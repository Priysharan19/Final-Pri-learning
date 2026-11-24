APPROVED by the author, Priysharan Tripathi (tutor), on 2026-11-24, at the digest named in this file. It pays on Prithagoras only while the server has PRI_METHOD_MARKS=on. Not an official NESA guideline.

# Differentiate, then find the gradient at a point (2 marks)

Course: Year 12 Mathematics Advanced. Type id: `y12-diff-gradient-2`. Total: 2 marks.

## Question form

A function of x is given and the student finds its gradient at a stated value of x (two marks).

Generator families: `y12-diff`.

## Sample questions

1. Use the product rule to find the gradient of $y = (2x - 4)(3x + 2)$ at the point where $x = 0$.
   Key: -8

2. Use the product rule to find the gradient of $y = (5x - 7)(4x + 4)$ at the point where $x = 2$.
   Key: 72

3. Find the gradient of $y = x^{3}(3x + 3)^{3}$ at the point where $x = -2$.
   Key: -972

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Differentiates the function correctly. | 1 | a line the step check ticks as equal to the derivative of the given function (the plan's first stage), in any form; a line that only restates the function does not count |
| Finds the gradient at the point correctly (the final answer). | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Differentiates the function correctly.
- Finds the gradient at the point correctly (the final answer).

It cannot verify:

- It reads a derivative only when the line is labelled dy/dx, y' or f'(x); a line that only restates the function earns nothing.
- It cannot tell which rule the student used, or judge a long written reason.
- The substitution line must be the derivative the student wrote, with the value put in, term by term. A sum that merely comes to the same value, or the value alone, is a true line but does not show the substitution, so it earns nothing for it.
- The gradient is read from the final answer only (the answer checker); a rounded decimal on a working line is not matched.

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Use the product rule to find the gradient of $y = (2x - 4)(3x + 2)$ at the point where $x = 0$.

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 2 * (3 * x + 2) + (2 * x - 4) * 3` | true line | derivative |
| 2 | `dy/dx = -8` | true line | nothing |

Award: **2 of 2**. Criteria earned: derivative (1), gradient (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 2 * (3 * x + 2) + (2 * x - 4) * 3` | true line | derivative |
| 2 | `dy/dx = -7` | wrong here (This substituted value is -7, but the verified expression evaluates to -8.) | nothing |

Award: **1 of 2**. Criteria earned: derivative (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 3 * (3 * x + 2) + (2 * x - 4) * 3` | wrong here (At x = -5, this line gives -81, but differentiating the original function gives -68.) | nothing |
| 2 | `dy/dx = -7` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 3 * (3 * x + 2) + (2 * x - 4) * 3` | wrong here (At x = -5, this line gives -81, but differentiating the original function gives -68.) | nothing |
| 2 | `= 3 * (3 * x + 2) + (2 * x - 4) * 3` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: no verdict.

The engine named line(s) 2 as following from the earlier mistake, and gave them no tick. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `321087896ff2c26b5cd961ccd9ff2b269c2374ecaadc8fca2df01d1d85c79647`
