# The manual parts of the author bank, served honestly (25 November 2026)

Scope: Prithagoras only (India is unchanged: it loads no bank). Built on the diagrams round, `task/qbank-diagrams`. Every number below is printed by
`node tools/qbank-import.mjs --pack <archive> --out server/content/qbank --overwrite --figures <work>` (the importer prints them on every build), by
`node server/test/qbank-worked-check.mjs` and by `node tools/qbank-manual.test.mjs`. Nothing here is a person's reading of a question: a person has not read
any derived key or any worked-solution question, and a derived key agreeing with the author's own working is not independent evidence that it is right.

## What was done with the 3,087 manual parts

| Kind (from the prompt's words, outside the maths) | Parts | Becomes |
|---|---|---|
| Prove, show that, verify, justify, derive | 686 | worked-solution question (no key, ever) |
| Explain, describe, interpret | 199 | worked-solution question |
| Sketch, graph, draw | 392 | worked-solution question |
| Find (and everything else) | 1,810 | 87 become auto-markable; the rest worked-solution questions |
| **Total** | **3,087** | **87 marked + 2,241 worked-solution + 759 not served** |

### Which "find" parts became auto-markable (87 of 1,810)

A key is derived only when ALL of these hold (`tools/qbank-manual.mjs deriveKey`, `tools/qbank-import.mjs derivedKeyRefusals`), and a part that fails any of them is not guessed:

1. the prompt is a find (not show, prove, explain, sketch) and asks for ONE value: no reason, justification, explanation or second thing to state ("State Pearson's r, with a reason",
   "state ... and ..."), no particular method, no particular form, no named precision;
2. his printed answer `ans` is only maths, not approximate, not two quantities (a semicolon is his sign for two), and reads fully as ONE numeric value, one
   expression, one `y = ...` equation (only where the prompt asks for an equation), one set (only where it solves or lists roots) or one point (only where it asks for one);
3. that value is a result stated by his LAST worked step (a numeric one evaluates to it, an expression is equivalent to it);
4. **the key keeps its function arguments.** TeX writes `\cos 2x` and means cos(2x); the plain text `cos2x` is read by the engine as cos(2)·x. Every function application is bracketed
   before the key is written (`bracketFunctions`: the run of numbers, letters, π, groups, fractions and roots with their powers up to an operator or another function), and the key
   is then **proved against his own TeX**: his TeX is evaluated by a separate evaluator (`evalTeX`, which never uses our engine) and the key by our engine, at the same six sample
   points of each unknown (at least three where his TeX is defined); a set and a point item by item; a numeric key once. Any disagreement refuses the conversion;
5. **his exact form is typeable and accepted.** The importer tries each natural way of typing his printed answer (`naturalForms`: as his TeX reads, brackets taken out, `pi` and `π`,
   one rearrangement of a sum, a plain decimal where his answer is one) with the real marker and the question's own answer type, and every one must be marked CORRECT. A numeric box
   says "work it out first" to `e^2+5` and `3pi^2/2` (D13), so a numeric key whose own form is not a bare number is tried as an exact-form expression too; the first type that accepts
   all his forms is used (7 of the 87 are exact-form expressions: A12-C4-212, A12-C2-201, A12-C2-207, X12-C2-184, X12-C2-193, X12-C3-209, X12-C2-214). An exact-form box does not
   accept a rounded decimal (3pi^2/2 is not 14.8): that is the cost, and the part is otherwise left a worked-solution question. Neither type accepts: the part stays one;
6. the part then passes exactly what an authored auto-markable part passes: the engine accepts the key, the hint rung rule, the figure rule, the layout rules,
   the line-feedback and crossed-line rules; and at least THREE plausible wrong values (the negative, the double, one more, a swap, a dropped or added element)
   are refused by the real marker. The last criterion is tagged the answer criterion by its position.

Each converted question records the forms it was proved on (`derivedForms` in the pack); `server/test/qbank-real-pack-check.mjs` re-marks every one of them, and the plausible wrong values, on the committed pack.

Result: 87 (numeric 62, expression 18, set 6, equation 1). By course: A11 18, A12 20, X11 20, X12 29. They have no authored trap. Of the first round's 91, X11-T2-115 stays a worked-solution question
(with its function arguments kept, the engine crosses a line of his own steps), A12-S2-027 stays one (it asks for a reason), A12-C4-212 and X12-C3-209 are exact-form expressions that accept `e^2+5`,
`3pi^2/2`, `1.5pi^2` and `(3/2)pi^2`; X12-V1-004(i) and two others stay worked-solution questions because his TeX could not be evaluated at the sample points.

Why the other 1,723 find parts stay worked-solution questions (a part can fail more than one test; the first is counted):

| Reason | Parts |
|---|---|
| His answer is two or more quantities | 418 |
| The prompt asks for more than a value (a reason, a justification, an explanation, a second thing, "hence show") or for several things | 248 |
| His answer has words or units with it | 172 |
| His printed answer is not what his last step states | 162 |
| The prompt names a precision (decimal places, nearest) | 154 |
| A list where one value is asked for, or a list item that is not a number | 152 |
| The prompt mandates a method ("use", "by completing", "hence") | 142 |
| A left side that is not a bare value, or one not read as one value | 87 |
| Approximate or plus-or-minus | 82 |
| An inequality or range, several unknowns | 48 |
| The prompt asks for a particular form | 46 |
| A unit in the answer, or a point where none is asked for | 3 |
| Passed the derivation but failed a pack check (a crossed line of his own) | 6 |
| His TeX could not be evaluated at the sample points, so the key could not be proved against it | 3 |

### Worked-solution questions served: 2,241

By kind: prove 568, explain 143, sketch 87, find 1,443. By course: A11 621, A12 599, X11 489, X12 532. Line feedback is allowed on 1,774 (the step report never
crosses his own page); 285 have a figure. 759 manual parts are not served: 746 because their figure shows a result of his worked steps (or one that cannot be
read), 13 because the prompt carries layout TeX the page cannot draw. Placed by dot point (`qbankDotpoints.js`: A12 S2.2a scatterplots and Extension 1 induction P1.1a to c are
new rows); a worked-solution question is drawn by topic and dot point like the others.

## What the student sees

- **Before starting**: under the question, one plain sentence: "Worked solution question: Pri shows the solution, it does not mark this one." No badge, no new chrome.
  The one action is "Show the worked solution". There is no Submit, no "Show solution" and no marks-available line. His hints (at most three) are offered; there is no solution rung.
- **Working**: the working-only editor (Type, Write and Photo stay where the product has them). Nothing typed is sent anywhere until the press.
- **After the press**: his steps, then "What a marker looks for": his criteria as a list to read, each with his marks as information, and the line
  "These marks are for information. Pri has not marked your working." The list has no input, no button and no tick box (`client/test/online-check-access-check.mjs` still forbids
  self-marked marks on practice; the card names no criteria table). When the server sends a note on the student's own lines (only where the question's own gate allows it, and
  only with `PRI_FEATURE_LINE_CHECK=1`, the switch "Check this line so far" uses): a tick on each leading line that holds, one quiet "Look again at this line", never a cross, never a mark.
