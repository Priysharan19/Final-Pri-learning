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
| CP-03 Responsive Product Foundation | SOFTWARE IMPLEMENTATION: COMPLETE | `2261f03b` | `6b9235a0` | [#261](https://github.com/Priysharan19/Final-Pri-learning/pull/261) | `003cc053` | DEFERRED |
| CP-04 iPhone Product | SOFTWARE IMPLEMENTATION: COMPLETE | `003cc053` | `09d868b6` | [#266](https://github.com/Priysharan19/Final-Pri-learning/pull/266) | `3ed4f9c4` | DEFERRED |
| CP-05 iPhone Automated Certification | SOFTWARE IMPLEMENTATION: COMPLETE | `3ed4f9c4` | `1820d32c` | [#273](https://github.com/Priysharan19/Final-Pri-learning/pull/273) | `247f12c2` | DEFERRED |
| CP-06 Android Shell | SOFTWARE IMPLEMENTATION: COMPLETE once merged | `247f12c2` | recorded by the next CP | this PR | recorded by the next CP | DEFERRED |

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

**CP-03 exact-head evidence (recorded by CP-04):**
- Candidate `6b9235a0`, after merging `main` twice during review (#259 migration CLI transactions, then #255 misconception ontology); only generated bundles conflicted, and they were rebuilt.
- Clean-worktree local run on `6b9235a0`: `npm test` exit 0; e2e 235/235 across 7 flows; responsive matrix 145/145 in Chromium **and** WebKit; phone tour 53/53; KALP-04 26/26; accessibility gate exit 0.
- GitHub CI on `6b9235a0`: 27 checks pass, 3 skipped (path-filtered mirror/iPad-shell jobs), 0 failing, including all four required checks.
- Merged as `003cc053` with `--match-head-commit`. Verified on `main`: `client/src/platform/formFactor.js` present, form-factor check 27/27, architecture guard 267/267, native host contract 76/76, and still no `android/` directory.
- One transient failure is recorded honestly: an earlier local accessibility run on the previous head exited 1 with "0/1 checks" in its metadata group while the host was under heavy parallel load. A re-run passed with no code change, and CI passed it on the exact head.

## CP-04 — iPhone Product

**Delivered:** the iPhone results are in [IPHONE_GAP_REPORT.md](IPHONE_GAP_REPORT.md) §5. In summary:
- Finger-default native ink where no Apple Pencil can exist (`InkSurface.fingerDrawingEnabled`; host facts `ink.stylus` / `ink.fingerDefault`, mirrored by the page). iPad stays Pencil-first.
- Dynamic Type as page zoom, capped so the CSS viewport never drops below 360 px, with zoom-aware native ink placement.
- iPhone portrait-only; iPad keeps all orientations.
- Account-action deep links routed only for the signed cloud host, with the token fragment never logged. Dormant until Associated Domains exist (**BLOCKED_EXTERNAL**).
- `scripts/apple-shipping-target.mjs`: `main` declares **iPad only** (V1 hard blocker #1 closed in code; `--check-v1` in CI). iPhone engineering CI builds a scratch copy with the iPhone family that is never archived.
- Simulator harnesses compiled only in DEBUG: `BridgeSelfCheck` (8 checks, including zoom-aware ink placement) and `JourneySelfCheck` (onboarding → practice → typed attempt marked → feedback → next → native ink → progress → persistence → relaunch).
- The package drift gate widened to `Info.plist`, models and assets (36 files). The stale `PriLearning.swiftpm.zip` was removed.
- `native-ink.yml` runs on the macOS runner: `--check-v1`, one engineering build, the iPhone bridge self-check, the iPhone and iPad journeys, and an uploaded evidence artefact.

**V1 scope reconciliation:** `docs/release/PRI_V1_RELEASE_SCOPE.md` (owner, PR #257) makes V1 iPad-only. CP-04's iPhone work therefore ships only as engineering capability on `main`. A public iPhone release needs the V1 scope-change procedure (**BLOCKED_GOVERNANCE**) and the physical gates in [IPHONE_GAP_REPORT.md](IPHONE_GAP_REPORT.md) §4.

**Simulator evidence (S2, synthetic):** local runs on 2026-10-01 UTC were 11/11 journey steps on an iPhone 18 Pro simulator and on an iPad Pro 13-inch (M5) simulator, both iOS 27.0, plus the bridge self-check 8/8 on both. CI repeats these on its own simulators and uploads the evidence records.

**Environment note:** the local iPad `ink-native` benchmark run scored 93.8% and 6/10 below its floor. The same failure reproduces on untouched `main`, so it comes from the local iOS 27.0 Vision runtime and not from CP-04. The macOS CI benchmark passes. No threshold was changed.

**Deferred (physical):** finger writing feel on a real iPhone, VoiceOver, and real Dynamic Type sizes on hardware. Also an iPad + Apple Pencil smoke test, because the Swift ink and shell code changed.

**CP-04 exact-head evidence (recorded by CP-05):**
- Candidate `09d868b6`. `main` was merged in three times during review because parallel work kept landing. Only the generated iOS bundles conflicted; they were rebuilt from the committed tree and resynced.
- GitHub CI on the candidate: all four required checks pass. 25 checks passed, 3 were skipped (path-filtered), and the Swift job (not required) was still running at merge time.
- **Swift build, native benchmark and bridge smoke test** (macOS runner, not a required check) failed on the earlier CP-04 heads in both trigger runs, from the simulator rather than a product assertion:
  - the pull-request run: `simctl launch` → `FBSOpenApplicationServiceErrorDomain code=1`;
  - the push run: the app launched, but the bridge self-check logged no summary within its window.
  - It was re-run once, which is the infrastructure allowance. CP-05 adds a launch retry to both harnesses, and **CP-05's own CI must show that job green**. It is not waived.
- Merged as `3ed4f9c4` with `--match-head-commit`.

## CP-05 — iPhone Automated Certification

**Delivered:** the full results are in [IPHONE_GAP_REPORT.md](IPHONE_GAP_REPORT.md) §6. In summary:
- `scripts/iphone-journey.mjs --cloud --dynamic-type --lifecycle --a11y` drives the real app in the real WKWebView. The cloud phases run against the **real server** on a throwaway database, through `scripts/cloud-fixture-server.mjs` (fixture accounts only; the credentials pass through `SIMCTL_CHILD_` environment variables and are never logged). Steps covered:
  - sign-up, then login;
  - sign-in, sync, then session kept across a relaunch;
  - logout, with server-side proof from the fixture server's log;
  - account deletion, with the server refusing that account afterwards;
  - typed attempt → feedback → next;
  - finger-default native ink and native photo OCR, both programmatic;
  - offline practice, with sync not offered;
  - reconnect sync;
  - background → foreground keeps a draft;
  - relaunch persistence;
  - a DOM-level accessibility smoke check;
  - Dynamic Type at the largest accessibility size with no sideways overflow.
- Every run writes a `SYNTHETIC_SIMULATOR` evidence record with `physicalDevice: false`. `native-ink.yml` runs the full journey and uploads the records.
- **Product bugs found and fixed:**
  1. CP-04's Dynamic Type used `pageZoom`, which magnifies without reflowing and clipped the iPhone page. It now goes through the viewport (width ÷ capped scale) at document start. Ink placement uses `pageZoom × zoomScale` and is re-placed on zoom changes. Width rules that used `vw` now use `%`.
  2. The account label read "sign-in required" when the server was simply unreachable. It now distinguishes `Linked · offline`, `Linked · cloud unavailable`, `Linked · sign-in required` (401 only) and `Linked · checking…`.
  3. Every successful Sync or refresh dropped a connected account back to "sign-in required" (pre-existing). It now stays connected.
- Both harnesses retry the launch when the simulator's SpringBoard is not ready.

**Simulator evidence (S2, synthetic, 2026-10-02 local):** iPhone 18 Pro, iOS 27.0: **28/28** journey steps. iPad Pro 13-inch (M5): **16/16**. Bridge self-check 8/8 on both. The records are `docs/release/evidence/cp05/journey-{iphone,ipad}.local.json`.

**Not automated (stated, not hidden):**
- StoreKit Testing / restore: `SKTestSession` needs an XCTest target, which the SwiftPM app package does not have. That is a tooling gap. Sandbox purchases are **BLOCKED_EXTERNAL**.
- XCUITest `performAccessibilityAudit`: same reason.
- Live ink placement at large text sizes.

**Deferred (physical):** small, standard and large iPhones; finger writing feel; camera; keyboard; VoiceOver; Dynamic Type on hardware; StoreKit sandbox; process death under real memory pressure; launch performance.

**CP-05 exact-head evidence (recorded by CP-06):**
- Candidate `1820d32c`, after merging `main` (#262 observability and others). The account-state strings were moved into i18n (en + hi) during that merge.
- Local: `npm test` exit 0 on the merged tree.
- GitHub CI on `1820d32c`: all four required checks pass, with 19 checks passing in total.
- Merged as `247f12c2` with `--match-head-commit`. The merge automation waits only for the required checks, so it merged while **Swift build, native benchmark and bridge smoke test** (macOS simulator, not required) was still running. Its result is recorded by CP-07. If it fails, it is fixed in a follow-up and not waived.


## CP-06 — Android Shell

**Delivered:** `android/`, a Kotlin shell around one WebView serving the **same** shared web build. [ANDROID_ARCHITECTURE.md](ANDROID_ARCHITECTURE.md) is the authority.
- **Stable origin:** `https://appassets.androidplatform.net` through `WebViewAssetLoader` (HTTP disabled), with an SPA fallback and local 404s. `/v1/*` never maps to the SPA. Any other form of the bundled host (another port, userinfo, http) is answered locally, never by the network.
- **Hardened WebView:** no file/content access, no mixed content, Safe Browsing, no multiple windows, no geolocation, debugging only in DEBUG, algorithmic darkening off. Fails closed below Chromium 91, or without `WEB_MESSAGE_LISTENER` / `DOCUMENT_START_SCRIPT`.
- **Bridge:** `priBridge` is an origin-scoped `addWebMessageListener` with a main-frame check, never `addJavascriptInterface`. The deep-frozen, non-configurable `__PRI_HOST__` is installed at document start for the bundled origin only. It carries capabilities, never OS identity.
- **Navigation:** only the exact bundled origin loads in-app. http(s)/mailto leave the app only for a main-frame navigation the person started; everything else is blocked.
- **Back:** the page declares whether it wants Back: a visible sheet/dialog, or in-app history (`history.state.idx > 0`). The callback is enabled exactly then; otherwise the system default runs (predictive back-to-home). A press that finds a dialog open never also navigates. The role landing (`/`, `/teach`) is the first entry, so Back there leaves the app.
- **Lifecycle and layout:** edge-to-edge letterbox insets with light bar icons. Rotation, fold and multi-window are handled without recreation. Lifecycle events go to the page.
- **Renderer crashes:** recovery destroys the dead WebView, is rate-limited, and shows a native screen after repeated crashes.
- **Dialogs and release identity:** `alert`/`confirm` get real native dialogs. The bundled release identity is exposed.
- **Build:** Gradle 9.3.1 (pinned SHA-256), AGP 8.12.3, Kotlin 2.1.20, webkit 1.17.1, JDK 17. Release builds require `-Ppri.versionCode`. `pri.cloudOrigin` is validated at build time. `verifyPriWeb` cannot be skipped as NO-SOURCE.
- **Embedded web:** `scripts/sync-android.mjs --check` proves the embedded web is exactly `client/dist`.

**Evidence (S0/S2, synthetic):**
- JVM: `ShellLogicTest` 10/10 (origin, SPA mapping, traversal, navigation policy incl. port/userinfo/gesture, WebView floor, envelope, descriptor).
- Instrumented journey (`android/scripts/run-instrumented.sh`), with a **real process death** (`am force-stop`) between two runs. Covered:
  - boot and handshake;
  - onboarding into a local profile;
  - SPA routing and history Back;
  - Back closing the More sheet before navigating;
  - rotation keeping a typed answer;
  - blocked schemes;
  - a tapped external link leaving the app while a scripted redirect launches nothing;
  - Back on the landing entry leaving the app;
  - after process death, the profile (IndexedDB) and localStorage survived.
- Local: passed on the API 36 phone emulator (2026-10-02).
- CI matrix (`android-shell.yml`): API 26 asserts the fail-closed floor screen (its factory WebView is below Chromium 91). API 33 and API 36 phone, and API 36 tablet, run the product journey.
- Independent review requested changes; all were applied: the Back trap at `/teach`; the double action on a stubborn dialog; the skippable web check; API 26 evidence that overstated what it proved; process death not proven; renderer-crash loop; reset race; system Back; bar icons; navigation-policy gaps; observer cost.

**Deferred (physical):** a low-end phone boot smoke test, real Back gestures and predictive animation, OEM WebView variants, and foldable posture changes.
