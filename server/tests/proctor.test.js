// Part B backend tests: consent gating, sessions, flags, config, purge.
// Run: npm test. Requires API on :3000 with safeguarding_schema applied.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db.js";

const API = "http://127.0.0.1:3000";
const U = "test-proctor-user";
const O = "test-proctor-other";
let sessionId = null;
let noticeVersion = null;
let createdTestNotice = false;

before(async () => {
  const h = await fetch(`${API}/api/health`).then((r) => r.json()).catch(() => null);
  assert.ok(h?.db === "up", "API must be running with DB up");
  const activeNotice = await pool.query("SELECT version FROM consent_notices WHERE active ORDER BY version DESC LIMIT 1");
  if (activeNotice.rows.length) {
    noticeVersion = activeNotice.rows[0].version;
  } else {
    const next = await pool.query("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM consent_notices");
    noticeVersion = next.rows[0].version;
    await pool.query(
      "INSERT INTO consent_notices (version, title, body, active) VALUES ($1, 'Test-only notice', 'Test fixture; not approved for real consent.', TRUE)",
      [noticeVersion]
    );
    createdTestNotice = true;
  }
  for (const u of [U, O]) {
    await pool.query(`INSERT INTO "user" (id, name, email) VALUES ($1,$1,$2) ON CONFLICT (id) DO NOTHING`, [u, `${u}@test.local`]);
  }
});

test("consent: session blocked without both consents", async () => {
  const g = await fetch(`${API}/api/consents?user=${U}`).then((r) => r.json());
  assert.ok(g.notice && g.notice.version === noticeVersion);
  assert.equal(g.complete, false);
  const r = await fetch(`${API}/api/exam-sessions`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: U, exam_code: "WAEC" }),
  });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).need_consent, true);
});

test("proctoring fails closed when no active notice is configured", async () => {
  await pool.query("UPDATE consent_notices SET active=FALSE WHERE version=$1", [noticeVersion]);
  try {
    const consent = await fetch(`${API}/api/consents?user=${U}`);
    assert.equal(consent.status, 503);
    const session = await fetch(`${API}/api/exam-sessions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: U, exam_code: "WAEC" }),
    });
    assert.equal(session.status, 503);
  } finally {
    await pool.query("UPDATE consent_notices SET active=TRUE WHERE version=$1", [noticeVersion]);
  }
});

test("consent: parent needs a name; both consents unlock sessions", async () => {
  const post = (b) => fetch(`${API}/api/consents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  let r = await post({ student_id: U, consent_type: "parent", notice_version: noticeVersion });
  assert.equal(r.status, 400);
  r = await post({ student_id: U, consent_type: "school", notice_version: noticeVersion, consenter_name: "Test School" });
  assert.equal(r.status, 200);
  r = await post({ student_id: U, consent_type: "parent", notice_version: noticeVersion, consenter_name: "Test Parent", relationship: "mother" });
  assert.equal(r.status, 200);
  const g = await fetch(`${API}/api/consents?user=${U}`).then((x) => x.json());
  assert.equal(g.complete, true);
  r = await fetch(`${API}/api/exam-sessions`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: U, exam_code: "WAEC" }),
  });
  assert.equal(r.status, 200);
  sessionId = (await r.json()).id;
  assert.ok(sessionId);
});

test("flags: write own session, reject bad type and other students", async () => {
  const post = (b) => fetch(`${API}/api/proctor-flags`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  let r = await post({ student_id: U, session_id: sessionId, flag_type: "nope" });
  assert.equal(r.status, 400);
  r = await post({ student_id: O, session_id: sessionId, flag_type: "no_face" });
  assert.equal(r.status, 403);
  r = await post({ student_id: U, session_id: sessionId, flag_type: "no_face", detail: { seconds: 12 } });
  assert.equal(r.status, 200);
  const list = await fetch(`${API}/api/exam-sessions/${sessionId}/flags?user=${U}`).then((x) => x.json());
  assert.equal(list.length, 1);
  assert.equal(list[0].flag_type, "no_face");
  const other = await fetch(`${API}/api/exam-sessions/${sessionId}/flags?user=${O}`);
  assert.equal(other.status, 403);
});

test("config + retention endpoints answer", async () => {
  const c = await fetch(`${API}/api/proctor-config`).then((r) => r.json());
  assert.equal(c.no_face_seconds, 10);
  assert.equal(c.yaw_degrees, 35);
  const t = await fetch(`${API}/api/retention`).then((r) => r.json());
  assert.equal(t.snapshot_retention_days, 30);
  const p = await fetch(`${API}/api/retention/purge`, { method: "POST" });
  assert.equal(p.status, 200);
  assert.ok(typeof (await p.json()).deleted === "number");
});

test("deletion requests: known student ok, unknown student 404", async () => {
  let r = await fetch(`${API}/api/deletion-requests`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "test-proctor-user", reason: "leaving" }),
  });
  assert.equal(r.status, 200);
  r = await fetch(`${API}/api/deletion-requests`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "ghost-user", reason: "x" }),
  });
  assert.equal(r.status, 404);
});

test("session patch: owner-only, validates camera_status", async () => {
  const patch = (id, b) => fetch(`${API}/api/exam-sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  let r = await patch(sessionId, { student_id: O, camera_status: "active" });
  assert.equal(r.status, 403);
  r = await patch(sessionId, { student_id: U, camera_status: "bogus" });
  assert.equal(r.status, 400);
  r = await patch(sessionId, { student_id: U, camera_status: "denied", needs_review: true });
  assert.equal(r.status, 200);
});

after(async () => {
  await pool.query("DELETE FROM proctor_flags WHERE session_id IN (SELECT id FROM exam_sessions WHERE student_id LIKE 'test-proctor-%')");
  await pool.query("DELETE FROM exam_sessions WHERE student_id LIKE 'test-proctor-%'");
  await pool.query("DELETE FROM consents WHERE student_id LIKE 'test-proctor-%'");
  await pool.query("DELETE FROM deletion_requests WHERE student_id LIKE 'test-proctor-%'");
  await pool.query('DELETE FROM "user" WHERE id LIKE \'test-proctor-%\'');
  if (createdTestNotice) await pool.query("DELETE FROM consent_notices WHERE version=$1", [noticeVersion]);
  await pool.end();
});
