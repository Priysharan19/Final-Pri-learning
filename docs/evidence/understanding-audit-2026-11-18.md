# Understanding audit, 2026-11-18

**What this measures.** For every question family in both editions, how often the deterministic step checker (`stepCheck`, called the way the server calls it in `server/platform/markerOps.js`: `stepMetaFor(q)` then `stepCheck(meta, lines, { prompt })`) says anything about a line of student working, and whether what it says is right.

**This is a synthetic corpus.** Every transcript is built by fixed rules from the generator's own authored solution steps (`q.steps`), with no language model and no real student. It shows how the checker treats well-formed, correct working written in common styles. It is not a measure of how real students write, of handwriting recognition, or of learning. Real student working will be messier. Treat every rate below as an optimistic bound on silence.

Reproduce: `node tools/understanding-audit/run.mjs` (deterministic; fixed seeds; about a minute). Tool: `tools/understanding-audit/`.

## Key numbers

- 91.9% of generated questions have no step check at all: the server never judges a line of their working.
- Over all working lines in the corpus, 6.4% get any verdict and 6.4% of correct lines are ticked.
- Where the step check does run, 59.8% of lines get a verdict, 58.8% of correct lines are ticked, 0 correct lines are crossed, 268 of 289 slipped lines are caught at the right line, and 0 wrong lines are ticked.

## 1. Whether the question offers a step check at all

The server calls `stepCheck` only when `stepMetaFor(q)` returns a meta (an authored `stepcheck`, or a numeric answer with an `x =` prefix, or an expression or set answer). Across 414 families (5486 generated questions at 3 seeds and 4 difficulties, more seeds where a family offers step checking), **442 questions (8.1%) have a meta; 91.9% have none, so no line of their working is ever judged.** 47 of 414 families (11.4%) offer step checking on at least one question.

| Edition | Families | Families with any step check | Questions | Questions with a meta |
|---|---:|---:|---:|---:|
| NSW | 135 | 38 | 2030 | 300 (14.8%) |
| India | 279 | 9 | 3456 | 142 (4.1%) |

## 2. Headline: per line of working

"Any verdict" is a tick or a cross. A line the engine abstains on (status `note`) is silent. Rates use scored lines (true lines, the slip line, lines after the slip); prose lines are counted separately. "Correct lines ticked" is over true lines. A **false tick** is the engine ticking the line that is wrong.

### 2a. Everything a student would write, including questions with no step check

| Group | Scored lines | Any verdict | Correct lines ticked | False crosses | Wrong lines caught at the right line | FALSE TICKS |
|---|---:|---:|---:|---:|---:|---:|
| All | 80881 | 6.4% | 6.4% | 0 | 6.1% | 0 |
| NSW | 27571 | 9.8% | 9.8% | 0 | 9.6% | 0 |
| India | 53310 | 4.6% | 4.7% | 0 | 4.1% | 0 |

### 2b. Only questions where the server runs the step check

| Group | Scored lines | Any verdict | Correct lines ticked | False crosses | Wrong lines caught at the right line | FALSE TICKS |
|---|---:|---:|---:|---:|---:|---:|
| All | 8647 | 59.8% | 58.8% | 0 | 92.7% | 0 |
| NSW | 5770 | 46.9% | 45.6% | 0 | 88.0% | 0 |
| India | 2877 | 85.7% | 85.1% | 0 | 100.0% | 0 |
| All, excluding template lines | 8005 | 63.1% | 62.2% | 0 | 92.7% | 0 |

Template lines are authored lines that use a symbol the question never introduces (for example the generic formula `f'(x) = a(cx + e) + c(ax + b)`). They are true in the generator's terms but a student would not write them, so silence on them is arguably right. The last row removes them.

Lines after the slip are judged against the student's own work and are not scored for correctness: of 82, the engine ticked 38 and crossed 0. Prose lines: 160, of which the engine gave a verdict on 0.

**First break on slip transcripts (step-checked questions only, 289 transcripts):** found at the slipped line 268 (92.7%); reported at an earlier, correct line 0; reported later than the slip 0; no break reported 21.

## 3. False ticks (release-blocking)

No wrong line was ticked in this corpus. That is not proof there is none: the corpus has one slip per transcript, in three kinds (sign, arithmetic, dropped factor).

Transcripts of step-checked questions: 1981; with at least one true line crossed: 0 (0.0%).

