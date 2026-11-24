DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Differentiate using the product or quotient rule (3 marks)

Course: Year 12 Mathematics Advanced. Type id: `y12-diff-rules-3`. Total: 3 marks.

## Question form

A function of x is given and the student is asked to differentiate it, using the product rule or the quotient rule, and give the answer in a stated form. This version is for questions worth three marks.

Generator families: `y12-diff`.

## Sample questions

1. Use the quotient rule to differentiate $y = \dfrac{x^2 + 7}{x - 1}$.
   Key: (x^2 - 2x - 7)/(x - 1)^2

2. Use the quotient rule to differentiate $y = \dfrac{x^2 + 3}{x + 1}$.
   Key: (x^2 + 2x - 3)/(x + 1)^2

3. Use the quotient rule to differentiate $y = \dfrac{x^2 - 6}{x - 5}$.
   Key: (x^2 - 10x + 6)/(x - 5)^2

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Writes a correct derivative of the given function (any equivalent form). | 1 | a line the step check ticks as equal to the derivative of the given function, in any form (a line that only restates the function does not count) |
| Writes a second correct derivative, on a different line (the rule applied, then simplified). | 1 | a second line the step check ticks as equal to the derivative, whose right-hand side is not the same as an earlier line's once spaces are ignored; the first such line earns the first criterion and the next one earns this |
| Gives the final answer correctly, in the form the question asks. | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 3 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Writes a correct derivative of the given function (any equivalent form).
- Writes a second correct derivative, on a different line (the rule applied, then simplified).
- Gives the final answer correctly, in the form the question asks.

It cannot verify:

- It cannot tell which rule the student used. A correct derivative earns the first criterion however it was found.
- It cannot tell a worthwhile rewrite from a reordering. A second correct line earns the second criterion if its right-hand side is not the same as an earlier line's once spaces are ignored, so the same derivative written in two forms earns both.
- It reads a derivative only when the line is labelled dy/dx, y' or f'(x).

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Use the quotient rule to differentiate $y = \dfrac{x^2 + 7}{x - 1}$.

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = (2 * x * (x - 1) - (x^2 + 7)) / (x - 1)^2` | true line | derivative |
| 2 | `dy/dx = (x^2 - 2x - 7)/(x - 1)^2` | true line | second |

Award: **3 of 3**. Criteria earned: derivative (1), second (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = (2 * x * (x - 1) - (x^2 + 7)) / (x - 1)^2` | true line | derivative |
| 2 | `dy/dx = (x^3 - 2x - 7)/(x - 1)^2` | wrong here (At x = 2 this line is -3, but the derivative is -7 there.) | nothing |

Award: **1 of 3**. Criteria earned: derivative (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = (x^3 - 2x - 7)/(x - 1)^2` | wrong here (At x = 2 this line is -3, but the derivative is -7 there.) | nothing |
| 2 | `dy/dx = (x^3 - 2x - 7)/(x - 1)^2 + 1` | no verdict (The right side had 1 added, but the left side was left as it was.) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = (x^3 - 2x - 7)/(x - 1)^2` | wrong here (At x = 2 this line is -3, but the derivative is -7 there.) | nothing |
| 2 | `= (x^3 - 2x - 7)/(x - 1)^2` | no verdict (This defines something the method uses, so it is not checked against the answer.) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: no verdict.

The engine did not name any later line as following from the earlier mistake. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `045e2cfe6ac1a701d921b62097a289eede04181acf32f226034ec6b475ead35b`
