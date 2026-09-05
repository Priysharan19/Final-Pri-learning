# Pri Learning Autonomous Engineering Fleet V2

Pri Learning now has an executable agent control plane rather than a role list alone.

## Architecture

```text
Evidence + backlog
      |
      v
Director / CTO (read-only)
      |
 deterministic ranker
      |
      v
GitHub-Issue mission ledger + single writer lease
      |
      v
Primary specialist writer
      |
 typed specialist gates
      |
      v
Independent QA / Release review
      |
 exact-head CI
      |
  +---+---+
  |       |
 fail    pass
  |       |
repair   merge-ready
  |       |
  +---record history---+
          |
          v
      next mission
```

## 1. Deterministic mission selection

The Director still inspects current `main`, open PRs/issues and health/CI evidence, but candidate prioritisation is now machine-checkable. Critical categories preempt normal features. Within a category the score combines severity, student impact, unblock value, recurrence, strategic value, diagnosis confidence, effort and regression risk.

Use:

```bash
node scripts/pri-mission-control.mjs rank candidates.json
```

The ranker is deliberately deterministic so we can later evaluate whether the Director chose good work instead of changing priorities unpredictably from prompt wording.

## 2. Durable mission memory

GitHub Issues are the persistent mission ledger. A mission record tracks:

- mission ID
- state
- specialist
- branch
- R1-R4 risk
- base SHA
- attempt count
- normalized failure fingerprint
- acceptance conditions
- required typed gates
- evidence
- blockers
- residual risk
- last progress time

The state machine prevents invented transitions such as jumping directly from implementation to done.

## 3. Writer lease

Only one mission may hold the code-writing lease. Writer states are `ACTIVE`, `IMPLEMENTING`, `TESTING`, `REVIEW`, `CI`, `REPAIR` and `MERGE_READY`.

The lease expires after 12 hours without progress. Future autonomous mission PRs are governed using the branch format:

`agent/mission/<agent>/<mission-id>`

The governance workflow verifies there is exactly one open managed GitHub Issue holding the active lease and that it matches the PR branch and specialist.

## 4. Primary ownership + reviewer overlays

V1 had overlapping broad ownership. V2 replaces that with ordered ownership rules. The first matching rule is authoritative and contains:

- one `primary` writer
- zero or more mandatory `reviewers`
- a risk class

This makes security, reliability and QA cross-cutting reviewers without allowing them to compete with the domain specialist for the same implementation by default.

Inspect routing with:

```bash
node scripts/pri-fleet.mjs route client/src/ink/native.js
```

## 5. Typed gates

Agent gates are no longer free-form strings. Every gate declares:

- command
- platform
- severity
- timeout
- evidence class

This lets the orchestration layer distinguish deterministic Linux evidence from real-human/physical evidence and prevents simulator status from being silently treated as physical proof.

## 6. Risk-aware autonomy

V2 uses four risk classes:

- R1 low
- R2 moderate
- R3 high
- R4 critical

The changed files determine the actual risk. Autonomous PRs must declare `Pri-Risk`; CI rejects under-declaration.

R4 includes auth, billing, migrations, security policy, mathematical marking authority, handwriting authority and destructive data paths. These require the strongest review/evidence and must remain reversible for autonomous merge consideration.

## 7. Failure memory and loop prevention

CI/test failures are normalized into a SHA-256 fingerprint. Infrastructure-only failures may be retried once. Three identical failure attempts suspend the mission as `BLOCKED_AUTOMATION` instead of allowing an infinite repair loop.

External evidence gaps such as physical Apple Pencil studies or App Store credentials become `BLOCKED_EXTERNAL`; software work and evidence tooling should still be completed first, then the writer lease is released so another software mission can proceed.

## 8. Independent review

The QA / Release Governor is logically separate from the specialist writer. The reviewer starts from the actual diff and current evidence, not the writer's confidence. It specifically looks for:

- false mathematical acceptance/rejection
- data-loss paths
- auth/session/isolation regressions
- answer leakage into handwriting recognition
- native lifecycle regressions
- test or threshold weakening
- unsafe workflow/security changes
- missing regression tests
- unsupported product/accuracy/completeness claims

## 9. Governance workflow

`.github/workflows/pri-agent-governance.yml` now runs on every PR. All PRs validate the control plane and receive diff risk classification. Strict writer ownership, metadata and GitHub-Issue lease enforcement apply automatically to `agent/mission/**` branches.

## 10. Relationship to existing Pri automation

V2 does not replace Pri's existing deterministic evidence systems:

- `Pri App Health Agent` remains the mounted-product/native health layer.
- repository CI remains the authoritative release contract.
- specialist handwriting, curriculum, platform and native workflows remain domain evidence.
- the existing merge watcher can remain the final exact-head merge authority.

The V2 fleet sits above these systems and turns evidence into prioritized, stateful engineering missions.

## Commands

```bash
node scripts/pri-fleet.mjs validate
node scripts/pri-fleet.mjs list
node scripts/pri-fleet.mjs route server/platform/index.js
node scripts/pri-fleet.mjs prompt platform
node scripts/pri-fleet.mjs guard platform origin/main
node scripts/pri-fleet.mjs risk origin/main
node scripts/pri-mission-control.mjs validate
node scripts/pri-mission-control.mjs template <id> <agent> <risk> <base-sha>
node scripts/pri-mission-control.mjs validate-record mission.json
node scripts/pri-mission-control.mjs lease-status mission.json
```
