# Real Apple Pencil corpus

This directory is the only repository evidence for arbitrary real handwriting. Synthetic writers and simulator benchmarks do **not** count as real-writer accuracy.

## Collect

From the repository root:

```bash
npm run ink:collect
```

Open the printed HTTPS address on the iPad and use an anonymous participant code. The collector accepts Pencil input only, records versioned consent, and deterministically assigns the participant to exactly one of `train`, `validation`, `test`, or `final-holdout`.

Save each downloaded `pri-real-ink-*.json` file in this directory.

## Audit before use

```bash
npm run test:ink:corpus:strict
```

Strict audit answers **whether collected data is trustworthy enough to use**. It rejects missing consent, manual/conflicting split assignment, writer/session leakage, finger samples, predicted-touch ground truth, malformed stroke data, and inadequate timing/dynamics coverage.

A passing integrity audit is **not** evidence that the recognizer is production-ready. A corpus can be perfectly well-formed and still contain too few writers or too few evaluation expressions.

## Release-evidence gate

Run the independent real-writer evidence gate before making any production-readiness claim:

```bash
node client/test/ink-release-evidence-gate.mjs
```

The gate re-checks writer isolation, detects byte-near duplicate/derived ink samples, scores only the writer-disjoint `test` split, and enforces the measurable Gate C floors from `handwriting/v12/PRODUCTION_STANDARD.md`:

- at least 20 test writers;
- at least 1,000 scored real-Pencil test expressions;
- exact expression accuracy >= 98.0%;
- character accuracy >= 99.5%;
- worst-writer exact accuracy >= 90.0%;
- critical-structure exactness >= 99.5%.

It intentionally does **not** invent native auto-mark precision from the legacy JS recognizer. That final Gate C metric must come from the native consensus/confirmation path on supported iPad hardware.

An undersized corpus is expected to fail this command. That failure is an evidence blocker to fix by collecting representative writer-disjoint data, not by lowering the thresholds.

## Split discipline

- `train`: gradients only.
- `validation`: model selection/early stopping.
- `test`: frozen-candidate evaluation.
- `final-holdout`: locked release evidence. Do not inspect individual errors or tune against repeated final-holdout runs.

Production real-Pencil evidence requires at least 20 writer-disjoint evaluation writers and 1,000 scored real-Pencil evaluation expressions, plus the accuracy/precision gates in `handwriting/v12/PRODUCTION_STANDARD.md`.

Do not commit names, emails, account identifiers, school identifiers, or unrelated student work into corpus files.
