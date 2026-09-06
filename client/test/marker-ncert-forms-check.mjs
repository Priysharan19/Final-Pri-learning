// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT/JEE answer-form contract
//
// A student writing NCERT maths does not answer in a numeric box. They write
// "{10, 12}" for a solution set, "2 < x ≤ 5" or "(2, 5]" for the solution of an
// inequality, "[[1, 2], [3, 4]]" for a matrix and "i − 2j + 3k" for a vector,
// and they use n!, nCr, sec, cosec and cot in expressions. This suite pins what
// the marker accepts, and — just as important — what it must still refuse, so a
// wrong answer can never be marked right by a more forgiving parser.
//
// Every case is authored. Nothing here is generated, so a failure names one
// concrete way of writing maths that stopped working.
// ─────────────────────────────────────────────────────────────────────────────
import { checkAnswer } from '../src/engine/checker.js';
import {
  parseIntervalInput, parseMatrixInput, parseVectorInput,
  sameRegion, sameMatrix, sameVector, formatRegion, formatVector, formatMatrix
} from '../src/engine/answer-forms.js';
import { evalNumeric } from '../src/engine/expr.js';

let pass = 0;
const failures = [];
function ok(cond, label) {
  if (cond) pass++;
  else failures.push(label);
}
function correct(question, input, label) {
  const verdict = checkAnswer(question, input);
  ok(verdict.correct === true, `${label} — expected correct, got ${verdict.correct} (${verdict.feedback || verdict.reason || ''})`);
}
function wrong(question, input, label) {
  const verdict = checkAnswer(question, input);
  ok(verdict.correct === false, `${label} — expected wrong, got correct`);
}

// ── 1. Solution sets, the way NCERT writes them ──────────────────────────────
// "The zeroes of the polynomial are …" is answered as a set, in any order, with
// or without braces, and often as "x = 3 or x = −2".
const zeroes = { answerType: 'set', answer: { values: [-2, 3] } };
for (const [input, label] of [
  ['{-2, 3}', 'braces in order'],
  ['{3, -2}', 'braces reversed'],
  ['{3,-2}', 'no spaces'],
  ['{ 3 , -2 }', 'loose spaces'],
  ['3, -2', 'bare list'],
  ['-2 , 3', 'bare list in order'],
  ['x = 3 or x = -2', 'named unknown with or'],
  ['x ∈ {-2, 3}', 'set membership'],
  ['S = {-2, 3}', 'named set'],
  ['{3, −2}', 'unicode minus'],
]) correct(zeroes, input, `set: ${label}`);
wrong(zeroes, '{3}', 'set: a subset is not the set');
wrong(zeroes, '{-2, 3, 5}', 'set: a superset is not the set');
wrong(zeroes, '{2, -3}', 'set: sign errors are wrong');

const emptySet = { answerType: 'set', answer: { values: [] } };
for (const [input, label] of [['{}', 'empty braces'], ['∅', 'empty-set symbol'], ['φ', 'phi as NCERT prints it']])
  correct(emptySet, input, `empty set: ${label}`);
wrong(emptySet, '{0}', 'empty set: zero is not nothing');

const singleton = { answerType: 'set', answer: { values: [7] } };
correct(singleton, '{7}', 'set: singleton in braces');
correct(singleton, '7', 'set: singleton bare');
correct(singleton, '14/2', 'set: singleton as an exact fraction');

// ── 2. Inequalities and intervals are interchangeable ────────────────────────
// Class 11 linear inequalities are answered either way, and a student who
// writes the interval must not be marked down for it.
const halfLine = { answerType: 'interval', answer: { region: 'x > 3' } };
for (const [input, label] of [
  ['x > 3', 'inequality'],
  ['x>3', 'no spaces'],
  ['3 < x', 'variable on the right'],
  ['(3, ∞)', 'interval with infinity'],
  ['(3, inf)', 'ascii infinity'],
  ['x ∈ (3, ∞)', 'membership'],
  ['{x : x > 3}', 'set-builder with colon'],
  ['{x | x > 3}', 'set-builder with bar'],
  ['{x in R : x > 3}', 'set-builder over the reals'],
]) correct(halfLine, input, `interval: ${label}`);
wrong(halfLine, 'x >= 3', 'interval: a closed endpoint is a different set');
wrong(halfLine, 'x < 3', 'interval: the wrong side is wrong');
wrong(halfLine, '(3, 10)', 'interval: a bounded piece is not the half-line');

