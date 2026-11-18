# Meaning beyond colour: marking and feedback states (Standard principle #36)

Rule: a correct, incorrect, partial or pending state is never carried by colour alone; each has a word or a mark (icon or glyph) that says the same thing.

## How it is held
- **In the accessibility walk** (`client/test/a11y-check.mjs`, section "colour is never alone"): on every view the walk opens, any visible element whose text, background or border is one of the verdict colours (good, bad, warn) must also carry a word or a mark in its own text or `aria-label`. It reads the computed colours, so it follows the real theme in both themes.
- **By reading the marking and feedback components** (this audit), because the walk can only judge the views it reaches and the states it drives.

## Surfaces read and what each uses beside colour
| Surface | Colour carries | Also carries |
|---|---|---|
| Multiple choice after marking (`QuestionCard`) | right / wrong option fill | a word on the option: "Correct option" / "Your choice" |
| Handwriting line verdicts (`InkAnswer`) | green / red line boxes | a check or correction icon at the line, an underline under a broken line, and spoken text per line ("line 2 is correct") |
| Step marks (`StepMarks`, `MarkStrip`) | row tint | the marks as numbers, "2/3", plus a spoken "marks earned" text |
| History and Favourites (`History`, `Favorites`) | green / red verdict chip | check or correction icon (History), tick or cross glyph (Favourites), plus spoken "correct" / "incorrect" / "not marked" |
| Placement result (`Placement`) | right / wrong link | tick or cross glyph, plus spoken text |
| Exam result, whole-question tags (`ExamRoom`) | good / warn / bad tag colour | the words "Correct", "Partial", "Wrong" with the marks |
| Exam result, per-part tags (`ExamRoom`) | good / bad tag colour | **was marks only ("2/3") with a spoken suffix; now also a check or correction icon** and `data-part-verdict` |
| Topic map nodes (`instrument/MapPage.jsx`) | mastery fill | a text line under each node (`metaOf`) and a list view of the same nodes |

## Finding fixed
- `ExamRoom` per-part tag: visually only the awarded/total marks in green or red. A reader who cannot tell the colours apart could not tell a full-mark part from a lost one without doing the arithmetic. It now shows a check (full marks) or a correction mark (any mark lost, including partial credit, where the numbers say how many) beside the numbers; the spoken text was already there. The whole-question tag keeps its own word, "Partial".

## Not covered (stated plainly)
- Surfaces reached only through states the walk does not drive (for example a long exam in progress) are covered here by reading, not by the walk's rule.
- Charts that encode series in colour (Insights, Report) carry labels and values in text; the legend swatches are decorative beside them. They were read but not changed.

## Spoken maths and the accessibility tree
Formulas are `role="math"` with a spoken `aria-label`; the KaTeX and its MathML stay in the DOM but are `aria-hidden`, so a formula is announced once, as its spoken name. This trades away the MathML navigation some screen readers offer (JAWS and NVDA with MathCAT) for a consistent, translated reading in English, Australian English and Hindi; the formula's text is still selectable and copyable.
