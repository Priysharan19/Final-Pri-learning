// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Exam Desk clock (plan F4a) — client/src/engine/deskClock.js
//
// Every test of prithagoras-web tests/session-core.test.mjs (Priysharan19/
// prithagoras-web 46e1476) ported to the event-log clock, with the same
// numbers, plus the one deliberate change (owner decision F4 Q5: working time
// running out counts overtime and does not close the paper) and the
// server-stamping rules. Deterministic: every time is a fixed number.
//
//   node client/test/desk-clock-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import {
  applyIntent, deriveClock, durationOf, formatClock, paperConfigOf, questionGroups, questionTallies, readEvents, readQuestions, INTENTS
} from '../src/engine/deskClock.js';

let pass = 0;
const failures = [];
const check = (label, fn) => { try { fn(); pass++; } catch (e) { failures.push(`${label}: ${e.message}`); } };

// The real paper, in the prithagoras-web shape and in the library's shape.
const site = {
  id: 'paper-2027', duration: '3 hours', readingMinutes: 10, workingMinutes: 180, questions: 27,
  sections: [{ label: 'Section I', start: 1, end: 10, format: 'Multiple choice' }, { label: 'Section II', start: 11, end: 27, format: 'Extended response' }]
};
const library = {
  id: '2027-mathematics-advanced-assessment-1', title: 'Paper', marks: 100, durationMinutes: 180, readingMinutes: 10, questionCount: 27, updatedAt: 1,
  sections: [{ label: 'Section I', firstQuestion: 1, lastQuestion: 10, kind: 'multiple-choice', marks: 10 }, { label: 'Section II', firstQuestion: 11, lastQuestion: 27, kind: 'extended-response', marks: 90 }]
};
const paper = paperConfigOf(library);
const at = Date.UTC(2026, 10, 12, 11, 0, 0);
/** Apply a sequence of [intent, time, opts] and return the log (asserting each is accepted). */
const run = (steps, p = paper) => steps.reduce((events, [intent, t, opts]) => {
  const out = applyIntent(p, events, intent, t, opts);
  assert.ok(out.events, `${intent} at +${t - at} was refused: ${out.refused}`);
  return out.events;
}, []);

// ── duration and section metadata match the real examination ───────────────
check('duration config', () => {
  assert.deepEqual(durationOf(site), { readingMinutes: 10, workingMinutes: 180 });
  assert.deepEqual(durationOf(library), { readingMinutes: 10, workingMinutes: 180 });
});
check('sections → groups', () => {
  assert.deepEqual(questionGroups(site).map(g => [g.firstQuestion, g.lastQuestion]), [[1, 10], [11, 27]]);
  assert.deepEqual(paper.sections.map(g => [g.label, g.firstQuestion, g.lastQuestion, g.kind, g.marks]),
    [['Section I', 1, 10, 'multiple-choice', 10], ['Section II', 11, 27, 'extended-response', 90]]);
});
check('no sections → one group of all questions', () => assert.equal(questionGroups({ ...site, sections: [] })[0].lastQuestion, 27));
check('overflowing section → one group', () => assert.equal(questionGroups({ ...site, sections: [{ label: 'Broken', start: 1, end: 29 }] }).length, 1));
check('overlapping sections → one group', () => assert.equal(questionGroups({ ...site, sections: [{ start: 1, end: 10 }, { start: 10, end: 27 }] }).length, 1));
check('incomplete sections → one group', () => assert.equal(questionGroups({ ...site, sections: [{ start: 1, end: 10 }] }).length, 1));
check('"2 hours" duration', () => assert.equal(durationOf({ duration: '2 hours', questions: 20 }).workingMinutes, 120));
check('no duration at all → 60 minutes, no reading', () => assert.deepEqual(durationOf({ durationMinutes: null }), { readingMinutes: 0, workingMinutes: 60 }));
check('clamps 1..600 working, 0..90 reading', () => assert.deepEqual(durationOf({ durationMinutes: 5000, readingMinutes: 500 }), { readingMinutes: 90, workingMinutes: 600 }));
check('a paper with no question count cannot be sat', () => assert.equal(paperConfigOf({ ...library, questionCount: null }), null));
check('question count capped at 200', () => assert.equal(paperConfigOf({ ...library, questionCount: 450, sections: [] }).questionCount, 200));
check('the frozen paper carries no score field', () => assert.deepEqual(Object.keys(paper).sort(),
  ['marks', 'questionCount', 'readingMinutes', 'resourceId', 'resourceUpdatedAt', 'sections', 'title', 'workingMinutes']));

