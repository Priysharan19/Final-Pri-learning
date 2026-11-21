> **Note (22 November 2026): these 40 samples were produced by the OLDER integration** (branch `task/line-comments`, 98691867e), by a
> real provider run, and have NOT been regenerated (no provider call was made for this port). What differs on main now: comments
> exist only for lines the engine ticked or crossed with a state, so the samples' comments on "could not check", follow-on and
> incomplete lines, and the "Pri's comment (not checked by the engine)" label, will not appear; a tick that says only "true as
> written" (arithmetic) can no longer be called the right step; the engine's own sentence now stays on the page and the comment sits
> under it, instead of an engine "template" comment being the fallback. Read them as the register of the model's writing, not as a
> preview of the final page.

# Marking comments written by AI: 40 to read before anything goes live

For the owner. Plain words. Nothing here is real student work: the working is made by rule from our own worked solutions (and the cases you tested yourself), so the mistakes are planted. The comments were written by an AI model (`gpt-5.6-terra`) in the voice of a good tutor, exact and encouraging, and then held to the maths engine's rules. **No person has marked these; a second AI scored them, and that is not the same thing.** AI comments stay off until you have read these.

Most are NSW Year 11 and 12 (the product now); a few India and Years 7 to 10 ones are there as a regression check.

How to read each one: the question, the student's working with the line in question marked `>>`, what the maths engine decided about that line (the AI cannot change this), the comment as the student would see it, and what the page shows without the AI. Tick one box per comment.

# Part 1. Comments I think are good (18)

Lines the engine checked, with a specific comment that passed every rule.

## 1. NSW Year 11, correct working

**Question:** Solve $\sin(\theta) = -\frac{\sqrt{2}}{2}$ for $-180° \le \theta \le 180°$. Give all solutions in degrees.

**The working:**

   1. `sin(45°) = (√(2))/2`
   2. `θ = -135°, -45°`
>> 3. `-135 or -45`

**What the maths engine decided about line 3:** the maths engine checked this line and it is right.

**The comment:** Correct. This gives both required degree solutions, $-135°$ and $-45°$, in the stated interval.

**Without the AI the page says:** Correct. The engine checked this line, $-135 \text{ or } -45$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 2. NSW Year 12, your own test case

**Question:** The curve $y = 2x^3 + 9x^2$ has two stationary points. Find the $y$-coordinate of the one with the smaller $x$-coordinate.

**The working:**

   1. `y=2x³+9x²`
   2. `y'=6x²+18x`
>> 3. `for stat points y'=0`
   4. `0=6x²+18x`
   5. `0=6x[x+3]`
   6. `x=0 or x=-3`
   7. `y(0)=0`
   8. `smallest: (0,0)`

**What the maths engine decided about line 3:** this line states a condition (nothing to check).

**The comment:** Correct. Stationary points occur where the derivative is zero, so setting $y'$ equal to $0$ is required.

