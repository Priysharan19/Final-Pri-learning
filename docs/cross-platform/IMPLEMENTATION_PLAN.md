# Cross-Platform Implementation Plan (CP-02 → CP-12)

Initial audit baseline `main` @ `421f1ff1`; revalidated against `main` @ `7f4a0559`.

Every task follows the `AGENTS.md` control plane (branch + PR, independent review, required CI, no direct `main` updates). Risk classes are the minimum; the diff-derived risk from `node scripts/pri-fleet.mjs risk` is authoritative.

**Global invariants:**
- **The iPad is a regression-protected baseline.** No task may silently replace PencilKit with web ink on iPad, weaken StoreKit/server verification, bypass the native cloud bridge, remove offline behaviour, orphan existing IndexedDB data, change grading, curriculum or account semantics, or regress accessibility.
- The suites listed in [CROSS_PLATFORM_TEST_MATRIX.md](CROSS_PLATFORM_TEST_MATRIX.md) §4 stay green for every task.

**Completion states (owner decision at CP-01: physical validation is deferred):**
- A task is **`SOFTWARE IMPLEMENTATION COMPLETE`** when its scope is merged and every *automated* gate is green.
- While any of its physical-device gates is outstanding, it also reports **`PHYSICAL DEVICE VALIDATION DEFERRED`**, listing each open gate.
- A deferred physical gate is recorded and stays open. It is never waived, weakened, simulated, or satisfied by S1/S2 evidence.
- Fully **`DONE`** means software complete *and* every physical gate recorded as P evidence.
- Downstream tasks may start once their dependencies are `SOFTWARE IMPLEMENTATION COMPLETE`.
- While any physical gate for a platform is deferred, nothing may say that platform is "supported" or "certified", and no store release may ship.

## Sequence and lanes

```
CP-02 Bridge Foundation ──┬──> CP-03 Responsive Foundation ──> CP-04 iPhone Product ──> CP-05 iPhone Certification ─┐
                          │                                                                                         ├─> CP-11 Release Matrix ──> CP-12 Store Readiness
                          └──> CP-06 Android Shell ──> CP-07 Android Bridges ──┬─> CP-08 Play Billing ──┐            │
                                                                               └─> CP-09 Handwriting ───┴─> CP-10 Android QA ┘
Additional edges: CP-03 ──> CP-09 (compact canvas) and CP-03 ──> CP-10 (UI QA). CP-06 itself does not need CP-03.
```

CP-03 and CP-06 can run in parallel after CP-02, with different owners. Under the single-writer lease they are still *sequenced* missions; the diagram shows dependencies, not concurrency.

---

## CP-02 — Platform Bridge Foundation

- **Goal:** one platform-neutral `priNative` contract in shared JavaScript. Product code stops touching `window.webkit.messageHandlers` directly. The Apple shell speaks the versioned envelope **and** keeps its legacy protocol during migration.
- **Files:**
  - **New:** `client/src/platform/native/{index.js,host.js,envelope.js,errors.js,fakeHost.js}`.
  - **Modified:** `client/src/ink/native.js`, `client/src/native/photo.js`, `client/src/platform/nativeBilling.js`, `client/src/platform/cloudTransport.js`, `client/src/lib/files.js`, `client/src/components/InkPhysicalEvidenceSession.jsx`, `client/src/components/CloudAccountSecurity.jsx`, `client/src/main.jsx`, `client/src/local/offlineWarm.js`, `client/src/local/backend.js`, `client/src/components/CloudAccountPanel.jsx`, `client/src/pages/SettingsLegacy.jsx`, `client/src/ink/InkAnswer.jsx`, `client/src/ink/Calibrate.jsx`; Swift `ios/PriLearning.swiftpm/WebShell.swift` (`__PRI_HOST__` injection, `priBridge` handler, main-frame/origin checks, lifecycle events, binary share); the mirror `ios/PriLearning 2.swiftpm`.
  - **Tests:** `client/test/native-host-contract-check.mjs` (new), plus `client/test/cross-platform-architecture-check.mjs` (allowlist shrinks).
