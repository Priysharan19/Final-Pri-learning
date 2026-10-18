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

## The plan (`stepcheck`)

```js
{
  kind: 'plan', chain: true, anyOrder: true, creditPerStage: true, ecf: 'method',
  givens: { a, d, n },                 // what the question states; a line `a = 10` is a copying slip
  givensWhy: { n: '…so n = 9.' },      // optional: the diagnosis for a given copied wrongly
  derived: { l: a + (n - 1) * d },     // values the page may use that the question does not state
  aliases: { l: ['a_n', 't_n', …] },   // other spellings of a letter
  stages: [
    { kind: 'identify', letters: ['a', 'd', 'n'] },                       // completed by the givens being written
    { kind: 'formula', labels: ['S_n', 'S'], forms: [{ expr, letters }], why },
    { kind: 'evaluation', source, sources, substitutions, expected, labels,
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
| `diagnosis` | `arithmetic-slip` (names the operation and the right value), `given-misread`, `formula-error`, `formula-misapplied` |

Error carried forward, in order of what is carried:

- a given copied wrongly (`a = 10`) — later substitutions are judged with 10;
- a stage's value slipped (`a_18 = 72`) — `yields` letters take the student's value;
- a formula written wrongly (`T_n = a + nd`) — the substitution below it is true of
  that formula, carried forward and **never a method step**.

A line that is right in that world is `ok, ecf: true`, blamed once. A line that is
false in both worlds is a second, independent error.

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
- A `supporting` stage (the last term on a sum question) earns only when a primary
  stage is verified on the page; alone it answers a different question.
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
