// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Numeric tolerance policy — boundary cases
//
// Ledger 3.7. docs/content/marking-tolerance.md states how close a typed
// number has to be for each question type; engine/tolerance.js is the
// executable form; this suite pins the boundaries, both sides of each line:
//
//   · default: a whole-number target is exact, a non-integer target keeps a
//     relative 1e-4 band, an authored `tol` always wins;
//   · nta-2dp: a JEE numerical value keyed to two decimals accepts anything
//     within half a unit of the second decimal — the rounded AND the truncated
//     writing of the same value — and nothing past it;
//   · nta-integer: "rounded off to the nearest integer" accepts the key's
//     integer and the exact value, and no other integer;
//   · percent, exact-form and angle rounding keep their own documented bands.
//
// Every case is authored. Nothing here is generated.
// ─────────────────────────────────────────────────────────────────────────────
import { acceptsNumeric, roundHalfAwayFromZero, truncateTowardsZero, toleranceFor, ROUNDING } from '../src/engine/tolerance.js';
import { checkAnswer } from '../src/engine/checker.js';
import { numsClose } from '../src/engine/expr.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(Object.is(a, b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const accept = (q, input, label = input) => { const v = checkAnswer(q, input); ok(v.correct === true, `${q.answer?.rounding || 'default'} ${JSON.stringify(label)} on ${q.answer.value} — expected accept, got ${v.correct} (${v.feedback || ''})`); };
const reject = (q, input, label = input) => { const v = checkAnswer(q, input); ok(v.correct === false, `${q.answer?.rounding || 'default'} ${JSON.stringify(label)} on ${q.answer.value} — expected reject (false positive)`); };

// ── 1 · Rounding primitives ──────────────────────────────────────────────────
eq(roundHalfAwayFromZero(2.5), 3, '2.5 rounds up');
eq(roundHalfAwayFromZero(-2.5), -3, '−2.5 rounds away from zero');
eq(roundHalfAwayFromZero(7.4), 7, '7.4 → 7');
eq(roundHalfAwayFromZero(7.5), 8, '7.5 → 8');
eq(roundHalfAwayFromZero(1.005, 2), 1.01, '1.005 → 1.01 at two decimals (not the float artefact 1.00)');
eq(roundHalfAwayFromZero(2.675, 2), 2.68, '2.675 → 2.68 at two decimals');
eq(truncateTowardsZero(2.679, 2), 2.67, '2.679 truncates to 2.67');
eq(truncateTowardsZero(-2.679, 2), -2.67, '−2.679 truncates to −2.67');
eq(toleranceFor(3, null, 0.1), 0.1, 'an authored tol wins');
ok(toleranceFor(3, ROUNDING.NTA_2DP) > 0.005 && toleranceFor(3, ROUNDING.NTA_2DP) < 0.0051, 'nta-2dp band is half a unit of the second decimal');
eq(toleranceFor(3, null), null, 'no policy → the default band (numsClose)');

// ── 2 · Default policy ───────────────────────────────────────────────────────
{
  const whole = { answerType: 'numeric', prompt: 'How many?', answer: { value: 12 } };
  accept(whole, '12'); accept(whole, '12.0'); accept(whole, '24/2'); accept(whole, '11.9999999999');
  reject(whole, '12.0001'); reject(whole, '11.99'); reject(whole, '12.1'); reject(whole, '13'); reject(whole, '11');
  const dec = { answerType: 'numeric', prompt: 'Find the mean.', answer: { value: 3.14159 } };
  accept(dec, '3.14159'); accept(dec, '3.1416'); accept(dec, '3.14160');
  // 3.1413 sat inside the relative band but is not 3.14159 to four places (3.1416): refused since #518.
  reject(dec, '3.1413');
  reject(dec, '3.14'); reject(dec, '3.142'); reject(dec, '3.15'); reject(dec, '3.1'); reject(dec, '3');
  ok(numsClose(0.26795, 2 - Math.sqrt(3)), '0.26795 is within the relative band of 2 − √3');
  ok(!numsClose(0.268, 2 - Math.sqrt(3)), '0.268 is outside the relative band of 2 − √3 (documented: ≈ 5 significant figures)');
  const authored = { answerType: 'numeric', prompt: 'Find x to one decimal place.', answer: { value: 3.14159, tol: 0.05 } };
  accept(authored, '3.1'); accept(authored, '3.14'); accept(authored, '3.19'); accept(authored, '3.0916');
  reject(authored, '3.2'); reject(authored, '3.09'); reject(authored, '3.3');
  const zero = { answerType: 'numeric', prompt: 'Find the gradient.', answer: { value: 0 } };
  accept(zero, '0'); accept(zero, '0.0'); accept(zero, '-0'); reject(zero, '0.001'); reject(zero, '0.1');
  const neg = { answerType: 'numeric', prompt: 'Find the value.', answer: { value: -2.5 } };
  accept(neg, '-2.5'); accept(neg, '−5/2'); reject(neg, '-2.50001'); reject(neg, '2.5'); reject(neg, '-2.51'); reject(neg, '-2.4');
}

