# ADR-0002 — One platform, two regional editions: Priyabhata (India) and Prithagoras (Australia)

- **Status:** Proposed — management direction received 2026-11-13; accepted when this PR merges.
- **Decision owner:** product owner (Priysharan19).
- **Builds on:** [ADR-0001](adr-0001-online-first-runtime.md) (online-first, server-authoritative marking). Nothing here relaxes it.
- **Does not reopen:** the frozen V1 India release scope (`docs/release/PRI_V1_RELEASE_SCOPE.md`, decision D2 "V1 is India-only").
  Australia enters through the phases below, after V1, as reviewed changes.
- **Migration plan:** [`docs/architecture/regional-editions-plan.md`](regional-editions-plan.md).

## Context

Management has replaced the earlier two-product plan with one principle:

> One technology. Two identities. Pri Learning builds the intelligence; Priyabhata and Prithagoras bring it to their students.

Pri Learning is the parent company and the platform. **Priyabhata** is the India edition (NCERT, CBSE, JEE,
Olympiad; English and Hindi; INR). **Prithagoras** is the Australia edition (NSW HSC and Years 7–12; Australian
English; AUD). Both are to receive the same capabilities: AI handwriting recognition, photo/PDF question input,
verified mathematical marking, step feedback, notes and worked examples, adaptive practice and revision, timed
exams and an Exam Desk, a searchable resource library, progress/bookmarks/exports, and AI tutoring. Those are the
**required end-state capabilities**, not a claim that either deployment supports them today.

### What the repository already contains (inspected at `origin/main` `7735cf9ca`, 2026-11-13)

The platform is not starting from an India-only codebase. It already carries two courses:

| Evidence | Where |
| --- | --- |
| A per-profile `course` of `'in'` or `'nsw'` (87 branch points in `client/src` and `server`) | `client/src/api.js`, `client/src/local/backend.js`, `client/src/lib/csv.js` |
| The NSW Years 7–12 curriculum (strands, subtopics, dot points, syllabus codes `MA4`/`MA5`/`MA-F1`…`MA-S3`, HSC pathways incl. Extension 2) | `client/src/engine/curriculum.js`, re-exported by `server/engine/curriculum.js` |
| The India curriculum (NCERT/CBSE/JEE/Olympiad tracks, banks, syllabus) | `client/src/engine/curriculum-in*.js`, `server/platform/indiaBanks.js`, `server/platform/india-syllabus.generated.js` |
| Regional locale and time: `en-IN`/`Asia/Kolkata` vs `en-AU`/`Australia/Sydney`, described as "legacy Australian profiles" | `client/src/lib/locale.js` |
| The Australian sign-up path, hidden unless the build sets `PRI_FEATURE_AUSTRALIA=1` | `client/src/pages/Login.jsx`, `client/src/platform/features.js`, `client/vite.config.js` |
| One payment provider (Razorpay) with an env-driven display currency defaulting to INR | `server/platform/billing.js`, `server/platform/razorpay.js` |
| Server-authoritative examination room (`/v1/exams`): server-chosen layout, sealed questions, durable answer collection | `server/platform/exams.js` |
| "Pri Learning" brand text in the client (≈340 files mention it; 67 lines in `strings.en.js` alone) | `client/src/**`, `client/index.html`, `client/src/components/BrandMark.jsx` |
| One data region: Supabase Mumbai (`ap-south-1`) and one Railway staging/production pair | ADR-0001, `docs/architecture/repository-authority.md` |