- **Scope:**
  - `__PRI_HOST__` handshake, envelope v1, closed error set, timeouts/cancel via `AbortSignal`, event bus, lazy capability detection.
  - Adapters wrapping the five existing bridges.
  - `lifecycle.state` event and draft flush on background.
  - `share.file` with binary support; account export works in the shell.
  - Swift handlers reject non-main-frame and non-`prilearning://app` senders; flag script becomes `forMainFrameOnly: true`.
- **Non-goals:** no Android code, no layout changes, no new capabilities beyond lifecycle/share/files, no change to recogniser behaviour or billing semantics.
- **Dependencies:** CP-01 (this audit).
- **Acceptance tests:**
  - Fake-host unit tests for every capability: success, error, timeout, cancel, unsupported, version-too-new.
  - The existing `test:ink:bridge`, `test:photo:bridge`, `native-cloud-transport-check`, `native-storekit-boundary-check` stay green **unchanged**.
  - The iPad simulator `--ink-selfcheck` stays green.
  - A message from a subframe is ignored (simulator self-check).
- **Automated gates:** `npm test`, `npm run test:browser`, `npm run check:ios`, `npm run test:ink:native` (iPad sim), the architecture check with direct `messageHandlers` access allowed **only** in `client/src/platform/native/`.
- **Physical-device gates:** iPad + Apple Pencil smoke (write → recognise → submit, purchase restore in sandbox), because Swift bridge code changed.
- **Rollback criteria:** any iPad ink, billing or cloud regression. Rollback is a revert: legacy flags and handlers remain until one release ships `__PRI_HOST__`.
- **Done when:** zero direct `webkit.messageHandlers` references outside the contract module, every capability has fake-host coverage, and an iPad build ships with both protocols and no behaviour change. Without the iPad + Pencil smoke, the state is `SOFTWARE IMPLEMENTATION COMPLETE` / `PHYSICAL DEVICE VALIDATION DEFERRED`, and no iPad release containing the Swift change may ship until it is done. **Risk: R4** (touches the billing and cloud auth path).

## CP-03 — Responsive Product Foundation

- **Goal:** semantic form factors (COMPACT/MEDIUM/EXPANDED + SHORT) and phone-quality layouts of the hard surfaces, in shared CSS/React.
- **Files:** `client/src/theme.css`, `client/src/theme-state.css`, delete `client/src/theme-legacy.css`, `client/src/App.jsx`, `client/src/components/QuestionCard.jsx`, `client/src/ink/InkAnswer.jsx`, `client/src/ink/InkCanvas.jsx`, `client/src/components/PriExplainV5.jsx`/`client/src/components/PriExplainV5.css`, `client/src/pages/ProgressLegacy.jsx`, `client/src/pages/SettingsLegacy.jsx`, `client/src/pages/ExamRoom.jsx`, `client/src/pages/Login.jsx`, `client/index.html`; tests `client/test/responsive-matrix.mjs` (new Playwright helper over the S1 viewport rows, Chromium + WebKit) and `client/test/tour-phone.js` (extended).
- **Scope:**
  - Breakpoint tokens; migrate the ad hoc 720–1180 values.
  - `dvh`, four-sided insets, fixed bars sized *with* the inset.
  - Canvas sized to the available height, explicit scroll model, rescale strokes on resize, compact ink toolbar, remove developer copy for students.
  - `inputMode`/`enterKeyHint`; ≥44 px palette and secondary buttons.
  - Pri Explain launcher moved out of the action area; fix the non-India progress overflow and the settings editor wrap.
  - Hover reveals given tap/focus equivalents.
- **Non-goals:** no native shell changes, no new features, no change to iPad EXPANDED composition beyond token migration.
- **Dependencies:** CP-02 (capability-driven ink copy needs `priNative.has('ink')`).
- **Acceptance tests:** for every S1 row (A1–A6, D1–D6): no horizontal overflow on all student routes; primary action visible and unobscured before **and after** answering; ≥44 px coarse-pointer targets; write-mode stroke → recognise → submit with synthetic pointer events at COMPACT; a11y gate at A1 and D1; iPad portrait/landscape screenshots identical within tolerance to the CP-02 baseline.
- **Automated gates:** `npm run test:browser` (with the new matrix flow pinned in `ci.yml`), the KALP tours, `npm test`.
- **Physical-device gates:** none required for merge. Recommended: a quick iPad visual check.
- **Rollback criteria:** any EXPANDED (iPad) visual or interaction regression; any E2E count drop.
- **Done when:** every surface in [FORM_FACTOR_SPEC.md](FORM_FACTOR_SPEC.md) §3 meets its COMPACT target in S1 on Chromium and WebKit. **Risk: R2** (R3 if ink stroke storage changes).

