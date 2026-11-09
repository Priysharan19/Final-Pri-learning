# Pri Learning — native iPad app

`PriLearning.swiftpm` is the canonical native Apple package for Pri Learning. It wraps the bundled React application in a SwiftUI/WKWebView shell and adds the native PencilKit writing surface, camera access for photo attach, StoreKit billing, sharing/downloads and bounded production cloud transport. Nothing in the shell reads handwriting or photos: both are read on the server (owner decision 2026-10-02, default D16), and the deterministic marking engine in the web bundle decides every mark.

`ios/PriLearning 2.swiftpm` is a tracked compatibility copy for existing Swift Playgrounds installs. Native source changes must remain synchronized; CI enforces the package contract.

## Development

### iPad / Swift Playgrounds

1. Install Swift Playgrounds from Apple.
2. On a Mac with the repository, run `npm run build && npm run sync:ios && npm run check:ios` so `Resources/Web/` holds the generated bundle (git carries only its README), then copy the complete `PriLearning.swiftpm` package to Files/iCloud Drive.
3. Open the package and press Run.
4. Use this path for development/device checks only; production evidence must still follow `RELEASE.md`.

### Mac / Xcode

1. From the repository root run `npm run build && npm run sync:ios && npm run check:ios` (the web bundle is generated, not in git; see below).
2. Open `PriLearning.swiftpm` in Xcode 15+.
3. Select an iPad simulator or connected iPad.
4. Run the `PriLearning` scheme.
5. A personal-device development install may use a development signing team; App Store/TestFlight signing is a separate release step.

## Bundled web application

The shipping web bundle lives in `Resources/Web/`. It is **generated, never committed** (decision D28, 1 November 2026): on a fresh checkout the folder holds only its README, and `Package.swift`'s `.copy("Resources/Web")` would ship an empty web folder until it is generated. Do not hand-edit it. From the repository root, before the first Run in Xcode or Swift Playgrounds and after any change under `client/`:

```bash
npm ci --prefix client   # once
npm run build            # client/dist
npm run sync:ios         # copies client/dist into both packages
npm run check:ios        # fails unless each bundle is a complete copy of the build
```

CI, the Native Ink lane, the App Health agent and the release-candidate workflow run the same three `npm run` commands before any Swift step; `tools/generated-bundles-untracked-check.mjs` fails CI if a generated file is ever committed again. A branch cut before D28 still tracks the old bundle and conflicts when `main` is merged in; `scripts/resolve-generated-conflicts.sh` clears those conflicts.

`ios/PriLearning.swiftpm` is the canonical native package. Native Swift, Package.swift, Info.plist and release assets must be kept consistent with the compatibility package under `ios/PriLearning 2.swiftpm`.

## Runtime model

Pri Learning remains **offline-first**, not network-free:

- practice/content, local profiles and the bundled learning runtime continue to work without cloud connectivity;
- optional production account, sync, classroom, entitlement and related `/v1` features use the native `NativeCloudBridge`;
- release builds obtain the sole permitted cloud origin from the signed `PRICloudOrigin` Info.plist value, populated by the `PRI_CLOUD_ORIGIN` build setting;
- production native cloud transport accepts HTTPS only and fails closed when the origin is absent or invalid;
- JavaScript cannot choose the destination origin and never receives the native session/CSRF cookies;
- external web links are opened in Safari rather than loaded into the local app origin.

Do not describe the shipping app as making “no network requests.” Describe it as offline-first with optional authenticated cloud services.

## Native components

- `PriLearningApp.swift` — SwiftUI application entry and shell presentation.
- `WebShell.swift` — WKWebView host, native bridge registration, share/download handling and outbound navigation policy.
- `LocalSchemeHandler.swift` — serves bundled assets through `prilearning://` so local web storage remains in the app sandbox.
- `NativeCloudBridge.swift` — bounded HTTPS `/v1` transport with native cookie/CSRF ownership.
- `StoreKitBillingBridge.swift` — native Apple purchase/restore bridge; server entitlement state remains authoritative.
- `Ink/` — PencilKit surface (`InkSurface.swift`), the stroke model (`InkStroke.swift`), the page bridge (`InkBridge.swift`, capture only, no read op), the capture-fidelity self-check (`InkSelfCheck.swift`, Gate A) and the debug demo driver.
- `Assets.xcassets/AppIcon.appiconset/` — production AppIcon asset, regression-gated by the native bridge suite.
- `Resources/Web/` — generated web application bundle (`npm run build && npm run sync:ios`); only its README is tracked.

## Production release

Follow [`RELEASE.md`](RELEASE.md). A successful simulator build or green CI run is software evidence only; it is not a substitute for signing, TestFlight/App Store Connect, physical-device, privacy/legal or real-user evidence where those are required.
