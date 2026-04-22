"""
Qilin — Ingestor VIP Aircraft
Sigue aeronaves de líderes mundiales, billonarios y oligarcas usando
la watchlist config/vip_aircraft.yaml.

Estrategia:
  Para cada entrada de la watchlist, consulta Airplanes.live:
    - Si tiene icao24: GET /v2/icao/{hex}
    - Si solo tiene registration: GET /v2/reg/{reg}
  Publica posiciones en stream:vip y genera alertas de despegue/aterrizaje.
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [VIP] %(message)s")
log = logging.getLogger(__name__)

BASE_URL      = "https://api.airplanes.live/v2"
REDIS_URL     = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL        = os.getenv("DB_URL", "")
POLL_INTERVAL  = int(os.getenv("VIP_POLL_INTERVAL", "300"))
WATCHLIST      = "/app/config/vip_aircraft.yaml"

# Delay entre peticiones — configurable para no saturar IP compartida con ADSB.
# Con 70 aeronaves: 70 × delay = tiempo total del scan.
# ADSB hace 12 req/min; a 8s = 7.5 req/min de VIP → ~19 req/min combinados.
REQUEST_DELAY = float(os.getenv("VIP_REQUEST_DELAY", "8.0"))


def load_watchlist() -> list[dict]:
    with open(WATCHLIST) as f:
        cfg = yaml.safe_load(f)
    entries = cfg.get("aircraft", [])
    log.info(f"Watchlist cargada: {len(entries)} aeronaves VIP")
    return entries


def parse_ac(ac: dict, meta: dict) -> dict | None:
    """Combina datos de Airplanes.live con metadatos de la watchlist."""
    if not ac:
        return None
    icao24 = (ac.get("hex") or "").lower()
    if not icao24:
        return None

    alt_baro = ac.get("alt_baro")
    altitude_m = round(alt_baro * 0.3048, 1) if isinstance(alt_baro, (int, float)) else None
    gs = ac.get("gs")
    velocity = round(gs * 0.514444, 1) if isinstance(gs, (int, float)) else None
    on_ground = ac.get("alt_baro") == "ground"

    return {
        "icao24":       icao24,
        "callsign":     (ac.get("flight") or "").strip() or None,
        "registration": ac.get("r") or meta.get("registration"),
        "type_code":    ac.get("t"),
        "lat":          ac.get("lat"),
        "lon":          ac.get("lon"),
        "altitude":     altitude_m,
        "on_ground":    on_ground,
        "velocity":     velocity,
        "heading":      ac.get("track"),
        "squawk":       ac.get("squawk"),
        "category":     "vip",
        "zone":         "global",
        "time":         datetime.now(timezone.utc).isoformat(),
        # Metadatos VIP
        "vip_owner":    meta["owner"],
        "vip_category": meta.get("category", "vip"),
        "vip_country":  meta.get("country"),
        "origin_country": meta.get("country"),
    }


async def fetch_by_icao(client: httpx.AsyncClient, icao24: str) -> list[dict]:
    await asyncio.sleep(REQUEST_DELAY)
    try:
        r = await client.get(f"{BASE_URL}/icao/{icao24}", timeout=15)
        if r.status_code == 429:
            wait = int(r.headers.get("Retry-After", 15))
            log.info(f"429 en icao/{icao24} — esperando {wait}s")
            await asyncio.sleep(wait)
            r = await client.get(f"{BASE_URL}/icao/{icao24}", timeout=15)
        r.raise_for_status()
        return r.json().get("ac") or []
    except Exception as e:
        log.debug(f"fetch_by_icao {icao24}: {e}")
        return []


async def fetch_by_reg(client: httpx.AsyncClient, reg: str) -> list[dict]:
    await asyncio.sleep(REQUEST_DELAY)
    # Normalizar: quitar espacios, guiones para la URL
    reg_clean = reg.replace(" ", "%20")
    try:
        r = await client.get(f"{BASE_URL}/reg/{reg_clean}", timeout=15)
        if r.status_code == 429:
            wait = int(r.headers.get("Retry-After", 15))
            log.info(f"429 en reg/{reg} — esperando {wait}s")
            await asyncio.sleep(wait)
            r = await client.get(f"{BASE_URL}/reg/{reg_clean}", timeout=15)
        r.raise_for_status()
        return r.json().get("ac") or []
    except Exception as e:
        log.debug(f"fetch_by_reg {reg}: {e}")
        return []


async def publish(redis, aircraft: dict):
    """Publica en stream:vip y en current:aircraft:{icao24} (junto con los ADSB normales)."""
    icao24 = aircraft["icao24"]
    payload = json.dumps(aircraft)
    await redis.xadd("stream:vip", {"data": payload}, maxlen=2000)
    # También en el stream ADSB para que aparezca en el mapa
    await redis.xadd("stream:adsb", {"data": payload})
    await redis.setex(f"current:aircraft:{icao24}", 180, payload)
    # Índice VIP para búsquedas rápidas
    await redis.hset("vip:index", icao24, json.dumps({
        "owner":    aircraft["vip_owner"],
        "category": aircraft["vip_category"],
        "country":  aircraft.get("vip_country"),
    }))


async def check_state_change(redis, aircraft: dict) -> str | None:
    """Detecta despegue/aterrizaje comparando con última posición conocida."""
    icao24 = aircraft["icao24"]
    prev_raw = await redis.get(f"vip:state:{icao24}")
    was_grounded = True  # asume en tierra si no hay dato previo

    if prev_raw:
        try:
            prev = json.loads(prev_raw)
            was_grounded = prev.get("on_ground", True)
        except Exception:
            pass

    now_grounded = aircraft.get("on_ground", True)
    event = None

    if was_grounded and not now_grounded:
        event = "takeoff"
        log.info(f"DESPEGUE VIP: {aircraft['vip_owner']} ({aircraft['registration']}) "
                 f"lat={aircraft.get('lat')} lon={aircraft.get('lon')}")
    elif not was_grounded and now_grounded:
        event = "landing"
        log.info(f"ATERRIZAJE VIP: {aircraft['vip_owner']} ({aircraft['registration']}) "
                 f"lat={aircraft.get('lat')} lon={aircraft.get('lon')}")

    # Guardar estado actual
    await redis.setex(f"vip:state:{icao24}", 3600 * 6, json.dumps({
        "on_ground": now_grounded,
        "lat": aircraft.get("lat"),
        "lon": aircraft.get("lon"),
        "time": aircraft["time"],
    }))

    return event


async def generate_alert(redis, aircraft: dict, event: str):
    """Genera alerta en stream:alerts para despegues/aterrizajes VIP."""
    sev = "high" if aircraft["vip_category"] in ("head_of_state",) else "medium"
    action = "ha despegado" if event == "takeoff" else "ha aterrizado"
    lat, lon = aircraft.get("lat"), aircraft.get("lon")

    alert = {
        "rule":     f"vip_{event}",
        "title":    f"{aircraft['vip_owner']} {action}",
        "severity": sev,
        "zone":     "global",
        "entities": json.dumps({
            "owner":        aircraft["vip_owner"],
            "registration": aircraft.get("registration"),
            "icao24":       aircraft["icao24"],
            "callsign":     aircraft.get("callsign"),
            "lat":          lat,
            "lon":          lon,
            "category":     aircraft["vip_category"],
        }),
        "time": aircraft["time"],
    }
    await redis.xadd("stream:alerts", {"data": json.dumps(alert)}, maxlen=500)


_INSERT_SQL = (
    "INSERT INTO aircraft_positions"
    " (time, icao24, callsign, lat, lon, altitude, velocity, heading,"
    "  on_ground, category, origin_country, zone)"
    " VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)"
    " ON CONFLICT DO NOTHING"
)


async def persist(db, aircraft: dict):
    if not db or not aircraft.get("icao24"):
        return
    try:
        await db.execute(_INSERT_SQL,
            datetime.fromisoformat(aircraft["time"]),
            aircraft["icao24"],
            aircraft.get("callsign"),
            aircraft.get("lat"),
            aircraft.get("lon"),
            aircraft.get("altitude"),
            aircraft.get("velocity"),
            aircraft.get("heading"),
            aircraft.get("on_ground"),
            "vip",
            aircraft.get("origin_country"),
            "global",
        )
    except Exception as e:
        log.debug(f"persist error {aircraft['icao24']}: {e}")


async def connect_db():
    if not DB_URL:
        return None
    try:
        conn = await asyncpg.connect(DB_URL)
        log.info("Conectado a TimescaleDB.")
        return conn
    except Exception as e:
        log.warning(f"No se pudo conectar a DB: {e}")
        return None


async def poll_entry(client: httpx.AsyncClient, entry: dict) -> list[dict]:
    """Consulta un avión de la watchlist, devuelve lista de aeronaves encontradas."""
    icao24 = entry.get("icao24")
    reg    = entry.get("registration")
    raw    = []

    if icao24:
        raw = await fetch_by_icao(client, icao24.lower().replace(" ", ""))
    if not raw and reg:
        raw = await fetch_by_reg(client, reg)

    results = []
    for ac in raw:
        parsed = parse_ac(ac, entry)
        if parsed and parsed.get("lat") is not None:
            results.append(parsed)

    return results


async def main():
    log.info("Qilin VIP Aircraft ingestor arrancando...")
    watchlist = load_watchlist()
    redis     = aioredis.from_url(REDIS_URL, decode_responses=True)
    db        = await connect_db()

    headers = {"User-Agent": "Qilin/1.0 geopolitical-intelligence-platform"}

    async with httpx.AsyncClient(headers=headers) as http:
        cycle = 0
        while True:
            found = 0
            events = 0

            for entry in watchlist:
                try:
                    aircraft_list = await poll_entry(http, entry)
                    for aircraft in aircraft_list:
                        await publish(redis, aircraft)
                        event = await check_state_change(redis, aircraft)
                        if event:
                            await generate_alert(redis, aircraft, event)
                            events += 1
                        await persist(db, aircraft)
                        found += 1
                except Exception as e:
                    log.warning(f"Error procesando {entry.get('owner', '?')}: {e}")

            cycle += 1
            log.info(f"Ciclo {cycle} — {found}/{len(watchlist)} VIPs en vuelo — {events} eventos")

            if db:
                try:
                    await db.execute("SELECT 1")
                except Exception:
                    log.warning("DB desconectada, reconectando...")
                    db = await connect_db()

            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
