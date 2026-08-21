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

## Option C — Safari over your local network, for quick UI iteration

Fastest loop when you are changing screens and want to look at them on glass,
but read the limitation before trusting anything you see.

```bash
npm run build
node scripts/serve-lan.mjs
```

It prints a `http://<your-mac>:4188` address. Type it into Safari on the iPad,
on the same Wi-Fi.

**What does not work over plain `http`, and why.** iOS only exposes
`crypto.subtle` in a *secure context* — HTTPS, or `localhost`. A LAN IP is
neither. So on this route:

- password-protected profiles cannot be created or opened (the vault needs
  PBKDF2 through `crypto.subtle`),
- encryption at rest is therefore not exercised at all,
- the service worker will not register, so there is no offline mode and
  *Add to Home Screen* gives you a bookmark rather than a real installed PWA.

Everything else — the whole question engine, marking, the Apple Pencil canvas
and the recogniser — runs normally. Use this route to look at screens; use
Option A when you want to test the app as a student would actually have it.

## Why this architecture

The engine (expression equivalence, 84 generators, the $P handwriting
recogniser, Elo adaptive model) is ~17,300 lines, and the repo's suites run
693,000+ automated checks over it (`npm test`). None of it has been used by a
student yet — there is no field evidence of any kind. Shipping it inside the Swift app keeps 100% of that
verified behaviour while the app itself is fully native at the edges — icon,
full-screen launch, share sheet, camera, sandbox storage. This is the same
approach many production iPad apps use. A screen-by-screen Swift/SwiftUI port
of the engine can be done incrementally later without users losing anything.
