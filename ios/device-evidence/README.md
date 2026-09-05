# Pri Learning — Physical iPad Validation Protocol

This directory is the evidence boundary between **simulator confidence** and **physical iPad proof**.

A green simulator run is valuable, but it does not prove Apple Pencil latency, touch arbitration, device rotation, memory pressure, real camera/share sheets, or storage behaviour on hardware. Do not describe a case as physically validated unless a result file from a real iPad exists under `ios/device-evidence/results/`.

## Recording rules

- Use a physical iPad. Never set `physicalHardware: true` for a simulator.
- Record the exact Git commit tested.
- Use an anonymised tester ID; do not put student names in the repository.
- Record exact iPad model, iPadOS version and Pencil model.
- Run every required case below on the same build.
- A failure must include reproduction notes.
- `blocked` and `not-run` are honest states. Do not convert them to pass to satisfy a gate.
- Store one JSON file per device/test run in `ios/device-evidence/results/`.

Validate locally with:

```bash
npm run test:ios:device-evidence
```

For a release candidate, use:

```bash
npm run test:ios:device-evidence:strict
```

Strict mode fails if there is no physical evidence, if a required case fails, or if a required case is blocked/not-run.

## Required critical cases

### LAUNCH-001 — cold launch
1. Force-quit Pri Learning.
2. Disable network connectivity.
3. Launch the app.
4. Verify the shell paints without a white/error page and the saved profile is available.

Pass: app reaches usable home/login state offline without data loss or crash.

### PENCIL-001 — Pencil writes, finger scrolls
1. Open a handwriting answer area.
2. Write with Apple Pencil.
3. Scroll the page with a finger.
4. Alternate rapidly between writing and scrolling.

Pass: Pencil never scrolls the page; finger does not leave ink after Pencil mode is established; no visible input lag regression.

### PENCIL-002 — erase, undo, redo
Write at least 20 strokes, erase multiple strokes, undo repeatedly, then redo.

Pass: drawing state is visually and semantically restored without missing/duplicated strokes.

### PENCIL-003 — long handwriting session
Write continuously across at least 10 maths working lines with fractions, powers, roots, equals signs and variables.

Pass: no crash, runaway lag, stroke loss or unusable recognition degradation.

### INK-ALIGN-001 — scroll alignment
Write near the top, middle and bottom of a long question/working area while repeatedly scrolling.

Pass: native Pencil ink remains welded to the intended web-paper coordinates.

### INK-ROTATE-001 — rotation / resize alignment
With ink visible, rotate portrait → landscape → portrait. If supported, repeat while entering/exiting Split View or resizing Stage Manager.

Pass: existing strokes and active writing surface stay aligned; no stale overlay intercepts touches outside the writing area.

### OFFLINE-001 — network independence
Use Practice, handwriting, marking, History and Progress with Wi-Fi and cellular networking unavailable.

Pass: core learning flow remains functional and does not block on remote resources.

### LIFECYCLE-001 — background / foreground
Begin an answer, background the app for at least 60 seconds, return, lock/unlock the iPad, then continue.

Pass: unsaved working is not unexpectedly lost and the Pencil surface still responds correctly.

### PERSIST-001 — relaunch persistence
Complete work, force-quit, relaunch and inspect History/Progress.

Pass: committed attempt/progress data survives exactly once with no duplication or rollback.

### BACKUP-001 — export/import round trip
Export a full backup, create or use a clean profile context, import it, and compare representative history/progress/settings/task data.

Pass: documented backup-owned state round-trips without silent loss or corruption.

### EXAM-001 — long exam flow
Run a representative timed exam session with typed and handwritten answers, navigation and final submission.

Pass: no crash, stale answer, timer corruption, duplicate submission or unrecoverable navigation state.

### SHARE-001 — native share/export
Export a backup/task/progress file through the iPad share sheet and save it to Files or AirDrop target.

Pass: sheet presents correctly on iPad, exported file is usable, cancellation and retry do not break the app.

## Recommended extended cases

- `CAMERA-001` photo attachment permission granted/denied/retry.
- `KEYBOARD-001` software keyboard appears/disappears around maths input without covering controls.
- `HWKEY-001` hardware keyboard navigation/input.
- `VOICEOVER-001` core Practice flow with VoiceOver.
- `DYNAMIC-001` largest supported Dynamic Type setting.
- `STORAGE-001` low free-storage warning / large history behaviour.
- `MEMORY-001` long session with repeated page transitions and large ink drawings.
- `IMPORT-001` malformed/older-version import rejection and recovery.

## Result schema

Example:

```json
{
  "schemaVersion": 1,
  "physicalHardware": true,
  "testRunId": "ipad-air-m2-2026-08-22-a",
  "recordedAt": "2026-08-22T12:00:00Z",
  "testerId": "tester-001",
  "build": {
    "commit": "0123456789abcdef0123456789abcdef01234567",
    "appVersion": "4.0 (2)"
  },
  "device": {
    "model": "iPad Air 11-inch (M2)",
    "osVersion": "18.6",
    "pencil": "Apple Pencil Pro"
  },
  "cases": [
    { "id": "LAUNCH-001", "status": "pass", "notes": "" },
    { "id": "PENCIL-001", "status": "pass", "notes": "" }
  ]
}
```

The validator requires every critical ID. The example above is intentionally incomplete and therefore is **not** valid release evidence.

## Minimum release evidence target

Before Pri Learning is described as physically validated for iPad production, collect at least:

- one 60 Hz / non-Pro representative iPad,
- one modern iPad Air,
- one iPad Pro where available,
- at least two Apple Pencil generations where hardware access permits,
- current shipping iPadOS plus one supported older major version where practical,
- all critical cases passing on every claimed supported configuration.

Hardware availability may limit the matrix. Record the gap instead of inventing coverage.
