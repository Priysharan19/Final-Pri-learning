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
21. **Account deletion** is password-only in the client UI (the server also accepts Apple/Google id-token re-auth). App Store Review Guideline 5.1.1(v) requires in-app deletion, which is present, but it is unverified on iPhone.

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
| 18. Accessibility | **Partly fixed.** Dynamic Type is applied as page zoom (up to 1.5×), capped so the CSS viewport never drops below 360 px. VoiceOver remains a physical gate. |
| Stale artefacts | `PriLearning.swiftpm.zip` removed. The package drift gate now covers `Info.plist`, assets and models. |

**Simulator evidence (synthetic):**
- `node scripts/iphone-journey.mjs --family iphone` gives **11/11** on an iPhone 18 Pro simulator (iOS 27.0): launch, onboarding, practice, a typed attempt marked with feedback ("Not quite…"), next question, native ink (`stylus=false fingerDefault=true`, a native reading returned), progress, a persistence marker, and the profile and marker surviving a relaunch.
- The same journey gives 11/11 on an iPad Pro 13-inch (M5) simulator (`stylus=true fingerDefault=false`).
- The bridge self-check is 7/7 on both.

**Scope note:** `docs/release/PRI_V1_RELEASE_SCOPE.md` makes V1 iPad-only. `main` keeps iPhone engineering. The V1 shipping target is applied with `node scripts/apple-shipping-target.mjs --apply-v1` and verified with `--check-v1`; the iPad-only variant compiles and produces `UIDeviceFamily = [2]`. A public iPhone release needs the V1 scope-change procedure **and** the §4 physical gates.
