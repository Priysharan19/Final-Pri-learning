APPROVED by the author, Priysharan Tripathi (tutor), on 2026-11-24, at the digest named in this file. It pays on Prithagoras only while the server has PRI_METHOD_MARKS=on. Not an official NESA guideline.

# Step marks drawn from the authored worked solution (generic rule)

Approval id: `generic-solution-steps`. This is ONE rule for every multi-mark written Year 11 and Year 12 question (Mathematics Advanced and Extension 1), where each type used to need its own hand-built scheme.

## What you are asked to decide

Whether the rule below may pay step marks, in Australia only, for a student whose method is right and whose final answer is wrong or missing. You approved it on 2026-11-24, at the digest at the foot of this packet; it pays only while the Australian server has the method-marks switch on. It is a separate approval from your question types, which are unchanged: a question whose type you approved still uses that type's scheme.

If you approve it the server pays it only while all of these hold: the Australian server has the method-marks switch on, the question was marked as a rule question when it was issued, and your record names the digest at the foot of this packet. Change one word of the rule and the digest changes, and the approval no longer counts.

## The rule in plain words

1. A question worth N marks (N is 2 or more) with a correct final answer earns N, as it always did. Working never earns the final-answer mark.
2. With a wrong or missing final answer the student can earn at most N minus 1: one mark for each KEY STEP of the authored worked solution that one of their lines reaches.
3. A line reaches a key step only if all of these hold. The marked page ticks the line (the page the engine builds, never the interpreter's extra reading). It comes before the first line the page crosses. It states the step's result by the same matching the page already uses to say "matches step 2 of the worked solution". It is real progress (below).
4. One line pays one step, and one step is paid once.
5. The reply carries a table of the key steps (earned, not earned, or not verified, with the line numbers) and the words: "Pri practice marking, approved by the author (Priysharan Tripathi, tutor). Not an official NESA guideline."

## How the key steps are chosen, and how the marks are shared out

The authored solution has steps. Steps headed Check, Note or Bonus are left out. The last step states the answer, so it is never a key step.

A step before it is a candidate if it is real progress and the engine can read it. Key steps are the LAST N minus 1 distinct candidates, in order (last N-1 distinct non-trivial results before the answer step).

Why the last ones: the early steps of a worked solution are mostly set-up (writing the function, naming the rule). The later ones are the results a student has to derive. The usual slip is near the end, so the steps a student with a slip still reaches are the ones the marks sit on. A fixed list also means every mark has a named step you can read in the table.

If the solution has more usable steps than N minus 1, only the last N minus 1 count. If it has fewer, one mark is paid per usable step and the answer criterion carries the rest (a 3 mark question with one usable step pays at most 1 mark for working, and the answer criterion is worth 2). If it has none, the question is not paid by this rule and stays on the final answer.

A step is "readable" only if the engine, given the author's own line for that step as if a student wrote it, ticks it and recognises it as that step. This is a self-test run on every question, so a step the engine cannot tick when you wrote it is never paid.

## Real progress, and what never earns

A step is real progress only if its result is not the question's own statement or expression, not a number the question gives, and not the same as the answer step. A line earns nothing if it is:

- a restatement of the question, or the question's own expression copied;
- a number or value the question gives;
- a line that only names a formula with nothing put in (unless the authored step is exactly that);
- true but irrelevant arithmetic (2 + 2 = 4), unless it uses the same operations on the question's own numbers as the authored step does;
- a number from the solution written without the working, when the step's result is an expression (an equation, a derivative, an antiderivative);
- a line the page only notes, or one that comes at or after the first crossed line;
- a line carried forward from an earlier slip;
- a line that comes at or after a line the page could not verify (THE STOP RULE below);
- a bare value or bare condition with nothing derived behind it (THE BARE-LINE TEST below).

THE STOP RULE. The page leaves some lines as notes: it cannot tell whether they are true. A student whose middle line is wrong, and which the page can only note, can then write the right lines again and collect marks. So no line at or after the first NOTE THAT CLAIMS SOMETHING may earn a key step. A note claims something unless it is plain words and nothing else. Any relation (= < > and the words for them), any digit, any operator or mathematical sign (+ - * / ^, a root, a power, an arrow), any function name (sin, cos, ln), any single-letter name (x, y, k) and any run of one or two letters that is not a common word (xy, dx) makes it a claim. A longer run of letters (xyz) is read as a word. So "x > y", "x - y", "x is seven", "sin x" and "g(3) = 4" all stop it. This is deliberately strict. WHAT IT CANNOT SEE: a wrong statement written entirely in plain words ("therefore positive") is not read, so it does not stop the paying; the lines that earn after it are still lines the page itself proved true. WHAT DOES NOT STOP IT: a line the page ticks; a note that restates the question; plain words ("so the answer is clear", "by the formula"); and a definition the page itself reads (u = 2x + 1) when it is exactly the line the authored solution has. A DIFFERENT definition (u = 3x + 1 where the authored one is u = 2x + 1) stops it, whether or not later lines use u. Lines are not rescued by being true: there is no exception for a later line that happens to match the solution.

THE BARE-LINE TEST. A bare line is a letter equal to a number (t = 1, x = -6) or a number alone. It can earn a key step only if ALL hold: the authored step is itself only values; the step does not list several values of that one letter (t = 9 or t = 10 is a guess at one candidate, and never earns); the value is not zero (v = 0, tan(theta) = 0 and sin(5x) = 0, with any letter or Greek letter, are the set-up of solving, never a result); the value is not a number the question gives; the step is not the first step of the solution (which is set-up); and EITHER the step has that one result alone, OR a line that is not bare and reached a key step stands before it. So x = -6 alone earns nothing on a step whose result is the equation x + 6 = 0, and v = 0 alone earns nothing.

## The choices you can see

| Name | Value | What it means |
|---|---|---|
| BARE_VALUE_EVIDENCE | true | A correct intermediate value written as a bare number is evidence of the step that produces it, as an examiner would credit it. It counts only for a step whose result is a number, only when the marked page itself ticks the line as the value at that step (the page does this only after an earlier line of the working that it recognised, in order), and only if the value is not a number the question gives or something computed in a different way. As the very first line, alone, the page does not tick a bare value, so it earns nothing. Set the choice to false and a bare value never earns. |
| WRONG_ANSWER_CAP_BELOW_FULL | 1 | A wrong or missing final answer earns at most N minus this. |
| MIN_MARKS | 2 | The rule applies to questions worth at least this. |
| KEY_STEP_CHOICE | last N-1 distinct non-trivial results before the answer step | Which steps carry the marks. |

## Coverage: how many questions the rule can pay

Measured on the generated Year 11 and 12 Advanced and Extension 1 written questions that the NSW bank issues, seeds 1 to 40 per issued cell. "Can pay" means the question is worth 2 or more marks and the rule has at least one key step to pay. "All N-1" means it has a key step for every mark below full.

| Topic | Multi-mark written | Your approved types today | Rule can pay | Share | Rule can pay all N-1 |
|---|---:|---:|---:|---:|---:|
| Advanced · Algebra | 191 | 40 | 46 | 24.1% | 12 |
| Advanced · Calculus | 851 | 123 | 559 | 65.7% | 342 |
| Advanced · Financial Maths | 219 | 0 | 82 | 37.4% | 45 |
| Advanced · Functions | 780 | 0 | 415 | 53.2% | 283 |
| Advanced · Statistics & Probability | 342 | 0 | 86 | 25.1% | 76 |
| Advanced · Trigonometry | 362 | 6 | 77 | 21.3% | 53 |
| Extension 1 · Algebra | 590 | 0 | 206 | 34.9% | 112 |
| Extension 1 · Calculus | 518 | 0 | 188 | 36.3% | 116 |
| Extension 1 · Functions | 109 | 0 | 71 | 65.1% | 29 |
| Extension 1 · Statistics & Probability | 307 | 0 | 96 | 31.3% | 72 |
| Extension 1 · Trigonometry | 330 | 0 | 199 | 60.3% | 59 |
| ALL | 4599 | 169 | 2025 | 44.0% | 1199 |

Before this rule only 3.7% of these questions could earn a step mark. With it, 44.0% can. On the 2025 questions it can pay, it can pay 2347 of the 3239 marks below full (72.5%).

## The sweep: does it pay anything it should not

Run with the rule approved in the test process only (nothing is approved in the repository), over every topic, seeds 1 to 6: 301 payable questions, 7347 marked pages.

- Authored working with only the final line wrong (291 pages): marks earned 1 mark(s) on 228, 2 mark(s) on 60, 3 mark(s) on 3.
- Authored working in full with the right answer: N on 229 of 229. Full working with a wrong typed answer: N on 0 of 293.
- Wrong from a key step onward (359 pages): marks earned on or after the wrong step: 0. One wrong line only (355 pages): the wrong line earned 0, anything at or after a crossed line earned 0.
- Gaming, restate the question (293 pages): a mark was earned on 0, exceptions 0.
- Gaming, another questions working (269 pages): a mark was earned on 0, exceptions 0.
- Gaming, given numbers (293 pages): a mark was earned on 0, exceptions 0.
- Gaming, irrelevant true arithmetic (293 pages): a mark was earned on 0, exceptions 0.
- Gaming, irrelevant true arithmetic outside the question (293 pages): a mark was earned on 0, exceptions 0.
- Gaming, lines no check can read (293 pages): a mark was earned on 0, exceptions 0.
- Gaming, naming a formula (293 pages): a mark was earned on 0, exceptions 0.
- Gaming, same value other operations (176 pages): a mark was earned on 0, exceptions 0.
- Gaming, bare intermediate value alone (192 pages): a mark was earned on 0, exceptions 0.
- Gaming, bare intermediate value after earlier lines (192 pages): a mark was earned on 40, exceptions 0.
- Gaming, lines after the first crossed line (291 pages): a mark was earned on 0, exceptions 0.
- Gaming, numbers of the solution without working (168 pages): a mark was earned on 0, exceptions 0.
- Every page: a wrong answer at full marks 0, above N 0, a mark on an unticked line 0, a mark at or after a crossed line 0, the answer mark earned by working 0.

## Twelve worked examples

Each is a real run of the rule on a generated question. "Not checked" means the page could not judge the line, which is not the same as wrong.

### Example 1: Integration (Advanced, Calculus)

A student sets up the equation correctly and then slips at the last line.

Question (3 marks): The area under the line y=2x+5 between x=0 and x=k is 84 square units, where k > 0. Find k.

The authored worked solution, step by step:

1. Integral: int_0^k (2x + 5)dx = k^2 + 5k
2. Equation: k^2+5k-84=0
3. Solve: k=7

Final answer typed: `62`. The answer checker says it is not correct.

| Line | What the student wrote | What the marked page shows | Earns |
|---:|---|---|---|
| 1 | `k^2+5k-84=0` | ticked | step 2 |
| 2 | `k=62` | not checked | nothing |

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 2 of the worked solution (Equation): k^2+5k-84=0 | 1 | earned | 1 |
| Gives the final answer correctly, in the form the question asks. | 2 | not earned | - |

Marks: **1 of 3**.

### Example 2: Stationary points (Advanced, Calculus)

A student differentiates, solves for the stationary point and shows the second derivative, then slips on the final value.

Question (3 marks): A ball is thrown upward from a balcony. Its height h(t) metres above the ground, t seconds after release, is modelled by h(t)=-3t^2+36t+39 for t>=0. Find the greatest height the ball reaches.

The authored worked solution, step by step:

1. Differentiate: h'(t) = -6t + 36
2. Stationary point: -6t+36=0; t=6
3. Nature: h'' = -6
4. Value: h(6)=147

Final answer typed: `1042`. The answer checker says it is not correct.

| Line | What the student wrote | What the marked page shows | Earns |
|---:|---|---|---|
| 1 | `h'(t) = -6t + 36` | ticked | nothing |
| 2 | `-6t+36=0` | ticked | step 2 |
| 3 | `t=6` | ticked | nothing |
| 4 | `h'' = -6` | ticked | step 3 |
| 5 | `h(6)=1042` | not checked | nothing |

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 2 of the worked solution (Stationary point): -6t+36=0; t=6 | 1 | earned | 2 |
| Step 3 of the worked solution (Nature): h'' = -6 | 1 | earned | 4 |
| Gives the final answer correctly, in the form the question asks. | 1 | not earned | - |

Marks: **2 of 3**.

### Example 3: Series (Advanced, Functions)

A student sets up the arithmetic-sequence condition correctly, then slips while solving.

Question (2 marks): The expressions -2k, -4k-8 and -2k-12 are three consecutive terms of an arithmetic sequence. Find the value of k.

The authored worked solution, step by step:

1. Equal differences: 2(-4k-8)=(-2k)+(-2k-12)
2. Expand and collect: -8k-16=-4k-12
3. Solve: k=-1

Final answer typed: `-20`. The answer checker says it is not correct.

| Line | What the student wrote | What the marked page shows | Earns |
|---:|---|---|---|
| 1 | `2(-4k-8)=(-2k)+(-2k-12)` | ticked | step 1 |
| 2 | `-8k-16=-4k-12` | ticked | nothing |
| 3 | `k=-20` | crossed (first wrong line) | nothing |

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 1 of the worked solution (Equal differences): 2(-4k-8)=(-2k)+(-2k-12) | 1 | earned | 1 |
| Gives the final answer correctly, in the form the question asks. | 1 | not earned | - |

Marks: **1 of 2**.

### Example 4: Financial mathematics (Advanced)

A student works out the first plan's interest correctly, but is wrong from the second key step onward (a slip carried down the page).

Question (3 marks): Two plans repay the same loan of $10,000. Plan 1 requires 48 monthly repayments of $240.39. Plan 2 requires 60 monthly repayments of $198.96. How much less total interest is paid on the cheaper plan? Give your answer to the nearest cent.

The authored worked solution, step by step:

1. Plan 1: 48*240.39-10000=1538.72
2. Plan 2: 60*198.96-10000=1937.6
3. Difference: 398.88

Final answer typed: `99991`. The answer checker says it is not correct.

| Line | What the student wrote | What the marked page shows | Earns |
|---:|---|---|---|
| 1 | `48*240.39-10000=1538.72` | ticked | step 1 |
| 2 | `60*198.96-10000=1937.55` | not checked | nothing |
| 3 | `398.629` | not checked | nothing |

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 1 of the worked solution (Plan 1): 48*240.39-10000=1538.72 | 1 | earned | 1 |
| Step 2 of the worked solution (Plan 2): 60*198.96-10000=1937.6 | 1 | not verified | - |
| Gives the final answer correctly, in the form the question asks. | 1 | not earned | - |

Marks: **1 of 3**.

### Example 5: Trigonometric equations (Extension 1)

A student factorises and finds both factors, then gives wrong solutions.

Question (3 marks): Solve sin^2*θ=-(1/(sqrt(2)))*sinθ for -360° le theta le 0°.

The authored worked solution, step by step:

1. Move everything to one side: sin^2*θ--(1/(sqrt(2)))*sinθ=0
2. Factorise: sinθ(sinθ--(1/(sqrt(2))))=0
3. Solve both factors: sinθ=0; sinθ=-(1/(sqrt(2)))
4. All solutions: theta = -360°, -180°, -135°, -45°, 0°

Final answer typed: `99991`. The answer checker says it is not correct.

| Line | What the student wrote | What the marked page shows | Earns |
|---:|---|---|---|
| 1 | `sin^2*θ--(1/(sqrt(2)))*sinθ=0` | ticked | nothing |
| 2 | `sinθ(sinθ--(1/(sqrt(2))))=0` | ticked | nothing |
| 3 | `sinθ=0` | ticked | nothing |
| 4 | `sinθ=-(1/(sqrt(2)))` | ticked | step 3 |

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 3 of the worked solution (Solve both factors): sinθ=0; sinθ=-(1/(sqrt(2))) | 1 | earned | 4 |
| Gives the final answer correctly, in the form the question asks. | 2 | not earned | - |

Marks: **1 of 3**.

### Example 6: Probability (Extension 1, binomial)

A student finds p correctly, then slips. Only one step of this solution is one the page can read, so the rule pays at most one mark.

Question (3 marks): A binomial random variable has n=10 trials and mean 5.2. Find its standard deviation, correct to 2 decimal places.

The authored worked solution, step by step:

1. Find p: p=(5.2/10)=0.52
2. Variance: np(1-p)=2.496
3. Standard deviation: sigma approx 1.58

Final answer typed: `99991`. The answer checker says it is not correct.

| Line | What the student wrote | What the marked page shows | Earns |
|---:|---|---|---|
| 1 | `p=(5.2/10)=0.52` | ticked | step 1 |
| 2 | `np(1-p)=2.496` | ticked | nothing |

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 1 of the worked solution (Find p): p=(5.2/10)=0.52 | 1 | earned | 1 |
| Gives the final answer correctly, in the form the question asks. | 2 | not earned | - |

Marks: **1 of 3**.

### Example 7: Polynomials (Extension 1)

A student differentiates and finds the repeated-root candidates, then slips on k.

Question (4 marks): Find all values of k for which the equation x^3+9x^2+24x+k=0 has a repeated root.

The authored worked solution, step by step:

1. A repeated root is a root of the derivative: P'(x) = 3x^2 + 18x + 24 = 3(x + 4)(x + 2)
2. Candidate positions: x=-4; x=-2
3. Substitute into P(x) = 0: k=-((-4)^3+9((-4))^2+24((-4))); x=-2
4. Both values of k: k=16; k=20

Final answer typed: `153`. The answer checker says it is not correct.

| Line | What the student wrote | What the marked page shows | Earns |
|---:|---|---|---|
| 1 | `P'(x) = 3x^2 + 18x + 24 = 3(x + 4)(x + 2)` | ticked | step 1 |
| 2 | `x=-4` | ticked | nothing |
| 3 | `x=-2` | ticked | nothing |
| 4 | `k=-((-4)^3+9((-4))^2+24((-4)))` | ticked | nothing |
| 5 | `x=-2` | ticked | nothing |
| 6 | `k=16` | ticked | nothing |
| 7 | `k=153` | crossed (first wrong line) | nothing |

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 1 of the worked solution (A repeated root is a root of the derivative): P'(x) = 3x^2 + 18x + 24 = 3(x + 4)(x + 2) | 1 | earned | 1 |
| Gives the final answer correctly, in the form the question asks. | 3 | not earned | - |

Marks: **1 of 4**.

### Example 8: Vectors (Extension 1)

A student sets the dot product to zero, then solves it wrongly.

Question (2 marks): The vectors a = (1, 9) and b = (k, 9) are perpendicular. Find k.

The authored worked solution, step by step:

1. Dot product is zero: 1k+81=0
2. Solve: k=-81

Final answer typed: `-580`. The answer checker says it is not correct.

| Line | What the student wrote | What the marked page shows | Earns |
|---:|---|---|---|
| 1 | `1k+81=0` | ticked | step 1 |
| 2 | `k=-580` | crossed (first wrong line) | nothing |

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 1 of the worked solution (Dot product is zero): 1k+81=0 | 1 | earned | 1 |
| Gives the final answer correctly, in the form the question asks. | 1 | not earned | - |

Marks: **1 of 2**.

### Example 9: Integration, restating the question

A student only copies the question out. Nothing is credited: copying the question is not progress.

Question (3 marks): The area under the line y=2x+5 between x=0 and x=k is 84 square units, where k > 0. Find k.

The authored worked solution, step by step:

1. Integral: int_0^k (2x + 5)dx = k^2 + 5k
2. Equation: k^2+5k-84=0
3. Solve: k=7

Final answer typed: `99991`. The answer checker says it is not correct.

| Line | What the student wrote | What the marked page shows | Earns |
|---:|---|---|---|
| 1 | `y = 2x + 5` | ticked | nothing |
| 2 | `x = 0` | not checked | nothing |
| 3 | `x = k` | ticked | nothing |
| 4 | `84` | not checked | nothing |

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 2 of the worked solution (Equation): k^2+5k-84=0 | 1 | not verified | - |
| Gives the final answer correctly, in the form the question asks. | 2 | not earned | - |

Marks: **0 of 3**.

### Example 10: Functions and modelling, a bare value and true but irrelevant sums

A student writes one correct intermediate value and some true sums that have nothing to do with the question.

Question (3 marks): A club sells n tickets with revenue R(n)=6n(38-n) dollars and costs C(n)=30+102n dollars. Find the profit, in dollars, when n=19.

The authored worked solution, step by step:

1. Revenue: R(19)=6(19)(19)=2166
2. Cost: C(19)=30+102(19)=1968
3. Profit: 2166-1968=198

Final answer typed: `99991`. The answer checker says it is not correct.

| Line | What the student wrote | What the marked page shows | Earns |
|---:|---|---|---|
| 1 | `2 + 2 = 4` | ticked | nothing |
| 2 | `3 * 5 = 15` | ticked | nothing |
| 3 | `7 - 3 = 4` | ticked | nothing |
| 4 | `12 - 5 = 7` | ticked | nothing |
| 5 | `2166` | not checked | nothing |

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 1 of the worked solution (Revenue): R(19)=6(19)(19)=2166 | 1 | not verified | - |
| Step 2 of the worked solution (Cost): C(19)=30+102(19)=1968 | 1 | not verified | - |
| Gives the final answer correctly, in the form the question asks. | 1 | not earned | - |

Marks: **0 of 3**.

### Example 11: Calculus, volume of revolution (Extension 1), no final answer

A student sets up the integral and integrates, but leaves the final answer box empty.

Question (3 marks): The curve y=sqrt(5x) and the line y=x enclose a region. The region is rotated about the x-axis. Find the **exact** volume of the solid formed.

The authored worked solution, step by step:

1. Intersections: 5x=x^2; x=0; x=5
2. Washer volume formula: V=π∫_{0}^{5}(R^2-r^2)dx; R^2=5x; r^2=x^2
3. Integrate: V = pi[((5x^2)/(2)) - ((x^3)/(3))]_0^(5)
4. Evaluate: V=((125π)/6)

Final answer typed: (left empty). The answer checker says it is not correct.

| Line | What the student wrote | What the marked page shows | Earns |
|---:|---|---|---|
| 1 | `5x=x^2` | ticked | step 1 |
| 2 | `x=0` | ticked | nothing |
| 3 | `x=5` | ticked | nothing |
| 4 | `V=π∫_{0}^{5}(R^2-r^2)dx` | ticked | nothing |
| 5 | `R^2=5x` | ticked | step 2 |
| 6 | `r^2=x^2` | ticked | nothing |
| 7 | `V = pi[((5x^2)/(2)) - ((x^3)/(3))]_0^(5)` | ticked | nothing |

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 1 of the worked solution (Intersections): 5x=x^2; x=0; x=5 | 1 | earned | 1 |
| Step 2 of the worked solution (Washer volume formula): V=π∫_{0}^{5}(R^2-r^2)dx; R^2=5x; r^2=x^2 | 1 | earned | 5 |
| Gives the final answer correctly, in the form the question asks. | 1 | not earned | - |

Marks: **2 of 3**.

### Example 12: Calculus, motion, right answer and no working

A student types only the correct final answer. This was always full marks, and still is.

Question (2 marks): A particle's displacement from the origin is x(t) = 8e^(-2t) metres after t seconds, for t>=0. Find its **initial acceleration**.

The authored worked solution, step by step:

1. Velocity: v = -16e^(-2t)
2. Acceleration: a = 32e^(-2t)
3. At t = 0: a(0)=32

Final answer typed: `32`. The answer checker says it is correct.

No working was written.

| Criterion | Marks | Result | Lines |
|---|---:|---|---|
| Step 2 of the worked solution (Acceleration): a = 32e^(-2t) | 1 | earned | the final answer |
| Gives the final answer correctly, in the form the question asks. | 1 | earned | the final answer |

Marks: **2 of 2**.

## What the rule cannot see, and its known weaknesses

These are measured, in the same sweep (seeds 1 to 6), and rewritten each time the packet is generated.

- **A different valid method earns less.** The same correct route, with a wrong last line, earns on average 1.24 marks when it is written the way the author wrote it (263 pages). Written with the sides of each equation swapped it earns 0.56, and with every equation moved to one side it earns 1.17. The rule recognises the authored route best. A student who solves it another valid way, or writes an equivalent line in a different shape, is paid less than they deserve and sometimes nothing.
- **Over-credit after a wrong line the page cannot see.** One middle line was made wrong in turn, and the authored lines left after it (695 pages, hard test, tolerance 0): 334 marks were earned against an ideal of 371 (the steps written before the wrong line); pages above the ideal: 0; marks earned by the wrong line or a line after it: 0. The cost of the stop rule is that true working is sometimes not paid: a true line the page can only note (a bare list of numbers, an inequality, a definition it does not read) ends the paying. The stop rule and the bare-line test together reduced the questions the rule can pay from 52.5 percent to 44.8 percent of the multi-mark written questions (45.8 percent with the seven types approved when this was measured), seeds 1 to 40, and the marks paid on the authored route with a wrong last line from 2702 over 2260 pages (1.20 a page) to 2257 over 1940 pages (1.16 a page): a loss of 16.5 percent of marks, almost all of it questions that no longer pay at all, not a lower mark on those that still do.
- **A single bare line.** A letter equal to a number, or a number, alone (257 pages, hard test, tolerance 0): a mark was earned on 9, every one a step whose one result that is (9); over-credit 0. Examples that no longer earn: v = 0 alone, and x = -6 alone for the domain of a composite function.
- **A true first line, then nothing readable.** 293 pages: a mark was earned on 219. In 209 of those the step is the first step of the solution, and the line is a derived expression on 219 and a bare value on 0. This is intended: a derived first line (a derivative, the equation set up from the question) is a true result a student had to find, and it earns one mark, the same as it does at the answer step of an examiner's scheme. A bare value as the first step does not pay (it is set-up).
- It reads only what the page can tick. A question whose solution is in words, in a table, as an inequality, as a sketch or as a vector or matrix the page cannot read has no usable steps, and stays on the final answer.
- A value counts for a numeric step only if it is worked from the question's or the solution's own numbers with the same operations on the same numbers as the authored step (so 2 + 2 = 4 is not the step 2^2 = 4, and 9 / 3 = 3 is not 27 / 9 = 3).
- Another question's correct working earns nothing, except where one of its lines is also a true statement of this question's own solution (the same root, an equivalent equation). That is rare in the sweep and each case is listed in the test output.
- It trusts the page's ticks. If the page wrongly ticks a line, the rule can pay for it. The review of this rule found one such false tick (a derivative of the wrong function ticked when the question gave a value for x) and it is fixed in the page; the sweep cannot prove none remains.
- Only the LAST N minus 1 usable steps pay. A student who does the early steps correctly and goes wrong in the middle may earn nothing for working although they did earn something in an examiner's eyes.
- It never pays on a question worth one mark, and never for a model's reading: only the engine's own tick.
- The mark split between steps is the same, one mark each. It does not weigh a hard step more than an easy one.

Nothing here is an official NESA marking guideline.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `d8f1119ae311c778679bebfa49b836e73a67838e3e4a35d7054dfa2c81f5c329`
