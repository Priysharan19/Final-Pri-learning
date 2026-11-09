# Pri Ink physical Apple Pencil release evidence (server reader)

Status: **measurement protocol**. This is the bridge between a correct implementation and a defensible production handwriting claim.

Synthetic writers, simulator suites and deterministic fixtures remain regression evidence. They do not satisfy this protocol.

The reader under test is the **server reader**: PencilKit strokes on a physical iPad, the production picture drawn from them, one read of `/v1/handwriting/transcribe` when the writer presses "Read my answer", the confirmation boundary the card applies, and the round trip the app measured. The retired on-device readers (Vision, Core ML foundation, JS recogniser) are not production evidence; the scorer refuses their labels.

## What must be measured

Run the actual production handwriting path on physical iPads at `/practice?inkEvidence=1` and record one JSON file per anonymised writer/session under:

`handwriting/v12/evidence/physical/`

Validate the files without claiming release readiness:

```bash
node client/test/ink-physical-release-evidence.mjs
```

Run the blocking release gate:

```bash
node client/test/ink-physical-release-evidence.mjs --strict
```

The final holdout is intentionally explicit:

```bash
node client/test/ink-physical-release-evidence.mjs --strict --split final-holdout
```

Do not repeatedly inspect final-holdout errors and then tune the reader against them.

## Where the strict gate runs

- Pull-request CI (`.github/workflows/ink-physical-evidence.yml`, and `npm test` through `test:ink:release-gate`) runs the validator **without** `--strict`: it proves committed files are well formed, server-reader only and leak-free, and prints NOT MEASURED when there are none. A green PR check is therefore not release evidence.
- The strict gate (test split and locked final holdout) is a **blocking** step of `.github/workflows/release-candidate.yml`, run against one exact candidate SHA (`workflow_dispatch` input `release_sha`, or a `v*` tag). With no result files committed it exits 1, and the workflow's job summary shows the row as red. That is expected until physical runs exist; nothing in the workflow may be loosened to change it.
- Current state: no result files are committed, so the strict gate is red and every Gate C/D number is NOT MEASURED.

## Required result schema (version 2)

Version 1 described the retired on-device consensus reader. No version-1 file was ever collected and none is accepted.

```json
{
  "schemaVersion": 2,
  "physicalHardware": true,
  "reader": "server",
  "runId": "P0001-session-2026-11-02-a",
  "recordedAt": "2026-11-02T09:00:00Z",
  "build": {
    "commit": "0123456789abcdef0123456789abcdef01234567",
    "appVersion": "1.0 (3)",
    "kind": "development",
    "server": "staging"
  },
  "device": {
    "model": "iPad Air 11-inch (M2)",
    "osVersion": "26.1",
    "pencil": "Apple Pencil Pro"
  },
  "writer": {
    "id": "P0001",
    "split": "test"
  },
  "samples": [
    {
      "id": "session-a-001",
      "target": "x^2=9",
      "recognized": "x^2=9",
      "authority": "auto",
      "pencil": true,
      "reader": "server",
      "recognitionMs": 2183.4,
      "engine": "cloud-gpt-example",
      "productionReady": true,
      "researchOnly": false,
      "critical": true
    }
  ]
}
```

For `final-holdout`, the writer object must additionally contain `"holdoutLocked": true`.

`build.kind` is `development` (an Xcode run of the frozen SHA, DEBUG, pointed at staging) or `testflight` (the signed store build, production origin). `build.server` names the server the app was pointed at. Both kinds are accepted as evidence of the reader; the release record keeps them distinct (`docs/release/device-matrix.md`, "Which server a device build talks to").

## Measurement rules

- Use anonymous stable writer IDs only. Never commit names, emails, school identifiers or account identifiers.
- Every selected writer belongs to exactly one train/validation/test/final-holdout split.
- `target` is the prompt's ground-truth transcription, not the expected mathematical answer to an arbitrary student problem.
- `recognized` is what the server reader returned before any student correction.
- `authority` is the production confirmation decision: `auto` (the server was sure and the card would mark the reading as it stands), `confirm` (the card asks the student to confirm first) or `abstain` (no reading). Do not hand-edit it after seeing whether recognition was correct.
- `recognitionMs` is the server read round trip the app itself measured, from the press of "Read my answer" to the transcription landing, on the device's own network. It is not substituted by a stopwatch or a server-side figure.
- `engine` is the label the server returned (it starts with `cloud`). A label naming Vision, the foundation model, native rescue, the JS recogniser or a consensus of them is refused.
- `researchOnly:true` and `productionReady:false` readings are rejected from production evidence.
- A repeated sample ID for the same writer is rejected so repeated measurements cannot inflate accuracy.
- Final-holdout data is opened intentionally for release evidence, not daily tuning.

## Strict production floors

The validator enforces the production-standard floors and adds evidence-sufficiency minima for the two metrics most vulnerable to tiny-sample claims:

- >=20 writer-disjoint test writers;
- >=1,000 scored expressions;
- >=2 physical iPad model classes;
- exact expression accuracy >=98.0%;
- character accuracy >=99.5%;
- worst-writer exact accuracy >=90.0%;
- >=200 critical-structure expressions;
- critical-structure exactness >=99.5%;
- >=1,000 actual `auto` authority decisions before quoting safe-auto precision;
- safe auto-mark precision >=99.9%;
- server read p95 <=4,000 ms on the device (replaces the retired on-device 500 ms target; default of 2 November 2026 pending the owner's confirmation; may be tightened, never loosened, without a recorded decision).

The additional 200-critical-expression and 1,000-auto-decision minima do not lower the production standard. They prevent a tiny lucky subset from being used to claim that the corresponding percentage has been measured meaningfully.

## Critical structure

A sample is critical when it contains a power, fraction/division structure, radical, relation/equality or multi-line ownership. Set `critical:true` when the collection harness knows the prompt belongs to a critical bucket. The scorer also derives a conservative critical flag from the canonical target when that field is absent.

## Failure handling

When the strict gate fails, do not lower a threshold. Classify the failing cases by the production taxonomy in `PRODUCTION_STANDARD.md`, then improve the earliest failing authority in the chain: capture -> picture -> server read -> calibration/confirmation -> marking authority.
