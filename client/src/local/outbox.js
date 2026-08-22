// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · durable sync outbox
//
// This is a dirty-entity queue, not a copy of student data. It records only the
// random entity id, entity kind, operation and sequence needed to know WHAT must
// be synchronised later. Names, answers, handwriting, emails, passwords and
// record bodies never enter the outbox; a future cloud adapter must re-read the
// authorised current state from the encrypted/local stores when it flushes.
//
// Keeping the outbox payload-free has two benefits now: it is safe to persist in
// the device store, and the app can start accumulating durable offline changes
// before a cloud transport exists without creating a second plaintext database.
// ─────────────────────────────────────────────────────────────────────────────

import { get, put } from './idb.js';

const ROW_ID = 'pri-sync-outbox-v1';
const VERSION = 1;
const MAX_ITEMS = 500;
const ID = /^[A-Za-z0-9._-]{1,100}$/;

let serial = Promise.resolve();

function safeId(value, fallback = 'self') {
  const text = String(value ?? '');
  return ID.test(text) ? text : fallback;
}

function pathId(path, at) {
  const parts = String(path || '').split('/').filter(Boolean);
  return safeId(parts[at], 'unknown');
}

/**
 * Map a successful local mutation to the entity that a future sync adapter has
 * to re-read. null means intentionally local-only or read-only.
 */
export function classifyMutation(method, path, result = null) {
  const key = `${String(method || '').toUpperCase()} ${String(path || '')}`;

  if (key === 'POST /profiles') return { kind: 'profile', entityId: safeId(result?.user?.id), operation: 'upsert' };
  if (key === 'PATCH /me') return { kind: 'profile', entityId: safeId(result?.user?.id), operation: 'upsert' };
  if (key === 'POST /profiles/delete') return null; // deletion id lives in request body; never copied into diagnostics/outbox here
  if (key === 'POST /profiles/password' || key === 'POST /profiles/select' || key === 'POST /auth/logout' || key === 'POST /profiles/demo') return null;

  let m = key.match(/^POST \/practice\/([A-Za-z0-9._-]+)\/(submit|reveal)$/);
  if (m) return { kind: 'practice-progress', entityId: safeId(m[1]), operation: 'upsert' };

  if (key === 'POST /exams') return { kind: 'exam', entityId: safeId(result?.exam?.id), operation: 'upsert' };
  m = key.match(/^POST \/exams\/([A-Za-z0-9._-]+)\/submit$/);
  if (m) return { kind: 'exam', entityId: safeId(m[1]), operation: 'upsert' };

  if (key === 'POST /rush/finish') return { kind: 'rush-history', entityId: 'self', operation: 'upsert' };
  if (key === 'POST /match/finish') return { kind: 'match-history', entityId: 'self', operation: 'upsert' };

  if (key === 'POST /classes') return { kind: 'class', entityId: safeId(result?.class?.id), operation: 'upsert' };
  m = key.match(/^POST \/classes\/([A-Za-z0-9._-]+)\/students$/);
  if (m) return { kind: 'class', entityId: safeId(m[1]), operation: 'upsert' };
  m = key.match(/^POST \/classes\/([A-Za-z0-9._-]+)\/import-progress$/);
  if (m) return { kind: 'class', entityId: safeId(m[1]), operation: 'upsert' };

  if (key === 'POST /tasks') return { kind: 'task', entityId: safeId(result?.task?.id), operation: 'upsert' };
  if (key === 'POST /tasks/import-pack') return { kind: 'task', entityId: safeId(result?.task?.id), operation: 'upsert' };
  m = key.match(/^POST \/tasks\/([A-Za-z0-9._-]+)\/delete$/);
  if (m) return { kind: 'task', entityId: safeId(m[1]), operation: 'delete' };

  m = key.match(/^POST \/history\/([A-Za-z0-9._-]+)\/bookmark$/);
  if (m) return { kind: 'bookmark', entityId: safeId(m[1]), operation: result?.bookmarked === false ? 'delete' : 'upsert' };

  if (key === 'POST /custom-questions') return { kind: 'custom-question', entityId: safeId(result?.question?.id), operation: 'upsert' };
  m = key.match(/^POST \/custom-questions\/([A-Za-z0-9._-]+)\/delete$/);
  if (m) return { kind: 'custom-question', entityId: safeId(m[1]), operation: 'delete' };

  if (key === 'POST /data/import') return { kind: 'profile', entityId: safeId(result?.user?.id), operation: 'bulk-import' };
  return null;
}

