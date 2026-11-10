// Pri Learning · the Board-scheme marks contract (CBSE Sections B–E)
//
// client/src/engine/boardScheme.js carries the Board's own value points with a
// past question and is the only thing that turns them into marks. This check
// proves the contract, including that it can fail:
//   · a scheme is refused unless its points add to the marks, are multiples of
//     ½, end in the answer, and every working point names a line;
//   · ½ points are grouped into whole marks and the award NEVER exceeds what
//     the Board's scheme gives for the same verified points;
//   · only lines stepCheck verifies `ok` earn: a report line that says it came
//     from a model, a note, a break or anything else earns nothing;
//   · the server's practice operation awards a wrong answer's method by the
//     Board scheme from the deterministic step check, and a correct answer the
//     printed marks;
//   · the archive schema refuses a Section B–E record without a scheme, a scheme
//     on a Section A record, a proof (no numeric answer) and a scheme not read
//     from the Board's marking scheme — and every Section B–E record in the
//     archive has every scheme line verified by the engine.
// [SYNTHETIC fixtures — software check, not a human or examiner review]
import assert from 'node:assert/strict';

const SRC = new URL('../src/', import.meta.url).href;
const { boardSchemeProblems, wholeMarkGroups, awardBoardScheme } = await import(`${SRC}engine/boardScheme.js`);
const { awardStepMarks } = await import(`${SRC}engine/cbseMarking.js`);
const { stepCheck, checkAnswer } = await import(`${SRC}engine/checker.js`);
const { validatePyqRecord, pyqPayload } = await import(`${SRC}engine/pyq/pyqSchema.js`);
const { PYQ_RECORDS } = await import(`${SRC}engine/pyq/pyqArchive.js`);
const { MARKER_OPS, marksPossibleFor } = await import('../../server/platform/markerOps.js');

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks += 1; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1; };

// A 3-mark scheme in the Board's shape: ½ + ½ + 1 + ½ + ½ (a fixture, not a past paper).
const SCHEME = [
  { marks: 0.5, point: 'Form the equation', line: '2x + 5 = 11' },
  { marks: 0.5, point: 'Collect terms', line: '2x = 6' },
  { marks: 1, point: 'Solve', line: 'x = 3' },
  { marks: 0.5, point: 'Substitute back', line: '2(3) + 5 = 11' },
  { marks: 0.5, point: 'x = 3', answer: true }
];

// ── 1. The scheme itself ─────────────────────────────────────────────────────
eq(boardSchemeProblems(SCHEME, 3), [], 'a sound scheme has no problems');
ok(boardSchemeProblems(SCHEME, 4).some(p => /add to 3, not 4/.test(p)), 'points that do not add to the marks are refused');
ok(boardSchemeProblems([{ ...SCHEME[0], marks: 0.3 }, ...SCHEME.slice(1)], 3).length > 0, 'a mark that is not a multiple of ½ is refused');
ok(boardSchemeProblems(SCHEME.slice(0, -1), 2.5).length > 0, 'a scheme without a final answer point is refused');
ok(boardSchemeProblems([{ ...SCHEME[0], line: '' }, ...SCHEME.slice(1)], 3).some(p => /no line/.test(p)), 'a working point the engine cannot verify is refused');
ok(boardSchemeProblems([{ ...SCHEME[0], answer: true }, ...SCHEME.slice(1)], 3).some(p => /not last/.test(p)), 'an answer point that is not last is refused');
eq(wholeMarkGroups(SCHEME).map(g => [g.points.join(','), g.marks]), [['0,1', 1], ['2', 1], ['3,4', 1]], '½ + ½ group into one whole mark');

// ── 2. Never above the Board ─────────────────────────────────────────────────
// The Board gives each verified point its own marks; ours gives a group only
// when every point in it is verified. For every number of verified lines and
// both answer verdicts, ours ≤ the Board's, and equal when no group is split.
for (let n = 0; n <= SCHEME.length; n++) {
  for (const correct of [false, true]) {
    const ours = awardBoardScheme({ scheme: SCHEME, okLines: n, correct });
    const board = SCHEME.reduce((s, p, i) => s + (p.answer ? (correct ? p.marks : 0) : (i < n ? p.marks : 0)), 0);
    ok(ours.awarded <= board + 1e-9, `${n} verified lines, correct=${correct}: ${ours.awarded} never above the Board's ${board}`);
    ok(Number.isInteger(ours.awarded) && ours.awarded >= 0 && ours.awarded <= 3, 'whole marks within the question');
  }
}
eq(awardBoardScheme({ scheme: SCHEME, okLines: 4, correct: true }).awarded, 3, 'every point verified and the answer right: full marks');
eq(awardBoardScheme({ scheme: SCHEME, okLines: 0, correct: false }).awarded, 0, 'nothing verified, answer wrong: nothing');

