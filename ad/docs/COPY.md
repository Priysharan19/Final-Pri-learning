# COPY.md — Pri Learning Instagram ad

> Copy revised 2 November 2026 under owner decision D24: none of the retired coverage,
> accuracy, price-comparison, connectivity, rank-prediction or marking-authority claims. The
> rendered files under `out/` (MP4s, contact sheets, cover, `vo-report.json`) predate this
> revision and must be re-rendered (`node scripts/render-all.mjs`) and re-voiced before use.
> `client/test/marketing-claims-check.mjs` holds the list of retired phrases and enforces it.

Register: Indian English, dry and confident, no American idiom, no forced Hinglish,
no exclamation marks, no shame hooks. The app's own voice ("Not quite." / "The maths
breaks on this line.") sets the temperature.

## Hook variants (A/B)

| Variant | Line | Why |
|---|---|---|
| **A — blunt (HERO)** | **Stop memorising maths.** | Imperative, category-breaking, survives a thumb at speed. |
| B — mathematical | One idea beats four hundred formulas. | States the film's thesis as arithmetic; slower but smarter. |
| C — emotional | You are not a rank. | The anti-factory line; strongest for parents, softer for students. |

## On-screen line set (every word that appears in frame, 36 s master)

| # | Time (s) | Line | Words |
|---|---|---|---|
| 1 | 0.10–1.50 | Stop memorising maths. *(all-ivory; the gold is the tangent line sweeping under the words)* | 3 |
| 2 | 2.00–4.50 | Memorise. Repeat. | 2 |
| 3 | 4.60–6.40 | Four hundred formulas. / No ideas. *(two lines, "No ideas." gold)* | 5 |
| 4 | 6.20–7.60 | Until the question is new. | 5 |
| 5 | 9.20–11.60 | Watch the secant become the tangent. | 6 |
| 6 | 12.90–14.90 | The derivative isn't a rule. / It's what you're watching. | 9 |
| 7 | 15.30–17.40 | Understand one idea. / Solve what you've never seen. | 8 |
| 8 | 18.60–20.00 | Marked by the engine. It can be wrong. | 7 |
| 9 | 20.40–23.20 | Generated questions, fresh every time. / Your misconceptions, traced. | 8 |
| 10 | 23.50–26.20 | Timed papers, marked. / Rivals raced. | 5 |
| 11 | 25.60–26.45 | Sign in. Connect. Practise. | 4 |
| 12 | 27.10–32.80 | Class 7 to JEE Advanced. / The same mathematics, at different pressures. | 11 |
| 13 | 33.20–35.60 | ℙri Learning · **Join the change.** · Follow @pri.learning · coming soon | — |

Feature-panel labels (small caps, in-panel): QUESTION BANK · GENERATED FRESH /
KNOWLEDGE MAP · CHAPTERS, ONE WEB / PRIORITIES · WHY THIS NEXT / CHAPTERS PRACTISED ·
FROM YOUR PRACTICE / MATCH MODE · RACE LIVE RIVALS / TIMED PAPERS · AUTOMATIC MARKING — with
in-frame disclaimers on progress and rivals (illustrative; needs an account).

Plus scene kickers in small caps (not spoken, structural): THE FACTORY · THE IDEA ·
CLASS 7 · CLASS 10 · CLASS 12 · JEE · JEE ADVANCED · QUESTION 1 · UNSEEN / SOLVED.

Maths set in frame (all KaTeX, all verified in `src/math`): d/dx x² = 2x · the factory's
formula cards · "Prove that eˣ ≥ 1 + x for every real x." · secant slope table (h = 1 → 3,
h = 0.5 → 2.5, h = 0.1 → 2.1) · lim_{h→0} ((1+h)²−1)/h = 2 · y = 2x − 1 · y = 1 + x tangent at 0 ·
x − y + 1 = 0 tangent to y² = 4x at (1,2).

## VO lines (studio voice; each is also a burned caption)

The gap at 11.7–13.2 s is authored: the music owns the tangent lock.

| at–until (s) | Line |
|---|---|
| 0.15–1.45 | Stop memorising maths. |
| 2.60–6.05 | Four hundred formulas. The same drill, the same batch, every day. |
| 6.10–7.35 | Until the question is new. |
| 9.00–11.70 | Watch the secant become the tangent. |
| 13.00–15.30 | Not a rule. A reason. |
| 15.40–19.60 | Understand one idea, and you can solve what you've never seen. Marked by the engine; it can be wrong. |
| 20.30–23.20 | Generated questions, fresh every time. Your misconceptions, traced. |
| 23.50–26.10 | Timed papers, marked. Rivals raced. |
| 27.30–32.60 | Class seven to JEE Advanced. The same mathematics, at different pressures. |
| 33.30–35.20 | Pri Learning. Join the change. |

## 15 s cut — on-screen lines

Stop memorising maths. → Until the question is new. → The derivative isn't a rule. → Your
working, marked by the engine. → Class 7 to JEE Advanced. → ℙri Learning · Join the change. ·
@pri.learning

## Feed primary text (~125 chars visible)

> Memorising gets you to the last question you saw. Understanding gets you past the first one you haven't. Join the change.

(124 chars to "haven't." — the CTA rides after the fold.)

## Headline (≤40 chars)

> Maths you understand. Finally.  *(30 chars)*

## CTA button

Learn more → the public site, once it exists (decision D5: `prilearning.com`).

## What the ad may not say

The retired claims are listed, one regular expression each with its reason, in
`client/test/marketing-claims-check.mjs`; that suite runs over this folder in CI. In short: no
coverage or completeness claim, no accuracy figure or marking-authority comparison, no rank
prediction, no connectivity claim, no track outside V1, no question count, and no price
comparison with coaching.
