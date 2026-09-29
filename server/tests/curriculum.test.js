// Curriculum tests (STEP 7). Run: npm test  (node --test tests/)
// Requires: dev DB imported (node scripts/import-curriculum.js) and the
// API running on http://127.0.0.1:3000. Uses disposable TEST_ ids, cleaned up.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db.js";
import {
  parseFile,
  canonicalSubject,
  deptSlugFor,
  splitItem,
} from "../scripts/curriculum-parser.js";

import { fileURLToPath } from "node:url";
import path from "node:path";
const MD = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "doc", "WAEC_Subjects_and_Curriculum.md");
const API = "http://127.0.0.1:3000";
const TEST_USER = "test-curriculum-user";
const TEST_OTHER = "test-curriculum-other";

const walk = (nodes) => nodes.reduce((a, x) => a + 1 + walk(x.children), 0);
const depth = (nodes) =>
  nodes.reduce((m, x) => Math.max(m, 1 + depth(x.children)), 0);

// ---------- parser: required subjects ----------

test("parser: Biology has 20 top-level topics", async () => {
  const { subjects } = parseFile(MD);
  const bio = subjects.find((s) => s.slug === "biology");
  assert.equal(bio.topics.length, 20);
});

test("parser: General Mathematics has sections A-I with limits intact", async () => {
  const { subjects } = parseFile(MD);
  const maths = subjects.find((s) => s.slug === "general-mathematics");
  const titles = maths.topics.map((t) => t.title);
  for (const h of ["A. Number and numeration", "I. Vectors and transformation"]) {
    assert.ok(titles.some((t) => t.startsWith(h.split(" ")[0])), `missing ${h}`);
  }
  assert.equal(maths.topics.length, 9);
});

test("parser: Economics has 25 topics, stored once, linked thrice at import", async () => {
  const { subjects } = parseFile(MD);
  const blocks = subjects.filter((s) => s.slug === "economics");
  assert.equal(blocks.length, 3); // repeated once per department in the doc
  assert.equal(blocks[0].topics.length, 25);
});

test("parser: a subject with sub-topics nests them (Biology, Government)", async () => {
  const { subjects } = parseFile(MD);
  const bio = subjects.find((s) => s.slug === "biology");
  assert.ok(bio.topics[0].children.length >= 2);
  assert.equal(depth(bio.topics), 2);
  const gov = subjects.filter((s) => s.slug === "government")[0];
  assert.equal(depth(gov.topics), 3); // section -> topic -> sub-bullet
});

test("parser: (*) and bare-* markers land in notes, not in titles", async () => {
  const { subjects } = parseFile(MD);
  const maths = subjects.find((s) => s.slug === "general-mathematics");
  const find = (nodes) => {
    for (const n of nodes) {
      if (/matrices/i.test(n.title)) return n;
      const f = find(n.children);
      if (f) return f;
    }
    return null;
  };
  const m = find(maths.topics);
  assert.ok(!m.title.includes("(*)"));
  assert.match(m.notes, /Section B/);
  const mkt = subjects.find((s) => s.slug === "marketing");
  const prod = mkt.topics.find((t) => /^products/i.test(t.title));
  assert.ok(!/\*$/.test(prod.title));
  assert.match(prod.notes, /practical work/);
});

test("parser: only Literature has zero topics; nothing fails silently", async () => {
  const { subjects } = parseFile(MD);
  const zero = subjects.filter((s) => walk(s.topics) === 0).map((s) => s.slug);
  assert.deepEqual(zero, ["literature-in-english"]);
  const fails = subjects.flatMap((s) => s.failures);
  assert.equal(fails.length, 0);
});

test("parser: every subject resolves to a canonical slug with a source URL", async () => {
  const { subjects } = parseFile(MD);
  for (const s of subjects) {
    assert.ok(s.slug, `no slug for ${s.rawName}`);
    assert.ok(s.source.url, `no source URL for ${s.slug}`);
  }
});

