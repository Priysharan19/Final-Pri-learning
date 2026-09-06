// Pri Learning · the sync worker acknowledges commits, and a first link merges.
//
// Drives the real IndexedDB-backed cloud account / profile outbox / sync modules
// against a deterministic in-process HTTP mock. No production endpoint is
// contacted.
//
// Dropping an entry from the durable outbox is the one irreversible act in a
// sync: the local rows stay, but nothing will ever look at them again. The
// worker's own header says it "acknowledges sequence numbers only after the
// server confirms the commit", and profileOutbox's acknowledgeProfileMutations
// says "only remote commits" — but syncNow acknowledged `batch.represented`,
// which is everything it put in the ENVELOPE, whatever came back. A student who
// worked offline all evening could have the whole batch dropped and never
// retried, and `result.acceptedEvents || []` meant an unparseable 200 read as
// "the server took it all".
//
// The first link to an account that already has data has two more problems. The
// pre-pull applied the cloud's profile body straight onto a local row that had
// never been published — for an Indian student `year` selects the entire NCERT
// scope — and syncContract.resolveEntityConflict, which exists for exactly this,
// was never called by the worker. And the rescan acknowledged only its own
// marker, leaving the pre-link outbox entries in place, so every attempt already
// published as a `hist:` event was published again as an `evt-` event under a
// different id that idempotency has no way to match.
//
// Usage: node client/test/cloud-sync-ack-check.mjs

import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://pri.example.test';

const account = { id: 'acct-A', email: 'a@example.test', name: 'A', role: 'student', emailVerified: true };
const pushes = [];

// What the mock server does with a push, and what it already holds.
let accept = 'everything';          // 'everything' | 'nothing' | 'events-only' | 'unparseable'
let serverEntities = [];
let serverCursor = 0;

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json', 'x-pri-request-id': 'ack-test' }
});

globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  if (path === '/v1/account/login' || path === '/v1/account/me') return json({ account });
  if (path === '/v1/account/logout') return json({ ok: true });
  if (path === '/v1/entitlements') return json({ entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } });
  if (path.startsWith('/v1/sync/pull/')) {
    const from = Number(path.split('/').pop()) || 0;
    const entities = serverEntities.filter(row => row.serverCursor > from);
    return json({ schemaVersion: 1, cursor: Math.max(from, serverCursor), hasMore: false, events: [], entities });
  }
  if (path === '/v1/sync/push') {
    const body = JSON.parse(options.body || '{}');
    pushes.push(body);
    const cursor = pushes.length * 100;
    if (accept === 'unparseable') return json({ ok: true, replayed: true });
    const acceptedEvents = accept === 'nothing' ? [] : (body.events || []).map((event, i) => ({ id: event.id, serverCursor: cursor + i, replayed: false }));
    const acceptedEntities = accept === 'nothing' || accept === 'events-only'
      ? []
      : (body.entities || []).map((entity, i) => ({ kind: entity.kind, entityId: entity.entityId, version: entity.baseVersion + 1, serverCursor: cursor + 50 + i }));
    // A committed entity becomes what a later pull returns, the way the real
    // server's sync_entities row does. Without that the mock would answer a pull
    // with a body it had just been told was superseded, and the suite would be
    // testing an inconsistency no server can produce.
    for (const row of acceptedEntities) {
      const sent = body.entities.find(e => e.kind === row.kind && e.entityId === row.entityId);
      serverCursor = Math.max(serverCursor, row.serverCursor);
      const at = serverEntities.findIndex(e => e.kind === row.kind && e.entityId === row.entityId);
      const next = { kind: row.kind, entityId: row.entityId, version: row.version, serverCursor: row.serverCursor, updatedAt: Date.now(), tombstone: sent.operation === 'delete', body: sent.body || null };
      if (at >= 0) serverEntities[at] = next; else serverEntities.push(next);
    }
    return json({ schemaVersion: 1, cursor, acceptedEvents, acceptedEntities, fullRescanAccepted: !!body.fullRescan });
  }
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

const { add, get, put } = await import('../src/local/idb.js');
const { loginCloudAccount } = await import('../src/platform/cloudAccount.js');
const { profileOutboxStats, recordProfileMutation } = await import('../src/platform/profileOutbox.js');
const { syncNow } = await import('../src/platform/syncWorker.js');

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