## 4. False crosses (a true line marked wrong)

None in this corpus.

## 5. By working style (questions with a step check)

| Group | Scored lines | Any verdict | Correct lines ticked | False crosses | Wrong lines caught at the right line | FALSE TICKS |
|---|---:|---:|---:|---:|---:|---:|
| owner-misread | 3 | 0.0% | 0.0% | 0 | n/a | 0 |
| units | 29 | 17.2% | 17.2% | 0 | n/a | 0 |
| owner-clean | 3 | 33.3% | 33.3% | 0 | n/a | 0 |
| continuation | 29 | 41.4% | 41.4% | 0 | n/a | 0 |
| restate | 1610 | 52.4% | 52.4% | 0 | n/a | 0 |
| substitution | 131 | 53.4% | 53.4% | 0 | n/a | 0 |
| labelled | 1434 | 57.3% | 57.3% | 0 | n/a | 0 |
| therefore | 1808 | 57.8% | 57.8% | 0 | n/a | 0 |
| bare | 1769 | 59.2% | 59.2% | 0 | n/a | 0 |
| sentence | 626 | 68.4% | 68.4% | 0 | n/a | 0 |
| slip | 1190 | 74.5% | 70.8% | 0 | 92.7% | 0 |
| owner-wrong-choice | 7 | 85.7% | 85.7% | 0 | n/a | 0 |
| owner-right-choice | 8 | 87.5% | 87.5% | 0 | n/a | 0 |

Style names: bare = equation chain with the answer last; labelled = `label = value` or `label: value` answer line; therefore = answer line prefixed `∴`, `so`, `hence` or `therefore`; restate = question's expression written first; continuation = lines starting `=`; substitution = `f(2) = …`, `when x = …`, `let …`; units = units or words on the answer line; sentence = a prose line in the middle; slip = one realistic error (sign, arithmetic, dropped factor).

Same, over all questions (including those with no step check):

| Group | Scored lines | Any verdict | Correct lines ticked | False crosses | Wrong lines caught at the right line | FALSE TICKS |
|---|---:|---:|---:|---:|---:|---:|
| owner-misread | 3 | 0.0% | 0.0% | 0 | n/a | 0 |
| units | 2849 | 0.2% | 0.2% | 0 | n/a | 0 |
| continuation | 516 | 2.3% | 2.3% | 0 | n/a | 0 |
| labelled | 15037 | 5.5% | 5.5% | 0 | n/a | 0 |
| slip | 14966 | 5.9% | 5.9% | 0 | 6.1% | 0 |
| bare | 15945 | 6.6% | 6.6% | 0 | n/a | 0 |
| therefore | 15001 | 7.0% | 7.0% | 0 | n/a | 0 |
| sentence | 5853 | 7.3% | 7.3% | 0 | n/a | 0 |
| restate | 10239 | 8.2% | 8.2% | 0 | n/a | 0 |
| substitution | 454 | 15.4% | 15.4% | 0 | n/a | 0 |
| owner-clean | 3 | 33.3% | 33.3% | 0 | n/a | 0 |
| owner-wrong-choice | 7 | 85.7% | 85.7% | 0 | n/a | 0 |
| owner-right-choice | 8 | 87.5% | 87.5% | 0 | n/a | 0 |

## 6. By question family

### 6a. The 15 worst families that offer a step check (lowest share of correct lines ticked)

| Group | Scored lines | Any verdict | Correct lines ticked | False crosses | Wrong lines caught at the right line | FALSE TICKS |
|---|---:|---:|---:|---:|---:|---:|
| y12-integral-calc (NSW) | 77 | 0.0% | 0.0% | 0 | 0.0% | 0 |
| y12-trigcalc (NSW) | 51 | 13.7% | 12.0% | 0 | 100.0% | 0 |
| y12-trig-model (NSW) | 100 | 11.0% | 12.2% | 0 | 0.0% | 0 |
| me12-trigeq (NSW) | 475 | 13.9% | 13.9% | 0 | n/a | 0 |
| y12-explogcalc (NSW) | 184 | 15.8% | 14.8% | 0 | 100.0% | 0 |
| c11-sets (India) | 68 | 16.2% | 16.2% | 0 | n/a | 0 |
| hand:owner-buoy (NSW) | 6 | 16.7% | 16.7% | 0 | n/a | 0 |
| y11-sine-cosine-rule (NSW) | 55 | 21.8% | 17.3% | 0 | 100.0% | 0 |
| me12-calc (NSW) | 125 | 17.6% | 17.6% | 0 | n/a | 0 |
| mex-integration (NSW) | 58 | 20.7% | 20.7% | 0 | n/a | 0 |
| y11-trigfunc (NSW) | 110 | 20.0% | 22.4% | 0 | 0.0% | 0 |
| me11-functions (NSW) | 269 | 24.2% | 22.7% | 0 | 100.0% | 0 |
| c12-definite-integrals (India) | 139 | 29.5% | 26.3% | 0 | 100.0% | 0 |
| c11-complex-numbers (India) | 141 | 29.8% | 26.7% | 0 | 100.0% | 0 |
| ms12-nonright (NSW) | 21 | 38.1% | 31.6% | 0 | 100.0% | 0 |

