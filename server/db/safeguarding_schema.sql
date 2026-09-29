-- Safeguarding migration (permissions, consent, proctoring, privacy).
-- Applies the data model for honest permission flows, exam camera
-- monitoring consent, retention, and deletion requests. Apply after
-- curriculum_schema.sql:
--   psql "$DATABASE_URL" -f db/safeguarding_schema.sql
--
-- No audio is ever collected. Snapshots live in R2 (metadata here).

-- PART 0: permission state transitions (no personal data, analytics only).
-- feature: 'notifications' | 'camera' | 'exact_alarm'
-- state: 'prompt_shown' | 'granted' | 'denied_once' | 'permanently_denied' |
--   'revoked' | 'settings_opened'
CREATE TABLE IF NOT EXISTS permission_events (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL DEFAULT '',
  feature TEXT NOT NULL,
  from_state TEXT NOT NULL DEFAULT '',
  to_state TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS permission_events_feature_idx
  ON permission_events (feature, to_state);

-- PART B: consent notices (versioned) + recorded consents (school + parent).
CREATE TABLE IF NOT EXISTS consent_notices (
  version INT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consents (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('school', 'parent')),
  notice_version INT NOT NULL REFERENCES consent_notices(version),
  consenter_name TEXT NOT NULL DEFAULT '',
  relationship TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, consent_type, notice_version)
);

-- PART B: retention setting (default 30 days after results final) + purge log.
CREATE TABLE IF NOT EXISTS retention_settings (
  id INT PRIMARY KEY CHECK (id = 1),
  snapshot_retention_days INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO retention_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS retention_purges (
  id SERIAL PRIMARY KEY,
  deleted_snapshots INT NOT NULL DEFAULT 0,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PART B: exam sessions + proctor flags. Flags never auto-fail an exam.
CREATE TABLE IF NOT EXISTS exam_sessions (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL,
  exam_code TEXT NOT NULL DEFAULT 'WAEC',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  camera_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (camera_status IN ('unknown', 'active', 'denied', 'failed', 'off')),
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  results_final BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS proctor_flags (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL
    CHECK (flag_type IN ('no_face', 'multiple_faces', 'head_turned', 'tab_switch', 'fullscreen_exit', 'backgrounded', 'camera_failed')),
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_url TEXT NOT NULL DEFAULT '',
  snapshot_encrypted BOOLEAN NOT NULL DEFAULT TRUE,
  detail JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS proctor_flags_session_idx ON proctor_flags (session_id);

-- PART B: server-side detection thresholds (global default; per-exam later).
CREATE TABLE IF NOT EXISTS proctor_config (
  id INT PRIMARY KEY CHECK (id = 1),
  no_face_seconds INT NOT NULL DEFAULT 10,
  yaw_degrees INT NOT NULL DEFAULT 35,
  pitch_degrees INT NOT NULL DEFAULT 25,
  sustain_seconds INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO proctor_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- PART C: in-app deletion requests for the data controller to action.
CREATE TABLE IF NOT EXISTS deletion_requests (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
