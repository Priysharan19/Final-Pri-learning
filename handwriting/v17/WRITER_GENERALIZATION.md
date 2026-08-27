# Pri Ink V17 — Writer Generalisation Standard

## Objective

Pri Learning should recognise mathematical handwriting from people it has never seen before, not merely memorise one writer or a catalogue of hand-authored allographs.

No finite system can truthfully guarantee recognition of **all possible handwriting**. V17 therefore defines the production target as high-accuracy, calibrated recognition across a deliberately broad, writer-disjoint population, with safe abstention when the ink is genuinely ambiguous.

## Integration status

V17 is rebuilt from the current production `main` rather than merged from the diverged V16 branch. This preserves the newer JEE notation, structural decoding, curriculum, diagnosis and iPad work while carrying forward the tested V4 writer-generalisation foundation. PR #45 is therefore a source lane, not the release branch.

**V4 remains the ML architecture/checkpoint version. V17 is the Pri Ink product/release lane.** Renaming the model files to V17 would falsely imply a new checkpoint format and would break append-only compatibility guarantees.

The current repository has one substantial real Apple Pencil writer corpus. That writer is useful for plumbing and train-split diagnostics, but it is not evidence of unseen-writer generalisation. V17 deliberately keeps production promotion locked until writer-disjoint evidence reaches the minimum scale below.

## What changed

V17 introduces the V4 foundation-model track without replacing the current production recogniser:

1. **Coherent raw-stroke style augmentation.** Slant, aspect ratio, page rotation, baseline curvature, point density, pressure, width and writing speed are perturbed once at the raw-ink level. Stroke and raster encoders always see the same transformed handwriting.
2. **Writer-adaptive style path.** A style embedding is retained so the model can exploit stable characteristics of a writer when useful.
3. **Writer-invariant content path.** A gradient-reversal adversary makes the mathematical representation actively discard writer identity rather than accidentally encoding it.
4. **Style dropout.** The decoder is regularly denied the style vector, preventing dependence on a known writer.
5. **Two-view consistency.** Two independently transformed versions of the same expression must agree at both the token distribution and content-embedding level.
6. **Physical-stroke CTC remains first-class.** The model still learns the marks actually drawn, separately from serialization-only syntax such as power wrappers.
7. **Generalisation stress evaluation.** Frozen checkpoints are evaluated on real unseen writers and repeated plausible style shifts. A prediction is only `robust` when the original and every perturbation remain correct.
8. **Corpus diversity audit.** Synthetic transforms never count as new writers. The audit measures real writer counts, split integrity, samples, vocabulary coverage and capture-style variation.
9. **Dual-gated Core ML promotion.** V4 can be exported for development at any time, but it cannot be marked production-ready unless the exact checkpoint passes both the locked final-holdout release report and the real unseen-writer generalisation report.
10. **Executable CI smoke.** CI compiles every V4 module, runs architecture/vocabulary checks, generates a writer-disjoint mini-corpus, performs an actual one-epoch CPU training run, verifies the resulting checkpoint identity and audits the current real corpus.
11. **Coverage cannot hide behind sample count.** Production data readiness requires real multi-writer exposure for every supported V4 token; a large corpus that omits hard notation is still not ready.

## Production data policy

Writer identity is an anonymous corpus code only. The existing split assignment is retained permanently so the same person cannot leak from training into validation/test/final-holdout.

The collection target is **100+ independent training writers**. The repeatable engineering **test split itself** must contain at least **20 independent unseen writers and 1,000 real expressions** before broad writer-generalisation claims. Final-holdout writers/samples never fill a missing test quota: final-holdout is reserved for a frozen release candidate, not routine readiness accounting.

Sample count alone is insufficient. For every non-special token in the V4 vocabulary, the real corpus must contain that token from at least **5 independent training writers**; the test split must contain it from at least **3 independent writers** and at least **5 total occurrences**. These are minimum diversity floors, not evidence that five examples are enough to estimate per-symbol accuracy precisely.

Recruit for variation in the handwriting itself rather than demographic profiling: printed/cursive/mixed construction, upright/slanted writing, small/large glyphs, narrow/wide aspect, slow/fast writing, light/heavy pressure, connected/disconnected strokes, unusual but legitimate stroke order, left/right handed capture when volunteered, and common mathematical allographs.

