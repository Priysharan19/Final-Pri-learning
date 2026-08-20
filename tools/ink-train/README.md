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
node gen.mjs            # ~250k training renders -> /tmp/inktrain   (a few minutes)
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

`npm test` runs four suites. The one that matters is the last:

- `inkcheck.mjs` — clean symbols, layout, LaTeX. A regression guard.
- `inkcheck-hard.mjs` — heavy distortion, scenes, digit strings.
- `inkcheck-lines.mjs` — line-level accuracy. The tuning target.
- `inkcheck-holdout.mjs` — **the honest number.** Different seed space,
  different expressions, and a *writer* model (one consistent hand per
  simulated student, as real handwriting is) rather than per-glyph randomness.

Do not tune against the held-out suite. Anything tuned against is eventually
tuned *to*, which is the whole reason it is separate.

Watch the worst-writer figure it prints as closely as the mean. A student whose
hand the engine cannot read does not care about the average.
