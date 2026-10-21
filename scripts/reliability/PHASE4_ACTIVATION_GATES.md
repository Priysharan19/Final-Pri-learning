# Phase 4 — controlled integration, NOT production authorization

Status: **fail closed; not activated**. All code under this directory must execute
from protected-main source, never a contributor-controlled PR checkout. The
GitHub App and Postgres tests are engineering evidence, not live certification.

## Confirmed on the personal public repository (21 October 2026)

* User-owned repository branch ruleset `Restrict updates` worked on an isolated
  branch. Owner direct Git push was rejected (`GH013`) and REST ref PATCH was
  rejected (`422`), while a separate isolated ruleset with the owner in the
  exact bypass list allowed a harmless fast-forward push and GitHub recorded
  the bypass. All temporary refs/rulesets were deleted; `main` unchanged.
* Attempting a ruleset bypass using GitHub Actions integration id `15368`
  returned 422: `Actor GitHub Actions integration must be part of the ruleset
  source or owner organization`. This is **not** evidence against a newly
  installed, repository-authorized dedicated GitHub App.
* GitHub branch protection remains strict, requires one independent review,
  last-push approval, stale-review invalidation, conversation resolution and
  four product checks pinned to GitHub Actions id 15368.
* No installed independent signing/verification/merger App, protected private
  signing key, reviewed public key or signed non-genesis admission event is
  verified. No live positive App bypass or merger proof exists.

## Minimum external custody work (owner + independent reviewer)

1. In https://github.com/settings/apps create three **separate** GitHub Apps,
   not owned by a developer-controlled PR: `pri-governor-signer`,
   `pri-governor-verifier` and `pri-governor-merger`. Limit installation to this
   one repository. Distinct App IDs and private keys; no App credentials in code,
   issues, ordinary Actions artifacts, chat or PR comments.
2. Signer: metadata/read, contents/write **only through admission-ref
   operations in its protected runtime**, issues/write only for signed-ledger
   reconciliation, PR/read; independently protect Ed25519 signer key. Verify
   public-key correspondence; commit only the public key through QA review.
3. Verifier: metadata/read, contents/read, PR/read, issues/read, checks/write,
   administration/read. It must run approved protected-main code and publish
   `Pri Trusted Governor / Source Authorization` at the exact candidate head.
   It must not have contents/write or the merger's bypass identity.
4. Merger: metadata/read, contents/write, PR/write, checks/read, issues/read,
   administration/read. This App alone may appear as `Integration` bypass
   actor in a `Restrict updates` main-branch ruleset. It must never hold the
   Ed25519 key or the verifier check-writing credential.
5. First prove an installed App's positive bypass on an isolated branch with
   matching negative human and REST-push tests; retain API receipts. The earlier
   user-role bypass proof is not sufficient. Do not modify `main` rules.
6. Provision a **separate dedicated control-plane PostgreSQL database**;
   run `scripts/reliability/sql/001_trusted_merger.sql` only there, with a
   tightly scoped service role inaccessible to product runtime and PR CI.
   Deploy exactly one independently governed serial merger; make all signer
   commands use the **same** durable transaction lock and emergency queue.
   Test durable replay, lock loss, signer crash, revocation priority and
   ambiguous GitHub merge recovery under real App identities.
7. Only after tests, require the verifier check from the actual verifier App
   in addition to existing four required checks, and add the main-branch
   `Restrict updates` ruleset with only the merger App in bypass. Read back
   both controls; test non-App denial and App-mediated reviewed merge. Never
   relax classic protections or give human-role main bypass.
8. Exercise real GRANT/RENEW/RELEASE/REVOKE and pre-existing green status
   invalidation before authorizing any production writer admission. On
   emergency, set the durable shutdown fence, stop merger issuance, revoke
   compromised source, and require fresh independent certification.

## Unproven boundaries / mandatory stop conditions

* `pri-trusted-check-publisher.mjs` intentionally throws
  `SERIAL_MERGE_AND_REVOCATION_INTERLOCK_NOT_ACTIVATED`: leave that gate in
  place until independent human-authorized deployment evidence warrants
  removing it. Do not fabricate the trusted-App check's success.
* `pri-serial-merge-controller.mjs` implements a fail-closed orchestration
  contract; the deployed GitHub App transport, verified HMAC ingress, durable
  Postgres store, signer adapter and protected-main evaluator must still be
  connected and independently certified. The existing manual workflow signer
  does not yet use the new shared queue and MUST remain inactive.
* An ordinary GitHub commit check may remain green after a later signed
  revocation. Physical exclusivity and shared signer/merger serialization are
  required. Even then, sudden App credential compromise, administrator
  reconfiguration or distributed network failures require a defined security
  envelope. Do not claim unconditional zero-race proof from mocks or local DB.
* #625 requires genuine Kalp-Bajpai `APPROVED` review at its exact final SHA
  and all current checks. #626 remains stacked/draft until #625's legitimate
  merge, retarget, fresh CI, and independent approval. Never bypass protection.
* No Railway, `deploy/production`, student schema or App Store/Play release
  may be changed by this governor activation preparation.
