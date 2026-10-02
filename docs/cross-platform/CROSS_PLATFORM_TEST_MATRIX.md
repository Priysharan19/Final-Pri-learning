# Cross-Platform Test Matrix (CP-01)

Initial audit baseline `main` @ `421f1ff1`; revalidated against `main` @ `7f4a0559`.

Evidence classes are kept strictly separate, per `AGENTS.md`. A result from one class must never be reported as another.

| Class | Meaning | Examples |
|---|---|---|
| **S0 — static** | Source/contract analysis | `client/test/cross-platform-architecture-check.mjs`, `tools/check-client-network-boundary.mjs` |
| **S1 — browser synthetic** | Playwright Chromium (and WebKit once added) at emulated viewports | `client/test/tour-phone.js`, `client/test/e2e.mjs` |
| **S2 — simulator/emulator** | iOS Simulator / Android Emulator running the real shell | `scripts/ink-native-check.mjs` (iPad only today) |
| **P — physical device** | Real hardware, real stylus or finger, real store sandbox | none exists for iPhone or Android. iPad evidence follows its own workflows (`.github/workflows/ink-physical-evidence.yml`, PR `Priysharan19/Final-Pri-learning#18`). |

## 1. Device and viewport matrix

CSS px = viewport in CSS pixels. The form-factor class follows [FORM_FACTOR_SPEC.md](FORM_FACTOR_SPEC.md).

| Id | Platform | Representative | CSS viewport (portrait) | Class | S1 browser | S2 sim/emu | P physical |
|---|---|---|---|---|---|---|---|
| A1 | Apple | Compact iPhone (SE 3rd gen class) | 375×667 | COMPACT (+SHORT with keyboard) | required (CP-03) | iPhone SE simulator (CP-05) | required (CP-05) |
| A2 | Apple | Current standard iPhone (iPhone 17e class) | 390×844 | COMPACT | ✅ today (`client/test/tour-phone.js`, 390×844) | ✅ audit-only build+launch 2026-10-02; CI in CP-04 | required (CP-05) |
| A3 | Apple | Large iPhone (Pro Max class) | 440×956 | COMPACT | required (CP-03) | Pro Max simulator (CP-05) | required (CP-05) |
| A4 | Apple | iPad portrait (iPad Air 11 class) | 820×1180 | EXPANDED | ✅ KALP tours (`client/test/tour-kalp02-navigation.js`) | ✅ `scripts/ink-native-check.mjs` | existing iPad workflows |
| A5 | Apple | iPad landscape | 1180×820 | EXPANDED | ✅ KALP tours | ✅ | existing iPad workflows |
| A6 | Apple | iPad mini portrait / Split View | 744×1133 / ≈ 507×1133 | MEDIUM / COMPACT | required (CP-03) | iPad mini simulator (CP-04) | optional |
| D1 | Android | Small phone (entry 720p) | 360×640 | COMPACT (+SHORT) | 🟡 360×800 today; add 360×640 (CP-03) | API 26 emulator (CP-06) | required (CP-10) |
| D2 | Android | Normal phone (Pixel 7 class) | 412×915 | COMPACT | required (CP-03) | API 36 emulator (CP-06) | required (CP-10) |
| D3 | Android | Large phone (Pro XL / Ultra class) | 448×998 | COMPACT | required (CP-03) | emulator (CP-10) | required (CP-10) |
| D4 | Android | Tablet portrait (10–11″) | 800×1280 | EXPANDED (MEDIUM < 840) | required (CP-03) | tablet emulator (CP-10) | required (CP-10) |
| D5 | Android | Tablet landscape | 1280×800 | EXPANDED | required (CP-03) | tablet emulator (CP-10) | required (CP-10) |
| D6 | Android | Foldable inner display | ≈ 673×841 | MEDIUM | required (CP-03) | foldable emulator (CP-10) | optional |
| D7 | Android | Stylus tablet (S Pen / USI) | 800×1280 | EXPANDED | ➖ | emulator stylus is synthetic only | required for any stylus claim (CP-09) |

