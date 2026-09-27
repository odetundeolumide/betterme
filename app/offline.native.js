// Native build: SQLite store with memory fallback.
// SQLite opens lazily on first use — never at import time.
let db = null;
let tried = false;
const mem = { packs: {}, queue: [] };

function ensureDb() {
  if (tried) return db;
  tried = true;
  try {
    const SQLite = require("expo-sqlite");
    db = SQLite.openDatabaseSync("betterme.db");
    db.execSync("CREATE TABLE IF NOT EXISTS packs (key TEXT PRIMARY KEY, payload TEXT, saved_at TEXT);");
    db.execSync("CREATE TABLE IF NOT EXISTS queue (uuid TEXT PRIMARY KEY, payload TEXT, created_at TEXT);");
  } catch {
    db = null;
  }
  return db;
}

export const uuid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function savePack(key, payload) {
  const s = JSON.stringify(payload);
  const d = ensureDb();
  if (d) d.runSync("INSERT OR REPLACE INTO packs (key, payload, saved_at) VALUES (?,?,?)", [key, s, new Date().toISOString()]);
  else mem.packs[key] = { payload: s, saved_at: new Date().toISOString() };
}

export function loadPack(key) {
  try {
    const d = ensureDb();
    if (d) {
      const row = d.getFirstSync("SELECT payload FROM packs WHERE key=?", [key]);
      return row ? JSON.parse(row.payload) : null;
    }
    return mem.packs[key] ? JSON.parse(mem.packs[key].payload) : null;
  } catch {
    return null;
  }
}

export function queueAttempt(payload) {
  const id = payload.client_uuid || uuid();
  payload.client_uuid = id;
  payload.offline_created_at = new Date().toISOString();
  const d = ensureDb();
  if (d) d.runSync("INSERT OR REPLACE INTO queue (uuid, payload, created_at) VALUES (?,?,?)", [id, JSON.stringify(payload), payload.offline_created_at]);
  else mem.queue.push(payload);
  return id;
}

export function pendingAttempts() {
  const d = ensureDb();
  if (d) return d.getAllSync("SELECT payload FROM queue").map((r) => JSON.parse(r.payload));
  return [...mem.queue];
}

export function dropQueued(id) {
  const d = ensureDb();
  if (d) d.runSync("DELETE FROM queue WHERE uuid=?", [id]);
  else mem.queue = mem.queue.filter((p) => p.client_uuid !== id);
}

export function pendingCount() {
  try {
    const d = ensureDb();
    if (d) return d.getFirstSync("SELECT COUNT(*) AS c FROM queue").c;
  } catch { /* fall through to memory */ }
  return mem.queue.length;
}