## CP-04 — iPhone Product

- **Goal:** the existing Apple shell becomes a usable iPhone app without Apple Pencil.
- **Files:**
  - `ios/PriLearning.swiftpm/Ink/InkSurface.swift` and `ios/PriLearning.swiftpm/Ink/InkBridge.swift` (finger-capable default when no Pencil is seen; iPad unchanged once a Pencil is seen).
  - `ios/PriLearning.swiftpm/Package.swift` (iPhone portrait-only for v1).
  - `ios/PriLearning.swiftpm/WebShell.swift` (share anchor, Dynamic Type → CSS, safe-area decision).
  - `scripts/ink-native-check.mjs` (add an iPhone destination), `.github/workflows/native-ink.yml`.
  - `scripts/check-native-package-sync.mjs` (also gate `Info.plist`).
  - Remove or refresh the stale `ios/PriLearning.swiftpm.zip`.
  - Universal Links: `onOpenURL` → route bridge, plus `apple-app-site-association` served by `server/`.
- **Scope:** finger ink default, compact-friendly native surfaces, iPhone simulator build+launch+bridge self-check in CI, deep links for `/account-action`, account export via `share.file`.
- **Non-goals:** iPhone landscape layouts, a new recogniser, StoreKit changes, App Store submission.
- **Dependencies:** CP-02, CP-03.
- **Acceptance tests:**
  - CI builds and launches on an iPhone simulator and an iPad simulator.
  - `--bridge-selfcheck` passes on both.
  - On iPhone, a finger stroke reaches `ink.strokes` without the toggle.
  - On iPad, after a Pencil stroke, the finger does not draw (unchanged policy).
  - A deep link opens the account-action route with the fragment intact and never logged.
- **Automated gates:** `native-ink.yml` (iPad + iPhone), `npm run check:ios`, the package drift gate including `Info.plist`, `npm test`, `npm run test:browser`.
- **Physical-device gates:** iPad Pencil regression check (ink path changed).
- **Rollback criteria:** any iPad Pencil policy change, ink accuracy regression in `--ink-selfcheck`, or StoreKit/cloud bridge regression.
- **Done when:** an iPhone simulator student completes the critical journey with finger and typed input, and all iPad gates are unchanged. That is `SOFTWARE IMPLEMENTATION COMPLETE`. Until the iPad Pencil regression check is recorded, it is also `PHYSICAL DEVICE VALIDATION DEFERRED`. **Risk: R4** (handwriting authority path).

## CP-05 — iPhone Certification

- **Goal:** evidence, not claims. Automated iPhone simulator journeys plus physical-iPhone evidence across A1–A3.
- **Files:** `ios/PriLearning.swiftpm` UI-test harness (or `scripts/iphone-journey.mjs` via `simctl` + `--journey-selfcheck`), a `.storekit` test configuration, `docs/release/` iPhone evidence record (new), evidence workflow modelled on `.github/workflows/ink-physical-evidence.yml`.
- **Scope:** simulator journeys for signup/login/session, typed + finger + photo attempts, feedback, next, progress, offline/relaunch, StoreKit Testing purchase/restore, account deletion/logout, accessibility audit. Physical runs per [IPHONE_GAP_REPORT.md](IPHONE_GAP_REPORT.md) §4.
- **Non-goals:** new features; Android.
- **Dependencies:** CP-04.
- **Acceptance tests:** all S2 iPhone rows green in CI; P evidence records for each physical gate, signed by the operator with device, OS and SHA.
- **Automated gates:** S2 iPhone journey workflow (macOS runner, per `.github/workflows/native-ink.yml` conventions).
- **Physical-device gates:** **all** of [IPHONE_GAP_REPORT.md](IPHONE_GAP_REPORT.md) §4 on SE-class, standard and Pro Max-class iPhones.
- **Rollback criteria:** none (evidence task). Failures reopen CP-03/CP-04 defects.
- **Done when:** every iPhone gate has S2 evidence plus P evidence, with no synthetic result presented as physical. Only then may docs/marketing say "iPhone supported". With S2 complete and P outstanding: `SOFTWARE IMPLEMENTATION COMPLETE` / `PHYSICAL DEVICE VALIDATION DEFERRED`, and no "supported" claim. **Risk: R1–R2.**

