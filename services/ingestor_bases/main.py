"""
Qilin — Ingestor de Bases de Aeronaves

Detecta aterrizajes analizando aircraft_positions, identifica el aeródromo
más cercano usando la tabla airfields (OurAirports) y aprende las bases y
rutas habituales de cada aeronave.

Ciclo cada 5 minutos:
1. Busca nuevas posiciones on_ground=True, velocity<5 en los últimos 6 min
2. Para cada icao24, calcula el centroide de esas posiciones
3. Busca el aeródromo más cercano (<3 km) en la tabla airfields
4. Upsert en aircraft_bases (increment visit_count)
5. Si el avión estaba en vuelo antes, registra la ruta en aircraft_routes
"""

import asyncio
import logging
import math
import os

import asyncpg
import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [BASES] %(message)s")
log = logging.getLogger(__name__)

DB_URL           = os.getenv("DB_URL", "")
POLL_INTERVAL    = int(os.getenv("BASES_POLL_INTERVAL", "300"))   # 5 min
LANDING_RADIUS_M = 3000   # radio máximo para asociar a un aeródromo (metros)
LANDING_VELOCITY = 5.0    # m/s — umbral para considerar "en tierra parado"
OURAIRPORTS_URL  = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# En memoria: última base conocida por icao24 (para detectar rutas)
_last_base: dict[str, str] = {}  # icao24 -> airfield_icao


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia en metros entre dos puntos (Haversine)."""
    R = 6_371_000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


MILITARY_KEYWORDS = [
    'air force', 'afb', 'air base', 'naval air', 'nas ', 'raf ', 'marine corps',
    'army airfield', 'military', 'luftwaffe', 'fliegerhorst', 'base aérea',
    'base aerien', 'aeroporto militare', 'baza lotnicza', 'vliegbasis',
]

def _is_military_name(name: str) -> bool:
    n = name.lower()
    return any(kw in n for kw in MILITARY_KEYWORDS)


async def import_airfields(db: asyncpg.Connection):
    """Descarga OurAirports CSV e importa aeródromos en la tabla airfields."""
    count = await db.fetchval("SELECT COUNT(*) FROM airfields")
    if count and count > 1000:
        log.info(f"Airfields ya cargados: {count} registros. Saltando importación.")
        return

    log.info("Descargando base de datos OurAirports...")
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(OURAIRPORTS_URL)
            resp.raise_for_status()
            csv_text = resp.text
    except Exception as e:
        log.error(f"Error descargando OurAirports: {e}")
        return

    lines = csv_text.strip().splitlines()
    header = [h.strip('"') for h in lines[0].split(',')]

    # Índices de columnas
    try:
        idx = {h: i for i, h in enumerate(header)}
        i_ident   = idx['ident']
        i_iata    = idx.get('iata_code', -1)
        i_type    = idx['type']
        i_name    = idx['name']
        i_lat     = idx['latitude_deg']
        i_lon     = idx['longitude_deg']
        i_country = idx['iso_country']
        i_region  = idx['iso_region']
        i_muni    = idx.get('municipality', -1)
    except KeyError as e:
        log.error(f"Columna no encontrada en CSV OurAirports: {e}")
        return

    records = []
    skip_types = {'closed', 'heliport', 'seaplane_base', 'balloonport'}

    for line in lines[1:]:
        # CSV con posibles comas dentro de comillas
        parts = []
        in_q = False
        buf = []
        for ch in line:
            if ch == '"':
                in_q = not in_q
            elif ch == ',' and not in_q:
                parts.append(''.join(buf).strip().strip('"'))
                buf = []
            else:
                buf.append(ch)
        parts.append(''.join(buf).strip().strip('"'))

        if len(parts) <= max(i_ident, i_type, i_name, i_lat, i_lon):
            continue

        atype = parts[i_type]
        if atype in skip_types:
            continue

        try:
            lat = float(parts[i_lat])
            lon = float(parts[i_lon])
        except (ValueError, IndexError):
            continue

        icao = parts[i_ident].upper()
        if not icao or len(icao) > 6:
            continue

        name    = parts[i_name]
        iata    = parts[i_iata].upper() if i_iata >= 0 and i_iata < len(parts) else None
        country = parts[i_country] if i_country < len(parts) else None
        region  = parts[i_region]  if i_region  < len(parts) else None
        muni    = parts[i_muni]    if i_muni >= 0 and i_muni < len(parts) else None
        is_mil  = atype == 'military' or _is_military_name(name)

        records.append((icao, iata or None, name, atype, lat, lon, country, region, muni, is_mil))

    if not records:
        log.error("No se pudieron parsear registros de OurAirports.")
        return

    log.info(f"Importando {len(records)} aeródromos...")
    await db.executemany(
        """
        INSERT INTO airfields (icao, iata, name, type, lat, lon, country, region, municipality, is_military)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (icao) DO UPDATE SET
            name=EXCLUDED.name, type=EXCLUDED.type, lat=EXCLUDED.lat, lon=EXCLUDED.lon,
            is_military=EXCLUDED.is_military
        """,
        records,
    )
    mil_count = sum(1 for r in records if r[9])
    log.info(f"Aeródromos importados: {len(records)} total, {mil_count} militares.")


async def find_nearest_airfield(db: asyncpg.Connection, lat: float, lon: float) -> dict | None:
    """Busca el aeródromo más cercano dentro de LANDING_RADIUS_M metros."""
    # Bounding box ~0.03° ≈ 3.3 km
    delta_lat = LANDING_RADIUS_M / 111_000
    delta_lon = LANDING_RADIUS_M / (111_000 * max(math.cos(math.radians(lat)), 0.01))

    rows = await db.fetch(
        """
        SELECT icao, name, type, lat, lon, country, is_military
        FROM airfields
        WHERE lat BETWEEN $1 AND $2
          AND lon BETWEEN $3 AND $4
        """,
        lat - delta_lat, lat + delta_lat,
        lon - delta_lon, lon + delta_lon,
    )
    if not rows:
        return None

    best = None
    best_dist = float('inf')
    for row in rows:
        d = haversine_m(lat, lon, row['lat'], row['lon'])
        if d < best_dist:
            best_dist = d
            best = row

    if best and best_dist <= LANDING_RADIUS_M:
        return {**dict(best), 'dist_m': round(best_dist)}
    return None


async def process_landings(db: asyncpg.Connection):
    """Detecta aterrizajes recientes y actualiza aircraft_bases y aircraft_routes."""
    # Aeronaves en tierra con velocidad baja en los últimos POLL_INTERVAL*1.5 segundos
    window_s = POLL_INTERVAL * 1.5
    rows = await db.fetch(
        f"""
        SELECT
            icao24,
            MAX(callsign)   AS callsign,
            MAX(category)   AS category,
            AVG(lat)        AS lat,
            AVG(lon)        AS lon,
            MAX(time)       AS last_time
        FROM aircraft_positions
        WHERE on_ground = TRUE
          AND (velocity IS NULL OR velocity < {LANDING_VELOCITY})
          AND lat IS NOT NULL AND lon IS NOT NULL
          AND time > NOW() - INTERVAL '{window_s} seconds'
        GROUP BY icao24
        """,
    )

    if not rows:
        return

    log.info(f"Procesando {len(rows)} aeronaves en tierra...")
    detected = 0

    for row in rows:
        icao24 = row['icao24']
        lat    = row['lat']
        lon    = row['lon']

        airfield = await find_nearest_airfield(db, lat, lon)
        if not airfield:
            continue

        detected += 1
        af_icao = airfield['icao']

        # Upsert en aircraft_bases
        await db.execute(
            """
            INSERT INTO aircraft_bases
                (icao24, airfield_icao, airfield_name, airfield_type,
                 country, lat, lon, is_military,
                 first_seen, last_seen, visit_count, callsign, category)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW(), NOW(), 1, $9,$10)
            ON CONFLICT (icao24, airfield_icao) DO UPDATE SET
                last_seen   = NOW(),
                visit_count = aircraft_bases.visit_count + 1,
                callsign    = COALESCE(EXCLUDED.callsign, aircraft_bases.callsign),
                category    = COALESCE(EXCLUDED.category, aircraft_bases.category)
            """,
            icao24, af_icao, airfield['name'], airfield['type'],
            airfield['country'], airfield['lat'], airfield['lon'],
            airfield['is_military'],
            row['callsign'], row['category'],
        )

        # Detectar ruta si venía de otra base
        prev = _last_base.get(icao24)
        if prev and prev != af_icao:
            await db.execute(
                """
                INSERT INTO aircraft_routes
                    (icao24, origin_icao, dest_icao, origin_name, dest_name,
                     category, callsign, first_seen, last_seen, flight_count)
                SELECT $1,$2,$3,
                    (SELECT name FROM airfields WHERE icao=$2),
                    (SELECT name FROM airfields WHERE icao=$3),
                    $4,$5, NOW(), NOW(), 1
                ON CONFLICT (icao24, origin_icao, dest_icao) DO UPDATE SET
                    last_seen    = NOW(),
                    flight_count = aircraft_routes.flight_count + 1,
                    callsign     = COALESCE(EXCLUDED.callsign, aircraft_routes.callsign)
                """,
                icao24, prev, af_icao,
                row['category'], row['callsign'],
            )
            log.info(f"  Ruta detectada: {icao24} {prev} → {af_icao}")

        _last_base[icao24] = af_icao

    if detected:
        log.info(f"  {detected} aterrizajes asociados a aeródromos.")


async def main():
    log.info("Qilin Base Tracker arrancando...")

    if not DB_URL:
        log.error("DB_URL no configurado. Saliendo.")
        return

    db = None
    while db is None:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"DB no disponible aún: {e} — reintentando en 10s")
            await asyncio.sleep(10)

    # Crear tablas si no existen (por si la migración no se ejecutó)
    try:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS airfields (
                icao TEXT PRIMARY KEY, iata TEXT, name TEXT NOT NULL, type TEXT NOT NULL,
                lat DOUBLE PRECISION NOT NULL, lon DOUBLE PRECISION NOT NULL,
                country TEXT, region TEXT, municipality TEXT, is_military BOOLEAN DEFAULT FALSE
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS airfields_latlon_idx ON airfields (lat, lon)")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS aircraft_bases (
                icao24 TEXT NOT NULL, airfield_icao TEXT NOT NULL, airfield_name TEXT NOT NULL,
                airfield_type TEXT, country TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION,
                is_military BOOLEAN DEFAULT FALSE,
                first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                visit_count INTEGER NOT NULL DEFAULT 1,
                callsign TEXT, category TEXT,
                PRIMARY KEY (icao24, airfield_icao)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS aircraft_routes (
                icao24 TEXT NOT NULL, origin_icao TEXT NOT NULL, dest_icao TEXT NOT NULL,
                origin_name TEXT, dest_name TEXT, category TEXT, callsign TEXT,
                first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                flight_count INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (icao24, origin_icao, dest_icao)
            )
        """)
    except Exception as e:
        log.warning(f"Error creando tablas: {e}")

    # Importar aeródromos si la tabla está vacía
    await import_airfields(db)

    # Cargar bases conocidas en memoria
    try:
        rows = await db.fetch(
            "SELECT icao24, airfield_icao FROM aircraft_bases ORDER BY last_seen DESC"
        )
        seen = set()
        for r in rows:
            if r['icao24'] not in seen:
                _last_base[r['icao24']] = r['airfield_icao']
                seen.add(r['icao24'])
        log.info(f"Bases previas cargadas en memoria: {len(_last_base)} aeronaves.")
    except Exception as e:
        log.warning(f"Error cargando bases previas: {e}")

    log.info(f"Iniciando ciclo de detección cada {POLL_INTERVAL}s...")
    while True:
        try:
            await process_landings(db)
        except Exception as e:
            log.error(f"Error en ciclo: {e}")
        await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
