// Web build: memory-only store (no SQLite on web). Syncs when online.
const mem = { packs: {}, queue: [] };

export const uuid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function savePack(key, payload) {
  mem.packs[key] = { payload: JSON.stringify(payload), saved_at: new Date().toISOString() };
}

export function loadPack(key) {
  try {
    return mem.packs[key] ? JSON.parse(mem.packs[key].payload) : null;
  } catch {
    return null;
  }
}

export function queueAttempt(payload) {
  const id = payload.client_uuid || uuid();
  payload.client_uuid = id;
  payload.offline_created_at = new Date().toISOString();
  mem.queue.push(payload);
  return id;
}

export function pendingAttempts() {
  return [...mem.queue];
}

export function dropQueued(id) {
  mem.queue = mem.queue.filter((p) => p.client_uuid !== id);
}

export function pendingCount() {
  return mem.queue.length;
}
