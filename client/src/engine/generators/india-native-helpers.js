// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum — shared toolkit for the NCERT-native banks
//
// Three banks written against the NCERT/CBSE chapters that used to borrow an
// NSW generator (india-class10-native.js, india-class11.js, india-class12.js)
// share four things, and they are here rather than copied three times.
//
// ── 1 · Traps that are distinct AS THE STUDENT READS THEM ────────────────────
//
// A designed distractor is only a distractor if it looks different from the
// other options. `indiaExamComposer.numericToMcq` prints every candidate with
// `formatLike`, which rounds it to the precision of the KEYED answer — so two
// traps that are far apart as numbers can still print the same string. That is
// not hypothetical: an archer question with a keyed answer of 1 had two traps
// near zero, both printed "0", and the paper offered ["2","0","1","0"].
// mcq-distinctness-check.mjs pins the composer's half of that fix; `traps()`
// below pins the authoring half, so a bank cannot hand the composer a pair that
// collapses in the first place. It drops any trap that renders as the answer or
// as an earlier trap, rather than trusting the author to have noticed.
//
// ── 2 · Exact answers ────────────────────────────────────────────────────────
//
// The probability of drawing a red ball really is 5/13 and the derivative of
// arctan at 3 really is 1/10. Keying the decimal shadow of either would make
// the marker reject the exact answer a student is taught to give, so a value
// that is not whole is keyed as a simplest fraction.
//
// ── 3 · Indian context, where a context is used at all ───────────────────────
//
// Rupees, Indian names and Indian places — but only where the question has a
// story to tell. "Solve the pair by elimination" needs no story, and dressing
// it in one would be worse than leaving it bare: the student then has to read
// two sentences of scene-setting to find a question that was never about the
// scene. Contexts appear where NCERT itself sets them: savings and instalments
// in progressions, journeys and speeds in quadratics, defective items and
// coloured balls in probability, cricket selections in combinations.
// ─────────────────────────────────────────────────────────────────────────────
import { gcd, rc } from '../qhelpers.js';

// ── Traps ────────────────────────────────────────────────────────────────────

/**
 * How `indiaExamComposer.formatLike` will print `value` beside this answer.
 * Deliberately a copy of that function's arithmetic rather than a call to it:
 * the composer is a product surface and this is a bank, and a bank importing a
 * paper composer to author a question would be the wrong way round. The one
 * property that matters — the precision comes from the KEYED value, not from
 * the candidate — is asserted against the real composer in
 * india-native-banks-check.mjs, so the copy cannot drift unnoticed.
 */
export function renderedAs(answerValue, value) {
  if (!Number.isFinite(value)) return null;
  const shown = String(answerValue);
  const dot = shown.indexOf('.');
  const decimals = dot < 0 ? 0 : Math.min(6, shown.length - dot - 1);
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(Math.max(decimals, 2))));
}

/**
 * The traps worth offering: finite, not the answer, and not a repeat of an
 * earlier trap — compared on the text the student reads rather than on the
 * number behind it. Order is preserved, so the most instructive misconception
 * stays first and survives when a later one has to be dropped.
 */
export function traps(answerValue, list) {
  const out = [];
  const seen = new Set([renderedAs(answerValue, answerValue)]);
  for (const trap of list || []) {
    if (!trap || typeof trap.value !== 'number') continue;
    const text = renderedAs(answerValue, trap.value);
    if (text === null || seen.has(text)) continue;
    seen.add(text);
    out.push(trap);
  }
  return out;
}

// ── Exact answers ────────────────────────────────────────────────────────────

/** A fraction reduced to lowest terms, sign carried by the numerator. */
export function frac(n, d) {
  if (d === 0) throw new Error('zero denominator');
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d) || 1;
  return { n: n / g, d: d / g, value: n / d };
}

/** A fraction in KaTeX, written the way it is read: 3 rather than 3/1. */
export function fracTex(n, d) {
  const f = frac(n, d);
  if (f.d === 1) return String(f.n);
  return f.n < 0 ? `-\\dfrac{${-f.n}}{${f.d}}` : `\\dfrac{${f.n}}{${f.d}}`;
}

