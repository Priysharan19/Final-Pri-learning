// Pri Learning · board mock papers ("Pri mock in board format").
//
// Deterministic, no network, no clock. Proves:
//   1. a mock is built only on the CBSE Class X Standard and Class XII
//      reference blueprints, whose structure matches CBSE's published 2025-26
//      sample question papers (5 sections, 38 questions, 80 marks, 180
//      minutes, the internal choices) and which cite those papers; it is
//      always labelled "Pri mock in board format", never an official paper;
//   2. the examiner's margin (markerOps.js examWorkingStage → `script`) changes
//      NO mark: over every Class X / XII generator, a wrong answer with working
//      is marked exactly as the stage was marked before the margin existed;
//   3. margin marks add up to the method marks awarded — never more — and the
//      first-error line is the first line the engine refuted;
//   4. the returned script (mockScript) totals sections, time and per-question
//      first errors from the stored result alone.
import assert from 'node:assert/strict';
import { BOARD_MOCK_BLUEPRINTS, MOCK_LABEL, FREE_SAMPLE_MOCKS, boardMockOf, mockTitleOf, mockSpecOf, scriptLinesOf, mockScript } from '../src/engine/boardMock.js';
import { examAnswerStage, examWorkingStage, markResponse, stepMetaFor } from '../../server/platform/markerOps.js';
import { methodMarks } from '../src/engine/checker.js';
import { indiaScope } from '../src/engine/indiaProduct.js';
import { generateQuestion, loadBanksFor } from '../src/engine/generators/index.js';

let count = 0;
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };

