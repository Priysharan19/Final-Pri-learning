DRAFT for the author's review: not approved. Nothing in this file is switched on.

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
| Differentiates the function correctly (stage 1 of the plan). | 1 | the engine tags a line "ok" at stage 1 of the question's plan (the derivative stage) (decided by: engine plan stage) |
| Substitutes the x-value and finds the gradient (stage 2 of the plan). | 1 | the engine tags a line "ok" at stage 2 of the plan (the substitution of the x-value into the verified derivative) (decided by: engine plan stage) |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The engine is the marking code. The interpreter is the part that reads one line of working and checks it against the question. The answer checker is the code that marks a final answer.

It can verify:

- Differentiates the function correctly (stage 1 of the plan). (engine plan stage).
- Substitutes the x-value and finds the gradient (stage 2 of the plan). (engine plan stage).

It cannot verify:

- It decides only the two stages the plan names. It cannot check any other kind of working.
- The plan is authored for this question form only.

Rule used in every award below: a line earns a criterion only if the engine or interpreter finds it true. The first wrong line stops all further credit. The final-answer criterion looks at the last line only.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Find the gradient of the tangent to $y = x^2 + 6x + 3$ at the point where $x = -1$.

### Full marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 2x + 6` | true line | checked | derivative |
| 2 | `dy/dx = 2*(-1) + 6` | true line | could not verify (a number here is the gradient at a point, which this line does not say) | gradient |
| 3 | `gradient = 4` | true line | could not verify (gradient of a curve needs a point) | nothing |

Award: **2 of 2**. Criteria earned: derivative (1), gradient (1).

### Partial marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 2x + 6` | true line | checked | derivative |
| 2 | `gradient = 5` | wrong here (This substituted value is 5, but the verified expression evaluates to 4.) | could not verify (gradient of a curve needs a point) | nothing |

Award: **1 of 2**. Criteria earned: derivative (1).

### Zero marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 3x + 6` | wrong here (At x = -5, this line gives -9, but differentiating the original function gives -4.) | wrong here | nothing |
| 2 | `dy/dx = 3*(-1) + 6` | no verdict (Follows from the earlier slip.) | could not verify (a number here is the gradient at a point, which this line does not say) | nothing |
| 3 | `gradient = 3` | no verdict (Follows from the earlier slip.) | could not verify (gradient of a curve needs a point) | nothing |

Award: **0 of 2**. Criteria earned: none.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 3x + 6` | wrong here (At x = -5, this line gives -9, but differentiating the original function gives -4.) | wrong here | nothing |
| 2 | `dy/dx = 3*(-1) + 6` | no verdict (Follows from the earlier slip.) | could not verify (a number here is the gradient at a point, which this line does not say) | nothing |
| 3 | `gradient = 3` | no verdict (Follows from the earlier slip.) | could not verify (gradient of a curve needs a point) | nothing |

Award: **0 of 2**. Criteria earned: none.

What the engine actually did: the first wrong line was line 1. After it, line 2: engine no verdict, interpreter could not verify; line 3: engine no verdict, interpreter could not verify.

The engine named line(s) 2, 3 as following from the earlier mistake, and gave them no tick. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `8c8eba64e50f941ad2501bbc99131020303fd6bf1180dae9fe36088ffbd6fb70`
