DRAFT for the author's review: not approved. Nothing in this file is switched on.

# Maximum or minimum of a sine or cosine model

Course: Year 12 Mathematics Advanced. Type id: `y12-trig-extreme`. Total: 3 marks.

## Question form

A model such as h(t) = 14 + 11 sin(pi t / 6) is given. The student finds its greatest or least value.

Generator families: `y12-trig-model`.

## Sample questions

1. The depth of water at a jetty, in metres, $t$ hours after midnight, is modelled by $h(t) = 22 + 16\sin\left(\dfrac{\pi t}{6}\right)$. What is the minimum value of $h$?
   Key: 6

2. The water level in a tidal creek, in metres, $t$ hours after the first high tide, is modelled by $h(t) = 9 + 4\cos\left(\dfrac{\pi t}{6}\right)$. What is the minimum value of $h$?
   Key: 5

3. The depth of water at a jetty, in metres, $t$ hours after midnight, is modelled by $h(t) = 14 + 11\sin\left(\dfrac{\pi t}{6}\right)$. What is the maximum value of $h$?
   Key: 25

## Criteria

| Criterion | Marks | How the engine decides it |
|---|---:|---|
| States the amplitude correctly. | 1 | a line "amplitude = ..." that the interpreter finds equal to the amplitude of the given function (decided by: interpreter) |
| States the midline (centre value) correctly. | 1 | a line "midline = ..." that the interpreter finds equal to the centre value of the given function (decided by: interpreter) |
| States the maximum or minimum value asked for, correctly. | 1 | a line "maximum = ..." or "minimum = ..." that the interpreter finds equal to that value of the given function (decided by: interpreter) |

Total: 3 marks. The marks per criterion are a first guess for the author to correct.

## What the engine can and cannot verify for this type

The engine is the marking code. The interpreter is the part that reads one line of working and checks it against the question. The answer checker is the code that marks a final answer.

It can verify:

- States the amplitude correctly. (interpreter).
- States the midline (centre value) correctly. (interpreter).
- States the maximum or minimum value asked for, correctly. (interpreter).

It cannot verify:

- It cannot check a long written reason ("the sine is at most 1, so...").
- It reads only the labels amplitude, midline, maximum and minimum, followed by a number.
- A model with a domain restriction on t is not read, because the greatest value on that stretch may not be the greatest value of the curve.

Rule used in every award below: a line earns a criterion only if the engine or interpreter finds it true. The first wrong line stops all further credit. The final-answer criterion looks at the last line only.

## Worked awards

These come from running the engine on built transcripts for the first sample question: The depth of water at a jetty, in metres, $t$ hours after midnight, is modelled by $h(t) = 22 + 16\sin\left(\dfrac{\pi t}{6}\right)$. What is the minimum value of $h$?

### Full marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `amplitude = 16` | true line | checked | amplitude |
| 2 | `midline = 22` | true line | checked | midline |
| 3 | `minimum = 6` | true line | checked | extreme |

Award: **3 of 3**. Criteria earned: amplitude (1), midline (1), extreme (1).

### Partial marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `amplitude = 16` | true line | checked | amplitude |
| 2 | `midline = 22` | true line | checked | midline |
| 3 | `minimum = 38` | wrong here (This comes to 38, which is not the minimum.) | wrong here | nothing |

Award: **2 of 3**. Criteria earned: amplitude (1), midline (1).

### Zero marks

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `amplitude = 17` | wrong here (This comes to 17, which is not the amplitude.) | wrong here | nothing |
| 2 | `midline = 23` | no verdict (Follows from the earlier slip.) | follows from the earlier mistake | nothing |
| 3 | `minimum = 38` | no verdict (Follows from the earlier slip.) | follows from the earlier mistake | nothing |

Award: **0 of 3**. Criteria earned: none.

## Error carried forward

Transcript with an earlier slip, on the same question:

| # | What the student wrote | Engine says | Interpreter says | Counts toward |
|---:|---|---|---|---|
| 1 | `amplitude = 17` | wrong here (This comes to 17, which is not the amplitude.) | wrong here | nothing |
| 2 | `midline = 22` | no verdict (Follows from the earlier slip.) | checked | nothing |
| 3 | `minimum = 5` | no verdict (Follows from the earlier slip.) | follows from the earlier mistake | nothing |

Award: **0 of 3**. Criteria earned: none.

What the engine actually did: the first wrong line was line 1. After it, line 2: engine no verdict, interpreter checked; line 3: engine no verdict, interpreter follows from the earlier mistake.

The engine named line(s) 2, 3 as following from the earlier mistake, and gave them no tick. Line(s) 2 were found true on their own, but they come after the first wrong line, so this draft does not count them. The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.

## Review record

To be filled in by the author (the tutor). Leave blank until reviewed.

- Decision (approved by the author / changes needed): 
- Note: 
- Name: 
- Date: 
- Scheme digest: `6e34ad8532c9f09b60ec7fc0e444805b220b8806dde224404f911ec23ca5d96d`
