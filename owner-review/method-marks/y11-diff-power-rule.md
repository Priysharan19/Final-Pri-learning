DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Differentiate a polynomial by the power rule

Course: Year 11 Mathematics Advanced. Type id: `y11-diff-power-rule`. Total: 2 marks.

## Question form

A power or a polynomial is given and the student writes its derivative.

Generator families: `y11-diff`.

## Sample questions

1. Differentiate $y = -8x^{9}$.
   Key: -72x^8

2. Differentiate $y = -3x^{5}$.
   Key: -15x^4

3. Differentiate $y = -8x^{7}$.
   Key: -56x^6

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Writes a correct derivative. | 1 | the engine tags a line "ok" against the question's derivative step (decided by: engine) |
| Gives the final answer correctly. | 1 | the last line, read as the final answer, is checked by the answer checker (the same check that marks a one-line answer) (decided by: answer checker) |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The engine is the marking code. The interpreter is the part that reads one line of working and checks it against the question. The answer checker is the code that marks a final answer.

It can verify:

- Writes a correct derivative. (engine).
- Gives the final answer correctly. (answer checker).

It cannot verify:

- It cannot tell a rule line from the final line, so one correct line can earn both criteria.
- It does not check each term separately.

Rule used in every award below: a line earns a criterion only if the engine or interpreter finds it true. The first wrong line stops all further credit. The final-answer criterion looks at the last line only.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Differentiate $y = -8x^{9}$.

### Full marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = -72x^8` | true line | checked | derivative, answer |

Award: **2 of 2**. Criteria earned: derivative (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = -72x^8` | true line | checked | derivative |
| 2 | `dy/dx = -73x^8` | wrong here (Your power is right (x⁸). Check the coefficient: -8 × 9 = -72.) | wrong here | nothing |

Award: **1 of 2**. Criteria earned: derivative (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = -73x^8` | wrong here (Your power is right (x⁸). Check the coefficient: -8 × 9 = -72.) | wrong here | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = -73x^8` | wrong here (Your power is right (x⁸). Check the coefficient: -8 × 9 = -72.) | wrong here | nothing |
| 2 | `= -73x^8` | no verdict (Follows from the earlier slip.) | follows from the earlier mistake | nothing |

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
- Scheme digest: `9c576f1338d510d4ae084bb8db6d86fb50f528359b149d21ee65940ce8b95e7d`
