# iOS source of truth

`PriLearning.swiftpm/` is the **only authoritative native iPad package** in this repository.

The repository previously contained `PriLearning 2.swiftpm/` with the exact same Git tree as `PriLearning.swiftpm/`, plus a checked-in `PriLearning.swiftpm.zip`. Neither was referenced by the iOS bundle sync (`scripts/sync-ios.mjs`) or the native simulator runner (`scripts/ink-native-check.mjs`); both tools explicitly target `ios/PriLearning.swiftpm/`.

Those duplicate copies were removed during the Native Ink V9 sprint so Swift/PencilKit/Vision changes have one source of truth. If a distributable archive is needed, create it from the canonical package at release time rather than committing a second independently drifting implementation.

## Physical iPad input validation

The native Pencil surface is a sibling overlay above the embedded `WKWebView`, but its frame is constrained to the visible handwriting rectangle only. Empty transparent native space is passthrough, so buttons and navigation outside the writing area remain owned by the web app. Inside the writing area, `PKCanvasView` is explicitly `.pencilOnly` by default; optional finger-drawing mode switches it to `.anyInput`.

Before copying the package to Swift Playgrounds, run `npm run build && npm run sync:ios` so `PriLearning.swiftpm/Resources/Web/` matches the current client. CI gates this with `npm run check:ios`.

For a physical iPad smoke test, verify in this order:

1. finger taps work on navigation, toolbar and question controls;
2. finger scrolling works normally outside the writing surface;
3. Apple Pencil draws immediately inside the handwriting rectangle;
4. rapid consecutive Pencil strokes do not freeze controls or wait for recognition;
5. leaving the question unmounts the native writing overlay, after which no invisible view can intercept input.

The simulator can verify geometry, routing policy and native recognition regressions, but it cannot certify physical Apple Pencil touch-to-photon latency. That final performance claim requires a real iPad and Pencil.
