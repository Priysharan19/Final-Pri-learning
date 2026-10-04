// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Equivalence classes the marker must honour — and refuse
//
// Ledger 3.3. Every class below has two halves and both are load-bearing:
//
//   · ACCEPTED — the same answer written the other ways a student writes it
//     (a fraction as a decimal, a surd unsimplified, an angle in radians, an
//     interval as an inequality, a vector in î ĵ k̂ form, a ± answer as a pair);
//   · REJECTED — the near miss that a more forgiving reader would let through
//     (x < 2 for x > 2, 0.51 for 1/2, the conjugate for a complex number, the
//     transpose for a matrix, "12 cm²" for 12 m²).
//
// The rejected half is the false-positive hunt. A marker that accepts more is
// not a better marker; it is a marker that tells a student a wrong answer was
// right. Every case is authored. Nothing here is generated.
// ─────────────────────────────────────────────────────────────────────────────
import { checkAnswer } from '../src/engine/checker.js';

let pass = 0;
const failures = [];
const classes = new Map();

function note(cls, okay) {
  const row = classes.get(cls) || { pass: 0, fail: 0 };
  if (okay) row.pass++; else row.fail++;
  classes.set(cls, row);
}
function accepted(cls, question, input, label = input) {
  let v;
  try { v = checkAnswer(question, input); } catch (e) { v = { correct: false, feedback: String(e?.message || e) }; }
  const okay = v.correct === true;
  note(cls, okay);
  if (okay) pass++;
  else failures.push(`[${cls}] expected ACCEPT ${JSON.stringify(label)} — got ${v.correct} (${v.feedback || ''})`);
}
function rejected(cls, question, input, label = input) {
  let v;
  try { v = checkAnswer(question, input); } catch (e) { v = { correct: false, feedback: String(e?.message || e) }; }
  const okay = v.correct === false;
  note(cls, okay);
  if (okay) pass++;
  else failures.push(`[${cls}] expected REJECT ${JSON.stringify(label)} — marked correct (false positive)`);
}

// ── 1 · Fractions vs decimals vs surds ───────────────────────────────────────
{
  const C = 'fractions-decimals-surds';
  const half = { answerType: 'numeric', prompt: 'Find P(heads).', answer: { value: 0.5 } };
  for (const s of ['1/2', '0.5', '0.50', '2/4', '.5', '50%', '(1)/(2)']) accepted(C, half, s);
  for (const s of ['0.51', '0.49', '1/3', '0.55', '5', '1/2 + 0.01']) rejected(C, half, s);

  const root8 = { answerType: 'numeric', prompt: 'Find the length.', answer: { value: Math.sqrt(8) } };
  for (const s of ['2√2', '2sqrt(2)', '2 sqrt 2', 'sqrt(8)', '√8', '2.828427', '2*√2']) accepted(C, root8, s);
  for (const s of ['2√3', '2.83', '2.8', '√2', '4', '2√2 + 0.01']) rejected(C, root8, s);

  // The question asks for simplest surd form: √20 is equivalent, not simplified.
  const surd = { answerType: 'numeric', prompt: 'Simplify √20.', answer: { value: 2 * Math.sqrt(5), surdForm: { k: 2, r: 5 } } };
  for (const s of ['2√5', '2sqrt(5)', '2 sqrt5']) accepted(C, surd, s);
  for (const s of ['√20', '2√6', '4.47', '4.472136', '5√2']) rejected(C, surd, s);

  // Simplest fraction demanded by the prompt.
  const frac = { answerType: 'numeric', prompt: 'Simplify 12/18 and give a fraction in simplest form.', answer: { value: 2 / 3, simplestFraction: { n: 2, d: 3 } } };
  for (const s of ['2/3', ' 2 / 3 ', '(2)/(3)']) accepted(C, frac, s);
  for (const s of ['4/6', '12/18', '0.67', '0.6667', '0.666666', '3/2', '2/5']) rejected(C, frac, s);

  // Exact value demanded: the rounded decimal is close, and it is not the answer.
  const exact = { answerType: 'numeric', prompt: 'Find the exact value.', answer: { value: 1 / 3, requireExact: true } };
  for (const s of ['1/3', '2/6', '0.333333333333']) accepted(C, exact, s);
  for (const s of ['0.33', '0.333', '0.3333', '1/4']) rejected(C, exact, s);

  const mixed = { answerType: 'numeric', prompt: 'How many litres?', answer: { value: 2.5 } };
  for (const s of ['2 1/2', '5/2', '2.5', '2 (1)/(2)', '-(-2.5)']) accepted(C, mixed, s);
  for (const s of ['2 1/3', '2.4', '21/2', '2 1/2 + 1']) rejected(C, mixed, s);

  // Rationalised denominators are the same number; the unrationalised form is
  // refused only where the question forbids it.
  const r = { answerType: 'numeric', prompt: 'Find cos 45°.', answer: { value: 1 / Math.SQRT2 } };
  for (const s of ['√2/2', '1/√2', 'sqrt(2)/2', '1/sqrt(2)', '0.7071', '0.70711']) accepted(C, r, s);
  for (const s of ['√2', '0.71', '1/2', '0.7', '2/√2']) rejected(C, r, s);
  const rationalise = { ...r, prompt: 'Rationalise the denominator of 1/√2.', answer: { value: 1 / Math.SQRT2, forbid: '/\\s*\\(?\\s*sqrt', forbidWhy: 'Rationalise the denominator.' } };
  accepted(C, rationalise, '√2/2');
  rejected(C, rationalise, '1/√2');
  rejected(C, rationalise, '1/sqrt(2)');
}

