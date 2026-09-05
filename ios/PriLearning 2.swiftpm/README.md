# Pri Learning — native iPad app

`PriLearning.swiftpm` is the canonical native Apple package for Pri Learning. It wraps the bundled offline-first React application in a SwiftUI/WKWebView shell and adds native PencilKit/Vision handwriting, camera/photo OCR, StoreKit billing, sharing/downloads and bounded production cloud transport.

`ios/PriLearning 2.swiftpm` is a tracked compatibility copy for existing Swift Playgrounds installs. Native source changes must remain synchronized; CI enforces the package contract.

## Development

### iPad / Swift Playgrounds

1. Install Swift Playgrounds from Apple.
2. Copy the complete `PriLearning.swiftpm` package to Files/iCloud Drive.
3. Open the package and press Run.
4. Use this path for development/device checks only; production evidence must still follow `RELEASE.md`.

### Mac / Xcode

1. Open `PriLearning.swiftpm` in Xcode 15+.
2. Select an iPad simulator or connected iPad.
3. Run the `PriLearning` scheme.
4. A personal-device development install may use a development signing team; App Store/TestFlight signing is a separate release step.

## Bundled web application

The shipping web bundle lives in `Resources/Web/`. Do not hand-edit it. From the repository root regenerate and verify both declared mirrors with:

```bash
npm run build
npm run sync:ios
npm run check:ios
```

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
- `PhotoOCRBridge.swift` — native photo OCR path.
- `Ink/` — PencilKit surface, stroke bridge, recognition and native handwriting support.
- `Assets.xcassets/AppIcon.appiconset/` — production AppIcon asset, regression-gated by the native bridge suite.
- `Resources/Web/` — generated offline-first web application bundle.
- `Resources/Models/` — promoted native model assets when release evidence allows them.

## Production release

Follow [`RELEASE.md`](RELEASE.md). A successful simulator build or green CI run is software evidence only; it is not a substitute for signing, TestFlight/App Store Connect, physical-device, privacy/legal or real-user evidence where those are required.
