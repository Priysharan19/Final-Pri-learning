# Pri dream interface: research

Status: 2 Oct 2026, branch `task/dream-interface` (PR #264). This document records what was audited, what was researched, and what follows from it. The chosen direction is in [PRI_DREAM_VISUAL_DIRECTION.md](PRI_DREAM_VISUAL_DIRECTION.md); the system itself is in [PRI-DREAM-INTERFACE.md](PRI-DREAM-INTERFACE.md); what was verified is in [PRI_DREAM_INTERFACE_QA.md](PRI_DREAM_INTERFACE_QA.md).

It builds on the first research round, which is kept beside it and not repeated here:

- [pri-instrument-interface-research.md](pri-instrument-interface-research.md): the full synthesis (learning science, ink, feedback, hints, motivation, colour, motion).
- [research-notes/](research-notes/): sources per topic (learning apps, pen and ink apps, craft UI, design systems, audience).
- [dream-interface-research.md](dream-interface-research.md): the Leibniz reference study.
- [pri-instrument-plan.md](pri-instrument-plan.md): the 12-item implementation plan.

## 1. What authority exists

The brief names K1–K5 experience specifications and P1–P5 learning specifications (for example `PRI_STUDENT_EXPERIENCE_SPEC.md`, `PRI_DESIGN_SYSTEM.md`, `PRI_FEEDBACK_EXPERIENCE.md`). **These files are not in the repository.** That is the repository's own finding, not only this audit's: `docs/release/PRI_V1_RELEASE_SCOPE.md` §8 and `docs/release/PRI_R1_SCOPE_EVIDENCE.md` both record that the canonical K1/K2/K3 filenames and a stable P1–P5 file set were not established on `main`.

The authorities that do exist, and that this work follows:

| Authority | What it governs |
|---|---|
| `AGENTS.md` | Non-negotiable invariants: answer-blind handwriting, "AI proposes, the deterministic engine decides", no fabricated evidence, no weakened tests. |
| `docs/design/KALP-01…04` | Token names and accessibility baseline (01), navigation and roles (02), onboarding and profiles (03), the Home recommendation policy (04). |
| `docs/cross-platform/FORM_FACTOR_SPEC.md` | Semantic form factors: COMPACT < 600, MEDIUM 600–839, EXPANDED ≥ 840, SHORT ≤ 480 tall; input type as a separate axis; 44px targets. |
| `docs/release/PRI_V1_RELEASE_SCOPE.md` | What V1 is; that K/P contracts remain mandatory product-quality contracts even though their files are not located. |
| `docs/PERSON1_INTELLIGENCE_RELEASE_CONTRACT.md` and the engine tests | Learning-intelligence behaviour as implemented and tested. |
| `docs/design/PRI-DREAM-INTERFACE.md` | The visual and interaction system (this branch). |

Where the brief and the repository disagree, the repository's tested behaviour wins and the difference is recorded as a reconciliation item (see §7).

## 2. Existing Pri audit

Method: the production build was served locally and walked with Playwright (Chromium) through first entry, onboarding, Home, practice (typed, handwritten, multiple choice), hint, retry, marked result, worked solution, the explanation player, Progress, Review, Exams, Tasks, Settings and offline, at five viewport classes and in both themes. Screens were read as images, not inferred from source.

### Architecture

- React 18 single-page app built with Vite (`client/`), no component library and no CSS framework. All styling is one global stylesheet, `client/src/theme.css` (about 2,600 lines), plus five small stylesheets for the explanation player. Tokens are CSS custom properties on `:root` and `[data-theme="dark"]`.
- State is local React state plus a single app context (`App.jsx`). Data comes from an in-browser backend (`client/src/local/backend.js`) over IndexedDB, with optional cloud sync. The deterministic marking engine is bundled in the client.
- Mathematics is KaTeX. Handwriting is a canvas (`ink/InkCanvas.jsx`) in the browser and PencilKit in the native iPad shell.
- One icon family (`components/Icon.jsx`, 24-unit grid, 1.6 stroke). No React Native: the iOS and Android apps are native shells around this web bundle, so the React Native guidance in the plugin does not apply to code in this repository.
- Design gates run in CI: `client/test/design-system-check.mjs` (no gradients, glows, literal colours below the token block, radii over 8px, emoji in chrome) and `client/test/dream-interface-check.mjs` (workspace and theme contracts).

### Strengths worth preserving

- **The identity is already right.** Paper, near-black ink, one teal, four states that never look alike (copper correction, dashed indigo uncertainty, red for technical failure only, restrained green).
- **Question prose is set in the maths face**, so equations do not look pasted into sentences.
- **Thinking mode.** `/practice` and `/exams/:id` drop the rail, the bottom bar and account furniture. On a landscape tablet the question sits beside the page.
- **One dominant action** per state, and a status line that reports only what the device knows.
- **Honest feedback states.** A reading the recogniser is unsure of is never marked wrong; a failed submission says nothing was lost.
- **Home is one recommendation**, from a deterministic resolver, with a reason worded from real data.
- **Exam room** has confirmed submission, flags with a legend, and a timer announced in words.

### Weaknesses found in the rendered product (this pass)

| # | Finding | Kind | Outcome |
|---|---|---|---|
| 1 | The explanation player (the tutor surface) sat outside the system: pills, 14–20px radii, a gradient band, halos, 7–10px labels, and "V8 adaptive teacher" in the chrome. | Visual system | Fixed |
| 2 | The same player uppercased the question, so the variable `x` rendered as `X`. | Mathematical correctness | Fixed |
| 3 | Input boundaries were about 1.5:1 against paper in both themes. | Accessibility (WCAG 1.4.11) | Fixed |
| 4 | No "match device" theme, a light flash for night-mode users on cold start, and a static browser chrome colour. | Theme architecture | Fixed |
| 5 | The typed answer was a bordered input inside a bordered, focus-ringed sheet. | Component | Fixed |
| 6 | 4–8px of horizontal overflow in the split workspace; 10px on Home and 27px on Progress at phone widths. | Layout | Fixed |
| 7 | Inline equations broke mid-expression when the question wrapped. | Typography | Fixed |
| 8 | Progress was six stacked cards with four metric tiles, a mis-aligned table header, figures to a tenth of a mark, and internal vocabulary ("learning-intelligence layer"). | Structure, copy | Fixed |
| 9 | On a touch iPad in landscape the rail was nine unlabelled icons (the labelled rail stopped at 1180px, exactly an iPad's width). | Navigation | Fixed |
| 10 | Feedback repeated the mark up to four times ("0 / 1 marks (0%)", "0 / 1", "0/1", "0/1."). | Feedback | Fixed |
| 11 | A bare "×" in the practice bar cleared filters; on a phone the same controls took two wrapped lines. | Affordance | Fixed |
| 12 | In-flow disclosures ("Show working…", "Mark it yourself…") looked like bold labels. | Affordance | Fixed |
| 13 | Onboarding showed a decorative device glyph and the same privacy statement three times per step. | Noise | Fixed |
| 14 | Leftover glyph characters as icons in Settings (✎, "? Help"). | Consistency | Fixed |
| 15 | "read in this browser (fallback reader)" shown to students. | Copy | Fixed (developer-only) |

### Debt that remains (not fixed here)

- `theme.css` is layered: a base layer, an instrument layer and later patches override one another. It works and is gated, but a rule's final value can take three reads to find. Consolidation needs visual regression tooling first.
- The explanation player still carries its five historical stylesheets; `PriExplainInstrument.css` overrides them rather than replacing them.
- Onboarding and Settings offer an emoji avatar that the chrome then shows as initials. The picker is covered by the KALP-03 tests, so removing it is a product decision, not a styling one.
- Settings is still a long stack of cards.
- Plot captions are plain strings from the engine (`y = x^2 + 4x - 5`), not typeset.

## 3. External research

The first round's findings stand (see the linked synthesis). The headline numbers that drive decisions: decorative detail reduces learning (g = −0.33); elaborated feedback beats bare right/wrong (ES 0.49 vs 0.05); worked examples help (g = 0.48); bottom-out hint abuse is common (36% of actions in one study); dark text on light beats light on dark for acuity.

This round filled specific gaps. Sources were opened on 2 Oct 2026.

### Dark mode

- Material's dark theme uses a dark grey base (`#121212`) rather than black, shows elevation with lighter surfaces, and warns that saturated colours vibrate on dark, so accents are lightened and desaturated ([Material dark theme codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme), [Material Android docs](https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Dark.md)).
- Apple uses two background sets, base and elevated, and semantic colours rather than hard-coded values ([Apple HIG, Dark Mode](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/dark-mode.json)).
- NN/g: light mode performs better for normal vision, more so at small sizes; dark mode helps some users; the recommendation is to offer the choice ([NN/g](https://www.nngroup.com/articles/dark-mode/)).
- **What Pri takes:** night is a warm near-black desk (`#121210`) with paper one step lighter and raised surfaces lighter again; accents are lighter and less saturated than their paper values; paper stays the default. **What Pri does not copy:** Material's white-overlay elevation maths, or any glow.
- Not verified: peer-reviewed evidence on halation and astigmatism with light-on-dark text. Only secondary articles were found.

### Accessibility (WCAG 2.2)

- 1.4.3: text 4.5:1. 1.4.1: colour is never the only carrier ([WCAG 2.2](https://www.w3.org/TR/WCAG22/)).
- 1.4.11: 3:1 for the visual information needed to identify a component and its states; an input border needs it when the border is what identifies the field ([Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- 2.5.8: 24×24 CSS px minimum ([Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)); Apple's default is 44pt ([Apple HIG, Accessibility](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json)).
- 2.4.11: a focused control must not be hidden by sticky content ([Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)).
- **What Pri takes:** a `--control-border` token at ≥ 3.28:1 on every paper surface and ≥ 3.5:1 on every night surface; 44px targets on coarse pointers; a 3px focus ring; meaning carried by icon, rule style and word as well as colour.

### Interface engineering (Vercel Web Interface Guidelines)

Rules most relevant to a study app ([guidelines](https://vercel.com/design/guidelines), [repository](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/AGENTS.md)): visible `:focus-visible`; hit targets at least 24px and 44px on mobile; inputs at least 16px on mobile so iOS does not zoom; never block paste; skeletons that mirror content; `tabular-nums`; `text-wrap: balance`; `overscroll-behavior: contain` in sheets; safe-area insets; animate transform and opacity only; a `theme-color` that matches the page.

**What Pri takes:** all of the above as engineering rules. **What Pri does not copy:** Vercel's visual identity, or "prefer APCA" as a gate (APCA is used as a design aid; WCAG 2 AA is the floor that is measured).

### Tutor and explanation interfaces

- Khanmigo guides rather than answers, and Khan routes arithmetic to a calculator and has the model read human-written steps first ([Khanmigo](https://www.khanmigo.ai/learners), [Khan blog](https://blog.khanacademy.org/khanmigo-math-computation-and-tutoring-updates/)).
- Brilliant frames its tutor as visual and interactive on a shared canvas ([Brilliant](https://brilliant.org/)). Photomath gives step-by-step explanations with "how" and "why" ([Photomath](https://photomath.com/)).
- NN/g: do not autoscroll streamed responses; disclose progressively ([NN/g](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)). Response-time limits are 0.1s, 1s and 10s ([NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)).
- **What Pri takes:** the explanation is a board beside the student's own working, one step at a time, in the same typography as the question; it states plainly that it cannot change the mark; the verdict is instant from the bundled engine and only an optional method check may take longer, with a status that says so. **What Pri does not copy:** a chat sidebar, a persona, sparkle or robot motifs, or streamed text that moves under the reader.
- Not found: published guidance on keeping AI explanation visually distinct from grading. Pri's rule here comes from `AGENTS.md`, not from an external source.

### Mathematical typography and graphs

- KaTeX renders at 1.21× surrounding text by default and breaks inline maths only after relations and binary operators ([KaTeX fonts](https://katex.org/docs/font.html), [KaTeX supported](https://katex.org/docs/supported.html)).
- Okabe–Ito: use redundant coding (line style, shape, direct labels), never pair red with green ([Okabe and Ito](https://jfly.uni-koeln.de/color/)).
- `tabular-nums` for figures that change or line up ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)).
- **What Pri takes:** balanced wrapping on question prose so an equation breaks where a typesetter would; three plot colours taken from the state tokens (teal, copper, indigo), which avoids a red–green pair; tabular figures on marks, timers and tables.

### Scroll and viewport on iPad and iOS

- `100vh` overflows with browser toolbars; `dvh` follows the dynamic viewport; the keyboard changes no viewport unit, so `visualViewport` is the tool for keyboard overlap ([web.dev](https://web.dev/blog/viewport-units), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)).
- Sticky positions against the nearest scrolling ancestor ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/position)); `overscroll-behavior: contain` stops scroll chaining ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)).
- **What Pri takes:** the workspace has one scroller (the page) with a sticky bar above and a sticky action bar below; the question column scrolls on its own only in the split layout and contains its overscroll. **Scroll Craft's** choreography (pinning, parallax, scrubbing) is deliberately not used: the skill itself excludes learning and assessment flows.

### Theme architecture

- Paint the stored preference before first paint with a blocking script; follow the device with a `change` listener; update `theme-color` by script when the user overrides the device ([Josh Comeau](https://www.joshwcomeau.com/react/dark-mode/), [web.dev](https://web.dev/articles/color-scheme), [MDN change event](https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/change_event), [MDN theme-color](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/theme-color)).
- **What Pri takes:** exactly this, with the script as an external file so a strict script policy still allows it.

## 4. Student requirements

| Need | How the system serves it |
|---|---|
| Concentration | Thinking mode removes navigation. One primary action. No toasts, points or badges in the result. |
| Mathematical thinking | Question and maths share one face. The page is ruled paper. Pen input is first-class. |
| Long sessions | Paper by default; warm neutrals, not white; night as a deliberate second theme; no motion that repeats. |
| Clarity | Sentence-case labels, labelled controls on touch, one edge per field, figures in tabular numerals. |
| Confidence | The status line says what is saved and where. Nothing is marked on an unconfirmed reading. |
| Mistake recovery | The first break leads, with its diagnosis; correction is copper, never alarm red; the worked method sits beside the student's own work. |
| Curiosity | "See another method" after a correct answer; the explanation player one tap away, never forced. |
| Momentum | Home gives one next step with a reason; the session bar shows the count; "Done for today" is offered at the goal. |

## 5. Light mode requirements

Emotional character: a clean exercise book on a desk in daylight. Contrast: near-black ink at 14.7–16.5:1; secondary text never below 4.8:1; hairlines divide content while control edges hold 3:1. Surfaces: desk, paper, raised paper; depth by one step of lightness and a hairline, not by shadow. Reading environment: the question at 19–22px in the maths face on a 68ch measure.

## 6. Dark mode requirements

Emotional character: the same notebook under a lamp at night. Luminance: desk `#121210`, paper `#1a1a17`, raised `#24241f`; each step is small but ordered, so elevation reads as "nearer the lamp". Glare: no pure white (ink is `#edebe4`), accents lightened and desaturated, the primary button is the only large light object on a screen. Surfaces keep their hairlines; nothing glows.

## 7. Why this is Pri and not another product

Pri is recognisable before the logo by five things that come from its subject rather than from a trend: (1) ruled paper with a copper margin rule wherever work is written; (2) question prose in the mathematics face; (3) one teal, used for action and for the examiner's reading line; (4) copper for a mistake and dashed indigo for "I could not read this", so being wrong never looks like an alarm; (5) a margin grammar (tick, pencil mark, question mark) that a CBSE student already reads fluently. None of these is borrowed from Linear, Notion, Duolingo or an AI product, and none of them works as decoration on a non-mathematical app.

## 8. Plugin-assisted design review

The `pri-design-mega-toolkit` plugin was discovered on disk (20 skills, each a short routing brief) and every skill file was read. How each was used:

| Skill | Used | Effect on the work |
|---|---|---|
| redesign-existing-projects | Yes | Set the order: audit before change, separate defects from taste, preserve function, render and inspect. The audit table in §2 follows its categories. |
| design-taste-frontend | Yes | Its anti-default list (pills, identical cards, generic glass) was the checklist for the explanation player and Progress. Its rule that an existing design system is authoritative kept the token names and the teal. |
| high-end-visual-design | Yes | "A small number of meaningful motifs" produced the decision to keep exactly three (ruled paper, the reading line, the margin marks) and remove the inset accent bar on Home. |
| brandkit | Yes | Strategy before marks: category, audience, promise, metaphor (§7 and the direction document). No new logo work was done; the existing mark was kept. |
| minimalist-ui | Yes | Thin dividers and limited accent, with its own caveat that minimalism must not hide controls: hence labels on the touch rail and chevrons on disclosures. |
| stitch-design-taste | Yes | Shaped the design-system document as a source of truth another engineer or agent can build from (roles, do and do not, implementation notes). |
| awesome-design-md | Yes | Used as a pattern for document structure (token roles, component states, do and do not). No third-party DESIGN.md was imported. |
| web-design-guidelines | Yes | Drove the accessibility and interaction fixes (control contrast, targets, focus, input attributes, overflow). The upstream guidelines were consulted (§3). |
| vercel-react-best-practices | Yes | Kept theme state out of the render path (`useSyncExternalStore` for the device preference, one effect to apply it), no new dependencies, no new context. |
| vercel-composition-patterns | Considered | The explanation player and `QuestionCard` are large single components. Splitting them is the right next refactor; it was not attempted alongside a merge of the submission lifecycle (recorded as deferred). |
| playwright-cli | Yes | Rendered QA ran through Playwright's Chromium, which the repository already installs; see the QA report. |
| scroll-craft | Considered, rejected for product screens | The skill excludes learning and assessment flows. Its performance and reduced-motion cautions were kept. |
| image-to-code | Yes, on Pri's own screenshots | Screens were captured and read as images to extract layout and hierarchy defects. No external mock-up was converted. |
| imagegen-frontend-mobile / -web | Considered | Used as guidance on complete flows and per-form-factor composition. No images were generated. |
| vercel-react-native-skills | Not applicable | There is no React Native in this repository; the native apps are shells around the web bundle. |
| gpt-taste, industrial-brutalist-ui, design-taste-frontend-v1, full-output-enforcement | Read, not used | Marketing-page motion, a brutalist aesthetic and a legacy variant do not fit a study product. |

Recommendations rejected, and why:

- **Scroll choreography, bento grids and "perpetual micro-motion"** (taste skills): decorative motion has a measured cost to learning and repeats hundreds of times a day.
- **A more characterful interface typeface than Inter** (first-round research suggested Instrument Sans and Geist Mono): deferred, not rejected. It needs self-hosted font files and a layout-shift check, and Inter is the existing canonical choice in KALP-01.
- **APCA as the contrast gate** (Vercel guidelines): WCAG 2 AA is what the repository's accessibility suite measures; APCA remains a design aid.
- **Glass on floating controls** (first-round research, following Apple): the workspace bars are opaque paper. Blur over scrolling content was removed for scroll performance.