// ── 2 · Degrees vs radians ───────────────────────────────────────────────────
{
  const C = 'degrees-radians';
  // An authored degree answer: a bare number is in degrees, radians are read
  // when written as such or as a multiple of π.
  const deg = { answerType: 'numeric', prompt: 'Find the angle.', answerSuffix: '°', answer: { value: 60 } };
  for (const s of ['60', '60°', '60 degrees', '60 deg', 'π/3 rad', 'pi/3 radians', 'π/3', '1.0472 rad']) accepted(C, deg, s);
  for (const s of ['30°', '60 rad', 'π/6', '1.0472', '120°', '2π/3', '59', '61°']) rejected(C, deg, s);

  // An authored radian answer: a bare number is in radians, and 60° converts.
  const rad = { answerType: 'numeric', prompt: 'Find the angle in radians.', answer: { value: Math.PI / 3, angle: 'rad' } };
  for (const s of ['π/3', 'pi/3', '1.0472', '1.047198', '60°', '60 degrees', 'π/3 rad', '(1/3)π']) accepted(C, rad, s);
  for (const s of ['60', '45°', 'π/4', 'π/6', '1.05', '3.14/3', '60 rad', '2π/3']) rejected(C, rad, s);

  // Degrees authored through answerSuffix spelled out, with a decimal target.
  const deg2 = { answerType: 'numeric', prompt: 'Find θ to one decimal place.', answerSuffix: 'degrees', answer: { value: 36.9, tol: 0.05 } };
  for (const s of ['36.9', '36.9°', '36.87', '0.644 rad', '0.6435 radians']) accepted(C, deg2, s);
  for (const s of ['36.9 rad', '53.1', '0.644', '37.0', '36.8']) rejected(C, deg2, s);
}

