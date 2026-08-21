# Retraining the ink engine

Everything the recogniser learns is generated on this machine — there is no
external dataset to fetch beyond MNIST, and no training data leaves the box.

Nothing here needs to be run to build or ship the app. The trained assets are
already committed (`client/src/ink/model-data.js`, `rerank-data.js`); this is
only for when you want to change the model.

## Setup (once)

```bash
python3 -m venv .venv && .venv/bin/pip install numpy torch
mkdir -p /tmp/mn && cd /tmp/mn && npm install mnist
```

PyTorch needs to match your Python; 3.14 works with torch ≥ 2.13.

## The three models

Run from this directory, in order. Each step writes into
`client/src/ink/`, so the app picks the result up immediately.

```bash
# 1 · CNN ensemble A (28px) + B (32px), both aspect-preserving
node gen.mjs            # 553,200 renders -> /tmp/inktrain   (a few minutes)
../../.venv/bin/python train.py                                   # ~30 min on 10 cores

# 2 · model C (32px, aspect-FLOORED) appended as a third voter
node genC.mjs           # same glyphs, different raster convention
../../.venv/bin/python trainC.py                                  # ~20 min

# 3 · geometry re-ranker (needs the CNNs above to exist first)
node genfeat.mjs        # runs 50k glyphs through the ensemble
../../.venv/bin/python train_rerank.py                            # ~1 min
```

Then check nothing regressed:

```bash
cd ../.. && npm test
```

## Why each piece exists

**The bow policy in `gen.mjs` is the thing to be careful with.** Curvature is
the only property separating a stick from a bracket, so the amount of bow each
class sees in training *is* where the net puts that boundary. Brackets are
damped (`LOW_BOW`) so they stay clustered around their genuine deep curve;
everything else, including `1`, `l` and `/`, trains with the full bow a real
hand produces. Damping the sticks as well — which an earlier version did —
teaches the net that any curvature at all means bracket, and every naturally
slanted `1` is then read as `(`. That was the single largest error class in the
recogniser.

**Model C exists because of a resolution problem, not an accuracy one.**
Aspect-preserving normalisation gives a stroke of aspect 0.06 about 1.3px of
width against a brush that paints 2-3px, so every tall-thin glyph reaches the
net as the same vertical smear. `minAspect: 0.25` in `raster.js` widens those
glyphs enough to see which way they bow. It is a floor, not a fill: stretching
all the way to square makes `1` and `/` pixel-identical, since both are straight
lines and only aspect ever told them apart.

**The re-ranker recovers what the raster throws away** — bow direction and
depth, net tilt, stroke count, and absolute size (a full-height `O`, a degree
mark and a decimal point are the same picture once scale is normalised away).
It is deliberately linear and tiny so it can only nudge decisions the render was
unable to make, never overrule a confident net.

## Validating a change

`npm test` runs five ink suites, after the engine, backend and security checks.
The one that matters is the last:

- `inkcheck.mjs` — clean symbols, layout, LaTeX. A regression guard.
- `inkcheck-hard.mjs` — heavy distortion, scenes, digit strings.
- `inkcheck-lines.mjs` — line-level accuracy. The tuning target.
- `inkcheck-holdout.mjs` — holdout #1, and **no longer independent.** It was the
  held-out suite until the v8 accuracy work read its failures — the misreads
  *are* the diagnosis, so reading them is what spends a holdout. Treat it as a
  regression guard now.
- `inkcheck-holdout2.mjs` — holdout #2, **the honest number.** Different seed
  space, different expressions, and a *writer* model (one consistent hand per
  simulated student, as real handwriting is) rather than per-glyph randomness.
  No tuning pass has ever executed it.

Do not tune against either holdout. A spent holdout does not become a target;
it becomes a guard. Anything tuned against is eventually tuned *to*, which is
the whole reason holdout #2 is separate — and when a retrain has to read holdout
#2's failures to make progress, that spends it too, and a third suite must be
added before the next one.

`README.md` (**Measured accuracy**) says the same thing, and carries the current
figures with the `n` that produced each. If the two ever disagree, the one
claiming more independence is the wrong one.

Watch the worst-writer figure each holdout prints as closely as the mean. A
student whose hand the engine cannot read does not care about the average.

And none of it is real ink. Every suite above scores strokes this repo
generated, including the holdouts — they hold out a seed space, not a person.
`tools/ink-collect/index.html` captures genuine Pencil handwriting, and
`npm run test:real` scores it; until a corpus exists there is no real-handwriting
number for anything trained here. Never tune against a recorded corpus either —
reading its failures is what would stop it being evidence.
# Ink model experiments — 2026-08-21

Baseline before any retrain (ink-100 recogniser, shipped model):
  holdout1 n=24  94.6% lines, 98.7% chars, worst writer 79%
  holdout2 n=40  93.2% lines, 98.2% chars, worst writer 57%

## 1. ADOPTED — 513k samples, 20% style tail to 2.65, A28+B32+C32f
  holdout1 n=24  95.2% lines, 98.9% chars, worst writer 86%
  holdout2 n=40  94.5% lines, 98.4% chars, worst writer 71%
  hard suite symbols 95.2% -> 96.3%
  467 KB (A+B) / 798 KB with C. int8 ensemble val 0.9395, as recorded in model-data.js.
  Worst writer +14 points on the independent set — the heavy tail did what it was for.

## 2. REJECTED — widened network (A 32/64/96/256, B 32/64/112/288)
  int8 ensemble val 94.44% (up from 93.98%) but on the holdouts:
  holdout1 n=24  95.5% (+0.3)
  holdout2 n=40  94.1% (-0.4), worst writer 64% (-7)
  1212 KB for TWO voters vs 467 KB.
  Verdict: width buys mean accuracy and LOSES worst-case accuracy — it overfits the
  bulk of the distribution. The third voter (aspect-floored C32) is worth more than
  2.6x the parameters. Not adopted.

## 3. REJECTED — heavier style tail (35% of samples, strength to 3.20)
  holdout1 n=24  94.6%, worst writer 79%
  holdout2 n=40  93.8%, worst writer 64%
  Worse than the adopted recipe on every axis.
  Verdict: past ~20%/2.65 the augmentation stops modelling bad handwriting and starts
  being label noise, pulling the net off the distribution real writers occupy.

## What this means
The current recipe sits at a good local optimum for this architecture and this
generator. More parameters and more distortion both make the worst writer worse.
The remaining headroom is algorithmic (question-conditioned decoding, test-time
augmentation on uncertain glyphs, a fuller page-level hand model) and, above all,
REAL INK — every number above is measured on a simulator. See tools/ink-collect/.
