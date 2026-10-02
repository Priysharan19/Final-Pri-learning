# Pri dream interface: visual direction

Status: 2 Oct 2026. Decision record. Evidence is in [PRI_DREAM_INTERFACE_RESEARCH.md](PRI_DREAM_INTERFACE_RESEARCH.md); the resulting system is in [PRI-DREAM-INTERFACE.md](PRI-DREAM-INTERFACE.md).

## Thesis

**Pri is an examiner's notebook that reads.** The page is paper. The student's working is the largest thing on it. Pri behaves like a careful examiner looking over the page: it shows what it read, asks when it is unsure, marks in the margin, and says what to do next. Everything that is not the question, the working or the mark gets quieter as the student goes deeper.

In one line: *the interface becomes quieter as the thinking becomes deeper.*

## Three directions considered

Each was reasoned through against the same five screens (Home, practice with handwriting, feedback, Progress, the explanation player) in both themes. Only the chosen direction was built and rendered; A and C were evaluated as written concepts, not as mock-ups. They differ in composition, surface philosophy, density, type emphasis and what "intelligence" looks like, not only in colour.

### A. Editorial Proof

A typeset mathematics text. One serif for everything, a narrow centred column, almost no surfaces, rules instead of boxes, generous white space. Interaction is minimal and link-like.

- Composition: single column everywhere, including the workspace.
- Surfaces: one. No cards.
- Density: low.
- Type: serif throughout, chrome included.
- Intelligence: footnotes and marginalia in type.
- Dark: an inverted page.

### B. Examiner's Notebook

A ruled exercise book on a desk, with instrument-like controls around it. Two type voices: the maths face for anything mathematical, a neutral sans for controls. The workspace splits into question and page on a wide screen. Marks are made in the margin in examiner grammar. Three surfaces (desk, paper, raised).

- Composition: content-first; split workspace on tablets, stacked on phones.
- Surfaces: three, ordered by lightness, divided by hairlines.
- Density: medium, and lower in thinking mode.
- Type: maths serif for questions and working, Inter for chrome, tabular numerals for figures.
- Intelligence: a reading strip, a reading line, margin marks, a board beside the working.
- Dark: the same notebook at night, designed separately.

### C. Quiet Console

A dark-first instrument panel. Monospaced numerals, a command bar, dense panels, contextual tools that appear at the pen tip, intelligence as a floating assistant layer.

- Composition: multi-panel, tool-like.
- Surfaces: many thin panels.
- Density: high.
- Type: sans and mono.
- Intelligence: a contextual panel and command palette.
- Dark: the primary theme; light is secondary.

## Evaluation

Scored 1–5 against the brief's criteria. Scores are design judgement, not measurements.

| Criterion | A · Editorial Proof | B · Examiner's Notebook | C · Quiet Console |
|---|---|---|---|
| Learning focus | 5 | 5 | 3 |
| Mathematical clarity | 5 | 5 | 4 |
| Originality for Pri | 3 | 5 | 2 |
| Scalability to new screens | 3 | 4 | 4 |
| Accessibility | 4 | 5 | 3 |
| Light mode | 5 | 5 | 2 |
| Dark mode | 3 | 4 | 5 |
| iPad with Pencil | 3 | 5 | 3 |
| Phone | 4 | 4 | 2 |
| Implementation feasibility | 3 | 5 | 2 |
| Long-session comfort | 4 | 5 | 3 |
| Visual identity | 4 | 5 | 2 |

Why A was not chosen: it is beautiful for reading and weak for doing. A serif-only chrome makes controls look like prose, a single column wastes a landscape iPad, and the handwriting tools have nowhere to live. It also has no answer for Progress or the exam room beyond "more text".

Why C was not chosen: it reads as a developer tool and an AI demo, the two things the brief says Pri must not feel like. Dark-first contradicts the legibility evidence for long study sessions. Dense panels raise cognitive load for 12-to-16-year-olds. It would also be a rewrite.

## Decision

**B, with two things taken from A and one from C.**

- From A: the typographic discipline. Question prose in the maths face; hierarchy by size and space before weight; rules instead of boxes wherever grouping does not need containment. Progress became one reading column for this reason.
- From C: figures behave like instrument readouts. Marks, timers, counts and table columns are tabular and right-aligned, and they do not move when they update.
- Not an average: A's serif chrome, A's single-column workspace, C's panels, C's command surface and C's dark-first stance are all left out.

B was also the direction the first research round reached independently ("a quiet instrument on paper") and the one the branch had begun to implement. This record confirms it against two serious alternatives rather than assuming it.

## What Pri should and should not feel like

Should: intelligent, calm, curious, precise, supportive, advanced, human, trustworthy, academically serious, and now and then quietly surprising (the reading line).

Should not: corporate, sterile, childish, gamified, loud, neon, cluttered, template-made, like a developer tool, like an AI demo, like a dashboard.

## The motifs (exactly three)

1. **Ruled paper with a margin rule.** Wherever work is written: the handwriting page, the first-entry screen. Never as wallpaper behind chrome.
2. **The margin grammar.** Tick (green), pencil mark (copper), question mark in a dashed ring (indigo), warning triangle (red, technical only). The same four marks in feedback, on ink, in Review and in the exam script.
3. **The reading line.** One teal hairline that passes down a handwritten page once when the engine has marked it.

Anything else that looks like a motif (accent bars, badges, pills, halos, gradients) is removed. A decorative element has to answer: does it improve clarity, comprehension, confidence, orientation or emotional quality? If not, it goes.

## Pri signature moments

Each one exists because it helps learning. None delays a result.

| Moment | What happens | Why it earns its place | State |
|---|---|---|---|
| The reading line | When the deterministic engine has marked a handwritten page, one teal hairline travels down the page in 640ms. Absent under reduced motion. Never on a technical failure or an unreadable page. | Tells the student the whole page was read, in the visual language of an examiner's eye, without a spinner or a celebration. | Implemented |
| Unsure is never wrong | A symbol the recogniser doubts is offered for confirmation in place (dashed indigo). Nothing is marked until the student confirms. | Separates "Pri misread me" from "I made a mistake". | Implemented (earlier in this branch) |
| The first break leads | Feedback opens on the first line where the working breaks, with its diagnosis; other lines wait behind one disclosure. | Elaborated, task-focused feedback is the kind that helps. | Implemented (earlier in this branch) |
| The work stays put | The status line reports what the device knows: saving, saved on this device, offline but saved, not saved. Ink is reported saved only after the record is read back. | A student never wonders whether Pri kept the page. | Implemented |
| A board beside your working | The explanation player replays the student's own attempt first, then the verified steps, and says it cannot change the mark. | Explanation is separate from marking, and visibly so. | Implemented (restyled in this pass) |
| Examiner margin rail | Step codes (M1, A0, ft) in a right-hand rail on the ink page. | Board idiom students already trust. | Designed, not implemented (marking-adjacent, R4) |
| Four-rung hint ladder | Orient, strategy, partial step, worked step, with friction between rungs. | Reduces bottom-out hint abuse. | Designed, not implemented (R3) |
| Syllabus map | Chapters as a prerequisite map with evidence per outcome. | Makes progress legible without a percentage. | Designed, not implemented (R3) |
