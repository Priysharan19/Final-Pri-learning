DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Find the equation of a tangent

Course: Year 12 Mathematics Advanced. Type id: `y12-tangent`. Total: 3 marks.

## Question form

A curve y = f(x) and a value of x are given. The student finds the tangent there, in the form y = mx + c.

Generator families: `y12-appdiff`.

## Sample questions

1. Find the equation of the **tangent** to $y = x^2 - 5x + 6$ at the point where $x = 1$. Answer in the form $y = mx + c$.
   Key: -3x + 5

2. Find the equation of the **tangent** to $y = x^2 - 2x - 1$ at the point where $x = 2$. Answer in the form $y = mx + c$.
   Key: 2x + -5

3. Find the equation of the **tangent** to $y = x^2 - 5x + 2$ at the point where $x = -1$. Answer in the form $y = mx + c$.
   Key: -7x + 1

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Differentiates the function correctly. | 1 | a line labelled as the derivative (dy/dx or f'(x)) that the interpreter finds true for the function the question gives (decided by: interpreter) |
| Finds the y-value of the point of contact. | 1 | a line that starts with the function written at the given value (for example y(2) = ...) with a right side that is not just a number, which the interpreter finds true (decided by: interpreter) |
| Gives the correct equation of the tangent. | 1 | the last line, read as the final answer, is checked by the answer checker (the same check that marks a one-line answer) (decided by: answer checker) |

Total: 3 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The engine is the marking code. The interpreter is the part that reads one line of working and checks it against the question. The answer checker is the code that marks a final answer.

It can verify:

- Differentiates the function correctly. (interpreter).
- Finds the y-value of the point of contact. (interpreter).
- Gives the correct equation of the tangent. (answer checker).

It cannot verify:

- It cannot check the gradient at the point on its own line, nor the point-gradient step. The gradient is only tested through the final equation.
- The y-value line must be written as y(a) = ... to be read.

Rule used in every award below: a line earns a criterion only if the engine or interpreter finds it true. The first wrong line stops all further credit. The final-answer criterion looks at the last line only.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Find the equation of the **tangent** to $y = x^2 - 5x + 6$ at the point where $x = 1$. Answer in the form $y = mx + c$.

### Full marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 2x - 5` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | checked | derivative |
| 2 | `y(1) = 2` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | checked | ypoint |
| 3 | `y = -3x + 5` | true line | could not verify (this is an equation about the unknown, or a rearrangement the checker cannot confirm) | answer |

Award: **3 of 3**. Criteria earned: derivative (1), ypoint (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 2x - 5` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | checked | derivative |
| 2 | `y(1) = 2` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | checked | ypoint |
| 3 | `y = -2x + 4` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | could not verify (this is an equation about the unknown, or a rearrangement the checker cannot confirm) | nothing |

Award: **2 of 3**. Criteria earned: derivative (1), ypoint (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 3x - 5` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | wrong here | nothing |
| 2 | `y(1) = 3` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | follows from the earlier mistake | nothing |
| 3 | `y = -2x + 5` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | could not verify (this is an equation about the unknown, or a rearrangement the checker cannot confirm) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 3x - 5` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | wrong here | nothing |
| 2 | `y(1) = 2` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | checked | nothing |
| 3 | `y = -2x + 4` | no verdict (Not checked ,  the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | could not verify (this is an equation about the unknown, or a rearrangement the checker cannot confirm) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: engine no verdict, interpreter checked; line 3: engine no verdict, interpreter could not verify.

The engine did not name any later line as following from the earlier mistake. Line(s) 2 were found true on their own, but they come after the first wrong line, so this draft does not count them. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `e1c1adc9b2320ae1bbcf230f0ece79e186d7d3fee189ad041f33db9cece9cffe`
