DRAFT for the author's review: not approved. Nothing in this file is switched on.

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
| Substitutes the value of t into the model correctly. | 1 | a line that starts with the function written at the given value (for example y(2) = ...) with a right side that is not just a number, which the interpreter finds true (decided by: interpreter) |
| States the value correctly. | 1 | the last line, read as the final answer, is checked by the answer checker (the same check that marks a one-line answer) (decided by: answer checker) |

Total: 2 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The engine is the marking code. The interpreter is the part that reads one line of working and checks it against the question. The answer checker is the code that marks a final answer.

It can verify:

- Substitutes the value of t into the model correctly. (interpreter).
- States the value correctly. (answer checker).

It cannot verify:

- It cannot judge a trigonometric value of a plain number without pi, because the angle might be in degrees or radians. Such a line is left unverified.
- The question may supply the exact trig value to use. The engine does not check that the student used it.

Rule used in every award below: a line earns a criterion only if the engine or interpreter finds it true. The first wrong line stops all further credit. The final-answer criterion looks at the last line only.

## Worked awards

These come from running the engine on built transcripts for the first sample question: The depth of water at a jetty, in metres, $t$ hours after midnight, is modelled by $h(t) = 15 + 12\sin\left(\dfrac{\pi t}{12}\right)$. Find $h(10)$. (Use $\sin\dfrac{\pi}{6} = \sin\dfrac{5\pi}{6} = \dfrac12$.)

### Full marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `h(10) = 15 + 12sin((π*(10))/(12))` | true line | checked | substitute |
| 2 | `h(10) = 21` | true line | checked | answer |

Award: **2 of 2**. Criteria earned: substitute (1), answer (1).
Final answer check: correct.

### Partial marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `h(10) = 15 + 12sin((π*(10))/(12))` | true line | checked | substitute |
| 2 | `h(10) = 22` | wrong here (This comes to 22, which is not the h(10).) | wrong here | nothing |

Award: **1 of 2**. Criteria earned: substitute (1).
Final answer check: not correct.

### Zero marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `h(10) = 15 + 12sin((π*(11))/(12))` | wrong here (This comes to 18.105829, which is not the h(10).) | wrong here | nothing |
| 2 | `h(10) = 22` | no verdict (Follows from the earlier slip.) | follows from the earlier mistake | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `h(10) = 15 + 12sin((π*(11))/(12))` | wrong here (This comes to 18.105829, which is not the h(10).) | wrong here | nothing |
| 2 | `= 22` | no verdict (Follows from the earlier slip.) | could not verify (does not match the line above; it may continue an earlier step) | nothing |

Award: **0 of 2**. Criteria earned: none.
Final answer check: not correct.

What the engine actually did: the first wrong line was line 1. After it, line 2: engine no verdict, interpreter could not verify.

The engine named line(s) 2 as following from the earlier mistake, and gave them no tick. No later line was found true. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `c23cfa56a7b5dacd7bf40237d288a64a48e3e1df428d5fb40a9255f3c2474e2e`
