# Pri Learning v1.1 — interface redesign spec

Status: accepted direction for v1.1 (ships after the v1.0 App Store build, through normal merge trains).
Authority: this file refines `PRI-DREAM-INTERFACE.md`; where they disagree, this file wins for v1.1.
Design artifact (owner review): see the PR body / orchestrator report for the link.

## 1. Direction

"A quiet instrument on paper", made sharper. The reference bar is Linear (density and
keyboard speed), Framer (type precision), GoodNotes (the page and the pen come first) and
Atlassian (systematic tokens, predictable components). Pri borrows their discipline, not
their look.

Rules that do not change (design-system-check enforces most of them):

- One flat interaction colour, Pri teal `#0b6e69`. No gradients, glows, glass, emoji, sparkles.
- Four states never look alike: correction (copper), uncertain (indigo, dashed), bad (red,
  technical/destructive only), good (green, restrained).
- Radii stay precise: `--radius` 4px, `--radius-lg` 6px, nothing literal above 8px.
- Shadows only on things that float.
- Nothing is marked offline or signed out; the redesign changes no marking, reading or
  sign-in behaviour.

What changes in v1.1:

1. One type scale with eight steps and three weights (400/500/600) instead of ad hoc sizes.
2. Named elevation levels 0–3 and named z-layers.
3. A surface ladder (page → surface → raised → overlay) used the same way on every screen.
4. A single navigation model per size class (§4).
5. Every component in §3 has one canonical CSS class, states, and a 44pt touch target.
6. Visual regression snapshots for each screen × size × theme.

## 2. Tokens

All tokens live in `client/src/theme.css` `:root` and `[data-theme="dark"]`. New names are
additive; existing names stay as aliases so no screen breaks during the migration.

### 2.1 Type

| Token | Size / line | Weight | Face | Use |
|---|---|---|---|---|
| `--t-display` | 30/36 | 400 | math serif | screen titles on tablet/web |
| `--t-title` | 24/30 | 400 | math serif | screen titles on phone, sheet titles |
| `--t-heading` | 17/24 | 600 | Inter | section headings |
| `--t-body` | 15.5/24 | 400 | Inter | running text |
| `--t-control` | 15/20 | 500 | Inter | buttons, inputs, nav labels |
| `--t-compact` | 13.5/20 | 400 | Inter | table rows, metadata |
| `--t-label` | 12/16 | 600, +0.08em, caps | Inter | small section labels |
| `--t-caption` | 12/16 | 400 | Inter | captions, timestamps |
| `--t-math` | clamp(19–22) | 400 | KaTeX | question prose and maths |
| `--t-mono` | 13/20 | 400 | ui-monospace, tabular | counts, timers, IDs |

Hindi (Devanagari) uses the same steps with line-height +4px (`:lang(hi)` override), so the
two languages wrap to the same rhythm. Nothing heavier than 600.

### 2.2 Spacing

4px grid: `--space-0_5` 2, `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16,
`--space-5` 20, `--space-6` 24, `--space-8` 32, `--space-10` 40, `--space-12` 48,
`--space-16` 64. Page gutters: phone 16, tablet 24, web 32. Section gap 32; row gap 12.

### 2.3 Colour

Light (paper) and dark (the same notebook at night). Values are the shipped ones; v1.1
adds the ladder names.

| Role | Light | Dark |
|---|---|---|
| `--bg-base` (desk) | `#f2f0ea` | `#121210` |
| `--surface-default` | `#fbfaf7` | `#1a1a17` |
| `--surface-sunken` | `#f0ede6` | `#22221e` |
| `--surface-raised` | `#ffffff` | `#24241f` |
| `--surface-overlay` | `#ffffff` | `#2a2924` |
| `--paper` (ink canvas) | `#fdfcf9` | `#1c1c19` |
| `--text-primary` | `#1c1b18` | `#edebe4` |
| `--text-secondary` | `#48463f` | `#bebaaf` |
| `--text-tertiary` | `#6b675e` | `#969286` |
| `--border-control` (3:1) | `#85827a` | `#7b786f` |
| `--accent` | `#0b6e69` | `#5db8ad` |
| `--correction` | `#a04f24` | `#e0915f` |
| `--uncertain` | `#4a54a3` | `#a3acec` |
| `--good` | `#2d6a43` | `#7cc79a` |
| `--bad` | `#b3261e` | `#f2877d` |

Text on every surface holds 4.5:1; control borders and focus rings hold 3:1.

### 2.4 Radii

`--radius-xs` 2 (chips, marks), `--radius-sm` 3 (inputs), `--radius` 4 (buttons, cards),
`--radius-lg` 6 (question card, popovers), `--radius-xl` 8 (sheet top corners, dialogs).
No pills except the segmented-control thumb and avatars.

### 2.5 Elevation and layers

| Level | Token | Recipe | Used by |
|---|---|---|---|
| 0 | — | hairline only | cards, rows, rail |
| 1 | `--elev-1` | `0 1px 2px` 6% | sticky bars when scrolled, raised buttons |
| 2 | `--elev-2` | `0 4px 16px` 10% + 1px | menus, popovers, toasts |
| 3 | `--elev-3` | `0 12px 40px` 14% + 1px | sheets, dialogs |

Z-layers: `--z-sticky` 50, `--z-nav` 60, `--z-popover` 80, `--z-sheet` 90, `--z-toast` 100.

### 2.6 Motion

