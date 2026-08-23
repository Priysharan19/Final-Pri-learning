# Pri Learning Handwriting Production Standard

Status: **release policy**. This is the bar for calling Pri Learning handwriting production-ready; it is not a marketing claim about the current model.

## Product contract

Pri Learning does not recognise isolated characters for their own sake. It must recover the student's **mathematical structure** from Apple Pencil ink and must never confidently mark a different expression from the one the student wrote.

The production pipeline therefore owns all of these layers together:

1. Pencil stroke capture and preservation.
2. Written-line segmentation.
3. 2-D relationships: powers, fractions, radicals and grouped working.
4. Symbol hypotheses from independent visual / stroke evidence.
5. Maths-aware decoding and candidate fusion.
6. Calibrated uncertainty and fail-closed marking.
7. Writer-disjoint real-Pencil evaluation.

A high character score cannot compensate for a structural error. `x^3` becoming `x3`, a numerator becoming another line, or `=` becoming `-` is a release-blocking defect.

## Non-negotiable safety invariants

- A superscript or degree-sized mark that is geometrically carried by a body glyph stays on that written line.
- A genuine second line stays separate.
- Fractions, radicals, powers and relation operators survive as structure, not flattened text.
- No submitted stroke may disappear silently.
- A correction made by the student outranks model and grammar priors.
- Question context may break a genuine near-tie but may never pull a wrong answer toward the expected answer.
- Ambiguous recognition is **not auto-marked**. The product asks for confirmation rather than inventing certainty.
- Training, validation, test and final-holdout writers are disjoint.

## Release gates

### Gate A — deterministic native pipeline

Required on the canonical iPad package for every relevant pull request:

- native Swift build succeeds;
- PencilKit ↔ JavaScript bridge round trip succeeds;
- native deterministic expression benchmark: **100% exact expressions**;
- native deterministic character accuracy: **>= 99.5%**;
- structural regression suite passes, including detached superscript attachment while preserving a real second line.

This gate is a regression test, not evidence of real-writer accuracy.

### Gate B — locked synthetic generalisation

The untouched synthetic writer holdout remains a mandatory regression floor. Existing evidence floors must never be lowered to make a release green. Floors may only move upward after an independently measured gain.

For a production-quality target, Pri Learning should converge on:

- exact expression accuracy: **>= 99.0%**;
- character accuracy: **>= 99.5%**;
- worst-writer exact accuracy: **>= 90%**.

Until those targets are reached, the measured lower regression floor remains visible and cannot be described as the target standard.

### Gate C — real Apple Pencil evidence

A handwriting release cannot be labelled production-ready from synthetic data alone.

Minimum evidence set:

- **>= 20 writer-disjoint people** in the test split;
- **>= 1,000 scored expressions** total in the real-Pencil test split;
- at least two supported iPad hardware classes where practical;
- a deliberate mix of neat, ordinary, fast and messy writing;
- curriculum-representative Year 7–12 algebra, arithmetic, functions, powers, fractions, roots and multi-line working;
- no writer, session or derived sample crossing train / validation / test boundaries.

Required real-Pencil target metrics:

- exact expression accuracy: **>= 98.0%**;
- character accuracy: **>= 99.5%**;
- worst-writer exact accuracy: **>= 90%**;
- critical-structure exactness (powers / fractions / radicals / relations): **>= 99.5%**;
- auto-mark precision among readings the system declares safe: **>= 99.9%**.

If the engine cannot meet auto-mark precision at full coverage, coverage must fall before precision does: uncertain work is confirmed by the student instead of being silently marked from a guess.

### Gate D — latency and interaction

Measured on supported iPad hardware, with a representative page already containing working:

- ink rendering remains interactive while the Pencil is down;
- recognition never blocks Pencil input;
- stable single-line reading target: **p95 <= 500 ms** after the recognition debounce / pen-up point;
- cancellation of obsolete recognition prevents stale results replacing newer ink.

Latency targets do not permit accuracy or safety gates to be weakened.

## Failure taxonomy that must be reported

Every failed real-Pencil case is assigned at least one primary cause:

- line segmentation;
- glyph segmentation / alignment;
- symbol classification;
- x vs multiplication;
- operator / relation;
- superscript / subscript;
- fraction / radical layout;
- function-name decoding;
- multi-line ordering;
- confidence calibration / unsafe auto-mark;
- unsupported notation.

Headline accuracy without this breakdown is insufficient for release review.

## Source-of-truth rule

`ios/PriLearning.swiftpm` is the canonical native iPad package. `ios/PriLearning 2.swiftpm` is retained only because existing iPad / Swift Playgrounds workflows may still point at it. While both exist, their Swift source must be byte-for-byte equivalent and CI must reject drift. No recognition improvement may ship to one package without the other.

## Current evidence boundary

The repository currently contains synthetic gates and a real-ink evaluator, but the committed real-ink corpus contains no scored writer sessions. Therefore **no real-handwriting accuracy percentage is currently evidenced by the repository**. The correct engineering response is to improve the engine, collect writer-disjoint Apple Pencil data, and let Gate C decide readiness — not to infer a production percentage from synthetic tests.
