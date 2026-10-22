# Marking a page of chained equalities: first error, error carried forward

Issue #430. The Class 10 arithmetic-progression questions (nth term, sum, the
savings word problem) carry a step-check plan the server marks with. This note
is for whoever authors the next such plan or reviews a change to the marker.
The code is `client/src/engine/reason-chain.js` (primitives),
`client/src/engine/checker.js` (`stepCheckPlan` with `chain: true`,
`methodMarks`), and the generators in
`client/src/engine/generators/india-class10-base.js`. The server runs exactly
this engine (`server/platform/markerOps.js`); no model output sets a mark.

## What the page looks like

    a = 9, d = 3                 the givens, copied from the question
    T_n = a + (n - 1)d           the formula, under its own label
    T_9 = 9 + 8 × 3              the substitution, with the numbers in it
        = 9 + 24                 a continuation of the line above
        = 35                     false: 9 + 24 is 33

The same page is read however it is laid out:

- **Givens as prose.** `a = 9 and d = 3`, `a = 9 d = 3` (a comma lost),
  `a = 9. d = 3.`, `Given: a = 289; d = 28; n = 13`, `Here, a = …`,
  `First term a = 289, common difference d = 28` — all copied givens. A derived
  letter beside them (`a = 20, d = 3, n = 18, l = 71`) is read too; a wrong one
  is the first break (`value-slip`) and is carried forward.
- **A formula with its arithmetic on one line.** `T_n = a + (n - 1)d = 9 + 8 × 3 = 35`
  is judged on every segment: the formula against the authored forms, and each
  number after it against what stands before it. The false segment is the break,
  so "every line verified" is never said over it. A line that holds a false
  equality earns nothing, even when an earlier segment on it states the formula
  — write the formula on its own line to have it credited. A line that is all
  true is credited to one stage (the formula stage when it is open): one stage
  per line.
- **Either half of the sum first.** `n/2 (…)`, `n(…)/2`, `(…) × n/2` are one shape
  (`reason-chain.js shapeKey`: a product and its divisions are multisets), so the
  substitution is shown whichever way the /2 is written.
- **Not read as arithmetic, never a mistake.** The terms listed (`9, 12, 15, …`)
  are several values, not the number 91215 (a comma that groups digits —
  `5,941`, `1,00,000` — is still one number). A word is not letters multiplied
  together (`9 and d` is not 9·a·n·d). A number and a letter set apart with no
  label to anchor the line (`a + d = 5 d`) may be a lost comma. Each of these is
  a `note`.

## The plan (`stepcheck`)

```js
{
  kind: 'plan', chain: true, anyOrder: true, creditPerStage: true, ecf: 'method',
  givens: { a, d, n },                 // what the question states; a line `a = 10` is a copying slip
  givensWhy: { n: '…so n = 9.' },      // optional: the diagnosis for a given copied wrongly
  derived: { l: a + (n - 1) * d },     // values the page may use that the question does not state
  derivedWhy: { l: '…' },              // optional: the diagnosis for a derived letter written wrongly
  aliases: { l: ['a_n', 't_n', …] },   // other spellings of a letter
  stages: [
    { kind: 'identify', letters: ['a', 'd', 'n'] },                       // completed by the givens being written
    { kind: 'formula', labels: ['S_n', 'S'], forms: [{ expr, letters }],
      why,                             // told when the formula is wrong
      traps: [{ expr: 'n*(a+l)', why }] },  // a recognisable wrong formula, told what went wrong in it
    { kind: 'evaluation', source, sources, substitutions, expected, labels,
      indexLabels: { letter: 'n', stems: ['S_'] },  // `S_17` is this stage's label when n was copied as 17
      evidence: 'substitution',        // proved only by a line that shows the numbers put in
      yields: ['l'],                   // the letter this stage's value stands for, carried if slipped
      ecf: { source: 'n/2*(a+l)', bind: ['l'] },   // the form to re-judge under a carried letter
      traps: [{ source: 'a + n*d', why }],          // recognisable misapplications, named when reached
      supporting: true }               // earns only beside a verified primary stage
  ]
}
```

Nothing is inferred from difficulty: every value is the generator's own.

## What the report says about each line

| field | meaning |
| --- | --- |
| `status: 'ok'` | true — of the question, or (with `ecf: true`) of the student's own earlier slip |
| `status: 'break'` | false of the question and of the slip; the first one is `firstBreak`, a later one carries `independent: true` |
| `status: 'note'` | not judged: prose, a bare value, a letter the plan does not know, a line under an unverified prerequisite |
| `given: true` | a line of copied givens (right or wrong) |
| `stage: i` | the line proves stage `i`; absent on a true line that proves nothing |
| `diagnosis` | `arithmetic-slip` (names the operation and the right value), `given-misread`, `value-slip` (a derived letter beside the givens), `formula-error`, `formula-misapplied` |

Error carried forward, in order of what is carried:

- a given copied wrongly (`a = 10`) — later substitutions are judged with 10; a
  misread n also gives the student's own labels (`T_8`, `S_17`, from `indexLabels`),
  so the substitution under them is carried forward rather than passed over;
- a stage's value slipped (`a_18 = 72`), on its own line, on its formula line
  (`l = a + (n - 1)d = 20 + 17 × 3 = 72`) or on a continuation below either —
  `yields` letters take the student's value (a formula stage yields what the
  evaluation stage substituting into it yields);
- a formula written wrongly (`T_n = a + nd`) — the substitution below it, and any
  continuation of the formula line, is true of that formula, carried forward and
  **never a method step**.

