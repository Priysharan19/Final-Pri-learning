// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the band an authored numeric key may carry
//
// A generator may author `answer.tol` to absorb a rounding the question asks
// for. A band the question does not ask for is a hole in the marker: a key of 7
// authored with tol 0.011 marked 7.01 correct, a z-score of 0.5 marked 0.51
// correct, and "evaluate exactly" answers carried an absolute tol of 0.001 that
// is half the size of a key such as 1/480 (walk-through finding F02; the NSW
// quality gate excluded some thirty cells for it).
//
// The rule, applied to every question as it is made (generators/index.js):
//
//   · an authored `tol` stays when the question names a precision ("correct to
//     2 decimal places", "to the nearest dollar"), asks for an estimate or a
//     rounded value, or declares a published `rounding` rule;
//   · otherwise, on a key that is itself exact to two decimal places or fewer
//     (7, 2.4, 661.25), the band is dropped: the key is the answer, and the
//     marker's own default band (a whole key exact, a decimal key within half a
//     unit of its last place) judges it;
//   · a key with more places than that is a rounded value of something longer,
//     so its question has to name the precision: the generator says so in the
//     prompt (client/test/numeric-tolerance-sweep-check.mjs holds that line).
//
// Pure: the arithmetic on the question's own numbers; nothing consults a model.
// ─────────────────────────────────────────────────────────────────────────────
import { namedDecimalPlaces } from './checker-core.js';

const ROUNDING_WORDS = /\b(?:estimate[sd]?|approximat\w*|about|roughly|round(?:ed|ing)?|nearest|significant|decimal\s+places?|d\.\s?p\.?|s\.\s?f\.?)\b/i;

/** Is `v` exact to two decimal places or fewer? */
export function exactToHundredths(v) {
  if (!Number.isFinite(v)) return false;
  const h = v * 100;
  return Math.abs(h - Math.round(h)) <= 1e-9 * Math.max(1, Math.abs(h));
}

/**
 * The question with an authored `tol` that its wording does not call for removed.
 * Returns the same object when nothing changes.
 */
export function withoutUncalledForBand(payload) {
  const a = payload?.answer;
  if (!a || a.tol == null || a.rounding) return payload;
  const keys = payload.answerType === 'numeric' && typeof a.value === 'number' ? [a.value]
    : payload.answerType === 'set' && Array.isArray(a.values) && a.values.every(v => typeof v === 'number') ? a.values : null;
  if (!keys) return payload;
  const asked = `${payload.prompt ?? ''} ${payload.answerSuffix ?? ''} ${payload.answerPrefix ?? ''}`;
  if (ROUNDING_WORDS.test(asked) || namedDecimalPlaces(payload) != null) return payload;
  if (!keys.every(exactToHundredths)) return payload;
  // A band that is already tiny (a decimal key held to 1e-9) is the exact band, not a rounding allowance.
  if (a.tol <= 1e-9 * Math.max(1, ...keys.map(Math.abs))) return payload;
  const { tol, ...answer } = a;
  return { ...payload, answer };
}
