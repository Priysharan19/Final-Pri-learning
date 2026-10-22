# Board mock papers — "Pri mock in board format"

Status: shipped behind the existing exam authority (`server/platform/exams.js`). Risk class R4: it touches marking output and entitlements.

## What a board mock is

A board mock is a full-length, timed paper for **CBSE Class X Mathematics (Standard, 041)** or **CBSE Class XII Mathematics (041)**. It follows the section structure, marks per question and internal choice of CBSE's published sample question papers. Pri composes and issues the questions from its own authored generators and the reviewed previous-year archive. The student writes the paper by hand, and the server marks every response with the deterministic engine.

**It is not an official CBSE paper.** CBSE has not set, seen or endorsed it. Every surface labels it **"Pri mock in board format"** (`MOCK_LABEL` in `client/src/engine/boardMock.js`), and its title is `Pri mock in board format · CBSE Class X Mathematics (Standard, 041)` (or `… Class XII Mathematics (041)`). The words "official", "board paper" and "CBSE paper" never appear in a mock's title; `client/test/board-mock-check.mjs` enforces this.

## Blueprint provenance

A mock adds no blueprint of its own. It is sat under the existing reference blueprints in `client/src/engine/indiaExams.js`, which carry their sources in `INDIA_EXAM_SOURCES`:

| Mock | Blueprint id | Pattern source (CBSE's published document) |
|---|---|---|
| Class X Standard | `cbse-x-standard-041-2025-26-reference` | CBSE Class X Mathematics Standard Sample Question Paper 2025-26 — https://cbseacademic.nic.in/web_material/SQP/ClassX_2025_26/MathsStandard-SQP.pdf |
| Class XII | `cbse-xii-041-2025-26-reference` | CBSE Class XII Mathematics Sample Question Paper 2025-26 — https://cbseacademic.nic.in/web_material/SQP/ClassXII_2025_26/Maths-SQP.pdf |

The 2025-26 curriculum documents set unit weightage. These are cited on the same blueprints: the Secondary curriculum (Maths_Sec_2025-26.pdf) for Class X and the Senior Secondary curriculum (Mathematics_SrSec_2025-26.pdf) for Class XII. The structure taken from the sample papers, and checked in `client/test/board-mock-check.mjs`, is:

| Section | Questions | Marks each | Marks | Internal choice (X / XII) |
|---|---|---|---|---|
| A | 20 (18 MCQ + 2 assertion-reason) | 1 | 20 | none |
| B | 5 | 2 | 10 | 2 / 2 |
| C | 6 | 3 | 18 | 2 / 3 |
| D | 4 | 5 | 20 | 2 / 2 |
| E | 3 case studies (1 + 1 + 2) | 4 | 12 | 3 / 2 (one sub-part each) |
| **Total** | **38** | | **80** | 180 minutes |

The blueprints are labelled `authenticity: 'reference-pattern'`. Their own release notes say they are the 2025-26 pattern and make no 2026-27 authenticity claim, and a mock inherits that limit. The Class X Basic (241) blueprint and the Class XI school pattern are not offered as mocks: Basic would need its own label, and CBSE sets no Class XI board paper.

## Marks scheme provenance

- **Grid.** Marks per question come from the blueprint section (`marking(section)` in `indiaExamComposer.js`), never from the device.
- **Objective items (Section A).** These are marked by `markObjective` against the authored key: full marks or nothing, with no negative marking, as in the CBSE paper.
- **Written items (B–E).** These are marked by `markResponse` (`server/platform/markerOps.js`). A correct final answer earns full marks. A wrong final answer with working earns method marks under the rule practice uses (`methodMarks` in `checker.js`): one mark per verified line that moves the solution on, capped one below the question's marks. This is Pri's step-marking rule in the spirit of CBSE "value points". It is **not** CBSE's marking scheme, and no surface says it is.
- **The examiner's margin.** This is new in this change: `scriptLinesOf` in `boardMock.js`, attached as `script` by `examWorkingStage`.
  - It is read off the same `stepCheck` report and `methodMarks` vector that decided the mark, *after* the mark is decided. It changes no mark. `client/test/board-mock-check.mjs` compares 864 markings across every Class X/XII generator before and after the change and finds them identical.
  - The margin marks always add up to the method marks awarded. Where the engine's per-row vector under-reports a capped progress line, the margin places the rest beside the verified progress lines held back by the cap; the total is still the engine's.
  - The first-error line is the first line `stepCheck` refuted (`status: 'break'`).
- **AI.** AI never sets a mark. Handwriting is read answer-blind by the existing exam reading path, and only the transcript the student sees is marked.

## Entitlement

- Premium (`premium-exams`, from `serverEntitlementCapabilities` on the server's own `entitlement_snapshots` row) sits any number of mocks.
- A free account gets **one sample mock for the life of the account** (`FREE_SAMPLE_MOCKS`). It is counted from the account's `exam-mock` ledger rows, which are written in the same transaction and under the same lock that seals the paper. A finished or abandoned sample still counts.
- The sample is counted apart from the free 30-day exam-simulation window, and does not spend it.
- A refusal is `402 PREMIUM_REQUIRED` with `capability: 'premium-exams'`, the shape the device paywall already reads.
- `server/test/board-mock-check.mjs` covers all of the above over real HTTP.

## The result script

`mockScript(result, sections)` is a pure view of the stored, server-marked result. It shows:

- the total out of 80, and each section's score and time (the sum of the per-question times the device checkpointed);
- for each question, the marks, the outcome, the internal choice taken, the margin lines with their verdict and margin mark, and the first-error line (for a case study, the part it falls in).

A result still waiting on handwriting is shown as provisional.

## Evidence limits

This is synthetic and deterministic evidence only. No student has sat a mock, and no claim is made about how well a mock predicts a board score.
