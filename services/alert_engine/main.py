"""
Qilin — Motor de Alertas
Lee Redis Streams (stream:adsb, stream:ais), aplica reglas y genera alertas.
Notifica por Telegram y guarda en TimescaleDB.
"""

import asyncio
import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timezone

import asyncpg
import httpx
import redis.asyncio as aioredis

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ALERT] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL        = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL           = os.getenv("DB_URL", "")
TELEGRAM_TOKEN   = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# ─── ESTADO EN MEMORIA ────────────────────────────────────────────────────────
# Ventana de correlación: vehículos vistos en los últimos N segundos por zona
window: dict[str, list] = defaultdict(list)
WINDOW_SECONDS = 3600 * 6  # 6 horas


# ─── REGLAS ───────────────────────────────────────────────────────────────────

def rule_military_aircraft_surge(zone: str, aircraft_list: list) -> dict | None:
    """Dispara si hay 5 o más aeronaves militares en la misma zona."""
    military = [a for a in aircraft_list if a.get("category") == "military"]
    if len(military) >= 5:
        return {
            "zone":        zone,
            "severity":    "high",
            "rule":        "military_aircraft_surge",
            "title":       f"Concentración aeronaves militares — {zone}",
            "description": f"{len(military)} aeronaves militares detectadas en zona {zone}.",
            "entities":    [{"type": "aircraft", "id": a["icao24"], "callsign": a.get("callsign")} for a in military],
        }
    return None


def rule_ais_dark(zone: str, vessels: list) -> dict | None:
    """Dispara si un petrolero o buque desconocido ha desactivado AIS en zona estratégica."""
    dark = [v for v in vessels if not v.get("ais_active") and v.get("category") in ("tanker", "unknown")]
    if dark:
        return {
            "zone":        zone,
            "severity":    "medium",
            "rule":        "ais_dark_vessel",
            "title":       f"Buque con AIS desactivado — {zone}",
            "description": f"{len(dark)} embarcación(es) han desaparecido del radar AIS en zona {zone}.",
            "entities":    [{"type": "vessel", "id": v["mmsi"], "name": v.get("name")} for v in dark],
        }
    return None


def rule_naval_group(zone: str, vessels: list) -> dict | None:
    """Dispara si hay 3 o más buques militares en la misma zona (posible grupo de combate)."""
    naval = [v for v in vessels if v.get("category") == "military"]
    if len(naval) >= 3:
        return {
            "zone":        zone,
            "severity":    "high",
            "rule":        "naval_group_detected",
            "title":       f"Grupo naval detectado — {zone}",
            "description": f"{len(naval)} buques militares en zona {zone}. Posible grupo de combate.",
            "entities":    [{"type": "vessel", "id": v["mmsi"], "name": v.get("name")} for v in naval],
        }
    return None


def rule_asw_patrol(zone: str, aircraft_list: list) -> dict | None:
    """
    Detecta actividad antisubmarina: concentración de aviones de patrulla marítima.
    Callsigns conocidos: P-8 Poseidon (USN), P-3 Orion, ATL2 (Francia), MPA.
    """
    asw_keywords = ["MANTA", "JATO", "TRTN", "POSEI", "ORION", "NEPTUN"]
    asw = [
        a for a in aircraft_list
        if a.get("callsign") and any(kw in (a["callsign"] or "").upper() for kw in asw_keywords)
    ]
    if len(asw) >= 2:
        return {
            "zone":        zone,
            "severity":    "high",
            "rule":        "asw_patrol_activity",
            "title":       f"Actividad antisubmarina detectada — {zone}",
            "description": f"{len(asw)} aviones de patrulla ASW en zona {zone}. Posible actividad submarina.",
            "entities":    [{"type": "aircraft", "id": a["icao24"], "callsign": a.get("callsign")} for a in asw],
        }
    return None


RULES_AIRCRAFT = [rule_military_aircraft_surge, rule_asw_patrol]
RULES_VESSELS  = [rule_ais_dark, rule_naval_group]


# ─── NOTIFICACIONES ───────────────────────────────────────────────────────────

async def send_telegram(alert: dict):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    severity_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(alert["severity"], "⚪")
    text = (
        f"{severity_icon} *{alert['title']}*\n"
        f"Zona: `{alert['zone']}`\n"
        f"{alert['description']}"
    )
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    async with httpx.AsyncClient() as client:
        try:
            await client.post(url, json={
                "chat_id":    TELEGRAM_CHAT_ID,
                "text":       text,
                "parse_mode": "Markdown",
            }, timeout=10)
        except Exception as e:
            log.warning(f"Error enviando Telegram: {e}")


async def save_alert(db: asyncpg.Connection, alert: dict):
    await db.execute(
        """
        INSERT INTO alerts (zone, severity, rule, title, description, entities)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        alert["zone"],
        alert["severity"],
        alert["rule"],
        alert["title"],
        alert.get("description"),
        json.dumps(alert.get("entities", [])),
    )


async def process_alert(db: asyncpg.Connection, alert: dict):
    log.info(f"[{alert['severity'].upper()}] {alert['title']}")
    await save_alert(db, alert)
    await send_telegram(alert)


# ─── PROCESAMIENTO DE STREAMS ─────────────────────────────────────────────────

async def consume_stream(redis, db, stream: str, last_id: str = "0") -> str:
    results = await redis.xread({stream: last_id}, count=100, block=1000)
    if not results:
        return last_id

    for _, messages in results:
        for msg_id, msg in messages:
            try:
                data = json.loads(msg["data"])
                zone = data.get("zone", "unknown")

                # Guardar en ventana de correlación
                window[f"{stream}:{zone}"].append(data)

                # Evaluar reglas según tipo de stream
                if stream == "stream:adsb":
                    aircraft_in_zone = window[f"stream:adsb:{zone}"][-50:]
                    for rule in RULES_AIRCRAFT:
                        alert = rule(zone, aircraft_in_zone)
                        if alert:
                            await process_alert(db, alert)

                elif stream == "stream:ais":
                    vessels_in_zone = window[f"stream:ais:{zone}"][-50:]
                    for rule in RULES_VESSELS:
                        alert = rule(zone, vessels_in_zone)
                        if alert:
                            await process_alert(db, alert)

            except Exception as e:
                log.error(f"Error procesando mensaje: {e}")

            last_id = msg_id

    return last_id


# ─── MAIN ─────────────────────────────────────────────────────────────────────

async def main():
    log.info("Qilin Alert Engine arrancando...")
    redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    db    = await asyncpg.connect(DB_URL)

    last_ids = {"stream:adsb": "$", "stream:ais": "$"}

    while True:
        for stream in last_ids:
            last_ids[stream] = await consume_stream(redis, db, stream, last_ids[stream])
        await asyncio.sleep(0.1)


if __name__ == "__main__":
    asyncio.run(main())
