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
import { evalNumeric, exprEquivalent } from '../src/engine/expr.js';

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


// ── 14. Domain-aware final answers (issue #231) ──────────────────────────────
// exprEquivalent() compared fixed sample points and skipped undefined ones, so
// x/x passed for 1 and (x²−1)/(x−1) passed for x+1. A final answer has to be
// defined where the answer is (`strictDomain`); a line of working does not,
// because cancelling a common factor is a valid step that loses the hole.
const strict = { strictDomain: true };
function same(a, b, opts, label) { ok(exprEquivalent(a, b, opts) === true, `domain: ${label}: ${a} ≡ ${b} should hold`); }
function differ(a, b, opts, label) { ok(exprEquivalent(a, b, opts) === false, `domain: ${label}: ${a} ≡ ${b} must be refused`); }

// holes from the issue
differ('x/x', '1', strict, 'hole at 0');
differ('(x^2)/(x)', 'x', strict, 'hole at 0');
differ('(x^2-1)/(x-1)', 'x+1', strict, 'hole at 1');
differ('x+1', '(x^2-1)/(x-1)', strict, 'hole at 1, either order');
differ('(x-5)/(x-5)', '1', strict, 'hole outside the sampling window');
differ('(x^2-2)/(x^2-2)', '1', strict, 'irrational holes at ±√2');
differ('(x*y)/y', 'x', strict, 'hole along y = 0 with two variables');

// Radical, log and trigonometric restrictions
differ('sqrt(x)^2', 'x', strict, 'square root defined only for x ≥ 0');
differ('ln(x^2)', '2*ln(x)', strict, 'log of a square is defined for negative x');
same('ln(x^2)', '2*ln(x)', { ...strict, positiveOnly: true }, 'positive-only question');
same('sin(x)/cos(x)', 'tan(x)', strict, 'same poles at odd multiples of π/2');

// An authored domain that excludes the hole accepts the cancelled form
same('(x^2-1)/(x-1)', 'x+1', { ...strict, domain: [2, 5] }, 'authored domain excludes x = 1');

// No false regression on ordinary equivalence
same('(x+1)^2', 'x^2+2x+1', strict, 'polynomial expansion');
same('2x+3y', '3y+2x', strict, 'commutativity');
same('sin(2x)', '2sin(x)cos(x)', strict, 'double angle');
same('1/(x^2)', 'x^(-2)', strict, 'same hole at 0, two notations');
same('x^2/x^3', '1/x', strict, 'same hole at 0 after cancelling');
same('(x^2-9)/(x-3)', '(x+3)(x-3)/(x-3)', strict, 'same hole kept on both sides');
differ('x^2+1', 'x^2+2', strict, 'genuinely different values');

// Without strictDomain, the cancellation convention is unchanged
same('(x^2-1)/(x-1)', 'x+1', {}, 'working-line comparison keeps the cancellation convention');

// through the real marker
const simplify = { answerType: 'expression', answer: { expr: 'x+3' }, prompt: 'Simplify (x^2-9)/(x-3)' };
ok(checkAnswer(simplify, 'x+3').correct === true, 'marker: the simplified answer is correct');
ok(checkAnswer(simplify, '(x^2-9)/(x-3)').correct === false, 'marker: copying the unsimplified expression back is not the answer x+3');

const reciprocal = { answerType: 'expression', answer: { expr: '1' }, prompt: 'Write x/x for x ≠ 0 in simplest form' };
ok(checkAnswer(reciprocal, '1').correct === true, 'marker: 1 is accepted');
ok(checkAnswer(reciprocal, 'x/x').correct === false, 'marker: x/x is not accepted as 1');

// Step Check: factorise-then-cancel working must still be correct end to end.
const working = {
  answerType: 'working',
  prompt: 'Simplify (x^2 - 16)/(x - 4), showing each line of your working.',
  answer: {
    stepMeta: { kind: 'expression', canonical: '(x^2 - 16)/(x - 4)' },
    minLines: 2,
    final: { kind: 'expr', expr: 'x + 4' }
  }
};
const verdict = checkAnswer(working, '(x^2 - 16)/(x - 4)\n((x + 4)(x - 4))/(x - 4)\nx + 4');
ok(verdict.correct === true, `marker: factorise-then-cancel working is correct (${verdict.feedback || ''})`);

