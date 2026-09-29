// Curriculum parser (STEP 2): parses doc/WAEC_Subjects_and_Curriculum.md
// into plain JS structures. Pure functions, no DB — see import-curriculum.js
// for the runner and tests/curriculum.test.js for coverage.
//
// Rules (see doc/curriculum_import_notes.md for ambiguities):
// - Never invent content: titles/notes are copied from the document.
// - `(*)` / `(**)` / trailing `*` markers move into topic notes, with the
//   meaning taken from the subject's own legend line when present.

import fs from "node:fs";

// Display name in the doc -> canonical { slug, name }.
const SUBJECTS = [
  [/^english language$/i, "english-language", "English Language"],
  [/^general mathematics$/i, "general-mathematics", "General Mathematics"],
  [/^civic education$/i, "civic-education", "Civic Education"],
  [/^biology$/i, "biology", "Biology"],
  [/^chemistry$/i, "chemistry", "Chemistry"],
  [/^physics$/i, "physics", "Physics"],
  [/^agricultur(e|al science)/i, "agricultural-science", "Agricultural Science"],
  [/^further mathematics$/i, "further-mathematics", "Further Mathematics"],
  [/^physical education$/i, "physical-education", "Physical Education"],
  [/^health/i, "health-science", "Health Science"],
  [/^foods and nutrition$/i, "foods-and-nutrition", "Foods and Nutrition"],
  [/^geography$/i, "geography", "Geography"],
  [/^technical drawing$/i, "technical-drawing", "Technical Drawing"],
  [/^economics$/i, "economics", "Economics"],
  [/^marketing$/i, "marketing", "Marketing"],
  [/^history/i, "history", "History"],
  [/^government$/i, "government", "Government"],
  [/^christian religious/i, "christian-religious-studies", "Christian Religious Studies"],
  [/^islamic/i, "islamic-religious-studies", "Islamic Religious Studies"],
  [/^french$/i, "french", "French"],
  [/^visual art/i, "visual-art", "Visual Art"],
  [/^music$/i, "music", "Music"],
  [/^literature/i, "literature-in-english", "Literature in English"],
  [/^home management$/i, "home-management", "Home Management"],
  [/^catering craft/i, "catering-craft-practice", "Catering Craft Practice"],
  [/^financial accounting/i, "financial-accounting", "Financial Accounting"],
  [/^commerce$/i, "commerce", "Commerce"],
];

export function canonicalSubject(display) {
  const clean = display.replace(/\s*\(DONE\)\s*$/i, "").trim();
  for (const [re, slug, name] of SUBJECTS) {
    if (re.test(clean)) return { slug, name };
  }
  return null;
}

export const DEPARTMENTS = [
  { slug: "science", name: "Science" },
  { slug: "humanities", name: "Humanities (Arts)" },
  { slug: "business", name: "Business (Commercial)" },
];

// Lines that are syllabus metadata, not topics: appended to subject notes.
const NOTE_HEADERS = [
  "assumed background", "abilities tested", "practical skills",
  "quantitative analysis", "qualitative analysis", "units to know",
  "practical materials", "field work", "ghana only", "what to study",
  "recommended", "suggested reading", "reading list", "reading texts",
  "recommended texts", "recommended textbooks", "set texts",
];

function isNoteHeader(line) {
  const t = line.replace(/[*_]/g, "").trim().toLowerCase();
  return NOTE_HEADERS.some((h) => t.startsWith(h));
}

function isTextbookHeader(line) {
  const t = line.replace(/[*_]/g, "").trim().toLowerCase();
  return (
    t.startsWith("recommended textbook") ||
    t.startsWith("recommended texts") ||
    t.startsWith("suggested reading") ||
    t.startsWith("reading list") ||
    t.startsWith("reading texts")
  );
}

// Split a bold-led item into { title, notes }. Markers (*)/(**)/trailing *
// move into notes with the subject legend meaning when we know it.
export function splitItem(text, legends) {
  let notes = "";
  let title = text.trim();
  const takeMarker = (re, meaning) => {
    const m = title.match(re);
    if (m) {
      title = title.replace(re, "").trim();
      notes += (notes ? " " : "") + meaning;
    }
  };
  takeMarker(/\s*\(\*\*\)\s*:?\s*$/, legends.starstar || "[marked (**) in source]");
  takeMarker(/\s*\(\*\)\s*:?\s*$/, legends.star || "[marked (*) in source]");
  // trailing bare asterisk, e.g. "product design*"
  const bare = title.match(/^(.*\S)\*\s*:?\s*$/);
  if (bare && !title.includes("**")) {
    title = bare[1].trim();
    notes += (notes ? " " : "") + (legends.bareStar || "[marked * in source]");
  }
  return { title, notes };
}

