-- 2026-04-23: Scheduled multi-agent intel
-- Adds agent_findings hypertable (per-agent outputs per cycle) and cycle_id on analyzed_events.

CREATE TABLE IF NOT EXISTS agent_findings (
    id            BIGSERIAL,
    time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cycle_id      UUID NOT NULL,
    agent_name    TEXT NOT NULL,
    anomaly_score INT  NOT NULL,
    summary       TEXT NOT NULL,
    raw_output    JSONB NOT NULL,
    tools_called  TEXT[],
    duration_ms   INT,
    telegram_sent BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id, time)
);
SELECT create_hypertable('agent_findings', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS agent_findings_cycle_idx
    ON agent_findings (cycle_id);
CREATE INDEX IF NOT EXISTS agent_findings_agent_time_idx
    ON agent_findings (agent_name, time DESC);
CREATE INDEX IF NOT EXISTS agent_findings_score_time_idx
    ON agent_findings (anomaly_score DESC, time DESC);

ALTER TABLE analyzed_events
    ADD COLUMN IF NOT EXISTS cycle_id UUID;
CREATE INDEX IF NOT EXISTS analyzed_events_cycle_idx
    ON analyzed_events (cycle_id);
