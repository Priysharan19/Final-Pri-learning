# Extension 1 bank variety: the decision each new form demands (22 November 2026)

**Status: the writer's own assessment. Not reviewed by a teacher, an examiner or NESA.** The difficulty
ordering below is a judgement about how many separate decisions a student must make, not a measured
difficulty. No student evidence stands behind it.

An external audit found that at the top difficulty one remembered recipe could carry a student through a
whole cell (every `me12-further-calc` D4 draw was an integral from 0 to 1/2 of k over the root of 1 minus
x squared) and that every `me12-induction-forms` draw asked for a number, so a student could finish
"Proof by Induction" without producing any part of a proof. These forms are the response. "Different" here
means the student makes a different **decision**, not that the numbers change.

Forms live in `client/src/engine/generators/au-forms-ext1-bank-nsw.js` and are verified by
`client/test/ext1-bank-forms-check.mjs` (300 seeds per difficulty, each key re-derived by an independent
route: Simpson's rule, central differences, direct summation, modular arithmetic, polynomial
multiplication, bisection on the function itself, and each multiple-choice option evaluated as the
statement it makes).

A full written proof is **not** marked in topic practice (it has no final answer, and the NSW bank admission
policy excludes answers that are entirely working). It is set and marked, with a rubric, only in the
Extension 1 papers. The induction forms here test one real step of constructing a proof each.

## me12-further-calc

| Level | Form | Decisions the student makes |
| --- | --- | --- |
| D1 | `fc-sin-grad` | Spot the chain-rule factor 1/m; find the argument at the point; take a rational root. |
| D1 | `fc-sin-simplify` | Differentiate sin⁻¹(x/m); put the root over a common denominator; cancel the m. (multiple choice) |
| D1 | `fc-sin-mcq` | Choose sin⁻¹ rule versus tan⁻¹ rule; keep the inner derivative; keep the square. |
| D1 | `fc-sin-domain` | Recognise where the gradient exists (open interval, endpoints excluded); solve a double inequality; choose the upper end. |
| D1 | `fc-sin-tangent` | Find the point and the gradient separately; build the tangent line. |
| D2 | `fc-tan-grad` | Chain rule with x/m; evaluate 1 + u² at the point. |
| D2 | `fc-tan-product` | Recognise a product; apply the product rule; differentiate tan⁻¹. (multiple choice) |
| D2 | `fc-tan-mcq` | Choose the derivative of tan⁻¹(x/m) from named slips. |
| D2 | `fc-tan-yvalue` | Given a y-value, read the argument back as tan y; then 1 + tan² y. |
| D2 | `fc-tan-tangent` | Find the point from the argument 1; find the gradient; write the tangent with π. |
| D2 | `fc-tan-second` | Differentiate twice; chain rule on (1 + x²)⁻¹; evaluate. |
| D3 | `fc-int-tan-root3` | Recognise 1/(1+x²); know tan⁻¹√3 = π/3, not π/4. |
| D3 | `fc-int-a2x2` | Identify a from a² + x²; keep the factor 1/a; evaluate at x = a. |
| D3 | `fc-anti-sin` | Choose the sin⁻¹ antiderivative; find a from a²; no extra factor. (multiple choice) |
| D3 | `fc-anti-tan` | Choose the tan⁻¹ antiderivative; keep 1/a, not 1/a². (multiple choice) |
| D3 | `fc-int-sin-limits` | Evaluate at two non-zero limits; convert x/a to angles; subtract. |
| D3 | `fc-int-decimal` | Recognise that the angle has no exact value; use radians; round to 3 decimal places. |
| D3 | `fc-int-find-k` | Integrate with an unknown constant; equate with a given multiple of π; solve. |
| D4 | `fc-int-factor` | Factor a perfect square out of the root; take √B outside; integrate; evaluate at an exact limit. |
| D4 | `fc-int-trigsub` | Choose u = sin x or u = cos x; change limits; recognise 1/(1+u²). |
| D4 | `fc-int-expsub` | Choose u = e^x; change limits through logarithms; choose tan⁻¹ or sin⁻¹; subtract two angles. |
| D4 | `fc-int-xsq` | Choose u = x²; keep the factor ½; change limits; choose tan⁻¹ or sin⁻¹. |
| D4 | `fc-int-area` | Set up an area as an integral; identify a; integrate; evaluate at a√3; round. |
| D4 | `fc-int-square-tan` | Complete the square; substitute u = x + b; change limits; keep the factor 1/c. |
| D4 | `fc-sub-mcq` | Choose which substitution gives 1/(1+u²) and absorbs the numerator. (multiple choice) |
| D4 | `fc-int-split` | Split a numerator into an f′/f part and a tan⁻¹ part; integrate each; add as decimals. |

