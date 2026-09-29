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
    "SELECT id, exam_code, subject, name, department FROM topics WHERE ($1::text IS NULL OR exam_code = $1) ORDER BY subject, name LIMIT 200",
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

// ---- Phase 4: attempts, progress, plan, mocks, prefs ----

// Save a finished quiz/diagnostic/practice (G1 source data)
app.post("/api/attempts", async (req, res) => {
  const { user_id, exam_code, topic_id, question_ids, answers, score, duration_s, status, client_uuid, offline_created_at } = req.body || {};
  if (!user_id || !exam_code) return res.status(400).json({ error: "user_id + exam_code required" });
  // Idempotent: offline retries with same client_uuid insert once (O2)
  const { rows } = await pool.query(
    `INSERT INTO attempts (user_id, exam_code, topic_id, question_ids, answers, score, duration_s, status, client_uuid, offline_created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (client_uuid) DO NOTHING RETURNING id`,
    [user_id, exam_code, topic_id || null, JSON.stringify(question_ids || []),
     JSON.stringify(answers || []), score || 0, duration_s || 0, status || "done",
     client_uuid || null, offline_created_at || null]
  );
  res.json({ ok: true, deduped: rows.length === 0 && !!client_uuid });
});

// Offline pack: all topics + questions + notes for an exam in one download (O1)
app.get("/api/pack", async (req, res) => {
  const { exam } = req.query;
  const topics = await pool.query("SELECT id, exam_code, subject, name, department FROM topics WHERE exam_code=$1 ORDER BY id", [exam]);
  const questions = await pool.query(
    "SELECT id, exam_code, topic_id, stem, options, answer_idx, explanation, difficulty FROM questions WHERE exam_code=$1 ORDER BY id LIMIT 500",
    [exam]
  );
  const notes = await pool.query(
    "SELECT n.topic_id, n.body_md FROM notes n JOIN topics t ON t.id=n.topic_id WHERE t.exam_code=$1",
    [exam]
  );
  res.json({ exam, downloaded_at: new Date().toISOString(), topics: topics.rows, questions: questions.rows, notes: notes.rows });
});

// Analytics events (PRD §8 metrics)
app.post("/api/events", async (req, res) => {
  const { user_id, exam_code, name, props } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  await pool.query("INSERT INTO events (user_id, exam_code, name, props) VALUES ($1,$2,$3,$4)",
    [user_id || "", exam_code || "", name, JSON.stringify(props || {})]);
  res.json({ ok: true });
});

// Per-topic progress across attempts (G1)
app.get("/api/progress", async (req, res) => {
  const { user, exam } = req.query;
  const { rows } = await pool.query(
    `SELECT a.topic_id, t.name, COUNT(*) AS n,
            SUM((a.score::float / NULLIF(jsonb_array_length(a.question_ids),0))) AS rate_sum
     FROM attempts a LEFT JOIN topics t ON t.id = a.topic_id
     WHERE a.user_id = $1 AND a.exam_code = $2 AND a.topic_id IS NOT NULL
     GROUP BY a.topic_id, t.name`,
    [user, exam]
  );
  res.json(rows.map((r) => ({ topic_id: r.topic_id, name: r.name, attempts: +r.n, avg: +(r.rate_sum / r.n).toFixed(2) })));
});

// Weekly plan: fix 3 weakest topics, auto-updates from latest data (G2/G3)
app.get("/api/plan", async (req, res) => {
  const { user, exam } = req.query;
  const { rows } = await pool.query(
    `SELECT a.topic_id, t.name,
            AVG(a.score::float / NULLIF(jsonb_array_length(a.question_ids),0)) AS avg,
            COUNT(*) AS n
     FROM attempts a LEFT JOIN topics t ON t.id = a.topic_id
     WHERE a.user_id = $1 AND a.exam_code = $2 AND a.topic_id IS NOT NULL
     GROUP BY a.topic_id, t.name ORDER BY avg ASC NULLS FIRST LIMIT 3`,
    [user, exam]
  );
  res.json(rows.map((r) => ({ topic_id: r.topic_id, name: r.name, avg: r.avg === null ? null : +(+r.avg).toFixed(2), drills: 3 })));
});

// Mock results: save + list for comparison (M1/M2)
app.post("/api/mocks", async (req, res) => {
  const { user_id, exam_code, label, score, total, breakdown } = req.body || {};
  if (!user_id || !exam_code) return res.status(400).json({ error: "user_id + exam_code required" });
  const { rows } = await pool.query(
    `INSERT INTO mock_results (user_id, exam_code, label, score, total, breakdown)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, taken_at`,
    [user_id, exam_code, label || "", score || 0, total || 0, JSON.stringify(breakdown || {})]
  );
  res.json({ ok: true, ...rows[0] });
});

