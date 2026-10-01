# Android Handwriting — Evidence and Protocol (CP-09)

**Status:** `SOFTWARE IMPLEMENTATION: COMPLETE` / `PHYSICAL DEVICE VALIDATION: DEFERRED`.
**No Android handwriting-quality claim is made.** iPad PencilKit claims do not transfer to Android.

## Architecture (least duplication)

- Android writes on the **shared web canvas** (`client/src/ink/InkCanvas.jsx`), the same component browsers use. PointerEvents carry `pointerType` (`touch` / `pen`), pressure and coalesced samples.
- Palm rejection is the shared rule. Once a pen has been seen, finger touches do not draw (they scroll) until the student turns on **Finger**.
- Recognition is the shared pipeline: on-device JS, plus the answer-blind cloud reader when switched on. There is **no Kotlin recogniser and no native drawing surface.**
- The shell reports `device.stylusSeen` as a capability fact: true when a stylus input device exists or a stylus/eraser pointer has been seen. `device.facts` answers live; never a model name.
- **Native-surface escalation rule:** an `androidx.ink` front-buffer surface may be added only if **physical** measurements show the web canvas misses the product's latency or continuity requirements. Without physical evidence, none is built.

## Instrumentation

`client/src/ink/inputMetrics.js` is opt-in. It is enabled by a test, or by `?inkdiag` for research sessions, and it is bounded and coordinate-free. Per stroke it records:
- pointer type;
- events and coalesced samples;
- kept points (for dropped-point checks);
- the largest gap between samples;
- delivery latency p50/p95 (`now − event.timeStamp`);
- whether pressure varied;
- cancels.

It also counts finger touches rejected after a pen. It never records coordinates, points or text (`client/test/ink-input-metrics-check.mjs`).

## Synthetic evidence (S2, emulator)

`android/app/src/androidTest/.../InkInputTest.kt`, run by `android/scripts/run-instrumented.sh` on every product image in `android-shell.yml`. It injects real `MotionEvent`s into the WebView over a practice question's canvas:

| Check | Result on API 36 phone emulator, 2026-10-02 |
|---|---|
| Finger (`TOOL_TYPE_FINGER`) arrives as `pointerType: touch` and draws | ✅ 24/24 samples kept |
| Stylus (`TOOL_TYPE_STYLUS`, pressure 0.35→0.85) arrives as `pen` with pressure and draws | ✅ 24/24 samples kept |
| `device.facts` reports `stylusSeen: true` after a stylus event | ✅ |
| After a pen, a finger touch is rejected (palm) and draws nothing | ✅ 1 rejection, no stroke |
| With **Finger** on, a finger writes again | ✅ |
| Rotation keeps the ink | ✅ |
| The shared recognizer reads the handwriting and the attempt is marked | ✅ |
| No stroke cancelled | ✅ |

**What these numbers do not mean:**
- **Latency:** injected events carry synthetic timestamps. Latency figures from emulator runs, hundreds of milliseconds, measure the injection harness, not the device, and are not evidence of anything.
- **No missing points:** this shows nothing is lost between the WebView and the canvas for injected input. It says nothing about real digitiser sampling.

## Physical protocol (DEFERRED; required before any quality statement)

Run with `?inkdiag` and record the metrics plus a screen recording on each device:
1. a low-end phone, finger;
2. a Samsung tablet with S Pen;
3. a USI 2.0 stylus tablet;
4. an Android foldable.

Per device, write 20 expressions from the synthetic corpus at natural speed and record:
- latency p50/p95 against a 50 ms target;
- the largest sample gap;
- kept/received points;
- palm-rest behaviour while writing;
- pen → finger transitions;
- behaviour across rotation;
- recognition agreement with the browser JS on the same strokes.

Results are P evidence and are kept separate from iPad PencilKit evidence. Only then may a statement about Android handwriting quality be written, and it must cite these records.
