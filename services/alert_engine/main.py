"""
Qilin — Motor de Alertas
Lee Redis Streams (stream:adsb, stream:ais), aplica reglas y genera alertas.
Notifica por Telegram (alerta inmediata + resumen diario a las 07:00 UTC).
"""

import asyncio
import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timezone, time as dtime

import anthropic
import asyncpg
import httpx
import redis.asyncio as aioredis

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ALERT] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL        = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL           = os.getenv("DB_URL", "")
TELEGRAM_TOKEN   = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ENRICH_MODEL      = "claude-haiku-4-5-20251001"

# Ventana de correlación en memoria: últimos vehículos por zona
window: dict[str, list] = defaultdict(list)
WINDOW_SECONDS = 3600 * 6  # 6 horas

# Anti-spam: no repetir la misma regla+zona más de 1 vez por hora
_fired: dict[str, float] = {}
COOLDOWN_SECONDS = 3600


# ── REGLAS ────────────────────────────────────────────────────────────────────

def rule_military_aircraft_surge(zone: str, aircraft_list: list) -> dict | None:
    military = [a for a in aircraft_list if a.get("category") == "military"]
    if len(military) >= 5:
        return {
            "zone":        zone,
            "severity":    "high",
            "rule":        "military_aircraft_surge",
            "title":       f"Concentración aeronaves militares — {zone.upper()}",
            "description": f"{len(military)} aeronaves militares detectadas en zona {zone}.",
            "entities":    [{"type":"aircraft","id":a["icao24"],"callsign":a.get("callsign")} for a in military],
        }


def rule_ais_dark(zone: str, vessels: list) -> dict | None:
    dark = [v for v in vessels if not v.get("ais_active") and v.get("category") in ("tanker","unknown")]
    if dark:
        return {
            "zone":        zone,
            "severity":    "medium",
            "rule":        "ais_dark_vessel",
            "title":       f"Buque con AIS desactivado — {zone.upper()}",
            "description": f"{len(dark)} embarcación(es) desaparecidas del radar AIS en zona {zone}.",
            "entities":    [{"type":"vessel","id":v["mmsi"],"name":v.get("name")} for v in dark],
        }


def rule_naval_group(zone: str, vessels: list) -> dict | None:
    naval = [v for v in vessels if v.get("category") == "military"]
    if len(naval) >= 3:
        return {
            "zone":        zone,
            "severity":    "high",
            "rule":        "naval_group_detected",
            "title":       f"Grupo naval detectado — {zone.upper()}",
            "description": f"{len(naval)} buques militares en zona {zone}. Posible grupo de combate.",
            "entities":    [{"type":"vessel","id":v["mmsi"],"name":v.get("name")} for v in naval],
        }


def rule_asw_patrol(zone: str, aircraft_list: list) -> dict | None:
    asw_keywords = ["MANTA","JATO","TRTN","POSEI","ORION","NEPTUN","POSDN","MARLIN"]
    asw = [
        a for a in aircraft_list
        if a.get("callsign") and any(kw in (a["callsign"] or "").upper() for kw in asw_keywords)
    ]
    if len(asw) >= 2:
        return {
            "zone":        zone,
            "severity":    "high",
            "rule":        "asw_patrol_activity",
            "title":       f"Actividad antisubmarina — {zone.upper()}",
            "description": f"{len(asw)} aviones patrulla ASW en zona {zone}. Posible actividad submarina.",
            "entities":    [{"type":"aircraft","id":a["icao24"],"callsign":a.get("callsign")} for a in asw],
        }


# ── LLM ENRICHMENT ────────────────────────────────────────────────────────────

async def _db_get_recent_news(db, zone: str, hours: int = 24) -> list[dict]:
    if not db:
        return []
    try:
        rows = await db.fetch(
            """
            SELECT title, source, severity, time::text
            FROM news_events
            WHERE $1 = ANY(zones)
              AND time > NOW() - ($2 * INTERVAL '1 hour')
            ORDER BY severity DESC, time DESC
            LIMIT 5
            """,
            zone, hours,
        )
        return [dict(r) for r in rows]
    except Exception as e:
        log.warning(f"[ENRICH] Error leyendo noticias: {e}")
        return []


