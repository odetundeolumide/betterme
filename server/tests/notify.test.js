// Part A tests: prefs extension, device tokens, send worker, notify status.
// Run: npm test. Requires API on :3000 with notifications_schema applied.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db.js";

const API = "http://127.0.0.1:3000";
const U = "test-notify-user";

before(async () => {
  const h = await fetch(`${API}/api/health`).then((r) => r.json()).catch(() => null);
  assert.ok(h?.db === "up", "API must be running with DB up");
  await pool.query(`INSERT INTO "user" (id, name, email) VALUES ($1,$1,$2) ON CONFLICT (id) DO NOTHING`, [U, `${U}@test.local`]);
});

test("prefs: round-trips opt-in, days, quiet hours without clobbering", async () => {
  const put = (b) => fetch(`${API}/api/prefs`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: U, ...b }) }).then((r) => r.json());
  await put({ reminder_time: "18:30", notify_opt_in: false, days: "Mon,Wed", quiet_start: "22:00", quiet_end: "06:00" });
  let g = await fetch(`${API}/api/prefs?user=${U}`).then((r) => r.json());
  assert.equal(g.notify_opt_in, false);
  assert.equal(g.days, "Mon,Wed");
  // omitted notify_opt_in must NOT flip back to true
  await put({ reminder_time: "19:00" });
  g = await fetch(`${API}/api/prefs?user=${U}`).then((r) => r.json());
  assert.equal(g.notify_opt_in, false);
  assert.equal(g.reminder_time, "19:00");
});

test("device-tokens: register, refresh, unknown user, delete", async () => {
  const post = (b) => fetch(`${API}/api/device-tokens`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  let r = await post({ user_id: "no-such-user", token: "t1" });
  assert.equal(r.status, 404);
  r = await post({ user_id: U, platform: "android", token: "test-token-1" });
  assert.equal(r.status, 200);
  r = await post({ user_id: U, platform: "android", token: "test-token-1" });
  assert.equal(r.status, 200); // refresh = upsert, no duplicate
  const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM device_tokens WHERE student_id=$1", [U]);
  assert.equal(rows[0].c, 1);
  r = await fetch(`${API}/api/device-tokens`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: U, token: "test-token-1" }) });
  assert.equal(r.status, 200);
});

test("notify-status reports channels; send-due handles empty queue", async () => {
  const s = await fetch(`${API}/api/notify-status`).then((r) => r.json());
  assert.equal(typeof s.fcm, "boolean");
  assert.equal(typeof s.email, "boolean");
  const r = await fetch(`${API}/api/notifications/send-due`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ before: "2000-01-01" }) });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).sent, []);
});

after(async () => {
  await pool.query("DELETE FROM device_tokens WHERE student_id=$1", [U]);
  await pool.query("DELETE FROM user_prefs WHERE user_id=$1", [U]);
  await pool.query("DELETE FROM notification_log WHERE student_id=$1", [U]);
  await pool.query('DELETE FROM "user" WHERE id=$1', [U]);
  await pool.end();
});
