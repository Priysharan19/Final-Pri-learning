// Pri Learning · sync conflict recovery
//
// The server refuses a whole push when one entity's baseVersion is stale (409
// SYNC_ENTITY_CONFLICT). The worker used to record the error and stop, and the
// next sync rebuilt the same push from the same stale version — the queue was
// wedged until something else happened to move the cursor. It now pulls the
// authoritative versions, re-applies the pending local edit over them (last
// writer wins for profile fields) and retries once; a second refusal is
// surfaced, with every queue entry kept for the next sync.
//
// Drives the real IndexedDB-backed modules against an in-process HTTP mock. No
// production endpoint is contacted.
//
// Usage: node client/test/sync-conflict-recovery-check.mjs

import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://pri.example.test';

const account = { id: 'acct-C', email: 'c@example.test', name: 'C', role: 'student', emailVerified: true };
const pushes = [];
const pulls = [];
// The server's sync_entities table and event log for this account.
const entities = new Map();   // `${kind}:${entityId}` → row
const events = [];
let serverCursor = 0;
let alwaysConflict = false;

const key = (kind, entityId) => `${kind}:${entityId}`;
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json', 'x-pri-request-id': 'conflict-test' }
});

/** Another device commits an entity version behind this device's back. */
function remoteCommit(kind, entityId, body) {
  const current = entities.get(key(kind, entityId));
  serverCursor += 1;
  entities.set(key(kind, entityId), {
    kind, entityId, version: (current?.version || 0) + 1, serverCursor, updatedAt: Date.now(), tombstone: false, body
  });
  return entities.get(key(kind, entityId));
}

globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  if (path === '/v1/account/login' || path === '/v1/account/me') return json({ account });
  if (path === '/v1/account/logout') return json({ ok: true });
  if (path === '/v1/entitlements') return json({ entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } });
  if (path.startsWith('/v1/sync/pull/')) {
    const from = Number(path.split('/').pop()) || 0;
    pulls.push(from);
    return json({
      schemaVersion: 1, cursor: Math.max(from, serverCursor), hasMore: false,
      events: events.filter(row => row.serverCursor > from),
      entities: [...entities.values()].filter(row => row.serverCursor > from)
    });
  }
  if (path === '/v1/sync/push') {
    const body = JSON.parse(options.body || '{}');
    pushes.push(body);
    // The real server validates every entity before committing anything.
    for (const entity of body.entities || []) {
      const current = entities.get(key(entity.kind, entity.entityId));
      if (alwaysConflict || (current?.version || 0) !== entity.baseVersion) {
        return json({ error: { code: 'SYNC_ENTITY_CONFLICT', message: `Sync conflict for ${entity.kind}:${entity.entityId}.` } }, 409);
      }
    }
    const acceptedEvents = (body.events || []).map(event => {
      serverCursor += 1;
      events.push({ ...event, serverCursor });
      return { id: event.id, serverCursor, replayed: false };
    });
    const acceptedEntities = (body.entities || []).map(entity => {
      const committed = remoteCommit(entity.kind, entity.entityId, entity.body || null);
      return { kind: entity.kind, entityId: entity.entityId, version: committed.version, serverCursor: committed.serverCursor };
    });
    return json({ schemaVersion: 1, cursor: serverCursor, acceptedEvents, acceptedEntities, fullRescanAccepted: !!body.fullRescan });
  }
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

const { add, get, put } = await import('../src/local/idb.js');
const { loginCloudAccount } = await import('../src/platform/cloudAccount.js');
const { pendingProfileMutations, recordProfileMutation } = await import('../src/platform/profileOutbox.js');
const { cloudSyncStatus, syncNow } = await import('../src/platform/syncWorker.js');
const { syncStateId } = await import('../src/platform/syncReplicaState.js');

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return true; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return false;
};
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const profileBody = row => ({ name: row.name, year: row.year, course: row.course, pathway: row.pathway || null, indiaTrack: row.indiaTrack || null, avatar: row.avatar, theme: row.theme, dailyGoal: row.dailyGoal, handwriting: row.handwriting !== false });

// ── Link, publish the profile once, so this device knows version 1 ───────────

const base = { id: 'p1', name: 'Aarav', avatar: '🙂', year: 10, role: 'student', course: 'in', indiaTrack: 'cbse', theme: 'dark', dailyGoal: 10, handwriting: true };
await put('profiles', base);
await loginCloudAccount('p1', { email: 'c@example.test', password: 'test-password-only' });
const first = await syncNow('p1');
eq('the first sync reconciles', first.requiresFullRescan, false);
eq('the server now holds the profile at version 1', entities.get('profile:self')?.version, 1);
eq('no conflict on a clean first link', first.conflicts, 0);

// ── Another device moves the profile; this device edits it too ───────────────

remoteCommit('profile', 'self', { ...profileBody(base), name: 'Aarav (old phone)', theme: 'light' });
eq('the other device committed version 2', entities.get('profile:self')?.version, 2);

await put('profiles', { ...base, name: 'Aarav', dailyGoal: 20 });
await recordProfileMutation('p1', 'PATCH', '/me', { user: { id: 'p1' } }, { dailyGoal: 20 });
// A learning event rides in the same push, so the refusal covers it as well.
const attemptId = await add('attempts', { pid: 'p1', questionId: 'q-1', subtopic: 'linear', difficulty: 2, correct: 1, ms: 700, hintsUsed: 0, mode: 'practice', viaInk: false, ratingBefore: 1150, ratingAfter: 1170, createdAt: Date.now() });
await recordProfileMutation('p1', 'POST', '/practice/q-1/submit', { correct: true });
eq('two entries wait in the outbox', (await pendingProfileMutations('p1')).length, 2);

