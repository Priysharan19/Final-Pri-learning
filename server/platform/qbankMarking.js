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
//   3. NO PRECISION NAMED. A numeric key that is an IRRATIONAL value (10 or more significant figures as authored; never a rational value such as
//      11/36 or 2/3, which is exact, and never a whole
//      number or a terminating decimal as authored), on a prompt that is not about money, a count or "how many" (a currency sign, dollars,
//      cents), on a prompt that names no
//      decimal places, significant figures or "nearest" and asks for no exact form, is accepted when the student's value is the key correctly
//      ROUNDED to at least 3 significant figures, counting the digits as typed (135 and 135.0 for 134.9537, never 130, never a truncation that
//      is not also a rounding, never a neighbour). The form the author wrote the key in does not matter: 8/15 accepts 0.533 and 24 root 3
//      accepts 41.6. It does NOT apply where the prompt, any criterion's point or any step heading says exact, exact value, exact form, as a
//      fraction, in simplest form, simplest surd form, rational denominator, in terms of pi or e, or leave your answer as: 0.3636 is not 4/11.
//      A key that carries its own tolerance (`tol`) keeps the engine's reading alone.
//
// Pure and deterministic.
import { checkAnswer } from '../../client/src/engine/checker.js';
import { parse, normalize, evaluate, variablesOf } from '../../client/src/engine/expr.js';
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

// What the question asks for. A rounded decimal is a reading of a key whose value is only ever a decimal approximation; it is never accepted
// where the prompt, any criterion's point or any step heading asks for an exact form: "exact", "exact value", "as a fraction", "in simplest form",
// "simplest surd form", "rational denominator", "in terms of pi or e", "leave your answer as". The form the author wrote the key in does NOT
// decide (24 root 3 asked for with no precision is a decimal); the words do. A prompt that states a precision keeps the engine's reading.
const ASKS_FOR_PRECISION = /significant|sig\.?\s*fig|decimal|d\.\s?p\.?|nearest|round|approximat|\bto\s+(?:one|two|three|four|five|\d)\b/i;
const EXACT_WORDS = /exact|as a fraction|what fraction|fraction of|in the form|express (?:it |this |your answer )?as|simplif|simplest|lowest terms|surd|rational denominator|rationalis|in terms of|leave your answer as|mixed number|closed form/i;
/** A currency sign, dollars or cents, or "how many": a money, count or quantity question. */
const WHOLE_THINGS = /\\\$|\bdollars?\b|\bcents?\b|\bhow many\b|\bnumber of\b/i;
const stripTeX = t => String(t ?? '').replace(/\$/g, '').trim();
/** Is the value a ratio of two whole numbers with a denominator up to 1000 (0.3055555555555556 is 11/36)? */
export function isRational(v) {
  if (!Number.isFinite(v)) return false;
  for (let d = 1; d <= 1000; d++) { const n = v * d; if (Math.abs(n - Math.round(n)) <= 1e-12 * Math.max(1, Math.abs(n))) return true; }
  return false;
}
/** Does the question ask for an exact form anywhere: its prompt, any criterion's point, any step heading? */
export function asksForExact(q) {
  const prompt = `${q?.prompt ?? ''} ${q?.answerSuffix ?? ''}`;
  if (EXACT_WORDS.test(prompt)) return true;
  if ((Array.isArray(q?.criteria) ? q.criteria : []).some(c => EXACT_WORDS.test(stripTeX(c?.point)))) return true;
  if ((Array.isArray(q?.steps) ? q.steps : []).some(st => EXACT_WORDS.test(stripTeX(st?.h)))) return true;
  return false;
}

/**
 * The number a key is, for the rounding rule: a numeric key's value, or an expression key with no unknown in it (a constant such as e^2/4 or
 * -pi^2, an exact-form key), evaluated. Null for any other key. One rule serves both.
 */
function roundingValueOf(q) {
  const a = q?.answer;
  if (!a) return null;
  if (q.answerType === 'numeric') return Number.isFinite(a.value) && a.tol === undefined && !a.surdForm && !a.simplestFraction ? a.value : null;
  if (q.answerType === 'expression' && typeof a.expr === 'string' && a.tol === undefined) {
    try { const ast = parse(normalize(a.expr)); if ([...variablesOf(ast)].some(v => v !== 'e')) return null; /* e is the constant */ const v = evaluate(ast, {}); return Number.isFinite(v) ? v : null; } catch { return null; }
  }
  return null;
}

/** Does this question (a numeric key, or a constant exact-form expression key) accept a correctly rounded answer to at least 3 significant figures? */
export function acceptsRoundedFigures(q) {
  const value = roundingValueOf(q);
  if (value === null) return false;
  // Only a key whose exact value is not the authored decimal: an irrational or a recurring value written out to float length (10 or more
  // significant figures). A whole number or a terminating decimal as authored (22315.5, 0.3413, 4.375) is its own answer.
  if (Number.isInteger(value) || digitsOf(value).digits.length < 10) return false;
  if (isRational(value)) return false;      // a rational key (11/36, 2/3 for log base 8 of 4) is an exact value: only exact forms are accepted
  // Money, counts and whole things take the authored value under the existing tolerance and nothing else.
  if (WHOLE_THINGS.test(`${q.prompt ?? ''} ${q.answerSuffix ?? ''}`)) return false;
  if (ASKS_FOR_PRECISION.test(`${q.prompt ?? ''} ${q.answerSuffix ?? ''}`)) return false;
  if (namedDecimalPlaces(q) !== null || asksForExactValue(q) || asksForExact(q)) return false;
  return true;
}
/** The question asks for an exact value or form (asksForExact above): a plain decimal that is not the key itself is then never the answer. */
export const demandsExactForm = q => asksForExact(q);
/** The correctly rounded reading: the typed number is the key rounded to the figures the student typed, at least three. */
export function isRoundedKey(q, typed) {
  if (!acceptsRoundedFigures(q)) return false;
  const t = typedDecimal(typed);
  if (!t || t[1] < 3) return false;
  return t[0] === roundSignificant(roundingValueOf(q), t[1]);
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
  if ((q.answerType === 'numeric' || q.answerType === 'expression') && typeof input === 'string' && isRoundedKey(q, input)) return { correct: true };
  return first;
}
