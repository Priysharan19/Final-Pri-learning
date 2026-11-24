DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Find the equation of a tangent or a normal

Course: Year 12 Mathematics Advanced. Type id: `y12-tangent-3`. Total: 3 marks.

## Question form

The equation of the tangent, or of the normal, to a curve at a stated value of x is asked for, in the form y = mx + c (three marks).

Generator families: `y12-appdiff`.

## Sample questions

1. Find the equation of the **tangent** to $y = x^2 - 5x + 6$ at the point where $x = 1$. Answer in the form $y = mx + c$.
   Key: -3x + 5

2. Find the equation of the **normal** to the curve $y = x^2 + 3x + 1$ at the point where $x = 2$. Give your answer in the form $y = mx + c$.
   Key: -x/7 + 79/7

3. Find the equation of the **normal** to the curve $y = x^2 + 4x + 4$ at the point where $x = 1$. Give your answer in the form $y = mx + c$.
   Key: -x/6 + 55/6

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Differentiates the curve correctly. | 1 | a line the step check ticks as equal to the derivative of the curve (the plan's first stage), in any form; a line that only restates the curve does not count |
| Finds the gradient of the tangent at the point correctly. | 1 | a line the step check ticks at the plan's second stage: its value is the derivative of the curve at the point (the substitution, or the value), with the label m, m_T, gradient or dy/dx |
| Gives the equation of the line correctly (the final answer). | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 3 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Differentiates the curve correctly.
- Finds the gradient of the tangent at the point correctly.
- Gives the equation of the line correctly (the final answer).

It cannot verify:

- It reads the derivative only when the line is labelled dy/dx, y' or f'(x), and the gradient only when it is labelled m, m_T, gradient or dy/dx with the value at the point. The point of contact, the point-gradient line and the normal's own gradient are not marked as criteria.
- A normal question is paid for the tangent's gradient (the method both share); the normal's gradient is not a criterion.
- The equation is read from the final answer only (the answer checker), in the form the question asks.

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Find the equation of the **tangent** to $y = x^2 - 5x + 6$ at the point where $x = 1$. Answer in the form $y = mx + c$.

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 2 * x - 5` | true line | derivative |
| 2 | `m = 2 * (1) - 5 = -3` | true line | gradient |
| 3 | `y = -3x + 5` | true line (Matches step 4 of the method (Simplify).) | nothing |

Award: **3 of 3**. Criteria earned: derivative (1), gradient (1), equation (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 2 * x - 5` | true line | derivative |
| 2 | `m = 2 * (1) - 5 = -3` | true line | gradient |
| 3 | `y = -4x + 5` | no verdict (This line is not labelled as the value asked for (m, gradient or y′(x)), so it is not checked as that value.) | nothing |

Award: **2 of 3**. Criteria earned: derivative (1), gradient (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 3 * x - 5` | wrong here (At x = -5, this line gives -20, but differentiating the original function gives -15.) | nothing |
| 2 | `y = -4x + 5` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `dy/dx = 3 * x - 5` | wrong here (At x = -5, this line gives -20, but differentiating the original function gives -15.) | nothing |
| 2 | `= 3 * x - 5` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: no verdict.

The engine named line(s) 2 as following from the earlier mistake, and gave them no tick. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `8e0013beecf267d0a84b39636c15d8d6255732d0f652e0d065684e82c0004269`
