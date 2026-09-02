# Physical Pri Ink result files

Place anonymised JSON result files from the physical-iPad production recognition path in this directory. Do not commit names, emails, account IDs, school IDs or unrelated student work.

Use the canonical participant allocation in `../../PHYSICAL_STUDY_PLAN.json` and the operator procedure in `../../PHYSICAL_STUDY_RUNBOOK.md`. Do not invent replacement writer codes after observing recognition quality, and do not inspect the final holdout during ordinary tuning.

Progress:

```bash
node client/test/ink-physical-study-plan-check.mjs
node scripts/ink-physical-study-status.mjs --split test
node client/test/ink-physical-release-evidence.mjs
```

No JSON result file is committed yet. Therefore physical production handwriting evidence remains **NOT MEASURED** until real runs are collected under `../../REAL_PENCIL_RELEASE_EVIDENCE.md`.