// ── 3 · Unit-bearing answers (cm, m², ₹) ─────────────────────────────────────
{
  const C = 'units';
  const area = { answerType: 'numeric', prompt: 'Find the area.', answerSuffix: 'm²', answer: { value: 12 } };
  for (const s of ['12', '12 m²', '12 m^2', '12m2', '12 sq m', '12 square metres', '12 sq. m', '12.0 m²']) accepted(C, area, s);
  for (const s of ['12 cm²', '12 m', '13 m²', '1200 cm²', '12 m³', '120000 cm²', '12 km²', '11.9 m²']) rejected(C, area, s);

  const length = { answerType: 'numeric', prompt: 'How far?', answerSuffix: 'km', answer: { value: 2.5 } };
  for (const s of ['2.5', '2.5 km', '2.5 kilometres', '5/2 km', '2.50 km']) accepted(C, length, s);
  for (const s of ['2500 m', '2.5 m', '2.5 cm', '25 km', '2.5 km/h', '2.4 km']) rejected(C, length, s);

  const speed = { answerType: 'numeric', prompt: 'Find the speed.', answerSuffix: 'km/h', answer: { value: 60 } };
  for (const s of ['60', '60 km/h', '60 km/hr', '60 kmph'.replace('kmph', 'km per hour')]) accepted(C, speed, s);
  for (const s of ['60 m/s', '60 km', '16.67 m/s', '60 h', '61 km/h']) rejected(C, speed, s);

  const rupees = { answerType: 'numeric', prompt: 'How much does it cost, in rupees?', answer: { value: 9.75 } };
  for (const s of ['9.75', '₹9.75', '₹ 9.75', 'Rs 9.75', 'Rs. 9.75', '9.75 rupees', 'INR 9.75', '975 paise']) accepted(C, rupees, s);
  for (const s of ['₹9.57', '₹975', '9.75 paise', '₹9.7', '₹10', '97.5']) rejected(C, rupees, s);

  const volume = { answerType: 'numeric', prompt: 'Find the volume.', answerSuffix: 'cm³', answer: { value: 125 } };
  for (const s of ['125', '125 cm³', '125 cm^3', '125 cubic cm', '125 cu cm', '125 cm3']) accepted(C, volume, s);
  for (const s of ['125 cm²', '125 cm', '125 m³', '125 ml', '124 cm³']) rejected(C, volume, s);
}

// ── 4 · Interval and set notation ────────────────────────────────────────────
{
  const C = 'interval-set-notation';
  const gt2 = { answerType: 'interval', prompt: 'Solve 3x − 1 > 5.', answer: { region: 'x > 2' } };
  for (const s of ['x > 2', '2 < x', '(2, ∞)', '(2, inf)', 'x ∈ (2, ∞)', '{x : x > 2}', 'x>2', '{x | x > 2}', '(2, infinity)']) accepted(C, gt2, s);
  for (const s of ['x < 2', 'x ≥ 2', '[2, ∞)', 'x > 3', 'x ≤ 2', '(2, 3)', '(−∞, 2)', 'x > −2', 'R']) rejected(C, gt2, s);

  const between = { answerType: 'interval', prompt: 'Solve.', answer: { region: '2 < x <= 5' } };
  for (const s of ['(2, 5]', '2 < x ≤ 5', '5 ≥ x > 2', 'x > 2 and x ≤ 5', '{x ∈ R : 2 < x ≤ 5}', '2<x<=5']) accepted(C, between, s);
  for (const s of ['[2, 5]', '(2, 5)', '2 ≤ x ≤ 5', '[2, 5)', '(2, 6]', '(1, 5]', 'x > 2', 'x ≤ 5']) rejected(C, between, s);

  const all = { answerType: 'interval', prompt: 'Solve x² + 1 > 0.', answer: { region: 'R' } };
  for (const s of ['R', 'all real numbers', '(−∞, ∞)', 'x ∈ R']) accepted(C, all, s);
  for (const s of ['x > 0', '∅', 'no solution', '(0, ∞)']) rejected(C, all, s);

  const none = { answerType: 'interval', prompt: 'Solve x² + 1 < 0.', answer: { intervals: [] } };
  for (const s of ['∅', 'no solution', '{}', 'empty set']) accepted(C, none, s);
  for (const s of ['R', 'x < 0', '(−1, 1)']) rejected(C, none, s);

  const roots = { answerType: 'set', prompt: 'Solve x² + x − 2 = 0.', answer: { values: [1, -2] } };
  for (const s of ['{1, −2}', '{-2, 1}', 'x = −2 or x = 1', '−2, 1', 'x ∈ {−2, 1}', 'S = {1, -2}', '1; -2', 'x = 1, x = -2', '1 and -2']) accepted(C, roots, s);
  for (const s of ['{1}', '{1, 2}', '{1, −2, 3}', '{−1, 2}', '−2', '{1, -2, 1}', '{0, -2}']) rejected(C, roots, s);
}

