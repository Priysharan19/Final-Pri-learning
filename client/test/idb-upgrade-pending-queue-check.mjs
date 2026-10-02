// ─────────────────────────────────────────────────────────────────────────────
// §22 — An IndexedDB schema upgrade never loses or duplicates queued sync work.
//
// A device that last ran an older build holds learning rows and a profile cloud
// queue with entries the cloud has not acknowledged yet. The next build opens
// the database at a newer version, and onupgradeneeded runs over those existing
// stores: it adds what is missing, drops indexes the build no longer writes and
// must touch no row. This pins that: the old rows and the queue survive the
// upgrade byte for byte, the pending entries come back in order, a new attempt
// queued after the upgrade continues the sequence instead of reusing a number,
// a second upgrade changes nothing, and acknowledging delivers each entry once.
// Usage: node client/test/idb-upgrade-pending-queue-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

installBrowserEnv(); resetStorage();

// The in-memory database the app will open, reached before any schema exists.
const freshOpen = globalThis.indexedDB.open;
const database = await new Promise((resolve, reject) => {
  const req = freshOpen('pri-learning');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
assert.equal(database.stores.size, 0, 'the database starts with no schema');

// ── An older build's schema, with an older build's index set ────────────────
// Stores the old build never had are missing, taskProgress lacks its taskId
// index, and classes still carries the teacherPid index the current build drops.
function oldStore(name, opts, indexes = []) {
  const st = database.createObjectStore(name, opts);
  for (const [iname, keyPath] of indexes) st.createIndex(iname, keyPath);
  st.indexNames = { contains: n => st.indexes.has(n) };
  st.deleteIndex = n => { st.indexes.delete(n); };
  return st;
}
oldStore('profiles', { keyPath: 'id' });
oldStore('attempts', { keyPath: 'id', autoIncrement: true }, [['pid', 'pid']]);
oldStore('questions', { keyPath: 'id' }, [['pid', 'pid']]);
oldStore('ratings', { keyPath: 'key' }, [['pid', 'pid']]);
oldStore('activity', { keyPath: 'key' }, [['pid', 'pid']]);
oldStore('rushRuns', { keyPath: 'id', autoIncrement: true }, [['pid', 'pid']]);
oldStore('classes', { keyPath: 'id' }, [['teacherPid', 'teacherPid']]);
oldStore('taskProgress', { keyPath: 'key' }, [['pid', 'pid']]);
oldStore('device', { keyPath: 'id' });

const PID = 'p_upgrade_student';
const OUTBOX = `pri-cloud-outbox-v1:${PID}`;
const now = Date.now();
const seed = {
  attempts: [
    { id: `${PID}:a1`, pid: PID, questionId: 'q_one', subtopic: 'lin', correct: 1, createdAt: now - 3000 },
    { id: `${PID}:a2`, pid: PID, questionId: 'q_two', subtopic: 'lin', correct: 0, createdAt: now - 2000 }
  ],
  rushRuns: [{ id: 7, pid: PID, score: 4, correct: 4, total: 6, createdAt: now - 1000 }],
  device: [{
    id: OUTBOX, version: 1, nextSeq: 4, initialComplete: true,
    items: [
      { seq: 1, kind: 'practice-progress', entityId: 'q_one', operation: 'upsert', sourceId: `${PID}:a1`, firstAt: now - 3000, at: now - 3000 },
      { seq: 2, kind: 'practice-progress', entityId: 'q_two', operation: 'upsert', sourceId: `${PID}:a2`, firstAt: now - 2000, at: now - 2000 },
      { seq: 3, kind: 'rush-history', entityId: 'self', operation: 'upsert', sourceId: 7, firstAt: now - 1000, at: now - 1000 }
    ]
  }]
};
for (const [store, rows] of Object.entries(seed)) {
  for (const row of rows) database.stores.get(store).rows.set(row.id, structuredClone(row));
}
database.stores.get('attempts').seq = 0;
const before = rawRows();

// ── The newer build opens it: onupgradeneeded runs over the existing stores ─
let upgrades = 0;
globalThis.indexedDB = {
  open() {
    const req = {
      result: database, error: null, onsuccess: null, onerror: null, onupgradeneeded: null,
      transaction: { objectStore: name => database.stores.get(name) }
    };
    queueMicrotask(() => {
      try { upgrades++; req.onupgradeneeded?.(); req.onsuccess?.(); }
      catch (err) { req.error = err; req.onerror?.(); }
    });
    return req;
  }
};

const idb = await import('../src/local/idb.js');
const outbox = await import('../src/platform/profileOutbox.js');

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed++; }
  catch (e) { failures.push(`${name}\n      ${String(e?.message || e).split('\n').slice(0, 6).join('\n      ')}`); }
}