// ── reading session keeps exact time and moves to ready ─────────────────────
check('reading: deadline, display, ready', () => {
  const reading = run([['begin-reading', at]]);
  const c0 = deriveClock(paper, reading, at);
  assert.equal(c0.phase, 'reading');
  assert.equal(c0.phaseEndsAt, at + 600_000);
  assert.equal(formatClock(deriveClock(paper, reading, at + 1000).remainingMs), '00:09:59');
  assert.equal(deriveClock(paper, reading, at + 599_999).phase, 'reading');
  const ready = deriveClock(paper, reading, at + 600_000);
  assert.equal(ready.phase, 'ready');
  assert.equal(ready.running, false);
  assert.equal(ready.remainingMs, 10_800_000);
  assert.equal(ready.readingEndedAt, at + 600_000);
  assert.equal(ready.elapsedReadingMs, 600_000);
});
check('reading end is recorded at the moment it was due, before the next intent', () => {
  const events = run([['begin-reading', at], ['begin-working', at + 900_000]]);
  assert.deepEqual(events, [{ t: 'begin-reading', at }, { t: 'reading-ended', at: at + 600_000 }, { t: 'begin-working', at: at + 900_000 }]);
  const c = deriveClock(paper, events, at + 900_000);
  assert.deepEqual([c.phase, c.remainingMs, c.elapsedReadingMs], ['working', 10_800_000, 600_000]);
});
check('working time never starts by itself from ready', () => assert.equal(deriveClock(paper, run([['begin-reading', at]]), at + 5 * 3_600_000).phase, 'ready'));

