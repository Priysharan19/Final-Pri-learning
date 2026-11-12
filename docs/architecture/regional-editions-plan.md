# Regional editions — migration plan

Implements [ADR-0002](adr-0002-one-platform-two-editions.md): one platform (Pri Learning), two editions —
**Priyabhata** (India) and **Prithagoras** (Australia). Each mission below is one PR on a `task/*` or
`agent/mission/*` branch, under the normal governance (`AGENTS.md`, `docs/release/release-policy.md`). Risk classes
are the expected minimum; the diff-derived risk is authoritative.

Status of every row is **not started** as of 2026-11-13 unless a PR is linked.

## Phase 1 — Common foundation (edition configuration, no behaviour change for India)

Exit criterion: a Priyabhata build is byte-for-byte equivalent in behaviour to today's `main` (same marking,
auth, subscription, examiner dossier), and a Prithagoras build exists in CI with its own brand and default course.

| ID | Mission | Main paths | Risk |
| --- | --- | --- | --- |
| E1 | **Edition configuration.** Add `client/edition.config.mjs` (one checked-in setting, like `interface.config.mjs`) defining `priyabhata` and `prithagoras`: brand name, mark, default course, offered languages, locale/timezone defaults, currency, legal-document set, support contact, capability set with recorded reasons for any difference. `vite.config.js` reads it; release identity and `/v1/health` report the edition. Twelve capabilities, identical in both editions; any not yet offered is a gap naming its closing mission, and the check suite prints both editions' open gaps on every run. (PR #862) | `client/edition.config.mjs`, `client/vite.config.js`, `release/`, `server/app.js` | R2 |
| E2 | **Server edition identity.** `PRI_EDITION` server env, validated against the same file; the server refuses to start when the client bundle's edition and the server's disagree. Course defaults on sign-up come from the edition. | `server/index.js`, `server/routes`, `server/platform/accounts*` | R4 (auth path) |
| E3 | **Retire `PRI_FEATURE_AUSTRALIA`.** The NSW course becomes available by edition (default for Prithagoras; cross-edition opt-in only where approved). Remove "legacy Australian" framing in `lib/locale.js`. | `client/src/platform/features.js`, `client/src/pages/Login.jsx`, `client/src/lib/locale.js` | R2 |
| E4 | **Brand text through the edition.** Replace student-facing "Pri Learning" with an edition brand token in `strings.*.js`, `index.html`, `BrandMark.jsx`, PWA manifest; keep "Pri Learning" as the company line. Re-derive the i18n coverage pin and examiner dossier digest by running them (never hand-edited). | `client/src/i18n/`, `client/src/components/BrandMark.jsx`, `client/index.html` | R2 |
| E5 | **Billing provider per edition.** Factor `server/platform/billing.js` behind an edition → provider map. Priyabhata stays on Razorpay/INR, unchanged and regression-tested. Prithagoras has *no* provider until owner decision O2: its paywall shows "not yet available" rather than a broken checkout. | `server/platform/billing*.js`, `client/src/paywall/` | R4 |
| E6 | **CI for both editions.** Build, unit, browser and accessibility suites run for each edition (matrix), with the heavy browser suites sharded so the four required contexts keep their names. | `.github/workflows/`, `scripts/` | R2 (R4 if workflow security changes) |

## Phase 2 — Bring Prithagoras features into the core

Exit criterion: everything `prithagoras-web` does exists in the shared app for signed-in students of both editions,
with the server, not `localStorage`, holding account data.

