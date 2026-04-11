"""
Qilin — Ingestor ADS-B
Fuente: OpenSky Network REST API
Publica posiciones de aeronaves en Redis Streams filtradas por zonas configuradas.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ADSB] %(message)s")
log = logging.getLogger(__name__)

OPENSKY_URL = "https://opensky-network.org/api/states/all"
REDIS_URL   = os.getenv("REDIS_URL", "redis://localhost:6379")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "15"))

# Credenciales opcionales (aumentan el rate limit de OpenSky)
OPENSKY_AUTH = None
if os.getenv("OPENSKY_USER") and os.getenv("OPENSKY_PASS"):
    OPENSKY_AUTH = (os.getenv("OPENSKY_USER"), os.getenv("OPENSKY_PASS"))


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


def parse_state(state: list) -> dict:
    """
    OpenSky devuelve cada aeronave como una lista posicional.
    https://openskynetwork.github.io/opensky-api/rest.html
    """
    return {
        "icao24":         state[0],
        "callsign":       (state[1] or "").strip() or None,
        "origin_country": state[2],
        "lat":            state[6],
        "lon":            state[5],
        "altitude":       state[7],
        "on_ground":      state[8],
        "velocity":       state[9],
        "heading":        state[10],
        "category":       "unknown",  # TODO: clasificar por ICAO24 DB
    }


async def fetch_states(client: httpx.AsyncClient) -> list:
    try:
        params = {}
        if OPENSKY_AUTH:
            r = await client.get(OPENSKY_URL, params=params, auth=OPENSKY_AUTH, timeout=20)
        else:
            r = await client.get(OPENSKY_URL, params=params, timeout=20)
        r.raise_for_status()
        return r.json().get("states") or []
    except Exception as e:
        log.warning(f"Error fetching OpenSky: {e}")
        return []


async def main():
    log.info("Qilin ADS-B ingestor arrancando...")
    zones = load_zones()
    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    async with httpx.AsyncClient() as client:
        while True:
            states = await fetch_states(client)
            if not states:
                log.info("Sin datos, reintentando...")
                await asyncio.sleep(POLL_INTERVAL)
                continue

            count = 0
            for state in states:
                aircraft = parse_state(state)
                lat, lon = aircraft["lat"], aircraft["lon"]

                for zone_name, zone_cfg in zones:
                    if not in_zone(lat, lon, zone_cfg):
                        continue

                    aircraft["zone"] = zone_name
                    aircraft["time"] = datetime.now(timezone.utc).isoformat()

                    # Publicar en Redis Stream
                    await redis.xadd("stream:adsb", {"data": json.dumps(aircraft)})

                    # Cache posición actual
                    key = f"current:aircraft:{aircraft['icao24']}"
                    await redis.setex(key, 120, json.dumps(aircraft))

                    count += 1
                    break  # una aeronave solo se publica una vez aunque esté en varias zonas

            log.info(f"Publicadas {count} aeronaves en zonas monitorizadas (de {len(states)} totales)")
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
