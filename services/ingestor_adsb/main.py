"""
Qilin — Ingestor ADS-B (Airplanes.live)
Fuente: Airplanes.live REST API — sin autenticación requerida.

Estrategia de polling:
  GET /mil  → todas las aeronaves militares del mundo → filtra por zonas configuradas.

Rate limit de Airplanes.live: throttling por ráfagas → sleep 2.5s entre peticiones + retry en 429.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import asyncpg
import httpx
import redis.asyncio as aioredis
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ADSB] %(message)s")
log = logging.getLogger(__name__)

BASE_URL      = "https://api.airplanes.live/v2"
REDIS_URL     = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL        = os.getenv("DB_URL", "")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))

# ── País por prefijo de matrícula (ICAO Doc 9303) ────────────────────────────
_REG_PREFIX: list[tuple[str, str]] = sorted([
    ("N",   "United States"),    ("G",   "United Kingdom"),
    ("D",   "Germany"),          ("F",   "France"),
    ("I",   "Italy"),            ("B",   "China"),
    ("JA",  "Japan"),            ("HL",  "South Korea"),
    ("VH",  "Australia"),        ("ZK",  "New Zealand"),
    ("TC",  "Turkey"),           ("RA",  "Russia"),    ("RF", "Russia"),
    ("4X",  "Israel"),           ("SX",  "Greece"),
    ("EC",  "Spain"),            ("CS",  "Portugal"),
    ("OE",  "Austria"),          ("HB",  "Switzerland"),
    ("PH",  "Netherlands"),      ("LN",  "Norway"),
    ("SE",  "Sweden"),           ("OH",  "Finland"),
    ("OY",  "Denmark"),          ("SP",  "Poland"),
    ("OK",  "Czech Republic"),   ("HA",  "Hungary"),
    ("YR",  "Romania"),          ("LZ",  "Bulgaria"),
    ("LY",  "Lithuania"),        ("ES",  "Estonia"),
    ("YL",  "Latvia"),           ("EI",  "Ireland"),
    ("UR",  "Ukraine"),          ("EX",  "Kyrgyzstan"),
    ("UP",  "Kazakhstan"),       ("UN",  "Kazakhstan"),
    ("4K",  "Azerbaijan"),       ("UK",  "Uzbekistan"),
    ("EK",  "Armenia"),          ("A6",  "United Arab Emirates"),
    ("A9C", "Bahrain"),          ("7T",  "Algeria"),
    ("CN",  "Morocco"),          ("5A",  "Libya"),
    ("SU",  "Egypt"),            ("OD",  "Lebanon"),
    ("YK",  "Syria"),            ("JY",  "Jordan"),
    ("HZ",  "Saudi Arabia"),     ("A4O", "Oman"),
    ("A7",  "Qatar"),            ("9K",  "Kuwait"),
    ("EP",  "Iran"),             ("YI",  "Iraq"),
    ("4W",  "Yemen"),            ("VT",  "India"),
    ("PK",  "Indonesia"),        ("HS",  "Thailand"),
    ("XV",  "Vietnam"),          ("9M",  "Malaysia"),
    ("9V",  "Singapore"),        ("RP",  "Philippines"),
    ("AP",  "Pakistan"),         ("S2",  "Bangladesh"),
    ("YA",  "Afghanistan"),      ("ZS",  "South Africa"),
    ("5N",  "Nigeria"),          ("ET",  "Ethiopia"),
    ("CC",  "Chile"),            ("LV",  "Argentina"),
    ("PP",  "Brazil"),           ("PT",  "Brazil"),
    ("XA",  "Mexico"),           ("C",   "Canada"),
], key=lambda x: -len(x[0]))


def infer_country(registration: str | None) -> str | None:
    if not registration:
        return None
    reg = registration.upper().strip()
    for prefix, country in _REG_PREFIX:
        if reg.startswith(prefix):
            return country
    return None


def load_zones() -> list[tuple[str, dict]]:
    with open("/app/config/zones.yaml") as f:
        cfg = yaml.safe_load(f)
    return [(name, z) for name, z in cfg["zones"].items()]


def in_zone(lat, lon, zone: dict) -> bool:
    if lat is None or lon is None:
        return False
    return (zone["lat"][0] <= lat <= zone["lat"][1] and
            zone["lon"][0] <= lon <= zone["lon"][1])


def parse_aircraft(ac: dict, zone: str, category: str) -> dict:
    """
    Convierte un avión de Airplanes.live al formato interno de Qilin.
    Conversiones de unidades:
      alt_baro: pies → metros  (×0.3048)
      gs:       nudos → m/s    (×0.514444)
    """
    alt_baro   = ac.get("alt_baro")
    altitude_m = round(alt_baro * 0.3048, 1) if isinstance(alt_baro, (int, float)) else None

    gs       = ac.get("gs")
    velocity = round(gs * 0.514444, 1) if isinstance(gs, (int, float)) else None

    return {
        "icao24":         (ac.get("hex") or "").lower(),
        "callsign":       (ac.get("flight") or "").strip() or None,
        "registration":   ac.get("r"),
        "type_code":      ac.get("t"),
        "origin_country": infer_country(ac.get("r")),
        "lat":            ac.get("lat"),
        "lon":            ac.get("lon"),
        "altitude":       altitude_m,
        "on_ground":      ac.get("alt_baro") == "ground",
        "velocity":       velocity,
        "heading":        ac.get("track"),
        "squawk":         ac.get("squawk"),
        "category":       category,
        "zone":           zone,
        "time":           datetime.now(timezone.utc).isoformat(),
    }


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
            log.info(f"429 — reintentando en {wait}s")
            await asyncio.sleep(wait)
            return await fetch_aircraft(client, url, _retry=False)
        r.raise_for_status()
        return r.json().get("ac") or []
    except Exception as e:
        log.warning(f"Error fetching {url}: {e}")
        return []


async def publish_redis(redis, aircraft: dict):
    icao24 = aircraft["icao24"]
    if not icao24:
        return
    payload = json.dumps(aircraft)
    await redis.xadd("stream:adsb", {"data": payload})
    await redis.setex(f"current:aircraft:{icao24}", 120, payload)


_INSERT_SQL = (
    "INSERT INTO aircraft_positions"
    " (time, icao24, callsign, lat, lon, altitude, velocity, heading,"
    "  on_ground, category, origin_country, zone)"
    " VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)"
)


async def persist_batch(db, positions: list[dict]) -> None:
    rows = [
        (
            datetime.fromisoformat(p["time"]),
            p["icao24"],
            p.get("callsign"),
            p.get("lat"),
            p.get("lon"),
            p.get("altitude"),
            p.get("velocity"),
            p.get("heading"),
            p.get("on_ground"),
            p.get("category"),
            p.get("origin_country"),
            p.get("zone"),
        )
        for p in positions
        if p.get("icao24")
    ]
    if rows:
        await db.executemany(_INSERT_SQL, rows)


async def connect_db() -> "asyncpg.Connection | None":
    if not DB_URL:
        return None
    try:
        conn = await asyncpg.connect(DB_URL)
        log.info("Conectado a TimescaleDB.")
        return conn
    except Exception as e:
        log.warning(f"No se pudo conectar a DB: {e}. Posiciones no se persistirán.")
        return None


async def main():
    log.info("Qilin ADS-B ingestor (Airplanes.live) arrancando...")
    zones = load_zones()
    redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    db    = await connect_db()

    headers = {"User-Agent": "Qilin/1.0 geopolitical-intelligence-platform"}
    cycle   = 0

    async with httpx.AsyncClient(headers=headers) as http:
        while True:
            mil_count = 0
            cycle_positions: list[dict] = []

            mil_aircraft = await fetch_aircraft(http, f"{BASE_URL}/mil")
            log.info(f"Militares globales recibidos: {len(mil_aircraft)}")

            for ac in mil_aircraft:
                lat, lon = ac.get("lat"), ac.get("lon")
                # Asignar zona si cae dentro de alguna, "global" si no
                zone_name = "global"
                for zn, zc in zones:
                    if in_zone(lat, lon, zc):
                        zone_name = zn
                        break
                parsed = parse_aircraft(ac, zone_name, "military")
                await publish_redis(redis, parsed)
                cycle_positions.append(parsed)
                mil_count += 1

            log.info(f"Ciclo completo — militares publicados: {mil_count}")

            if db and cycle_positions:
                try:
                    await persist_batch(db, cycle_positions)
                    cycle += 1
                    if cycle % 10 == 1:
                        log.info(f"DB: {len(cycle_positions)} posiciones persistidas (ciclo {cycle})")
                except Exception as e:
                    log.error(f"Error guardando posiciones en DB: {e}")
                    db = await connect_db()

            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
