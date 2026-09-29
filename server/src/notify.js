// Part A: reminder delivery. FCM push first, email fallback, quiet-hours
// respected, invalid tokens pruned. No personal data beyond what's needed
// to address the message.
import admin from "firebase-admin";
import nodemailer from "nodemailer";
import fs from "node:fs";
import { pool } from "./db.js";

let fcmReady = false;
try {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json";
  if (fs.existsSync(saPath)) {
    admin.initializeApp({ credential: admin.cert(JSON.parse(fs.readFileSync(saPath, "utf8"))) });
    fcmReady = true;
  } else {
    console.error("notify: no service account, push disabled (email/in-app only)");
  }
} catch (e) {
  console.error("notify: firebase init failed, push disabled:", e.message);
}

function mailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function studentEmail(studentId) {
  const { rows } = await pool.query('SELECT email FROM "user" WHERE id=$1', [studentId]);
  return rows[0]?.email || null;
}

function inQuietHours(prefs) {
  if (!prefs?.quiet_start || !prefs?.quiet_end) return false;
  const now = new Date();
  const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const { quiet_start: s, quiet_end: e } = prefs;
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
}

async function log(studentId, channel, title, body, status) {
  await pool.query(
    "INSERT INTO notification_log (student_id, channel, title, body, status) VALUES ($1,$2,$3,$4,$5)",
    [studentId || "", channel, title || "", body || "", status]
  );
}

// Send one reminder. Returns the channel used (or 'skipped_quiet').
export async function sendReminder(studentId, title, body) {
  const { rows } = await pool.query("SELECT notify_opt_in, quiet_start, quiet_end FROM user_prefs WHERE user_id=$1", [studentId]);
  const prefs = rows[0] || { notify_opt_in: true };
  if (prefs.notify_opt_in === false) {
    await log(studentId, "inapp", title, body, "sent"); // in-app list is the fallback
    return "inapp";
  }
  if (inQuietHours(prefs)) {
    await log(studentId, "push", title, body, "skipped_quiet");
    return "skipped_quiet";
  }
  const toks = await pool.query("SELECT token FROM device_tokens WHERE student_id=$1", [studentId]);
  const tokens = toks.rows.map((r) => r.token);
  if (fcmReady && tokens.length) {
    try {
      const res = await admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } });
      let ok = 0;
      res.responses.forEach((r, i) => {
        if (r.success) {
          ok += 1;
        } else if (r.error?.code === "messaging/registration-token-not-registered" || r.error?.code === "messaging/invalid-registration-token") {
          pool.query("DELETE FROM device_tokens WHERE token=$1", [tokens[i]]).catch(() => {});
          log(studentId, "push", title, body, "invalid_token").catch(() => {});
        }
      });
      if (ok > 0) {
        await log(studentId, "push", title, body, "sent");
        return "push";
      }
    } catch (e) {
      console.error("notify: fcm send failed:", e.message);
    }
  }
  // Fallback: email (Q2). Needs an email on the user row.
  const email = await studentEmail(studentId);
  if (email && process.env.SMTP_USER) {
    try {
      await mailer().sendMail({ from: process.env.SMTP_USER, to: email, subject: title, text: body });
      await log(studentId, "email", title, body, "sent");
      return "email";
    } catch (e) {
      console.error("notify: email failed:", e.message);
      await log(studentId, "email", title, body, "failed");
      return "failed";
    }
  }
  await log(studentId, "inapp", title, body, "sent");
  return "inapp";
}

// Worker: send all due curriculum reminders, then mark them sent.
export async function sendDueReminders(limitBefore) {
  const before = limitBefore ? new Date(limitBefore) : new Date();
  const { rows } = await pool.query(
    `SELECT r.id, r.plan_id, p.student_id, p.subject_slug, t.title AS topic_title
     FROM curriculum_plan_reminders r
     JOIN curriculum_study_plans p ON p.id=r.plan_id
     JOIN curriculum_topics t ON t.id=r.topic_id
     WHERE r.status='pending' AND r.remind_at <= $1 AND p.active
     ORDER BY r.remind_at LIMIT 50`,
    [before]
  );
  const out = [];
  for (const r of rows) {
    const channel = await sendReminder(r.student_id, "Study time", `${r.topic_title} (${r.subject_slug})`);
    if (channel !== "skipped_quiet" && channel !== "failed") {
      await pool.query("UPDATE curriculum_plan_reminders SET status='sent' WHERE id=$1", [r.id]);
    }
    out.push({ reminder: r.id, channel });
  }
  return out;
}

export const notifyStatus = () => ({ fcm: fcmReady, email: !!process.env.SMTP_USER });
