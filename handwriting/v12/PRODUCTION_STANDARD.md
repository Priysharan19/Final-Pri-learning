# Pri Learning Handwriting Production Standard

Status: **release policy**. This is the bar for calling Pri Learning handwriting production-ready; it is not a marketing claim about the current reader.

## The reader this standard describes

Since 2 October 2026 (owner decision, confirmed as default D16 on 1 November 2026) the only reader in a student's path is the **server reader**: the device sends a picture drawn from the student's own strokes (`client/src/ink/cloudRaster.js`) to `/v1/handwriting/transcribe`, where `server/platform/handwritingProvider.js` asks the model provider for a transcription. The transcription comes back with the provider's own confidence and doubt; the card asks the student to confirm when the server is unsure; the **deterministic engine marks what the student confirms**. A model output never sets a mark.

The on-device readers (Vision, the Core ML foundation model, the JS recogniser) are retired from the shipped path and from every gate below. The deterministic marking engine stays bundled in the client. The PencilKit writing surface on iPhone and iPad stays native; everything it captures is scored here as **capture fidelity**, not recognition.

## Product contract

Pri Learning must recover the student's **mathematical structure** from Apple Pencil ink and must never confidently mark a different expression from the one the student wrote. The handwriting system therefore owns capture, the picture the reader sees, the server read, calibrated uncertainty and confirmation, and writer-disjoint real-Pencil evaluation together.

A high character score cannot compensate for a structural error. `x^3` becoming `x3`, a numerator becoming another line, or `=` becoming `-` is release-blocking.

## Non-negotiable safety invariants

- No submitted stroke may disappear silently: the picture the server reads is drawn from every stroke the student made.
- Student corrections outrank the reader: a line the student corrects is marked as corrected, and nothing new leaves the device for it.
- Reading is answer-blind: the reader receives the picture and nothing else. No question, expected answer, solution, mark scheme or profile reaches it (`client/test/ink-answer-blind-static-check.mjs`).
- Ambiguous recognition is not auto-marked; when the server says it is unsure the product asks for confirmation before marking.
- A read happens only when the student asks for one, and nothing is marked without the student's confirmation of what was read.
- Training, validation, test and final-holdout writers are disjoint.
- The real-Pencil collector's displayed prompts and stored targets are contract-tested before collection; a ground-truth typo is a release-blocking data defect.

## Gate A — PencilKit capture fidelity and the native journey

Required for every relevant release:

- native Swift build succeeds on the pinned Xcode and iOS simulator runtime (the lane names them; a runner-image change cannot move a gate silently);
- canonical and legacy SwiftPM packages are source-identical;
- PencilKit ↔ JavaScript bridge: the surface mounts and positions where the page said, every stroke placed on it comes back through the bridge with **every point, its timing, pressure, azimuth and altitude intact** (`InkSelfCheck.swift`, scored by `scripts/ink-native-check.mjs`): **100% of strokes and points**, no coordinate moved by more than the codec's own sampling step;
- the student journey passes on an iPhone and an iPad simulator (`scripts/iphone-journey.mjs`): strokes on the surface, hardware-correct ink facts, a sealed draft, a server-marked handwritten answer through the real `/v1` server with a scripted reader, History after a relaunch.

This is a regression gate for capture and the journey. It says nothing about recognition accuracy, and it is simulator evidence, never device evidence.

## Gate B — reader contract and regression

Production target, measured on the committed real-ink corpus with the real provider (`tools/ink-cloud-reader-eval.mjs`):

- exact expression accuracy on the real-ink regression floor may never fall below `handwriting/v17/real-ink-floor.json` (ratchet, upward only, written by a person);
- the server reply contract is enforced: a malformed or out-of-range reply is refused, never passed to marking as confident;
- the retired on-device recogniser's synthetic suites remain in `npm test` only as regression tests for the deterministic engine and the stroke tooling they share; they are not reader evidence.

Existing regression floors may not be lowered to make a release pass.

## Gate C — real Apple Pencil evidence of the server reader

A release cannot be labelled production-ready from synthetic data alone.

Minimum evidence:

- **>= 20 writer-disjoint people** in the test split;
- **>= 1,000 scored expressions** in the real-Pencil test split;
- multiple supported iPad hardware classes where practical;
- neat, ordinary, fast and messy hands;
- curriculum-representative arithmetic, algebra, functions, powers, fractions, roots and multi-line working;
- zero writer/session/derived-sample leakage across splits;
- every scored expression read by the **server reader** from the production picture, never by a retired reader.

Required targets (unchanged from the on-device standard):

- exact expression accuracy **>= 98.0%**;
- character accuracy **>= 99.5%**;
- worst-writer exact accuracy **>= 90%**;
- critical-structure exactness (powers/fractions/radicals/relations) **>= 99.5%**;
- auto-mark precision among readings the server declared safe (not flagged, at or above its confidence floor) **>= 99.9%**, over **>= 1,000** such decisions.