/**
 * A numeric answer that stays exact: a plain value when whole, a keyed simplest
 * fraction when not. Spread into the payload beside `answerType: 'numeric'`.
 */
export function exact(f, suffix) {
  const g = frac(f.n, f.d);
  return {
    answer: g.d === 1 ? { value: g.n } : { value: g.n / g.d, simplestFraction: { n: g.n, d: g.d } },
    ...(g.d === 1 ? {} : { inputHint: `e.g. ${g.n}/${g.d}` }),
    ...(suffix ? { answerSuffix: suffix } : {})
  };
}

// ── Indian context ───────────────────────────────────────────────────────────

export const IN_NAMES = [
  'Aarav', 'Ananya', 'Bhavna', 'Chirag', 'Divya', 'Farhan', 'Gauri', 'Harsh',
  'Ishaan', 'Jyoti', 'Kavya', 'Lakshmi', 'Manish', 'Neha', 'Omkar', 'Pooja',
  'Rahul', 'Rekha', 'Sanjay', 'Tanvi', 'Uday', 'Vikram', 'Yamini', 'Zoya',
  'Meera', 'Arjun', 'Nikhil', 'Preeti', 'Ravi', 'Sneha'
];

export const IN_CITIES = [
  'Delhi', 'Mumbai', 'Chennai', 'Kolkata', 'Bengaluru', 'Hyderabad', 'Pune',
  'Jaipur', 'Lucknow', 'Ahmedabad', 'Bhopal', 'Patna', 'Kochi', 'Nagpur',
  'Indore', 'Guwahati', 'Chandigarh', 'Surat', 'Varanasi', 'Coimbatore'
];

/** Two different cities, so a journey never starts and ends in the same place. */
export function twoCities(rng) {
  const from = rc(rng, IN_CITIES);
  let to = rc(rng, IN_CITIES);
  let guard = 20;
  while (to === from && guard--) to = rc(rng, IN_CITIES);
  if (to === from) to = IN_CITIES[(IN_CITIES.indexOf(from) + 1) % IN_CITIES.length];
  return [from, to];
}

/** Two different names, for a question that needs both. */
export function twoNames(rng) {
  const a = rc(rng, IN_NAMES);
  let b = rc(rng, IN_NAMES);
  let guard = 20;
  while (b === a && guard--) b = rc(rng, IN_NAMES);
  if (b === a) b = IN_NAMES[(IN_NAMES.indexOf(a) + 1) % IN_NAMES.length];
  return [a, b];
}

export const IN_FESTIVALS = ['Diwali', 'Holi', 'Pongal', 'Onam', 'Durga Puja', 'Baisakhi', 'Eid'];

export const IN_TRAINS = [
  'Rajdhani Express', 'Shatabdi Express', 'Duronto Express',
  'Vande Bharat Express', 'Garib Rath Express'
];

/**
 * Things an Indian kirana shop actually sells, with a plausible per-unit rupee
 * band. Both grammatical numbers are carried rather than derived, because "one
 * geometry box" and "three geometry boxes" do not differ by an "s" and a
 * question that reads "4 units of litre of mustard oil" costs the student
 * attention it should be spending on the mathematics.
 */
export const IN_GOODS = [
  { one: 'notebook', many: 'notebooks', unit: [25, 60] },
  { one: 'geometry box', many: 'geometry boxes', unit: [70, 150] },
  { one: 'kilogram of tur dal', many: 'kilograms of tur dal', unit: [110, 190] },
  { one: 'kilogram of basmati rice', many: 'kilograms of basmati rice', unit: [80, 160] },
  { one: 'school tie', many: 'school ties', unit: [90, 180] },
  { one: 'cricket ball', many: 'cricket balls', unit: [120, 320] },
  { one: 'litre of mustard oil', many: 'litres of mustard oil', unit: [130, 210] }
];