## CP-06 — Android Shell

- **Goal:** a minimal Kotlin shell that boots the same `client/dist` with persistent storage, a hardened WebView and back navigation. No product bridges beyond the handshake, lifecycle and release identity.
- **Files:**
  - **New:** `android/**` per [ANDROID_ARCHITECTURE.md](ANDROID_ARCHITECTURE.md) §2, `scripts/sync-android.mjs`, `.github/workflows/android-shell.yml`.
  - `.pri-os/fleet.json`: ownership rule `android/**` → primary `android`, reviewers `security`, `qa-release`.
  - `.gitignore` for generated assets.
- **Scope:** `WebViewAssetLoader` origin + SPA fallback, WebView floor screen, navigation policy, edge-to-edge letterbox insets, config changes without recreation, Back dispatcher ↔ `lifecycle.backRequested`, `__PRI_HOST__` with **no** cloud/billing/ink capabilities, release identity.
- **Non-goals:** cloud, billing, photo, share bridges (CP-07/08); any Play Store work; any product UI change.
- **Dependencies:** CP-02. CP-03 is needed before product QA, not for the shell.
- **Acceptance tests:**
  - JVM tests: SPA fallback mapping, navigation policy, envelope validation.
  - Instrumented on API 26 + API 36 emulators: app boots to onboarding; a local profile created → force-stop → relaunch keeps it (IndexedDB persistence); Back closes the More sheet before exiting; rotation keeps the in-progress typed answer; external link opens outside the WebView.
  - `scripts/sync-android.mjs --check` parity.
- **Automated gates:** `android-shell.yml` (Gradle build, lint, JVM tests, emulator instrumented tests), `node scripts/pri-fleet.mjs validate`, `npm test`.
- **Physical-device gates:** none for merge. One low-end phone boot smoke recommended.
- **Rollback criteria:** isolated directory, so revert the PR. No shared-code changes except the fleet rule.
- **Done when:** emulator evidence that the shared product runs offline with persistent data on phone and tablet emulators. Not claimed as an Android product. **Risk: R3.**

## CP-07 — Android Native Bridges

- **Goal:** cloud (with encrypted cookie jar), photo/files import, share/export, print and lifecycle on Android via the CP-02 contract. Plus the **server** acceptance of `android-native-v1`.
- **Files:** `android/app/src/main/java/com/prilearning/app/bridge/**`, `server/platform/security.js` (`nativeNonBrowserRequest` accepts `android-native-v1` under the identical no-Origin/no-Sec-Fetch rule), `server/test/native-origin-csrf-check.mjs` (extended), shared envelope fixtures under `client/test/fixtures/native-envelope/` (new).
- **Scope:** OkHttp transport with the same allowlist/caps as Swift; Keystore-encrypted cookie jar cleared on logout/deletion; `onShowFileChooser` → Photo Picker / capture / SAF; `FileProvider` share; `PrintManager`.
- **Non-goals:** billing, native ink, ML Kit OCR, push.
- **Dependencies:** CP-06.
- **Acceptance tests:**
  - Server: `android-native-v1` with an Origin or Sec-Fetch header is rejected; without them it is accepted for mutations only with a valid CSRF pair; `ios-native-v1` behaviour unchanged.
  - Android: shared envelope fixtures pass in JVM; instrumented sign-up → sync → relaunch keeps the session; logout wipes the jar; a photo attach reaches `QuestionCard`; export produces a share intent.
- **Automated gates:** `ci.yml` platform job (server contracts), `android-shell.yml`, `npm test`.
- **Physical-device gates:** camera capture on one real phone (recommended before CP-10).
- **Rollback criteria:** any change in `ios-native-v1` or browser origin/CSRF behaviour; any cookie exposure to JS.
- **Done when:** an emulator student can sign up, sync, attach photos and export, with the server boundary covered by regression tests. **Risk: R4** (auth/CSRF boundary).