**Status (CP-03):** the S1 browser matrix exists as `client/test/tour-responsive-matrix.js` and runs in Chromium and WebKit in the required browser job. It covers A1-class (360×640), A2 (390×844), A3-class (430×932), tablet portrait (820×1180), tablet landscape (1180×820) and short (844×390). The original note follows: the S1 browser matrix is a single Playwright helper (CP-03) that iterates these viewports with `hasTouch` and `isMobile` set correctly. Today `client/test/e2e.mjs` creates a context at 1440×900 with `hasTouch: true` and **no `isMobile`**, so a coarse pointer is not emulated faithfully. The helper should also run **WebKit** for the Apple rows, because WKWebView-specific regressions are invisible to Chromium.

## 2. Gates by journey

✅ = automated today. ⬜ = to be added in the named CP task. P = physical-only part.

| Gate | S0 static | S1 browser (viewports) | S2 iOS Simulator (iPhone + iPad) | S2 Android Emulator | P physical-only |
|---|---|---|---|---|---|
| Responsive rendering: no horizontal overflow, ≥44 px targets, no overlap of primary actions | ⬜ CP-03 token/rule lint | ✅ 360/390 overflow + targets (type mode); ⬜ CP-03 all S1 rows, write mode, post-answer state | ⬜ CP-05 screenshot set | ⬜ CP-10 screenshot set | visual sign-off on the smallest device |
| Critical student journey (onboard → home → question → feedback → next) | — | ✅ desktop (`client/test/golden-student-journey.mjs` at 1440×900); 🟡 phone partial (`client/test/tour-phone.js`); ⬜ CP-03 full journey at A1, D1, A4, D5 | ⬜ CP-05 XCUITest or `simctl`-driven journey | ⬜ CP-10 Espresso/UI Automator journey | P: full journey per device row |
| Signup / login / session persistence | ✅ server contracts (`server/test/account-lifecycle-contract-check.mjs`) | ✅ `client/test/tour-cloud-platform.js` (desktop) | ⬜ CP-05 relaunch keeps session (native cookie jar) | ⬜ CP-07 encrypted cookie jar survives relaunch; cleared on logout | P: real network, captive portals |
| Question attempt: typed | — | ✅ `client/test/tour-phone.js` typed answer fits | ⬜ CP-05 | ⬜ CP-10 | P: soft keyboard on smallest device |
| Question attempt: handwriting (finger) | ✅ ink contract checks (`client/test/native-ink-check.mjs`) | ⬜ CP-03 synthetic pointer strokes at COMPACT | ⬜ CP-04 PencilKit finger policy (`--bridge-selfcheck`) | ⬜ CP-09 web canvas strokes in WebView | **P only:** real finger writing quality, latency, scroll conflict |
| Question attempt: stylus | — | ➖ | ✅ iPad `--ink-selfcheck` (synthetic strokes) | ⬜ CP-09 synthetic `pen` events | **P only:** Apple Pencil (iPad), S Pen/USI (Android) |
| Photo of working | ✅ `client/test/photo-ocr-bridge-check.mjs`, `client/test/cloud-photo-client-check.mjs` | ⬜ CP-03 file input at COMPACT | ⬜ CP-05 picker presented | ⬜ CP-07 `onShowFileChooser` → Photo Picker | P: camera capture of real paper |
| Submission and feedback | ✅ engine/marker suites (`npm test`) | ✅ desktop flows | shared JS (no native logic) | shared JS (no native logic) | — |
| Next question | — | ✅ phone pre-answer; ⬜ CP-03 post-answer (Pri Explain launcher overlap) | ⬜ CP-05 | ⬜ CP-10 | — |
| Progress | ✅ `client/test/india-progress-product-check.mjs` | ✅ phone overflow on `/progress` (India); ⬜ CP-03 non-India legacy progress | ⬜ CP-05 | ⬜ CP-10 | — |
| Offline / retry | ✅ outbox/sync suites | ✅ offline reload in `client/test/tour-phone.js` | ⬜ CP-05 airplane-mode toggle (`simctl status_bar` cannot cut network; use a network link conditioner) | ⬜ CP-10 `adb shell svc wifi/data disable` | P: real flaky network |
| Relaunch | — | ✅ reload | ⬜ CP-05 terminate+launch keeps IndexedDB (**origin `prilearning://app` must be unchanged**) | ⬜ CP-06 force-stop+launch keeps IndexedDB (origin `appassets.androidplatform.net`) | P: OS-initiated process death |
| Sync | ✅ `client/test/cloud-sync-worker-check.mjs`, `server/test/platform-sync-pagination-check.mjs` | ✅ cloud tour | ⬜ CP-05 with a local `/v1` server | ⬜ CP-07 with a local `/v1` server (emulator `10.0.2.2`) | P: two real devices, same account |
| Purchase / restore | ✅ `server/test/apple-billing-check.mjs`; ⬜ CP-08 Google verifier tests with recorded fixtures | ✅ paywall render | ⬜ CP-05 StoreKit Testing config (`.storekit`) purchase/restore | ⬜ CP-08 Play Billing test doubles (instrumented) | **P only:** App Store sandbox and Play license testers, real renew/cancel/refund |
| Account deletion / logout | ✅ server contracts | ✅ cloud tour (desktop) | ⬜ CP-05 deletion clears cookie jar and link | ⬜ CP-07 deletion wipes encrypted cookie jar | P: store subscription still active after deletion (Apple/Google manage links) |
| Accessibility | ✅ `client/test/a11y-gate.mjs` (1280×900) | ⬜ CP-03 a11y gate at A1 and D1, 200% text zoom | ⬜ CP-05 XCUITest accessibility audit (`performAccessibilityAudit`) | ⬜ CP-10 Accessibility Test Framework checks | **P only:** VoiceOver and TalkBack walkthroughs, largest text sizes |
| Native bridge contract | ✅ JS bridge fakes (`client/test/native-ink-check.mjs`, `client/test/photo-ocr-bridge-check.mjs`) | — | ⬜ CP-02 shared envelope fixtures vs Swift | ⬜ CP-07 shared envelope fixtures vs Kotlin (JVM) | — |
| Server native-client boundary | ✅ `server/test/native-origin-csrf-check.mjs` (iOS) | — | — | ⬜ CP-07 `android-native-v1` accepted only without Origin/Sec-Fetch | — |
| Security: no secrets in shells | ✅ CP-01 architecture check (`ios/`, and `android/` when present) | — | — | — | — |
| Release identity | ✅ `server/test/release-identity-check.mjs`, `npm run check:ios` | — | ✅ native reads bundled `release.json` | ⬜ CP-06 `scripts/sync-android.mjs --check` | — |

