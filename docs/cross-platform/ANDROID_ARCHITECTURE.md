# Android Architecture (CP-01)

- **Status:** design only. As of `main` @ `421f1ff1` (initial audit) and again at `7f4a0559` (revalidation), the repository contains **no** Android code, no `android/` directory, and no `android/**` ownership rule in `.pri-os/fleet.json`. The fleet does have an `android` agent ("Prepare shared product logic for Android without weakening iPad quality or splitting learning engines").
- **Direction:** a Kotlin native shell, using AndroidX WebKit `WebView`, the **same** bundled `client/dist`, and platform bridges that implement the contract in [CROSS_PLATFORM_ARCHITECTURE.md](CROSS_PLATFORM_ARCHITECTURE.md) section 4. No React Native or Flutter. No Kotlin port of any learning logic.

Repository evidence supports the WebView direction:

1. The Apple shell already proves the model in production code (`ios/PriLearning.swiftpm/WebShell.swift`).
2. The client build targets `chrome91` (`client/vite.config.js`), which an updatable Android System WebView satisfies.
3. All learning, marking and progress logic is in-process JavaScript (`client/src/local/backend.js`), with no platform dependencies.
4. Cloud I/O is confined to one module (`client/src/platform/cloudTransport.js`), so only one transport needs a native implementation.

## 1. Platform floor

| Item | Decision | Reason |
|---|---|---|
| `minSdk` | **26** (Android 8.0) | Updatable WebView since Android 7, Keystore AES-GCM reliable, adaptive icons. Covers the vast majority of active Play devices in India (re-check the Play Console distribution at CP-12). |
| `targetSdk` / `compileSdk` | **36** | Play's target-API requirement for new apps and updates from 2026-08-31. Re-verify at CP-12. Edge-to-edge is enforced from API 35. |
| WebView floor | Chromium **≥ 91** at runtime | Matches the `chrome91` build target. The shell checks `WebViewCompat.getCurrentWebViewPackage()` and shows a native "Update Android System WebView" screen (Play link) below the floor, instead of a blank page. |
| Language/build | Kotlin 2.1.20, Gradle Kotlin DSL, version catalog, AGP 8.12.3, Gradle 9.3.1 (wrapper with pinned `distributionSha256Sum`), JDK 17. AndroidX WebKit 1.17.1 (where `addDocumentStartJavaScript` / `DOCUMENT_START_SCRIPT` are public API), Activity 1.13.0. | Built and verified in CP-06. |
| Form factors | Phones and tablets, one APK/AAB; `resizeableActivity=true` (multi-window, foldables) | Layout comes from CSS form factors ([FORM_FACTOR_SPEC.md](FORM_FACTOR_SPEC.md)). |
| Application id | `com.prilearning.app` (matches the Apple bundle id) | Must be confirmed available in Play Console. That is an external owner action. |

## 2. Project structure

```
android/                                 # NEW (CP-06); fleet rule android/** → primary android, reviewers security+qa-release
  settings.gradle.kts
  build.gradle.kts
  gradle/libs.versions.toml
  gradle/wrapper/…                       # committed wrapper, pinned checksum
  app/
    build.gradle.kts                     # task syncWebAssets ← client/dist (fails if missing or release.json mismatch)
    src/main/AndroidManifest.xml
    src/main/assets/web/                 # GENERATED from client/dist; git-ignored; parity-checked in CI
    src/main/java/com/prilearning/app/
      MainActivity.kt                    # single activity, edge-to-edge, back dispatcher, config changes
      shell/WebViewFactory.kt            # hardened WebSettings
      shell/AssetOrigin.kt               # WebViewAssetLoader + SPA fallback at https://appassets.androidplatform.net/
      shell/NavigationPolicy.kt          # external links → Custom Tabs / browser
      shell/WebViewFloor.kt              # runtime WebView version gate
      bridge/PriBridge.kt                # envelope router: origin/frame check, size limits, validation, timeouts
      bridge/HostHandshake.kt            # injects window.__PRI_HOST__ via WebViewCompat.addDocumentStartJavaScript (origin rule; requires DOCUMENT_START_SCRIPT, fails closed otherwise)
      bridge/cloud/CloudBridge.kt        # OkHttp /v1 transport, X-Pri-Client: android-native-v1
      cloud/{CloudConfig,CookieJar,SecureStore,NativeCloud}.kt # cloud transport + Keystore-encrypted jar (CP-07)
      io/{FileRules,FileExchange}.kt     # share, print, file/photo chooser (CP-07)
      bridge/billing/PlayBillingBridge.kt
      bridge/photo/FileChooser.kt        # onShowFileChooser → Photo Picker / camera / SAF
      bridge/share/ShareBridge.kt        # FileProvider + ACTION_SEND; ACTION_CREATE_DOCUMENT
      bridge/lifecycle/LifecycleBridge.kt
      release/ReleaseIdentity.kt         # reads assets/web/release.json
    src/test/…                           # JVM: envelope schema, path allowlist, cookie jar, error mapping
    src/androidTest/…                    # instrumented: floor screen, boot, handshake, journey, Back, links; relaunch after process death
scripts/sync-android.mjs                 # NEW (CP-06): mirror of scripts/sync-ios.mjs (--check parity mode)
```

