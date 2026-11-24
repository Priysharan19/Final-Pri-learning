DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Evaluate a definite integral or an area (3 marks)

Course: Year 12 Mathematics Advanced. Type id: `y12-integral-3`. Total: 3 marks.

## Question form

A definite integral is given, or the area under a curve between two values of x, and the student finds its value (three marks): integrate, put the limits in, subtract.

Generator families: `y12-integration`, `y12-integral-calc`.

## Sample questions

1. Find the area under the curve $y = (3x + 4)^{2}$ from $x = 1$ to $x = 3$. Give the answer as a fraction in simplest form if needed.
   Key: 206

2. Find the area under the curve $y = (2x + 3)^{3}$ from $x = 0$ to $x = 2$. Give the answer as a fraction in simplest form if needed.
   Key: 290

3. Find the area under the curve $y = (-2x + 5)^{3}$ from $x = 1$ to $x = 2$. Give the answer as a fraction in simplest form if needed.
   Key: 10

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Integrates correctly: writes an antiderivative of the function. | 1 | a line the step check ticks at the plan's first stage: a function on it (after F(x) =, the integral sign, or inside a bracket with limits; any constant) whose derivative equals the function being integrated at every sample point where both are defined, found by differentiating it |
| Substitutes the limits into the antiderivative correctly. | 1 | a line the step check ticks at the plan's second stage (it has a difference of two numbers equal to the value of the integral) whose two numbers are the antiderivative the student wrote above, put at the upper and at the lower limit; a difference that merely comes to the value earns nothing |
| Finds the value correctly (the final answer). | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 3 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Integrates correctly: writes an antiderivative of the function.
- Substitutes the limits into the antiderivative correctly.
- Finds the value correctly (the final answer).

It cannot verify:

- It cannot tell which method the student used. Any function on a line whose derivative is the integrand earns the first criterion, however it was found, and in any form or constant.
- It reads an antiderivative written as F(x) = ..., after the integral sign, or inside a bracket with its limits. A line that is not an antiderivative of this integrand is left without a verdict, never marked wrong.
- The limits criterion needs the antiderivative to be written on its own earlier line, and the substitution to be a difference of two numbers, each exact (a fraction, a surd or a whole-number sum), that are that antiderivative at the upper and at the lower limit. A rounded decimal, or a difference that merely comes to the value, earns nothing.
- Integration by substitution, an area between two curves, an area that crosses the axis and a question about an unknown limit are not read: those questions stay on the final answer.

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: Find the area under the curve $y = (3x + 4)^{2}$ from $x = 1$ to $x = 3$. Give the answer as a fraction in simplest form if needed.

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `F(x) = x*16 + x^2*12 + x^3*3` | true line | antiderivative |
| 2 | `= ((3)*16 + (3)^2*12 + (3)^3*3) - ((1)*16 + (1)^2*12 + (1)^3*3)` | true line | limits |
| 3 | `= 206` | true line (This equals the line above: $206$.) | nothing |

Award: **3 of 3**. Criteria earned: antiderivative (1), limits (1), value (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `F(x) = x*16 + x^2*12 + x^3*3` | true line | antiderivative |
| 2 | `= ((3)*16 + (3)^2*12 + (3)^3*3) - ((1)*16 + (1)^2*12 + (1)^3*3)` | true line | limits |
| 3 | `= 207` | no verdict (the checker could not match this line to the limits substituted into an antiderivative.) | nothing |

Award: **2 of 3**. Criteria earned: antiderivative (1), limits (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `F(x) = x*17 + x^2*12 + x^3*3` | no verdict (the checker could not verify this as an antiderivative of the integrand.) | nothing |
| 2 | `= 207` | no verdict (the checker could not match this line to a step of the area calculation, so it earns no step credit.) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `F(x) = x*17 + x^2*12 + x^3*3` | no verdict (the checker could not verify this as an antiderivative of the integrand.) | nothing |
| 2 | `= ((3)*17 + (3)^2*12 + (3)^3*3) - ((1)*17 + (1)^2*12 + (1)^3*3)` | no verdict (the checker could not match this line to a step of the area calculation, so it earns no step credit.) | nothing |
| 3 | `= 207` | no verdict (the checker could not match this line to a step of the area calculation, so it earns no step credit.) | nothing |

Award: **0 of 3**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: it did not name any line as wrong, so the slip showed only as lines that earned no tick.

The engine did not name any later line as following from the earlier mistake. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `51055d287d31ce88cf90d971e2ee694faa3b213e639265636fad21d5660142e6`