async def _db_get_signal_history(db, zone: str, signal_type: str, days: int = 7) -> list[dict]:
    if not db:
        return []
    try:
        table = "aircraft_positions" if signal_type == "aircraft" else "vessel_positions"
        rows = await db.fetch(
            f"""
            SELECT zone, COUNT(*) as count, MAX(time)::text as last_seen
            FROM {table}
            WHERE zone = $1 AND time > NOW() - ($2 * INTERVAL '1 day')
            GROUP BY zone
            LIMIT 1
            """,
            zone, days,
        )
        return [dict(r) for r in rows]
    except Exception as e:
        log.warning(f"[ENRICH] Error leyendo historial de señales: {e}")
        return []


async def _db_get_active_vessels(db, zone: str) -> list[dict]:
    if not db:
        return []
    try:
        rows = await db.fetch(
            """
            SELECT mmsi, name, category, flag, time::text
            FROM vessel_positions
            WHERE zone = $1 AND time > NOW() - INTERVAL '6 hours'
            ORDER BY time DESC LIMIT 10
            """,
            zone,
        )
        return [dict(r) for r in rows]
    except Exception as e:
        log.warning(f"[ENRICH] Error leyendo vessels activos: {e}")
        return []


async def _db_get_sentinel_data(db, zone: str) -> list[dict]:
    if not db:
        return []
    try:
        rows = await db.fetch(
            """
            SELECT product, mean_value, anomaly_ratio, time::text
            FROM sentinel_observations
            WHERE zone_id = $1 AND time > NOW() - INTERVAL '24 hours'
            ORDER BY time DESC LIMIT 4
            """,
            zone,
        )
        return [dict(r) for r in rows]
    except Exception as e:
        log.warning(f"[ENRICH] Error leyendo datos Sentinel: {e}")
        return []


