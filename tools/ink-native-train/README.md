# PRI Stroke-Native Handwriting Training

This directory is the training/export path for PRI's proprietary **online mathematical handwriting expert**. It is deliberately separate from the older raster glyph classifier in `tools/ink-train/`.

The model is not intended to replace the structural recognizer or the no-guess policy. Its job is to provide a powerful independent hypothesis from **how the Apple Pencil moved**, while the production system still requires trace provenance, 2-D structure, independent count evidence and calibrated acceptance.

## Architecture

Input is the same 20-channel contract implemented by `ios/PriLearning.swiftpm/Ink/InkFeatureTensor.swift`:

`x y dx dy dt120 speed turnSin turnCos force forceMask azimuthSin azimuthCos altitude orientationMask width strokeStart strokeEnd strokeIndex pointProgress timeMask`

The initial model is a compact six-layer Transformer encoder with:

- a CTC mathematical-token head
- an independently trained top-level symbol-count head
- a reserved trust/quality head that is **not trained until genuine trust labels exist**

CTC is intentional: V2 expression corpora provide expression truth but not verified trace→symbol alignments. We do not fabricate alignments to make a relation loss possible. A future richly annotated PRI corpus can add grouping/relation/tree heads with genuine labels.

## Data requirements

Only `pri-ink-corpus` **version 2** files are accepted for this pipeline. The loader rejects:

- session-random V1 writer identity
- participant leakage across splits
- duplicate participant/session IDs
- missing split metadata
- samples that include predicted touches
- samples that do not preserve stroke order

By default finger samples are excluded.

The same anonymous participant must reuse the same participant code across every session. The collector maps that code deterministically into train/calibration/test/final-holdout and the loader checks exclusivity again.

## Data licensing

Do not silently train a shipping commercial model on a public research dataset whose licence prohibits commercial use. In particular, the published MathWriting archive has been distributed under CC BY-NC-SA terms. It is useful for architecture research where permitted, but that is not equivalent to permission to ship commercial production weights.

Production weights should use PRI-owned, consented or otherwise commercially licensed training data with documented provenance.

## Setup

```bash
cd tools/ink-native-train
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 1. Audit/load the V2 corpus

`dataset.py` is the single writer-split authority for training. Training automatically prints an audit with participant/session/example counts by split and exits on leakage.

## 2. Train

```bash
python train.py \
  --corpus ../../client/test/ink-corpus \
  --output ../../artifacts/pri-ink-online.pt
```

Default training requires at least eight unique train writers. Increase that threshold for serious experiments; eight is a floor against obviously meaningless training, not a production sample-size recommendation.

The objective is:

`CTC token loss + 0.20 × independent symbol-count loss`

The model is selected on **calibration-writer** token error, never on test or final-holdout writers. The resulting evidence JSON reports writer-level metrics and keeps final holdout as `SEALED` unless explicitly unlocked.

Avoid `--report-test-each-epoch`: repeatedly inspecting test performance turns the test set into development data.

## 3. Calibrate confidence

```bash
python calibrate.py \
  ../../artifacts/pri-ink-online.pt \
  --corpus ../../client/test/ink-corpus
```

This chooses post-hoc token/count temperatures using calibration writers only. It emits `pri-ink-online.calibration.json` and records exactly which participants were used.

Calibration is not a claim that a probability is production-safe. Production acceptance thresholds still need risk-vs-coverage measurement on sufficiently large, representative real Pencil data.

## 4. Export Core ML

```bash
python export_coreml.py \
  ../../artifacts/pri-ink-online.pt \
  ../../artifacts/pri-ink-online.calibration.json \
  --output ../../ios/PriLearning.swiftpm/Resources/PriInkOnline.mlpackage
```

The exporter refuses to proceed when:

- the feature-contract version differs
- calibration metadata is missing
- calibration has zero examples
- calibration metadata says test/final-holdout data was used

The `.mlpackage` stores the feature contract, vocabulary, temperatures, calibration counts, max point count and `pri.acceptance_authority=false` in model metadata.

The package is a candidate artifact, not proof. Before checking it into a release candidate, run native parity tests comparing PyTorch/Core ML token and count outputs, benchmark latency/energy on physical iPads, then evaluate the frozen model on untouched writers.

## Final-holdout discipline

`train.py` does **not** evaluate final holdout by default. After architecture, checkpoint selection and calibration are frozen, a release-measurement run can use:

```bash
python train.py ... --unlock-final-holdout
```

Once final-holdout failures have been inspected, do not tune that model generation against them. Create a new untouched release holdout for the next development cycle.

## Required production reporting

A future model should never be promoted because of one average accuracy number. Record at least:

- exact expression accuracy
- token/symbol error rate
- top-level symbol-count accuracy
- structural relation/tree accuracy once those heads have genuine annotations
- per-writer exact accuracy and worst/lower-decile writer results
- confusion-family accuracy (`1/l/y`, `0/O/theta`, `x/times/4/k`, etc.)
- calibration error / reliability curves
- auto-accepted precision
- automatic coverage
- clarification rate
- false-confident error rate
- p50/p95 recognition latency and energy on supported iPads
- source/provenance and dataset version

The goal is not to force a recognition result for every trace. The release objective is extremely high correctness on **accepted** readings and explicit rescue/clarification when evidence is insufficient.
