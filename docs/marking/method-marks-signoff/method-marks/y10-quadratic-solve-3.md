DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Solve a quadratic equation, three marks

Course: Mathematics Stage 5 (Year 10). Type id: `y10-quadratic-solve-3`. Total: 3 marks.

## Question form

A quadratic equation is given and the student finds all its solutions. This version is for three-mark questions.

Generator families: `y10-quadratics`.

## Sample questions

1. Solve $x^2 - 81 = 0$.
   Key: -9, 9

2. Solve $3x^2 - 75 = 0$.
   Key: -5, 5

3. Solve $x^2 - 64 = 0$.
   Key: -8, 8

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Writes a correct first step towards the solutions. | 1 | a line that the step check ticks as an equation with the same solutions as the question's, and that is a real rewrite: it has a letter in it, it is not the question's own equation (either way round), it is not a solved form such as x = 7, and it is not a line already written |
| Writes a second correct step, on a different line. | 1 | a line that the step check ticks as an equation with the same solutions as the question's, and that is a real rewrite: it has a letter in it, it is not the question's own equation (either way round), it is not a solved form such as x = 7, and it is not a line already written; the first such line earns the first step and the next one earns this |
| Gives all the solutions correctly. | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 3 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Writes a correct first step towards the solutions.
- Writes a second correct step, on a different line.
- Gives all the solutions correctly.

It cannot verify:

- It reads each line only as an equation with the same solutions as the question's. It cannot tell a worthwhile step from a harmless rewrite (for example multiplying both sides by 1).
- A line with no letter in it, a solved form such as x = 7, the question's own equation (either way round), and a line already written earn no step.
- A chained line such as 5x = -31 - 4 = -35 is left unchecked by the page, so it earns no step: each equation has to be written on its own line. A line that only shows numbers being equal earns nothing either.
- A step the page cannot place is "not verified", never "wrong". A word problem has no equation printed in the question: the student's own setup equation is a step like any other.

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Solve $x^2 - 81 = 0$.

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `x^2 = 81` | true line | step1 |
| 2 | `x = 9` | true line | nothing |
| 3 | `x = -9` | true line | nothing |
| 4 | `-9 or 9` | true line | nothing |

Award: **3 of 3**. Criteria earned: step1 (1), step2 (1), solutions (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `x^2 = 81` | true line | step1 |
| 2 | `x = 9` | true line | nothing |
| 3 | `x = -9` | true line | nothing |
| 4 | `-9 or 10` | wrong here (x = 10 is listed here, but it does not solve the original equation.) | nothing |

Award: **1 of 3**. Criteria earned: step1 (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `x^2 = 82` | wrong here (Put a solution of the original equation in for x (try it yourself) and this line reads 81 = 82, which is false: a correct step keeps every solution.) | nothing |
| 2 | `-9 or 10` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `x^2 = 82` | wrong here (Put a solution of the original equation in for x (try it yourself) and this line reads 81 = 82, which is false: a correct step keeps every solution.) | nothing |
| 2 | `x = 9` | no verdict (Follows from the earlier slip.) | nothing |
| 3 | `x = -9` | no verdict (Follows from the earlier slip.) | nothing |
| 4 | `-9 or 10` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: no verdict; line 3: no verdict; line 4: no verdict.

The engine named line(s) 2, 3, 4 as following from the earlier mistake, and gave them no tick. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `396531471dd01c7d4e289ac14ac9f279782b1e82d33e7103ff6aca40180d1e51`