async def enrich_alert(alert: dict, db) -> dict:
    """
    Llama a Claude claude-haiku-4-5 con tool use para contextualizar la alerta.
    Devuelve el alert enriquecido con severity_score, context_summary,
    related_signals y confidence.
    Si ANTHROPIC_API_KEY no está configurada, devuelve el alert sin cambios
    con severity_score=5 (notificación por defecto).
    """
    if not ANTHROPIC_API_KEY:
        log.warning("[ENRICH] ANTHROPIC_API_KEY no configurada — enrichment omitido")
        return {**alert, "severity_score": 5, "confidence": "low",
                "context_summary": alert.get("description", ""), "related_signals": []}

    zone = alert.get("zone", "unknown")

    tools = [
        {
            "name": "get_recent_news",
            "description": "Obtiene noticias recientes relacionadas con una zona geopolítica.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "zone":  {"type": "string", "description": "ID de zona (ej: ukraine_black_sea)"},
                    "hours": {"type": "integer", "description": "Horas hacia atrás a buscar", "default": 24},
                },
                "required": ["zone"],
            },
        },
        {
            "name": "get_signal_history",
            "description": "Obtiene historial de señales (aeronaves o buques) en una zona.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "zone":        {"type": "string"},
                    "signal_type": {"type": "string", "enum": ["aircraft", "vessel"]},
                    "days":        {"type": "integer", "default": 7},
                },
                "required": ["zone", "signal_type"],
            },
        },
        {
            "name": "get_active_vessels",
            "description": "Lista los buques activos en una zona en las últimas 6 horas.",
            "input_schema": {
                "type": "object",
                "properties": {"zone": {"type": "string"}},
                "required": ["zone"],
            },
        },
        {
            "name": "get_sentinel_data",
            "description": "Obtiene lecturas recientes de emisiones Sentinel-5P para una zona.",
            "input_schema": {
                "type": "object",
                "properties": {"zone": {"type": "string"}},
                "required": ["zone"],
            },
        },
    ]

    system_prompt = (
        "Eres un analista de inteligencia geopolítica. Se te proporciona una alerta automática "
        "de un sistema de monitorización. Usa las herramientas disponibles para buscar contexto "
        "adicional y evalúa la alerta. Responde EXCLUSIVAMENTE con un JSON con esta estructura: "
        '{"severity_score": <1-10>, "confidence": "alta"|"media"|"baja", '
        '"context_summary": "<3-4 líneas>", "related_signals": [<lista de señales relacionadas>]}'
    )

    user_msg = (
        f"Evalúa esta alerta:\n\n"
        f"Regla: {alert.get('rule')}\n"
        f"Zona: {zone}\n"
        f"Severidad base: {alert.get('severity')}\n"
        f"Título: {alert.get('title')}\n"
        f"Descripción: {alert.get('description')}\n"
        f"Entidades: {json.dumps(alert.get('entities', []))}"
    )

    aclient = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    messages = [{"role": "user", "content": user_msg}]

    try:
        for _ in range(5):  # máximo 5 rondas de tool use
            response = await aclient.messages.create(
                model=ENRICH_MODEL,
                max_tokens=1024,
                system=system_prompt,
                tools=tools,
                messages=messages,
            )

            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, "text"):
                        try:
                            raw = block.text.strip()
                            if raw.startswith("```"):
                                raw = raw.split("```")[1]
                                if raw.startswith("json"):
                                    raw = raw[4:]
                                raw = raw.strip()
                            enrichment = json.loads(raw)
                            log.info(
                                f"[ENRICH] {alert.get('rule')} en {zone}: "
                                f"score={enrichment.get('severity_score')} "
                                f"confidence={enrichment.get('confidence')}"
                            )
                            return {**alert, **enrichment}
                        except json.JSONDecodeError:
                            pass
                break

            if response.stop_reason != "tool_use":
                break

            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                tool_name = block.name
                tool_input = block.input

                if tool_name == "get_recent_news":
                    result = await _db_get_recent_news(db, tool_input["zone"], tool_input.get("hours", 24))
                elif tool_name == "get_signal_history":
                    result = await _db_get_signal_history(db, tool_input["zone"], tool_input["signal_type"], tool_input.get("days", 7))
                elif tool_name == "get_active_vessels":
                    result = await _db_get_active_vessels(db, tool_input["zone"])
                elif tool_name == "get_sentinel_data":
                    result = await _db_get_sentinel_data(db, tool_input["zone"])
                else:
                    result = []

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result, default=str),
                })

            if not tool_results:
                break
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

    except Exception as e:
        log.error(f"[ENRICH] Error en Claude enrichment: {e}")

    log.warning(f"[ENRICH] Enriquecimiento no completado para {alert.get('rule')} en {alert.get('zone')} — usando score neutro")
    return {**alert, "severity_score": 5, "confidence": "low",
            "context_summary": alert.get("description", ""), "related_signals": []}


def rule_sentinel_anomaly(zone: str, data: dict) -> dict | None:
    ratio = data.get("anomaly_ratio")
    product = data.get("product", "?")
    if ratio and ratio >= 1.5:
        return {
            "zone":        zone,
            "severity":    "medium" if ratio < 2.5 else "high",
            "rule":        "sentinel_atmospheric_anomaly",
            "title":       f"Anomalía atmosférica {product} — {zone.upper()}",
            "description": f"Concentración de {product} en zona {zone}: {ratio:.1f}x el baseline histórico.",
            "entities":    [{"type": "sentinel", "product": product, "anomaly_ratio": ratio}],
        }


RULES_AIRCRAFT = [rule_military_aircraft_surge, rule_asw_patrol]
RULES_VESSELS  = [rule_ais_dark, rule_naval_group]


# ── TELEGRAM ──────────────────────────────────────────────────────────────────

