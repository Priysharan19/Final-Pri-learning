# Lit Instrument: the next-generation interface decision


**Status:** approved by the owner on 13 November 2026 (D1–D5 below, each exactly as recommended; D6 added the same day at the owner's request).
**Proposal:** https://claude.ai/artifact/B8F6J64sBGuNZQDau33Acz (private design board: audit, eight mockups in both editions and both themes, motion spec, accessibility check, self-critique, PR plan).
**Implemented by:** UI1 and UI-IND-1 together in PR #883 (D1, D2, D3, D6); D4 and D5 follow in later UI PRs.
**Builds on:** V1 decisions D7–D9 (`client/interface.config.mjs`: Instrument structure, Aurora on chrome only) and the edition brand decision Direction A, "Prime" (`docs/brand/editions-decision.md`, PR #869).

## The direction in one paragraph

Pri stays a quiet instrument on paper. Aurora's glass and light stay on the chrome, but the light gets one job: it marks where you are and what is live. Its colour is the edition's accent, peacock for Priyabhata and wattle for Prithagoras. Mathematics, ink, marks, charts and verdicts stay on matte paper in the Instrument tokens. The interface earns "futuristic" from capability it shows (the server reading each line, the clock, the margin marks), not from decoration. Its two motion signatures are the Check sweep and the focus push.

## Decisions

| # | Decision | Consequence in the code |
| --- | --- | --- |
| D1 | The edition accent replaces Aurora's violet in the chrome. Violet is retired. | `aurora.css` reads `--edition-accent` (written into `index.html` by `client/brand/edition-brand.mjs`). The accent is used only for the current place (the current tab's rule, the current bottom-bar and More item, the Continue edge, the selected palette row, the current question on an exam rail) and for the light pool. It never fills a button and never colours a verdict, mark, chart, plot or focus ring. Index primary actions become the ink primary (`--in-action`). |
| D2 | Focus rings are ink everywhere. | One rule: `outline: 2px solid var(--in-tx); outline-offset: 2px`, which replaces both the violet chrome ring and the signal-orange content ring. |
| D3 | Keep one edition-tinted light pool on the Index, the Map and Settings. | One pool instead of three: `color-mix(in srgb, var(--edition-accent) 7%, transparent)` in light and 10% in dark, drifting over 72 s. It stands still under Reduce Motion, is hidden under Reduce Transparency and in forced colours, and pauses when the page is hidden. |
| D4 | On iPad landscape, the Pencil layout is the default for every paper, with a left/right-hand setting. | The shared exam shell gets a rail of question ticks, a question column, a full-height writing sheet, a mono clock with a full-width elapsed rule, and a tool dock on the side of the hand that isn't writing. Phones keep the stacked room. |
| D5 | The welcome screen's decorative waves become the edition's live plot. | `SignInPlot.jsx` draws a real function of the edition's first chapter with its tracer, in the chart palette (never the accent). |
| D6 | (owner request, 13 Nov, after "Yes, build it") Both editions get one signature working indicator, **"Construction"**: three points settle into the edition's construction cut (the jyā bow for Priyabhata, the right angle for Prithagoras), the line draws, holds and lets go, over a 2.4 s cycle. It appears only while real work is in flight (shown after 400 ms, held at least 480 ms). It is in the edition light under the Aurora skin and in ink under `instrument`. | One component, `client/src/instrument/Working.jsx` (`.pri-working`), pure SVG and CSS, about 0.7 kB gzip. Under reduced motion nothing moves and only the line's opacity breathes. It replaces the pulsing status dot, the "Loading…" route text, the tutor's italic "thinking" text and the Instrument skeleton shimmer (`brief-UI-indicator.md`). The edition accent's allowed places gain `.pri-working`. |

## Amendment to the brand decision

`docs/brand/editions-decision.md` says the edition accent never appears in "marks or verdicts, charts, the prime, focus rings, or large fills", and `client/test/brand-usage-check.mjs` confines the token to `BrandMark.jsx`. D1 widens the **places** the accent may appear, and nothing else. The amendment:

- **Allowed consumers:** `BrandMark.jsx` (the cut) and `client/src/instrument/aurora.css`, only in the current-place selectors, the pool listed above, and `.pri-working`, the working indicator (D6: "what is live").
- **Still never:** marks, verdicts, readings, charts and plots, the prime, focus rings, text on content surfaces, and solid fills. The pool is a radial wash of at most 10% and is not a fill, and the selected palette row's wash is at most 16%.
- `brand-usage-check` enforces this with a selector allowlist for `aurora.css` and a ban on the token inside any `outline`, `:focus` or `:focus-visible` rule and in any `background:` that is not a `color-mix` of 16% or less.

## What stays as it was

- D9: content is never translucent; no `--in-*` token is declared under the skin.
- The reading stays answer-blind. Reading states describe only what was read, never whether it is right.
- Marking is server-authoritative. The sweep visualises marks the server has already committed. It never runs before a receipt exists.
- D8's fallback still holds: `INTERFACE_SKIN = 'instrument'` turns every Aurora rule off, the edition light included.

## Not claimed

These are mockups and a plan. Nothing here measures learning, recognition accuracy or device behaviour. iPad and Apple Pencil acceptance of the exam layout needs physical-device evidence, recorded separately from simulator runs.
