APPROVED by the author, Priysharan Tripathi (tutor), on 2026-11-24, at the digest named in this file. It pays on Prithagoras only while the server has PRI_METHOD_MARKS=on. Not an official NESA guideline.

# Gradient of a tangent: differentiate, then substitute

Course: Year 11 Mathematics Advanced. Type id: `y11-diff-gradient-plan`. Total: 2 marks.

## Question form

A curve y = f(x) is given and the student finds the gradient of the tangent at a stated x. This question carries a two-stage plan the engine already knows.

Generator families: `y11-diff`.

## Sample questions

1. Find the gradient of the tangent to $y = x^2 + 6x + 3$ at the point where $x = -1$.
   Key: 4

2. Find the gradient of the tangent to $y = x^2 - x + 4$ at the point where $x = 3$.
   Key: 5

3. Find the gradient of the tangent to $y = x^2 + 2x - 3$ at the point where $x = -1$.
   Key: 0

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Differentiates the function correctly (stage 1 of the plan). | 1 | a line the step check ticks at stage 1 of the question's plan (the derivative stage) |
| Substitutes the x-value and finds the gradient correctly (the final answer). | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Differentiates the function correctly (stage 1 of the plan).
- Substitutes the x-value and finds the gradient correctly (the final answer).

It cannot verify:

- It decides only the two stages the plan names. It cannot check any other kind of working.
- The plan is authored for this question form only.

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Find the gradient of the tangent to $y = x^2 + 6x + 3$ at the point where $x = -1$.

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 2x + 6` | true line | derivative |
| 2 | `dy/dx = 2*(-1) + 6` | true line | nothing |
| 3 | `gradient = 4` | true line | nothing |

Award: **2 of 2**. Criteria earned: derivative (1), gradient (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 2x + 6` | true line | derivative |
| 2 | `gradient = 5` | wrong here (This substituted value is 5, but the verified expression evaluates to 4.) | nothing |

Award: **1 of 2**. Criteria earned: derivative (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 3x + 6` | wrong here (At x = -5, this line gives -9, but differentiating the original function gives -4.) | nothing |
| 2 | `dy/dx = 3*(-1) + 6` | no verdict (Follows from the earlier slip.) | nothing |
| 3 | `gradient = 3` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 3x + 6` | wrong here (At x = -5, this line gives -9, but differentiating the original function gives -4.) | nothing |
| 2 | `dy/dx = 3*(-1) + 6` | no verdict (Follows from the earlier slip.) | nothing |
| 3 | `gradient = 3` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: no verdict; line 3: no verdict.

The engine named line(s) 2, 3 as following from the earlier mistake, and gave them no tick. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `c9d8465b12841281dec30c8bb4b9bdebef94bb375c47c06e7e4f32838d86865b`
