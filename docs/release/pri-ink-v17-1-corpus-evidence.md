# Pri Ink V17.1 — real-writer corpus evidence hardening

Pri Ink V17.1 moves the handwriting programme from one-writer diagnostics toward the evidence needed for arbitrary new students. This lane is deliberately about **real independent writers and trustworthy evaluation**, not another screenshot heuristic or synthetic-accuracy claim.

## Why this lane exists

The V17 release standard requires at least:

- 100 independent train writers;
- at least 40 real Pencil expressions for every train writer;
- 20 writer-disjoint routine `test` writers;
- at least 1,000 real Pencil `test` expressions;
- broad V4 token coverage across independent train/test writers;
- no unknown targets, writer leakage, or duplicate sessions;
- a locked `final-holdout` that routine development tooling does not inspect.

Before V17.1, two evidence-management problems could undermine those claims:

1. `ink-corpus-status.mjs` still displayed the older 40-train-writer target and iterated final-holdout samples while reporting progress.
2. `audit_writer_diversity.py` did not read the collector's canonical `writer.sessionId` field, so two saved files from the same physical session could escape its duplicate-session gate.

V17.1 fixes both and adds a machine-gated collection campaign planner.

## Source of truth

`tools/ink-foundation/corpus_policy.json` owns the V17.1 corpus thresholds and evidence-firewall rules. Routine readiness tools consume this policy instead of carrying independent writer/sample constants.

The final holdout is metadata-only during routine work. Routine tools may register that an anonymous writer/session exists, but they do not inspect holdout targets, strokes, token coverage, style statistics, sample counts, or failure details.

## Commands

Check the human-readable collection status:

```bash
node client/test/ink-corpus-status.mjs
```

Run the machine-readable V17.1 writer-diversity audit:

```bash
python3 tools/ink-foundation/audit_writer_diversity.py \
  --corpus client/test/ink-corpus \
  --out /tmp/pri-ink-v17-1-readiness.json
```

Generate the next recruitment/collection wave, including anonymous participant codes that already map deterministically to the required split:

```bash
python3 tools/ink-foundation/plan_collection_campaign.py \
  --corpus client/test/ink-corpus
```

For machine-readable output:

```bash
python3 tools/ink-foundation/plan_collection_campaign.py \
  --corpus client/test/ink-corpus \
  --json \
  --out /tmp/pri-ink-v17-1-campaign.json
```

Each code must be assigned to exactly one real person and never recycled for another writer. Synthetic variants never count as additional writers.

## Permanent regression gate

`.github/workflows/ink-corpus-evidence.yml` checks:

- V17.1 policy thresholds;
- canonical `writer.sessionId` duplicate detection;
- deterministic participant-code split allocation;
- Node status-tool holdout opacity;
- Python readiness/campaign holdout opacity;
- current corpus report generation without requiring the corpus to be release-ready.

This gate proves the **evidence machinery** behaves correctly. It does not prove real-world handwriting accuracy. That still requires collecting the independent-writer corpus and passing the frozen model-quality gates.
