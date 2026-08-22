# Pri InkNet — Benchmark and Promotion Specification

This document defines what evidence is allowed to promote a handwriting model. Synthetic accuracy is useful for regression testing; it is not sufficient production evidence.

## Benchmark ladder

### B0 — unit/contract

Purpose: catch implementation defects cheaply.

- schema validation;
- preprocessing parity;
- tokenizer/vocabulary round-trip;
- MathGraph validity;
- shadow-mode safety;
- deterministic export manifest.

B0 must run in ordinary repository CI.

### B1 — synthetic glyph regression

Existing V12 suites remain authoritative regression guards for the shipped recognizer. InkNet may additionally use synthetic glyph/trajectory tasks to verify learning and export parity.

Never quote B1 as real handwriting accuracy.

### B2 — synthetic expression/writer simulation

Measure complete expression exact accuracy, character accuracy, layout relation F1, calibration and worst simulated writer. These tests expose architecture regressions and difficult math layouts, but still inherit simulator assumptions.

### B3 — real-writer development

Consented anonymous real Pencil writers, split **by writer**. Training and validation writers may be inspected. Validation is used for model selection, calibration and thresholds.

### B4 — immutable real-writer test

A writer-disjoint test set that is never used to tune model weights, preprocessing, decoding or thresholds. Once failures are inspected to improve the model, the set is considered spent and replaced before the next claimed test result.

### B5 — grading integrity

The recognition output is passed through the exact deterministic Step Check / marking path used by the app. Compare against human-transcribed ground truth.

Primary risks:

- `false_correct`: recognition error causes an incorrect response to receive credit;
- `false_incorrect`: recognition error removes credit from correct mathematics;
- `mark_change`: awarded mark differs because of recognition;
- `feedback_change`: first-error location or misconception feedback changes because of recognition.

B5 is the final authority for rollout. Recognition exact-match alone cannot prove marking safety.

## Required split fields

Every real sample belongs to a manifest containing:

- `sample_id` — globally unique opaque id;
- `writer_id` — stable anonymous participant id;
- `session_id` — unique recording session;
- `split` — `train | validation | calibration | test | final-holdout`;
- `collection_device` — device/model family, not a personal identifier;
- `capture_mode` — Pencil / finger / imported;
- `timestamp_bucket` — coarse bucket only;
- `expression_id` — canonical prompt/expression identity;
- `target` — human-verified transcription;
- `consent_scope` — whether the sample may be used for training, validation, benchmark or only local debugging.

Names, emails and account ids must not be model features or dataset identifiers.

## Leakage blockers

A dataset is invalid when any of the following occurs across protected splits:

1. same `writer_id` in more than one protected split;
2. same `session_id` in more than one split or file;
3. duplicate `sample_id`;
4. exact duplicate ink payload under different sample ids;
5. near-duplicate ink produced by copying/transforming a benchmark sample into training;
6. calibration and final-test writers overlap;
7. a sample whose consent scope forbids the requested use is included.

Synthetic datasets must use a distinct source namespace and are never mixed into reported real-writer denominators.

## Metrics

### Recognition

- expression exact accuracy;
- normalized character/token error rate;
- MathGraph relation precision/recall/F1;
- fraction/root/superscript/subscript exact accuracy;
- multi-line exact accuracy;
- correction rate after top-2 confirmation.

### Tail performance

Always report:

- mean writer exact accuracy;
- median writer exact accuracy;
- 10th percentile writer exact accuracy;
- worst-writer exact accuracy;
- worst-writer character accuracy.

Do not hide a catastrophic writer behind a high global mean.

### Calibration

- expected calibration error (ECE);
- Brier score;
- exact-expression accuracy at confidence bands;
- selective risk vs coverage curve;
- OOD AUROC/AUPRC for supported vs unsupported ink.

### Product safety

- false-correct rate;
- false-incorrect rate;
- mark-change rate;
- feedback-change rate;
- abstention/confirmation rate;
- percentage of unsafe errors caught by the confirmation policy.

### Performance

Measure on target hardware, not desktop only:

- p50/p95 recognition latency;
- peak resident memory;
- model artifact size;
- cold-load time;
- energy/thermal behaviour over a realistic worksheet session;
- offline availability after installation.

## Initial promotion gates

These are intentionally conservative starting gates and must be ratcheted upward after a stable measured baseline exists. A gate may not be lowered merely to make a release pass.

### Edge challenger minimums

- B4 expression exact: **>= 90%**;
- B4 character/token accuracy: **>= 97%**;
- B4 worst-writer exact: **>= 75%**;
- ECE: **<= 0.03**;
- p95 warm inference on supported iPad: **<= 120 ms** for a normal single-line expression;
- no raw-ink network telemetry;
- model loads and runs offline.

### B5 grading gates

- false-correct due to recognition: **<= 0.10%**;
- false-incorrect due to recognition: **<= 0.50%**;
- total mark-change rate: **<= 0.50%**;
- no severity-1 failure in the immutable release set;
- confirmation/abstention policy must reduce unsafe mark-changing errors rather than merely reducing coverage.

These are promotion gates, not claims that the current challenger already meets them.

## Confidence policy

The model may only auto-authorize a reading when all of the following are true:

- calibrated exact-expression confidence exceeds the selected threshold;
- OOD score is below its threshold;
- no structural relation falls into the ambiguity band;
- the reading does not violate deterministic grammar/syntax constraints;
- the sample is within supported length/point/layout limits.

Otherwise the product should prefer a one-symbol confirmation or fall back to V12/native Vision rather than silently guess.

## Holdout discipline

- `train`: fit weights;
- `validation`: architecture/model selection;
- `calibration`: fit temperature/decision thresholds;
- `test`: routine untouched evidence until first diagnostic inspection;
- `final-holdout`: release-only, deliberately opened.

Opening failure details spends the corresponding holdout for future unbiased claims.

## Release artifact

Every promoted model must ship with a machine-readable manifest containing:

- model version;
- Git commit;
- training configuration hash;
- training/validation/calibration/test manifest hashes;
- vocabulary/schema/preprocessing versions;
- model artifact SHA-256;
- calibration parameters;
- measured metrics and hardware;
- release-gate verdict;
- explicit fallback model/version.

A binary model without this manifest is not a production artifact.
