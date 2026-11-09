# Board mock papers: "Pri mock in board format"

Status: issued, timed and marked by the existing exam authority (`server/platform/exams.js`). Risk class R4: it touches the exam router and the free plan's paper allowance. Owner defaults D19 and D22 (`docs/release/V1_DECISIONS_2026-11-01.md`).

## What a board mock is

A board mock is a full-length, timed paper for **CBSE Class X Mathematics (Standard, 041)** or **CBSE Class XII Mathematics (041)**. It follows the section structure, marks per question and internal choice of CBSE's published sample question papers. Pri composes and issues the questions from its own authored generators and the reviewed previous-year archive, exactly as for any India paper.

**It is typed (D22).**
- Every written answer is typed, on every device, whatever the exam-handwriting flag says. The exam room offers no writing surface on a mock (`ExamRoom.jsx`).
- The server refuses a handwritten mode or an unread page on a mock's save and finish (`readResponses` in `exams.js`). No page can ever be read on one.
- Ordinary papers keep the exam-handwriting behaviour they have.

**It is not an official CBSE paper.**
- CBSE has not set, seen or endorsed it.
- Every surface labels it **"Pri mock in board format"** (`MOCK_LABEL` in `client/src/engine/boardMock.js`).
- Its title is `Pri mock in board format · CBSE Class X Mathematics (Standard, 041)` (or `… Class XII Mathematics (041)`).
- The words "official", "board paper" and "CBSE paper" never appear in a mock's title (`client/test/board-mock-check.mjs`).
- The result says it was marked under Pri's own rules, is not CBSE's marking scheme, and predicts no board result.

## Blueprint provenance

A mock adds no blueprint of its own. It is sat under the existing reference blueprints in `client/src/engine/indiaExams.js`, which carry their sources:

| Mock | Pattern source (CBSE's published document) |
|---|---|
| Class X Standard | CBSE Class X Mathematics Standard Sample Question Paper 2025-26: https://cbseacademic.nic.in/web_material/SQP/ClassX_2025_26/MathsStandard-SQP.pdf |
| Class XII | CBSE Class XII Mathematics Sample Question Paper 2025-26: https://cbseacademic.nic.in/web_material/SQP/ClassXII_2025_26/Maths-SQP.pdf |

The structure, checked in `client/test/board-mock-check.mjs`:

| Section | Questions | Marks each | Marks | Internal choice (X / XII) |
|---|---|---|---|---|
| A | 20 (18 MCQ + 2 assertion-reason) | 1 | 20 | none |
| B | 5 | 2 | 10 | 2 / 2 |
| C | 6 | 3 | 18 | 2 / 3 |
| D | 4 | 5 | 20 | 2 / 2 |
| E | 3 case studies | 4 | 12 | 3 / 2 |
| **Total** | **38** | | **80** | 180 minutes |

The blueprints are labelled `authenticity: 'reference-pattern'`. They are the 2025-26 pattern, with no 2026-27 authenticity claim, and a mock inherits that limit. The Class X Basic (241) blueprint and the Class XI school pattern are not offered as mocks: Basic would need its own label, and CBSE sets no Class XI board paper.

## Marking

A mock is marked exactly as any server-issued India paper. **This change adds nothing to the marker** (`markerOps.js` is untouched).
- **Marks per question** come from the blueprint section, never from the device.
- **Objective items** are marked against the authored key.
- **Written items** are marked by the deterministic engine on the typed answer. Method marks follow the deployment's switch, and they stay off in production until an examiner signs (D12).
- **AI** never sets a mark.

The #656 proposal's "examiner's margin" (per-line margin marks on the result) is **not** part of this change. It added output inside the marker. D22 asks only for typed timed papers, so it is left for the marking lane and a signed examiner result.

## The plan (D19)

- A mock is a timed paper like any other. On the free plan, the account's one timed paper in 30 days may be a mock or an ordinary paper, and the server counts both from the same sealed-paper rows.
- Premium (`premium-exams`, from the server's own `entitlement_snapshots`) sits any number.
- A refusal is `402 FREE_CAP_REACHED` with `capability: 'premium-exams'` and the window's next instant, the shape the device already explains.

**Evidence:** `server/test/board-mock-check.mjs` (SQLite and Postgres) and `client/test/board-mock-check.mjs`. This is synthetic and deterministic evidence only. No student has sat a mock, and no claim is made about how well a mock predicts a board score.