### 6b. All 47 families that offer a step check, worst first

| Group | Scored lines | Any verdict | Correct lines ticked | False crosses | Wrong lines caught at the right line | FALSE TICKS |
|---|---:|---:|---:|---:|---:|---:|
| y12-integral-calc (NSW) | 77 | 0.0% | 0.0% | 0 | 0.0% | 0 |
| y12-trigcalc (NSW) | 51 | 13.7% | 12.0% | 0 | 100.0% | 0 |
| y12-trig-model (NSW) | 100 | 11.0% | 12.2% | 0 | 0.0% | 0 |
| me12-trigeq (NSW) | 475 | 13.9% | 13.9% | 0 | n/a | 0 |
| y12-explogcalc (NSW) | 184 | 15.8% | 14.8% | 0 | 100.0% | 0 |
| c11-sets (India) | 68 | 16.2% | 16.2% | 0 | n/a | 0 |
| hand:owner-buoy (NSW) | 6 | 16.7% | 16.7% | 0 | n/a | 0 |
| y11-sine-cosine-rule (NSW) | 55 | 21.8% | 17.3% | 0 | 100.0% | 0 |
| me12-calc (NSW) | 125 | 17.6% | 17.6% | 0 | n/a | 0 |
| mex-integration (NSW) | 58 | 20.7% | 20.7% | 0 | n/a | 0 |
| y11-trigfunc (NSW) | 110 | 20.0% | 22.4% | 0 | 0.0% | 0 |
| me11-functions (NSW) | 269 | 24.2% | 22.7% | 0 | 100.0% | 0 |
| c12-definite-integrals (India) | 139 | 29.5% | 26.3% | 0 | 100.0% | 0 |
| c11-complex-numbers (India) | 141 | 29.8% | 26.7% | 0 | 100.0% | 0 |
| ms12-nonright (NSW) | 21 | 38.1% | 31.6% | 0 | 100.0% | 0 |
| y8-linear (NSW) | 101 | 38.6% | 35.4% | 0 | 100.0% | 0 |
| me11-poly (NSW) | 152 | 36.8% | 35.6% | 0 | 100.0% | 0 |
| ms12-normal (NSW) | 48 | 43.8% | 35.7% | 0 | 100.0% | 0 |
| y11-lines (NSW) | 82 | 37.8% | 37.8% | 0 | n/a | 0 |
| y9-linear (NSW) | 281 | 40.2% | 40.1% | 0 | 100.0% | 0 |
| y8-algebra (NSW) | 552 | 44.6% | 40.7% | 0 | 100.0% | 0 |
| y9-algebra (NSW) | 176 | 45.5% | 42.2% | 0 | 100.0% | 0 |
| y12-appdiff (NSW) | 165 | 44.2% | 43.2% | 0 | 100.0% | 0 |
| me12-induction (NSW) | 121 | 44.6% | 43.7% | 0 | 100.0% | 0 |
| y11-polynomials (NSW) | 158 | 45.6% | 45.6% | 0 | n/a | 0 |
| y12-integration (NSW) | 97 | 48.5% | 47.3% | 0 | 66.7% | 0 |
| y10-indices-neg (NSW) | 208 | 48.1% | 47.8% | 0 | 100.0% | 0 |
| y12-diff (NSW) | 218 | 52.3% | 50.5% | 0 | 100.0% | 0 |
| y7-algebra (NSW) | 134 | 55.2% | 52.4% | 0 | 100.0% | 0 |
| y12-stats (NSW) | 125 | 56.0% | 53.0% | 0 | 100.0% | 0 |
| y11-quadfunc (NSW) | 215 | 56.7% | 54.9% | 0 | 100.0% | 0 |
| y11-diff (NSW) | 107 | 65.4% | 64.8% | 0 | 100.0% | 0 |
| mex-proof (NSW) | 49 | 65.3% | 65.3% | 0 | n/a | 0 |
| y12-series (NSW) | 76 | 69.7% | 67.6% | 0 | 100.0% | 0 |
| y10-quadratics (NSW) | 224 | 70.1% | 70.1% | 0 | n/a | 0 |
| c10-linear-pair-methods (India) | 373 | 76.9% | 76.2% | 0 | 100.0% | 0 |
| y7-equations (NSW) | 265 | 78.1% | 77.5% | 0 | 87.5% | 0 |
| hand:owner-stationary (NSW) | 15 | 86.7% | 86.7% | 0 | n/a | 0 |
| c7-range-display-reasoning (India) | 216 | 88.9% | 88.9% | 0 | n/a | 0 |
| y8-equations (NSW) | 403 | 89.6% | 89.1% | 0 | 100.0% | 0 |
| ms11-formulas (NSW) | 36 | 91.7% | 91.2% | 0 | 100.0% | 0 |
| y7-angles (NSW) | 193 | 92.7% | 92.3% | 0 | 100.0% | 0 |
| c8-linear-equations-brackets (India) | 544 | 93.2% | 92.9% | 0 | 100.0% | 0 |
| y11-explog (NSW) | 38 | 94.7% | 94.4% | 0 | 100.0% | 0 |
| c8-linear-equations-source-mastery (India) | 390 | 97.2% | 97.0% | 0 | 100.0% | 0 |
| c8-linear-equations-both-sides (India) | 547 | 100.0% | 100.0% | 0 | 100.0% | 0 |
| c8-linear-equations-decimals (India) | 459 | 100.0% | 100.0% | 0 | 100.0% | 0 |

