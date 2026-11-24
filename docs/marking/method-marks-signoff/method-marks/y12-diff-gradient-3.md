APPROVED by the author, Priysharan Tripathi (tutor), on 2026-11-24, at the digest named in this file. It pays on Prithagoras only while the server has PRI_METHOD_MARKS=on. Not an official NESA guideline.

# Differentiate, substitute, then find the gradient at a point (3 marks)

Course: Year 12 Mathematics Advanced. Type id: `y12-diff-gradient-3`. Total: 3 marks.

## Question form

A function of x is given and the student finds its gradient at a stated value of x (three marks): differentiate, put the value in, evaluate.

Generator families: `y12-diff`.

## Sample questions

1. If $y = \dfrac{x + 4}{2x + 3}$, find the gradient $\dfrac{dy}{dx}$ at $x = 1$, correct to 3 decimal places where needed.
   Key: -0.2

2. Find the gradient of $y = \dfrac{2x - 3}{4x - 2}$ at the point where $x = 1$. Give your answer as a decimal, correct to 3 decimal places where needed.
   Key: 2

3. Find the gradient of $y = \dfrac{-3x + 6}{x + 4}$ at the point where $x = 1$. Give your answer as a decimal, correct to 3 decimal places where needed.
   Key: -0.72

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Differentiates the function correctly. | 1 | a line the step check ticks as equal to the derivative of the given function (the plan's first stage), in any form; a line that only restates the function does not count |
| Substitutes the value of x into the derivative correctly. | 1 | a line the step check ticks at the plan's second stage (its value is the derivative's value at the point) that is the derivative the student wrote above, with the value put in, term by term (not an expression that merely comes to the same value) |
| Finds the gradient at the point correctly (the final answer). | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 3 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Differentiates the function correctly.
- Substitutes the value of x into the derivative correctly.
- Finds the gradient at the point correctly (the final answer).

It cannot verify:

- It reads a derivative only when the line is labelled dy/dx, y' or f'(x); a line that only restates the function earns nothing.
- It cannot tell which rule the student used, or judge a long written reason.
- The substitution line must be the derivative the student wrote, with the value put in, term by term. A sum that merely comes to the same value, or the value alone, is a true line but does not show the substitution, so it earns nothing for it.
- The gradient is read from the final answer only (the answer checker); a rounded decimal on a working line is not matched.

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: If $y = \dfrac{x + 4}{2x + 3}$, find the gradient $\dfrac{dy}{dx}$ at $x = 1$, correct to 3 decimal places where needed.

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = (2 * x + 3 - (x + 4) * 2) / (2 * x + 3)^2` | true line | derivative |
| 2 | `dy/dx = (2 * (1) + 3 - ((1) + 4) * 2) / (2 * (1) + 3)^2` | true line | substitute |
| 3 | `dy/dx = -0.2` | true line | nothing |

Award: **3 of 3**. Criteria earned: derivative (1), substitute (1), gradient (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = (2 * x + 3 - (x + 4) * 2) / (2 * x + 3)^2` | true line | derivative |
| 2 | `dy/dx = (2 * (1) + 3 - ((1) + 4) * 2) / (2 * (1) + 3)^2` | true line | substitute |
| 3 | `dy/dx = 0.8` | no verdict (This substituted value is 0.8, but the verified expression evaluates to -0.2.) | nothing |

Award: **2 of 3**. Criteria earned: derivative (1), substitute (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = (3 * x + 3 - (x + 4) * 2) / (2 * x + 3)^2` | wrong here (At x = -5, this line gives -0.20408163, but differentiating the original function gives -0.10204082.) | nothing |
| 2 | `dy/dx = 0.8` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = (3 * x + 3 - (x + 4) * 2) / (2 * x + 3)^2` | wrong here (At x = -5, this line gives -0.20408163, but differentiating the original function gives -0.10204082.) | nothing |
| 2 | `dy/dx = (3 * (1) + 3 - ((1) + 4) * 2) / (2 * (1) + 3)^2` | no verdict (Follows from the earlier slip.) | nothing |
| 3 | `dy/dx = 0.8` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: no verdict; line 3: no verdict.

The engine named line(s) 2, 3 as following from the earlier mistake, and gave them no tick. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `617054ccf2d5ea4c0bc74f4bf2c0c0657b871f8914a5ac414f93de9f24c57efe`