app.get("/api/mocks", async (req, res) => {
  const { user, exam } = req.query;
  const { rows } = await pool.query(
    "SELECT id, label, score, total, breakdown, taken_at FROM mock_results WHERE user_id=$1 AND exam_code=$2 ORDER BY taken_at DESC LIMIT 10",
    [user, exam]
  );
  res.json(rows);
});

// Exam date + target (H5)
app.put("/api/exam-progress", async (req, res) => {
  const { user_id, exam_code, exam_date, target } = req.body || {};
  if (!user_id || !exam_code) return res.status(400).json({ error: "user_id + exam_code required" });
  await pool.query(
    `INSERT INTO exam_progress (user_id, exam_code, exam_date, target) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, exam_code) DO UPDATE SET exam_date=EXCLUDED.exam_date, target=EXCLUDED.target`,
    [user_id, exam_code, exam_date || null, target || ""]
  );
  res.json({ ok: true });
});

app.get("/api/exam-progress", async (req, res) => {
  const { user, exam } = req.query;
  const { rows } = await pool.query("SELECT exam_date, target FROM exam_progress WHERE user_id=$1 AND exam_code=$2", [user, exam]);
  res.json(rows[0] || {});
});

// Reminder time (G4 — stored; native push comes later)
app.put("/api/prefs", async (req, res) => {
  const { user_id, reminder_time } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  await pool.query(
    "INSERT INTO user_prefs (user_id, reminder_time) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET reminder_time=EXCLUDED.reminder_time",
    [user_id, reminder_time || ""]
  );
  res.json({ ok: true });
});

app.get("/api/prefs", async (req, res) => {
  const { rows } = await pool.query("SELECT reminder_time FROM user_prefs WHERE user_id=$1", [req.query.user]);
  res.json(rows[0] || {});
});

// Badges from real data (G5): first diagnostic, topic 80%+, first mock, mock 70%+
app.get("/api/badges", async (req, res) => {
  const { user, exam } = req.query;
  const badges = [];
  const at = await pool.query("SELECT COUNT(*)::int AS c FROM attempts WHERE user_id=$1 AND exam_code=$2", [user, exam]);
  if (at.rows[0].c > 0) badges.push("🎯 Diagnostic done");
  const hi = await pool.query(
    `SELECT t.name FROM attempts a JOIN topics t ON t.id=a.topic_id
     WHERE a.user_id=$1 AND a.exam_code=$2 AND jsonb_array_length(a.question_ids)>0
     GROUP BY t.name HAVING MAX(a.score::float/jsonb_array_length(a.question_ids))>=0.8 LIMIT 5`,
    [user, exam]
  );
  hi.rows.forEach((r) => badges.push(`🏅 ${r.name} 80%+`));
  const mk = await pool.query("SELECT COUNT(*)::int AS c, MAX(score::float/NULLIF(total,0)) AS best FROM mock_results WHERE user_id=$1 AND exam_code=$2", [user, exam]);
  if (mk.rows[0].c > 0) badges.push("📝 First mock");
  if (mk.rows[0].best !== null && +mk.rows[0].best >= 0.7) badges.push("🚀 Mock 70%+");
  res.json(badges);
});

// ---- Phase 5: AI tutor (T1–T4) ----

// What the tutor knows: weak + strong topics, past mastery, history, exam date/target (T2)
async function tutorContext(user, exam) {
  const weak = await pool.query(
    `SELECT a.topic_id, t.name, AVG(a.score::float/NULLIF(jsonb_array_length(a.question_ids),0)) AS avg
     FROM attempts a LEFT JOIN topics t ON t.id=a.topic_id
     WHERE a.user_id=$1 AND a.exam_code=$2 AND a.topic_id IS NOT NULL
     GROUP BY a.topic_id, t.name ORDER BY avg ASC NULLS FIRST LIMIT 3`,
    [user, exam]
  );
  const strong = await pool.query(
    `SELECT a.topic_id, t.name, AVG(a.score::float/NULLIF(jsonb_array_length(a.question_ids),0)) AS avg
     FROM attempts a LEFT JOIN topics t ON t.id=a.topic_id
     WHERE a.user_id=$1 AND a.exam_code=$2 AND a.topic_id IS NOT NULL
     GROUP BY a.topic_id, t.name HAVING AVG(a.score::float/NULLIF(jsonb_array_length(a.question_ids),0)) >= 0.8
     ORDER BY avg DESC LIMIT 5`,
    [user, exam]
  );
  const hist = await pool.query(
    "SELECT status, score, jsonb_array_length(question_ids) AS total, created_at FROM attempts WHERE user_id=$1 AND exam_code=$2 ORDER BY created_at DESC LIMIT 5",
    [user, exam]
  );
  // Things they got right before — recall anchors for "I forgot" moments
  const mastered = await pool.query(
    `SELECT q.stem, t.name AS topic FROM attempts a,
            jsonb_array_elements_text(a.answers) WITH ORDINALITY AS ans(picked, i),
            jsonb_array_elements_text(a.question_ids) WITH ORDINALITY AS qid(qid, i)
     JOIN questions q ON q.id = qid.qid::int
     LEFT JOIN topics t ON t.id = q.topic_id
     WHERE a.user_id=$1 AND a.exam_code=$2
       AND ans.picked::int = q.answer_idx
     ORDER BY a.created_at DESC LIMIT 5`,
    [user, exam]
  ).catch(() => ({ rows: [] }));
  const ep = await pool.query("SELECT exam_date, target FROM exam_progress WHERE user_id=$1 AND exam_code=$2", [user, exam]);
  return {
    weakTopics: weak.rows,
    strongTopics: strong.rows,
    mastered: mastered.rows,
    recent: hist.rows,
    examDate: ep.rows[0]?.exam_date || null,
    target: ep.rows[0]?.target || null,
    suggestion: weak.rows[0] || null, // T3: practice this next
  };
}

