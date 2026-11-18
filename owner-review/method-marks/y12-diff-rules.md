DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Differentiate using the chain, product or quotient rule

Course: Year 12 Mathematics Advanced. Type id: `y12-diff-rules`. Total: 2 marks.

## Question form

A function of x is given and the student is asked to differentiate it, using a named rule, and give the answer in a stated form.

Generator families: `y12-diff`.

## Sample questions

1. Differentiate $y = \dfrac{1}{3x + 1}$.
   Key: -3*(3*x + 1)^(-2)

2. Differentiate $y = \dfrac{1}{4x - 8}$.
   Key: -4*(4*x - 8)^(-2)

3. Differentiate $y = (2x + 6)^{5}$ using the chain rule.
   Key: 10(2x + 6)^4

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Writes a correct derivative of the given function (any equivalent form). | 1 | a line labelled as the derivative (dy/dx or f'(x)) that the interpreter finds true for the function the question gives (decided by: interpreter) |
| Gives the final answer correctly, in the form the question asks. | 1 | the last line, read as the final answer, is checked by the answer checker (the same check that marks a one-line answer) (decided by: answer checker) |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The engine is the marking code. The interpreter is the part that reads one line of working and checks it against the question. The answer checker is the code that marks a final answer.

It can verify:

- Writes a correct derivative of the given function (any equivalent form). (interpreter).
- Gives the final answer correctly, in the form the question asks. (answer checker).

It cannot verify:

- It cannot tell which rule the student used. A correct derivative earns the first criterion however it was found.
- It cannot tell an unsimplified rule line from the final line. One correct line can therefore earn both criteria.
- It reads a derivative only when the line is labelled dy/dx, y' or f'(x).

Rule used in every award below: a line earns a criterion only if the engine or interpreter finds it true. The first wrong line stops all further credit. The final-answer criterion looks at the last line only.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Differentiate $y = \dfrac{1}{3x + 1}$.

### Full marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = -3*(3*x + 1)^(-2)` | true line | checked | derivative, answer |

Award: **2 of 2**. Criteria earned: derivative (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = -3*(3*x + 1)^(-2)` | true line | checked | derivative |
| 2 | `dy/dx = -4*(3*x + 1)^(-2)` | wrong here (At x = 2 this line is -0.0816327, but the derivative is -0.0612245 there.) | wrong here | nothing |

Award: **1 of 2**. Criteria earned: derivative (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = -4*(3*x + 1)^(-2)` | wrong here (At x = 2 this line is -0.0816327, but the derivative is -0.0612245 there.) | wrong here | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = -4*(3*x + 1)^(-2)` | wrong here (At x = 2 this line is -0.0816327, but the derivative is -0.0612245 there.) | wrong here | nothing |
| 2 | `= -4*(3*x + 1)^(-2)` | no verdict (This defines something the method uses, so it is not checked against the answer.) | follows from the earlier mistake | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: engine no verdict, interpreter follows from the earlier mistake.

The engine named line(s) 2 as following from the earlier mistake, and gave them no tick. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `cf7cfc7d6d8ffaa4ccd53b8a7f335c138190ea80ea333817ff6aecb847083e42`