## 3. Physical-device-only gates (explicitly not automatable here)

These require a human with hardware. They are recorded as **P** evidence with device model, OS version, build SHA, date and operator. They must never be simulated, inferred from S1/S2, or written into documentation as done before they happen.

**Owner decision (CP-01): physical validation is deferred.**
- A task whose automated gates are green, but whose physical gates are outstanding, reports `SOFTWARE IMPLEMENTATION COMPLETE` + `PHYSICAL DEVICE VALIDATION DEFERRED`.
- A deferred gate is recorded and open. It is never waived, weakened, simulated, or replaced by S1/S2 evidence.
- While any physical gate for a platform is deferred, nothing may claim that platform is supported or certified, and no store release may ship.

1. Real finger handwriting quality, latency and the scroll-versus-draw conflict on the smallest iPhone and Android phone.
2. Apple Pencil (iPad baseline regression) and S Pen/USI stylus (Android tablets): latency, palm rejection, pressure.
3. Camera capture of real paper working in poor light.
4. App Store sandbox and Play license-tester purchase, renewal, cancellation, refund/revocation and restore, each reflected by the server entitlement.
5. VoiceOver and TalkBack walkthroughs of the critical journey.
6. OS-initiated process death while backgrounded, with draft survival.
7. Cold launch time on low-end Android (2–3 GB RAM class) and on the oldest supported iPhone.
8. Two-device sync on the same account over real networks.
9. Store review submissions (App Store, Play) — external.

