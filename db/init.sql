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
    id              BIGSERIAL       PRIMARY KEY,
    time            TIMESTAMPTZ     NOT NULL,
    source          TEXT            NOT NULL,
    title           TEXT            NOT NULL,
    url             TEXT            NOT NULL,
    summary         TEXT,
    zones           TEXT[],                    -- zonas relacionadas detectadas
    keywords        TEXT[],
    severity        TEXT            DEFAULT 'low',
    relevance       INT             DEFAULT 50,
    source_country  TEXT,
    source_type     TEXT,
    sectors         TEXT[]
);

CREATE INDEX IF NOT EXISTS news_time_idx ON news_events (time DESC);
CREATE UNIQUE INDEX IF NOT EXISTS news_events_url_key      ON news_events (url);
CREATE INDEX        IF NOT EXISTS news_events_severity_idx ON news_events (severity, time DESC);
CREATE INDEX        IF NOT EXISTS news_events_country_idx  ON news_events (source_country, time DESC);
CREATE INDEX        IF NOT EXISTS news_events_type_idx     ON news_events (source_type, time DESC);

-- GIN indexes para búsquedas eficientes en arrays
CREATE INDEX IF NOT EXISTS news_events_zones_gin    ON news_events USING GIN (zones);
CREATE INDEX IF NOT EXISTS news_events_sectors_gin  ON news_events USING GIN (sectors);
CREATE INDEX IF NOT EXISTS news_events_keywords_gin ON news_events USING GIN (keywords);

-- Para DBs existentes (init.sql solo corre en primera creación del volumen):
-- ALTER TABLE news_events
--     ADD COLUMN IF NOT EXISTS severity       TEXT    DEFAULT 'low',
--     ADD COLUMN IF NOT EXISTS relevance      INT     DEFAULT 50,
--     ADD COLUMN IF NOT EXISTS source_country TEXT,
--     ADD COLUMN IF NOT EXISTS source_type    TEXT,
--     ADD COLUMN IF NOT EXISTS sectors        TEXT[];

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

-- ─── DOCUMENTOS OFICIALES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id               BIGSERIAL        PRIMARY KEY,
    time             TIMESTAMPTZ      NOT NULL,
    discovered_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    title            TEXT             NOT NULL,
    url              TEXT             NOT NULL,
    source           TEXT             NOT NULL,
    source_country   TEXT,
    org_type         TEXT,
    sectors          TEXT[],
    relevance        INT              DEFAULT 50,
    severity         TEXT             DEFAULT 'low',
    page_count       INT,
    file_size_kb     INT,
    summary          TEXT,
    full_text        TEXT,
    status           TEXT             DEFAULT 'pending',
    fetch_error      TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS documents_url_key        ON documents (url);
CREATE INDEX        IF NOT EXISTS documents_time_idx       ON documents (time DESC);
CREATE INDEX        IF NOT EXISTS documents_severity_idx   ON documents (severity, time DESC);
CREATE INDEX        IF NOT EXISTS documents_org_type_idx   ON documents (org_type, time DESC);
CREATE INDEX        IF NOT EXISTS documents_country_idx    ON documents (source_country, time DESC);
CREATE INDEX        IF NOT EXISTS documents_sectors_gin    ON documents USING GIN (sectors);

-- ─── SEC FILINGS (8-K) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sec_filings (
    id               BIGSERIAL     PRIMARY KEY,
    time             TIMESTAMPTZ   NOT NULL,
    discovered_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    ticker           TEXT          NOT NULL,
    company_name     TEXT          NOT NULL,
    cik              TEXT          NOT NULL,
    form_type        TEXT          NOT NULL,
    accession_number TEXT          NOT NULL,
    title            TEXT,
    filing_url       TEXT          NOT NULL,
    sector           TEXT,
    severity         TEXT          DEFAULT 'low',
    relevance        INT           DEFAULT 50,
    summary          TEXT,
    full_text        TEXT,
    status           TEXT          DEFAULT 'pending'
);

