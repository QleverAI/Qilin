-- db/migrate_002_vessels.sql
-- Run once against existing production DB:
--   docker exec qilin_db psql -U qilin -d qilin -f /migrate_002_vessels.sql
-- (copy file into container first: docker cp db/migrate_002_vessels.sql qilin_db:/migrate_002_vessels.sql)

CREATE TABLE IF NOT EXISTS vessel_ports (
    mmsi          TEXT             NOT NULL,
    port_id       TEXT             NOT NULL,
    port_name     TEXT             NOT NULL,
    country       TEXT,
    lat           DOUBLE PRECISION,
    lon           DOUBLE PRECISION,
    is_military   BOOLEAN          DEFAULT FALSE,
    first_seen    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    last_seen     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    visit_count   INT              NOT NULL DEFAULT 1,
    PRIMARY KEY (mmsi, port_id)
);

CREATE INDEX IF NOT EXISTS vessel_ports_mmsi_idx ON vessel_ports (mmsi, last_seen DESC);

CREATE TABLE IF NOT EXISTS vessel_routes (
    mmsi          TEXT        NOT NULL,
    origin_port   TEXT        NOT NULL,
    dest_port     TEXT        NOT NULL,
    origin_name   TEXT,
    dest_name     TEXT,
    route_count   INT         NOT NULL DEFAULT 1,
    last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (mmsi, origin_port, dest_port)
);

CREATE INDEX IF NOT EXISTS vessel_routes_mmsi_idx ON vessel_routes (mmsi, last_seen DESC);

CREATE TABLE IF NOT EXISTS vessel_favorites (
    username   TEXT        NOT NULL,
    mmsi       TEXT        NOT NULL,
    name       TEXT,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, mmsi)
);

CREATE INDEX IF NOT EXISTS vessel_fav_username_idx ON vessel_favorites (username);
