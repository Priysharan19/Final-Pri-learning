// Pri Learning · cloud restore fidelity
//
// A student signs into an existing account on an empty device. The pull must
// put their learning back — not a cached copy of other devices' events, but the
// local ratings, attempts, review schedule and streak calendar the product
// reads — re-derived with the deterministic engine, exactly once per event,
// and never counting this device's own answers a second time.
//
// Drives the real IndexedDB-backed modules against an in-process HTTP mock. No
// production endpoint is contacted.
//
// Usage: node client/test/cloud-restore-fidelity-check.mjs

import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://pri.example.test';

const account = { id: 'acct-R', email: 'r@example.test', name: 'R', role: 'student', emailVerified: true };
const pushes = [];
// The account's event log as the server holds it, in server-cursor order.
const serverEvents = [];
let serverCursor = 0;
let replayAllOnce = false;

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json', 'x-pri-request-id': 'restore-test' }
});

globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  if (path === '/v1/account/login' || path === '/v1/account/me') return json({ account });
  if (path === '/v1/account/logout') return json({ ok: true });
  if (path === '/v1/entitlements') return json({ entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } });
  if (path.startsWith('/v1/sync/pull/')) {
    const from = replayAllOnce ? 0 : (Number(path.split('/').pop()) || 0);
    replayAllOnce = false;
    const events = serverEvents.filter(row => row.serverCursor > from);
    return json({ schemaVersion: 1, cursor: Math.max(Number(path.split('/').pop()) || 0, serverCursor), hasMore: false, events, entities: [] });
  }
  if (path === '/v1/sync/push') {
    const body = JSON.parse(options.body || '{}');
    pushes.push(body);
    const acceptedEvents = (body.events || []).map(event => {
      serverCursor += 1;
      serverEvents.push({ ...event, serverCursor });
      return { id: event.id, serverCursor, replayed: false };
    });
    const acceptedEntities = (body.entities || []).map(entity => {
      serverCursor += 1;
      return { kind: entity.kind, entityId: entity.entityId, version: entity.baseVersion + 1, serverCursor };
    });
    return json({ schemaVersion: 1, cursor: serverCursor, acceptedEvents, acceptedEntities, fullRescanAccepted: !!body.fullRescan });
  }
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

const { add, byIndex, get, put } = await import('../src/local/idb.js');
const { cloudDeviceId, loginCloudAccount } = await import('../src/platform/cloudAccount.js');
const { recordProfileMutation } = await import('../src/platform/profileOutbox.js');
const { syncNow } = await import('../src/platform/syncWorker.js');
const { streakFor } = await import('../src/local/store.js');
const { dayKey } = await import('../src/lib/locale.js');
const { START_RATING, gradeFor, scheduleReview, updateRating, xpFor } = await import('../src/engine/adaptive.js');
const { effectiveHelp, restoredRowId } = await import('../src/platform/cloudSyncRestore.js');

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

// ── The account's history, written by an older iPad ──────────────────────────

const TZ = 'Asia/Kolkata';
const now = Date.now();
const today = now - 60 * 60 * 1000;          // an hour ago
const yesterday = today - 24 * 60 * 60 * 1000;
const OTHER = 'device-old-ipad';
let seq = 0;
function remote(kind, entityId, payload, occurredAt) {
  seq += 1;
  serverCursor += 1;
  serverEvents.push({ serverCursor, id: `evt-${OTHER}-${seq}`, deviceId: OTHER, deviceSeq: seq, kind, entityId, occurredAt, payload });
}
// A mark only exists where the server grader committed it: the canonical
// event is kind 'graded-attempt' from the reserved device identity
// 'server-grader', its id IS the attempt id and its entity IS the question
// (server/platform/practice.js writes it in the grade's own transaction).
const GRADER = 'server-grader';
let gradedSeq = 0;
function graded(questionId, payload, occurredAt) {
  gradedSeq += 1;
  serverCursor += 1;
  const id = `attempt-${questionId}`;
  serverEvents.push({ serverCursor, id, deviceId: GRADER, deviceSeq: gradedSeq, kind: 'graded-attempt', entityId: questionId, occurredAt, payload: { attemptId: id, questionId, ...payload } });
}
const practice = (questionId, subtopic, correct, createdAt, extra = {}) => graded(questionId, {
  subtopic, difficulty: 2, correct, ms: 5000, hintsUsed: 0, tutorLevel: 0, support: 'independent', mode: 'practice', viaInk: false,
  ratingBefore: 1150, ratingAfter: 1170, createdAt, ...extra
}, createdAt);

