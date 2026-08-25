# Pri Learning — launch reel

The Instagram/Reels launch video for Pri Learning: 9:16, 4K (2160 × 3840), 36.4 s,
11 scenes from hook to "Coming soon". It is a real-time web composition — one React
tree rendered as a pure function of the timeline — so every frame is deterministic
and the piece exports frame-perfectly.

Canonical design source: the "Pri Learning Instagram Reel" project on claude.ai/design
(these files are kept in sync with it; the canvas is where the video export dialog lives).

## Files

| File | Role |
|---|---|
| `index.html` | Production shell — scene list (`OM_SCENES`), playback mode, frame chrome, sound-arm button |
| `reel.jsx` | The whole reel: 11 sections, captions, audio rig (music sync + speech-synthesis VO) |
| `animations-v3.jsx` | Composition engine (timeline, cues, easing, export protocol) — generated scaffold, don't hand-edit |
| `support.js` | dc-runtime — boots React 18 + Babel from CDN and mounts the `<x-dc>` document — generated, don't edit |
| `assets/music.wav` | Soundtrack, 36.4 s, VO ducking baked in |
| `tools/make-music.mjs` | Deterministic zero-dependency synth that renders `assets/music.wav` to the cue map |
| `tools/serve.mjs` | Static server (port 4174) that also accepts the export harness's MP4 upload |
| `tools/frame.html` | Bare stage page (native 2160×3840, no chrome) for frame capture |
| `tools/render-frames.mjs` | Zero-dependency headless-Chrome CDP driver — seeks the timeline frame by frame and captures 4K JPEGs |
| `tools/export.html` | WebCodecs encoder — H.264 + AAC muxed to MP4, written to `export/` |

## Preview

Serve the folder over HTTP (the runtime fetches the `.jsx` files, so `file://` won't work):

```bash
python3 -m http.server 4173 -d marketing/reel
```

Then open http://localhost:4173. Space toggles play/pause, ←/→ scrub, 0 returns to
start. Click "Enable sound" once — browsers require a gesture before audio — and the
music and voice-over follow the timeline from then on.

Sound in the browser preview is two layers: `assets/music.wav` (timeline-synced) and
live speech-synthesis voice-over (an en-IN voice when the OS has one). The exported
video muxes the music track; record studio VO separately for the final master if the
platform needs burned-in voice.

## Export

Two ways to get the MP4; both are frame-exact because everything on screen is a
pure function of the timeline (no wall-clock CSS transitions).

**Claude Design canvas** — the stage advertises the export protocol (duration,
seek, font inlining), so the host dialog renders it frame by frame at the
resolution you pick.

**Local, no canvas needed** — a two-pass pipeline (Chromium taints canvases for
any foreignObject SVG, so frames are captured from headless Chrome's compositor,
then encoded with WebCodecs):

```bash
node marketing/reel/tools/serve.mjs
```

```bash
node marketing/reel/tools/render-frames.mjs --fps 30
```

Then open http://localhost:4174/tools/export.html — it encodes the frames plus
`assets/music.wav` (H.264 + AAC) and writes `export/pri-reel-2160x3840-30fps.mp4`.
Frames and MP4s under `export/` are build artifacts and gitignored.

## Editing rules

- `OM_SCENES` in `index.html` is the single source of structure — names, order,
  durations. Choreography keys off `CUES.<Name>`; retiming a scene retimes its motion.
- Key everything to `T` (authored seconds from `useComposition()`), never to
  wall-clock time, CSS transitions, or `requestAnimationFrame` — those export stale.
- The loop seam is authored: first and last frames are both full black.

## Regenerating the soundtrack

```bash
node marketing/reel/tools/make-music.mjs
```

Deterministic output (seeded synth). If you retime `OM_SCENES`, update the `CUE`
table at the top of the script to the new running starts first.
