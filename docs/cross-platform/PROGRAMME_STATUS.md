# Cross-Platform Programme Status

This is the durable ledger for CP-02 → CP-12 and SEC-COMM-01. Each CP's own PR adds or updates its row. The *next* CP's PR records the previous CP's merge SHA, because a merge SHA cannot exist inside the PR it merges. Rows are never edited to look more complete than they were: corrections are appended as dated notes.

**Status vocabulary** (owner decision, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)):
- `SOFTWARE IMPLEMENTATION: COMPLETE` means merged with every automated gate green.
- `PHYSICAL DEVICE VALIDATION: DEFERRED` means the physical gates are open. They are never waived.
- `BLOCKED_EXTERNAL` means the task needs an owner, store, console or legal action.

**Evidence classes:**
- **S0**: static/contract tests.
- **S1**: browser.
- **S2**: simulator/emulator.
- **P**: physical device. P evidence is **NONE** for every row below unless a row says otherwise.

## Ledger

| CP | Status | Starting `main` | Final candidate | PR | Merge SHA | Physical |
|---|---|---|---|---|---|---|
| CP-01 Architecture audit | COMPLETE | `421f1ff1` | `1291d4bd` | [#250](https://github.com/Priysharan19/Final-Pri-learning/pull/250) | `fa1c44df` | n/a (audit) |
| CP-02 Platform Bridge Foundation | SOFTWARE IMPLEMENTATION: COMPLETE | `fa1c44df` | `f089d550` | [#253](https://github.com/Priysharan19/Final-Pri-learning/pull/253) | `2261f03b` | DEFERRED |
| CP-03 Responsive Product Foundation | SOFTWARE IMPLEMENTATION: COMPLETE once merged | `2261f03b` | recorded by CP-04 | this PR | recorded by CP-04 | DEFERRED |

## CP-02 — Platform Bridge Foundation

**Delivered:**
- `client/src/platform/native/` is the only native boundary:
  - `index.js`: the `priNative` facade.
  - `host.js`: discovery, protocol and capability-version negotiation, deep-frozen descriptor, no OS identity.
  - `envelope.js`: envelope v1, limits, per-op reply schemas.
  - `bridge.js`: timeouts, cancellation, late/duplicate/malformed replies, per-capability in-flight cap, size limits, sequenced and bounded event buffering, native→JS requests, dispose.
  - `errors.js`: the closed error set.
  - `legacyApple.js`: the pre-envelope Apple handlers, behind one transport per capability.
  - `fakeHost.js`: an executable envelope host for tests.
- **Consumers migrated:** every product reference to `window.webkit.messageHandlers` and `__PRI_NATIVE*__`. That covers ink, photo/OCR, StoreKit, native cloud, share/export (including account export, now through one `saveTextFile` path whose blob URL outlives the download), service-worker gating, offline warm-up, persisted storage, settings copy, the ink bootstrap profile, release identity and the dev structural hook.
  - The import-time `NATIVE_INK` constant is now evaluated per mount.
  - Native ink messages pass an answer-blind key allowlist.
- **Apple shell:**
  - `NativeHostBridge.swift` adds `priBridge` (envelope v1): `host.ready`, `host.diagnostics` (logs only), `share.file` (text or binary), `share.print`, `storage.status`, `device.facts`, `lifecycle.state`.
  - Lifecycle events (`active`/`inactive`/`background`) arrive with a background-task grace period; drafts flush on `inactive`/`background`.
  - `WebShell.swift` injects the deep-frozen, non-configurable `__PRI_HOST__` and the legacy flags into the **main frame only**.
  - Every bridge message must pass `isTrustedSender`: same web view, main frame, `prilearning://app`. The origin is unchanged.
- **Tests:**
  - `client/test/native-host-contract-check.mjs`: 64 behavioural checks.
  - The existing ink, photo, StoreKit and cloud boundary tests pass. Their source pins moved to the new files at equal strength.
  - Architecture guard: 268 checks. Product modules may no longer touch WebKit, injected flags, native receivers/events, `__PRI_HOST__` or `host.diagnostics`, and the Swift sender gate and main-frame injection are pinned.
- **Simulator evidence (S2, synthetic):**
  - `node scripts/native-bridge-selfcheck.mjs --family ipad` passed 7/7 on an iPad Air 11-inch (M4) simulator, iOS 27.0: host present, deep-frozen, not replaceable, no OS identity, main-frame round trip, same-origin subframe refused, subframe has no host.
  - Swift compiled for iPad and iPhone simulators.
  - CI runs the same self-check on the macOS runner (`.github/workflows/native-ink.yml`).

**Environment note (2026-10-01, UTC):** after the iPad run, the local CoreSimulator iOS 27.0 runtime image became unmounted ("runtime profile not found"). Restarting the user-level CoreSimulator service did not remount it, and `simdiskimaged` runs as root, so it cannot be restarted without elevated access. The local iPhone bridge self-check and the local iPad ink self-check could therefore not run after that point. This is an environment problem, not a code result; the macOS CI runner provides the simulator gate.

**Deferred (physical):** iPad + Apple Pencil smoke (write → recognise → submit; StoreKit sandbox restore), because Swift bridge code changed. No iPad release containing this Swift change ships until that smoke is recorded.

**Not in CP-02 scope (by design):** ink, photo, billing and cloud stay on their legacy Apple handlers during the migration window. The contract defines their envelope ops for Android (CP-07/CP-08). Apple-specific user copy ("Apple Pencil") moves to capability-driven copy in CP-04.

**CP-02 exact-head evidence (recorded by CP-03):**
- Candidate `f089d550` (after merging `main` @ `487cfac0`).
- Clean-worktree `npm test`: exit 0 across 70 suites. That includes the engine 1704000/1704000, the architecture guard 268/268, the native host contract 76/76 and the install budget 47/47. The `test:hard` handwriting suite passed at 14/15 scenes; the one failing scene, which was already failing before CP-02, is within its threshold.
- Also passing: fleet and mission-control validation, native package sync, the network boundary, the cloud account boundary, the native cloud/StoreKit boundaries, and the server native-origin CSRF check.
- `check:ios`: asset parity 160/160 in both bundles. The local `release.json` difference came from a rebuild at a newer commit; the file is gitignored, and CI's build job passed `check:ios`.
- GitHub CI on `f089d550`: 23 checks pass. That includes the macOS "Swift build, native benchmark and bridge smoke test" job, which runs the iPad simulator `--bridge-selfcheck`.
- Merged as `2261f03b`. Verified on `main`: `client/src/platform/native/` is present, the guard passes, and there is no `android/` directory.

## CP-03 — Responsive Product Foundation

**Re-validated before implementing** (Chromium and WebKit, on the post-CP-02 code):

| Finding | Result |
|---|---|
| Fixed 380 px writing area on a 360×640 phone | Confirmed |
| Developer handwriting copy shown to students | Confirmed: the "legacy JS fallback" note, engine labels, and the Settings handwriting text |
| No `inputMode`/`enterKeyHint` on answer boxes | Confirmed |
| Settings menu overlay (mobile) | Confirmed. The single-column menu stayed `position: sticky` and covered controls, such as email edit. |
| Next obstructed after answering | Confirmed and root-caused. At ≤820 px, Pri Explain's launcher grew to full width at `bottom: 82px`, over the Next pill at `bottom: 74px`. It only appears once a worked solution exists, which is why it was intermittent. |
| Primary buttons too small for touch | Found by the matrix: `.btn` was 42 px on touch screens, because a later base rule beat the coarse-pointer rule |
| Non-India progress overflow | **Not reproduced** (0 px at 360/390/430). Not changed. |

**Delivered:**
- `client/src/platform/formFactor.js`: COMPACT/MEDIUM/EXPANDED + SHORT from viewport and pointer only, plus `data-ff`/`data-short`/`data-pointer` on `<html>`.
- A fitted handwriting area. EXPANDED and tall MEDIUM windows keep the 380 px writing area. Compact gets `height − 330`, never below 240. Sizing uses the layout viewport in 40 px steps, so toolbar collapse and pinch-zoom don't make it jitter, and a keyboard opened while typing doesn't shrink a tablet canvas.
- Strokes are rescaled when the canvas width changes. Widening is clamped so the lowest point stays 8 px above the foot of the sheet. Points are copied, not mutated, and a marked (disabled) answer is never re-read.
- Diagnostics-only engine and fallback labels. "Read on the server" stays visible to students for privacy.
- Student-appropriate copy in English and Hindi.
- `inputMode="text"` + `enterKeyHint` on answer boxes. A numeric keypad would block expression answers.
- The Settings menu is static once the grid collapses.
- The Explain launcher is a full-width bar above the pill at ≤760 px. Above that it stays a compact corner button, raised to `bottom: 112px` so it clears the pill whatever the pill's height. The content gets bottom room for the pill.
- The sidebar's sticky offset includes the top-bar inset, so the two line up in an installed web app.
- 44 px coarse-pointer targets, including `.btn`.
- Toasts span the screen width on phones.
- The top bar's height includes the status-bar inset.
- `dvh` for full-height surfaces, a SHORT layout for auth, and hover-only effects neutralised on touch.
- `client/test/e2e.mjs --browser=webkit`.

**What tablets (EXPANDED/MEDIUM) see differently:** the layout and the 380 px writing area are unchanged. Two small, intentional changes do apply:
- Primary buttons are 44 px on touch screens, the size the original "iPad & touch" rule intended. They were 42 px.
- Pri Explain's corner launcher sits at `bottom: 112px` instead of 82/88 px, because it could overlap a tall Next pill.

**Tests (S1, synthetic browser evidence):**
- `client/test/tour-responsive-matrix.js`: **145/145 in Chromium and 145/145 in WebKit**, across 360×640, 390×844, 430×932, 820×1180, 1180×820 and 844×390. It covers:
  - overflow on 7 routes;
  - classification and navigation;
  - a question that offers handwriting and typing;
  - the writing area fitting (or keeping 380 px on iPad);
  - synthetic strokes;
  - no developer copy;
  - keyboard attributes;
  - submit reachable;
  - Next uncovered after answering;
  - Pri Explain offered after a forced worked solution, its launcher clear of Next and placed correctly for the width (full-width bar on phones, corner button above 760 px);
  - the sidebar starting below the top bar;
  - synthetic strokes landing inside the stroke box on the editor's own canvas (empty before);
  - phone → tablet widening keeping the lowest stroke visible and unclipped, and phone → small-phone narrowing keeping ink on the sheet;
  - 44 px targets;
  - Settings controls uncovered.
- Run against the CP-02 build, an earlier 121-check version of the matrix failed 28 checks.
- Mutation tests against the final matrix:
  - Re-scoping the full-width launcher to 820 px fails the tablet-portrait placement check.
  - Removing the widening clamp fails the widening check.
- Independent review returned "request changes". All of it is fixed:
  - widening clipped ink;
  - a re-read after marking;
  - the launcher reached iPad portrait;
  - `visualViewport`-driven jitter and keyboard shrink;
  - sidebar/inset misalignment;
  - vacuous matrix checks;
  - hard-coded English;
  - unknown `--browser` values were accepted.
- `client/test/form-factor-check.mjs`: 27/27.
- Existing phone and KALP tours pass unchanged: phone 53/53, KALP-01 24/24, KALP-02 68/68, KALP-03 53/53.

**Deferred (physical):** real-device keyboard behaviour, notch/safe-area rendering in an installed web app, and touch feel on small phones.
