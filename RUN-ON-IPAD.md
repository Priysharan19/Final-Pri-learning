# Running Pri Learning as a native iPad app

The native app lives in **`ios/PriLearning.swiftpm`** — a complete Swift
project that opens in Swift Playground on the iPad itself or in Xcode on a Mac.
It wraps the full Pri Learning build (already bundled inside it) in a SwiftUI
shell with native share-sheet exports, camera access for photo attach, and
sandboxed persistent storage.

**Apple Pencil is first-class, and it is native.** On the iPad the question
page defaults to ✎ Write mode, and what you write on is a real `PKCanvasView` —
PencilKit, the ink engine Notes is built on. It is Metal-rendered, fed by the
system's predicted touches, and drawn on the low-latency display path, which is
why it feels like Notes and GoodNotes rather than like a web page. Write each
step on its own line; the on-device recogniser turns your ink into maths as you
write, and when you submit, the engine marks it line by line **on your own
handwriting** — a green ✓ on lines that check out, and on the exact line where
the maths breaks: a red ✗, a red underline, and a margin note saying what went
wrong ("the mistake is here — …"). If every line is consistent but the final
answer is off, the final line gets the ✗ instead, so a wrong answer is never
just "incorrect" — it always points somewhere.

Fingers still scroll. A touch that is not a Pencil falls through the writing
surface to the page underneath, exactly as it always did — and ☝ Finger in the
toolbar brings finger drawing back when you want it.

## The writing surface and the reader are native

This is the part of the app that is *not* a web page, and the reason is that it
could not be one.

| | Before | Now |
|---|---|---|
| Ink | `<canvas>` in a web view | `PKCanvasView` (PencilKit) |
| Reading | a template matcher + a small CNN, in JavaScript | Vision's on-device handwriting model + a maths decoder, in Swift |

**Why the ink had to move.** The old canvas was carefully built — coalesced
samples, predicted points, incremental repaint, a 1€ filter. It still could not
match Notes, because pointer events cross into the web content process *after*
the compositor has run. That latency is structural; no amount of tuning inside
the page removes it. PencilKit sits on the other side of it.

**Why the reader had to move.** The web recogniser was trained and scored
against jittered copies of the very stroke templates it matched against, and
`client/test/ink-corpus/` — the directory for real handwriting — was empty. So
its headline accuracy measured the generator, not the reader. Vision has no
relationship to this project's stroke data at all.

What the native reader does, in order: lifts stacked fractions out (a bar with
ink above and below it), finds the lines from the ink, redraws each line black
on white at the size Vision reads best, asks Vision for several candidate
readings, scores each one **as maths** rather than as English, ties the
characters back to the marks underneath them, and reads powers off where the
ink actually sits. Brackets get a second look from the ink itself: Vision reads
a hand-drawn `(` as a `1` very readily, and a bracket bows to one side of its
own chord where a `1` does not.

Everything downstream is unchanged — the reading panel, tap-to-correct, "check
this reading first", the ✓/✗ overlay, Step Check, the marker. The native reader
hands back exactly the shape the web engine always returned.

**The web engine is still there**, for two jobs: it runs the whole surface in a
browser (Option C below, the dev server, CI), and inside the app it reads any
individual line Vision returns nothing for, so a step is never lost.

**What is still not measured.** `npm run test:ink:native` scores the native
pipeline at **94.8% character accuracy, 6/10 expressions exactly right** — but
on ink this repo generated, same as every other handwriting figure here. It is
worth more than the old number for one reason only: Vision never saw the
generator, so it is not the closed loop the web engine's figures were. It is
still not a real-handwriting benchmark. `tools/ink-collect/` and
`npm run test:real` remain the way to get one, and that gap is still open.

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
| `WebShell.swift` | Hosts the web view and the native ink surface as siblings; `priShare` bridge → iOS share sheet (AirDrop/Files/Mail) for backups, task packs and progress files; WKDownload fallback; external links → Safari |
| `LocalSchemeHandler.swift` | Serves the bundled build over `prilearning://` so IndexedDB/localStorage persist in the app sandbox; SPA route fallback |
| `Ink/InkSurface.swift` | The `PKCanvasView` writing surface — pen, stroke eraser, undo/redo, and the hitTest rule that lets fingers scroll |
| `Ink/InkBridge.swift` | The page's half of the surface: where the writing area is, what the toolbar did, "read what is written". Scrolling is followed from the web view's own offset, not from messages |
| `Ink/MathInkRecognizer.swift` | Vision, with the retry ladder short lines need, and the mapping from characters back to marks |
| `Ink/InkLineSegmenter.swift`, `Ink/FractionFinder.swift`, `Ink/InkRasterizer.swift` | Lines from ink, stacked fractions lifted out, and the picture Vision is shown |
| `Ink/MathDecoder.swift` | Reads Vision's answer as maths: one spelling per mark, letter/digit twins settled by neighbours, function names locked, brackets recovered from the ink, powers wrapped as `^(…)` |
| `Ink/InkSelfCheck.swift` | `npm run test:ink:native` — scores the pipeline and smoke-tests the bridge |
| `Resources/Web/` | The complete Pri Learning build — engine, generators, adaptive model, UI, and the web recogniser used in browsers and as a per-line fallback |

The web app detects the shell (`window.__PRI_NATIVE__`) and adapts: exports go
through the native share sheet, the service worker is skipped (the bundle *is*
the offline copy), and Settings reports native sandbox storage.

## Updating the app after changing the web code

```bash
npm run build
npm run sync:ios
```

Then press Run again in Swift Playground / Xcode.

Changing anything under `ios/PriLearning.swiftpm/Ink/` needs no web rebuild —
but do run the two checks that cover it:

```bash
npm run test:ink:bridge
```

```bash
npm run test:ink:native
```

The first reads both sides of the JS↔Swift contract and needs nothing but node.
The second builds the app, runs it on an iPad simulator, and reports what the
native reader scored — it needs Xcode.

Two debug launch arguments help when something looks wrong:

- `--ink-selfcheck` runs the scoring and bridge smoke test above and writes the
  result to the system log (`PRIINK …`). Adding `--ink-trace` also logs every
  Vision attempt per line and saves the picture Vision was actually shown into
  the app's Documents directory, which is how you tell a bad reading apart from
  a bad picture.
- `--ink-demo` walks the app to a real question in ✎ Write mode and writes on
  the surface, so the native canvas can be seen in the real layout without an
  Apple Pencil to hand.

```bash
xcrun simctl launch 'iPad Pro 11-inch (M5)' com.prilearning.app --ink-demo
```

Neither does anything unless the argument is passed.

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
