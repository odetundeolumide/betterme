// Import runner (STEP 2): parses doc/WAEC_Subjects_and_Curriculum.md and
// loads it into the curriculum_* tables. Repeatable and idempotent.
//
//   node scripts/import-curriculum.js [--force] [--subject=<slug>]
//
// Default: inserts departments/subjects/links/sources; inserts topics ONLY
// for subjects that have none (admin topic edits are never overwritten
// without --force). Papers/textbooks refresh every run (no admin-owned
// fields there). --force replaces a subject's whole tree (or everything).
//
// Exit code is 1 if the department-link checks fail.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";
import {
  parseFile,
  deptSlugFor,
  DEPARTMENTS,
  canonicalSubject,
} from "./curriculum-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MD_PATH = path.join(__dirname, "..", "..", "doc", "WAEC_Subjects_and_Curriculum.md");
const SCHEMA_PATH = path.join(__dirname, "..", "db", "curriculum_schema.sql");

// Press note lives on the link rows (not hard-coded anywhere in the app).
const ECON_NOTE =
  "Press-reported 2026 Business-only guideline unconfirmed by WAEC; default allow.";

async function applySchema() {
  const sql = fs.readFileSync(SCHEMA_PATH, "utf8");
  await pool.query(sql);
}

async function insertTopicTree(client, subjectSlug, nodes, parentId) {
  let count = 0;
  for (const n of nodes) {
    const { rows } = await client.query(
      `INSERT INTO curriculum_topics (subject_slug, parent_topic_id, title, topic_order, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [subjectSlug, parentId, n.title, n.order, n.notes || ""]
    );
    count += 1 + (await insertTopicTree(client, subjectSlug, n.children, rows[0].id));
  }
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const onlySlug = (args.find((a) => a.startsWith("--subject=")) || "").split("=")[1] || null;

  await applySchema();
  const parsed = parseFile(MD_PATH);

  // Dedupe repeated subject sections (Economics/Marketing/Government appear
  // once per department in the doc): merge, keeping the richest block.
  const bySlug = new Map();
  for (const s of parsed.subjects) {
    if (onlySlug && s.slug !== onlySlug) continue;
    if (!s.slug) {
      console.log(`SKIP unmapped section: ${s.rawName}`);
      continue;
    }
    const prev = bySlug.get(s.slug);
    if (!prev) bySlug.set(s.slug, s);
    else {
      // Merge: prefer longer aims/notes, union papers/textbooks/sources.
      if (s.aims.length > prev.aims.length) prev.aims = s.aims;
      if (s.notes.length > prev.notes.length) prev.notes = s.notes;
      const seen = new Set(prev.papers.map((p) => p.label));
      for (const p of s.papers) if (!seen.has(p.label)) prev.papers.push(p);
      const bseen = new Set(prev.textbooks);
      for (const b of s.textbooks) if (!bseen.has(b)) prev.textbooks.push(b);
      if (!prev.source.url && s.source.url) prev.source = s.source;
      const count = (function walk(n) {
        return n.reduce((a, x) => a + 1 + walk(x.children), 0);
      })(s.topics);
      const pcount = (function walk(n) {
        return n.reduce((a, x) => a + 1 + walk(x.children), 0);
      })(prev.topics);
      if (count > pcount) prev.topics = s.topics;
      prev.failures.push(...s.failures);
    }
  }

  // Departments (fixed three).
  for (const [i, d] of DEPARTMENTS.entries()) {
    await pool.query(
      `INSERT INTO curriculum_departments (slug, name, sort) VALUES ($1,$2,$3)
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, sort=EXCLUDED.sort`,
      [d.slug, d.name, i]
    );
  }

  // Links: core subjects -> all departments; dept tables -> mapped dept.
  const links = new Map(); // slug -> Set(dept)
  const addLink = (slug, dept) => {
    if (!bySlug.has(slug)) return;
    if (!links.has(slug)) links.set(slug, new Set());
    links.get(slug).add(dept);
  };
  const canonSlug = (display) => canonicalSubject(display)?.slug;
  for (const name of parsed.coreTable) {
    const slug = canonSlug(name);
    if (slug) for (const d of DEPARTMENTS) addLink(slug, d.slug);
  }
  for (const dt of parsed.deptTables) {
    const dept = deptSlugFor(dt.header);
    if (!dept) {
      console.log(`WARN unknown department header: ${dt.header}`);
      continue;
    }
    for (const name of dt.rows) {
      const slug = canonSlug(name);
      if (!slug) {
        console.log(`WARN unmapped dept-table subject: ${name}`);
        continue;
      }
      addLink(slug, dept);
    }
  }

  const report = [];
  for (const [slug, s] of bySlug) {
    await pool.query(
      `INSERT INTO curriculum_subjects (slug, name, is_core, aims, notes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, is_core=EXCLUDED.is_core,
         aims=EXCLUDED.aims, notes=EXCLUDED.notes`,
      [slug, s.name, parsed.coreTable.some((c) => canonSlug(c) === slug), s.aims, s.notes]
    );
    // Sources: refresh content fields, never touch admin-owned verification.
    await pool.query(
      `INSERT INTO curriculum_sources (subject_slug, source_url, source_note, syllabus_edition)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (subject_slug) DO UPDATE SET source_url=EXCLUDED.source_url,
         source_note=EXCLUDED.source_note, syllabus_edition=EXCLUDED.syllabus_edition`,
      [slug, s.source.url, s.source.note, s.source.edition]
    );
    // Papers + textbooks refresh (no admin-owned columns there).
    await pool.query("DELETE FROM curriculum_exam_papers WHERE subject_slug=$1", [slug]);
    for (const p of s.papers) {
      await pool.query(
        "INSERT INTO curriculum_exam_papers (subject_slug, label, format) VALUES ($1,$2,$3)",
        [slug, p.label, p.format]
      );
    }
    await pool.query("DELETE FROM curriculum_textbooks WHERE subject_slug=$1", [slug]);
    let si = 0;
    for (const b of s.textbooks) {
      await pool.query(
        "INSERT INTO curriculum_textbooks (subject_slug, citation, sort) VALUES ($1,$2,$3)",
        [slug, b, si++]
      );
    }
    // Topics: skip subjects that already have a tree (admin-owned) unless --force.
    const existing = await pool.query("SELECT COUNT(*)::int AS c FROM curriculum_topics WHERE subject_slug=$1", [slug]);
    let inserted = 0;
    let skipped = false;
    if (existing.rows[0].c > 0 && !force) {
      skipped = true;
    } else {
      if (force) await pool.query("DELETE FROM curriculum_topics WHERE subject_slug=$1", [slug]);
      inserted = await insertTopicTree(pool, slug, s.topics, null);
    }
    const total = (function walk(n) {
      return n.reduce((a, x) => a + 1 + walk(x.children), 0);
    })(s.topics);
    report.push({ slug, top: s.topics.length, total, papers: s.papers.length, books: s.textbooks.length, fails: s.failures.length, skipped });
    for (const f of s.failures) console.log(`PARSE-FAIL ${slug} body-line ${f.line}: [${f.reason}] ${f.text.slice(0, 120)}`);
  }

  // Links (never overwrite admin-edited eligible flags; apply default notes once).
  for (const [slug, depts] of links) {
    for (const dept of depts) {
      await pool.query(
        `INSERT INTO curriculum_dept_subjects (department_slug, subject_slug)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [dept, slug]
      );
    }
  }
  await pool.query(
    `UPDATE curriculum_dept_subjects SET eligibility_note=$1
     WHERE subject_slug='economics' AND eligibility_note=''`,
    [ECON_NOTE]
  );

  // ---- Report ----
  console.log("\n--- import report ---");
  let zeroTopics = [];
  for (const r of report) {
    console.log(
      `${r.skipped ? "SKIP " : "LOAD "} ${r.slug}: top=${r.top} total=${r.total} papers=${r.papers} books=${r.books} parse-fails=${r.fails}`
    );
    if (r.total === 0) zeroTopics.push(r.slug);
  }
  console.log(`subjects with zero topics: ${zeroTopics.length ? zeroTopics.join(", ") : "(none)"}`);

  // ---- Link checks (STEP 2 requirement) ----
  let ok = true;
  const checkLinks = async (slug, expected) => {
    const { rows } = await pool.query(
      "SELECT department_slug FROM curriculum_dept_subjects WHERE subject_slug=$1 ORDER BY 1",
      [slug]
    );
    const got = rows.map((r) => r.department_slug).sort().join(",");
    const want = [...expected].sort().join(",");
    const pass = got === want;
    if (!pass) ok = false;
    console.log(`${pass ? "CHECK-OK " : "CHECK-FAIL "}${slug}: [${got}] expected [${want}]`);
  };
  await checkLinks("economics", ["science", "humanities", "business"]);
  await checkLinks("marketing", ["science", "humanities", "business"]);
  await checkLinks("government", ["humanities", "business"]);
  if (!ok) {
    console.error("LINK CHECKS FAILED");
    process.exitCode = 1;
  } else {
    console.log("all link checks passed");
  }
  await pool.end();
}

main().catch((e) => {
  console.error("IMPORT FAILED:", e.message);
  process.exitCode = 1;
});
