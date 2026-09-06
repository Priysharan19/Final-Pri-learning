// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · India-native coverage for the chapters that borrowed NSW banks
//
// Nineteen of the eighty-four India chapters reached at least one of their dot
// points through a generator written for the NSW syllabus — `y10-simeq` for
// Class 10 elimination, `y11-diff` for Class 11 Limits and Derivatives,
// `me12-binomial` for the Class 12 random variable, and so on. This table
// replaces those entries with the generators authored against NCERT in
// india-class10-core.js, india-class11.js and india-class12.js.
//
// It is a coverage table and nothing else. The dot points a chapter declares —
// the claim about what a student is being taught — are untouched, and so is
// every review state in indiaProductionMeta.js: authoring a generator is not a
// source review, and a table in this file cannot make it one.
//
// ── Why the difficulty lists got shorter ─────────────────────────────────────
//
// Most of these chapters carried `maps: 'y11-functions'`, which is sugar for
// "this generator covers every dot point at every difficulty". That is a strong
// claim and it was never checked form by form: `y11-functions` D1 is not about
// the Cartesian product, and `y12-series` D3–D4 are geometric while the Class 10
// chapter that borrowed them wanted arithmetic. Written out per difficulty, the
// honest coverage is narrower — a dot point that one rung of the ladder asks
// about is claimed at that rung and not at the other three. The count of dot
// points reachable at only one of the four difficulties therefore RISES against
// the borrowed mapping. That is the measurement improving, not the product
// getting worse: the old number was lower because the old claim was larger.
//
// The standard each entry has to meet is the one curriculum-in-base.js sets:
// every difficulty an entry names must ask about the dot point it claims.
// ─────────────────────────────────────────────────────────────────────────────

const ALL = [1, 2, 3, 4];
const c = (gen, dp, diff = ALL) => ({ gen, dp: [...dp], diff: [...diff] });

/**
 * chapterId → the covers that replace whatever the chapter had. Entries naming
 * a generator this project already wrote (`c10-linear-graphs`,
 * `c12-probability-bayes`, `c11-sequence-means`, …) are carried through
 * unchanged; the ones that changed are the ones that used to name a `y…`,
 * `ms…`, `me…` or `mex…` subtopic from the NSW banks.
 */
