# BRAND.md — Pri Learning, as evidenced by the repo

Source of truth: `client/src/theme.css` (1,157 lines, self-titled **"Design system v4 — Dark LaTeX"**:
"near-black paper, Computer Modern serif everywhere (KaTeX fonts, already bundled), ivory ink, cream
primary actions, gold accents, 1px hairlines, small-caps labels. Light mode = the same paper, printed.")
No Tailwind — hand-written CSS variables. Everything below is measured from the repo, not invented.

## Palette (dark theme — the film's world)

| Role | Token | Hex |
|---|---|---|
| Page (the paper) | `--page` | `#0a0a09` |
| Surface / 2 / 3 | `--surface…` | `#101010` / `#161615` / `#1d1d1b` |
| Ink (primary text) | `--ink` | `#efece1` |
| Ink secondary / muted | `--ink-2/3` | `#b3afa2` / `#7c796d` |
| Cream (primary action) | `--cream` | `#f4f1e0` (text-on-cream `#131310`) |
| **Gold (the accent)** | `--gold` | `#c9ad63` (bright `#e3c87e`) |
| Success | `--good` | `#5aa86c` |
| Error | `--bad` | `#cf5f56` |
| Hairline | — | `rgba(240,236,224,0.13)` (strong 0.24 / faint 0.07) |

The film is near-monochrome (paper + ivory) plus **one accent: gold**. Green appears only as the
marking engine's ✓ (it is product UI, not decoration). Cream is reserved for the primary action
(the CTA) exactly as in the app. The uncommitted reel pass introduced a cyan `#7fd8cf`; this film
does not use it — restraint is the flex, and cyan is not in `theme.css`.

## Type

- **Everything is Computer Modern** — the KaTeX font family, bundled from the `katex` npm package:
  `'KaTeX_Main', 'Latin Modern Roman', Georgia, 'Times New Roman', serif`. The app sets its whole UI
  in it; so does the film. Real maths is KaTeX-rendered, never faked with unicode.
- Wordmark: blackboard-bold **ℙ** set in `KaTeX_AMS` + "ri Learning." in the serif (`client/src/App.jsx`).
- Handwriting: **Caveat** (the shipped reel's hand; Google Fonts) — used only for ink the "student" writes.
- Signature label style: 11.5px-at-app-scale uppercase, letterspaced **0.18em**, muted ink; kicker 0.32em.
  The film uses these labels for scene kickers ("THE FACTORY", "CLASS 12 · DERIVATIVES").

### Film modular scale (1080×1920 master; ratio 1.333, base 36)
`36 · 48 · 64 · 85 · 113 · 151 · 201` px. Captions 40–44. Display type is set tight
(line-height 1.02–1.08, letter-spacing −0.5 to −1.5px at display sizes — Computer Modern needs
negative tracking above ~100px). Small-caps labels +0.18em, always.

## Spacing · radii · surfaces

- Radii are small and square-ish: **6px** cards, **3px** controls. Nothing rounder.
- Cards are `surface` + **1px hairline** — resting cards carry **no shadow** in the app; in the film,
  UI panels get depth from *light* (soft key + rim + contact shadow), not from decorative glows.
- Spacing rhythm at app scale: 20px card padding, 16px grid gap. Film equivalents: ×2.5 at 1080 wide.

## Motion physics (from the app + film discipline)

- App curves: `cubic-bezier(0.22, 1, 0.36, 1)` (its signature ease-out), verdict-pop overshoot
  `cubic-bezier(0.34, 1.56, 0.64, 1)`, press `scale(0.97)`.
- Film rules: **no linear easing anywhere**. Enters use the signature ease-out or springs with mass;
  exits use a different curve than enters. The factory (Act I) deliberately breaks the physics rule
  the way a machine would: hard snaps, zero settle — rigidity as characterisation.

## The grade (one look across every shot)

- Blacks lifted to ~`#0d0d0b` floor; gentle S-curve (`contrast(1.04) brightness(1.01) saturate(1.05)`).
- Gold highlight roll-off: a faint warm wash from the key-light direction.
- Vignette `radial-gradient → rgba(0,0,0,0.42)`; animated SVG-turbulence grain at 4–5% opacity,
  re-seeded per frame. Nothing reads as a screen recording.

## Voice

Dry, confident, mathematically literate. The app says "Nailed it." / "Not quite." /
"The maths breaks on this line." / "✒ Pri Ink Engine — on-device recognition". No exclamation
marks, no hype adjectives. Indian English for the ad (the shipped marketing's register), no
American idiom, no forced Hinglish.

## What makes it structurally different from a coaching app (all real, all in the code)

1. **The teacher is an algorithm on the student's own device.** Questions generated, working marked
   line by line with method marks, misconceptions named — no batch, no server, nothing leaves the iPad.
2. **Handwriting-native.** The student writes maths with a Pencil as on paper, and the marking comes
   back *on their own ink* — ✓/✗ per line, a margin note at the exact line where the maths breaks.
   The recogniser learns each student's individual hand, per profile, on device.
3. **It diagnoses the gap, not the score.** The Priorities engine ranks what to do next by
   exam-weight × mastery-gap × recency and names the misconception ("you keep flipping the sign")
   instead of reporting a percentage. That is the anti-factory, in shipping code.

## Claims hygiene (the repo's own "no-fake-100" culture, applied to this ad)

- No accuracy numbers on screen (no real-ink corpus exists — README: "the project's largest evidence gap").
- No syllabus-verification claims (nothing is NESA/board-checked); ladder labels are positioning, not certification.
- No price (README says free-by-architecture; the older reel invented ₹999/mo — this film needs no price).
- No invented statistics, no rank claims, no competitor names. Every equation on screen is verified
  numerically in `src/math` and gated by `scripts/check.ts`.
- Market note, honestly recorded: the codebase's curriculum is NSW-HSC-shaped; the *shipped marketing*
  (merged PRs #40–44) and this brief position for India (Class 7–12 · JEE · Olympiad). The film follows
  the shipped marketing direction and makes no board-alignment claim anywhere.