// ── 3. The deterministic engine decides; a model never does ──────────────────
const META = { kind: 'equation', variable: 'x', solutions: [3] };
const working = SCHEME.filter(p => !p.answer).map(p => p.line);
const report = stepCheck(META, working.join('\n'));
eq(report.lines.map(l => l.status), ['ok', 'ok', 'ok', 'ok'], 'every transcribed working line verifies under the record\'s step metadata');
const q = { prompt: 'fixture', answerType: 'numeric', answer: { value: 3 }, marks: 3, boardScheme: SCHEME, stepcheck: META };
eq(awardStepMarks({ question: q, workingLines: working, stepReport: report, answerText: '3', correct: true }).awarded, 3, 'board award with verified lines and a right answer');
eq(awardStepMarks({ question: q, workingLines: working, stepReport: report, answerText: '3', correct: true }).schemeKind, 'board-official-transcribed', 'the award says it is the Board\'s transcribed scheme');
for (const status of ['model', 'ai', 'cloud', 'note', 'break', 'unverified', undefined]) {
  const forged = { lines: working.map(text => ({ status, text, source: 'model', verdict: 'correct' })) };
  eq(awardStepMarks({ question: q, workingLines: working, stepReport: forged, answerText: '7', correct: false }).awarded, 0, `a report line with status ${status} earns nothing`);
}

// ── 4. The server's practice operation ───────────────────────────────────────
eq(marksPossibleFor(q), 3, 'the question is worth the marks the Board printed');
const run = (answer, work) => MARKER_OPS.practice({ q, answer, working: work, evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
const wrong = run('4', working.slice(0, 3).join('\n'));
eq(wrong.result.correct, false, 'a wrong answer is wrong');
eq(wrong.evidence.partial.awarded, 2, 'three verified lines earn the two whole method groups they complete (Board: 2)');
ok(wrong.evidence.partial.boardScheme === true, 'the partial says it came from the Board scheme');
const half = run('4', working.slice(0, 1).join('\n'));
ok(!half.evidence.partial || half.evidence.partial.awarded === 0, 'one verified ½ point does not round up to a mark');
const right = run('3', working.join('\n'));
eq(right.result.correct, true, 'the right answer is credited by checkAnswer');
eq(checkAnswer(q, '3').correct, true, 'and checkAnswer is the authority on the final answer');

// ── 5. The archive schema ────────────────────────────────────────────────────
const base = { ...PYQ_RECORDS.find(r => r.examId === 'cbse-class-10') };
for (const k of ['chapterName', 'track']) delete base[k];
const stepped = {
  ...base, id: 'fixture-section-c', section: 'Section C', answerType: 'numeric', answer: { value: 3 },
  mcqOptions: undefined, marks: 3, boardScheme: SCHEME, stepcheck: META
};
const accepts = (rec, label) => { validatePyqRecord(rec); checks += 1; void label; };
const refuses = (rec, label) => { assert.throws(() => validatePyqRecord(rec), undefined, label); checks += 1; };
accepts(stepped, 'a sound Section C record');
refuses({ ...stepped, boardScheme: undefined, marks: undefined }, 'a Section C record without the Board scheme');
refuses({ ...stepped, answerType: 'mcq', mcqOptions: ['1', '2', '3', '4'], answer: { correctIndex: 0 } }, 'a Section C record with no numeric answer (a proof stays out)');
refuses({ ...stepped, stepcheck: undefined }, 'a Section C record with no step metadata');
refuses({ ...stepped, answerSource: [].concat(stepped.promptSource).filter(id => /questions$/.test(id)) }, 'a scheme not read from the Board\'s marking scheme');
refuses({ ...base, boardScheme: SCHEME, marks: 3 }, 'a Section A record carrying a scheme');
const payload = pyqPayload(validatePyqRecord(stepped));
eq([payload.marks, payload.boardScheme.length, !!payload.stepcheck], [3, 5, true], 'the payload carries marks, scheme and step metadata to the server');

// Every Section B–E record in the archive: each scheme line is verified by the
// engine, all of them together earn full method, and the key is a solution.
const real = PYQ_RECORDS.filter(r => Array.isArray(r.boardScheme));
for (const r of real) {
  const lines = r.boardScheme.filter(p => !p.answer).map(p => p.line);
  const rep = stepCheck(r.stepcheck, lines.join('\n'), { prompt: r.prompt });
  eq(rep.lines.map(l => l.status), lines.map(() => 'ok'), `${r.id}: every Board point's line is verified by the engine`);
  ok(r.stepcheck.solutions.some(s => Math.abs(s - r.answer.value) < 1e-9), `${r.id}: the keyed answer is a solution of the step metadata`);
  // End to end on the server's practice operation, with the real payload.
  const pq = pyqPayload(r);
  eq(marksPossibleFor(pq), r.marks, `${r.id}: worth the Board's printed marks`);
  const right = MARKER_OPS.practice({ q: pq, answer: String(r.answer.value), working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
  eq(right.result.correct, true, `${r.id}: the keyed answer is credited by checkAnswer`);
  const wrongR = MARKER_OPS.practice({ q: pq, answer: String(r.answer.value + 1), working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
  const board = r.boardScheme.filter(p => !p.answer).reduce((s, p) => s + p.marks, 0);
  ok((wrongR.evidence?.partial?.awarded ?? 0) <= board, `${r.id}: a wrong answer's method marks never exceed the Board's method marks`);
}

console.log(`BOARD SCHEME CONTRACT: PASS — ${checks}/${checks} checks — Board value points carried in whole-mark groups, never above the Board; only lines the deterministic step check verifies earn; no model verdict sets a mark; ${real.length} Section B–E archive records, every scheme line engine-verified. [SYNTHETIC fixtures]`);
