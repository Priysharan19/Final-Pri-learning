// Pri Learning · cloud sync worker behavioural contract
// Drives the real IndexedDB-backed cloud account/outbox/sync modules against a
// deterministic in-process HTTP mock. No production endpoint is contacted.

import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://pri.example.test';

const pushes = [];
let account = { id: 'acct-A', email: 'a@example.test', name: 'A', role: 'student', emailVerified: true };

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json', 'x-pri-request-id': 'sync-test' }
});

globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  if (path === '/v1/account/login') return json({ account });
  if (path === '/v1/account/me') return json({ account });
  if (path === '/v1/entitlements') return json({ entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } });
  if (path.startsWith('/v1/sync/pull/')) {
    return json({ schemaVersion: 1, cursor: Number(path.split('/').pop()) || 0, hasMore: false, events: [], entities: [] });
  }
  if (path === '/v1/sync/push') {
    const body = JSON.parse(options.body || '{}');
    pushes.push({ body, headers: { ...(options.headers || {}) } });
    let cursor = pushes.length * 100;
    return json({
      schemaVersion: 1,
      cursor,
      acceptedEvents: (body.events || []).map((event, i) => ({ id: event.id, serverCursor: cursor + i, replayed: false })),
      acceptedEntities: (body.entities || []).map((entity, i) => ({ kind: entity.kind, entityId: entity.entityId, version: entity.baseVersion + 1, serverCursor: cursor + 50 + i })),
      fullRescanAccepted: !!body.fullRescan
    });
  }
  if (path === '/v1/account/logout') return json({ ok: true });
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

const { add, put } = await import('../src/local/idb.js');
const { loginCloudAccount } = await import('../src/platform/cloudAccount.js');
const {
  acknowledgeProfileMutations, pendingProfileMutations, recordProfileMutation
} = await import('../src/platform/profileOutbox.js');
const { cloudSyncStatus, syncNow } = await import('../src/platform/syncWorker.js');

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};
const same = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

await put('profiles', { id: 'p1', name: 'Local A', avatar: 'A', year: 10, role: 'student', course: 'in', indiaTrack: 'cbse', theme: 'dark', dailyGoal: 10, handwriting: true });
await add('attempts', { pid: 'p1', questionId: 'q-old-1', subtopic: 'linear', difficulty: 2, correct: 0, ms: 1400, hintsUsed: 1, mode: 'practice', viaInk: true, ratingBefore: 1000, ratingAfter: 990, createdAt: 1000 });
await add('attempts', { pid: 'p1', questionId: 'q-old-2', subtopic: 'quadratic', difficulty: 3, correct: 1, ms: 900, hintsUsed: 0, mode: 'practice', viaInk: false, ratingBefore: 990, ratingAfter: 1015, createdAt: 2000 });
await put('exams', {
  id: 'exam-old-1', pid: 'p1', title: 'Class 10 mathematics mock', year: 10,
  questionIds: [], createdAt: 2100, finishedAt: 2600, score: 17, total: 25,
  indiaExam: { family: 'cbse-school', sourceReviewed: true }
});
await add('rushRuns', { pid: 'p1', score: 80, correct: 8, total: 10, bestCombo: 5, createdAt: 2700 });
await add('matchRuns', { pid: 'p1', won: true, playerScore: 7, rivalScore: 4, rival: 'Robo-Rookie', ms: 45000, createdAt: 2800 });

await loginCloudAccount('p1', { email: 'a@example.test', password: 'test-password-only' });
same('first profile sync requires reconciliation', (await cloudSyncStatus('p1')).requiresFullRescan, true);
const first = await syncNow('p1');
same('initial reconciliation clears full-rescan requirement', first.requiresFullRescan, false);