// ── 1. Blueprints and labels ─────────────────────────────────────────────────
eq(BOARD_MOCK_BLUEPRINTS.map(m => [m.track, m.grade, m.variant]), [['cbse', 10, 'standard'], ['cbse', 12, 'standard']], 'mocks are built on CBSE X Standard and XII only');
eq(FREE_SAMPLE_MOCKS, 1, 'the free plan has one sample mock');
for (const sel of [{ track: 'cbse', grade: 10, variant: 'basic' }, { track: 'cbse', grade: 11 }, { track: 'jee-main', grade: 12 }, { track: 'cbse', grade: 9 }, null, {}]) {
  ok(boardMockOf(sel) === null && mockTitleOf(sel) === null && mockSpecOf(sel) === null, `no mock on ${JSON.stringify(sel)}`);
}
const CHOICE = { 10: { B: 2, C: 2, D: 2, E: 3 }, 12: { B: 2, C: 3, D: 2, E: 2 } };
for (const m of BOARD_MOCK_BLUEPRINTS) {
  const spec = mockSpecOf(m);
  ok(spec && spec.track === 'cbse', `${m.id}: the blueprint is released`);
  eq([spec.durationMinutes, spec.totalMarks, spec.sections.reduce((n, s) => n + s.questions, 0)], [180, 80, 38], `${m.id}: 180 minutes, 80 marks, 38 questions`);
  eq(spec.sections.map(s => [s.id, s.questions, s.marksEach, s.marks]), [['A', 20, 1, 20], ['B', 5, 2, 10], ['C', 6, 3, 18], ['D', 4, 5, 20], ['E', 3, 4, 12]], `${m.id}: the sample paper's sections`);
  eq(Object.fromEntries(spec.sections.filter(s => s.internalChoice).map(s => [s.id, s.internalChoice])), CHOICE[m.grade], `${m.id}: the sample paper's internal choices`);
  const sqp = (spec.sources || []).filter(s => s.kind === 'sample-paper');
  ok(sqp.length === 1 && /^https:\/\/cbseacademic\.nic\.in\/web_material\/SQP\//.test(sqp[0].url), `${m.id}: cites CBSE's published sample question paper`);
  ok(spec.authenticity === 'reference-pattern', `${m.id}: a reference pattern, not an official paper`);
  const title = mockTitleOf(m);
  ok(title.startsWith(MOCK_LABEL) && !/official|board paper|cbse paper/i.test(title), `${m.id}: titled "${title}"`);
}
eq(MOCK_LABEL, 'Pri mock in board format', 'the label');

// ── 2. The margin changes no mark ────────────────────────────────────────────
// The stage exactly as it was before the margin was added.
function stageBefore(q, working, grid, stage) {
  if (stage.final) return stage.response;
  const marks = Number(grid.correct);
  const response = { ...stage.response };
  try {
    const method = methodMarks({ meta: stage.meta, working: String(working), marks, prompt: q.prompt });
    if (method && method.awarded > 0) {
      response.awarded = Math.max(0, Math.min(marks - 1, method.awarded));
      response.partial = { okLines: method.okLines, awarded: response.awarded, note: method.note, lost: method.lost };
    }
    response.markingScheme = 'step-marked';
  } catch { /* the final-answer mark stands */ }
  return response;
}
const chapters = [...indiaScope('cbse', 10), ...indiaScope('cbse', 12)];
const gens = [...new Set(chapters.flatMap(c => (c.covers || []).map(x => x.gen)))];
await loadBanksFor(gens);
const workingOf = q => (q.steps || []).map(s => String(s.d ?? s.b ?? '').replace(/\$|\\left|\\right/g, '').split('\n')[0]).filter(Boolean);
let compared = 0, withMargin = 0, refuted = 0;
for (const gen of gens) {
  for (const difficulty of [1, 2, 3, 4]) {
    for (const seed of [11, 29, 47, 83]) {
      let q;
      try { q = generateQuestion(gen, difficulty, seed); } catch { continue; }
      if (!q || !stepMetaFor(q)) continue;
      const lines = workingOf(q);
      if (!lines.length) continue;
      const value = Number(q.answer?.value);
      const wrong = Number.isFinite(value) ? String(value + 7) : '7';
      // The authored working, then a wrong last line; and a slip first.
      for (const working of [[...lines, `x = ${wrong}`].join('\n'), [`${lines[0]} + 1`, ...lines.slice(1)].join('\n')]) {
        for (const marks of [2, 3, 5]) {
          const grid = { correct: marks, incorrect: 0, unanswered: 0 };
          const stage = examAnswerStage(q, wrong, working, grid);
          const before = stageBefore(q, working, grid, stage);
          const after = examWorkingStage(q, working, grid, examAnswerStage(q, wrong, working, grid));
          const { script, ...rest } = after;
          assert.deepEqual(rest, before, `${gen} D${difficulty} #${seed}: the margin changed the marking`);
          compared++;
          if (!script) continue;
          withMargin++;
          const sum = script.lines.reduce((n, l) => n + l.mark, 0);
          assert.equal(sum, after.partial ? after.awarded : 0, `${gen}: margin marks add up to the method marks awarded`);
          assert.ok(script.lines.every(l => ['ok', 'break', 'note', 'unverified'].includes(l.verdict) && l.mark >= 0 && l.text.length <= 160), `${gen}: margin lines are well-formed`);
          assert.ok(script.lines.every(l => l.mark === 0 || l.verdict === 'ok'), `${gen}: only a verified line carries a margin mark`);
          if (script.firstError >= 0) {
            refuted++;
            assert.equal(script.lines[script.firstError].verdict, 'break', `${gen}: the first error is a refuted line`);
            assert.ok(script.lines.slice(0, script.firstError).every(l => l.verdict !== 'break'), `${gen}: and the first one`);
          }
        }
      }
    }
  }
}
ok(compared >= 300, `the margin changed no mark on ${compared} wrong answers with working`);
ok(withMargin >= 100 && refuted >= 50, `margins checked: ${withMargin}, with a first error: ${refuted}`);

// A pinned case: one verified step, then a slip.
const linear = { prompt: 'Solve $3x + 4 = 19$.', answerType: 'numeric', answerPrefix: 'x =', answer: { value: 5 }, difficulty: 3,
  steps: [{ h: 'Subtract 4', b: '3x = 15' }, { h: 'Divide by 3', b: 'x = 5' }] };
const grid3 = { correct: 3, incorrect: 0, unanswered: 0 };
const slip = markResponse(linear, '6', '3x = 15\nx = 6', grid3);
eq([slip.awarded, slip.markingScheme], [1, 'step-marked'], 'one method mark for the verified step');
eq(slip.script, { lines: [{ text: '3x = 15', verdict: 'ok', mark: 1 }, { text: 'x = 6', verdict: 'break', mark: 0 }], firstError: 1, truncated: false }, 'the margin: +1 beside line 1, line 2 the first error');
const early = markResponse(linear, '16/3', '3x = 16\nx = 16/3', grid3);
eq([early.awarded, early.script.firstError, early.script.lines.map(l => l.mark)], [0, 0, [0, 0]], 'a slip on line 1: no margin mark, first error line 1');
const right = markResponse(linear, '5', '3x = 15\nx = 5', grid3);
ok(right.awarded === 3 && !right.script, 'a correct answer is not given a margin it was not marked on');
ok(!markResponse(linear, '', '3x = 15', grid3).script, 'nor a blank one');
ok(!markResponse({ ...linear, answerType: 'mcq', mcqOptions: ['5', '6'], answer: { correctIndex: 0 } }, '1', '3x = 15', { correct: 1, incorrect: 0, unanswered: 0 }).script, 'nor an objective one');

// scriptLinesOf never credits beyond what was awarded.
const capped = scriptLinesOf({ lines: [{ text: 'a', status: 'ok' }, { text: 'b', status: 'ok' }, { text: 'c', status: 'ok' }], firstBreak: -1 },
  { lines: [{ index: 0, mark: 1 }, { index: 1, mark: 1 }, { index: 2, mark: 1 }] }, 2);
eq(capped.lines.map(l => l.mark), [1, 1, 0], 'margin marks stop at the marks awarded (the cap one below full marks)');
// The engine withdrew a rewriting line while a factorisation was held back by
// the cap: the marks awarded stand, and the margin puts them beside verified lines.
const quad = { prompt: 'Solve by factorisation: $(x + 1)(x - 4) = -6$.', answerType: 'set', answer: { values: [1, 2] }, difficulty: 3, steps: [{ h: 'Expand' }, { h: 'Factorise' }] };
const capWorking = 'x^2 - 3x - 4 = -6\nx^2 - 3x + 2 = 0\n(x - 1)(x - 2) = 0\nx = 1 or x = 2\nx = 7';
const capped3 = markResponse(quad, '7', capWorking, grid3);
eq([capped3.awarded, capped3.script.lines.map(l => l.mark), capped3.script.firstError], [2, [1, 0, 1, 0, 0], 4], 'expand, standard form, factorise under a two-mark cap: +1 expand, +1 factorise, first error line 5');
eq(scriptLinesOf({ lines: [] }, null, 0), null, 'no lines, no margin');
eq(scriptLinesOf({ lines: Array.from({ length: 50 }, (_, i) => ({ text: `y = ${i}`, status: 'note' })), firstBreak: 45 }, null, 0).firstError, -1, 'a first error past the shown lines is not pointed at');

// ── 4. The returned script ───────────────────────────────────────────────────
const sections = mockSpecOf({ track: 'cbse', grade: 10 }).sections;
const detail = [
  { id: 'q1', order: 1, section: 'A', marks: 1, awarded: 1, correct: true, ms: 60000, timed: true },
  { id: 'q2', order: 2, section: 'A', marks: 1, awarded: 0, unanswered: true, ms: 5000, timed: true },
  { id: 'q21', order: 21, section: 'B', marks: 2, awarded: 1, correct: false, ms: 240000, timed: true, choiceTaken: 'or', markingScheme: 'step-marked',
    partial: { awarded: 1, note: '1 mark for correct working' }, script: slip.script },
  { id: 'q36', order: 36, section: 'E', multipart: true, marks: 4, awarded: 1, ms: 600000, timed: true, parts: [
    { key: 'i', marks: 1, awarded: 1, correct: true },
    { key: 'iii', marks: 2, awarded: 0, correct: false, script: early.script },
    { key: 'ii', marks: 1, awarded: 0, pending: true }
  ] }
];
const s = mockScript({ detail, title: 'T' }, sections);
eq([s.score, s.total, s.pct, s.label], [3, 80, 3.8, MOCK_LABEL], 'the total is out of the blueprint\'s 80');
eq(s.sections.map(x => [x.id, x.awarded, x.marks, x.ms, x.questions, x.attempted]),
  [['A', 1, 20, 65000, 2, 1], ['B', 1, 10, 240000, 1, 1], ['C', 0, 18, 0, 0, 0], ['D', 0, 20, 0, 0, 0], ['E', 1, 12, 600000, 1, 1]], 'section scores and time per section');
eq(s.totalMs, 905000, 'time on the paper');
ok(s.timed && s.provisional, 'timed, and provisional while a part waits on handwriting');
const q21 = s.questions.find(q => q.order === 21);
eq([q21.outcome, q21.choiceTaken, q21.firstError, q21.margin.map(l => l.mark)], ['part-marks', 'or', { line: 2, text: 'x = 6' }, [1, 0]], 'a question\'s margin and first-error line');
const q36 = s.questions.find(q => q.order === 36);
eq(q36.parts.map(p => p.outcome), ['correct', 'wrong', 'pending'], 'case-study parts');
eq(q36.firstError, { part: 'iii', line: 1, text: '3x = 16' }, 'a case study names the part its first error is in');
eq(s.questions.map(q => q.order), [1, 2, 21, 36], 'questions in paper order');
eq(mockScript(null).total, 0, 'an empty result is an empty script');

console.log(`BOARD MOCK: PASS — ${count} checks (${compared} markings compared, ${withMargin} margins, ${refuted} first errors)`);
