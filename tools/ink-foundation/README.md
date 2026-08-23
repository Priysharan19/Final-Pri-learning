# Pri Ink Foundation — locally owned handwriting AI

Pri Ink Foundation is Pri Learning's trainable, on-device handwriting system. It is trained by Pri Learning, exported to Core ML and executed locally. No hosted AI inference API is required.

## Current production-compatible path: V3

1. **Stroke Transformer** — up to 768 Pencil points with x/y, velocity, timing, force, width, orientation and stroke boundaries.
2. **Whole-expression visual encoder** — 128×512 raster, preserving 2-D context that isolated-glyph CNNs lose.
3. **Writer/style encoder** — conditions both modalities on the current hand; no known writer ID is required at inference.
4. **Parallel maths decoder** — emits the complete token sequence in one neural pass for practical iPad latency.
5. **Pri structural/grammar checks** — learned hypotheses do not get permission to rewrite mathematically wrong work into an expected answer.

The native runtime uses:

1. promoted Pri Ink Foundation Core ML model;
2. existing Pri JS stroke/CNN/grammar recogniser;
3. native Vision/geometry recogniser as emergency no-result rescue.

All three are on-device.

## Structural V4 research path

V4 is the next architecture, developed beside V3 rather than replacing a passing runtime prematurely. It changes the recognition abstraction from flat OCR to explicit mathematical structure:

```text
Pencil points
    -> physical-stroke encoder
    -> contextual stroke embeddings + 2-D visual cross-attention
    -> same-glyph grouping
    -> symbol evidence
    -> directed spatial/mathematical relations
    -> inspectable maths graph
    -> deterministic structural decoder
```

The current V4 relation vocabulary is `RIGHT`, `SUPERSCRIPT`, `SUBSCRIPT`, `ABOVE`, `BELOW`, `NUMERATOR`, `DENOMINATOR` and `INSIDE_ROOT`. Grouping and relation heads are trained with balanced losses so the huge number of negative/NONE pairs cannot produce misleadingly high validation accuracy.

V4 is intentionally tagged **research-only**. It does not have permission to replace V3 or enter a release build until it beats V3 on locked writer-disjoint real Pencil evidence.

### Annotate real Pencil traces for V4

Collect normally first:

```bash
npm run ink:collect
```

Then run the local structural annotator:

```bash
npm run ink:annotate
```

Load a collected `pri-ink-corpus` JSON. For every expression:

1. group the physical stroke numbers that form one visible glyph (for example, the two bars of `=`);
2. label the group with the canonical model token (`x`, `2`, `=`, `sqrt`, `theta`, `'`, etc.);
3. add explicit mathematical relations such as `SUPERSCRIPT` or `NUMERATOR`;
4. validate that every physical stroke belongs to exactly one glyph;
5. save the structural-V4 JSON locally.

The annotator reads and writes local files only. It does not upload handwriting.

### Train V4

Set up the same Python environment used by V3, then point the V4 trainer at a directory containing structure-annotated train and validation writers:

```bash
.venv-ink/bin/python tools/ink-foundation/train_structural.py \
  --corpus client/test/ink-corpus-structural \
  --out tools/ink-foundation/runs/pri-ink-structural-v4.pt
```

The trainer refuses:

- writer overlap between train and validation;
- unsupported glyph labels;
- incomplete or duplicate stroke grouping;
- relation edges to nonexistent glyphs;
- corpora with no real multi-stroke glyph grouping signal;
- corpora with no positive mathematical relations.

V4 checkpoint selection weights symbol accuracy, balanced grouping accuracy and **positive structural-relation accuracy**. Raw all-pairs/NONE accuracy is not accepted as evidence that the parser learned maths structure.

## Collect real Apple Pencil data

From the repo root:

```bash
npm run ink:collect
```

Open the printed HTTPS address on the iPad. The collector:

- accepts Apple Pencil input only;
- records anonymous participant codes, not names/emails/account IDs;
- records a versioned consent acknowledgement;
- deterministically maps every participant code to one split using `fnv1a32-v1:70/10/10/10`;
- stores coalesced real samples but never predicted touches;
- records timing, pressure and Pencil orientation where available.

