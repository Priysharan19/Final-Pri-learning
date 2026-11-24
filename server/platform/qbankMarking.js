// Pri Learning · how an author-bank answer is READ before the engine decides (qbankPack.js)
//
// The engine's checkAnswer still decides every mark. For a bank question only, three readings of what the student typed are added, each
// narrow, none able to make a wrong value right:
//
//   1. THE ANSWER BOX'S OWN PREFIX. A question whose box is labelled `dy/dx =` is answered with the label or without it. The declared
//      label is removed (spacing, ′ for ', ⁻¹ for ^-1 are one spelling), and so is another name for the SAME quantity: y' and dy/dx are one
//      (f'(x) too, when the question defines y = f(x)). A different left side is left alone and the engine refuses it as it always did.
//   2. A NAMED PRECISION ON AN INTERVAL. "Solve 3^x > 20, to two decimal places": the key is x > 2.7268, and x > 2.73 is the same answer
//      rounded as asked. Every number of the key is rounded to the named place; the student's region is also tried against that.
//   3. NO PRECISION NAMED. A numeric key that the author wrote as a long decimal (7 or more significant figures: a recurring or irrational
//      value), on a prompt that names no decimal places, significant figures or "nearest" and asks for no exact form, is accepted when the
//      student's value is the key correctly rounded to at least 3 significant figures, counting the digits as typed (so 135 and 135.0 for
//      134.9537, never 130). It is NEVER accepted where the prompt asks for an exact form (a fraction, a surd, a rational denominator, "exact",
//      "in terms of", "simplest form") or where the author wrote the key as one (its criterion or last worked line is a fraction, a surd,
//      a multiple of π, a logarithm, or its value reads as one): 0.3636 is not 4/11. A key that carries its own tolerance (`tol`) keeps the engine's reading alone.
//
// Pure and deterministic.
import { checkAnswer } from '../../client/src/engine/checker.js';
import { namedDecimalPlaces, asksForExactValue } from '../../client/src/engine/checker-core.js';

export const isBankQuestion = q => !!q && typeof q._bank === 'string';

// ── 1. the prefix ────────────────────────────────────────────────────────────
const spelled = t => String(t ?? '').replace(/\s+/g, '').replace(/″/g, "''").replace(/[′’‘]/g, "'").replace(/⁻¹/g, '^-1').replace(/\^\{-1\}|\^\(-1\)/g, '^-1').replace(/[−–—]/g, '-');
/**
 * The quantity a left side names. dy/dx, y' and d/dx(y) are one quantity (the first derivative of y), as are d²y/dx², y'' and d/dx(y');
 * f'(x) is that same quantity only when the question defines y = f(x). Any other left side is its own spelling and nothing else.
 */
