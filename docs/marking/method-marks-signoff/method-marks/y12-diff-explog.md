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
| Writes a correct derivative (any equivalent form). | 1 | a line the step check ticks as equal to the derivative of the given function, in any form (a line that only restates the function does not count) |
| Gives the final answer correctly, in the form the question asks. | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Writes a correct derivative (any equivalent form).
- Gives the final answer correctly, in the form the question asks.

It cannot verify:

- It cannot tell which rule the student used, or an unsimplified rule line from the final line. One correct line can earn both criteria.
- Only the step check's own equivalence test decides whether a line is a correct derivative.

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Differentiate $y = e^{9x + 9}$ with respect to $x$.

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 9*e^(9*x+9)` | true line | derivative |

Award: **2 of 2**. Criteria earned: derivative (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 9*e^(9*x+9)` | true line | derivative |
| 2 | `dy/dx = 10*e^(9*x+9)` | no verdict (Not checked: the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | nothing |

Award: **1 of 2**. Criteria earned: derivative (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 10*e^(9*x+9)` | no verdict (Not checked: the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 10*e^(9*x+9)` | no verdict (Not checked: the checker cannot place this line on the way to the answer, so it is not marked right or wrong.) | nothing |
| 2 | `= 10*e^(9*x+9)` | true line (Equal to the line above for every value of x.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: it did not name any line as wrong, so the slip showed only as lines that earned no tick.

The engine did not name any later line as following from the earlier mistake. Line(s) 2 were found true on their own, but they come after the first wrong line, so this draft does not count them. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `3d22a090d1a9e2bbbcdf4af4e742d5c7e6600812c0e048222be50f2e9e39be85`
