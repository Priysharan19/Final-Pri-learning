# Standard gap audit

Audited against `docs/product/PRI_LEARNING_STANDARD.md` (PR #984) on `task/train-editions-23` (tip as of 2026-11-18). Method: code paths were read, not only test names; nothing was built or run, and no screenshots were opened for this audit, so "met" means the code path and its tests exist, not that a device or a human has confirmed it. Six claims were spot-checked by the auditor (marked **verified**); the rest are code reading by sub-reviews and should be treated as strong leads.

Status: **met**, **partial**, **gap**. Size: S under 1 day, M 1 to 3 days, L more. "Ink/engine" marks a fix that touches `client/src/ink/**` or the marking engine and needs the extra review AGENTS.md requires.

Standard-wide limits found: the production marking policy (`server/platform/markingPolicy.js`, D12) keeps method marks off until a signed examiner result (#499), so #14, #15 and half of Experience 6 are blocked externally, not only by engineering. Whether the tutor feature flag is on in production was not established; the CI test build for the tutor tour runs with `PRI_FEATURE_TUTOR: '0'` (`.github/workflows/ci.yml:862`), so every tutor-related row is judged on the code, which may be dark for learners.

## P0 gaps, ranked (what to assign first)

| Rank | # | Status | One line | Size | Ink/engine |
|---|---|---|---|---|---|
| 1 | 33 Accessible maths | **gap** (verified) | KaTeX is rendered with defaults (`lib/latex.jsx:14`), so a raw MathML tree exists, but there is no speech string, no `role="math"`, no navigation, and no test asserts MathML is exposed. | M floor (speech text + assertion), L navigable | No |
| 2 | 11 Explicit ambiguity resolution | partial (verified) | The gate fires only on doubted readings (`QuestionCard.jsx:1376`); a confident reading submits with no whole-expression confirmation or quick approve. | S to M | Yes (ink UI) |
| 3 | 15 Evidence-backed partial credit | gap in production | Method marks off under D12; practice receipts are aggregate-only (`markRows.js`), so there are no criterion rows. | L, examiner-gated (#499) | Yes |
| 4 | 14 Fair alternative methods | partial | Valid alternative paths earn nothing in production (final-answer-only); no approved rubric. | L, examiner-gated | Yes |
| 5 | 38 Curriculum-version authority | partial (verified) | NSW seals syllabus, version and outcome per question; India `identityOf: null` (`editionBanks.js:30`), so Priyabhata items carry none. | M | No |
| 6 | 37 Equal capability | partial (verified) | NSW marking is `FINAL_ANSWER_MARKING`, India `marking: null` (`editionBanks.js:34`): a marking difference between editions that is not declared or tested; the a11y walk hard-codes `course: 'in'`. | M | Marking-policy review |
| 7 | 41 Child-safe AI | partial | The no-companionship, no-personal-details rule is on the "why this step" prompt only; the help, diagnose and coach prompts lack it; no distress or disclosure path; no adversarial test across surfaces. | M | No |
| 8 | 23 Transparent AI limits | partial | Safeguards are strong (spans re-verified, mark cannot move) but the labels say "From the Pri tutor"; nothing says generated and unverified; Explain captions are unlabelled. | S (copy + token) | No |
| 9 | 45 Accurate availability states | partial | Local-saved and offline are expressed; there is no single model of cached / offline-readable / saved / cloud-required / confirmed, and cached versus readable is unlabelled. | M | No |
| 10 | 42 Ethical commerce | partial | Consent and restriction screens are structurally free of paywall imports, but no test asserts it and the parent-report path shows a Premium message; one added import would break the rule silently. | S | No |
| 11 | 43 Responsive input | partial | No test holds a cloud call open while asserting writing latency and navigation stay responsive. | M (test only) | Read-only |
| 12 | 40 Privacy by design | partial | Retention and erasure exist and are tested; retention doc is "not legally reviewed", and retention is not parameterised by edition; no automated retention window for learner work. | M + legal | No |
| 13 | 46 Objective quality gates | partial | a11y gate is real; device matrix is empty (honest); no web-vitals gate, no maths-accessibility journey gate, no 44px per-control assertion. | L (humans) | No |
| 14 | 34 Multiple equivalent inputs | partial | Typed and handwritten paths exist; no test proves equal outcomes across typed, confirmed-handwritten and an accessible alternative; handwriting is online-only. | M | Parity test touches marking path |
| 15 | 08 Original work preserved | partial | Strokes live only in device IndexedDB; server keeps text-level original and corrected revisions; lost on account switch or new device. | M | Yes (sync) |
| 16 | 10 Semantic structure | partial | Reading is linear text turned into LaTeX by regex; no matrices, diagram objects, assumptions or line relationships. | L | Yes |
| 17 | 30 Recoverability | partial to met | Undo, idempotent retry and crash-draft recovery exist; exam-mode undo rules and the crash path were not exercised. | S to M | Read-only |
| 18 | 27 Continuity | met for Practice, partial elsewhere | No Notes reading position or last-route restore found. | S to M | Read-only |
| 19 | 29 Honest system feedback | met (mostly) | State is derived from real IndexedDB readbacks and avoids over-claiming; no explicit "confirmed" badge. | S | No |
| 20 | 16 Uncertainty is not correctness | met (practice) | Three distinct verdict titles and server rules; visual distinctness not seen; one caveat: an unverifiable line still withholds the mark. | S | No |

Cross-cutting finding (not a numbered P0, but it breaks Experience 7 and ADR-0002 parity): **Prithagoras Progress shows raw mastery percentages and an unthresholded accuracy**, because `ProgressAustralia.jsx` re-exports `ProgressLegacy.jsx`, which prints `{s.mastery}%` (`ProgressLegacy.jsx:278,311`) with no minimum-evidence gate or uncertainty; Priyabhata's India Progress is the restrained one. Also in `Placement.jsx:363` and `Teach.jsx:81,94,115`. Size M; no ink/engine.

## All P0 and P1 principles

### A. Learning effectiveness

| # | P | Status | Evidence | Missing | Size | Ink/engine |
|---|---|---|---|---|---|---|
| 01 Independent mastery | P0 | partial | Attempts carry `support: 'supported'|'independent'` (`local/backend.js` ~2411); `progressTruth.js:84-100` splits independent from supported; `IndiaProgress.jsx:61,165` shows "needed help"; spaced ladder counts only unassisted recall (`engine/spacedReview.js:30-35`). | Mastery is one blended rating; immediate retry and delayed success are not separate evidence classes; AU Progress shows no independence figure; doc/code mismatch on second-try success (`progress-metrics.md` vs `isSupported()`). | M | No |
| 02 Worked-example progression | P1 | gap | Worked examples are static tabs in Notes; session types are review/learn/practise/mock only. | No explanation, example, partial completion, independent sequence. | L | No |
| 03 Productive struggle | P1 | partial | Hint ladder, two-press reveal (`QuestionCard.jsx:1812`), tutor refuses answers. | No measure that only navigation difficulty is removed. | S–M | No |
| 04 Targeted spaced revision | P1 | partial | Ladder 1/2/4/7/14/30/60 (`engine/spacedReview.js`), `client/test/spaced-review-check.mjs`. | The same endpoint also serves an FSRS forgetting-curve queue (`engine/reviewQueue.js`): two schedulers, one a universal curve. | M | No |
| 05 Strategy discrimination | P1 | partial | `adaptive.js` interleave, `todaySet.js`. | Subtopic-level only; no which-method-applies items. | M | No |

### B. Mathematical workbench

| # | P | Status | Evidence | Missing | Size | Ink/engine |
|---|---|---|---|---|---|---|
| 07 Writing first-class | P0 | met | Multi-line ink, typed path, palm rejection (`InkCanvas.jsx`), ink metric tests. | No physical-iPad evidence (by design). | – | – |
| 08 Original work preserved | P0 | partial | See rank 15. | See rank 15. | M | Yes |
| 09 Answer-blind | P0 | met | `handwritingProvider.js`, `FORBIDDEN_FIELDS`, `ink-answer-blind-static-check.mjs`, `provider-answer-blind-check.mjs`. | – | – | – |
| 10 Semantic structure | P0 | partial | See rank 16. | See rank 16. | L | Yes |
| 11 Explicit ambiguity resolution | P0 | partial | Client gate `QuestionCard.jsx:1376`; server `RECOGNITION_CONFIRMATION_REQUIRED` (`practice.js:1191`); tests `ink-reader-doubt-check`. | No confirmation on confident reads; exam path replays saved lines as confident (`ExamRoom.jsx:1055`). | S–M | Yes |
| 12 Spatially intelligent tools | P1 | partial | `lib/writingHand.js` used on the Desk and Settings only; `useFormFactor`. | Practice ignores writing hand; no keyboard-inset handling. | M | Ink-adjacent |

### C. Assessment and trust

| # | P | Status | Evidence | Missing | Size | Ink/engine |
|---|---|---|---|---|---|---|
| 13 Server-authoritative marking | P0 | met | `markerPool` server-side, `authoritativeGrade.js`, `online-marking-authority-check.mjs`. | A client `awardStepMarks`/`boardAward` path remains (`QuestionCard.jsx:2026`), guarded dead; delete. | S | Engine-adjacent |
| 14 Fair alternative methods | P0 | partial | Equivalent finals and line-to-line checks. | See rank 4. | L | Yes |
| 15 Evidence-backed partial credit | P0 | gap | See rank 3. | See rank 3. | L | Yes |
| 16 Uncertainty is not correctness | P0 | met | `verdict.unreadable` / `notSubmittedTitle` / `notQuite`; exam `pendingReview`. | See rank 20. | S | No |
| 17 Exact mark reconciliation | P0 | met | `attestedGrade` is the only displayed score source; `authoritativeGrade.test.mjs`; `exam-authority-check.mjs`. | Exam receipt reconciled by score equality, not a shown receipt id. | – | – |
| 18 Contestability and auditability | P1 | partial | History replays ink and "read as" text; first break named. | No dispute or review request anywhere; no basis-of-mark view. | M | No |

### D. Tutoring and feedback

| # | P | Status | Evidence | Missing | Size | Ink/engine |
|---|---|---|---|---|---|---|
| 19 Minimum effective assistance | P1 | partial | Three ordered tutor levels (`tutor/TutorHelp.jsx`); authored hint fallback. | Always student-pulled; starting level not chosen by context; flag may be dark. | M | No |
| 20 Assistance fading | P1 | partial | `explain/adaptiveTeaching.js` modes. | Fades Explain pacing only; no hint fading in Practice. | M | No |
| 21 Differentiate error causes | P1 | partial | `engine/misconceptions.js`; recognition failure separated (`workState: 'read-failed'`). | No learner-facing concept / arithmetic / method / notation taxonomy. | M | Engine read-only |
| 22 First justified break | P1 | met (engine), partial (UI) | `checker-core.js:1458` `firstBreak`; `StepCoachLive.jsx`; `MistakeDiagnosis.jsx`. | Diagnosis gated by the tutor flag. | S–M | Engine read-only |
| 23 Transparent AI limitations | P0 | partial | See rank 8. | See rank 8. | S | No |
| 24 Student intellectual autonomy | P1 | gap | Searched `tutor/`, strings, `ink/`: no critique or verify affordance. | "Check it yourself" and "I disagree" path. | M | No |

### E. Information architecture and interaction

| # | P | Status | Evidence | Missing | Size | Ink/engine |
|---|---|---|---|---|---|---|
| 25 One primary action | P1 | partial | `Home.jsx` single recommendation; `QuestionCard` dominant move. | Home and Today coexist; other screens not audited. | S–M | No |
| 26 Stable mental model | P1 | gap | `App.jsx:160-169` groups are feature-based ("Learn now", "My work", "Understand my learning", "Practice modes"). | Not Learn / Practise / Review / Exams. | M | No |
| 27 Continuity | P0 | met (Practice) | See rank 18. | See rank 18. | S–M | Read-only |
| 28 Progressive disclosure | P1 | partial | Tutor levels, paged examples. | No explicit rule for ink toolbar and tools. | S–M | Maybe |
| 29 Honest system feedback | P0 | met (mostly) | See rank 19. | See rank 19. | S | No |
| 30 Recoverability | P0 | partial to met | See rank 17. | See rank 17. | S–M | Read-only |

### F. Accessibility, form factors, visual design

| # | P | Status | Evidence | Missing | Size | Ink/engine |
|---|---|---|---|---|---|---|
| 31 Content-first premium design | P1 | partial | `--font-math`, `.katex` sizing, `design-system-check.mjs`. | No gate that maths dominates. | S | No |
| 32 Adaptive composition | P1 | partial | 76 media queries, pointer queries, `tour-responsive-matrix.js`. | Portrait tablet gets one column (`theme.css:1543` splits only landscape 1000px+); no rotation or keyboard test. | M | No |
| 33 Accessible mathematics | P0 | gap | See rank 1. | See rank 1. | M–L | No |
| 34 Multiple equivalent inputs | P0 | partial | See rank 14. | See rank 14. | M | Parity test |
| 35 Purposeful motion | P1 | partial | `prefers-reduced-motion` in 23 files; reduced-transparency only in unshipped `aurora.css`. | No reduced-transparency in `instrument.css`; no test that motion stops. | S | No |
| 36 Meaning beyond colour | P0 | met | `a11y-check.mjs:49,164-313` fails colour-only verdicts, with planted-fault self-checks. | Limited to verdict tokens; status chips and chart series not covered; contrast not measured. | S | No |

### G. Localisation, child safety, ethics

| # | P | Status | Evidence | Missing | Size | Ink/engine |
|---|---|---|---|---|---|---|
| 37 Equal capability standard | P0 | partial | See rank 6. | See rank 6. | M | Policy review |
| 38 Curriculum-version authority | P0 | partial | See rank 5. | See rank 5. | M | No |
| 39 Genuine multilingual quality | P1 | partial | i18n checks, `docs/release/hindi-review/`. | No named human reviewer confirmed; only en and hi. | M (external) | No |
| 40 Privacy by design | P0 | partial | See rank 12. | See rank 12. | M + legal | No |
| 41 Child-safe AI relationships | P0 | partial | See rank 7. | See rank 7. | M | No |
| 42 Ethical commerce | P0 | partial | See rank 10. | See rank 10. | S | No |

### H. Reliability, measurement, improvement

| # | P | Status | Evidence | Missing | Size | Ink/engine |
|---|---|---|---|---|---|---|
| 43 Responsive input | P0 | partial | See rank 11. | See rank 11. | M | Read-only |
| 44 Data integrity across sessions | P0 | met (strong) | `cloud-account-boundary-check.mjs`, `submission-sync-durability-check.mjs`, `restore-durability-check.mjs`, `desk-isolation-check.mjs`, `rls-fail-closed-check.mjs`. | No test swaps accounts mid-submission with a request in flight. | S | No |
| 45 Accurate availability states | P0 | partial | See rank 9. | See rank 9. | M | No |
| 46 Objective quality gates | P0 | partial | See rank 13. | See rank 13. | L | No |
| 47 Independent learning metrics | P1 | gap | `progress-metrics.md`, `progressTruth.js` define accuracy and mastery. | No delayed, unassisted or held-out metric; gated behind V7 measurement prerequisites in AGENTS.md. | L | Learner-state logic |

## Seven experiences

| Experience | Status | Gap |
|---|---|---|
| 1 Sign-up | partial | Consent, guardian and recovery exist; cannot confirm the student lands on a real first activity, and an under-18 student cannot reach one until a guardian approves. |
| 2 Home | partial to met | One recommendation with reason and alternatives; no explicit "what happens next" line; Home and Today both present a next action. |
| 3 Notes | partial | Missing explicit objective, distinct intuition section, independent checkpoint, and diagrams woven into the reasoning. |
| 4 Practice | partial to met | Side by side only at landscape 1000px+; no rotation or keyboard stability test. |
| 5 Recognition | partial | See #11; original ink is device-local only. |
| 6 Feedback | partial | With method marks off, students see "wrong" but not why marks were lost; submitted working is not echoed for working-type questions. |
| 7 Progress | partial | Missing retention, transfer, review priority and uncertainty; false-precision percentages on Prithagoras (above). |

## Notes for whoever assigns lanes

- Verified here: #33 (default KaTeX options), #11 (gate condition), #38 and #37 (`editionBanks.js`), Prithagoras Progress re-export and `{mastery}%` lines.
- Not verified: everything else, including all "met" rows' runtime behaviour, tutor flag state in production, and the visual distinctness in #16.
- Honest zero-evidence items that are not code gaps: physical-device matrix, Hindi review sign-offs and legal review are empty by design.
