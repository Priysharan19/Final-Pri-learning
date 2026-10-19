# Pri Learning v1.1 — the instrument interface

Status: owner-approved 2026-10-20. Design book (interactive): https://claude.ai/artifact/KdiTJ2742ZvAo5zLB4XUnM
Supersedes the earlier v1.1 token pass (PRs #594–#600, closed).

## What it is

A matte measuring instrument: graphite at night, warm paper by day. Interface type is
Instrument Sans with IBM Plex Mono for figures; mathematics keeps KaTeX's Computer Modern;
handwriting stays the student's own. No glow, no gradients, no tinted shadows. One filled
action per screen (ivory at night, graphite by day) and one signal orange for "the scan" and
"where you are". Each chapter carries a muted print colour. Radii 2–6 px.

## Owner decisions (2026-10-20)

- Ships behind `PRI_FEATURE_INSTRUMENT` (build-time, `client/src/platform/features.js`):
  **on in staging, off in production** until v1.0 clears App Store review; then the owner flips it.
- Mark labels use **CBSE marking-scheme wording** (step marks, ½-mark steps), never B1/M1/A1.
- The theme **follows the device** by default; Settings and the command bar can fix it.

## How it is built

- `html.ui-instrument` (set by `App.jsx` only when the flag is on) remaps the legacy token
  names (`--page`, `--surface`, `--ink`, `--accent`, `--font`…) in `client/src/instrument/instrument.css`,
  so every existing screen takes the new material without a markup change. Production is untouched.
- New surfaces live in `client/src/instrument/`: `InstrumentBar` (tabs, ⌘K field, online state),
  `CommandBar` (⌘K dialog), `IndexPage` (thumb-indexed syllabus with a chapter plate) and
  `ChapterScope` (the chapter's mathematics on a graduated canvas, decorative for marks).
- Evidence on the Index is the server's (`/curriculum` answers and correct); accuracy is withheld
  below the Progress floor (`engine/progressTruth.js`). Nothing on the Index estimates a mark.
- Fonts are self-hosted (`@fontsource-variable/instrument-sans`, `@fontsource/ibm-plex-mono`),
  so the instrument works offline in the native shells.

## Build steps

1. Material, shell, Index, command bar — this PR.
2. Write & Check: writing surface, reading as you write (existing `/handwriting/transcribe`), the scan, dial and inspector.
3. Server: named CBSE step labels and per-line confidence from the working check (R4, independent review).
4. Review path and hint ladder (the #369 routes).
5. Per-chapter marks and coverage, next-chapter recommendation, syllabus map.
6. Report and Scripts with per-mark detail and saved ink.
7. Display-only plot of the student's equations.
8. Settings, sign-in, states, iPad and phone, Hindi parity throughout.

## Tests

`client/test/tour-instrument.js` builds with the flag on and walks the shell, Index, scope,
command bar, theme-follows-device, accessible names, 44 px targets and layout shift at phone,
tablet and web in both themes. All other suites build with the flag off and keep testing
the interface production ships.