The separate repository [`Priysharan19/prithagoras-web`](https://github.com/Priysharan19/prithagoras-web) (inspected the same day)
is a dependency-free static GitHub Pages site: a public resource library driven by `resources.json` (one published
item: an external 100-mark HSC Mathematics Advanced practice paper), command search, bookmarks in `localStorage`, an
**unmarked** local Exam Desk (`desk.html` + a pure, tested `session-core.mjs`: separate reading/working timers on
device-clock deadlines, pause/resume, flag/done statuses, per-question notes, JSON export), and a publishing studio
that generates a `resources.json` package for an editor to commit. It has no accounts, no server, no marking and no
student data off the device.

## Decision

1. **One codebase.** `Priysharan19/Final-Pri-learning` is the foundation of the shared platform. Learning,
   assessment, AI, content, interface, accounts and progress are implemented once, here. `prithagoras-web` is a
   feature source, not a second application; its features are migrated through reviewed PRs (plan, Phase 2). It may
   remain live as the free public Prithagoras discovery site in front of the authenticated app.

2. **Edition and course are two different things.**
   - **Edition** (`priyabhata` | `prithagoras`) is *who serves the student*: brand, default course, offered
     languages, currency and payment methods, legal documents and child safeguards, support contacts, data
     region and hosting. It is fixed per deployment, chosen in one checked-in configuration file the same way
     `client/interface.config.mjs` fixes the interface, and reported in release identity and `/v1/health`.
   - **Course** (`in` | `nsw`, with India tracks `cbse`/`jee-main`/`jee-advanced`/`olympiad`) is *what the student
     studies*. It stays a per-profile field, as it already is. Each edition has a default course; a student may opt
     into another course only where that content is marked approved for cross-edition use, and their home stays
     their edition's.

3. **No inferior edition — full parity, both ways.** Every feature of Priyabhata is owed to Prithagoras and every
   feature of Prithagoras is owed to Priyabhata (owner instruction, 2026-11-13). Both editions declare exactly the same
   platform capabilities in the edition configuration. A capability an edition does not offer yet is a written gap
   naming the plan mission that closes it — a debt with an owner, never a lesser edition by design. A test fails a
   capability missing from one edition, a gap without a mission, or a capability only one edition declares. Editions
   may differ only in curriculum, presentation, language, commercial configuration and legal requirements.
   The Prithagoras features that do not exist in the platform yet (resource library, resource publishing, the Exam
   Desk) are therefore Priyabhata gaps as much as Prithagoras ones, and are built once for both.

4. **Build once, certify per edition.** Every new learning feature lands in the shared platform and is verified
   against both editions. A feature becomes available to an edition when that edition's certification for it is
   recorded — not when the code merges.

5. **Mathematical authority is shared and unchanged.** One deterministic engine, one server marking path, one
   examination room, one handwriting/photo pipeline for both editions. ADR-0001 rule 4 ("AI proposes, the
   deterministic engine decides") and the answer-blind handwriting invariant bind both brands. No model sets a mark.

6. **Certification gates bind both brands.** Production method-mark awarding stays disabled in both editions while
   [#499](https://github.com/Priysharan19/Final-Pri-learning/issues/499) is open. Neither brand advertises partial-credit
   marking before it is certified. Australian rubrics (HSC-style marking guidelines) are certified separately from
   CBSE rubrics; a CBSE certification never implies an Australian one.

7. **A paper is auto-markable only by question identity.** An uploaded paper (e.g. a PDF) is a *resource*. A question
   becomes server-markable only when it has an approved question identity, a verified answer specification and a
   marking rubric in the content system. Until then it can be practised in the Exam Desk mode (timed, unmarked,
   work kept for the student) but receives no mark.

8. **One examination system.** Prithagoras's Exam Desk is not added as a competing exam system. Its timing model and
   workspace become an *unmarked mode* of the server examination room (`/v1/exams`) for resources without approved
   question identity; papers built from approved questions use the existing sealed, server-marked path.

9. **Regional data isolation.** Each edition's accounts and learning records live in that edition's region and
   deployment. Australian student data is not stored in the Mumbai project, and Indian student data is not stored in
   an Australian one. There is no cross-region account linking until a separate decision says how. Provisioning an
   Australian region (database, hosting, email, payment provider) is an owner action (`BLOCKED_EXTERNAL` until done).

## Consequences

- The dormant `nsw` course stops being "legacy" and becomes the Prithagoras default course. Its availability is
  governed by the edition configuration instead of `PRI_FEATURE_AUSTRALIA`; that flag is retired in Phase 1, in the
  same way `PRI_FEATURE_INSTRUMENT` was retired by `client/interface.config.mjs`.
- Brand text, logo, legal copy and marketing become edition-supplied; "Pri Learning" remains the parent-company and
  technology name, never the student-facing product name in either edition.
- Billing becomes provider-per-edition. Razorpay serves Priyabhata. The Prithagoras provider and AUD price points are
  an owner decision; billing changes are R4.
- Every CI gate that today assumes one brand (i18n coverage pins, the examiner dossier digest, accessibility walks,
  bundle budgets) must run for both editions before an edition can be certified. Phase 1 must budget for this.
- The Australian content gap is real: the NSW curriculum model exists, but approved Australian question banks,
  notes, worked examples, rubrics and exam papers at the depth of the India content do not. Phase 3 is content- and
  certification-heavy, not just code.

## Non-goals

- Merging `prithagoras-web` into this repository in one step, or deleting it.
- Shipping Prithagoras inside the V1 India release.
- Any claim that either edition currently supports the full capability table, that Australian marking is certified,
  or that either edition is complete against its syllabus.

## Open owner decisions (recorded in the plan; none blocks Phase 1 code)

1. Australian data region and provider projects (e.g. a Supabase project in Sydney, a Railway Australia service).
2. Prithagoras payment provider, AUD prices and native in-app purchase arrangement.
3. Edition domains, app-store listings and bundle identifiers.
4. Australian legal review: privacy policy and terms under Australian law, child safeguards and parental consent.
5. Whether a signed-in Australian student may opt into JEE/CBSE content at launch, and which content is approved for it.
6. Who certifies Australian marking rubrics (the counterpart of #499 for HSC-style papers).
