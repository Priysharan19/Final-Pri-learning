# Pri Learning Handwriting Production Standard

Status: **release policy**. This is the bar for calling Pri Learning handwriting production-ready; it is not a marketing claim about the current model.

## Product contract

Pri Learning must recover the student's **mathematical structure** from Apple Pencil ink and must never confidently mark a different expression from the one the student wrote. The handwriting system therefore owns capture, line segmentation, 2-D relationships, symbol hypotheses, maths-aware decoding, calibrated uncertainty, and writer-disjoint real-Pencil evaluation together.

A high character score cannot compensate for a structural error. `x^3` becoming `x3`, a numerator becoming another line, or `=` becoming `-` is release-blocking.

## Non-negotiable safety invariants

- A superscript or degree-sized mark geometrically carried by a body glyph stays on that written line.
- A genuine second line stays separate.
- Fractions, radicals, powers and relation operators survive as structure.
- No submitted stroke may disappear silently.
- Student corrections outrank model and grammar priors.
- Question context may break a genuine near-tie but may never pull wrong work toward the expected answer.
- Ambiguous recognition is not auto-marked; the product asks for confirmation.
- Training, validation, test and final-holdout writers are disjoint.

## Gate A — deterministic native pipeline

Required for every relevant release:

- native Swift build succeeds;
- canonical and legacy SwiftPM packages are source-identical;
- PencilKit ↔ JavaScript bridge succeeds;
- deterministic native expression benchmark: **100% exact expressions**;
- deterministic native character accuracy: **>= 99.5%**;
- detached-superscript/real-second-line structural regression passes.

This is a regression gate, not real-writer evidence.

## Gate B — locked synthetic generalisation

Production target:

- exact expression accuracy **>= 99.0%**;
- character accuracy **>= 99.5%**;
- worst-writer exact accuracy **>= 90%**.

Existing regression floors may not be lowered to make a release pass.

## Gate C — real Apple Pencil evidence

A release cannot be labelled production-ready from synthetic data alone.

Minimum evidence:

- **>= 20 writer-disjoint people** in the test split;
- **>= 1,000 scored expressions** in the real-Pencil test split;
- multiple supported iPad hardware classes where practical;
- neat, ordinary, fast and messy hands;
- curriculum-representative arithmetic, algebra, functions, powers, fractions, roots and multi-line working;
- zero writer/session/derived-sample leakage across splits.

Required targets:

- exact expression accuracy **>= 98.0%**;
- character accuracy **>= 99.5%**;
- worst-writer exact accuracy **>= 90%**;
- critical-structure exactness (powers/fractions/radicals/relations) **>= 99.5%**;
- auto-mark precision among readings declared safe **>= 99.9%**.

Coverage must fall before precision: uncertain work is confirmed by the student rather than silently marked from a guess.

## Gate D — latency and interaction

On supported iPad hardware:

- ink rendering remains interactive while Pencil is down;
- recognition never blocks Pencil input;
- stable single-line recognition p95 **<= 500 ms** after debounce/pen-up;
- stale recognition is cancellable and cannot replace newer ink.

## CI enforcement

Changes under `handwriting/v12/` intentionally trigger both the native-iPad gate and the Ink Foundation model-tooling gate. A release-standard change therefore exercises the Swift package/build/bridge/native benchmark and a real one-epoch neural training smoke test on the same PR head. General application CI separately gates the deterministic recogniser suites, browser flows, build and iOS web-bundle synchronization.

No gate may be lowered to obtain a green build. If a model or recogniser regresses, fix the system or collect better evidence.

## Failure taxonomy

Every failed real-Pencil case must be assigned a primary cause: line segmentation; glyph segmentation/alignment; symbol classification; x-vs-multiplication; operator/relation; superscript/subscript; fraction/radical layout; function-name decoding; multi-line ordering; confidence calibration/unsafe auto-mark; or unsupported notation.

## Current evidence boundary

The committed real-ink corpus currently contains no scored writer sessions. Therefore no real-handwriting accuracy percentage is currently evidenced by the repository. Synthetic and simulator results are regression evidence only.
