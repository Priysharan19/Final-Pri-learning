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

// ── 6. Indian money: a rupee answer to a rupee question ─────────────────────
// The product is India-first. A student who answers "₹9.75" to a question
// priced in rupees has answered it. The dollar sign was already read; the
// rupee had no reading at all.
const rupees = {
  answerType: 'numeric',
  answer: { value: 9.75 },
  prompt: 'One item costs ₹3.25. What is the cost of $3$ identical items?'
};
for (const [input, label] of [
  ['9.75', 'the bare number'],
  ['₹9.75', 'rupee sign, no space'],
  ['₹ 9.75', 'rupee sign with a space'],
  ['Rs 9.75', 'Rs as NCERT prints it'],
  ['Rs. 9.75', 'Rs. with the full stop'],
  ['rs 9.75', 'lower-case rs'],
  ['INR 9.75', 'the currency code'],
  ['9.75 rupees', 'the word after the number'],
  ['9.75 Rupees', 'the word capitalised'],
  ['$9.75', 'the dollar sign still works'],
]) correct(rupees, input, `money: ${label}`);
wrong(rupees, '₹9.85', 'money: a rupee sign does not make a wrong number right');
wrong(rupees, '₹', 'money: a currency sign alone is not an answer');
wrong(rupees, 'rupees', 'money: the word alone is not an answer');

const paise = { answerType: 'numeric', answer: { value: 50 }, prompt: 'How many paise are there in half a rupee?' };
correct(paise, '50 paise', 'money: paise as the trailing unit');
correct(paise, '50', 'money: a paise question answered bare');
wrong(paise, '60 paise', 'money: a paise unit does not rescue a wrong number');

// ── 7. Fractions: the form is a demand only when the question makes it ───────
// `simplestFraction` is how a generator states the canonical fraction. It is a
// display hint, not a licence to refuse the exact decimal of a question that
// never asked for a fraction.
const asksFraction = {
  answerType: 'numeric',
  answer: { value: 0.25, simplestFraction: { n: 1, d: 4 } },
  prompt: 'Simplify $\\dfrac{3}{12}$ fully. Give your answer as a fraction in simplest form.'
};
for (const [input, label] of [
  ['1/4', 'the canonical form'],
  ['1 / 4', 'loose spaces'],
  ['+1/4', 'a leading plus'],
  ['1/4.', 'a trailing full stop'],
  ['(1)/(4)', 'handwritten brackets'],
]) correct(asksFraction, input, `fraction asked: ${label}`);
wrong(asksFraction, '2/8', 'fraction asked: an unsimplified equivalent is not simplest form');
wrong(asksFraction, '0.25', 'fraction asked: the decimal is refused when the question asked for a fraction');
wrong(asksFraction, '1/5', 'fraction asked: a wrong fraction is wrong');

const negativeFraction = {
  answerType: 'numeric',
  answer: { value: -1.4, simplestFraction: { n: -7, d: 5 } },
  prompt: 'Solve $5x+7=0$ exactly. Give the answer as a fraction in simplest form.'
};
for (const [input, label] of [
  ['-7/5', 'ascii minus'],
  ['−7/5', 'unicode minus, as the iPad ink and cloud OCR produce it'],
  ['- 7/5', 'a space after the minus'],
  ['-7/5.', 'a trailing full stop'],
  ['(-7)/(5)', 'handwritten brackets'],
  ['-1 2/5', 'the mixed numeral'],
  ['−1 2/5', 'the mixed numeral with a unicode minus'],
]) correct(negativeFraction, input, `negative fraction: ${label}`);
wrong(negativeFraction, '7/5', 'negative fraction: the sign still matters');
wrong(negativeFraction, '−14/10', 'negative fraction: unsimplified is still unsimplified');

// A question that never asks for a fraction must accept its own exact decimal.
const neverAsked = {
  answerType: 'numeric',
  answer: { value: 0.5, simplestFraction: { n: 1, d: 2 } },
  prompt: 'A line has gradient $-2$. What is the gradient of a line **perpendicular** to it?'
};
correct(neverAsked, '0.5', 'no fraction asked: the exact decimal is the answer');
correct(neverAsked, '.5', 'no fraction asked: the decimal without a leading zero');
correct(neverAsked, '0.50', 'no fraction asked: a trailing zero');
correct(neverAsked, '1/2', 'no fraction asked: the fraction still works');
wrong(neverAsked, '2', 'no fraction asked: the wrong value is still wrong');
wrong(neverAsked, '-0.5', 'no fraction asked: the wrong sign is still wrong');
wrong(neverAsked, '2/4', 'no fraction asked: an unsimplified fraction still asks to be simplified');