// ── 15. Domain probe review fixes (PR #243 review) ────────────────────────────
// e is Euler's number, never a variable to search for holes over.
same('-e^(-x)', '-1/e^x', strict, 'e is a constant: negative exponent');
same('1/e^x', 'e^(-x)', strict, 'e is a constant: reciprocal');
same('x*e^(-x)', 'x/e^x', strict, 'e is a constant: product and quotient');
same('e^x/(1+e^x)', '1/(1+e^(-x))', strict, 'e is a constant: logistic forms');
same('1/(e^x+e^(-x))', 'e^x/(e^(2x)+1)', strict, 'e is a constant: hyperbolic forms');
differ('(x-e)/(x-e)', '1', strict, 'a hole at x = e is still a hole');
differ('(x-pi)/(x-pi)', '1', strict, 'a hole at x = π is still a hole');

// An odd-denominator power is the real odd root, as cbrt is.
same('cbrt(x)', 'x^(1/3)', strict, 'real cube root, two notations');
same('(1/3)x^(-2/3)', '1/(3cbrt(x^2))', strict, 'derivative of the cube root');
same('x^(2/3)', 'cbrt(x^2)', strict, 'two-thirds power as root of the square');
same('x^(2/3)', 'cbrt(x)^2', strict, 'two-thirds power as square of the root');
differ('(x^2)^(1/6)', 'x^(1/3)', strict, '(x²)^(1/6) is |x|^(1/3), negative for no x');

// The reviewer's must-refuse set, including holes outside the sampling window.
differ('x/x', '1', strict, 'review: hole at 0');
differ('(x^2-1)/(x-1)', 'x+1', strict, 'review: hole at 1');
differ('sqrt(x^2)', 'x', strict, 'review: √(x²) is |x|');
differ('ln(x^2)', '2ln(x)', strict, 'review: log of a square');
differ('(x-25)/(x-25)', '1', strict, 'hole at 25, outside [-20, 20]');
differ('(x-1000)/(x-1000)', '1', strict, 'hole at 1000');
differ('(x-5000)/(x-5000)', '1', strict, 'hole at 5000: linear guard solved exactly');
differ('(0.001x-5)/(0.001x-5)', '1', strict, 'hole at 5000 with a decimal coefficient');
differ('(x^2-50)/(x^2-50)', '1', strict, 'holes at ±√50: quadratic guard solved exactly');
differ('(x-25)^2/(x-25)^2', '1', strict, 'double root at 25');
differ('(x^3-27)/(x^3-27)', '1', strict, 'cubic guard searched inside its root bound');
differ('(x-1/3)/(x-1/3)', '1', strict, 'hole at a third');
differ('sqrt(x+30)^2', 'x+30', strict, 'root guard changes sign at -30');
differ('(sqrt(x)-5.5)/(sqrt(x)-5.5)', '1', strict, 'non-polynomial guard, hole at 30.25');
// Residual limitation, pinned so a future fix has to update it on purpose: a
// non-polynomial guard that only touches zero (no sign change) beyond |x| = 20
// and off the whole numbers is not located. cos(x/100) + 1 vanishes at 100π.
ok(exprEquivalent('(cos(x/100)+1)/(cos(x/100)+1)', '1', strict) === true,
  'domain: KNOWN LIMITATION: a far tangential hole of a non-polynomial guard (x = 100π) is not located');

// through the real marker
const marks = (expr, input) => checkAnswer({ answerType: 'expression', answer: { expr }, prompt: 'Differentiate' }, input).correct;
ok(marks('-e^(-x)', '-1/e^x') === true, 'marker: -1/e^x is accepted for -e^(-x)');
ok(marks('x*e^(-x)', 'x/e^x') === true, 'marker: x/e^x is accepted for x e^(-x)');
ok(marks('e^x/(1+e^x)', '1/(1+e^(-x))') === true, 'marker: logistic forms are accepted');
ok(marks('(1/3)x^(-2/3)', '1/(3cbrt(x^2))') === true, 'marker: the cube-root derivative is accepted');
ok(marks('x^(1/3)', 'cbrt(x)') === true, 'marker: cbrt(x) is accepted for x^(1/3)');
ok(marks('1', '(x-25)/(x-25)') === false, 'marker: (x-25)/(x-25) is not accepted as 1');