const allEvents = () => pushes.flatMap(body => body.events || []);
const since = from => pushes.slice(from).flatMap(body => body.events || []);
/**
 * How many DISTINCT cloud events one local answer turned into. A retry re-sends
 * the same envelope, and that is safe precisely because the event carries the
 * same id — so it is ids, not envelopes, that say whether an answer was
 * duplicated in the student's cloud history.
 */
const distinctEventsFor = (...entityIds) =>
  new Set(allEvents().filter(event => entityIds.includes(event.entityId)).map(event => event.id)).size;

// ── A first link to an account that already holds this student's profile ─────

// The cloud copy is what an older phone published: a different name and, for an
// Indian student, a different `year` — the field that chooses the whole NCERT
// scope they practise from.
serverCursor = 5;
serverEntities = [{
  kind: 'profile', entityId: 'self', version: 4, serverCursor: 5, updatedAt: 1000, tombstone: false,
  body: { name: 'Aarav (old phone)', year: 9, course: 'in', indiaTrack: 'cbse', pathway: null, avatar: '🙂', theme: 'dark', dailyGoal: 10, handwriting: true }
}];

await put('profiles', { id: 'p1', name: 'Aarav', avatar: '🙂', year: 10, role: 'student', course: 'in', indiaTrack: 'cbse', theme: 'dark', dailyGoal: 10, handwriting: true });
const attemptId = await add('attempts', {
  pid: 'p1', questionId: 'q-1', subtopic: 'c10-polynomials', difficulty: 2, correct: 1,
  ms: 4000, hintsUsed: 0, mode: 'practice', viaInk: true, ratingBefore: 1000, ratingAfter: 1020, createdAt: 1700000000000
});
ok('the local attempt was stored before the first link', attemptId !== undefined, String(attemptId));
// Work done before the account existed leaves a fine-grained marker behind as
// well as the rows the rescan reads.
await recordProfileMutation('p1', 'POST', '/practice/q-1/submit', { correct: true });

await loginCloudAccount('p1', { email: 'a@example.test', password: 'test-password-only' });
ok('the first sync requires a full reconciliation', (await profileOutboxStats('p1')).requiresFullRescan === true);

const first = await syncNow('p1');
ok('the reconciliation clears the full-rescan requirement', first.requiresFullRescan === false, JSON.stringify(first.requiresFullRescan));

const local = await get('profiles', 'p1');
eq('the never-published local name survives the first link', local.name, 'Aarav');
eq('the never-published local year survives the first link', local.year, 10);
const published = pushes.flatMap(body => body.entities || []).filter(e => e.kind === 'profile');
ok('the rescan publishes the local profile, not the one it just pulled',
  published.length > 0 && published.every(e => e.body.name === 'Aarav' && e.body.year === 10),
  JSON.stringify(published.map(e => e.body)));
ok('the rescan pushes at the version the pre-pull learned',
  published.every(e => e.baseVersion === 4), JSON.stringify(published.map(e => e.baseVersion)));

const rescanEvents = allEvents().filter(event => event.kind === 'practice-progress');
eq('one local attempt produced exactly one cloud event', rescanEvents.length, 1);
ok('the reconciliation sent it as a historical event', rescanEvents[0].id.startsWith('hist:'), rescanEvents[0].id);
eq('the pre-link marker was acknowledged with the reconciliation', (await profileOutboxStats('p1')).pending, 0);

const beforeSecond = pushes.length;
const second = await syncNow('p1');
eq('a second sync has nothing left to send', since(beforeSecond).length, 0);
eq('the second sync acknowledges nothing', second.acknowledged, 0);
eq('one local attempt is still exactly one cloud event', allEvents().filter(e => e.kind === 'practice-progress').length, 1);

// ── An ordinary push the server declines ─────────────────────────────────────