app.get("/api/tutor/context", async (req, res) => {
  res.json(await tutorContext(req.query.user, req.query.exam));
});

app.post("/api/tutor/ask", async (req, res) => {
  const { user_id, exam_code, question_id, message, history } = req.body || {};
  if (!message) return res.status(400).json({ error: "message required" });
  const ctx = await tutorContext(user_id, exam_code);
  let question = null, note = null;
  if (question_id) {
    const q = await pool.query("SELECT stem, options, answer_idx, explanation, topic_id FROM questions WHERE id=$1", [question_id]);
    question = q.rows[0] || null;
    if (question) {
      const n = await pool.query("SELECT body_md FROM notes WHERE topic_id=$1", [question.topic_id]);
      note = n.rows[0]?.body_md || null;
    }
  }
  const weakList = ctx.weakTopics.map((w) => `${w.name} (${w.avg === null ? "new" : Math.round(w.avg * 100) + "%"})`).join(", ") || "none yet";
  const strongList = ctx.strongTopics.map((s) => s.name).join(", ") || "none yet";
  const masteredList = ctx.mastered.map((m) => `"${m.stem}" (${m.topic})`).join("; ") || "none yet";

  // No LLM key → honest rule-based fallback grounded in real data
  if (!process.env.LLM_API_KEY) {
    let answer;
    if (question) {
      const opts = typeof question.options === "string" ? JSON.parse(question.options) : question.options;
      const cleanNote = note ? note.replace(/\\n/g, " ").split(". ")[0] : null;
      answer = `Let's break it down: "${question.stem}" The correct answer is "${opts[question.answer_idx]}". ${question.explanation}${cleanNote ? ` Key idea: ${cleanNote}.` : ""}`;
    } else if (ctx.weakTopics.length) {
      answer = `Your weakest topics right now: ${weakList}. I suggest starting with ${ctx.weakTopics[0].name} — tap "Practice" below for a drill.`;
    } else {
      answer = `Take the diagnostic first so I can learn your weak topics, then ask me anything like "explain this again in a simpler way".`;
    }
    if (ctx.strongTopics.length) answer += ` Good news: you've already mastered ${strongList}.`;
    return res.json({ answer, suggestion: ctx.suggestion, source: "fallback" });
  }

  // LLM path: all educational questions; step-by-step depth; conversational
  const system = `You are BetterMe, a friendly conversational tutor for ${exam_code} prep. Chat naturally like a patient teacher: acknowledge what the student says, reference the conversation so far, and ask one short follow-up when it helps.
SCOPE: answer ANY education or study question — syllabus topics, past questions, general knowledge, study skills, exam strategy. If asked something non-educational (gossip, crime, explicit content, etc.), politely decline in one line and steer back to studying.
STUDENT CONTEXT — weak topics: ${weakList}. Mastered: ${strongList}. Answered correctly before: ${masteredList}. Exam date: ${ctx.examDate || "unset"}, target: ${ctx.target || "unset"}.
DEPTH RULES: never answer problem questions vaguely or in two lines. For math/science/computation: numbered STEP-BY-STEP working (Step 1, Step 2…), final answer stated clearly, then one exam tip. For theory: explain simply, give one concrete example, then one exam tip. When confused about something once known, remind them they got it right before and rebuild from that memory. Connect new ideas to mastered topics. End with one concrete next step.`;
  const past = Array.isArray(history) ? history.slice(-6).map((m) => ({
    role: m.from === "tutor" ? "assistant" : "user", content: String(m.text || "").slice(0, 500),
  })) : [];
  const userMsg = question
    ? `Question: ${question.stem}\nCorrect: ${(typeof question.options === "string" ? JSON.parse(question.options) : question.options)[question.answer_idx]}\nWhy: ${question.explanation}\nNotes: ${note || "n/a"}\nStudent asks: ${message}`
    : `Student asks: ${message}`;
  const r = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: JSON.stringify({ model: process.env.LLM_MODEL, messages: [{ role: "system", content: system }, ...past, { role: "user", content: userMsg }], max_completion_tokens: 800 }),
  });
  if (!r.ok) return res.status(502).json({ error: "tutor provider failed" });
  const data = await r.json();
  res.json({ answer: data.choices?.[0]?.message?.content || "", suggestion: ctx.suggestion, source: "llm" });
});