const initialEnvelopes = pushes.slice();
const initialEvents = initialEnvelopes.flatMap(x => x.body.events || []);
const initialEntities = initialEnvelopes.flatMap(x => x.body.entities || []);
const historicalAttempts = initialEvents.filter(event => event.kind === 'practice-progress');
same('initial reconciliation migrates both historical attempts', historicalAttempts.length, 2);
ok('historical attempts use reserved high device sequence namespace', historicalAttempts.every(event => event.deviceSeq >= 4_000_000_000_000_000), JSON.stringify(historicalAttempts.map(x => x.deviceSeq)));
same('historical attempt payloads preserve two separate subtopics', historicalAttempts.map(x => x.payload.subtopic).sort(), ['linear', 'quadratic']);
same('initial reconciliation includes completed exam history', initialEvents.filter(event => event.kind === 'exam-attempt').length, 1);
same('initial reconciliation includes Rush history', initialEvents.filter(event => event.kind === 'rush-history').length, 1);
same('initial reconciliation includes Match history', initialEvents.filter(event => event.kind === 'match-history').length, 1);
same('initial reconciliation migrates every supported historical learning fact', initialEvents.length, 5);
ok('historical supplemental events use their reserved sequence namespace', initialEvents.filter(event => event.kind !== 'practice-progress').every(event => event.deviceSeq >= 6_500_000_000_000_000), JSON.stringify(initialEvents.map(x => [x.kind, x.deviceSeq])));
ok('initial reconciliation includes local profile state', initialEntities.some(x => x.kind === 'profile' && x.entityId === 'self'), JSON.stringify(initialEntities));
ok('every sync push carries an idempotency key', initialEnvelopes.every(x => x.headers['Idempotency-Key']), JSON.stringify(initialEnvelopes.map(x => x.headers)));

// New repeated attempts after the initial migration remain distinct and use the
// low live outbox sequence namespace, never the reserved historical namespace.
const newAttemptId = await add('attempts', { pid: 'p1', questionId: 'q-repeat', subtopic: 'linear', difficulty: 2, correct: 1, ms: 700, hintsUsed: 0, mode: 'practice', viaInk: true, ratingBefore: 1015, ratingAfter: 1030, createdAt: 3000 });
const marker = await recordProfileMutation('p1', 'POST', '/practice/q-repeat/submit', { correct: true });
same('live marker records exact opaque attempt source id', marker.sourceId, newAttemptId);
const beforeLive = pushes.length;
await syncNow('p1');
const liveEvents = pushes.slice(beforeLive).flatMap(x => x.body.events || []);
same('one new local attempt produces one cloud event', liveEvents.length, 1);
same('live event carries expected question id', liveEvents[0]?.entityId, 'q-repeat');
ok('live event uses ordinary outbox sequence namespace', liveEvents[0]?.deviceSeq > 0 && liveEvents[0].deviceSeq < 1_000_000, String(liveEvents[0]?.deviceSeq));

// A second profile on the same install must not enter p1's queue or p1's rescan.
await put('profiles', { id: 'p2', name: 'Local B', avatar: 'B', year: 9, role: 'student', course: 'in', indiaTrack: 'cbse', theme: 'dark', dailyGoal: 10, handwriting: true });
await add('attempts', { pid: 'p2', questionId: 'q-p2', subtopic: 'secret-p2-topic', difficulty: 2, correct: 1, ms: 600, hintsUsed: 0, mode: 'practice', viaInk: false, ratingBefore: 1000, ratingAfter: 1010, createdAt: 4000 });
await acknowledgeProfileMutations('p2', [0]); // isolate the live-queue assertion from p2's own first-sync marker
await recordProfileMutation('p2', 'POST', '/practice/q-p2/submit', { correct: true });
same('p2 has one independent pending mutation', (await pendingProfileMutations('p2')).length, 1);
same('p1 remains clear after its own successful sync', (await cloudSyncStatus('p1')).pending, 0);
const beforeIsolation = pushes.length;
await syncNow('p1');
const isolationPayload = JSON.stringify(pushes.slice(beforeIsolation));
ok('p1 sync never uploads p2 subtopic', !isolationPayload.includes('secret-p2-topic'), isolationPayload);
ok('p1 sync never uploads p2 question id', !isolationPayload.includes('q-p2'), isolationPayload);

console.log(`\nCloud sync worker — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\n${fail ? '✖ CLOUD SYNC WORKER FAILED' : '✔ CLOUD SYNC WORKER PASSED'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
