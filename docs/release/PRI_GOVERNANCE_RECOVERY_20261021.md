# Pri Learning P0 Governance Recovery — 21 October 2026

## Trust / evidence statement

Baseline protected main: `29b7d92d59ffed9b0fca9da8df15d4224c0e8519`.
This is a QA-owned **source and test recovery candidate**, NOT a production-authorized
admission system or release. Its controller source must be independently approved,
merged through protected main and tested on GitHub before activation. The proposed
reliability-owned `.github/workflows/pri-writer-authority.yml` is deliberately
**not** included in this PR and must be reviewed and integrated separately.

### Verified external facts

- On initial audit, `main` required 0 approving reviews and permitted stale approvals.
- Owner-level GitHub branch protection was then raised to exactly 1 formal approval,
  dismiss stale approvals and require approval after last push. Four existing required
  status checks were preserved, strict=true, and pinned to the observed official
  GitHub Actions application id `15368`. Admin enforcement and prevention of
  force-push/deletion remained on. These configuration changes are live, external to Git.
- The `pri-writer-admission` GitHub environment exists with reviewer Kalp-Bajpai,
  prevent-self-review enabled and branch-policy restriction.
- The protected admission branch remained at genesis SHA
  `43390383a4ad5ea51315756094d0075b4477b9ed`; the event log is empty.
- `.pri-os/admission-public-key.pem` does NOT yet exist on protected main. The
  required `PRI_GOVERNOR_APP_ID`, private GitHub App credential and signing-key
  secrets were not observed in the inspected repository configuration.
- Complete paginated managed mission issue inventory: 74 total, 9 open.
  Legacy closed #172, #207 and #577 retain historical write-state markers.
  Open #603 is in CI without a pinned `Pri-Review-Head`; it requires truthful,
  exact-PR-head reconciliation under independent QA oversight.
- PRs #492, #495, #496 and #497 were closed, not merged; #492 received formal
  CHANGES_REQUESTED review due to untrusted PR self-authorization. This patch
  borrows selected tested ideas only; it does not import their unsafe CI design.

## Source safety design

The QA-owned controller requires a signed Ed25519 event log with pinned Git
ancestry and append-only transitions, domain-separated repo/policy/signer,
unique grant identity, bounded 12-hour leases, revocation, strict issue/PR
identity, two-writer cap and denial of overlapping critical write scopes.
Renames, copies and deletions are checked against both source and destination
paths, with canonical path normalization and owner verification.

An ordinary `admit` command is an **advisory DENY** until the protected serial
issuer is operational. This branch does not issue a real grant. The existing
main fleet PR workflow still depends on candidate checkout source and is NOT a
sufficient independent authorization check. All production-authorization claims
remain prohibited until a distinct trusted-verifier status is configured and
required at the actual PR SHA, independent of candidate code or writable tokens.

## Mandatory rollout order

1. Independent security (Kalp-Bajpai) + QA/reliability review of this exact
   source candidate; resolve all inline comments and host checks, no weakening.
2. Merge reviewed QA-owned source using protected main, not a bypass.
3. Have the legitimate signing custodian create protected Ed25519 private-key
   material without committing it; commit its public key under reviewed QA
   ownership. Independently attest public/private correspondence and rotation.
4. Independently provision a dedicated least-privilege GitHub App with approved
   ruleset authority to append only on the protected admission ref; provision
   protected environment credentials. No ordinary PR job may access signing keys.
5. Independently review and merge reliability-owned protected dispatcher workflow.
   Verify that its checkout uses protected main, the required reviewer controls
   are live, and unavailable authority fails closed.
6. Repair exact-head historical and active mission markers truthfully. In
   particular, verify #603's source PR/head and freeze review without a writer
   grant; never fake DONE or use unrelated comments as lease heartbeats.
7. Install a trusted external/privileged verifier whose resulting required
   status is bound to the PR exact head and an independently controlled app,
   not a job that a candidate PR can rewrite to report green. Enforce manual
   branch scope and automatic mission signed-authority checks uniformly.
8. Controlled non-production GitHub exercise: grant, deny last-slot collision,
   renew, revoke, attempt stale replay, deny post-revoke writes, recovery after
   issue-update crash, and no external production environment changes.
9. Verify the resulting protected main SHA, current-head CI, branch protection,
   independent reviewer and release pointer isolation.

### Safety blockers

This PR alone does not satisfy the above conditions, and its passing tests
cannot substitute for protected authority transaction evidence. Do not activate
admissions, auto-merge review-gated code, rotate production credentials,
change `deploy/production`, or deploy Railway through this candidate.

## Phase 2 signed lifecycle (21 October) — implementation candidate

- Writer GRANT -> checkpoint RENEW -> signed RELEASE is deliberately distinct from
  emergency REVOKE. RELEASE is allowed only from truthful TESTING while the
  signed checkpoint is unexpired and exactly equals the reviewed PR head.
- A RELEASE removes write authority and preserves a signed immutable
  `Pri-Review-Head` + `Pri-Provenance-Event` for REVIEW/CI/MERGE_READY. The
  source remains reviewable after normal 12-hour lease expiration; a later
  malicious REVOKE invalidates source eligibility.
- Historical cap, owner, scope, temporal and source-base consistency are
  checked after every event in the authenticated chain, not just at current
  time. Expired historical leases do not falsely consume concurrent slots.
- Protected signed Git CAS is first; editable issue status is a separately
  reconciled projection. `RECONCILE` is idempotent and must use independent
  environment approval. After CAS success + issue patch failure, authority
  remains the signed chain, the workflow fails visibly, and repeat RECONCILE
  is required. No issue edit grants permission.
- `verifyReleasedSource` checks source PR, main, mission, exact release digest,
  head SHA and scope. `verifyMergePolicy` additionally checks signed provenance
  (autonomous lanes), live permissions/human reviews, last pusher exclusion,
  source file owners, risk owners and pinned current-head hosted checks.
  Legitimate task/* and feature/* branches retain the manual reviewed lane.
- Code in the candidate checkout remains NOT trusted to authorize its own
  merge. A distinct, installed, independently controlled GitHub App with
  checks:write must execute protected-main code and publish the required status.
  A green status from GitHub Actions App 15368 is NOT sufficient proof.
- Native GitHub required checks are commit-based and a previously green check
  need not automatically fail at the exact time of a later authority revocation.
  Until the application has an enforced serialized just-in-time merge control,
  revocation-aware webhook revalidation and a pinned required check source,
  **DO NOT MERGE OR ACTIVATE** autonomous governance. This remaining platform
  and credential dependency must not be represented as solved by passing tests.

**Added QA tests:** `client/test/pri-source-provenance-check.mjs` and
`client/test/pri-trusted-merge-policy-check.mjs`.