A line that is right in that world is `ok, ecf: true`, blamed once — including a
continuation (`= 9 + 9 × 3`) of the wrong formula's own line. A line that is
false in both worlds is a second, independent error.

## What is never judged

A line Pri may have misread is a `note` — never a tick, never the mistake,
never a mark: a part with no value (`35/0`, `sqrt(-4)`); two statements run
together (`T_n = a + (n-1)d  n = 9`, `… = 33 d = 3`); a word beside the working
(`= 33 an`, `expand`); a comma inside brackets (`18/2 (20, 71)`); a hedged given
(`a = 289 or 300`). A given with its unit (`₹289`, `13 months`) is still a given.

## What earns (`methodMarks`)

- A line earns only as the proof of a stage, each stage once (`creditPerStage`).
  A given restated, arithmetic beside the method, a bare value, prose, a copied
  question, neutral algebra in the givens: verified where true, earning nothing.
- A substitution stage with `evidence: 'substitution'` is proved only by a line
  that shows the authored expression with the numbers in it, partly evaluated as
  the student liked (`9 + (9-1)×3`, `9 + 8×3`, `9 + 24`) — never the bare value,
  never another computation that reaches it (`9 × 3 + 6`).
- A carried line (`ecf`) earns its stage only when the rubric says `ecf: 'method'`.
  A substitution into a wrong formula never earns.
- The consequence of `ecf: 'method'`, stated plainly: a substitution that is right
  for the student's own values earns its stage, however wrong those values are.
  Givens copied wholly wrongly (`a = 21, d = 4, n = 17`) and then put correctly
  into the right formula still earn the substitution stage — bounded by the cap,
  and never the answer mark. So a misread given costs one mark where the method
  is otherwise right: on D2 (two marks) a misread `n = 17` summed as
  `S_17 = 17/2 (40 + 48)` earns 1 of 2; on D4 (three marks) a misread `d` earns 2
  of 3; on D1 (one mark) it costs the only mark.
- A `supporting` stage (the last term on a sum question, D2 and D4) earns only when
  a primary stage of the method — a formula or its substitution — is verified on
  the page; recognising the givens (`identify`) is not that method. Alone the last
  term answers a different question. Its value, right or slipped, is the `l` the
  sum carries: a last term slipped beside the givens, on its formula line or on a
  continuation below it is carried into the sum once, on D2 and D4 alike.
- Method marks are capped one below the question's marks, so a wrong final answer
  never earns the answer mark; a one-mark question pays no method mark. A right
  final answer earns full marks under the existing final-answer policy.

## What the student sees

- "look here" marks the first mistake only; a later independent error is "also
  wrong"; a carried line keeps its tick and is labelled "carried forward".
- "Every line of your working was checked" is said only when the server's step
  report is of exactly the lines on screen and every one is `ok` and none carried
  (`client/src/components/workingEvidence.js`, #448).
- In Photo mode the verdicts are pinned to the transcript lines they judged, only
  when the report's text is exactly the lines submitted (#475).

## Tests

- `client/test/marker-ap-first-error-check.mjs` — the adversarial corpus on D1, D2,
  D4 and a seed sweep (`npm run test:marker:ap`).
- `server/test/ap-term-firstbreak-regression-check.mjs` — 120 seeds, both signs of `d`.
- `server/test/owner-ap-first-mistake-contract-check.mjs` — the owner's page over
  HTTP against the shipped app (SQLite or `--engine=postgres`).
- `client/test/working-evidence-check.mjs` — the presentation rules.

## Formula rubrics beyond AP (`workingRubrics.js`)

`client/src/engine/generators/workingRubrics.js` builds the same plan for any
"formula, substitute, evaluate" question from a list of parts:
`formulaPlan({ givens, aliases, parts: [{ letter, labels, forms, source, expected, why, traps }], combine })`.
A part that uses an earlier part's letter binds it, so a value slipped above and
used correctly below is carried forward. Plan letters are single characters; a
letter written as a symbol (θ) is an alias (`ANGLE_ALIASES`). A one-letter label
must not fold onto a different given (`A` is read as `a`): the corpus checks it.

Families carrying one (tranche 1): sector area, sector perimeter (arc + 2r),
quarter-circle segment (sector − triangle), square less four quarter-circles,
cylinder + hemisphere, and the minute-hand sector (θ = 6m, then the sector).

### The adversarial corpus (`npm run test:marker:rubrics`)

`client/test/marker-working-rubrics-check.mjs` writes, for every plan-carrying
question of the listed families (12 seeds × 4 levels), the model page and a set
of attacks, all marked through `markerOps.stepEvidence`:
each value line falsified three ways is the first break and never verified;
each given substituted wrongly is never a plain verified line; every authored
wrong formula is a break and earns nothing; a wrong final answer is never
correct and earns at most marks − 1; a bare answer, the copied question, prose,
givens alone (beyond a word problem's identify mark), repetition and a sweep of
candidates earn nothing; a part's value slipped and carried is the one first
break, everything built on it is `ecf`, and the method around it still earns.
A new rubric family is added to `RUBRIC_FAMILIES` there.

### Coverage, honestly

`node scripts/working-rubric-census.mjs` lists every subtopic issuing multi-mark
numeric questions and how many carry a plan. Most still have none (they are
marked on the final answer, with the equation step check where one applies).
Forms that need multi-character letters (`x_1`, `Σfx`) — distance, section,
grouped mean/median/mode — need a letter-alias extension before they can carry
a plan; they are not covered here.