await idb.openDB();

await check('the upgrade ran over the old stores and completed the schema', async () => {
  assert.equal(upgrades, 1);
  for (const name of ['exams', 'reviews', 'badges', 'matchRuns', 'inks', 'tasks', 'customQs', 'bookmarks', 'progressImports']) {
    assert.ok(database.stores.has(name), `store ${name} was created`);
  }
  assert.ok(database.stores.get('taskProgress').indexes.has('taskId'), 'a missing index on an existing store was added');
  assert.ok(!database.stores.get('classes').indexes.has('teacherPid'), 'an index the build no longer writes was dropped');
});

await check('no existing row was touched by the upgrade', async () => {
  const after = rawRows();
  for (const store of Object.keys(before)) assert.deepEqual(after[store], before[store], `store ${store} is unchanged`);
});

await check('every queued entry is still pending, in order, once', async () => {
  const pending = await outbox.pendingProfileMutations(PID);
  assert.deepEqual(pending.map(i => i.seq), [1, 2, 3]);
  assert.deepEqual(pending.map(i => i.sourceId), [`${PID}:a1`, `${PID}:a2`, 7]);
  const stats = await outbox.profileOutboxStats(PID);
  assert.equal(stats.pending, 3);
  assert.equal(stats.requiresFullRescan, false, 'the upgrade did not reset the queue to a full rescan');
});

await check('an attempt queued after the upgrade continues the sequence', async () => {
  const attempt = { id: `${PID}:a3`, pid: PID, questionId: 'q_three', subtopic: 'lin', correct: 1, createdAt: Date.now() };
  const { event } = await outbox.stageAttemptProgress(PID, 'q_three', attempt.id,
    queueOp => idb.atomicBatch([{ type: 'add', store: 'attempts', value: attempt }, queueOp]));
  assert.equal(event.seq, 4, 'the next sequence number, never a reused one');
  const pending = await outbox.pendingProfileMutations(PID);
  assert.deepEqual(pending.map(i => i.seq), [1, 2, 3, 4]);
  assert.equal(new Set(pending.map(i => i.seq)).size, pending.length, 'no sequence number appears twice');
  assert.equal((await idb.byIndex('attempts', 'pid', PID)).length, 3);
});

await check('a second upgrade (the next build) changes nothing', async () => {
  const snapshot = rawRows();
  // drop the cached handle the way a versionchange does, then reopen
  database.onversionchange?.();
  await idb.openDB();
  assert.equal(upgrades, 2, 'the upgrade ran again');
  assert.deepEqual(rawRows(), snapshot);
  assert.deepEqual((await outbox.pendingProfileMutations(PID)).map(i => i.seq), [1, 2, 3, 4]);
});

await check('acknowledging delivers each entry exactly once', async () => {
  assert.equal(await outbox.acknowledgeProfileMutations(PID, [1, 2]), 2);
  assert.equal(await outbox.acknowledgeProfileMutations(PID, [1, 2]), 0, 'a repeated acknowledgement removes nothing');
  assert.deepEqual((await outbox.pendingProfileMutations(PID)).map(i => i.seq), [3, 4]);
  assert.equal((await idb.byIndex('attempts', 'pid', PID)).length, 3, 'acknowledging never deletes learning rows');
});

if (failures.length) {
  console.log(`IDB UPGRADE WITH PENDING QUEUE: FAIL — ${failures.length} of ${passed + failures.length} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`IDB UPGRADE WITH PENDING QUEUE: PASS — ${passed}/${passed} checks — an upgrade over existing stores keeps every row and every queued entry, continues the sequence, is idempotent, and acknowledges once.`);
