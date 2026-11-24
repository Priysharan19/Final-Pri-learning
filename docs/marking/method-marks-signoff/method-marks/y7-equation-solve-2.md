DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Solve an equation, two marks

Course: Mathematics Stage 4 (Years 7 and 8). Type id: `y7-equation-solve-2`. Total: 2 marks.

## Question form

An equation in one letter is given, or arises from a short word problem, and the student finds the value of the letter. This version is for two-mark questions.

Generator families: `y7-equations`, `y8-equations`, `y7-angles`.

## Sample questions

1. A rectangular netball practice court has length $(x + 5)$ metres and width $20$ metres. Its perimeter is $54$ metres. Find $x$.
   Key: 2

2. A rectangular netball practice court has length $(x + 3)$ metres and width $12$ metres. Its perimeter is $48$ metres. Find $x$.
   Key: 9

3. A rectangular netball practice court has length $(x + 5)$ metres and width $3$ metres. Its perimeter is $20$ metres. Find $x$.
   Key: 2

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Writes a correct step towards the solution. | 1 | a line that the step check ticks as an equation with the same solutions as the question's, and that is a real rewrite: it has a letter in it, it is not the question's own equation (either way round), it is not a solved form such as x = 7, and it is not a line already written |
| Gives the solution correctly. | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Writes a correct step towards the solution.
- Gives the solution correctly.

It cannot verify:

- It reads each line only as an equation with the same solutions as the question's. It cannot tell a worthwhile step from a trivial rewrite that gets nowhere (for example multiplying both sides by 1): both are a true equation with the same solutions, and both earn.
- A line with no letter in it, a solved form such as x = 7, the question's own equation (either way round), and a line already written earn no step.
- A chained line such as 5x = -31 - 4 = -35 is left unchecked by the page, so it earns no step: each equation has to be written on its own line. A line that only shows numbers being equal earns nothing either.
- A step the page cannot place is "not verified", never "wrong". A word problem has no equation printed in the question: the student's own setup equation is a step like any other.

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: A rectangular netball practice court has length $(x + 5)$ metres and width $20$ metres. Its perimeter is $54$ metres. Find $x$.

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `2(x + 5 + 20) = 54` | true line | step |
| 2 | `x + 25 = 27` | true line | nothing |
| 3 | `x = 2` | true line | nothing |
| 4 | `x = 2` | true line | nothing |

Award: **2 of 2**. Criteria earned: step (1), solution (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `2(x + 5 + 20) = 54` | true line | step |
| 2 | `x + 25 = 27` | true line | nothing |
| 3 | `x = 2` | true line | nothing |
| 4 | `x = 3` | wrong here (This line is the line above with 2 in place of 3. Everything around it is correct.) | nothing |

Award: **1 of 2**. Criteria earned: step (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `2(x + 5 + 20) = 55` | wrong here (Put a solution of the original equation in for x (try it yourself) and this line reads 54 = 55, which is false: a correct step keeps every solution.) | nothing |
| 2 | `x = 3` | no verdict (This line is the line above with 3 in place of 2. Everything around it is correct.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `2(x + 5 + 20) = 55` | wrong here (Put a solution of the original equation in for x (try it yourself) and this line reads 54 = 55, which is false: a correct step keeps every solution.) | nothing |
| 2 | `x + 25 = 27` | true line (The left side was divided by 2 but the right side had 28 taken off. If the left side is what you meant, the right side should read 27.5.) | nothing |
| 3 | `x = 2` | true line | nothing |
| 4 | `x = 3` | no verdict (This line is the line above with 2 in place of 3. Everything around it is correct.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: true line; line 3: true line; line 4: no verdict.

The engine did not name any later line as following from the earlier mistake. Line(s) 2, 3 were found true on their own, but they come after the first wrong line, so this draft does not count them. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `2db74e25a9c0a60828800d8f3370fcf2e9287b718dfb852551b812bf37698ed2`
