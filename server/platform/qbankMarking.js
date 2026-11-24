// Pri Learning · how an author-bank answer is READ before the engine decides (qbankPack.js)
//
// The engine's checkAnswer still decides every mark. For a bank question only, three readings of what the student typed are added, each
// narrow, none able to make a wrong value right:
//
//   1. THE ANSWER BOX'S OWN PREFIX. A question whose box is labelled `dy/dx =` is answered with the label or without it. Exactly the
//      declared label is removed (spacing, ′ for ', ⁻¹ for ^-1 are one spelling); a different left side is left alone and the engine
//      refuses it as it always did.
//   2. A NAMED PRECISION ON AN INTERVAL. "Solve 3^x > 20, to two decimal places": the key is x > 2.7268, and x > 2.73 is the same answer
//      rounded as asked. Every number of the key is rounded to the named place; the student's region is also tried against that.
//   3. NO PRECISION NAMED. A numeric key that is not a whole number, on a prompt that names no decimal places, significant figures or
//      "nearest", is accepted when the student's value is the key correctly rounded to at least 3 significant figures, counting the digits
//      as typed (so 135 and 135.0 for 134.95, never 130; 0.533 and 0.5333 for 8/15, never 0.53 or 0.534). The worked solution states
//      the exact value. A key that carries its own tolerance (`tol`) or asks for the exact value keeps the engine's reading alone.
//
// Pure and deterministic.
import { checkAnswer } from '../../client/src/engine/checker.js';
import { namedDecimalPlaces, asksForExactValue } from '../../client/src/engine/checker-core.js';

export const isBankQuestion = q => !!q && typeof q._bank === 'string';

// ── 1. the prefix ────────────────────────────────────────────────────────────
const spelled = t => String(t ?? '').replace(/\s+/g, '').replace(/[′’‘]/g, "'").replace(/⁻¹/g, '^-1').replace(/\^\{-1\}|\^\(-1\)/g, '^-1').replace(/[−–—]/g, '-');
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
  if (spelled(raw.slice(0, at)) === left) return { input: rest, otherSide: false };
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

/** Does this numeric question accept a correctly rounded answer to at least 3 significant figures? */
export function acceptsRoundedFigures(q) {
  const a = q?.answer;
  if (q?.answerType !== 'numeric' || !a || !Number.isFinite(a.value) || a.tol !== undefined || a.surdForm || a.simplestFraction) return false;
  if (Number.isInteger(a.value)) return false;
  const prompt = String(q.prompt ?? '');
  if (/significant|sig\.?\s*fig|decimal|d\.\s?p\.?|nearest|round|approximat|exact|\bto\s+(?:one|two|three|four|five|\d)\b/i.test(`${prompt} ${q.answerSuffix ?? ''}`)) return false;
  if (namedDecimalPlaces(q) !== null || asksForExactValue(q)) return false;
  return true;
}
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
