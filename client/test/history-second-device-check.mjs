// Pri Learning · History on a second device (release journey §22.2)
//
// L8's local journey on 63deeb757: a student answers on one device, signs in
// on a second, and the sync restores every marked attempt — yet History on the
// second device reads "Nothing here yet", even after a reload. History listed
// only this device's own question rows (local/backend.js POST /history/list),
// and the restore (platform/cloudSyncRestore.js) writes attempt rows only: the
// question and the typed answer never travel through the replica.
//
// Drives the real IndexedDB-backed modules (sync worker, restore, local
// backend) against an in-process HTTP stand-in for the account's event log,
// as cloud-restore-fidelity-check does. Proves the second device's History
// lists the account's answers from the other device — verdict, server marks,
// chapter, date — invents nothing (no prompt, no answer, no retry), keeps a
// question this device answered itself as its own row, and lists nothing that
// was only a client's claim.
//
// Usage: node client/test/history-second-device-check.mjs

import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://pri.example.test';

const account = { id: 'acct-H', email: 'h@example.test', name: 'H', role: 'student', emailVerified: true };
const serverEvents = [];
let serverCursor = 0;
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'x-pri-request-id': 'history-test' } });
globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  if (path === '/v1/account/login' || path === '/v1/account/me') return json({ account });
  if (path === '/v1/entitlements') return json({ entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } });
  if (path.startsWith('/v1/sync/pull/')) {
    const from = Number(path.split('/').pop()) || 0;
    const events = serverEvents.filter(row => row.serverCursor > from).sort((x, y) => x.serverCursor - y.serverCursor);
    return json({ schemaVersion: 1, cursor: Math.max(from, serverCursor), hasMore: false, events, entities: [] });
  }
  if (path === '/v1/sync/push') {
    const body = JSON.parse(options.body || '{}');
    const acceptedEvents = (body.events || []).map(event => { serverCursor += 1; serverEvents.push({ ...event, serverCursor }); return { id: event.id, serverCursor, replayed: false }; });
    const acceptedEntities = (body.entities || []).map(entity => { serverCursor += 1; return { kind: entity.kind, entityId: entity.entityId, version: entity.baseVersion + 1, serverCursor }; });
    return json({ schemaVersion: 1, cursor: serverCursor, acceptedEvents, acceptedEntities, fullRescanAccepted: !!body.fullRescan });
  }
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

const { put, byIndex } = await import('../src/local/idb.js');
const { loginCloudAccount } = await import('../src/platform/cloudAccount.js');
const { syncNow } = await import('../src/platform/syncWorker.js');
const { dispatch } = await import('../src/local/backend.js');

