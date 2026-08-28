# Posting kit — "Five things Pri does" carousel

Seven-slide Instagram carousel covering the five headline features: AI handwriting
recognition, examiner-style instant marking, every level from boards to JEE Advanced,
all of Class 7–12, and an unlimited question bank.

Register follows `ad/docs/COPY.md`: Indian English, dry and confident, no exclamation
marks, no shame hooks. Design system is `client/src/theme.css` v4 "Dark LaTeX", same as
the reel and the A2Z poster.

## Build

```bash
node marketing/feature-carousel/build.mjs && node marketing/feature-carousel/render.mjs
```

`build.mjs` emits `slides/*.html` + `preview.html`; `render.mjs` shoots `out/*.png` at
2160×2700 (2×) using the Chromium already installed for the client's Playwright.
**Edit `build.mjs`, never the generated HTML.**

## Upload spec

| Field | Value |
|---|---|
| Format | PNG carousel, 7 slides, in filename order |
| Aspect / size | 4:5 — exported 2160×2700, Instagram serves 1080×1350 |
| Cover | `01-cover.png` |
| Reusable as | Facebook carousel, LinkedIn document post (same order) |

Safe areas: all type sits inside a 88px margin at 1080 scale, and the footer rule clears
the bottom ~6%, so nothing collides with Instagram's caption gradient.

## Slides

| # | File | Says |
|---|---|---|
| 1 | `01-cover` | Write the maths. It marks the maths. |
| 2 | `02-recognition` | **AI recognition** — on-device CNN, 56 symbols, 98.4% chars |
| 3 | `03-marking` | **Instant feedback** — ✓/✗ on your own ink, method marks, misconception named |
| 4 | `04-levels` | **Every level** — CBSE, JEE Main, JEE Advanced, Olympiad |
| 5 | `05-syllabus` | **Every class** — 7 to 12, 252/252 dot points covered |
| 6 | `06-unlimited` | **Unlimited** — 344,798 distinct questions, no cell a short loop |
| 7 | `07-cta` | Join the change · @pri.learning · coming soon |

## Caption (ready to paste)

> Five things Pri does that a formula sheet cannot.
>
> **1 · It reads your handwriting.** A convolutional net ships inside the app — 597 kB of
> weights running on the iPad itself. Fractions, roots, exponents, multi-line working. No
> network, no upload, no account. It learns your hand.
>
> **2 · It marks like an examiner, instantly.** ✓ and ✗ land on your own ink, line by line.
> Method marks where the reasoning holds even when the final answer does not — and the
> exact line where the maths breaks, with the misconception named. Not "62%". "You keep
> flipping the sign."
>
> **3 · Boards to JEE Advanced.** Four tracks over the same mathematics — CBSE/NCERT, JEE
> Main, JEE Advanced, Olympiad (PRMO → RMO → INMO). What separates them is not the chapter
> list. It is the pressure.
>
> **4 · Class 7 to Class 12, all of it.** Every NCERT chapter broken into the syllabus
> lines it teaches, each with a generator behind it and a square on your skill map.
>
> **5 · The bank does not run out.** Questions are built from a seed, not drawn from a
> pool. 3,44,798 distinct questions counted, and no chapter-difficulty cell is a short
> loop. Premium is unlimited: every track, every class, no cap.
>
> Join the change. Follow @pri.learning — coming soon. 🔔

**Short variant** (if the long one is too much for the feed):

> Five things Pri does that a formula sheet cannot: reads your handwriting on-device,
> marks your working line by line like an examiner, covers boards to JEE Advanced, maps
> all of Class 7–12, and never runs out of questions. Join the change. Follow
> @pri.learning — coming soon.

## Hashtags (7 — not spam)

`#JEEAdvanced #IITJEE #JEEpreparation #Class12 #NCERT #ApplePencil #PriLearning`

Lead with the first three. Swap `#Class12` → `#Class10` if you post this in board season.

## Alt text

> A seven-slide carousel on near-black paper set in Computer Modern. Slide 1: "Write the
> maths. It marks the maths." Slide 2: on-device handwriting recognition, a strip of the
> 56 symbols it reads, 98.4% character accuracy. Slide 3: handwritten quadratic working
> marked line by line with green ticks, a red cross on the last line and a margin note
> naming the sign error. Slide 4: four tracks — CBSE, JEE Main, JEE Advanced, Olympiad.
> Slide 5: Class 7 to 12 in a grid, 252 of 252 syllabus dot points covered. Slide 6:
> 344,798 distinct questions observed. Slide 7: Pri Learning, Join the change, follow
> @pri.learning, coming soon.

## Claims checklist

Every number on a slide, with the command that produced it. Re-run before reposting —
these move whenever a generator or the model changes, and a date has never once caught a
stale figure (README, "Measured accuracy").

| Slide | Claim | Source |
|---|---|---|
| 2 | 597 kB of int8 weights, on device | `client/src/ink/model-data.js`; README "The handwriting engine" |
| 2 | 56 symbols | the `classes` array in `model-data.js` — exactly 56. **The glyph strip only shows classes that are actually in it** (no ∫, no ×) |
| 2 | 98.4% chars · 94.5% lines | `node client/test/inkcheck-holdout2.mjs 40` — 40 simulated writers × 14 lines = 560 |
| 2 | footnote: simulated writers, worst hand 71% | same run. **This is not a human trial** and the slide says so; do not drop that line |
| 3 | 795 / 795 mistakes named | `npm run test:diagnose` — 20 mistakes × 40 seeded draws, buried in random context |
| 3 | the worked example | Class 10 completing-the-square with a sign slip. Every glyph in it is one the shipped net has a class for |
| 4 | four tracks, difficulty ceilings | `IN_TRACKS` in `client/src/engine/curriculum-in.js` |
| 4 | percentile disclaimer | required — carried in the reel too |
| 5 | 252 / 252 · 220 exact · 0 empty | `node tools/dotpoint-coverage.mjs` |
| 5 | Class 7–12 captions | `IN_CURRICULUM` in `curriculum-in.js`, verbatim |
| 6 | 344,798 distinct · thinnest cell 54 · 0 single-question cells | `node tools/count-questions.mjs` (client registry row — **not** the 365,333 server row) |

### One claim that is a plan, not a measurement

Slide 6 says **"Premium is unlimited: every track, every class, no cap."** The shipped app
has no tiers at all — `client/src/pages/Settings.jsx` reads "Everything unlocked — no
account, no subscription, no limits", and the README's feature matrix says the same. So
this is launch pricing (the reel already markets ₹999/month), not a description of what
runs today. It is honest as a forward-looking statement about the paid tier and dishonest
if read as "the free tier is capped" — there is no free tier yet. If you would rather not
carry a pre-launch claim at all, the drop-in replacement for that sentence is:

> Unlimited today, unlimited on premium: every track, every class, no cap.
