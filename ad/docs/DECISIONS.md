# Decisions log — Pri Learning Instagram ad

Every call made without you, one line of reasoning each. Newest at the bottom.

1. **Repo path** — `<REPO_PATH_OR_URL>` was never replaced in the brief; the working directory *is* the Pri Learning repo, so it is the recon source.
2. **Relationship to the existing reel** — `marketing/reel/` already holds a finished 36.4 s feature-tour reel. The brief asks for a different film (an argument, not a tour), a different duration, and a Remotion toolchain, so this is a new production in `ad/`, not an edit of the old one. The old reel's audio *tooling* (deterministic synth + ElevenLabs VO channel strip/mastering DSP) is reused because it is ours and it is good.
3. **Branch** — built on `marketing/ig-ad-production` off `main`'s tip. The uncommitted `marketing/reel/reel.jsx` edit (someone's in-progress cinematic pass on the old reel) is left untouched and unstaged throughout.
4. **Toolchain** — Remotion 4 (pinned 4.0.226) as specified; its bundled ffmpeg/ffprobe covers the missing system ffmpeg.
5. **Voice-over** — an ElevenLabs key is present (`~/.elevenlabs_key`), so the ad ships with a studio VO cut to the new 30 s beat grid, mixed and mastered with the same DSP chain the launch reel used (90 Hz HP, presence EQ, 3:1 comp, −14 LUFS, −1 dBFS ceiling). Sound-off remains primary; every line is also a burned-in caption.
6. **Market** — the repo's package.json says "Years 7–12 / HSC-style", the shipped reel and posting kit say India/JEE/₹999. The brief specifies the Indian market; the shipped marketing agrees; India it is.
7. **No price in frame** — README says free-by-architecture while the old reel invented ₹999/mo; the two contradict, and this film's argument doesn't need a price. It shows none.
8. **VO voice** — the account's only Indian-accent voice (Riya Rao) is a library voice: HTTP 402 on the free API tier. Shipped with Alice (the same premade educator voice the launch reel used) rather than degrade to macOS TTS. An Indian-English re-voice is a 15-minute change once the account has a suitable voice (`ad/tools/make-vo.mjs --voice <id>`).
9. **Film grain** — per-frame SVG turbulence cost ~×3 render time; replaced with 8 pre-generated deterministic grain PNGs cycling at 2× scale (the shipped reel's grade upscales the same way). Visually identical at 4.5% opacity.
10. **Bundled ffmpeg is slim** — Remotion's ffmpeg refuses image outputs, lavfi and pipes (A/V mp4 work only). Contact sheets and the pixel gates therefore use a pure-Node PNG codec (`ad/scripts/png.mjs`) and Remotion's own `--sequence` rendering; no system ffmpeg was installed.
11. **ESM** — `ad/` switched to `"type": "module"` so the TS gate scripts and the Node tools share one module world; verified Remotion CLI unaffected.
12. **Frame 0 vs loop seam** — the brief wants frame 0 to be the cover AND a loop-safe hand-off from the black last frame. Resolved: frame 0 is special-cased to the fully-set hook line (a single frame at 60 fps is imperceptible in motion), so the cover is strong and the loop reads as the hook re-slamming.
