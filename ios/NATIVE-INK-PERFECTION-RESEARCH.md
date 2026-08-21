# PRI Native Ink — Perfection Research Standard

Date: 2026-08-21

## Objective

The production objective is **near-zero silent mathematical transcription error**, not a misleading 100% raw recognizer score.

Some ink is genuinely ambiguous even to humans (`x` vs multiplication, `1` vs `l`, `0` vs `O`, a fraction bar vs minus, superscript placement, incomplete strokes). A production system that always emits one answer will therefore eventually be wrong. The correct reliability objective is selective recognition:

- auto-accept only when the system is strongly calibrated and independent experts agree;
- re-run or escalate uncertain cases through stronger experts;
- ask a minimal one-tap clarification when ambiguity remains;
- never silently convert uncertainty into a wrong mathematical mark.

Target engineering metrics (targets, not current claims):

- accepted-expression precision >= 99.9%
- silent dangerous error <= 0.1%, with a long-term goal below 0.01%
- auto-accept coverage >= 98% on the supported curriculum domain
- 100% of low-confidence/disagreement cases routed to rescue or clarification
- no production-readiness claim until writer-separated real Apple Pencil testing passes

## What current research says

### 1. Online ink is materially more informative than image OCR

Google's MathWriting dataset contains roughly 230k human-written and 400k synthetic online mathematical expressions. Its benchmark reports that a 35M ink-sequence CTC Transformer achieved 5.56% test CER versus 7.17% for image OCR. MathWriting explicitly identifies visually similar symbols and incorrect sub/superscript nesting as major remaining failure modes.

Implication for PRI: raw ordered Pencil traces are a first-class modality. Do not reduce Apple Pencil input to an image before recognition.

Source: Gervais, Fadeeva, Maksai, *MathWriting: A Dataset For Handwritten Mathematical Expression Recognition*, arXiv:2404.10690.

### 2. Flat LaTeX/text decoding is structurally insufficient

Recent strong HMER systems repeatedly converge on explicit structure:

- TAMER jointly learns LaTeX sequence and tree structure.
- PosFormer explicitly learns relative spatial position forests.
- NAMER tokenizes visible symbols/local relations and refines a graph in parallel, while also improving decoding speed.
- *The Return of Structural HMER* restores explicit trace-to-symbol segmentation, classification and spatial-relation prediction and produces a complete graph tied to raw traces.

Implication for PRI: the canonical internal truth should be a trace-backed mathematical graph/AST. LaTeX is an export format, not the primary state representation.

Sources: arXiv:2408.08578, arXiv:2407.07764, arXiv:2407.11380, arXiv:2508.19773.

### 3. Error-driven auxiliary objectives directly target HMER's hard cases

Uni-MuMER (NeurIPS 2025 Spotlight) combines three training tasks:

- Tree-Aware Chain-of-Thought for spatial structure;
- Error-Driven Learning for visually confusable characters;
- Symbol Counting for long-expression consistency.

Implication for PRI: train explicit auxiliary heads/losses for relation structure, confusion families and symbol/stroke coverage. Do not rely on a single sequence loss.

Source: Li et al., *Uni-MuMER*, arXiv:2505.23566 / NeurIPS 2025.

### 4. Commercial digital-ink engines should be experts, not unquestioned authorities

Mathpix `/v3/strokes` accepts raw stroke coordinates directly, is designed to be faster/smaller than rendered-image submission, and returns LaTeX plus confidence fields. It is an excellent optional cloud rescue expert.

MyScript iink has a dedicated Math recognizer, native recognition resources (`math2`), incremental recognition, custom math subsets/grammars, and structured JIIX math output. MyScript explicitly recommends reducing the supported math symbol/rule set where appropriate because fewer ambiguities can improve the user experience.

Google ML Kit Digital Ink runs offline and consumes ordered vector strokes with timestamps. Google explicitly recommends timestamps, writing-area context, pre-context and natural stroke order for better accuracy. It is not a full mathematical-layout parser, so it is best used as a text/symbol auxiliary expert rather than the sole math engine.

Implication for PRI: benchmark MyScript, Mathpix and ML Kit independently against the same blind real-Pencil corpus. Fuse evidence; never hard-code external output as truth.

