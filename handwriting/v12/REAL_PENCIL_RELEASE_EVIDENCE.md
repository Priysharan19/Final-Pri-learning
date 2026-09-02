# Pri Ink physical Apple Pencil release evidence

Status: **measurement protocol**. This is the bridge between a correct implementation and a defensible production handwriting claim.

Synthetic writers, simulator suites and deterministic fixtures remain regression evidence. They do not satisfy this protocol.

## What must be measured

Run the actual production handwriting path on physical iPads and record one JSON file per anonymised writer/session under:

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

Do not repeatedly inspect final-holdout errors and then tune the recogniser against them.

## Required result schema

```json
{
  "schemaVersion": 1,
  "physicalHardware": true,
  "runId": "P0001-session-2026-09-02-a",
  "recordedAt": "2026-09-02T09:00:00Z",
  "build": {
    "commit": "0123456789abcdef0123456789abcdef01234567",
    "appVersion": "1.0"
  },
  "device": {
    "model": "iPad Air 11-inch (M2)",
    "osVersion": "18.6",
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
      "recognitionMs": 183.4,
      "engine": "pri-consensus:pri-foundation+native-rescue",
      "productionReady": true,
      "researchOnly": false,
      "critical": true
    }
  ]
}
```

For `final-holdout`, the writer object must additionally contain `"holdoutLocked": true`.

## Measurement rules

- Use anonymous stable writer IDs only. Never commit names, emails, school identifiers or account identifiers.
- Every selected writer belongs to exactly one train/validation/test/final-holdout split.
- `target` is the prompt's ground-truth transcription, not the expected mathematical answer to an arbitrary student problem.
- `recognized` is what the production recognition path emitted before any student correction.
- `authority` is the production marking decision: `auto`, `confirm`, or `abstain`. Do not hand-edit it after seeing whether recognition was correct.
- `recognitionMs` measures recognition computation/request time after the production quiet-window/debounce begins the read. Record user-visible ink-to-preview separately if desired; it is not substituted for this metric.
- `researchOnly:true` and `productionReady:false` readings are rejected from production evidence.
- A repeated sample ID for the same writer is rejected so repeated measurements cannot inflate accuracy.
- Final-holdout data is opened intentionally for release evidence, not daily tuning.

## Strict production floors

The validator enforces the existing production-standard floors and adds evidence-sufficiency minima for the two metrics most vulnerable to tiny-sample claims:

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
- recognition p95 <=500 ms.

The additional 200-critical-expression and 1,000-auto-decision minima do not lower the production standard. They prevent a tiny lucky subset from being used to claim that the corresponding percentage has been measured meaningfully.

## Critical structure

A sample is critical when it contains a power, fraction/division structure, radical, relation/equality or multi-line ownership. Set `critical:true` when the collection harness knows the prompt belongs to a critical bucket. The scorer also derives a conservative critical flag from the canonical target when that field is absent.

## Failure handling

When the strict gate fails, do not lower a threshold. Classify the failing cases by the production taxonomy in `PRODUCTION_STANDARD.md`, then improve the earliest failing authority in the chain: capture/line ownership -> glyph/structure recognition -> arbitration/confidence -> marking authority.
