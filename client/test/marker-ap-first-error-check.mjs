// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Arithmetic progressions: the first error, and what is carried
// forward (issue #430)
//
// The owner's page for "first term 9, common difference 3, find the 9th term":
//
//     a = 9, d = 3
//     T_n = a + (n - 1)d
//     T_9 = 9 + 8 × 3
//         = 9 + 24
//         = 35              ← the first (and only) wrong line: 9 + 24 is 33
//
// What this suite pins, on the Class 10 AP generators (nth term, sum, the
// savings word problem) and through the server's own marking operation
// (markerOps.stepEvidence — the deterministic engine that decides every mark):
//
//   · the FIRST wrong line is named, with the arithmetic that should have been
//     done, and every line above it that is true is verified;
//   · method marks earned before the slip stay earned; a line that is true of
//     the student's own slip (a given copied wrongly, a last term slipped and
//     then summed, a wrong formula substituted into) is error carried forward
//     — reported `ecf`, blamed once, never twice;
//   · the final-answer mark is never paid for a wrong final answer: method
//     marks are capped one below the question's marks, and a one-mark question
//     pays no method mark at all;
//   · FALSE POSITIVES, the primary risk: padded and repeated lines, reversed
//     equalities, a right answer with no method, a wrong answer with good
//     method, the question copied as "working", neutral algebra that restates
//     the givens (#416), bare values, prose, sweeps of candidates, the last
//     term alone on a sum question — none of these earns a method mark it did
//     not show, and none is called a mistake when it is true;
//   · review round 1 (#430): a formula line that also carries its arithmetic
//     (`T_n = a + (n - 1)d = 9 + 8 × 3 = 35`) is judged on every segment, so a
//     false one is the break and "every line verified" is never said over it;
//     givens written as prose (`a = 9 and d = 3`, `a = 9 d = 3`, `Given: …`)
//     are givens, never a first mistake; the terms listed (`9, 12, 15, …`) are
//     never read as one number; a last term slipped through continuation lines
//     is carried into the sum once; `n(…)/2` is the sum's substitution as much
//     as `n/2 (…)`.
//
// Everything here is deterministic: fixed seeds, no model, no clock.
// ─────────────────────────────────────────────────────────────────────────────
import { loadAllBanks, generateQuestion } from '../src/engine/generators/index.js';
import { checkAnswer, stepCheck, methodMarks } from '../src/engine/checker.js';
import { marksPossibleFor, stepEvidence } from '../../server/platform/markerOps.js';
import { everyLineVerified, lineMarks } from '../src/components/workingEvidence.js';

await loadAllBanks();

let pass = 0;
const failures = [];
function ok(cond, label) { if (cond) pass++; else failures.push(label); }
function eq(actual, expected, label) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  ok(same, `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/** One page judged by the engine the way the server judges it. */
function judge(q, lines, answer) {
  const working = lines.join('\n');
  const report = stepCheck(q.stepcheck, working, { prompt: q.prompt });
  const result = checkAnswer(q, String(answer));
  const evidence = stepEvidence(q, String(answer), working, result);
  const marks = marksPossibleFor(q);
  // What practice.js commits for a wrong answer: method marks, one below full.
  const earned = result.correct ? marks : Math.max(0, Math.min(marks - 1, evidence.partial?.awarded ?? 0));
  return {
    report, result, evidence, marks, earned,
    statuses: report.lines.map(l => l.status),
    stages: report.lines.map(l => (Number.isInteger(l.stage) ? l.stage : null)),
    ecf: report.lines.map(l => l.ecf === true),
    reasons: evidence.partial?.lines?.map(l => l.reason) || null,
    awarded: evidence.partial?.awarded ?? 0,
    // What the card may say and pin (workingEvidence.js): "every line verified", and the per-line marks.
    verified: everyLineVerified(report, lines),
    pins: (lineMarks(report, lines) || []).map(m => m?.kind ?? null)
  };
}

/** The checks every corpus case may ask for, on top of statuses and the first break. */
function expectCase(prefix, c, j) {
  eq(j.statuses, c.statuses, `${prefix} ${c.label}: statuses`);
  eq(j.report.firstBreak, c.firstBreak, `${prefix} ${c.label}: first break`);
  if (c.stages) eq(j.stages, c.stages, `${prefix} ${c.label}: stages proved`);
  if (c.ecf) eq(j.ecf, c.ecf, `${prefix} ${c.label}: lines carried forward`);
  if (c.independent) eq(j.report.lines.map(l => l.independent === true), c.independent, `${prefix} ${c.label}: independent errors`);
  if (c.diagnosis) eq(j.report.lines[c.firstBreak]?.diagnosis?.code, c.diagnosis, `${prefix} ${c.label}: diagnosis`);
  if (c.note) ok(c.note.test(String(j.report.lines[c.firstBreak]?.note)), `${prefix} ${c.label}: note (${j.report.lines[c.firstBreak]?.note})`);
  if (c.notNote) ok(!c.notNote.test(String(j.report.lines[c.firstBreak]?.note)), `${prefix} ${c.label}: not the note ${c.notNote} (${j.report.lines[c.firstBreak]?.note})`);
  if (c.lastNote) ok(c.lastNote.test(String(j.report.lines.at(-1)?.note)), `${prefix} ${c.label}: last note (${j.report.lines.at(-1)?.note})`);
  if (c.firstNote) ok(c.firstNote.test(String(j.report.lines[0]?.note)), `${prefix} ${c.label}: first line's note (${j.report.lines[0]?.note})`);
  if (c.given) eq(j.report.lines.map(l => l.given === true), c.given, `${prefix} ${c.label}: lines read as givens`);
  if (c.awarded !== undefined) eq(j.awarded, c.awarded, `${prefix} ${c.label}: method marks`);
  if (c.reasons) eq(j.reasons, c.reasons, `${prefix} ${c.label}: per-line reasons`);
  if (c.verified !== undefined) eq(j.verified, c.verified, `${prefix} ${c.label}: "every line verified" is said only when true`);
  if (c.pins) eq(j.pins, c.pins, `${prefix} ${c.label}: marks pinned to lines`);
  // A break is never carried forward; "every line verified" is never said over a break.
  ok(j.report.lines.every(l => !(l.status === 'break' && l.ecf)), `${prefix} ${c.label}: a break is never carried forward`);
  ok(!(j.verified && j.report.lines.some(l => l.status !== 'ok')), `${prefix} ${c.label}: never "every line verified" over a line that is not ok`);
  ok(j.report.firstBreak === -1 || j.pins[j.report.firstBreak] === 'break', `${prefix} ${c.label}: the first-mistake mark is pinned on the first break`);
}

// ── The owner's question: D1, seed 10931 (a = 9, d = 3, n = 9, T_9 = 33) ─────
const D1 = generateQuestion('c10-arithmetic-progressions', 1, 10931);
eq(D1.prompt, 'An arithmetic progression has first term $9$ and common difference $3$. Find its $9$th term.', 'D1: the owner\'s question is issued by seed 10931');
eq(D1.answer.value, 33, 'D1: its answer is 33');
eq(marksPossibleFor(D1), 1, 'D1: one mark');
eq(D1.stepcheck?.kind, 'plan', 'D1: it carries a step-check plan');
eq(D1.stepcheck.chain, true, 'D1: read as a page of chained equalities');

