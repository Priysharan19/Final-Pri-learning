# Pri Ink physical release study runbook

This runbook executes the remaining Person 1 handwriting proof without manufacturing evidence.

## 1. Freeze the build under test

Use an exact `main` commit and build the iPad package from that commit. Record the full Git SHA and app version before collecting any participant data.

The hidden production study route is:

`/practice?inkEvidence=1`

It mounts the same `InkAnswer` + PencilKit production recognition path used by Practice.

## 2. Use only the assigned anonymous writer codes

The canonical allocation lives in `PHYSICAL_STUDY_PLAN.json`.

Do not invent replacement IDs after seeing recognition quality. Writer split is deterministic and must remain fixed.

Planned allocation:

- 12 train writers;
- 6 validation writers;
- 24 test writers;
- 6 final-holdout writers.

The 24 test writers give 1,400+ possible scored expressions under the current prompt protocol, leaving margin above the 1,000-expression release floor for skips and unusable runs.

## 3. Keep hardware coverage real

Each participant is assigned device slot `A` or `B`.

- Slot A = one supported iPad model class.
- Slot B = a second, genuinely different supported iPad model class.

Do not relabel the same hardware model as two classes. Record the actual iPad model, iPadOS version and Pencil model in the collection UI.

## 4. Participant collection procedure

For each assigned participant:

1. obtain the participant's consent for anonymous Pencil strokes to be used for Pri Ink training/evaluation;
2. open the exact frozen build on a physical iPad;
3. open `/practice?inkEvidence=1`;
4. enter only the assigned anonymous code, never a name/email/student ID;
5. enter the exact build SHA, app version, iPad model, iPadOS version and Pencil model;
6. complete the prompts naturally, without rewriting to make handwriting artificially neat;
7. do not tell the participant whether the model was correct during the pre-correction capture;
8. export both JSON files at the end of the session.

The release-evidence JSON contains the production reading, authority decision and latency. The corpus JSON contains the raw PencilKit strokes plus prompt transcription for the deterministic writer split.

## 5. File placement

Place release-evidence exports in:

`handwriting/v12/evidence/physical/`

Place real-writer corpus exports in the real-writer corpus location used by `client/test/ink-corpus-audit.mjs`, preserving their embedded split metadata.

Never commit personal identifiers or unrelated student work.

## 6. Daily progress check

```bash
node client/test/ink-physical-study-plan-check.mjs
node scripts/ink-physical-study-status.mjs --split test
node client/test/ink-physical-release-evidence.mjs
```

The first command proves the participant plan has not drifted. The second reports missing writers/device coverage. The third validates committed physical files without manufacturing a release pass.

## 7. Test-set release gate

Only after the planned test collection is complete:

```bash
node client/test/ink-physical-release-evidence.mjs --strict --split test
```

Do not lower thresholds. A failure means classify the failures and improve the earliest responsible layer: capture/ownership, recognition/structure, arbitration/confidence, or marking authority.

## 8. Final holdout discipline

The final-holdout writers in `PHYSICAL_STUDY_PLAN.json` are marked `locked-until-release`.

Collect their sessions only when the release candidate is frozen. Do not repeatedly inspect final-holdout mistakes and then tune against them.

Run the final holdout once the test-set candidate is frozen:

```bash
node client/test/ink-physical-release-evidence.mjs --strict --split final-holdout
```

If the final holdout fails, the release claim fails. Do not redefine the holdout after seeing the result.

## 9. Production claim boundary

Person 1 software is implemented. Arbitrary-real-handwriting production proof becomes complete only when the real physical evidence satisfies the release floors already enforced by `ink-physical-release-evidence.mjs`.

Synthetic writers, duplicated strokes, simulator sessions, research-only recognizers, browser fallbacks and hand-edited authority labels never count toward this proof.
