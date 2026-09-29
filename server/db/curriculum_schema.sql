-- Curriculum migration (STEP 1): structured WAEC data from
-- doc/WAEC_Subjects_and_Curriculum.md
--
-- Table prefix is `curriculum_` to avoid colliding with the existing quiz
-- tables (`topics`, `notes`, ...), which serve practice questions, not the
-- syllabus tree. Apply after schema.sql:
--   psql "$DATABASE_URL" -f db/curriculum_schema.sql

-- STEP 1: departments (Science, Humanities, Business). Core subjects are
-- linked to every department via curriculum_dept_subjects.
CREATE TABLE IF NOT EXISTS curriculum_departments (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort INT NOT NULL DEFAULT 0
);

-- STEP 1: subjects, stored once even when shared across departments.
CREATE TABLE IF NOT EXISTS curriculum_subjects (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_core BOOLEAN NOT NULL DEFAULT FALSE,
  aims TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

-- STEP 1: many-to-many links. `eligible` is configurable (default allow):
-- the press-reported "Economics for Business students only" 2026 guideline
-- is unconfirmed by WAEC, so it lives here as a note, not a hard rule.
CREATE TABLE IF NOT EXISTS curriculum_dept_subjects (
  department_slug TEXT NOT NULL REFERENCES curriculum_departments(slug),
  subject_slug TEXT NOT NULL REFERENCES curriculum_subjects(slug) ON DELETE CASCADE,
  eligible BOOLEAN NOT NULL DEFAULT TRUE,
  eligibility_note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (department_slug, subject_slug)
);

-- STEP 1: topic tree. parent_topic_id NULL = top-level topic/section.
CREATE TABLE IF NOT EXISTS curriculum_topics (
  id SERIAL PRIMARY KEY,
  subject_slug TEXT NOT NULL REFERENCES curriculum_subjects(slug) ON DELETE CASCADE,
  parent_topic_id INT REFERENCES curriculum_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic_order INT NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS curriculum_topics_subject_idx
  ON curriculum_topics (subject_slug, topic_order);
CREATE INDEX IF NOT EXISTS curriculum_topics_parent_idx
  ON curriculum_topics (parent_topic_id);

-- STEP 1: exam papers, one row per "Paper N" bullet.
CREATE TABLE IF NOT EXISTS curriculum_exam_papers (
  id SERIAL PRIMARY KEY,
  subject_slug TEXT NOT NULL REFERENCES curriculum_subjects(slug) ON DELETE CASCADE,
  label TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT ''
);

-- STEP 1: recommended textbooks / reading lists, one row per citation.
CREATE TABLE IF NOT EXISTS curriculum_textbooks (
  id SERIAL PRIMARY KEY,
  subject_slug TEXT NOT NULL REFERENCES curriculum_subjects(slug) ON DELETE CASCADE,
  citation TEXT NOT NULL,
  sort INT NOT NULL DEFAULT 0
);

-- STEP 1: provenance. Most content is a secondary copy of the WAEC syllabus,
-- so every subject records where it came from and how reliable it is.
CREATE TABLE IF NOT EXISTS curriculum_sources (
  subject_slug TEXT PRIMARY KEY REFERENCES curriculum_subjects(slug) ON DELETE CASCADE,
  source_url TEXT NOT NULL DEFAULT '',
  source_note TEXT NOT NULL DEFAULT '',
  syllabus_edition TEXT NOT NULL DEFAULT '',
  reliability TEXT NOT NULL DEFAULT 'secondary-copy-unverified',
  last_verified_at TIMESTAMPTZ
);

-- STEP 1: per-student topic progress. student_id is the Better Auth user id,
-- same convention as attempts/user_prefs.
CREATE TABLE IF NOT EXISTS curriculum_progress (
  student_id TEXT NOT NULL,
  topic_id INT NOT NULL REFERENCES curriculum_topics(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'studying', 'done')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, topic_id)
);

-- STEP 6: admin allow-list. Production should use real roles; this table is
-- the minimal gate: only user_ids listed here may use /api/curriculum/admin/*.
-- Seed locally with: INSERT INTO admin_users (user_id) VALUES ('<your id>');
CREATE TABLE IF NOT EXISTS admin_users (
  user_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- STEP 5: study plans (data model + API only; delivery is a separate system).
-- A student picks a subject, topics and a time slot; creation fans out one
-- pending reminder row per topic for the notification system to pick up.
CREATE TABLE IF NOT EXISTS curriculum_study_plans (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL,
  subject_slug TEXT NOT NULL REFERENCES curriculum_subjects(slug) ON DELETE CASCADE,
  time_slot TEXT NOT NULL DEFAULT '',
  days TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS curriculum_plan_reminders (
  id SERIAL PRIMARY KEY,
  plan_id INT NOT NULL REFERENCES curriculum_study_plans(id) ON DELETE CASCADE,
  topic_id INT NOT NULL REFERENCES curriculum_topics(id) ON DELETE CASCADE,
  remind_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS curriculum_plan_reminders_due_idx
  ON curriculum_plan_reminders (status, remind_at);