### 6c. The 367 families with no step check on any generated question

Their working is never judged by the server, whatever the student writes. By chapter prefix:

| Prefix | Families without step check | of which in total |
|---|---:|---:|
| c11 | 61 | 63 |
| c7 | 60 | 61 |
| c8 | 50 | 54 |
| c10 | 44 | 45 |
| c12 | 32 | 33 |
| c9 | 16 | 16 |
| y10 | 16 | 18 |
| ms12 | 15 | 17 |
| y9 | 13 | 15 |
| ms11 | 10 | 11 |
| me12 | 8 | 11 |
| olymp | 7 | 7 |
| y11 | 7 | 14 |
| y8 | 7 | 10 |
| y7 | 6 | 9 |
| me11 | 5 | 7 |
| mex | 5 | 7 |
| y12 | 5 | 14 |

Full list: `c10-ap-daily-life-reasoning`, `c10-ap-inverse-competency`, `c10-ap-sum-forms`, `c10-ap-sum-reasoning`, `c10-ap-term-forms`, `c10-areas-circles`, `c10-arithmetic-progressions`, `c10-bpt-reasoning`, `c10-circles`, `c10-coordinate-geometry`, `c10-distance-reasoning`, `c10-grouped-mean-reasoning`, `c10-grouped-mode-reasoning`, `c10-irrationality-proofs`, `c10-linear-condition-forms`, `c10-linear-graphs`, `c10-linear-pair-situations-reasoning`, `c10-linear-solution-conditions`, `c10-linear-ticket-competency`, `c10-polynomial-zeroes`, `c10-polynomial-zeroes-reasoning`, `c10-probability-classical`, `c10-probability-reasoning`, `c10-quadratic-context`, `c10-quadratic-discriminant`, `c10-quadratic-factorisation-reasoning`, `c10-quadratic-k-forms`, `c10-quadratic-roots`, `c10-quadratic-triangle-competency`, `c10-real-numbers`, `c10-section-reasoning`, `c10-sector-reasoning`, `c10-statistics`, `c10-surface-area-combo`, `c10-surface-volume-combo`, `c10-tangent-length-reasoning`, `c10-triangles-current`, `c10-trig-applications-current`, `c10-trig-boundary-relations`, `c10-trig-ratio-reasoning`, `c10-trig-standard-reasoning`, `c10-trigonometry-current`, `c10-volume-combination-reasoning`, `c10-zero-coefficient-forms`, `c11-3d-distance-jee-reasoning`, `c11-3d-introduction`, `c11-3d-point-jee-reasoning`, `c11-3d-section-jee-reasoning`, `c11-ap-jee-reasoning`, `c11-ap-reasoning`, `c11-arrangement-jee-reasoning`, `c11-arrangement-reasoning`, `c11-binomial-expansion-jee-reasoning`, `c11-binomial-general-term-jee-reasoning`, `c11-binomial-middle-term-jee-reasoning`, `c11-binomial-theorem`, `c11-cartesian-product-reasoning`, `c11-circle-jee-reasoning`, `c11-coefficient-variation-reasoning`, `c11-complex-algebra-reasoning`, `c11-complex-modulus-reasoning`, `c11-complex-polar-reasoning`, `c11-complex-quadratic-jee-reasoning`, `c11-complex-quadratic-reasoning`, `c11-compound-event-reasoning`, `c11-conic-sections`, `c11-counting-principle-jee-reasoning`, `c11-counting-principle-reasoning`, `c11-derivative-rules-reasoning`, `c11-domain-range-reasoning`, `c11-ellipse-hyperbola-jee-reasoning`, `c11-first-principles-reasoning`, `c11-inclusion-exclusion-jee-reasoning`, `c11-inequality-region-jee-reasoning`, `c11-inequality-system-jee-reasoning`, `c11-limit-jee-reasoning`, `c11-limit-reasoning`, `c11-limits-derivatives`, `c11-line-angle-reasoning`, `c11-line-distance-reasoning`, `c11-line-equation-jee-reasoning`, `c11-line-equation-reasoning`, `c11-linear-inequalities`, `c11-linear-inequality-jee-reasoning`, `c11-mean-deviation-jee-reasoning`, `c11-mean-deviation-reasoning`, `c11-parabola-jee-reasoning`, `c11-permutations-combinations`, `c11-probability`, `c11-radian-circle-reasoning`, `c11-radian-unit-circle-reasoning`, `c11-real-function-reasoning`, `c11-relations-functions`, `c11-sample-space-jee-reasoning`, `c11-sample-space-reasoning`, `c11-sequence-means`, `c11-sequences-series`, `c11-set-notation-jee-reasoning`, `c11-set-operations-jee-reasoning`, `c11-statistics`, `c11-straight-lines`, `c11-trig-functions`, `c11-trig-general-solution-reasoning`, `c11-trig-identity-reasoning`, `c11-variance-reasoning`, `c12-3d-geometry`, `c12-applications-derivatives`, `c12-applications-integrals`, `c12-bijection-reasoning`, `c12-composite-inverse-reasoning`, `c12-conditional-probability`, `c12-continuity-mvt`, `c12-continuity-test-reasoning`, `c12-determinants`, `c12-differentiability-reasoning`, `c12-differential-equations`, `c12-differentiation-rules`, `c12-functions-onto-inverse`, `c12-integral-properties`, `c12-integrals-methods`, `c12-inverse-trig-branch-reasoning`, `c12-inverse-trig-evaluate-reasoning`, `c12-inverse-trigonometric`, `c12-linear-programming`, `c12-matrices`, `c12-monotonic-tangent-reasoning`, `c12-optimisation-reasoning`, `c12-principal-value-reasoning`, `c12-probability-bayes`, `c12-random-variable`, `c12-rate-approximation-reasoning`, `c12-related-rates-reasoning`, `c12-relations-equivalence`, `c12-vector-algebra`, `c12-vector-direction-reasoning`, `c12-vector-dot-product`, `c12-vector-magnitude-reasoning`, `c7-angle-construction-reasoning`, `c7-angle-pair-reasoning`, `c7-angle-sum-reasoning`, `c7-arithmetic-expressions-current`, `c7-balance-reasoning`, `c7-bracket-placement-reasoning`, `c7-common-ground-current`, `c7-congruence-inference-reasoning`, `c7-congruent-matching-reasoning`, `c7-connecting-dots-current`, `c7-constructions-tilings-current`, `c7-cryptarithm-reasoning`, `c7-decimal-context-reasoning`, `c7-decimal-division-reasoning`, `c7-decimal-multiplication-reasoning`, `c7-decimal-operations-current`, `c7-decimal-ordering-reasoning`, `c7-decimal-place-value-reasoning`, `c7-decimals-current`, `c7-equation-context-reasoning`, `c7-expression-comparison-reasoning`, `c7-expression-translation-reasoning`, `c7-factor-regroup-reasoning`, `c7-finding-unknown-current`, `c7-formula-evaluation-reasoning`, `c7-fraction-context-reasoning`, `c7-fraction-magnitude-reasoning`, `c7-fraction-product-reasoning`, `c7-fractions-current`, `c7-geometric-twins-current`, `c7-hcf-lcm-context-reasoning`, `c7-hcf-reasoning`, `c7-integer-division-reasoning`, `c7-integer-expression-reasoning`, `c7-integer-operations-current`, `c7-integer-product-sign-reasoning`, `c7-large-numbers-current`, `c7-lcm-reasoning`, `c7-letter-numbers-current`, `c7-letter-pattern-reasoning`, `c7-magic-square-reasoning`, `c7-mean-reasoning`, `c7-number-play-current`, `c7-one-step-equation-reasoning`, `c7-parallel-intersecting-lines-current`, `c7-parity-reasoning`, `c7-perpendicular-bisector-reasoning`, `c7-place-value-systems-reasoning`, `c7-property-rewrite-reasoning`, `c7-rounding-bounds-reasoning`, `c7-solid-shapes`, `c7-sss-sas-reasoning`, `c7-statistical-question-reasoning`, `c7-symmetry`, `c7-tiling-invariant-reasoning`, `c7-transversal-reasoning`, `c7-triangle-angles`, `c7-triangle-construction-reasoning`, `c7-triangle-inequality-reasoning`, `c7-triangles-current`, `c8-algebraic-identities-ncert-mastery`, `c8-area-decomposition-reasoning`, `c8-bar-graph-reasoning`, `c8-common-factor-reasoning`, `c8-comparing-quantities-ncert-mastery`, `c8-cube-multiplier-reasoning`, `c8-cube-pattern-reasoning`, `c8-cubes-roots`, `c8-cubes-roots-ncert-mastery`, `c8-data-charts`, `c8-data-handling-ncert-mastery`, `c8-direct-proportion-reasoning`, `c8-exponent-laws-reasoning`, `c8-exponents-ncert-mastery`, `c8-exterior-angle-reasoning`, `c8-factorisation-ncert-mastery`, `c8-graphs-ncert-mastery`, `c8-gst-reasoning`, `c8-identity-factorisation-reasoning`, `c8-inverse-proportion-reasoning`, `c8-like-terms-reasoning`, `c8-line-graph-reasoning`, `c8-linear-equations-foundations`, `c8-linear-equations-fractions`, `c8-linear-equations-verification`, `c8-mensuration-ncert-mastery`, `c8-monomial-product-reasoning`, `c8-percentage-reasoning`, `c8-pie-chart-reasoning`, `c8-plotting-reasoning`, `c8-proportions-dir-inv`, `c8-proportions-ncert-mastery`, `c8-quadrilateral-property-reasoning`, `c8-quadrilaterals`, `c8-quadrilaterals-ncert-mastery`, `c8-rational-numbers`, `c8-rational-numbers-associativity`, `c8-rational-numbers-between`, `c8-rational-numbers-closure`, `c8-rational-numbers-commutativity`, `c8-rational-numbers-distributivity`, `c8-rational-numbers-foundations`, `c8-rational-numbers-identities`, `c8-rational-numbers-strategy`, `c8-square-pattern-reasoning`, `c8-square-root-reasoning`, `c8-squares-roots`, `c8-squares-roots-ncert-mastery`, `c8-standard-form-reasoning`, `c8-surface-area-reasoning`, `c9-algebraic-identities-ncert-mastery`, `c9-circles`, `c9-circles-ncert-mastery`, `c9-coordinate-geometry`, `c9-coordinate-geometry-ncert-mastery`, `c9-euclid-geometry`, `c9-herons-formula`, `c9-linear-polynomials-ncert-mastery`, `c9-number-systems-ncert-mastery`, `c9-perimeter-area-ncert-mastery`, `c9-polynomial-basics`, `c9-probability-ncert-mastery`, `c9-quadrilaterals`, `c9-sequences-progressions-ncert-mastery`, `c9-statistics-grouped`, `c9-triangles`, `me11-binomial`, `me11-comb`, `me11-inversetrig`, `me11-rates`, `me11-trigid`, `me12-binomial`, `me12-binomial-forms`, `me12-further-calc`, `me12-induction-forms`, `me12-projectile`, `me12-projectile-forms`, `me12-vectors`, `me12-vectors-forms`, `mex-complex`, `mex-demoivre`, `mex-mechanics`, `mex-vectors`, `mex-vectors-lines`, `ms11-data`, `ms11-earning`, `ms11-earning-exact`, `ms11-energy`, `ms11-linear`, `ms11-managing-exact`, `ms11-measure`, `ms11-measure-more`, `ms11-relfreq`, `ms11-time-location`, `ms12-algebraic`, `ms12-annuity`, `ms12-annuity-table`, `ms12-bivariate`, `ms12-bivariate-fit`, `ms12-critical-path`, `ms12-depreciation`, `ms12-invest-loans`, `ms12-loans`, `ms12-network-flow`, `ms12-networks`, `ms12-normal-exact`, `ms12-rates`, `ms12-right-triangle`, `ms12-simple-interest`, `olymp-combinatorics`, `olymp-functional-equations`, `olymp-geometry`, `olymp-inequalities`, `olymp-number-theory`, `olymp-polynomials`, `olymp-proof`, `y10-circle-geometry`, `y10-compound`, `y10-functions`, `y10-geometry-proof`, `y10-logarithms`, `y10-networks`, `y10-nonlinear`, `y10-polynomials`, `y10-probability`, `y10-simeq`, `y10-similarity`, `y10-stats`, `y10-surds`, `y10-trig`, `y10-trig-any-angle`, `y10-trig-nonright`, `y11-data-sets`, `y11-explog-more`, `y11-functions`, `y11-functions-more`, `y11-probability`, `y11-transform`, `y11-trig-ident`, `y12-fin-exact`, `y12-financial`, `y12-func-model`, `y12-motion`, `y12-random-var`, `y7-area`, `y7-data`, `y7-decimals-perc`, `y7-fractions`, `y7-integers`, `y7-ratio`, `y8-circles`, `y8-geo-figures`, `y8-indices`, `y8-percentages`, `y8-probability`, `y8-rates`, `y8-volume`, `y9-data`, `y9-data-inquiry`, `y9-indices-sci`, `y9-nonlinear-a`, `y9-probability`, `y9-pythagoras`, `y9-rate-change`, `y9-simint`, `y9-surface-area`, `y9-surface-solids`, `y9-trig`, `y9-variation`, `y9-volume-solids`