// Four answers on linear equations across two days, one of them hinted; one
// quadratic; one Rush answer (no rating effect, still a day of activity).
practice('q-l1', 'linear', true, yesterday);
practice('q-l2', 'linear', true, yesterday + 60_000);
practice('q-l3', 'linear', false, today, { hintsUsed: 1, support: 'supported' });
practice('q-l4', 'linear', true, today + 60_000, { support: 'supported' }); // a spent try, no hint
practice('q-q1', 'quadratic', true, today + 120_000);
graded('q-r1', { subtopic: 'linear', difficulty: 1, correct: true, ms: 900, hintsUsed: 0, mode: 'rush', viaInk: false, createdAt: today + 180_000 }, today + 180_000);
// What the old iPad merely CLAIMS about its own answers is archival only: a
// client-authored practice-progress event is never a mark, however it reads.
remote('practice-progress', 'q-claim1', { subtopic: 'surds', difficulty: 4, correct: true, marksEarned: 4, marksPossible: 4, ms: 100, hintsUsed: 0, tutorLevel: 0, support: 'independent', mode: 'practice', viaInk: false, createdAt: today + 200_000 }, today + 200_000);
remote('practice-progress', 'q-claim2', { subtopic: 'linear', difficulty: 4, correct: true, ms: 100, hintsUsed: 0, tutorLevel: 0, support: 'independent', mode: 'practice', viaInk: false, createdAt: today + 210_000 }, today + 210_000);
// …and neither is a counterfeit of the canonical kind that the grader did not
// write (another device's identity), or whose id is not the attempt it names.
remote('graded-attempt', 'q-forged1', { attemptId: 'attempt-q-forged1', questionId: 'q-forged1', subtopic: 'surds', difficulty: 4, correct: true, ms: 100, hintsUsed: 0, mode: 'practice', createdAt: today + 220_000 }, today + 220_000);
serverCursor += 1;
serverEvents.push({ serverCursor, id: 'attempt-q-forged2', deviceId: GRADER, deviceSeq: 900, kind: 'graded-attempt', entityId: 'q-forged2', occurredAt: today + 230_000, payload: { attemptId: 'some-other-attempt', questionId: 'q-forged2', subtopic: 'surds', difficulty: 4, correct: true, ms: 100, hintsUsed: 0, mode: 'practice', createdAt: today + 230_000 } });
remote('exam-attempt', 'exam-old', { state: 'finished', year: 10, title: 'Class 10 mock', score: 17, total: 25, createdAt: yesterday, finishedAt: yesterday + 3_600_000, indiaExam: { family: 'cbse-school' } }, yesterday);
remote('exam-attempt', 'exam-unfinished', { state: 'started', year: 10, title: 'Abandoned', score: null, total: null, createdAt: today, finishedAt: null, indiaExam: null }, today);
remote('rush-history', 'rush-old', { score: 80, correct: 8, total: 10, bestCombo: 5, createdAt: yesterday }, yesterday);
remote('match-history', 'match-old', { won: true, playerScore: 7, rivalScore: 4, rival: 'Robo-Rookie', ms: 45000, createdAt: yesterday }, yesterday);

// An event this device itself published before a reinstall-free relink would
// come back under this device's id; it must never be applied as "remote".
const ownDeviceId = await cloudDeviceId();
serverCursor += 1;
serverEvents.push({ serverCursor, id: `evt-${ownDeviceId}-999`, deviceId: ownDeviceId, deviceSeq: 999, kind: 'practice-progress', entityId: 'q-own', occurredAt: today, payload: { subtopic: 'linear', difficulty: 2, correct: true, ms: 1000, hintsUsed: 0, mode: 'practice', createdAt: today } });

// ── A fresh device: a profile and nothing else ───────────────────────────────