const band = { answerType: 'interval', answer: { region: '2 < x <= 5' } };
for (const [input, label] of [
  ['2 < x <= 5', 'chained inequality'],
  ['2 < x ≤ 5', 'unicode ≤'],
  ['(2, 5]', 'half-open interval'],
  ['x ∈ (2, 5]', 'membership'],
  ['5 >= x > 2', 'written right to left'],
]) correct(band, input, `interval: ${label}`);
wrong(band, '[2, 5]', 'interval: both endpoints closed is a different set');
wrong(band, '(2, 5)', 'interval: both endpoints open is a different set');

const union = { answerType: 'interval', answer: { region: 'x < 1 or x > 4' } };
for (const [input, label] of [
  ['x < 1 or x > 4', 'or'],
  ['(-∞, 1) ∪ (4, ∞)', 'union of intervals'],
  ['(-inf, 1) U (4, inf)', 'ascii union'],
]) correct(union, input, `interval: ${label}`);
wrong(union, '1 < x < 4', 'interval: the complement is wrong');

const allReals = { answerType: 'interval', answer: { region: 'x ∈ R' } };
correct(allReals, 'R', 'interval: all reals as R');
correct(allReals, '(-∞, ∞)', 'interval: all reals as an interval');

// Unreadable input is refused with help, never guessed into a mark.
const nonsense = checkAnswer(halfLine, 'somewhere above three');
ok(nonsense.correct === false, 'interval: prose is not marked correct');
ok(/x > 3|solution set/i.test(nonsense.feedback || ''), 'interval: unreadable input explains the accepted forms');

// ── 3. Matrices ──────────────────────────────────────────────────────────────
const matrix = { answerType: 'matrix', answer: { rows: [[1, 2], [3, 4]] } };
for (const [input, label] of [
  ['[[1, 2], [3, 4]]', 'nested brackets'],
  ['[[1,2],[3,4]]', 'no spaces'],
  ['1 2; 3 4', 'semicolon rows'],
  ['1 2\n3 4', 'newline rows'],
  ['\\begin{pmatrix}1 & 2\\\\3 & 4\\end{pmatrix}', 'LaTeX pmatrix'],
  ['\\begin{bmatrix}1 & 2\\\\3 & 4\\end{bmatrix}', 'LaTeX bmatrix'],
]) correct(matrix, input, `matrix: ${label}`);
wrong(matrix, '[[1, 3], [2, 4]]', 'matrix: the transpose is a different matrix');
wrong(matrix, '[[1, 2, 0], [3, 4, 0]]', 'matrix: wrong order is wrong');
wrong(matrix, '[[1, 2], [3, 5]]', 'matrix: one wrong entry is wrong');
ok(sameMatrix(parseMatrixInput('1 2; 3 4').rows, [[1, 2], [3, 4]]), 'matrix: semicolon rows parse to the same rows');
ok(formatMatrix([[1, 2], [3, 4]]).includes('1'), 'matrix: formats for feedback');

const fractionMatrix = { answerType: 'matrix', answer: { rows: [[0.5, -1], [2, 0]] } };
correct(fractionMatrix, '[[1/2, -1], [2, 0]]', 'matrix: exact fractions are evaluated');

