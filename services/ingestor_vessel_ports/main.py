"""
Qilin — Vessel Port Detector
Reads recent vessel_positions WHERE speed < 1 knot, matches against a curated
port catalog, upserts into vessel_ports and vessel_routes.
"""

import asyncio
import logging
import math
import os
from datetime import datetime, timezone

import asyncpg

logging.basicConfig(level=logging.INFO, format="%(asctime)s [VPORTS] %(message)s")
log = logging.getLogger(__name__)

DB_URL        = os.getenv("DB_URL", "")
POLL_INTERVAL = int(os.getenv("VESSEL_PORTS_POLL_INTERVAL", "300"))  # 5 min
PORT_RADIUS_M = 3000  # consider vessel "at port" if within 3km

MAJOR_PORTS = [
    {"id": "NLRTM", "name": "Rotterdam",          "country": "Netherlands",    "lat": 51.9225, "lon":   4.4792, "is_military": False},
    {"id": "SGSIN", "name": "Singapore",           "country": "Singapore",      "lat":  1.2647, "lon": 103.8229, "is_military": False},
    {"id": "CNSHA", "name": "Shanghai",            "country": "China",          "lat": 31.2325, "lon": 121.4750, "is_military": False},
    {"id": "CNNGB", "name": "Ningbo-Zhoushan",     "country": "China",          "lat": 29.8683, "lon": 122.0968, "is_military": False},
    {"id": "CNSZX", "name": "Shenzhen",            "country": "China",          "lat": 22.5429, "lon": 114.0596, "is_military": False},
    {"id": "BEANR", "name": "Antwerp",             "country": "Belgium",        "lat": 51.2193, "lon":   4.4025, "is_military": False},
    {"id": "DEHAM", "name": "Hamburg",             "country": "Germany",        "lat": 53.5500, "lon":  10.0000, "is_military": False},
    {"id": "USLAX", "name": "Los Angeles",         "country": "United States",  "lat": 33.7290, "lon":-118.2660, "is_military": False},
    {"id": "USNYC", "name": "New York",            "country": "United States",  "lat": 40.6400, "lon": -74.0200, "is_military": False},
    {"id": "GBFXT", "name": "Felixstowe",          "country": "United Kingdom", "lat": 51.9544, "lon":   1.3506, "is_military": False},
    {"id": "EGPSD", "name": "Port Said",           "country": "Egypt",          "lat": 31.2565, "lon":  32.2841, "is_military": False},
    {"id": "TRAMB", "name": "Ambarli",             "country": "Turkey",         "lat": 41.0100, "lon":  28.6700, "is_military": False},
    {"id": "MYPKG", "name": "Port Klang",          "country": "Malaysia",       "lat":  3.0041, "lon": 101.3963, "is_military": False},
    {"id": "JPYOK", "name": "Yokohama",            "country": "Japan",          "lat": 35.4437, "lon": 139.6380, "is_military": False},
    {"id": "KRPUS", "name": "Busan",               "country": "South Korea",    "lat": 35.1028, "lon": 129.0400, "is_military": False},
    {"id": "AEDXB", "name": "Jebel Ali",           "country": "UAE",            "lat": 25.0111, "lon":  55.0694, "is_military": False},
    {"id": "GRPIR", "name": "Piraeus",             "country": "Greece",         "lat": 37.9396, "lon":  23.6222, "is_military": False},
    {"id": "ESALG", "name": "Algeciras",           "country": "Spain",          "lat": 36.1286, "lon":  -5.4566, "is_military": False},
    {"id": "TRTUZ", "name": "Tuzla",               "country": "Turkey",         "lat": 40.8300, "lon":  29.3000, "is_military": False},
    {"id": "CNTSN", "name": "Tianjin",             "country": "China",          "lat": 39.0083, "lon": 117.7206, "is_military": False},
    # Military ports
    {"id": "MIL_NORFOLK",    "name": "Norfolk Naval Station",      "country": "United States",  "lat": 36.9430, "lon": -76.3060, "is_military": True},
    {"id": "MIL_ROTA",       "name": "Rota Naval Base",            "country": "Spain",          "lat": 36.6358, "lon":  -6.3505, "is_military": True},
    {"id": "MIL_PORTSMOUTH", "name": "Portsmouth Naval Base",      "country": "United Kingdom", "lat": 50.8097, "lon":  -1.0850, "is_military": True},
    {"id": "MIL_TOULON",     "name": "Toulon Naval Base",          "country": "France",         "lat": 43.1042, "lon":   5.9283, "is_military": True},
    {"id": "MIL_TARANTO",    "name": "Taranto Naval Base",         "country": "Italy",          "lat": 40.4713, "lon":  17.2185, "is_military": True},
    {"id": "MIL_SOUDA",      "name": "Souda Bay NATO Base",        "country": "Greece",         "lat": 35.4944, "lon":  24.1336, "is_military": True},
    {"id": "MIL_SEVASTOPOL", "name": "Sevastopol Black Sea Fleet", "country": "Russia",         "lat": 44.6233, "lon":  33.5239, "is_military": True},
    {"id": "MIL_VLAD",       "name": "Vladivostok Pacific Fleet",  "country": "Russia",         "lat": 43.1050, "lon": 131.8735, "is_military": True},
    {"id": "MIL_SANYA",      "name": "Sanya Naval Base",           "country": "China",          "lat": 18.2100, "lon": 109.5100, "is_military": True},
    {"id": "MIL_QINGDAO",    "name": "Qingdao North Sea Fleet",    "country": "China",          "lat": 36.0671, "lon": 120.3826, "is_military": True},
    {"id": "MIL_YOKOSUKA",   "name": "Yokosuka US Navy Base",      "country": "Japan",          "lat": 35.2800, "lon": 139.6700, "is_military": True},
    {"id": "MIL_TARTUS",     "name": "Tartus Russian Naval Base",  "country": "Syria",          "lat": 34.8958, "lon":  35.8872, "is_military": True},
    {"id": "MIL_BREST",      "name": "Brest Naval Base",           "country": "France",         "lat": 48.3820, "lon":  -4.4950, "is_military": True},
    {"id": "MIL_DEVONPORT",  "name": "Devonport Naval Base",       "country": "United Kingdom", "lat": 50.3700, "lon":  -4.1500, "is_military": True},
]


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_nearest_port(lat: float, lon: float) -> dict | None:
    best = None
    best_dist = PORT_RADIUS_M
    for port in MAJOR_PORTS:
        d = haversine_m(lat, lon, port["lat"], port["lon"])
        if d < best_dist:
            best_dist = d
            best = port
    return best


