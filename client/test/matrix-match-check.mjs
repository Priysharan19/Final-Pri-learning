// Matrix-match and multiple-correct marking: deterministic, row by row, and
// never crediting a malformed or near-miss response.
// Run: node client/test/matrix-match-check.mjs
import { markMatrixMatch, readMatrixGrid, checkMatrixMatch, matrixKey } from '../src/engine/matrixMatch.js';
import { markMultiCorrect } from '../src/engine/indiaExams.js';
import { checkAnswer } from '../src/engine/checker.js';
import { markResponse } from '../../server/platform/markerOps.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass += 1; else { fail += 1; console.error('FAIL', label); } };

const KEY = { rows: ['P', 'Q', 'R', 'S'], columns: ['1', '2', '3', '4', '5'], pairs: { P: ['2'], Q: ['1', '4'], R: ['3'], S: ['5'] } };
const GRID = { correct: 8, perRow: 2, incorrectRow: 0, unanswered: 0 };

// ── Group 1: row-by-row marks ──
const m = raw => markMatrixMatch(GRID, raw, KEY);
ok(m('P-2, Q-1 4, R-3, S-5').awarded === 8 && m('P-2, Q-1 4, R-3, S-5').outcome === 'full', 'all rows → full');
ok(m({ P: ['2'], Q: '4,1', R: ['3'], S: ['5'] }).outcome === 'full', 'object grid, order-free');
ok(m('p→2; q->4,1; r:3; s=5').outcome === 'full', 'separators and case');
ok(m('P-2, Q-1, R-3, S-5').awarded === 6, 'Q missing a column → that row earns nothing');
ok(m('P-2, Q-1 4 5, R-3, S-5').awarded === 6, 'Q with an extra column → that row earns nothing');
ok(m('P-2').awarded === 2 && m('P-2').outcome === 'partial', 'one row answered');
ok(m('P-1, Q-2, R-4, S-3').awarded === 0 && m('P-1, Q-2, R-4, S-3').outcome === 'wrong', 'all wrong');
ok(m('').outcome === 'unanswered' && m('').awarded === 0, 'blank → unanswered');
ok(m('P-1 2 3 4 5, Q-1 2 3 4 5, R-1 2 3 4 5, S-1 2 3 4 5').awarded === 0, 'tick-everything earns nothing');
ok(m('P-2, Q-1 4, R-3, T-5').outcome === 'invalid' && m('P-2, Q-1 4, R-3, T-5').awarded === 0, 'unknown row → invalid');
ok(m('P-2, Q-1 4, R-3, S-9').outcome === 'invalid', 'unknown column → invalid');
ok(m('P is 2').outcome === 'invalid', 'unreadable text → invalid');
ok(m('x'.repeat(401)).outcome === 'invalid', 'overlong → invalid');
ok(markMatrixMatch({ correct: 8, perRow: 2, incorrectRow: -1 }, 'P-2, Q-1, R-1, S-1', KEY).awarded === -1, 'negative wrong-row mark when the grid says so');
ok(markMatrixMatch({ correct: 8, perRow: 2, incorrectRow: 5 }, 'P-1', KEY).awarded === 0, 'a positive wrong-row mark is clamped to 0');
ok(markMatrixMatch({ correct: 8, unanswered: 3 }, '', KEY).awarded === 0, 'a positive unanswered mark is clamped to 0');
let threw = 0;
for (const bad of [{}, { rows: ['P'], columns: ['1'], pairs: {} }, { rows: ['P', 'P'], columns: ['1'], pairs: { P: ['1'] } }, { rows: ['P'], columns: ['1'], pairs: { P: ['9'] } }]) {
  try { matrixKey(bad); } catch { threw += 1; }
}
ok(threw === 4, 'malformed keys refuse to mark');

