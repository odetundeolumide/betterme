import type { Config, Context } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import bcrypt from "bcryptjs";
import Anthropic from "@anthropic-ai/sdk";

// Standard exam specs — real-exam question counts & timing.
// V1 is MCQ-only, so writing/speaking/essay sections are excluded by design.
const EXAM_SPECS: Record<string, any> = {
  WAEC: {
    subjects: {
      Mathematics: { questions: 50, minutes: 90, verify: false },
      English: { questions: 80, minutes: 60, verify: true },
      default: { questions: 50, minutes: 60, verify: true },
    },
    diagnostic: { questions: 15, minutes: 15 },
    practice: { questions: 10, minutes: 10 },
  },
  TOEFL: {
    sections: [
      { name: "Reading", questions: 20, minutes: 35 },
      { name: "Listening", questions: 28, minutes: 36 },
    ],
    total: { questions: 48, minutes: 71, verify: true },
    diagnostic: { questions: 15, minutes: 15 },
    practice: { questions: 10, minutes: 10 },
  },
  SAT: {
    sections: [
      { name: "Reading & Writing", questions: 54, minutes: 64 },
      { name: "Math", questions: 44, minutes: 70 },
    ],
    total: { questions: 98, minutes: 134, verify: false },
    diagnostic: { questions: 15, minutes: 15 },
    practice: { questions: 10, minutes: 12 },
  },
  GRE: {
    sections: [
      { name: "Verbal Reasoning", questions: 27, minutes: 41 },
      { name: "Quantitative Reasoning", questions: 27, minutes: 47 },
    ],
    total: { questions: 54, minutes: 88, verify: false },
    diagnostic: { questions: 15, minutes: 15 },
    practice: { questions: 10, minutes: 12 },
  },
};

const mask = (u: string) =>
  u && u.includes("@") ? u[0] + "***@" + u.split("@")[1] : String(u || "?").slice(0, 6) + "***";

const anthropic = new Anthropic();

async function tutorContext(db: any, user: string, exam: string) {
  const weak = await db.sql`
    SELECT a.topic_id, t.name, AVG(a.score::float/NULLIF(jsonb_array_length(a.question_ids),0)) AS avg
    FROM attempts a LEFT JOIN topics t ON t.id=a.topic_id
    WHERE a.user_id=${user} AND a.exam_code=${exam} AND a.topic_id IS NOT NULL
    GROUP BY a.topic_id, t.name ORDER BY avg ASC NULLS FIRST LIMIT 3
  `;
  const hist = await db.sql`
    SELECT status, score, jsonb_array_length(question_ids) AS total, created_at
    FROM attempts WHERE user_id=${user} AND exam_code=${exam}
    ORDER BY created_at DESC LIMIT 5
  `;
  const ep = await db.sql`
    SELECT exam_date, target FROM exam_progress WHERE user_id=${user} AND exam_code=${exam}
  `;
  return {
    weakTopics: weak,
    recent: hist,
    examDate: ep[0]?.exam_date || null,
    target: ep[0]?.target || null,
    suggestion: weak[0] || null,
  };
}