// ── working session pause, resume, finish, no accidental restart ────────────
check('working: pause, resume, finish', () => {
  const work = run([['begin-working', at]]);
  assert.equal(deriveClock(paper, work, at).phaseEndsAt, at + 10_800_000);
  const paused = run([['begin-working', at], ['pause', at + 30_000]]);
  const p = deriveClock(paper, paused, at + 30_000);
  assert.equal(p.running, false);
  assert.equal(p.remainingMs, 10_770_000);
  assert.equal(deriveClock(paper, paused, at + 100_000).remainingMs, 10_770_000);
  assert.equal(deriveClock(paper, paused, at + 100_000).pausedMs, 70_000);
  const resumed = run([['begin-working', at], ['pause', at + 30_000], ['resume', at + 100_000]]);
  assert.equal(deriveClock(paper, resumed, at + 100_000).phaseEndsAt, at + 100_000 + 10_770_000);
  const finished = run([['begin-working', at], ['pause', at + 30_000], ['resume', at + 100_000], ['finish', at + 200_000]]);
  const f = deriveClock(paper, finished, at + 300_000);
  assert.deepEqual([f.phase, f.finishedAt, f.finishReason, f.elapsedWorkingMs, f.pausedMs, f.overtimeMs], ['finished', at + 200_000, 'student', 130_000, 70_000, 0]);
  assert.deepEqual(applyIntent(paper, finished, 'begin-working', at + 300_000), { refused: 'DESK_FINISHED' });
  for (const intent of INTENTS) assert.deepEqual(applyIntent(paper, finished, intent, at + 400_000, { early: true }), { refused: 'DESK_FINISHED' }, intent);
});
// The deliberate change: the site moved to `finished` at the working deadline.
check('working deadline: overtime counts, the paper stays open', () => {
  const work = run([['begin-working', at]]);
  const due = at + 10_800_000;
  const c = deriveClock(paper, work, due + 252_000);
  assert.deepEqual([c.phase, c.running, c.remainingMs, c.overtimeMs], ['working', true, 0, 252_000]);
  assert.equal(formatClock(c.overtimeMs), '00:04:12');
  const closed = run([['begin-working', at], ['finish', due + 252_000]]);
  const f = deriveClock(paper, closed, due + 999_000);
  assert.deepEqual([f.phase, f.overtimeMs, f.elapsedWorkingMs], ['finished', 252_000, 10_800_000 + 252_000]);
});
check('a pause in overtime freezes the overtime', () => {
  const due = at + 10_800_000;
  const events = run([['begin-working', at], ['pause', due + 60_000]]);
  assert.equal(deriveClock(paper, events, due + 600_000).overtimeMs, 60_000);
  const resumed = run([['begin-working', at], ['pause', due + 60_000], ['resume', due + 600_000]]);
  assert.equal(deriveClock(paper, resumed, due + 610_000).overtimeMs, 70_000);
});
check('intents refused outside their phase', () => {
  assert.deepEqual(applyIntent(paper, [], 'pause', at), { refused: 'DESK_INTENT_NOT_ALLOWED' });
  assert.deepEqual(applyIntent(paper, [], 'resume', at), { refused: 'DESK_INTENT_NOT_ALLOWED' });
  assert.deepEqual(applyIntent(paper, [], 'finish', at), { refused: 'DESK_INTENT_NOT_ALLOWED' });
  assert.deepEqual(applyIntent(paper, [], 'finish', at, { early: true }), { refused: 'DESK_INTENT_NOT_ALLOWED' });
  const reading = run([['begin-reading', at]]);
  assert.deepEqual(applyIntent(paper, reading, 'begin-reading', at + 1), { refused: 'DESK_INTENT_NOT_ALLOWED' });
  assert.deepEqual(applyIntent(paper, reading, 'resume', at + 1), { refused: 'DESK_INTENT_NOT_ALLOWED' });
  assert.deepEqual(applyIntent(paper, reading, 'finish', at + 1), { refused: 'DESK_INTENT_NOT_ALLOWED' }, 'closing in reading time needs early');
  assert.ok(applyIntent(paper, reading, 'finish', at + 1, { early: true }).events, 'closing early in reading time');
  assert.deepEqual(applyIntent(paper, reading, 'pause', at + 600_000), { refused: 'DESK_INTENT_NOT_ALLOWED' }, 'reading has ended: nothing to pause');
  assert.deepEqual(applyIntent(paper, reading, 'launch', at), { refused: 'DESK_INTENT_NOT_ALLOWED' });
});
check('a paused reading keeps its time; resume restarts it', () => {
  const events = run([['begin-reading', at], ['pause', at + 120_000], ['resume', at + 300_000]]);
  const c = deriveClock(paper, events, at + 300_000);
  assert.deepEqual([c.phase, c.remainingMs, c.phaseEndsAt], ['reading', 480_000, at + 780_000]);
  assert.equal(deriveClock(paper, events, at + 780_000).phase, 'ready');
});

// ── a zero-reading-time paper begins directly with working time ─────────────
check('zero reading → working', () => {
  const generic = paperConfigOf({ ...library, readingMinutes: 0 });
  const events = run([['begin-reading', at]], generic);
  assert.equal(deriveClock(generic, events, at).phase, 'working');
  assert.deepEqual(events, [{ t: 'begin-working', at }], 'the log records what happened: working began');
});

