# Android ↔ iPad parity

Owner request (2026-10-03): make Android as good as iPhone/iPad. This page lists, feature by feature, what each shell does today, the gap, and the fix. Android and iPad run the **same bundled web product**: Android uses `WebViewAssetLoader`, iPad uses `WKWebView`. So most product behaviour (marking, curriculum, offline state, ink rendering, server-side reading) is identical by construction. The gaps are in the shell: input plumbing, OS integration, store and identity.

**Evidence rules.** "CI" means the Android Shell workflow on GitHub-hosted emulators. That evidence is **synthetic** (API 26 floor; API 33 and 36 phone; API 36 tablet). Nothing below claims a physical-device result. Every physical check is **BLOCKED_EXTERNAL**: an owner or tester has to run it on real hardware and record it in `docs/release/evidence/`.

Status: ✅ parity in software · 🟡 partial / differs by design · ❌ gap · ⛔ BLOCKED_EXTERNAL (physical or owner action)

| Feature | iPad (Apple shell) | Android shell | Gap | Fix / status |
|---|---|---|---|---|
| **Stylus: pressure** | Apple Pencil `PointerEvent.pressure` → shared `InkCanvas` width | S Pen / USI `pressure` reaches the same `InkCanvas` (Chromium WebView). `InkInputTest` injects `TOOL_TYPE_STYLUS` with pressure | None in software | ✅ software · ⛔ S Pen feel on a real Galaxy Tab |
| **Stylus: palm rejection** | Shared canvas: once a pen is seen, fingers scroll and never draw | Same code. The shell also reports `stylusCapable` / `stylusSeen` so finger-drawing is the default only without a pen | None | ✅ (`InkInputTest`: finger draws before a pen, not after) |
| **Stylus: latency** | `desynchronized` canvas, coalesced + predicted points | Same: Chromium WebView supports `getCoalescedEvents` / `getPredictedEvents` and a `desynchronized` 2D context | A WebView cannot use front-buffered native rendering (`androidx.graphics` low-latency) | 🟡 by design; measuring needs a device ⛔ |
| **Stylus: eraser end / S Pen side button** | Apple Pencil has no eraser end; the eraser is a UI tool | Before: the eraser end and the S Pen button drew ink | Was ❌ | PR #312: `penButtons.js` (`buttons & 32` eraser, `& 2` barrel) erases on the shared canvas. Apple Pencil behaviour is unchanged |
| **Offline learning** | Bundled assets, IndexedDB/localStorage in the app sandbox, deterministic marker bundled | Same, through `WebViewAssetLoader` on a stable origin. Storage survives a real process death (CI: `relaunchAfterProcessDeath`) | None | ✅ CI |
| **Cloud sync** | `NativeCloudBridge` (URLSession, Keychain cookie jar) | `NativeCloud` (Keystore-bound cookie jar). CI runs the real server: sign-up, delete, sign-in, sync, offline attempt, reconnect, session after process death, disconnect | None | ✅ CI (`CloudJourneyTest`) |
| **Sign-in: email / phone OTP** | Six-box `OtpInput`; `autocomplete="one-time-code"` lets the keyboard offer the SMS code from Messages | Same boxes. **A WebView has no WebOTP (`OTPCredential`)**, so no SMS autofill | Was ❌ | PR #325: SMS User Consent API through the bridge (`otp.smsCode`). No SMS permission; the person approves one message in a system sheet; only six digits cross; the server still verifies. ⛔ real SMS on a device |
| **Sign-in: Google / Apple** | Hidden in native shells (`socialSignInSupported` is false). A popup inside a web view is not the OS sheet | Same, hidden | Both shells lack native social sign-in (Credential Manager / AuthenticationServices) | 🟡 equal on both; a cross-platform mission, not an Android gap |
| **Billing** | StoreKit 2 → JWS verified on the server | Play Billing 8 → purchase token verified on the server (`/v1/billing/google/purchase`); web checkout disabled in the shell | None in software | ✅ software · ⛔ Play Console products and a real purchase |
| **Notifications** | None | None | None (no product need yet; would need consent and age-gating review) | ➖ |
| **Deep links** | `WebShell.route(deepLink:)` for `/account-action#…` on the signed cloud host | Before: none | Was ❌ | **Merged** #311: App Links on the cloud host with the same accept rule (`DeepLink.kt`, `DeepLinkTest`). ⛔ `assetlinks.json` + Play signing fingerprint |
| **App icon** | Asset catalog icon | Before: a flat placeholder drawable | Was ❌ | **Merged** #311: adaptive icon with a monochrome layer (themed icons on Android 13+). P′ artwork follows the logo kit (#317) ⛔ store artwork |
| **Splash** | Launch screen in the app's dark first paint | Before: system default flash | Was ❌ | **Merged** #311: Android 12+ `windowSplashScreen*` with the app mark |
| **Safe areas** | WKWebView inside safe area | Edge-to-edge (mandatory on API 35+). The WebView is padded by system bars + cutout + IME insets; `device.safeAreaApplied` is reported | None | ✅ CI (phone + tablet) |
| **Back** | Swipe-back / no hardware Back | System Back walks the app's own history, closes sheets first, and leaves the app from the landing entry; predictive back is on (`enableOnBackInvokedCallback`) | None (Android-only affordance, done) | ✅ CI (`ShellJourneyTest`) |
| **Photo a question / camera** | File input → system picker / camera; reading on Pri's server | Same file input → system document picker + `ACTION_IMAGE_CAPTURE` via `FileProvider`, no storage or camera permission; same server reader | None (reading is server-only on both by owner decision) | ✅ CI (`FileExchangeTest`) · ⛔ real camera |
| **Screen reader** | VoiceOver over WKWebView | TalkBack over WebView. CI runs a DOM accessibility smoke check, and the system font scale reaches the page (`textZoom` follows it) | No automated TalkBack walkthrough exists (the framework cannot see WebView DOM) | 🟡 CI smoke · ⛔ TalkBack walkthrough |
| **Multi-window / DeX / tablets** | iPad multitasking | Config changes handled in place (no recreation); tablet profile in CI | `resizeableActivity` was implicit | **Merged** #311 declares it. ✅ CI tablet |
| **Mid-range tablet performance** | Measured on owner iPads | Not measured | No numbers | ⛔ needs a mid-range device (e.g. Galaxy Tab A-series); never estimated here |
| **Emulator CI** | Simulator journeys on macOS runners | Phone jobs lost the emulator mid-journey on every branch (#278) | Was ❌ | This mission's CI PR: emulator GPU `swangle_indirect` (see the PR for the run evidence) |

## Not claimed

- No physical S Pen, USI, camera, TalkBack, SMS, Play purchase or performance result.
- No claim that Android latency matches Apple Pencil. A WebView cannot reach the native low-latency path, and nothing has been measured.

## BLOCKED_EXTERNAL (owner / device)

1. Real-device runs: Galaxy Tab with S Pen (pressure, palm, eraser, side button), a USI-pen Chromebook or tablet, a mid-range phone and a mid-range tablet.
2. `assetlinks.json` on the production origin with the Play App Signing SHA-256.
3. Play Console: products, licence testers, one real purchase.
4. A real SMS sign-in on a device with Play services. The sender must not be in the person's contacts, or the consent sheet does not appear (an API rule).
5. Store icon and splash artwork sign-off.
