# Final Pri Learning — governed Railway release automation

**Status (2026-10-20): STAGING READ-ONLY PROOF ENABLED AFTER MERGE; PRODUCTION PROMOTION DISABLED.**
This is an operations protocol, **not** certification or authorization to ship. The sole
source-of-truth development branch is protected `main`. Do not change production
secrets, source branch, database driver, volume, billing, or storage in this workstream.

## 1. Audited topology (exact baseline)

| Environment | Railway target | GitHub branch | Storage | Release identity |
|---|---|---|---|---|
| Staging | project `profound-spontaneity`, service `pri-learning-staging` | `main` | PostgreSQL via `PRI_DATABASE_URL`, no volume | Latest Railway deploy `98a30194caf349885a24b11d75edf01ac50df428` — runtime endpoints still require verification |
| Production | same project, service `Final-Pri-learning` | `deploy/production` | SQLite on `pri-learning-data`, mounted at `/data` | `169bcdfe798f6961908deafb1a2710da45ddba4c`; latest SUCCESS deployment `536de612-9d14-4046-b2da-ff869f65c817` |

Both Railway services were observed with `source.checkSuites: false` on
2026-10-20. GitHub CI **does not automatically prevent Railway from deploying a
new source-branch commit**. The critical control is restricting mutations to
`deploy/production`. Do not enable auto-promotion or merge a release-pointer PR.

Railway's *Wait for CI* feature is a distinct service setting; it only helps
when GitHub push check suites actually run on the source branch. Merely turning
it on cannot substitute for a verified push workflow on `deploy/production`,
required GitHub branch protection, and human release authorization. The normal
required CI jobs target PRs/main, so test the exact production-pointer event
before relying on any Wait for CI configuration.

## 2. Diagnosis: fleet-governance failure #39461096485