D4 needs more decisions than D2 (substitution and limit change, completing the square, splitting) where
D2 asks for one rule applied once or twice.

## me11-binomial

| Level | Form | Decisions the student makes |
| --- | --- | --- |
| D1 | `bin-context` | See that order does not matter; choose a combination, not a permutation. |
| D1 | `bin-find-n` | Write C(n,2) as n(n−1)/2; solve for n from the product. |
| D1 | `bin-pascal` | Recognise two neighbours in a row; use Pascal's identity. |
| D1 | `bin-symmetry` | Choose the mirror entry; reject neighbours and changed rows. (multiple choice) |
| D1 | `bin-mirror` | Use symmetry to find the second r with the same value. |
| D2 | `bin-ax` | Treat ax as one quantity; raise the constant to the power k, with its sign. |
| D2 | `bin-sum-two` | Add two expansions' coefficients rather than combining powers. |
| D2 | `bin-equal-coeffs` | Use symmetry in reverse: equal entries sum to n. |
| D2 | `bin-general-term` | Choose the general term of (1 + ax)ⁿ. (multiple choice) |
| D2 | `bin-product-powers` | Combine (1+x)^m(1+x)^n into one power before reading a coefficient. |
| D2 | `bin-middle` | Know the row peaks in the middle. |
| D3 | `bin-axb` | Match a^k to x^k and b^(n−k) to the constant; sign of b. |
| D3 | `bin-independent` | Combine powers of x; set the exponent to zero; solve for r; evaluate the term (two shapes). |
| D3 | `bin-extra-factor` | Two ways to reach x^k from an extra bracket; add the contributions. |
| D3 | `bin-find-a` | Set up the coefficient equation; undo a power. |
| D3 | `bin-ratio` | Use the ratio of consecutive coefficients; solve for n. |
| D3 | `bin-signs` | Track the sign of (−b)^(n−k); choose the correct term. (multiple choice) |
| D4 | `bin-sum-sign` | Put x = 1 and keep the minus sign inside the bracket. |
| D4 | `bin-even-sum` | Use x = 1 and x = −1 together; add and halve. |
| D4 | `bin-find-n-sum` | Recognise Σ C(n,k)aᵏ as (1+a)ⁿ; solve for n. |
| D4 | `bin-sum-product` | Put x = 1 in a product; multiply the two sums. |
| D4 | `bin-find-a-sum` | Express the sum as (1+a)ⁿ; take a root; subtract 1. |
| D4 | `bin-sum-no-constant` | Total at x = 1; constant term at x = 0; subtract. |
| D4 | `bin-sum-mcq` | Recognise the alternating sum as (1 − a)ⁿ with an odd power. (multiple choice) |

## me11-functions (D1 and D3)