The web bundle is **not committed** for Android. The Apple bundle is committed only because Swift Playgrounds packages must be self-contained. Android builds from `client/dist` through Gradle, and CI asserts that the packaged `release.json` SHA equals the web build SHA.

## 3. WebView configuration (hardened)

```kotlin
settings.javaScriptEnabled = true
settings.domStorageEnabled = true            // localStorage + IndexedDB
settings.allowFileAccess = false             // assets come only through WebViewAssetLoader
settings.allowContentAccess = false
settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
settings.setSupportMultipleWindows(false)
settings.mediaPlaybackRequiresUserGesture = true
settings.setGeolocationEnabled(false)
settings.safeBrowsingEnabled = true          // and WebViewCompat.startSafeBrowsing
WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
// textZoom left at default so system font scale reaches the page (accessibility)
```

- **Never** call `addJavascriptInterface`. Bridges use `WebViewCompat.addWebMessageListener(webView, "priBridge", setOf("https://appassets.androidplatform.net"), listener)`. This is origin-scoped by the platform. The listener also rejects `!isMainFrame`. Replies go through `JavaScriptReplyProxy`. If `WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)` is false, the shell **fails closed**: no native capabilities, and the WebView-update screen if the floor is unmet.
- `shouldOverrideUrlLoading`: any navigation that is not to `appassets.androidplatform.net` opens in a Custom Tab or the default browser and is cancelled. This mirrors the Apple navigation policy.
- `onRenderProcessGone`: recreate the WebView and reload the last route. Drafts survive because `client/src/components/drafts.js` persists them in localStorage.

## 4. Origin and storage strategy

- **Origin:** `https://appassets.androidplatform.net/`, served by `WebViewAssetLoader` with a custom `PathHandler` at `/`. The handler maps `/assets/*`, `/icons/*`, `/release.json` and similar paths to `assets/web/…`, and maps **any extensionless path to `index.html`** (the SPA fallback that `BrowserRouter` needs, mirroring `ios/PriLearning.swiftpm/LocalSchemeHandler.swift`). Any other unmatched path returns a local **404 response**, never `null`, so no request for this host can fall through to the real network host `appassets.androidplatform.net`. Vite emits root-absolute URLs (`/assets/…`, no `base`), which works with a root handler.
- **Why not `file://`:** `file://` gives an opaque origin, unreliable IndexedDB, and needs dangerous `allowFileAccessFromFileURLs`.
- **Why not a real domain we own** (for example the production web origin) as the local origin: cookies, service workers and storage of the real site would be confused with the bundled app, and phishing-style origin confusion becomes possible.
- **Persistence:** WebView storage lives in the app's private data directory and survives updates. **The origin string is the data key.** It must never change after the first public release; the check is part of CP-11. Uninstall wipes data, which is expected; cloud sync is the cross-device path.
- **Backup:** `android:allowBackup="false"` and `dataExtractionRules` exclude everything for v1. Keystore keys do not migrate, so a restored encrypted cookie jar would be undecryptable. IndexedDB restore across devices bypasses the server's account model. Cross-device continuity is cloud sync.
- **Service worker:** not registered inside the shell (the gate moves from `__PRI_NATIVE__` to `__PRI_HOST__` in CP-02). The bundled assets already are the offline cache.

