# P0 Governance Recovery — unmerged proposal

Baseline main: `ce8d4b06c91736c82a0e9920917914fe086de6d3`
Date: 2026-10-14
Status: Isolated QA engineering proposal only. No writer admission, remote branch, PR, merge or application deployment.

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
- 34/34 deterministic regression assertions pass, including refusal to gain a lease through a normal state transition, stale transition denial, exact-head and status checks, dependency, derived root, wrong owner and concurrent attempts.
- Live read-only GitHub snapshot: 490 issues total, 66 managed, 35 managed open; #470/#485 open ACTIVE, #483/#456 open REVIEW, #172/#207 closed historic writer-like markers.
- Unmodified live snapshot: validator DENY (missing heartbeats, missing review-head pins, same-owner conflict).
- Simulation-only ledger with #470 as single heartbeat-bound ACTIVE, #485 REPAIR_PENDING and #483/#456 REVIEW pinned to their own PR heads: validator PASS, active_count=1, historic closed records warning-only. This simulation grants no authority and does not change GitHub issue bodies.
- This code may be submitted only through the owner-directed, manual-governed `task/*` lane as a DRAFT recovery proposal. It is not a fifth autonomous `agent/mission/*` writer, cannot be merged by its author alone, and cannot be used to declare P0 resolved.
- Required independent acceptance: exact-head CI, QA/governance + security review, approved issue migration, authenticated heartbeat and CAS/serialized admission-controller design. Until admission is authenticated and serialized, new code-writer admissions remain DENIED.