await put('profiles', { id: 'p1', name: 'Aarav', avatar: '🙂', year: 10, role: 'student', course: 'in', indiaTrack: 'cbse', theme: 'dark', dailyGoal: 10, handwriting: true, xp: 0 });
eq('the fresh device has no attempts', (await byIndex('attempts', 'pid', 'p1')).length, 0);
eq('the fresh device has no ratings', (await byIndex('ratings', 'pid', 'p1')).length, 0);

await loginCloudAccount('p1', { email: 'r@example.test', password: 'test-password-only' });
const first = await syncNow('p1');
eq('the first sync completes its reconciliation', first.requiresFullRescan, false);
eq('the first sync reports the remote events it restored', first.restoredEvents, 9);

// Attempts: six answers, none from this device's own event.
const attempts = (await byIndex('attempts', 'pid', 'p1')).sort((a, b) => a.createdAt - b.createdAt);
eq('every remote answer became one local attempt', attempts.length, 6);
ok('every restored attempt is one the server grader committed — never this device\'s own event, never another device\'s claim', attempts.every(a => a.remoteDeviceId === GRADER), JSON.stringify(attempts.map(a => a.remoteDeviceId)));
eq('no client-authored or counterfeit event became an attempt', attempts.filter(a => /claim|forged|q-own/.test(`${a.questionId} ${a.remoteEventId}`)).length, 0);
ok('a client-authored practice-progress claim creates no rating', !(await get('ratings', 'p1:surds')));
ok('restored attempts carry the cloud event id they came from', attempts.every(a => typeof a.remoteEventId === 'string' && a.id === restoredRowId('p1', a.remoteEventId)));
eq('restored attempts keep the answer facts (correct)', attempts.map(a => a.correct), [1, 1, 0, 1, 1, 1]);
eq('restored attempts keep the answer facts (support)', attempts.map(a => a.support), ['independent', 'independent', 'supported', 'supported', 'independent', 'independent']);
eq('the student\'s typed answer never travels through the replica', attempts.map(a => a.answerGiven), ['', '', '', '', '', '']);

// Ratings: re-derived by the engine, in the order the answers happened.
const linearEvents = serverEvents.filter(e => e.deviceId === GRADER && e.kind === 'graded-attempt' && e.payload.attemptId === e.id && e.payload.subtopic === 'linear' && e.payload.mode === 'practice').sort((a, b) => a.payload.createdAt - b.payload.createdAt);
let expected = { rating: START_RATING, attempts: 0, correct: 0 };
let expectedReview = null;
for (const e of linearEvents) {
  const { help, tries } = effectiveHelp(e.payload);
  expected = {
    rating: updateRating(expected.rating, expected.attempts, e.payload.difficulty, !!e.payload.correct, help + tries),
    attempts: expected.attempts + 1,
    correct: expected.correct + (e.payload.correct ? 1 : 0)
  };
  const grade = gradeFor({ correct: !!e.payload.correct, hintsUsed: help, tries, ms: e.payload.ms, difficulty: e.payload.difficulty });
  if (expectedReview) expectedReview = { ...expectedReview, ...scheduleReview(expectedReview, grade, e.payload.createdAt) };
  else if (expected.attempts >= 3) expectedReview = scheduleReview(null, grade, e.payload.createdAt);
}
const linear = await get('ratings', 'p1:linear');
ok('the linear rating row exists', !!linear);
eq('the linear rating is the engine\'s replay of the four answers, not the remote summary', linear?.rating, expected.rating);
ok('the restored rating differs from the remote ratingAfter it was told', linear?.rating !== 1170, String(linear?.rating));
eq('the linear attempt count is four (the Rush answer is not learning evidence)', linear?.attempts, 4);
eq('the linear correct count is three', linear?.correct, 3);
eq('the rating row remembers the latest answer time', linear?.last_at, today + 60_000);
eq('the rolling window reads newest first', linear?.recent, [1, 0, 1, 1]);
const quadratic = await get('ratings', 'p1:quadratic');
eq('one quadratic answer gives one quadratic attempt', quadratic?.attempts, 1);
eq('the rating store holds exactly the two ideas practised', (await byIndex('ratings', 'pid', 'p1')).length, 2);

