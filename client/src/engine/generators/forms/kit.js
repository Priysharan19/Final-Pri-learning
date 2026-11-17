// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · extra-form kit (Priyabhata)
//
// A skill's established generator is its "direct" form. This kit lets a skill
// carry further structural forms — reverse, missing-parameter, multi-step,
// context, representation, misconception-MCQ — without touching that
// generator. A form is { form, make(rng, diff) } and make returns
// { payload, check } where `check()` recomputes the keyed answer by a DIFFERENT
// route (a brute-force scan, a numeric evaluation) so a test can prove the key.
// The index draws the form from the seed through its own rng, so the established
// generator's stream — and every seed already issued — is untouched.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, mcq } from '../../qhelpers.js';

/**
 * Typeset the maths in one string so that no hint, step, prompt or option shows a
 * double sign ("+ -5"), a unit or zero coefficient ("1x", "0x"), or a zero term
 * ("(x + 0)"). Only the $…$ segments are touched. A form writes its expression
 * naturally; this is the one place the house typesetting rules are applied.
 */
export function typeset(text) {
  if (typeof text !== 'string') return text;
  return text.split('$').map((seg, i) => {
    if (i % 2 === 0) return seg;
    let t = seg;
    for (let n = 0; n < 3; n++) {
      t = t.replace(/\+ -(?=\d|\\|[a-z(])/g, '- ');           // "+ -5" → "- 5"
      t = t.replace(/- -(?=\d|\\|[a-z(])/g, '+ ');              // "- -5" → "+ 5"
      t = t.replace(/\\cdot -(\d+(?:\.\d+)?)/g, '\\cdot (-$1)');  // "\cdot -5" → "\cdot (-5)"
      t = t.replace(/(?<![\w.])0[a-zA-Z](?:\^\{?\d+\}?)?\s[+-]\s/g, ''); // leading "0x + "
      t = t.replace(/(?<=[a-zA-Z)}\]]|\^\d)\s[+-]\s0[a-zA-Z](?:\^\{?\d+\}?)?/g, ''); // trailing "+ 0x"
      t = t.replace(/(?<=[a-zA-Z)}\]]|\^\d)\s[+-]\s0(?![\d.\w])/g, '');           // trailing "+ 0"
      t = t.replace(/(?<![\d._^{\w])1(?=[a-zA-Z])/g, '');                // "1x" → "x"
    }
    return t;
  }).join('$');
}
const ts = (steps = []) => steps.map(x => (typeof x === 'string' ? typeset(x) : { ...x, h: typeset(x.h), d: typeset(x.d) }));

/** A numeric-answer payload. `traps` are common wrong answers with the reason. */
export function numeric(form, prompt, rawValue, { hints, steps, traps: rawTraps = [] }) {
  // Keys are kept to six places so no floating-point artefact (4.800000000000001) is ever served.
  const tidy = v => (Number.isInteger(v) ? v : Math.round(v * 1e6) / 1e6);
  const value = tidy(rawValue);
  const traps = rawTraps.map(t => ({ ...t, value: tidy(t.value) }));
  const kept = traps.filter((t, i) => t.value !== value && Number.isFinite(t.value) && traps.findIndex(u => u.value === t.value) === i);
  // A designed distractor must always exist (it is what the multiple-choice view
  // and the misconception feedback use). When a form's own wrong answers all
  // coincide with the key for this draw, fall back to the two slips every
  // numeric answer can suffer.
  if (!kept.length) {
    if (value !== 0) kept.push({ value: -value, why: 'Check the sign: a reversed order of subtraction or a dropped minus gives the opposite value.' });
    kept.push({ value: value === 0 ? 1 : 2 * value, why: 'A stray factor of $2$ has crept in; recheck whether a halving or doubling step belongs.' });
  }
  return {
    form, prompt: typeset(prompt), answerType: 'numeric', answer: { value },
    traps: kept.map(t => ({ ...t, why: typeset(t.why) })),
    hints: hints.map(typeset), steps: ts(steps)
  };
}

/** A multiple-choice payload; every distractor is a named misconception. */
export function choice(rng, form, prompt, correct, distractors, { hints, steps }) {
  const m = mcq(rng, typeset(correct), distractors.map(x => ({ ...x, text: typeset(x.text), why: typeset(x.why) })));
  const optionTraps = Object.fromEntries(Object.entries(m.optionTraps).map(([k, v]) => [k, typeset(v)]));
  return { form, prompt: typeset(prompt), answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps }, mcqOptions: m.options, hints: hints.map(typeset), steps: ts(steps) };
}

/** Upper bound of a parameter range at a difficulty: wider as the cell hardens. */
export const span = (diff, base, per) => base + per * (diff - 1);

export const PEOPLE = ['Aarav', 'Ananya', 'Rohan', 'Meera', 'Kabir', 'Diya', 'Ishaan', 'Sneha', 'Arjun', 'Kavya', 'Vihaan', 'Pooja', 'Rahul', 'Nisha', 'Dev', 'Tanvi'];
export const PLACES = ['Nashik', 'Jaipur', 'Pune', 'Lucknow', 'Indore', 'Kochi', 'Mysuru', 'Patna', 'Surat', 'Bhopal', 'Madurai', 'Guwahati'];
export const person = rng => rc(rng, PEOPLE);
export const place = rng => rc(rng, PLACES);
export { ri, rc };

// ── independent-check helpers (used only by check() closures) ────────────────
/** Simpson's rule, n even. Exact for polynomials up to degree 3. */
export function simpson(f, a, b, n = 2000) {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}
/** Five-point derivative: exact for polynomials up to degree 4, error O(h⁴) otherwise. */
export function numDeriv(f, x, h = 0.25) {
  return (-f(x + 2 * h) + 8 * f(x + h) - 8 * f(x - h) + f(x - 2 * h)) / (12 * h);
}
/** Round to 6 places so decimal keys compare without float noise. */
export const r6 = v => Math.round(v * 1e6) / 1e6;
/** Fraction of numbers whose decimal expansion terminates: den has only 2s and 5s. */
export const terminates = d => { let x = Math.abs(d); while (x % 2 === 0) x /= 2; while (x % 5 === 0) x /= 5; return x === 1; };
export const C = (n, r) => { if (r < 0 || r > n) return 0; let v = 1; for (let i = 1; i <= r; i++) v = (v * (n - r + i)) / i; return Math.round(v); };

// ── typesetting helpers: no unit/zero coefficients, no "+ -" double signs ────
/** An algebraic expression from [coefficient, variable-part] terms, e.g. expr([[2,'x^2'],[-1,'x'],[5,'']]) → "2x^2 - x + 5". */
export function expr(terms) {
  let out = '';
  for (const [c, v] of terms) {
    if (!c) continue;
    const mag = Math.abs(c);
    const body = v === '' ? String(mag) : (mag === 1 ? v : `${mag}${v}`);
    out += out === '' ? (c < 0 ? `-${body}` : body) : (c < 0 ? ` - ${body}` : ` + ${body}`);
  }
  return out || '0';
}
/** A number written for use inside a product or power: negatives in brackets. */
export const pr = v => (v < 0 ? `(${v})` : String(v));
/** A coefficient written before a variable: 1 → '', -1 → '-'. */
export const cf = c => (c === 1 ? '' : c === -1 ? '-' : String(c));