// ── 5 · Matrices and vectors ─────────────────────────────────────────────────
{
  const C = 'matrices-vectors';
  const m = { answerType: 'matrix', prompt: 'Find AB.', answer: { rows: [[1, 2], [3, 4]] } };
  for (const s of ['[[1, 2], [3, 4]]', '1 2; 3 4', '[1 2; 3 4]', '((1, 2), (3, 4))', '1, 2\n3, 4', '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}']) accepted(C, m, s);
  for (const s of ['[[1, 3], [2, 4]]', '[[1, 2], [3, 5]]', '[[1, 2]]', '[[−1, −2], [−3, −4]]', '[[1, 2], [3, 4], [5, 6]]', '[[2, 1], [4, 3]]']) rejected(C, m, s);

  const v = { answerType: 'vector', prompt: 'Find AB→.', answer: { components: [1, -2, 3] } };
  for (const s of ['(1, −2, 3)', 'i − 2j + 3k', '1i − 2j + 3k', 'î − 2ĵ + 3k̂', '3k − 2j + i', '(1,-2,3)', '[1, -2, 3]']) accepted(C, v, s);
  for (const s of ['(1, 2, 3)', '(−1, 2, −3)', '(3, −2, 1)', '(1, −2)', 'i + 2j + 3k', '(1, −2, 3, 0)', '√14']) rejected(C, v, s);

  const v2 = { answerType: 'vector', prompt: 'Find the position vector.', answer: { components: [-3, 4] } };
  for (const s of ['(−3, 4)', '−3i + 4j', '4j − 3i', '(-3, 4)', '(−3, 4, 0)']) accepted(C, v2, s); // a plane vector with k = 0 is the same vector (parseVectorInput pads by design)
  for (const s of ['(3, −4)', '(4, −3)', '5', '(−3, 4, 1)', '(−3, −4)']) rejected(C, v2, s);
}

// ── 6 · Complex numbers (a + bi and polar) ───────────────────────────────────
{
  const C = 'complex';
  const z = { answerType: 'complex', prompt: 'Simplify (1 + 2i)(1 + 2i) + 2 + 4 + 0i, giving a + bi.', answer: { re: 3, im: 4 } };
  for (const s of ['3 + 4i', '3+4i', '4i + 3', '3 + i4', '3 + 4 i', 'z = 3 + 4i', '(3 + 4i)', '6/2 + 8i/2', '3 − (−4)i']) accepted(C, z, s);
  for (const s of ['3 − 4i', '4 + 3i', '−3 + 4i', '−3 − 4i', '5', '3', '4i', '3 + 4', '3 + 5i', '2 + 4i', '3 + 4x']) rejected(C, z, s);

  // Polar: modulus 5, argument tan⁻¹(4/3) ≈ 53.13° ≈ 0.9273 rad.
  for (const s of ['5(cos 53.13° + i sin 53.13°)', '5 (cos(53.13°) + i sin(53.13°))', '5 cis 53.13°', '5∠53.13°', '5 cis 0.9273', '5(cos 0.9273 + i sin 0.9273)', '5e^(0.9273i)', '5 e^{i 0.9273}', '5e^(i·0.9273)']) accepted(C, z, s);
  for (const s of ['5(cos 36.87° + i sin 36.87°)', '5 cis −53.13°', '5(cos 53.13° − i sin 53.13°)', '4 cis 53.13°', '5 cis 53.13', '3 cis 53.13°', '5∠126.87°']) rejected(C, z, s);

  const unit = { answerType: 'complex', prompt: 'Find i³ · i².', answer: { re: 0, im: 1 } };
  for (const s of ['i', '0 + i', '0 + 1i', '1i', 'cis 90°', 'cos 90° + i sin 90°', 'e^(iπ/2)', 'cis(π/2)']) accepted(C, unit, s);
  for (const s of ['−i', '1', '0', '1 + i', 'cis 0°', 'cis 270°', '-1i']) rejected(C, unit, s);

  const real = { answerType: 'complex', prompt: 'Find (2 + i)(2 − i).', answer: { re: 5, im: 0 } };
  for (const s of ['5', '5 + 0i', '5 cis 0°', '5(cos 0 + i sin 0)', '10/2']) accepted(C, real, s);
  for (const s of ['5i', '3', '4 + i', '−5', '5 cis 180°']) rejected(C, real, s);

  const half = { answerType: 'complex', prompt: 'Write 1/(1 + i) as a + bi.', answer: { re: 0.5, im: -0.5 } };
  for (const s of ['1/2 − i/2', '0.5 − 0.5i', '(1 − i)/2', '1/2 − 1/2 i', '−i/2 + 1/2', '(√2/2) cis(−45°)', '(1/√2) cis −45°']) accepted(C, half, s);
  for (const s of ['1/2 + i/2', '1 − i', '0.5 − 0.51i', '−0.5 + 0.5i', '(√2/2) cis 45°', '0.5']) rejected(C, half, s);
}