## 4. Regression baseline (iPad)

Every CP task from CP-02 onward must keep these green, unchanged: `npm test`, `npm run test:browser`, `npm run check:ios`, `npm run test:ink:bridge`, the iPad simulator `npm run test:ink:native`, the KALP iPad portrait/landscape tours, and the existing iPad physical-evidence workflows. Any change to `ios/PriLearning.swiftpm/Ink/**` also needs the iPad Pencil physical check before release.

## 5. Android automated certification status (CP-10)

`android/scripts/run-instrumented.sh` (CI: `android-shell.yml`) runs on API 33 phone, API 36 phone, API 36 tablet and API 36 foldable (`pixel_fold`). API 26 asserts the fail-closed WebView-floor screen. The cloud steps run against the **real Pri server** (`scripts/cloud-fixture-server.mjs`). Real process death (`am force-stop`) happens between runs. Evidence is SYNTHETIC / EMULATOR.

| Spec item | Automated (S2) | Where |
|---|---|---|
| Cold launch, onboarding, local profile, Home | ✅ | `ShellJourneyTest#journey` |
| Question loading, typed attempt, submission, feedback, next, progress | ✅ Progress shows 0 answered before and at least 1 after the marked attempt; Next renders a new question | `ShellJourneyTest#journey` |
| Handwriting attempt, recognition | ✅ finger + stylus MotionEvents through the shared canvas; the shared recognizer produces a reading and the submitted attempt is marked | `InkInputTest` (CP-09) |
| Photo | ✅ picker and camera offer with URI grants; the photo reaches the page | `FileExchangeTest` |
| Share/export, print | ✅ | `FileExchangeTest` |
| Signup, login, session persistence, logout, account deletion | ✅ against the real server. Signing up connects the account. Its credentials sign in on the server (200) before deletion and are refused (401) after. A revoked session cookie is refused (401). | `CloudJourneyTest` |
| Offline, reconnect | ✅ With the server stopped, a typed attempt is marked on the device, the account reads "Linked · offline", and Sync is not offered. After the server restarts on the same database, the session is still valid and Sync pushes at least one learning event (the offline work). | `CloudJourneyTest` + runner |
| Process recreation, rotation, Back | ✅ real process death; rotation keeps a typed answer and ink; Back closes sheets, walks history, and leaves the app from the landing page | `ShellJourneyTest`, `InkInputTest` |
| Billing | ✅ **Fail-closed check without a Play Store:** the request reaches Play Billing and fails with a `PLAY_*` provider code. The **test double** is server-side: `google-billing-check` (100 checks against a fake Play Developer API). | `CloudJourneyTest`, `server/test` |
| Accessibility | 🟡 A DOM-level smoke check in the real WebView on four screens, each audited once its landmark renders. At system font scale 1.3 the same text is measurably larger than at 1.0. The Android Accessibility Test Framework does not inspect WebView DOM content. **TalkBack is a physical/manual gate.** | `WebViewAccessibilityTest` |
| Low memory / process death | 🟡 real process death between runs; renderer-crash recovery is rate-limited (CP-06). Real low-memory killing on low-end hardware is **physical**. | runner, `MainActivity` |
| Foldable / multi-window | 🟡 the `pixel_fold` profile is in the CI matrix (pending its first green run); posture changes and multi-window resizing are not automated | matrix |

**Not claimed (physical, DEFERRED):** real camera, S Pen / USI quality, a TalkBack walkthrough, a real Play purchase, low-end phone performance, OEM WebView variants.