// Policy (owner decision, recorded in PR #243): 0^0 and the poles of sec/tan
// are domain restrictions, so x^0 is not 1 and sec²x − tan²x is not 1 here.
differ('x^0', '1', strict, 'policy: x^0 is undefined at 0');
differ('sec(x)^2-tan(x)^2', '1', strict, 'policy: sec²x − tan²x is undefined at odd multiples of π/2');

// ── 16. Second review of PR #243: touching roots and the domain policy ────────
// The marker's default for a final answer is `isolatedDomain`: an isolated
// removable-point difference is refused (the #231 class), an interval
// difference is not unless the question authors `strictDomain: true`.
const isolated = { isolatedDomain: true };
const finalMark = (expr, input, extra = {}) =>
  checkAnswer({ answerType: 'expression', answer: { expr, ...extra }, prompt: 'Simplify' }, input).correct;

// Touching roots: one side squares the factor the other side leaves unsquared.
// Definedness at the root must not depend on where the root-finder put it.
const touching = [
  ['ln(abs(sec(x)+tan(x)))', 'ln(abs(tan(pi/4+x/2)))'],
  ['ln(abs(sec(x)+tan(x)))', '-ln(abs(sec(x)-tan(x)))'],
  ['ln(abs(cosec(x)-cot(x)))', 'ln(abs(tan(x/2)))'],
  ['sin(x)/(1+cos(x))', 'tan(x/2)'],
  ['1/(x-sqrt(2))^2', '(x-sqrt(2))^(-2)'],
  ['1/(x-1/3)^2', '(x-1/3)^(-2)'],
  ['1/(x-sqrt(2))^2', '1/(x-sqrt(2))/(x-sqrt(2))'],
  ['ln((x-sqrt(2))^2)', '2*ln(abs(x-sqrt(2)))']
];
for (const [a, b] of touching) {
  same(a, b, isolated, 'touching root, default policy');
  same(b, a, isolated, 'touching root, default policy, either order');
  same(a, b, strict, 'touching root, strict domain');
  ok(finalMark(b, a) === true, `marker: ${a} is accepted for ${b}`);
}

// Interval differences behave as on main by default (NCERT's implied positivity)…
const intervals = [
  ['ln(x)+ln(y)', 'ln(x*y)'],
  ['ln(x^2)', '2*ln(x)'],
  ['sqrt(x)*sqrt(x)', 'x'],
  ['ln(x)', 'ln(abs(x))'],
  ['sqrt(x)^2', 'x']
];
for (const [a, b] of intervals) {
  same(a, b, isolated, 'interval difference accepted by default');
  ok(finalMark(b, a) === true, `marker: ${a} is accepted for ${b} by default`);
  // …and are refused where the question authors a strict domain.
  differ(a, b, strict, 'interval difference refused under strictDomain');
  ok(finalMark(b, a, { strictDomain: true }) === false, `marker: ${a} is refused for ${b} when the question sets strictDomain`);
}

// The #231 class, isolated removable points, is refused by default.
const holes = [
  ['x/x', '1'], ['(x^2-1)/(x-1)', 'x+1'], ['(x*y)/y', 'x'], ['x^0', '1'],
  ['sec(x)^2-tan(x)^2', '1'], ['(x-25)/(x-25)', '1'], ['(e^x-1)/(e^x-1)', '1']
];
for (const [a, b] of holes) {
  differ(a, b, isolated, 'isolated hole refused by default');
  ok(finalMark(b, a) === false, `marker: ${a} is refused for ${b}`);
}

// Trigonometric identities that differ only at scattered points among poles of
// both sides are accepted by default and refused under strictDomain.
for (const [a, b] of [['tan(2x)', '2tan(x)/(1-tan(x)^2)'], ['(1-cos(x))/sin(x)', 'tan(x/2)']]) {
  same(a, b, isolated, 'trigonometric identity among poles, default policy');
  ok(finalMark(a, b) === true, `marker: ${b} is accepted for ${a}`);
  differ(a, b, strict, 'trigonometric identity refused under strictDomain');
}

