# iPhone Gap Report (CP-01)

Initial audit baseline `main` @ `421f1ff1` (2026-10-01 UTC); revalidated against `main` @ `7f4a0559`.

**Bottom line:** Pri Learning is **not yet an iPhone product**. The Apple package already *declares* iPhone support and *compiles and launches* on an iPhone simulator. The web client already has a phone navigation shell with a browser E2E flow at phone widths. But native ink defaults to Apple Pencil only, nothing in CI builds or tests an iPhone destination, several surfaces are unverified or broken at compact width, and **there is no physical-iPhone evidence of any kind**.

## 1. What already exists

| Area | Evidence | Kind of evidence |
|---|---|---|
| iPhone device family declared | `ios/PriLearning.swiftpm/Package.swift`: `supportedDeviceFamilies: [.pad, .phone]`; iPhone orientations portrait + landscape left/right | Repository |
| Compiles for iPhone | `xcodebuild -scheme PriLearning -destination 'platform=iOS Simulator,name=iPhone 17e' build` → **BUILD SUCCEEDED**, 0 errors (Xcode 27.0, 2026-10-02). Built `Info.plist`: `UIDeviceFamily = [1, 2]`, `MinimumOSVersion = 16.0`, `UISupportedInterfaceOrientations~iphone` = portrait, landscape left, landscape right | **Synthetic: simulator build, run once by the CP-01 audit; not in CI** |
| Launches and renders | Installed and launched on the iPhone 17e simulator. Landing page and onboarding steps 1–2 render at 390 pt and accept taps. Cold first paint was **slow (blank for more than 8 s, rendered by about 30 s)** on a freshly booted simulator; this is not a performance measurement. The web view is letterboxed inside the safe area (dark bands top and bottom). | **Synthetic: simulator, observed once** |
| Phone navigation shell | `client/src/App.jsx` bottom bar (4 destinations + More sheet) at ≤760 px | Repository |
| Phone browser E2E | `client/test/tour-phone.js` at 390×844 and 360×800 in the required browser job: all destinations reachable, no horizontal overflow on 8 routes, ≥44 px targets in type mode, Next uncovered before answering, offline reload | **Synthetic: Chromium at phone width, not WebKit and not a device** |
| Camera | `NSCameraUsageDescription` present; photo attach via `<input type=file>` (system picker/camera); Vision OCR has no iPad assumption | Repository |
| Cloud transport, account, sync | `ios/PriLearning.swiftpm/NativeCloudBridge.swift` has no idiom checks; `/v1` is device-agnostic | Repository |
| StoreKit 2 | `ios/PriLearning.swiftpm/StoreKitBillingBridge.swift` has no idiom checks; server verifies the JWS | Repository |
| Typed answers | Plain input at 17 px (avoids iOS focus zoom) | Repository |

**Engineering judgement (not a measurement):** most of the *platform* layer already exists: shell, transport, billing, cloud and phone navigation. Most of the *product and evidence* work does not: ink defaults, compact layouts of the hard surfaces, iPhone CI and all certification.

## 2. Exact gaps (each one blocks the claim "iPhone product")

### 2.1 Input (Apple Pencil must not be required)

1. **Native ink is Pencil-only by default.** `ios/PriLearning.swiftpm/Ink/InkSurface.swift` sets `fingerDrawingEnabled = false`, which gives `drawingPolicy = .pencilOnly`. On iPhone the PencilKit surface ignores the finger until the student finds the Finger toggle in `client/src/ink/InkAnswer.jsx`.
   **Fix (CP-04):** default the drawing policy from `__PRI_HOST__.capabilities.ink.stylus`, or from "no Pencil seen" (the policy the shared `client/src/ink/InkCanvas.jsx` already uses). This must not change iPad behaviour once a Pencil has been seen.
2. **Finger and scroll conflict.** With finger drawing on, a page-height canvas captures all one-finger drags. Compact needs a deliberate scroll model: two-finger scroll, or the canvas sized to the viewport so the page itself does not need to scroll while writing.
3. **User copy names Apple Pencil:** "Apple Pencil" / "legacy JS fallback… run the native iPad package" in `client/src/ink/InkAnswer.jsx`, and "full-screen iPad experience" in `client/src/i18n/strings.en.js`. These must become capability-driven ("stylus or finger").
4. **The typed path must be first-class.** Add `inputMode`/`enterKeyHint`, and Σ palette keys ≥44 px.
5. **Photo-of-working path:** works through the system picker, but is not exercised on iPhone in any test.