// ── 3 · Percent policy ───────────────────────────────────────────────────────
{
  // The prompt asks for a percentage: the % sign is read, and a bare 0.25 is
  // never 25 % — not even where the author set percent: true. Accepting it was
  // a false-correct (the P0 false-positive sweep, m-fp-sweep: "bare 0.6
  // accepted as 60%"), so this policy follows the sweep's stricter rule.
  const pct = { answerType: 'numeric', prompt: 'What percentage of the class passed?', answer: { value: 25 } };
  accept(pct, '25'); accept(pct, '25%');
  reject(pct, '0.25'); reject(pct, '0.25%'); reject(pct, '2.5'); reject(pct, '26'); reject(pct, '25.1');
  const pctFlag = { answerType: 'numeric', prompt: 'What percentage of the class passed?', answer: { value: 25, percent: true } };
  accept(pctFlag, '25'); accept(pctFlag, '25%'); reject(pctFlag, '0.25');
  reject(pctFlag, '0.25%'); reject(pctFlag, '2.5'); reject(pctFlag, '26');
  const prob = { answerType: 'numeric', prompt: 'Find the probability.', answer: { value: 0.44 } };
  accept(prob, '0.44'); accept(prob, '11/25'); accept(prob, '44%');
  reject(prob, '0.44%'); reject(prob, '44'); reject(prob, '0.45');
}

// ── 4 · Exact-form policy ────────────────────────────────────────────────────
{
  const exact = { answerType: 'numeric', prompt: 'Find the exact area.', answer: { value: 2 * Math.PI, requireExact: true } };
  accept(exact, '2π'); accept(exact, '2pi'); accept(exact, '6.283185307179586');
  reject(exact, '6.28'); reject(exact, '6.283'); reject(exact, '6.2832'); reject(exact, '6.3'); reject(exact, '2');
}

// ── 5 · JEE numerical value, two decimals (nta-2dp) ──────────────────────────
{
  const q = { answerType: 'numeric', prompt: 'Enter the numerical value.', answer: { value: 3.14159, rounding: 'nta-2dp' } };
  // the rounded writing and the truncated writing are both inside the band
  accept(q, '3.14', 'rounded'); accept(q, '3.14', 'truncated'); accept(q, '3.142'); accept(q, '3.1416'); accept(q, '3.14159'); accept(q, '3.145');
  // the band is half a unit of the second decimal, both sides
  accept(q, '3.13659', 'target − 0.005'); accept(q, '3.14659', 'target + 0.005');
  reject(q, '3.13', 'two decimals below'); reject(q, '3.15', 'two decimals above'); reject(q, '3.1365'); reject(q, '3.1467'); reject(q, '3.1'); reject(q, '3');
  // a key whose value sits exactly on a half: both roundings are accepted
  const half = { answerType: 'numeric', prompt: 'Enter the numerical value.', answer: { value: 2.675, rounding: 'nta-2dp' } };
  accept(half, '2.68', 'rounded half up'); accept(half, '2.67', 'truncated'); accept(half, '2.675');
  reject(half, '2.69'); reject(half, '2.66'); reject(half, '2.7');
  // negative keys
  const negq = { answerType: 'numeric', prompt: 'Enter the numerical value.', answer: { value: -0.4167, rounding: 'nta-2dp' } };
  accept(negq, '-0.42', 'rounded'); accept(negq, '-0.41', 'truncated towards zero'); accept(negq, '−0.4167');
  reject(negq, '0.42'); reject(negq, '-0.43'); reject(negq, '-0.40'); reject(negq, '-0.405');
  // truncation lands outside the half-unit band and is still the published writing
  const trunc = { answerType: 'numeric', prompt: 'Enter the numerical value.', answer: { value: 2.679, rounding: 'nta-2dp' } };
  accept(trunc, '2.68', 'rounded'); accept(trunc, '2.67', 'truncated'); accept(trunc, '2.679'); accept(trunc, '2.675', 'inside the band');
  reject(trunc, '2.66'); reject(trunc, '2.69'); reject(trunc, '2.7'); reject(trunc, '2.673', 'outside the band and neither writing');
  // an authored band from the official key still wins over the policy
  const band = { answerType: 'numeric', prompt: 'Enter the numerical value.', answer: { value: 1.73, tol: 0.02, rounding: 'nta-2dp' } };
  accept(band, '1.71'); accept(band, '1.75'); accept(band, '1.732');
  reject(band, '1.70'); reject(band, '1.76');
  // a whole-number key with two-decimal policy
  const whole = { answerType: 'numeric', prompt: 'Enter the numerical value.', answer: { value: 5, rounding: 'nta-2dp' } };
  accept(whole, '5'); accept(whole, '5.00'); accept(whole, '4.995'); accept(whole, '5.004');
  reject(whole, '5.01'); reject(whole, '4.99'); reject(whole, '6');
}

