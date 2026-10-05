# Pri dream interface: QA report

Status: 2 Oct 2026, branch `task/dream-interface` (PR #264), after the merges of `origin/main` (through the latest main at the time of writing, `a069b16f`). Companion documents: [research](PRI_DREAM_INTERFACE_RESEARCH.md), [direction](PRI_DREAM_VISUAL_DIRECTION.md), [design system](PRI-DREAM-INTERFACE.md).

Everything here is synthetic browser evidence from a development machine. None of it is evidence about a physical iPad, an Apple Pencil, a real student or a learning outcome.

## 1. How the product was looked at

The production build (`client/dist`) was served locally and driven with Playwright's Chromium, which the repository already installs (`@playwright/test`; Chromium and WebKit binaries were present). A scratch driver walked the student journey and wrote screenshots; the screenshots were then read as images. The driver is not committed (the production build refuses untracked files); the committed tours listed in §6 cover the same flows with assertions.

For every capture the driver also recorded console errors, page errors and horizontal overflow (`scrollWidth − innerWidth`).

### Screens captured

First entry, onboarding (steps 1, 2, 4, 5), Home (new, returning, offline), practice (typed, handwriting empty, handwriting with ink, hint, typed answer, retry, marked result, full marked page), the explanation player, multiple choice (selected, after marking), practice offline, Progress, Progress map, Review, Exams, Tasks, Classes, Settings, Rush, a legal page.

### Viewports and themes

| Viewport | Paper | Night | Depth |
|---|---|---|---|
| iPad landscape 1180×820 | Yes | Yes | Full set (30 captures each) |
| iPad portrait 820×1180 | Yes | Yes | Core set (22) |
| Phone 390×844 | Yes | Yes | Core set (22) |
| Android phone 360×780 | Yes | No | Core set (22) |
| Desktop 1440×900 | Yes | No | Core set (22) |
| Touch iPad profile 1180×820 (`hover: none`, `pointer: coarse`) | Yes | No | Rail and Home only |

192 captures in the final round, after four earlier rounds used to find and fix defects.

### What was inspected by eye, and what was not

- Inspected by eye, both themes: iPad landscape for entry, onboarding, Home, typed practice, handwriting, retry, marked result with worked solution, the explanation player, Progress, Review, Exams, Settings; phone for Home, practice, handwriting, marked result and Progress.
- Inspected by eye, paper only: iPad portrait handwriting, the touch-iPad rail, Rush, multiple choice.
- Captured and checked programmatically (console, overflow) but **not** all read by eye: desktop 1440, Android 360, iPad portrait night, Tasks, Classes, the legal page, the Progress map tab.
- **Not captured in this pass:** the exam room, its confirmation dialog and its result page (the class tracks used had no startable paper). They are exercised with assertions by `tour-exam-timer.js`, `tour-v4.js` and `tour-hindi.js`, and were inspected in the earlier pass recorded in the PR description. The teacher workspace was not reviewed.

### Result of the final capture round

No console errors, no page errors and no horizontal overflow on any captured screen at any of the five viewport sizes, in either theme.

## 2. Defects found by rendering, and their state

| Finding | State |
|---|---|
| Explanation player outside the system (pills, 14–20px radii, gradient, halos, 7–10px labels, engine version in chrome) | Fixed |
| Explanation player uppercased the question, rendering `x` as `X` | Fixed, gated |
| Input edges about 1.5:1 in both themes | Fixed (`--control-border`), gated by computed contrast |
| No match-device theme; light flash for night users; static chrome colour | Fixed, gated |
| Bordered input inside a bordered, focus-ringed sheet | Fixed |
| 4–8px overflow in the split workspace; 10px on Home at 360px; 27px on Progress at 390px | Fixed |
| Inline equations breaking mid-expression | Fixed (balanced wrapping) |
| Progress as stacked cards with metric tiles, mis-aligned table head, tenths of a mark, internal vocabulary | Fixed |
| Unlabelled icon rail on a touch iPad in landscape | Fixed, verified under a touch media profile |
| The mark repeated up to four times in feedback, with a redundant percentage | Fixed, gated |
| A bare "×" clearing filters; two wrapped lines of filter text on a phone | Fixed |
| Disclosures that looked like labels | Fixed (`.btn-disclose`) |
| Onboarding device glyph and a privacy paragraph repeated on every step | Fixed |
| Glyph characters and emoji in student-facing labels | Fixed for labels and page heroes; avatar picker and Match rivals remain |
| "read in this browser (fallback reader)" shown to students | Fixed (developer-only) |
| Blur on bars over scrolling content | Fixed, gated |
| Ink sheet height depended on an incidental re-render after a resize | Fixed |
| "Not saved" could appear after a marked answer; "Saving" could stick after a retry | Fixed, gated |

## 3. Independent review

The diff is risk class R4, so it was reviewed by a separate reviewer that was given the code and the invariants, not the writer's conclusions. Verdict: **REQUEST_CHANGES**, with two blocking findings:

1. Tap-to-correct fixes survived Undo and Redo. They are keyed by glyph position at full confidence, so a stale fix could land on a different symbol and bypass the reading check.
2. The Finger toggle was hidden in the native iPad app, where it is the only way to write without a Pencil.

Plus: a typed draft could be rewritten after marking; the save status could stick; one English-only draft note in the exam room; four overstated claims in the design-system document; "+0" for under half a mark on Progress.

All were fixed in `59189e11`, with regression checks for the two blocking findings. The reviewer also confirmed the submission-lifecycle merge is intact, recognition remains answer-blind, marks come only from the deterministic engine, and no test threshold was lowered. The reviewer did not re-review after the fixes; that re-review is still owed before merge.

## 4. Accessibility

Checked:

- **Text contrast, computed from the tokens** for ink, secondary, tertiary, accent, correction, uncertain, good, bad and warning on desk, paper, raised, sunken and workspace surfaces, in both themes: all ≥ 4.5:1. Primary button label on teal: 6.1:1 on paper. This is now a gate (`dream-interface-check`).
- **Non-text contrast, computed:** `--control-border` ≥ 3:1 on every surface in both themes (3.28:1 minimum on paper, 3.5:1 at night). Gated.
- **Automated accessibility suites:** `npm run test:a11y`, 35/35 and 38/38 checks.
- **Targets:** the responsive matrix asserts everything a finger presses on Practice is ≥ 44px tall on phones, in Chromium and WebKit.
- **Colour independence:** each feedback state has an icon and a word; uncertainty is also dashed. Asserted by `dream-interface-check` ("mistakes, uncertainty and failures are three different states").
- **Reduced motion:** the reading line, feedback entrance and theme cross-fade are disabled under `prefers-reduced-motion` (asserted in source). Not exercised in a browser with the preference set.
- **Hindi:** `tour-hindi.js` 36/36; no English interface literal on the walked screens.

Not checked: a screen reader (VoiceOver or TalkBack) by hand; browser zoom at 200% by eye; text scaling on a device; focus order by hand beyond what the suites assert; forced-colours mode. Dialogs move focus in but do not trap it.

## 5. Performance

- No new dependencies.
- Install budget gate passes: 1237 kB raw / 522 kB gzip installed, under the 1270 / 547 kB limits.
- **The main stylesheet grew**: 114.8 kB raw / 23.2 kB gzip, against 77.7 kB / 16.5 kB on `main` when measured. That is the cost of the layered stylesheet (base layer, instrument layer, patches) and it is the main reason consolidation is listed as debt.
- Blur was removed from every bar that sits over scrolling content.
- Motion uses opacity and transform only; nothing loops.
- Not measured: frame times, input latency, Lighthouse, or anything on a real device.

## 6. Tests and builds

Commands run locally on the final source. The full deterministic suite was run at `59189e11`; the browser suites and the fast gates were re-run after the last merge of `main`.

| Command | Result |
|---|---|
| `npm test` (every deterministic suite) | exit 0, at `59189e11`. Includes engine 1,704,000/1,704,000 self-checks, backend 468/468, i18n 186/186, i18n coverage 88/88 (42 files), i18n voice 92/92, submission lifecycle 13 groups, install budget 47/47 |
| `npm run test:dream` | dream interface 42/42, design system 91/91 |
| `node client/test/e2e.mjs` | 257/257 across 9 flows |
| `tour-explain-v2.js` | 16/16 |
| `tour-hindi.js` | 36/36 |
| `tour-cloud-platform.js`, `tour-admin-cms-platform.js`, `tour-admin-independent-review.js` | 18/18, 17/17, 8/8 |
| `tour-responsive-matrix.js` (Chromium) | 151/151 |
| `tour-responsive-matrix.js --browser=webkit` | 151/151 |
| `tour-kalp01-design.js`, `tour-kalp02-navigation.js`, `tour-kalp03-onboarding.js`, `tour-kalp04-home.js` | 26/26, 68/68, 53/53, 26/26 |
| `golden-student-journey.mjs` | PASS |
| `npm run test:a11y` | 35/35 and 38/38 |
| `npm run test:security`, `test:backend`, `test:gateway`, `test:contracts`, `test:budget`, `test:submission` | pass (129/129, 468/468, 111/111) after the last merge |
| `npm run build` | builds |
| `npm run check:ios` | both tracked iPad bundles match `client/dist`, 163 files |

Not run locally: the server and Postgres platform suites (`test:platform`), the Swift and native ink suites, and the Android build. They run in CI.

### Test changes, disclosed in full

Some checks were loosened, replaced or deleted. Each is listed here with its reason, so a reviewer can disagree with a specific one.

**Thresholds loosened or replaced**
- `tour-responsive-matrix.js` (CP-03):
  - **Widening, depth.** The check that ink stays near the foot after phone → tablet widening was lowered from `maxY >= 0.85h` to `maxY >= 0.5h`. In this design the sheet is 340px on a phone but up to 640px on a portrait tablet, so ink drawn at the phone sheet's foot no longer sits at the tablet sheet's foot.
  - **Widening, scaling.** To restore what the original check proved, a new check requires the ink to be *scaled*: its share of the sheet width must be at least 1.3× what unscaled ink would show, and never more than before (no stretching). It waits for the canvas to settle after the resize, which removed an intermittent result.
  - **Sheet height.** The exact `sheet height === 380` was replaced by a range (at least the iPad height, and it fits the window).
  - **Explain launcher.** It must now also not sit under the action bar (`underBar`, previously computed but never asserted).
- `design-system-check.mjs`: three checks that pinned the KALP-01 midnight palette (`--page #090f1d`, light `--brand-1 #315fdd`, a brand gradient) were replaced by checks for the paper identity, plus new anti-template lints (no decorative gradients, glows, literal colours, radii above 8px, or emoji in chrome).

**Checks inverted or deleted**
- `tour-v3.js`: "the question is on the clock" was inverted to "practice shows no running clock", because practice is deliberately untimed on screen.
- `tour-exam-timer.js` (added on this branch) was deleted when main's ExamRoom replaced the tick timer with a deadline clock. Its cases (warnings, auto-submit at zero) are covered by main's `tour-exam-deadline.js`. The static guard against timers shadowing `t` remains in `dream-interface-check.mjs`.
- `backend-check.mjs`: the ink-draft route's checks were removed together with the route. A single store (`practiceRecovery.js`) is now covered by `submission-lifecycle-check.mjs` and `tour-submit-lifecycle.js`.
- `i18n-check.mjs`: three reasoned exceptions were dropped for controls that no longer exist, and 77 catalogue keys left unused by the merge were deleted.

**Selectors and flows that follow deliberate behaviour changes**
- `tour-v4.js`, `tour-exam-india.js`, `a11y-check.mjs`: formal submission is two steps ("Review and submit", then "Submit paper" in a dialog).
- `tour-kalp01-design.js`: paper is the default theme, so the toggle is tested to night and back.
- `tour-kalp03-onboarding.js`: leaves Practice through the workspace bar's Home control, because thinking mode has no account menu.
- `tour-phone.js`: in thinking mode the bottom bar is absent, so the offline-shell check accepts the workspace bar.
- `kalp04-home-check.mjs`, `tour-kalp04-home.js`: the CSS check follows `.home-next`, and resume checks assert the recommendation kind (`data-kind`) rather than the generic title, because the card is titled with the actual topic.
- `tour-placement.js`: the multiple-choice submit lives in the workspace action bar.
- `tour-ink.js`, `tour-v3.js`, `a11y-check.mjs`: verdicts are an icon plus a spoken word, Scratch is found by its name, and Show solution takes two presses.
- `.github/workflows/ci.yml`: the exact-count invariants were recounted from a full local run of the merged tree (see the commit that sets them).

## 7. Remaining limitations

Implemented but not verified on hardware: everything about Pencil and touch (latency, palm rejection, hover, squeeze, rotation with real ink, restoring a draft into PencilKit), the theme boot inside the native shells, Dynamic Type on device.

Known and left in place:

- A night-mode profile created before this change paints paper once on its first launch after the update.
- The emoji avatar picker (onboarding, Settings) and Match rival avatars.
- Unfinished ink and in-flight submissions are kept in `localStorage`, which is not encrypted at rest, unlike the sealed IndexedDB stores. This comes from `main`'s recovery store, not from the redesign; it is recorded here because the redesign removed its own sealed-row alternative to avoid two stores.
- Plot captions are untypeset strings from the engine.
- Settings is still a long stack of cards. Tasks, Classes, Rush, Match and the teacher workspace were not redesigned.
- Legacy sub-12px sizes outside the system layer.
- Dialogs do not trap focus.

## 8. Deferred work

Designed, not built: the examiner margin rail with step codes (R4), the four-rung hint ladder (R3), the syllabus map (R3).

Engineering: consolidate `theme.css` and the explanation player's five stylesheets; split `QuestionCard.jsx` and the player into composed parts; a self-hosted interface face and numeral face; visual regression tooling.

Needs people or devices: a usability study with real Class 8–10 students; physical iPad and Pencil validation; a screen-reader pass; counsel's view on the DPDP questions raised in the first research round.
