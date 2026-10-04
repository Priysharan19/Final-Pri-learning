// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the misconception IDs the working checker may propose
//
// The canonical ontology lives in client/src/engine/misconceptions.js, with the
// student-facing names, explanations and detectors. The production server image
// carries no client source (see Dockerfile), so the IDs the cloud checker may
// return are mirrored here. client/test/misconception-ontology-check.mjs fails
// if this list and the client's CLOUD_MISCONCEPTION_IDS ever differ.
//
// A proposed ID is a suggestion only. The client records it in learner state
// only when its deterministic diagnoser names the same misconception on the
// same line (ADR-0001: AI proposes, the deterministic engine decides).
// ─────────────────────────────────────────────────────────────────────────────

export const MISCONCEPTION_ONTOLOGY_VERSION = 1;

/** The value a model returns when the mistake is real but not in the ontology. */
export const OTHER_MISCONCEPTION = 'other';

export const CLOUD_MISCONCEPTION_IDS = Object.freeze([
  'sign-on-transfer', 'one-side-only', 'sides-mismatched', 'wrong-inverse-operation',
  'inequality-not-reversed', 'distribute-partial', 'distribute-sign', 'power-of-sum',
  'combined-unlike-terms', 'juxtaposition-as-digits', 'negative-squared', 'power-of-power',
  'power-product', 'power-as-multiplication', 'negative-index-as-negative', 'function-of-sum',
  'fraction-across', 'cancel-over-sum', 'reciprocal-flip', 'lost-root', 'divided-by-variable',
  'root-sign-from-factor', 'perpendicular-gradient', 'probability-wrong-total', 'sign-flipped',
  'term-dropped', 'operator-swapped', 'variable-swapped', 'arithmetic-slip'
]);