const OWNER = ['a = 9, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', '= 9 + 24', '= 35'];
{
  const j = judge(D1, OWNER, 35);
  eq(j.report.firstBreak, 4, 'owner: the first mistake is the fifth line');
  eq(j.statuses, ['ok', 'ok', 'ok', 'ok', 'break'], 'owner: every line above the slip is verified, nothing after it is blamed');
  eq(j.report.lines[4].diagnosis?.code, 'arithmetic-slip', 'owner: the slip is named as arithmetic');
  ok(/9 \+ 24 equals 33, not 35/.test(j.report.lines[4].note), `owner: the note says what the addition gives (${j.report.lines[4].note})`);
  eq(j.stages, [null, 0, 1, 1, null], 'owner: the formula proves stage 0, the substitution and its continuation stage 1, the givens no stage');
  eq(j.report.lines[0].given, true, 'owner: the givens line is marked as copied from the question');
  eq([j.result.correct, j.awarded, j.earned, j.marks], [false, 0, 0, 1], 'owner: a one-mark question pays no method mark for a wrong answer');
  eq(j.reasons, ['restated', 'cap', 'cap', 'repeat', 'break'], 'owner: the givens restate, the stages are capped at zero method marks, the continuation repeats');
  eq(j.report.lines.every(l => !l.independent), true, 'owner: no line is a second, independent error');
}
{
  const j = judge(D1, [...OWNER.slice(0, -1), '= 33'], 33);
  eq(j.report.firstBreak, -1, 'owner corrected: no break');
  eq(j.statuses, ['ok', 'ok', 'ok', 'ok', 'ok'], 'owner corrected: every line is verified');
  eq([j.result.correct, j.earned], [true, 1], 'owner corrected: 1 of 1');
}

