# ADR-0001 — Online-first runtime: Railway + Supabase (Mumbai) + OpenAI

- **Status:** Proposed — owner decision recorded 2026-10-01; accepted when this PR merges.
- **Decision owner:** product owner (Priysharan19).
- **Supersedes:** the "local-first" learning-runtime clause of `authoritative-architecture.md` as it stood at `449be42`.

## Context

Pri Learning was built local-first: the learning engine, marking and progress run in the browser
against IndexedDB, and the `/v1` server is an optional control plane on a single SQLite volume.

The product goal is now to be the strongest maths-practice product for Indian students
(NCERT 7–12, CBSE boards, JEE Main/Advanced, olympiad). The owner has chosen an online-first
product and has provisioned:

- **Railway Pro** — application hosting for the `/v1` server and web client.
- **Supabase, Mumbai region** — managed Postgres, auth, storage and realtime, with student data
  resident in India.
- **OpenAI API** — vision handwriting transcription, working-step review, tutoring and
  explanation, photo-to-question and language features.

The server-side OpenAI providers already exist (`server/platform/handwritingProvider.js`,
`server/platform/workingProvider.js`) behind an opt-in setting.

## Decision

1. **Online-first.** The canonical student experience assumes a signed-in, connected account.
   AI-assisted features (vision handwriting, tutor, explanations, photo-to-question, language)
   are first-class product paths, not experiments.
2. **Hosting.** The `/v1` server and the built web client are deployed on Railway.
3. **Data authority.** Supabase Postgres (Mumbai) becomes the authoritative store for accounts and
   learning records as each migration phase lands. Until a phase lands, the current authority for
   that data is unchanged. IndexedDB becomes a device cache, not the system of record.
4. **AI proposes, the deterministic engine decides.** A model may transcribe, explain, hint or
   propose; the mark a student receives is decided by Pri's deterministic equivalence marker and
   Step Check. A model output can never turn a wrong answer into a right one.
5. **Deterministic fallback stays on the client.** The deterministic engine (question generation,
   marking, Step Check, on-device ink) remains bundled in the client. It gives an instant mark while
   a cloud call is in flight and keeps practice usable when a mobile connection drops. It is a
   resilience path, not a marketed offline mode.
6. **Answer-blind handwriting is unchanged.** Vision transcription receives the ink image only —
   never the question's expected answer, solution or marks.
7. **Secrets live only on the server.** `OPENAI_API_KEY` and Supabase service-role credentials are
   Railway environment variables. The client receives only the Supabase anon key and URL, and every
   table it can reach is protected by Row-Level Security.
8. **Cost control is a product requirement.** Every model call is metered per account and plan,
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
