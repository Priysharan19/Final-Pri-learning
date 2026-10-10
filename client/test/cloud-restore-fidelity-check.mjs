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
    // Paged as the real server pages: at most 400 events a response.
    const waiting = serverEvents.filter(row => row.serverCursor > from).sort((x, y) => x.serverCursor - y.serverCursor);
    const events = waiting.slice(0, 400);
    const hasMore = waiting.length > events.length;
    return json({ schemaVersion: 1, cursor: hasMore ? events[events.length - 1].serverCursor : Math.max(Number(path.split('/').pop()) || 0, serverCursor), hasMore, events, entities: [] });
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
// A Rapid Fire run as the product writes one: the score IS the number correct,
// at most 20 (POST /rush/finish). (This fixture used to claim a score of 80
// for 8 correct, which no version of the product could produce.)
remote('rush-history', 'rush-old', { score: 8, correct: 8, total: 10, bestCombo: 5, createdAt: yesterday }, yesterday);
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
eq('Rush history is restored', (await byIndex('rushRuns', 'pid', 'p1')).map(r => [r.score, r.correct, r.total, r.bestCombo, r.createdAt]), [[8, 8, 10, 5, yesterday]]);
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

// ── A repeat, and a tampering device of the same account ────────────────────
// (Review 4, B1 and M2.) The server flags an answer to content whose solution
// the account had already been shown; the flag has to survive the restore or
// the row reads as learning evidence. And a device of the same account can
// publish anything it likes as its own Rush, Match and legacy exam history:
// another device must rebuild those rows with the backup importer's types and
// ranges, never copy them.
{
  const { isLearningEvidence, evidenceByKey } = await import('../src/engine/progressTruth.js');
  const { markedByOf } = await import('../src/local/serverExam.js');
  const { checkBadges } = await import('../src/local/badges.js');
  const before = {
    rating: await get('ratings', 'p1:linear'), review: await get('reviews', 'p1:linear'),
    xp: (await get('profiles', 'p1'))?.xp, evidence: evidenceByKey(await byIndex('attempts', 'pid', 'p1')).linear,
    day: (await byIndex('activity', 'pid', 'p1')).find(a => a.date === dayKey(now, TZ)),
    badges: (await byIndex('badges', 'pid', 'p1')).length
  };
  const repeatAt = now + 1000;
  practice('q-repeat', 'linear', true, repeatAt, { repeat: true, marksEarned: 1, marksPossible: 1 });
  const EVIL = 'device-tampered-ipad';
  const evil = (kind, id, payload) => {
    serverCursor += 1;
    serverEvents.push({ serverCursor, id, deviceId: EVIL, deviceSeq: serverCursor, kind, entityId: id, occurredAt: now, payload });
  };
  evil('rush-history', 'evil-rush', { score: 999999, correct: { a: 1 }, total: 'x', bestCombo: [1, 2], createdAt: 'never' });
  evil('rush-history', 'evil-rush-2', { score: 19, correct: 500, total: -3, bestCombo: 1e9, createdAt: 9e15 });
  evil('match-history', 'evil-match', { won: 'yes', playerScore: 1e9, rivalScore: -40, rival: { html: '<b>x</b>' }, ms: -5 });
  evil('match-history', 'evil-match-2', { won: true, playerScore: 7, rivalScore: 3, rival: '<img src=x onerror=1>Robo', ms: 1e15 });
  evil('exam-attempt', 'evil-exam', {
    state: 'finished', title: '<script>x</script>JEE Main Full Paper ' + 'A'.repeat(300), year: 99, score: 300000, total: 300, durationMin: 1e9,
    finishedAt: 9e15, indiaExam: { blueprintId: 'jee-main', label: { o: 1 }, sections: 'not-an-array', seed: -9, fullPaper: 'yes', server: { examId: 'x' } },
    server: { examId: '11111111-1111-4111-8111-111111111111', questionIds: [] }, detail: [{ correct: true }], serverMarked: true
  });
  evil('exam-attempt', 'evil-exam-2', { state: 'finished', title: 'Mock', score: 41, total: 40, year: 10 });
  const pulled = await syncNow('p1');
  eq('the repeat and the six tampered history events are all restored (none is dropped)', pulled.restoredEvents, 7);

  const rows = await byIndex('attempts', 'pid', 'p1');
  const repeatRow = rows.find(a => a.remoteEventId === 'attempt-q-repeat');
  eq('B1: a restored repeat keeps the server\'s repeat flag', repeatRow?.repeat, true);
  eq('B1: so it is not learning evidence on this device either', repeatRow && isLearningEvidence(repeatRow), false);
  eq('B1: the chapter\'s evidence is what it was before the repeat', evidenceByKey(rows).linear, before.evidence);
  eq('B1: an ordinary restored attempt carries no repeat flag', rows.filter(a => a.remoteEventId && a !== repeatRow).some(a => 'repeat' in a), false);
  eq('a restored repeat moves no rating', await get('ratings', 'p1:linear'), before.rating);
  eq('a restored repeat earns no XP', (await get('profiles', 'p1'))?.xp, before.xp);
  const reviewAfter = await get('reviews', 'p1:linear');
  const helped = scheduleReview(before.review, gradeFor({ correct: true, hintsUsed: 1, tries: 0, ms: 5000, difficulty: 2 }), repeatAt);
  eq('…and reschedules the review that already existed as a helped recall, as the sitting device does', [reviewAfter?.dueAt, reviewAfter?.reps], [helped.dueAt, helped.reps]);
  const day = (await byIndex('activity', 'pid', 'p1')).find(a => a.date === dayKey(repeatAt, TZ));
  eq('M3: a restored repeat is a question of its day and never one of the day\'s correct answers',
    [day?.questions, day?.correct], [(before.day?.questions || 0) + 1, before.day?.correct || 0]);
  // Badges are never earned from repeats: with nine more correct repeats on
  // disk the ten-correct badge is still out of reach, and a repeat's own
  // moment awards nothing.
  for (let i = 0; i < 12; i++) await add('attempts', { pid: 'p1', questionId: `q-rep-${i}`, subtopic: 'linear', difficulty: 4, correct: 1, ms: 100, hintsUsed: 0, mode: 'practice', viaInk: true, repeat: true, createdAt: now + 2000 + i });
  const onRepeat = await checkBadges('p1', { type: 'attempt', difficulty: 4, correct: true, hintsUsed: 0, year: 10, xp: 0, repeat: true }, now + 3000, TZ);
  eq('M3: no badge is awarded at the moment of a repeat', [onRepeat.length, (await byIndex('badges', 'pid', 'p1')).length], [0, before.badges]);
  const onReal = await checkBadges('p1', { type: 'attempt', difficulty: 2, correct: true, hintsUsed: 0, year: 10, xp: 0 }, now + 3000, TZ);
  const earned = onReal.map(b => b.id);
  ok('M3: and repeats on disk never count towards a later badge (ten correct, ten in a row, ten handwritten)',
    !earned.includes('ten-up') && !earned.includes('sharpshooter') && !earned.includes('penmanship') && earned.includes('first-steps'), JSON.stringify(earned));

  const rush = Object.fromEntries((await byIndex('rushRuns', 'pid', 'p1')).map(r => [r.remoteEventId, r]));
  eq('M2: a tampered Rush run is typed and held to what Rapid Fire can produce',
    rush['evil-rush'] && [rush['evil-rush'].score, rush['evil-rush'].correct, rush['evil-rush'].total, rush['evil-rush'].bestCombo, rush['evil-rush'].createdAt === now],
    [20, 0, 20, 0, true]);
  eq('M2: …correct never exceeds the score, total never falls below it, and the clock is bounded',
    rush['evil-rush-2'] && [rush['evil-rush-2'].score, rush['evil-rush-2'].correct, rush['evil-rush-2'].total, rush['evil-rush-2'].bestCombo, rush['evil-rush-2'].createdAt <= 4102444800000],
    [19, 19, 19, 19, true]);
  eq('M2: the best Rapid Fire score another device can be made to show is a possible one', Math.max(...Object.values(rush).map(r => r.score)), 20);
  const match = Object.fromEntries((await byIndex('matchRuns', 'pid', 'p1')).map(r => [r.remoteEventId, r]));
  eq('M2: a tampered Match run is typed and clamped; a label that is not text is dropped',
    match['evil-match'] && [match['evil-match'].won, match['evil-match'].playerScore, match['evil-match'].rivalScore, 'rival' in match['evil-match'], match['evil-match'].ms],
    [true, 10, 0, false, 0]);
  eq('M2: markup in a rival\'s name is stripped and the duration bounded',
    match['evil-match-2'] && [match['evil-match-2'].rival, match['evil-match-2'].playerScore, match['evil-match-2'].ms], ['Robo', 7, 1e9]);
  const papers = Object.fromEntries((await byIndex('exams', 'pid', 'p1')).map(e => [e.remoteEventId, e]));
  const evilExam = papers['evil-exam'];
  eq('M2: a tampered legacy exam has its title stripped and cut, and its year, score, total and clock clamped',
    evilExam && [evilExam.title.length <= 80, /[<>]/.test(evilExam.title), evilExam.year, evilExam.score, evilExam.total, evilExam.finishedAt <= 4102444800000, evilExam.durationMin],
    [true, false, 12, 300, 300, true, 600]);
  eq('M2: …its India blueprint is rebuilt field by field', evilExam?.indiaExam && [evilExam.indiaExam.blueprintId, evilExam.indiaExam.sections, evilExam.indiaExam.seed, evilExam.indiaExam.fullPaper, 'label' in evilExam.indiaExam, 'server' in evilExam.indiaExam],
    ['jee-main', [], 0, true, false, false]);
  eq('M2: …it cannot name a server paper, a marked detail or any question', evilExam && ['server' in evilExam, 'detail' in evilExam, evilExam.questionIds], [false, false, []]);
  eq('M2: …so it is listed as marked by an earlier version, never as the server\'s', markedByOf(evilExam), 'earlier-version');
  eq('M2: a score above the paper\'s own total is cut to the total', papers['evil-exam-2'] && [papers['evil-exam-2'].score, papers['evil-exam-2'].total], [40, 40]);
  eq('M2: the tampered history wrote no attempt, rating, review or XP', [
    (await byIndex('attempts', 'pid', 'p1')).filter(a => a.remoteDeviceId === EVIL).length,
    (await byIndex('ratings', 'pid', 'p1')).length, (await get('profiles', 'p1'))?.xp
  ], [0, 2, before.xp]);
  replayAllOnce = true;
  eq('a replayed pull restores none of them twice', (await syncNow('p1')).restoredEvents, 0);
}

