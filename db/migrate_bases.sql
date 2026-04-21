-- Qilin — Migración: sistema de bases de aeronaves
-- Ejecutar manualmente en DBs existentes:
-- docker exec -i qilin_db psql -U qilin -d qilin < /tmp/migrate_bases.sql

-- ─── AERÓDROMOS (OurAirports) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS airfields (
    icao            TEXT PRIMARY KEY,
    iata            TEXT,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    country         TEXT,
    region          TEXT,
    municipality    TEXT,
    is_military     BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS airfields_latlon_idx ON airfields (lat, lon);
CREATE INDEX IF NOT EXISTS airfields_country_idx ON airfields (country);
CREATE INDEX IF NOT EXISTS airfields_military_idx ON airfields (is_military) WHERE is_military = TRUE;

-- ─── BASES CONOCIDAS POR AERONAVE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aircraft_bases (
    icao24          TEXT NOT NULL,
    airfield_icao   TEXT NOT NULL,
    airfield_name   TEXT NOT NULL,
    airfield_type   TEXT,
    country         TEXT,
    lat             DOUBLE PRECISION,
    lon             DOUBLE PRECISION,
    is_military     BOOLEAN DEFAULT FALSE,
    first_seen      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    visit_count     INTEGER NOT NULL DEFAULT 1,
    callsign        TEXT,
    category        TEXT,
    PRIMARY KEY (icao24, airfield_icao)
);

CREATE INDEX IF NOT EXISTS aircraft_bases_icao24_idx    ON aircraft_bases (icao24);
CREATE INDEX IF NOT EXISTS aircraft_bases_airfield_idx  ON aircraft_bases (airfield_icao);
CREATE INDEX IF NOT EXISTS aircraft_bases_military_idx  ON aircraft_bases (is_military, last_seen DESC);
CREATE INDEX IF NOT EXISTS aircraft_bases_last_seen_idx ON aircraft_bases (last_seen DESC);

-- ─── RUTAS DETECTADAS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aircraft_routes (
    icao24          TEXT NOT NULL,
    origin_icao     TEXT NOT NULL,
    dest_icao       TEXT NOT NULL,
    origin_name     TEXT,
    dest_name       TEXT,
    category        TEXT,
    callsign        TEXT,
    first_seen      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    flight_count    INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (icao24, origin_icao, dest_icao)
);

CREATE INDEX IF NOT EXISTS aircraft_routes_icao24_idx  ON aircraft_routes (icao24);
CREATE INDEX IF NOT EXISTS aircraft_routes_origin_idx  ON aircraft_routes (origin_icao);
CREATE INDEX IF NOT EXISTS aircraft_routes_dest_idx    ON aircraft_routes (dest_icao);
CREATE INDEX IF NOT EXISTS aircraft_routes_last_seen_idx ON aircraft_routes (last_seen DESC);
