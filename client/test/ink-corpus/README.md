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

Strict audit rejects missing consent, manual/conflicting split assignment, writer/session leakage, finger samples, predicted-touch ground truth, malformed stroke data, and inadequate timing/dynamics coverage.

## Split discipline

- `train`: gradients only.
- `validation`: model selection/early stopping.
- `test`: frozen-candidate evaluation.
- `final-holdout`: locked release evidence. Do not inspect individual errors or tune against repeated final-holdout runs.

Production real-Pencil evidence requires at least 20 writer-disjoint evaluation writers and 1,000 scored real-Pencil evaluation expressions, plus the accuracy/precision gates in `handwriting/v12/PRODUCTION_STANDARD.md`.

Do not commit names, emails, account identifiers, school identifiers, or unrelated student work into corpus files.