// The odd-root reading also compares values: (−x)^(1/3) is −x^(1/3).
same('(-x)^(1/3)', '-x^(1/3)', isolated, 'odd root of a negated variable');
same('(-x)^(1/3)', '-x^(1/3)', strict, 'odd root of a negated variable, strict');

// A repeated (key, answer) pair is answered from the cache with the same verdict.
ok(exprEquivalent('x/x', '1', isolated) === false && exprEquivalent('x/x', '1', isolated) === false, 'domain: cached verdict is stable');
ok(exprEquivalent('tan(2x)', '2tan(x)/(1-tan(x)^2)', isolated) === true, 'domain: cached acceptance is stable');

// ── 17. Endpoints of an interval domain (third review of PR #243) ─────────────
// Sides that differ only at an endpoint of their common domain — both undefined
// just beyond it — are an interval difference: accepted by default, refused
// where the question authors strictDomain. (sin⁻¹ is written asin/arcsin: the
// parser reads sin⁻¹x as (sin x)⁻¹, and has no inverse cotangent.)
const endpoints = [
  ['x/sqrt(x)', 'sqrt(x)'],
  ['asin(x)', 'atan(x/sqrt(1-x^2))'],
  ['arcsin(x)', 'arctan(x/sqrt(1-x^2))']
];
for (const [a, b] of endpoints) {
  same(a, b, isolated, 'endpoint difference accepted by default');
  same(b, a, isolated, 'endpoint difference accepted by default, either order');
  ok(finalMark(b, a) === true, `marker: ${a} is accepted for ${b} by default`);
  differ(a, b, strict, 'endpoint difference refused under strictDomain');
  ok(finalMark(b, a, { strictDomain: true }) === false, `marker: ${a} is refused for ${b} when the question sets strictDomain`);
}
// A hole inside the common domain is still isolated, and still refused.
differ('(x+1)/(x^2-1)', '1/(x-1)', isolated, 'interior hole at -1 refused by default');
ok(finalMark('1/(x-1)', '(x+1)/(x^2-1)') === false, 'marker: (x+1)/(x²−1) is refused for 1/(x−1)');

// Endpoint review fixes: an endpoint is one of the natural domain, judged on
// the real line at every scale — not an authored bound, and not a hole that
// merely sits close to a natural boundary.
const authored = (expr, domain, input) => checkAnswer({ answerType: 'expression', answer: { expr, domain }, prompt: 'Simplify' }, input).correct;
ok(authored('1', [0, 5], 'x/x') === false, 'marker: x/x is refused for 1 when the authored domain is [0, 5] (hole at the bound)');
ok(authored('1', [-5, 0], 'x/x') === false, 'marker: x/x is refused for 1 when the authored domain is [-5, 0] (hole at the bound)');
ok(authored('x+1', [1, 5], '(x^2-1)/(x-1)') === false, 'marker: (x²−1)/(x−1) is refused for x+1 when the authored domain is [1, 5]');
differ('sqrt(x)*(x-0.00005)/(x-0.00005)', 'sqrt(x)', isolated, 'hole at 0.00005 beside √x\'s boundary is still a hole');
differ('sqrt(x)*(x-0.0000001)/(x-0.0000001)', 'sqrt(x)', isolated, 'hole at 10⁻⁷ beside √x\'s boundary is still a hole');
differ('sqrt(x)*(x-0.0002)/(x-0.0002)', 'sqrt(x)', isolated, 'hole at 0.0002 beside √x\'s boundary is still a hole');
same('x/sqrt(x)', 'sqrt(x)', isolated, 'natural endpoint at 0 still accepted');
same('asin(x)', 'atan(x/sqrt(1-x^2))', isolated, 'natural endpoints at ±1 still accepted');

console.log(failures.length
  ? `NCERT ANSWER FORMS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `NCERT ANSWER FORMS: PASS — ${pass}/${pass} checks — solution sets, inequality/interval equivalence, matrices, vectors, the n!/nCr/nPr/sec/cosec/cot vocabulary, rupees and paise, fraction form only where the question asks for it, blank answers, exact integers, the percent sign, unit-named variables and domain-aware final answers.`);
process.exit(failures.length ? 1 : 0);
