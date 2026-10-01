# Form-Factor Specification (CP-01)

Baseline: `main` @ `421f1ff1`. Active stylesheets are `client/src/theme.css` and `client/src/theme-state.css`, both imported by `client/src/main.jsx`. `client/src/theme-legacy.css` is not imported anywhere and is dead code; CP-03 deletes it.

## 1. Current state (audit)

- **Breakpoints:** no system exists. The ad hoc width values are 720, 760/761, 820, 860, 900, 980, 1000, 1020 and 1180 px. One `(pointer: coarse)` rule makes the 761–1180 px "tablet sidebar". There are **no** orientation, `hover`, or container queries.
- **Shell:** at ≤760 px, a fixed `.mobilenav` (4 destinations + More sheet). Between 761 and 1180 px with a coarse pointer, a 178 px labelled sidebar. With a fine pointer, a 58 px rail that expands on hover. A phone in landscape is wider than 760 px, so it receives the tablet sidebar.
- **Viewport:** `client/index.html` sets `width=device-width, initial-scale=1, viewport-fit=cover`. Zoom is allowed, and `client/test/a11y-gate.mjs` enforces that. Six uses of `100vh`, no `dvh`/`svh`, no `visualViewport`.
- **Safe area:** only the top and bottom insets are handled. In standalone PWA mode the top bar's fixed height (64/58 px) swallows the inset. In the Apple shell the web view is inset by SwiftUI, so CSS insets are 0. This was observed on the iPhone 17e simulator.
- **Existing phone coverage:** `client/test/tour-phone.js` runs at 390×844 and 360×800 in the required browser E2E job. It covers destinations, horizontal overflow, ≥44 px targets in **type** mode, and that Next is uncovered *before* answering. `client/test/tour-kalp01-design.js`, `client/test/tour-kalp02-navigation.js` and `client/test/tour-kalp03-onboarding.js` add phone and iPad portrait/landscape checks in path-filtered workflows.

## 2. Semantic form factors (production definition)

Form factors are chosen by **available viewport width in CSS px** (the window, not the device). Input type is a *separate* axis. The same rules then cover iPad Split View, Android multi-window and foldables without any device sniffing.

| Class | Width | Typical devices | Shell layout | Answer default |
|---|---|---|---|---|
| **COMPACT** | `< 600px` | All iPhones (portrait), Android phones (portrait), iPad Slide Over, narrow split | Bottom bar (4 + More), single column, full-width question, sheets instead of popovers | Coarse pointer → **write with finger** (stylus if seen); typed always one tap away |
| **MEDIUM** | `600–839px` | Foldables unfolded portrait, small tablets portrait, iPad mini portrait (744), phones in landscape, iPad split view | Bottom bar **or** rail (rail if height ≥ 480), single column with wider ink area; side rails inline | Same as compact |
| **EXPANDED** | `≥ 840px` | iPad portrait/landscape (≥ 820), Android tablets, desktop | Sidebar/rail, two-pane question (rails beside), current iPad experience | Pencil/stylus write; finger toggle |

**Height modifier `SHORT`:** `max-height: 480px`. This covers phone landscape and a soft keyboard that is open. It hides decorative chrome, collapses the top bar to 44 px, and makes the ink area scroll *with* the page instead of being pinned.

**Input axis** (CSS media features; never user-agent sniffing):
- `(pointer: coarse)` sets 44 px targets and finger affordances.
- `(hover: hover)` gates hover-only reveals. Every hover reveal must also have a focus/tap path.
- A stylus is a runtime fact: a `pen` pointer was seen (shared `InkCanvas.jsx`) or `__PRI_HOST__.capabilities.ink.stylus` is set.

### 2.1 Tokens (CP-03 introduces them)

```css
:root {
  --bp-medium: 600px;   /* documentation token; media queries use literals */
  --bp-expanded: 840px;
  --tap-min: 44px;
  --pri-inset-top: env(safe-area-inset-top, 0px);
  --pri-inset-bottom: env(safe-area-inset-bottom, 0px);
  --pri-inset-left: env(safe-area-inset-left, 0px);
  --pri-inset-right: env(safe-area-inset-right, 0px);
  --pri-ime-bottom: 0px; /* set by the shell/visualViewport when the keyboard is open */
}
```

The 600/840 split matches Android's window-size classes and keeps every current iPad width (≥ 744 portrait mini, ≥ 820 others) out of COMPACT. CP-03 migrates the existing 760/1180 rules onto these classes, **with iPad landscape and portrait screenshots held as regression baselines**.

## 3. Surface-by-surface adaptation

"Phone" means COMPACT. Each verdict comes from code reading plus existing tests; anything marked unverified is unverified.