Coverage must fall before precision: uncertain work is confirmed by the student rather than silently marked from a guess.

## Gate D — latency and interaction

On supported iPad hardware:

- ink rendering remains interactive while Pencil is down (PencilKit owns the surface; nothing on the read path touches it);
- a read never blocks Pencil input, and a late reading never replaces newer ink or a corrected line;
- **server read p95 <= 4,000 ms**, measured on the device from the press of "Read my answer" to the transcription landing, on the device's own network (`recognitionMs` in the physical evidence). This replaces the retired on-device target of 500 ms, which a network reader can never meet; 4,000 ms is the product's existing end-to-end budget (`docs/operations/alerts.md` §2a). It was set as a default on 2 November 2026 pending the owner's confirmation, and may be tightened, never loosened, without a recorded decision;
- the product says what it is doing: "still reading" after 5 s, and a named reason with its action when a read is refused or fails.

## CI enforcement

What actually runs, and where (verified against the workflow files, not inferred):

| Gate | PR CI (`ci.yml` and path-filtered workflows) | Release candidate (`release-candidate.yml`) |
|---|---|---|
| Gate A capture fidelity and journey | `native-ink.yml` (hosted `macos-26`, Xcode 26.6, iOS 26.5 runtime, pinned) and `native-journey-ios27.yml` (hosted `xcode-27`, Xcode 27.1, iOS 27.0 runtime, pinned), path-filtered to `ios/**`, `client/src/ink/**`, `client/src/platform/native/**` and their harness scripts. Each lane refuses to run on any other runtime. | not re-run; the candidate SHA must already carry green runs of both lanes where their paths changed |
| Gate B reader contract and real-ink floor | `ci.yml` runs `test:real` as a diagnostic with `\|\| true`; the reply-contract suites run in `npm test` | `inkcheck-real.mjs --strict --gate` blocking |
| Gate C real-writer evidence of the server reader (`client/test/ink-release-evidence-gate.mjs`) | its regression check runs in `npm test` (`test:ink:release-gate`); the gate itself is **not run** on PRs | blocking: the newest real-human evaluation record on the test split, re-scored row by row against the committed corpus |
| Gate C/D physical Apple Pencil (`ink-physical-release-evidence.mjs --strict`) | `ink-physical-evidence.yml` and `npm test` run the validator **non-strict** and its regression check (schema 2, server reader only, retired readers refused) | blocking, test split and locked final holdout |
| Answer-blind invariant (`ink-answer-blind-static-check.mjs`) | `test:ink:blind` | blocking |
| Server reader accuracy (`tools/ink-cloud-reader-eval.mjs`) | tool self-test with a fake provider only (`test:ink:cloud-eval`) | NOT MEASURED unless dispatched with a provider key; the result is an artifact, and becomes Gate C evidence only when a person commits it under `handwriting/v17/cloud-reader-eval/` |
| V17 writer-generalisation data readiness | `ink-writer-generalization.yml` audits and prints readiness | blocking |

`release-candidate.yml` runs on `workflow_dispatch` (input `release_sha`) and on `v*` tags. It is expected to be red until the evidence above exists; its job summary lists every gate, including NOT MEASURED rows. A red release-candidate run is the honest state of the product, not a reason to edit a threshold.

No gate may be lowered to obtain a green build. If the reader regresses, fix the system or collect better evidence.

## Failure taxonomy

Every failed real-Pencil case must be assigned a primary cause: capture (a stroke missing or displaced in the picture); picture (size, contrast, line spacing of the raster); line ordering; symbol misread; x-vs-multiplication; operator/relation; superscript/subscript; fraction/radical layout; function-name decoding; multi-line ordering; confidence calibration/unsafe auto-mark; provider error or timeout; or unsupported notation.

## Current evidence boundary

The committed real-ink corpus (`client/test/ink-corpus/`) contains **one** writer (`P0001`), 50 Apple Pencil expressions, assigned deterministically to the **train** split. The server reader has **never been scored on it**: `tools/ink-cloud-reader-eval.mjs` exists to do so and exits NOT MEASURED without a provider key. The 64.0% / 87.0% figures in `handwriting/v17/real-ink-floor.json` describe the retired JS recogniser on that train split and are kept only as the regression floor the ratchet started from; they are not a claim about the shipped reader.

There are **no** physical-iPad result files under `handwriting/v12/evidence/physical/`, so Gate C/D, auto-mark precision and server-read latency on a device are NOT MEASURED. The only device-side latency figures on record are 1.8–4.0 s from a localhost run with simulated ink (`docs/operations/recognition-cost.md` §3, n = 12) and an uncommitted 10 October staging session before latency train #576. Synthetic, simulator and dry-run results are regression evidence only.
