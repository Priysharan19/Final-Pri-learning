# ADR-0001 — Online-first runtime: Railway + Supabase (Mumbai) + OpenAI

- **Status:** Proposed — owner decision recorded 2026-10-01; accepted when this PR merges.
- **Decision owner:** product owner (Priysharan19).
- **Supersedes:** the "local-first" learning-runtime clause of `authoritative-architecture.md` as it stood at `449be42`.

## Context

Pri Learning was built local-first: the learning engine, marking and progress run in the browser
against IndexedDB, and the `/v1` server is an optional control plane on a single SQLite volume.

The product goal is now an excellent maths-practice product for Indian students
(NCERT 7–12, CBSE boards, JEE Main/Advanced, olympiad). The owner has chosen an online-first
product on the following providers. The owner reports having accounts with them; this ADR does not
verify any provisioned resource, deployment or production state.

- **Railway Pro** — application hosting for the `/v1` server and web client.
- **Supabase, Mumbai region (`ap-south-1`)** — managed Postgres, auth, storage and realtime, with student data
  resident in India.
- **OpenAI API** — vision handwriting transcription, working-step review, tutoring and
  explanation, photo-to-question and language features.

The server-side OpenAI providers already exist (`server/platform/handwritingProvider.js`,
`server/platform/workingProvider.js`) behind an opt-in setting.

## Decision

1. **Online-first.** The canonical student experience assumes a signed-in, connected account.
   AI-assisted features (vision handwriting, tutor, explanations, photo-to-question, language)
   are first-class product paths, not experiments.
2. **Hosting.** The `/v1` server and the built web client are to be deployed on Railway Pro
   (ADR-0001 phase 4). Nothing in this ADR claims that deployment exists yet.
3. **Data authority.** Supabase Postgres (Mumbai) becomes the authoritative store for accounts and
   learning records as each migration phase lands. Until a phase lands, the current authority for
   that data is unchanged. IndexedDB becomes a device cache, not the system of record.
4. **AI proposes, the deterministic engine decides.** A model may transcribe, explain, hint or
   propose; the mark a student receives is decided by Pri's deterministic equivalence marker and
   Step Check. A model output can never turn a wrong answer into a right one.
5. **Deterministic fallback stays on the client.** The deterministic engine (question generation,
   marking, Step Check) remains bundled in the client. It gives an instant mark while a cloud call
   is in flight and keeps typed-answer practice usable when a mobile connection drops. It is a
   resilience path, not a marketed offline mode.

   **Amendment (2026-10, owner decision): handwriting and photos are read only by the server.**
   In the owner's words: "Pri Learning does not have the feature to mark handwriting or photo when
   not online, since the local engine is just not good enough." Handwritten ink and photographed
   working are transcribed only by the server (OpenAI) reader, on by default for a signed-in
   account whose `/v1/handwriting/status` is usable (an explicit off in Settings is respected; an
   under-18 account waits for guardian consent). The on-device recogniser is not in the marking
   path or the "I'm reading:" panel. When the server cannot read (offline, not signed in, reader
   down) the ink stays on the page, the student is told the real reason, and it is read
   automatically when the reason clears. The transcription is
   still only a proposal — the deterministic engine decides the mark from it.
   **Amendment (2026-10-10, owner decision): grading is online-only and server-authoritative.**
   In the owner's words: "Do NOT allow signed-out or offline mathematical checking, even when
   labelled 'marked on this device'." This supersedes the connection-loss marking clause of item 5.
   - Checking an answer, awarding marks and showing the solution require a verified, eligible,
     signed-in account, a connection, and a question the server issued. The server runs the same
     deterministic engine; a model still never sets a mark (item 4).
   - Before that, a student may read the question, type, write, preview notation and save drafts.
     All of it is kept on the device. When the answer is checked the server issues the identical
     question from its generator, difficulty and seed — never from a client-supplied answer or id —
     so the question, typed steps and ink the student already has are the ones that get marked.
   - Without an account or a connection the app says so in the question itself (sign in / reconnect)
     and marks nothing. No result is labelled as marked on the device.
   - The engine stays bundled in the client for question selection and generation, notation preview,
     and reading attempts recorded by earlier versions. It does not mark new work.
   - Examination papers (CBSE, JEE Main, JEE Advanced, IOQM and the practice paper) are issued,
     collected and marked by the server (`server/platform/exams.js`, `/v1/exams`). The device
     composes a paper *spec*; the server holds it to its own blueprint slot by slot (the layout its
     seed allots, each chapter's cells inside the section's difficulty window), enforces the plan
     from its own entitlement record (free exam simulations counted from its sealed papers, the JEE
     Advanced capability, at most three open papers), chooses every question, titles the paper, seals questions, marking grid, start and deadline
     under an exam id owned by the account, keeps the latest answer snapshot, and finalises exactly
     once. The layout seed is the server's too: the device asks for it (`POST /v1/exams/layout`),
     composes for it, and a paper composed for any other seed is refused; the same seed is returned
     until a paper is sealed under it. A finish that arrives later than `deadline + 2 minutes` is
     marked on the last snapshot the server holds and flagged late. A paper nobody finishes is
     finalised by the server in the same way once that time has passed — on the account's next
     start or read of a paper, and in housekeeping — so an abandoned paper still has a result and
     still counts as a sat paper. Finalising records every question of the paper as content the
     account has seen (the record practice keeps), so a later practice copy is a repeat; and an
     item already seen when the paper is finalised is marked and scored but flagged a repeat, which
     earns no XP, rating or mastery. With no connection at the finish the paper is queued on the
     device, frozen and unscored, until the server's result arrives. A paper marked by an earlier
     app version opens in review labelled as such and is never shown as certified.
   - The placement diagnostic is marked by the server as well: each placement question is issued
     by `/v1/practice/issue` in mode `placement` and answered through the practice submit and
     reveal routes (`client/src/local/backend.js`, `POST /placement/start` and
     `POST /placement/:id/answer`). The server writes no progress event for that mode — a
     placement verdict is diagnostic evidence, not practice — and a placement check begun by a
     version that marked on the device cannot be continued; it is started again.
   - Known limits, not hidden: an open paper is resumed on the device that started it; a second
     device sees a paper once it is finished (its result and marked detail are read back from the
     account).
   - `.pri-os/fleet.json` keeps the principle key `deterministic_marking_fallback` (the fleet
     validator pins the key name). From this amendment it means: the deterministic engine, not a
     model, decides every mark — on the server.
