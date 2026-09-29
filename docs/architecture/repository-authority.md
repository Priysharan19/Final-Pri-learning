# Repository Authority

Status: **authoritative production declaration**

Production repository: `Priysharan19/Final-Pri-learning`

Production integration/release branch: `main`

No other repository, local clone, release branch, agent branch, generated iOS bundle or deployment artifact is a production source of truth. A running build is authoritative only when its release identity names this repository/branch and reports the exact source SHA.

## Change authority

Normal production changes are developed on a task/feature branch and reach `main` through a pull request after the repository's real required checks pass. A newer timestamp, a locally modified clone, an unmerged branch or a feature present elsewhere is not evidence that code belongs in production.

The canonical release identity is defined by `release/metadata.json` plus the exact build SHA/timestamp resolved by `release/release-identity.mjs`. The web build emits `release.json`; `/v1/health` reports the server identity; the native shell exposes the same bundled identity through `window.__PRI_NATIVE_RELEASE_IDENTITY__`.

## Repository inventory

| Repository | Classification | Authority |
| --- | --- | --- |
| `Priysharan19/Final-Pri-learning` | current production repository | **authoritative** on `main` |
| `Priysharan19/Pri-Learning-India` | historical/migration source | non-authoritative; code may be considered only by explicit SHA-level reconciliation |
| `Priysharan19/Pri-Forge` | separate engineering/automation project | not a Pri Learning production predecessor |
| `Priysharan19/Pri-money` | separate project | not a Pri Learning production predecessor |

## PRI-01 live audit

At 2026-09-29T18:44:37Z, GitHub reported `main` at `33e7b6c9bb06b65f00a9f38f88a678a333eec80f`, with no branch protection and no repository rulesets. PRI-01 therefore began from a fresh clone of that remote SHA.

A separate launcher checkout was on local `main` at `a0627e601f30f9e2ba18518fba26344de7094b09`, 69 commits behind fetched `origin/main`, with untracked local runtime state. It is not release authority and PRI-01 did not modify or clean it.

Open product PRs and historical branches remain evidence/history, but none changes authority until merged through the production process. See `docs/architecture/branch-reconciliation.md`.

## Reconciliation rule

Code from any predecessor repository or divergent branch must be evaluated by source SHA, merge-base, existing-main equivalence, architectural compatibility and affected regression gates. Never bulk-merge or copy code merely because it appears newer or more complete.
