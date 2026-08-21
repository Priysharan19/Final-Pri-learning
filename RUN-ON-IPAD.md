# Running Pri Learning as a native iPad app

The native app lives in **`ios/PriLearning.swiftpm`** — a complete Swift
project that opens in Swift Playground on the iPad itself or in Xcode on a Mac.
It wraps the full Pri Learning build (already bundled inside it) in a SwiftUI
shell with native share-sheet exports, camera access for photo attach, and
sandboxed persistent storage.

**Apple Pencil is first-class:** on the iPad the question page defaults to
✎ Write mode. Write each step on its own line; the on-device recogniser turns
your ink into maths as you write, and when you submit, the engine marks it
line by line **on your own handwriting** — a green ✓ on lines that check out,
and on the exact line where the maths breaks: a red ✗, a red underline, and a
margin note saying what went wrong ("the mistake is here — …"). If every line
is consistent but the final answer is off, the final line gets the ✗ instead,
so a wrong answer is never just "incorrect" — it always points somewhere.

## Option A — on the iPad, no Mac needed

1. Install **Swift Playground** (free, by Apple) from the App Store.
2. Get `ios/PriLearning.swiftpm` onto the iPad — AirDrop the folder, or drop it
   into iCloud Drive and open Files.
3. Tap the `.swiftpm` — it opens in Swift Playground.
4. Press **Run** ▶. The app builds on-device and launches full-screen.
   Swift Playground can also place it on the Home Screen with its own icon,
   and submit it to App Store Connect if you ever want it on the App Store.

## Option B — Mac with Xcode

1. Open `ios/PriLearning.swiftpm` in **Xcode 15+**.
2. Choose an iPad simulator or your connected iPad and press **Run**.
3. To install on a real iPad, pick your personal team (a free Apple ID works)
   under *Signing & Capabilities*.

## How the native app is put together

| Layer | What it does |
|---|---|
| `PriLearningApp.swift` | SwiftUI entry — full-screen, dark, home-indicator hidden |
| `WebShell.swift` | WKWebView host: `priShare` bridge → iOS share sheet (AirDrop/Files/Mail) for backups, task packs and progress files; WKDownload fallback; external links → Safari |
| `LocalSchemeHandler.swift` | Serves the bundled build over `prilearning://` so IndexedDB/localStorage persist in the app sandbox; SPA route fallback |
| `Resources/Web/` | The complete Pri Learning build — engine, generators, handwriting recogniser, adaptive model, UI |

The web app detects the shell (`window.__PRI_NATIVE__`) and adapts: exports go
through the native share sheet, the service worker is skipped (the bundle *is*
the offline copy), and Settings reports native sandbox storage.

## Updating the app after changing the web code

```bash
npm run build
npm run sync:ios
```

Then press Run again in Swift Playground / Xcode.

`npm run sync:ios` fingerprints both trees and copies only what differs, leaving
`Resources/Web/icons/` alone. `npm run check:ios` exits non-zero when the bundle
has drifted from the build, and CI gates on it — the bundle went stale three
times in one day while it was a hand-typed `rm -rf` + `cp`, which is how the
iPad app ended up shipping a marketing claim that had already been removed
everywhere else.

## Option C — installed from your Mac over Wi-Fi, no Swift Playgrounds

Gives you a real installed app — full screen, its own Home Screen icon, offline,
passwords working — without Xcode or Swift Playgrounds. Serve it over HTTPS and
use *Add to Home Screen*.

```bash
npm run build
npm run serve:lan
```

It prints two addresses. Do the certificate step once:

1. On the iPad, open the **certificate** address it prints (plain `http`, port
   +1) and let Safari download the profile.
2. **Settings → General → VPN & Device Management** → install the downloaded
   profile.
3. **Settings → General → About → Certificate Trust Settings** → turn it on for
   "Pri Learning (local)".

Then open the **https** address in Safari and use **Share → Add to Home Screen**.
It launches full screen with no browser chrome.

**Why HTTPS and not plain http.** iOS exposes `crypto.subtle` and registers a
service worker only in a *secure context*. A LAN IP over `http` is not one, so
on plain http password-protected profiles cannot be opened, encryption at rest
is never exercised, and *Add to Home Screen* gives a bookmark rather than an
installed app with an offline copy. `npm run serve:lan -- --http` is available
if you want the reduced-capability route with no trust step.

The certificate is generated once into `scripts/.lan-cert/` (git-ignored) and
names your Mac's current LAN address. If your Mac's IP changes, the next run
regenerates it and you repeat the trust step.

Option A is still the one to use before you believe anything about how the app
behaves for a student — it is the artefact you would actually ship.
