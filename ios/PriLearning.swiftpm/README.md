# Pri Learning — native iPad app

This is a complete native iPad app project. Two ways to run it:

## On the iPad itself (no Mac needed)

1. Install **Swift Playground** (free, by Apple) from the App Store.
2. Copy this whole `PriLearning.swiftpm` folder to the iPad (AirDrop it, or put
   it in iCloud Drive / Files).
3. In Files, tap `PriLearning.swiftpm` — it opens in Swift Playground.
4. Press **Run** (▶). The app builds on the iPad and launches full-screen.
   From Swift Playground you can also add it to the Home Screen with its own
   icon, and even submit it to App Store Connect.

## On a Mac with Xcode

1. Open `PriLearning.swiftpm` in **Xcode 15+** (File → Open).
2. Select an iPad simulator or a connected iPad, press **Run**.
3. For a personal install on a real iPad, sign with your (free) Apple ID team
   under *Signing & Capabilities*.

## What's inside

- `PriLearningApp.swift` — SwiftUI app entry (full-screen dark shell).
- `WebShell.swift` — the WKWebView host: native share sheet for backups /
  task packs / progress files, download handling, external links → Safari.
- `LocalSchemeHandler.swift` — serves the bundled app over `prilearning://`
  so IndexedDB and localStorage persist in the app sandbox.
- `Resources/Web/` — the complete Pri Learning build (engine, handwriting
  recogniser, adaptive model, all content). Rebuild it from the repo with
  `npm run build`, then re-copy `client/dist` here.

Everything runs on-device and offline — the app makes no network requests.
