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
| `Priysharan19/Pri-Learning-India` | historical/migration source | non-authoritative; code may be considered only by explicit SHA-level reconciliation. Its hosted shell at `pri-learning-staging.vercel.app` is a **retired host** (below) |
| `Priysharan19/Pri-Forge` | separate engineering/automation project | not a Pri Learning production predecessor |
| `Priysharan19/Pri-money` | separate project | not a Pri Learning production predecessor |

## Hosted origins

The only hosts whose running build can be release evidence are the two Railway services that
deploy this repository (`docs/release/release-policy.md`, "Staging first, production by promotion"):

| Role | Origin | Deploys |
| --- | --- | --- |
| **Staging** | `https://pri-learning-staging-staging.up.railway.app` | every push to `main` |
| **Production** | `https://final-pri-learning-production.up.railway.app` | the branch `deploy/production`, a pointer fast-forwarded to a certified `main` SHA |

A host is authoritative for a claim only when its `/v1/health` `releaseIdentity` names this
repository and `main` and reports the exact SHA under discussion; `node scripts/release-nominate.mjs <sha>`
and `npm run verify:deployment` check exactly that.

### Retired host: `pri-learning-staging.vercel.app` (issue #427)

`https://pri-learning-staging.vercel.app` is the Vercel deployment of the **predecessor repository
`Priysharan19/Pri-Learning-India`** (branch `release/v1`). On 10 October 2026 it was observed serving
that repository's Next.js "Pri Learning India" shell at Vercel SHA `0216aae8f3c301c2c8f6dab7d7e5ea21247c4483`:
typed answers only, no handwriting or photo reading, not the examiner's-notebook product on `main`
(issue [#427](https://github.com/Priysharan19/Final-Pri-learning/issues/427)). It never deployed this
repository.

Classification: **retired, non-authoritative.** Nothing observed on it is evidence about Pri Learning,
and no checklist, acceptance run or release record may cite it. Staging means the Railway staging origin
above. Taking the Vercel deployment down or redirecting it is an owner action on the Vercel account
(`BLOCKED_EXTERNAL`); until then the host may still answer, and still proves nothing.

## PRI-01 live audit

At 2026-09-29T18:44:37Z, GitHub reported `main` at `33e7b6c9bb06b65f00a9f38f88a678a333eec80f`, with no branch protection and no repository rulesets. PRI-01 therefore began from a fresh clone of that remote SHA.

During PRI-01, branch protection was applied to `main`: changes require a pull request, strict/up-to-date status checks, conversation resolution, blocked force-push/deletion, and enforcement for administrators. The required pre-merge contexts are `Suites, coverage and accuracy gates`, `Production account, sync and commercial schema`, `Browser suites (end-to-end and accessibility)`, and `Client build and offline-first boundary`.

A separate launcher checkout was on local `main` at `a0627e601f30f9e2ba18518fba26344de7094b09`, 69 commits behind fetched `origin/main`, with untracked local runtime state. It is not release authority and PRI-01 did not modify or clean it.

Open product PRs and historical branches remain evidence/history, but none changes authority until merged through the production process. See `docs/architecture/branch-reconciliation.md`.

## Reconciliation rule

Code from any predecessor repository or divergent branch must be evaluated by source SHA, merge-base, existing-main equivalence, architectural compatibility and affected regression gates. Never bulk-merge or copy code merely because it appears newer or more complete.
