# Progress metrics — what every number means

**Scope:** the student progress surfaces of the India V1 product — India Progress
(`client/src/pages/IndiaProgress.jsx`) and Home (`client/src/pages/Home.jsx`) — and
the routes that feed them (`GET /stats`, `GET /curriculum`, `GET /me`, `GET /reviews`
in `client/src/local/backend.js`). The counts `GET /report` serves (totals, streak,
active days, chapter attempts) are audited too, but see *Known limits* for its
accuracy figures.

**Code authority:** `client/src/engine/progressTruth.js` holds the definitions and
thresholds below as code. Change one, change the other.

**Proof:** `client/test/progress-truth-check.mjs` recomputes every number on this page
independently from the raw attempt rows and fails if any route disagrees.
`client/test/tour-progress-truth.js` does the same against the rendered screens in a
real browser. `client/test/adaptive-simulation-check.mjs` covers the engine behind
mastery, the review queue and the "what next" choice.

## The ledger

Every marked answer writes exactly one row to the `attempts` store, in the same
IndexedDB transaction as the rating, review, activity and question updates it
causes (`resolve()` in `local/backend.js`). The row id is a keyed digest of the
question (or exam part) it resolves, so a retried, replayed or doubled delivery
cannot write a second row. This append-only ledger is the authority for every
count below. The other learner state is either derived from the same answers in
the same transaction (the per-chapter rating row, the FSRS review row, the
per-day activity row), or computed from the ledger when it is read.

An attempt is **learning evidence** when it is a marked answer in practice, review,
an assignment or an exam, on a curriculum question. Rapid Fire and Match answers
are real answers, but they are given in seconds against a clock. They count
towards *questions answered* and the daily goal, and nothing else. A teacher's
custom question belongs to no chapter and is not chapter evidence.

An answer is **supported** when the student used a hint or tutor help, or got it
right on the second try. Otherwise it is **independent**. A supported correct
answer is still correct. It is reported separately, and the engine weights it
less (see below).

## Numbers

