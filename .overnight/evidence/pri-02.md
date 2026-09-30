# PRI-02 — Golden Student Journey Evidence

## Authority and crash recovery

- Task-start main SHA: `81d075acfe7f4a7574b39a77c478eee6641d1bb4`
- Working branch: `task/pri-02-golden-student-journey`
- Recovered workspace: `~/PriLearningWork/Final-Pri-learning-pri-02`
- Launcher clone was inspection-only and was not reset, cleaned, or modified.
- Recovery result: surviving PRI-02 work was found and preserved rather than reimplemented.
- Recovered durable commits:
  - `c8e5c6f` — IndexedDB open/retry and versionchange lifecycle recovery.
  - `6c0e37b` — atomic exactly-once practice resolution and state invariants.

## Defects repaired

1. Rejected IndexedDB opens could remain cached and poison future opens.
2. Successful IndexedDB handles did not release promptly on `versionchange`.
3. A resolved practice question updated dependent learning stores in separate transactions.
4. Concurrent/repeated submission could race application-level state changes.
5. A fresh `Next Question` could replace unfinished local work rather than resuming it.
6. Practice allowance could be consumed again while resuming unfinished work.
7. Restore-durability failure injection assumed one-store transactions and no longer reached the intended failure after atomic multi-store writes.

## Invariants and contracts

- Idempotency claim: every authoritative practice resolution uses a stable per-question attempt id and an IndexedDB `add`; a duplicate claim aborts the complete multi-store transaction.
- Atomicity strategy: attempt, rating, review, profile XP, activity, resolved question and task progress are committed in one IndexedDB transaction.
- Unfinished-work contract: local practice persists and resumes the newest matching unresolved question. Resume does not create progress or consume another practice allowance.
- Profile isolation: unresolved questions and learning state remain owned by their profile; cross-profile question resolution returns not found.
- IndexedDB lifecycle: rejected opens are forgotten; `versionchange` closes and forgets the old handle; a subsequent open creates a valid current handle.

## Focused verification already passed

- `npm run test:backend` — PASS, 340/340.
- `npm run test:entitlements` — PASS, 59/59.
- `npm run test:outbox` — PASS, 70/70.
- `node client/test/profile-cloud-outbox-check.mjs` — PASS, 17/17.
- `npm run test:sync:worker` — PASS, 20/20.
- `npm run test:sync:ack` — PASS, 44/44.
- `npm run test:restore:durability` — PASS after adapting failure injection to the multi-store transaction contract.
- `npm run test:idb:lifecycle` — PASS.
- `npm run test:practice:state` — PASS.

## Canonical regression

`client/test/golden-student-journey.mjs` drives a real browser through profile creation, unfinished-question resume, three consecutive marked questions, History, Progress, full app restart, offline practice, offline History/Progress, another offline restart, unfinished-question resume, and continued practice.

Command: `npm run test:golden-journey`

Current status at this evidence revision: implementation committed next so the repository's release-identity guard can build the exact candidate. The pre-commit attempt was correctly rejected because production builds are forbidden from a dirty source tree.