export const INDIA_NATIVE_COVERS = Object.freeze({

  // ── Class 10 ──────────────────────────────────────────────────────────────
  // The 2026–27 Class X overlay already covers the graphical and
  // algebraic-condition outcomes natively; what was borrowed was the pair of
  // algebraic methods, the two solution methods for a quadratic, and the whole
  // of probability.
  'c10-pair-linear-equations': [
    c('c10-linear-graphs', [0]),
    c('c10-linear-solution-conditions', [1]),
    c('c10-linear-pair-methods', [2], [1, 2, 3]),
    c('c10-linear-pair-methods', [3], [4])
  ],
  'c10-quadratic-equations': [
    c('c10-quadratic-roots', [0], [1, 2]),
    c('c10-quadratic-roots', [1], [3, 4]),
    c('c10-quadratic-discriminant', [2]),
    c('c10-quadratic-context', [3])
  ],
  // The Year 8 bank could only be credited at D1, because its D2–D4 rungs run
  // on to complement, expected frequency and experimental probability — none of
  // which is a current Class X outcome. A native ladder reaches all four.
  'c10-probability': [
    c('c10-probability-classical', [0], [1, 2]),
    c('c10-probability-classical', [1], [3, 4])
  ],

  // ── Class 11 ──────────────────────────────────────────────────────────────
  'c11-relations-functions': [
    c('c11-relations-functions', [0], [1, 4]),
    c('c11-relations-functions', [1], [2, 3]),
    c('c11-relations-functions', [2], [3])
  ],
  'c11-trig-functions': [
    c('c11-trig-functions', [0], [1, 2]),
    c('c11-trig-functions', [1], [3]),
    c('c11-trig-functions', [2], [4])
  ],
  'c11-complex-numbers': [
    c('c11-complex-numbers', [0], [1, 2]),
    c('c11-complex-numbers', [1], [3]),
    c('c11-complex-numbers', [2], [4])
  ],
  // D3 is a cricket XI chosen with a restriction on the bowlers. It is
  // tempting to claim it for "arrangements … with restrictions" as well, but a
  // team is a selection and not an arrangement, so it is credited to the
  // selections dot point alone and D2 carries the arrangements by itself.
  'c11-permutations-combinations': [
    c('c11-permutations-combinations', [0], [1]),
    c('c11-permutations-combinations', [1], [2]),
    c('c11-permutations-combinations', [2], [3, 4])
  ],
  // `c11-sequence-means` already covered the means-and-standard-sums dot point;
  // what was borrowed was the AP and GP work at the front of the chapter.
  'c11-sequences-series': [
    c('c11-sequences-series', [0], [1, 2]),
    c('c11-sequences-series', [1], [3, 4]),
    c('c11-sequence-means', [2])
  ],
  'c11-straight-lines': [
    c('c11-straight-lines', [0], [1, 2]),
    c('c11-straight-lines', [1], [3]),
    c('c11-straight-lines', [2], [4])
  ],
  'c11-limits-derivatives': [
    c('c11-limits-derivatives', [0], [1, 2]),
    c('c11-limits-derivatives', [1], [3]),
    c('c11-limits-derivatives', [2], [4])
  ],
  // The only borrowed entry here was a second, redundant claim on the variance
  // dot point: `y10-stats` D2 sat beside `c11-statistics` D2–D3 on the same dot
  // point, so removing it costs the chapter no coverage at all.
  'c11-statistics': [
    c('c11-statistics', [0], [1]),
    c('c11-statistics', [1], [2, 3]),
    c('c11-statistics', [2], [4])
  ],
  'c11-probability': [
    c('c11-probability', [0], [1, 2]),
    c('c11-probability', [1], [3, 4]),
    c('c11-probability', [2], [4])
  ],

  // ── Class 12 ──────────────────────────────────────────────────────────────
  'c12-relations-functions': [
    c('c12-relations-equivalence', [0]),
    c('c12-functions-onto-inverse', [1], [2, 4]),
    c('c12-functions-onto-inverse', [2], [1, 3])
  ],
  // D3 evaluates $\cos^{-1}x$ from $\sin^{-1}x$, which is both an evaluation
  // and an application of the standard complementary identity, so it is
  // claimed for both dot points rather than for whichever reads better.
  'c12-inverse-trigonometric': [
    c('c12-inverse-trigonometric', [0], [1, 2]),
    c('c12-inverse-trigonometric', [1], [2, 3]),
    c('c12-inverse-trigonometric', [2], [3, 4])
  ],
  'c12-continuity-differentiability': [
    c('c12-continuity-mvt', [0], [1, 2]),
    c('c12-differentiation-rules', [1]),
    c('c12-continuity-mvt', [2], [3, 4])
  ],
  'c12-applications-derivatives': [
    c('c12-applications-derivatives', [0], [1]),
    c('c12-applications-derivatives', [1], [2, 3]),
    c('c12-applications-derivatives', [2], [4])
  ],
  'c12-integrals': [
    c('c12-integrals-methods', [0]),
    c('c12-definite-integrals', [1]),
    c('c12-integral-properties', [2])
  ],
  'c12-vector-algebra': [
    c('c12-vector-algebra', [0], [1, 2]),
    c('c12-vector-dot-product', [1]),
    c('c12-vector-algebra', [2], [3, 4])
  ],
  'c12-probability': [
    c('c12-conditional-probability', [0]),
    c('c12-probability-bayes', [1]),
    c('c12-random-variable', [2])
  ]
});

/** The chapters this table rewires, in curriculum order. */
export const INDIA_NATIVE_COVER_IDS = Object.freeze(Object.keys(INDIA_NATIVE_COVERS));
