// Pri Learning · profile-scoped cloud sync outbox
//
// The legacy local/outbox.js predates accounts and is intentionally install-wide.
// That is safe as a dirty-local-state journal, but it MUST NOT be flushed into a
// cloud account: one iPad can hold several local profiles. This queue is therefore
// keyed by local profile id and is the only queue the cloud sync worker consumes.
//
// Every profile starts with a required full rescan. That is the migration path for
// months of local-first data created before cloud sync existed: no old global
// marker is guessed to belong to a child, and no historical local work is silently
// skipped just because the new queue starts empty.

import { get, put } from '../local/idb.js';
import { classifyMutation, coalesce } from '../local/outbox.js';

const VERSION = 1;
const MAX_ITEMS = 500;
const PROFILE_ID = /^[A-Za-z0-9._-]{1,100}$/;
const CLOUD_KINDS = new Set([
  'profile', 'practice-progress', 'exam', 'rush-history', 'match-history',
  'task', 'bookmark', 'favorite', 'custom-question'
]);
const RESCAN = Object.freeze({ seq: 0, kind: 'full-rescan', entityId: 'all', operation: 'upsert', initial: true });

let serial = Promise.resolve();

const rowId = pid => `pri-cloud-outbox-v1:${pid}`;

function requirePid(pid) {
  const value = String(pid || '');
  if (!PROFILE_ID.test(value)) throw new TypeError('cloud outbox profile id is invalid');
  return value;
}

function fresh(pid) {
  return { id: rowId(pid), version: VERSION, nextSeq: 1, initialComplete: false, items: [] };
}

function clean(raw, pid) {
  if (!raw) return fresh(pid);
  if (raw.id !== rowId(pid) || raw.version !== VERSION || !Array.isArray(raw.items) || raw.items.length > MAX_ITEMS) {
    return fresh(pid);
  }
  const items = raw.items.filter(item => item && Number.isSafeInteger(Number(item.seq)) && Number(item.seq) > 0)
    .map(item => ({
      seq: Number(item.seq), kind: String(item.kind || ''), entityId: String(item.entityId || ''),
      operation: String(item.operation || 'upsert'), firstAt: Math.max(0, Number(item.firstAt) || 0),
      at: Math.max(0, Number(item.at) || 0)
    }));
  const maxSeq = items.reduce((n, item) => Math.max(n, item.seq), 0);
  return {
    id: rowId(pid), version: VERSION,
    nextSeq: Math.max(maxSeq + 1, Math.floor(Number(raw.nextSeq) || 1)),
    initialComplete: raw.initialComplete === true,
    items
  };
}

function locked(job) {
  const next = serial.then(job, job);
  serial = next.then(() => undefined, () => undefined);
  return next;
}

async function load(pid) {
  const id = requirePid(pid);
  return clean(await get('device', rowId(id)).catch(() => null), id);
}

async function save(row) {
  await put('device', row);
}

/**
 * Record one successful local mutation for exactly one local profile.
 * Payloads are never copied. Unsupported/server-authoritative local mutations
 * deliberately remain local and continue to be covered by the legacy journal.
 */
export function recordProfileMutation(pid, method, path, result, body = null) {
  const id = requirePid(pid);
  const classified = classifyMutation(method, path, result, body);
  if (!classified || !CLOUD_KINDS.has(classified.kind)) return Promise.resolve(null);

  // Local profile deletion is not cloud-account deletion. Cloud account deletion
  // is an explicit authenticated account action and must never be inferred from
  // deleting one profile on a shared iPad.
  if (classified.kind === 'profile' && classified.operation === 'delete') return Promise.resolve(null);

  return locked(async () => {
    const row = await load(id);
    const now = Date.now();

    // A bulk local import can replace many entities and historical attempts. The
    // only correct cloud action is another complete reconciliation.
    if (classified.operation === 'bulk-import') {
      row.initialComplete = false;
      row.items = [];
      await save(row);
      return { ...RESCAN };
    }

    const event = {
      seq: row.nextSeq++, kind: classified.kind, entityId: classified.entityId,
      operation: classified.operation, firstAt: now, at: now
    };
    const next = coalesce(row.items, event);
    if (next.some(item => item.kind === 'full-rescan')) {
      row.initialComplete = false;
      row.items = [];
    } else {
      row.items = next;
    }
    await save(row);
    return { ...event };
  });
}

/** First cloud sync is always a full rescan; afterwards return this profile only. */
export async function pendingProfileMutations(pid, limit = 100) {
  const row = await load(pid);
  if (!row.initialComplete) return [{ ...RESCAN }];
  const n = Math.max(1, Math.min(MAX_ITEMS, Math.floor(Number(limit) || 100)));
  return row.items.slice(0, n).map(item => ({ ...item }));
}

/** Acknowledge only remote commits for this local profile. */
export function acknowledgeProfileMutations(pid, sequences) {
  const id = requirePid(pid);
  const ack = new Set((Array.isArray(sequences) ? sequences : []).map(Number).filter(Number.isFinite));
  if (!ack.size) return Promise.resolve(0);
  return locked(async () => {
    const row = await load(id);
    let count = 0;
    if (ack.has(0) && !row.initialComplete) {
      row.initialComplete = true;
      count++;
    }
    const before = row.items.length;
    row.items = row.items.filter(item => !ack.has(item.seq));
    count += before - row.items.length;
    if (count) await save(row);
    return count;
  });
}

export async function profileOutboxStats(pid) {
  const row = await load(pid);
  return {
    version: VERSION,
    pending: row.initialComplete ? row.items.length : Math.max(1, row.items.length),
    requiresFullRescan: !row.initialComplete,
    initialComplete: row.initialComplete,
    oldestAt: row.items.length ? Math.min(...row.items.map(item => item.firstAt || item.at || 0)) : null,
    newestAt: row.items.length ? Math.max(...row.items.map(item => item.at || 0)) : null,
    nextSeq: row.nextSeq
  };
}
