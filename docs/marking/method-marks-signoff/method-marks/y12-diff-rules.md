APPROVED by the author, Priysharan Tripathi (tutor), on 2026-11-24, at the digest named in this file. It pays on Prithagoras only while the server has PRI_METHOD_MARKS=on. Not an official NESA guideline.

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
| Writes a correct derivative of the given function (any equivalent form). | 1 | a line the step check ticks as equal to the derivative of the given function, in any form (a line that only restates the function does not count) |
| Gives the final answer correctly, in the form the question asks. | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Writes a correct derivative of the given function (any equivalent form).
- Gives the final answer correctly, in the form the question asks.

It cannot verify:

- It cannot tell which rule the student used. A correct derivative earns the first criterion however it was found.
- It cannot tell an unsimplified rule line from the final line. One correct line can therefore earn both criteria.
- It reads a derivative only when the line is labelled dy/dx, y' or f'(x).

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Differentiate $y = \dfrac{1}{3x + 1}$.

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = -3*(3*x + 1)^(-2)` | true line | derivative |

Award: **2 of 2**. Criteria earned: derivative (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = -3*(3*x + 1)^(-2)` | true line | derivative |
| 2 | `dy/dx = -4*(3*x + 1)^(-2)` | wrong here (At x = 2 this line is -0.0816327, but the derivative is -0.0612245 there.) | nothing |

Award: **1 of 2**. Criteria earned: derivative (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = -4*(3*x + 1)^(-2)` | wrong here (At x = 2 this line is -0.0816327, but the derivative is -0.0612245 there.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = -4*(3*x + 1)^(-2)` | wrong here (At x = 2 this line is -0.0816327, but the derivative is -0.0612245 there.) | nothing |
| 2 | `= -4*(3*x + 1)^(-2)` | no verdict (This defines something the method uses, so it is not checked against the answer.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: no verdict.

The engine did not name any later line as following from the earlier mistake. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `1ad1b2e438c55f503fd39357e4d7f17981edee6820dbdfbadc7638caf33cfeca`