### 2.2 Layout (compact)

6. **Handwriting area:** fixed 380 px canvas, 7-button toolbar wrapping to 3 rows, strokes not rescaled on rotation, verdict overlays clipped by `overflow:hidden`. See [FORM_FACTOR_SPEC.md](FORM_FACTOR_SPEC.md).
7. **Post-answer action collision (suspected, unverified):** the fixed Pri Explain launcher (`client/src/components/PriExplainV5.css`, bottom-right, z-index 72) likely overlaps the Next context pill (`client/src/theme.css` `.ctx-pill`, full-width at phone sizes, z-index 50). `client/test/tour-phone.js` checks Next only *before* answering.
8. **Suspected overflow (inferred from code, not measured):** the non-India progress page `client/src/pages/ProgressLegacy.jsx` uses an inline `1fr 330px` grid, and the settings email editor row in `client/src/pages/SettingsLegacy.jsx` does not wrap. `client/test/tour-phone.js` visits neither state.
9. **Phone landscape** (wider than 760 px with a coarse pointer) gets the tablet sidebar. Decide between supporting landscape properly at MEDIUM/SHORT and locking iPhone to portrait for v1. **Recommendation:** portrait-only for the iPhone v1 release (remove the iPhone landscape orientations from `Package.swift`), revisit at CP-05+. iPad keeps all four orientations.
10. **Safe area:** the shell letterboxes the web view inside the safe area. That is acceptable for v1 and avoids the top-bar inset bug. Edge-to-edge is a later polish and must fix the fixed-height top bar first.
11. **Keyboard:** no `visualViewport` handling; SwiftUI keyboard avoidance resizes the web view (inferred, unverified). The answer box and its primary action must stay visible with the keyboard open on a 375×667 viewport.
12. **Untested compact surfaces:** exam room, teacher, Calibrate, the Pri Explain dialog, toasts, the post-answer state.

### 2.3 Platform and lifecycle

13. **No iPhone CI destination.** `scripts/ink-native-check.mjs` picks iPad simulators only; `.github/workflows/native-ink.yml` requires an iPad simulator. Add an iPhone build+launch smoke test (compile, install, `--bridge-selfcheck`).
14. **No lifecycle bridge.** Drafts flush on `pagehide`/`visibilitychange` only. iPhone apps are backgrounded and killed more often than iPad apps, so `lifecycle.state` (CP-02) plus a flush on `background` is required.
15. **No deep-link entry.** Account-action links (`/account-action#…`) open in Safari, not the app. Universal Links need the `apple-app-site-association` file on the public origin plus a native `onOpenURL` → route bridge.
16. **Account export** (`client/src/components/CloudAccountSecurity.jsx`) relies on the shell's implicit `WKDownload` → share-sheet path and revokes its blob URL on the next tick. That is a possible race, unverified on any device. CP-02 moves it to `share.file`.
17. **The share sheet** is anchored at a fixed rect (harmless on iPhone, wrong on iPad split view).
18. **Accessibility:** Dynamic Type is not propagated into the web view; VoiceOver is not tested on any native build; the a11y gate runs at 1280×900 only.
19. **Cold-start time** on the simulator was long. A real-device launch-time budget must be measured (physical gate, below) before any claim.

### 2.4 Commerce and account

20. **StoreKit on iPhone:** code is idiom-agnostic. Products, purchase, restore, refund and revocation have **not** been exercised on any device or in StoreKit Testing for iPhone. The paywall at compact width is unverified in WKWebView.
21. **Account deletion** in the client UI now covers every sign-in method: password, Apple/Google re-auth where the web provider is configured, and a fresh one-time code to the account's own email/phone for any passwordless account (`CloudAccountSecurity.jsx`); a public signed-out path exists at `/account/delete-request`. App Store Review Guideline 5.1.1(v) requires in-app deletion, which is present (browser-verified in `tour-account-deletion.js`), but it is unverified on iPhone.