// ── 7 · Inequalities with direction, and compound "or" solutions ─────────────
{
  const C = 'inequality-direction-or';
  const lt3 = { answerType: 'interval', prompt: 'Solve −2x > −6.', answer: { region: 'x < 3' } };
  for (const s of ['x < 3', '3 > x', '(−∞, 3)', 'x ∈ (−∞, 3)', '{x : x < 3}']) accepted(C, lt3, s);
  for (const s of ['x > 3', 'x ≤ 3', 'x < −3', 'x > −3', '(3, ∞)', '(−∞, 3]', 'x < 2']) rejected(C, lt3, s);

  const or = { answerType: 'interval', prompt: 'Solve |x − 0.5| > 1.5.', answer: { region: 'x < -1 or x > 2' } };
  for (const s of ['x < −1 or x > 2', 'x > 2 or x < −1', '(−∞, −1) ∪ (2, ∞)', '(-inf, -1) U (2, inf)', 'x < -1 | x > 2', 'x ∈ (−∞, −1) ∪ (2, ∞)']) accepted(C, or, s);
  for (const s of ['−1 < x < 2', 'x < −1 and x > 2', 'x ≤ −1 or x > 2', 'x < −1 or x ≥ 2', 'x < −1', 'x > 2', 'x > −1 or x < 2', '(−∞, −1] ∪ [2, ∞)', 'x < 1 or x > 2']) rejected(C, or, s);

  const ge = { answerType: 'interval', prompt: 'Solve 2x + 1 ≥ 7.', answer: { region: 'x >= 3' } };
  for (const s of ['x ≥ 3', 'x >= 3', '[3, ∞)', '3 ≤ x', 'x ⩾ 3']) accepted(C, ge, s);
  for (const s of ['x > 3', 'x ≤ 3', '(3, ∞)', 'x ≥ 4', '(−∞, 3]']) rejected(C, ge, s);

  const quad = { answerType: 'interval', prompt: 'Solve x² − 5x + 6 ≤ 0.', answer: { region: '2 <= x <= 3' } };
  for (const s of ['[2, 3]', '2 ≤ x ≤ 3', 'x ≥ 2 and x ≤ 3', '3 ≥ x ≥ 2']) accepted(C, quad, s);
  for (const s of ['x ≤ 2 or x ≥ 3', '(2, 3)', '[2, 3)', 'x ≤ 3', 'x ≥ 2', '(−∞, 2] ∪ [3, ∞)']) rejected(C, quad, s);
}

// ── 8 · ± answers ────────────────────────────────────────────────────────────
{
  const C = 'plus-minus';
  const pm = { answerType: 'set', prompt: 'Solve x² − 4x + 1 = 0.', answer: { values: [2 + Math.sqrt(3), 2 - Math.sqrt(3)] } };
  for (const s of ['2 ± √3', '2 ± sqrt(3)', 'x = 2 ± √3', '2 + √3, 2 − √3', '{2 − √3, 2 + √3}', '2 +/- √3', '3.73205, 0.26795', '(4 ± √12)/2', '2 ∓ √3']) accepted(C, pm, s);
  for (const s of ['2 ± √5', '2 ± 3', '−2 ± √3', '2 + √3', '2 − √3', '±√3', '2 ± √3, 0', '3.73, 0.27', '3.732, 0.268']) rejected(C, pm, s);

  const pm2 = { answerType: 'set', prompt: 'Solve (x − 2)² = 9.', answer: { values: [5, -1] } };
  for (const s of ['x = 2 ± 3', '2 ± 3', '5, −1', '{−1, 5}', 'x = 5 or x = −1']) accepted(C, pm2, s);
  for (const s of ['±3', '2 ± 9', '5', '−1', '±5', '{5, 1}', '−2 ± 3']) rejected(C, pm2, s);

  const sq = { answerType: 'set', prompt: 'Solve x² = 16.', answer: { values: [4, -4] } };
  for (const s of ['±4', 'x = ±4', '4, −4', '{−4, 4}', '+4, -4']) accepted(C, sq, s);
  for (const s of ['4', '−4', '±16', '±8', '{4, 4}']) rejected(C, sq, s);
}