- **Then**: "Next question".

## Server: sealing, the reveal and the accounting

- The issue reply carries the prompt, the hints and the figure's description. His steps, criteria and marks are not in it; the escrow holds them.
- `POST /v1/practice/:id/solution` (tied to the issued question and account; another account's id is a 404) sends the steps and criteria. Submit, reveal and the ladder's solution rung refuse a worked-solution question (409 `PRACTICE_NOT_MARKED`).
- It records the question as **completed** and **seen** (so the no-repeat rule passes over it) and nothing else: no graded attempt, no learning event, no grade or reveal record, no mark earned or credited,
  no mastery, readiness, streak or XP input. It is neither correct nor incorrect. The device closes the row so it is not resumed and records no attempt (`POST /practice/:id/solution` in `client/src/local/backend.js`).
- Mix: 1 draw in 6 where a pool exists (`MANUAL_TURNS`), from the seed alone; the account's last-dealt question must not be one (never two in a row); only in plain practice by topic or dot point: never in review, task, Rush, Match, the placement check, a timed paper, a prepared (signed-out) question or a picked item.
- A worked-solution question is not a counted practice question: it uses none of the free day's allowance, and no model is called.

## Tests

`node tools/qbank-manual.test.mjs` (81 checks: classification, reading his answer, key derivation, plausible wrong values, the leak rule, the importer on a fixture),
`node server/test/qbank-worked-check.mjs` (59: the pack, sealing, the routes, accounting, mix and mode exclusions),
`node client/test/tour-nsw-practice-worked.js` (a browser tour on the Prithagoras build: the notice, the press, the read-only checklist, no mark, nothing recorded, 360 px),
and the accessibility walk (`PRI_EDITION=prithagoras node client/test/a11y-gate.mjs`) walks a worked-solution question before and after the press.

## Not done

- No person has read the 87 derived keys or any worked-solution question; the sample below is for a reader to verify.
- The hints of a worked-solution question go through the rung rule and a step-result rule: a rung is dropped when it states any number, fraction or function of a number (`ln 0.4`, `n = 300 or 360`) equal to a result of his worked steps that the question's own text does not give. That removes the set-up rungs of A12-M1-103, A12-M1-118, A12-M1-127, A12-C2-151 and X11-C1-132. They were not read by a person.
- A worked-solution question is shown, never marked: it is in no History list, no report series, no chapter total and no streak day (it is not a question answered), and it is dealt in plain practice only (not review, task, Rush, Match, the placement check or a timed paper). It uses none of the free day's allowance on any issuing path (issue, repeat, twin).
- Hindi wording is added for the new strings and was not read by a Hindi reader (Prithagoras does not offer Hindi).
- The 759 manual parts that are not served (mostly figures that show a worked result) are for the owner to look at.
- No native app run: the iOS and Android shells were not exercised for the new route.

## 40 derived keys, for a reader to verify

Chosen by a hash of the question id (the same 40 on every run), in id order. "Box" is the answer type the question has; the derived key is what the engine is given and, in brackets, what his printed answer reads to; "His form typed in" is how many natural typed forms of his answer the real marker accepted, with the first four; "Wrong values refused" is how many plausible wrong values (at least three) it refused.

| Question | Prompt (start) | Box | Derived key (his printed answer, read as) | His form typed in (accepted) | Wrong values refused |
|---|---|---|---|---|---|
| A11-C1-161 | Differentiate $y=x^{3}\sqrt{1-x}$. | expression | `{"expr":"3x^(2)sqrt(1-x)-((x^(3))/(2sqrt(1-x)))"}` (`3x^(2)sqrt(1-x)-((x^(3))/(2sqrt(1-x)))`) | 3: `3x^(2)sqrt(1-x)-((x^(3))/(2sqrt(1-x)))` `3x^2sqrt(1-x)-((x^3)/(2sqrt(1-x)))` `-((x^3)/(2sqrt(1-x)))+3x^2sqrt(1-x)` | 4 |
| A11-C1-186 | Differentiate $\sqrt{5-2x^{2}}$. | expression | `{"expr":"((-2x)/(sqrt(5-2x^(2))))"}` (`((-2x)/(sqrt(5-2x^(2))))`) | 2: `((-2x)/(sqrt(5-2x^(2))))` `-2x/(sqrt(5-2x^2))` | 4 |
| A11-C1-207 | The tangent to $y=\dfrac4x$ at $x=2$ meets the axes at $P$ and $Q$. Find the area of triangle $OPQ$. | numeric | `{"value":8}` (`8`) | 1: `8` | 5 |
| A11-E1-198 | Solve $4^{x}-3\cdot2^{x+1}+8=0$. | set | `{"values":[1,2]}` (`x=1, x=2`) | 3: `x=1, x=2` `1, 2` `2, 1` | 3 |
| A11-F1-182 | For which $a$ does the system $2x+ay=3$, $ax+8y=6$ have no solution? | numeric | `{"value":-4}` (`-4`) | 1: `-4` | 5 |
| A11-S1-179 | A target has concentric circles of radius $1$, $2$ and $3$. A dart lands at a random point on the target. Find the probability it lands in t | numeric | `{"value":0.5555555555555556}` (`((5)/(9))`) | 2: `((5)/(9))` `5/9` | 5 |
| A11-T1-174 | A triangle has sides $x$, $x+1$ and $x+2$, and its largest angle is $120^\circ$. Find $x$. | numeric | `{"value":1.5}` (`((3)/(2))`) | 3: `((3)/(2))` `3/2` `1.5` | 5 |
| A11-T2-174 | Find the exact value of $\cos330^\circ+\sin150^\circ$. | numeric | `{"value":1.3660254037844386}` (`((sqrt(3)+1)/(2))`) | 2: `((sqrt(3)+1)/(2))` `(sqrt(3)+1)/2` | 5 |
| A11-T2-190 | If $\tan\theta=2$, find the value of $\dfrac{\sin\theta+\cos\theta}{\sin\theta-\cos\theta}$. | numeric | `{"value":3}` (`3`) | 1: `3` | 5 |
| A12-C2-203 | Find the equation of the tangent to $y=2\sin x+\cos x$ at $x=0$. | equation | `{"lhs":"y","rhs":"2x+1"}` (`y=2x+1`) | 4: `y = 2x+1` `y=2x+1` `y = 1+2x` `y=1+2x` | 3 |
| A12-C2-207 | The tangent to $y=x\ln x$ at $x=e$ meets the axes at $A$ and $B$. Find the area of triangle $OAB$. | expression (exact form) | `{"expr":"((e^(2))/(4))"}` (`((e^(2))/(4))`) | 2: `((e^(2))/(4))` `(e^2)/4` | 4 |
| A12-C2-213 | Find the gradient of $y=e^{x}\ln x$ at $x=1$. | numeric | `{"value":2.718281828459045}` (`e`) | 1: `e` | 5 |
| A12-C3-073 | Find the maximum value of $y=x+2\cos x$ on $0\le x\le\pi$. | numeric | `{"value":2.255649583167176}` (`((pi)/(6))+sqrt(3)`) | 5: `((pi)/(6))+sqrt(3)` `(pi/6)+sqrt(3)` `(π/6)+sqrt(3)` `((π)/(6))+sqrt(3)` | 5 |
| A12-C4-215 | Find the exact area bounded by $y=e^{x}$, $y=e^{-x}$ and the line $x=1$. | numeric | `{"value":1.0861612696304874}` (`e+((1)/(e))-2`) | 3: `e+((1)/(e))-2` `e+(1/e)-2` `-2+(1/e)+e` | 5 |
| A12-C4-219 | Evaluate $\displaystyle\int_{0}^{\pi/9}\sec^{2}3x\,dx$ exactly. | numeric | `{"value":0.5773502691896257}` (`((sqrt(3))/(3))`) | 2: `((sqrt(3))/(3))` `sqrt(3)/3` | 5 |
| A12-C4-230 | Given $f''(x)=6x+2$, $f'(0)=-1$ and $f(0)=3$, find $f(x)$. | expression | `{"expr":"x^(3)+x^(2)-x+3"}` (`x^(3)+x^(2)-x+3`) | 5: `x^(3)+x^(2)-x+3` `x^3+x^2-x+3` `3-x+x^2+x^3` `f(x) = x^(3)+x^(2)-x+3` | 4 |
| A12-S2-145 | Class A ($20$ students) has mean mark $72$ and class B ($30$ students) has mean mark $65$. Find the mean mark of all $50$ students. | numeric | `{"value":67.8}` (`67.8`) | 1: `67.8` | 5 |
| A12-S3-155 | Test A has mean $70$ and standard deviation $5$; test B has mean $58$ and standard deviation $12$. What mark on test B is equivalent to $78$ | numeric | `{"value":77.2}` (`77.2`) | 1: `77.2` | 5 |
| X11-A1-144 | How many $4$-digit numbers greater than $5000$ can be formed from the digits $1,2,\dots,9$ with no repetition, if the number must be odd? | numeric | `{"value":924}` (`924`) | 1: `924` | 5 |
| X11-A1-243 | Find the middle term in the expansion of $(2+x)^{8}$. | expression | `{"expr":"1120x^(4)"}` (`1120x^(4)`) | 2: `1120x^(4)` `1120x^4` | 4 |
| X11-F2-035 | The roots of $x^{3}-14x^{2}+56x-64=0$ form a geometric progression. Find them. | set | `{"values":[2,4,8]}` (`2, 4, 8`) | 2: `2, 4, 8` `8, 4, 2` | 3 |
| X11-F2-190 | The roots of $2x^{3}+6x^{2}-x+4=0$ are $\alpha,\beta,\gamma$. Evaluate $\dfrac\alpha{\beta\gamma}+\dfrac\beta{\alpha\gamma}+\dfrac\gamma{\al | numeric | `{"value":-5}` (`-5`) | 1: `-5` | 5 |
| X11-F2-210 | The roots of $2x^{2}-5x+1=0$ are $\alpha$ and $\beta$. Find the exact value of $\alpha^{3}+\beta^{3}$. | numeric | `{"value":11.875}` (`((95)/(8))`) | 3: `((95)/(8))` `95/8` `11.875` | 5 |
| X11-T1-106 | Evaluate $\cos^{-1}\left(-\tfrac{\sqrt3}2\right)-\sin^{-1}\left(-\tfrac12\right)$. | numeric | `{"value":3.141592653589793}` (`pi`) | 2: `pi` `π` | 5 |
| X11-T1-112 | Find the exact value of $\cos\left(\tan^{-1}2-\tan^{-1}\tfrac12\right)$. | numeric | `{"value":0.8}` (`((4)/(5))`) | 3: `((4)/(5))` `4/5` `0.8` | 5 |
| X11-T2-029 | Given acute angles with $\tan A=2$ and $\tan B=\tfrac13$, find $A-B$. | numeric | `{"value":0.7853981633974483}` (`((pi)/(4))`) | 4: `((pi)/(4))` `pi/4` `π/4` `((π)/(4))` | 5 |
| X11-T2-164 | $A$ is acute with $\tan A=\tfrac34$ and $B$ is obtuse with $\sin B=\tfrac5{13}$. Find $\cos(A-B)$. | numeric | `{"value":-0.5076923076923077}` (`-((33)/(65))`) | 2: `-((33)/(65))` `-(33/65)` | 5 |
| X11-T2-205 | Given $\tan\tfrac x2=\tfrac13$, find the exact value of $\sin x+\cos x$. | numeric | `{"value":1.4}` (`((7)/(5))`) | 3: `((7)/(5))` `7/5` `1.4` | 5 |
| X12-C2-169 | Evaluate $\displaystyle\int_{\sqrt2}^{\sqrt6}\frac{dx}{\sqrt{8-x^{2}}}$. | numeric | `{"value":0.5235987755982988}` (`((pi)/(6))`) | 4: `((pi)/(6))` `pi/6` `π/6` `((π)/(6))` | 5 |
| X12-C2-184 | Evaluate $\displaystyle\int_{0}^{1}\frac{2x+3}{x^{2}+3x+5}\,dx$. | expression (exact form) | `{"expr":"ln(((9)/(5)))"}` (`ln(((9)/(5)))`) | 2: `ln(((9)/(5)))` `ln((9/5))` | 4 |
| X12-C2-193 | Find the exact area under $y=\dfrac1{3+x^{2}}$ from $x=0$ to $x=\sqrt3$. | expression (exact form) | `{"expr":"((pi)/(4sqrt(3)))"}` (`((pi)/(4sqrt(3)))`) | 4: `((pi)/(4sqrt(3)))` `pi/(4sqrt(3))` `π/(4sqrt(3))` `((π)/(4sqrt(3)))` | 4 |
| X12-C2-200 | Evaluate $\displaystyle\int_{e}^{e^{3}}\frac{dx}{x\ln x}$. | numeric | `{"value":1.0986122886681096}` (`ln(3)`) | 1: `ln(3)` | 5 |
| X12-C2-202 | Find the exact area under $y=\dfrac1{1+9x^{2}}$ from $x=0$ to $x=\tfrac13$. | numeric | `{"value":0.2617993877991494}` (`((pi)/(12))`) | 4: `((pi)/(12))` `pi/12` `π/12` `((π)/(12))` | 5 |
| X12-C2-216 | Find the exact area under $y=\dfrac1{\sqrt{16-x^{2}}}$ between $x=-2$ and $x=2$. | numeric | `{"value":1.0471975511965976}` (`((pi)/(3))`) | 4: `((pi)/(3))` `pi/3` `π/3` `((π)/(3))` | 5 |
| X12-C3-171 | The region between $y=x^{3}$, the $y$-axis, $y=1$ and $y=27$ is rotated about the $y$-axis. Find the volume. | numeric | `{"value":456.159253301238}` (`((726pi)/(5))`) | 4: `((726pi)/(5))` `726pi/5` `726π/5` `((726π)/(5))` | 5 |
| X12-C3-195 | The part of the circle $x^{2}+y^{2}=25$ with $3\le x\le5$, $y\ge0$, is rotated about the $x$-axis to form a cap of a sphere. Find its volume | numeric | `{"value":54.45427266222308}` (`((52pi)/(3))`) | 4: `((52pi)/(3))` `52pi/3` `52π/3` `((52π)/(3))` | 5 |
| X12-C3-205 | The region enclosed by $y=2x$ and $y=x^{2}$ is rotated about the $y$-axis. Find the volume of the solid. | numeric | `{"value":8.377580409572781}` (`((8pi)/(3))`) | 4: `((8pi)/(3))` `8pi/3` `8π/3` `((8π)/(3))` | 5 |
| X12-C3-209 | The region under $y=1+\cos x$ for $0\le x\le\pi$ is rotated about the $x$-axis. Find the exact volume. | expression (exact form) | `{"expr":"((3pi^(2))/(2))"}` (`((3pi^(2))/(2))`) | 4: `((3pi^(2))/(2))` `(3pi^2)/2` `(3π^2)/2` `((3π^(2))/(2))` | 4 |
| X12-C3-215 | The region inside $x^{2}+y^{2}=4$ and above $y=1$ is rotated about the $x$-axis. Find the exact volume of the solid formed. | numeric | `{"value":21.765592370810612}` (`4sqrt(3)pi`) | 2: `4sqrt(3)pi` `4sqrt(3)π` | 5 |
| X12-T3-075 | Find the maximum value of $y=\sin x(\sin x+\cos x)$. | numeric | `{"value":1.2071067811865475}` (`((1+sqrt(2))/(2))`) | 2: `((1+sqrt(2))/(2))` `(1+sqrt(2))/2` | 5 |
