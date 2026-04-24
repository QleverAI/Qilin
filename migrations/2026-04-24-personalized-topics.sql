-- 2026-04-24: Personalized topics feature
-- Adds user_topics table, telegram_chat_id on users (plan column already in init.sql),
-- and topics TEXT[] column on news_events, agent_findings, analyzed_events.

BEGIN;

-- User subscriptions
CREATE TABLE IF NOT EXISTS user_topics (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id   TEXT    NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, topic_id)
);

-- Telegram chat ID per user
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Ensure plan default is 'free' for new users (column exists from init.sql)
ALTER TABLE users ALTER COLUMN plan SET DEFAULT 'free';

-- Topics arrays on content tables
ALTER TABLE news_events
    ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS news_events_topics_gin ON news_events USING GIN (topics);

ALTER TABLE agent_findings
    ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS agent_findings_topics_gin ON agent_findings USING GIN (topics);

ALTER TABLE analyzed_events
    ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS analyzed_events_topics_gin ON analyzed_events USING GIN (topics);

COMMIT;