// ── Group 2: the practice box and the examination pipeline ──
const q = { answerType: 'matrix-match', answer: { matrix: KEY } };
ok(checkAnswer(q, 'P-2, Q-1 4, R-3, S-5').correct === true, 'practice: all rows right');
ok(checkAnswer(q, 'P-2, Q-1 4, R-3, S-4').correct === false, 'practice: one row wrong is wrong');
ok(checkAnswer(q, 'P-2, Q-1 4, R-3, T-5').invalid === true, 'practice: unknown row is unread');
ok(checkAnswer({ answerType: 'matrix-match', answer: {} }, 'P-2').correct === false, 'practice: no key never marks right');
const full = markResponse(q, 'P-2, Q-1 4, R-3, S-5', 'working', GRID);
ok(full.awarded === 8 && full.correct && full.markingScheme === 'objective-per-row', 'exam: full marks');
const part = markResponse(q, 'P-2, Q-4, R-3', 'lots of working', GRID);
ok(part.awarded === 4 && part.outcome === 'partial' && part.partial?.awarded === 4, 'exam: per-row partial, working never adds');
ok(markResponse(q, '', '', GRID).unanswered === true, 'exam: blank');
ok(markResponse({ answerType: 'matrix-match', answer: {} }, 'P-2', '', GRID).awarded === 0, 'exam: missing key earns nothing');

// ── Group 3: false-positive sweep over every possible grid ──
// Each row may pick any subset of the five columns: 32^4 = 1,048,576 grids.
// The engine's mark must equal an independent count of exact rows, and full
// marks must appear only for the key itself.
const subsets = [];
for (let b = 0; b < 32; b += 1) subsets.push(KEY.columns.filter((_, i) => b & (1 << i)));
const exactRow = (row, cols) => cols.length === KEY.pairs[row].length && cols.every(c => KEY.pairs[row].includes(c));
let grids = 0, mismatches = 0, falseFull = 0;
const k = matrixKey(KEY);
for (const a of subsets) for (const b of subsets) for (const c of subsets) for (const d of subsets) {
  const raw = { P: a, Q: b, R: c, S: d };
  const r = markMatrixMatch(GRID, raw, k);
  const answered = [a, b, c, d].filter(x => x.length).length;
  const right = [['P', a], ['Q', b], ['R', c], ['S', d]].filter(([row, x]) => x.length && exactRow(row, x)).length;
  const expected = answered ? right * 2 : 0;
  if (r.awarded !== expected) mismatches += 1;
  if (r.outcome === 'full' && right !== 4) falseFull += 1;
  grids += 1;
}
ok(grids === 1048576 && mismatches === 0 && falseFull === 0, `matrix sweep: ${mismatches} mismatches, ${falseFull} false full marks in ${grids}`);
console.log(`matrix-match sweep: ${falseFull} false full marks / ${mismatches} wrong marks in ${grids} grids`);

// ── Group 4: JEE multiple-correct scheme (+4 / +3 / +2 / +1 / 0 / −2) ──
// The scheme as printed: +4 for exactly the correct set; +3 when all four are
// correct and three are chosen; +2 when three or more are correct and two
// correct ones are chosen; +1 when two or more are correct and one correct one
// is chosen; 0 unanswered; −2 otherwise. Checked against markMultiCorrect for
// every correct set and every choice over four options.
const JEE = { correct: 4, partialPerOption: 1, incorrect: -2, unanswered: 0 };
const options = [0, 1, 2, 3];
const sets = []; for (let b = 0; b < 16; b += 1) sets.push(options.filter(i => b & (1 << i)));
let mcCases = 0, mcBad = 0, mcFalseFull = 0;
for (const correct of sets.filter(s => s.length)) for (const chosen of sets) {
  const allRight = chosen.every(i => correct.includes(i));
  let printed;
  if (!chosen.length) printed = 0;
  else if (!allRight) printed = -2;
  else if (chosen.length === correct.length) printed = 4;
  else if (correct.length === 4 && chosen.length === 3) printed = 3;
  else if (correct.length >= 3 && chosen.length === 2) printed = 2;
  else if (correct.length >= 2 && chosen.length === 1) printed = 1;
  else printed = NaN;
  const r = markMultiCorrect(JEE, chosen, correct);
  if (r.awarded !== printed) mcBad += 1;
  if (r.outcome === 'full' && (chosen.length !== correct.length || !allRight)) mcFalseFull += 1;
  mcCases += 1;
}
ok(mcCases === 240 && mcBad === 0 && mcFalseFull === 0, `multi-correct: ${mcBad} disagreements with the printed scheme in ${mcCases}`);
console.log(`multi-correct sweep: ${mcFalseFull} false full marks / ${mcBad} disagreements in ${mcCases} cases`);

console.log(`MATRIX MATCH: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