## 3. Audit checklist (current answer)

| Item | Status |
|---|---|
| iPhone compilation | ✅ simulator build succeeds (audit run); ❌ not in CI |
| Deployment target | iOS 16.0. Recommendation: keep 16.0 for v1. The web build target (`client/vite.config.js`: `safari15`, `es2022`) is satisfied by iOS 16 WebKit, and `isInspectable` (16.4+) is already availability-gated. |
| Layouts | 🟡 navigation OK; handwriting, progress (non-India) and settings editor need CP-03 |
| Safe areas | 🟡 letterboxed by SwiftUI (works, not edge-to-edge) |
| Keyboard | ❓ unverified |
| Orientation | 🟡 declared portrait+landscape; landscape layout unplanned → recommend portrait-only v1 |
| Camera | 🟡 system picker; untested on iPhone |
| Sharing | 🟡 `priShare` text JSON + implicit `WKDownload` blob path; account export unverified (possible revoke race) |
| Cloud transport | ✅ code path idiom-agnostic; ❓ untested on iPhone |
| StoreKit | ✅ code path; ❓ untested on iPhone |
| Account lifecycle | ✅ code path; ❓ untested on iPhone |
| Sync | ✅ shared JS (manual sync) |
| Typed answer | ✅ works; 🟡 no `inputMode` |
| Finger writing | ❌ native default is Pencil-only |
| Photo-working flow | 🟡 untested on iPhone |
| Cloud handwriting/working recognition | ✅ shared JS + `/v1`; guardian consent gating applies |
| Accessibility | ❌ no phone-width or native AT verification |
| Simulator coverage | ❌ none in CI (one manual audit run) |
| Physical-device requirements | ❌ none performed (section 4) |

## 4. Physical-iPhone gates (none performed; must not be fabricated)

Run on at least one small iPhone (SE-class, 375×667 pt), one current standard iPhone, and one Pro Max-class device. Record results through the existing evidence workflow, kept separate from simulator evidence:

1. Cold launch to interactive time, and a relaunch that preserves the profile and IndexedDB data.
2. Finger handwriting: write, undo, erase, recognise, submit, then see feedback and the next question, all with no Pencil.
3. Photo of paper working: camera capture and library pick.
4. Keyboard: typed answer with the keyboard open on the smallest device.
5. Sign-up, login, logout, account deletion, and session persistence across relaunch.
6. StoreKit sandbox: purchase, restore, renewal, cancellation and refund (revocation), each reflected by the server entitlement.
7. Background → foreground with an unsaved draft. Then a forced kill while backgrounded, and confirm the draft survives.
8. VoiceOver pass of the critical journey, plus the largest Dynamic Type size.
9. Offline: airplane mode during practice, then reconnect and sync.

## 5. Status after CP-04 (iPhone Product)

The rows below update §2 and §3 with what is implemented and automatically checked. Nothing here is physical evidence.

