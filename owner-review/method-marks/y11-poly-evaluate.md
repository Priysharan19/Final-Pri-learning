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
| Substitutes the correct value into P(x). | 1 | a line that starts with the function written at the given value (for example y(2) = ...) with a right side that is not just a number, which the interpreter finds true (decided by: interpreter) |
| Evaluates correctly to give the value or remainder. | 1 | the last line, read as the final answer, is checked by the answer checker (the same check that marks a one-line answer) (decided by: answer checker) |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The engine is the marking code. The interpreter is the part that reads one line of working and checks it against the question. The answer checker is the code that marks a final answer.

It can verify:

- Substitutes the correct value into P(x). (interpreter).
- Evaluates correctly to give the value or remainder. (answer checker).

It cannot verify:

- It cannot tell whether the student chose the right value to substitute, except through the arithmetic of the line: a wrong value makes the line false.
- Long division is not read at all.

Rule used in every award below: a line earns a criterion only if the engine or interpreter finds it true. The first wrong line stops all further credit. The final-answer criterion looks at the last line only.

## Worked awards

These come from running the engine on built transcripts for the first sample question: If $P(x) = x^3 - 4x^2 + 5x + 7$, evaluate $P(-2)$.

### Full marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `P(-2) = (-2)^3-4*(-2)^2+5*(-2)+7` | not used | checked | substitute |
| 2 | `P(-2) = -27` | not used | checked | answer |

Award: **2 of 2**. Criteria earned: substitute (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `P(-2) = (-2)^3-4*(-2)^2+5*(-2)+7` | not used | checked | substitute |
| 2 | `P(-2) = -26` | not used | wrong here | nothing |

Award: **1 of 2**. Criteria earned: substitute (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `P(-2) = (-1)^3-4*(-1)^2+5*(-1)+7` | not used | wrong here | nothing |
| 2 | `P(-2) = -26` | not used | follows from the earlier mistake | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `P(-2) = (-1)^3-4*(-1)^2+5*(-1)+7` | not used | wrong here | nothing |
| 2 | `= -3` | not used | follows from the earlier mistake | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: engine not used, interpreter follows from the earlier mistake.

The engine named line(s) 2 as following from the earlier mistake, and gave them no tick. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `07b48f570fbcc9411b66b74850ce495858ceb31a707c9cceaf9054e15c7ea8a4`