// ── 6 · JEE (Main) numerical value, nearest integer (nta-integer) ────────────
{
  const q = { answerType: 'numeric', prompt: 'Enter the numerical value.', answer: { value: 7.4, rounding: 'nta-integer' } };
  accept(q, '7', 'the key’s integer'); accept(q, '7.4', 'the exact value'); accept(q, '37/5', 'the exact value as a fraction');
  reject(q, '8'); reject(q, '6'); reject(q, '7.5'); reject(q, '7.3'); reject(q, '7.44');
  const up = { answerType: 'numeric', prompt: 'Enter the numerical value.', answer: { value: 7.5, rounding: 'nta-integer' } };
  accept(up, '8', '7.5 rounds half away from zero'); accept(up, '7.5');
  reject(up, '7'); reject(up, '9');
  const neg = { answerType: 'numeric', prompt: 'Enter the numerical value.', answer: { value: -2.5, rounding: 'nta-integer' } };
  accept(neg, '-3'); accept(neg, '-2.5'); reject(neg, '-2'); reject(neg, '3'); reject(neg, '-4');
  const integer = { answerType: 'numeric', prompt: 'Enter the numerical value.', answer: { value: 12, rounding: 'nta-integer' } };
  accept(integer, '12'); accept(integer, '12.0'); reject(integer, '12.4'); reject(integer, '11'); reject(integer, '13'); reject(integer, '11.6');
  const tiny = { answerType: 'numeric', prompt: 'Enter the numerical value.', answer: { value: 0.3, rounding: 'nta-integer' } };
  accept(tiny, '0'); accept(tiny, '0.3'); reject(tiny, '1'); reject(tiny, '0.5');
  // acceptsNumeric directly, so the policy is pinned without the parser
  ok(acceptsNumeric(7, 7.4, { rounding: 'nta-integer' }), 'acceptsNumeric: 7 for 7.4');
  ok(!acceptsNumeric(8, 7.4, { rounding: 'nta-integer' }), 'acceptsNumeric: not 8 for 7.4');
  ok(acceptsNumeric(3.14, 3.14159, { rounding: 'nta-2dp' }), 'acceptsNumeric: 3.14 for 3.14159');
  ok(!acceptsNumeric(3.15, 3.14159, { rounding: 'nta-2dp' }), 'acceptsNumeric: not 3.15 for 3.14159');
  ok(!acceptsNumeric(NaN, 3, { rounding: 'nta-2dp' }), 'acceptsNumeric: NaN is never accepted');
  ok(!acceptsNumeric(Infinity, 3, {}), 'acceptsNumeric: Infinity is never accepted');
}

// ── 7 · Angle conversion band ────────────────────────────────────────────────
{
  const deg = { answerType: 'numeric', prompt: 'Find the angle.', answerSuffix: '°', answer: { value: 60 } };
  accept(deg, '60'); accept(deg, '1.0472 rad'); accept(deg, 'π/3 rad'); accept(deg, '1.047198 rad');
  // A bare π/3 on a degree question names no unit, and is refused (owner decision, review of #513).
  reject(deg, 'π/3'); reject(deg, 'pi/3');
  reject(deg, '1.05 rad'); reject(deg, '1.04 rad'); reject(deg, '60.01'); reject(deg, '1.0472');
}