| Gap (from §2) | CP-04 result |
|---|---|
| 1. Pencil-only native ink | **Fixed.** `InkSurface.fingerDrawingEnabled` defaults on where no Apple Pencil can exist (iPhone) and stays Pencil-first on iPad. The host reports `ink.stylus` / `ink.fingerDefault` as capability facts, and the page mirrors them; the toolbar toggle still switches either way. |
| 3. "Apple Pencil" copy | **Fixed** (CP-03/CP-04). Copy is capability-neutral ("stylus or finger") and translated. |
| 4. Typed path | **Fixed** (CP-03): `inputMode="text"` + `enterKeyHint`, 44 px palette keys. |
| 6–8. Compact layouts | **Fixed** (CP-03). The writing area fits the screen, Next is unobscured, and Settings is uncovered. The suspected progress overflow did not reproduce. |
| 9. Orientation | **Decided:** iPhone portrait-only (`Package.swift`); iPad keeps all four orientations. |
| 13. No iPhone CI | **Fixed.** `native-ink.yml` runs the bridge self-check and the native student journey on an iPhone simulator, and the journey on an iPad simulator too. Evidence JSON is uploaded. |
| 14. Lifecycle | **Fixed** (CP-02): `lifecycle.state` with a background grace period, and drafts flush on `inactive`/`background`. |
| 15. Deep links | **Implemented but dormant.** Only `https://<signed cloud host>/account-action#…` is routed into the app, and the token fragment is never logged. It needs the Associated Domains entitlement plus `apple-app-site-association` on the production origin (**BLOCKED_EXTERNAL**, owner/Apple account). |
| 16. Account export | **Fixed** (CP-02): the explicit `share.file` path. |
| 2. Finger draw vs scroll | **Partly fixed.** On iPhone, fingers write on the canvas and scroll the page everywhere else. The canvas fits the screen (CP-03), so scrolling while writing is rarely needed. Two-finger scrolling over the canvas is **not** implemented (open). Real finger feel is a physical gate. |
| 18. Accessibility | **Partly fixed.** Dynamic Type is applied as page zoom, capped so the CSS viewport never drops below 360 px: up to 1.5× on iPad, and about 1.08× (390 pt wide) to 1.22× (440 pt) on iPhone. The native ink surface is placed zoom-aware: it keeps CSS-pixel bounds and is scaled by the zoom, and the bridge self-check verifies the zoom 1 and 1.5× cases. VoiceOver remains a physical gate. |
| Stale artefacts | `PriLearning.swiftpm.zip` removed. The package drift gate now covers `Info.plist`, assets and models. |

**Simulator evidence (synthetic):** the evidence records come from the CI artefact `native-simulator-evidence` (workflow "Native Ink"). The local runs on 2026-10-01 UTC were:
- `node scripts/iphone-journey.mjs --family iphone` gives **11/11** on an iPhone 18 Pro simulator (iOS 27.0): launch, onboarding, practice, a typed attempt marked with feedback ("Not quite…"), next question, native ink (`stylus=false fingerDefault=true`, a native reading returned), progress, a persistence marker, and the profile and marker surviving a relaunch.
- The same journey gives 11/11 on an iPad Pro 13-inch (M5) simulator (`stylus=true fingerDefault=false`).
- The bridge self-check is 8/8 on both, including zoom-aware ink placement.
- The journey asserts hardware-correct ink facts. Finger *touch* input itself is not exercised by injected strokes; it remains a physical gate.

**Scope note:** `docs/release/PRI_V1_RELEASE_SCOPE.md` makes V1 iPad-only, and the release policy ships only an exact `main` SHA. So `main` itself declares **iPad only**, which closes V1 hard blocker #1 in code, and `--check-v1` runs in CI. iPhone engineering builds a scratch copy that adds the iPhone family: `node scripts/apple-shipping-target.mjs --engineering-package <dir>`. That copy is used for simulator CI and is never archived. A public iPhone release needs the V1 scope-change procedure, then a reviewed change to `main`, **and** the §4 physical gates.

## 6. CP-05 — iPhone automated certification

`node scripts/iphone-journey.mjs --family iphone --cloud --dynamic-type --lifecycle --a11y` drives the real app in the real WKWebView on an iPhone simulator. The cloud steps run against a **real Pri server** (`scripts/cloud-fixture-server.mjs`: the real `server/index.js` on a throwaway database, fixture accounts only). Every step writes a machine-readable record (SHA, simulator, runtime, workflow, timestamp, per-step result) labelled `SYNTHETIC_SIMULATOR` with `physicalDevice: false`. CI (`native-ink.yml`) uploads the records as `native-simulator-evidence`.

