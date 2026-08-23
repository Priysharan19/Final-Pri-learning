# Pri Ink Foundation — locally owned handwriting AI

Pri Ink Foundation is Pri Learning's trainable, on-device handwriting model. It is trained by Pri Learning, exported to Core ML and executed locally. No hosted AI inference API is required.

## Architecture

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

## Training: synthetic initialization → real-writer fine-tuning

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

A development model can be exported without promotion:

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

## Evidence boundary

Synthetic suites, simulator benchmarks and training loss are engineering evidence, not arbitrary-human-handwriting accuracy. Until the real writer corpus reaches the production evidence floor and the frozen checkpoint passes it, Pri Learning must describe the foundation model as unvalidated for production real writers.