async def process_port_calls(db):
    rows = await db.fetch(
        """
        SELECT DISTINCT ON (mmsi) mmsi, name, lat, lon, speed, category
        FROM vessel_positions
        WHERE time > NOW() - INTERVAL '10 minutes'
          AND speed IS NOT NULL AND speed < 1.0
          AND lat IS NOT NULL AND lon IS NOT NULL
        ORDER BY mmsi, time DESC
        """
    )

    arrivals = 0
    for row in rows:
        port = find_nearest_port(row["lat"], row["lon"])
        if not port:
            continue
        mmsi = row["mmsi"]
        now  = datetime.now(timezone.utc)
        try:
            existing = await db.fetchrow(
                "SELECT last_seen, visit_count FROM vessel_ports WHERE mmsi=$1 AND port_id=$2",
                mmsi, port["id"]
            )
            if existing:
                time_since = (now - existing["last_seen"]).total_seconds()
                if time_since < 3600:
                    continue  # already recorded this visit in the last hour
                await db.execute(
                    """
                    UPDATE vessel_ports
                    SET last_seen=NOW(), visit_count=visit_count+1
                    WHERE mmsi=$1 AND port_id=$2
                    """,
                    mmsi, port["id"]
                )
            else:
                await db.execute(
                    """
                    INSERT INTO vessel_ports (mmsi, port_id, port_name, country, lat, lon, is_military)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                    """,
                    mmsi, port["id"], port["name"], port["country"],
                    port["lat"], port["lon"], port["is_military"]
                )
                arrivals += 1
        except Exception as e:
            log.error(f"Error upserting port call for {mmsi}: {e}")

    if arrivals:
        log.info(f"Detectadas {arrivals} nuevas escala(s) en puerto")


async def process_routes(db):
    """
    Detect routes: for each vessel that visited ≥2 distinct ports,
    upsert the most recent origin→destination pair.
    """
    rows = await db.fetch(
        """
        SELECT mmsi, port_id, port_name, last_seen
        FROM vessel_ports
        WHERE last_seen > NOW() - INTERVAL '30 days'
        ORDER BY mmsi, last_seen ASC
        """
    )
    by_vessel: dict[str, list] = {}
    for r in rows:
        by_vessel.setdefault(r["mmsi"], []).append(r)

    for mmsi, visits in by_vessel.items():
        if len(visits) < 2:
            continue
        # Only update the latest pair
        origin = visits[-2]
        dest   = visits[-1]
        try:
            await db.execute(
                """
                INSERT INTO vessel_routes (mmsi, origin_port, dest_port, origin_name, dest_name, route_count, last_seen)
                VALUES ($1,$2,$3,$4,$5,1,NOW())
                ON CONFLICT (mmsi, origin_port, dest_port) DO UPDATE
                  SET route_count = vessel_routes.route_count + 1,
                      last_seen   = NOW()
                """,
                mmsi, origin["port_id"], dest["port_id"],
                origin["port_name"], dest["port_name"]
            )
        except Exception as e:
            log.error(f"Error upserting route for {mmsi}: {e}")


async def main():
    log.info("Qilin Vessel Port Detector arrancando...")
    if not DB_URL:
        log.error("DB_URL no configurada — saliendo.")
        return

    db = None
    while db is None:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"DB no disponible aún: {e} — reintentando en 10s")
            await asyncio.sleep(10)

    while True:
        try:
            await process_port_calls(db)
            await process_routes(db)
        except Exception as e:
            log.error(f"Error en ciclo principal: {e}")
            db = None
            while db is None:
                try:
                    db = await asyncpg.connect(DB_URL)
                    log.info("Reconectado a TimescaleDB.")
                except Exception as e2:
                    log.warning(f"Reconexión fallida: {e2} — reintentando en 10s")
                    await asyncio.sleep(10)
        await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