`--motion-instant` 80ms (press), `--motion-fast` 140ms (hover, toggle), `--motion-base`
200ms (reveal), `--motion-sheet` 260ms (sheet in). Easing `--ease-standard`
`cubic-bezier(.2,0,0,1)`, exit `cubic-bezier(.3,0,1,1)`. Only `transform` and `opacity`
animate. The single signature motion is the teal reading sweep on Check. Under
`prefers-reduced-motion` every duration is 0 and no transition starts.

### 2.7 Performance contract

Input to visible response < 100 ms (press state is pure CSS `:active`). CLS = 0 after first
paint: every async region reserves its height (skeleton line, not spinner); fonts are
metric-matched with `size-adjust`. Ink strokes never wait for React.

## 3. Components

Each component: one class, states (rest, hover, pressed, focus-visible, disabled, busy),
44×44 hit area, visible 2px focus ring offset 2px in `--focus`.

- **Button** `.btn` + `.btn-primary` (teal fill, one per screen), `.btn-secondary`
  (control border), `.btn-quiet` (text), `.btn-danger` (red outline, destructive only).
  Height 40 (44 on coarse pointers), padding 0 16, `--t-control`. Busy keeps width and
  swaps label for a 3-dot tick, never a spinner wheel.
- **Input** `.input`: 40/44 high, `--border-control`, radius 3, label above in
  `--t-compact` 500 (not caps), help and error below; error uses `--bad` text plus icon,
  never colour alone.
- **Segmented control** `.seg`: hairline track, raised thumb, used for Typed/Write,
  theme, filters.
- **Card** `.card`: surface-default, hairline, radius 4, padding 20 (16 phone). No shadow.
  Cards never nest.
- **Nav rail** `.sidebar` (tablet/web): see §4. Active item: teal 2px left tick + text
  primary, never a filled pill.
- **Tab bar** `.mobilenav` (phone): 4 destinations + More; 56 high + safe area;
  icon 20 over label 11/600; active teal.
- **Sheet** `.sheet`: bottom sheet on phone (drag handle, radius 8 top), centred dialog
  ≥600px; elevation 3; scrim `rgb(0 0 0 / .32)`; focus trapped, Esc closes, returns focus.
- **Toast** `.toast`: bottom-centre phone, bottom-left web; elevation 2; one line + optional
  action; `role=status`; 5s, paused on hover/focus.
- **Sign-in card**: single column 400 max, wordmark, `--t-title` heading, Apple/Google
  buttons first (equal secondary weight), email OTP below a hairline "or" rule, legal line
  in caption. No illustration, no math-symbol background.
- **Question card**: radius 6 surface-raised on desk; header row (topic · difficulty ·
  source in `--t-caption`), prompt in `--t-math`, answer area below. Typed/Write segmented
  control in the header right. Check is the only primary button, bottom-right, sticky above
  the keyboard/tab bar on phone.
- **Ink canvas chrome**: paper with 32px faint rules and copper margin line; floating
  tool strip (pen, eraser, lasso, undo, redo, clear) at elevation 2, top-centre on tablet,
  bottom on phone, collapses to a 44 handle; Pencil-only toggle visible on iPad; palm
  rejection state shown as caption. Strip never covers the last written line (canvas pads).
- **Feedback** `.feedback`: a margin column on tablet/web, below the card on phone.
  Examiner marks in copper at the line they refer to; uncertain lines dashed indigo with
  "Pri couldn't read this line" — never marked. Verdict sentence comes only from the
  engine's step evidence.
- **Transcript** `.transcript`: numbered reading lines in mono gutter + math text, each
  editable; status chip read / ambiguous / unreadable.
- **History**: dense list (Linear-style rows, 48 high): date mono, topic, result mark,
  chevron. Filters as segmented control; group headers by day.
- **Progress**: one reading column; topic rows with a 6-step sequential teal bar; no
  rings, no XP, no percentages without the count beside them.
- **Settings**: grouped list sections with labels; each row 52 high, label left, value or
  control right; destructive actions isolated in their own section at the bottom.

## 4. Layouts

| Size class | Width | Nav | Gutter | Content |
|---|---|---|---|---|
| Phone | < 600 | top bar 48 + bottom tab bar 56 | 16 | single column |
| Tablet | 600–1099 | icon rail 72 (icon + 11px label) | 24 | 760 column; question card + 280 margin column ≥ 900 |
| Web | ≥ 1100 | labelled rail 220, sections | 32 | 760 reading / 820 canvas; feedback margin 300 |

Keyboard first: `/` focuses search, `g p` Practice, `g h` History, `g s` Settings,
`⌘↵` Check, `[`/`]` previous/next question, `e` eraser, `p` pen, `⌘z` undo. Shortcuts listed
in a `?` sheet. Pencil first: pencil writes, finger scrolls (unless finger-ink enabled).

Screens: Home, Practice (question card + ink), Feedback, History, Progress, Settings,
Sign-in. Each gets visual snapshots at phone 390×844, tablet 820×1180, web 1440×900, light
and dark.

## 5. Implementation sequence

One surface per branch from `origin/main`, each independently reviewed:

1. Tokens and theme (additive tokens, aliases, Hindi line-height, reduced motion) — this branch's sibling.
2. Shell and nav (rail, tab bar, top bar).
3. Sign-in card.
4. Practice: question card + ink chrome.
5. Feedback and transcript.
6. History and Progress.
7. Settings.

Every branch keeps all `data-*` hooks, roles, labels and i18n keys; adds snapshots for its
screens; never weakens a test.