export function splitBoldItem(text, legends) {
  // "**Title:** rest" or "**Title** rest"
  const m = text.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/s);
  if (!m) return splitItem(text, legends);
  const inner = splitItem(m[1].replace(/:\s*$/, ""), legends);
  const rest = m[2].trim();
  let notes = [inner.notes, rest].filter(Boolean).join(" ");
  if (/[A-Za-z]\*/.test(inner.title + " " + rest) && legends.bareStar && !notes.includes("practical work")) {
    notes += (notes ? " " : "") + legends.bareStar;
  }
  return { title: inner.title, notes };
}

function findLegends(body) {
  const legends = {};
  for (const line of body) {
    const t = line.trim();
    let m = t.match(/items marked \(\*\)([^\n.]*)/i);
    if (m) legends.star = `[marked (*) in source: ${m[1].trim() || "see source"}]`;
    m = t.match(/items marked \(\*\*\)([^\n.]*)/i);
    if (m) legends.starstar = `[marked (**) in source: ${m[1].trim() || "see source"}]`;
    m = t.match(/items marked \*([^\n.]*practical[^\n.]*)/i);
    if (m) legends.bareStar = `[marked * in source: stresses practical work]`;
  }
  // Known legend wordings in this document
  if (!legends.star && body.some((l) => /tested in Section B of Paper 2 only/i.test(l))) {
    legends.star = "[marked (*) in source: tested in Section B of Paper 2 only]";
  }
  if (!legends.starstar && body.some((l) => /peculiar to Nigeria/i.test(l))) {
    legends.starstar = "[marked (**) in source: peculiar to Nigeria]";
  }
  if (!legends.bareStar && body.some((l) => /items marked \* stress practical work/i.test(l))) {
    legends.bareStar = "[marked * in source: stresses practical work]";
  }
  return legends;
}

const isL1Header = (t) =>
  /^\*\*[A-Z]\.\s/.test(t) || // **A. Number and numeration**
  /^\*\*(IV|VI{0,3}|IX|X|I{1,3})\.\s/.test(t) || // **I./II./III. Pure Mathematics**
  /^\*\*(Part|Section|Paper \d)\b/i.test(t); // **Part 1:**, **Section A:**, **Paper 1:**

const isL2Header = (t) =>
  /^\*[^*]+\*$/.test(t) && !/^\*\*/.test(t); // *Section A: ...*, *Plane geometry*

// Bare container labels ("**Topics**", "**Structure topics ...**"): no node;
// any legend meaning is already captured by findLegends.
const isContainerLabel = (t) =>
  /^\*\*Topics\b/i.test(t) || /^\*\*Structure topics\b/i.test(t);

// Plain numbered item without bold: "Title; detail" -> split on first "; "
// when the head is short, else the whole line is the title.
function splitPlainItem(text) {
  const i = text.indexOf(";");
  if (i > 0 && i <= 100) {
    return { title: text.slice(0, i).trim(), notes: text.slice(i + 1).trim() };
  }
  return { title: text.trim(), notes: "" };
}

