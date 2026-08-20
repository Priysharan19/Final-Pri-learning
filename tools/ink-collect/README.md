# Ink Collector

A standalone capture tool for building a **real handwriting corpus**.

## Why this exists

Every accuracy figure this project quotes is measured on ink the repo generated
itself. Synthetic strokes carry the same assumptions the recogniser was built on,
so those numbers prove the engine is internally consistent, not that it can read a
Year 9 student's handwriting on a Tuesday afternoon.

This tool closes that gap. It captures real Pencil strokes in exactly the shape
`recognize()` consumes, so a corpus recorded here scores directly, no conversion.

## Recording a corpus

1. Open `tools/ink-collect/index.html` on the iPad in Safari.
   (AirDrop the file, or serve the folder over the local network.)
2. Write each of the 60 prompts once, with the Apple Pencil.
   **Write naturally.** Do not be neat for the computer — messy ink is the point.
   Skipping a prompt is fine; a skipped prompt is simply not recorded.
3. Tap **Save corpus file** at the end.
4. Put the file in `client/test/ink-corpus/`.
5. Run `npm run test:real`.

## What the prompts cover

All ten digits, every letter the recogniser supports (a b c d e k m n r s t u v x
y z), π and θ, decimals, negatives, both fraction forms, powers, roots, the
comparison family (< > ≤ ≥ ≠), percent, degrees, ratios, ±, brackets, and the
trig/log function names. 60 prompts, no duplicates.

Two conventions were verified against the engine and are baked into the expected
answers: `×` is read as `*`, and a stacked mixed number reads as `2(1)/(2)`.

## Getting an honest number out of it

- **Eight or more writers** before the figure is quotable. One or two hands
  measures those hands, not the engine — the suite warns below five.
- **Different hands, deliberately.** Left-handed, heavy slant, tiny writing,
  someone in a hurry, a shaky hand. The worst-writer number matters more than the
  mean: a student whose hand the engine cannot read does not care about the average.
- **Finger-written corpora are kept but reported separately.**
- **Hold one back.** Record a corpus and do not look at its failures — the same
  discipline `inkcheck-holdout2.mjs` exists to enforce.

## Do not tune against the corpus

The moment you fix the recogniser by reading this set's failures, this set stops
being evidence. Record more ink instead, and keep the untouched set for the
honest number.
