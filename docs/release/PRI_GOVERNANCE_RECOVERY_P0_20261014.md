# P0 Governance Recovery — PR #492 under independent review

Baseline main: `ce8d4b06c91736c82a0e9920917914fe086de6d3`
Date: 2026-10-14
Historical proposal status before 14 October PR submission: isolated QA engineering proposal; at that stage there was no remote branch or PR. **Current status:** draft PR #492 exists and is **UNMERGED**, with no writer admission or application deployment.

## Root cause

The current mission-control program treats `REVIEW`, `CI` and `MERGE_READY` as code-writer states, even though those states can represent frozen work awaiting independent gates. The four open records #470 ACTIVE, #485 ACTIVE, #483 REVIEW and #456 REVIEW share the india-curriculum primary, violating both the maximum of two and the same-owner restriction. Issue `updated_at` is an incidental timestamp, not proof of authorized coding progress. Admission ignores stale leases while ledger validation rejects them; old closed issues #172/#207 retain misleading writer markers. `admit` approves snapshots without atomic reservation.

## Proposed state and evidence contracts

- Code-writer states: `ACTIVE`, `IMPLEMENTING`, `TESTING`, `REPAIR` only.
- Writer-free states: `REVIEW`, `CI`, `MERGE_READY`, `REPAIR_PENDING`, `TRIAGED`, all legitimately blocked/closed states.
- In REVIEW/CI/MERGE_READY/REPAIR_PENDING, pin `Pri-Review-Head: <full 40-hex PR SHA>`. CI requires that marker to equal the actual current PR head; changing source without reacquisition invalidates the review gate.
- A live writer requires `Pri-Lease-Heartbeat-At: <ISO UTC>`, `Pri-Lease-Heartbeat-Ref: <full commit SHA>` and `Pri-Lease-Heartbeat-By: <canonical agent>`. Only explicitly authorized progress renews. Comments and issue updated_at have no authority.
- On REVIEW-to-REPAIR_PENDING, preserve the branch and evidence but relinquish writer capacity. REPAIR_PENDING-to-ACTIVE must obtain a new heartbeat and authorized admission; the transition code does not invent it.
- Use a shared inspection function for ledger validation and advisory admission: closed issues are non-admitting and historically flagged; open stale or malformed writer issues prevent fresh admission.
- Preserve the two-writer maximum, same-owner denial, canonical routing, base SHA, path overlap, shared derived roots, sensitive authority and dependency restrictions.
- Atomicity is **not implemented**. The CLI deliberately returns DENY/SERIALIZED_ADMISSION_REQUIRED rather than pretending a snapshot reserves capacity. A serialized GitHub admission transaction is required before new automatic code writers.

Heartbeat actor identity and progress legitimacy require independent GitHub authorization/evidence review; syntactic validation alone cannot cryptographically prove a commit or its author. Treat this as a remaining release requirement.

## Record migration — only AFTER approved control-plane integration

1. Confirm #470 PR #472 is still actively writing, then attach a verified exact-commit heartbeat. If no longer writing, transition truthfully rather than renewing a lease by comment.
2. Confirm #485 PR #486 is committed and paused. Source review requires corrections: move ACTIVE -> REVIEW -> REPAIR_PENDING with its pinned head. Do not move it while an authorized writer is actively editing; do not call it DONE.
3. Leave #483 in REVIEW with pinned PR #484 head, pending curriculum correction, blind-content and protected-CI gates.
4. Leave #456 in REVIEW with pinned specialist-branch PR #457 head, consistent with its recorded Pri-Branch. Preserve integrated release PR #458 separately for QA; do not substitute its different branch head into #456. App-health blockers and independent mathematical review remain.
5. Leave closed #172 and #207 closed and out of writer admission; retain historical audit warning.
6. Revalidate live issue/PR state and required checks after the record changes. Do not create another writer before serialization exists.
7. Prioritize P0 auth/onboarding, student data, grading, App Health and release evidence ahead of Pri Worlds.

## Local verification commands

- `node scripts/pri-mission-control.mjs validate`
- `node scripts/pri-fleet.mjs validate`
- `node client/test/pri-mission-control-regression.mjs`
- Parse and execute the updated relevant self-test steps of `pri-agent-governance.yml` and `pri-agent-concurrency.yml`.
- Check patch against exact main, then obtain independent security/QA review and real exact-head CI (not performed on this unmerged proposal).

The patch does not alter curriculum source, grading, authentication, student data, iOS code, or production. It does **not** certify governance or authorize Pri Worlds.

## Verified local follow-up, 14 October