// ── D1 adversarial corpus ────────────────────────────────────────────────────
const cases1 = [
  { label: 'a single-line chain with the slip', lines: ['T_9 = 9 + 8 × 3 = 35'], answer: 35,
    statuses: ['break'], firstBreak: 0, diagnosis: 'arithmetic-slip', note: /9 \+ 8 × 3 equals 33, not 35/ },
  { label: 'the multiplication slipped, then carried forward', lines: ['a = 9, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', '= 9 + 27', '= 36'], answer: 36,
    statuses: ['ok', 'ok', 'ok', 'break', 'ok'], firstBreak: 3, ecf: [false, false, false, false, true], note: /9 \+ 27 equals 36/ },
  { label: 'a given copied wrongly and carried through (error carried forward)', lines: ['a = 10, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 10 + 8 × 3', '= 10 + 24', '= 34'], answer: 34,
    statuses: ['break', 'ok', 'ok', 'ok', 'ok'], firstBreak: 0, ecf: [false, false, true, true, true], diagnosis: 'given-misread', note: /gives a = 9, not 10/,
    independent: [false, false, false, false, false] },
  { label: 'a given copied wrongly, then a second, independent slip', lines: ['a = 10, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 10 + 8 × 3', '= 10 + 24', '= 35'], answer: 35,
    statuses: ['break', 'ok', 'ok', 'ok', 'break'], firstBreak: 0, independent: [false, false, false, false, true], lastNote: /10 \+ 24 equals 34, not 35/ },
  { label: 'the given copied wrongly but not used (seed-10000 shape): the correct substitution is true of the question', lines: ['a = 10, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', '= 33'], answer: 33,
    statuses: ['break', 'ok', 'ok', 'ok'], firstBreak: 0, ecf: [false, false, false, false] },
  { label: 'the formula written wrongly (a + nd) and substituted into: blamed once', lines: ['a = 9, d = 3', 'T_n = a + nd', 'T_9 = 9 + 9 × 3', '= 36'], answer: 36,
    statuses: ['ok', 'break', 'ok', 'ok'], firstBreak: 1, ecf: [false, false, true, true], diagnosis: 'formula-error',
    stages: [null, 0, null, null], independent: [false, false, false, false] },
  { label: 'the formula right, the substitution with n in place of n − 1 (authored trap)', lines: ['a = 9, d = 3', 'T_n = a + (n-1)d', 'T_9 = 9 + 9 × 3', '= 36'], answer: 36,
    statuses: ['ok', 'ok', 'break', 'ok'], firstBreak: 2, diagnosis: 'formula-misapplied', ecf: [false, false, false, true] },
  { label: 'reversed equalities read with the label last', lines: ['a = 9, d = 3', '9 + 8 × 3 = T_9', '35 = 9 + 24'], answer: 35,
    statuses: ['ok', 'ok', 'break'], firstBreak: 2, stages: [null, 1, null], note: /9 \+ 24 equals 33, not 35/ },
  { label: 'the question copied as working, then the answer', lines: ['An arithmetic progression has first term 9 and common difference 3. Find its 9th term.', '35'], answer: 35,
    statuses: ['note', 'note'], firstBreak: -1 },
  { label: 'neutral algebra in the givens earns nothing and breaks nothing until the wrong value (#416)', lines: ['a = 9', 'd = 3', 'a + d = 12', '9 = 9', 'a - a = 0', '8 × 3 = 24', 'T_9 = 35'], answer: 35,
    statuses: ['ok', 'ok', 'ok', 'note', 'ok', 'ok', 'break'], firstBreak: 6, stages: [null, null, null, null, null, null, 1] },
  { label: 'a right answer with another computation: true, not the method step', lines: ['T_9 = 9 × 3 + 6', '= 33'], answer: 33,
    statuses: ['ok', 'ok'], firstBreak: -1, stages: [null, null] },
  { label: 'the value alone under the label: true, not the method step', lines: ['T_9 = 33'], answer: 33, statuses: ['ok'], firstBreak: -1, stages: [null] },
  { label: 'a bare value: stated, not derived', lines: ['a = 9, d = 3, n = 9', '33'], answer: 33, statuses: ['ok', 'note'], firstBreak: -1, stages: [null, null] },
  { label: 'prose is not judged', lines: ['I did it in my head', 'the answer is 33'], answer: 33, statuses: ['note', 'note'], firstBreak: -1 },
  { label: 'a sweep of values under the label: the first wrong one is the break, the true one earns nothing', lines: ['T_9 = 30', 'T_9 = 31', 'T_9 = 33', 'T_9 = 35'], answer: 35,
    statuses: ['break', 'break', 'ok', 'break'], firstBreak: 0, stages: [1, 1, null, 1] },
  { label: 'padded with repeats: each true line verified, nothing twice', lines: ['a = 9, d = 3', 'a = 9, d = 3', 'T_n = a + (n - 1)d', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', 'T_9 = 9 + 8 × 3', '= 33', '= 33'], answer: 33,
    statuses: Array(8).fill('ok'), firstBreak: -1 },
  { label: 'unicode subscripts and minus signs', lines: ['a = 9, d = 3', 'Tₙ = a + (n − 1)d', 'T₉ = 9 + (9 − 1) × 3', '= 9 + 24 = 33'], answer: 33,
    statuses: ['ok', 'ok', 'ok', 'ok'], firstBreak: -1, stages: [null, 0, 1, 1] },
  { label: 'plain tn / t9 labels and * for times', lines: ['tn = a + (n-1)d', 't9 = 9 + 8*3 = 33'], answer: 33, statuses: ['ok', 'ok'], firstBreak: -1, stages: [0, 1] },
  { label: 'x between numbers is a times sign', lines: ['T_9 = 9 + 8 x 3', '= 33'], answer: 33, statuses: ['ok', 'ok'], firstBreak: -1, stages: [1, null] },
  { label: 'a letter the formula does not have is not judged', lines: ['T_n = a + (n-1)k', 'T_9 = 9 + 8 × 3 = 33'], answer: 33, statuses: ['note', 'ok'], firstBreak: -1 },
  // Round 1: T_8 is the label the student's own n gives, so the substitution
  // under it is read as error carried forward (it was passed over as
  // "follows from the earlier slip" before the plan knew that label).
  { label: 'n copied wrongly is the first break; the substitution under its own label T_8 is carried forward, not blamed', lines: ['a = 9, d = 3, n = 8', 'T_n = a + (n-1)d', 'T_8 = 9 + 7 × 3', '= 30'], answer: 30,
    statuses: ['break', 'ok', 'ok', 'ok'], firstBreak: 0, diagnosis: 'given-misread', note: /asks for the 9th term, so n = 9/,
    ecf: [false, false, true, true], stages: [null, 0, 1, null], independent: [false, false, false, false] },
  { label: 'a relation is not an equality chain', lines: ['T_9 > 30', 'T_9 = 33'], answer: 33, statuses: ['note', 'ok'], firstBreak: -1 },

  // ── Review round 1 ──────────────────────────────────────────────────────────
  // A formula line that carries its arithmetic is judged on every segment.
  { label: 'formula and a false sum on one line: the false segment is the break', lines: ['a = 9, d = 3', 'T_n = a + (n - 1)d = 9 + 8 × 3 = 35'], answer: 35,
    statuses: ['ok', 'break'], firstBreak: 1, diagnosis: 'arithmetic-slip', note: /9 \+ 8 × 3 equals 33, not 35/, verified: false, pins: ['ok', 'break'] },
  { label: 'formula with a false sum, then the right value: the false segment is the break, not the correction', lines: ['T_n = a + (n-1)d = 9 + 8 × 3 = 35', '= 33'], answer: 33,
    statuses: ['break', 'ok'], firstBreak: 0, note: /9 \+ 8 × 3 equals 33, not 35/, pins: ['break', 'ok'], verified: false },
  { label: 'formula, false sum and a correction on one line: never "every line verified"', lines: ['a = 9, d = 3', 'T_n = a + (n - 1)d = 9 + 8 × 3 = 35 = 33'], answer: 33,
    statuses: ['ok', 'break'], firstBreak: 1, note: /9 \+ 8 × 3 equals 33, not 35/, verified: false, pins: ['ok', 'break'] },
  { label: 'formula and a true sum on one line: verified, credited to the formula stage', lines: ['T_n = a + (n - 1)d = 9 + 8 × 3 = 33'], answer: 33,
    statuses: ['ok'], firstBreak: -1, stages: [0], verified: true },
  { label: 'formula half substituted, then the arithmetic, on one line: credited to the formula stage (one stage per line)', lines: ['T_9 = 9 + 8d = 9 + 24 = 33'], answer: 33,
    statuses: ['ok'], firstBreak: -1, stages: [0], verified: true },
  { label: 'the formula and a wrong value with nothing between: put the values in', lines: ['T_n = a + (n-1)d = 35'], answer: 35,
    statuses: ['break'], firstBreak: 0, note: /Put the values into a \+ \(n-1\)d: it equals 33, not 35/ },
  { label: 'formula with a misread given carried through on the same line: carried forward, blamed once', lines: ['a = 10, d = 3', 'T_n = a + (n-1)d = 10 + 8 × 3 = 34'], answer: 34,
    statuses: ['break', 'ok'], firstBreak: 0, ecf: [false, true], independent: [false, false], diagnosis: 'given-misread' },
  { label: 'the formula with a misread given put in, then substituted: carried forward', lines: ['a = 10, d = 3', 'T_n = 10 + (n-1)3', 'T_9 = 10 + 8 × 3 = 34'], answer: 34,
    statuses: ['break', 'ok', 'ok'], firstBreak: 0, ecf: [false, true, true], independent: [false, false, false] },
  // Givens written as prose, or with a comma lost, are givens — never the first mistake.
  { label: 'givens joined by "and", then a slip', lines: ['a = 9 and d = 3', 'T_9 = 9 + 8 × 3 = 35'], answer: 35,
    statuses: ['ok', 'break'], firstBreak: 1, given: [true, false], independent: [false, false], note: /9 \+ 8 × 3 equals 33, not 35/ },
  { label: 'givens without a comma, then a slip', lines: ['a = 9 d = 3', 'T_9 = 9 + 8 × 3 = 35'], answer: 35,
    statuses: ['ok', 'break'], firstBreak: 1, given: [true, false], independent: [false, false] },
  { label: 'givens after "Here", joined by "and", then a slip', lines: ['Here a = 9 and d = 3', 'T_9 = 9 + 8 × 3 = 35'], answer: 35,
    statuses: ['ok', 'break'], firstBreak: 1, given: [true, false], independent: [false, false] },
  { label: 'givens without a comma on a fully correct page: no mistake', lines: ['a = 9 d = 3', 'T_n = a + (n-1)d', 'T_9 = 9 + 8 × 3 = 33'], answer: 33,
    statuses: ['ok', 'ok', 'ok'], firstBreak: -1, verified: true },
  { label: 'givens set apart by double spaces, then a slip: the slip is the first mistake', lines: ['a = 9  d = 3  n = 9', 'T_n = a + (n-1)d', 'T_9 = 9 + 8 × 3 = 35'], answer: 35,
    statuses: ['ok', 'ok', 'break'], firstBreak: 2, independent: [false, false, false], pins: ['ok', 'ok', 'break'] },
  { label: 'givens with full stops for commas, then a slip', lines: ['a = 9. d = 3.', 'T_n = a + (n-1)d', 'T_9 = 9 + 8 × 3 = 35'], answer: 35,
    statuses: ['ok', 'ok', 'break'], firstBreak: 2, independent: [false, false, false] },
  { label: 'givens joined by "&", then a slip', lines: ['a = 9 & d = 3', 'T_9 = 9 + 8 × 3 = 35'], answer: 35,
    statuses: ['ok', 'break'], firstBreak: 1, given: [true, false], independent: [false, false] },
  { label: 'a number and a letter set apart, unlabelled: not judged, never a mistake', lines: ['a + d = 5 d', 'T_9 = 33'], answer: 33,
    statuses: ['note', 'ok'], firstBreak: -1 },
  { label: 'a word is not letters multiplied together: "12 and d" is not 12·a·n·d', lines: ['a + d = 12 and d = 3', 'T_9 = 33'], answer: 33,
    statuses: ['note', 'ok'], firstBreak: -1 },
  { label: 'a word is not letters multiplied together: "4d and d" is not 4·d·a·n·d', lines: ['a + d = 4d and d = 3', 'T_9 = 33'], answer: 33,
    statuses: ['note', 'ok'], firstBreak: -1 },
  // The terms listed are several values, not one number.
  { label: 'two terms listed', lines: ['9, 12', 'd = 3'], answer: 33, statuses: ['note', 'ok'], firstBreak: -1, firstNote: /lists several values/ },
  { label: 'the terms listed to the 9th, right answer', lines: ['9, 12, 15, 18, 21, 24, 27, 30, 33', 'T_9 = 33'], answer: 33, statuses: ['note', 'ok'], firstBreak: -1 },
  { label: 'the terms listed, then a wrong value: the wrong value is the first mistake', lines: ['9, 12, 15, 18, 21, 24, 27, 30, 33', 'T_9 = 35'], answer: 35,
    statuses: ['note', 'break'], firstBreak: 1, independent: [false, false], pins: [null, 'break'] },
  { label: 'terms under their own labels: not this method\'s steps, not judged', lines: ['T_1 = 9', 'T_2 = 12', 'T_9 = 33'], answer: 33,
    statuses: ['note', 'note', 'ok'], firstBreak: -1, firstNote: /not one of them/ },
  // What the diagnosis names.
  { label: 'a slip after a restated value is measured from what computed it', lines: ['T_9 = 9 + 24', '= 33', '= 35'], answer: 35,
    statuses: ['ok', 'ok', 'break'], firstBreak: 2, note: /9 \+ 24 equals 33, not 35/ },
  { label: 'a value that changes between two bare values', lines: ['T_9 = 33', '= 35'], answer: 35,
    statuses: ['ok', 'break'], firstBreak: 1, note: /35 does not follow: the working above reached 33/ },
  { label: 'the continuation of a wrong formula is carried forward, not a plain tick', lines: ['a = 9, d = 3', 'T_n = a + nd', '= 9 + 9 × 3', '= 36'], answer: 36,
    statuses: ['ok', 'break', 'ok', 'ok'], firstBreak: 1, ecf: [false, false, true, true], independent: [false, false, false, false], verified: false,
    pins: ['ok', 'break', 'ecf', 'ecf'], note: /n − 1 steps along, not n/ },
  { label: 'an unrelated wrong formula is told the right one, not the n − 1 slip', lines: ['a = 9, d = 3', 'T_n = n^2 - 6n + 6'], answer: 33,
    statuses: ['ok', 'break'], firstBreak: 1, diagnosis: 'formula-error', note: /a \+ \(n − 1\)d: start at a/, notNote: /not n\./ }
];
for (const c of cases1) {
  const j = judge(D1, c.lines, c.answer);
  expectCase('D1', c, j);
  eq(j.awarded, 0, `D1 ${c.label}: a one-mark question pays no method mark`);
  eq(j.earned, j.result.correct ? 1 : 0, `D1 ${c.label}: the answer mark is paid for a right answer only`);
}

// ── The sum: D2, seed 7000 (a = 20, d = 3, n = 18, l = 71, S_18 = 819) ───────
const D2 = generateQuestion('c10-arithmetic-progressions', 2, 7000);
eq(D2.prompt, 'An arithmetic progression has first term $20$ and common difference $3$. Find the sum of its first $18$ terms.', 'D2: the sum question is issued by seed 7000');
eq([D2.answer.value, marksPossibleFor(D2), D2.stepcheck.derived.l], [819, 2, 71], 'D2: 819, two marks, last term 71');
eq(D2.stepcheck.stages.filter(s => s.supporting).length, 2, 'D2: the two nth-term stages are supporting stages');

const cases2 = [
  { label: 'perfect page, right answer', lines: ['a = 20, d = 3, n = 18', 'S_n = n/2 (2a + (n-1)d)', 'S_18 = 18/2 (2 × 20 + 17 × 3)', '= 18/2 (40 + 51)', '= 819'], answer: 819,
    statuses: ['ok', 'ok', 'ok', 'ok', 'ok'], firstBreak: -1, earned: 2 },
  { label: 'good method, wrong final line', lines: ['a = 20, d = 3, n = 18', 'S_n = n/2 (2a + (n-1)d)', 'S_18 = 18/2 (2 × 20 + 17 × 3)', '= 18/2 (40 + 51)', '= 829'], answer: 829,
    statuses: ['ok', 'ok', 'ok', 'ok', 'break'], firstBreak: 4, awarded: 1, earned: 1, reasons: ['restated', 'progress', 'cap', 'repeat', 'break'], note: /18\/2 \(40 \+ 51\) equals 819, not 829/ },
  { label: 'the last term slipped, then summed correctly: error carried forward keeps the method mark', lines: ['a = 20, d = 3', 'a_n = a + (n-1)d', 'a_18 = 20 + 17 × 3 = 72', 'S_n = n/2 (a + l)', 'S_18 = 18/2 (20 + 72)', '= 828'], answer: 828,
    statuses: ['ok', 'ok', 'break', 'ok', 'ok', 'ok'], firstBreak: 2, ecf: [false, false, false, false, true, true], awarded: 1, earned: 1, note: /20 \+ 17 × 3 equals 71, not 72/,
    independent: Array(6).fill(false) },
  { label: 'the last term alone, submitted as the sum: a different question answered, no method mark', lines: ['a = 20, d = 3', 'T_18 = 20 + 17 × 3', '= 71'], answer: 71,
    statuses: ['ok', 'ok', 'ok'], firstBreak: -1, awarded: 0, earned: 0, reasons: ['restated', 'supporting', 'unrelated'] },
  { label: 'the last term, then the sum substitution shown, wrong final line', lines: ['T_18 = 20 + 17 × 3 = 71', 'S_18 = 18/2 (20 + 71)', '= 820'], answer: 820,
    statuses: ['ok', 'ok', 'break'], firstBreak: 2, awarded: 1, earned: 1 },
  { label: 'n times the last term (authored trap)', lines: ['S = 18 × 71', '= 1278'], answer: 1278,
    statuses: ['break', 'ok'], firstBreak: 0, diagnosis: 'formula-misapplied', awarded: 0, earned: 0 },
  { label: 'a wrong sum formula, substituted into: the formula is the break, the substitution follows it and earns nothing', lines: ['a = 20, d = 3, n = 18', 'l = 20 + 17 × 3 = 71', 'S_n = n(a + l)', 'S_18 = 18(20 + 71)', '= 1638'], answer: 1638,
    statuses: ['ok', 'ok', 'break', 'ok', 'ok'], firstBreak: 2, ecf: [false, false, false, true, true], diagnosis: 'formula-error', awarded: 0, earned: 0,
    reasons: ['restated', 'supporting', 'break', 'after-mistake', 'after-mistake'], independent: Array(5).fill(false) },
  { label: 'a wrong formula in letters from both forms', lines: ['S_n = n/2 (a + l) d', 'S = 820'], answer: 820, statuses: ['break', 'break'], firstBreak: 0, diagnosis: 'formula-error', awarded: 0, earned: 0 },
  { label: 'the right formula, then a wrong one: the wrong one is the break', lines: ['S_n = n/2 (2a + (n-1)d)', 'S_n = n(a + l)', 'S_n = n/2 (a + l)', 'S = 820'], answer: 820,
    statuses: ['ok', 'break', 'ok', 'break'], firstBreak: 1, awarded: 1, earned: 1, reasons: ['progress', 'break', 'repeat', 'break'] },
  { label: 'a given copied wrongly, carried through the sum', lines: ['a = 21, d = 3, n = 18', 'S_n = n/2 (2a + (n-1)d)', 'S_18 = 18/2 (2 × 21 + 17 × 3)', '= 837'], answer: 837,
    statuses: ['break', 'ok', 'ok', 'ok'], firstBreak: 0, ecf: [false, false, true, true], awarded: 1, earned: 1 },
  { label: 'a given copied wrongly, then an independent arithmetic slip', lines: ['a = 21, d = 3, n = 18', 'S_n = n/2 (2a + (n-1)d)', 'S_18 = 18/2 (2 × 21 + 17 × 3)', '= 844'], answer: 844,
    statuses: ['break', 'ok', 'ok', 'break'], firstBreak: 0, independent: [false, false, false, true], awarded: 1, earned: 1, lastNote: /equals 837, not 844/ },
  { label: 'the substitution alone, wrong final line', lines: ['S_18 = 18/2 (2 × 20 + 17 × 3)', '= 822'], answer: 822, statuses: ['ok', 'break'], firstBreak: 1, awarded: 1, earned: 1 },
  { label: 'the question copied, the givens restated, neutral algebra, the wrong value', lines: ['An arithmetic progression has first term 20 and common difference 3. Find the sum of its first 18 terms.', 'a = 20', 'd = 3', 'a + d = 23', '2a = 40', '824'], answer: 824,
    statuses: ['note', 'ok', 'ok', 'ok', 'ok', 'note'], firstBreak: -1, awarded: 0, earned: 0 },
  { label: 'the right answer with no method', lines: ['S = 819'], answer: 819, statuses: ['ok'], firstBreak: -1, earned: 2 },
  { label: 'the formula three times over, wrong final value: one mark, not three', lines: ['S_n = n/2 (2a + (n-1)d)', 'S_n = n/2 (2a + (n-1)d)', 'S_n = n/2 (2a + (n-1)d)', 'S = 820'], answer: 820,
    statuses: ['ok', 'ok', 'ok', 'break'], firstBreak: 3, awarded: 1, earned: 1, reasons: ['progress', 'repeat', 'repeat', 'break'] },
  { label: 'reversed equalities: substitution shown with the label last, then a wrong value', lines: ['18/2 (2 × 20 + 17 × 3) = S_18', '821 = S_18'], answer: 821,
    statuses: ['ok', 'break'], firstBreak: 1, awarded: 1, earned: 1 },
  { label: 'a single-line chain with the slip', lines: ['S_18 = 18/2 (40 + 51) = 829'], answer: 829, statuses: ['break'], firstBreak: 0, note: /18\/2 \(40 \+ 51\) equals 819, not 829/, awarded: 0, earned: 0 },

  // ── Review round 1 ──────────────────────────────────────────────────────────
  { label: 'the formula and a false sum on one line: a break, never verified; a line holding a false equality earns nothing', lines: ['S_n = n/2 (2a + (n-1)d) = 18/2 (40 + 51) = 829'], answer: 829,
    statuses: ['break'], firstBreak: 0, note: /18\/2 \(40 \+ 51\) equals 819, not 829/, awarded: 0, earned: 0, verified: false },
  { label: 'givens without commas, then a slip: the slip is the first mistake', lines: ['a = 20 d = 3 n = 18', 'S_18 = 18/2 (40 + 51) = 820'], answer: 820,
    statuses: ['ok', 'break'], firstBreak: 1, given: [true, false], independent: [false, false], earned: 0 },
  { label: 'the last term slipped through continuation lines under its formula: carried into the sum once, the method mark kept', lines: ['a_n = a + (n-1)d', '= 20 + 17 × 3', '= 72', 'S_18 = 18/2 (20 + 72)', '= 828'], answer: 828,
    statuses: ['ok', 'ok', 'break', 'ok', 'ok'], firstBreak: 2, ecf: [false, false, false, true, true], independent: Array(5).fill(false), awarded: 1, earned: 1, note: /20 \+ 17 × 3 equals 71, not 72/ },
  { label: 'the last term slipped on its formula line: carried into the sum once, the method mark kept', lines: ['l = a + (n-1)d = 20 + 17 × 3 = 72', 'S_18 = 18/2 (20 + 72)', '= 828'], answer: 828,
    statuses: ['break', 'ok', 'ok'], firstBreak: 0, ecf: [false, true, true], independent: Array(3).fill(false), awarded: 1, earned: 1, note: /20 \+ 17 × 3 equals 71, not 72/ },
  { label: 'the last term slipped on a continuation line under its substitution: the same mark as one line', lines: ['a_18 = 20 + 17 × 3', '= 72', 'S_18 = 18/2 (20 + 72)', '= 828'], answer: 828,
    statuses: ['ok', 'break', 'ok', 'ok'], firstBreak: 1, ecf: [false, false, true, true], independent: Array(4).fill(false), awarded: 1, earned: 1 },
  { label: 'the last term right on its formula line: the formula and its arithmetic are verified', lines: ['l = a + (n-1)d = 20 + 17 × 3 = 71', 'S_18 = 18/2 (20 + 71)', '= 820'], answer: 820,
    statuses: ['ok', 'ok', 'break'], firstBreak: 2, awarded: 1, earned: 1 },
  { label: 'the sum substitution written n(…)/2 is the substitution', lines: ['S_18 = 18 (40 + 51) / 2', '= 820'], answer: 820,
    statuses: ['ok', 'break'], firstBreak: 1, awarded: 1, earned: 1, reasons: ['progress', 'break'] },
  { label: 'the sum substitution written (…) × n/2 is the substitution', lines: ['S_18 = (2 × 20 + 17 × 3) × 18/2', '= 820'], answer: 820,
    statuses: ['ok', 'break'], firstBreak: 1, awarded: 1, earned: 1, reasons: ['progress', 'break'] },
  { label: 'a slipped last term summed as n(a + l)/2: carried forward, the method mark kept', lines: ['a_18 = 20 + 17 × 3 = 72', 'S_18 = 18 (20 + 72) / 2', '= 828'], answer: 828,
    statuses: ['break', 'ok', 'ok'], firstBreak: 0, ecf: [false, true, true], awarded: 1, earned: 1 },
  { label: 'the terms listed, then a correct method with a slipped final line: the slip is the first mistake', lines: ['20, 23, 26, 29, 32, 35, 38, 41, 44, 47, 50, 53, 56, 59, 62, 65, 68, 71', 'S_n = n/2 (a + l)', 'S_18 = 18/2 (20 + 71)', '= 829'], answer: 829,
    statuses: ['note', 'ok', 'ok', 'break'], firstBreak: 3, independent: Array(4).fill(false), awarded: 1, earned: 1, firstNote: /lists several values/ },
  { label: 'the last term written beside the givens', lines: ['a = 20, d = 3, n = 18, l = 71', 'S_18 = 18/2 (20 + 71)', '= 820'], answer: 820,
    statuses: ['ok', 'ok', 'break'], firstBreak: 2, given: [true, false, false], awarded: 1, earned: 1 },
  { label: 'a wrong last term beside the givens: the first mistake, carried into the sum once', lines: ['a = 20, d = 3, n = 18, l = 72', 'S_18 = 18/2 (20 + 72)', '= 828'], answer: 828,
    statuses: ['break', 'ok', 'ok'], firstBreak: 0, diagnosis: 'value-slip', note: /l = 71, not 72/, ecf: [false, true, true], awarded: 1, earned: 1 },
  { label: 'n copied wrongly, summed under its own label S_17: the misread costs one mark', lines: ['a = 20, d = 3, n = 17', 'S_17 = 17/2 (40 + 48)', '= 748'], answer: 748,
    statuses: ['break', 'ok', 'ok'], firstBreak: 0, diagnosis: 'given-misread', ecf: [false, true, true], awarded: 1, earned: 1 },
  // The ECF policy, stated in docs/product/marking-first-error-ecf.md: a
  // substitution right for the student's own values earns its stage under
  // ecf: 'method', however wrong those values — bounded by the cap.
  { label: 'every given copied wrongly, then substituted correctly: the substitution stage still earns under ecf: method', lines: ['a = 21, d = 4, n = 17', 'S_17 = 17/2 (2 × 21 + 16 × 4)', '= 901'], answer: 901,
    statuses: ['break', 'ok', 'ok'], firstBreak: 0, ecf: [false, true, true], stages: [null, 1, null], awarded: 1, earned: 1 },
  { label: 'a scratch label that is the sum\'s own: S = a + l is a wrong sum formula', lines: ['S = a + l = 91'], answer: 91,
    statuses: ['break'], firstBreak: 0, diagnosis: 'formula-error', awarded: 0, earned: 0 },
  { label: 'n(a + l) is named for what it is', lines: ['S_n = n(a + l)', 'S_18 = 18(20 + 71)'], answer: 1638,
    statuses: ['break', 'ok'], firstBreak: 0, diagnosis: 'formula-error', note: /adds every term twice/, awarded: 0, earned: 0 }
];
for (const c of cases2) {
  const j = judge(D2, c.lines, c.answer);
  expectCase('D2', c, j);
  eq(j.earned, c.earned, `D2 ${c.label}: marks earned`);
  ok(j.result.correct || j.earned < j.marks, `D2 ${c.label}: a wrong answer never earns the answer mark`);
}

// ── The savings word problem: D4, seed 7000 (a = 289, d = 28, n = 13, S = 5941) ─
const D4 = generateQuestion('c10-arithmetic-progressions', 4, 7000);
ok(/Priya saves \$₹289\$/.test(D4.prompt) && /\$13\$ months/.test(D4.prompt), `D4: the savings question is issued by seed 7000 (${D4.prompt})`);
eq([D4.answer.value, marksPossibleFor(D4), D4.stepcheck.stages[0].kind], [5941, 3, 'identify'], 'D4: 5941, three marks, recognising the progression is the first stage');

const cases4 = [
  { label: 'perfect page', lines: ['a = 289, d = 28, n = 13', 'S_n = n/2 [2a + (n-1)d]', 'S_13 = 13/2 [2(289) + 12(28)]', '= 13/2 × 914', '= 5941'], answer: 5941,
    statuses: Array(5).fill('ok'), firstBreak: -1, stages: [0, 1, 2, 2, null], earned: 3 },
  { label: 'good method, wrong final line: two of three, never the answer mark', lines: ['a = 289, d = 28, n = 13', 'S_n = n/2 [2a + (n-1)d]', 'S_13 = 13/2 [2(289) + 12(28)]', '= 6041'], answer: 6041,
    statuses: ['ok', 'ok', 'ok', 'break'], firstBreak: 3, awarded: 2, earned: 2, reasons: ['progress', 'progress', 'cap', 'break'] },
  { label: 'the givens with rupees and months, then a wrong value', lines: ['a = ₹289, d = ₹28, n = 13 months', 'S = 6041'], answer: 6041,
    statuses: ['ok', 'break'], firstBreak: 1, awarded: 1, earned: 1 },
  { label: 'the givens on three lines complete the recognising stage on the third', lines: ['a = 289', 'd = 28', 'n = 13', '6041'], answer: 6041,
    statuses: ['ok', 'ok', 'ok', 'note'], firstBreak: -1, stages: [null, null, 0, null], awarded: 1, earned: 1 },
  { label: 'two of the three givens do not recognise the progression', lines: ['a = 289', 'd = 28', '6041'], answer: 6041,
    statuses: ['ok', 'ok', 'note'], firstBreak: -1, awarded: 0, earned: 0 },
  { label: 'the last month alone (authored trap): recognised, but the nth term is not a stage of the sum', lines: ['a = 289, d = 28, n = 13', 'T_13 = 289 + 12 × 28 = 625'], answer: 625,
    statuses: ['ok', 'ok'], firstBreak: -1, awarded: 1, earned: 1, trap: true },
  { label: 'a × n (authored trap)', lines: ['S = 289 × 13 = 3757'], answer: 3757, statuses: ['break'], firstBreak: 0, diagnosis: 'formula-misapplied', awarded: 0, earned: 0, trap: true },
  { label: 'd misread, then formula and substitution carried forward: the misread costs one mark', lines: ['a = 289, d = 38, n = 13', 'S_n = n/2 (2a + (n-1)d)', 'S = 13/2 (578 + 456)', '= 6721'], answer: 6721,
    statuses: ['break', 'ok', 'ok', 'ok'], firstBreak: 0, ecf: [false, false, true, true], diagnosis: 'given-misread', note: /grows by ₹28 each month, so d = 28/, awarded: 2, earned: 2 },
  { label: 'the question copied and the answer guessed', lines: ['Priya saves ₹289 in the first month and increases her saving by ₹28 every month after that.', '6000'], answer: 6000,
    statuses: ['note', 'note'], firstBreak: -1, awarded: 0, earned: 0 },

  // ── Review round 1 ──────────────────────────────────────────────────────────
  { label: 'givens joined by "and", then a slip: recognised, and the slip is the first mistake', lines: ['a = 289 and d = 28 and n = 13', 'S_n = n/2 (2a + (n-1)d)', 'S_13 = 13/2 (578 + 336) = 5940'], answer: 5940,
    statuses: ['ok', 'ok', 'break'], firstBreak: 2, stages: [0, 1, 2], independent: [false, false, false], awarded: 2, earned: 2 },
  { label: 'givens without commas, then a slip on the last line', lines: ['a = 289 d = 28 n = 13', 'S_n = n/2 (2a + (n-1)d)', 'S_13 = 13/2 (2 × 289 + 12 × 28)', '= 5940'], answer: 5940,
    statuses: ['ok', 'ok', 'ok', 'break'], firstBreak: 3, reasons: ['progress', 'progress', 'cap', 'break'], awarded: 2, earned: 2 },
  { label: '"Given" before the givens', lines: ['Given a = 289, d = 28, n = 13', '6041'], answer: 6041, statuses: ['ok', 'note'], firstBreak: -1, stages: [0, null], awarded: 1, earned: 1 },
  { label: '"Given:" and semicolons', lines: ['Given: a = 289; d = 28; n = 13.', '6041'], answer: 6041, statuses: ['ok', 'note'], firstBreak: -1, stages: [0, null], awarded: 1, earned: 1 },
  { label: '"Here," and "and"', lines: ['Here, a = 289, d = 28 and n = 13', '6041'], answer: 6041, statuses: ['ok', 'note'], firstBreak: -1, stages: [0, null], awarded: 1, earned: 1 },
  { label: 'each given named in words', lines: ['First term a = 289, common difference d = 28, number of terms n = 13', '6041'], answer: 6041,
    statuses: ['ok', 'note'], firstBreak: -1, stages: [0, null], awarded: 1, earned: 1 },
  { label: 'the last month written beside the givens still recognises the progression', lines: ['a = 289, d = 28, n = 13, l = 625', '6041'], answer: 6041,
    statuses: ['ok', 'note'], firstBreak: -1, stages: [0, null], awarded: 1, earned: 1 },
  { label: 'the months listed, then a correct method with a slipped final line', lines: ['289, 317, 345, 373, 401, 429, 457, 485, 513, 541, 569, 597, 625', 'S_n = n/2 (a + l)', 'S_13 = 13/2 (289 + 625)', '= 5940'], answer: 5940,
    statuses: ['note', 'ok', 'ok', 'break'], firstBreak: 3, independent: [false, false, false, false], awarded: 2, earned: 2 },
  { label: 'a total written with a digit-grouping comma', lines: ['a = 289, d = 28, n = 13', 'S_13 = 13/2 (578 + 336)', '= 5,941'], answer: 5941,
    statuses: ['ok', 'ok', 'ok'], firstBreak: -1, earned: 3 },
  { label: 'a given misread, written with a digit-grouping comma', lines: ['a = 1,289, d = 28, n = 13', '6041'], answer: 6041,
    statuses: ['break', 'note'], firstBreak: 0, diagnosis: 'given-misread', awarded: 0, earned: 0 },
  // Round 2: the last month (l = 625) slipped to 627 and then summed correctly
  // is error carried forward, on D4 as on D2: the sum line is not "also wrong".
  { label: 'the last month slipped on its formula line: carried into the sum once, the method mark kept', lines: ['a = 289, d = 28, n = 13', 'l = a + (n - 1)d = 289 + 12 × 28 = 627', 'S_13 = 13/2 (289 + 627)', '= 5954'], answer: 5954,
    statuses: ['ok', 'break', 'ok', 'ok'], firstBreak: 1, ecf: [false, false, true, true], independent: Array(4).fill(false), note: /289 \+ 12 × 28 equals 625, not 627/, awarded: 2, earned: 2 },
  { label: 'the last month slipped through continuation lines: carried into the sum once', lines: ['a = 289, d = 28, n = 13', 'a_n = a + (n - 1)d', '= 289 + 12 × 28', '= 627', 'S_13 = 13/2 (289 + 627)', '= 5954'], answer: 5954,
    statuses: ['ok', 'ok', 'ok', 'break', 'ok', 'ok'], firstBreak: 3, ecf: [false, false, false, false, true, true], independent: Array(6).fill(false), awarded: 2, earned: 2 },
  { label: 'the last month slipped on a continuation of its substitution: carried into the sum once', lines: ['a = 289, d = 28, n = 13', 'l = 289 + 12 × 28', '= 627', 'S_13 = 13/2 (289 + 627)', '= 5954'], answer: 5954,
    statuses: ['ok', 'ok', 'break', 'ok', 'ok'], firstBreak: 2, ecf: [false, false, false, true, true], independent: Array(5).fill(false), awarded: 2, earned: 2 },
  { label: 'the last month found correctly alone earns nothing beyond recognising the progression', lines: ['a = 289, d = 28, n = 13', 'l = 289 + 12 × 28 = 625', '6041'], answer: 6041,
    statuses: ['ok', 'ok', 'note'], firstBreak: -1, awarded: 1, earned: 1 }
];
for (const c of cases4) {
  const j = judge(D4, c.lines, c.answer);
  expectCase('D4', c, j);
  eq(j.earned, c.earned, `D4 ${c.label}: marks earned`);
  if (c.trap) ok(D4.traps.some(t => t.value === c.answer) && j.result.feedback === D4.traps.find(t => t.value === c.answer).why, `D4 ${c.label}: the authored trap explains the answer`);
  ok(j.result.correct || j.earned < j.marks, `D4 ${c.label}: a wrong answer never earns the answer mark`);
}

// ── The same invariants across seeds, all three generators ───────────────────
// Perfect pages verify every line; the same page with its last line wrong
// breaks there and only there; the question copied, the givens restated and a
// bare value never earn; a reversed page earns exactly what the forward one
// does; and no wrong answer ever earns the final-answer mark.
let swept = 0;
for (let seed = 10000; seed < 10060; seed++) {
  for (const diff of [1, 2, 4]) {
    const q = generateQuestion('c10-arithmetic-progressions', diff, seed);
    if (q.stepcheck?.kind !== 'plan') continue;          // D2/D4 fall back to a lower level when the sum is not whole
    const { a, d, n } = q.stepcheck.givens;
    const answer = q.answer.value;
    const term = a + (n - 1) * d;
    const isTerm = /th term\./.test(q.prompt);
    const page = isTerm
      ? [`a = ${a}, d = ${d}`, 'T_n = a + (n - 1)d', `T_${n} = ${a} + ${n - 1} × (${d})`, `= ${a} + (${(n - 1) * d})`, `= ${term}`]
      : [`a = ${a}, d = ${d}, n = ${n}`, 'S_n = n/2 (2a + (n - 1)d)', `S_${n} = ${n}/2 (2 × (${a}) + ${n - 1} × (${d}))`, `= ${n}/2 × (${2 * a + (n - 1) * d})`, `= ${answer}`];
    const marks = marksPossibleFor(q);
    const good = judge(q, page, answer);
    eq(good.statuses, Array(5).fill('ok'), `sweep d${diff} seed ${seed}: the perfect page is verified line by line`);
    eq([good.report.firstBreak, good.earned], [-1, marks], `sweep d${diff} seed ${seed}: no break, full marks`);
    const wrongValue = answer + (seed % 2 ? 1 : -1);
    const slipped = judge(q, [...page.slice(0, -1), `= ${wrongValue}`], wrongValue);
    eq(slipped.statuses, ['ok', 'ok', 'ok', 'ok', 'break'], `sweep d${diff} seed ${seed}: the last line is the first and only break`);
    ok(new RegExp(`equals ${String(answer).replace('-', '\\-')}, not ${String(wrongValue).replace('-', '\\-')}`).test(slipped.report.lines[4].note), `sweep d${diff} seed ${seed}: the note gives the right arithmetic (${slipped.report.lines[4].note})`);
    eq(slipped.earned, Math.min(marks - 1, diff === 1 ? 0 : diff === 2 ? 1 : 2), `sweep d${diff} seed ${seed}: method marks stay, the answer mark does not`);
    ok(slipped.earned < marks, `sweep d${diff} seed ${seed}: never full marks for a wrong answer`);
    const reversed = judge(q, [page[0], page[1], `${page[2].split('=').slice(1).join('=').trim()} = ${page[2].split('=')[0].trim()}`, `${wrongValue} = ${page[2].split('=')[0].trim()}`], wrongValue);
    eq(reversed.earned, slipped.earned, `sweep d${diff} seed ${seed}: a reversed page earns what the forward page earns`);
    eq(reversed.statuses.at(-1), 'break', `sweep d${diff} seed ${seed}: the reversed wrong value is the break`);
    const copied = judge(q, [q.prompt.replace(/\$/g, ''), `a = ${a}`, `d = ${d}`, `a + d = ${a + d}`, `${wrongValue}`], wrongValue);
    eq([copied.report.firstBreak, copied.earned], [-1, 0], `sweep d${diff} seed ${seed}: the question copied, the givens restated and a bare value earn nothing and break nothing`);
    ok(copied.statuses.every(s => s !== 'break'), `sweep d${diff} seed ${seed}: nothing true is called a mistake`);
    // Round 1: the givens as prose, or with the commas lost, are givens.
    for (const givensText of [page[0].replace(/, /g, ' and '), page[0].replace(/, /g, ' '), `Given: ${page[0]}.`]) {
      const prose = judge(q, [givensText, ...page.slice(1, -1), `= ${wrongValue}`], wrongValue);
      eq([prose.statuses, prose.report.firstBreak], [['ok', 'ok', 'ok', 'ok', 'break'], 4], `sweep d${diff} seed ${seed}: givens written "${givensText}" are givens; the slip is the first mistake`);
      eq(prose.earned, slipped.earned, `sweep d${diff} seed ${seed}: givens written "${givensText}" earn what the commas did`);
    }
    // Round 1: the formula with its arithmetic on one line is judged on every segment.
    const formulaLine = isTerm ? `T_n = a + (n - 1)d = ${a} + ${n - 1} × (${d}) = ${wrongValue}` : `S_n = n/2 (2a + (n - 1)d) = ${n}/2 (2 × (${a}) + ${n - 1} × (${d})) = ${wrongValue}`;
    const oneLine = judge(q, [formulaLine], wrongValue);
    eq([oneLine.statuses, oneLine.report.firstBreak, oneLine.verified], [['break'], 0, false], `sweep d${diff} seed ${seed}: a formula line with a false value on it is the break`);
    ok(new RegExp(`equals ${String(answer).replace('-', '\\-')}, not ${String(wrongValue).replace('-', '\\-')}`).test(oneLine.report.lines[0].note), `sweep d${diff} seed ${seed}: the formula line's note gives the right arithmetic (${oneLine.report.lines[0].note})`);
    if (!isTerm) {
      // Round 1: the sum's substitution with the /2 written last earns as the /2 written first.
      const lastHalf = judge(q, [`S_${n} = ${n} (2 × (${a}) + ${n - 1} × (${d})) / 2`, `= ${wrongValue}`], wrongValue);
      const firstHalf = judge(q, [`S_${n} = ${n}/2 (2 × (${a}) + ${n - 1} × (${d}))`, `= ${wrongValue}`], wrongValue);
      eq([lastHalf.statuses, lastHalf.stages[0]], [['ok', 'break'], firstHalf.stages[0]], `sweep d${diff} seed ${seed}: n(…)/2 proves the stage n/2 (…) proves`);
      eq(lastHalf.earned, firstHalf.earned, `sweep d${diff} seed ${seed}: n(…)/2 earns what n/2 (…) earns`);
      // Round 2: a last term slipped by 2 on its formula line, then summed
      // correctly (the sum moves by n), is carried forward on D2 and D4 alike.
      const lastWrong = term + 2, sumWrong = answer + n;
      const lSlip = judge(q, [page[0], `l = a + (n - 1)d = ${a} + ${n - 1} × (${d}) = ${lastWrong}`, `S_${n} = ${n}/2 ((${a}) + (${lastWrong}))`, `= ${sumWrong}`], sumWrong);
      eq([lSlip.statuses, lSlip.report.firstBreak], [['ok', 'break', 'ok', 'ok'], 1], `sweep d${diff} seed ${seed}: the slipped last term is the first and only break`);
      eq([lSlip.ecf, lSlip.report.lines.map(l => l.independent === true)], [[false, false, true, true], [false, false, false, false]], `sweep d${diff} seed ${seed}: the sum of the slipped last term is carried forward, not "also wrong"`);
      eq(lSlip.earned, slipped.earned, `sweep d${diff} seed ${seed}: a slipped last term summed correctly earns what a slipped final line does`);
    }
    swept++;
  }
}
ok(swept >= 120, `the sweep covered ${swept} generated questions`);

// ── Round 2: lines Pri may have misread are judged nowhere ───────────────────
// A part with no value (`35/0`, `sqrt(-4)`) is never ticked or paid; two
// statements run together, a word beside the working, or a comma in brackets
// is never named the mistake; a hedged given (`289 or 300`) is not a given.
// The ordinary spellings `(n - 1) d` and `8 x 3` are still read and verified.
{
  const Q = { 1: D1, 2: D2, 4: D4 };
  const misread = [
    [1, 'a value that does not exist on a formula line', ['a = 9, d = 3', 'T_n = a + (n-1)d = 9 + 8 × 3 = 35/0'], 35, ['ok', 'note'], -1, 0],
    [1, 'a square root of a negative as the formula’s value', ['T_n = a + (n-1)d = sqrt(-4)'], 33, ['note'], -1, 0],
    [1, '0/0 after a true chain', ['T_n = a + (n-1)d = 9 + 8 × 3 = 33 = 0/0'], 33, ['note'], -1, 0],
    [2, 'a division by zero after the substitution', ['S_n = n/2 (2a + (n-1)d) = 18/2 (40 + 51) = 829/0'], 829, ['note'], -1, 0],
    [4, 'the formula equated to sqrt(-1): only recognising the progression earns', ['a = 289, d = 28, n = 13', 'S_n = n/2 (2a + (n-1)d) = sqrt(-1)', '= 6000'], 6000, ['ok', 'note', 'note'], -1, 1],
    [1, 'the formula and a given run together', ['a = 9, d = 3', 'T_n = a + (n-1)d  n = 9', 'T_9 = 9 + 8 × 3', '= 35'], 35, ['ok', 'note', 'ok', 'break'], 3, 0],
    [2, 'the sum formula and a given run together', ['a = 20, d = 3', 'S_n = n/2 (2a + (n-1)d)  n = 18', 'S_18 = 18/2 (40 + 51)', '= 829'], 829, ['ok', 'note', 'ok', 'break'], 3, 1],
    [4, 'the sum formula and the last month run together', ['a = 289, d = 28, n = 13', 'S_n = n/2 (a + l)  l = 625', 'S_13 = 13/2 (289 + 625)', '= 5940'], 5940, ['ok', 'note', 'ok', 'break'], 3, 2],
    [1, 'a formula and a given after a full stop', ['T_n = a + (n-1)d. a = 9', 'T_9 = 9 + 8 × 3', '= 35'], 35, ['note', 'ok', 'break'], 2, 0],
    [1, 'a true chain with a given run on', ['T_9 = 9 + 8 × 3 = 33 d = 3'], 33, ['note'], -1, 0],
    [2, 'a word after the formula', ['S_n = n/2 (2a + (n-1)d) expand', 'S_18 = 18/2 (40 + 51)', '= 829'], 829, ['note', 'ok', 'break'], 2, 1],
    [2, 'a word after the substitution', ['S_18 = 18/2 (40 + 51) an', '= 829'], 829, ['note', 'note'], -1, 0],
    [1, 'a word beginning with a constant’s name', ['T_9 = 33 pin'], 33, ['note'], -1, 0],
    [1, 'a word after a continuation', ['T_9 = 9 + 8 × 3', '= 33 an'], 33, ['ok', 'note'], -1, 0],
    [4, 'a word beginning with a function’s name', ['a = 289, d = 28, n = 13', 'S_13 = 13/2 (578 + 336) = 5941 secand'], 5941, ['ok', 'note'], -1, 0],
    [1, 'a word and a given run on', ['T_9 = 9 + 8 × 3 = 33 pie a = 9'], 33, ['note'], -1, 0],
    [4, 'hedged givens are not givens', ['a = 289 or 300, d = 28 or 30, n = 13 or 14', '6000'], 6000, ['note', 'note'], -1, 0],
    [4, 'a range is not a given', ['a = 289 to 300, d = 28, n = 13', '6000'], 6000, ['note', 'note'], -1, 0],
    [4, 'givens with their units are givens', ['a = ₹289, d = 28 rupees, n = 13 months', '6000'], 6000, ['ok', 'note'], -1, 1],
    [2, 'a comma in brackets is not a number the student wrote', ['S_18 = 18/2 (20, 71)', '= 819'], 819, ['note', 'note'], -1, 0],
    [1, '(n - 1) d and 8 x 3 are still read', ['T_n = a + (n - 1) d', 'T_9 = 9 + 8 x 3', '= 33'], 33, ['ok', 'ok', 'ok'], -1, null],
    [2, '(n - 1) d in the sum is still read', ['S_n = n/2 (2a + (n - 1) d)', 'S_18 = 18/2 (40 + 51)', '= 819'], 819, ['ok', 'ok', 'ok'], -1, null]
  ];
  for (const [diff, label, lines, answer, statuses, firstBreak, awarded] of misread) {
    const j = judge(Q[diff], lines, answer);
    eq([j.statuses, j.report.firstBreak], [statuses, firstBreak], `D${diff} ${label}: statuses and first mistake`);
    if (awarded !== null) eq(j.awarded, awarded, `D${diff} ${label}: method marks`);
    eq(j.verified, statuses.every(st => st === 'ok'), `D${diff} ${label}: "every line verified" only over verified lines`);
    ok(j.result.correct || j.earned < j.marks, `D${diff} ${label}: a wrong answer never earns the answer mark`);
  }
}

// ── Outside the AP plans: a listed line is never a derivative mistake ────────
// The evaluation stage abstains on `0, 0`; the derivative stage must too, or
// a gradient question whose answer is 0 names a listed line the first mistake.
{
  const g = generateQuestion('y11-diff', 3, 1010);
  eq([g.stepcheck?.kind, g.answer?.value], ['plan', 0], 'y11-diff seed 1010: a gradient plan whose answer is 0');
  for (const listed of ['0, 0', '0,0', '5, 5']) {
    const r = stepCheck(g.stepcheck, listed, { prompt: g.prompt });
    eq(r.lines[0].status, 'note', `y11-diff seed 1010: "${listed}" lists values and is not judged`);
  }
}

// ── methodMarks alone agrees with the server path ────────────────────────────
{
  const m = methodMarks({ meta: D2.stepcheck, working: ['S_n = n/2 (2a + (n-1)d)', 'S_18 = 18/2 (2 × 20 + 17 × 3)', '= 829'].join('\n'), marks: 2, prompt: D2.prompt });
  eq([m.awarded, m.lines.map(l => l.mark)], [1, [1, 0, 0]], 'methodMarks: one mark on the formula line, the substitution capped, the slip nothing');
  ok(m.lines.reduce((s, l) => s + l.mark, 0) === m.awarded, 'methodMarks: the per-line marks sum to the award');
}

if (failures.length) {
  console.error(`AP FIRST ERROR + ECF: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`AP FIRST ERROR + ECF: PASS — ${pass}/${pass} checks — the first wrong line is named with the right arithmetic, method marks earned before it stay and error is carried forward once, the answer mark is never paid for a wrong answer, and padding, reversed equalities, copied questions, restated givens, bare values, sweeps and the last term alone earn nothing.`);
