// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Hardest-level coverage, tranche 1 (CBSE Class X and Class XII)
//
// The CBSE track serves D1–D3. Before this table, twenty-two dot points of the
// two board-exam years had no authored form at D3, so the picker could not
// offer the hardest level for them and a request that named it was refused
// (docs/release/evidence/india-difficulty-coverage.md, issue #408). Each entry
// below adds ONE original generator for ONE such dot point, claimed at D3 and
// at no other rung.
//
// This is a coverage table, nothing more. It does not edit any chapter's dot
// points, does not touch the Class X source contract in
// ncert/class10-2026-27-production.js (which records which OUTCOMES were
// reviewed, not which generators exist), and does not move any review state in
// indiaProductionMeta.js: authoring a form is not a source review.
//
// Provenance, stated where the forms are wired in so no surface can round it
// up: the forms are original and parameterised, every answer is computed, each
// is re-derived independently from its own prompt by
// client/test/india-hardest-forms-check.mjs, and a human maths review of a
// sample is still outstanding. No board approval is claimed.
// ─────────────────────────────────────────────────────────────────────────────

export const INDIA_HARDEST_PROVENANCE = Object.freeze({
  tranche: 'phase-4-tranche-1',
  scope: 'CBSE Class X and Class XII dot points without a D3 form',
  authored: 'original-parameterised',
  answers: 'computed-from-parameters',
  verification: 'client/test/india-hardest-forms-check.mjs re-derives every answer from the prompt text by an independent route',
  humanMathsReview: 'pending',
  boardApproved: false
});

const d3 = (gen, dp) => Object.freeze({ gen, dp: Object.freeze([dp]), diff: Object.freeze([3]) });

/** chapterId → covers APPENDED to the chapter, one per dot point, at D3 only. */
export const INDIA_HARDEST_COVERS = Object.freeze({
  // ── Class X ────────────────────────────────────────────────────────────────
  'c10-polynomials': [d3('c10-polynomial-zeroes-reasoning', 0)],
  'c10-pair-linear-equations': [d3('c10-linear-pair-situations-reasoning', 3)],
  'c10-quadratic-equations': [d3('c10-quadratic-factorisation-reasoning', 0)],
  'c10-arithmetic-progressions': [d3('c10-ap-sum-reasoning', 1), d3('c10-ap-daily-life-reasoning', 2)],
  'c10-triangles': [d3('c10-bpt-reasoning', 0)],
  'c10-coordinate-geometry': [d3('c10-distance-reasoning', 0), d3('c10-section-reasoning', 1)],
  'c10-trigonometry': [d3('c10-trig-ratio-reasoning', 0), d3('c10-trig-standard-reasoning', 1)],
  'c10-circles': [d3('c10-tangent-length-reasoning', 1)],
  'c10-areas-circles': [d3('c10-sector-reasoning', 0)],
  'c10-surface-volume': [d3('c10-volume-combination-reasoning', 1)],
  'c10-statistics': [d3('c10-grouped-mean-reasoning', 0), d3('c10-grouped-mode-reasoning', 1)],
  'c10-probability': [d3('c10-probability-reasoning', 0)],
  // ── Class XII ──────────────────────────────────────────────────────────────
  'c12-relations-functions': [d3('c12-bijection-reasoning', 1)],
  'c12-inverse-trigonometric': [d3('c12-principal-value-reasoning', 0)],
  'c12-continuity-differentiability': [d3('c12-differentiability-reasoning', 0)],
  'c12-applications-derivatives': [d3('c12-related-rates-reasoning', 0), d3('c12-optimisation-reasoning', 2)],
  'c12-vector-algebra': [d3('c12-vector-magnitude-reasoning', 0)]
});

/** The generators this table introduces, in table order. */
export const INDIA_HARDEST_GENERATORS = Object.freeze(
  Object.values(INDIA_HARDEST_COVERS).flatMap(list => list.map(entry => entry.gen))
);