## 7. Why the engine is silent (questions with a step check)

3474 scored lines got no verdict. Reasons are assigned from the shape of the line (first matching rule), so they are this audit's classification, not the engine's own words.

| # | Reason | Silent lines | Share of silent | Example |
|---:|---|---:|---:|---|
| 1 | equation, other form | 915 | 26.3% | `a^2 = 121` (bare) |
| 2 | line judged to be off the answer path ("this question’s check covers the lines that lead to the answer") | 641 | 18.5% | `x = 197 - 8 × 22 = 21` (bare) |
| 3 | line is about a letter other than the question’s unknown | 390 | 11.2% | `x^2 - 2x + 26 = 0` (restate) |
| 4 | equation with a symbol the question never introduces (template/formula line) | 236 | 6.8% | `a + b = 7` (bare) |
| 5 | word label before the value ("max = …", "x-int: …", "ans = …") | 212 | 6.1% | `f(g(x)) = (4x + 1) + 2 = 4x + 3` (bare) |
| 6 | units / words after the number ("= 27 m", "72 °", "10 years") | 192 | 5.5% | `-33 dollars` (units) |
| 7 | single-letter variable equation ("x = 35", "a = 10") not matching an expected step | 163 | 4.7% | `x = 4y + 2` (bare) |
| 8 | expression only, no "=" (not an equation) | 139 | 4.0% | `f⁻¹(x): (x - 2)/2` (labelled) |
| 9 | continuation line starting with "=" | 118 | 3.4% | `= 9` (continuation) |
| 10 | inequality or chained comparison | 101 | 2.9% | `b^2 - 4ac = 4 - 104 = -100 < 0` (bare) |
| 11 | function / point evaluation ("f(2) = …", "P(-3) = …") | 101 | 2.9% | `f(x) = 4x + 2` (restate) |
| 12 | starts with a "∴" / "so" / "hence" / "therefore" prefix | 97 | 2.8% | `so ans = 2 or 3 or 6 or 8 or 9 or 11 or 12` (therefore) |
| 13 | "couldn’t read the solution list / derivative line safely" (sets, lists, derivatives) | 70 | 2.0% | `A = {8, 9, 11, 12}` (bare) |
| 14 | multi-"=" chain (a = b = c) | 41 | 1.2% | `h = 15 + 12×1/2 = 21` (bare) |
| 15 | substitution line ("when …", "let …") | 26 | 0.7% | `let A = {3, 4, 7, 10, 11}` (substitution) |