| Surface | Current phone verdict | COMPACT target | MEDIUM | EXPANDED (iPad baseline, unchanged) |
|---|---|---|---|---|
| Onboarding (`client/src/pages/Login.jsx`) | Likely OK. No top inset in standalone mode; `.pathway-row` is 2 columns at 139 px | One question per screen, sticky Continue above the keyboard, `.pathway-row` → 1 column under 400 px | As compact, wider card | Current split hero |
| Signup/login | Likely OK (`.auth-card` max-width 100%) | Full-bleed card, `autocomplete`/`inputmode=email`, password manager friendly | Centred card | Current |
| Home (`client/src/pages/Home.jsx`) | Likely OK; overflow-tested at 360/390 | One "next best action" card first, then streak/tasks; topic panel becomes a sheet | 2-column cards | Current command centre |
| Learn (chapter sections) | Unknown; 5-column exercise grid cramped | Chapter list → chapter detail (push navigation), tables scroll horizontally inside cards | 2-pane if ≥ 720 | Current |
| Practice (`client/src/pages/PracticeBase.jsx`) | OK before answering; **suspected** overlap of the Pri Explain launcher (`client/src/components/PriExplainV5.css`, fixed bottom-right) with Next after answering | Single primary action bar (Check → Next) pinned above the safe area; explain becomes a button in the feedback card, not a floating launcher | Same | Current |
| Question screen (`client/src/components/QuestionCard.jsx`) | Likely OK; rails go inline at ≤1180 | Prompt → answer area → actions, no side rails; hints in a bottom sheet | Inline rails | Two-pane |
| Handwriting/working area (`client/src/ink/InkAnswer.jsx`, `client/src/ink/InkCanvas.jsx`) | **Poor:** fixed 380 px canvas, `touch-action:none` blocks scrolling, developer notice shown to students, 7-button toolbar wraps to 3 rows, strokes not rescaled on resize | Canvas height = available height minus action bar (min 240, grows with "+ space"); explicit scroll/draw mode (two-finger scroll), compact toolbar (pen/eraser/undo/clear + overflow), no developer copy, strokes stored in a normalised space or rescaled on resize | Same, larger | PencilKit (native) or canvas; unchanged |
| Answer entry | Partial: no `inputMode`/`enterKeyHint`; Σ palette keys 30 px | `inputMode="decimal"` for numeric answers, `"text"` for expressions; `enterKeyHint="done"`; palette keys ≥ 44 px in a scrollable row above the keyboard | Same | Current |
| AI feedback (Pri Explain, working comments) | Likely OK; dialog uses `97vh` | Full-screen sheet using `100dvh`, close button in thumb reach, comments stacked under the canvas | Sheet | Side panel |
| Progress (`client/src/pages/Progress.jsx`) | India: likely OK. Non-India `client/src/pages/ProgressLegacy.jsx`: **overflows** (`1fr 330px` inline grid); knowledge map is mouse-only | Single column; knowledge map becomes a list with drill-down; touch pan/zoom if the map stays | 2 columns | Current |
| Exams (`client/src/pages/Exams.jsx`, `client/src/pages/ExamRoom.jsx`) | List OK; exam room unknown (40 px question dots); print sheet keeps 52 px padding | Question navigator as a sheet; timer in the top bar; print disabled or bridged | Same | Current |
| Assignments/tasks (`client/src/pages/Tasks.jsx`, `client/src/components/AssignmentInboxPanel.jsx`) | Likely OK | Card list, due date first | Same | Current |
| Profile/settings (`client/src/pages/Settings.jsx`) | Likely OK, except the inline email editor row overflows (`client/src/pages/SettingsLegacy.jsx`) | Settings list → detail pages; editors stack vertically | List + detail | Current grid |
| Subscription/paywall (`client/src/components/FreeCapNotice.jsx`, `client/src/components/CloudAccountPanel.jsx`) | Likely OK (inline card, wrapping buttons) | Plan cards stacked; store-specific button (App Store / Play) chosen by `billing.store` capability, never by OS sniffing | Same | Current |
| Teacher (`client/src/pages/Teach.jsx`) | Unknown; tables scroll; not phone-tested | **Supported but secondary:** read/triage on phone (class list, assignment status); authoring recommended at MEDIUM+ with an explicit note | Full | Current |
| Guardian (`client/src/pages/AccountAction.jsx`) | Likely OK | Unchanged | — | — |

## 4. Rules that apply everywhere

1. **No device sniffing for layout.** `navigator.userAgent`, `__PRI_HOST__.platform` and "isIPad"-style checks are forbidden in layout code. The architecture check enforces that `navigator.userAgent` stays out of `client/src`.
2. **Never scale the tablet UI down.** COMPACT is a distinct composition, not a zoomed EXPANDED.
3. **Touch targets** must be ≥ 44×44 CSS px at COMPACT/MEDIUM with a coarse pointer. Today's exceptions to remove: `.btn-sm` 36, `.sym-key` 30, `.ink-sym` 30, `.exam-dot` 40, photo-thumb remove 22.
4. **Dynamic viewport units:** use `dvh` with a `vh` fallback for full-height layouts and sheets.
5. **Safe area:** all four insets go through `--pri-inset-*`. Fixed bars add the inset to their *height*; they do not pad inside a fixed height.
6. **Keyboard:** primary actions stay visible above the IME (`visualViewport` in browsers, `--pri-ime-bottom` from the Android shell).
7. **Rotation** must preserve the in-progress attempt: answer text, ink strokes and timer.
8. **Hover:** hover-only information is forbidden; every `:hover` reveal needs `:focus-visible` and a tap equivalent.
