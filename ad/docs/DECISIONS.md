# Decisions log — Pri Learning Instagram ad

Every call made without you, one line of reasoning each. Newest at the bottom.

1. **Repo path** — `<REPO_PATH_OR_URL>` was never replaced in the brief; the working directory *is* the Pri Learning repo, so it is the recon source.
2. **Relationship to the existing reel** — `marketing/reel/` already holds a finished 36.4 s feature-tour reel. The brief asks for a different film (an argument, not a tour), a different duration, and a Remotion toolchain, so this is a new production in `ad/`, not an edit of the old one. The old reel's audio *tooling* (deterministic synth + ElevenLabs VO channel strip/mastering DSP) is reused because it is ours and it is good.
3. **Branch** — built on `marketing/ig-ad-production` off `main`'s tip. The uncommitted `marketing/reel/reel.jsx` edit (someone's in-progress cinematic pass on the old reel) is left untouched and unstaged throughout.
4. **Toolchain** — Remotion 4 (pinned 4.0.226) as specified; its bundled ffmpeg/ffprobe covers the missing system ffmpeg.
5. **Voice-over** — an ElevenLabs key is present (`~/.elevenlabs_key`), so the ad ships with a studio VO cut to the new 30 s beat grid, mixed and mastered with the same DSP chain the launch reel used (90 Hz HP, presence EQ, 3:1 comp, −14 LUFS, −1 dBFS ceiling). Sound-off remains primary; every line is also a burned-in caption.
6. **Market** — the repo's package.json says "Years 7–12 / HSC-style", the shipped reel and posting kit say India/JEE/₹999. The brief specifies the Indian market; the shipped marketing agrees; India it is.
