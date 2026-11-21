# Advanced bank: the decision each new form asks for (22 November 2026)

**Status: the writer's own assessment. A teacher has not reviewed any difficulty label or any "decision" below.** A form is listed at a level when it is issued there; "decisions" is what the student must decide or notice, not what number they read. Higher levels are meant to demand more decisions and more steps, not bigger numbers.

Why these forms exist: an external audit found Advanced cells where a student saw one question shape over and over (for example `y11-explog-more` at every level, `y11-trig-ident` D1, `y12-financial` D3), so success could come from memorising one recipe. Each cell below now has the established generator form plus at least five new forms that differ in the decision they ask for. Every key is computed in code; `client/test/adv-variety-forms-check.mjs` recomputes each one by a different route (numeric integration, month-by-month iteration, root scanning, brute-force enumeration, data sets built to the stated mean and spread).

Dot points are the cell-level ones in `DOTPOINT_FORMS`; nothing here claims more than that, and no form declares a dot point of its own. (`y12-financial` D2 and D3 are shared by two dot points; declaring one per form would add cells where the practice picker's dot-point filter does not narrow, which `client/test/practice-dotpoint-check.mjs` records and only lets shrink.)

## y11-explog-more (files: `au-forms-adv11-c-nsw.js`)

| Form | Levels | Decisions the student makes |
|---|---|---|
| Which single log equals this? (MCQ) | D1, D2 | Turn coefficients into powers, then decide which terms multiply and which divide. D2 has three terms and a subtracted one. |
| Evaluate with a law that cancels | D1, D2 | The numbers are not powers of the base, so spot that the sum, difference or power-then-difference of logs makes a power of the base. |
| Log to a power of the base | D1, D2 | Choose a common base and write the answer as a fraction. |
| Unknown base | D1 | Rewrite `log_x N = k` as `x^k = N` and take a root. |
| Negative and fractional logs | D1, D2 | Read a reciprocal as a negative index and a root as a fractional index. |
| Solve `a^x = c` by taking logs | D2, D3 | Recognise the bases cannot be matched. D3 adds a shift in the index or a multiplier to isolate first. |
| Time to reach a size (integer) | D2 | Divide for the total factor, write it as a power of the growth factor, read the index. |
| Between which whole numbers? | D2, D3 | Bracket by powers of the base without a calculator. D3 uses a fraction below 1, so the answer is negative. |
| Hidden quadratic in `b^x` | D3, D4 | Substitute `u = b^x`, solve, then back-substitute. D4 has a negative root of `u` that must be rejected. |
| Extraneous root | D4 | Combine two logs, solve the quadratic, then reject the root that breaks the domain. |
| Logarithmic graph | D3, D4 | D3: intercept from `y = 0`. D4: find an unknown coefficient from a point, evaluating the log exactly. |
| Express in terms of `p` and `q` | D3, D4 | Factor into primes, split with the laws, remember `log_b b = 1`. D4 includes quotients. |
| Unknown rate (percent) | D3, D4 | Take the n-th root of the growth ratio, then convert the multiplier to a percentage change (fall or rise). |
| First whole period past a target | D3, D4 | Model, take logs, round UP. D4 is a decay, so dividing by a negative log reverses the inequality. |

## y11-trig-ident (`au-forms-adv11-c-nsw.js`)

| Form | Levels | Decisions |
|---|---|---|
| Other ratio from one ratio and a quadrant | D1 | Use `sin^2 + cos^2 = 1`, then choose the sign from the quadrant. |
| Which expression is identical? (MCQ) | D1 | Choose between Pythagorean and quotient identities and the rearranged forms. |
| Squared ratios | D1 | Spot `1 - sin^2 = cos^2`, or split `cos^2 + 2 sin^2`, then square a given ratio (a negative squared is positive). |
| Which statement is true for every angle? (MCQ) | D1 | Tell an identity from a plausible false rule by testing an angle. |
| Identity behind an awkward angle | D1 | Spot the identity instead of calculating; one version needs the quotient identity as well. |
| Linear equation in a ratio | D2, D4 | Rearrange, find the reference angle, use the right quadrants and the ends of the interval. |
| `sin = m cos` | D2, D4 | Divide to make a tangent, then use its period. D4 includes the root-3 values. |
| Different interval | D2, D4 | Extend or shift solutions for `-180` to `180` or `0` to `720`. |
| Reference angle | D2 | Ignore the sign and recall the special value. |
| The other solution | D2 | Pick the symmetry that matches the function (180 minus, 360 minus, plus 180). |
| Quadratic in a ratio | D4 | Factorise, reject a value outside -1 to 1, count each value's angles. |
| Equation needing the identity first | D4 | Replace the squared other ratio using `sin^2 + cos^2 = 1`, then factorise. |
| Squared ratio | D4 | Take both signs of the square root; four solutions. |
| How many over a longer interval | D3 | Count per turn, then handle shared end angles. |
| Count the roots of a quadratic | D3 | Factorise, then count each value's angles including the special cases 0 and plus or minus 1. |
| Which equation has exactly this many solutions? (MCQ) | D3 | Spot the special values (extremes, zero, out of range). |
| Multiple of a ratio equals a constant | D3 | Divide first, then decide whether the value is possible. |
| Count after the identity | D3 | Convert to one ratio, factorise, count without double counting. |

## y11-transform (`au-forms-adv11-d-nsw.js`)

| Form | Levels | Decisions |
|---|---|---|
| Equation of a translated power | D1 | Sign inside the bracket moves the graph the opposite way. |
| Read a translation from a rule (MCQ) | D1 | Treat inside and outside separately. |
| Vertex after a translation | D1 | The vertex moves with the translation; read it from vertex form first. |
| Find `h` or `k` from a point and its image | D1 | Subtract the right coordinates, mind the direction. |
| Value of a reflected function | D2 | `-f(x)` versus `f(-x)`. |
| Equation of a reflection | D2 | Negate all terms or change `x` to `-x`. |
| Which transformation? (MCQ) | D2 | Compare rules term by term: x-axis, y-axis, both, or a translation. |
| Vertex after a reflection | D2 | Reflect the vertex point. |
| Sum of x-intercepts after a reflection | D2 | Intercepts are fixed under an x-axis reflection and negate under a y-axis reflection. |
| Vertical equals horizontal dilation | D3 | Rewrite `k x^n` as `(c x)^n`. |
| Image under `a f(bx) + k` | D3 | Horizontal changes divide, vertical multiply. |
| Work backwards from the image | D3, D4 | Undo the transformation in reverse order. D4 includes `b(x - h)`. |
| Image under `a f(b(x - h)) + k` | D4 | Solve the input equation; negative factors allowed. |
| Equation of the image of a power | D3 | Translate then stretch, or stretch then shift, or reflect then shift. |
| Order of a dilation and a translation | D4 | The second transformation acts on the first's equation. |
| Range or domain of the image | D3, D4 | D3: a negative factor swaps the top and bottom of the range. D4: invert `b(x - h)` over the domain, with a negative `b` reversing the ends. |
| A graph to read | D3, D4 | Read a labelled point, transform it; D4 uses a negative factor so the highest becomes the lowest. |

## y11-functions-more (`au-forms-adv11-d-nsw.js`)

| Form | Levels | Decisions |
|---|---|---|
| Denominator excluded value | D1 | Set the denominator to zero. |
| Greatest value under a root | D1 | Solve the inequality for the boundary. |
| Which function is defined everywhere? (MCQ) | D1 | Check denominators and roots. |
| Integers in a two-root domain | D1 | Both conditions at once, inclusive ends. |
| Inverse on a restricted domain | D3, D4 | Choose the correct branch of a square root; D4 adds a shifted vertex. |
| Solve `f(g(x)) = N` | D3, D4 | Substitute in the right order. D4 has a squared inner function and two solutions. |
| Commuting composites | D3, D4 | Compare constant terms to find the constant. |
| Domain of a composite | D3, D4 | D3: the inner output must be allowed by the root. D4: the inner output must avoid the excluded input. |
| Find `f` from `f(g(x))` | D3, D4 | Work backwards through `g`. D4 needs a substitution `u = x + q`. |
| Inverse of a composite | D3, D4 | Undo the last function first. D4 includes a cube root. |

## y11-data-sets (`au-forms-adv11-d-nsw.js`)

| Form | Levels | Decisions |
|---|---|---|
| Mean from a frequency table | D1 | Weight by frequency, divide by the total frequency. |
| Missing value from a mean | D1 | Use the total. |
| Combined mean of two groups | D1 | Weight by group size. |
| Mean after scale and shift | D1 | Apply the same operations to the mean, in order. |
| Median of an unordered even list | D2 | Sort first, average the middle pair. |
| Median from a frequency table | D2 | Locate the middle position with cumulative frequency. |
| Which measure of centre? (MCQ) | D2 | Mean, median or mode, depending on outliers and data type. |
| Median after adding a value | D2 | The count becomes even. |
| Median after an outlier | D2 | The median is unchanged by an extreme value. |
| Stem-and-leaf median | D2 | Read stems and leaves, then locate the middle. |
| Variance of a list | D3 | Variance, not standard deviation, and divide by `n`. |
| Standard deviation from `sum x` and `sum x^2` | D3, D4 | Subtract the square of the mean before the root. |
| Add a value equal to the mean | D3, D4 | The sum of squares is unchanged but the divisor grows. |
| Which set is more spread? (MCQ) | D3 | Compare distances from the middle, not the means. |
| Spread resistant to an outlier (MCQ) | D3 | Interquartile range, not range, variance or standard deviation. |
| Spread after `y = ax + b` | D3, D4 | The shift does nothing; the factor is squared for variance; a negative factor still gives a positive spread. |
| Combined variance, same mean | D4 | Weight by group size, add the squared deviations. |
| Find `b` for a target mean and spread | D4 | `a` from the spread, then `b` from the mean. |
| Variance from a frequency table | D4 | Use `sum f x^2` over `sum f` minus the square of the mean. |

## y12-financial (`au-forms-adv12-d-nsw.js`)

| Form | Levels | Decisions |
|---|---|---|
| Unknown regular deposit | D2, D3 | Rearrange the future-value formula; D3 uses monthly deposits and an annual rate. |
| Number of deposits to reach a goal | D2, D3 | Solve for `n` and round up to a whole deposit. |
| Unknown rate from a table | D2, D3 | Divide the goal by the deposit, read the first rate that reaches the factor. |
| Present value of an annuity | D2, D3 | Discount each payment back to today (geometric series with ratio `1/(1+r)`). |
| Regular deposits or a lump sum | D2, D3 | Value both plans, then subtract. |
| Deposits at the start of each year | D3 | Every deposit earns one more period of interest. |
| A recurrence written out | D2, D3 | Follow `A(k+1) = m A(k) + a` step by step. |
| Unknown repayment | D4 | Set the final balance to zero and solve for the repayment. |
| Number of repayments | D4 | Solve for `n`, round up, allow a smaller last repayment. |
| Compare two loans | D4 | Total paid minus the amount borrowed for each plan, then the difference. |
| Balance after `k` repayments | D4 | Apply the recurrence, keeping full precision. |
| Interest and principal of a repayment | D4 | The interest uses the current balance (balance after repayment 1 for the second repayment). |
| Table of repayments per \$1000 | D4 | Choose the column for the term, scale, then multiply by the number of months. |

## y12-stats (`au-forms-adv12-c-nsw.js`)

| Form | Levels | Decisions |
|---|---|---|
| Missing probability, then `E(X)` | D1 | Find `k` from the total of 1, then weight. |
| Unknown outcome from `E(X)` | D1 | Use `E(X)` as an equation. |
| Net gain of a game | D1 | Expected prize minus the cost. |
| Variance from `E(X^2) - mu^2` | D1 | Subtract the square of the mean. |
| `E` and `Var` of `aX + b` | D1 | Constant ignored in variance; factor squared. |
| Which table is a distribution? (MCQ) | D1 | Total of 1 and no negative probability. |
| z-score of a value | D3 | Subtract the mean, divide by the standard deviation, keep the sign. |
| Value with a given z-score | D3 | Rearrange to `mu + z sigma`. |
| Which subject was better? (MCQ) | D3 | Compare z-scores, not raw marks. |
| Mean from a z-score | D3 | Rearrange for the mean. |
| Standard deviation from two z-scores | D3 | Difference in scores over difference in z-scores. |
| z-score after a rescale | D3 | A linear change leaves the z-score unchanged. |
| Percentage between two values | D4 | Find how many standard deviations the limits are from the mean. |
| Number in one tail | D4 | One tail is half of the outside percentage. |
| Reverse the rule for the standard deviation | D4 | Match the percentage to a number of standard deviations, divide the width. |
| When does the rule apply? (MCQ) | D4 | Bell-shaped data only. |
| z-score, then the rule | D4 | Two ideas combined, one tail. |

## y12-integration (`au-forms-adv12-c-nsw.js`, all at D3: the dot point is areas)

| Form | Decisions |
|---|---|
| Split at a root | The curve crosses the axis inside the interval, so integrate each part and add positive areas. |
| Between a curve and a line | Find the intersections, decide which is on top. |
| Unknown upper limit | Integrate, form a quadratic, reject the negative root. |
| Area under `(ax + b)^n` | Reverse the chain rule for a linear inner function, including dividing by `a`. |
| Enclosed by a parabola and the x-axis | Find the roots; the integral may be negative, so take the positive area. |

## y12-series (`au-forms-adv12-c-nsw.js`, all at D3: geometric sequences)

| Form | Decisions |
|---|---|
| Ratio from two non-adjacent terms | Divide to get `r^k`, take the k-th root (sign from the sign of the quotient). |
| Sum of the first `n` terms | Choose `S_n` for any `r`, including negative and fractional. |
| Number of terms | Match the last term to `a r^(n-1)` and count the index correctly. |
| First term to pass a target | Inequality with logarithms or powers, whole-term answer. |
| Arithmetic or geometric from context | Add a fixed amount or multiply by a fixed factor, then use the matching formula. |
| Which sequence is geometric? (MCQ) | Constant ratio, not constant difference. |

## Not decided here

- Whether sec, cosec and cot belong in the Year 11 Advanced trigonometry cell: none of these forms uses them.
- A teacher has not reviewed the level labels above or confirmed that each form is inside the NSW Mathematics Advanced (2024) syllabus. Items to check first: stem-and-leaf displays, the interquartile-range distractor, present value of an annuity (`y12-financial`), the repayments-per-\$1000 table, and the reverse-chain-rule area of `(ax + b)^n`.