### 5. Pencil telemetry should preserve the real online signal

Apple documents that compatible devices can report touch samples at up to 240 Hz, while normal UIKit delivery can be around 60 Hz; additional samples are available through coalesced touches. Apple also provides predicted touches to reduce perceived rendering latency, but explicitly treats predictions as temporary and says they should be replaced by real touches.

Apple Pencil also exposes timestamps, force, altitude, azimuth and (on supported hardware) roll.

Implication for PRI:

- keep PencilKit for excellent low-latency rendering;
- capture actual coalesced Pencil touches for the recognizer/training corpus when possible;
- store timestamps and physical telemetry;
- use predicted touches for rendering only, never as permanent recognition/training evidence;
- retain the untouched raw event stream alongside any normalized/resampled tensor.

## Target recognition architecture

### Stage A — high-fidelity acquisition

Persist actual input as an immutable trace stream:

`{x, y, timestamp, force, altitude, azimuth, roll?, estimated-flags, stroke-id}`

Derived features may include:

- normalized x/y
- dx/dy
- dt
- velocity and acceleration
- tangent angle
- curvature
- path-length position
- pressure and pressure derivative
- perpendicular pressure estimate using altitude
- stroke-start/end flags
- pen-up duration
- local writing-area scale

Never overwrite raw traces with normalized values.

### Stage B — local online-stroke expert

Train a dedicated Transformer/Conformer-style encoder for online mathematical ink.

Recommended multi-task outputs:

1. symbol/token sequence
2. stroke-to-symbol ownership
3. pairwise spatial relations (`right`, `above`, `below`, `superscript`, `subscript`, `inside`, `fraction numerator/denominator`, etc.)
4. symbol count / coverage
5. confusion-family logits
6. uncertainty / OOD score

The production model should be distilled/quantized to Core ML after an accuracy-first teacher has been established.

### Stage C — independent appearance expert

Rasterize ink at multiple normalized scales and run a structurally trained 2-D HMER model. This expert should be architecturally independent from the online model so disagreement carries useful information.

Research candidates to reproduce/borrow ideas from: TAMER, NAMER, PosFormer, Uni-MuMER.

### Stage D — commercial experts

Evaluate behind interfaces:

- MyScript iink Math: preferred commercial on-device/incremental candidate if licensing and measured accuracy are acceptable.
- Mathpix strokes: optional network rescue path, server-brokered credentials only.
- ML Kit Digital Ink: offline auxiliary candidate for text-like fragments and candidate diversity.
- Apple Vision: retain as an image hypothesis expert, never the primary mathematical truth source.

### Stage E — canonical mathematical graph

All expert outputs are normalized into the same canonical representation:

- trace-backed symbol nodes
- explicit spatial edges
- canonical operators/functions
- grouping/fence structure
- fraction/radical/superscript/subscript hierarchy
- provenance from every expert
- calibrated probability and disagreement features

No expert may bypass this graph.

### Stage F — global constrained decoding

Generate an N-best set of candidate graphs/ASTs, then score globally using:

- calibrated online-model likelihood
- calibrated appearance-model likelihood
- commercial-expert likelihood/confidence when available
- trace-coverage score
- relation consistency
- symbol-count consistency
- curriculum grammar
- expression syntax validity
- local question context / expected answer form when legitimate
- personalization evidence

Context may break a visual tie but must never fabricate unsupported ink.

### Stage G — selective acceptance and rescue

Calibrate probabilities on a disjoint calibration set. Track reliability diagrams, ECE/Brier score and risk-vs-coverage rather than trusting raw softmax confidence.

Policy example:

1. if calibrated posterior and expert agreement exceed threshold -> accept;
2. otherwise invoke stronger local/cloud experts;
3. if two valid candidates remain close -> highlight the exact trace region and ask a one-tap clarification;
4. corrections become opt-in, profile-scoped adaptation data and global hard-negative training data only after privacy/consent checks.

The system's safest answer is sometimes "I need you to confirm this symbol".

## Data strategy

### Research datasets

Use for architecture experiments and benchmarking subject to their licenses:

