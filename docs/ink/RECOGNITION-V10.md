# PRI Native Ink V10 — recognition architecture

This document records the production recognition direction and prevents future work from collapsing back into benchmark-specific OCR substitutions.

## Evidence-backed design

1. **Keep raw online ink.** Pencil coordinates, time, force and orientation are first-class evidence. Do not rasterize and discard them.
2. **Use multiple independent hypothesis sources.** Apple Vision is the always-available image hypothesis engine. Pencil geometry supplies deterministic structural evidence. A stroke-native recognizer may supply additional hypotheses when configured.
3. **Keep maths two-dimensional.** Trace-to-symbol ownership, baseline, superscript/subscript, fraction membership, radical span and spatial relations are resolved before final expression assembly.
4. **Delay commitment.** Candidate alternatives survive until maths grammar and global structure can score them.
5. **Calibrate uncertainty.** A disagreement between engines or weak structural ownership lowers confidence; it must not be hidden by a syntactically convenient rewrite.
6. **Offline first.** Network recognition is optional rescue/ensemble evidence. Loss of network or credentials must never stop writing or local recognition.
7. **No client secrets.** Mathpix `app_key` is server-only. The app may receive only short-lived `app_token` / `strokes_session_id` credentials.
8. **Writer-separated evidence.** Development, validation and final holdout are split by writer. Synthetic fixtures are regression tests, not production-accuracy evidence.

## Current engines

### Apple Vision
Always available on the supported iOS target. It remains useful for candidate generation from normalized rasters, but ordinary OCR is not treated as a mathematical parser or as ground truth.

### PRI geometry + structural decoder
Uses the original Pencil traces to recover evidence that raster OCR loses: crossings, closed loops, stroke direction, fractions, superscripts, brackets, equals signs, baseline and trace ownership. The final decoder scores mathematical structure and preserves ambiguity.

### Mathpix strokes (optional)
`OnlineInkRecognizer.swift` implements the raw-stroke client boundary. The endpoint consumes x/y arrays directly and can return text/LaTeX/confidence. Production activation requires a PRI backend route that brokers short-lived Mathpix app tokens. The app key must never be committed or embedded in the binary.

### Google ML Kit Digital Ink
Researched but deliberately not added to the current Swift Playgrounds package. Google's current iOS distribution documentation states ML Kit is CocoaPods-only, while this application is an Apple Swift Package / Swift Playgrounds iOSApplication. Introducing a parallel CocoaPods/Xcode project solely for this engine would break the present package architecture. Re-evaluate if Google ships Swift Package Manager support or PRI moves to an Xcode workspace.

## Evaluation gates

Report these separately:

- native synthetic character accuracy
- native synthetic expression exact match
- writer-separated real-Pencil character/symbol accuracy
- writer-separated expression exact match
- fraction/superscript/ambiguous-symbol accuracy
- false-confidence rate
- local recognition latency distribution (p50/p95/p99)
- optional remote rescue latency and incremental accuracy
- physical Pencil latency/feel (human/device evidence only)

A 10/10 synthetic fixture is not evidence of 100% production recognition.

## Primary references reviewed 2026-08-21

- Apple Vision `VNRecognizeTextRequest` documentation
- Mathpix `/v3/strokes` and authentication/app-token documentation
- Google ML Kit iOS migration/distribution and Digital Ink guidance
- Seitz, Lengfeld & Timofte, *The Return of Structural Handwritten Mathematical Expression Recognition* (2025)

The common conclusion is architectural: online handwriting recognition benefits from retaining traces and explicit spatial structure rather than flattening handwriting into a bitmap/string too early.
