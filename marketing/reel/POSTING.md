# Posting kit — Pri Learning launch reel

Everything needed to take the exported MP4 live on Instagram Reels (and reuse on
YouTube Shorts / Facebook Reels).

## Upload spec

| Field | Value |
|---|---|
| Format | MP4, H.264 + AAC |
| Aspect / size | 9:16 — export at 2160 × 3840, Instagram serves 1080 × 1920 |
| Length | 36.4 s |
| Frame rate | 30 or 60 fps (either is fine; the piece is deterministic per frame) |
| Audio | Music track muxed from `assets/music.wav` (VO ducking baked in) |
| Cover frame | **34.5 s** — logo lockup + "Coming soon" badge, before the fade |

Safe areas are already authored in: captions and CTAs sit above the bottom ~22%
(Instagram's caption/actions overlay) and clear of the right-side icon rail, and the
first/last frames are black so the loop is seamless.

## Caption (ready to paste)

> What if your handwriting marked itself? ✍️
>
> Write a real JEE Advanced integral on your iPad — Pri Learning reads every symbol
> live and marks it step by step, like a real examiner. M1 · M1 · A1 · full marks.
>
> 3,44,798 exam-style questions · every topic mapped · predicted percentile · Match
> Mode races · full mock papers. All offline. ₹999/month.
>
> Coming soon — follow @pri.learning for launch. 🔔

## Hashtags

`#JEE2027 #JEEAdvanced #JEEMain #IITJEE #Olympiad #MathsTricks #Class11 #Class12
#NCERT #JEEpreparation #iPad #ApplePencil #StudyGram #EdTech #ComingSoon`

(Use 5–10; lead with #JEEAdvanced #IITJEE #JEEpreparation.)

## Alt text

> Dark cinematic reel: a calculus integral is handwritten on an iPad, marked step by
> step with examiner-style ticks, followed by a question counter, syllabus map,
> predicted percentile, a race between students, a mock paper, a feature montage,
> and pricing — ₹999 a month — ending on the Pri Learning logo and "Coming soon".

## Voice-over

The browser preview speaks the VO with the OS speech engine (en-IN voice when
available) — that layer is **not** in the exported file. For the commercial master,
record the 11 lines in `reel.jsx` (`AudioRig` → `VO`) with a studio/AI voice and lay
them over the export at each line's cue; the music already ducks under every line.

## Claims checklist (already in the video)

- Percentile scene carries "Estimate from your practice data — not a guarantee of results."
- Price scene carries "Savings vs a typical big-brand two-year JEE classroom programme."
- Student names and scores in Match Mode are illustrative.