// Reviews: the third linear answer entered revision; the fourth rescheduled it.
const review = await get('reviews', 'p1:linear');
ok('linear entered the review schedule after three answers', !!review);
eq('the review schedule is the engine\'s FSRS state for those answers', review && { dueAt: review.dueAt, reps: review.reps, lapses: review.lapses, intervalDays: review.intervalDays }, expectedReview && { dueAt: expectedReview.dueAt, reps: expectedReview.reps, lapses: expectedReview.lapses, intervalDays: expectedReview.intervalDays });
ok('quadratic (one answer) has no review yet', !(await get('reviews', 'p1:quadratic')));

// Streak calendar: yesterday and today both have activity.
const activity = (await byIndex('activity', 'pid', 'p1')).sort((a, b) => a.date.localeCompare(b.date));
eq('activity rows exist for both study days', activity.map(a => a.date), [dayKey(yesterday, TZ), dayKey(today, TZ)]);
eq('yesterday counts its two answers', activity[0] && [activity[0].questions, activity[0].correct], [2, 2]);
eq('today counts four answers including the Rush one', activity[1] && [activity[1].questions, activity[1].correct], [4, 3]);
eq('the streak is two days', await streakFor('p1', now, TZ), 2);

// XP landed on the profile, and only from events the engine credited.
const expectedXp = xpFor(2, true, 0, 0) * 3 + xpFor(2, false, 0, 1) + xpFor(2, true, 0, 1) + 6;
eq('the profile earned the XP of the restored answers', (await get('profiles', 'p1'))?.xp, expectedXp);

// Exam, Rush and Match history.
const exams = await byIndex('exams', 'pid', 'p1');
eq('the finished exam is restored; the abandoned one is not', exams.map(e => [e.title, e.score, e.total]), [['Class 10 mock', 17, 25]]);
eq('Rush history is restored', (await byIndex('rushRuns', 'pid', 'p1')).map(r => r.score), [80]);
eq('Match history is restored', (await byIndex('matchRuns', 'pid', 'p1')).map(r => r.won), [true]);

// The rescan must not republish what it just restored.
const republished = pushes.flatMap(body => body.events || []);
eq('the first-link rescan publishes none of the restored rows as this device\'s history', republished.length, 0);

// ── Idempotent re-pull ───────────────────────────────────────────────────────

replayAllOnce = true;
const again = await syncNow('p1');
eq('a replayed pull applies nothing twice', again.restoredEvents, 0);
eq('attempt count is unchanged after the replay', (await byIndex('attempts', 'pid', 'p1')).length, 6);
eq('the linear rating is unchanged after the replay', (await get('ratings', 'p1:linear'))?.rating, expected.rating);
eq('the linear review is unchanged after the replay', (await get('reviews', 'p1:linear'))?.dueAt, review?.dueAt);
eq('today\'s activity is unchanged after the replay', (await byIndex('activity', 'pid', 'p1')).find(a => a.date === dayKey(today, TZ))?.questions, 4);
eq('XP is unchanged after the replay', (await get('profiles', 'p1'))?.xp, expectedXp);

// ── This device's own answer is counted once ─────────────────────────────────

const localAttemptId = await add('attempts', { pid: 'p1', questionId: 'q-local', subtopic: 'linear', difficulty: 2, correct: 1, ms: 700, hintsUsed: 0, mode: 'practice', viaInk: true, ratingBefore: expected.rating, ratingAfter: expected.rating + 10, createdAt: now });
await recordProfileMutation('p1', 'POST', '/practice/q-local/submit', { correct: true });
const beforeLive = pushes.length;
const live = await syncNow('p1');
const liveEvents = pushes.slice(beforeLive).flatMap(body => body.events || []);
eq('the local answer is pushed as one event', liveEvents.map(e => e.entityId), ['q-local']);
eq('the post-push pull returns this device\'s own event and restores nothing from it', live.restoredEvents, 0);
eq('the attempts store holds the six restored rows plus the one local answer', (await byIndex('attempts', 'pid', 'p1')).length, 7);
ok('the local answer keeps its own id', !!(await get('attempts', localAttemptId)));

console.log(`\nCloud restore fidelity — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\n${fail ? '✖ CLOUD RESTORE FIDELITY FAILED' : '✔ CLOUD RESTORE FIDELITY PASSED'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