Save every session JSON under `client/test/ink-corpus/`, then run:

```bash
npm run test:ink:corpus:strict
```

Strict audit fails on writer/session leakage, incorrect deterministic split assignment, missing consent, non-Pencil samples, or inadequate timing/dynamics coverage.

## V3 training: synthetic initialization → real-writer fine-tuning

Set up once:

```bash
python3 -m venv .venv-ink
.venv-ink/bin/pip install -r tools/ink-foundation/requirements.txt
```

### 1. Synthetic whole-expression pretraining

Synthetic data is initialization only, never release evidence:

```bash
node tools/ink-foundation/generate_synthetic.mjs /tmp/pri-ink-pretrain

.venv-ink/bin/python tools/ink-foundation/train.py \
  --stage pretrain \
  --corpus /tmp/pri-ink-pretrain \
  --out tools/ink-foundation/runs/pri-ink-pretrain.pt
```

### 2. Fine-tune on writer-separated real Pencil data

```bash
npm run test:ink:corpus:strict

.venv-ink/bin/python tools/ink-foundation/train.py \
  --stage finetune \
  --init tools/ink-foundation/runs/pri-ink-pretrain.pt \
  --corpus client/test/ink-corpus \
  --out tools/ink-foundation/runs/pri-ink-finetuned.pt
```

`train.py` uses train writers for gradients and validation writers for checkpoint selection. It does not read final-holdout evidence.

## Frozen evaluation

Use `test` while deciding whether a checkpoint is a credible release candidate:

```bash
.venv-ink/bin/python tools/ink-foundation/evaluate_release.py \
  tools/ink-foundation/runs/pri-ink-finetuned.pt \
  --corpus client/test/ink-corpus \
  --split test
```

Only for a frozen release candidate, spend the final holdout once:

```bash
.venv-ink/bin/python tools/ink-foundation/evaluate_release.py \
  tools/ink-foundation/runs/pri-ink-finetuned.pt \
  --corpus client/test/ink-corpus \
  --split final-holdout \
  --unlock-final-holdout \
  --out tools/ink-foundation/runs/final-release-report.json
```

Do not inspect individual final-holdout failures or repeatedly tune against its aggregate score.

## Production gates

The current release standard requires at minimum:

- >= 20 writer-disjoint evaluation writers;
- >= 1,000 real-Pencil evaluation expressions;
- exact expression accuracy >= **98.0%**;
- character accuracy >= **99.5%** (CER <= 0.5%);
- worst-writer exact accuracy >= **90%**;
- critical-structure exactness for powers/fractions/radicals/relations >= **99.5%**;
- precision among readings the product declares safe to auto-mark >= **99.9%**;
- deterministic native benchmark remains 100% exact and >=99.5% characters;
- detached superscripts stay attached while real second lines stay separate;
- supported-iPad stable single-line recognition target p95 <= 500 ms after debounce/pen-up.

Coverage is allowed to fall before safe precision. Uncertain work should be confirmed by the student, not silently marked from a guess.

## Core ML export and promotion lock

A V3 development model can be exported without promotion:

```bash
.venv-ink/bin/python tools/ink-foundation/export_coreml.py \
  tools/ink-foundation/runs/pri-ink-finetuned.pt
```

It is tagged `pri.productionReady=false`; release builds refuse it.

A production export requires the passing locked final-holdout report for the exact checkpoint SHA-256:

```bash
.venv-ink/bin/python tools/ink-foundation/export_coreml.py \
  tools/ink-foundation/runs/pri-ink-finetuned.pt \
  --release-report tools/ink-foundation/runs/final-release-report.json
```

The exporter embeds the checkpoint hash and release metrics. Release builds activate the model only when promotion metadata is valid.

V4 has no production export path yet by design. A structural research checkpoint is not allowed to masquerade as a promoted V3 Core ML asset.

## Evidence boundary

Synthetic suites, simulator benchmarks, annotation-tool correctness and training loss are engineering evidence, not arbitrary-human-handwriting accuracy. Until a frozen model passes the real writer-disjoint release floor, Pri Learning must describe it as unvalidated for production real writers.