| ID | Mission | Notes | Risk |
| --- | --- | --- | --- |
| F1 | **Resource library.** A content-system resource type (paper, solutions, notes) with schema migrated from `prithagoras-web/resources.json` (`schemaVersion`, type, subject, year, marks, duration, questions, sections, availability, source, disclaimer). Searchable, filterable, edition- and course-scoped. | Rights/attribution and academic review fields are required, as in the studio. | R3 (migration ⇒ R4) |
| F2 | **Bookmarks and command search** across resources and pages, server-stored per account. | Port behaviour, not markup; Instrument UI only. | R2 |
| F3 | **Publishing.** Staff/editor publishing in the existing staff operations surface (MFA-gated), replacing "generate JSON and commit": validation, PDF upload to edition-region storage, review state, version history. | Never asks for a GitHub token. | R4 |
| F4 | **Exam Desk as an unmarked mode of `/v1/exams`.** Port `session-core.mjs` semantics (reading vs working timers on deadlines, explicit start, pause/resume, ready-to-work stop, reset confirmation, flag/done, notes) into the examination room for resources *without* approved question identity. Work is saved to the account; no mark is produced or implied. | Reconciles, not duplicates, the exam system (ADR-0002 §8). Port the session-core tests. | R3 |
| F5 | **Exports.** Attempt and progress export (JSON now, PDF later), clearly labelled as not a grading result for unmarked attempts. | | R2 |
| F6 | **Public site.** `prithagoras-web` links into the app for sign-in; its catalogue is fed from the platform's public resource endpoint instead of a hand-committed file. | Change in the other repository. | R1–R2 |

## Phase 3 — Full learning in Australia

Exit criterion: a Prithagoras student can practise, write by hand or photograph work, and receive server-decided
marks on approved NSW questions, with certification recorded per capability.

| ID | Mission | Notes | Risk |
| --- | --- | --- | --- |
| G1 | **Research gate first.** Read `docs/research/README.md` and the curriculum-authority research; write the NSW counterpart of `CBSE_NCERT_CURRICULUM_ASSESSMENT_AUTHORITY_V7.md` (NESA syllabus authority, outcome codes, marking-guideline conventions, transportability limits of India-derived evidence). | No efficacy or threshold carried across populations without its limits. | R1 |
| G2 | **NSW curriculum to current syllabus.** Reconcile `client/src/engine/curriculum.js` against the current NSW Mathematics K–10 and Stage 6 syllabuses with provenance per outcome; mark generator availability honestly (`curriculumAvailability.js`). | | R3 |
| G3 | **Australian question banks and notes.** Generators, worked examples and notes per dot point, each with approved question identity and answer specification. | Content work; no syllabus-complete claims. | R3 |
| G4 | **HSC-style papers from approved questions.** Exam blueprints for Years 11–12 Advanced/Extension, sealed and server-marked like the India boards. | | R4 |
| G5 | **Handwriting/photo for Australian notation.** Same answer-blind pipeline; test fixtures for Australian conventions (e.g. pronumeral wording, units, `≈`, interval notation). | | R4 |
| G6 | **Australian rubric certification.** The HSC counterpart of #499: independent examiner certification before any method-mark awarding in Prithagoras. | External human evidence only; never fabricated. | R4 |

## Phase 4 — Regional deployments and certification

| ID | Mission | Blocked on | Risk |
| --- | --- | --- | --- |
| H1 | Provision the Australian region: database project, hosting service pair (staging + production), email, storage. Record origins in `repository-authority.md`. | O1 (owner) | R4 |
| H2 | Edition-region data isolation tests: an account in one region is unreachable from the other; no shared tables. | H1 | R4 |
| H3 | Prithagoras payments and native in-app purchase. | O2 (owner) | R4 |
| H4 | Australian legal and child-safeguard copy, consent flow and privacy notices. | O4 (owner/legal) | R4 |
| H5 | Full student-journey acceptance under both brands on staging (web, iPad, iPhone, Android), with simulator and physical-device evidence kept separate. | H1–H4 | R2 |
| H6 | Store listings, domains and bundle identifiers per edition. | O3 (owner) | R4 |

## Owner decisions

| ID | Decision | Needed by |
| --- | --- | --- |
| O1 | Australian data region and provider projects | H1 |
| O2 | Prithagoras payment provider, AUD prices, IAP arrangement | E5 (stub only), H3 |
| O3 | Domains, app-store listings, bundle identifiers | H6 |
| O4 | Australian legal review and child safeguards | H4 |
| O5 | Cross-edition curriculum opt-in at launch, and which content is approved | E3 (default: off) |
| O6 | Who certifies Australian rubrics | G6 |

## Ordering and parallelism

E1 first (everything reads it). Then E2–E6 can run as the writer pool allows (E2 and E5 are R4 and touch server
auth/billing, so they do not run concurrently with each other). Phase 2 starts after E1+E3; F4 after F1. Phase 3's
G1 can start now (docs only). Phase 4 waits on owner decisions; software for H2 and H5 can be prepared ahead.
