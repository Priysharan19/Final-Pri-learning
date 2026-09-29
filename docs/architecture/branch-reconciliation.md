# Branch Reconciliation Ledger

Audit base: `main` = `33e7b6c9bb06b65f00a9f38f88a678a333eec80f`

The PRI-01 inventory found 179 remote refs; 108 branches contained commits not reachable from the audit-base `main`. This count is an inventory signal, not a merge queue. History is preserved.

## Current, deliberately unmerged work

| Branch | Main relationship at audit | Classification | PRI-01 action |
| --- | --- | --- | --- |
| `agent/mission/math-reasoning/nsw-stage6-cohort-versioning` | 4 ahead / 0 behind; PR #220 | current feature work | leave for its owning PR; no PRI-01 import |
| `agent/mission/platform/nsw-stage6-profile-persistence` | current PR #222 | current dependent feature work | leave for its owning PR; no PRI-01 import |
| `scholarship/kalp-pilot-evidence-export` | PR #144 | non-release product/evidence lane | no PRI-01 import |
| `marketing/commercial-launch` | PR #37; old divergent base | historical/unmerged commercial lane | preserve; no bulk import |
| `agent/ipad-device-qa` | PR #18; old divergent base | historical device-QA lane | preserve; reconcile only if its owner revives it against current main |

## Representative divergent release/integration branches

| Branch | Unique / main-only commits | Assessment |
| --- | ---: | --- |
| `release/production-readiness` | 10 / 3 | broad old candidate; changes overlap later main privacy, guardian, legal and platform work; not a release authority |
| `integrate/session-fixes` | 28 / 15 | broad integration snapshot containing many later-main capabilities; unsafe to merge wholesale |
| `fix/ink-cloud-defects` | 2 / 15 | old handwriting/marking fix snapshot; current main contains the evolved cloud/marking surfaces |
| `release/cloud-handwriting` | 8 / 18 | old release candidate; cloud handwriting/working now exists on main through later integration |

## Historical branch families

Very old `agent/*`, handwriting, explain/reason, backend-foundation, release-wave and generated-sync branches diverge by tens to more than one thousand `main` commits. They are retained as history/source material, not production candidates. A future owning task may cherry-pick a specifically proven missing change only after comparing it to current `main` and rerunning affected gates.

PRI-01 intentionally deletes no branch and imports no unrelated feature. This avoids both loss of useful history and accidental resurrection of superseded architecture.

## Reconciliation procedure for future work

Before importing any branch commit: record source SHA and merge-base; inspect unique files/commits; prove the capability is absent from current `main`; check architecture compatibility; integrate the smallest justified change; rerun affected regression gates on the resulting tree. The production authority remains `Priysharan19/Final-Pri-learning` / `main` throughout.
