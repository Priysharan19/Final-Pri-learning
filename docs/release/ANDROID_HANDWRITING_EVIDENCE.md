# Android Handwriting — Evidence and Protocol (CP-09)

**Status:** `SOFTWARE IMPLEMENTATION: COMPLETE` / `PHYSICAL DEVICE VALIDATION: DEFERRED`.
**No Android handwriting-quality claim is made.** iPad PencilKit claims do not transfer to Android.

## Architecture (least duplication)

- Android writes on the **shared web canvas** (`client/src/ink/InkCanvas.jsx`), the same component browsers use. PointerEvents carry `pointerType` (`touch` / `pen`), pressure and coalesced samples.
- Palm rejection is the shared rule. Once a pen has been seen, finger touches do not draw (they scroll) until the student turns on **Finger**.
- Recognition is the shared pipeline: on-device JS, plus the answer-blind cloud reader when switched on. There is **no Kotlin recogniser and no native drawing surface.**
- The shell reports two capability facts, never a model name:
  - `device.stylusCapable`: an input device advertises stylus input. Some panels do with no pen attached.
  - `device.stylusSeen`: a stylus or eraser pointer has actually been seen. `device.facts` answers live.
  - Nothing in the product consumes them yet; they exist for diagnostics and future pen-first defaults.
- **Native-surface escalation rule:** an `androidx.ink` front-buffer surface may be added only if **physical** measurements show the web canvas misses the product's latency or continuity requirements. Without physical evidence, none is built.

## Instrumentation

`client/src/ink/inputMetrics.js` is opt-in. It is enabled by a test, or by `?inkdiag` for research sessions, and it is bounded and coordinate-free. It **cannot cost a stroke**: every entry point swallows its own errors, a malformed global is replaced, and the canvas records metrics only after the stroke is committed. Per stroke it records:
- pointer type;
- events and coalesced samples;
- kept points (for dropped-point checks);
- the largest gap between samples. This includes the writer's own pauses, so it is not by itself a dropped-sample measure.
- input-to-handler delay p50/p95, measured from the oldest coalesced sample in each event. It excludes rendering and display, so it is **not** touch-to-ink latency.
- whether pressure varied (more than 0.05 between minimum and maximum);
- cancels.

It also counts finger touches rejected after a pen. It never records coordinates, points or text (`client/test/ink-input-metrics-check.mjs`).

## Synthetic evidence (S2, emulator)

`android/app/src/androidTest/.../InkInputTest.kt`, run by `android/scripts/run-instrumented.sh` on every product image in `android-shell.yml`. It injects real `MotionEvent`s into the WebView over a practice question's canvas:

| Check | Result on API 36 phone emulator, 2026-10-02 |
|---|---|
| Finger (`TOOL_TYPE_FINGER`) arrives as `pointerType: touch` and draws | ✅ 24/24 samples kept |
| Stylus (`TOOL_TYPE_STYLUS`, pressure 0.35→0.85) arrives as `pen`, pressure varies, and draws | ✅ 24/24 samples kept |
| `device.facts` reports `stylusSeen: false` before and `true` after a stylus event | ✅ |
| After a pen, a finger touch is rejected (palm) and draws nothing | ✅ 1 rejection, no stroke |
| With **Finger** on, a finger stroke is captured, and its ink appears in the band where it was written (when the sheet width is stable) | ✅ |
| Rotation keeps the ink | ✅ |
| The shared recognizer produces a reading of the strokes (`.ink-preview` lines), and submitting it is marked. The injected strokes are not a real answer, so correct, incorrect and unreadable are all honest outcomes. | ✅ |
| No stroke cancelled | ✅ |

**What these numbers do not mean:**
- **Latency:** injected events carry synthetic timestamps. Latency figures from emulator runs, hundreds of milliseconds, measure the injection harness, not the device, and are not evidence of anything.
- **No missing points:** this shows nothing is lost between the WebView and the canvas for injected input. It says nothing about real digitiser sampling.

## Physical protocol (DEFERRED; required before any quality statement)

Use a **debug** build: release builds disable WebView debugging and always load the fixed start page. Enable the metrics with `window.__PRI_INK_METRICS_ENABLED__ = true` (or open the page with `?inkdiag`), read `window.__PRI_INK_METRICS__` through `chrome://inspect`, and record a screen recording on each device:
1. a low-end phone, finger;
2. a Samsung tablet with S Pen;
3. a USI 2.0 stylus tablet;
4. an Android foldable.

Per device, write 20 expressions from the synthetic corpus at natural speed and record:
- touch-to-ink latency from a high-speed camera recording against a 50 ms target, with input-to-handler p50/p95 from the metrics alongside;
- the largest sample gap;
- kept/received points;
- palm-rest behaviour while writing;
- pen → finger transitions;
- behaviour across rotation;
- recognition agreement with the browser JS on the same strokes.

Results are P evidence and are kept separate from iPad PencilKit evidence. Only then may a statement about Android handwriting quality be written, and it must cite these records.
