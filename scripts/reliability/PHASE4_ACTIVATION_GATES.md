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
   reconciliation, PR/read, administration/read for actual main/authority
   protection checks, actions/read to verify genuine approved workflow runs; independently protect Ed25519 signer key. Verify
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

## Phase 4B — exact post-merge setup inventory (2026-10-21)

Protected QA PR #625 merged from independent-approved `e3bc0c0e2df092db37113cc24d216d7abd172844`
via native GitHub merge commit `32dbed8e2ae70b90ee47bfa087713b84960b56b4`.
PR #626 is reconciled to protected `main`; its only changed files are
reliability-owned (verified by `node scripts/pri-fleet.mjs guard reliability origin/main`).
The merge does not activate a writer or App bypass. Do not use old PR #626
checks for its new head; rerun CodeQL after a synchronize event, then require
fresh approval by Kalp-Bajpai.

### Three separate GitHub Apps — permissions and credential custody

| Installed App | Exact least-privilege repository permissions (minimum for candidate transport) | Runtime-only credentials | Forbidden |
| --- | --- | --- | --- |
| Signer | Contents **read/write**; Issues **read/write**; Pull requests **read**; Administration **read**; Actions **read**; Metadata read (implicit) | `PRI_SIGNER_APP_ID` (protected env variable), `PRI_SIGNER_APP_PRIVATE_KEY` and Ed25519 `PRI_ADMISSION_PRIVATE_KEY` (protected env secrets); record `PRI_SIGNER_INSTALLATION_ID` privately as nonsecret metadata | Checks:write, main update bypass, merger private key |
| Verifier | Contents **read**; Issues **read**; Pull requests **read**; Checks **read/write**; Administration **read** (inspect protections/rulesets); Metadata implicit | `PRI_TRUSTED_APP_ID`, `PRI_TRUSTED_INSTALLATION_ID`, `PRI_TRUSTED_APP_PRIVATE_KEY`, `PRI_GITHUB_WEBHOOK_SECRET`, pinned `PRI_AUTHORITY_GENESIS_SHA` | Contents:write, GitHub main-update bypass, signer Ed25519 key |
| Exclusive merger | Contents **read/write**; Pull requests **read/write**; Checks **read**; Issues **read**; Administration **read** (protection/rulesets); Metadata implicit | `PRI_MERGER_APP_ID`, `PRI_MERGER_INSTALLATION_ID`, `PRI_MERGER_APP_PRIVATE_KEY`, `PRI_CONTROL_DATABASE_URL` | Checks:write, Ed25519 signing key, verifier App credentials |

Only the merger App ID may be the sole `Integration` bypass of the future main
`Restrict updates` ruleset; never reuse GitHub Actions App `15368`. The signer
App may be the *sole* separately validated ref-update bypass to the admission
freeze `25542737`, without changing deletion and non-fast-forward rule
`25078652`. Neither App gains broad ruleset administration permission unless
an independently approved operator needs a one-time installation/setup action.

The Ed25519 public key must become a reviewed nonsecret file on protected `main` at
`.pri-os/admission-public-key.pem`, not the GitHub App's RSA public key.
Do not deploy or enable signing until the corresponding public key and
protected environment secrets exist and their cryptographic match is proven.
Use protected secret storage only; never commit `PRI_*PRIVATE_KEY`, print them
in logs, or put them in PR comments. Key rotation requires independent approval,
signer shutdown, migration of pinned verifier public key and tested refusal of
old or unknown signatures. Disable App installations and the durable governor
merge queue on emergency before restoring any authority.

A dedicated PostgreSQL connection string goes **only** to the independently
owned governor service, never the student backend, untrusted workflows or a
pull request. Execute the included migration on a disposable control-plane DB
first. Database roles must prevent developers and ordinary student-app tokens
from modifying `pri_governor.*`. Owner must also provision authenticated
independent webhook ingress with atomic delivery-ID persistence and verify the
App installation ID belongs to the target repository before any status write.

**Current external blockers:** these App IDs, installation IDs, protected keys,
shared live signer/merger runtime and positive App bypass proof do not yet
exist in verified evidence. The admission ref is intentionally frozen and
empty. `SERIAL_MERGE_AND_REVOCATION_INTERLOCK_NOT_ACTIVATED` must remain fail
closed until real App identity, signed transactions and revocation-after-green
denial have been demonstrated. Existing local and hosted tests are candidate
contract evidence only, not live authority certification.


## Phase 4D — canonical signer config and fail-closed staging

The **only** authorized role-specific names in `.github/workflows/pri-writer-authority.yml` are:

- Environment variable `PRI_SIGNER_APP_ID` (numeric nonsecret GitHub App ID);
- Environment secret `PRI_SIGNER_APP_PRIVATE_KEY` (GitHub App RS256 PEM);
- Environment secret `PRI_ADMISSION_PRIVATE_KEY` (independent Ed25519 signing key);
- Repository variable `PRI_AUTHORITY_GENESIS_SHA` (existing immutable genesis SHA);
- Environment variable `PRI_SIGNER_RUNTIME_CERTIFIED`: intentionally **unset**.

No compatibility alias for the deprecated `PRI_GOVERNOR_APP_*` names exists.
The workflow explicitly fails BEFORE token issuance; it first checks the
independent `PRI_SIGNER_RUNTIME_CERTIFIED` flag and then has an **unconditional
shutdown** until the signed authority CLI is genuinely wired to the same
durable PostgreSQL transaction authority as the merger. Merely setting the
variable cannot activate the signer. Removing that shutdown requires new
independently reviewed protected-main source and real signed authority tests.