6. **Answer-blind handwriting is unchanged.** Vision transcription receives the ink image only —
   never the question's expected answer, solution or marks.
7. **Secrets live only on the server.** `OPENAI_API_KEY` and Supabase service-role credentials live
   only in Railway environment variables — never in the client, the repository, CI logs or chat. The client receives only the Supabase anon key and URL, and every
   table it can reach is protected by Row-Level Security.
8. **Database changes go to staging first.** Every schema, Row-Level Security or data change is
   applied to a Supabase staging project and verified there before it is applied to production.
   Production application of an irreversible migration needs explicit owner approval at the time.
9. **Cost control is a product requirement.** Every model call is metered per account and plan,
   rate-limited, cached where the input is identical, and fails closed to the deterministic path
   when a budget is exhausted.

## Consequences

- `AGENTS.md`, `authoritative-architecture.md` and `.pri-os/fleet.json` replace the
  `offline_first` principle with `deterministic_marking_fallback`. The CI context
  `Client build and offline-first boundary` keeps protecting that the deterministic engine still
  builds and runs client-side; it is not removed by this ADR.
- Profile/data isolation moves from per-device IndexedDB separation to Postgres Row-Level Security
  plus server authorization. A cross-account read is a release-blocking security regression.
- Student data is personal data of minors under India's DPDP Act. Verifiable parental consent,
  data export and deletion, and a published processor list (Railway, Supabase, OpenAI) are
  release requirements, and legal sign-off remains an external authority.
- OpenAI calls must set `store: false` and must not send names, emails or other identifiers.

## Migration phases (each its own mission, branch and PR)

| Phase | Mission | Risk |
|---|---|---|
| 1 | This ADR and governance update | R4 |
| 2 | Postgres schema + Row-Level Security on Supabase, replacing the SQLite store for `/v1` records; staging project first | R4 |
| 3 | Supabase Auth (email, Google, Apple) behind the existing `/v1` session contract | R4 |
| 4 | Railway deployment: Dockerfile, health check, release identity, environment contract | R3 |
| 5 | Learning records server-authoritative: attempts, mastery, review schedule; IndexedDB as cache | R4 |
| 6 | OpenAI handwriting + working review as default path, with metering and budgets | R4 |
| 7 | AI tutor (hint → Socratic question → narrated walkthrough), grounded in verified solutions | R3 |
| 8 | Hindi language layer, photo-to-question, teacher live view | R3 |

## Not decided here

- Whether existing production SQLite data must be migrated, or Supabase starts empty.
- Pricing, plan limits and per-plan AI budgets.
- Any destructive production operation; each needs explicit owner approval at the time.
