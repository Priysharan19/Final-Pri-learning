// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Exam session contract — the clock, the autosave and the
// finalised paper (doc §15).
//
// Drives the real local exam backends (local/indiaExamBackend.js for a JEE Main
// paper, local/backend.js for the practice paper) against the real /v1 server
// booted in-process, with a controllable clock, and pins what a timed paper
// promises a student. Owner decision 2026-10-10: the SERVER issues and marks
// every paper. The device holds the public paper only; every score below is
// the server's, and "the right answer" is read from the server's own sealed
// paper as a test oracle (support/online-authority.mjs), never from the device.
//
//   · the deadline is an absolute timestamp written when the paper starts, and
//     reading the paper back later ("a reload", "a relaunch") reports the same
//     deadline and less time left — never a fresh clock;
//   · answers, working, per-question time and handwriting strokes autosave to
//     the device store and come back on the next read;
//   · nothing saves after the deadline or after the paper is finalised;
//   · a submit after the deadline marks only what was saved before it, never
//     what the late request carries;
//   · the final submit is idempotent: the same submission replayed returns the
//     frozen result without marking again, and any other resubmission is
//     refused without touching learning state;
//   · finalisation freezes the paper version and the exact inputs it marked;
//   · an autosave racing the final submit can never un-finalise the paper;
//   · a paper cannot start signed out or offline, and says why;
//   · every autosave is checkpointed to the server, retried when it fails, and
//     never blocks the local save;
//   · a finish with no connection is queued: no score exists until the server's
//     result arrives, and what is marked after the bell is the last checkpoint;
//   · a paper carried further or finished on another device is adopted on open;
//   · a paper marked by an earlier app version opens in review labelled as
//     such, and one it left unfinished cannot be marked on the device.
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
// Online-only grading (owner decision 2026-10-10): a paper starts only for a
// real signed-in account that can reach the server. The in-process server
// shares this suite's Date.now; both students sign in at offset 0 and the
// clock never moves more than a paper's length from real time.
const { startOnlineAuthority } = await import('./support/online-authority.mjs');
const online = await startOnlineAuthority({ label: 'exam-session' });
const { dispatch } = await import('../src/local/backend.js');
const { dispatchIndiaExam } = await import('../src/local/indiaExamBackend.js');
const { loadAllBanks } = await import('../src/engine/generators/index.js');
const { SUBMIT_GRACE_MS } = await import('../src/local/examSession.js');
const { flushExamCheckpoints } = await import('../src/local/serverExam.js');
const gate = await import('../src/local/entitlementGate.js');
const idb = await import('../src/local/idb.js');
await loadAllBanks();

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (actual, expected, label) => ok(JSON.stringify(actual) === JSON.stringify(expected), `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
async function rejectsWith(promise, code, label) {
  let err = null;
  try { await promise; } catch (e) { err = e; }
  ok(!!err && (err.code === code || err.status === code), `${label} — expected ${code}, got ${err ? `${err.status} ${err.code} ${err.message}` : 'success'}`);
  return err;
}

// A controllable clock. Every backend read of "now" goes through Date.now.
const realNow = Date.now.bind(Date);
let offset = 0;
Date.now = () => realNow() + offset;
const MIN = 60000;

// A real verified account, linked the way the product links one, holding a
// Premium snapshot so the suite can sit more than one paper in 30 days.
async function premium(user) {
  await online.link(user.id, { entitlement: 'premium' });
}

resetStorage();
const student = (await dispatch('POST', '/profiles', { name: 'Chitra', course: 'in', indiaTrack: 'jee-main', year: 12 })).user;
await premium(student);
// The device session is the student's own account for every call below.
const call = (method, path, body = {}) => online.withSessionOf(student.id, () => dispatchIndiaExam(student, method, path, body));
// The oracle: the server's sealed copy of a question on the paper.
const payloadOf = async id => online.answerKey(await idb.get('questions', id));
// "A moment passes with a connection": every pending checkpoint has landed.
const settle = () => online.withSessionOf(student.id, () => flushExamCheckpoints());
const PRIVATE = new Set(['answer', 'steps', 'traps', 'stepcheck', 'seed', 'hints', 'optionTraps', 'correctIndex', 'correctIndices', 'solution', 'solutionText', 'criteria', 'builtFrom']);
const leaks = (value, path = '') => (!value || typeof value !== 'object' ? []
  : Object.entries(value).flatMap(([k, v]) => [...(PRIVATE.has(k) ? [path + k] : []), ...leaks(v, path + k + '.')]));

// ── 0 · a paper is marked work: it starts only signed in and connected ───────
{
  const examsBefore = (await idb.byIndex('exams', 'pid', student.id)).length;
  const usedBefore = (await gate.examAllowance(student)).used;
  const signedOut = await rejectsWith(online.signedOut(() => dispatchIndiaExam(student, 'POST', '/exams', {})), 'SIGN_IN_TO_CHECK', 'a signed-out India student cannot start a paper');
  eq(signedOut?.status, 401, 'and is told to sign in, as a practice check is');
  const offlineErr = await rejectsWith(online.offline(() => call('POST', '/exams', {})), 'RECONNECT_TO_CHECK', 'an India paper cannot start without a connection');
  eq(offlineErr?.status, 503, 'and is told to reconnect');
  const stranger = (await dispatch('POST', '/profiles', { name: 'Unlinked', course: 'in', indiaTrack: 'jee-main', year: 12 })).user;
  await rejectsWith(dispatchIndiaExam(stranger, 'POST', '/exams', {}), 'SIGN_IN_TO_CHECK', 'a profile that has never signed in cannot start a paper');
  await dispatch('POST', '/profiles/select', { id: student.id });
  eq((await idb.byIndex('exams', 'pid', student.id)).length, examsBefore, 'a refused start stores no paper');
  eq((await idb.byIndex('exams', 'pid', stranger.id)).length, 0, 'for either profile');
  eq((await gate.examAllowance(student)).used, usedBefore, 'and spends no exam simulation');
  eq(Number((await online.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE scope='exam-paper'"))?.n || 0), 0, 'and the server issued none');
}

// ── 1 · the deadline is written once, at the start ───────────────────────────
const made = (await call('POST', '/exams', { seed: 4242 })).exam;
const row0 = await idb.get('exams', made.id);
ok(Number.isFinite(row0.startedAt) && Number.isFinite(row0.deadlineAt), 'a new paper stores an absolute start and deadline');
eq(row0.deadlineAt - row0.startedAt, made.durationMin * MIN, 'the deadline is the start plus the paper duration');
eq(made.session.deadlineAt, row0.deadlineAt, 'the room is handed the stored deadline');
ok(made.session.remainingMs > 0 && made.session.remainingMs <= made.durationMin * MIN, 'the room is told how long is left');
eq(made.session.expired, false, 'a new paper is not expired');
ok(/^sv1-[0-9a-f]{24}-25$/.test(row0.paperVersion || ''), `the issued paper carries the server's version of it (${row0.paperVersion})`);
ok(!!row0.server?.examId && row0.server.questionIds.length === 25, 'the paper is the server\'s: the device keeps its exam and question ids');
eq((await online.examPaper(row0)).id, row0.server.examId, 'and the server holds the sealed paper');
{
  const stored = [];
  for (const qid of row0.questionIds) stored.push(await idb.get('questions', qid));
  eq(leaks(stored.map(r => r.payload)), [], 'no answer, step, trap or seed of the paper is stored on the device');
  eq(leaks(made.questions), [], 'and none is handed to the room');
}

const questions = made.questions;
const mcq = questions.filter(q => q.answerType === 'mcq');
const numeric = questions.filter(q => q.answerType !== 'mcq');
ok(mcq.length === 20 && numeric.length === 5, 'the JEE Main paper is 20 MCQ + 5 numerical');

// Correct and wrong MCQ choices, read from the stored payloads (the API never
// hands an answer back mid-paper).
const right = {};
const wrong = {};
for (const q of mcq) {
  const p = await payloadOf(q.id);
  right[q.id] = String(p.answer.correctIndex);
  wrong[q.id] = String((p.answer.correctIndex + 1) % 4);
}

// ── 2 · autosave, including handwriting, comes back on the next read ─────────
const strokes = [
  { points: [{ x: 10.04, y: 20.06, t: 1.0001, w: 3, p: 0.5, azimuth: 1 }, { x: 11, y: 40, t: 1.05 }] },
  { points: [[30, 20], [31, 41]] }
];
const saved = await call('POST', `/exams/${made.id}/responses`, {
  answers: { [mcq[0].id]: right[mcq[0].id], [mcq[1].id]: wrong[mcq[1].id], [numeric[0].id]: '12', 'not-a-question': 'x' },
  workings: { [numeric[0].id]: 'x = 3\n4x = 12' },
  times: { [mcq[0].id]: 42000, 'not-a-question': 5 },
  modes: { [numeric[0].id]: 'ink', [mcq[0].id]: 'pencil' },
  inks: { [numeric[0].id]: { strokes, lines: ['4x = 12', '12'], answerLine: '12', engine: 'pri-js-v3' } },
  cur: 20
});
eq(saved.saved, true, 'an autosave is accepted while the clock runs');
eq(saved.rev, 1, 'the first autosave is revision 1');
eq(await online.examSnapshot(made.id), null, 'the local save does not wait for the server');
await settle();
{
  const snap = await online.examSnapshot(made.id);
  eq([snap?.rev, snap?.answers?.[mcq[0].id], snap?.answers?.[numeric[0].id], snap?.workings?.[numeric[0].id]], [1, right[mcq[0].id], '12', 'x = 3\n4x = 12'],
    'a moment later the server holds the same answers and working');
  ok(!('inks' in snap) && JSON.stringify(snap).length < 2000, 'strokes stay on the device: the checkpoint is text');
  eq((await idb.get('exams', made.id)).server.savedRev, 1, 'and the device knows which revision the server holds');
}

offset += 10 * MIN;   // "the app is relaunched ten minutes later"
const reread = (await call('GET', `/exams/${made.id}`)).exam;
const r = reread.session.responses;
eq(reread.session.deadlineAt, row0.deadlineAt, 'a relaunch reads back the same deadline — a crash is not extra time');
ok(Math.abs(reread.session.remainingMs - (row0.deadlineAt - Date.now())) < 50, 'the time left is measured from the stored deadline');
ok(reread.session.remainingMs <= made.durationMin * MIN - 10 * MIN, 'ten minutes away from the paper cost ten minutes of it');
eq(r.answers, { [mcq[0].id]: right[mcq[0].id], [mcq[1].id]: wrong[mcq[1].id], [numeric[0].id]: '12' }, 'answers come back exactly, and a key for no question on the paper is dropped');
eq(r.workings[numeric[0].id], 'x = 3\n4x = 12', 'working comes back line for line');
eq(r.times, { [mcq[0].id]: 42000 }, 'per-question time comes back');
eq(r.modes, { [numeric[0].id]: 'ink' }, 'the answer mode comes back and only a known mode is kept');
eq(r.cur, 20, 'the question the student was on comes back');
const ink = r.inks[numeric[0].id];
eq(ink?.strokes, [{ points: [[10, 20.1, 1], [11, 40, 1.05]] }, { points: [[30, 20], [31, 41]] }], 'handwriting strokes come back compact: position and time only');
eq(ink?.lines, ['4x = 12', '12'], 'the reader\'s transcription is kept with the strokes');

// A second save replaces answers but merges ink key by key.
await call('POST', `/exams/${made.id}/responses`, {
  answers: { [mcq[0].id]: right[mcq[0].id], [mcq[1].id]: wrong[mcq[1].id], [mcq[2].id]: right[mcq[2].id], [numeric[0].id]: '12' },
  inks: { [numeric[1].id]: { strokes: [{ points: [[1, 2]] }], lines: ['7'], answerLine: '7' } }
});
const r2 = (await call('GET', `/exams/${made.id}`)).exam.session.responses;
eq(r2.rev, 2, 'a second autosave is revision 2');
ok(!!r2.inks[numeric[0].id] && !!r2.inks[numeric[1].id], 'ink is merged per question — saving one question\'s writing keeps the others');
eq(r2.workings[numeric[0].id], 'x = 3\n4x = 12', 'a save that does not carry working keeps the saved working');
await call('POST', `/exams/${made.id}/responses`, { inks: { [numeric[1].id]: { strokes: [], lines: [] } } });
ok(!(await call('GET', `/exams/${made.id}`)).exam.session.responses.inks[numeric[1].id], 'clearing a question\'s writing removes its saved strokes');
await settle();
eq((await online.examSnapshot(made.id))?.rev, 3, 'the server holds the latest revision before the bell');

// ── 3 · nothing saves after the deadline ─────────────────────────────────────
offset += made.durationMin * MIN;   // well past the deadline
const before = JSON.stringify((await idb.get('exams', made.id)).responses);
await rejectsWith(call('POST', `/exams/${made.id}/responses`, { answers: { [mcq[3].id]: right[mcq[3].id] } }), 'EXAM_DEADLINE_PASSED', 'an autosave after the deadline is refused');
eq(JSON.stringify((await idb.get('exams', made.id)).responses), before, 'the refused autosave changed nothing');
const expired = (await call('GET', `/exams/${made.id}`)).exam.session;
eq([expired.expired, expired.remainingMs], [true, 0], 'a relaunch after the deadline is told the paper has expired');

// ── 4 · a late submit marks only what was saved before the deadline ─────────
const attemptsBefore = (await idb.byIndex('attempts', 'pid', student.id)).length;
const everythingRight = Object.fromEntries(mcq.map(q => [q.id, right[q.id]]));
const late = await call('POST', `/exams/${made.id}/submit`, { answers: everythingRight, ms: 1000, submissionKey: 'sub-late-1' });
const given = Object.fromEntries(late.detail.filter(d => !d.unanswered).map(d => [d.id, d.given]));
eq(given[mcq[0].id], right[mcq[0].id], 'the saved right answer is marked');
eq(given[mcq[1].id], wrong[mcq[1].id], 'the saved wrong answer is marked as saved — the late request cannot correct it');
ok(!given[mcq[5].id], 'a question answered only in the late request stays unattempted');
eq(late.final.late, true, 'the result records that it was finalised late');
eq(late.final.finalisedBy, 'deadline', 'a late paper is finalised by the deadline, not the student');
const d0 = late.detail.find(d => d.id === mcq[0].id);
const d1 = late.detail.find(d => d.id === mcq[1].id);
eq([d0.awarded, d1.awarded], [4, -1], 'JEE Main marks the saved answers +4 / −1');
eq(d0.timed, true, 'a question with measured time is marked as timed');
const row1 = await idb.get('exams', made.id);
eq(row1.final.inputSource, 'server-snapshot-before-deadline', 'the frozen record names where its inputs came from: the server\'s own snapshot');
eq([row1.final.markedBy, late.markedBy], ['server', 'server'], 'the paper is marked by the server');
{
  const stored = await online.examResult(made.id);
  eq([stored.score, stored.total, stored.late], [late.score, late.total, true], 'the score shown is the server\'s stored result');
  eq(late.detail.map(d => d.awarded), stored.detail.map(d => d.awarded), 'question by question');
}
eq(row1.final.responses.answers, r2.answers, 'finalisation freezes exactly the responses it marked');
eq(row1.final.paperVersion, row0.paperVersion, 'finalisation freezes the paper version, and it is the version that was composed');
eq(row1.final.paperVersionChanged, false, 'the paper did not change between start and finalisation');
ok(row1.responses === undefined, 'the draft responses are gone once the paper is frozen');
ok(!!row1.final.inks[numeric[0].id]?.strokes?.length, 'the handwriting is frozen with the paper for review');
ok(late.analysis?.pattern === 'jee-main', 'the result carries the JEE Main section analysis');
const negatives = late.detail.reduce((n, d) => n + Math.max(0, -d.awarded), 0);
ok(negatives >= 1, 'the saved wrong answer cost a negative mark');
eq(late.analysis?.negativeMarking?.marksLost, negatives, 'the analysis counts every negative mark the paper took');
eq(late.analysis?.totals?.awarded, late.score, 'the analysis net is the paper score');

// ── 5 · finalisation is idempotent ───────────────────────────────────────────
const attemptsAfter = (await idb.byIndex('attempts', 'pid', student.id)).length;
const replay = await call('POST', `/exams/${made.id}/submit`, { answers: everythingRight, submissionKey: 'sub-late-1' });
eq(replay.replayed, true, 'the same submission replayed returns the frozen result');
eq([replay.score, replay.total], [late.score, late.total], 'the replay reports the same score');
eq((await idb.byIndex('attempts', 'pid', student.id)).length, attemptsAfter, 'a replay records no new learning evidence');
ok(attemptsAfter > attemptsBefore, 'the first finalisation did record evidence');
await rejectsWith(call('POST', `/exams/${made.id}/submit`, { answers: everythingRight, submissionKey: 'another' }), 'INDIA_EXAM_ALREADY_SUBMITTED', 'a different submission of a finalised paper is refused');
await rejectsWith(call('POST', `/exams/${made.id}/submit`, { answers: everythingRight }), 'INDIA_EXAM_ALREADY_SUBMITTED', 'a keyless resubmission is refused');
await rejectsWith(call('POST', `/exams/${made.id}/responses`, { answers: everythingRight }), 'INDIA_EXAM_ALREADY_SUBMITTED', 'an autosave to a finalised paper is refused');
eq((await idb.get('exams', made.id)).score, late.score, 'nothing after finalisation changed the score');
const finalView = (await call('GET', `/exams/${made.id}`)).exam;
eq([finalView.session.finalised, finalView.session.responses], [true, null], 'a finalised paper reads back as finalised, with no editable draft');
ok(finalView.analysis?.pattern === 'jee-main', 'the analysis is available when the finalised paper is reopened');

// ── 6 · inside the deadline, the submission's own answers stand ──────────────
offset = 0;
const second = (await call('POST', '/exams', { seed: 777 })).exam;
const mcq2 = second.questions.filter(q => q.answerType === 'mcq');
const right2 = {};
for (const q of mcq2) right2[q.id] = String((await payloadOf(q.id)).answer.correctIndex);
await call('POST', `/exams/${second.id}/responses`, { answers: { [mcq2[0].id]: String((Number(right2[mcq2[0].id]) + 1) % 4) } });
offset = second.durationMin * MIN - MIN;
const onTime = await call('POST', `/exams/${second.id}/submit`, {
  answers: { [mcq2[0].id]: right2[mcq2[0].id], [mcq2[1].id]: right2[mcq2[1].id] },
  times: { [mcq2[0].id]: 30000, [mcq2[1].id]: 20000 }, ms: 50000, submissionKey: 'on-time'
});
eq(onTime.score, 8, 'a submit inside the deadline marks the answers it carries (two right = 8)');
eq([onTime.final.late, onTime.final.finalisedBy], [false, 'student'], 'an on-time submit is the student\'s');

// The clock's own submit at the deadline, inside the grace window.
offset = 0;
const third = (await call('POST', '/exams', { seed: 778 })).exam;
const mcq3 = third.questions.filter(q => q.answerType === 'mcq');
const a3 = String((await payloadOf(mcq3[0].id)).answer.correctIndex);
offset = third.durationMin * MIN + SUBMIT_GRACE_MS - 1000;
const graced = await call('POST', `/exams/${third.id}/submit`, { answers: { [mcq3[0].id]: a3 }, reason: 'deadline', submissionKey: 'clock' });
eq([graced.score, graced.final.finalisedBy, graced.final.late], [4, 'deadline', false], 'the deadline\'s own submit, landing inside the grace window, marks what it carries');

offset = 0;
const fourth = (await call('POST', '/exams', { seed: 779 })).exam;
const mcq4 = fourth.questions.filter(q => q.answerType === 'mcq');
const a4 = String((await payloadOf(mcq4[0].id)).answer.correctIndex);
offset = fourth.durationMin * MIN + SUBMIT_GRACE_MS + 1000;
const tooLate = await call('POST', `/exams/${fourth.id}/submit`, { answers: { [mcq4[0].id]: a4 } });
eq([tooLate.score, tooLate.final.late], [0, true], 'a submit after the grace window cannot add an answer that was never saved');

// ── 7 · a paper stored before the clock existed gets the conservative one ────
offset = 0;
const fifth = (await call('POST', '/exams', { seed: 780 })).exam;
const legacyRow = await idb.get('exams', fifth.id);
delete legacyRow.startedAt; delete legacyRow.deadlineAt;
legacyRow.createdAt -= 30 * MIN;
await idb.put('exams', legacyRow);
const migrated = (await call('GET', `/exams/${fifth.id}`)).exam.session;
eq(migrated.deadlineAt, legacyRow.createdAt + fifth.durationMin * MIN, 'an older paper\'s deadline is taken from when it was created');
eq((await idb.get('exams', fifth.id)).deadlineAt, migrated.deadlineAt, 'and that deadline is stored, so it never moves again');

// ── 8 · an autosave racing the final submit cannot un-finalise the paper ─────
const sixth = (await call('POST', '/exams', { seed: 781 })).exam;
const q6 = sixth.questions[0].id;
// One session for the three racing requests (the pin is not re-entrant).
const raw = (method, path, body = {}) => dispatchIndiaExam(student, method, path, body);
const [raceSave, raceSubmit] = await online.withSessionOf(student.id, () => Promise.allSettled([
  raw('POST', `/exams/${sixth.id}/responses`, { answers: { [q6]: '0' } }),
  raw('POST', `/exams/${sixth.id}/submit`, { answers: { [q6]: '0' }, submissionKey: 'race' }),
  raw('POST', `/exams/${sixth.id}/responses`, { answers: { [q6]: '1' } })
])).then(rs => [rs[2], rs[1]]);
eq(raceSubmit.status, 'fulfilled', 'the racing submit finalises the paper');
eq(raceSave.status, 'rejected', 'the autosave queued behind the submit is refused');
const raced = await idb.get('exams', sixth.id);
ok(!!raced.finishedAt && raced.responses === undefined && raced.final?.responses?.answers?.[q6] === '0', 'the finalised paper survives the race intact');

// ── 9 · the legacy practice paper keeps the same rules ───────────────────────
offset = 0;
const ada = (await dispatch('POST', '/profiles', { name: 'Ada', year: 9 })).user;
await premium(ada);
const paper = (await dispatch('POST', '/exams', { length: 10, minutes: 15 })).exam;
eq(paper.session.deadlineAt - paper.session.startedAt, 15 * MIN, 'a legacy paper gets the same absolute deadline');
const first = paper.questions.find(q => !q.multipart);
await dispatch('POST', `/exams/${paper.id}/responses`, { answers: { [first.id]: 'saved-answer' } });
eq((await dispatch('GET', `/exams/${paper.id}`)).exam.session.responses.answers[first.id], 'saved-answer', 'a legacy paper autosaves and reads back');
await flushExamCheckpoints();
offset = 16 * MIN + 2 * MIN;
await rejectsWith(dispatch('POST', `/exams/${paper.id}/responses`, { answers: {} }), 'EXAM_DEADLINE_PASSED', 'a legacy paper refuses an autosave after its deadline');
const legacyLate = await dispatch('POST', `/exams/${paper.id}/submit`, { answers: { [first.id]: 'late-answer' }, submissionKey: 'legacy' });
eq(legacyLate.detail.find(d => d.id === first.id)?.given, 'saved-answer', 'a late legacy submit marks the saved answer, not the late one');
eq((await dispatch('POST', `/exams/${paper.id}/submit`, { submissionKey: 'legacy' })).replayed, true, 'a legacy replay returns the frozen result');
await rejectsWith(dispatch('POST', `/exams/${paper.id}/submit`, {}), 409, 'a legacy resubmission is still refused');

await dispatch('POST', '/profiles/select', { id: student.id });

// ── 10 · winding the device clock back buys nothing ─────────────────────────
// A paper's clock only moves forward: every read, save and submit records the
// latest time seen, and an earlier "now" is read as that time.
offset = 0;
const rb = (await call('POST', '/exams', { seed: 990 })).exam;
const rbMcq = rb.questions.filter(q => q.answerType === 'mcq');
const rbRight = String((await payloadOf(rbMcq[0].id)).answer.correctIndex);
const rbWrong = String((Number(rbRight) + 1) % 4);
await call('POST', `/exams/${rb.id}/responses`, { answers: { [rbMcq[0].id]: rbWrong } });
await settle();

// (a) halfway through, the clock is wound back 25 minutes: no time is gained
offset = 30 * MIN;
const mid = (await call('GET', `/exams/${rb.id}`)).exam.session;
offset = 5 * MIN;
const wound = (await call('GET', `/exams/${rb.id}`)).exam.session;
ok(wound.remainingMs <= mid.remainingMs, `a clock wound back mid-paper adds no time (${mid.remainingMs} ms before, ${wound.remainingMs} ms after)`);
eq(wound.now, mid.now, 'the paper reads a wound-back clock as the latest time it has seen');

// (b) past the deadline, then wound back to before it: still expired
offset = rb.durationMin * MIN + 2 * MIN;
const expiredRb = (await call('GET', `/exams/${rb.id}`)).exam.session;
eq(expiredRb.expired, true, 'the paper expires once its deadline is seen');
offset = 10 * MIN;   // the clock is wound back to well inside the hour
const reopened = (await call('GET', `/exams/${rb.id}`)).exam.session;
eq([reopened.expired, reopened.remainingMs], [true, 0], 'winding the clock back does not reopen an expired paper');
await rejectsWith(call('POST', `/exams/${rb.id}/responses`, { answers: { [rbMcq[0].id]: rbRight } }), 'EXAM_DEADLINE_PASSED', 'an autosave under a wound-back clock is still refused');
eq((await idb.get('exams', rb.id)).responses.answers[rbMcq[0].id], rbWrong, 'the refused autosave left the saved answer as it was');

// (c) an "on-time" submit under the wound-back clock is not taken as new answers
const rbMarked = await call('POST', `/exams/${rb.id}/submit`, { answers: { [rbMcq[0].id]: rbRight }, submissionKey: 'rollback' });
eq(rbMarked.detail.find(d => d.id === rbMcq[0].id)?.given, rbWrong, 'a submit under a wound-back clock marks the answer saved before the deadline, not the new one');
eq([rbMarked.final.late, rbMarked.final.finalisedBy], [true, 'deadline'], 'and it is recorded as finalised late, by the deadline');
const rbRow = await idb.get('exams', rb.id);
ok(rbRow.final.clockRolledBack === true && rbRow.clockRollbacks >= 1, 'the frozen record notes that the clock was wound back');
ok(rbRow.finishedAt >= rbRow.deadlineAt, 'the finalisation time is never earlier than a time the paper had already seen');

// ── 11 · real time after a rollback still counts toward the deadline ────────
// Saved at +50 min; the device clock is then wound back 30 min and the paper is
// NOT reloaded. The room's 30-second heartbeat save is the first thing to see
// the wound-back clock. Real time carries on: at real +55 (device +25) five
// minutes are left, not thirty-five; at real +88 (device +58) the paper is past
// its real deadline, so the autosave is refused and the submit marks only saved
// work. (Time between the last observation and the rollback cannot be seen by
// anyone; the heartbeat bounds it to 30 seconds.)
offset = 0;
const rt = (await call('POST', '/exams', { seed: 991 })).exam;
const rtMcq = rt.questions.filter(q => q.answerType === 'mcq');
const rtRight = String((await payloadOf(rtMcq[0].id)).answer.correctIndex);
const rtWrong = String((Number(rtRight) + 1) % 4);
offset = 50 * MIN;
const atFifty = await call('POST', `/exams/${rt.id}/responses`, { answers: { [rtMcq[0].id]: rtWrong } });
eq(atFifty.now - (await idb.get('exams', rt.id)).startedAt >= 50 * MIN, true, 'a save reports the paper\'s own time');
const WOUND = -30 * MIN;          // device reads 30 minutes earlier than real time from here on
offset = 50 * MIN + WOUND;        // the heartbeat, just after the rollback: real +50, device +20
await call('POST', `/exams/${rt.id}/responses`, { answers: { [rtMcq[0].id]: rtWrong } });
offset = 50 * MIN + WOUND + 5 * MIN;   // real +55, device +25
const afterWind = await call('POST', `/exams/${rt.id}/responses`, { answers: { [rtMcq[0].id]: rtWrong } });
await settle();
const leftAfterWind = (await idb.get('exams', rt.id)).deadlineAt - afterWind.now;
ok(Math.abs(leftAfterWind - 5 * MIN) < 1000, `five real minutes after a 30-minute rollback, five minutes are left — not thirty-five (${Math.round(leftAfterWind / 1000)} s left)`);
ok(afterWind.now - Date.now() >= 30 * MIN - 1000, 'the save tells the room how far its clock is behind the paper');
const viewAfterWind = (await call('GET', `/exams/${rt.id}`)).exam.session;
ok(viewAfterWind.remainingMs <= 5 * MIN && viewAfterWind.remainingMs > 4 * MIN, `the paper view reports the real time left (${Math.round(viewAfterWind.remainingMs / 1000)} s)`);
offset = 88 * MIN + WOUND;   // real +88, device +58 — before the deadline by the device clock alone
await rejectsWith(call('POST', `/exams/${rt.id}/responses`, { answers: { [rtMcq[0].id]: rtRight } }), 'EXAM_DEADLINE_PASSED', 'an autosave after the real deadline is refused even though the wound-back device clock reads +58 min');
const rtView = (await call('GET', `/exams/${rt.id}`)).exam.session;
eq([rtView.expired, rtView.remainingMs], [true, 0], 'the paper reads as expired at the real deadline without a reload');
const rtMarked = await call('POST', `/exams/${rt.id}/submit`, { answers: { [rtMcq[0].id]: rtRight }, submissionKey: 'real-time' });
eq(rtMarked.detail.find(d => d.id === rtMcq[0].id)?.given, rtWrong, 'the submit after the real deadline marks only the saved answer');
eq([rtMarked.final.late, rtMarked.final.finalisedBy], [true, 'deadline'], 'and it is recorded as late, finalised by the deadline');
const rtRow = await idb.get('exams', rt.id);
ok(rtRow.clockOffsetMs >= 30 * MIN - 1000 && rtRow.final.clockRolledBack === true, `the forward-only correction equals the rollback (${Math.round((rtRow.clockOffsetMs || 0) / 1000)} s) and is recorded`);
ok(rtRow.finishedAt >= rtRow.deadlineAt + 27 * MIN, 'the finalisation time is the paper\'s real time, not the wound-back device time');

// ── 12 · a dropped connection never costs typed work; a failed checkpoint is retried
offset = 0;
await dispatch('POST', '/profiles/select', { id: student.id });
const dc = (await call('POST', '/exams', { seed: 1201 })).exam;
const dcMcq = dc.questions.filter(q => q.answerType === 'mcq');
const dcRight = {};
for (const q of dcMcq) dcRight[q.id] = String((await payloadOf(q.id)).answer.correctIndex);
await call('POST', `/exams/${dc.id}/responses`, { answers: { [dcMcq[0].id]: dcRight[dcMcq[0].id] } });
await settle();
eq((await online.examSnapshot(dc.id))?.rev, 1, 'online, the first answer is checkpointed');
online.setOffline(true);
const offSave = await call('POST', `/exams/${dc.id}/responses`, { answers: { [dcMcq[0].id]: dcRight[dcMcq[0].id], [dcMcq[1].id]: dcRight[dcMcq[1].id] } });
eq([offSave.saved, offSave.rev], [true, 2], 'with the connection gone the autosave still succeeds on the device');
await settle();
eq((await online.examSnapshot(dc.id))?.rev, 1, 'the server still holds the earlier checkpoint');
eq((await idb.get('exams', dc.id)).server.savedRev, 1, 'and the device knows its newer answers are not there yet');
eq((await call('GET', `/exams/${dc.id}`)).exam.session.responses.answers[dcMcq[1].id], dcRight[dcMcq[1].id], 'the paper reopens offline with everything typed');
online.setOffline(false);
await settle();
eq([(await online.examSnapshot(dc.id))?.rev, (await online.examSnapshot(dc.id))?.answers?.[dcMcq[1].id]], [2, dcRight[dcMcq[1].id]], 'back online the failed checkpoint is retried and lands');

// ── 13 · finishing with no connection queues the finish; nothing is marked yet
const attemptsPre = (await idb.byIndex('attempts', 'pid', student.id)).length;
const queued = await online.offline(() => call('POST', `/exams/${dc.id}/submit`, {
  answers: { [dcMcq[0].id]: dcRight[dcMcq[0].id], [dcMcq[1].id]: dcRight[dcMcq[1].id], [dcMcq[2].id]: dcRight[dcMcq[2].id] }, submissionKey: 'queued-finish-0001'
}));
eq([queued.pending, queued.code, queued.reason], [true, 'EXAM_FINISH_QUEUED', 'offline'], 'an offline finish is queued, and says so');
eq([queued.score, queued.detail], [null, null], 'no score and no marked detail exist for a queued paper');
ok(/not marked yet/i.test(queued.message) && /back online/i.test(queued.message), `it says plainly the paper is not marked yet (${queued.message})`);
const queuedRow = await idb.get('exams', dc.id);
eq([queuedRow.finishedAt, queuedRow.score, queuedRow.detail], [null, null, null], 'the stored paper is unfinished and unscored');
ok(!!queuedRow.pendingFinish?.submissionKey, 'and holds the queued submission');
eq(await online.examResult(dc.id), null, 'the server has marked nothing');
eq((await idb.byIndex('attempts', 'pid', student.id)).length, attemptsPre, 'no learning evidence is recorded for an unmarked paper');
await rejectsWith(call('POST', `/exams/${dc.id}/responses`, { answers: { [dcMcq[3].id]: dcRight[dcMcq[3].id] } }), 'EXAM_SUBMITTED_PENDING', 'a submitted paper waiting to be marked can no longer change');
const stillOff = (await online.offline(() => call('GET', `/exams/${dc.id}`))).exam;
eq([stillOff.finishedAt, stillOff.score, stillOff.session.pending?.code, stillOff.markedBy], [null, null, 'EXAM_FINISH_QUEUED', null], 'reopened offline it is still waiting, with no score');
const listedPending = (await call('GET', '/exams')).exams.find(e => e.id === dc.id);
eq([listedPending.pending, listedPending.finished_at, listedPending.score], [true, null, null], 'the list shows it as waiting, not as marked');
const resubmit = await online.offline(() => call('POST', `/exams/${dc.id}/submit`, { answers: { [dcMcq[4].id]: dcRight[dcMcq[4].id] }, submissionKey: 'another-key-0002' }));
eq([resubmit.pending, (await idb.get('exams', dc.id)).pendingFinish.submissionKey], [true, 'queued-finish-0001'], 'submitting again while queued changes nothing about what was submitted');
// Back online: opening the paper sends the queued finish and shows the server's result.
const settled = (await call('GET', `/exams/${dc.id}`)).exam;
eq([settled.score, settled.markedBy, settled.session.pending, settled.session.finalised], [12, 'server', null, true], 'back online the queued finish is marked by the server: three right = 12');
eq((await online.examResult(dc.id))?.score, 12, 'the score shown is the server\'s stored result');
eq(settled.detail.filter(d => !d.unanswered).map(d => d.id).sort(), [dcMcq[0].id, dcMcq[1].id, dcMcq[2].id].sort(), 'what was submitted is what was marked');
ok((await idb.byIndex('attempts', 'pid', student.id)).length === attemptsPre + 3, 'and the evidence is recorded once the server has marked it');
eq((await call('POST', `/exams/${dc.id}/submit`, { submissionKey: 'queued-finish-0001' })).replayed, true, 'the room\'s own retry of that submission is a replay');
eq(Number((await online.db.get("SELECT COUNT(*) AS n FROM learning_events WHERE kind='exam-attempt' AND entity_id=?", [queuedRow.server.examId]))?.n), 1, 'the server finalised it exactly once');

// ── 14 · offline at the bell: the last checkpoint is marked, nothing after it ─
offset = 0;
const bell = (await call('POST', '/exams', { seed: 1401 })).exam;
const bellMcq = bell.questions.filter(q => q.answerType === 'mcq');
const bellRight = {};
for (const q of bellMcq) bellRight[q.id] = String((await payloadOf(q.id)).answer.correctIndex);
await call('POST', `/exams/${bell.id}/responses`, { answers: { [bellMcq[0].id]: bellRight[bellMcq[0].id] } });
await settle();
online.setOffline(true);
await call('POST', `/exams/${bell.id}/responses`, { answers: { [bellMcq[0].id]: bellRight[bellMcq[0].id], [bellMcq[1].id]: bellRight[bellMcq[1].id] } });
const bellQueued = await call('POST', `/exams/${bell.id}/submit`, { answers: { [bellMcq[0].id]: bellRight[bellMcq[0].id], [bellMcq[1].id]: bellRight[bellMcq[1].id] }, reason: 'student', submissionKey: 'bell-finish-0001' });
eq(bellQueued.pending, true, 'offline before the bell, the finish is queued');
ok(/answers last saved to the server/i.test(bellQueued.message), 'and the student is told which answers count if they reconnect after time');
offset = bell.durationMin * MIN + 5 * MIN;   // the bell rings, and the server's grace passes, with no connection
online.setOffline(false);
const bellDone = (await call('GET', `/exams/${bell.id}`)).exam;
eq([bellDone.score, bellDone.session.final.late, bellDone.session.final.finalisedBy], [4, true, 'deadline'], 'reconnecting after time marks the last checkpoint only, and flags the paper late');
eq(bellDone.detail.filter(d => !d.unanswered).map(d => d.id), [bellMcq[0].id], 'the answer that never reached the server before the bell is not marked');
eq((await idb.get('exams', bell.id)).final.inputSource, 'server-snapshot-before-deadline', 'the record says the server\'s snapshot was marked');
eq((await idb.get('exams', bell.id)).final.responses.answers, { [bellMcq[0].id]: bellRight[bellMcq[0].id] }, 'and freezes exactly what was marked');

// ── 15 · a paper carried further, or finished, on another device ────────────
offset = 0;
const two = (await call('POST', '/exams', { seed: 1501 })).exam;
const twoMcq = two.questions.filter(q => q.answerType === 'mcq');
const twoRight = {};
for (const q of twoMcq) twoRight[q.id] = String((await payloadOf(q.id)).answer.correctIndex);
await call('POST', `/exams/${two.id}/responses`, { answers: { [twoMcq[0].id]: twoRight[twoMcq[0].id] } });
await settle();
const twoRow = await idb.get('exams', two.id);
const jar = online.accountOf(student.id).jar;
// "The other device": the same account, straight to the server.
const otherSave = await online.app.request(`/v1/exams/${twoRow.server.examId}/answers`, { method: 'PATCH', jar, body: {
  answers: { [twoMcq[0].id]: twoRight[twoMcq[0].id], [twoMcq[1].id]: twoRight[twoMcq[1].id] }, cur: 1, rev: 7 } });
eq([otherSave.status, otherSave.data.saved], [200, true], 'another device checkpoints further answers');
await new Promise(resolve => setTimeout(resolve, 3100));   // past the reconcile throttle
const carried = (await call('GET', `/exams/${two.id}`)).exam.session.responses;
eq([carried.rev, carried.answers[twoMcq[1].id], carried.cur], [7, twoRight[twoMcq[1].id], 1], 'reopening here adopts the newer snapshot from the server');
const otherFinish = await online.app.request(`/v1/exams/${twoRow.server.examId}/finish`, { method: 'POST', jar, body: {
  answers: { [twoMcq[0].id]: twoRight[twoMcq[0].id], [twoMcq[1].id]: twoRight[twoMcq[1].id], [twoMcq[2].id]: twoRight[twoMcq[2].id] } } });
eq(otherFinish.status, 200, 'the other device finishes the paper');
await new Promise(resolve => setTimeout(resolve, 3100));
const adopted = (await call('GET', `/exams/${two.id}`)).exam;
eq([adopted.score, adopted.markedBy, adopted.session.finalised], [12, 'server', true], 'reopening here shows the server\'s result, not a second marking');
await rejectsWith(call('POST', `/exams/${two.id}/submit`, { answers: {}, submissionKey: 'second-device-01' }), 'INDIA_EXAM_ALREADY_SUBMITTED', 'and the paper cannot be submitted again from here');
eq(Number((await online.db.get("SELECT COUNT(*) AS n FROM learning_events WHERE kind='exam-attempt' AND entity_id=?", [twoRow.server.examId]))?.n), 1, 'it was finalised once');

// ── 16 · a session that lapsed mid-paper: the finish waits for sign-in ──────
const lapsed = (await call('POST', '/exams', { seed: 1601 })).exam;
const lapsedQ = lapsed.questions.find(q => q.answerType === 'mcq');
const lapsedRight = String((await payloadOf(lapsedQ.id)).answer.correctIndex);
const signedOutFinish = await online.signedOut(() => dispatchIndiaExam(student, 'POST', `/exams/${lapsed.id}/submit`, { answers: { [lapsedQ.id]: lapsedRight }, submissionKey: 'lapsed-finish-001' }));
eq([signedOutFinish.pending, signedOutFinish.reason, signedOutFinish.score], [true, 'sign-in', null], 'signed out at the finish, the paper waits to be marked and shows no score');
eq((await call('GET', `/exams/${lapsed.id}`)).exam.score, 4, 'signed in again, the server marks what was submitted');

// ── 17 · papers from an earlier version of the app ──────────────────────────
// A paper an earlier version MARKED on the device opens in review, says who
// marked it, and is never presented as the server's. One it left unfinished
// holds its answers on the device and cannot be marked at all.
{
  const now = Date.now();
  const oldQ = { id: 'legacy-q-1', pid: student.id, subtopic: 'c12-matrices', difficulty: 2, mode: 'exam', examId: 'legacy-exam-1', answered: 1, tries: 0, hintsUsed: 0, createdAt: now - 86400000,
    india: { chapterId: null, track: 'jee-main', dotpointIndex: null }, indiaExamSection: 'A', indiaExamSectionLabel: 'Section A', indiaExamItem: 'mcq', examOrder: 1,
    examMarking: { correct: 4, incorrect: -1, unanswered: 0 },
    payload: { prompt: 'Legacy question', answerType: 'mcq', mcqOptions: ['1', '2', '3', '4'], answer: { correctIndex: 2 }, steps: [{ h: 'Step', d: 'Detail' }], subtopic: 'c12-matrices', difficulty: 2 } };
  await idb.put('questions', oldQ);
  const indiaExam = (await idb.get('exams', made.id)).indiaExam;
  await idb.put('exams', { id: 'legacy-exam-1', pid: student.id, year: 12, title: 'JEE Main · earlier version', durationMin: 60, questionIds: ['legacy-q-1'],
    createdAt: now - 86400000, startedAt: now - 86400000, deadlineAt: now - 86400000 + 3600000, finishedAt: now - 86000000, score: 4, total: 4, indiaExam,
    detail: [{ id: 'legacy-q-1', order: 1, section: 'A', sectionLabel: 'Section A', prompt: 'Legacy question', answerType: 'mcq', mcqOptions: ['1', '2', '3', '4'], given: '2', correct: true, unanswered: false, marks: 4, negativeMarks: 1, awarded: 4, ms: 1000, difficulty: 2, subtopicName: 'Matrices', solution: { steps: [{ h: 'Step', d: 'Detail' }], answerText: '3', criteria: [] } }],
    summary: { sections: [], chapters: [], negativeMarks: 0, totalMs: 1000, markingSchemes: {} },
    final: { submittedAt: now - 86000000, finalisedBy: 'student', late: false, paperVersion: 'pv1-00000000-1', responses: { answers: { 'legacy-q-1': '2' }, workings: {}, times: {} }, inks: {} } });
  const legacyView = (await call('GET', '/exams/legacy-exam-1')).exam;
  eq([legacyView.score, legacyView.markedBy, legacyView.serverIssued, legacyView.detail.length], [4, 'earlier-version', false, 1], 'a paper marked by an earlier version still opens in review, labelled as such');
  eq((await call('GET', '/exams')).exams.find(e => e.id === 'legacy-exam-1').marked_by, 'earlier-version', 'the list says who marked it');
  eq((await call('GET', '/exams/legacy-exam-1/paper')).markedBy, 'earlier-version', 'and so does its printable paper');
  eq((await call('GET', `/exams/${made.id}`)).exam.markedBy, 'server', 'a paper the server marked says so');

  await idb.put('questions', { ...oldQ, id: 'legacy-q-2', examId: 'legacy-exam-2', answered: 0 });
  await idb.put('exams', { id: 'legacy-exam-2', pid: student.id, year: 12, title: 'JEE Main · unfinished earlier version', durationMin: 60, questionIds: ['legacy-q-2'],
    createdAt: now, startedAt: now, deadlineAt: now + 3600000, finishedAt: null, score: null, total: 4, detail: null, indiaExam });
  const unfinished = (await call('GET', '/exams/legacy-exam-2')).exam;
  eq([unfinished.questions.length, unfinished.serverIssued, leaks(unfinished.questions)], [1, false, []], 'an unfinished earlier-version paper still opens, without its answers');
  const refusedLegacy = await rejectsWith(call('POST', '/exams/legacy-exam-2/submit', { answers: { 'legacy-q-2': '2' } }), 'EXAM_NOT_SERVER_ISSUED', 'but it cannot be marked on the device');
  ok(/earlier version/i.test(refusedLegacy?.message || ''), 'and the student is told why');
  const after = await idb.get('exams', 'legacy-exam-2');
  eq([after.finishedAt, after.score, after.detail], [null, null, null], 'no device mark was produced for it');
}

Date.now = realNow;
await online.close();
console.log(failures.length
  ? `EXAM SESSION: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `EXAM SESSION: PASS — ${pass}/${pass} checks — the server issues and marks every paper: absolute deadline, autosave with handwriting checkpointed to the server, no writes after time or finalisation, late and offline finishes mark only saved work, idempotent frozen finalisation, earlier-version papers never certified.`);
process.exit(failures.length ? 1 : 0);
