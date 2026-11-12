# Regional editions — feature-evidence matrix

Baseline for [ADR-0002](adr-0002-one-platform-two-editions.md). It records what each repository **actually contains**,
inspected on 2026-11-13 at `Priysharan19/Final-Pri-learning` `main` `7735cf9ca` and `Priysharan19/prithagoras-web`
`main` `46e1476`. "Code and tests exist" is not the same as "certified" or "live in production". Every capability here is
still subject to the V1 flags, the staging certification and the release policy that apply to it.

The machine-readable counterpart is the `capabilities` table in `client/edition.config.mjs` (plan E1, PR #862).
`npm run test:editions` prints both editions' open gaps on every run.

| Capability | Priyabhata (India) — evidence today | Prithagoras (Australia) — evidence today | Gate before an edition may offer it |
| --- | --- | --- | --- |
| Handwriting recognition | Answer-blind cloud transcription (`server/platform/handwriting*.js`); suites `test:handwriting:cloud`, `test:ink:release-gate`, `test:ink:arbitration`, `test:exam:handwriting` | Same pipeline, nothing edition-specific in it; **no Australian notation corpus** | Australian handwriting corpus with clear abstention behaviour (plan G5) |
| Photo / PDF input | `client/src/photo/`; `test:photo:cloud`, `test:photo:practise`, `test:pdf`, `test:photo:no-device-ocr` | Same code | Same as handwriting (G5) |
| Verified marking | Server-authoritative practice and exams (`server/platform/practice.js`, `exams.js`); `test:marker:false-positive`, `test:marker:policy`, `test:marker:verified`, `test:marking:dossier`, `test:cbse:marking`. The production policy is **final answer only**: method marks stay off while #499 is open | **None served.** `practice.js:50` issues India banks only (decision D15). About 9,400 lines of NSW Years 7–12 generators exist (`client/src/engine/generators/year7.js`–`year12.js`, `streams-*.js`), mapped to **pre-2024 syllabus codes** in `curriculum.js` | NSW 2024 syllabus mapping, approved question identity, independent rubric certification (G1–G4, G6) |
| Step feedback | `test:step-coach`, `test:marker:working`, `test:working:cloud`, `test:typed:working` | Not served (same reason as marking) | As for verified marking |
| Notes and worked examples | `client/src/pages/Notes.jsx` (search, bookmarks, study links, each with tests); `test:notes`, `test:explain` | None for NSW | NSW notes authored to the 2024 syllabus, with academic review (G2, G3) |
| Adaptive practice and revision | `test:india:adaptive`, `test:adaptive:sim`, `test:placement`, `test:predictor`, spaced review | Engine is course-generic; no NSW banks are served | As for verified marking |
| Timed, server-marked exams | `client/src/pages/ExamRoom.jsx`, `server/platform/exams.js` (server layout, sealed questions, authoritative deadline); `test:india:exams`, `test:exam:session`, `test:exam:analysis` | None. One external 100-mark paper is listed as a **resource**, not structured questions | HSC blueprints built from approved questions (G4) |
| Exam Desk (unmarked timed attempt) | **None.** `ExamRoom` is marked-only | `prithagoras-web`: `desk.html`/`desk.js`, `session-core.mjs` (reading and working timers on device-clock deadlines, pause/resume, flags, notes, JSON export); `tests/session-core.test.mjs`. Data lives in browser `localStorage` | One shared unmarked mode of `/v1/exams`, plus an explicit, tested import of existing browser notes and flags (F4) |
| Resource library | **None** (notes and past-paper questions exist; there is no resource catalogue) | `index.html`/`script.js`, `resources.json` schema v1 (1 resource), search, filters, command palette; `tests/smoke.test.mjs` | Shared library for both editions (F1) |
| Resource publishing | Content administration exists for questions and notes (`server/platform/content.js`, `admin.js`, MFA-gated staff) | `studio.html`/`studio.js` produce JSON for a manual commit; no review states | Unified review and publication states (F3) |
| Progress, bookmarks, exports | `test:progress:truth`, `test:streak`, `test:insights`, `test:account:export`; question and notes bookmarks | Local bookmarks and attempt JSON export only (no accounts) | Regional accounts (H1, H2) |
| AI tutor | `client/src/tutor/`, `test:tutor:ui`; **ships dark** (`PRI_FEATURE_TUTOR`, an owner GO decision) | Same code | Same flag; Australian content review |
| Accounts and identity | `/v1` accounts, MFA for staff, Supabase Mumbai (ADR-0001) | None | Isolated Australian region; consent and recovery tests (H1, H2, H4) |
| Payments | Razorpay, INR (`server/platform/billing.js`) | None | Australian provider, reconciliation and refund tests (E5, H3) |

## Integration dependency map — the smallest safe first changes

1. **E1, edition manifest** (PR #862). Behaviour unchanged: the Priyabhata bundle is byte-identical to `main` apart from
   `features.json`, and the release-identity shape is untouched. *Reversible.*
2. **F1, resource library** in the shared app, for both editions. A new surface that changes no grading, identity or
   billing. *Reversible.*
3. **F4, Exam Desk** as the unmarked mode of `/v1/exams`. Shares navigation, autosave and accessibility with the marked
   mode, but never touches its deadline or marks.
4. Only after these: **E2/E5** (server edition, billing; R4), **G1–G6** (NSW 2024 content and certification) and **H1–H6**
   (Australian region).