// ---- Phase 6: community (C1/C2) + leaderboard (C3) ----

const mask = (u) => (u && u.includes("@") ? u[0] + "***@" + u.split("@")[1] : String(u || "?").slice(0, 6) + "***");

// One shared feed, exam/topic tags as filters (C1)
app.get("/api/posts", async (req, res) => {
  const { exam, topic } = req.query;
  const { rows } = await pool.query(
    `SELECT p.id, p.user_id, p.exam_code, p.topic_id, t.name AS topic_name, p.title, p.created_at,
            (SELECT COUNT(*)::int FROM post_answers a WHERE a.post_id=p.id AND NOT a.hidden) AS answers
     FROM posts p LEFT JOIN topics t ON t.id=p.topic_id
     WHERE NOT p.hidden
       AND ($1::text IS NULL OR $1 = '' OR p.exam_code = $1 OR p.exam_code = '')
       AND ($2::int IS NULL OR p.topic_id = $2)
     ORDER BY p.created_at DESC LIMIT 50`,
    [exam || null, topic || null]
  );
  res.json(rows.map((r) => ({ ...r, user_id: mask(r.user_id) })));
});

app.post("/api/posts", async (req, res) => {
  const { user_id, exam_code, topic_id, title, body } = req.body || {};
  if (!user_id || !title) return res.status(400).json({ error: "user_id + title required" });
  const { rows } = await pool.query(
    "INSERT INTO posts (user_id, exam_code, topic_id, title, body) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at",
    [user_id, exam_code || "", topic_id || null, title, body || ""]
  );
  res.json({ ok: true, ...rows[0] });
});

app.get("/api/posts/:id", async (req, res) => {
  const p = await pool.query("SELECT * FROM posts WHERE id=$1 AND NOT hidden", [req.params.id]);
  if (!p.rows.length) return res.status(404).json({ error: "not found" });
  const a = await pool.query("SELECT id, user_id, body, is_accepted, created_at FROM post_answers WHERE post_id=$1 AND NOT hidden ORDER BY is_accepted DESC, created_at", [req.params.id]);
  res.json({ ...p.rows[0], user_id: mask(p.rows[0].user_id), answers: a.rows.map((x) => ({ ...x, user_id: mask(x.user_id) })) });
});

app.post("/api/posts/:id/answers", async (req, res) => {
  const { user_id, body } = req.body || {};
  if (!user_id || !body) return res.status(400).json({ error: "user_id + body required" });
  await pool.query("INSERT INTO post_answers (post_id, user_id, body) VALUES ($1,$2,$3)", [req.params.id, user_id, body]);
  res.json({ ok: true });
});

// Accept answer (only the asker)
app.post("/api/posts/:id/accept", async (req, res) => {
  const { answer_id, user_id } = req.body || {};
  const p = await pool.query("SELECT user_id FROM posts WHERE id=$1", [req.params.id]);
  if (!p.rows.length || p.rows[0].user_id !== user_id) return res.status(403).json({ error: "only the asker can accept" });
  await pool.query("UPDATE post_answers SET is_accepted=FALSE WHERE post_id=$1", [req.params.id]);
  await pool.query("UPDATE post_answers SET is_accepted=TRUE WHERE id=$1 AND post_id=$2", [answer_id, req.params.id]);
  res.json({ ok: true });
});

// Report → auto-hide after 3 (moderation v1)
app.post("/api/posts/:id/report", async (req, res) => {
  await pool.query("UPDATE posts SET reports = reports + 1, hidden = (reports + 1) >= 3 WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

// Leaderboard by quiz scores, exam-filtered by default (C3)
app.get("/api/leaderboard", async (req, res) => {
  const { exam, user } = req.query;
  const { rows } = await pool.query(
    `SELECT user_id, SUM(score)::int AS total, COUNT(*)::int AS quizzes
     FROM attempts WHERE exam_code=$1 GROUP BY user_id ORDER BY total DESC LIMIT 20`,
    [exam]
  );
  const board = rows.map((r, i) => ({ rank: i + 1, user: mask(r.user_id), total: r.total, quizzes: r.quizzes, you: r.user_id === user }));
  const me = board.find((b) => b.you) || null;
  res.json({ board, me });
});

app.listen(PORT, () => console.log(`betterme-server on http://localhost:${PORT}`));