| Surface | Number | Definition | Below the threshold |
|---|---|---|---|
| India Progress | Questions answered | Count of the profile's attempt rows, all modes. | — |
| India Progress | Demonstrated accuracy | Correct / attempts over learning evidence. Rounded to 0.1%. | Under **10** evidence answers it reads "Not enough evidence yet" and says how many more answers it needs. No percentage is shown. |
| India Progress | "N correct answers needed help" | Supported correct answers among the learning evidence. | Shown only alongside an accuracy. |
| India Progress | Chapters started | Chapters in the student's scope with at least one evidence answer. | — |
| India Progress | Chapters practised | Chapters with **5** or more evidence answers. | — |
| India Progress | Chapter row: attempts, correct | Evidence answers filed under that chapter, and how many were correct. | — |
| India Progress | Chapter row: accuracy | Correct / attempts for the chapter. | Under **5** answers it reads "Too few answers". With no answers it shows a dash. |
| India Progress | Syllabus board: dot-point colour | `engine/syllabusBoard.js` over `/curriculum`: each dot point's **own** mastery band (`dp` state under the chapter's rating row, or the generator rows that cover it on an older history), never the chapter average. | Under **3** answers (`DOTPOINT_COLOUR_FLOOR`) it is drawn as a hollow "too few answers" square; with none, as "not started". |
| India Progress | Syllabus board: "N/M dot points practised · K mastered" | Dot points with at least one answer, and those in the `mastered` band. | — |
| India Progress | Priorities | `/stats.priorities` (the topic queue's `prioritiesAmong` ranking: exam share × gap to secure × time since practice × repeating slips) in its own order, joined to the predictor's unit for "marks still open" and to the chapter's weakest practisable dot point. Nothing is re-ranked on the page. | Empty when every chapter in scope is at or above 88% mastery. |
| India Progress | "If you sat this paper tomorrow" | `engine/markPredictor.js`: expected marks over the units actually practised, never scaled to the rest of the paper. | No headline below 40% coverage of the paper's marks (`COVERAGE_FLOOR`). |
| `/stats`, `/curriculum` | Chapter mastery and band | `masteryOf(rating, attempts, lastAnswer)`: rating from the Elo chain, discounted by evidence (`0.3 + 0.7·min(1, attempts/10)`) and by time since the last answer. | 0 and `unseen` with no answers. One correct answer cannot reach `strong` or `mastered`. |
| Home | Today's goal ring | Attempt rows dated today in the profile's timezone (Asia/Kolkata for India). | — |
| Home, `/me` | Streak | Consecutive calendar days in the profile's timezone with at least one answer, ending today. If there is no answer yet today, it ends yesterday. | 0 with no answers. |
| Home | Week strip | Days in the last seven with at least one answer. | — |
| Home, nav badge | Reviews due | FSRS review rows with `dueAt ≤ now` (see the review queue below). | — |
| `/stats` | Recent | The last 15 attempt rows **in answer order**. | — |
| `/stats` | Exam count | Exams with a `finishedAt`. | — |
| `/report` | Active days | Distinct days with an answer in the last 28, in the profile's timezone. | — |

What is **not** shown, on purpose: a CBSE percentage, a JEE percentile, a rank,
or any predicted score derived from a practice history. See `progress.honesty`.

## The Elo chain

Each evidence answer moves the chapter rating (and the rating of the dot point it
exercised) by `updateRating(before, n, difficulty, correct, help)`:

- `help` counts each hint, each tutor level, and each spent wrong try. A second-try
  success is help in the same sense a hint is: the student was told the first
  answer was wrong.
- A correct answer with help scores `max(0.55, 1 − 0.15·help)` instead of 1.
- Every attempt row records `ratingBefore`/`ratingAfter`. Within a chapter they form
  an unbroken chain that ends on the stored rating. The truth suite checks this
  chain and checks each step against the help that answer used.

## The review queue

A chapter enters spaced review on its third evidence answer, if that answer was in
practice, review or an assignment. From then on, every such answer reschedules it
with FSRS-5 (`scheduleReview` in `engine/adaptive.js`). The grade is:

- **Again** for a wrong answer.
- **Hard** for a supported success.
- **Easy** for a fast independent success.
- **Good** otherwise.

Exam answers update the rating but never the schedule. The truth suite replays the
ledger through FSRS and requires the stored due date, reps and lapses of every
review row to match. "Due" means `dueAt ≤ now`, and "upcoming" means due within
seven days.

## Profiles, devices and replays

- Every count is per profile (`pid`). A second profile on the same device
  shares nothing.
- Restoring a backup creates a new profile with the backup's rows. Restoring the
  same backup twice creates two separate copies, and each carries exactly the
  original totals.
- Cloud sync publishes the ledger. Each attempt becomes one event with a stable id,
  and the server stores an event id once. Syncing again publishes nothing new.
  Sync never changes this device's numbers.
- Another device's events are folded into this device's ledger once
  (`client/src/platform/cloudSyncRestore.js`). Each pulled event becomes one
  attempt row keyed by its event id, with `remoteEventId`/`remoteDeviceId` on
  the row, and the rating, review schedule and per-day activity it implies are
  re-derived by the deterministic engine from that row — never copied from the
  other device's summary. Pulling the same events again is idempotent by event
  id, so nothing is counted twice; a rescan never republishes a restored row.
  The progress pages therefore describe the account's ledger as known to this
  device: everything answered here plus everything pulled so far. Pushing never
  changes this device's numbers.

## Known limits

- The NSW (Australian) progress page is not part of V1. Its multipart-exam path
  writes its attempt and activity rows outside the shared transaction.
- Per-day activity rows are written in the answer's transaction rather than
  derived on read. The truth suite asserts they equal the ledger's per-day counts.
  A restored backup carries both from the same file.
- `GET /report` and the NSW legacy progress page (`ProgressLegacy.jsx`, its only
  student consumer, out of V1) still print accuracy without the sample floor or the
  game exclusion: `/report`'s per-chapter `accuracy` (`indiaChapterRows`, also read
  by teacher analytics) is a plain correct/attempts on rating rows. No India V1
  student surface reads it; the truth suite audits `/report`'s counts, not those
  percentages.
