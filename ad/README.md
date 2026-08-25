# Pri Learning — Instagram ad ("The Tangent")

A 36 s launch-film-grade Instagram ad, built as code (Remotion 4 + React +
TypeScript), plus a real 15 s edit, in the product's own **Dark LaTeX** design
language. One idea carries the whole film: the tangent line — memorised in the factory,
understood at the lock, backed by the feature run ("The Instrument"), scaled
Class 7 → Olympiad, offered as an invitation. Creative rationale: [docs/INTERPRETATION.md](docs/INTERPRETATION.md);
frame-accurate board: [docs/STORYBOARD.md](docs/STORYBOARD.md).

## Deliverables (in `out/`, gitignored build artifacts)

| File | What |
|---|---|
| `pri-reel-36-916.mp4` | **Hero** — 1080×1920, 36 s, 60 fps, H.264 yuv420p, AAC 128k 48 kHz, faststart |
| `pri-reel-36-45.mp4` / `pri-reel-36-11.mp4` | 4:5 and 1:1 recompositions (re-framed, not cropped) |
| `pri-reel-15-916.mp4` | 15 s cut — its own edit on its own audio mix |
| `cover.png` | Frame 0 — works as the IG cover |
| `captions.srt` / `captions-15.srt` | VO captions (burned captions are in-film) |
| `contact-sheet-30.png` / `-15.png` | A frame every 0.5 s, for review |

## Rebuild everything

```bash
npm install                                   # in ad/
node scripts/gen-grain.mjs                    # film grain frames (deterministic)
node tools/make-audio.mjs                     # score + SFX beds (deterministic synth)
node tools/make-vo.mjs --voice Xb7hH8MSUJpSbSDYk0k2   # ElevenLabs VO → mastered mixes (−14 LUFS)
node scripts/render-all.mjs                   # all four MP4s + cover + SRT
npx tsx scripts/check.ts                      # quality gates — run, don't claim
node scripts/contact-sheet.mjs                # review sheets
node scripts/audio-profile.mjs                # RMS proof of the dynamic-range moment
```

Without an ElevenLabs key the VO tool falls back to macOS TTS; without either,
`make-audio.mjs` already leaves a music-only soundtrack in place — the film is
designed sound-off-first (every spoken line is a designed burned caption).

## The gates (`scripts/check.ts`)

1. Every TeX expression compiles; every equation is verified numerically.
2. Text beats >4 words hold ≥1.2 s; all cuts land on the beat grid.
3. ffprobe: codec/fps/duration/bitrate/pix_fmt/audio per spec; moov leads.
4. IG safe zones: every text box (pixel-linted via debug renders) clears the
   top-250/bottom-420/side-90 zones — including under the virtual camera's zoom.
5. Contrast ≥ 4.5:1, sampled per text beat from the real frames.
6. Determinism: the same frame renders byte-identical twice.
7. Zero React warnings in the render log.

## Structure

- `src/data/timeline.ts` — the single source of truth (scenes, text beats, VO).
- `src/design/tokens.ts` — palette/type/motion from the app's `theme.css` (see docs/BRAND.md).
- `src/lib/` — the film system: virtual camera (`Stage`), grade (`Film`), type, KaTeX, plots.
- `src/scenes/` — one file per shot; `src/compositions/` — the 30 s assembly + the 15 s edit.
- `tools/` — deterministic score synth + ElevenLabs VO chain (−14 LUFS master).
- `docs/` — BRAND · INTERPRETATION · STORYBOARD · COPY · DECISIONS · CRITIQUE · HANDOFF.
