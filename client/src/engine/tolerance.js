// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Numeric tolerance policy
//
// One place that says how close a typed number has to be, per question type,
// so the rule is read here and tested here rather than rediscovered inside
// every marker. The policy is documented for authors in
// docs/content/marking-tolerance.md; this file is its executable form.
//
//   default      an authored `tol` wins; otherwise a whole-number target is
//                exact (within floating-point noise) and a non-integer target
//                keeps a relative 1e-4 band (expr.js numsClose).
//   nta-2dp      JEE numerical-value answers keyed to two decimal places: the
//                published keys accept the value "truncated/rounded off to the
//                second decimal place", so the rounded two-decimal writing, the
//                truncated two-decimal writing and anything within half a unit
//                of the second decimal are accepted; the next two-decimal
//                value beyond those is not.
//   nta-integer  JEE (Main) numerical-value answers "rounded off to the
//                nearest integer": the rounded integer is accepted, and so is
//                the exact unrounded value, because a student who writes the
//                exact value has not made a mathematical mistake. Any other
//                integer is wrong.
//
// A rounding policy never widens acceptance beyond the published band, and
// nothing here lets a model set a mark: it is arithmetic on two numbers.
// ─────────────────────────────────────────────────────────────────────────────
import { numsClose } from './expr.js';

export const ROUNDING = Object.freeze({ NTA_2DP: 'nta-2dp', NTA_INTEGER: 'nta-integer' });

const EPS = 1e-9;

/** Half away from zero, the convention school and NTA keys round by. */
export function roundHalfAwayFromZero(value, decimals = 0) {
  const f = 10 ** decimals;
  const scaled = Math.abs(value) * f;
  const r = Math.floor(scaled + 0.5 + EPS) / f;
  return value < 0 ? -r : r;
}

/** Truncation towards zero to `decimals` places. */
export function truncateTowardsZero(value, decimals = 2) {
  const f = 10 ** decimals;
  const t = Math.trunc(Math.abs(value) * f + EPS) / f;
  return value < 0 ? -t : t;
}

/** The band (half-width) a policy accepts around `target`, or null for the default. */
export function toleranceFor(target, rounding, authoredTol) {
  if (Number.isFinite(authoredTol) && authoredTol > 0) return authoredTol;
  if (rounding === ROUNDING.NTA_2DP) return 0.005 + EPS;
  return null;
}

/**
 * Is `value` an acceptable writing of `target` under `rounding`?
 * `authoredTol` is the question's own `tol`, which always wins.
 */
export function acceptsNumeric(value, target, { rounding = null, tol: authoredTol } = {}) {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return false;
  if (Number.isFinite(authoredTol) && authoredTol > 0) return Math.abs(value - target) <= authoredTol + EPS;
  if (rounding === ROUNDING.NTA_2DP) {
    if (Math.abs(value - target) <= 0.005 + EPS) return true;                       // within half a unit of the 2nd decimal
    if (Math.abs(value - truncateTowardsZero(target, 2)) <= EPS) return true;      // the truncated two-decimal writing
    return Math.abs(value - roundHalfAwayFromZero(target, 2)) <= EPS;              // the rounded two-decimal writing
  }
  if (rounding === ROUNDING.NTA_INTEGER) {
    if (numsClose(value, target)) return true;                       // the exact value
    return Math.abs(value - roundHalfAwayFromZero(target)) <= EPS;   // the key's integer
  }
  return numsClose(value, target);
}
