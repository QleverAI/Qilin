"""
Qilin — Ingestor ADS-B (Airplanes.live)
Fuente: Airplanes.live REST API — sin autenticación requerida.

Estrategia de polling:
  1. GET /mil  → todas las aeronaves militares del mundo → filtra por zonas
  2. GET /point/{lat}/{lon}/{radius} por zona → aeronaves civiles (excluye militares)

Rate limit de Airplanes.live: 1 req/s → sleep 1.1s entre peticiones.
"""

import asyncio
import json
import logging
import math
import os
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ADSB] %(message)s")
log = logging.getLogger(__name__)

BASE_URL      = "https://api.airplanes.live/v2"
REDIS_URL     = os.getenv("REDIS_URL", "redis://localhost:6379")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))   # segundos de espera tras completar el ciclo
MAX_RADIUS_NM = 250                                     # límite del endpoint /point


# ── Carga de zonas ────────────────────────────────────────────────────────────

def load_zones() -> list[tuple[str, dict]]:
    with open("/app/config/zones.yaml") as f:
        cfg = yaml.safe_load(f)
    return [(name, z) for name, z in cfg["zones"].items()]


def zone_center_and_radius(zone: dict) -> tuple[float, float, float]:
    """Centro geográfico de la zona y radio mínimo (nm) que la cubre, máx 250nm."""
    clat = (zone["lat"][0] + zone["lat"][1]) / 2
    clon = (zone["lon"][0] + zone["lon"][1]) / 2
    dlat_nm = (zone["lat"][1] - zone["lat"][0]) / 2 * 60
    dlon_nm = (zone["lon"][1] - zone["lon"][0]) / 2 * 60 * math.cos(math.radians(clat))
    radius  = math.sqrt(dlat_nm ** 2 + dlon_nm ** 2)
    return clat, clon, min(radius, MAX_RADIUS_NM)


def in_zone(lat, lon, zone: dict) -> bool:
    if lat is None or lon is None:
        return False
    return (zone["lat"][0] <= lat <= zone["lat"][1] and
            zone["lon"][0] <= lon <= zone["lon"][1])


# ── Parsing ───────────────────────────────────────────────────────────────────

def is_military(ac: dict) -> bool:
    """dbFlags bit 0 == 1 → militar (clasificación de Airplanes.live)."""
    return bool(int(ac.get("dbFlags") or 0) & 1)


def parse_aircraft(ac: dict, zone: str, category: str) -> dict:
    """
    Convierte un avión de Airplanes.live al formato interno de Qilin.
    Conversiones de unidades:
      alt_baro: pies → metros  (×0.3048)
      gs:       nudos → m/s    (×0.514444)
    """
    alt_baro   = ac.get("alt_baro")
    altitude_m = round(alt_baro * 0.3048, 1) if isinstance(alt_baro, (int, float)) else None

    gs         = ac.get("gs")
    velocity   = round(gs * 0.514444, 1) if isinstance(gs, (int, float)) else None

    return {
        "icao24":       (ac.get("hex") or "").lower(),
        "callsign":     (ac.get("flight") or "").strip() or None,
        "registration": ac.get("r"),        # matrícula directa
        "type_code":    ac.get("t"),        # tipo ICAO (B738, F16, C130…)
        "lat":          ac.get("lat"),
        "lon":          ac.get("lon"),
        "altitude":     altitude_m,
        "on_ground":    ac.get("alt_baro") == "ground",
        "velocity":     velocity,
        "heading":      ac.get("track"),
        "squawk":       ac.get("squawk"),
        "category":     category,
        "zone":         zone,
        "time":         datetime.now(timezone.utc).isoformat(),
    }


# ── HTTP ──────────────────────────────────────────────────────────────────────

async def fetch_aircraft(client: httpx.AsyncClient, url: str, _retry: bool = True) -> list[dict]:
    """
    Petición GET con rate limit y retry en 429.
    Airplanes.live aplica throttling por ráfagas — si recibimos 429 esperamos
    el tiempo indicado en Retry-After (o 12s por defecto) y reintentamos una vez.
    """
    await asyncio.sleep(2.5)
    try:
        r = await client.get(url, timeout=15)
        if r.status_code == 429 and _retry:
            wait = int(r.headers.get("Retry-After", 12))
            log.info(f"429 en {url.split('/')[-3:]} — reintentando en {wait}s")
            await asyncio.sleep(wait)
            return await fetch_aircraft(client, url, _retry=False)
        r.raise_for_status()
        return r.json().get("ac") or []
    except Exception as e:
        log.warning(f"Error fetching {url}: {e}")
        return []


# ── Publicación en Redis ──────────────────────────────────────────────────────

async def publish(redis, aircraft: dict):
    icao24 = aircraft["icao24"]
    if not icao24:
        return
    payload = json.dumps(aircraft)
    await redis.xadd("stream:adsb", {"data": payload})
    await redis.setex(f"current:aircraft:{icao24}", 120, payload)


# ── Loop principal ────────────────────────────────────────────────────────────

async def main():
    log.info("Qilin ADS-B ingestor (Airplanes.live) arrancando...")
    zones = load_zones()
    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    headers = {"User-Agent": "Qilin/1.0 geopolitical-intelligence-platform"}

    async with httpx.AsyncClient(headers=headers) as client:
        while True:
            mil_count   = 0
            civil_count = 0

            # ── Paso 1: militares globales ──────────────────────────────────
            mil_aircraft = await fetch_aircraft(client, f"{BASE_URL}/mil")
            log.info(f"Militares globales recibidos: {len(mil_aircraft)}")

            for ac in mil_aircraft:
                lat, lon = ac.get("lat"), ac.get("lon")
                for zone_name, zone_cfg in zones:
                    if in_zone(lat, lon, zone_cfg):
                        await publish(redis, parse_aircraft(ac, zone_name, "military"))
                        mil_count += 1
                        break  # una zona por avión

            # ── Paso 2: civiles por zona ────────────────────────────────────
            for zone_name, zone_cfg in zones:
                clat, clon, radius = zone_center_and_radius(zone_cfg)
                url = f"{BASE_URL}/point/{clat:.4f}/{clon:.4f}/{int(radius)}"
                aircraft_in_zone = await fetch_aircraft(client, url)

                for ac in aircraft_in_zone:
                    if is_military(ac):
                        continue  # ya procesado en paso 1
                    lat, lon = ac.get("lat"), ac.get("lon")
                    if not in_zone(lat, lon, zone_cfg):
                        continue  # fuera del rectángulo exacto de la zona
                    await publish(redis, parse_aircraft(ac, zone_name, "civil"))
                    civil_count += 1

            log.info(
                f"Ciclo completo — militares en zonas: {mil_count} | "
                f"civiles en zonas: {civil_count}"
            )
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