test("parser: deptSlugFor never maps 'department' via ART substring", async () => {
  assert.equal(deptSlugFor("Department 3: Business (Commercial)"), "business");
  assert.equal(deptSlugFor("Department 2: Humanities (Arts)"), "humanities");
  assert.equal(deptSlugFor("Department 1: Science"), "science");
});

test("parser: canonicalSubject mappings incl. parenthetical display names", async () => {
  assert.equal(canonicalSubject("Agriculture (Agricultural Science)").slug, "agricultural-science");
  assert.equal(canonicalSubject("Financial Accounting (Accounting)").slug, "financial-accounting");
  assert.equal(canonicalSubject("History (Nigerian History)").slug, "history");
});

// ---------- API: needs live server + imported DB ----------

const idsToClean = { topics: [], plans: [] };

before(async () => {
  const h = await fetch(`${API}/api/health`).then((r) => r.json()).catch(() => null);
  assert.ok(h?.db === "up", "API must be running with DB up for API tests");
  // disposable users (plain rows; Better Auth shape not needed for these endpoints)
  await fetch(`${API}/api/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "x", exam_code: "x" }),
  }).catch(() => {});
  for (const u of [TEST_USER, TEST_OTHER, "test-curriculum-admin"]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
      [u, u, `${u}@test.local`]
    );
  }
  await pool.query("INSERT INTO admin_users (user_id) VALUES ('test-curriculum-admin') ON CONFLICT DO NOTHING");
  // real biology topic ids (ids are global; never assume them)
  const bio = await fetch(`${API}/api/curriculum/subjects/biology`).then((r) => r.json());
  globalThis.__BIO_IDS = [bio.topics[0].id, bio.topics[1].id];
});

test("api: department-subject links (Economics x3, Marketing x3, Government x2)", async () => {
  const j = (p) => fetch(`${API}${p}`).then((r) => r.json());
  const econ = [];
  for (const d of ["science", "humanities", "business"]) {
    const rows = await j(`/api/curriculum/departments/${d}/subjects`);
    if (rows.some((s) => s.slug === "economics")) econ.push(d);
  }
  assert.deepEqual(econ.sort(), ["business", "humanities", "science"]);
  const gov = [];
  for (const d of ["science", "humanities", "business"]) {
    const rows = await j(`/api/curriculum/departments/${d}/subjects`);
    if (rows.some((s) => s.slug === "government")) gov.push(d);
  }
  assert.deepEqual(gov.sort(), ["business", "humanities"]);
});

test("api: core subjects come first and Economics carries the press note", async () => {
  const rows = await fetch(`${API}/api/curriculum/departments/business/subjects`).then((r) => r.json());
  assert.ok(rows[0].is_core && rows[1].is_core && rows[2].is_core);
  const econ = rows.find((s) => s.slug === "economics");
  assert.equal(econ.eligible, true);
  assert.match(econ.eligibility_note, /unconfirmed by WAEC/);
});

test("api: subject detail has tree, papers, textbooks, source notice", async () => {
  const s = await fetch(`${API}/api/curriculum/subjects/biology`).then((r) => r.json());
  assert.ok(s.topics.filter((t) => !t.title.startsWith("TEST-")).length >= 20);
  assert.ok(s.exam_papers.length >= 1 && s.exam_papers[0].label && s.exam_papers[0].format);
  assert.ok(s.textbooks.length > 0);
  assert.ok(s.source.source_url && s.source.source_note);
});

test("api: progress write + read own rows; rejects unknown user, bad status, bad topic", async () => {
  const [t1] = globalThis.__BIO_IDS;
  const put = (body) =>
    fetch(`${API}/api/curriculum/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  let r = await put({ user_id: "no-such-user", topic_id: t1, status: "done" });
  assert.equal(r.status, 404);
  r = await put({ user_id: TEST_USER, topic_id: t1, status: "almost" });
  assert.equal(r.status, 400);
  r = await put({ user_id: TEST_USER, topic_id: 999999, status: "done" });
  assert.equal(r.status, 404);
  r = await put({ user_id: TEST_USER, topic_id: t1, status: "studying" });
  assert.equal(r.status, 200);
  const g = await fetch(`${API}/api/curriculum/subjects/biology/progress?user=${TEST_USER}`).then((x) => x.json());
  assert.ok(g.topics.some((t) => t.topic_id === t1 && t.status === "studying"));
  r = await put({ user_id: TEST_USER, topic_id: t1, status: "done" });
  assert.equal(r.status, 200);
});

test("api: progress is isolated per student", async () => {
  const [t1] = globalThis.__BIO_IDS;
  const g = await fetch(`${API}/api/curriculum/subjects/biology/progress?user=${TEST_OTHER}`).then((x) => x.json());
  assert.ok(!g.topics.some((t) => t.topic_id === t1));
  const anon = await fetch(`${API}/api/curriculum/subjects/biology/progress`);
  assert.equal(anon.status, 401);
});

test("api: study plan creates reminders; rejects cross-subject topics", async () => {
  const [t1, t2] = globalThis.__BIO_IDS;
  const post = (body) =>
    fetch(`${API}/api/curriculum/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  let r = await post({ user_id: TEST_USER, subject_slug: "biology", topic_ids: [t1, t2], time_slot: "18:30", days: "Mon,Wed" });
  assert.equal(r.status, 200);
  const created = await r.json();
  assert.equal(created.reminders, 2);
  idsToClean.plans.push(created.plan_id);
  r = await post({ user_id: TEST_USER, subject_slug: "biology", topic_ids: [999999], time_slot: "18:30" });
  assert.equal(r.status, 400);
  r = await post({ user_id: TEST_USER, subject_slug: "biology", topic_ids: [t1], time_slot: "evening" });
  assert.equal(r.status, 400);
  // cross-subject: biology topic in a chemistry plan
  r = await post({ user_id: TEST_USER, subject_slug: "chemistry", topic_ids: [t1], time_slot: "18:30" });
  assert.equal(r.status, 400);
  const due = await fetch(`${API}/api/curriculum/reminders/due?before=2099-01-01`).then((x) => x.json());
  assert.ok(due.some((d) => d.plan_id === created.plan_id));
});

test("api: admin endpoints reject non-admins, accept admins", async () => {
  const admin = "test-curriculum-admin";
  let r = await fetch(`${API}/api/curriculum/admin/topics/1`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: TEST_USER, notes: "x" }),
  });
  assert.equal(r.status, 403);
  r = await fetch(`${API}/api/curriculum/admin/topics/1`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: admin, notes: "admin-test-note" }),
  });
  assert.equal(r.status, 200);
  const back = await fetch(`${API}/api/curriculum/admin/topics/1`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: admin, notes: "" }),
  });
  assert.equal(back.status, 200);
  // add + source update
  r = await fetch(`${API}/api/curriculum/admin/subjects/biology/topics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: admin, title: "TEST-TOPIC-DELETE-ME" }),
  });
  assert.equal(r.status, 200);
  const added = await r.json();
  idsToClean.topics.push(added.id);
  r = await fetch(`${API}/api/curriculum/admin/subjects/biology/source`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: admin, last_verified_at: new Date().toISOString() }),
  });
  assert.equal(r.status, 200);
  assert.ok(r && (await r.json()).last_verified_at);
  // restore source verification to NULL (import-owned state)
  await pool.query("UPDATE curriculum_sources SET last_verified_at=NULL WHERE subject_slug='biology'");
});

after(async () => {
  if (idsToClean.topics.length) {
    await pool.query("DELETE FROM curriculum_topics WHERE id = ANY($1)", [idsToClean.topics]);
  }
  if (idsToClean.plans.length) {
    await pool.query("DELETE FROM curriculum_study_plans WHERE id = ANY($1)", [idsToClean.plans]);
  }
  await pool.query("DELETE FROM curriculum_progress WHERE student_id LIKE 'test-curriculum-%'");
  await pool.query("DELETE FROM admin_users WHERE user_id='test-curriculum-admin'");
  await pool.query("DELETE FROM \"user\" WHERE id LIKE 'test-curriculum-%'");
  await pool.end();
});