The corpus should deliberately include hard confusable families: `1/l/I`, `0/O/theta`, `2/z`, `5/s`, `6/b`, `8/B/3`, `9/g/q/4`, `x/times`, `u/v`, `r/v`, `c/e`, plus primes, decimal points, minus/fraction bars, powers, subscripts, roots, brackets, inequalities, trigonometric notation and calculus notation.

## Promotion gates

A V4 checkpoint is not a production model merely because training loss is low. Promotion requires all of the following evidence:

- no writer leakage across splits;
- at least 100 real training writers with at least 40 valid expressions each;
- test evaluation on real writer-disjoint data;
- at least 20 **test** writers and 1,000 **test** expressions, excluding final-holdout;
- every supported non-special token represented by at least 5 training writers;
- every supported non-special token represented by at least 3 test writers and 5 test occurrences;
- base exact accuracy >= 98%;
- style-perturbed exact accuracy >= 97%;
- robust exact accuracy >= 95%;
- worst-writer base and robust exact accuracy >= 90%;
- prediction flip rate under style shift <= 2%;
- critical-structure robust exact accuracy >= 98%;
- existing safe-precision/abstention and final-holdout rules continue to pass.

The untouched final holdout remains locked during tuning. Style perturbation is a stress test, never a substitute for real people. **Do not lower an existing handwriting floor to promote V4.** A candidate that cannot meet the current release contract stays a candidate.

## Commands

Audit the real corpus:

```bash
python tools/ink-foundation/audit_writer_diversity.py --corpus client/test/ink-corpus
```

Run fast architecture checks:

```bash
python tools/ink-foundation/test_writer_generalization.py
```

Fine-tune V4 from an existing compatible checkpoint:

```bash
python tools/ink-foundation/train_v4.py \
  --corpus client/test/ink-corpus \
  --init tools/ink-foundation/runs/pri-ink-foundation-v3.pt \
  --out tools/ink-foundation/runs/pri-ink-foundation-v4.pt
```

Stress-test the unseen-writer test split:

```bash
python tools/ink-foundation/evaluate_writer_generalization.py \
  tools/ink-foundation/runs/pri-ink-foundation-v4.pt \
  --corpus client/test/ink-corpus \
  --split test \
  --perturbations 8
```

Export a development-only V4 Core ML candidate:

```bash
python tools/ink-foundation/export_coreml_v4.py \
  tools/ink-foundation/runs/pri-ink-foundation-v4.pt \
  --out ios/PriLearning.swiftpm/Resources/Models/PriInkFoundation.mlpackage
```

Only after the exact checkpoint passes both evidence tracks may it be exported as production-ready:

```bash
python tools/ink-foundation/export_coreml_v4.py \
  tools/ink-foundation/runs/pri-ink-foundation-v4.pt \
  --release-report tools/ink-foundation/runs/pri-ink-foundation-v4-final-holdout.json \
  --generalization-report tools/ink-foundation/runs/pri-ink-foundation-v4-test-writer-generalization.json \
  --out ios/PriLearning.swiftpm/Resources/Models/PriInkFoundation.mlpackage
```

Use `--enforce` only when the corpus is large enough for the production evidence gates. Do not unlock final-holdout merely to improve a score.

## Current evidence and next data milestone

The live V17 audit currently finds **1 real writer / 50 train expressions / 0 test writers**, and **49 of 86 non-special V4 tokens** appear in that writer's real corpus. That is enough to exercise the pipeline and nowhere near enough to claim generalisation.

V17 makes the existing data more useful and gives the model the correct inductive bias, but **new independent real writers are now the highest-leverage input**. Until those writers are collected, universal-handwriting claims would be unsupported regardless of how sophisticated the network becomes.

The next evidence milestone is therefore operational rather than architectural: collect independent writers under the existing consent/anonymisation protocol, keep test/final-holdout writers untouched, then train and evaluate V4 writer-disjoint. Failure clusters should be fixed from training/validation evidence; the locked final holdout is only for promotion decisions.