The signer requires repository **Administration:read** (`GET branches/.../protection`)
and **Actions:read** (`GET actions/runs/{id}/approvals`) in addition to Contents:write,
Issues:write and Pull requests:read. Those two permissions are read-only and
must not be silently omitted or promoted to write. The GitHub App installation
must cover only `Priysharan19/Final-Pri-learning`, and protected production app
runtime must not receive the signer private key. A GitHub App ID is **not** an
installation ID; `actions/create-github-app-token` resolves installation scope
from the owner and selected repository, while the operator verifies and retains
the actual numeric installation ID out of band.

**Registration contract (three Apps):**

| Field | Signer | Trusted verifier | Exclusive merger |
| --- | --- | --- | --- |
| App display name | `pri-governor-signer` (choose available unique slug) | `pri-governor-verifier` | `pri-governor-merger` |
| Installation | Only selected repo `Final-Pri-learning` | Same single repo | Same single repo |
| Repository permissions | Contents RW, Issues RW, Pull requests R, Administration R, Actions R, Metadata R implicit | Contents R, Issues R, Pull requests R, Checks RW, Administration R, Metadata R implicit | Contents RW, Pull requests RW, Checks R, Issues R, Administration R, Metadata R implicit |
| Org/account permissions | None beyond GitHub defaults | None beyond defaults | None beyond defaults |
| Webhook | Disable until independently approved endpoint (workflow-dispatched signer requires none) | Enable only after trusted HTTPS ingress; subscribe `pull_request` (opened/synchronize supported by current candidate); independently review any expansion to `pull_request_review` | Disable until trusted HTTPS merger ingress exists; never accept unsigned issue/PR comment merge instructions |
| Protected environment | `pri-writer-admission` | `pri-trusted-verifier` | `pri-exclusive-merger` |
| Nonsecret numeric variables | `PRI_SIGNER_APP_ID`; retain installation id as controlled inventory | `PRI_TRUSTED_APP_ID`, `PRI_TRUSTED_INSTALLATION_ID` | `PRI_MERGER_APP_ID`, `PRI_MERGER_INSTALLATION_ID` |
| Protected secrets | `PRI_SIGNER_APP_PRIVATE_KEY`, `PRI_ADMISSION_PRIVATE_KEY` | `PRI_TRUSTED_APP_PRIVATE_KEY`, `PRI_GITHUB_WEBHOOK_SECRET` | `PRI_MERGER_APP_PRIVATE_KEY`, `PRI_CONTROL_DATABASE_URL` |
| Initial status | Inactive, runtime certification flag UNSET, admission ref frozen | Inactive, no required trusted check | Inactive, no main update bypass |

Each App registration can be created now with the listed permissions and the
**Only on this account** installation availability setting; do not install
outside the selected repository. Do not guess App IDs, installation IDs, webhook
URLs or keys. Capture actual IDs from GitHub *after creation* in protected
variables/inventory, and generate/download each RSA private key directly into
approved secret storage. Do not copy them into source, chat or CI logs.

Verifier bootstrap obtains installation tokens with `checks:write`,
`contents:read`, `issues:read`, `pull_requests:read`, `administration:read`.
Merger bootstrap obtains `contents:write`, `pull_requests:write`, `checks:read`,
`issues:read`, `administration:read`. The existing main branch still requires
its four GitHub Actions checks; add the dedicated verifier App's fifth trusted
check only AFTER real independent publication and a safe negative-merge proof.

There is no production webhook URL, no production control-plane DB, and no
positive trusted App ruleset bypass test. The original admission-ref freeze
ruleset `25542737` and immutability ruleset `25078652` must stay active.


## Phase 4D — isolated runtime artifacts now implemented, not deployed

- `scripts/reliability/pri-webhook-ingress.mjs`: real Node HTTP server, bound to
  loopback only; validates GitHub HMAC SHA-256 over the raw PR payload and
  persists unique delivery metadata using the dedicated Postgres store. The
  only write endpoint records deliveries. There are no grant, merge or
  check-publication endpoints, and Railway environments are refused.
- `scripts/reliability/pri-webhook-ingress-check.mjs`: tests real loopback HTTP
  and disposable PostgreSQL, including correct HMAC, replay, tampering,
  wrong repository/event, content-type, body limit, and deny-all authority.
- `scripts/reliability/pri-github-app-transport.mjs`: real GitHub REST API
  adapter for verifying the actual App and selected-repository installation,
  minting a short-lived narrow installation token and read-only PR inspection.
  Any merge write requires separately certified physical App exclusivity and
  exact GitHub head/base checks; it has not been invoked against live GitHub.
- `scripts/reliability/pri-github-app-transport-check.mjs`: isolated HTTP-mock
  proof, including rejection of wrong App, installation, repository and
  permission scope. Tests do not constitute live App certification.
- `scripts/reliability/pri-signer-provisioning-check.mjs`: source-level check
  that the signer workflow and this runbook use the same role-specific secret
  names and the Actions/Admin read permissions proven by the real CLI calls.

**Not yet wired:** a real signer adapter holding the *same* durable Postgres
lock through signed grant/revoke CAS, an independently deployed external webhook
receiver address, an actual installed GitHub App with credentials, a protected
merger policy evaluator and the fifth trusted required check. The runtime
remains intentionally not deployed and unauthorized. Do not set a public
webhook endpoint or GitHub main/admission App bypass yet. Staging of private
App credentials must occur through the GitHub environment UI, never this PR.