- Exact baseline applied cleanly in separate full repository clone.
- Original isolated patch: 34/34 deterministic regression assertions passed, including refusal to gain a lease through a normal state transition, stale transition denial, exact-head and status checks, dependency, derived root, wrong owner and concurrent attempts.
- Live read-only GitHub snapshot: 490 issues total, 66 managed, 35 managed open; #470/#485 open ACTIVE, #483/#456 open REVIEW, #172/#207 closed historic writer-like markers.
- Unmodified live snapshot: validator DENY (missing heartbeats, missing review-head pins, same-owner conflict).
- Simulation-only ledger with #470 as single heartbeat-bound ACTIVE, #485 REPAIR_PENDING and #483/#456 REVIEW pinned to their own PR heads: validator PASS, active_count=1, historic closed records warning-only. This simulation grants no authority and does not change GitHub issue bodies.
- This code may be submitted only through the owner-directed, manual-governed `task/*` lane as a DRAFT recovery proposal. It is not a fifth autonomous `agent/mission/*` writer, cannot be merged by its author alone, and cannot be used to declare P0 resolved.
- Required independent acceptance: exact-head CI, QA/governance + security review, approved issue migration, authenticated heartbeat and CAS/serialized admission-controller design. Until admission is authenticated and serialized, new code-writer admissions remain DENIED.

## P0 continuation: submitted recovery, adversarial closure and remaining security boundary

- **Draft PR:** https://github.com/Priysharan19/Final-Pri-learning/pull/492, branch `task/p0-governance-recovery-20261014`, exact branch head must be independently re-read after each change. This is the explicitly reviewed, owner-directed recovery path, **not** a fifth automatic writer lease.
- Original PR head `3042ae5978e692738ff84e030aecfcc902bf4552` received passing hosted CI, CodeQL, Fleet Governance, Concurrency Safety/Adversarial, App Health, browser and container acceptance. **These historic greens are invalid for any later head.**
- Follow-up adversarial validation: title-based issue inventory; missing/blank/duplicated mission ID, duplicated required/optional markers, malformed issue state, and open records with missing status all fail closed. Historical closed records remain non-admitting. Exact 40-character PR head is a required CLI input even for active writer checks. **48/48 local regression assertions** at this checkpoint; rerun before merge.
- `Pri-Lease-Heartbeat-At` is a well-formed timestamp, **not authoritative evidence of genuine progress**. `Pri-Lease-Heartbeat-Ref` is a plausible 40-character commit digest, **not proof that a commit exists, that GitHub accepted it, or that the agent owns it**. `Pri-Lease-Heartbeat-By` matching the marker's owner is **not identity authentication**; anyone with issue edit access might spoof all three. Plain GitHub comments cannot refresh the timestamp used for lease freshness under this patch, but authorized issue edits also need an independent actor-and-transaction audit.
- Current validator can verify shape, local lease TTL, fleet ownership, exact source/PR-head equality in the call site, and overall conflict constraints. It **cannot** validate GitHub actor identity, historical branch ancestry, GitHub PR/commit existence, or transaction uniqueness against a mutable issue body. It is a **safety check**, not an admission grant. `admit` returns DENY on every eligible snapshot with `SERIALIZED_ADMISSION_REQUIRED`.
- The primary GitHub Actions governance PR path forwards `github.event.pull_request.head.sha`; both derived sync and apply call sites pass their authenticated event `HEAD_SHA`; the deterministic smoke fixture now passes its explicit SHA. A direct CLI call without the exact SHA must fail.
- **Minimum future admission controller:** an authenticated workflow with scoped issue/branch permissions and a single Git-controlled authoritative grant log or other proven CAS/serialized state; each transaction reads latest grants, atomically reserves the slot, emits unique grant ID and verifiable authenticated actor/workflow receipt, and rejects conflicts. Lease heartbeat, release, revocation, expiry and crash recovery are serialized through this authority; user-editable issue markers are synchronized views, never the sole grant store. Demonstrate overlapping concurrent requests for one slot (exactly one grant or both denied), stale snapshots, forged issue edits, crash-retry idempotence, owner/path conflict and branch-main revalidation. No capacity increase until that controller has independent security approval.
- **Integration order:** independent QA/security approval and exact-head required hosted CI → protected merge if authorized → truthful real mission issue migration → independent verification of the live ledger → separate authenticated serialized admission controller → any new autonomous feature mission. Treat the October 15 milestone as an evidence checkpoint, not a release override.

## Read-only, high-leverage work while waiting

- P0 release: review #478, #480, #481 and the #490/#491 companion PRs against their own base/head; isolate exact-head auth, guardian, native/Android, student sync and graded Practice regressions.
- P0 grading: review combined candidate #481, #439 and acceptance #482; preserve server-authoritative grading and answer-blind handwriting checks.
- Study platform: inventory `c8-linear-equations` Notes-to-Practice route and versioned Pri Worlds research; no new code or second interactive engine before admission.
- Curriculum production: independently verify PR #472 Class IX mathematics/figures, #484 CBSE answer-blind content and #486 JEE hints/rights; retain distinct author/reviewer separation.

### Review finding correction: forged heartbeat is not authenticated

Independent automated code review on PR #492 correctly noted that a generic DENY assertion is not evidence of detecting a forged reference. The regression now explicitly checks that forged-looking but syntactically valid markers remain **eligible on the read-only snapshot** and that no grant occurs solely because the unimplemented serialized admission authority returns `SERIALIZED_ADMISSION_REQUIRED`. There is no commit-existence, actor-signature or heartbeat provenance validation in this patch. Do not treat its green result as proof of spoof detection.
