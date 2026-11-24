APPROVED by the author, Priysharan Tripathi (tutor), on 2026-11-24, at the digest named in this file. It pays on Prithagoras only while the server has PRI_METHOD_MARKS=on. Not an official NESA guideline.

# Find the value of a sine or cosine model at a time

Course: Year 12 Mathematics Advanced. Type id: `y12-trig-evaluate`. Total: 2 marks.

## Question form

A model h(t) is given and the student finds h at a stated value of t.

Generator families: `y12-trig-model`.

## Sample questions

1. The depth of water at a jetty, in metres, $t$ hours after midnight, is modelled by $h(t) = 15 + 12\sin\left(\dfrac{\pi t}{12}\right)$. Find $h(10)$. (Use $\sin\dfrac{\pi}{6} = \sin\dfrac{5\pi}{6} = \dfrac12$.)
   Key: 21

2. The number of hours of daylight in a town, $t$ months after the equinox, is modelled by $h(t) = 13 + 4\sin\left(\dfrac{\pi t}{6}\right)$. Find $h(5)$. (Use $\sin\dfrac{\pi}{6} = \sin\dfrac{5\pi}{6} = \dfrac12$.)
   Key: 15

3. The height of a buoy above the seabed, in metres, $t$ seconds after a reading starts, is modelled by $h(t) = 24 + 8\sin\left(\dfrac{\pi t}{6}\right)$. Find $h(5)$. (Use $\sin\dfrac{\pi}{6} = \sin\dfrac{5\pi}{6} = \dfrac12$.)
   Key: 28

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| Substitutes the value of t into the model correctly. | 1 | a line that starts with the model written at the given value, for example h(5) = ..., written as the model with that value put in, term by term (not an expression that merely comes to the same value), which the step check ticks |
| States the value correctly. | 1 | the answer checker marks the final answer, the same check that marks a one-line answer |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.

It can verify:

- Substitutes the value of t into the model correctly.
- States the value correctly.

It cannot verify:

- A substitution line earns only when it is the model with the asked value put in, term by term. A sum that merely comes to the same value (a different number, or an evaluated line) does not earn; that criterion is then "not verified".
- It cannot judge a trigonometric value of a plain number without pi, because the angle might be in degrees or radians. Such a line is left unverified.
- The question may supply the exact trig value to use. The engine does not check that the student used it.

Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.

## Worked awards

These come from running the engine on built transcripts for the first sample question: The depth of water at a jetty, in metres, $t$ hours after midnight, is modelled by $h(t) = 15 + 12\sin\left(\dfrac{\pi t}{12}\right)$. Find $h(10)$. (Use $\sin\dfrac{\pi}{6} = \sin\dfrac{5\pi}{6} = \dfrac12$.)

### Full marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `h(10) = 15 + 12sin((π*(10))/(12))` | true line | substitute |
| 2 | `h(10) = 21` | true line | nothing |

Award: **2 of 2**. Criteria earned: substitute (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `h(10) = 15 + 12sin((π*(10))/(12))` | true line | substitute |
| 2 | `h(10) = 22` | wrong here (This comes to $22$, which is not the $h(10)$.) | nothing |

Award: **1 of 2**. Criteria earned: substitute (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `h(10) = 15 + 12sin((π*(11))/(12))` | wrong here (This comes to $18.105829$, which is not the $h(10)$.) | nothing |
| 2 | `h(10) = 22` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | What the marked page shows | Counts toward |
|---:|---|---|---|
| 1 | `h(10) = 15 + 12sin((π*(11))/(12))` | wrong here (This comes to $18.105829$, which is not the $h(10)$.) | nothing |
| 2 | `= 22` | no verdict (Follows from the earlier slip.) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: no verdict.

The engine named line(s) 2 as following from the earlier mistake, and gave them no tick. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `8575a4d493aa7c7367da17544e73cf82676b79029ce67e7f45a5185f0986e6a1`