| Level | Form | Decisions the student makes |
| --- | --- | --- |
| D1 | `fn-eval-inverse` | Read f⁻¹(c) as "which input gives c"; solve. |
| D1 | `fn-inverse-negative` | Swap and solve with a negative coefficient. |
| D1 | `fn-inverse-mcq` | Undo in reverse order; reject the reciprocal. (multiple choice) |
| D1 | `fn-reverse-pairs` | Read two facts f(a) = b as f⁻¹(b) = a; add. |
| D1 | `fn-find-constant` | Turn f⁻¹(c) = t into f(t) = c; solve for the constant. |
| D3 | `fn-sqrt-eval` | Isolate the root; square; undo the shift. |
| D3 | `fn-exp-eval` | Isolate 2ˣ; recognise a power of 2. |
| D3 | `fn-fixed-point` | Know f and f⁻¹ meet on y = x; solve f(x) = x. |
| D3 | `fn-composite-inverse` | Read a composite inside-out; apply the inverse at the right stage (two orders). |
| D3 | `fn-sqrt-inverse` | Swap; isolate the root; square; restrict the domain. |
| D3 | `fn-reciprocal-eval` | Isolate the fraction; invert; undo the shift. |

## me12-vectors-forms (D1)

| Level | Form | Decisions the student makes |
| --- | --- | --- |
| D1 | `vec-distance` | Form AB from the two points before taking the magnitude. |
| D1 | `vec-perp-mcq` | Test a dot product of zero; reject parallel, swapped and sign-changed pairs. (multiple choice) |
| D1 | `vec-unit` | Divide by the magnitude; keep the sign. |
| D1 | `vec-find-k` | Write |v|² in terms of k; take the positive root. |
| D1 | `vec-sum-diff` | Expand or compute the sum and difference; take their dot product. |
| D1 | `vec-lambda` | Read a scalar multiple from components; keep the sign. |

## Induction (`me12-induction` and `me12-induction-forms`)

Each form tests one step of building a proof, with an expression or multiple-choice answer the checker
decides. Together, a session covers: state the target, build the left side from the assumption, use the
assumption, simplify, close the divisibility step, choose a valid base case, find an error, and say what
an inequality step needs. The same forms are served by both generators where the dot point matches.

| Level | Form | Decisions the student makes |
| --- | --- | --- |
| D1 | `ind-rhs-next` | State the right side of P(k+1) by replacing n everywhere (expression). |
| D1 | `ind-lhs-next` | Build the left side of P(k+1) from P(k): the (k+1)th term, not the kth, not twice. (multiple choice) |
| D1 | `ind-base-case` | Choose the correct base case for a statement that starts above 1: first value, correct arithmetic. (multiple choice) |
| D2 | `ind-factor-out` | After adding the new term, take out the common factor (k+1) and find what remains (expression). |
| D2 | `ind-flaw-series` | Find the faulty line in a short series proof: a base-case arithmetic slip, or the wrong term added. (multiple choice) |
| D2, D3 | `ind-div-m` | From a^k − 1 = dM, write a^(k+1) − 1 in terms of M (expression). |
| D3 | `ind-div-mk` | From a^k − b^k = dM, write a^(k+1) − b^(k+1) in terms of M and k (expression). |
| D2, D3 | `ind-div-cubic` | Expand (k+1)³ + c(k+1); use the assumption; write 3M + 3(…) (expression). |
| D3, D4 | `ind-final-factor` | Add the new term; expand; factorise the quadratic; read the last factor (expression). |
| D4 | `ind-geo-numerator` | Put the new term over the common denominator; collect powers into r^(k+1) − 1 (expression). |
| D4 | `ind-flaw-logic` | Find the logical flaw: assuming every case, wrong starting value, or wrong term in the step. (multiple choice) |
| D4 | `ind-ineq-show` | After using the assumption, say which inequality must still be shown. (multiple choice) |
| D4 | `ind-ineq-diff` | Expand two brackets; subtract; give the linear expression that must be non-negative (expression). |

## Syllabus caution

The writer is not certain that these two are inside the NSW Extension 1 (2024) syllabus as examinable
content, and they are placed at D4 only: `fc-int-square-tan` (completing the square before an inverse
trigonometric integral) and `fc-int-split` (splitting a numerator into a logarithmic and an inverse
tangent part; the standard form is in Extension 1, the combined exercise may be Extension 2 depth).
`fc-tan-second` (a second derivative of an inverse tangent) and the chain-rule composites with inverse
trigonometric functions are also worth a teacher's check against the syllabus.
