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

import asyncpg
import httpx
import redis.asyncio as aioredis

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ALERT] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL        = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL           = os.getenv("DB_URL", "")
TELEGRAM_TOKEN   = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

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
    """Notificación inmediata al disparar una alerta."""
    severity_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(alert["severity"], "⚪")
    now = datetime.now(timezone.utc).strftime("%H:%M UTC")
    text = (
        f"{severity_icon} <b>{alert['title']}</b>\n"
        f"🕐 {now}  |  📍 {alert['zone']}\n\n"
        f"{alert['description']}"
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
    log.info(f"[{alert['severity'].upper()}] {alert['title']}")
    await save_alert(db, alert)
    await publish_alert(redis, alert)
    await send_alert_telegram(alert)


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
            target = target.replace(day=target.day + 1)
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

    last_ids = {"stream:adsb": "$", "stream:ais": "$"}

    # Lanzar scheduler de resumen diario en background
    asyncio.create_task(daily_summary_scheduler(db))

    log.info("Escuchando streams de datos...")
    while True:
        for stream in list(last_ids.keys()):
            last_ids[stream] = await consume_stream(redis, db, stream, last_ids[stream])
        await asyncio.sleep(0.1)


if __name__ == "__main__":
    asyncio.run(main())
