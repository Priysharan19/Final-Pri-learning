# Ink Collector V2

A standalone iPad capture tool for building the **real, writer-separated PRI mathematical-ink corpus**.

## Why V2 exists

Synthetic ink is useful for deterministic regressions, but it cannot establish real-world Apple Pencil accuracy. The older collector also generated a new random `writer` id for every recording session. If the same student recorded twice, those sessions could therefore look like two different writers and leak across train/test partitions.

V2 separates **participant identity** from **session identity** and locks every participant to one deterministic split for life.

## Recording a session

1. Open `tools/ink-collect/index.html` on the iPad in Safari.
2. Enter a stable anonymous participant code such as `P0142`. Reuse the **same code for the same person on every future session**. Do not use names, email addresses or student numbers.
3. Optionally record handedness.
4. Write each prompt naturally with Apple Pencil. Do not become artificially neat for the recognizer.
5. Save the resulting `pri-real-ink-<participant>-<session>.json` file.
6. Put approved corpus files in the project’s protected real-ink corpus location and run the corpus audit/scorer before using them for evidence or training.

## Split locking

The participant code is deterministically mapped to exactly one split:

- `train`: 70%
- `calibration`: 15%
- `test`: 10%
- `final_holdout`: 5%

A new session gets a new session id, **not a new participant id**. Every session by one participant therefore remains in the same partition.

Never manually move a writer to another split to improve a metric. The `final_holdout` set must remain unopened for tuning.

## What V2 captures

Each real Pointer Event/coalesced hardware sample can preserve:

- x/y position
- timestamp relative to stroke start
- pressure
- azimuth/altitude when the browser exposes them
- tiltX/tiltY when the browser exposes them
- exact stroke order and stroke boundaries
- canvas dimensions and device-pixel ratio
- whether the sample was recorded with Pencil

The collector calls `getCoalescedEvents()` when supported. It **never calls a predicted-event API and never stores predicted touches**. The corpus records `predictedSamplesIncluded: false` explicitly.

The native iOS runtime can capture richer UIKit/PencilKit telemetry than Safari exposes. A browser-captured corpus and a native-captured corpus should therefore remain distinguishable by their provenance instead of pretending they are identical sources.

## V2 schema

```json
{
  "format": "pri-ink-corpus",
  "version": 2,
  "participant": {
    "id": "P0142",
    "split": "test",
    "handedness": "left"
  },
  "session": {
    "id": "s...",
    "device": "...",
    "pen": true,
    "recordedAt": 1787280000000,
    "durationMs": 123456,
    "collector": "web-pointer-coalesced-v2",
    "predictedSamplesIncluded": false
  },
  "samples": [
    {
      "target": "2x+5=17",
      "shown": "2x + 5 = 17",
      "pen": true,
      "canvas": { "width": 900, "height": 420, "dpr": 2 },
      "strokeOrderPreserved": true,
      "predictedSamplesIncluded": false,
      "strokes": [
        { "points": [{ "x": 12, "y": 40, "t": 0, "p": 0.42, "az": 1.2, "alt": 0.9 }] }
      ]
    }
  ]
}
```

Optional sensor keys can be absent. Missing telemetry means **unknown**, not zero.

## What the prompts cover

The 60-prompt set exercises digits, supported variables, π/θ, decimals, negatives, slash and stacked fractions, powers, radicals, comparison operators, percent, degrees, ratios, ±, brackets, multiplication and trig/log names.

This prompt set is a coverage seed, not the final production corpus. Production evidence needs much broader free-form working, corrections, nested structures and adversarial confusion families.

## Evidence standard

Do not publish a headline real-handwriting number from one or two people. At minimum report:

- number of unique participants and sessions
- exact-expression accuracy
- symbol/character accuracy
- worst-writer and lower-decile writer accuracy
- structure accuracy for powers/fractions/radicals/brackets
- accepted-result precision and coverage under the no-guess policy
- clarification rate
- results split by collector provenance and device class where sample size permits

The final-holdout result must be evaluated only after model selection and calibration are frozen.

## Do not tune against the test/final-holdout corpus

The moment a failure is inspected and used to change the recognizer, that example is development evidence rather than untouched release evidence. Fix against train/calibration data, then leave test and especially final-holdout sealed for honest evaluation.
