-- BetterMe core schema (exams, topics, questions, notes, moderation, auth,
-- attempts/progress, mocks, community, analytics).

CREATE TABLE IF NOT EXISTS exams (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  exam_code TEXT NOT NULL REFERENCES exams(code),
  subject TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_topics_exam ON topics(exam_code);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  exam_code TEXT NOT NULL REFERENCES exams(code),
  topic_id INT NOT NULL REFERENCES topics(id),
  stem TEXT NOT NULL,
  options JSONB NOT NULL,
  answer_idx INT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  difficulty INT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3)
);

CREATE INDEX IF NOT EXISTS idx_questions_exam_topic ON questions(exam_code, topic_id);

CREATE TABLE IF NOT EXISTS notes (
  topic_id INT PRIMARY KEY REFERENCES topics(id),
  body_md TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  question_id INT REFERENCES questions(id),
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  exam_code TEXT NOT NULL,
  topic_id INT,
  question_ids JSONB NOT NULL DEFAULT '[]',
  answers JSONB NOT NULL DEFAULT '[]',
  score INT NOT NULL DEFAULT 0,
  duration_s INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'done',
  client_uuid TEXT UNIQUE,
  offline_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_exam ON attempts(user_id, exam_code);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  exam_code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mock_results (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  exam_code TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  score INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL DEFAULT '{}',
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mock_results_user_exam ON mock_results(user_id, exam_code);

CREATE TABLE IF NOT EXISTS exam_progress (
  user_id TEXT NOT NULL,
  exam_code TEXT NOT NULL,
  exam_date DATE,
  target TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, exam_code)
);

CREATE TABLE IF NOT EXISTS user_prefs (
  user_id TEXT PRIMARY KEY,
  reminder_time TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  exam_code TEXT NOT NULL DEFAULT '',
  topic_id INT REFERENCES topics(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  reports INT NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_answers (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  reports INT NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