// ── 9 · Equivalent algebraic forms ───────────────────────────────────────────
{
  const C = 'algebraic-forms';
  const quad = { answerType: 'expression', prompt: 'Expand (x + 1)(x + 2).', answer: { expr: 'x^2+3x+2' } };
  for (const s of ['x² + 3x + 2', '(x+1)(x+2)', '(x + 2)(x + 1)', '2 + 3x + x^2', 'x^2 + 2x + x + 2', 'x(x + 3) + 2', '(x + 1.5)^2 − 0.25']) accepted(C, quad, s);
  for (const s of ['x² + 3x + 1', '(x + 1)(x + 3)', 'x² + 2x + 3', 'x² + 3x', '3x + 2', 'x² + 3x − 2', 'y² + 3y + 2', '5']) rejected(C, quad, s);

  const diff = { answerType: 'expression', prompt: 'Factorise x² − 9.', answer: { expr: '(x-3)(x+3)' } };
  for (const s of ['(x − 3)(x + 3)', '(x+3)(x-3)', 'x² − 9', '−(3 − x)(x + 3)']) accepted(C, diff, s);
  for (const s of ['(x − 3)²', '(x − 9)(x + 1)', 'x² + 9', '(x − 3)(x − 3)', '(x − 3)(x + 3) + 1']) rejected(C, diff, s);

  const frac = { answerType: 'expression', prompt: 'Simplify (x² − 1)/(x − 1) for x ≠ 1.', answer: { expr: 'x+1', domain: [2, 6] } };
  for (const s of ['x + 1', '1 + x', '(x² − 1)/(x − 1)', '2(x + 1)/2']) accepted(C, frac, s);
  for (const s of ['x − 1', 'x', 'x + 2', 'x² + 1']) rejected(C, frac, s);

  // Rationalised denominators in an expression: √2x/2 is x/√2.
  const rat = { answerType: 'expression', prompt: 'Simplify x/√2.', answer: { expr: 'x*sqrt(2)/2' } };
  for (const s of ['x√2/2', 'x/√2', '(√2/2)x', 'x sqrt(2) / 2', '√2 x / 2', '0.7071067811865476x']) accepted(C, rat, s);
  for (const s of ['x√2', 'x/2', '2x/√2', '√2/x', '0.71x']) rejected(C, rat, s);

  const trig = { answerType: 'expression', prompt: 'Simplify sin²θ + cos²θ + tan²θ.', answer: { expr: 'sec(theta)^2' } };
  for (const s of ['sec²θ', '1/cos²θ', '1 + tan²θ', 'sec(theta)^2']) accepted(C, trig, s);
  for (const s of ['cosec²θ', 'tan²θ', '1', 'sec θ', '1 + cot²θ']) rejected(C, trig, s);

  const index = { answerType: 'expression', prompt: 'Simplify (a³)² · a.', answer: { expr: 'a^7' } };
  for (const s of ['a^7', 'a⁷', 'a^6 * a', 'a*a^6', 'a^3*a^3*a']) accepted(C, index, s);
  for (const s of ['a^6', 'a^8', 'a^5', '7a', 'a^9']) rejected(C, index, s);
}

// ── Report ───────────────────────────────────────────────────────────────────
const table = [...classes.entries()].map(([cls, r]) => `  ${cls.padEnd(28)} ${String(r.pass).padStart(3)} pass ${String(r.fail).padStart(3)} fail`).join('\n');
console.log(`Equivalence classes (accepted + rejected per class):\n${table}`);
console.log(failures.length
  ? `EQUIVALENCE CLASSES: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `EQUIVALENCE CLASSES: PASS — ${pass}/${pass} checks across ${classes.size} classes — fractions/decimals/surds, degrees/radians, units and rupees, interval and set notation, matrices and vectors, complex numbers in a + bi and polar form, inequality direction and "or" solutions, ± answers and equivalent algebraic forms, each with its false positives refused.`);
process.exit(failures.length ? 1 : 0);
