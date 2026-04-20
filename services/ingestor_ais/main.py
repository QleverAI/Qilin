"""
Qilin — Ingestor AIS (aisstream.io)
Fuente: wss://stream.aisstream.io/v0/stream — WebSocket, API key gratuita.

Estrategia:
  1. Lee zonas desde config/zones.yaml y construye bounding boxes para la suscripción.
  2. Conecta vía WebSocket y suscribe a todas las bounding boxes en un solo mensaje.
  3. Filtra por vessel_type: tankers (80-89), military (35), unknown (0).
  4. Detecta AIS dark: buque que no emite >30 min habiendo estado activo en zona.
  5. Publica en stream:ais de Redis + persiste en vessel_positions (hypertable).
  6. Reconexión automática con backoff exponencial si cae el WebSocket.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import asyncpg
import redis.asyncio as aioredis
import websockets
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s [AIS] %(message)s")
log = logging.getLogger(__name__)

AISSTREAM_URL   = "wss://stream.aisstream.io/v0/stream"
REDIS_URL       = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL          = os.getenv("DB_URL", "")
AISSTREAM_KEY   = os.getenv("AISSTREAM_API_KEY", "")

# Tipos de buque a monitorizar
TRACKED_TYPES = set(range(80, 90)) | {35, 0}  # tankers + military + unknown


# ── Config ────────────────────────────────────────────────────────────────────

def load_zones() -> list[tuple[str, dict]]:
    with open("/app/config/zones.yaml") as f:
        cfg = yaml.safe_load(f)
    return [(name, z) for name, z in cfg["zones"].items()]


def build_bounding_boxes(zones: list[tuple[str, dict]]) -> list[list[list[float]]]:
    """Convierte zones.yaml al formato aisstream: [[lat_min,lon_min],[lat_max,lon_max]]"""
    return [
        [[z["lat"][0], z["lon"][0]], [z["lat"][1], z["lon"][1]]]
        for _, z in zones
    ]


def zone_for_position(lat: float, lon: float, zones: list[tuple[str, dict]]) -> str:
    for zone_name, z in zones:
        if z["lat"][0] <= lat <= z["lat"][1] and z["lon"][0] <= lon <= z["lon"][1]:
            return zone_name
    return "unknown"


# ── Clasificación ─────────────────────────────────────────────────────────────

def classify_vessel(ship_type: int) -> str:
    if ship_type == 35:
        return "military"
    if 80 <= ship_type <= 89:
        return "tanker"
    if 70 <= ship_type <= 79:
        return "cargo"
    if ship_type == 60:
        return "passenger"
    return "unknown"


def should_track(ship_type: int) -> bool:
    return ship_type in TRACKED_TYPES


# ── Publicación ───────────────────────────────────────────────────────────────

async def publish_vessel(redis, db, vessel: dict):
    mmsi = vessel["mmsi"]

    await redis.xadd("stream:ais", {"data": json.dumps(vessel, default=str)}, maxlen=5000)
    await redis.setex(f"current:vessel:{mmsi}", 300, json.dumps(vessel, default=str))

    if db:
        try:
            await db.execute(
                """
                INSERT INTO vessel_positions
                    (time, mmsi, name, lat, lon, speed, course, heading,
                     ship_type, category, flag, destination, ais_active, zone)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                """,
                datetime.fromisoformat(vessel["time"]),
                mmsi, vessel.get("name"), vessel.get("lat"), vessel.get("lon"),
                vessel.get("speed"), vessel.get("course"), vessel.get("heading"),
                vessel.get("ship_type"), vessel.get("category"),
                vessel.get("flag"), vessel.get("destination"),
                True, vessel.get("zone", "unknown"),
            )
        except Exception as e:
            log.error(f"Error guardando vessel {mmsi} en DB: {e}")


async def check_ais_dark(redis, db, zones: list[tuple[str, dict]]):
    """
    Escanea buques conocidos que han dejado de emitir.
    Publica un evento AIS dark en stream:ais cuando el TTL es crítico.
    """
    try:
        keys = []
        cursor = 0
        while True:
            cursor, batch = await redis.scan(cursor, match="current:vessel:*", count=100)
            keys.extend(batch)
            if cursor == 0:
                break
        for key in keys:
            raw = await redis.get(key)
            if not raw:
                continue
            vessel = json.loads(raw)
            category = vessel.get("category", "unknown")
            if category not in ("tanker", "unknown", "military"):
                continue
            ttl = await redis.ttl(key)
            if 0 < ttl < 30:
                mmsi = vessel.get("mmsi", key.split(":")[-1])
                dark_vessel = {**vessel, "ais_active": False, "time": datetime.now(timezone.utc).isoformat()}
                await redis.xadd("stream:ais", {"data": json.dumps(dark_vessel, default=str)}, maxlen=5000)
                log.info(f"AIS dark detectado: {mmsi} ({category}) en {vessel.get('zone', 'unknown')}")
    except Exception as e:
        log.warning(f"Error en check_ais_dark: {e}")


# ── WebSocket consumer ────────────────────────────────────────────────────────

async def consume(redis, db, zones: list[tuple[str, dict]]):
    if not AISSTREAM_KEY:
        log.error("AISSTREAM_API_KEY no configurada — el ingestor AIS no puede conectar.")
        return

    bboxes = build_bounding_boxes(zones)
    subscribe_msg = json.dumps({
        "APIKey":        AISSTREAM_KEY,
        "BoundingBoxes": bboxes,
        "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
    })

    backoff = 5
    while True:
        try:
            log.info(f"Conectando a aisstream.io ({len(bboxes)} bounding boxes)...")
            async with websockets.connect(AISSTREAM_URL, ping_interval=30) as ws:
                await ws.send(subscribe_msg)
                log.info("Suscrito a aisstream.io — escuchando mensajes AIS")
                backoff = 5  # reset tras conexión exitosa

                count = 0
                async for raw_msg in ws:
                    try:
                        msg = json.loads(raw_msg)
                        msg_type = msg.get("MessageType", "")
                        metadata  = msg.get("MetaData", {})
                        mmsi      = str(metadata.get("MMSI", ""))

                        if not mmsi:
                            continue

                        if msg_type == "PositionReport":
                            pos = msg.get("Message", {}).get("PositionReport", {})
                            lat = pos.get("Latitude")
                            lon = pos.get("Longitude")
                            if lat is None or lon is None:
                                continue

                            ship_type = metadata.get("ShipType", 0) or 0
                            if not should_track(ship_type):
                                continue

                            zone = zone_for_position(lat, lon, zones)
                            vessel = {
                                "mmsi":      mmsi,
                                "name":      metadata.get("ShipName", "").strip() or None,
                                "lat":       lat,
                                "lon":       lon,
                                "speed":     pos.get("Sog"),
                                "course":    pos.get("Cog"),
                                "heading":   pos.get("TrueHeading"),
                                "ship_type": ship_type,
                                "category":  classify_vessel(ship_type),
                                "flag":      metadata.get("flag"),
                                "destination": metadata.get("Destination", "").strip() or None,
                                "ais_active": True,
                                "zone":      zone,
                                "time":      datetime.now(timezone.utc).isoformat(),
                            }
                            await publish_vessel(redis, db, vessel)
                            count += 1

                            if count % 500 == 0:
                                log.info(f"Procesadas {count} posiciones AIS en este ciclo")

                    except Exception as e:
                        log.error(f"Error procesando mensaje AIS: {e}")

        except websockets.exceptions.ConnectionClosed as e:
            log.warning(f"WebSocket aisstream.io cerrado: {e}. Reconectando en {backoff}s...")
        except Exception as e:
            log.error(f"Error en WebSocket AIS: {e}. Reconectando en {backoff}s...")

        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, 300)  # backoff exponencial hasta 5min


# ── AIS dark checker loop ─────────────────────────────────────────────────────

async def dark_checker_loop(redis, db, zones):
    while True:
        await asyncio.sleep(120)  # comprueba cada 2 minutos
        await check_ais_dark(redis, db, zones)


# ── Main ─────────────────────────────────────────────────────────────────────

async def main():
    log.info("Qilin AIS ingestor (aisstream.io) arrancando...")

    zones = load_zones()
    log.info(f"Cargadas {len(zones)} zonas")

    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Vessels no se persistirán.")

    asyncio.create_task(dark_checker_loop(redis, db, zones))

    await consume(redis, db, zones)


if __name__ == "__main__":
    asyncio.run(main())