const repeating = {
  answerType: 'numeric',
  answer: { value: 25 / 3, simplestFraction: { n: 25, d: 3 } },
  prompt: 'Find the distance from the point $(-6, -4, -5)$ to the plane $x + 2y + 2z - 1 = 0$.'
};
correct(repeating, '25/3', 'no fraction asked: the exact fraction');
correct(repeating, String(25 / 3), 'no fraction asked: the exact decimal');
wrong(repeating, '8.3333', 'no fraction asked: a rounded decimal is not the exact value');
wrong(repeating, '8.33', 'no fraction asked: a coarsely rounded decimal is wrong');

// An author who really does want the fraction says so.
const requiredFraction = {
  answerType: 'numeric',
  answer: { value: 0.5, simplestFraction: { n: 1, d: 2 }, requireFraction: true },
  prompt: 'What is the gradient of a perpendicular line?'
};
correct(requiredFraction, '1/2', 'requireFraction: the fraction is accepted');
wrong(requiredFraction, '0.5', 'requireFraction: the decimal is refused when the author demanded the form');

// ── 8. A blank answer is never a correct answer ──────────────────────────────
// Number('') is 0, so every MCQ keyed to option 0 marked an empty submission
// right. Nothing typed can never be right.
const mcqZero = {
  answerType: 'mcq',
  mcqOptions: ['Even', 'Odd', 'Neither even nor odd'],
  answer: { correctIndex: 0 }
};
correct(mcqZero, '0', 'mcq: the keyed index');
correct(mcqZero, 0, 'mcq: the keyed index as a number');
correct(mcqZero, ' 0 ', 'mcq: the keyed index with padding');
for (const [input, label] of [
  ['', 'the empty string'],
  ['   ', 'whitespace'],
  ['\n', 'a bare newline'],
  ['\t', 'a tab'],
  [null, 'null'],
  [undefined, 'undefined'],
  ['abc', 'text'],
  ['0.5', 'a fractional index'],
  ['1', 'a different option'],
]) wrong(mcqZero, input, `mcq blank: ${label} is not option 0`);

// ── 9. An exact answer is exact ──────────────────────────────────────────────
// numsClose defaulted to a relative 1e-4 band, so a converted area of 120000
// accepted 120012. An integer answer with no authored tolerance is exact.
const conversion = { answerType: 'numeric', answer: { value: 120000 }, prompt: 'Convert $12$ m² to cm².' };
correct(conversion, '120000', 'exactness: the answer');
correct(conversion, '1.2e5', 'exactness: scientific notation');
correct(conversion, '12*100^2', 'exactness: the calculation left unevaluated');
correct(conversion, '(1/3)*360000', 'exactness: floating-point noise is still the answer');
correct(conversion, '120,000', 'exactness: a thousands separator');
for (const [input, label] of [
  ['120001', 'one too many'],
  ['120012', 'twelve too many'],
  ['119988', 'twelve too few'],
  ['120000.5', 'half a unit out'],
]) wrong(conversion, input, `exactness: ${label}`);

const measured = { answerType: 'numeric', answer: { value: 120000, tol: 50 } };
correct(measured, '120001', 'authored tolerance: still forgiving inside the band');
correct(measured, '120040', 'authored tolerance: the edge of the band');
wrong(measured, '120060', 'authored tolerance: outside the band is still wrong');

const roundedTarget = { answerType: 'numeric', answer: { value: 3.14159 } };
correct(roundedTarget, '3.1416', 'non-integer answers keep the relative band');
correct(roundedTarget, '3.14159', 'non-integer answers accept themselves');

const smallInteger = { answerType: 'numeric', answer: { value: 12 } };
correct(smallInteger, '12', 'small integer: itself');
correct(smallInteger, '36/3', 'small integer: a calculation');
correct(smallInteger, 'sqrt(144)', 'small integer: a surd that lands on it');
wrong(smallInteger, '12.01', 'small integer: a hundredth out is wrong');

