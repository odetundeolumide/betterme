-- Feedback migration (Option A feedback round): in-app feedback reports.
-- Apply after notifications_schema.sql:
--   psql "$DATABASE_URL" -f db/feedback_schema.sql

CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'idea', 'praise')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  screen TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS feedback_status_idx ON feedback (status, created_at);