export default async (req: Request) => {
  const db = getDatabase();
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["api", ...]
  const q = url.searchParams;
  const method = req.method;

  const json = (data: unknown, status = 200) => Response.json(data, { status });
  const body = async () => {
    try {
      return await req.json();
    } catch {
      return {};
    }
  };

  try {
    // ---- health ----
    if (parts[1] === "health" && method === "GET") {
      await db.sql`SELECT 1`;
      return json({ ok: true, db: "up" });
    }

    // ---- auth ----
    if (parts[1] === "auth" && parts[3] === "email" && method === "POST") {
      const { email, password } = await body();
      if (!email || !password) return json({ error: "email + password required" }, 400);
      const normalized = String(email).trim().toLowerCase();

      if (parts[2] === "sign-up") {
        const existing = await db.sql`SELECT id FROM users WHERE email = ${normalized}`;
        if (existing.length) return json({ error: "account already exists" }, 409);
        const hash = await bcrypt.hash(password, 10);
        await db.sql`INSERT INTO users (email, password_hash) VALUES (${normalized}, ${hash})`;
        return json({ ok: true, email: normalized });
      }

      if (parts[2] === "sign-in") {
        const rows = await db.sql`SELECT password_hash FROM users WHERE email = ${normalized}`;
        if (!rows.length) return json({ error: "invalid email or password" }, 401);
        const valid = await bcrypt.compare(password, rows[0].password_hash);
        if (!valid) return json({ error: "invalid email or password" }, 401);
        return json({ ok: true, email: normalized });
      }
    }

    // ---- exams / topics / questions / specs ----
    if (parts[1] === "exams" && method === "GET") {
      return json(await db.sql`SELECT code, name FROM exams ORDER BY code`);
    }

    if (parts[1] === "topics" && method === "GET") {
      const exam = q.get("exam");
      return json(await db.sql`
        SELECT id, exam_code, subject, name, department FROM topics
        WHERE (${exam}::text IS NULL OR exam_code = ${exam})
        ORDER BY subject, name LIMIT 200
      `);
    }

    if (parts[1] === "questions" && method === "GET") {
      const exam = q.get("exam");
      const topic = q.get("topic") ? Number(q.get("topic")) : null;
      const limit = q.get("limit") ? Number(q.get("limit")) : 15;
      return json(await db.sql`
        SELECT id, exam_code, topic_id, stem, options, answer_idx, explanation, difficulty
        FROM questions
        WHERE (${exam}::text IS NULL OR exam_code = ${exam})
          AND (${topic}::int IS NULL OR topic_id = ${topic})
        ORDER BY RANDOM() LIMIT LEAST(COALESCE(${limit}::int, 15), 150)
      `);
    }

    if (parts[1] === "specs" && method === "GET") {
      if (parts[2]) {
        const spec = EXAM_SPECS[parts[2]];
        if (!spec) return json({ error: "unknown exam" }, 404);
        return json(spec);
      }
      return json(EXAM_SPECS);
    }

    if (parts[1] === "notes" && method === "GET") {
      const topic = Number(q.get("topic"));
      const rows = await db.sql`SELECT topic_id, body_md FROM notes WHERE topic_id = ${topic}`;
      if (!rows.length) return json({ error: "no notes for topic" }, 404);
      return json(rows[0]);
    }

    if (parts[1] === "reports" && method === "POST") {
      const { question_id, reason } = await body();
      if (!question_id) return json({ error: "question_id required" }, 400);
      await db.sql`INSERT INTO reports (question_id, reason) VALUES (${question_id}, ${reason || ""})`;
      return json({ ok: true });
    }

    // ---- attempts / pack / events ----
    if (parts[1] === "attempts" && method === "POST") {
      const {
        user_id, exam_code, topic_id, question_ids, answers, score,
        duration_s, status, client_uuid, offline_created_at,
      } = await body();
      if (!user_id || !exam_code) return json({ error: "user_id + exam_code required" }, 400);
      const rows = await db.sql`
        INSERT INTO attempts (user_id, exam_code, topic_id, question_ids, answers, score, duration_s, status, client_uuid, offline_created_at)
        VALUES (${user_id}, ${exam_code}, ${topic_id || null}, ${JSON.stringify(question_ids || [])}::jsonb,
                ${JSON.stringify(answers || [])}::jsonb, ${score || 0}, ${duration_s || 0}, ${status || "done"},
                ${client_uuid || null}, ${offline_created_at || null})
        ON CONFLICT (client_uuid) DO NOTHING RETURNING id
      `;
      return json({ ok: true, deduped: rows.length === 0 && !!client_uuid });
    }

    if (parts[1] === "pack" && method === "GET") {
      const exam = q.get("exam");
      const [topics, questions, notes] = await Promise.all([
        db.sql`SELECT id, exam_code, subject, name, department FROM topics WHERE exam_code=${exam} ORDER BY id`,
        db.sql`SELECT id, exam_code, topic_id, stem, options, answer_idx, explanation, difficulty FROM questions WHERE exam_code=${exam} ORDER BY id LIMIT 500`,
        db.sql`SELECT n.topic_id, n.body_md FROM notes n JOIN topics t ON t.id=n.topic_id WHERE t.exam_code=${exam}`,
      ]);
      return json({ exam, downloaded_at: new Date().toISOString(), topics, questions, notes });
    }

    if (parts[1] === "events" && method === "POST") {
      const { user_id, exam_code, name, props } = await body();
      if (!name) return json({ error: "name required" }, 400);
      await db.sql`
        INSERT INTO events (user_id, exam_code, name, props)
        VALUES (${user_id || ""}, ${exam_code || ""}, ${name}, ${JSON.stringify(props || {})}::jsonb)
      `;
      return json({ ok: true });
    }

    // ---- progress / plan / mocks / exam-progress / prefs / badges ----
    if (parts[1] === "progress" && method === "GET") {
      const user = q.get("user"), exam = q.get("exam");
      const rows = await db.sql`
        SELECT a.topic_id, t.name, COUNT(*) AS n,
               SUM((a.score::float / NULLIF(jsonb_array_length(a.question_ids),0))) AS rate_sum
        FROM attempts a LEFT JOIN topics t ON t.id = a.topic_id
        WHERE a.user_id = ${user} AND a.exam_code = ${exam} AND a.topic_id IS NOT NULL
        GROUP BY a.topic_id, t.name
      `;
      return json(rows.map((r: any) => ({
        topic_id: r.topic_id, name: r.name, attempts: +r.n, avg: +(r.rate_sum / r.n).toFixed(2),
      })));
    }

    if (parts[1] === "plan" && method === "GET") {
      const user = q.get("user"), exam = q.get("exam");
      const rows = await db.sql`
        SELECT a.topic_id, t.name,
               AVG(a.score::float / NULLIF(jsonb_array_length(a.question_ids),0)) AS avg,
               COUNT(*) AS n
        FROM attempts a LEFT JOIN topics t ON t.id = a.topic_id
        WHERE a.user_id = ${user} AND a.exam_code = ${exam} AND a.topic_id IS NOT NULL
        GROUP BY a.topic_id, t.name ORDER BY avg ASC NULLS FIRST LIMIT 3
      `;
      return json(rows.map((r: any) => ({
        topic_id: r.topic_id, name: r.name,
        avg: r.avg === null ? null : +(+r.avg).toFixed(2), drills: 3,
      })));
    }

    if (parts[1] === "mocks" && method === "POST") {
      const { user_id, exam_code, label, score, total, breakdown } = await body();
      if (!user_id || !exam_code) return json({ error: "user_id + exam_code required" }, 400);
      const rows = await db.sql`
        INSERT INTO mock_results (user_id, exam_code, label, score, total, breakdown)
        VALUES (${user_id}, ${exam_code}, ${label || ""}, ${score || 0}, ${total || 0}, ${JSON.stringify(breakdown || {})}::jsonb)
        RETURNING id, taken_at
      `;
      return json({ ok: true, ...rows[0] });
    }

    if (parts[1] === "mocks" && method === "GET") {
      const user = q.get("user"), exam = q.get("exam");
      return json(await db.sql`
        SELECT id, label, score, total, breakdown, taken_at FROM mock_results
        WHERE user_id=${user} AND exam_code=${exam} ORDER BY taken_at DESC LIMIT 10
      `);
    }

    if (parts[1] === "exam-progress" && method === "PUT") {
      const { user_id, exam_code, exam_date, target } = await body();
      if (!user_id || !exam_code) return json({ error: "user_id + exam_code required" }, 400);
      await db.sql`
        INSERT INTO exam_progress (user_id, exam_code, exam_date, target) VALUES (${user_id}, ${exam_code}, ${exam_date || null}, ${target || ""})
        ON CONFLICT (user_id, exam_code) DO UPDATE SET exam_date=EXCLUDED.exam_date, target=EXCLUDED.target
      `;
      return json({ ok: true });
    }

    if (parts[1] === "exam-progress" && method === "GET") {
      const user = q.get("user"), exam = q.get("exam");
      const rows = await db.sql`SELECT exam_date, target FROM exam_progress WHERE user_id=${user} AND exam_code=${exam}`;
      return json(rows[0] || {});
    }

    if (parts[1] === "prefs" && method === "PUT") {
      const { user_id, reminder_time } = await body();
      if (!user_id) return json({ error: "user_id required" }, 400);
      await db.sql`
        INSERT INTO user_prefs (user_id, reminder_time) VALUES (${user_id}, ${reminder_time || ""})
        ON CONFLICT (user_id) DO UPDATE SET reminder_time=EXCLUDED.reminder_time
      `;
      return json({ ok: true });
    }

    if (parts[1] === "prefs" && method === "GET") {
      const rows = await db.sql`SELECT reminder_time FROM user_prefs WHERE user_id=${q.get("user")}`;
      return json(rows[0] || {});
    }

    if (parts[1] === "badges" && method === "GET") {
      const user = q.get("user"), exam = q.get("exam");
      const badges: string[] = [];
      const at = await db.sql`SELECT COUNT(*)::int AS c FROM attempts WHERE user_id=${user} AND exam_code=${exam}`;
      if (at[0].c > 0) badges.push("🎯 Diagnostic done");
      const hi = await db.sql`
        SELECT t.name FROM attempts a JOIN topics t ON t.id=a.topic_id
        WHERE a.user_id=${user} AND a.exam_code=${exam} AND jsonb_array_length(a.question_ids)>0
        GROUP BY t.name HAVING MAX(a.score::float/jsonb_array_length(a.question_ids))>=0.8 LIMIT 5
      `;
      hi.forEach((r: any) => badges.push(`🏅 ${r.name} 80%+`));
      const mk = await db.sql`
        SELECT COUNT(*)::int AS c, MAX(score::float/NULLIF(total,0)) AS best
        FROM mock_results WHERE user_id=${user} AND exam_code=${exam}
      `;
      if (mk[0].c > 0) badges.push("📝 First mock");
      if (mk[0].best !== null && +mk[0].best >= 0.7) badges.push("🚀 Mock 70%+");
      return json(badges);
    }

    // ---- AI tutor ----
    if (parts[1] === "tutor" && parts[2] === "context" && method === "GET") {
      return json(await tutorContext(db, q.get("user") || "", q.get("exam") || ""));
    }

    if (parts[1] === "tutor" && parts[2] === "ask" && method === "POST") {
      const { user_id, exam_code, question_id, message } = await body();
      if (!message) return json({ error: "message required" }, 400);
      const ctx = await tutorContext(db, user_id || "", exam_code || "");
      let question: any = null, note: string | null = null;
      if (question_id) {
        const qr = await db.sql`SELECT stem, options, answer_idx, explanation, topic_id FROM questions WHERE id=${question_id}`;
        question = qr[0] || null;
        if (question) {
          const nr = await db.sql`SELECT body_md FROM notes WHERE topic_id=${question.topic_id}`;
          note = nr[0]?.body_md || null;
        }
      }
      const weakList = ctx.weakTopics.map((w: any) => `${w.name} (${w.avg === null ? "new" : Math.round(w.avg * 100) + "%"})`).join(", ") || "none yet";

      try {
        const system = `You are BetterMe, a tutor for ${exam_code} prep. Student weak topics: ${weakList}. Exam date: ${ctx.examDate || "unset"}, target: ${ctx.target || "unset"}. Be concise, exam-focused, and end with one concrete next step.`;
        const userMsg = question
          ? `Question: ${question.stem}\nCorrect: ${(typeof question.options === "string" ? JSON.parse(question.options) : question.options)[question.answer_idx]}\nWhy: ${question.explanation}\nNotes: ${note || "n/a"}\nStudent asks: ${message}`
          : `Student asks: ${message}`;
        const resp = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 400,
          system,
          messages: [{ role: "user", content: userMsg }],
        });
        const answer = resp.content[0]?.type === "text" ? resp.content[0].text : "";
        return json({ answer, suggestion: ctx.suggestion, source: "llm" });
      } catch {
        let answer: string;
        if (question) {
          const opts = typeof question.options === "string" ? JSON.parse(question.options) : question.options;
          const cleanNote = note ? note.replace(/\\n/g, " ").split(". ")[0] : null;
          answer = `Let's break it down: "${question.stem}" The correct answer is "${opts[question.answer_idx]}". ${question.explanation}${cleanNote ? ` Key idea: ${cleanNote}.` : ""}`;
        } else if (ctx.weakTopics.length) {
          answer = `Your weakest topics right now: ${weakList}. I suggest starting with ${ctx.weakTopics[0].name} — tap "Practice" below for a drill.`;
        } else {
          answer = `Take the diagnostic first so I can learn your weak topics, then ask me anything like "explain this again in a simpler way".`;
        }
        return json({ answer, suggestion: ctx.suggestion, source: "fallback" });
      }
    }

    // ---- community + leaderboard ----
    if (parts[1] === "posts" && !parts[2] && method === "GET") {
      const exam = q.get("exam"), topic = q.get("topic") ? Number(q.get("topic")) : null;
      const rows = await db.sql`
        SELECT p.id, p.user_id, p.exam_code, p.topic_id, t.name AS topic_name, p.title, p.created_at,
               (SELECT COUNT(*)::int FROM post_answers a WHERE a.post_id=p.id AND NOT a.hidden) AS answers
        FROM posts p LEFT JOIN topics t ON t.id=p.topic_id
        WHERE NOT p.hidden
          AND (${exam}::text IS NULL OR ${exam} = '' OR p.exam_code = ${exam} OR p.exam_code = '')
          AND (${topic}::int IS NULL OR p.topic_id = ${topic})
        ORDER BY p.created_at DESC LIMIT 50
      `;
      return json(rows.map((r: any) => ({ ...r, user_id: mask(r.user_id) })));
    }

    if (parts[1] === "posts" && !parts[2] && method === "POST") {
      const { user_id, exam_code, topic_id, title, body: postBody } = await body();
      if (!user_id || !title) return json({ error: "user_id + title required" }, 400);
      const rows = await db.sql`
        INSERT INTO posts (user_id, exam_code, topic_id, title, body)
        VALUES (${user_id}, ${exam_code || ""}, ${topic_id || null}, ${title}, ${postBody || ""})
        RETURNING id, created_at
      `;
      return json({ ok: true, ...rows[0] });
    }

    if (parts[1] === "posts" && parts[2] && !parts[3] && method === "GET") {
      const id = Number(parts[2]);
      const p = await db.sql`SELECT * FROM posts WHERE id=${id} AND NOT hidden`;
      if (!p.length) return json({ error: "not found" }, 404);
      const a = await db.sql`
        SELECT id, user_id, body, is_accepted, created_at FROM post_answers
        WHERE post_id=${id} AND NOT hidden ORDER BY is_accepted DESC, created_at
      `;
      return json({
        ...p[0], user_id: mask(p[0].user_id),
        answers: a.map((x: any) => ({ ...x, user_id: mask(x.user_id) })),
      });
    }

    if (parts[1] === "posts" && parts[3] === "answers" && method === "POST") {
      const id = Number(parts[2]);
      const { user_id, body: answerBody } = await body();
      if (!user_id || !answerBody) return json({ error: "user_id + body required" }, 400);
      await db.sql`INSERT INTO post_answers (post_id, user_id, body) VALUES (${id}, ${user_id}, ${answerBody})`;
      return json({ ok: true });
    }

    if (parts[1] === "posts" && parts[3] === "accept" && method === "POST") {
      const id = Number(parts[2]);
      const { answer_id, user_id } = await body();
      const p = await db.sql`SELECT user_id FROM posts WHERE id=${id}`;
      if (!p.length || p[0].user_id !== user_id) return json({ error: "only the asker can accept" }, 403);
      await db.sql`UPDATE post_answers SET is_accepted=FALSE WHERE post_id=${id}`;
      await db.sql`UPDATE post_answers SET is_accepted=TRUE WHERE id=${answer_id} AND post_id=${id}`;
      return json({ ok: true });
    }

    if (parts[1] === "posts" && parts[3] === "report" && method === "POST") {
      const id = Number(parts[2]);
      await db.sql`UPDATE posts SET reports = reports + 1, hidden = (reports + 1) >= 3 WHERE id=${id}`;
      return json({ ok: true });
    }

    if (parts[1] === "leaderboard" && method === "GET") {
      const exam = q.get("exam"), user = q.get("user");
      const rows = await db.sql`
        SELECT user_id, SUM(score)::int AS total, COUNT(*)::int AS quizzes
        FROM attempts WHERE exam_code=${exam} GROUP BY user_id ORDER BY total DESC LIMIT 20
      `;
      const board = rows.map((r: any, i: number) => ({
        rank: i + 1, user: mask(r.user_id), total: r.total, quizzes: r.quizzes, you: r.user_id === user,
      }));
      const me = board.find((b: any) => b.you) || null;
      return json({ board, me });
    }

    return json({ error: "not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "internal error" }, 500);
  }
};

export const config: Config = {
  path: "/api/*",
};