// ── the server stamps time ──────────────────────────────────────────────────
check('every event is stamped with the given server time, never a device value', () => {
  const out = applyIntent(paper, [], 'begin-working', at, { at: at - 3_600_000, deadline: 1, remainingMs: 99 });
  assert.deepEqual(out.events, [{ t: 'begin-working', at }]);
});
check('a server clock behind the last event never writes time backwards', () => {
  const events = run([['begin-working', at + 50_000]]);
  assert.equal(applyIntent(paper, events, 'pause', at).events.at(-1).at, at + 50_000);
});
check('a stored log is read defensively', () => {
  assert.deepEqual(readEvents({ v: 1, events: [{ t: 'begin-working', at }, { t: 'mark', at: at + 1 }, { t: 'pause', at: at - 5 }, { t: 'pause', at: 'x' }, { t: 'finish', at: at + 9, reason: 'score:100' }] }),
    [{ t: 'begin-working', at }, { t: 'finish', at: at + 9, reason: 'student' }]);
  assert.deepEqual(readEvents(null), []);
});
check('the same log and now give the same clock', () => {
  const events = run([['begin-reading', at], ['begin-working', at + 60_000], ['pause', at + 90_000]]);
  assert.deepEqual(deriveClock(paper, events, at + 1e6), deriveClock(paper, JSON.parse(JSON.stringify(events)), at + 1e6));
});

// ── question progress and notes: accurate, isolated, resettable ─────────────
check('tallies, isolation, independence of done and flagged', () => {
  const qs = readQuestions({ 1: { done: true }, 2: { flagged: true, note: 'I need to revisit the argument.', noteRev: 1 }, 3: { done: true, flagged: true } }, 27);
  assert.deepEqual(questionTallies(qs, 27), { done: 2, flagged: 2, notes: 1 });
  assert.equal(qs[2].note, 'I need to revisit the argument.');
  assert.equal(qs[3]?.note, '', 'a note on Q2 is not on Q3');
  assert.deepEqual([qs[3].done, qs[3].flagged], [true, true], 'done and flagged are independent');
  assert.deepEqual(questionTallies(readQuestions({}, 27), 27), { done: 0, flagged: 0, notes: 0 }, 'a new attempt starts empty');
});

// ── restore ignores invalid or out-of-range data ────────────────────────────
check('readQuestions drops invalid entries', () => {
  const qs = readQuestions({ 1: { done: true }, 2: { flagged: true }, 99: { done: true }, 3: 'invalid', '04': { done: true }, 0: { done: true },
    5: { note: 'x'.repeat(5001), noteRev: 1 }, 6: { note: 'bell\u0007', noteRev: 1 }, 7: { note: 'ok', noteRev: 2, score: 5 }, 8: { done: false } }, 27);
  assert.deepEqual(Object.keys(qs), ['1', '2', '5', '6', '7']);
  assert.equal(qs[5].note, '', 'an over-long note is not kept');
  assert.equal(qs[6].note, '', 'a note with a control character is not kept');
  assert.deepEqual(qs[7], { done: false, flagged: false, note: 'ok', noteRev: 2, ms: 0 }, 'unknown fields are dropped');
  assert.deepEqual(readQuestions(null, 27), {});
  assert.deepEqual(readQuestions([1, 2], 27), {});
});

// ── formatClock rounds conservatively to the displayed second ───────────────
check('formatClock', () => {
  assert.equal(formatClock(3 * 60 * 60 * 1000), '03:00:00');
  assert.equal(formatClock(1001), '00:00:02');
  assert.equal(formatClock(0), '00:00:00');
  assert.equal(formatClock(-5), '00:00:00');
});

// ── nothing in the clock is score-shaped ────────────────────────────────────
check('the clock carries no score field', () => {
  const c = deriveClock(paper, run([['begin-working', at], ['finish', at + 1]]), at + 2);
  assert.ok(!Object.keys(c).some(k => /score|award|pct|grade|result|correct|mark/i.test(k)), Object.keys(c).join());
});

if (failures.length) {
  console.error(`DESK CLOCK: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DESK CLOCK: PASS — ${pass}/${pass} checks`);
