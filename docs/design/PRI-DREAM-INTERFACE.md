# Pri Learning — the instrument interface

Status: implemented on `task/dream-interface`. Supersedes the visual identity in
`KALP-01-design-system.md` (midnight surfaces, gradient brand); KALP-01's
token names, selectors and accessibility baseline are retained.

## Authority and reconciliation

The brief for this work names three locked product authorities —
`PRI_STUDENT_EXPERIENCE_SPEC.md` (K1), `PRI_DESIGN_SYSTEM.md` (K2) and
`PRI_FEEDBACK_EXPERIENCE.md` (K3). **None of the three exists on any branch of
the repository** (checked against every remote branch on 2026-10-02). The only
in-repo design authorities are KALP-01/02/03 and the KALP-04 Home policy
(PR #240).

- `K1_RECONCILIATION_REQUIRED` — no K1 document. Experience behaviour here
  follows the brief text, KALP-02 (navigation) and KALP-04 (Home policy).
- `K2_RECONCILIATION_REQUIRED` — no K2 document, and KALP-01 contradicts the
  brief (midnight + blue/mint gradient vs warm paper + flat teal + copper).
  This branch implements the brief's identity. One deliberate deviation:
  mathematics stays on KaTeX's own Computer Modern metric fonts rather than STIX
  Two Math, because KaTeX's layout metrics (fractions, radicals, sub/superscript
  shifts) are computed for its fonts; substituting STIX would mis-set them.
  Question prose is set in the same face so equations never look pasted in.
- `K3_RECONCILIATION_REQUIRED` — no K3 document. Feedback follows the brief's
  three questions (what happened, where to look, what next). One nuance: the
  existing scratch pad is stored with the attempt for the student's own replay
  (History) but never marked, so it is labelled **"Not marked"** rather than
  "Not submitted" — the latter would be untrue.

Smallest reconciliation: commit the three documents, or ratify this file plus
KALP-02/04 as K2 and the feedback section below as K3.

## Identity

A pristine mathematical notebook crossed with a scientific instrument.

| Role | Paper (default) | Night |
| --- | --- | --- |
| Desk `--page` | `#f2f0ea` | `#121210` |
| Paper `--surface` | `#fbfaf7` | `#1a1a17` |
| Ink `--ink` | `#1c1b18` | `#edebe4` |
| Interaction `--accent` (only one) | `#0b6e69` | `#5db8ad` |
| Mathematical correction `--correction` | `#a04f24` copper, solid rule | `#e0915f` |
| Reading uncertainty `--uncertain` | `#4a54a3` indigo, dashed | `#a3acec` |
| Technical/destructive `--bad` | `#b3261e` red, heavy rule + icon | `#f2877d` |
| Correct `--good` | `#2d6a43` | `#7cc79a` |

Rules enforced by `client/test/design-system-check.mjs`: no decorative
gradients, no glows, no literal colours below the token block, radii ≤ 8px
(tokens 2/3/4/6px), no emoji in chrome, one icon family
(`client/src/components/Icon.jsx`, 24-unit grid, 1.6 stroke), focus ring 3px.

Typography: Inter for interface chrome; KaTeX Computer Modern for mathematics
and question prose. Motion tokens: instant 80ms, fast 140ms, standard 200ms,
focus 180ms, sheet 260ms; reduced motion removes all of it.

## Surfaces

- **Home** — one recommendation from the deterministic KALP-04 resolver
  (`client/src/home/recommendation.js`): exam in progress, assignments, resume,
  reviews, daily goal, adaptive, first practice. Reasons are worded from the
  action's own data only. "Choose something else" holds alternatives and the
  manual chooser. A quiet week line replaces the dashboard cards.
- **Workspace (thinking mode)** — `/practice` and `/exams/:id` remove the rail,
  bottom bar and account furniture. One bar: Home, topic, session, Next.
  Landscape tablets (≥1000px, landscape) split 38/62: question beside the page.
  Portrait and phone stack, with a "Question" recall bar and sheet once the
  prompt scrolls away. The action bar holds exactly one primary action:
  Submit answer → Check reading → Confirm reading → Submit again → Next question.
- **Handwriting** — Pen, Eraser, Undo, Redo, Clear, Page (up to 4 sheets on one
  coordinate space), Finger (browser only). Ruled paper with a margin rule.
  Unfinished ink is saved to the question's own sealed row
  (`POST /practice/:id/ink-draft`), restored on resume, dropped on resolution,
  serialized with submit under the per-question lock.
- **Status** — reports only what the device knows: Saving on this device /
  Saved on this device / Offline · saved on this device / Not saved — keep this
  screen open / Checking your working / Looking at your method (only while the
  optional server check is actually running) / Marked on this device.
- **Feedback** — the first meaningful break leads with its diagnosis; other
  lines wait behind "Show all n lines". Ink feedback is drawn on the student's
  own lines. A correct answer folds the worked method behind "See another
  method"; otherwise the worked method sits beside the student's work.
  No mastery %, skill deltas, XP or badge pop-ups in the result.
- **Recognition uncertainty** — the smallest region (one symbol) is offered
  for confirmation in place; nothing is marked on an unconfirmed reading.
- **Session end** — crossing today's goal offers "Done for today".
- **Formal assessment** — neutral chrome; answered / unanswered / flagged
  states with a legend; timer announced in words at 10, 5 and 1 minutes;
  on-device save status; confirmed final submission naming unanswered and
  flagged questions. No hints, no Pri Explain, no correction colour before
  submission.

## Verification

- `client/test/dream-interface-check.mjs` — recommendation scenarios and
  workspace contracts (one primary action, truthful status, ink drafts,
  uncertainty, state separation, first-break, scratch labelling, no learner
  numbers, exam rules, components calling `t()` without `useT()`).
- `client/test/design-system-check.mjs` — identity and anti-template lints.
- `client/test/backend-check.mjs` — ink draft save/restore/clear/isolation.

## Deferred

- Physical iPad: Pencil latency, palm rejection, hover, squeeze, rotation with
  real ink, restoring ink into PencilKit via `setStrokes` — not validated.
- Haptics: no native haptic bridge exists yet.
- Examiner-grammar margin marks, a gated hint ladder and a check-sweep motion
  (research PR #258) are marking-adjacent (R4) and need independent review.
- Syllabus/prerequisite map as a flagship Progress surface.
