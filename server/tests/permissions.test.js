// Part 0 tests: permission-event logging. Run: npm test (node --test).
// Requires the API running on http://127.0.0.1:3000 with safeguarding_schema applied.
import { test, before } from "node:test";
import assert from "node:assert/strict";

const API = "http://127.0.0.1:3000";

before(async () => {
  const h = await fetch(`${API}/api/health`).then((r) => r.json()).catch(() => null);
  assert.ok(h?.db === "up", "API must be running with DB up");
});

test("permission-events: accepts valid transitions", async () => {
  const r = await fetch(`${API}/api/permission-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: "test-perm-user", feature: "notifications", from_state: "prompt_shown", to_state: "denied_once", platform: "android" }),
  });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

test("permission-events: rejects unknown feature/state", async () => {
  let r = await fetch(`${API}/api/permission-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feature: "microphone", to_state: "granted" }),
  });
  assert.equal(r.status, 400);
  r = await fetch(`${API}/api/permission-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feature: "camera", to_state: "maybe" }),
  });
  assert.equal(r.status, 400);
});