// Parse one subject body (array of lines) into a tree.
// Two header levels: bold L1 (**A.**, **Part/Section/Paper N**) and italic L2
// (*Section A*, *Plane geometry*), the latter nesting under the former.
// Returns { roots, failures, looseNotes } — looseNotes are plain paragraphs
// with no topic to attach to; the caller stores them as subject notes.
export function parseSubjectBody(lines, legends) {
  const roots = [];
  const failures = [];
  const looseNotes = [];
  let l1 = null; // active level-1 section node (or null)
  let l2 = null; // active level-2 section node (or null)
  let subParent = null; // last indent-0 item: fallback parent for sub-bullets
  let childStack = []; // chain of { node, indent } for nested sub-bullets
  let pendingL1 = null; // L1 header waiting to see if it gets children
  let lastNode = null; // attach point for indented bullets / continuations
  let order = 0;

  const addNode = (node, parent) => {
    order += 1;
    node.order = order;
    node.children = node.children || [];
    (parent ? parent.children : roots).push(node);
    lastNode = node;
    return node;
  };

  // Materialize a pending L1 header: as a section parent under the current
  // L1 context (nested L1s don't occur, so parent is l1?.children ?? roots),
  // then it becomes the new L1 context. With asLeaf=true it becomes a plain
  // topic instead (headers with no children, e.g. single-line sections).
  const materializePending = (asLeaf) => {
    if (!pendingL1) return null;
    const node = { title: pendingL1.title, notes: pendingL1.notes, children: [] };
    if (asLeaf || !pendingL1.hasKids) {
      addNode(node, l1);
    } else {
      addNode(node, l1);
      l1 = node;
    }
    pendingL1 = null;
    return node;
  };

  for (let ln = 0; ln < lines.length; ln++) {
    const raw = lines[ln];
    if (!raw.trim()) continue;
    const t = raw.trim();
    const indent = raw.match(/^(\s*)/)[1].length;

    // Skip tables (Literature set texts) — caller stores them as notes.
    if (t.startsWith("|")) continue;
    if (isContainerLabel(t)) continue;

    // L1 bold headers.
    if (isL1Header(t) && indent === 0) {
      if (pendingL1) materializePending(true); // previous header had no children
      l1 = null;
      l2 = null;
      const clean = t.replace(/^\*\*|\*\*$/g, "").trim();
      const { title, notes } = splitItem(clean.replace(/:\s*$/, ""), legends);
      pendingL1 = { title, notes, hasKids: false };
      lastNode = null;
      continue;
    }

    // L2 italic headers nest under the pending/materialized L1.
    if (isL2Header(t) && indent === 0) {
      if (pendingL1) {
        pendingL1.hasKids = true;
        materializePending(false);
      }
      const clean = t.replace(/^\*|\*$/g, "").trim();
      const { title, notes } = splitItem(clean.replace(/:\s*$/, ""), legends);
      const node = { title, notes, children: [] };
      addNode(node, l1);
      l1 = l1; // L2 does not close the L1 context
      lastNode = node;
      // remember L2 as the attach point without closing L1:
      l2 = node;
      subParent = node;
      childStack = [];
      continue;
    }

    // Numbered items: "1. **Title:** rest" or "1. plain text".
    let m = t.match(/^(\d+)\.\s+(.*)$/s);
    if (m && indent === 0) {
      if (pendingL1) {
        pendingL1.hasKids = true;
        materializePending(false);
      }
      const rest = m[2].trim();
      const node = rest.startsWith("**") ? splitBoldItem(rest, legends) : splitPlainItem(rest);
      node.children = [];
      addNode(node, l2 || l1);
      subParent = node;
      childStack = [];
      continue;
    }

    // Bullets.
    m = t.match(/^-\s+(.*)$/s);
    if (m) {
      const rest = m[1].trim();
      if (indent === 0) {
        if (pendingL1) {
          pendingL1.hasKids = true;
          materializePending(false);
        }
        const node = rest.startsWith("**") ? splitBoldItem(rest, legends) : splitPlainItem(rest);
        node.children = [];
        addNode(node, l2 || l1);
        subParent = node;
        childStack = [];
      } else {
        // Nested bullet: pop to the first ancestor with smaller indent so
        // same-indent bullets become siblings, deeper ones become children.
        while (childStack.length && childStack[childStack.length - 1].indent >= indent) {
          childStack.pop();
        }
        const parent = childStack.length ? childStack[childStack.length - 1].node : subParent;
        if (!parent) {
          failures.push({ line: ln + 1, text: raw, reason: "indented bullet with no parent" });
          continue;
        }
        const node = rest.startsWith("**") ? splitBoldItem(rest, legends) : splitPlainItem(rest);
        node.children = [];
        order += 1;
        node.order = order;
        parent.children.push(node);
        lastNode = node;
        childStack.push({ node, indent });
      }
      continue;
    }

    // Plain continuation paragraph.
    if (pendingL1 && !pendingL1._noted) {
      pendingL1.notes = (pendingL1.notes ? pendingL1.notes + " " : "") + t;
      pendingL1._noted = true;
    } else if (lastNode && !lastNode.children.length) {
      lastNode.notes = (lastNode.notes ? lastNode.notes + " " : "") + t;
    } else {
      looseNotes.push(t);
    }
  }
  if (pendingL1) materializePending(true);
  const clean = (nodes) =>
    nodes.map(({ _noted, ...n }) => ({ ...n, children: clean(n.children) }));
  return { roots: clean(roots), failures, looseNotes };
}

