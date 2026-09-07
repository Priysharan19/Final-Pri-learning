# Handwriting architecture benchmark

Measures four architectures for reading and marking handwritten maths against
one corpus, one contract, one rasteriser and one normaliser — so a difference in
the numbers is a difference in the architecture rather than in the harness.

**It changes nothing in production.** Nothing under `client/src` or
`server/platform` is modified by this directory; it imports from them.

## The architectures

| | Architecture | Path |
|---|---|---|
| A | Direct multimodal marking | page + question + mark scheme → model → criterion evidence → Pri's marks |
| B | Mathpix recognition pipeline | ink → Mathpix → LaTeX → linear → Pri's symbolic marker |
| C | Hybrid | Mathpix **and** a multimodal model read independently → Pri arbitrates → disagreement escalates instead of marking |
| D | Digital ink | Apple Pencil strokes → Mathpix `v3/strokes` → live reading |

## Run it

```bash
node tools/handwriting-bench/run.mjs
```

Dry run by default: it calls nothing, spends nothing, prints the projected bill,
and runs the free offline reference. `--live` is required for a paid call,
`--limit N` caps the sample count, `--all` uses the whole split.

```bash
node tools/handwriting-bench/run.mjs --live --limit 20 --split test
```

Keys come from the environment and are never written to disk by this harness:

```
PRI_BENCH_MATHPIX_APP_ID     PRI_BENCH_MATHPIX_APP_KEY
PRI_BENCH_OPENAI_API_KEY     PRI_BENCH_GEMINI_API_KEY
PRI_BENCH_ANTHROPIC_API_KEY  (only with --with-anthropic)
```

Put them in `.env`, which is already gitignored. They are deliberately **not**
the production variable names: a benchmark must never be able to spend the
production budget or be mistaken for it in a shell.

## What holds the comparison honest

- **One picture.** Every image candidate is scored on the same PNG, produced by
  production's own `rasterizeInk` with a Node canvas injected. Nothing here
  redraws ink.
- **One prompt.** All three multimodal providers get the byte-identical
  `SYSTEM_INSTRUCTIONS` and `TRANSCRIPTION_SCHEMA` imported from
  `server/platform/handwritingProvider.js`. A provider cannot win on prompt
  engineering.
- **One normaliser.** `normalizeMath` is character-identical to the release
  gate's, so numbers here are comparable to the 98% / 99.5% floors already in
  `handwriting/v12/PRODUCTION_STANDARD.md`.
- **Real arbitration.** Architecture C uses Pri's production
  `chooseNativeConsensus`, not a comparator written for the benchmark.
- **Visible translation loss.** Mathpix returns LaTeX; `latex.mjs` converts it
  to Pri's linear dialect and reports every command it could not convert, so a
  Mathpix miss can be attributed to the recogniser or to the translator.
  It currently converts 17/17 of the constructs in `REAL_PENCIL_PROMPTS`.
- **Unknown costs stay unknown.** A provider that returns no usage is counted as
  unknown, never estimated as free.
- **No manufactured data.** With no corpus the runner reports NOT MEASURED and
  says what is missing.

## What is measured

**Recognition** — exact expression, character accuracy, worst-writer, per
structure (fractions, superscripts, subscripts, radicals, integrals, matrices,
trig, relations, multi-line), confidence calibration (ECE), p50/p95 latency,
cost per read, failure rate.

**Marking** — false-wrong rate first, then false-correct, exact mark agreement,
within-one-mark, per-criterion agreement, error localisation, error-carried-
forward handling, alternative-method acceptance, calibration, latency, cost.

The ordering is the brief's: *optimise for correct marking, not OCR accuracy.*
A candidate that reads 99% of characters and produces more false-wrongs than the
incumbent has lost.

The runner prints **inter-marker agreement** before any candidate. That is the
ceiling; a candidate inside the band where two humans disagree with each other
is not measurably worse than a human.

## Current state

The harness is complete and runs. The corpus is not.

- Recognition corpus: **1 writer**, 50 expressions — and that writer's file
  records a macOS Safari user agent, so it is not Apple Pencil evidence either.
- Marking corpus: **absent**. See `corpus/SPEC.md` for the protocol.

Measured baseline for the incumbent on those 50 real samples: **64.0% exact
expression, 87.0% characters, p95 853 ms**, weakest on subscripts (0%, n=1),
trig (0%, n=4) and fractions (33%, n=6). Against the synthetic holdout's 96.8%
exact, that gap is the strongest available evidence that the corpus — not the
vendor — is the current bottleneck.

Do not quote any of this as an architecture result. One writer is a baseline.
