# Pri Learning Design System — KALP-01

Status: implemented on `task/kalp-01-design-system`.

`client/src/theme.css` is the canonical visual layer for KALP-01; `client/src/theme-state.css` is its small semantic-state companion loaded immediately after it so decorative gold never aliases the warning token. Together they preserve existing product behaviour and selectors while replacing reference-derived styling with Pri's own system.

## Principles

- Calm, academically serious, premium rather than corporate.
- Inter for interface text; KaTeX/Computer Modern only for mathematics.
- Pri identity: midnight surfaces, learning blue, supporting mint and warm signal colour.
- Semantic state tokens for success, error, warning, information, focus and disabled states.
- One identity across phone, iPad/tablet and desktop/teacher workspaces.
- Touch navigation must never depend on hover.

## Tokens

Typography: `--font`, `--font-display`, `--font-math`, `--font-mono`.

Spacing: `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--space-8`, `--space-10`, `--space-12`, `--content-gutter`.

Core colour roles: `--page`, `--surface`, `--surface-2`, `--surface-3`, `--surface-raised`, `--ink`, `--ink-2`, `--ink-3`, `--brand-1`, `--brand-2`, `--brand-grad`, `--brand-soft`, `--brand-ring`, `--good`, `--bad`, `--warn`, `--info`, `--focus`, `--disabled`.

Shape/depth: `--radius-xs`, `--radius-sm`, `--radius`, `--radius-lg`, `--radius-pill`, `--shadow-sm`, `--shadow`, `--shadow-focus`.

Motion: `--motion-fast`, `--motion-base`, `--motion-slow`, `--ease-standard`, `--ease-emphasized`.

## Shared primitives

KALP-01 consolidates the existing class-based primitives rather than introducing a parallel component library. Canonical shared styles cover buttons, inputs, cards, tags/chips, global navigation, loading/empty/error states, question editor, feedback/evaluation surfaces and Pri Explain.

## Core demo adoption

Login/first entry, Home, Practice/question/answer controls, feedback, Pri Explain, Progress, Exams, Tasks, Teach, Settings and global navigation all consume the canonical token layer. Auth, grading, curriculum, billing, sync, handwriting and API contracts are unchanged.

## Responsive rules

Phone (<=760px): compact header, bottom navigation, 14px gutter, stacked cards and existing overflow protections.

Tablet/iPad (761–1180px, coarse pointer): persistent 178px labelled sidebar, no hover-only navigation, 48px nav rows, 44px primary touch targets, 24px content padding and full-width question workspace.

Desktop: compact icon rail with hover expansion and a 1240px content cap for teacher/data-heavy surfaces.

## Dark/light

The existing `data-theme` preference contract remains authoritative. KALP-01 changes semantic values, not persistence or account authority.

## Maths

Interface text uses Inter; KaTeX/equations use `--font-math`. Question prose, metadata, typed preview, final answer and verdicts remain visually distinct without changing marking logic.

## Accessibility baseline

- 3px `:focus-visible` outline via `--focus`.
- semantic controls preserved.
- explicit disabled treatment.
- reduced-motion override effectively removes animation/transition time.
- touch-size rules for tablet/phone.
- important states retain text/icon structure and do not rely on colour alone.

## Migration guidance

Use existing primitives first; use semantic tokens before literal values; keep maths on `--font-math`; verify phone, coarse-pointer tablet and desktop; keep domain authority out of the visual layer.

## Verification

`client/test/design-system-check.mjs` enforces token, originality, responsive and accessibility contracts. `client/test/tour-kalp01-design.js` drives the real built app through first entry, a real profile, Home, Practice, feedback, Progress, Exams, Tasks, Teach and Settings at tablet/desktop/phone sizes and writes screenshots to `artifacts/kalp-01/`. `.github/workflows/kalp-01-design-system.yml` runs these alongside existing browser, accessibility, Pri Explain and India-surface regressions.

## Deferred

Physical-iPad evidence remains separate if no device is exposed. Store imagery, full localisation/accessibility work, onboarding architecture, Practice interaction redesign, handwriting/Pencil/native engineering and backend/API work are outside KALP-01.