## CP-08 — Google Play Billing

- **Goal:** Play subscriptions with server-authoritative verification, equivalent to the Apple path.
- **Files:**
  - **Server:** `server/platform/googleBilling.js` (new: Play Developer API verifier, RTDN Pub/Sub OIDC verification), `server/platform/billing.js` (`/google/bootstrap`, `/google/purchase`, restore/webhook wiring), `server/platform/router.js` (`google` health flag from config), `server/platform/config.js` (production validation of Google settings), `server/app.js` (register verifier); tests `server/test/google-billing-check.mjs` (new, recorded fixtures, no network).
  - **Android:** `android/.../bridge/billing/PlayBillingBridge.kt`.
  - **Client:** `client/src/platform/nativeBilling.js` (store-neutral), `client/src/components/CloudAccountPanel.jsx` (store chosen by capability).
- **Scope:** bootstrap with `obfuscatedAccountId`; purchase → server verify → `applyVerifiedEntitlement` → acknowledge; restore; RTDN re-fetch-then-apply; health flag.
- **Non-goals:** web checkout inside Android (forbidden), promo codes, price experiments, changing Apple or Razorpay behaviour.
- **Dependencies:** CP-07.
- **Acceptance tests:** server verifier rejects wrong package, wrong product, mismatched account id, unacknowledged-expired, revoked, replayed token, and a forged RTDN; grants via the same entitlement path as Apple; client never grants locally; Apple suite unchanged.
- **Automated gates:** `ci.yml` platform job, `android-shell.yml` instrumented billing tests with Play Billing test doubles.
- **Physical-device gates:** **Play license testers on a real device:** purchase, renewal (accelerated test cycle), cancel, refund/revoke, restore on a second device. External prerequisites ⚑: a Play Console app, subscription products, a service account with least privilege, and a Pub/Sub topic. These are owner actions; record them as `BLOCKED_EXTERNAL` until done.
- **Rollback criteria:** any Apple/Razorpay regression; any path where a client-supplied value grants entitlement without server verification.
- **Done when:** server tests are green, emulator flows are green, physical license-tester evidence is recorded, and `google: true` appears only when configured. Without license-tester evidence: `SOFTWARE IMPLEMENTATION COMPLETE` / `PHYSICAL DEVICE VALIDATION DEFERRED` (plus `BLOCKED_EXTERNAL` for Play Console prerequisites), and Play billing must not be enabled in production. **Risk: R4** (billing).

## CP-09 — Android Handwriting/Input

- **Goal:** measured, honest handwriting on Android through the shared web canvas, finger and stylus. A native capture surface is added only if evidence demands it.
- **Files:** `client/src/ink/InkCanvas.jsx` (pointer tuning only if measured), `client/src/ink/InkAnswer.jsx`, Android stylus capability reporting, an evidence protocol in `docs/release/` (new), optional `android/.../bridge/ink/` (only if justified).
- **Scope:** latency and drop-rate measurement on target phones and stylus tablets; S Pen/USI palm rejection; the cloud handwriting path on Android; answer-blind guarantee tests.
- **Non-goals:** a Kotlin recogniser; changing marking; using expected answers in recognition (forbidden).
- **Dependencies:** CP-07 (cloud path), CP-03 (compact canvas).
- **Acceptance tests:** synthetic `pen`/`touch` pointer streams in the WebView produce the same strokes as Chromium desktop; recognition accuracy on the existing synthetic corpus within tolerance of browser JS (no claims beyond the corpus); no expected answer in any recogniser payload.
- **Automated gates:** `npm run test:ink*` suites, an instrumented WebView stroke test.
- **Physical-device gates:** **required for any claim:** finger on a low-end phone, S Pen tablet, USI stylus tablet. Latency and quality recorded as P evidence.
- **Rollback criteria:** any shared ink change that regresses the browser/iPad suites.
- **Done when:** a documented, evidenced statement of Android handwriting quality exists, kept explicitly separate from iPad PencilKit claims. Without P evidence: `SOFTWARE IMPLEMENTATION COMPLETE` / `PHYSICAL DEVICE VALIDATION DEFERRED`, and no Android handwriting-quality statement is made. **Risk: R4** (handwriting authority).

