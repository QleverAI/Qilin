"""
Qilin — Report Builder
Fetches data from TimescaleDB and builds the report data dict
for PDF generation. Calls Claude Sonnet for executive summary.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta

import anthropic
import asyncpg
import yaml

log = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
LLM_MODEL         = "claude-sonnet-4-6"
MAX_ALERTS        = 100  # cap to keep PDF under 20 pages


# ── Pure helpers (testable without DB) ───────────────────────────────────────

def severity_label(score: int) -> str:
    if score >= 7:
        return "high"
    if score >= 4:
        return "medium"
    return "low"


def generate_activity_svg(daily_counts: list[int], width: int = 200, height: int = 50) -> str:
    """Returns inline SVG bar chart for a list of daily activity counts."""
    if not daily_counts or max(daily_counts, default=0) == 0:
        return (
            f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">'
            f'<text x="10" y="30" fill="#aaa" font-size="11" font-family="Arial">Sin datos</text>'
            f'</svg>'
        )

    max_val = max(daily_counts)
    n = len(daily_counts)
    bar_w = width / n
    pad = 1.5
    bars = []
    for i, count in enumerate(daily_counts):
        bar_h = int((count / max_val) * (height - 8)) if max_val > 0 else 0
        x = i * bar_w + pad
        y = height - bar_h - 4
        w = max(bar_w - pad * 2, 1)
        color = "#c0392b" if count == max_val else "#3498db"
        bars.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" '
            f'height="{bar_h}" fill="{color}" rx="2"/>'
        )

    return (
        f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">'
        + "".join(bars)
        + "</svg>"
    )


def load_zone_labels() -> dict[str, str]:
    """Returns {zone_id: label} from zones.yaml."""
    try:
        with open("/app/config/zones.yaml") as f:
            cfg = yaml.safe_load(f)
        return {k: v.get("label", k) for k, v in cfg.get("zones", {}).items()}
    except Exception as e:
        log.warning(f"[REPORT] Error leyendo zones.yaml: {e}")
        return {}


# ── DB queries ────────────────────────────────────────────────────────────────

async def fetch_alerts(db, period_start: datetime, period_end: datetime) -> list[dict]:
    try:
        rows = await db.fetch(
            """
            SELECT id, time, zone, severity, rule, title, description,
                   entities,
                   (entities::jsonb->>'severity_score')::int  AS severity_score,
                   entities::jsonb->>'context_summary'        AS context_summary
            FROM alerts
            WHERE time >= $1 AND time < $2
            ORDER BY
                COALESCE((entities::jsonb->>'severity_score')::int, 0) DESC,
                time DESC
            LIMIT $3
            """,
            period_start, period_end, MAX_ALERTS,
        )
        return [dict(r) for r in rows]
    except Exception as e:
        log.error(f"[REPORT] Error fetching alerts: {e}")
        return []


async def fetch_zone_aircraft_stats(db, zone: str, period_start: datetime, period_end: datetime, days: int) -> dict:
    """Returns daily aircraft counts and totals for a zone."""
    try:
        rows = await db.fetch(
            """
            SELECT DATE_TRUNC('day', time) AS day, COUNT(*) AS cnt
            FROM aircraft_positions
            WHERE zone = $1 AND time >= $2 AND time < $3
              AND category = 'military'
            GROUP BY day ORDER BY day
            """,
            zone, period_start, period_end,
        )
        # Build a full list of days (zero-fill gaps)
        day_map: dict = {r["day"].date(): int(r["cnt"]) for r in rows}
        daily = []
        for i in range(days):
            d = (period_start + timedelta(days=i)).date()
            daily.append(day_map.get(d, 0))
        return {"daily": daily, "total": sum(daily)}
    except Exception as e:
        log.warning(f"[REPORT] Error fetching aircraft stats for {zone}: {e}")
        return {"daily": [0] * days, "total": 0}


async def fetch_zone_vessel_stats(db, zone: str, period_start: datetime, period_end: datetime) -> dict:
    try:
        row = await db.fetchrow(
            """
            SELECT
                COUNT(*)                                          AS total,
                COUNT(*) FILTER (WHERE ais_active = FALSE)       AS dark_count
            FROM vessel_positions
            WHERE zone = $1 AND time >= $2 AND time < $3
            """,
            zone, period_start, period_end,
        )
        return {
            "total":      int(row["total"]) if row else 0,
            "dark_count": int(row["dark_count"]) if row else 0,
        }
    except Exception as e:
        log.warning(f"[REPORT] Error fetching vessel stats for {zone}: {e}")
        return {"total": 0, "dark_count": 0}


async def fetch_zone_prev_aircraft(db, zone: str, prev_start: datetime, prev_end: datetime) -> int:
    """Aircraft count for the previous period (for % change comparison)."""
    try:
        row = await db.fetchrow(
            "SELECT COUNT(*) AS cnt FROM aircraft_positions WHERE zone=$1 AND time>=$2 AND time<$3 AND category='military'",
            zone, prev_start, prev_end,
        )
        return int(row["cnt"]) if row else 0
    except Exception:
        return 0


async def fetch_sentinel_anomalies(db, period_start: datetime, period_end: datetime) -> list[dict]:
    try:
        rows = await db.fetch(
            """
            SELECT zone_id, product, mean_value, anomaly_ratio, time
            FROM sentinel_observations
            WHERE time >= $1 AND time < $2 AND anomaly_ratio >= 1.5
            ORDER BY anomaly_ratio DESC LIMIT 20
            """,
            period_start, period_end,
        )
        return [dict(r) for r in rows]
    except Exception as e:
        log.warning(f"[REPORT] Error fetching sentinel anomalies: {e}")
        return []


async def fetch_top_news(db, period_start: datetime, period_end: datetime) -> list[dict]:
    try:
        rows = await db.fetch(
            """
            SELECT title, source, url, summary, severity, relevance, zones, time
            FROM news_events
            WHERE time >= $1 AND time < $2
            ORDER BY relevance DESC, time DESC
            LIMIT 10
            """,
            period_start, period_end,
        )
        return [dict(r) for r in rows]
    except Exception as e:
        log.warning(f"[REPORT] Error fetching news: {e}")
        return []


async def fetch_social_highlights(db, period_start: datetime, period_end: datetime) -> list[dict]:
    try:
        rows = await db.fetch(
            """
            SELECT handle, display, content, likes, retweets, url, time
            FROM social_posts
            WHERE time >= $1 AND time < $2
            ORDER BY (likes + retweets * 2) DESC
            LIMIT 5
            """,
            period_start, period_end,
        )
        return [dict(r) for r in rows]
    except Exception as e:
        log.warning(f"[REPORT] Error fetching social highlights: {e}")
        return []


async def fetch_ingestor_stats(db, period_start: datetime, period_end: datetime) -> dict:
    """Returns approximate record counts per source table."""
    counts = {}
    tables = {
        "adsb":     ("aircraft_positions",    "time"),
        "ais":      ("vessel_positions",       "time"),
        "news":     ("news_events",            "time"),
        "social":   ("social_posts",           "time"),
        "docs":     ("documents",              "discovered_at"),
        "sec":      ("sec_filings",            "discovered_at"),
        "sentinel": ("sentinel_observations",  "time"),
    }
    for label, (table, col) in tables.items():
        try:
            row = await db.fetchrow(
                f"SELECT COUNT(*) AS cnt FROM {table} WHERE {col} >= $1 AND {col} < $2",
                period_start, period_end,
            )
            counts[label] = int(row["cnt"]) if row else 0
        except Exception:
            counts[label] = -1  # -1 indicates table may not exist yet
    return counts


# ── LLM executive summary ─────────────────────────────────────────────────────

async def generate_executive_summary(
    report_type: str,
    period_start: datetime,
    period_end: datetime,
    alerts: list[dict],
    zone_stats: dict,
    sentinel_anomalies: list[dict],
    top_news: list[dict],
) -> str:
    """Calls Claude Sonnet to write the executive summary (3-4 paragraphs)."""
    if not ANTHROPIC_API_KEY:
        log.warning("[REPORT] ANTHROPIC_API_KEY no configurada — executive summary omitido")
        return "Resumen ejecutivo no disponible (ANTHROPIC_API_KEY no configurada)."

    fmt = "%Y-%m-%d %H:%M UTC"

    alert_summary = "\n".join(
        f"- [{a.get('severity', '?').upper()}] {a.get('title', '')} (zona: {a.get('zone', '?')})"
        for a in alerts[:20]
    ) or "Sin alertas en el periodo."

    zone_summary = "\n".join(
        f"- {data['label']}: {data['aircraft_total']} aeronaves militares, "
        f"{data['vessel_total']} buques ({data['vessel_dark']} AIS dark)"
        for data in list(zone_stats.values())[:10]
        if data["aircraft_total"] + data["vessel_total"] > 0
    ) or "Sin actividad significativa por zonas."

    sentinel_summary = "\n".join(
        f"- {a['zone_id']} — {a['product']} anomaly ratio {a['anomaly_ratio']:.1f}x"
        for a in sentinel_anomalies[:5]
    ) or "Sin anomalías satelitales detectadas."

    news_summary = "\n".join(
        f"- {n['title']} ({n['source']})"
        for n in top_news[:5]
    ) or "Sin noticias relevantes."

    prompt = f"""Eres un analista de inteligencia geopolítica senior. Redacta el resumen ejecutivo de un informe de inteligencia de tipo {report_type.upper()} para el periodo {period_start.strftime(fmt)} a {period_end.strftime(fmt)}.