const beforePush = pushes.length;
const beforePulls = pulls.length;
const recovered = await syncNow('p1');
const sent = pushes.slice(beforePush);
eq('the first push was refused and exactly one retry followed', sent.length, 2);
eq('the first push carried the stale base version', sent[0].entities.find(e => e.kind === 'profile')?.baseVersion, 1);
eq('the retry carried the version learned from the pull', sent[1].entities.find(e => e.kind === 'profile')?.baseVersion, 2);
ok('a pull happened between the refusal and the retry', pulls.length - beforePulls >= 2, String(pulls.length - beforePulls));
eq('the retry re-applies the local intent over the newer remote record', sent[1].entities.find(e => e.kind === 'profile')?.body.dailyGoal, 20);
eq('last writer wins for profile fields: the remote rename does not survive the local edit', entities.get('profile:self')?.body.name, 'Aarav');
eq('the server holds version 3 after the retry', entities.get('profile:self')?.version, 3);
eq('the learning event in the refused push was committed by the retry, once', events.filter(e => e.entityId === 'q-1').length, 1);
eq('the sync reports the conflict and its recovery', [recovered.conflicts, recovered.conflictsRecovered], [1, 1]);
eq('the outbox is clear once the retry is acknowledged', (await pendingProfileMutations('p1')).length, 0);
eq('the local profile keeps the edit the student made here', (await get('profiles', 'p1'))?.dailyGoal, 20);
eq('the local profile keeps its local name', (await get('profiles', 'p1'))?.name, 'Aarav');
eq('the state records no error', (await cloudSyncStatus('p1')).lastError, null);

// ── A cursor already past the moved record: the version-only re-walk ─────────

// The other device commits again, and this device's cursor is (by whatever
// accident) already past that commit: a pull from the cursor learns nothing.
remoteCommit('profile', 'self', { ...profileBody(base), dailyGoal: 20, avatar: '🦉' });
const state = await get('device', syncStateId('p1'));
const aheadCursor = serverCursor + 50;
await put('device', { ...state, cursor: aheadCursor });
await put('profiles', { ...base, dailyGoal: 25 });
await recordProfileMutation('p1', 'PATCH', '/me', { user: { id: 'p1' } }, { dailyGoal: 25 });

const beforeAhead = pushes.length;
const beforeAheadPulls = pulls.length;
const ahead = await syncNow('p1');
const aheadSent = pushes.slice(beforeAhead);
eq('a stale cursor still ends in one refusal and one retry', aheadSent.length, 2);
ok('the recovery fell back to a walk from cursor 0', pulls.slice(beforeAheadPulls).includes(0), JSON.stringify(pulls.slice(beforeAheadPulls)));
eq('the retry carried the version the walk learned', aheadSent[1].entities.find(e => e.kind === 'profile')?.baseVersion, 4);
eq('the server holds version 5', entities.get('profile:self')?.version, 5);
eq('the sync recovered', [ahead.conflicts, ahead.conflictsRecovered], [1, 1]);
ok('the saved cursor never moved backwards', (await get('device', syncStateId('p1'))).cursor >= aheadCursor, String((await get('device', syncStateId('p1'))).cursor));

// ── A refusal that persists: the error surfaces and nothing is lost ──────────

alwaysConflict = true;
await put('profiles', { ...base, dailyGoal: 30 });
await recordProfileMutation('p1', 'PATCH', '/me', { user: { id: 'p1' } }, { dailyGoal: 30 });
await add('attempts', { pid: 'p1', questionId: 'q-2', subtopic: 'linear', difficulty: 2, correct: 0, ms: 900, hintsUsed: 0, mode: 'practice', viaInk: false, ratingBefore: 1170, ratingAfter: 1160, createdAt: Date.now() });
await recordProfileMutation('p1', 'POST', '/practice/q-2/submit', { correct: false });
const queuedBefore = await pendingProfileMutations('p1');
eq('two entries wait before the failing sync', queuedBefore.length, 2);

const beforeFail = pushes.length;
let failure = null;
try { await syncNow('p1'); } catch (error) { failure = error; }
eq('a persistent conflict is surfaced to the caller', failure?.code, 'SYNC_ENTITY_CONFLICT');
eq('the worker retried exactly once, never looping', pushes.slice(beforeFail).length, 2);
eq('every queued entry survives the failure', (await pendingProfileMutations('p1')).map(i => i.seq), queuedBefore.map(i => i.seq));
eq('the refused learning event was not committed server-side', events.filter(e => e.entityId === 'q-2').length, 0);
eq('the failure is recorded for the status line', (await cloudSyncStatus('p1')).lastError, 'SYNC_ENTITY_CONFLICT');
eq('the local attempt is untouched', (await get('attempts', attemptId))?.questionId, 'q-1');

// When the server stops refusing, the very next sync drains the same queue.
alwaysConflict = false;
const drained = await syncNow('p1');
eq('the next sync drains the preserved queue', (await pendingProfileMutations('p1')).length, 0);
eq('the preserved learning event reaches the cloud exactly once', events.filter(e => e.entityId === 'q-2').length, 1);
eq('the drain reports no conflict', drained.conflicts, 0);

console.log(`\nSync conflict recovery — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\n${fail ? '✖ SYNC CONFLICT RECOVERY FAILED' : '✔ SYNC CONFLICT RECOVERY PASSED'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
