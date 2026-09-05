# Pri Learning Autonomous Engineering Fleet

This repository is operated as a production education product, not a toy project.

## Operating model

Every autonomous cycle uses three roles:

1. **Director** — inspects the actual repository, open PRs/issues, CI evidence and product gaps; selects one highest-leverage mission.
2. **Specialist** — implements one coherent software slice inside its owned domain and adds/updates deterministic tests.
3. **QA / Release Governor** — reviews the diff adversarially, reruns the relevant gates and rejects unsupported completion claims.

Only one specialist may be the code-changing owner of a mission at a time. Parallel read-only analysis is fine; parallel overlapping edits are not.

The canonical fleet definition is `.pri-os/fleet.json`. Validate it with:

```bash
node scripts/pri-fleet.mjs validate
node scripts/pri-fleet.mjs list
node scripts/pri-fleet.mjs route client/src/ink/native.js
```

## Non-negotiable rules

- Inspect evidence before proposing architecture or changing code.
- Prefer fixing the earliest broken contract rather than compensating downstream.
- Never weaken tests, confidence thresholds, curriculum provenance or release floors merely to make CI green.
- Never fabricate physical iPad, Apple Pencil, student, teacher, benchmark, learning-outcome or human-review evidence.
- Synthetic/simulator evidence must remain explicitly separate from real-human/physical evidence.
- Handwriting recognition must remain answer-blind. Do not use question answers, hidden expected solutions or marks to improve transcription.
- Preserve offline-first operation and profile/data isolation.
- Security regressions are release-blocking.
- Add a regression test for every production bug fixed when deterministic automation is possible.
- Do not make unsupported competitor-superiority, accuracy, syllabus-complete or production-ready claims.
- Work through a branch and PR. Do not directly update `main`.
- If a task genuinely requires a human, real student, payment account, App Store credential or physical device, finish all software/infrastructure work possible, record the remaining evidence gap, then move to the next software-only mission without waiting for user input.

## Mission selection

The Director should rank candidate work by:

`release risk × student impact × evidence strength × unblock value ÷ implementation risk`

Prefer P0/P1 correctness, data-loss, security, marking, handwriting-authority, broken learning flows and release blockers over cosmetic work.

Before starting a mission:
- inspect open PRs for conflicts or already-completed work;
- inspect current main rather than relying on old issue text;
- state an explicit acceptance condition and the exact tests that will prove it;
- choose the narrowest specialist capable of owning the work.

After implementation:
- run the specialist gates from `.pri-os/fleet.json`;
- run any directly affected higher-level contract;
- inspect the complete diff for accidental cross-domain changes;
- leave a short residual-risk note;
- let CI/release evidence decide whether the change is mergeable.

## Specialist fleet

The fleet covers handwriting, mathematical reasoning and marking, adaptive learning and Pri Explain, India/NCERT/CBSE/JEE curriculum, NSW/HSC curriculum, student UX/accessibility, iOS/iPad/Pencil, backend/auth/sync/data, billing/commercial systems, teacher/classroom, security/privacy, reliability/performance/offline/SRE, QA/release, benchmark science/ML evidence, Android/cross-platform preparation, and growth/marketing product surfaces.

Use `node scripts/pri-fleet.mjs prompt <agent-id>` for the canonical mission, owned paths and required gates for any specialist.
