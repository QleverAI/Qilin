"""
Qilin — Ingestor AIS
Fuente: AISHub API (requiere cuenta gratuita y receptor propio)
Publica posiciones de embarcaciones en Redis Streams filtradas por zonas.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s [AIS] %(message)s")
log = logging.getLogger(__name__)

AISHUB_URL    = "https://data.aishub.net/ws.php"
REDIS_URL     = os.getenv("REDIS_URL", "redis://localhost:6379")
AISHUB_USER   = os.getenv("AISHUB_USER", "")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "60"))

# Tipos de barco AIS considerados militares/gobierno
MILITARY_TYPES = {35, 36}  # 35=military, 36=law enforcement


def load_zones() -> list[dict]:
    with open("/app/config/zones.yaml") as f:
        cfg = yaml.safe_load(f)
    return [(name, z) for name, z in cfg["zones"].items()]


def in_zone(lat, lon, zone: dict) -> bool:
    if lat is None or lon is None:
        return False
    return (
        zone["lat"][0] <= lat <= zone["lat"][1]
        and zone["lon"][0] <= lon <= zone["lon"][1]
    )


def classify_vessel(ship_type: int) -> str:
    if ship_type in MILITARY_TYPES:
        return "military"
    if 70 <= ship_type <= 79:
        return "cargo"
    if 80 <= ship_type <= 89:
        return "tanker"
    if ship_type == 60:
        return "passenger"
    return "unknown"


async def fetch_vessels(client: httpx.AsyncClient, zone_cfg: dict) -> list:
    """Solicita embarcaciones de AISHub para un bounding box concreto."""
    try:
        params = {
            "username": AISHUB_USER,
            "format":   "1",      # JSON
            "output":   "full",
            "compress": "0",
            "latmin":   zone_cfg["lat"][0],
            "latmax":   zone_cfg["lat"][1],
            "lonmin":   zone_cfg["lon"][0],
            "lonmax":   zone_cfg["lon"][1],
        }
        r = await client.get(AISHUB_URL, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        # AISHub devuelve [metadata, [vessels...]]
        return data[1] if len(data) > 1 else []
    except Exception as e:
        log.warning(f"Error fetching AISHub: {e}")
        return []


async def main():
    log.info("Qilin AIS ingestor arrancando...")
    zones = load_zones()
    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    async with httpx.AsyncClient() as client:
        while True:
            total = 0
            seen_mmsi = set()  # evitar duplicados entre zonas solapadas

            for zone_name, zone_cfg in zones:
                vessels = await fetch_vessels(client, zone_cfg)

                for v in vessels:
                    mmsi = str(v.get("MMSI", ""))
                    if not mmsi or mmsi in seen_mmsi:
                        continue
                    seen_mmsi.add(mmsi)

                    ship_type = int(v.get("TYPE", 0) or 0)
                    vessel = {
                        "mmsi":        mmsi,
                        "name":        v.get("NAME", "").strip() or None,
                        "lat":         v.get("LATITUDE"),
                        "lon":         v.get("LONGITUDE"),
                        "speed":       v.get("SPEED"),
                        "course":      v.get("COURSE"),
                        "heading":     v.get("HEADING"),
                        "ship_type":   ship_type,
                        "category":    classify_vessel(ship_type),
                        "flag":        v.get("COUNTRY"),
                        "destination": v.get("DESTINATION", "").strip() or None,
                        "ais_active":  True,
                        "zone":        zone_name,
                        "time":        datetime.now(timezone.utc).isoformat(),
                    }

                    await redis.xadd("stream:ais", {"data": json.dumps(vessel)})
                    key = f"current:vessel:{mmsi}"
                    await redis.setex(key, 300, json.dumps(vessel))
                    total += 1

                await asyncio.sleep(1)  # pausa entre zonas para no saturar AISHub

            log.info(f"Publicadas {total} embarcaciones en zonas monitorizadas")
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
