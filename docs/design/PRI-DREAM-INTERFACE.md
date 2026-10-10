# Pri Learning design system: the examiner's notebook

Status: canonical visual and interaction authority for the student product. Implemented on `task/dream-interface` (PR #264). It supersedes the visual identity in `KALP-01-design-system.md` (midnight surfaces, gradient brand); KALP-01's token names, selectors and accessibility baseline are retained. KALP-02 (navigation), KALP-03 (onboarding) and KALP-04 (Home policy) remain the behavioural authorities for their areas.

Companion documents: [research](PRI_DREAM_INTERFACE_RESEARCH.md), [direction and signature moments](PRI_DREAM_VISUAL_DIRECTION.md), [QA report](PRI_DREAM_INTERFACE_QA.md).

The source of truth for values is `client/src/theme.css`. If this document and the stylesheet disagree, the stylesheet is right and this document has a bug.

## 1. Philosophy

Pri is an examiner's notebook that reads. The page is paper, the student's working is the hero, and Pri marks in the margin. The interface becomes quieter as the thinking becomes deeper.

Rules that follow, in priority order:

1. **Product correctness first.** No visual change may alter marking, recognition, saving or what a status claims.
2. **Structure before colour.** Hairlines, alignment and type carry hierarchy. Colour carries state.
3. **One accent.** Pri teal is for action and for the reading line. It is never a gradient.
4. **Four states that never look alike.** Correct, correction, uncertain, technical failure. Each has its own colour, rule style, icon and word.
5. **Sheets, not cards.** A bordered surface means "this is one object". Sections of a page are separated by space and a hairline.
6. **Motion explains.** It shows cause or continuity, never decorates, never repeats, and never delays a result.
7. **Say only what is known.** Saved, offline, marked, read: each is stated only when it is true on this device.

Enforced in CI by `client/test/design-system-check.mjs` (no decorative gradients, no glows, no literal colours below the token block, radii ≤ 8px, no emoji in chrome, one icon family, 3px focus ring) and `client/test/dream-interface-check.mjs` (workspace, feedback, exam and theme contracts).

## 2. Authority and reconciliation

The K1–K5 and P1–P5 specification files named in the programme brief are not in the repository (`docs/release/PRI_V1_RELEASE_SCOPE.md` §8 records the same). Until they are committed:

- `K1_RECONCILIATION_REQUIRED`: experience behaviour follows KALP-02/03/04 and the tested product.
- `K2_RECONCILIATION_REQUIRED`: this document acts as the design system. One deliberate deviation from the brief: mathematics stays on KaTeX's own metric fonts rather than STIX Two Math, because KaTeX's layout metrics are computed for its fonts.
- `K3_RECONCILIATION_REQUIRED`: feedback follows §9 below. The scratch pad is labelled "Not marked" (it is kept with the attempt for replay, so "Not submitted" would be untrue).
- Open product question: onboarding and Settings offer an emoji avatar that the chrome shows as initials. The picker is covered by KALP-03 tests and was left in place.

## 3. Colour

### Paper (light, default) and night (dark)

| Semantic name | Token | Paper | Night | Use |
|---|---|---|---|---|
| background/base | `--page` (`--bg-base`) | `#f2f0ea` | `#121210` | The desk: page background, browser chrome |
| background/subtle | `--surface-2` (`--bg-subtle`) | `#f0ede6` | `#22221e` | Table heads, hover, sunken areas |
| surface/default | `--surface` | `#fbfaf7` | `#1a1a17` | Sheets |
| surface/raised | `--surface-raised` | `#ffffff` | `#24241f` | Fields, selected segment, menus |
| surface/sunken | `--surface-2` | `#f0ede6` | `#22221e` | Segmented-control track |
| surface/overlay | `--surface-raised` + `--shadow` | | | Sheets and menus that float |
| paper | `--paper` | `#fdfcf9` | `#1c1c19` | The workspace and the ink page |
| text/primary | `--ink` | `#1c1b18` | `#edebe4` | 14.7–16.5:1 on paper; 13.1–15.7:1 at night |
| text/secondary | `--ink-2` | `#48463f` | `#bebaaf` | ≥ 8:1 |
| text/tertiary | `--ink-3` | `#6b675e` | `#969286` | ≥ 4.8:1 paper, ≥ 5.0:1 night. Never below this for text |
| text/disabled | `--disabled` | 45% of ink-2 | 42% of ink-2 | Disabled controls only |
| text/on-colour | `--accent-ink` | `#ffffff` | `#0a1f1d` | On the primary button (6.1:1 on paper) |
| border/subtle | `--hairline-faint` | 5.5% ink | 5.5% ink | Row dividers in dense tables |
| border/default | `--hairline` | 10% ink | 10% ink | Dividers, sheet edges |
| border/strong | `--hairline-strong` | 18% ink | 18% ink | Secondary buttons, chips |
| border/control | `--control-border` | `#85827a` | `#7b786f` | The edge of anything typed, written or picked in. ≥ 3.28:1 on every paper surface, ≥ 3.5:1 at night (WCAG 1.4.11) |
| accent/default | `--accent` | `#0b6e69` | `#5db8ad` | The one interaction colour |
| accent/hover | `--accent-hover` | `#095b57` | `#74c5bb` | |
| accent/pressed | `--accent-pressed` | `#074845` | `#8fd0c7` | |
| accent/subtle | `--accent-soft` | 8% accent | 11% accent | Selected option background |
| focus | `--focus` | `#0b6e69` | `#74c5bb` | 3px outline, 3px offset |
| success | `--good` | `#2d6a43` | `#7cc79a` | A correct line or answer. Restrained; never a celebration |
| correction | `--correction` | `#a04f24` | `#e0915f` | An ordinary mathematical mistake. Solid rule, pencil icon |
| uncertain | `--uncertain` | `#4a54a3` | `#a3acec` | Pri could not read this. Always dashed, with a question mark |
| error | `--bad` | `#b3261e` | `#f2877d` | Technical failure or destructive action only. Never a wrong answer |
| warning | `--warn` | `#8a5300` | `#e3b15a` | Offline, pending |
| info | `--info` | = accent | = accent | |

All text colours meet WCAG AA on every surface they are used on (computed; see the QA report).

Rules:

- No literal colours outside the token block. No gradients. No glow. No translucent surfaces and no blur on anything that sits over scrolling content: every bar (top bar, bottom bar, exam head, workspace bars) is opaque.
- Night is designed, not inverted: lightness rises with elevation (desk < paper < raised), accents are lighter and less saturated than on paper, nothing is pure black or pure white.
- Colour is never the only carrier of meaning. Every state has an icon and a word; uncertainty is also dashed.
- Learning-evidence fills use one sequential teal ramp (`--m0`…`--m5`), never traffic lights.

## 4. Typography

Two voices and one behaviour.

| Role | Token | Value | Use |
|---|---|---|---|
| Interface family | `--font` | Inter Variable, system fallbacks | All chrome |
| Mathematics family | `--font-math` | KaTeX Main, Latin Modern, STIX Two Math | Mathematics, question prose, worked steps, hints, answer options |
| Display | `--type-display` | 620 26–30px / 1.15 | One per screen at most (Home recommendation) |
| Title | `--type-title` | 600 20–24px / 1.2 | Page titles |
| Heading | `--type-heading` | 600 17px / 1.3 | Section and sheet headings |
| Body | `--type-body` | 400 15.5px / 1.55 | Default |
| Compact | `--type-compact` | 400 13.5px / 1.45 | Dense rows, secondary lines |
| Label | `--type-label` | 600 12px / 1.3, tracking 0.08em, uppercase | Section labels and table heads only |
| Caption | `--type-caption` | 400 12px / 1.4 | Notes |
| Question | `--text-math` | 19–22px / 1.62 in the maths family | The question, on a 68ch measure |

- Hierarchy comes from size and space first, weight second. Nothing is heavier than 620.
- Uppercase is for labels of at most a few words. **Never apply `text-transform` to anything that can contain mathematics**: it changes the variable.
- Figures that change or line up (marks, timers, counts, table columns) use `font-variant-numeric: tabular-nums` and are right-aligned in tables.
- Question prose uses `text-wrap: balance` so an inline equation breaks where a typesetter would.
- No text below 12px in the system layer. (Some legacy base-layer rules and a few pages outside this pass still set 11–11.5px; see Deferred.) On phones, text inputs should be at least 16px so iOS does not zoom.
- Buttons and labels are sentence case ("Submit answer", "Next question").

## 5. Space, shape, depth

- Spacing: a 4px grid, `--space-1` (4) to `--space-12` (48). Sections of a page are 36–40px apart; items within a section 8–16px.
- Radius: `--radius-xs` 2, `--radius-sm` 3, `--radius` 4, `--radius-lg` 6. Fields and buttons 3–4; sheets 6; circles only for avatars, step numbers and day dots. No pills on controls.
- Elevation: three levels. Flat paper; a sheet with a hairline; a floating surface (`--shadow`) for sheets and menus only. Buttons have at most a 1px keycap edge.
- Layout tokens: `--reading-width` 68ch, `--canvas-width` 820px, `--page-width` 760px, `--rail-width` 178px, `--bar-height` 52px, `--tap` 44px.

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--motion-instant` | 80ms | Press feedback |
| `--motion-fast` | 140ms | Hover, selection, disclosure chevron |
| `--motion-base` | 200ms | Feedback sheet entering, theme cross-fade |
| `--motion-sheet` | 260ms | Sheets and dialogs |
| reading line | 640ms, once | The signature sweep on a marked ink page |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Entrances and state changes |
| `--ease-exit` | `cubic-bezier(0.3, 0, 1, 1)` | Exits |

Animate opacity and transform only. Nothing loops except a progress indicator for work that is actually running. Ink has no added animation, ever. `prefers-reduced-motion` removes all of it; state is still visible through icon, colour and word.

## 7. Icons

One family: `client/src/components/Icon.jsx`, 24-unit grid, 1.6 stroke, `currentColor`. No emoji, no glyph characters (✎, ✕, ▶, ↺) as icons. On touch, an icon that is not universally understood carries a visible label. Add an icon by adding a path to `Icon.jsx`, drawn on the same grid.

## 8. Layout and responsive behaviour

Form factors follow `docs/cross-platform/FORM_FACTOR_SPEC.md`: COMPACT < 600px, MEDIUM 600–839px, EXPANDED ≥ 840px, SHORT ≤ 480px tall. Input type is a separate axis: `(pointer: coarse)` sets 44px targets; `(hover: none)` means every hover reveal needs a tap or focus path.

| Surface | COMPACT (phone) | MEDIUM | EXPANDED (iPad, desktop) |
|---|---|---|---|
| Shell | Top bar, bottom bar (4 + More) | Bottom bar or rail | Rail. Fine pointer: 58px icons that open on hover or focus. Touch: 178px with labels, from 761px (coarse pointer) and from 1024px (no hover) |
| Home | One column | One column | 760px column |
| Workspace | Stacked: question, tools, answer, sticky action bar; "Question" recall bar once the prompt scrolls away | Stacked | Landscape ≥ 1000px: question 38% beside the page 62%; otherwise stacked at 820px |
| Progress | One column; facts 2×2; the table drops its "Correct" column | One column | 900px column |
| Sheets and dialogs | Bottom sheet | Centred | Centred |

The page is the only scroller, with a sticky bar above and a sticky action bar below. The question column scrolls on its own only in the split layout and contains its overscroll. Full-height surfaces use `100dvh` with a `100vh` fallback. Safe-area insets are applied on the bars.

## 9. Components

Each entry lists what it is for and the states it must have. A component is not finished until every state exists in both themes.

**Button.** `.btn-primary` (teal; one per view), `.btn-ghost` (secondary; paper with a keycap edge), `.btn-quiet` (tertiary; text). States: default, hover, pressed (1px down), focus-visible (ring), disabled (surface-3 fill, tertiary text), busy (label changes to the present participle; width does not change). Heights 36 / 42 / 50, and 44 minimum on coarse pointers.

**Disclosure.** `.btn-disclose`: a chevron and a sentence, for content that opens in place. The chevron turns when open. Use this, not a quiet button, inside the flow of a page.

**Icon button.** `.icon-btn`: 36px, 44 on touch. Needs a `title` and an accessible name; a visible label when the meaning is not universal.

**Segmented control.** `.seg`: a sunken track with one raised segment. For 2–4 mutually exclusive modes (Type / Write / Photo; Paper / Night / Match device). Selected state is shape and contrast, not colour alone.

**Field.** `.input`, `.answer-input`, `select.input`, `textarea.input`: `--control-border` edge, raised surface, 44px tall. Focus: teal edge and a soft ring. Error: red edge, an icon and a sentence below. Disabled: sunken.

**Answer sheet.** `.editor-shell`: one edged sheet holding the tools and the field. The field inside draws no second box; focus is shown once, on the sheet. Tools disappear when the question is marked.

**Multiple choice.** `.mcq-opt`: control-border edge, a lettered key, 56px tall. Selected: teal edge and tint, key filled. After marking: correct is green with a tick and the word; the chosen wrong option is copper with a pencil mark and the word.

**Tabs and filters.** `.seg-tab`, `.pill-opt`, `.gen-opt`: bordered, squared, selected by a tinted fill and a teal edge. Chips (`.chip`) show an applied filter with a labelled remove control.

**Sheet (card).** `.card`, `.pg-sheet`, `.home-next`: paper surface, hairline edge, `--radius-lg`. Use it when the content is one object. Do not stack sheets to make a page; do not put a sheet inside a sheet.

**List row.** `.set-row`, `.home-alt`: a row with a hairline below, label left, value or chevron right. Whole row is the target.

**Table.** `.syl-table`: left-aligned text, right-aligned tabular figures, a tinted head with 12px labels, hairline rows, inside a `.table-scroll` that scrolls on its own.

**Navigation.** Rail (`.sidebar`): grouped per KALP-02, selected item has a 2px teal edge and a tinted row. Bottom bar on phones. The workspace bar (`.ws-bar`): back, topic and session, filters, Next.

**Menu and tooltip.** `.acct-menu`: floating surface, 140ms entrance. Tooltips are native `title` on pointer devices and never the only way to learn what a control does.

**Dialog and sheet.** `.sheet` over `.sheet-scrim`: `role="dialog"`, focus moved into it, Escape closes, the confirming action is the only primary. (Focus is moved, not yet trapped: Tab can still leave an open sheet. Deferred.) Destructive actions are confirmed and named ("Submit paper", not "OK").

**Notice and banner.** `.notice` with `.success`, `.error`, `.offline`: an edged row with an icon, a sentence and at most one action. Offline is amber with a left rule and says what still works.

**Toast.** Used only for a result the student did not look at directly (a favourite saved). Never for marks, points or badges.

**Loading.** Skeletons (`.skeleton`) that match the shape of the content; a status line for work that takes longer than a second ("Checking your working…"). No spinners over content.

**Empty.** One sentence saying what will appear here and one action that makes it appear.

**Error.** Three different things, never confused: a wrong answer (`.verdict-bad`, copper), an unreadable answer (`.verdict-unsure`, dashed indigo), a failure of the app (`.verdict-technical`, red, "Your work is still here and nothing was lost").

**Status line.** `.status-line`: a dot and a sentence. Values: Saving on this device / Saved on this device / Offline · saved on this device / Saved on this device · waiting for sign-in / Couldn’t save on this device — your work is still on this page (with a quiet “Save again”) / Checking your working / Looking at your method / Marked on this device.

## 10. Learning surfaces

**Workspace (thinking mode).** `/practice` and `/exams/:id` remove the rail, bottom bar and account furniture. The action bar holds exactly one primary action: Submit answer → Check this reading first → Confirm reading → Submit again → Next question.

**Handwriting.** Pen, Eraser, Undo, Redo, Clear, Page (up to four sheets on one coordinate space) and Finger, which is always offered: Apple Pencil is never required. A tap-to-correct fix is dropped whenever strokes are undone, redone or cleared, so it can never land on a different symbol. Ruled paper with a copper margin rule; ink is `--ink` in both themes. Unfinished ink is kept in the profile-scoped recovery store (`components/practiceRecovery.js`), restored on resume and cleared on resolution; the status line says "saved" only after the record is read back. Recognition is answer-blind. Engine names and fallback labels are developer-only.

**Reading and uncertainty.** The reading panel shows what Pri read, one line per row. The smallest doubtful region is offered for confirmation in place. Nothing is marked on an unconfirmed reading.

**Feedback.** The header states the outcome and the mark once. The first meaningful break leads, with its diagnosis; other lines wait behind "Show all n lines". A step table restates the total only when there is more than one step. A correct answer folds the worked method behind "See another method"; otherwise the worked method sits beside the student's work. No percentages, mastery figures, points or badges in the result.

**Hints.** Shown in the question column as a ruled note; each hint is numbered; the count remaining is on the control.

**Explanation player (Pri Explain).** A board, not a chat: the question as typeset mathematics, a ruled note on why the explanation is shaped this way, one step per scene, a timeline rail. It says "This explanation cannot change your mark". The engine version is a `data-explain-engine` attribute, not chrome. Styled by `components/PriExplainInstrument.css`.

**Home.** One recommendation from the KALP-04 resolver on one sheet, with its reason. "Choose something else" holds the alternatives and the manual chooser. One quiet week line.

**Progress.** One reading column: title, the paper estimate on the page's only sheet, a ruled facts line, the syllabus table, and a note on what the page does and does not claim. Whole marks only. No percentile, rank or prediction below the evidence threshold.

**Formal assessment.** Neutral chrome; answered, unanswered and flagged states with a legend; the timer announced in words at 10, 5 and 1 minutes; confirmed submission naming unanswered and flagged questions. No hints, no explanation player, no correction colour before submission.

## 11. Graphs and diagrams

`components/PriPlot.jsx` and `Charts.jsx` take their colours from tokens: grid `--plot-grid` (7% ink), axes `--plot-axis` (24% ink), labels `--plot-label`, curves `--plot-a` teal, `--plot-b` copper, `--plot-c` indigo, points `--plot-point` (ink), shaded regions `--plot-area` (8–11% teal). Lines are 1.5–2px and never glow. A second and third curve differ by line style or direct label as well as colour. Both themes use the same roles, so a plot needs no theme-specific code.

## 12. Theme architecture

- A profile's preference is `light` (paper, the default), `dark` (night) or `system` (match device). `client/src/lib/theme.js` resolves it to exactly `light` or `dark` on `<html data-theme>`, sets `color-scheme` and the browser `theme-color`, and follows the device live while the preference is `system`.
- `client/public/theme-boot.js` runs from `<head>` before the stylesheet and paints the last preference used on this device, so a cold start does not flash the wrong paper. It is an external file so a strict script policy allows it. One exception: a night-mode profile created before this change has no device copy yet, so its first launch after the update paints paper and then changes to night; every launch after that is correct.
- A change of theme cross-fades: 200ms transitions under `html.theme-switching`, a class held for 260ms. The first paint does not animate.
- Components never branch on the theme. They use tokens.

## 13. Accessibility

WCAG 2.2 AA is the floor. Text ≥ 4.5:1; control edges and focus ≥ 3:1; targets ≥ 44px on coarse pointers; a visible 3px focus ring on everything focusable; focus never hidden under a sticky bar; every state has a word; live regions announce marking, saving and the exam timer; zoom is never disabled; reduced motion removes motion. Curriculum names carry `lang="en"` so a Hindi page voices them correctly.

## 14. Building a new screen

1. Start from the student's question: what are they here to do, and what is the one action?
2. Lay it out as a reading column with sections. Reach for a sheet only when the content is one object.
3. Use the type roles in §4; set anything mathematical in the maths family.
4. Use the components in §9. If none fits, extend one; do not invent a new radius, shadow or colour.
5. Write every state: loading, empty, error, offline, disabled, focus.
6. Check it at 360, 390, 820 and 1180px, in paper and night, with a keyboard and with reduced motion.
7. Run `npm run test:dream` and the accessibility suite.

## 15. Deferred

- Examiner margin rail with step codes, a four-rung hint ladder, and the syllabus map (designed; see the direction document).
- A third type voice for numerals and a more characterful interface face (needs self-hosted fonts and a layout-shift check).
- Consolidating `theme.css` layers and the explanation player's historical stylesheets, including the remaining sub-12px sizes in legacy rules and in pages this pass did not touch (Tasks, Classes, Teach).
- Splitting `QuestionCard.jsx` and the explanation player into composed parts.
- Physical iPad validation: Pencil latency, palm rejection, hover, squeeze, rotation with real ink, restoring a draft into PencilKit. Not available; not claimed.
- Haptics: no native haptic bridge exists.