await add('attempts', {
  pid: 'p1', questionId: 'q-A', subtopic: 'c10-circles', difficulty: 2, correct: 1,
  ms: 3000, hintsUsed: 0, mode: 'practice', viaInk: false, ratingBefore: 1020, ratingAfter: 1035, createdAt: Date.now()
});
await recordProfileMutation('p1', 'POST', '/practice/q-A/submit', { correct: true });
await add('attempts', {
  pid: 'p1', questionId: 'q-B', subtopic: 'c10-circles', difficulty: 2, correct: 0,
  ms: 5000, hintsUsed: 1, mode: 'practice', viaInk: false, ratingBefore: 1035, ratingAfter: 1015, createdAt: Date.now()
});
await recordProfileMutation('p1', 'POST', '/practice/q-B/submit', {});
await put('profiles', { ...(await get('profiles', 'p1')), year: 11 });
await recordProfileMutation('p1', 'PATCH', '/me', { user: { id: 'p1' } });
eq('three offline mutations are queued', (await profileOutboxStats('p1')).pending, 3);

accept = 'nothing';
const declined = await syncNow('p1');
eq('a declined push acknowledges nothing', declined.acknowledged, 0);
eq('a declined push leaves every entry queued', (await profileOutboxStats('p1')).pending, 3);
ok('a declined push reports what it could not commit',
  declined.blocked.length === 3 && declined.blocked.every(row => row.reason === 'not-committed-remotely'),
  JSON.stringify(declined.blocked));

accept = 'events-only';
const partial = await syncNow('p1');
eq('a partial accept acknowledges only the committed events', partial.acknowledged, 2);
eq('a partial accept leaves the uncommitted entity queued', (await profileOutboxStats('p1')).pending, 1);
ok('a partial accept names the entry it could not commit',
  partial.blocked.some(row => row.kind === 'profile' && row.reason === 'not-committed-remotely'),
  JSON.stringify(partial.blocked));

accept = 'everything';
const finished = await syncNow('p1');
eq('the retry commits the entry that was held back', finished.acknowledged, 1);
eq('the queue is empty once the server has taken everything', (await profileOutboxStats('p1')).pending, 0);
eq('the two answers reached the cloud exactly once each', distinctEventsFor('q-A', 'q-B'), 2);

// ── A 200 the worker cannot read ─────────────────────────────────────────────

await add('attempts', {
  pid: 'p1', questionId: 'q-C', subtopic: 'c10-circles', difficulty: 2, correct: 1,
  ms: 2000, hintsUsed: 0, mode: 'practice', viaInk: false, ratingBefore: 1015, ratingAfter: 1030, createdAt: Date.now()
});
await recordProfileMutation('p1', 'POST', '/practice/q-C/submit', { correct: true });
eq('one mutation is queued before the unreadable response', (await profileOutboxStats('p1')).pending, 1);

accept = 'unparseable';
let unreadable = null;
try { await syncNow('p1'); } catch (err) { unreadable = err; }
ok('a 200 the worker cannot vouch for is an error, not an acknowledgement', !!unreadable, 'syncNow returned normally');
eq('the entry is still queued after an unreadable response', (await profileOutboxStats('p1')).pending, 1);

accept = 'everything';
const recovered = await syncNow('p1');
eq('the entry is delivered once the server answers properly', recovered.acknowledged, 1);
eq('the queue is empty again', (await profileOutboxStats('p1')).pending, 0);
eq('the third answer reached the cloud exactly once', distinctEventsFor('q-C'), 1);

// ── A remote change the local replica has NOT edited is taken ────────────────

// Nothing is queued now, so the local profile is exactly what the cloud last
// acknowledged. A newer authoritative version must win — resolveEntityConflict's
// job, and the reason the merge above is a merge rather than "local always wins".
serverCursor = 900;
serverEntities = [{
  kind: 'profile', entityId: 'self', version: 99, serverCursor: 900, updatedAt: 2000, tombstone: false,
  body: { name: 'Aarav Sharma', year: 12, course: 'in', indiaTrack: 'jee-main', pathway: null, avatar: '🚀', theme: 'dark', dailyGoal: 15, handwriting: true }
}];
await syncNow('p1');
const merged = await get('profiles', 'p1');
eq('a newer authoritative profile is applied when nothing local is unpublished', merged.name, 'Aarav Sharma');
eq('the authoritative year is applied too', merged.year, 12);