- MathWriting: large online HME; CC BY-NC-SA 4.0, therefore **not automatically suitable for commercial production weights**.
- CROHME / CROHME 2023: standard HMER evaluation and structural comparisons.
- HME100K: large real-scene offline HME; check license before any production use.
- DCOH-120K: useful trajectory metadata including timestamp/tilt/pressure, but published under non-commercial/no-derivatives terms; research only unless separately licensed.

### PRI-owned production corpus

A production model needs a separately owned/licensed corpus recorded under explicit consent.

Required participant identity rule: the same human writer must have one stable anonymous participant ID across every session. A random session ID is not a writer ID.

Required metadata where consent permits:

- anonymous writer ID
- session ID
- device/iPad model
- Pencil model / pointer capabilities
- handedness
- writing speed bucket derived from traces
- input modality (Pencil/finger)
- app/build/model version
- prompt ID and canonical target
- correction history for that sample

Do not collect unnecessary personal identity.

### Split protocol

Do not tune on the final holdout.

At minimum maintain:

- train writers
- calibration writers
- validation writers
- blind test writers
- final release holdout writers

A stronger release test simultaneously holds out:

- writers
- expression templates
- devices
- collection sessions

This prevents memorizing a person's hand or a repeated equation pattern.

## Deliberate hard-case corpus

Oversample and separately report:

- `1 / l / I / | / y`
- `0 / O / o / theta`
- `2 / z`
- `5 / s`
- `6 / b`
- `8 / B / 3`
- `9 / g / q / 4`
- `x / multiplication / * / 4 / k`
- decimal point / dot / multiplication dot
- minus / fraction bar
- `< / > / <= / >=`
- parentheses / brackets / `c`
- superscript vs baseline
- subscript vs baseline
- nested fractions
- radicals
- trig/functions
- overwritten/corrected symbols
- non-standard stroke order
- fast/slow writing
- light/heavy pressure
- left/right handed writers
- messy and adversarial but human-readable samples

## Evaluation standard

Every release must separately report:

### Raw recognition
- exact expression rate
- token/CER
- structure exact match
- symbol F1
- relation F1
- trace ownership F1

### Reliability
- accepted-expression precision
- auto-accept coverage
- selective risk-coverage curve
- ECE and Brier score
- top-2 margin/error detection AUROC
- OOD/reject performance
- silent-dangerous-error rate

### Generalization slices
- unseen writers
- unseen expression templates
- device family
- left/right hand
- speed quartiles
- pressure quartiles
- expression complexity/depth
- each confusion family

### Performance
- input/render touch-to-photon latency on physical iPad
- p50/p95 local recognition latency
- p50/p95 rescue latency
- battery/thermal impact
- model memory and storage

Simulator recognition time must never be reported as physical Pencil latency.

## Immediate engineering priorities

1. Fix all existing trace ownership / structural recovery regressions before adding another model.
2. Upgrade PRI's real-ink collector to preserve stable anonymous writer identity across sessions and capture timestamps + available Pencil telemetry.
3. Add a corpus validator that rejects writer leakage between train/calibration/test/final-holdout splits.
4. Establish MathWriting research ingestion and reproduce its online Transformer baseline; keep licensing boundaries explicit.
5. Implement a model-agnostic `InkRecognitionExpert` protocol and calibrated ensemble result type.
6. Benchmark MyScript iink Math, Mathpix strokes and ML Kit against the exact same blind corpus.
7. Train an accuracy-first online trace Transformer with structure/count/confusion auxiliary heads.
8. Train an independent 2-D structural appearance model.
9. Add calibrated selective acceptance + one-tap region-specific ambiguity confirmation.
10. Only after the final blind real-Pencil holdout is frozen, set numerical production thresholds.

## Definition of "perfect enough to ship"

The recognizer is not production-perfect because a synthetic ten-expression suite passes.

A release may be called production-grade only when:

- all deterministic architecture/safety regressions pass;
- writer-separated blind real-Pencil evaluation is large enough to estimate rare errors;
- accepted predictions meet the predeclared precision target;
- every below-threshold result is rescued or explicitly clarified;
- no data leakage exists between training, calibration and final evaluation;
- physical iPad latency meets the UX budget;
- commercial/licensing/privacy constraints for every dataset and external expert are resolved.

The system should optimize for **trustworthy mathematics**, not an attractive but unprovable 100% badge.