// ── 4. Vectors ───────────────────────────────────────────────────────────────
const vector = { answerType: 'vector', answer: { components: [1, -2, 3] } };
for (const [input, label] of [
  ['(1, -2, 3)', 'component triple'],
  ['<1, -2, 3>', 'angle brackets'],
  ['i - 2j + 3k', 'ijk form'],
  ['i − 2j + 3k', 'ijk with unicode minus'],
  ['1i-2j+3k', 'ijk with explicit leading one'],
  ['î - 2ĵ + 3k̂', 'hatted unit vectors'],
  ['\\hat{i} - 2\\hat{j} + 3\\hat{k}', 'LaTeX hats'],
]) correct(vector, input, `vector: ${label}`);
wrong(vector, '(1, 2, 3)', 'vector: a sign error is wrong');
wrong(vector, '(3, -2, 1)', 'vector: component order matters');
wrong(vector, 'i - 2j', 'vector: a missing component is wrong');
ok(sameVector(parseVectorInput('i - 2j + 3k').components, [1, -2, 3]), 'vector: ijk parses to components');
ok(formatVector([1, -2, 3]).includes('i'), 'vector: formats for feedback');

const planeVector = { answerType: 'vector', answer: { components: [0, 5] } };
correct(planeVector, '5j', 'vector: a single ijk term in the plane');
correct(planeVector, '(0, 5)', 'vector: zero component written out');

// ── 5. Expression vocabulary: factorial, nCr/nPr, sec/cosec/cot ──────────────
const vocabulary = [
  ['5!', 120, 'factorial'],
  ['0!', 1, 'zero factorial'],
  ['3! + 2!', 8, 'factorials in a sum'],
  ['(3!)^2', 36, 'factorial under a power'],
  ['nCr(5, 2)', 10, 'nCr function form'],
  ['C(5, 2)', 10, 'C(n, r) form'],
  ['5C2', 10, 'nCr juxtaposed as NCERT prints it'],
  ['nPr(5, 2)', 20, 'nPr function form'],
  ['5P2', 20, 'nPr juxtaposed'],
  ['sec(0)', 1, 'sec'],
  ['cosec(pi/2)', 1, 'cosec'],
  ['csc(pi/2)', 1, 'csc spelling'],
  ['cot(pi/4)', 1, 'cot'],
  ['sec(pi/3)', 2, 'sec at a standard angle'],
];
for (const [source, expected, label] of vocabulary) {
  let value = null;
  try { value = evalNumeric(source); } catch { value = null; }
  ok(value !== null && Math.abs(value - expected) < 1e-9, `vocabulary: ${label} — "${source}" evaluated to ${value}, expected ${expected}`);
}

// The vocabulary reaches the marker, not just the evaluator.
const combinatorics = { answerType: 'numeric', answer: { value: 10 } };
correct(combinatorics, '5C2', 'vocabulary: nCr answers a numeric question');
correct(combinatorics, '5!/(2!*3!)', 'vocabulary: the factorial definition of the same number');
wrong(combinatorics, '5P2', 'vocabulary: a permutation is not a combination');

const trig = { answerType: 'numeric', answer: { value: 2 } };
correct(trig, 'sec(pi/3)', 'vocabulary: sec answers a numeric question');
correct(trig, '1/cos(pi/3)', 'vocabulary: the reciprocal written out');

// ── 6. Restating the question earns nothing ──────────────────────────────────
// A student who copies the question back has shown no working. This is the
// partial-credit safety rule: it must hold wherever method marks are awarded.
const restated = checkAnswer({ answer: { type: 'numeric', value: 12 }, prompt: 'Solve 2x + 4 = 28' }, '2x + 4 = 28');
ok(restated.correct === false, 'partial credit: restating the question is not a correct answer');

console.log(failures.length
  ? `NCERT ANSWER FORMS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `NCERT ANSWER FORMS: PASS — ${pass}/${pass} checks — solution sets, inequality/interval equivalence, matrices, vectors and the n!/nCr/nPr/sec/cosec/cot vocabulary.`);
process.exit(failures.length ? 1 : 0);
