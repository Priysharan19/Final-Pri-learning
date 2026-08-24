# Pri Learning Commercial Launch

Production runbook for the first paid Instagram/Facebook launch campaign.

## Commercial objective

Prove that Pri Learning's strongest positioning converts attention into product exploration:

> **Maths that marks the working, not just the final answer.**

The first flight is deliberately a learning campaign, not a scale campaign. Pri Learning currently keeps the learning runtime local and does not ship a third-party tracking pixel. Until a separately consented first-party conversion endpoint exists, optimise paid media for **Landing Page Views** and use the `/launch` page's local events for device-level QA only.

## Destination

Primary destination after deployment:

`/launch`

The page accepts standard UTM parameters and stores first/last touch locally. It never persists `fbclid`, fingerprints a visitor or sends analytics data off-device.

Recommended URLs:

- 15 s master: `/launch?utm_source=meta&utm_medium=paid_social&utm_campaign=nsw_parent_launch&utm_content=reel15_working`
- 6 s cutdown: `/launch?utm_source=meta&utm_medium=paid_social&utm_campaign=nsw_parent_launch&utm_content=reel06_working`
- Organic Instagram bio/reel: `/launch?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch&utm_content=profile`

## First paid flight

### Campaign

- Platform: Meta Ads Manager
- Objective: Traffic
- Optimisation: Landing Page Views
- Geography: New South Wales, Australia
- Audience: adults 28–55, broad targeting
- Placements: Advantage+ placements, with the native 9:16 master supplied for Reels/Stories
- Schedule: 10 days
- Initial budget: **A$60/day (A$600 total)**
- Attribution decision: do not add a Meta Pixel to the learning runtime merely to improve reporting. Privacy is part of the product proposition.

### Ad sets

**A — Parent / guardian broad (70% of spend)**

- NSW adults 28–55
- Broad audience; let the creative qualify viewers with “Years 7–12”, “HSC” and the Apple Pencil product interaction
- Exclude existing warm users only if a reliable first-party audience exists later

**B — Maths educator / tutor broad (30% of spend)**

- NSW adults 24–60
- Keep targeting broad initially; the creative and copy identify the educator use case
- Measure landing-page engagement separately using `utm_campaign=nsw_educator_launch`

Do not split into many small interest audiences in the first flight. Four strong ads with enough delivery are more useful than twenty underfunded combinations.

## Creative matrix

Use no more than two active video cuts per ad set in the first test.

### Creative A — 15 second commercial master

**Primary text**

Most maths apps only know whether the final answer is right or wrong.

Pri Learning is built around the working: write with Apple Pencil, check the steps, see where the reasoning changed, then practise what you need next.

Years 7–12. Built for iPad. Local-first.

**Headline**

Maths that marks the working.

**Description**

Explore the live Pri Learning demo.

**CTA**

Learn More

### Creative B — 6 second performance cutdown

**Primary text**

The method can be right even when one sign is wrong.

Pri Learning is built to give feedback on the steps—not only the answer box.

**Headline**

Your working matters.

**Description**

Years 7–12 maths practice for iPad.

**CTA**

Learn More

## Educator copy variant

**Primary text**

Students do not learn maths in an answer box.

Pri Learning is built for the working: Apple Pencil input, step-by-step checking, HSC-style criteria and adaptive practice across Years 7–12.

See the product flow in the live demo.

**Headline**

See the reasoning, not only the result.

**CTA**

Learn More

## Landing-page conversion hierarchy

1. **Try the live demo** — primary action. Creates/selects the built-in six-week demo profile and opens the actual product.
2. **Create a local profile** — secondary action for high-intent visitors.
3. Product proof — handwritten working, teacher-style correction and recognition correction contract.
4. Trust — offline-after-install, no student work uploaded, Apple Pencil-first.
5. Coverage — Years 7–12, 252 NSW syllabus dot points, 344,798 observed distinct question variants.

The landing page avoids unsupported handwriting-accuracy promises. It explicitly says recognition can be tap-corrected when needed.

## Decision rules after the first A$600

Do not judge the campaign on raw views.

Track in Ads Manager:

- 3-second video view rate
- hold rate to 6 seconds
- outbound CTR
- landing-page-view rate from link clicks
- cost per landing-page view
- frequency

Interpretation:

- **Strong video hold, weak CTR:** hook works; offer/CTA or landing proposition needs work.
- **Weak video hold:** replace the opening 1–2 seconds before changing targeting.
- **Strong CTR, weak LPV rate:** page load/deployment issue or accidental clicks.
- **Both cuts weak:** revisit positioning before increasing spend.
- **One cut materially wins:** move 70–80% of spend to it and make two new hook variants rather than scaling the losing creative.

Do not scale daily spend aggressively from one good day. Wait for several days of stable delivery and compare the creative cuts on enough impressions to avoid reacting to noise.

## Commercial claim guardrails

Safe current claims:

- Years 7–12 maths practice
- iPad / Apple Pencil oriented interface
- on-device handwriting recognition
- line-by-line Step Check / marking feedback
- HSC-style marking criteria and method marks
- adaptive practice / priorities
- local-first and offline-after-install runtime
- current NSW generator coverage figures when quoted exactly from the measured repository census

Avoid in paid creative until independently demonstrated on real held-out users:

- “perfect handwriting recognition”
- “better than Leibniz”
- “most accurate” / “best AI tutor”
- guaranteed mark or ATAR improvement
- any real-handwriting accuracy percentage not backed by the relevant held-out benchmark

## Audio/licensing

Use the original commercial master audio or music explicitly licensed for advertising. Do not assume that a song available in Instagram's consumer music picker is cleared for paid commercial use.

## Next measurement upgrade

If paid acquisition proves demand, build a **separate consented marketing measurement boundary** rather than putting third-party analytics inside the learning runtime. The conversion endpoint should receive only campaign/session metadata and explicit funnel events—never handwriting, answers, profile names, progress or learning history.
