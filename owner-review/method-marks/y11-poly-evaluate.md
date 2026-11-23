DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Evaluate a polynomial or find a remainder by substitution

Course: Year 11 Mathematics Advanced. Type id: `y11-poly-evaluate`. Total: 2 marks.

## Question form

A polynomial P(x) is given. The student finds P(a), or the remainder when P(x) is divided by x - a.

Generator families: `y11-polynomials`.

## Sample questions

1. If $P(x) = x^3 - 4x^2 + 5x + 7$, evaluate $P(-2)$.
   Key: -27

2. If $P(x) = x^3 - 2x^2 - 2x + 1$, evaluate $P(3)$.
   Key: 4

3. If $P(x) = x^3 - 4x^2 - 5x + 4$, evaluate $P(-2)$.
   Key: -10

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Substitutes the correct value into P(x). | 1 | a line that starts with P at the given value, written as the polynomial with that value put in, term by term (not an expression that merely comes to the same value), which the step check ticks |
| Evaluates correctly to give the value or remainder. | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Substitutes the correct value into P(x).
- Evaluates correctly to give the value or remainder.

It cannot verify:

- A substitution line earns only when it is P(x) with the asked value put in, term by term. A sum that merely comes to the same value (a different number, or an evaluated line) does not earn; that criterion is then "not verified".
- Long division is not read at all.

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: If $P(x) = x^3 - 4x^2 + 5x + 7$, evaluate $P(-2)$.

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `P(-2) = (-2)^3-4*(-2)^2+5*(-2)+7` | true line (With $P = x^{3} - 4x^{2} + 5x + 7$ from the question, each side comes to $-27$.) | substitute |
| 2 | `P(-2) = -27` | true line (With $P = x^{3} - 4x^{2} + 5x + 7$ from the question, each side comes to $-27$.) | nothing |

Award: **2 of 2**. Criteria earned: substitute (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `P(-2) = (-2)^3-4*(-2)^2+5*(-2)+7` | true line (With $P = x^{3} - 4x^{2} + 5x + 7$ from the question, each side comes to $-27$.) | substitute |
| 2 | `P(-2) = -26` | no verdict (Not checked: the checker cannot tell from this line alone whether it is true.) | nothing |

Award: **1 of 2**. Criteria earned: substitute (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `P(-2) = (-1)^3-4*(-1)^2+5*(-1)+7` | no verdict (Not checked: the checker cannot tell from this line alone whether it is true.) | nothing |
| 2 | `P(-2) = -26` | no verdict (The arithmetic on this line is right, but this value was not accepted as the answer.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `P(-2) = (-1)^3-4*(-1)^2+5*(-1)+7` | no verdict (Not checked: the checker cannot tell from this line alone whether it is true.) | nothing |
| 2 | `= -3` | no verdict (The arithmetic on this line is right, but this value was not accepted as the answer.) | nothing |

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
- Scheme digest: `752b0bb78307bec0f5a234efc8c69a8713a464081f5b38b1a87ebfe3eec50503`
