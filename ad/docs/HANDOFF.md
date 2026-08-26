# HANDOFF — Pri Learning Instagram ad ("The Tangent")

The one you read with coffee. Everything below is honest.

## Outputs (all in `ad/out/`, all verified by `scripts/check.ts` — ALL GATES PASS)

| File | Spec | Size |
|---|---|---|
| **`pri-reel-36-916.mp4`** | **HERO** · 1080×1920 · 36.00 s · 60 fps · H.264 yuv420p (bt709) · ~13 Mbps · AAC 128k 48 kHz · faststart · loop-safe | ~58 MB |
| `pri-reel-36-45.mp4` | 1080×1350 recomposition (re-framed, not cropped) | ~61 MB |
| `pri-reel-36-11.mp4` | 1080×1080 recomposition | ~62 MB |
| `pri-reel-15-916.mp4` | 15.00 s — a real edit (beauty-first order, own audio mix, lock at 7.0 s; deliberately feature-light) | 25.2 MB |
| `cover.png` | Frame 0 — the hook fully set; works standalone | 636 KB |
| `captions.srt` / `captions-15.srt` | VO subtitles (burned captions are already in-film) | — |
| `contact-sheet-30.png` / `-15.png` | A frame every 0.5 s | — |

Posting copy, hooks A/B, feed text, hashtags: [COPY.md](COPY.md).
Rebuild from scratch: [../README.md](../README.md) (fully deterministic; gates re-run).

## The film in one paragraph

One mathematical object carries all 36 seconds — the tangent line. Act I: a
factory stamps formula cards (all real, all correct) until an unseen question
seizes the machine into true silence. Act II: the reveal — the secant sweeps
into tangency and **locks at 12.60 s**, the loudest half-second of the film
(−7.3 dB RMS, measured, against a −47 dB null before the bloom); then the ideal
Pri Learning marks a handwritten proof of that same unseen question. Act III —
**THE INSTRUMENT**: six lit feature panels fly a depth corridor, one crossing
per beat — the 3,44,798 question bank, the knowledge map, misconception
diagnosis in the app's own voice, predicted percentile (disclaimed), Match
Mode, criteria-marked mocks — capped by "All of it offline." Act IV: the
identical tangent motif at five pressures, Class 7 → Olympiad, ending on
"QUESTION 1 · SOLVED". Close: wordmark, "Join the change.", cream CTA. The ad
practises what it preaches — and now also shows the machine that delivers it.

## Final self-grades (four passes + five adversarial judge agents; full log in [CRITIQUE.md](CRITIQUE.md))

hook **8** · typographic craft **8** · motion **8** · cinematography **8** ·
sound design & dynamic range **8** · reveal craft **8.5** · mathematical honesty
**9** · message clarity **8** · restraint **8** · emotional truth **7**.

## The single weakest thing I could not fix

**Emotional truth (7).** This is an object film about an idea — the brief's own
premise (the mathematics is the hero object) means no student's face, no exam
hall, no fear. The most human moment is the ink being written and marked. Within
the premise I believe it lands; but a viewer who needs to *see themselves* will
feel admiration before recognition. A future 45 s version with one real
handwriting shot (a hand, paper texture, pencil sound) would close this.

Second honest caveat: interior UI type in the product panel (~22–29 px at 1080)
is smaller than Apple would ever set; legible on phones, but dense.

## Decisions made on your behalf (full list in [DECISIONS.md](DECISIONS.md))

- **No price in frame** — README says free, the old reel invented ₹999/mo; the
  contradiction is yours to resolve, so the film shows neither.
- **VO is Alice** (the shipped reel's premade educator voice). The account's
  only Indian-accent voice is a library voice → HTTP 402 on the free API tier.
- **Hook accent moved off "memorising"** onto a gold tangent line sweeping
  under the words (judge finding: don't gild the concept you're negating).
- **"Class 7 · SLOPE" relabelled PROPORTION** — slope isn't Class 7 in Indian
  syllabi; "y is always double of x" is honest Class 7 mathematics.
- **Green ✓ chips stay** — green is the product's real marking colour.
- Judged and rejected: early brand monogram (withholding is the design), the
  storyboard's strikethrough beat (two-line set carries it better).

## Fallbacks taken

- Remotion's bundled ffmpeg refuses image outputs/pipes → wrote a pure-Node PNG
  codec (`scripts/png.mjs`) for the pixel gates and contact sheets. No system
  ffmpeg was installed; MP4 remux paths all use the bundled binary.
- Per-frame SVG-turbulence grain tripled render times → 8 pre-generated
  deterministic grain frames cycling at 2× (the shipped reel upscales the same
  way). Visually identical at 4.5 % opacity.

## Feature-act values, for your sign-off

3,44,798 is the repo's measured figure (the one the shipped marketing quotes).
The percentile (96.4) and the Match rivals (Ishaan, Kabir) are **illustrative**
and labelled so in-frame, with the launch reel's own disclaimer on the
percentile panel. If you'd rather not show a percentile at all, deleting
`PercCard` from `src/scenes/Instrument.tsx`'s FACES list and re-rendering is a
five-minute change (the corridor re-paces itself off PANEL_CROSSINGS).

## Three highest-leverage 15-minute changes

1. **Re-voice in Indian English** the moment the ElevenLabs account has a
   premade/owned Indian voice: `node ad/tools/make-vo.mjs --voice <id>` then
   `node ad/scripts/render-all.mjs`. Everything else is untouched.
2. **A/B the hook**: variants B ("One idea beats four hundred formulas.") and C
   ("You are not a rank.") are one string in `src/data/timeline.ts` +
   `src/scenes/Hook.tsx` away; the beat grid already fits them.
3. **Post the 4:5 to feed with its own first-frame**: `npx remotion still
   Feed45 out/cover-45.png --frame=0` — 10 seconds, better feed presentation.
   (A 45 s "director's cut" that lets each Instrument panel breathe is the
   natural next version — the corridor is fully data-driven.)

## Repo state notes (important)

- Work is on `marketing/ig-ad-production`, merged to `main` via PR. Build
  artifacts (`out/*.mp4`, frames) are gitignored per repo convention — the
  files above live on this machine at `ad/out/`.
- `marketing/reel/reel.jsx` still carries the **uncommitted** cinematic-pass
  edit (+95/−16) from the older reel workstream — untouched by me, still in
  the working tree. Commit it on `marketing/reel-cinematic-pass` when ready.
- Untracked Finder-duplicate files (`* 2.py`, `* 2.mjs`, `* 2.sh` in scripts/
  and tools/ink-foundation/) predate this session and were left alone.