## 5. Bridges

| Capability | Android implementation | Notes |
|---|---|---|
| `cloud` | **As implemented (CP-07):** `cloud/NativeCloud.kt` on `HttpURLConnection` (no extra HTTP dependency). JavaScript supplies a path and method only; the path rule is exactly `cloudTransport.js` (`^/v1/[A-Za-z0-9/_-]{1,180}$`); GET/POST/PATCH/DELETE; GET has no body; requests ≤1 MB, responses ≤2 MB (one byte over is refused); 15 s connect / 60 s read; no cache; **redirects are never followed** (a 3xx is returned to the page, so the session cannot be bounced to another host); ≤32 in flight; cancellation by id, and every in-flight request is dropped when a new document starts. Headers: `X-Pri-Client: android-native-v1`, optional `X-Pri-Request-Id` / `Idempotency-Key` (visible ASCII ≤160), `X-Pri-CSRF` from the native jar on every mutation; never `Origin` or Fetch Metadata. The origin comes from `BuildConfig.PRI_CLOUD_ORIGIN` (validated at build time: empty or one HTTPS origin; empty advertises `cloud.configured: false` and fails closed with `UNAVAILABLE`/`CLOUD_DISABLED`). Debug builds also accept a test override to the emulator host. Failures use the closed priNative codes with `detail.providerCode` (`CLOUD_NETWORK_ERROR`, `CLOUD_REQUEST_TOO_LARGE`, …). | **Server (CP-07):** `nativeNonBrowserRequest` accepts the closed exact-match set `{ios-native-v1, android-native-v1}` under the unchanged "no Origin, no Sec-Fetch-Site/Mode" rule; CSRF is still required (`server/test/native-origin-csrf-check.mjs`, incl. near-miss identities). |
| Cookie/session | **As implemented (CP-07):** `cloud/CookieJar.kt` (own Set-Cookie parser: host-only, Secure cookies only over HTTPS, Max-Age over Expires, a zero/past expiry deletes — the server's logout) persisted by `cloud/SecureStore.kt`: AES-256-GCM with a non-exportable Android Keystore key, file in `noBackupFilesDir`; an undecryptable file is deleted (device signed out, offline learning unaffected). Session cookies are never in the WebView cookie store and never reachable by the page. | `androidx.security:security-crypto` is deprecated; the Keystore is used directly. |
| `photo` / `files` (import) | **As implemented (CP-07):** `io/FileExchange.kt` `onShowFileChooser` → the system document picker (`ACTION_OPEN_DOCUMENT`, MIME types from the input's `accept`; JSON also admits `application/octet-stream`/`text/plain` because providers mislabel exports — the page validates content). When the input accepts images, the chooser also offers the camera (`ACTION_IMAGE_CAPTURE` into a `FileProvider` cache URI). The callback is always answered exactly once. The document picker is used rather than the Photo Picker because the attach-work input accepts PDFs as well as images. | No `READ_MEDIA_*` and **no `CAMERA` permission** (the capture intent needs none when undeclared). `client/src/components/QuestionCard.jsx` works unchanged. |
| `photo.ocr` | **Not provided.** Photo reading uses the shared cloud path (`readPhotoWithCloud`) or the JS fallback. ML Kit text recognition is a possible later accelerator (CP-09), only with measured evidence. | Keeps answer-blind behaviour. |
| `share` / export | **As implemented (CP-07):** `share.file` writes text or base64 bytes (≤6 MB, sanitised name) into `cache/share/` and opens the `ACTION_SEND` chooser with a read grant for the chosen app only. One sheet at a time. Android's chooser usually reports "cancelled" even after a share; product code does not depend on `completed`. | A direct "Save to device" (`ACTION_CREATE_DOCUMENT`) is **not** implemented yet: on most devices the share sheet offers Files/Drive. Recorded as a CP-10 polish item. |
| `print` | **As implemented (CP-07):** `PrintManager` + `webView.createPrintDocumentAdapter` via `share.print`. The three Print / Save PDF buttons call `printPage()` (`client/src/lib/files.js`), which uses `share.print` whenever the host can print and `window.print()` otherwise. | `window.print()` does nothing in an Android WebView. |
| `billing` | Play Billing Library, current major version. See section 6. | |
| `lifecycle` | `onPause`/`onResume`/`onStop`/`onTrimMemory`, sent as a `lifecycle.state` event; `webView.onPause()`/`onResume()`. | JS flushes drafts on `background`. |
| Back | **As implemented (CP-06):** the page declares whether it wants Back (`lifecycle.setBackHandled`): `true` while a sheet/dialog is visibly open or while it has in-app history (`history.state.idx > 0`, stamped by the router; the role landing — `/` or `/teach` — is the first entry). The activity's `OnBackPressedCallback` is enabled exactly while that is true. Enabled: a `lifecycle.back` event follows; the page closes the open sheet/dialog (that press never also navigates) or calls `history.back()`. Disabled: the system default runs — predictive back-to-home, and the task moves to the background. There is no timeout race and no `canGoBack()` fallback. The declared state resets on the first message from a new document's reply proxy. | JS must close sheets and dialogs first and must never lose an in-progress attempt. |
| `ink` | **No native ink in v1.** The shared `client/src/ink/InkCanvas.jsx` handles finger and stylus via PointerEvents (`pointerType: 'pen'` for S Pen/USI, pressure, tilt; palm rejection once a pen is seen). `__PRI_HOST__.capabilities.ink` is **absent**, so `client/src/ink/InkAnswer.jsx` picks the canvas automatically. | A low-latency `androidx.ink` front-buffer surface is CP-09 scope **only** if latency is measured unacceptable on target tablets. It would capture strokes only; recognition stays shared. |
| `device` | Reports `stylusSeen` (any `InputDevice` with `SOURCE_STYLUS`) and `safeAreaApplied`; `lifecycle.backButton: true`. | No OS or model sniffing exposed for layout. |
| Release identity | Read `assets/web/release.json` and expose it as `__PRI_NATIVE_RELEASE_IDENTITY__` and `__PRI_HOST__.release`, matching `ios/PriLearning.swiftpm/ReleaseIdentity.swift`. | `versionCode` comes from the CI build number. |

## 6. Google Play Billing (CP-08)

The client and server flow mirrors the existing Apple flow (`server/platform/appleBilling.js`):

1. `GET /v1/billing/google/bootstrap` (new) returns the Play product ids from server env (`server/platform/billing.js` already reads `googleMonthly`/`googleAnnual`) and a server-minted `obfuscatedAccountId` bound to the account. This is the Play analogue of `appAccountToken`.
2. The shell calls `queryProductDetailsAsync`, then `launchBillingFlow(…setObfuscatedAccountId(…))`.
3. `onPurchasesUpdated` returns `{purchaseToken, productId, orderId}` to JS. This is an **opaque proof**.
4. JS calls `POST /v1/billing/google/purchase {purchaseToken, productId}` (new). The server calls the Play Developer API `purchases.subscriptionsv2.get` with a service-account credential held **only** in server env. It verifies package name, product, `obfuscatedExternalAccountId` and state, then calls `applyVerifiedEntitlement` (`server/platform/entitlements.js`), which is the same grant path Apple uses. Binding rules:
   - **Fail closed** when `obfuscatedExternalAccountId` is missing or mismatched (purchases made outside the app or via promo-code redemption carry none). Those go through a separate, explicit, re-verified link flow, never an implicit grant.
   - **One account per `purchaseToken`**: a token already bound to another account is refused.
   - Upgrades and re-subscriptions follow `linkedPurchaseToken`, superseding the old token's entitlement so one payment never yields two grants.
5. **Acknowledgement:** done by the server (`purchases.subscriptions.acknowledge`), or by the shell only after the server returns success, and always within Play's 3-day window. The shell **never** grants anything itself.
6. Real-time developer notifications: Pub/Sub push to the existing `POST /v1/billing/webhook/google` route (which today returns `BILLING_PROVIDER_NOT_CONFIGURED`). Verify the Pub/Sub OIDC token, then re-fetch the purchase from the Play API before changing entitlement. Never trust the notification body alone.
7. Restore: `queryPurchasesAsync(SUBS)`, then each token goes to `/v1/billing/restore/google` for server re-verification. **Pending-purchase recovery:** the shell also calls `queryPurchasesAsync(SUBS)` on every launch and `onResume`, and re-submits unacknowledged tokens to the server. Play does not replay purchases on its own, and refunds any purchase left unacknowledged for 3 days.
8. `/v1/health` reports `google: true` only when the verifier is configured (today it is hard-coded `false` in `server/platform/router.js`).
9. **UI:** the paywall chooses the store button from `__PRI_HOST__.capabilities.billing.store === 'play'`. Razorpay web checkout stays disabled inside any native shell. That rule already exists in `client/src/components/CloudAccountPanel.jsx` and is required by Play policy for digital goods.

## 7. Input, keyboard, insets, rotation

- **Keyboard/IME:** edge-to-edge (mandatory at targetSdk 35+). The activity root applies `WindowInsetsCompat` `systemBars | displayCutout | ime` as **padding on the WebView container**, so the web view is letterboxed like the Apple shell. CSS `env(safe-area-*)` stays 0 and the existing layout works. Later polish can pass insets as `--pri-inset-*` / `--pri-ime-bottom` instead ([FORM_FACTOR_SPEC.md](FORM_FACTOR_SPEC.md)).
- **Rotation:** `android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|uiMode"` so the WebView is **not** destroyed on rotation, fold or theme change. The page receives a normal resize.
- **Stylus/S Pen:** handled by the web canvas via PointerEvents. Hover (`pointerType: 'pen'` with no buttons) is ignored for drawing.
- **Dark mode:** follow the page's own theme. `WebSettingsCompat.setAlgorithmicDarkeningAllowed(false)` stops Chromium from auto-darkening an already-themed UI.

## 8. Offline behaviour

The same as the Apple shell: assets are bundled, the learning engine and marking run in process, and the outbox queues cloud work. Cloud features fail with `UNAVAILABLE` and learning continues. ADR-0001 governs the product framing (online-first, deterministic fallback); this shell adds no offline semantics of its own.

## 9. Accessibility

TalkBack works over WebView semantics, so the existing ARIA work in `client/src` carries over. System font scale reaches the page through the default `textZoom`. The native screens (WebView-update screen, crash/reload screen) carry content descriptions. A phone-width accessibility gate is CP-03/CP-10 scope.

## 10. Release signing and Play requirements (CP-12; external owner actions marked ⚑)

- AAB only. **Play App Signing**: the upload key is held in CI secrets, never in the repository ⚑.
- `versionCode` is monotonic from CI; `versionName` = `release/metadata.json` `productVersion`.
- **Data safety form**, **privacy policy URL** (`/privacy` exists in `client/src/pages/Legal.jsx`) and the **account deletion** requirement (in-app deletion exists; Play also requires a web deletion-request resource ⚑).
- **Target audience:** Classes 7–12 includes users under 13, so the Play **Families policy** applies (no ads SDKs, which matches current code; COPPA/DPDP-aligned consent, which the server guardian-consent flow supports) ⚑ legal sign-off.
- **Permissions:** only `INTERNET` (plus `com.android.vending.BILLING` via the library). No location, contacts, storage, camera or notifications.
- Pre-launch report on the Play Console device matrix; staged rollout ⚑.

## 11. Non-goals

- No Kotlin re-implementation of curriculum, generators, marking, Step Check, adaptive or progress.
- No Android-specific React screens. Divergence is by capability and form factor only.
- No push notifications, widgets or Wear/TV/ChromeOS-specific work in CP-06 to CP-12.
- No native handwriting recogniser for Android unless CP-09 produces measured evidence that it beats the shared path.
