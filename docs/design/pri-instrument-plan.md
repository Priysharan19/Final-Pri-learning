# Pri "quiet instrument" interface: implementation plan

Status: plan, 2 Oct 2026. Evidence: [pri-instrument-interface-research.md](pri-instrument-interface-research.md) (synthesis) and [research-notes/](research-notes/) (sources per topic). Visual design canvas with seven artboards (interactive Write screen, Home, Syllabus map, Exam script, Phone at night, Teacher pacing, System sheet): https://claude.ai/artifact/YMkRsk23ZM3Ur9FWk147TT (private until shared by the owner).

## Direction in one paragraph

Pri looks like a well-kept CBSE answer book and behaves like a precise instrument. Matte paper, the student's ink as the hero, one teal action per screen, three type voices (maths serif, interface sans, tabular mono numerals). A reading strip shows a faint typeset echo of each handwritten line; unsure readings are dashed indigo and are never marked; marks sit in a right-hand margin rail in examiner grammar (✓ M1, ✗ A0, ft) and come only from the deterministic engine. The one signature "futuristic" moment is a 1 px teal reading line that sweeps the page on Check while ticks land line by line behind it. Futurism lives in behaviour, not glass or glow.

## Already landed (task/dream-interface, production interface session)

Radii 2–6 px, flat teal on one primary action, keycap secondary buttons, question prose in the maths face, wordmark fixed, CI gates on gradients / glow / radius > 8 / literal colours / emoji (`client/test/design-system-check.mjs`), copper correction and dashed indigo uncertainty on ink. This plan covers what remains.

## Work items

| # | Item | Files | Risk | Acceptance |
|---|---|---|---|---|
| 1 | **Reading strip** — per-line typeset echo in the canvas gutter, three states (read / ambiguous with 2–3 alternatives / unreadable "?") | `client/src/ink/InkAnswer.jsx`, `InkCanvas`, recogniser adapter | R4 | Recogniser input contains ink only (test asserts no expected answer, solution or hint in the request). Unsure line renders no mark and an ask. Tapping an alternative records a student confirmation, not a model guess. |
| 2 | **Margin marks rail** — ✓ / ✗ / ? glyph + step code per line, total in board idiom ("2 / 3"), follow-through shown | `QuestionCard.jsx`, `StepReport`, `engine/cbseMarking.js` (read-only) | R4 | Rail renders engine output only; snapshot test that identical ink + transcript always yields identical rail. No mark element exists before Check. |
| 3 | **Check gate + sweep** — judgement held until Check; teal sweep 1100 ms then marks staggered 170 ms; reduced-motion = opacity only, no sweep | `QuestionCard.jsx`, `theme.css` motion tokens | R2 | Marks hidden while writing; `prefers-reduced-motion` test; verdict renders < 300 ms after Check from bundled engine. |
| 4 | **Explanation after the mark** — separate typographic voice, labelled "cannot change the mark" | `PriExplain` | R4 | Explanation component cannot write to mark state (prop is read-only; test). |
| 5 | **Hint tray, four rungs** — orient / strategy / partial step / worked step; next rung needs a written line or ~20 s dwell; rung 4 queues a similar item and withholds Proficient credit | `.hint-rail`, hints data, mastery model | R3 | Rung 4 use recorded honestly; rung content never sent to recogniser. |
| 6 | **Three type voices** — Instrument Sans (OFL) for chrome, Geist Mono (OFL) tabular for numbers, KaTeX `.katex{font-size:~1.08em}` | `theme.css`, `index.html` fonts (self-hosted) | R2 | Fonts self-hosted; no layout shift on question number / timer updates. |
| 7 | **Home** — one heading, generate bar, one mono facts line, one recommended set with "why", continue card with ink thumbnail | `pages/Home.jsx` | R2 | GoalCard / DiamondTrack / suggestion collapsed; private weekly count ("4 of 7 days"), no loss-based streak copy. |
| 8 | **Phone layout** — pinned stem, per-line reading list with glyph column, small line-at-a-time pad, keypad / photo / hint / Check bar, offline label | `PracticeBase.jsx`, CSS ≤ 760 px | R2/R3 | Works at 360×740; 44 px targets; nothing sensitive in notifications. |
| 9 | **Syllabus map** (follow-up already noted by the production session) — NCERT chapter lines, four-segment Khan-style bars, weak-link annotation, board-mark estimate only with enough evidence | `pages/Progress.jsx`, `Charts.jsx` | R3 | No percentage-only mastery; estimate hidden below evidence threshold. |
| 10 | **Exam room** — CBSE section structure (A 20×1, B 5×2, C 6×3, D 4×5, E 3×4 = 80; verify against the official sample paper), no hints or live marking, annotated script after submit | `pages/ExamRoom.jsx` | R3/R4 | Hints and live marking unavailable in exam route (test). |
| 11 | **Teacher pacing** — student × question grid with glyph-coded cells, anonymised ink snapshots of common slips, logged overrides | `pages/Teach.jsx`, server routes | R4 | RLS + server authz test: teacher sees only own classes; override is logged and visible to student. |
| 12 | **Docs** — replace stale `docs/design/KALP-01-design-system.md` direction with this system | docs | R1 | KALP-01 matches `theme.css`. |

Suggested order: 6 → 3 → 2 → 1 → 4 → 5 → 7 → 8 → 9 → 10 → 11, with 12 alongside 6. Items 1, 2, 4 and 11 need independent R4 review per AGENTS.md.

## Not claimed

No learning-outcome, accuracy or superiority claims follow from this design. Colour values need APCA and colour-blind validation. Before any claim of benefit, run a small usability study with real Class 8–10 students on real iPads and shared phones, recorded separately from simulator evidence. Whether Pri's mastery model fits the DPDP education exemption is a question for counsel.
