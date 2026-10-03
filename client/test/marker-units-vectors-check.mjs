// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Units, rounded values and vectors (§10 grading authority)
//
// The marker strips a unit before it reads the number. Stripped and ignored,
// "12 cm" marked right for "12 m". This suite pins the other direction too:
// a right answer written with the right unit, or with no unit, still marks
// right. Rounded values and vectors are audited for false positives and false
// negatives. Every case is authored. Nothing here is generated.
// ─────────────────────────────────────────────────────────────────────────────
import { checkAnswer } from '../src/engine/checker.js';
import { unitsPresent } from '../src/engine/cbseMarking.js';
import { canonicalUnit, unitContradicts } from '../src/engine/units.js';

let pass = 0;
const failures = [];
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

const numeric = (value, suffix, input, extra = {}) =>
  checkAnswer({ answerType: 'numeric', answer: { value, ...extra }, answerSuffix: suffix, prompt: 'Find the value.' }, input);

// ── 1. Unit spellings read to one canonical unit ─────────────────────────────
for (const [raw, want] of [
  ['m', 'm'], ['metres', 'm'], ['meter', 'm'], ['cm', 'cm'], ['m²', 'm²'], ['m^2', 'm²'], ['sq m', 'm²'],
  ['square metres', 'm²'], ['cm³', 'cm³'], ['cubic cm', 'cm³'], ['km/h', 'km/h'], ['km/hr', 'km/h'],
  ['km per hour', 'km/h'], ['m/s²', 'm/s²'], ['°', '°'], ['degrees', '°'], ['deg', '°'], ['L', 'l'],
  ['hours', 'h'], ['s', 's'], ['units', 'units'], ['square units', 'units²'], ['years', null], ['% p.a.', null]
]) ok(canonicalUnit(raw) === want, `canonicalUnit(${raw}) should be ${want}, got ${canonicalUnit(raw)}`);

// ── 2. A contradicting unit is wrong (former false positives) ────────────────
for (const [value, suffix, input] of [
  [12, 'm', '12 cm'], [12, 'm', '12 km'], [12, 'm²', '12 m'], [12, 'cm²', '12 cm'], [12, 'm', '12 m²'],
  [5, 's', '5 h'], [5, 'hours', '5 min'], [12, 'm/s', '12 km/h'], [3, 'L', '3 ml'], [12, 'cm²', '12 cm³'],
  [9, 'square units', '9 cm'], [4, 'units', '4 cm²']
]) {
  const r = numeric(value, suffix, input);
  ok(r.correct === false, `unit: ${input} must not be accepted for ${value} ${suffix}`);
  ok(/unit/i.test(r.feedback || ''), `unit: ${input} for ${value} ${suffix} says the unit is the problem`);
}

// ── 3. The right unit, any spelling, or no unit, still marks right ───────────
for (const [value, suffix, input] of [
  [12, 'm', '12 m'], [12, 'm', '12'], [12, 'm', '12 metres'], [12, 'm²', '12 m²'], [12, 'm²', '12 m^2'],
  [30, '°', '30°'], [30, '°', '30 deg'], [30, 'degrees', '30°'], [5, 's', '5 s'], [60, 'km/h', '60 km/h'],
  [60, 'km/h', '60 km/hr'], [9, 'square units', '9 cm²'], [9, 'square units', '9 sq units'], [4, 'units', '4 cm'],
  [7, 'years', '7'], [5, '% p.a.', '5'], [12, '', '12'], [12, ' cm²', '12 cm²']
]) ok(numeric(value, suffix, input).correct === true, `unit: ${input} is accepted for ${value} ${suffix}`);
// the right unit never rescues the wrong number
ok(numeric(12, 'm', '13 m').correct === false, 'unit: 13 m is not 12 m');
ok(numeric(12, 'm', '1200 cm').correct === false, 'unit: a converted value in the wrong unit is not the answer in m');
ok(unitContradicts('m', '12') === false, 'unit: no written unit never contradicts');