// ── Poison: no event may stop the pull (review 5, R1) ───────────────────────
// A device of the same account can publish any JSON as its own history. Values
// whose coercion throws ({ toString: 1 }), arrays, huge strings and non-finite
// numbers go into every numeric, label and time field of every restorable
// kind, and into the event's own clock. The pull must complete, the cursor
// must move past all of it, the genuine server mark that comes AFTER it must
// be restored, and nothing absurd may be on disk.
{
  const { applyRemoteLearningEvents } = await import('../src/platform/cloudSyncRestore.js');
  const POISON = [
    { toString: 1 }, { valueOf: 1, toString: 1 }, { valueOf: 1 }, {}, [], [1, 2], [[{}]], 'x'.repeat(5000), '9'.repeat(400),
    1e308, -1e308, 9e15, -1, 0.5, '', ' ', 'NaN', 'Infinity', true, false, null, { a: { b: { c: 1 } } }, '<img src=x onerror=1>'
  ];
  const FIELDS = {
    'rush-history': ['score', 'correct', 'total', 'bestCombo', 'createdAt'],
    'match-history': ['won', 'playerScore', 'rivalScore', 'rival', 'ms', 'createdAt'],
    'exam-attempt': ['title', 'year', 'score', 'total', 'durationMin', 'createdAt', 'finishedAt', 'indiaExam', 'serverExamId'],
    'task-completion': ['createdAt', 'taskId', 'done'],
    'practice-progress': ['subtopic', 'difficulty', 'correct', 'ms', 'hintsUsed', 'mode', 'createdAt'],
    'graded-attempt': ['subtopic', 'difficulty', 'correct', 'ms', 'hintsUsed', 'tutorLevel', 'mode', 'createdAt', 'contentId', 'contentVersion', 'ratingBefore', 'marksEarned', 'repeat']
  };
  const BASE = {
    'rush-history': { score: 5, correct: 5, total: 6, bestCombo: 2 },
    'match-history': { won: false, playerScore: 3, rivalScore: 4, rival: 'Robo', ms: 1000 },
    'exam-attempt': { state: 'finished', title: 'Mock', year: 10, score: 3, total: 5 },
    'task-completion': {}, 'practice-progress': { subtopic: 'linear', correct: true },
    'graded-attempt': { subtopic: 'linear', difficulty: 2, correct: true, mode: 'practice' }
  };
  const EVIL = 'device-poison-ipad';
  const before = {
    attempts: (await byIndex('attempts', 'pid', 'p1')).length, xp: (await get('profiles', 'p1'))?.xp,
    ratings: JSON.stringify(await byIndex('ratings', 'pid', 'p1'))
  };
  let n = 0;
  const poisonAt = now + 5000;
  for (const [kind, fields] of Object.entries(FIELDS)) {
    for (const field of fields) for (const bad of POISON) {
      n += 1; serverCursor += 1;
      const id = `poison-${n}`;
      // A forged graded-attempt names itself as the grader's in the payload; it is still a device's.
      const payload = { ...BASE[kind], ...(kind === 'graded-attempt' ? { attemptId: id, questionId: id } : {}), [field]: bad };
      serverEvents.push({ serverCursor, id, deviceId: EVIL, deviceSeq: n, kind, entityId: n % 2 ? id : null, occurredAt: poisonAt, payload });
    }
  }
  // The four events the reviewer's probe pushed through the real server, verbatim.
  for (const [id, kind, payload] of [
    ['evt-poison-m', 'match-history', { won: true, playerScore: 10, rival: { toString: 1 } }],
    ['evt-poison-r', 'rush-history', { score: { valueOf: 1, toString: 1 } }],
    ['evt-poison-x', 'exam-attempt', { state: 'finished', title: { toString: 1 }, score: 1, total: 1 }],
    ['evt-poison-t', 'task-completion', { createdAt: { toString: 1 } }]
  ]) { n += 1; serverCursor += 1; serverEvents.push({ serverCursor, id, deviceId: EVIL, deviceSeq: n, kind, entityId: null, occurredAt: poisonAt, payload }); }
  // …and a real mark the server wrote after all of it.
  practice('q-after-poison', 'quadratic', true, poisonAt + 1000);
  const cursorBefore = serverCursor;
  const pulled = await syncNow('p1').then(r => r, e => ({ threw: `${e?.constructor?.name}: ${e?.message}` }));
  ok(`R1: a pull of ${n} poisoned device events completes`, !pulled.threw, JSON.stringify(pulled).slice(0, 300));
  const after = await byIndex('attempts', 'pid', 'p1');
  ok('R1: the genuine server mark that came after the poison IS restored', after.some(a => a.remoteEventId === 'attempt-q-after-poison' && a.correct === 1 && a.subtopic === 'quadratic'));
  eq('R1: …and it is the only attempt the pull added: no device event became a mark', [after.length - before.attempts, after.filter(a => a.remoteDeviceId === EVIL).length], [1, 0]);
  const again2 = await syncNow('p1').then(r => r, e => ({ threw: String(e?.message) }));
  eq('R1: the cursor moved past the poison: the next pull restores nothing and throws nothing', [again2.threw, again2.restoredEvents], [undefined, 0]);
  ok('R1: the server was asked for nothing older than the poison again', serverCursor === cursorBefore);
  const finiteInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const rushBad = (await byIndex('rushRuns', 'pid', 'p1')).filter(r => r.remoteDeviceId === EVIL)
    .filter(r => !['score', 'correct', 'total', 'bestCombo'].every(f => r[f] === undefined || finiteInt(r[f], 0, 100)) || (r.score ?? 0) > 20 || !finiteInt(r.createdAt, 1, 4102444800000));
  eq('R1: every restored Rush run is typed and in range', rushBad.slice(0, 2), []);
  const matchBad = (await byIndex('matchRuns', 'pid', 'p1')).filter(r => r.remoteDeviceId === EVIL)
    .filter(r => (r.won !== undefined && typeof r.won !== 'boolean') || !['playerScore', 'rivalScore'].every(f => r[f] === undefined || finiteInt(r[f], 0, 10)) ||
      (r.rival !== undefined && (typeof r.rival !== 'string' || r.rival.length > 40 || /[<>]/.test(r.rival))) || (r.ms !== undefined && !finiteInt(r.ms, 0, 1e9)) || !finiteInt(r.createdAt, 1, 4102444800000));
  eq('R1: every restored Match run is typed and in range', matchBad.slice(0, 2), []);
  const examBad = (await byIndex('exams', 'pid', 'p1')).filter(e => e.remoteDeviceId === EVIL)
    .filter(e => typeof e.title !== 'string' || e.title.length > 80 || /[<>]/.test(e.title) || !(e.year === null || finiteInt(e.year, 7, 12)) ||
      !(e.score === null || finiteInt(e.score, -999, 999)) || !(e.total === null || finiteInt(e.total, 0, 999)) || (e.score !== null && e.total !== null && e.score > e.total) ||
      !finiteInt(e.createdAt, 1, 4102444800000) || !finiteInt(e.finishedAt, 1, 4102444800000) || 'server' in e || (e.durationMin !== undefined && !finiteInt(e.durationMin, 1, 600)) ||
      JSON.stringify(e).length > 4000);
  eq('R1: every restored legacy exam is typed, in range and small', examBad.slice(0, 2), []);
  ok('R1: the poisoned history was restored as history, not dropped wholesale', (await byIndex('rushRuns', 'pid', 'p1')).filter(r => r.remoteDeviceId === EVIL).length >= 50);
  eq('R1: none of it earned XP beyond the genuine mark, or touched another chapter\'s rating', [(await get('profiles', 'p1'))?.xp - before.xp, (await get('ratings', 'p1:linear')) && JSON.stringify(await get('ratings', 'p1:linear')) === JSON.stringify(JSON.parse(before.ratings).find(r => r.subtopic === 'linear'))], [xpFor(2, true, 0, 0), true]);

  // An event that throws while being read (a getter), direct to the restore.
  const thrower = (id, deviceId, kind, extra = {}) => ({
    id, deviceId, deviceSeq: 1, serverCursor: 1, kind, entityId: id, occurredAt: poisonAt + 2000,
    payload: Object.defineProperty({ attemptId: id, questionId: id, subtopic: 'linear', difficulty: 2, correct: true, mode: 'practice', score: 1, ...extra }, 'ms', { enumerable: true, get() { throw new RangeError('poisoned read'); } })
  });
  const good = (id, at) => ({ id, deviceId: 'server-grader', deviceSeq: 2, serverCursor: 2, kind: 'graded-attempt', entityId: `q-${id}`, occurredAt: at,
    payload: { attemptId: id, questionId: `q-${id}`, subtopic: 'quadratic', difficulty: 2, correct: false, mode: 'practice', ms: 10, createdAt: at } });
  const s1 = await applyRemoteLearningEvents('p1', [thrower('throw-device-run', EVIL, 'match-history'), good('attempt-after-device-throw', poisonAt + 3000)]).then(r => r, e => ({ threw: e?.code || String(e) }));
  eq('R1: a device event that throws is rejected, counted, and the mark after it is applied', [s1.threw, s1.rejected, s1.unsupported, s1.applied], [undefined, 1, 1, 1]);
  // A genuine server mark that cannot be recorded is NOT passed over.
  const s2 = await applyRemoteLearningEvents('p1', [thrower('throw-server-mark', 'server-grader', 'graded-attempt'), good('attempt-after-server-throw', poisonAt + 4000)]).then(r => r, e => ({ threw: e?.code, ids: e?.eventIds, summary: e?.summary }));
  eq('R1: a server mark that cannot be recorded is surfaced, not skipped — after everything else was applied', [s2.threw, s2.ids, s2.summary?.applied, s2.summary?.rejected], ['RESTORE_SERVER_EVENT_FAILED', ['throw-server-mark'], 1, 0]);
  ok('R1: …so the mark that followed it is on disk, and a retry applies nothing twice', (await byIndex('attempts', 'pid', 'p1')).some(a => a.remoteEventId === 'attempt-after-server-throw') &&
    (await applyRemoteLearningEvents('p1', [good('attempt-after-server-throw', poisonAt + 4000)])).duplicates === 1);
}

console.log(`\nCloud restore fidelity — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\n${fail ? '✖ CLOUD RESTORE FIDELITY FAILED' : '✔ CLOUD RESTORE FIDELITY PASSED'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
