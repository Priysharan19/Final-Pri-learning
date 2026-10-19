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

// ── Tranche 2 · JEE Main / JEE Advanced, Class 11 and Class 12 ─────────────
// Both JEE tracks top out at D4 on these chapters, and twenty-three dot points
// had no authored form at D4 (nine of them had no form in the JEE Advanced
// D3–D4 window at all). Each entry adds ONE original generator for ONE such
// dot point, claimed at D4 and at no other rung. The same provenance applies:
// original, computed, independently re-derived, human maths review pending,
// no board or examiner approval claimed.
export const INDIA_JEE_HARDEST_PROVENANCE = Object.freeze({
  ...INDIA_HARDEST_PROVENANCE,
  tranche: 'phase-4-tranche-2',
  scope: 'JEE Main / JEE Advanced Class 11 and Class 12 dot points without a D4 form'
});

const d4 = (gen, dp) => Object.freeze({ gen, dp: Object.freeze([dp]), diff: Object.freeze([4]) });

/** chapterId → covers APPENDED to the chapter, one per dot point, at D4 only. */
export const INDIA_JEE_HARDEST_COVERS = Object.freeze({
  // ── Class 11 ───────────────────────────────────────────────────────────────
  'c11-relations-functions': [d4('c11-domain-range-reasoning', 1), d4('c11-real-function-reasoning', 2)],
  'c11-trig-functions': [d4('c11-radian-circle-reasoning', 0), d4('c11-trig-identity-reasoning', 1)],
  'c11-complex-numbers': [d4('c11-complex-algebra-reasoning', 0), d4('c11-complex-polar-reasoning', 1)],
  'c11-permutations-combinations': [d4('c11-counting-principle-reasoning', 0), d4('c11-arrangement-reasoning', 1)],
  'c11-sequences-series': [d4('c11-ap-reasoning', 0)],
  'c11-straight-lines': [d4('c11-line-equation-reasoning', 0), d4('c11-line-angle-reasoning', 1)],
  'c11-limits-derivatives': [d4('c11-limit-reasoning', 0), d4('c11-first-principles-reasoning', 1)],
  'c11-statistics': [d4('c11-mean-deviation-reasoning', 0), d4('c11-variance-reasoning', 1)],
  'c11-probability': [d4('c11-sample-space-reasoning', 0)],
  // ── Class 12 ───────────────────────────────────────────────────────────────
  'c12-relations-functions': [d4('c12-composite-inverse-reasoning', 2)],
  'c12-inverse-trigonometric': [d4('c12-inverse-trig-branch-reasoning', 0), d4('c12-inverse-trig-evaluate-reasoning', 1)],
  'c12-continuity-differentiability': [d4('c12-continuity-test-reasoning', 0)],
  'c12-applications-derivatives': [d4('c12-rate-approximation-reasoning', 0), d4('c12-monotonic-tangent-reasoning', 1)],
  'c12-vector-algebra': [d4('c12-vector-direction-reasoning', 0)]
});

/** The generators this table introduces, in table order. */
export const INDIA_HARDEST_GENERATORS = Object.freeze(
  [INDIA_HARDEST_COVERS, INDIA_JEE_HARDEST_COVERS].flatMap(table => Object.values(table).flatMap(list => list.map(entry => entry.gen)))
);