// ── 4. The answer mark's unit check reads whole units, not letters ───────────
const Q = suffix => ({ answerSuffix: suffix });
ok(unitsPresent(Q('m'), [], '12 m') === true, 'unitsPresent: 12 m has metres');
ok(unitsPresent(Q('m'), [], '12 cm') === false, 'unitsPresent: 12 cm does not have metres (the m inside cm)');
ok(unitsPresent(Q('m'), ['sum = 12'], '12') === false, 'unitsPresent: the m in "sum" is not a unit');
ok(unitsPresent(Q('m²'), [], '12 m') === false, 'unitsPresent: m is not m²');
ok(unitsPresent(Q('m²'), [], '12 m^2') === true, 'unitsPresent: m^2 is m²');
ok(unitsPresent(Q('cm²'), ['area = 14 cm²'], '14') === true, 'unitsPresent: a unit in the working counts');
ok(unitsPresent(Q('m/s'), [], '12 ms') === false, 'unitsPresent: ms is not m/s');
ok(unitsPresent(Q('km/h'), [], '5 km/hr') === true, 'unitsPresent: km/hr is km/h');
ok(unitsPresent(Q('°'), [], '30') === true, 'unitsPresent: the degree sign stays optional, as before');

// ── 5. Rounded values: a value rounded differently is not the answer ─────────
for (const [value, input, want, label] of [
  [3.14, '3.14', true, 'the stated rounding'],
  [2.5, '2.50', true, 'a trailing zero'],
  [1200, '1.2e3', true, 'scientific notation'],
  [0.00012, '1.2e-4', true, 'small scientific notation'],
  [3.14, '3.1', false, 'one decimal place short'],
  [3.14, '3.1416', false, 'unrounded where 2 d.p. was asked'],
  [0.333, '0.33', false, 'three significant figures written as two'],
  [12, '12.0001', false, 'an exact whole number is exact'],
  [0.33, '1/3', false, 'an exact third is not the rounded 0.33']
]) ok(numeric(value, '', input).correct === want, `rounding: ${label}: ${input} for ${value} should be ${want}`);
ok(numeric(3.14, '', '3.1416', { tol: 0.005 }).correct === true, 'rounding: an authored tolerance is honoured');
ok(numeric(3.14, '', '3.15', { tol: 0.005 }).correct === false, 'rounding: outside an authored tolerance is wrong');

// ── 6. Vectors ───────────────────────────────────────────────────────────────
const vector = (components, input) => checkAnswer({ answerType: 'vector', answer: { components }, prompt: 'Find the vector.' }, input).correct;
for (const [c, input] of [
  [[1, 2, 3], '(1, 2, 3)'], [[1, 2, 3], 'i + 2j + 3k'], [[1, 2, 3], '3k + 2j + i'], [[1, 2, 3], '1 2 3'],
  [[1, 2, 0], '(1, 2)'], [[0.5, 1, 0], '(1/2, 1, 0)'], [[0.5, 1, 0], '1/2 i + j'], [[Math.SQRT2, 0, 0], 'sqrt(2)i'],
  [[1, -2, 3], 'î − 2ĵ + 3k̂'], [[1, 1, 1], 'i+j+k']
]) ok(vector(c, input) === true, `vector: ${input} is accepted for ${JSON.stringify(c)}`);
for (const [c, input, label] of [
  [[1, 2, 3], '(3, 2, 1)', 'components reversed'],
  [[1, 2, 3], '(1, 2)', 'a missing nonzero k component'],
  [[1, 2, 0], '(1, 2, 3)', 'an extra nonzero component'],
  [[1, 2, 3], '(1, 2, 3, 4)', 'four components'],
  [[1, 2, 3], '(-1, -2, -3)', 'the opposite vector'],
  [[1, 2, 3], 'i + 2j + 3k + 4', 'a stray scalar'],
  [[1, 2, 3], 'ijk', 'axes without coefficients run together'],
  [[1.4142, 0, 0], '(1.41, 0, 0)', 'a component rounded too far'],
  [[1, 2, 3], 'i + 2j + 2j + 3k', 'a repeated component']
]) ok(vector(c, input) === false, `vector: ${label}: ${input} must not be accepted for ${JSON.stringify(c)}`);

console.log(failures.length
  ? `UNITS, ROUNDING AND VECTORS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `UNITS, ROUNDING AND VECTORS: PASS — ${pass}/${pass} checks — a contradicting unit is wrong, a right unit in any spelling is right, rounding is not forgiven past its authored tolerance, and vectors match component by component.`);
process.exit(failures.length ? 1 : 0);
