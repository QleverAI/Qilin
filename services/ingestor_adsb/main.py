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

OPENSKY_URL      = "https://opensky-network.org/api/states/all"
OPENSKY_TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
REDIS_URL        = os.getenv("REDIS_URL", "redis://localhost:6379")
POLL_INTERVAL    = int(os.getenv("POLL_INTERVAL", "15"))

OPENSKY_CLIENT_ID     = os.getenv("OPENSKY_CLIENT_ID", "")
OPENSKY_CLIENT_SECRET = os.getenv("OPENSKY_CLIENT_SECRET", "")

_access_token: str | None = None
_token_expires_at: float  = 0.0


async def get_access_token(client: httpx.AsyncClient) -> str | None:
    """Obtiene o renueva el token OAuth2 de OpenSky."""
    global _access_token, _token_expires_at
    import time
    if not OPENSKY_CLIENT_ID or not OPENSKY_CLIENT_SECRET:
        return None
    if _access_token and time.time() < _token_expires_at - 30:
        return _access_token
    try:
        resp = await client.post(
            OPENSKY_TOKEN_URL,
            data={
                "grant_type":    "client_credentials",
                "client_id":     OPENSKY_CLIENT_ID,
                "client_secret": OPENSKY_CLIENT_SECRET,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        _access_token    = data["access_token"]
        _token_expires_at = time.time() + data.get("expires_in", 3600)
        log.info("Token OAuth2 de OpenSky obtenido correctamente.")
        return _access_token
    except Exception as e:
        log.warning(f"Error obteniendo token OpenSky: {e}")
        return None


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
        headers = {}
        token = await get_access_token(client)
        if token:
            headers["Authorization"] = f"Bearer {token}"
        r = await client.get(OPENSKY_URL, headers=headers, timeout=20)
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