**Without the AI the page says:** Correct. This states the condition being used, $\text{for stat points y'=0}$, which is the right condition for this question, so the next lines can build on it.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 3. NSW Year 12, correct working

**Question:** Use the substitution $u = x^2 + 5$ to find $\displaystyle\int 10x\,(x^2 + 5)^{4}\,dx$. (You may omit +C.)

**The working:**

   1. `u = x^2 + 5`
   2. `du = 2x dx`
   3. `5∫ u^4du = (5u^5)/5`
   4. `(5(x^2 + 5)^5)/5 + C`
>> 5. `5*(x^2 + 5)^5/5`

**What the maths engine decided about line 5:** the maths engine checked this line and it is right.

**The comment:** Correct. Cancelling the factor $5$ gives the required antiderivative written using the original variable $x$.

**Without the AI the page says:** Correct. The engine checked this line, $\frac{5\left(x^{2} + 5\right)^{5}}{5}$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 4. NSW Year 12, correct working

**Question:** A direct proof about the squares of the numbers $7n + 1$ begins by expanding. Write $(7n + 1)^2$ in expanded, simplified form.

**The working:**

   1. `(7n + 1)^2 = (7n)^2 + 2(7n)(1) + 1^2`
   2. `= 49n^2 + 14n + 1`
>> 3. `49*n^2 + 14*n + 1`

**What the maths engine decided about line 3:** the maths engine checked this line and it is right.

**The comment:** Correct. This states the expanded, simplified form $49n^2+14n+1$ required by the question.

**Without the AI the page says:** Correct. The engine checked this line, $49n^{2} + 14n + 1$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 5. NSW Year 11, one planted mistake

**Question:** Solve $2^{x + 1} = 16$.

**The working:**

>> 1. `2^(x + 1) = 2^4`
   2. `x + 1 = 4`
   3. `x = 3`
   4. `x = -3`

**What the maths engine decided about line 1:** the maths engine checked this line and it is right.

**The comment:** Correct. You rewrite $16$ as $2^4$, so both sides now have the same base.

**Without the AI the page says:** Correct. The engine checked this line, $2^{x + 1} = 2^{4}$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 6. NSW Year 12, correct working

**Question:** Solve $2\sin\theta = 1$ for $0° \le \theta \le 720°$. Give **all** solutions in degrees.

**The working:**

   1. `2sinθ = 1`
   2. `sinθ = 1/2`
   3. `θ = 30°, 150°, 390°, 510°`
>> 4. `30 or 150 or 390 or 510`

**What the maths engine decided about line 4:** the maths engine checked this line and it is right.

**The comment:** Correct. This lists the four degree values obtained from the solution set, covering the required interval through $720°$.

**Without the AI the page says:** Correct. The engine checked this line, $30 \text{ or } 150 \text{ or } 390 \text{ or } 510$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 7. NSW Year 12, correct working

**Question:** A direct proof about the squares of the numbers $7n + 1$ begins by expanding. Write $(7n + 1)^2$ in expanded, simplified form.

**The working:**

   1. `(7n + 1)^2 = (7n)^2 + 2(7n)(1) + 1^2`
>> 2. `= 49n^2 + 14n + 1`
   3. `49*n^2 + 14*n + 1`

**What the maths engine decided about line 2:** the maths engine checked this line and it is right.

**The comment:** Correct. Squaring $7n$ gives $49n^2$, and the middle term $2(7n)(1)$ simplifies to $14n$.

**Without the AI the page says:** Correct. The engine checked this line, $= 49n^{2} + 14n + 1$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 8. NSW Year 12, your own test case

**Question:** The height of a buoy above the seabed, in metres, $t$ seconds after a reading starts, is modelled by $h(t) = 22 + 5\sin\left(\dfrac{\pi t}{6}\right)$. What is the maximum value of $h$?

**The working:**

>> 1. `22+5sin(pi*t/6)`
   2. `max = 22 + 5`
   3. `= 27`

**What the maths engine decided about line 1:** this line copies something the question gave.

**The comment:** Correct. This restates the given height model, with the sine term describing the buoy's changing height.

**Without the AI the page says:** Correct. This line restates what the question gives, $22 + 5\sin\left(\frac{\pi \cdot t}{6}\right)$, so it is a sound starting point for the working that follows.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 9. NSW Year 12, working not finished

**Question:** A direct proof about the squares of the numbers $7n + 1$ begins by expanding. Write $(7n + 1)^2$ in expanded, simplified form.

**The working:**

   1. `(7n + 1)^2 = (7n)^2 + 2(7n)(1) + 1^2`
>> 2. `= 49n^2 + 14n + 1`

**What the maths engine decided about line 2:** the maths engine checked this line and it is right.

**The comment:** Correct. Squaring $7n$ gives $49n^2$, and the middle product $2(7n)(1)$ simplifies to $14n$.

**Without the AI the page says:** Correct. The engine checked this line, $= 49n^{2} + 14n + 1$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 10. NSW Year 11, one planted mistake

**Question:** Solve $6^{x - 4} = 1296$.

**The working:**

>> 1. `6^(x - 4) = 6^4`
   2. `x - 4 = 4`
   3. `x = 8`
   4. `x = 7`

**What the maths engine decided about line 1:** the maths engine checked this line and it is right.

**The comment:** Correct. Since $1296 = 6^4$, rewriting both sides with base $6$ is valid.

**Without the AI the page says:** Correct. The engine checked this line, $6^{x - 4} = 6^{4}$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 11. NSW Year 12, working not finished

**Question:** A divisibility proof hinges on factoring $3n^3 - 27n$ completely. Write it as a product of a constant and three factors.

**The working:**

   1. `3n^3 - 27n = 3n(n^2 - 9)`
>> 2. `= 3(n - 3) n (n + 3)`

**What the maths engine decided about line 2:** the maths engine checked this line and it is right.

**The comment:** Correct. Using the difference of two squares factorises $n^2 - 9$ as $(n - 3)(n + 3)$.

**Without the AI the page says:** Correct. Here the difference of two squares is used to reach $= 3\left(n - 3\right)n\left(n + 3\right)$, and it is equivalent to the line above, so the step is correct.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 12. NSW Year 12, your own test case

**Question:** The curve $y = 2x^3 + 9x^2$ has two stationary points. Find the $y$-coordinate of the one with the smaller $x$-coordinate.

**The working:**

   1. `y=2x³+9x²`
   2. `y'=6x²+18x`
>> 3. `for stat points y'=0`
   4. `0=6x²+18x`
   5. `0=6x[x+3]`
   6. `x=0 or x=-3`
   7. `y(-3)=27`
   8. `smallest: (-3,27)`

**What the maths engine decided about line 3:** this line states a condition (nothing to check).

**The comment:** Correct. Stationary points occur where the derivative is zero, so setting $y'$ equal to $0$ is the required condition.

**Without the AI the page says:** Correct. This states the condition being used, $\text{for stat points y'=0}$, which is the right condition for this question, so the next lines can build on it.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 13. NSW Year 12, one planted mistake

**Question:** A random variable $X$ has $P(X=4) = 0.58$, $P(X=6) = 0.02$ and $P(X=k) = 0.4$, where $k > 6$. Given that $E(X) = 5.24$, find the value of $k$.

**The working:**

   1. `2.32 + 0.12 + 0.4k = 5.24`
>> 2. `0.4k = 2.8`
   3. `k = 7`
   4. `k = 8`

**What the maths engine decided about line 2:** the maths engine checked this line and it is right.

**The comment:** Correct. Subtracting $2.32$ and $0.12$ from $5.24$ correctly isolates the term $0.4k$.

**Without the AI the page says:** Correct. The engine checked this line, $0.4k = 2.8$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 14. NSW Year 12, your own test case

**Question:** The height of a buoy above the seabed, in metres, $t$ seconds after a reading starts, is modelled by $h(t) = 22 + 5\sin\left(\dfrac{\pi t}{6}\right)$. What is the maximum value of $h$?

**The working:**

   1. `22+5sin((n+)/6)`
   2. `max = 22 + 5`
>> 3. `= 27`

**What the maths engine decided about line 3:** the maths engine checked this line and it is right.

**The comment:** Correct. Adding the baseline height $22$ and the maximum increase $5$ gives $27$.

**Without the AI the page says:** Correct. This line continues from the one above and keeps the same value, so the step to $= 27$ is correct.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 15. India Class 9, working not finished

**Question:** Solve $2(x + 4) = 18$.

**The working:**

>> 1. `2(x+4)=18`
   2. `2x+8=18`

**What the maths engine decided about line 1:** the maths engine checked this line and it is right.

**The comment:** Correct. This copies the given equation, with the bracketed expression $x + 4$ multiplied by $2$.

**Without the AI the page says:** Correct. The engine checked this line, $2\left(x + 4\right) = 18$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 16. NSW Year 9, one planted mistake

**Question:** A table of values is being built to graph $y = 5x - 9$. What is the value of $y$ when $x = 3$?

**The working:**

   1. `y = 5(3) - 9`
>> 2. `5 × 3 = 30`
   3. `y = 15 - 9 = 6`

**What the maths engine decided about line 2:** the maths engine found THIS line is the first mistake.

**The comment:** Not yet. The product $5 \times 3$ is $15$, not $30$, so multiply the substituted values accurately.

**Without the AI the page says:** Not yet. Line 1, $y = 5\left(3\right) - 9$, is correct, but this line does not follow from it. This is the first line that does not hold: $5 \cdot 3 = 30$. Substituting back gives 15 on the left and 30 on the right, so this line is not true. Re-evaluate each side with the value you substituted, or check the value itself. Every line after it depends on this one.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 17. NSW Year 10, correct working

**Question:** Simplify $\dfrac{9x^{-6}}{3x^{2}}$.

**The working:**

   1. `9÷ 3 = 3`
   2. `x^(-6)÷ x^2 = x^(-8)`
>> 3. `3*x^(-8)`

**What the maths engine decided about line 3:** the maths engine checked this line and it is right.

**The comment:** Correct. Combining the coefficient $3$ with the index result $x^{-8}$ gives $3x^{-8}$.

**Without the AI the page says:** Correct. The engine checked this line, $3x^{-8}$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 18. NSW Year 9, working not finished

**Question:** Solve $2(x + 4) = 18$.

**The working:**

   1. `2(x+4)=18`
>> 2. `2x+8=18`

**What the maths engine decided about line 2:** the maths engine checked this line and it is right.

**The comment:** Correct. Expanding $2(x + 4)$ gives $2x + 8$, so the equation remains equivalent.

**Without the AI the page says:** Correct. The engine checked this line, $2x + 8 = 18$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

# Part 2. Borderline (12)

Lines the engine could not check, lines after a mistake, compensating mistakes, and comments whose maths the engine could not independently check. These are where I would most like your eye.

## 19. NSW Year 11, working not finished

**Question:** In triangle $ABC$, $\angle A = 58°$, $a = 31$ cm and $b = 20$ cm, with $\angle B$ acute. Find $\angle C$ to the nearest degree.

**The working:**

   1. `B = sin^(-1)((20sin 58°)/31) ≈ 33.2°`
>> 2. `C = 180° - 58° - 33.2° ≈ 89°`

**What the maths engine decided about line 2:** the maths engine could not check this line.

**The comment:** Looks right. Subtracting angles $A$ and $B$ from $180°$ uses the angle sum of a triangle. _(shown with the label "Pri's comment (not checked by the engine)")_

**Without the AI the page says:** Check this. Pri could not check this line, $C = 180° - 58° - 33.2° ≈ 89°$, against the question, so it is neither marked right nor wrong; compare it with the line above yourself.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 20. NSW Year 11, one planted mistake

**Question:** Find the **greatest integer** value of $k$ for which $3x^2 + 3x + k = 0$ has **two distinct real roots**.

**The working:**

   1. `Δ = 9 - 12k`
   2. `Δ > 0`
   3. `k < 0.75`
>> 4. `k = 0`
   5. `k = 1`

**What the maths engine decided about line 4:** the maths engine checked this line and it is right.

**The comment:** Correct. Since $k$ is an integer and $k < 0.75$, the greatest possible value is $0$.

**Without the AI the page says:** Correct. The engine checked this line, $k = 0$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 21. NSW Year 11, working not finished

**Question:** Differentiate $f(x) = x^3 + x^2 - 3x - 3$.

**The working:**

>> 1. `1x^3 → 3x^2, 1x^2 → 2x, -3x → -3, -3 → 0`
   2. `f'(x) = 3x^2 + 2x - 3`

**What the maths engine decided about line 1:** the maths engine could not check this line.

**The comment:** Looks right. Each term has been differentiated separately: the cubic becomes $3x^2$, the quadratic becomes $2x$, and the constant becomes $0$. _(shown with the label "Pri's comment (not checked by the engine)")_

**Without the AI the page says:** Check this. Pri could not check this line, $1x 3 → 3x 2, 1x 2 → 2x, -3x → -3, -3 → 0$, against the question, so it is neither marked right nor wrong; compare it with the line above yourself.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 22. NSW Year 12, one planted mistake

**Question:** The curve $y = x^3 + x^2 + kx$ has a stationary point at $x = 1$. Find the value of $k$.

**The working:**

>> 1. `y' = 3x^2 + 2x + k`
   2. `3 + 2 + k = 0`
   3. `k = -5`
   4. `k = -6`

**What the maths engine decided about line 1:** the maths engine could not check this line.

**The comment:** Looks right. Differentiating $x^3 + x^2 + kx$ gives $3x^2 + 2x + k$, ready to use the stationary-point condition. _(shown with the label "Pri's comment (not checked by the engine)")_

**Without the AI the page says:** Check this. Pri could not check this line, $y' = 3x^{2} + 2x + k$, against the question, so it is neither marked right nor wrong; compare it with the line above yourself.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 23. NSW Year 12, one planted mistake

**Question:** The depth of water at a jetty, in metres, $t$ hours after midnight, is modelled by $h(t) = 14 + 11\sin\left(\dfrac{\pi t}{6}\right)$. What is the maximum value of $h$?

**The working:**

>> 1. `3 ≤ h ≤ 25`
   2. `26`

**What the maths engine decided about line 1:** the maths engine could not check this line.

**The comment:** Looks right. The sine term ranges from $-1$ to $1$, giving depths from $3$ to $25$ metres. _(shown with the label "Pri's comment (not checked by the engine)")_

**Without the AI the page says:** Check this. Pri could not check this line, $3 \le h \le 25$, against the question, so it is neither marked right nor wrong; compare it with the line above yourself.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 24. NSW Year 11, one planted mistake

**Question:** Find the **greatest integer** value of $k$ for which $3x^2 + 3x + k = 0$ has **two distinct real roots**.

**The working:**

   1. `Δ = 9 - 12k`
   2. `Δ > 0`
   3. `k < 0.75`
   4. `k = 0`
>> 5. `k = 1`

**What the maths engine decided about line 5:** the maths engine found THIS line is the first mistake.

**The comment:** Not yet. This line replaces the earlier value $0$ with $1$; the greatest integer satisfying $k < 0.75$ is $0$.

**Without the AI the page says:** Not yet. Line 4, $k = 0$, is correct, but this line does not follow from it. This is the first line that does not hold: $k = 1$. This line is the line above with 0 in place of 1. Everything around it is correct. Check that one calculation and carry the rest of the working forward. Every line after it depends on this one.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 25. NSW Year 11, correct working

**Question:** Find the value of $k$ for which $x^2 - 6x + k = 0$ has **equal roots**.

**The working:**

   1. `(-6)^2 - 4(1)k = 0`
>> 2. `4k = 36`
   3. `k = 9`
   4. `x^2 - 6x + 9 = (x - 3)^2`
   5. `k = 9`

**What the maths engine decided about line 2:** the maths engine checked this line and it is right.

**The comment:** Correct. Rearranging the discriminant equation gives $4k = 36$, ready to determine the required parameter.

**Without the AI the page says:** Correct. The engine checked this line, $4k = 36$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 26. NSW Year 12, working not finished

**Question:** Use the substitution $u = x^2 + 1$ to find $\displaystyle\int 10x\,(x^2 + 1)^{2}\,dx$. (You may omit +C.)

**The working:**

>> 1. `u = x^2 + 1`
   2. `du = 2x dx`
   3. `5∫ u^2du = (5u^3)/3`

**What the maths engine decided about line 1:** the maths engine could not check this line.

**The comment:** Looks right. This defines $u$ as the inner expression $x^2 + 1$ for the substitution. _(shown with the label "Pri's comment (not checked by the engine)")_

**Without the AI the page says:** Check this. Pri could not check this line, $u = x^{2} + 1$, against the question, so it is neither marked right nor wrong; compare it with the line above yourself.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 27. NSW Year 11, working not finished

**Question:** In triangle $ABC$, $\angle A = 42°$, side $a = 25$ m and side $b = 13$ m. Find the acute angle $B$, correct to the nearest degree.

**The working:**

   1. `(sin B)/b = (sin A)/a`
   2. `sin B = (13sin(42°))/25 = 0.348`
>> 3. `B = sin^(-1)(0.348) ≈ 20°`

**What the maths engine decided about line 3:** the maths engine could not check this line.

**The comment:** Looks right. Taking the inverse sine of $0.348$ gives the acute angle $B$ to the nearest degree. _(shown with the label "Pri's comment (not checked by the engine)")_

**Without the AI the page says:** Check this. Pri could not check this line, $B = \sin (-1)(0.348) ≈ 20°$, against the question, so it is neither marked right nor wrong; compare it with the line above yourself.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 28. NSW Year 12, working not finished

**Question:** Use the substitution $u = x^2 + 5$ to find $\displaystyle\int 10x\,(x^2 + 5)^{4}\,dx$. (You may omit +C.)

**The working:**

   1. `u = x^2 + 5`
>> 2. `du = 2x dx`
   3. `5∫ u^4du = (5u^5)/5`

**What the maths engine decided about line 2:** the maths engine could not check this line.

**The comment:** Looks right. Differentiating $u = x^2 + 5$ gives $du = 2x\,dx$, matching the required differential relationship. _(shown with the label "Pri's comment (not checked by the engine)")_

**Without the AI the page says:** Check this. Pri could not check this line, $du = 2xdx$, against the question, so it is neither marked right nor wrong; compare it with the line above yourself.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 29. India Class 9, one planted mistake

**Question:** Solve $4(x - 1) = 2x + 10$.

**The working:**

   1. `4(x-1)=2x+10`
   2. `4x-1=2x+10`
   3. `2x=11`
>> 4. `x=5.5`

**What the maths engine decided about line 4:** the maths engine could not check this line.

**The comment:** Check this. Dividing the preceding equation by the coefficient of $x$ needs to give the required solution. _(shown with the label "Pri's comment (not checked by the engine)")_

**Without the AI the page says:** Check this. Pri could not check this line, $x = 5.5$, against the question, so it is neither marked right nor wrong; compare it with the line above yourself.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

## 30. India Class 9, two mistakes that cancel

**Question:** Solve $4(x - 1) = 2x + 10$.

**The working:**

   1. `4(x-1)=2x+10`
>> 2. `4x-4=2x+10`
   3. `2x=10-4`
   4. `x=3`
   5. `x=7`

**What the maths engine decided about line 2:** the maths engine checked this line and it is right.

**The comment:** Correct. Expanding $4(x-1)$ gives $4x-4$, while the right-hand side remains $2x+10$.

**Without the AI the page says:** Correct. The engine checked this line, $4x - 4 = 2x + 10$, against the question and it holds, so the working stays correct at this point.

**Your verdict:**  [ ] fine to show   [ ] fine but needs a tweak   [ ] never show this   Note: ______________

# Part 3. Comments the rules threw away (10 shown of 43 in this run)

The AI wrote these and the engine's rules refused them; the student saw the engine's own comment instead. Shown so you can see what is being caught, and judge whether the rules are right to catch it.

## 31. NSW Year 12, line 1, correct working

**Question:** To prove $14^n - 1$ is divisible by $13$ by induction, assume $14^k - 1 = 13p$. Then $14^{k+1} - 1 = 14\cdot14^k - 1 = 14(13p + 1) - 1 = 13(\;?\;)$. Find the bracket.

**What the maths engine decided about line 1:** the maths engine could not check this line.

**The AI wrote:** Looks right. This substitutes the induction assumption $14^k = 13p + 1$ into the expression for $14^{k+1} - 1$.

**Caught because:** unsupported-equation.

**Your verdict:**  [ ] right to throw away   [ ] this was actually fine   Note: ______________

## 32. NSW Year 11, line 2, one planted mistake

**Question:** In triangle $ABC$, $\angle A = 42°$, side $a = 25$ m and side $b = 13$ m. Find the acute angle $B$, correct to the nearest degree.

**What the maths engine decided about line 2:** the maths engine could not check this line.

**The AI wrote:** Looks right. Substituting $b=13$, $A=42°$, and $a=25$ isolates $ sin B$ and gives the stated decimal.

**Caught because:** control-character.

**Your verdict:**  [ ] right to throw away   [ ] this was actually fine   Note: ______________

## 33. NSW Year 12, line 1, correct working

**Question:** A direct proof about the squares of the numbers $7n + 1$ begins by expanding. Write $(7n + 1)^2$ in expanded, simplified form.

**What the maths engine decided about line 1:** the maths engine checked this line and it is right.

**The AI wrote:** Correct. This expands the square using $(a+b)^2=a^2+2ab+b^2$, with $a=7n$ and $b=1$.

**Caught because:** unsupported-equation.

**Your verdict:**  [ ] right to throw away   [ ] this was actually fine   Note: ______________

## 34. NSW Year 11, line 2, working not finished

**Question:** Find the **greatest integer** value of $k$ for which $3x^2 + 3x + k = 0$ has **two distinct real roots**.

**What the maths engine decided about line 2:** the maths engine could not check this line.

**The AI wrote:** Looks right. Two distinct real roots require the discriminant to be strictly positive, so $ Delta > 0$ is the required condition.

**Caught because:** control-character.

**Your verdict:**  [ ] right to throw away   [ ] this was actually fine   Note: ______________

## 35. NSW Year 12, line 1, working not finished

**Question:** To prove $14^n - 1$ is divisible by $13$ by induction, assume $14^k - 1 = 13p$. Then $14^{k+1} - 1 = 14\cdot14^k - 1 = 14(13p + 1) - 1 = 13(\;?\;)$. Find the bracket.

**What the maths engine decided about line 1:** the maths engine could not check this line.

**The AI wrote:** Looks right. This substitutes the induction assumption $14^k = 13p + 1$ into $14^{k+1} - 1$.

**Caught because:** unsupported-equation.

**Your verdict:**  [ ] right to throw away   [ ] this was actually fine   Note: ______________

## 36. NSW Year 11, line 2, correct working

**Question:** Differentiate $f(x) = x^3 + x^2 - 3x - 3$.

**What the maths engine decided about line 2:** the maths engine checked this line and it is right.

**The AI wrote:** Correct. Combining the differentiated terms gives $f'(x) = 3x^2 + 2x - 3$.

**Caught because:** too-short.

**Your verdict:**  [ ] right to throw away   [ ] this was actually fine   Note: ______________

## 37. NSW Year 11, line 3, one planted mistake

**Question:** In triangle $ABC$, $\angle A = 58°$, $a = 31$ cm and $b = 20$ cm, with $\angle B$ acute. Find $\angle C$ to the nearest degree.

**What the maths engine decided about line 3:** the maths engine found THIS line is the first mistake.

**The AI wrote:** Not yet. The previous line gives $C \approx 89°$, so changing it to $C = 178$ does not follow from subtracting $58°$ and $33.2°$ from $180°$.

**Caught because:** disagrees-with-engine-reason.

**Your verdict:**  [ ] right to throw away   [ ] this was actually fine   Note: ______________

## 38. NSW Year 12, line 2, your own test case

**Question:** The height of a buoy above the seabed, in metres, $t$ seconds after a reading starts, is modelled by $h(t) = 22 + 5\sin\left(\dfrac{\pi t}{6}\right)$. What is the maximum value of $h$?

**What the maths engine decided about line 2:** the maths engine checked this line and it is right.

**The AI wrote:** Correct. The maximum sine value is $1$, so the largest contribution from $5\sin\left(\frac{\pi t}{6}\right)$ is $5$.

**Caught because:** wrong-answer-attributed.

**Your verdict:**  [ ] right to throw away   [ ] this was actually fine   Note: ______________

## 39. India Class 10, line 3, one planted mistake

**Question:** Solve by substitution: $x + 8y = 28$ and $5x - y = 17$. Find the value of $x$.

**What the maths engine decided about line 3:** the maths engine checked this line and it is right.

**The AI wrote:** Correct. Expanding the bracket gives $140 - 40y - y = 17$, which combines to $140 - 41y = 17$.

**Caught because:** unsupported-equation.

**Your verdict:**  [ ] right to throw away   [ ] this was actually fine   Note: ______________

## 40. India Class 10, line 3, one planted mistake

**Question:** Solve by elimination: $5x + y = 7$ and $6x - 5y = -4$. Find the value of $y$.

**What the maths engine decided about line 3:** the maths engine checked this line and it is right.

**The AI wrote:** Correct. Multiplying $5x + y = 7$ by $6$ gives $30x + 6y = 42$.

**Caught because:** too-short.

**Your verdict:**  [ ] right to throw away   [ ] this was actually fine   Note: ______________