The engine's own stated reason for silence (digits normalised to `#`):

| # | Engine note | Lines | Example |
|---:|---|---:|---|
| 1 | Not checked — Pri cannot place this line on the way to the answer, so it is not marked right or wrong. | 1188 | `x = 4y + 2` |
| 2 | Not checked — this question’s check covers the lines that lead to the answer. | 898 | `x = 197 - 8 × 22 = 21` |
| 3 | This line is about another letter. Pri has nothing in this question to check it against, so it is neither marked wrong nor counted. | 442 | `x^2 - 2x + 26 = 0` |
| 4 | Skipped — I couldn’t read the solution list safely. | 283 | `A = {8, 9, 11, 12}` |
| 5 | This defines something the method uses, so it is not checked against the answer. | 254 | `u = 5x^2` |
| 6 | Not verified: Pri does not check lines with this label. | 59 | `T = 2π÷(π)/6 = 12` |
| 7 | True — differentiating this line gives the integrand. It differs from the final answer by a constant, or is not yet simplified. | 39 | `6/5 e^(5x^2) + C` |
| 8 | True whatever the letters stand for — it says nothing about this question. | 35 | `(k+1)^3 + 5(k+1) = k^3 + 3k^2 + 3k + 1 + 5k + 5` |
| 9 | True for the answer. It would also allow another value of a, which the question's conditions rule out — check each value against the question. | 27 | `a^2 = 121` |
| 10 | (no reason given) | 26 | `∫ 12x e^(5x^2) dx` |
| 11 | This power can be read two ways (e^#x is e^(#x) or (e^#)x), so it is not marked wrong. Put the exponent in brackets. | 25 | `= 3e^4x((x - 4)/4 - 1/16)` |
| 12 | x = # and x = −# are also a solution. | 24 | `x^2 = 16` |
| 13 | Not checked — Pri cannot tell which values this line gives, so it is not marked right or wrong. | 22 | `cosθ = ±(√(3))/2` |
| 14 | Not verified: Pri cannot check this line against the question. | 21 | `3 ≤ h ≤ 25` |
| 15 | True for every value (an identity), so it does not carry the equation forward: Pri neither marks it right nor wrong. | 20 | `x^2 + 5x - 14 = (x + 7)(x - 2)` |

## 8. Limits of the method

- **Synthetic.** Lines are rewritten from the generators' own authored solutions. Real working has other orders, abbreviations, errors and recognition noise. Silence here is a lower bound on silence in use.
- **Truth is by construction.** A line is "valid" because the authored solution says it. Authored lines are not always what a student would write (template lines, step labels turned into equations). The report shows the rate with and without template lines, but the flag is a heuristic.
- **One slip per transcript**, of three kinds (sign, arithmetic, dropped factor), placed on a line that is a closed numeric equality (or the final answer). It does not test slips inside algebra, a wrong method, or two errors.
- **Truth of numbers uses `calc.mjs`**, a small evaluator separate from the engine, so the engine does not grade itself. It reads only plain arithmetic, so slips are never placed on symbolic lines.
- **Families are the authored subtopic generators** loaded by `loadAllBanks()` (both editions, with the `au-forms` overlays and the extra structural forms the server draws). Reviewed JEE past-paper generators (`jee-pyq:`), the source-cited archive (`pyq-archive:`), exam items and hand-built questions are not enumerated.
- **Which meta a question gets is the server's rule** (`stepMetaFor`), copied by importing it, so the first section tracks the product. A question reached by another route (an authored `stepcheck` added later, an exam item) would differ.
- **Printed-solution wording.** Where the authored step is prose ("Multiply first"), only its math spans become lines; the prose becomes a sentence line in one style only.
- **Marks, not understanding.** A verdict here is a line-level tick or cross, not a mark, and says nothing about whether a student learnt anything.
