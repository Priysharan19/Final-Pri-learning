# Pri Learning verified completion dashboard

This dashboard is intentionally evidence-driven. It never stores a hand-entered completion percentage.

## Mathematical definition

For a department with `N` mandatory verification gates and `P` passing gates:

```text
verified_completion = 100 × P / N
```

All mandatory gates have equal weight. There are no subjective weights and no manually assigned percentages.

Overall completion uses the set of **unique** mandatory gates referenced by all departments, so a shared gate is not double-counted:

```text
overall_verified_completion = 100 × unique_passing_gates / unique_required_gates
```

A required gate with missing, stale, unparseable, or failed evidence is **not passing**. It is never silently removed from the denominator.

Accuracy and quality measurements such as handwriting line accuracy, worst-writer accuracy, self-check counts, and route coverage are shown separately. They are not blended into the completion percentage.

## Evidence sources

The audit reuses the repository's existing production gates instead of inventing new success thresholds. Numeric floors are read directly from `.github/workflows/ci.yml`, so CI remains the source of truth.

Evidence includes:

- the 672,000 question-engine self-check gate and multipart checks;
- backend check count and 51-route coverage;
- security suite coverage;
- deterministic handwriting accuracy, hard, line, holdout, worst-writer and context gates;
- fresh production client build;
- browser E2E flows;
- accessibility gate;
- iOS bundle synchronisation;
- real Pencil corpus measurement (missing/unmeasured real ink fails this gate);
- JS↔Swift native ink bridge validation;
- native PencilKit/Vision simulator validation on macOS;
- repository-level presence of the production subsystems the app claims to ship.

## Local run

A full local audit is:

```bash
npm ci --prefix client
npx playwright install chromium
node tools/completion/audit.mjs --run
```

On macOS, `--run` also runs the native iPad ink checks. On non-macOS systems those native gates remain unmeasured and therefore fail, rather than being guessed.

Outputs:

```text
artifacts/completion/completion-report.json
artifacts/completion/index.html
```

The HTML contains the report inline, so it can be opened as a standalone audit snapshot.

## GitHub Actions

`.github/workflows/completion-dashboard.yml` runs the Linux/browser evidence and the native macOS evidence independently, aggregates them by commit SHA, and uploads both the JSON report and the rendered dashboard as the `completion-dashboard` artifact.

The dashboard is recalculated from fresh tests on every push and pull request. It is therefore a measurement of the tested commit, not a manually maintained project-management estimate.
