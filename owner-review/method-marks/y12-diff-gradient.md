DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Differentiate, then find the gradient at a point

Course: Year 12 Mathematics Advanced. Type id: `y12-diff-gradient`. Total: 2 marks.

## Question form

A curve y = f(x) is given. The student differentiates and substitutes an x-value to give the gradient there.

Generator families: `y12-diff`.

## Sample questions

1. Let $y = (2x + 3)^{3}$. Find the gradient of the curve at the point where $x = 1$.
   Key: 150

2. Let $y = (2x - 2)^{3}$. Find the gradient of the curve at the point where $x = -2$.
   Key: 216

3. Let $y = (5x + 4)^{4}$. Find the gradient of the curve at the point where $x = 0$.
   Key: 1280

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Differentiates the given function correctly. | 1 | a line labelled as the derivative (dy/dx or f'(x)) that the interpreter finds true for the function the question gives (decided by: interpreter) |
| Substitutes the x-value and states the gradient correctly. | 1 | the last line, read as the final answer, is checked by the answer checker (the same check that marks a one-line answer) (decided by: answer checker) |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The engine is the marking code. The interpreter is the part that reads one line of working and checks it against the question. The answer checker is the code that marks a final answer.

It can verify:

- Differentiates the given function correctly. (interpreter).
- Substitutes the x-value and states the gradient correctly. (answer checker).

It cannot verify:

- It cannot check the substitution line itself. A line such as "dy/dx = 4(1)(3)" is read as a gradient at a point, which it does not verify. Only the final value is checked.
- It reads only functions that expand to a polynomial. A quotient is not read.

Rule used in every award below: a line earns a criterion only if the engine or interpreter finds it true. The first wrong line stops all further credit. The final-answer criterion looks at the last line only.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Let $y = (2x + 3)^{3}$. Find the gradient of the curve at the point where $x = 1$.

### Full marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 24x^2 + 72x + 54` | not used | checked | derivative |
| 2 | `dy/dx = 150` | not used | could not verify (a number here is the gradient at a point, which this line does not say) | answer |

Award: **2 of 2**. Criteria earned: derivative (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 24x^2 + 72x + 54` | not used | checked | derivative |
| 2 | `dy/dx = 151` | not used | could not verify (a number here is the gradient at a point, which this line does not say) | nothing |

Award: **1 of 2**. Criteria earned: derivative (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 25x^2 + 72x + 54` | not used | wrong here | nothing |
| 2 | `dy/dx = 151` | not used | could not verify (a number here is the gradient at a point, which this line does not say) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 25x^2 + 72x + 54` | not used | wrong here | nothing |
| 2 | `dy/dx = 151` | not used | could not verify (a number here is the gradient at a point, which this line does not say) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: engine not used, interpreter could not verify.

The engine did not name any later line as following from the earlier mistake. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `6835749f95f2fedd805686d2a870c25df14f2e5260fffb596e0fa42c02352344`