// And an older one is not.
serverCursor = 1000;
serverEntities = [{
  kind: 'profile', entityId: 'self', version: 2, serverCursor: 1000, updatedAt: 3000, tombstone: false,
  body: { name: 'Stale', year: 7, course: 'in', indiaTrack: 'cbse', pathway: null, avatar: '🙂', theme: 'dark', dailyGoal: 10, handwriting: true }
}];
await syncNow('p1');
const unmoved = await get('profiles', 'p1');
eq('an older authoritative version does not roll the profile back', unmoved.name, 'Aarav Sharma');
eq('an older authoritative version does not roll the year back', unmoved.year, 12);

// A local edit the server has NOT taken stays unpublished, and the pull that
// follows the failed push must not quietly replace it with a remote body. This
// is the same shape as the first link — local state the cloud has never seen —
// on the ordinary path rather than the reconciliation one.
await put('profiles', { ...(await get('profiles', 'p1')), name: 'Aarav on this iPad', year: 11 });
await recordProfileMutation('p1', 'PATCH', '/me', { user: { id: 'p1' } });
serverCursor = 2000;
serverEntities = [{
  kind: 'profile', entityId: 'self', version: 500, serverCursor: 2000, updatedAt: 4000, tombstone: false,
  body: { name: 'Another device', year: 8, course: 'in', indiaTrack: 'cbse', pathway: null, avatar: '🙂', theme: 'dark', dailyGoal: 10, handwriting: true }
}];

accept = 'events-only';                                   // the server declines the profile
await syncNow('p1');
const kept = await get('profiles', 'p1');
eq('an unpublished local edit is not overwritten by the pull that follows', kept.name, 'Aarav on this iPad');
eq('an unpublished local year is not overwritten by the pull that follows', kept.year, 11);
eq('the declined edit is still queued', (await profileOutboxStats('p1')).pending, 1);

accept = 'everything';
const beforeEdit = pushes.length;
await syncNow('p1');
const pushedEdit = pushes.slice(beforeEdit).flatMap(body => body.entities || []).filter(e => e.kind === 'profile');
ok('the retry publishes the local edit, not the remote body it was offered',
  pushedEdit.length === 1 && pushedEdit[0].body.name === 'Aarav on this iPad' && pushedEdit[0].body.year === 11,
  JSON.stringify(pushedEdit.map(e => e.body)));
eq('the local edit survives its own successful sync', (await get('profiles', 'p1')).name, 'Aarav on this iPad');
eq('the queue is empty once that edit is committed', (await profileOutboxStats('p1')).pending, 0);

console.log(`\nCloud sync acknowledgement — ${pass}/${pass + fail} checks`);
// ── The idempotency key must cover the CONTENT, not just the sequence range ──
// The server now refuses a key that arrives carrying different content — it has
// to, because replaying the old response for a new batch threw the new work
// away silently. But this device derived its keys from sequence numbers alone,
// so a lost response followed by a changed local row rebuilt the SAME key over
// DIFFERENT content and would have wedged that queue for the key's full 24-hour
// life. Merging the two fixes without this would have traded silent data loss
// for a visible stall.
{
  const { contentDigest } = await import('../src/platform/syncWorker.js');
  const batchA = { events: [{ id: 'e1', kind: 'practice-progress' }], entities: [{ kind: 'settings', entityId: 'settings1', body: { theme: 'light' } }] };
  const batchB = { events: [{ id: 'e1', kind: 'practice-progress' }], entities: [{ kind: 'settings', entityId: 'settings1', body: { theme: 'dark' } }] };
  ok('the same batch always digests the same', contentDigest(batchA) === contentDigest(batchA));
  ok('a batch that differs only in a value digests differently', contentDigest(batchA) !== contentDigest(batchB));
  ok('and so the retried key differs, instead of colliding with the stored one',
    `sync-dev-1-3-${contentDigest(batchA)}` !== `sync-dev-1-3-${contentDigest(batchB)}`);
  ok('an empty and a populated batch never share a digest', contentDigest({ events: [], entities: [] }) !== contentDigest(batchA));
  ok('the digest is short enough to leave the key inside its 160-character cap', contentDigest(batchA).length <= 13);
}

if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nCLOUD SYNC ACK: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
