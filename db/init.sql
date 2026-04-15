-- Qilin — Schema inicial TimescaleDB

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ─── AERONAVES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aircraft_positions (
    time        TIMESTAMPTZ     NOT NULL,
    icao24      TEXT            NOT NULL,  -- identificador único ICAO
    callsign    TEXT,
    lat         DOUBLE PRECISION,
    lon         DOUBLE PRECISION,
    altitude    DOUBLE PRECISION,          -- metros
    velocity    DOUBLE PRECISION,          -- m/s
    heading     DOUBLE PRECISION,
    on_ground   BOOLEAN,
    category    TEXT,                      -- civil / military / government / unknown
    origin_country TEXT,
    zone        TEXT                       -- zona de configuración que activó el registro
);

SELECT create_hypertable('aircraft_positions', 'time', if_not_exists => TRUE);
SELECT add_compression_policy('aircraft_positions', INTERVAL '7 days');

-- ─── EMBARCACIONES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vessel_positions (
    time        TIMESTAMPTZ     NOT NULL,
    mmsi        TEXT            NOT NULL,  -- identificador único AIS
    name        TEXT,
    lat         DOUBLE PRECISION,
    lon         DOUBLE PRECISION,
    speed       DOUBLE PRECISION,          -- nudos
    course      DOUBLE PRECISION,
    heading     DOUBLE PRECISION,
    ship_type   INTEGER,                   -- código tipo AIS
    category    TEXT,                      -- cargo / tanker / military / unknown
    flag        TEXT,                      -- bandera (país)
    destination TEXT,
    ais_active  BOOLEAN DEFAULT TRUE,      -- FALSE si ha desaparecido del radar
    zone        TEXT
);

SELECT create_hypertable('vessel_positions', 'time', if_not_exists => TRUE);
SELECT add_compression_policy('vessel_positions', INTERVAL '7 days');

-- ─── ALERTAS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id          BIGSERIAL       PRIMARY KEY,
    time        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    zone        TEXT            NOT NULL,
    severity    TEXT            NOT NULL,  -- high / medium / low
    rule        TEXT            NOT NULL,  -- nombre de la regla que disparó la alerta
    title       TEXT            NOT NULL,
    description TEXT,
    entities    JSONB,                     -- vehículos implicados [{type, id, callsign}]
    resolved    BOOLEAN         DEFAULT FALSE,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS alerts_time_idx ON alerts (time DESC);
CREATE INDEX IF NOT EXISTS alerts_zone_idx ON alerts (zone);

-- ─── NOTICIAS (fase 2) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_events (
    id          BIGSERIAL       PRIMARY KEY,
    time        TIMESTAMPTZ     NOT NULL,
    source      TEXT            NOT NULL,
    title       TEXT            NOT NULL,
    url         TEXT,
    summary     TEXT,
    zones       TEXT[],                    -- zonas relacionadas detectadas
    keywords    TEXT[]
);

CREATE INDEX IF NOT EXISTS news_time_idx ON news_events (time DESC);

-- ─── POSTS SOCIALES (X / Twitter) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
    time        TIMESTAMPTZ     NOT NULL,
    tweet_id    TEXT            NOT NULL,
    handle      TEXT            NOT NULL,
    display     TEXT,
    category    TEXT,
    zone        TEXT,
    content     TEXT,
    lang        TEXT,
    likes       INT             DEFAULT 0,
    retweets    INT             DEFAULT 0,
    url         TEXT,
    media_url   TEXT,
    media_type  TEXT,                       -- 'photo' | 'video' | 'animated_gif' | NULL
    CONSTRAINT social_posts_tweet_id_key UNIQUE (tweet_id)
);

SELECT create_hypertable('social_posts', 'time', if_not_exists => TRUE);
SELECT add_compression_policy('social_posts', INTERVAL '7 days');

CREATE INDEX IF NOT EXISTS social_posts_handle_time ON social_posts (handle, time DESC);
CREATE INDEX IF NOT EXISTS social_posts_category_time ON social_posts (category, time DESC);
CREATE INDEX IF NOT EXISTS social_posts_zone_time ON social_posts (zone, time DESC);
