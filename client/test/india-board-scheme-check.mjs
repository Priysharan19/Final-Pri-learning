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
//   · lines match points one-to-one and in order: each line earns at most one
//     point, a point only by its own line as written, and the same line written
//     again — `x = 3` four times — earns nothing more (D25 review of #844),
//     on the client display path and on the server practice operation;
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
const { boardSchemeProblems, wholeMarkGroups, awardBoardScheme, matchBoardPoints } = await import(`${SRC}engine/boardScheme.js`);
const { awardStepMarks } = await import(`${SRC}engine/cbseMarking.js`);
const { stepCheck, checkAnswer } = await import(`${SRC}engine/checker.js`);
const { validatePyqRecord, pyqPayload } = await import(`${SRC}engine/pyq/pyqSchema.js`);
const { PYQ_RECORDS } = await import(`${SRC}engine/pyq/pyqArchive.js`);
const { MARKER_OPS, marksPossibleFor, practiceMarksEarned, markResponse } = await import('../../server/platform/markerOps.js');

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks += 1; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1; };

// A 3-mark scheme in the Board's shape: ½ + ½ + 1 + ½ + ½ (a fixture, not a past paper).
const SCHEME = [
  { marks: 0.5, point: 'Form the equation', line: '4x + 10 = 22' },
  { marks: 0.5, point: 'Halve both sides', line: '2x + 5 = 11' },
  { marks: 1, point: 'Collect terms', line: '2x = 6' },
  { marks: 0.5, point: 'Substitute back', line: '2(3) + 5 = 11' },
  { marks: 0.5, point: 'x = 3', answer: true }
];
const META = { kind: 'equation', variable: 'x', solutions: [3] };

// ── 1. The scheme itself ─────────────────────────────────────────────────────
eq(boardSchemeProblems(SCHEME, 3), [], 'a sound scheme has no problems');
ok(boardSchemeProblems(SCHEME, 4).some(p => /add to 3, not 4/.test(p)), 'points that do not add to the marks are refused');
ok(boardSchemeProblems([{ ...SCHEME[0], marks: 0.3 }, ...SCHEME.slice(1)], 3).length > 0, 'a mark that is not a multiple of ½ is refused');
ok(boardSchemeProblems(SCHEME.slice(0, -1), 2.5).length > 0, 'a scheme without a final answer point is refused');
ok(boardSchemeProblems([{ ...SCHEME[0], line: '' }, ...SCHEME.slice(1)], 3).some(p => /no line/.test(p)), 'a working point the engine cannot verify is refused');
ok(boardSchemeProblems([{ ...SCHEME[0], answer: true }, ...SCHEME.slice(1)], 3).some(p => /not last/.test(p)), 'an answer point that is not last is refused');
ok(boardSchemeProblems([SCHEME[0], { ...SCHEME[1], line: 'x = 3' }, ...SCHEME.slice(2)], 3, META).some(p => /only states the final value/.test(p)), 'a working point whose line is only the final value is refused');
ok(boardSchemeProblems([SCHEME[0], { ...SCHEME[1], line: '4x + 10 = 22' }, ...SCHEME.slice(2)], 3, META).some(p => /share the line/.test(p)), 'two working points with the same line are refused');
ok(boardSchemeProblems([SCHEME[0], { ...SCHEME[1], line: '22 = 4x + 10' }, ...SCHEME.slice(2)], 3, META).some(p => /share the line/.test(p)), 'two working points with the same line written differently are refused');
eq(wholeMarkGroups(SCHEME).map(g => [g.points.join(','), g.marks]), [['0,1', 1], ['2', 1], ['3,4', 1]], '½ + ½ group into one whole mark');

// ── 2. Never above the Board ─────────────────────────────────────────────────
// The Board gives each verified point its own marks; ours gives a group only
// when every point in it is ticked. For every set of ticked working points and
// both answer verdicts, ours ≤ the Board's.
const W = SCHEME.length - 1;
for (let mask = 0; mask < (1 << W); mask++) {
  const ticked = SCHEME.map((p, i) => !p.answer && !!(mask & (1 << i)));
  for (const correct of [false, true]) {
    const ours = awardBoardScheme({ scheme: SCHEME, ticked, correct });
    const board = SCHEME.reduce((s, p, i) => s + (p.answer ? (correct ? p.marks : 0) : (ticked[i] ? p.marks : 0)), 0);
    ok(ours.awarded <= board + 1e-9, `ticked ${mask.toString(2)}, correct=${correct}: ${ours.awarded} never above the Board's ${board}`);
    ok(Number.isInteger(ours.awarded) && ours.awarded >= 0 && ours.awarded <= 3, 'whole marks within the question');
  }
}
const all = SCHEME.map(p => !p.answer);
eq(awardBoardScheme({ scheme: SCHEME, ticked: all, correct: true }).awarded, 3, 'every point ticked and the answer right: full marks');
eq(awardBoardScheme({ scheme: SCHEME, ticked: SCHEME.map(() => false), correct: false }).awarded, 0, 'nothing ticked, answer wrong: nothing');
assert.throws(() => awardBoardScheme({ scheme: SCHEME, okLines: 4, correct: false }), /not a count/, 'a count of verified lines is refused as an input'); checks += 1;