function quantityOf(left, q) {
  const definesYasF = /y=f\(x\)/.test(String(q?.prompt ?? '').replace(/[\s$\\{}]/g, ''));
  if (/^(?:dy\/dx|y'|d\/dx\(y\))$/.test(left)) return 'first derivative of y';
  if (/^(?:d(?:\^?2|²)y\/dx(?:\^?2|²)|y''|d\/dx\(y'\))$/.test(left)) return 'second derivative of y';
  if (definesYasF && /^f'\(x\)$/.test(left)) return 'first derivative of y';
  if (definesYasF && /^f''\(x\)$/.test(left)) return 'second derivative of y';
  return left;
}
/**
 * The input with the question's own declared label taken off its front: { input, otherSide }. `otherSide` is true when the student wrote
 * a left side that is NOT the declared one ("y = 3x^2" on a box labelled dy/dx =): that is a different quantity, never the answer.
 */
export function readOwnPrefix(q, raw) {
  const prefix = String(q?.answerPrefix ?? '').trim();
  const same = { input: raw, otherSide: false };
  if (typeof raw !== 'string' || !prefix.includes('=')) return same;
  const left = spelled(prefix.slice(0, prefix.lastIndexOf('=')));
  if (!left) return same;
  const at = raw.search(/(?<![<>!:=])=(?!=)/);
  if (at < 0) return same;
  const rest = raw.slice(at + 1).trim();
  if (/(?<![<>!:=])=(?!=)/.test(rest)) return same;       // a chain or a list of equations: the engine reads it as written
  if (quantityOf(spelled(raw.slice(0, at)), q) === quantityOf(left, q)) return { input: rest, otherSide: false };
  return { input: raw, otherSide: ['expression', 'numeric', 'set'].includes(q.answerType) };
}
/** The input with the question's own declared label taken off its front, or the input unchanged. */
export const withoutOwnPrefix = (q, raw) => readOwnPrefix(q, raw).input;

// ── decimal rounding, half up, on the shortest decimal the key is written as ─────────────────────
function digitsOf(v) {
  const [mant, exp] = Math.abs(v).toExponential().split('e');
  return { digits: mant.replace('.', '').split('').map(Number), exp: Number(exp) };
}
/** The value rounded to k significant figures, half up, from its shortest decimal form (so 134.95 to 4 figures is 135.0). */
export function roundSignificant(v, k) {
  if (!Number.isFinite(v) || v === 0) return v;
  const { digits, exp } = digitsOf(v);
  if (digits.length <= k) return v;
  const keep = digits.slice(0, k);
  let carry = digits[k] >= 5 ? 1 : 0;
  for (let i = k - 1; i >= 0 && carry; i--) { keep[i] += carry; carry = keep[i] === 10 ? 1 : 0; if (carry) keep[i] = 0; }
  let e = exp;
  if (carry) { keep.unshift(1); keep.pop(); e += 1; }
  return Math.sign(v) * Number(`${keep[0]}.${keep.slice(1).join('')}e${e}`);
}
/** The decimal places the number is rounded to (half up) from its shortest decimal form. */
export function roundPlaces(v, p) {
  if (!Number.isFinite(v)) return v;
  const { digits, exp } = digitsOf(v);
  const k = exp + 1 + p;                      // significant digits kept
  if (v === 0) return 0;
  if (k <= 0) return k === 0 && digits[0] >= 5 ? Math.sign(v) * 10 ** -p : 0;
  return roundSignificant(v, k);
}

/** A plain decimal as typed: [value, significant figures as typed], or null. */
export function typedDecimal(text) {
  const t = String(text ?? '').trim().replace(/[−–]/g, '-');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const body = t.replace(/^[+-]/, '');
  const [whole, frac = ''] = body.split('.');
  let sig = (whole + frac).replace(/^0+/, '');
  if (!body.includes('.')) sig = sig.replace(/0+$/, '');
  return [Number(t), sig.length];
}

// What the question asks for, and what form the author wrote the key in. A rounded decimal is a reading of a key that is only ever a decimal
// approximation; it is never accepted where the question asks for an exact form (a fraction, a surd, a rational denominator, "in terms of
// π", "exact", "simplest form") or where the author wrote the key as one (a fraction, a surd, a multiple of π, a logarithm).
const ASKS_FOR_PRECISION = /significant|sig\.?\s*fig|decimal|d\.\s?p\.?|nearest|round|approximat|\bto\s+(?:one|two|three|four|five|\d)\b/i;
const ASKS_FOR_EXACT_FORM = /exact|fraction|simplest|simplif|surd|rational|rationalis|denominator|numerator|in terms of|closed form|mixed number|recurring|\\dot|\\overline|\bratio\b|\\pi|\\sqrt|\\ln|\\log|\bsurd\b/i;
const EXACT_MARKERS = /\\[dt]?frac|\\sqrt|\\pi|\\ln|\\log|\\binom|√|π|[½⅓⅔¼¾⅕⅛]|\bln\b|\blog\b|\bsqrt\b|\bpi\b|\be\s*\^|\^\s*\{?\s*\\?[a-z]|\d\s*\/\s*\d|\d\s*\\?\s*(?:ln|log)/i;
const stripTeX = t => String(t ?? '').replace(/\$/g, '').trim();
/** The last side of the author's final worked line, with the TeX kept: "\dfrac{0.36}{0.99}=\dfrac4{11}" gives "\dfrac4{11}". */
function lastSide(step) {
  const t = stripTeX(step?.d);
  const parts = t.split(/\\approx|\\fallingdotseq|=|≈/).map(x => x.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}
/** Did the author write the key as an exact form? Read from the answer's own criterion and the last side of his final line. Unknown: yes (fail closed). */
export function authoredAsExact(q) {
  const criteria = Array.isArray(q?.criteria) ? q.criteria : null;
  const steps = Array.isArray(q?.steps) ? q.steps : null;
  if (!criteria && !steps) return true;
  const point = stripTeX((criteria || []).find(c => c?.answer)?.point);
  if (point && (EXACT_MARKERS.test(point) || /exact/i.test(point))) return true;
  const side = steps?.length ? lastSide(steps[steps.length - 1]) : '';
  if (side && EXACT_MARKERS.test(side)) return true;
  return false;
}
/** Is `w` a root of a x² + b x + c with small whole coefficients (a whole number, a fraction or a quadratic surd)? */
function smallQuadraticRoot(w) {
  if (!Number.isFinite(w) || Math.abs(w) > 1e7) return false;
  for (let a = 1; a <= 12; a++) for (let b = -60; b <= 60; b++) {
    const c = -(a * w * w + b * w);
    const r = Math.round(c);
    if (Math.abs(r) <= 250 && Math.abs(c - r) < 1e-13 * Math.max(1, Math.abs(c), Math.abs(a * w * w), Math.abs(b * w))) return true;
  }
  return false;
}
/** Does the value read as an exact form: a fraction, a surd, a multiple of π, a logarithm or an exponential of one? Only the value is looked at. */
export function looksExact(v) {
  if (!Number.isFinite(v)) return false;
  const probes = [v, v / Math.PI, ...(Math.abs(v) < 40 ? [Math.exp(v)] : []), v / Math.LN2, v / Math.log(3), v / Math.LN10, v * (Math.E - 1), v / Math.E, v * Math.E];
  return probes.some(smallQuadraticRoot);
}
/** A key written as a long decimal: the shortest decimal it is written as has 7 or more significant figures (a recurring or irrational value, not 134.9 or 22315.5). */
export const isLongDecimal = v => Number.isFinite(v) && !Number.isInteger(v) && digitsOf(v).digits.length >= 7;

/** Does this numeric question accept a correctly rounded answer to at least 3 significant figures? */
export function acceptsRoundedFigures(q) {
  const a = q?.answer;
  if (q?.answerType !== 'numeric' || !a || !Number.isFinite(a.value) || a.tol !== undefined || a.surdForm || a.simplestFraction) return false;
  if (Number.isInteger(a.value) || !isLongDecimal(a.value)) return false;
  const prompt = `${q.prompt ?? ''} ${q.answerSuffix ?? ''}`;
  if (ASKS_FOR_PRECISION.test(prompt) || ASKS_FOR_EXACT_FORM.test(prompt)) return false;
  if (namedDecimalPlaces(q) !== null || asksForExactValue(q)) return false;
  if (authoredAsExact(q) || looksExact(a.value)) return false;
  return true;
}
/** The prompt asks for an exact form in so many words: a fraction, simplest form, a surd, a rational denominator, "exact", "in terms of". */
const DEMANDS_EXACT_FORM = /exact|fraction|simplest|surd|rational|rationalis|denominator|in terms of|mixed number|closed form/i;
export const demandsExactForm = q => DEMANDS_EXACT_FORM.test(`${q?.prompt ?? ''} ${q?.answerSuffix ?? ''}`.replace(/\$[^$]*\$/g, m => (/\\(?:sqrt|dfrac|frac)/.test(m) ? ' ' : m)));
/** The correctly rounded reading: the typed number is the key rounded to the figures the student typed, at least three. */
export function isRoundedKey(q, typed) {
  if (!acceptsRoundedFigures(q)) return false;
  const t = typedDecimal(typed);
  if (!t || t[1] < 3) return false;
  return t[0] === roundSignificant(q.answer.value, t[1]);
}

// ── 2. a named precision on an interval ──────────────────────────────────────
function roundRegion(region, places) {
  return String(region).replace(/\d+(?:\.\d+)?/g, m => { const n = roundPlaces(Number(m), places); return String(n); });
}

/** checkAnswer, with the bank readings above. The result is the engine's own object; only `correct: false` can become `correct: true`. */
export function checkBankAnswer(q, raw) {
  if (!isBankQuestion(q)) return checkAnswer(q, raw);
  const { input, otherSide } = readOwnPrefix(q, raw);
  if (otherSide) return { correct: false, feedback: `This box is for ${String(q.answerPrefix).replace(/\s*=\s*$/, '')}. Write the answer to that.` };
  const first = checkAnswer(q, input);
  // Where the question demands an exact form, a plain decimal that is not the key itself is never the answer, whatever band the engine reads a number in
  // (0.36364 is not "4/11 in simplest form"). The key typed as the decimal it is (0.5, 0.25) is.
  if (first?.correct === true && q.answerType === 'numeric' && q.answer?.tol === undefined && Number.isFinite(q.answer?.value) && demandsExactForm(q)) {
    const typed = typedDecimal(input);
    if (typed && Math.abs(typed[0] - q.answer.value) > 1e-12 * Math.max(1, Math.abs(q.answer.value))) {
      return { correct: false, feedback: 'This question asks for the exact form, not a decimal. Write it as a fraction, a surd or in terms of the constant it asks for.' };
    }
  }
  if (first?.correct === true) return first;
  if (q.answerType === 'interval' && q.answer && typeof q.answer.region === 'string') {
    const places = namedDecimalPlaces(q);
    if (places !== null) {
      const rounded = roundRegion(q.answer.region, places);
      if (rounded !== q.answer.region) {
        const again = checkAnswer({ ...q, answer: { ...q.answer, region: rounded } }, input);
        if (again?.correct === true) return again;
      }
    }
  }
  if (q.answerType === 'numeric' && typeof input === 'string' && isRoundedKey(q, input)) return { correct: true };
  return first;
}