// Parse a full subject section: source, aims, papers, textbooks, notes, topics.
export function parseSubject(displayName, bodyLines) {
  const canon = canonicalSubject(displayName);
  const failures = [];
  const legends = findLegends(bodyLines);
  let sourceUrl = "";
  let sourceNote = "";
  let aims = "";
  let edition = "";
  const papers = [];
  const textbooks = [];
  const subjectNotes = [];
  const topicLines = [];
  let mode = "body"; // body | source | format | textbooks
  let formatBuffer = [];

  const flushFormat = () => {
    for (const line of formatBuffer) {
      const t = line.trim().replace(/^-\s+/, "");
      const pm = t.match(/^(Paper \d+[^:]*):\s*(.*)$/i);
      if (pm) papers.push({ label: pm[1].trim(), format: pm[2].trim() });
      else if (t) subjectNotes.push(t);
    }
    formatBuffer = [];
  };

  for (let i = 0; i < bodyLines.length; i++) {
    const raw = bodyLines[i];
    const t = raw.trim();
    if (!t) {
      if (mode === "source") {
        sourceNote = sourceNote.trim();
        const ed = sourceNote.match(/20\d\d\s*(?:\/|to|-)\s*20\d\d|20\d\d/g);
        if (ed) edition = ed[0];
        mode = "body";
      } else if (mode === "format") {
        flushFormat();
        mode = "body";
      }
      continue;
    }
    if (t.startsWith("Source:") || t.startsWith("Source for")) {
      mode = "source";
      sourceNote = t.replace(/^Source[^:]*:\s*/, "");
      const u = sourceNote.match(URL_RE);
      if (u) sourceUrl = resolveUrl(u[0]);
      continue;
    }
    if (mode === "source") {
      // Continuation of the source paragraph (stops at blank line).
      sourceNote += " " + t;
      const u2 = t.match(URL_RE);
      if (u2 && !sourceUrl) sourceUrl = resolveUrl(u2[0]);
      continue;
    }
    let m = t.match(/^\*\*(Aims|Objectives):\*\*\s*(.*)$/);
    if (m) {
      aims = m[2].trim();
      mode = "body";
      continue;
    }
    if (/^\*\*Exam format\*\*/.test(t)) {
      mode = "format";
      continue;
    }
    if (isTextbookHeader(t)) {
      mode = "textbooks";
      const rest = t.replace(/^\*\*(.+?)\*\*\s*:?\s*/, "");
      if (rest && !isTextbookHeader("**" + rest)) {
        textbooks.push(...splitCitations(rest));
      }
      continue;
    }
    if (mode === "textbooks") {
      if (/^-{3,}\s*$/.test(t)) continue; // md section separators, not content
      if (/^\*\*|^##?\s|^\d+\.\s+|^\||^\*[^*]+\*$/.test(t) || /^\*\*(Part|Section|Paper \d|[A-Z]\.)/i.test(t) || /^-\s/.test(t)) {
        mode = "body";
        // fall through to reprocess this line in body mode
      } else {
        textbooks.push(...splitCitations(t));
        continue;
      }
    }
    if (mode === "format") {
      if (t.startsWith("- ")) {
        formatBuffer.push(t);
        continue;
      }
      flushFormat();
      mode = "body";
      // fall through
    }
    if (t.startsWith("|")) {
      subjectNotes.push(t); // e.g. Literature set-text table, kept verbatim
      continue;
    }
    if (/^\*\*/.test(t) && isNoteHeader(t)) {
      subjectNotes.push(t.replace(/^\*\*(.+?)\*\*\s*:?\s*/, (mm, h) => h.trim() + ": "));
      continue;
    }
    if (/^-{3,}\s*$/.test(t)) continue; // md section separators, not content
    topicLines.push({ raw, index: i });
  }
  if (mode === "format") flushFormat();

  const { roots, failures: tf, looseNotes } = parseSubjectBody(
    topicLines.map((l) => l.raw),
    legends
  );
  for (const n of looseNotes) subjectNotes.push(n);
  // remap failure line numbers to body-relative
  for (const f of tf) failures.push({ line: topicLines[f.line - 1]?.index ?? -1, text: f.text, reason: f.reason });

  return {
    slug: canon?.slug || null,
    name: canon?.name || displayName.replace(/\s*\(DONE\)\s*$/i, "").trim(),
    rawName: displayName,
    aims,
    notes: subjectNotes.join("\n"),
    source: { url: sourceUrl, note: sourceNote.trim(), edition },
    papers,
    textbooks,
    topics: roots,
    failures,
  };
}