// ── 2b. One line, one point, in order ────────────────────────────────────────
const okRows = texts => texts.map(text => ({ status: 'ok', text }));
const match = texts => matchBoardPoints({ scheme: SCHEME, lines: okRows(texts), meta: META });
eq(match(['x = 3', 'x = 3', 'x = 3', 'x = 3']), [false, false, false, false, false], 'x = 3 four times ticks no working point');
eq(match(['2x = 6', '2x = 6', '2x = 6', '2x = 6']), [false, false, true, false, false], 'one point\'s line four times ticks that point once');
eq(match(['4x + 10 = 22', '4x + 10 = 22']), [true, false, false, false, false], 'a line written twice earns one point, not two');
eq(match(['2x = 6', '4x + 10 = 22']), [false, false, true, false, false], 'a point above the last one ticked is not matched (in order)');
eq(match(['22 = 10 + 4x', '2x+5=11', '2x = 6 + 0', '2(3)+5=11']), [true, true, true, true, false], 'the Board\'s lines as written — reordered, swapped, padded — tick every point');
eq(match(['x - 3 = 0', '3x = 9', '6x = 18']), [false, false, false, false, false], 'other correct lines are not the Board\'s points');
for (const [label, texts, correct, expected] of [
  ['x = 3 ×4, wrong answer', ['x = 3', 'x = 3', 'x = 3', 'x = 3'], false, 0],
  ['x = 3 ×4, right answer', ['x = 3', 'x = 3', 'x = 3', 'x = 3'], true, 0],
  ['2x = 6 ×4, wrong answer', ['2x = 6', '2x = 6', '2x = 6', '2x = 6'], false, 1]
]) {
  const a = awardBoardScheme({ scheme: SCHEME, ticked: match(texts), correct });
  eq(a.method, expected, `${label}: ${expected} method marks`);
}

// ── 3. The deterministic engine decides; a model never does ──────────────────
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
for (const [answer, correct] of [['4', false], ['3', true]]) {
  const dup = ['x = 3', 'x = 3', 'x = 3', 'x = 3'];
  const dupReport = stepCheck(META, dup.join('\n'));
  eq(dupReport.lines.map(l => l.status), ['ok', 'ok', 'ok', 'ok'], 'the step check verifies every copy of x = 3 (so a count would credit them)');
  const client = awardStepMarks({ question: q, workingLines: dup, stepReport: dupReport, answerText: answer, correct });
  eq(client.awarded - client.rows[client.rows.length - 1].earned, 0, `client: x = 3 written four times earns no method mark (answer ${answer})`);
  const server = run(answer, dup.join('\n'));
  ok(!server.evidence?.partial || server.evidence.partial.awarded === 0, `server: x = 3 written four times earns no method mark (answer ${answer})`);
}
const twice = run('4', [working[0], working[0], working[1], working[1]].join('\n'));
eq(twice.evidence.partial.awarded, 1, 'server: the first two points\' lines each written twice earn their one group (Board: 1), not four points\' worth');
const fourDup = run('4', [working[2], working[2], working[2], working[2]].join('\n'));
eq(fourDup.evidence.partial.awarded, 1, 'server: one point\'s line written four times earns that one point\'s group only');
// A right answer is marked by the Board scheme too, on the server's practice
// and exam paths: the printed marks only with every point's own line.
const GRID = { correct: 3, incorrect: 0, unanswered: 0 };
const practiceMarks = (answer, work) => { const r = run(answer, work); return practiceMarksEarned(q, r.result, r.evidence, marksPossibleFor(q)); };
for (const [label, work, expected] of [
  ['the Board\'s working', working.join('\n'), 3],
  ['no working', '', 0],
  ['junk working', 'hello\nwhatever\n= = =', 0],
  ['x = 3 four times', 'x = 3\nx = 3\nx = 3\nx = 3', 0],
  ['the first point\'s line four times', Array(4).fill(working[0]).join('\n'), 0],
  ['the first two points\' lines', working.slice(0, 2).join('\n'), 1]
]) {
  eq(practiceMarks('3', work), expected, `server practice, right answer with ${label}: ${expected}/3`);
  eq(markResponse(q, '3', work, GRID).awarded, expected, `server exam, right answer with ${label}: ${expected}/3`);
}
eq(markResponse(q, '4', 'x = 3\nx = 3\nx = 3\nx = 3', GRID).awarded, 0, 'server exam, wrong answer with x = 3 four times: 0');
eq(markResponse(q, '4', working.slice(0, 3).join('\n'), GRID).awarded, 2, 'server exam, wrong answer with the first three points\' lines: 2');
eq(practiceMarksEarned(q, { correct: true }, null, 3), 0, 'no deterministic Board award, no mark — never the printed marks by default');
// The client pairs step-check verdicts with written lines by text, not position.
const shuffled = { lines: [...report.lines].reverse() };
eq(awardStepMarks({ question: q, workingLines: working, stepReport: shuffled, answerText: '3', correct: true }).awarded, 3, 'client: verdicts in another order still pair with their own lines');
const shifted = { lines: [{ status: 'ok', text: 'x = 3' }, ...report.lines.slice(0, 3).map(l => ({ ...l, status: 'break' }))] };
eq(awardStepMarks({ question: q, workingLines: working, stepReport: shifted, answerText: '4', correct: false }).awarded, 0, 'client: an ok verdict for another line\'s text earns nothing');
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
}

console.log(`BOARD SCHEME CONTRACT: PASS — ${checks}/${checks} checks — Board value points carried in whole-mark groups, never above the Board; only lines the deterministic step check verifies earn, matched to points one-to-one and in order; no model verdict sets a mark; ${real.length} Section B–E archive records, every scheme line engine-verified. [SYNTHETIC fixtures]`);
