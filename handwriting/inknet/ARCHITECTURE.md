# Pri InkNet — Production Architecture

Status: **challenger only**. V12 web recognition and native PencilKit/Vision remain authoritative until the evidence gates in `BENCHMARK_SPEC.md` pass.

## Why this exists

The shipped recognizer is already a strong hybrid system: structural rules + a three-CNN glyph ensemble + geometry re-ranking + layout parsing + personal correction learning, with native PencilKit/Vision on iPad. Its synthetic holdouts show that simply widening the CNN or increasing distortion can raise mean validation accuracy while *lowering worst-writer accuracy*. The remaining problem is therefore not “make the glyph CNN larger.”

InkNet targets the failure modes the current architecture cannot model cleanly:

1. **segmentation ambiguity** — deciding where one handwritten symbol ends and the next begins;
2. **2D mathematical structure** — fractions, radicals, powers, subscripts, aligned working and multi-line expressions;
3. **writer-conditioned ambiguity** — the same writer's 1/l, 0/o, x/×, 5/s habits are correlated across a page;
4. **calibrated abstention** — recognition must know when it is unsafe to drive marking;
5. **real-writer generalisation** — performance must be measured on people, not only on the generator that trained the engine.

## Non-negotiable invariants

- **V12 remains selected in shadow mode.** Challenger failure, latency or disagreement may never change a student's displayed reading or mark.
- **No raw ink telemetry leaves the device.** Shadow comparison records are metadata-only unless a separately consented corpus workflow is used.
- **No accuracy claim from synthetic data is presented as real-handwriting evidence.**
- **Writer, session and near-duplicate leakage are release blockers.**
- **Recognition and marking remain separate systems.** InkNet emits a versioned mathematical representation; deterministic maths/marking owns equivalence and marks.
- **Offline remains a first-class target.** iPad production inference should ultimately use Core ML/Metal; browser fallback may use the existing V12 engine or a WASM/WebGPU challenger where supported.

## Architecture

```text
Apple Pencil / Pointer Ink
          │
          ├────────────── V12 / Native Vision ────────────────┐
          │                                                   │
          │  selected production reading                     │
          │                                                   ▼
          │                                           Step Check / Marker
          │
          └── InkDocument v1
                  │
                  ├── online trajectory encoder
                  │     x,y,dx,dy,dt,pressure,tilt,pen-up
                  │
                  ├── whole-expression visual encoder
                  │     raster + explicit 2D position
                  │
                  └── cross-modal fusion
                         │
                  autoregressive symbol decoder
                         │
                  relation / structure head
                         │
                     MathGraph v1
                         │
               confidence + OOD + abstention
                         │
               shadow disagreement evidence
```

### 1. Stable `InkDocument`

Capture is normalized into a versioned document before any model runs. The contract preserves chronology and optional Pencil dynamics while remaining compatible with the existing `{points:[{x,y,...}]}` stroke shape.

Required model features:

- normalized absolute x/y;
- dx/dy;
- log time delta;
- pressure where available;
- altitude/azimuth or derived tilt where available;
- pen-up boundary;
- explicit stroke order.

Missing dynamics are legal and must use documented neutral defaults. The model cannot assume every browser supplies pressure or tilt.

### 2. Online trajectory encoder

Use a compact Transformer/Conformer-style encoder over points rather than glyph segments. This preserves stroke order and lets the model reason over multi-stroke symbols and neighbouring context before a hard segmentation decision exists.

The edge model should target roughly 4–8 encoder blocks at `d_model` 192–320. The server/teacher model may be larger.

### 3. Whole-expression visual encoder

Rasterize the complete expression, not each segmented glyph. The current V12 rasterizer has carefully learned conventions for thin glyphs; InkNet gets a separate expression raster contract and an explicit 2D coordinate embedding so fractions and superscripts do not become positionless image tokens.

A compact CNN/ConvNeXt-style backbone is preferred over a large ViT for the edge model because:

- mathematical ink is sparse;
- iPad latency and memory matter more than ImageNet transfer scale;
- convolutional operators export cleanly to Core ML;
- the trajectory branch already supplies long-range sequential context.

### 4. Cross-modal fusion

