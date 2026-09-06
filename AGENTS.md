# Pri Learning Autonomous Engineering Fleet V2

Pri Learning is operated as a production education product. Autonomous engineering must improve the actual repository without inventing evidence or weakening safety gates.

## Control plane

Every cycle uses:

**SCAN → RANK → LEASE → IMPLEMENT → TEST → INDEPENDENT REVIEW → CI → REPAIR/MERGE → RECORD → REPEAT**

The canonical definitions are:

- `.pri-os/fleet.json` — agents, specificity-resolved primary ownership, reviewer overlays, typed gates and risk classes.
- `.pri-os/mission-control.json` — persistent GitHub-Issue mission ledger, state machine, writer lease, retry ceiling and deterministic priority policy.
- `scripts/pri-fleet.mjs` — routing, ownership guard, risk classification and fleet validation.
- `scripts/pri-mission-control.mjs` — mission ranking, mission-record validation, transitions, failure fingerprints and lease status.

## Roles

### Director / CTO

The Director is read-only. It inspects current `main`, open PRs/issues, CI/health evidence and product gaps, creates a candidate set, and uses the mission-control priority model to choose the highest-leverage software mission. It does not own a code-changing branch.

Critical categories preempt normal feature work in this order:

1. security
2. data loss
3. wrong mathematical marking
4. broken production build
5. authentication
6. unsafe handwriting authority
7. normal product work

### Specialist writer

Exactly one specialist holds the writer lease. New autonomous branches must be:

`agent/mission/<agent-id>/<mission-id>`

The PR body must include:

`Pri-Mission-ID: <mission-id>`

`Pri-Agent: <agent-id>`

`Pri-Risk: R1|R2|R3|R4`

The most-specific matching ownership rule gives every governed path one canonical primary owner. Equal-specificity rules with different primary owners are rejected as ambiguous. Security, reliability, QA and other cross-cutting roles are reviewer overlays unless an ownership rule explicitly makes them primary.

### Independent QA / Release Governor

The reviewer must inspect the complete diff independently of the writer's self-assessment. It checks mathematical false positives, data-loss paths, auth boundaries, handwriting-answer leakage, lifecycle regressions, test weakening, threshold changes, insecure workflow edits, missing regression tests and unsupported claims.

The writer may not declare its own work release-ready.

## Mission ledger and writer lease

GitHub Issues are the durable mission ledger. A managed issue contains the canonical markers defined in `.pri-os/mission-control.json`, including mission ID, status, agent, branch, risk, base SHA, attempt count and failure fingerprint.

Only one mission may be in a writer-holding state at a time. The lease expires after 12 hours without progress and must then be released/retriaged rather than silently remaining locked forever.

Writer-holding states are:

`ACTIVE`, `IMPLEMENTING`, `TESTING`, `REVIEW`, `CI`, `REPAIR`, `MERGE_READY`.

Future autonomous PR governance verifies that exactly one active managed issue exists, that its mission/agent/branch/risk match the PR, that its required markers are well-formed, and that the issue has been updated inside the configured lease TTL.

## Failure handling

CI failures are classified and fingerprinted. Infrastructure-only failures may be rerun once. The same normalized failure fingerprint may be attempted at most three times before the mission becomes `BLOCKED_AUTOMATION` and is returned to triage. Do not loop indefinitely.

A mission blocked only by a real-world dependency becomes `BLOCKED_EXTERNAL`; finish all software/evidence tooling possible, record the missing dependency, release the writer lease, and move to the next software-only mission.

## Risk classes

- **R1** — docs/copy or isolated non-behavioural change.
- **R2** — bounded UI/product behaviour.
- **R3** — learning logic, offline state, sync, native lifecycle or executable curriculum behaviour.
- **R4** — auth, billing, migrations, security policy, mathematical marking authority, handwriting authority or destructive data path.

The diff-derived risk is authoritative. A PR may declare a higher risk, never a lower one.

## Non-negotiable invariants

- Inspect current evidence before architecture/code changes.
- Fix the earliest broken contract instead of compensating downstream.
- Never weaken tests, confidence thresholds, curriculum provenance or release floors merely to make CI green.
- Never fabricate physical iPad, Apple Pencil, student, teacher, benchmark, learning-outcome, App Store, payment-provider or human-review evidence.
- Synthetic/simulator evidence stays explicitly separate from real-human/physical evidence.
- Handwriting recognition remains answer-blind. Never use hidden expected answers/solutions/marks to improve transcription.
- Preserve offline-first operation and profile/data isolation.
- Security regressions are release-blocking.
- Add a deterministic regression test for every production bug when feasible.
- Do not make unsupported competitor-superiority, accuracy, syllabus-complete or production-ready claims.
- Work through branch + PR. Never directly update `main`.
- Destructive production operations, irreversible migrations, secret rotation, payment-provider actions, App Store publishing and legal/privacy sign-off require explicit external authority even when the code is ready.

## Commands

```bash
node scripts/pri-fleet.mjs validate
node scripts/pri-fleet.mjs route client/src/ink/native.js
node scripts/pri-fleet.mjs prompt handwriting
node scripts/pri-fleet.mjs guard handwriting origin/main
node scripts/pri-fleet.mjs risk origin/main
node scripts/pri-mission-control.mjs validate
node scripts/pri-mission-control.mjs rank candidates.json
node scripts/pri-mission-control.mjs validate-record mission.json
node scripts/pri-mission-control.mjs lease-status mission.json
```
