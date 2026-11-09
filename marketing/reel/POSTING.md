# Posting kit — Pri Learning launch reel

**Status: not postable until re-rendered and re-voiced.** The copy in `reel.jsx` and
`index.html` was revised on 2 November 2026 under owner decision D24 (none of the retired
coverage, accuracy, price-comparison, connectivity, rank-prediction or marking-authority
claims, no track outside V1, and the approved ₹199 / ₹1,499 prices). The recorded
voice-over in `assets/vo-mix.wav` and any exported MP4 still carry the old lines and must be
regenerated (`tools/make-vo.mjs` / `tools/make-vo-mix.mjs`, then
`tools/render-frames.mjs`) before anything is uploaded. Nothing from this kit has been posted.

`client/test/marketing-claims-check.mjs` fails CI if a retired phrase comes back into the
reel sources or this file.

## Upload spec

| Field | Value |
|---|---|
| Format | MP4, H.264 + AAC |
| Aspect / size | 9:16 — export at 2160 × 3840, Instagram serves 1080 × 1920 |
| Length | 36.4 s |
| Frame rate | 30 or 60 fps (the piece is deterministic per frame) |
| Audio | Full soundtrack muxed from `assets/vo-mix.wav` — music bed + VO, mastered to −14 LUFS, −1 dBFS peak, AAC 256 kbps |
| Cover frame | **34.5 s** — logo lockup + "Coming soon" badge, before the fade |

Safe areas are authored in: captions and CTAs sit above the bottom ~22% and clear of the
right-side icon rail; the first and last frames are black so the loop is seamless.

## Caption (ready to paste once the render is current)

> What if your handwriting marked itself? ✍️
>
> Write a JEE Advanced integral on your iPad. When you are online, Pri’s server reads the ink
> and Pri’s own engine marks the final answer — then shows every step of the solution. Marking
> is automatic and can be wrong.
>
> Maths practice for CBSE / NCERT Classes 7 to 12, JEE Main and JEE Advanced. 77 chapters,
> generated questions with fresh numbers, timed papers. No rank is predicted.
>
> Free: 20 questions a day. Premium: ₹199 a month or ₹1,499 a year.
>
> Not endorsed by NCERT, CBSE or the NTA. Coming soon — follow @pri.learning. 🔔

## Hashtags

`#JEE2027 #JEEAdvanced #JEEMain #IITJEE #Class11 #Class12 #NCERT #JEEpreparation #iPad
#ApplePencil #StudyGram #EdTech #ComingSoon`

(Use 5–10; lead with #JEEAdvanced #IITJEE #JEEpreparation.)

## Alt text

> Dark cinematic reel: a calculus integral is handwritten on an iPad and marked automatically,
> followed by a chapter counter, a syllabus map, a chapters-practised card, a race between
> students, a timed paper, a feature montage, and pricing — free at 20 questions a day, Premium
> at ₹199 a month — ending on the Pri Learning logo and "Coming soon".

## Voice-over

The 11 lines live in `reel.jsx` (`VO` in `AudioRig`). They are rendered with a studio voice
and mixed over the ducked bed by `tools/make-vo-mix.mjs`. After any copy change, regenerate the
takes, re-run the mix, then re-export — the current `assets/vo-mix.wav` predates the November
2026 revision.

## Claims checklist (in the video)

- Chapters-practised card: "Pri shows what you have practised. It does not predict a rank."
- Price scene: free and Premium only; no comparison with coaching.
- Toolkit scene: "needs an account and a connection".
- Student names and scores in Match Mode are illustrative.
- No scene names a question count, an accuracy figure, a rank prediction, a track outside V1, or use without a connection.