The failing run's actual `event` is `pull_request` for draft [PR #616]
(https://github.com/Priysharan19/Final-Pri-learning/pull/616):
`head.ref=main`, `base.ref=deploy/production`. It is **not** a push-to-main
run and the pre-existing `if: github.event_name == 'pull_request'` was obeyed.
The classifier treats `main` as an unauthorized governed-files PR head.
This is a *release-lane classification mismatch*, not a reason to exempt a
protected-main push from PR writer leasing. The fixed workflow explicitly
recognizes production-targeted PRs **and fails closed with an explanatory error**
rather than authorizing the PR merge. Normal `task/*`, `feature/*`, Dependabot
and `agent/mission/*` classifications remain intact. Active mission-leases
remain enforced for autonomous PRs.

**Do not merge #616**, even if it becomes technically mergeable: merging
`main` into `deploy/production` may create a different merge commit and would
trigger a production Railway deployment without the signed go/no-go record.
Keep it draft until it is retired/closed under a separately reviewed plan.

## 3. Permanent automated pathway and boundaries

1. A reviewed PR integrates through protected `main`; the existing
   `Main Integrity` workflow verifies actual merged-PR provenance and exact
   PR-head workflows. Required CI is defined in `docs/release/release-policy.md`.
2. Railway staging tracks `main` and automatically builds there. A completed
   successful `Main Integrity` **push** run triggers the *Release Staging Proof*
   workflow; a maintainer may also dispatch it on `main` for an exact SHA.
3. Proof workflow uses read-only permissions, does not use release secrets, and
   checks out that SHA. It requires the candidate to be on `origin/main`.
   It retries for up to roughly six minutes because Railway staging may
   be rolling out independently. `tools/verify-deployment.mjs` requires
   server and web release identities to agree, healthy/readiness endpoints,
   PostgreSQL schema and billing versions to match that checkout, and email
   provider readiness. It fails on old/new mismatched SHA.
4. A 30-day GitHub Actions artifact (`staging-proof-<run-id>`) contains the
   audited candidate and text of the exact-SHA smoke check. Failure is visible
   as a red workflow; operators must configure GitHub Actions failure
   notifications in their actual on-call route. This is **not** a 24-hour soak
   or a human journey test.
5. Operators independently run `node scripts/release-nominate.mjs <sha> --json`
   **outside** the concurrent proof workflow. It fails closed on incomplete or
   failing workflow runs, missing CI/container checks, mismatched staging SHA,
   schema mismatch, or a non-fast-forward production pointer.
6. **No automated production job exists.** The script only prints
   *hypothetical* commands; nobody may execute a pointer update without
   explicit release authorization and the gates below. Future deployment
   automation must be separately PR-reviewed, use a protected GitHub
   production environment with required reviewers, independent least-privilege
   identity, and a single SHA compare-and-swap lease on `deploy/production`.
   A mere `workflow_dispatch` input or repository variable is **not**
   sufficient authorization.

**Security boundaries:** Never execute code from `pull_request_target` or
an untrusted fork in a privileged job. Never use a broad contents-write token
for staging proof. Writer-leases are checked on autonomous PRs; PR #616 is a
production-promotion proposal, not a way around release approval.
`Release Staging Proof` never runs production migrations, backups, or deploys.

## 4. Mandatory activation gates (all initially UNVERIFIED)

- [ ] Exact candidate is a complete 40-character SHA in protected `main`;
      latest required workflows, the separate production-container job, and
      Main Integrity are successful; no known red, pending or cancelled run.
- [ ] Railway staging's /v1/health, /v1/ready and /release.json prove the
      **same exact SHA** and PostgreSQL schema expected by the checkout.
      Staging smoke artifact is retained and human-reviewed.
- [ ] A full **24-hour clean staging soak** after that actual deploy is
      recorded, with error-budget, restart and recovery metrics observed;
      absence of alarms is not sufficient evidence by itself.
- [ ] `tools/acceptance/staging-acceptance.mjs` A–F completes with tester
      evidence: adult OTP, child age-basis/guardian consent, cross-device sync,
      offline/retry, accounting/authorization isolation, typed and photo/ink
      grading, correction provenance, and account deletion/export.
- [ ] Actual iPhone, iPad, Android phone and Android tablet build/device matrix
      is measured; Pencil-specific claims require a real supported Apple device.
      An emulator/simulator does not count as physical-device certification.
- [ ] Independent academic examiner signs the marking/fairness dossier and
      reproduces adversarial step credit and no-model-awarded-mark boundaries.
- [ ] Owner-approved legal, child privacy, guardian consent, retention,
      data export and deletion evidence is linked and signed. Stores require
      their own approvals; one approved release is not store publication.
- [ ] Commercial acceptance: entitlement/webhook idempotency, renewals,
      refunds, platform store rules, and support recovery are certified.
- [ ] Production SQLite `/data` volume ID and mounted path are re-verified;
      take an **application-consistent verified backup**, test restore to an
      isolated resource, and prove restore integrity. Verify enough free space
      and retention. **A Railway image rollback does not reverse schema/data.**
- [ ] Separate database change assessment confirms **no production PostgreSQL
      cutover**. A future cutover requires its own approvals, data transfer,
      rehearsed rollback and the `postgres-cutover.md` checklist; never swap
      `PRI_DATABASE_URL` as part of a routine release.
- [ ] Named independent release reviewer, actual timestamp, approval
      identity, SHA, evidence links, rollback image ID, compatibility window,
      outage/error thresholds, response owner and production go/no-go are
      recorded in an immutable reviewed release record.
- [ ] Railway automatic deploy on `deploy/production` is explicitly treated
      as sensitive. Confirm branch rules including administrator enforcement,
      no force-push/deletion and required CI; the connector could **not**
      read branch-protection details (403), so do not assume the rules are set.
- [ ] Operator confirms a one-time *approved* fast-forward of exactly the
      attested main SHA, with expected old pointer SHA and post-change readback.
      No GitHub PR merge commits to the production pointer.

## 5. Governed promotion (documentation only; DO NOT RUN YET)

In a clean checkout, after all approvals have been independently recorded:

```bash
git fetch origin main deploy/production
node scripts/release-nominate.mjs <nominated-full-sha> --json
git merge-base --is-ancestor <nominated-full-sha> origin/main
git merge-base --is-ancestor origin/deploy/production <nominated-full-sha>
# RELEASE AUTHORIZATION REQUIRED HERE — no automatic push is configured.
```

The nominated SHA must be frozen. Re-read the pointer immediately before the
mutating operation; use a single non-force compare-and-swap update with the
recorded old SHA. Re-run verification after a successful deployment from the
nominated checkout:

```bash
npm run verify:deployment -- --origin https://final-pri-learning-production.up.railway.app \
  --sha <nominated-full-sha> --engine sqlite \
  --persistent-storage-proven --auth-email-proven
```

`--persistent-storage-proven` is permitted only with independent Railway
volume proof. `--auth-email-proven` verifies configured provider readiness,
not real account email delivery. Require separately recorded real sign-in tests.

## 6. Failure handling and rollback

- **PR/CI failure:** no merge, no production. Review failure logs and repair
  on a new task branch; never relabel failed jobs as skipped.
- **Staging identity/schema/readiness failure:** no nomination or production.
  Restore staging's correct source/variables and rerun proof. Do not turn off
  schema checks; staging remains PostgreSQL.
- **Post-promotion HTTP 5xx, wrong SHA, or guardian/marking failure:** stop
  further promotions, freeze pointer operations, page the named on-call owner,
  capture deployment/health evidence, and verify volume and schema safety.
  Prior Railway SUCCESS deployment
  `536de612-9d14-4046-b2da-ff869f65c817` is a *candidate* only:
  verify compatibility with the live SQLite schema and retained data before
  rollback. Railway image rollback also restores the deployment's recorded
  custom variables and may briefly interrupt a volume-backed service;
  scrutinize both effects. Snapshot or copy `/data` safely; never delete or
  overwrite it. Railway volume backup restoration stages a new mounted volume
  and retains the old one; it is a separate operator-governed database action.
- **Non-backward-compatible migration:** an image-only rollback may corrupt
  expectations. Follow a separate restore runbook using the rehearsed snapshot
  and explicit owner approval; no automatic database rollback.
- **Audit:** record UTC decision time, actor, exact candidate/pointer before
  and after, Railway deployment ID, health identity, test/soak evidence,
  production metrics, action taken and follow-up incident issue.

## 7. Remaining external setup

Configure a real notification channel for failed staging-proof/CI workflows;
validate Railway deploy-on-branch and GitHub branch protection in their
dashboards; establish real encrypted SQLite backup/restore drills and alerts.
Disable unnecessary Railway GitHub auto-deployment if branch controls cannot
be verified. Production promotion stays DISABLED until the full gate list and
a *separate* reviewed automation-activation PR are approved.
