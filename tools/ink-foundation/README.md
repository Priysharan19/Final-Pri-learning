# Pri Ink Foundation — locally owned handwriting AI

This directory is the replacement path for the tiny glyph-only CNN ensemble.
The model is **trained by Pri Learning, shipped by Pri Learning and run locally**.
There is no OpenAI, Gemini, Mathpix, Claude or other inference API in this path.

## Architecture

The model deliberately keeps information the old pipeline discarded:

1. **Stroke Transformer** — reads up to 768 sampled Pencil points with x/y,
   velocity, timing, force, stroke width, orientation and pen-boundary features.
2. **High-resolution visual encoder** — reads a 128×512 raster of the whole
   expression instead of isolated 28px glyphs.
3. **Writer/style encoder** — a pooled style vector conditions both modalities;
   writer-ID is an auxiliary training target only, so a new student needs no ID.
4. **Maths decoder** — an autoregressive Transformer emits structured maths
   tokens (`sqrt`, `theta`, powers, brackets, relations, operators, digits, etc.).
5. **Existing Pri grammar + symbolic checks** remain downstream. A learned model
   proposes what the student wrote; it does not get permission to change wrong
   mathematics into the expected answer.

## Data contract

Training consumes `pri-ink-corpus` version 2 JSON from `tools/ink-collect-v2/`.
The collector locks each anonymous writer to exactly one split. `data.py` checks
that invariant again and aborts if a writer appears in multiple splits.

The split policy is:

- `train` — gradients and augmentation.
- `validation` — model selection / early stopping.
- `test` — periodic unbiased evaluation after a candidate is frozen.
- `final-holdout` — release evidence. **Never inspect its errors while tuning.**

The old synthetic suites remain useful regression guards but are not evidence
that the foundation model works on real students.

## Capture quality

The iPad bridge now exports PencilKit timing, force, width, azimuth and altitude
alongside x/y. Legacy saved strokes without those fields still load with neutral
values. The browser collector's `tiltX` / `tiltY` fields are normalised into the
same orientation representation by the dataset loader.

## Train on a Mac

Apple Silicon is supported through PyTorch MPS. A discrete CUDA GPU is also
supported if the corpus is trained elsewhere.

```bash
cd Final-Pri-learning
python3 -m venv .venv-ink
.venv-ink/bin/pip install -r tools/ink-foundation/requirements.txt

.venv-ink/bin/python tools/ink-foundation/train.py \
  --corpus client/test/ink-corpus \
  --out tools/ink-foundation/runs/pri-ink-foundation.pt
```

The default network is intentionally much larger than the existing 798 kB CNN
ensemble. Storage is not used as an optimisation target; real accuracy and
worst-writer reliability are. Increase `--d-model`, `--stroke-layers` or
`--decoder-layers` only when real validation data says it helps.

## Export to the iPad app

On macOS:

```bash
.venv-ink/bin/python tools/ink-foundation/export_coreml.py \
  tools/ink-foundation/runs/pri-ink-foundation.pt
```

This writes a float16 Core ML package under the SwiftPM Resources directory.
The exported model accepts a fixed-size point tensor, validity mask, raster and
decoder prefix. Swift owns the autoregressive/beam loop so decoding policy can
change independently of the base weights.

## Release gates

Do not replace the current production recogniser merely because training loss
looks good. A foundation checkpoint is eligible to become primary only after it
passes **real-writer** gates. Initial targets:

- character error rate ≤ 0.5% on the locked test set;
- exact expression match ≥ 97%;
- worst-writer exact match ≥ 95% with enough expressions per writer;
- no regression in fraction/power/root structure suites;
- high-confidence false reads measured separately and driven as close to zero
  as practical because they are more dangerous than an explicit “check this”.

Those numbers are targets, not claims. Until a sufficiently large real corpus
exists, Pri Learning should report the current model as unvalidated on real
writers rather than extrapolating from synthetic ink.

## Why not just widen the old CNN?

The repository already measured that experiment: wider glyph CNNs slightly
improved the mean while substantially hurting the worst writer. The remaining
problem is not parameter count in an isolated raster classifier. It is missing
stroke dynamics, writer style, 2D context and real training ink. This model is
built around those failure modes directly.