// ── 7b · Follow-ups from the #515 review (#518) ──────────────────────────────
{
  // Floating-point noise on a computed two-decimal target is still two decimals:
  // the band is half a cent, not the 0.05 a long decimal gets.
  const noisy = { answerType: 'numeric', prompt: 'Find the amount.', answer: { value: 1357.9500000000003 } };
  accept(noisy, '1357.95'); reject(noisy, '1357.96'); reject(noisy, '1357.94'); reject(noisy, '1357.99'); reject(noisy, '1357.9');
  ok(numsClose(1357.95, 1357.9500000000003) && !numsClose(1357.96, 1357.9500000000003), 'numsClose: a noisy 2-dp target keeps the 2-dp band');
  // A rounded decimal must be the target rounded to the places written: 141.43
  // is not 100√2 = 141.42135… to two places, though it sits in the relative band.
  const surd = { answerType: 'numeric', prompt: 'Find the diagonal of a 100 cm square.', answer: { value: 100 * Math.SQRT2 } };
  accept(surd, '141.42'); accept(surd, '141.421'); accept(surd, '141.4214'); accept(surd, '100sqrt(2)');
  reject(surd, '141.43'); reject(surd, '141.41'); reject(surd, '141.4'); reject(surd, '141.5'); reject(surd, '141.422'); reject(surd, '141.4213');
  const third = { answerType: 'numeric', prompt: 'Find the probability.', answer: { value: 1 / 3 } };
  accept(third, '0.33333'); accept(third, '0.333333'); reject(third, '0.33334'); reject(third, '0.3334'); reject(third, '0.3332');
  // A tiny target is not forgiven a whole micro-unit: 0 is not 3e-7.
  const tiny = { answerType: 'numeric', prompt: 'Find the value.', answer: { value: 3e-7 } };
  accept(tiny, '0.0000003'); accept(tiny, '3e-7'); reject(tiny, '0'); reject(tiny, '0.0000001'); reject(tiny, '0.000001');
  ok(!numsClose(0, 3e-7) && numsClose(3e-7, 3e-7), 'numsClose: no 1e-6 floor around a tiny target');
  // The noise bound is a few ULPs, not relative 1e-9: a billion-scale target keeps its decimals.
  ok(!numsClose(1234567890, 1234567890.25), 'numsClose: 1234567890 is not 1234567890.25');
  const big = { answerType: 'numeric', prompt: 'Find the total.', answer: { value: 1234567890.25 } };
  accept(big, '1234567890.25'); reject(big, '1234567890'); reject(big, '1234567890.3');
  // A ₹-priced question that asks for a percentage is not money: paise are a wrong unit.
  const pct = { answerType: 'numeric', prompt: 'A shopkeeper buys a toy for ₹100 and sells it for ₹120. Find the profit percent.', answerSuffix: '%', answer: { value: 20 } };
  accept(pct, '20'); reject(pct, '2000 paise'); reject(pct, '20 paise'); reject(pct, '0.2 paise');
  const count = { answerType: 'numeric', prompt: 'Pens cost ₹5 each. How many pens can you buy with ₹100?', answerSuffix: 'pens', answer: { value: 20 } };
  accept(count, '20'); reject(count, '2000 paise');
  // Still money where the box is money.
  const rupees = { answerType: 'numeric', prompt: 'Find the cost.', answerPrefix: '₹', answer: { value: 9.75 } };
  accept(rupees, '975 paise'); accept(rupees, '9.75'); reject(rupees, '9.75 paise'); reject(rupees, '976 paise');
  const pricedNoBox = { answerType: 'numeric', prompt: 'A pen costs ₹9.75. What do two pens cost, in rupees?', answer: { value: 19.5 } };
  accept(pricedNoBox, '1950 paise'); reject(pricedNoBox, '1950');
}

// ── 8 · The policy document names every policy this file tests ──────────────
{
  const doc = readFileSync(fileURLToPath(new URL('../../docs/content/marking-tolerance.md', import.meta.url)), 'utf8');
  for (const needle of ['nta-2dp', 'nta-integer', 'requireExact', 'relative', '1e-4', 'tol', 'percent', 'radian', 'polar', 'simplestFraction', 'synthetic']) {
    ok(doc.includes(needle), `docs/content/marking-tolerance.md documents "${needle}"`);
  }
  ok(!/official CBSE marking scheme|guaranteed accuracy|100% accurate/i.test(doc), 'the policy document makes no unsupported accuracy or officialness claim');
}

console.log(failures.length
  ? `TOLERANCE POLICY: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `TOLERANCE POLICY: PASS — ${pass}/${pass} checks — default exact/relative bands, authored tol, percent, exact form, converted angles, and the NTA two-decimal and nearest-integer rules, each at its boundary on both sides.`);
process.exit(failures.length ? 1 : 0);
