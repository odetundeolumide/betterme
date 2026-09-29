-- Notifications migration (Part A): schedules, prefs, device tokens, log.
-- FCM credentials: server/firebase-service-account.json (git-ignored).
-- Email fallback: SMTP_* in server/.env (git-ignored). Apply after
-- safeguarding_schema.sql:
--   psql "$DATABASE_URL" -f db/notifications_schema.sql

-- Extend reminder preferences: opt-in, days, quiet hours.
ALTER TABLE user_prefs ADD COLUMN IF NOT EXISTS notify_opt_in BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_prefs ADD COLUMN IF NOT EXISTS days TEXT NOT NULL DEFAULT '';
ALTER TABLE user_prefs ADD COLUMN IF NOT EXISTS quiet_start TEXT NOT NULL DEFAULT '';
ALTER TABLE user_prefs ADD COLUMN IF NOT EXISTS quiet_end TEXT NOT NULL DEFAULT '';

-- One row per student device. Invalid tokens pruned on FCM errors.
CREATE TABLE IF NOT EXISTS device_tokens (
  student_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, token)
);

-- Every send attempt, whatever the channel. No message bodies with PII
-- beyond title/body needed for the reminder itself.
CREATE TABLE IF NOT EXISTS notification_log (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'inapp')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'invalid_token', 'skipped_quiet')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notification_log_student_idx ON notification_log (student_id);