## CP-10 — Android Product QA

- **Goal:** the full critical journey across D1–D7 on emulators, plus physical evidence.
- **Files:** `android/app/src/androidTest/**` journeys, `.github/workflows/android-shell.yml` matrix, evidence records in `docs/release/`.
- **Scope:** every row of the [CROSS_PLATFORM_TEST_MATRIX.md](CROSS_PLATFORM_TEST_MATRIX.md) §2 Android column; Accessibility Test Framework; TalkBack walkthrough; process death; low-memory devices.
- **Non-goals:** new features.
- **Dependencies:** CP-07, CP-08, CP-09, CP-03.
- **Acceptance tests:** all Android S2 gates green; all Android P gates recorded.
- **Automated gates:** emulator matrix (API 26, API 36, tablet, foldable).
- **Physical-device gates:** D1–D5 physical runs (and D7 for stylus).
- **Rollback criteria:** n/a (evidence task).
- **Done when:** S2 + P evidence for every Android gate exists. Only then may anything say "Android supported". With S2 complete and P outstanding: `SOFTWARE IMPLEMENTATION COMPLETE` / `PHYSICAL DEVICE VALIDATION DEFERRED`. **Risk: R1–R2.**

## CP-11 — Cross-Platform Release Matrix

- **Goal:** one release identity and one compatibility policy across web, iPad/iPhone and Android.
- **Files:** `release/release-identity.mjs`, `release/metadata.json`, `scripts/sync-ios.mjs`, `scripts/sync-android.mjs`, `server/platform/security.js` or a new middleware (minimum supported `X-Pri-Client` version → `426`-style upgrade response), `docs/release/release-policy.md`, `.github/workflows/ci.yml` (matrix pin).
- **Scope:**
  - Shell build ↔ web SHA mapping.
  - Server backward compatibility with the oldest supported shell.
  - Client version floor.
  - An **origin-immutability check** (`prilearning://app` and `https://appassets.androidplatform.net` must never change).
  - The required-CI matrix: S0, S1, S2 iOS, S2 Android.
- **Non-goals:** store submission.
- **Dependencies:** CP-05, CP-10 (each at least `SOFTWARE IMPLEMENTATION COMPLETE`; CP-11 needs no physical evidence).
- **Acceptance tests:** a release candidate produces identical `release.json` SHA in web, both iOS bundles and Android assets; an old-client header receives a structured upgrade response; origin constants are guarded by a test.
- **Automated gates:** `ci.yml` (required), `native-ink.yml`, `android-shell.yml`.
- **Physical-device gates:** none new.
- **Rollback criteria:** any change to existing iPad release identity semantics.
- **Done when:** one command verifies cross-platform release identity, and the policy is documented. **Risk: R3.**

## CP-12 — Store Release Readiness

- **Goal:** everything software-side ready for App Store (iPhone + iPad) and Play (phone + tablet) submission. External sign-offs are listed, not faked.
- **Files:** store metadata/screenshots generated from S2 runs (clearly labelled), privacy manifests (`PrivacyInfo.xcprivacy` for Apple), the Play Data safety draft, `docs/release/` checklists, signing configuration that references CI secrets only.
- **Scope:**
  - App Store: privacy manifest, review notes, account deletion, StoreKit metadata, age rating.
  - Play: target API, Data safety, Families policy, account deletion web resource, Play App Signing, staged rollout plan.
- **Non-goals:** actually publishing (external authority required per `AGENTS.md`); marketing claims.
- **Dependencies:** CP-11.
- **Acceptance tests:** the checklists are complete with evidence links; no secret material in the repository (architecture check plus secret scan).
- **Automated gates:** all required CI.
- **Physical-device gates:** final smoke on one device per platform/form factor using the release-signed build.
- **Rollback criteria:** n/a.
- **Done when:** the owner can submit. Submission additionally requires every deferred physical gate for the submitted platform to be closed. Items requiring external authority (store accounts, legal/privacy sign-off, payment-provider setup, publishing) are listed as `BLOCKED_EXTERNAL` with exact next steps. **Risk: R4** (release/signing configuration).