export function coalesce(items, next) {
  const list = Array.isArray(items) ? items.filter(Boolean).map(x => ({ ...x })) : [];
  if (!next) return list.slice(-MAX_ITEMS);
  const token = `${next.kind}:${next.entityId}`;
  const prior = list.findIndex(item => `${item.kind}:${item.entityId}` === token);
  if (prior >= 0) {
    const previous = list[prior];
    list.splice(prior, 1);
    next = { ...next, firstAt: previous.firstAt || previous.at || next.firstAt };
  }
  list.push({ ...next });
  return list.slice(-MAX_ITEMS);
}

function cleanRow(raw) {
  if (!raw || raw.id !== ROW_ID || raw.version !== VERSION || !Array.isArray(raw.items)) {
    return { id: ROW_ID, version: VERSION, nextSeq: 1, items: [] };
  }
  const items = raw.items.slice(-MAX_ITEMS).filter(item =>
    item && typeof item === 'object' && typeof item.kind === 'string' &&
    ID.test(String(item.entityId || '')) && ['upsert', 'delete', 'bulk-import'].includes(item.operation)
  ).map(item => ({
    seq: Math.max(1, Math.floor(Number(item.seq) || 1)),
    kind: String(item.kind).slice(0, 40), entityId: String(item.entityId), operation: item.operation,
    firstAt: Math.max(0, Number(item.firstAt) || Number(item.at) || 0),
    at: Math.max(0, Number(item.at) || 0)
  }));
  const maxSeq = items.reduce((n, item) => Math.max(n, item.seq), 0);
  return { id: ROW_ID, version: VERSION, nextSeq: Math.max(maxSeq + 1, Math.floor(Number(raw.nextSeq) || 1)), items };
}

function locked(job) {
  const next = serial.then(job, job);
  serial = next.then(() => undefined, () => undefined);
  return next;
}

/** Persist one successful mutation. The result body is inspected only for ids. */
export function recordMutation(method, path, result) {
  const classified = classifyMutation(method, path, result);
  if (!classified) return Promise.resolve(null);
  return locked(async () => {
    const row = cleanRow(await get('device', ROW_ID).catch(() => null));
    const now = Date.now();
    const event = {
      seq: row.nextSeq++, kind: classified.kind, entityId: classified.entityId,
      operation: classified.operation, firstAt: now, at: now
    };
    row.items = coalesce(row.items, event);
    await put('device', row);
    return { ...event };
  });
}

/** Snapshot for a future transport; contains no user content. */
export async function pendingMutations(limit = 100) {
  const row = cleanRow(await get('device', ROW_ID).catch(() => null));
  const n = Math.max(1, Math.min(500, Math.floor(Number(limit) || 100)));
  return row.items.slice(0, n).map(item => ({ ...item }));
}

/** Acknowledge only sequence numbers a transport actually committed remotely. */
export function acknowledgeMutations(sequences) {
  const ack = new Set((Array.isArray(sequences) ? sequences : []).map(Number).filter(Number.isFinite));
  if (!ack.size) return Promise.resolve(0);
  return locked(async () => {
    const row = cleanRow(await get('device', ROW_ID).catch(() => null));
    const before = row.items.length;
    row.items = row.items.filter(item => !ack.has(item.seq));
    if (row.items.length !== before) await put('device', row);
    return before - row.items.length;
  });
}

export async function outboxStats() {
  const row = cleanRow(await get('device', ROW_ID).catch(() => null));
  return {
    version: VERSION,
    pending: row.items.length,
    oldestAt: row.items.length ? Math.min(...row.items.map(x => x.firstAt || x.at || 0)) : null,
    newestAt: row.items.length ? Math.max(...row.items.map(x => x.at || 0)) : null,
    nextSeq: row.nextSeq
  };
}
