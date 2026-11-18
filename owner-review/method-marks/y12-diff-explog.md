DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Differentiate an exponential or logarithmic function

Course: Year 12 Mathematics Advanced. Type id: `y12-diff-explog`. Total: 2 marks.

## Question form

A function such as 2 ln(6x + 5) or x squared times e to the 2x is given and the student differentiates it.

Generator families: `y12-explogcalc`.

## Sample questions

1. Differentiate $y = e^{9x + 9}$ with respect to $x$.
   Key: 9*e^(9*x+9)

2. Differentiate $y = 3e^{3x + 1}$ with respect to $x$.
   Key: 9*e^(3*x+1)

3. Differentiate $y = 4\ln(8x - 2)$ with respect to $x$, for $8x - 2 > 0$.
   Key: 32/(8*x-2)

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Writes a correct derivative (any equivalent form). | 1 | the engine tags a line "ok" when it is equivalent to the question's derivative (decided by: engine) |
| Gives the final answer correctly, in the form the question asks. | 1 | the last line, read as the final answer, is checked by the answer checker (the same check that marks a one-line answer) (decided by: answer checker) |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The engine is the marking code. The interpreter is the part that reads one line of working and checks it against the question. The answer checker is the code that marks a final answer.

It can verify:

- Writes a correct derivative (any equivalent form). (engine).
- Gives the final answer correctly, in the form the question asks. (answer checker).

It cannot verify:

- It cannot tell which rule the student used, or an unsimplified rule line from the final line. One correct line can earn both criteria.
- The line interpreter does not read these derivatives; only the engine's own equivalence check decides.

Rule used in every award below: a line earns a criterion only if the engine or interpreter finds it true. The first wrong line stops all further credit. The final-answer criterion looks at the last line only.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Differentiate $y = e^{9x + 9}$ with respect to $x$.

### Full marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 9*e^(9*x+9)` | true line | could not verify (the question gives no single function to differentiate) | derivative, answer |

Award: **2 of 2**. Criteria earned: derivative (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 9*e^(9*x+9)` | true line | could not verify (the question gives no single function to differentiate) | derivative |
| 2 | `dy/dx = 10*e^(9*x+9)` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | could not verify (the question gives no single function to differentiate) | nothing |

Award: **1 of 2**. Criteria earned: derivative (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 10*e^(9*x+9)` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | could not verify (the question gives no single function to differentiate) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 10*e^(9*x+9)` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | could not verify (the question gives no single function to differentiate) | nothing |
| 2 | `= 10*e^(9*x+9)` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | could not verify (depends on the line above, which could not be verified) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: it did not name any line as wrong, so the slip showed only as lines that earned no tick.

The engine did not name any later line as following from the earlier mistake. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `f58e0aa8654e1cbe8a0760730c56be3459ffb874c9606969ff9f1b0d2eee6f10`
