DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Find the x-coordinates of the stationary points

Course: Year 12 Mathematics Advanced. Type id: `y12-stationary-x`. Total: 3 marks.

## Question form

A cubic curve y = f(x) is given. The student finds where the gradient is zero.

Generator families: `y12-appdiff`.

## Sample questions

1. Find the x-coordinates of the stationary points of $y = 2x^3 - 294x$.
   Key: -7, 7

2. Find the x-coordinates of the stationary points of $y = 2x^3 + 12x^2 + 18x$.
   Key: -3, -1

3. Find the x-coordinates of the stationary points of $y = 2x^3 + 12x^2 - 72x$.
   Key: -6, 2

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Differentiates the function correctly. | 1 | a line labelled as the derivative (dy/dx or f'(x)) that the interpreter finds true for the function the question gives (decided by: interpreter) |
| Sets the derivative equal to zero. | 1 | the line "Let dy/dx = 0", then a line setting the derivative expression equal to zero that the interpreter finds true (decided by: interpreter) |
| Solves to find the x-coordinates. | 1 | a line stating the solutions, which the interpreter substitutes back into the derivative set to zero (decided by: interpreter) |

Total: 3 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The engine is the marking code. The interpreter is the part that reads one line of working and checks it against the question. The answer checker is the code that marks a final answer.

It can verify:

- Differentiates the function correctly. (interpreter).
- Sets the derivative equal to zero. (interpreter).
- Solves to find the x-coordinates. (interpreter).

It cannot verify:

- It checks the "set equal to zero" line only after the student writes a line such as "Let dy/dx = 0". A bare equation with no such line before it is read as an ordinary equation and does not earn this criterion.
- It cannot check the y-coordinates or the nature (maximum, minimum or inflexion) of the points. Those are not in this scheme.

Rule used in every award below: a line earns a criterion only if the engine or interpreter finds it true. The first wrong line stops all further credit. The final-answer criterion looks at the last line only.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Find the x-coordinates of the stationary points of $y = 2x^3 - 294x$.

### Full marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 6x^2 - 294` | no verdict (This line is about another letter. the checker has nothing in this question to check it against, so it is neither marked wrong nor counted.) | checked | derivative |
| 2 | `Let dy/dx = 0` | no verdict (This line is about another letter. the checker has nothing in this question to check it against, so it is neither marked wrong nor counted.) | from the question | nothing |
| 3 | `6x^2 - 294 = 0` | true line | checked | zero |
| 4 | `x = -7 or x = 7` | true line | checked | solve |

Award: **3 of 3**. Criteria earned: derivative (1), zero (1), solve (1).

### Partial marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 6x^2 - 294` | no verdict (This line is about another letter. the checker has nothing in this question to check it against, so it is neither marked wrong nor counted.) | checked | derivative |
| 2 | `Let dy/dx = 0` | no verdict (This line is about another letter. the checker has nothing in this question to check it against, so it is neither marked wrong nor counted.) | from the question | nothing |
| 3 | `6x^2 - 294 = 0` | true line | checked | zero |
| 4 | `x = -6 or x = 8` | wrong here (x = -6 is listed here, but it does not solve the original equation.) | wrong here | nothing |

Award: **2 of 3**. Criteria earned: derivative (1), zero (1).

### Zero marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 7x^2 - 294` | no verdict (This line is about another letter. the checker has nothing in this question to check it against, so it is neither marked wrong nor counted.) | wrong here | nothing |
| 2 | `Let dy/dx = 0` | no verdict (This line is about another letter. the checker has nothing in this question to check it against, so it is neither marked wrong nor counted.) | from the question | nothing |
| 3 | `7x^2 - 294 = 0` | wrong here (Put a solution of the original equation in for x (try it yourself) and this line reads 49 = 0, which is false: a correct step keeps every solution.) | follows from the earlier mistake | nothing |
| 4 | `x = -6 or x = 8` | no verdict (Follows from the earlier slip.) | follows from the earlier mistake | nothing |

Award: **0 of 3**. Criteria earned: none.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `dy/dx = 7x^2 - 294` | no verdict (This line is about another letter. the checker has nothing in this question to check it against, so it is neither marked wrong nor counted.) | wrong here | nothing |
| 2 | `Let dy/dx = 0` | no verdict (This line is about another letter. the checker has nothing in this question to check it against, so it is neither marked wrong nor counted.) | from the question | nothing |
| 3 | `7x^2 - 294 = 0` | wrong here (Put a solution of the original equation in for x (try it yourself) and this line reads 49 = 0, which is false: a correct step keeps every solution.) | follows from the earlier mistake | nothing |
| 4 | `x = -6.48 or x = 6.48` | no verdict (Follows from the earlier slip.) | follows from the earlier mistake | nothing |

Award: **0 of 3**. Criteria earned: none.

What the engine actually did: the first wrong line was line 1. After it, line 2: engine no verdict, interpreter from the question; line 3: engine wrong here, interpreter follows from the earlier mistake; line 4: engine no verdict, interpreter follows from the earlier mistake.

The engine named line(s) 3, 4 as following from the earlier mistake, and gave them no tick. Line(s) 2 were found true on their own, but they come after the first wrong line, so this draft does not count them. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `18d08c2aee3dfccd6e2ec1f9e04ee9e1ef7eed4100f2ad14321dad22f540d857`