// ── 10. A percentage written with its sign ───────────────────────────────────
const percentage = {
  answerType: 'numeric',
  answer: { value: 47.5, tol: 0.11 },
  prompt: 'What **percentage** lies between $55$ and $59$?'
};
correct(percentage, '47.5', 'percent: the bare number');
correct(percentage, '47.5%', 'percent: written with its sign');
correct(percentage, '47.5 %', 'percent: a space before the sign');
wrong(percentage, '0.475', 'percent: the proportion without a sign is not the percentage');
wrong(percentage, '52.5%', 'percent: a wrong percentage is wrong');

const proportion = { answerType: 'numeric', answer: { value: 0.475 } };
correct(proportion, '47.5%', 'percent: a proportion answered as a percentage');
correct(proportion, '0.475', 'percent: the proportion itself');

// ── 11. A variable is not a unit ─────────────────────────────────────────────
// cleanInput strips a trailing unit. Applied to an expression answer it ate the
// last variable, so "a + s" became "a + " and would not parse.
for (const [expr, inputs, label] of [
  ['2h', ['2h', 'h*2', 'h + h'], 'a variable named like an hour'],
  ['a + s', ['a + s', 's + a'], 'a variable named like a second'],
  ['3n + m', ['3n + m', 'm + 3n'], 'a variable named like a metre'],
  ['l*w', ['l*w', 'w*l'], 'length times width'],
]) {
  const question = { answerType: 'expression', answer: { expr } };
  for (const input of inputs) correct(question, input, `expression units: ${label} — "${input}"`);
}
wrong({ answerType: 'expression', answer: { expr: '2h' } }, '2', 'expression units: dropping the variable is wrong');

// A numeric answer still forgives the unit the question was asked in.
const withUnits = { answerType: 'numeric', answer: { value: 12 } };
for (const input of ['12 cm', '12 m', '12 s', '12 kg', '12 cm²', '12 hours', '12 degrees'])
  correct(withUnits, input, `numeric units: "${input}" still reads as 12`);

// ── 12. Decorations a student writes around a right answer ───────────────────
// Continuing the question's own line with "= 9.75", ending the answer with a
// full stop, or writing the sign of a positive number. None of them change the
// value, and none of them may change the mark.
const plain = { answerType: 'numeric', answer: { value: 9.75 } };
for (const input of ['= 9.75', '=9.75', '≈ 9.75', '+9.75', '9.75.', ' 9.75 ', '9.75\n'])
  correct(plain, input, `decoration: ${JSON.stringify(input)}`);
wrong(plain, '= 9.85', 'decoration: an equals sign does not make a wrong number right');
wrong(plain, '=', 'decoration: an equals sign alone is not an answer');

const surd = { answerType: 'numeric', answer: { value: Math.sqrt(18), surdForm: { k: 3, r: 2 } } };
correct(surd, '3sqrt(2)', 'decoration: the surd itself');
correct(surd, '+3sqrt(2)', 'decoration: a leading plus on a surd');
correct(surd, '3sqrt(2).', 'decoration: a trailing full stop on a surd');
correct(surd, '3√2', 'decoration: the unicode root sign');
wrong(surd, 'sqrt(18)', 'decoration: an unsimplified surd is still unsimplified');

const exactPi = { answerType: 'numeric', answer: { value: 2 * Math.PI, requireExact: true } };
correct(exactPi, '2pi', 'decoration: an exact multiple of pi');
correct(exactPi, '2pi.', 'decoration: a trailing full stop after pi');
wrong(exactPi, '6.28', 'decoration: a rounded decimal is still not the exact value');

const solutionSet = { answerType: 'set', answer: { values: [-4, -8] } };
correct(solutionSet, '= -4, -8', 'decoration: a solution set continued from an equals sign');
wrong(solutionSet, '= -4', 'decoration: an equals sign does not complete a partial set');

// ── 13. Restating the question earns nothing ─────────────────────────────────
// A student who copies the question back has shown no working. This is the
// partial-credit safety rule: it must hold wherever method marks are awarded.
const restated = checkAnswer({ answer: { type: 'numeric', value: 12 }, prompt: 'Solve 2x + 4 = 28' }, '2x + 4 = 28');
ok(restated.correct === false, 'partial credit: restating the question is not a correct answer');

console.log(failures.length
  ? `NCERT ANSWER FORMS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `NCERT ANSWER FORMS: PASS — ${pass}/${pass} checks — solution sets, inequality/interval equivalence, matrices, vectors, the n!/nCr/nPr/sec/cosec/cot vocabulary, rupees and paise, fraction form only where the question asks for it, blank answers, exact integers, the percent sign and unit-named variables.`);
process.exit(failures.length ? 1 : 0);
