# Pri dream interface: QA report

Status: 2 Oct 2026, branch `task/dream-interface` (PR #264), after three merges of `origin/main` (through CP-07, `a069b16f`). Companion documents: [research](PRI_DREAM_INTERFACE_RESEARCH.md), [direction](PRI_DREAM_VISUAL_DIRECTION.md), [design system](PRI-DREAM-INTERFACE.md).

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

### Test changes, and why each is legitimate

No threshold was lowered and no check was deleted to get green.

- `tour-ink.js`, `tour-v3.js`: the marks line no longer carries "(100%)"; the regex still requires earned = total by back-reference.
- `tour-explain-v2.js`: the engine version is read from `data-explain-engine`, not from student-facing chrome.
- `a11y-check.mjs`: follows the sentence-case "Submit answer".
- `backend-check.mjs`: the backend ink-draft route's checks are replaced by checks that resume returns the same question, that no handwriting field is served, and that the removed route is absent. Ink drafts are covered by `submission-lifecycle-check.mjs` and `tour-submit-lifecycle.js`.
- `i18n-check.mjs`: two reasoned exceptions were for controls that no longer exist.
- `tour-kalp04-home.js`: the appearance labels are "Paper" and "Night".
- `tour-responsive-matrix.js` (from CP-03): reconciled with thinking mode. The shell is measured on Home and Practice is asserted to have its own bar and no rail; the writing sheet must be at least the iPad height and fit the window; Show solution takes two presses; the explanation launcher is measured as a pressable row in the page flow. One check was added per viewport (145 → 151).
- `.github/workflows/ci.yml`: four exact-count invariants were updated to the counts the suites now report (i18n 186, coverage 42 files, e2e 257 across 9 flows, responsive 151 per engine).

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
