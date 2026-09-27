CREATE TABLE IF NOT EXISTS exams (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  exam_code TEXT NOT NULL REFERENCES exams(code),
  subject TEXT NOT NULL,
  name TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS notes (
  topic_id INT PRIMARY KEY REFERENCES topics(id),
  body_md TEXT NOT NULL DEFAULT ''
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
  offline_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