async def _tg_post(client: httpx.AsyncClient, text: str, silent: bool = False):
    """Envía un mensaje a Telegram. silent=True para el resumen diario."""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        resp = await client.post(url, json={
            "chat_id":              TELEGRAM_CHAT_ID,
            "text":                 text,
            "parse_mode":           "HTML",
            "disable_notification": silent,
        }, timeout=10)
        if resp.status_code != 200:
            log.warning(f"Telegram HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log.warning(f"Error enviando Telegram: {e}")


async def send_alert_telegram(alert: dict):
    """Notificación inmediata. Usa context_summary del enrichment si disponible."""
    severity_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(alert["severity"], "⚪")
    now = datetime.now(timezone.utc).strftime("%H:%M UTC")
    score = alert.get("severity_score", "?")
    confidence = alert.get("confidence", "?")

    description = alert.get("context_summary") or alert.get("description", "")

    related = alert.get("related_signals", [])
    related_text = ""
    if related:
        items = related[:3]
        related_text = "\n\n<b>Señales relacionadas:</b>\n" + "\n".join(f"• {s}" for s in items)

    text = (
        f"{severity_icon} <b>{alert['title']}</b>\n"
        f"🕐 {now}  |  📍 {alert['zone']}  |  Score: {score}/10 ({confidence})\n\n"
        f"{description}"
        f"{related_text}"
    )
    async with httpx.AsyncClient() as client:
        await _tg_post(client, text)


async def send_daily_summary(db: asyncpg.Connection | None):
    """Resumen de las últimas 24h. Se envía cada día a las 07:00 UTC."""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return

    counts = {"high": 0, "medium": 0, "low": 0}
    recent_alerts = []

    if db:
        try:
            rows = await db.fetch(
                "SELECT severity, title, zone FROM alerts "
                "WHERE time > NOW() - INTERVAL '24 hours' "
                "ORDER BY time DESC LIMIT 20"
            )
            for r in rows:
                counts[r["severity"]] = counts.get(r["severity"], 0) + 1
                if len(recent_alerts) < 5:
                    recent_alerts.append(f"• [{r['severity'].upper()}] {r['title']} ({r['zone']})")
        except Exception as e:
            log.warning(f"Error leyendo alertas para resumen: {e}")

    total = sum(counts.values())
    date  = datetime.now(timezone.utc).strftime("%d/%m/%Y")

    lines = [
        f"📊 <b>Resumen Qilin — {date}</b>",
        f"Últimas 24h: <b>{total} alertas</b>  "
        f"🔴 {counts['high']}  🟡 {counts['medium']}  🟢 {counts['low']}",
    ]
    if recent_alerts:
        lines.append("\n<b>Alertas destacadas:</b>")
        lines.extend(recent_alerts)
    else:
        lines.append("\nSin alertas en las últimas 24h.")

    lines.append("\n🌐 <i>qilin · geopolitical intelligence</i>")

    async with httpx.AsyncClient() as client:
        await _tg_post(client, "\n".join(lines), silent=True)

    log.info("Resumen diario enviado a Telegram.")


# ── PERSISTENCIA ─────────────────────────────────────────────────────────────

async def save_alert(db: asyncpg.Connection | None, alert: dict):
    if not db:
        return
    try:
        await db.execute(
            """
            INSERT INTO alerts (zone, severity, rule, title, description, entities)
            VALUES ($1,$2,$3,$4,$5,$6)
            """,
            alert["zone"],
            alert["severity"],
            alert["rule"],
            alert["title"],
            alert.get("description"),
            json.dumps(alert.get("entities", [])),
        )
    except Exception as e:
        log.error(f"Error guardando alerta en DB: {e}")


async def publish_alert(redis, alert: dict):
    """Publica la alerta en stream:alerts para que la API la envíe por WebSocket."""
    await redis.xadd("stream:alerts", {"data": json.dumps(alert)}, maxlen=500)


# ── ANTI-SPAM ────────────────────────────────────────────────────────────────

def _can_fire(rule: str, zone: str) -> bool:
    key = f"{rule}:{zone}"
    now = asyncio.get_event_loop().time()
    if key in _fired and (now - _fired[key]) < COOLDOWN_SECONDS:
        return False
    _fired[key] = now
    return True


# ── PROCESAMIENTO ────────────────────────────────────────────────────────────

async def process_alert(redis, db, alert: dict):
    if not _can_fire(alert["rule"], alert["zone"]):
        return

    enriched = await enrich_alert(alert, db)
    score = enriched.get("severity_score", 5)

    log.info(
        f"[ENRICH] [{alert['severity'].upper()}] {alert['title']} "
        f"— score={score} confidence={enriched.get('confidence','?')}"
    )

    if score < 4:
        log.info(f"[ENRICH] Alerta descartada (score={score} < 4): {alert['title']}")
        return

    await save_alert(db, enriched)
    await publish_alert(redis, enriched)

    if score >= 7:
        await send_alert_telegram(enriched)
    else:
        log.info(f"[ENRICH] Alerta guardada sin notificar Telegram (score={score}): {alert['title']}")


async def consume_stream(redis, db, stream: str, last_id: str) -> str:
    results = await redis.xread({stream: last_id}, count=100, block=1000)
    if not results:
        return last_id

    for _, messages in results:
        for msg_id, msg in messages:
            try:
                data = json.loads(msg["data"])
                zone = data.get("zone", "unknown")
                key  = f"{stream}:{zone}"

                # Añadir a ventana y limpiar entradas antiguas
                data["_ts"] = asyncio.get_event_loop().time()
                window[key].append(data)
                cutoff = asyncio.get_event_loop().time() - WINDOW_SECONDS
                window[key] = [
                    e for e in window[key]
                    if e.get("_ts", 0) > cutoff
                ]

                if stream == "stream:adsb":
                    for rule in RULES_AIRCRAFT:
                        alert = rule(zone, window[key][-100:])
                        if alert:
                            await process_alert(redis, db, alert)

                elif stream == "stream:ais":
                    for rule in RULES_VESSELS:
                        alert = rule(zone, window[key][-100:])
                        if alert:
                            await process_alert(redis, db, alert)

                elif stream == "stream:sentinel":
                    alert = rule_sentinel_anomaly(zone, data)
                    if alert:
                        await process_alert(redis, db, alert)

            except Exception as e:
                log.error(f"Error procesando mensaje {msg_id}: {e}")

            last_id = msg_id

    return last_id


# ── SCHEDULER RESUMEN DIARIO ──────────────────────────────────────────────────

async def daily_summary_scheduler(db):
    """Espera hasta las 07:00 UTC y envía el resumen cada 24h."""
    while True:
        now  = datetime.now(timezone.utc)
        target = now.replace(hour=7, minute=0, second=0, microsecond=0)
        if now >= target:
            from datetime import timedelta
            target = (target + timedelta(days=1)).replace(hour=7, minute=0, second=0, microsecond=0)
        wait = (target - now).total_seconds()
        log.info(f"Próximo resumen diario en {wait/3600:.1f}h ({target.strftime('%H:%M UTC %d/%m')})")
        await asyncio.sleep(wait)
        await send_daily_summary(db)


# ── MAIN ─────────────────────────────────────────────────────────────────────

async def main():
    log.info("Qilin Alert Engine arrancando...")

    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Alertas no se persistirán.")

    last_ids = {"stream:adsb": "$", "stream:ais": "$", "stream:sentinel": "$"}

    # Lanzar scheduler de resumen diario en background
    asyncio.create_task(daily_summary_scheduler(db))

    log.info("Escuchando streams de datos...")
    while True:
        for stream in list(last_ids.keys()):
            last_ids[stream] = await consume_stream(redis, db, stream, last_ids[stream])
        await asyncio.sleep(0.1)


if __name__ == "__main__":
    asyncio.run(main())
