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
  'c12-vector-algebra': [d3('c12-vector-magnitude-reasoning', 0)],
  // ── Tranche 3: Class VII (Ganita Prakash) ─────────────────────────────────
  'c7-large-numbers-current': [d3('c7-place-value-systems-reasoning', 0), d3('c7-rounding-bounds-reasoning', 1), d3('c7-factor-regroup-reasoning', 3)],
  'c7-arithmetic-expressions-current': [d3('c7-expression-comparison-reasoning', 0), d3('c7-bracket-placement-reasoning', 1), d3('c7-property-rewrite-reasoning', 3)],
  'c7-decimals-current': [d3('c7-decimal-place-value-reasoning', 0), d3('c7-decimal-ordering-reasoning', 1)],
  'c7-letter-numbers-current': [d3('c7-letter-pattern-reasoning', 0), d3('c7-expression-translation-reasoning', 1), d3('c7-formula-evaluation-reasoning', 3)],
  'c7-parallel-intersecting-lines-current': [d3('c7-angle-pair-reasoning', 0), d3('c7-transversal-reasoning', 1)],
  'c7-number-play-current': [d3('c7-parity-reasoning', 0), d3('c7-magic-square-reasoning', 1), d3('c7-cryptarithm-reasoning', 3)],
  'c7-triangles-current': [d3('c7-angle-sum-reasoning', 0), d3('c7-triangle-inequality-reasoning', 1), d3('c7-triangle-construction-reasoning', 3)],
  'c7-fractions-current': [d3('c7-fraction-product-reasoning', 0), d3('c7-fraction-magnitude-reasoning', 1), d3('c7-fraction-context-reasoning', 3)],
  'c7-geometric-twins-current': [d3('c7-congruent-matching-reasoning', 0), d3('c7-sss-sas-reasoning', 1), d3('c7-congruence-inference-reasoning', 3)],
  'c7-integer-operations-current': [d3('c7-integer-product-sign-reasoning', 0), d3('c7-integer-division-reasoning', 1), d3('c7-integer-expression-reasoning', 3)],
  'c7-common-ground-current': [d3('c7-hcf-reasoning', 0), d3('c7-lcm-reasoning', 1), d3('c7-hcf-lcm-context-reasoning', 3)],
  'c7-decimal-operations-current': [d3('c7-decimal-multiplication-reasoning', 0), d3('c7-decimal-division-reasoning', 1), d3('c7-decimal-context-reasoning', 3)],
  'c7-connecting-dots-current': [d3('c7-statistical-question-reasoning', 0), d3('c7-mean-reasoning', 1), d3('c7-range-display-reasoning', 3)],
  'c7-constructions-tilings-current': [d3('c7-perpendicular-bisector-reasoning', 0), d3('c7-angle-construction-reasoning', 1), d3('c7-tiling-invariant-reasoning', 3)],
  'c7-finding-unknown-current': [d3('c7-balance-reasoning', 0), d3('c7-one-step-equation-reasoning', 1), d3('c7-equation-context-reasoning', 3)],
  // ── Tranche 3: Class VIII ─────────────────────────────────────────────────
  'c8-quadrilaterals': [d3('c8-exterior-angle-reasoning', 0), d3('c8-quadrilateral-property-reasoning', 1)],
  'c8-data-handling': [d3('c8-bar-graph-reasoning', 0), d3('c8-pie-chart-reasoning', 1)],
  'c8-squares-roots': [d3('c8-square-pattern-reasoning', 0), d3('c8-square-root-reasoning', 1)],
  'c8-cubes-roots': [d3('c8-cube-pattern-reasoning', 0), d3('c8-cube-multiplier-reasoning', 1)],
  'c8-comparing-quantities': [d3('c8-percentage-reasoning', 0), d3('c8-gst-reasoning', 1)],
  'c8-algebraic-identities': [d3('c8-like-terms-reasoning', 0), d3('c8-monomial-product-reasoning', 1)],
  'c8-mensuration': [d3('c8-area-decomposition-reasoning', 0), d3('c8-surface-area-reasoning', 1)],
  'c8-exponents': [d3('c8-exponent-laws-reasoning', 0), d3('c8-standard-form-reasoning', 2)],
  'c8-proportions': [d3('c8-direct-proportion-reasoning', 0), d3('c8-inverse-proportion-reasoning', 1)],
  'c8-factorisation': [d3('c8-common-factor-reasoning', 0), d3('c8-identity-factorisation-reasoning', 1)],
  'c8-graphs': [d3('c8-line-graph-reasoning', 0), d3('c8-plotting-reasoning', 1)],
  // ── Tranche 3: Class XI ───────────────────────────────────────────────────
  'c11-relations-functions': [d3('c11-cartesian-product-reasoning', 0)],
  'c11-trig-functions': [d3('c11-radian-unit-circle-reasoning', 0), d3('c11-trig-general-solution-reasoning', 2)],
  'c11-complex-numbers': [d3('c11-complex-modulus-reasoning', 0), d3('c11-complex-quadratic-reasoning', 2)],
  'c11-permutations-combinations': [d3('c11-counting-principle-reasoning', 0), d3('c11-arrangement-reasoning', 1)],
  'c11-sequences-series': [d3('c11-ap-reasoning', 0)],
  'c11-straight-lines': [d3('c11-line-equation-reasoning', 0), d3('c11-line-distance-reasoning', 2)],
  'c11-limits-derivatives': [d3('c11-limit-reasoning', 0), d3('c11-derivative-rules-reasoning', 2)],
  'c11-statistics': [d3('c11-mean-deviation-reasoning', 0), d3('c11-coefficient-variation-reasoning', 2)],
  'c11-probability': [d3('c11-sample-space-reasoning', 0), d3('c11-compound-event-reasoning', 2)]
});

/** The generators this table introduces, in table order. */
export const INDIA_HARDEST_GENERATORS = Object.freeze(
  Object.values(INDIA_HARDEST_COVERS).flatMap(list => list.map(entry => entry.gen))
);