function splitCitations(text) {
  // "A, *B*; C, *D*." -> split on "; " (authors contain commas, so not ",")
  return text
    .split(/;\s*/)
    .map((s) => s.trim().replace(/\s+/g, " ").replace(/\.$/, ""))
    .filter(Boolean);
}

// Split the whole markdown into { coreTable[], departments: {header, table[]}, subjects: [{display, body[]}] }
export function splitDocument(md) {
  const lines = md.split(/\r?\n/);
  const coreTable = [];
  const deptTables = []; // { header, rows[] }
  const subjects = [];
  let current = null;
  let currentDept = null;

  const tableRow = (t) => {
    const m = t.match(/^\|\s*(.+?)\s*\|.*$/);
    if (!m) return null;
    const cell = m[1].trim();
    if (/^subject$/i.test(cell) || /^:?-+:?$/.test(cell)) return null;
    return cell;
  };

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const h1 = t.match(/^#\s+(.+)$/);
    const h2 = t.match(/^##\s+(.+)$/);
    if (h1 && !h2) {
      if (/core subjects/i.test(h1[1])) currentDept = { header: h1[1], rows: [], core: true };
      else if (/department/i.test(h1[1])) currentDept = { header: h1[1], rows: [], core: false };
      else currentDept = null;
      if (currentDept) deptTables.push(currentDept);
      current = null;
      continue;
    }
    if (h2) {
      // Only completed subject sections count; meta sections like
      // "Sources and how to read this file" are skipped.
      if (!/\(DONE\)\s*$/.test(h2[1])) {
        current = null;
        continue;
      }
      current = { display: h2[1].trim(), body: [] };
      subjects.push(current);
      currentDept = null;
      continue;
    }
    if (current) {
      current.body.push(lines[i]);
      continue;
    }
    if (currentDept && t.startsWith("|")) {
      const row = tableRow(t);
      if (row) currentDept.rows.push(row);
    }
  }
  for (const d of deptTables) if (d.core) coreTable.push(...d.rows);
  return { coreTable, deptTables: deptTables.filter((d) => !d.core), subjects };
}

const RACHEL_BASE = "https://rachel.core2learn.org/modules/en-wassce/WASSCESYLABUS/";

// Resolve source links: absolute URLs pass through, `.../FILE` and bare
// rachel.core2learn.org paths resolve against the known syllabus host.
export function resolveUrl(raw) {
  const u = raw.trim().replace(/[).,;]+$/, "");
  if (/^https?:\/\//i.test(u)) return u;
  // ".../" or "../" in the doc means the syllabus host dir itself; the
  // filename part sometimes repeats WASSCESYLABUS, which the base already has.
  const m = u.match(/^\.{2,}\/(.*)$/);
  if (m) return RACHEL_BASE + m[1].replace(/^WASSCESYLABUS\//, "");
  if (u.startsWith("rachel.core2learn.org/")) return "https://" + u;
  return u;
}
const URL_RE = /https?:\/\/[^\s)]+|\.{2,}\/[^\s)]+|rachel\.core2learn\.org\/[^\s)]+/;
export function deptSlugFor(header) {
  const h = header.toLowerCase();
  if (h.includes("science")) return "science";
  if (h.includes("business") || h.includes("commercial")) return "business";
  // NOTE: plain "art" would also match "depARTment" — require word boundary.
  if (h.includes("humanities") || /\barts?\b/.test(h)) return "humanities";
  return null;
}

export function parseFile(path) {
  const md = fs.readFileSync(path, "utf8");
  const { coreTable, deptTables, subjects } = splitDocument(md);
  return {
    coreTable,
    deptTables,
    subjects: subjects.map((s) => parseSubject(s.display, s.body)),
  };
}