DATOS DEL PERIODO:

ALERTAS ({len(alerts)} total):
{alert_summary}

ACTIVIDAD POR ZONAS:
{zone_summary}

ANOMALÍAS SATELITALES SENTINEL-5P:
{sentinel_summary}

NOTICIAS DESTACADAS:
{news_summary}

Escribe exactamente 3-4 párrafos en español que cubran:
1. Los eventos más significativos del periodo y su contexto geopolítico
2. Tendencias observadas y patrones de actividad por zona
3. Correlaciones entre señales (si las hay: atmosféricas, marítimas, aéreas, medios)
4. Outlook para las próximas {"24 horas" if report_type == "daily" else "72 horas"}

Tono: profesional, conciso, analítico. No uses bullets. No repitas los datos brutos — interprétalos."""

    try:
        aclient = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        response = await aclient.messages.create(
            model=LLM_MODEL,
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except Exception as e:
        log.error(f"[REPORT] Error generando executive summary: {e}")
        return f"Error generando resumen ejecutivo: {e}"


# ── Main builder function ─────────────────────────────────────────────────────

async def build_report_data(
    db,
    period_start: datetime,
    period_end: datetime,
    report_type: str,   # "daily" or "weekly"
) -> dict:
    """
    Fetches all data from TimescaleDB, calls LLM, and assembles the full
    report data dict consumed by pdf_generator.py.
    """
    days = max(1, (period_end - period_start).days)
    zone_labels = load_zone_labels()

    # Previous period for % change
    prev_delta = period_end - period_start
    prev_start = period_start - prev_delta
    prev_end   = period_start

    log.info(f"[REPORT] Fetching data for {report_type} report ({period_start.date()} → {period_end.date()})")

    alerts, sentinel_anomalies, top_news, social_highlights, ingestor_stats = await asyncio.gather(
        fetch_alerts(db, period_start, period_end),
        fetch_sentinel_anomalies(db, period_start, period_end),
        fetch_top_news(db, period_start, period_end),
        fetch_social_highlights(db, period_start, period_end),
        fetch_ingestor_stats(db, period_start, period_end),
    )

    # Per-zone stats
    zone_stats = {}
    for zone_id, label in zone_labels.items():
        aircraft, vessels, prev_aircraft = await asyncio.gather(
            fetch_zone_aircraft_stats(db, zone_id, period_start, period_end, days),
            fetch_zone_vessel_stats(db, zone_id, period_start, period_end),
            fetch_zone_prev_aircraft(db, zone_id, prev_start, prev_end),
        )
        aircraft_total = aircraft["total"]
        change_pct = None
        if prev_aircraft > 0:
            change_pct = round((aircraft_total - prev_aircraft) / prev_aircraft * 100, 1)

        zone_stats[zone_id] = {
            "label":          label,
            "aircraft_total": aircraft_total,
            "aircraft_daily": aircraft["daily"],
            "aircraft_svg":   generate_activity_svg(aircraft["daily"]),
            "vessel_total":   vessels["total"],
            "vessel_dark":    vessels["dark_count"],
            "change_pct":     change_pct,
        }

    # Executive summary (LLM)
    executive_summary = await generate_executive_summary(
        report_type, period_start, period_end,
        alerts, zone_stats, sentinel_anomalies, top_news,
    )

    top_severity = max((a.get("severity_score") or 0 for a in alerts), default=0)

    return {
        "report_type":        report_type,
        "period_start":       period_start,
        "period_end":         period_end,
        "generated_at":       datetime.now(timezone.utc),
        "executive_summary":  executive_summary,
        "alerts":             alerts,
        "alert_count":        len(alerts),
        "top_severity":       top_severity,
        "zone_stats":         zone_stats,
        "sentinel_anomalies": sentinel_anomalies,
        "top_news":           top_news,
        "social_highlights":  social_highlights,
        "ingestor_stats":     ingestor_stats,
    }
