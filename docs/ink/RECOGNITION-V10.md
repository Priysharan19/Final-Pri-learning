# PRI Native Ink V11/V12 frontier architecture

This document records the production direction for the native Apple Pencil recognizer.

## Core principle

PRI must not collapse handwriting into a bitmap and then treat OCR text as ground truth. The production representation is multimodal and provenance-preserving:

1. raw Pencil traces (x/y/time/pressure/azimuth/altitude)
2. rendered appearance
3. trace-to-symbol ownership
4. 2-D mathematical relations
5. multiple expert hypotheses
6. mathematical grammar/AST
7. calibrated uncertainty
8. profile-scoped personalization

The local Vision recognizer is one expert, not the final authority.

## Implemented now

- incremental PencilKit transport and off-main-thread recognition
- dynamic-programming trace-to-symbol alignment
- geometry-aware ambiguity repair
- profile-scoped bounded personalization
- optional Mathpix raw-stroke expert boundary with no embedded API secret
- `InkSequenceEncoder`: a stable 16-feature online sequence representation ready for a future Core ML stroke Transformer
- `InkStructureGraph`: additive trace-provenance graph containing symbols, exact stroke ownership, right-of, superscript, subscript and bracket relations, plus explicit structural risk flags
- deterministic frontier self-checks in native CI

## Sequence model contract

Each sampled Pencil point is represented by 16 values:

`x, y, dx, dy, dt, speed, cos(direction), sin(direction), curvature, width, force, sin(azimuth), cos(azimuth), altitude, strokeStart, strokeEnd`

Coordinates are normalized by page scale. The encoder exposes `dynamicsCoverage` so tests and datasets can distinguish genuine Apple Pencil telemetry from old/synthetic samples with defaults.

The future Core ML model must use the exact same encoder contract during training and deployment.

## Structure graph

Recognition output now has an additive `structure` payload. Nodes preserve:

- symbol id
- symbol hypothesis
- confidence and alternatives
- line id
- bounding box
- exact stroke indexes
- approximate-ownership flag

Edges currently include:

- `rightOf`
- `superscriptOf`
- `subscriptOf`
- `bracketPair`
- `insideBrackets`

The graph also reports trace coverage, approximate-node fraction, an evidence-quality score and risk flags. The evidence score is diagnostic only and is **not** a calibrated probability.

## Next neural system

The first proprietary PRI model should be an online stroke Transformer trained on writer-separated data. It should predict symbol/structure hypotheses while preserving trace alignment. A second visual model should encode the raster view. Training should include:

- symbol classification
- sequence/LaTeX decoding
- symbol-count auxiliary loss
- tree/spatial-relation auxiliary loss
- trace-to-symbol alignment loss
- error-driven contrastive losses for known confusions
- stroke↔raster contrastive learning

A larger research/VLM teacher may be used for distillation where licensing allows, but the production iPad model should be compact enough for Core ML/Neural Engine deployment.

## Ensemble safety

External experts such as Mathpix, MyScript or ML Kit may supply hypotheses. Their confidence values must never be averaged blindly because provider confidence scales are not calibrated against each other. Until a provider is calibrated on the same writer-separated PRI holdout, external output may corroborate or surface a disagreement but must not silently overwrite trace-aligned local ink.

## Evidence hierarchy

Scores must always remain separate:

- synthetic native benchmark
- writer-model holdout
- real writer-separated Apple Pencil validation
- simulator latency
- physical iPad latency/feel

Passing the ten-expression simulator suite is a regression gate, not evidence of production accuracy.

## Production dataset requirement

The next accuracy step is data, not more benchmark-specific rules. A PRI-owned, consented corpus should preserve writer ids for splitting and record raw Pencil telemetry, ground-truth expression, symbol↔stroke alignment, corrections, writing-area geometry, device metadata and sample conditions. Train/dev/test/final-holdout must be writer-separated.
