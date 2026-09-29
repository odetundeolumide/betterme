// Feedback tests (Option A tester round). Run: npm test.
// Requires API on :3000 with feedback_schema applied.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db.js";

const API = "http://127.0.0.1:3000";
const U = "test-feedback-user";

before(async () => {
  const h = await fetch(`${API}/api/health`).then((r) => r.json()).catch(() => null);
  assert.ok(h?.db === "up", "API must be running with DB up");
  await pool.query(`INSERT INTO "user" (id, name, email) VALUES ($1,$1,$2) ON CONFLICT (id) DO NOTHING`, [U, `${U}@test.local`]);
});

test("feedback: accepts bug/idea/praise, rejects bad type, empty, unknown user", async () => {
  const post = (b) => fetch(`${API}/api/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  for (const type of ["bug", "idea", "praise"]) {
    const r = await post({ user_id: U, type, message: `test ${type}`, screen: "home", app_version: "0.1.0" });
    assert.equal(r.status, 200);
    assert.ok((await r.json()).id);
  }
  let r = await post({ user_id: U, type: "rant", message: "x" });
  assert.equal(r.status, 400);
  r = await post({ user_id: U, type: "bug", message: "" });
  assert.equal(r.status, 400);
  r = await post({ user_id: "no-such-user", type: "bug", message: "x" });
  assert.equal(r.status, 404);
});

after(async () => {
  await pool.query("DELETE FROM feedback WHERE user_id=$1", [U]);
  await pool.query('DELETE FROM "user" WHERE id=$1', [U]);
  await pool.end();
});
