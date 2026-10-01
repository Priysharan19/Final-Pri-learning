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
| CP-02 Platform Bridge Foundation | SOFTWARE IMPLEMENTATION: COMPLETE once merged (see notes) | `fa1c44df` | recorded by CP-03 | this PR | recorded by CP-03 | DEFERRED |

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
