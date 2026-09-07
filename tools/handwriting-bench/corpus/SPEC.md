# The marking corpus — capture and double-marking protocol

This is the part of the study that code cannot do. Everything else in
`tools/handwriting-bench/` is finished and will score every candidate the moment
this corpus exists.

## Why a second corpus

`client/test/ink-corpus` is a **recognition** corpus: strokes plus the
expression the writer was asked to copy. It can tell you whether a reader read
the ink. It cannot tell you whether a student was marked correctly, because it
has no question, no mark scheme and no human marks.

The architecture decision rests on marking, not on reading. So it rests on this
corpus.

## What already exists and should be reused

`handwriting/v12/PHYSICAL_STUDY_PLAN.json` already defines 48 anonymous writers
across four splits, two iPad hardware classes, and a versioned consent record.
`client/src/ink/productionEvidence.js` already assigns each writer a split by a
deterministic hash of their code. **Use both.** A writer must land in the same
split in both corpora, or test writers leak into training and both studies are
void. The validator enforces this and will reject a hand-picked split.

## Targets

| | Target | Why this number |
|---|---|---|
| Writers | ≥ 30 | The existing release gate needs 20 writer-disjoint evaluation writers; 30 leaves headroom after dropouts |
| Solutions | ≥ 300 | 10 per writer, enough that a 2-point difference in false-wrong rate is outside noise |
| Double-marked | all 300 | An architecture claim against single-marked ground truth is a claim against one person's opinion |
| Stroke items | ≥ 60 | Architecture D cannot be scored without raw Pencil strokes |
| Photo items | ≥ 60 | Architecture A's real use case is a photographed notebook page |

## Content the brief requires

Spread across the 300, not concentrated:

- **Level**: Class 11, Class 12, JEE Main, JEE Advanced-style.
- **Topics**: calculus, coordinate geometry, matrices, radicals, fractions.
- **Handwriting**: good and messy, in roughly equal share. Do not quietly drop
  the messy ones — they are where the architectures separate.
- **Page reality**: crossed-out working, multiple lines, diagrams, alternative
  methods, and solutions that are wrong in the ordinary ways students are wrong.
- **Capture**: both Apple Pencil strokes (via `npm run ink:collect`) and
  photographed notebook pages.

## Marking protocol

1. Two markers, working **independently**, neither seeing the other's marks.
2. Each records: total awarded, per-criterion earned/not, and the 1-indexed line
   where the working first goes wrong (`firstBreak`), or null.
3. Each flags `errorCarriedForward` when the solution is one-slip-then-correct,
   and `alternativeMethod` when the student's route is valid but not the one in
   the mark scheme. These two flags carry the metrics the brief cares most
   about; an item without them still counts, but contributes nothing to those
   two rows of the report.
4. Where the two disagree, a third person **adjudicates**. Record the
   adjudication in `adjudicated`. Never average two markers into a half-mark
   nobody awarded — the validator rejects an unadjudicated disagreement.

The runner prints inter-marker agreement before it prints any candidate. That
number is the ceiling. A candidate inside the band where two humans disagree
with each other is not measurably worse than a human marker, and the report
should not pretend otherwise.

## One constraint that shapes the corpus

Architecture B (Mathpix → Pri's symbolic engine) scores through
`stepCheck(meta, working)`, which needs Pri's **question `meta` object**, not
just prompt text. A question that exists only as a scan of a JEE paper can be
marked by Architecture A and by the humans, but not by Architecture B.

So: **at least 150 of the 300 should be existing Pri questions** carrying
`meta`. Otherwise Architecture B is scored on a subset, and a subset chosen by
what happened to be authored is not a fair comparison. The runner reports
`markableByPriEngine` separately for exactly this reason.

## Item shape

```json
{
  "format": "pri-marking-corpus",
  "version": 1,
  "items": [
    {
      "itemId": "c12-calc-014",
      "writerId": "P0031",
      "source": "strokes",
      "strokes": [{ "points": [{ "x": 0, "y": 0, "t": 0, "p": 0.4 }] }],
      "level": "class-12",
      "topic": "integration-by-substitution",
      "prompt": "Evaluate ∫10x(x²+1)² dx",
      "marks": 4,
      "meta": { "…": "the Pri question object, when the question is a Pri question" },
      "expectedAnswer": "(5(x^(2)+1)^(3))/(3)+c",
      "workedSolution": "let u=x^(2)+1 …",
      "markScheme": [
        { "criterion": "correct substitution stated", "marks": 1, "line": 1 },
        { "criterion": "du computed correctly", "marks": 1, "line": 2 }
      ],
      "errorCarriedForward": true,
      "alternativeMethod": false,
      "markerA": { "markerId": "M-anita", "awarded": 3, "firstBreak": 3, "criteria": [{ "line": 1, "earned": true }] },
      "markerB": { "markerId": "M-ravi", "awarded": 3, "firstBreak": 3 },
      "adjudicated": null
    }
  ]
}
```

Files go in `tools/handwriting-bench/corpus/items/`, one per collection session.

## Privacy

Same rules as the ink corpus, and they are not optional here because these pages
carry a student's actual work rather than a copied expression: anonymous writer
codes only. No names, emails, school identifiers, or other people's work in the
frame of a photographed page. Marker ids are pseudonyms.

Every adapter sends `improve_mathpix: false` and `store: false`, so no benchmark
image is retained for vendor QA. Confirm that is still true before a live run —
it is one line per adapter and it is the difference between a study and a
disclosure.