| Spec item | Result (SYNTHETIC / SIMULATOR) |
|---|---|
| Account signup | ✅ `cloudSignUp`: Settings → Create account (adult) against the real server |
| Login | ✅ `cloudLogin` (new account), `cloudSignIn` (fixture account) |
| Session persistence | ✅ `cloudSessionKept` after terminating and relaunching the app; after every sync the account still reads `Connected` |
| Logout | ✅ `cloudDisconnect`, plus `serverLogoutRecorded`: the fixture server's own log shows the logout answered 200 |
| Account deletion | ✅ `cloudDeleteAccount` (password + typed DELETE). Then `serverDeletedAccountRefused`: the server refuses that account's login (401) |
| Typed answer, submission, feedback, next | ✅ `typedAttempt`, `feedback`, `nextQuestion` |
| Finger handwriting | 🟡 `nativeInk`: the native PencilKit surface with finger-default facts (`stylus=false fingerDefault=true`) returns a reading from programmatic strokes. Real finger touch input is a **physical** gate. |
| Photo path | 🟡 `nativePhoto`: native Vision reads a rendered line of maths ("…11"). The camera itself is **physical**. |
| Progress | ✅ `progress` |
| Offline | ✅ `offlinePractice` + `offlineSyncSafe`: with the server unreachable, practice works, the account reads "Linked · offline" with a reassurance note, and Sync is not offered |
| Reconnect | ✅ `cloudReconnectSync`: the same server comes back, the session is still valid and Sync completes |
| Background → foreground | ✅ `backgroundDraftKept`: switching to Settings and back raises lifecycle events, and an unsent typed answer is kept |
| Relaunch persistence | ✅ `relaunchProfile`, `relaunchMarker` (process terminated between launches) |
| Accessibility automation | 🟡 `a11yAudit`: a DOM-level smoke check in the real web view (accessible names, labels, `lang`, headings, no positive tabindex, 44 px targets) on four screens. An XCUITest `performAccessibilityAudit` is **not set up**: it needs a UI-test target, which the SwiftPM app package does not have. That is a tooling gap and scope decision, not an impossibility. VoiceOver is **physical**. |
| Dynamic Type | ✅ `dynamicTypeZoom` asserts the page is scaled to the capped Dynamic Type scale; `dynamicTypeNoOverflow` asserts no sideways overflow on four screens, at the largest accessibility size. **Range:** the scale is capped so the CSS viewport stays ≥ 360 px, so a 402 pt iPhone gets about **1.12×** even at the largest size (iPad up to 1.5×). Text larger than that is a product decision, not delivered here. |
| StoreKit Testing, restore, transaction updates | **Not automated.** Local StoreKit Testing is possible headlessly through `SKTestSession` with a `.storekit` file, but only inside an XCTest run (`xcodebuild test`), and the SwiftPM app package has no test target. That is a tooling gap, not an external block. The `simctl`-launched journey cannot load a `.storekit` file. **Sandbox** purchases need App Store Connect products and a sandbox tester (**BLOCKED_EXTERNAL**). The JS ↔ Swift ↔ server contract is covered by `client/test/native-storekit-boundary-check.mjs` and `server/test/apple-billing-check.mjs`; StoreKit itself is not exercised. |

**Bugs found by this certification and fixed in CP-05:**
1. **Dynamic Type clipped the page on iPhone.** CP-04 applied the text size with `WKWebView.pageZoom`, which magnifies without reflowing. At the largest size the page was laid out 402 CSS px wide with 360 visible, and the right edge and the bottom navigation were cut off (screenshot-verified). The text size is now applied through the viewport (`width = view width ÷ scale`), so WebKit reflows. The viewport is set at document start, so there is no full-width first paint. Native ink placement uses the effective scale (`pageZoom × scrollView.zoomScale`) and is re-placed whenever the zoom scale changes. The bridge self-check (8/8 on iPhone and iPad) tests that placement **math**; live ink placement at large text sizes is not automated and stays a physical check. Width rules that used `vw` now use `%`.
2. **The account label was wrong in two ways.**
   - An unreachable server read as "sign-in required". It now reads "Linked · offline" (no response at all), with a note that work is saved on the device, or "Linked · cloud unavailable" (the server answered with an error). Only a 401 reads "sign-in required", and "Linked · checking…" shows until the session is known.
   - Every successful Sync, purchase or refresh dropped a connected account back to "sign-in required" and disabled Sync (pre-existing; found in review). A reload without re-verification now keeps the verified session.

**Physical gates (DEFERRED, unchanged):** small, standard and large iPhones; finger writing feel; camera; keyboard; VoiceOver; Dynamic Type on hardware; StoreKit sandbox; background process death under real memory pressure; real launch performance.

**Status:** `SOFTWARE IMPLEMENTATION: COMPLETE` / `PHYSICAL DEVICE VALIDATION: DEFERRED`. Not "physically certified".
