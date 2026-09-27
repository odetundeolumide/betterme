import express from "express";
import cors from "cors";
import "dotenv/config";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { pool } from "./db.js";
import { EXAM_SPECS } from "./specs.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Better Auth handler (signup/signin/session)
app.all("/api/auth/*", toNodeHandler(auth));

// Health
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "up" });
  } catch {
    res.status(500).json({ ok: false, db: "down" });
  }
});

// Phase 0/1 stubs backed by Postgres
app.get("/api/exams", async (_req, res) => {
  const { rows } = await pool.query("SELECT code, name FROM exams ORDER BY code");
  res.json(rows);
});

app.get("/api/topics", async (req, res) => {
  const { exam } = req.query;
  const { rows } = await pool.query(
    "SELECT id, exam_code, subject, name FROM topics WHERE ($1::text IS NULL OR exam_code = $1) ORDER BY subject, name LIMIT 200",
    [exam || null]
  );
  res.json(rows);
});

app.get("/api/questions", async (req, res) => {
  const { exam, topic, limit } = req.query;
  const { rows } = await pool.query(
    `SELECT id, exam_code, topic_id, stem, options, answer_idx, explanation, difficulty
     FROM questions
     WHERE ($1::text IS NULL OR exam_code = $1)
       AND ($2::int IS NULL OR topic_id = $2)
     ORDER BY RANDOM() LIMIT LEAST(COALESCE($3::int, 15), 150)`,
    [exam || null, topic || null, limit || 15]
  );
  res.json(rows);
});

// Standard exam specs (counts + timing, Phase 3)
app.get("/api/specs", (_req, res) => res.json(EXAM_SPECS));
app.get("/api/specs/:exam", (req, res) => {
  const spec = EXAM_SPECS[req.params.exam];
  if (!spec) return res.status(404).json({ error: "unknown exam" });
  res.json(spec);
});

// Topic notes (N1/N2)
app.get("/api/notes", async (req, res) => {
  const { topic } = req.query;
  const { rows } = await pool.query("SELECT topic_id, body_md FROM notes WHERE topic_id = $1", [topic]);
  if (!rows.length) return res.status(404).json({ error: "no notes for topic" });
  res.json(rows[0]);
});

// Report a question (P6)
app.post("/api/reports", async (req, res) => {
  const { question_id, reason } = req.body || {};
  if (!question_id) return res.status(400).json({ error: "question_id required" });
  await pool.query("INSERT INTO reports (question_id, reason) VALUES ($1, $2)", [question_id, reason || ""]);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`betterme-server on http://localhost:${PORT}`));