CREATE UNIQUE INDEX IF NOT EXISTS sec_filings_accession_key ON sec_filings (accession_number);
CREATE INDEX        IF NOT EXISTS sec_filings_time_idx      ON sec_filings (time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_ticker_idx    ON sec_filings (ticker, time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_sector_idx    ON sec_filings (sector, time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_form_idx      ON sec_filings (form_type, time DESC);

-- ─── SENTINEL-5P OBSERVATIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentinel_observations (
    time            TIMESTAMPTZ      NOT NULL,
    zone_id         TEXT             NOT NULL,
    product         TEXT             NOT NULL,  -- 'NO2' or 'SO2'
    mean_value      DOUBLE PRECISION,
    max_value       DOUBLE PRECISION,
    p95_value       DOUBLE PRECISION,
    baseline_mean   DOUBLE PRECISION,
    anomaly_ratio   DOUBLE PRECISION,
    granule_id      TEXT             NOT NULL
);

SELECT create_hypertable('sentinel_observations', 'time', if_not_exists => TRUE);
SELECT add_compression_policy('sentinel_observations', INTERVAL '7 days');

CREATE INDEX IF NOT EXISTS sentinel_zone_time_idx ON sentinel_observations (zone_id, time DESC);
CREATE INDEX IF NOT EXISTS sentinel_product_idx   ON sentinel_observations (product, time DESC);

-- ─── GENERATED REPORTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id               BIGSERIAL       PRIMARY KEY,
    report_type      TEXT            NOT NULL,   -- 'daily' or 'weekly'
    period_start     TIMESTAMPTZ     NOT NULL,
    period_end       TIMESTAMPTZ     NOT NULL,
    generated_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    filename         TEXT            NOT NULL,
    file_path        TEXT            NOT NULL,
    file_size_kb     INTEGER,
    alert_count      INTEGER         DEFAULT 0,
    top_severity     INTEGER         DEFAULT 0  -- numeric score 0–10 (max alert severity_score)
);

CREATE INDEX IF NOT EXISTS reports_type_time_idx ON reports (report_type, generated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS reports_type_period_idx ON reports (report_type, period_start);

-- ─── MERCADOS FINANCIEROS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_prices (
    time            TIMESTAMPTZ     NOT NULL,
    ticker          TEXT            NOT NULL,
    name            TEXT,
    sector          TEXT,
    asset_type      TEXT,           -- 'equity' | 'index'
    open            DOUBLE PRECISION,
    high            DOUBLE PRECISION,
    low             DOUBLE PRECISION,
    close           DOUBLE PRECISION,
    volume          DOUBLE PRECISION,
    rsi             DOUBLE PRECISION,
    macd            DOUBLE PRECISION,
    macd_signal     DOUBLE PRECISION,
    bb_upper        DOUBLE PRECISION,
    bb_lower        DOUBLE PRECISION,
    bb_mid          DOUBLE PRECISION,
    sma20           DOUBLE PRECISION,
    sma50           DOUBLE PRECISION,
    sma200          DOUBLE PRECISION,
    atr             DOUBLE PRECISION,
    vol_sma20       DOUBLE PRECISION,
    technical_score INTEGER         DEFAULT 0
);

SELECT create_hypertable('market_prices', 'time', if_not_exists => TRUE);
SELECT add_compression_policy('market_prices', INTERVAL '7 days');

CREATE INDEX IF NOT EXISTS market_prices_ticker_time_idx ON market_prices (ticker, time DESC);

CREATE TABLE IF NOT EXISTS market_signals (
    time            TIMESTAMPTZ     NOT NULL,
    ticker          TEXT            NOT NULL,
    name            TEXT,
    sector          TEXT,
    asset_type      TEXT,
    geo_relevance   TEXT[],
    price           DOUBLE PRECISION,
    volume          DOUBLE PRECISION,
    rsi             DOUBLE PRECISION,
    macd            DOUBLE PRECISION,
    bb_upper        DOUBLE PRECISION,
    bb_lower        DOUBLE PRECISION,
    sma20           DOUBLE PRECISION,
    sma50           DOUBLE PRECISION,
    sma200          DOUBLE PRECISION,
    atr             DOUBLE PRECISION,
    technical_score INTEGER,
    signals         TEXT[]
);

SELECT create_hypertable('market_signals', 'time', if_not_exists => TRUE);
SELECT add_compression_policy('market_signals', INTERVAL '7 days');

CREATE INDEX IF NOT EXISTS market_signals_ticker_time_idx ON market_signals (ticker, time DESC);

-- ─── POLYMARKET SIGNALS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polymarket_signals (
    time            TIMESTAMPTZ     NOT NULL,
    market_id       TEXT            NOT NULL,
    question        TEXT            NOT NULL,
    category        TEXT,
    yes_price       DOUBLE PRECISION,
    prev_1h_price   DOUBLE PRECISION,
    prev_24h_price  DOUBLE PRECISION,
    change_1h       DOUBLE PRECISION,
    change_24h      DOUBLE PRECISION,
    signal_type     TEXT,
    zones           TEXT[],
    volume          DOUBLE PRECISION,
    end_date        TIMESTAMPTZ
);

SELECT create_hypertable('polymarket_signals', 'time', if_not_exists => TRUE);
SELECT add_compression_policy('polymarket_signals', INTERVAL '7 days');

CREATE INDEX IF NOT EXISTS polymarket_signals_market_idx ON polymarket_signals (market_id, time DESC);
CREATE INDEX IF NOT EXISTS polymarket_signals_zones_gin  ON polymarket_signals USING GIN (zones);

-- ─── ANALYZED EVENTS (agent-engine) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyzed_events (
    id                      BIGSERIAL,
    time                    TIMESTAMPTZ     NOT NULL,
    zone                    TEXT,
    event_type              TEXT,
    severity                INTEGER,
    confidence              TEXT,
    headline                TEXT,
    summary                 TEXT,
    signals_used            TEXT[],
    market_implications     JSONB,
    polymarket_implications JSONB,
    recommended_action      TEXT,
    tags                    TEXT[],
    raw_input               JSONB,
    processing_time_ms      INTEGER
);

SELECT create_hypertable('analyzed_events', 'time', if_not_exists => TRUE);
SELECT add_compression_policy('analyzed_events', INTERVAL '7 days');

CREATE INDEX IF NOT EXISTS analyzed_events_zone_time_idx     ON analyzed_events (zone, time DESC);
CREATE INDEX IF NOT EXISTS analyzed_events_severity_time_idx ON analyzed_events (severity, time DESC);
CREATE INDEX IF NOT EXISTS analyzed_events_tags_gin          ON analyzed_events USING GIN (tags);

-- ─── USUARIOS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan          TEXT NOT NULL DEFAULT 'scout',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- ─── FAVORITOS DE USUARIO ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_favorites (
    username   TEXT        NOT NULL,
    icao24     TEXT        NOT NULL,
    callsign   TEXT,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, icao24)
);

CREATE INDEX IF NOT EXISTS favorites_username_idx ON user_favorites (username);

CREATE TABLE IF NOT EXISTS user_source_favorites (
    username     TEXT        NOT NULL,
    source_type  TEXT        NOT NULL,   -- 'news' | 'social' | 'docs'
    source_id    TEXT        NOT NULL,
    source_name  TEXT,
    added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS src_fav_user_type_idx ON user_source_favorites (username, source_type);