let pass = 0;
const failures = [];
const ok = (name, condition, detail = '') => { if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

// ── What the first device did: three marked answers, committed by the server
//    grader (the only source of a mark), and one client claim that is not one.
const at = Date.now() - 2 * 60 * 60 * 1000;
let gradedSeq = 0;
function graded(questionId, payload, occurredAt) {
  gradedSeq += 1; serverCursor += 1;
  const id = `attempt-${questionId}`;
  serverEvents.push({ serverCursor, id, deviceId: 'server-grader', deviceSeq: gradedSeq, kind: 'graded-attempt', entityId: questionId, occurredAt, payload: { attemptId: id, questionId, ...payload } });
}
const answer = (questionId, subtopic, correct, createdAt, marks) => graded(questionId, {
  subtopic, difficulty: 2, correct, ms: 4000, hintsUsed: 0, tutorLevel: 0, support: 'independent', mode: 'practice', viaInk: false,
  ratingBefore: 1150, ratingAfter: 1160, createdAt, ...marks
}, createdAt);
answer('q-first-1', 'linear', true, at, { marksEarned: 2, marksPossible: 2 });
answer('q-first-2', 'linear', false, at + 60_000, { marksEarned: 1, marksPossible: 3 });
answer('q-first-3', 'quadratic', true, at + 120_000, { marksEarned: 4, marksPossible: 4 });
serverCursor += 1;
serverEvents.push({ serverCursor, id: 'evt-claim-1', deviceId: 'device-first', deviceSeq: 1, kind: 'practice-progress', entityId: 'q-claim', occurredAt: at + 180_000,
  payload: { subtopic: 'linear', difficulty: 4, correct: true, marksEarned: 4, marksPossible: 4, ms: 10, hintsUsed: 0, mode: 'practice', createdAt: at + 180_000 } });

// ── The second device: a profile, signed in, nothing of its own yet ─────────
await put('profiles', { id: 'p2', name: 'Asha', avatar: '🙂', year: 10, role: 'student', course: 'in', indiaTrack: 'cbse', theme: 'dark', dailyGoal: 10, handwriting: true, xp: 0 });
await dispatch('POST', '/profiles/select', { id: 'p2' });
let history = await dispatch('POST', '/history/list', { pageSize: 50 });
eq('before the sign-in, History is empty', history.total, 0);
await loginCloudAccount('p2', { email: 'h@example.test', password: 'test-password-only' });
const synced = await syncNow('p2');
ok('the sync completes and restores the server-marked answers', synced.requiresFullRescan === false && (await byIndex('attempts', 'pid', 'p2')).length === 3,
  JSON.stringify({ synced, attempts: (await byIndex('attempts', 'pid', 'p2')).length }));
ok('the second device holds no question row for them (only the attempts travel)', (await byIndex('questions', 'pid', 'p2')).length === 0);

history = await dispatch('POST', '/history/list', { pageSize: 50 });
eq('History on the second device lists the account\'s three answers from the first device', history.total, 3);
const byId = Object.fromEntries(history.items.map(item => [item.id, item]));
eq('newest first, by question', history.items.map(item => item.id), ['q-first-3', 'q-first-2', 'q-first-1']);
eq('each with its verdict', ['q-first-1', 'q-first-2', 'q-first-3'].map(id => byId[id]?.correct), [true, false, true]);
eq('and the marks the server certified', ['q-first-1', 'q-first-2', 'q-first-3'].map(id => [byId[id]?.marksEarned, byId[id]?.marksPossible]), [[2, 2], [1, 3], [4, 4]]);
eq('when it was answered', byId['q-first-1']?.answeredAt, at);
ok('filed under its chapter', byId['q-first-3']?.subtopic === 'quadratic' && typeof byId['q-first-3']?.subtopicName === 'string' && byId['q-first-3'].subtopicName.length > 0,
  JSON.stringify(byId['q-first-3']));
ok('marked as answered on another device, with nothing invented: no prompt, no answer, no retry',
  history.items.every(item => item.fromAnotherDevice === true && item.prompt === '' && item.answerGiven === '' && item.canRetry === false));
eq('a client\'s own claim of a mark is not a History row', byId['q-claim'], undefined);
eq('the filters count them', [history.counts.all, history.counts.correct, history.counts.wrong], [3, 2, 1]);
eq('"most marks lost" sorts them by the certified marks', (await dispatch('POST', '/history/list', { pageSize: 50, sort: 'marks' })).items.map(item => item.id)[0], 'q-first-2');
eq('a chapter filter keeps them in their chapter', (await dispatch('POST', '/history/list', { pageSize: 50, subtopic: 'linear' })).total, 2);

// A question this device has its own row for is listed once, as its own row.
await put('questions', { id: 'q-first-1', pid: 'p2', subtopic: 'linear', difficulty: 2, mode: 'practice', answered: true, createdAt: at,
  payload: { prompt: 'Solve 2x + 3 = 7', answer: '2' } });
history = await dispatch('POST', '/history/list', { pageSize: 50 });
eq('a question this device holds is listed once', history.items.filter(item => item.id === 'q-first-1').length, 1);
ok('as this device\'s own row, with its prompt', history.items.find(item => item.id === 'q-first-1')?.prompt === 'Solve 2x + 3 = 7'
  && history.items.find(item => item.id === 'q-first-1')?.fromAnotherDevice === undefined);

console.log(failures.length
  ? `HISTORY SECOND DEVICE: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `HISTORY SECOND DEVICE: PASS — ${pass}/${pass} checks — History on a second device lists the account's answers from every device, with their verdict, certified marks, chapter and date, and invents nothing.`);
process.exit(failures.length ? 1 : 0);
