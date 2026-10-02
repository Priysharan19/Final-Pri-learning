// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Exam session contract — the clock, the autosave and the
// finalised paper (doc §15).
//
// Drives the real local exam backends (local/indiaExamBackend.js for a JEE Main
// paper, local/backend.js for the legacy practice paper) with a controllable
// clock, and pins what a timed paper promises a student:
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
//   · an autosave racing the final submit can never un-finalise the paper.
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
const { dispatch } = await import('../src/local/backend.js');
const { dispatchIndiaExam } = await import('../src/local/indiaExamBackend.js');
const { loadAllBanks } = await import('../src/engine/generators/index.js');
const { SUBMIT_GRACE_MS } = await import('../src/local/examSession.js');
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

async function premium(user) {
  const { cloudLinkRowId } = await import('../src/platform/cloudAccount.js');
  const now = Date.now();
  await idb.put('device', {
    id: cloudLinkRowId(user.id), accountId: `acct-${user.id}`, role: 'student',
    emailVerified: true, linkedAt: now, lastVerifiedAt: now, lastSyncAt: null,
    entitlement: { plan: 'premium', status: 'active', provider: 'web', currentPeriodEnd: now + 30 * 86400000, offlineUntil: now + 7 * 86400000, issuedAt: now, sourceVersion: 1 }
  });
}

resetStorage();
const student = (await dispatch('POST', '/profiles', { name: 'Chitra', course: 'in', indiaTrack: 'jee-main', year: 12 })).user;
await premium(student);
const call = (method, path, body = {}) => dispatchIndiaExam(student, method, path, body);
const payloadOf = async id => (await idb.get('questions', id))?.payload;

// ── 1 · the deadline is written once, at the start ───────────────────────────
const made = (await call('POST', '/exams', { seed: 4242 })).exam;
const row0 = await idb.get('exams', made.id);
ok(Number.isFinite(row0.startedAt) && Number.isFinite(row0.deadlineAt), 'a new paper stores an absolute start and deadline');
eq(row0.deadlineAt - row0.startedAt, made.durationMin * MIN, 'the deadline is the start plus the paper duration');
eq(made.session.deadlineAt, row0.deadlineAt, 'the room is handed the stored deadline');
ok(made.session.remainingMs > 0 && made.session.remainingMs <= made.durationMin * MIN, 'the room is told how long is left');
eq(made.session.expired, false, 'a new paper is not expired');
ok(/^pv1-[0-9a-f]{8}-25$/.test(row0.paperVersion || ''), `the composed paper is fingerprinted (${row0.paperVersion})`);

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
eq(row1.final.inputSource, 'autosave-before-deadline', 'the frozen record names where its inputs came from');
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
const [raceSave, raceSubmit] = await Promise.allSettled([
  call('POST', `/exams/${sixth.id}/responses`, { answers: { [q6]: '0' } }),
  call('POST', `/exams/${sixth.id}/submit`, { answers: { [q6]: '0' }, submissionKey: 'race' }),
  call('POST', `/exams/${sixth.id}/responses`, { answers: { [q6]: '1' } })
]).then(rs => [rs[2], rs[1]]);
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
offset = 16 * MIN;
await rejectsWith(dispatch('POST', `/exams/${paper.id}/responses`, { answers: {} }), 'EXAM_DEADLINE_PASSED', 'a legacy paper refuses an autosave after its deadline');
const legacyLate = await dispatch('POST', `/exams/${paper.id}/submit`, { answers: { [first.id]: 'late-answer' }, submissionKey: 'legacy' });
eq(legacyLate.detail.find(d => d.id === first.id)?.given, 'saved-answer', 'a late legacy submit marks the saved answer, not the late one');
eq((await dispatch('POST', `/exams/${paper.id}/submit`, { submissionKey: 'legacy' })).replayed, true, 'a legacy replay returns the frozen result');
await rejectsWith(dispatch('POST', `/exams/${paper.id}/submit`, {}), 409, 'a legacy resubmission is still refused');

// ── 10 · winding the device clock back buys nothing ─────────────────────────
// A paper's clock only moves forward: every read, save and submit records the
// latest time seen, and an earlier "now" is read as that time.
offset = 0;
const rb = (await call('POST', '/exams', { seed: 990 })).exam;
const rbMcq = rb.questions.filter(q => q.answerType === 'mcq');
const rbRight = String((await payloadOf(rbMcq[0].id)).answer.correctIndex);
const rbWrong = String((Number(rbRight) + 1) % 4);
await call('POST', `/exams/${rb.id}/responses`, { answers: { [rbMcq[0].id]: rbWrong } });

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

Date.now = realNow;
console.log(failures.length
  ? `EXAM SESSION: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `EXAM SESSION: PASS — ${pass}/${pass} checks — absolute deadline, autosave with handwriting, no writes after time or finalisation, late submits mark only saved work, idempotent frozen finalisation.`);
process.exit(failures.length ? 1 : 0);