Bidirectional attention lets trajectory tokens ask the raster where a stroke sits in the 2D expression, and image tokens ask the trajectory branch how a shape was written. This is specifically aimed at ambiguities where geometry alone or order alone is insufficient.

### 5. Segmentation-free decoder

The primary decoder predicts canonical math tokens autoregressively. It must not depend on V12's glyph segmentation. During migration, V12 segments may be used only as auxiliary training targets or diagnostics.

The vocabulary is versioned and includes:

- digits and supported letters;
- operators/comparators;
- Greek symbols;
- structural tokens for fraction/root/superscript/subscript/matrix/line boundaries;
- function tokens (`sin`, `cos`, `tan`, `log`, `ln`, `lim`, etc.).

### 6. Structure head → `MathGraph`

A relation head predicts sparse relationships such as `right`, `sup`, `sub`, `above`, `below`, `inside`, and `next_line`. The graph decoder is conservative: low-confidence edges are omitted instead of invented.

`MathGraph` is the boundary between perception and deterministic mathematics. It should preserve candidate confidence and provenance, but the marking engine must never infer marks directly from neural logits.

### 7. Confidence, OOD and abstention

Raw softmax is not a product confidence score. InkNet carries separate heads for:

- probability the full expression was transcribed exactly;
- out-of-distribution score;
- token/structure uncertainty.

Post-hoc calibration is fit on a dedicated writer-disjoint calibration split. Final test writers are never used to fit thresholds.

The production policy is asymmetric: a false confident reading that changes a mark is much worse than an abstention that asks the student to confirm one symbol.

### 8. Teacher → edge distillation

Train two model classes:

- **Teacher**: higher resolution, longer point budget, larger hidden width. Used for difficult-case analysis, pseudo-labeling of consented data, and distillation.
- **Edge**: compact model for offline iPad inference.

Distillation transfers the teacher's token distribution and confidence behaviour, but student selection still uses writer-disjoint validation metrics.

### 9. iPad deployment

Production target order:

1. **Core ML / Metal in the native shell** — preferred for PencilKit builds;
2. **existing V12 engine** — permanent fallback and rollout authority;
3. optional browser challenger using WASM/WebGPU where the platform supports it.

Do not make the PWA depend on a heavyweight runtime before a trained model has proven material benefit. Model artifacts are versioned, checksummed and loaded behind a fail-closed feature flag.

## Shadow rollout

Phase 0 — contracts + benchmark gates only.  
Phase 1 — challenger runs locally after V12/Vision has already produced the student-facing reading.  
Phase 2 — collect metadata-only agreement/calibration/latency statistics and separately consented error corpora.  
Phase 3 — allow InkNet to propose a confirmation UI on high-value disagreements, without changing marks automatically.  
Phase 4 — limited authority only after B5 grading-integrity gates pass.  
Phase 5 — V12 remains a fallback even after promotion.

## Approaches deliberately rejected

### “Just make the current CNN wider”
Already tested in this repository: validation improved while independent worst-writer performance fell and model size increased materially. This optimizes the wrong objective.

### “Train harder synthetic augmentation”
Already tested: beyond the current tail, augmentation becomes label noise and degrades holdouts. More simulator variance does not manufacture human handwriting diversity.

### “Use only Vision on iPad”
Vision is a useful production fallback but is not a Pri-controlled mathematical recognizer: it cannot provide the same deterministic versioning, writer-specific evidence, structural graph contract and offline cross-platform behaviour we need.

### “Replace V12 in one release”
Rejected. Handwriting feeds marks. A new recognizer must first prove it does not create false-correct/false-incorrect marking changes.

### “Tune on the final holdout until it looks good”
Rejected. Reading holdout failures spends the holdout. A new untouched writer set must replace it before further tuning.

## Definition of done

InkNet is not “done” when training loss is low. It is promotable only when:

- real-writer exact/character/worst-writer gates pass;
- confidence is calibrated;
- OOD/abstention behaviour passes;
- latency/memory/offline gates pass on target iPads;
- no writer/session/near-duplicate leakage is detected;
- the B5 grading-integrity benchmark shows mark-change risk below the release threshold;
- shadow mode has run long enough to expose disagreement classes without user-facing regressions.
