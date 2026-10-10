# Flagship handwriting acceptance

**Evidence class: real provider, real localhost HTTP server, simulated handwriting images; not staging, not physical device.**

It is also not a student's writing, not Apple Pencil, and not a measure of reading accuracy. One run reads about a dozen pictures; that is a journey check, not a benchmark.

## What it proves or disproves

One journey, over real HTTP against a real `node server/index.js` process on localhost, with the real configured handwriting provider (`server/platform/handwritingProvider.js`):

server-issued question → handwriting image → provider transcription (`POST /v1/handwriting/transcribe`) → server reading receipt (`POST /v1/practice/:id/recognize`) → authenticated deterministic grading (`POST /v1/practice/:id/submit`) → verdict, marks, worked solution → persisted attempt, read back through `GET /v1/sync/pull/0`.

The requests are the shipped client's, in its order (`QuestionCard.jsx` `submit()` → `local/backend.js` `gradeOnServer`). The simulated student never edits a reading: what the provider read is what is submitted.

Cases: (1) a wrong answer "5", followed through both tries to resolution; (2) the right answer, plus an idempotent replay; (3) four lines of working; (4) the same working with a wrong last line — method marks are recorded, not judged; (5) a JPEG "photo" of the working (paper colour, 3° turn, stored sideways with EXIF Orientation 6) through the app's own `preparePhoto`; (6) failure honesty — all-white, scribble, truncated and random-byte files, no session, and a provider timeout on a second server booted with `PRI_HANDWRITING_TIMEOUT_MS=2000`.

The question is Class 10 Arithmetic Progressions, difficulty 3 (`c10-arithmetic-progressions`, "which term is equal to …"). The server chooses the seed; the script never sends one. It asks for up to 40 questions and uses the owner's exact numbers (16, −6, −122 → 24) only if the server happens to issue them (1 form in 13,824); otherwise it uses the numbers issued, works out the expected term number itself from the printed question, and says so under NOT VERIFIED.

## Run

```bash
cd ~/Developer/Final-Pri-learning        # any directory linked to the Railway project
railway run --service pri-learning-staging --environment staging -- \
  node <path-to-this-checkout>/tools/acceptance/launch.mjs
```

Optional: `PRI_ACCEPT_OUT=<dir>` (where pictures, `report.json` and scrubbed server logs go; default a temp directory), `PRI_ACCEPT_ISSUE_BOUND` (10–120, default 40), `PRI_ACCEPT_SEED` (the simulated pen's jitter).

Exit code: `0` every expectation met · `1` an expectation failed · `3` nothing failed but something is NOT VERIFIED · `2` a dependency is missing (no provider credential, or not run through the launcher).

Pictures only, no server and no provider: `node tools/acceptance/flagship-handwriting.mjs --render-only`.

About 24 provider model calls per run, capped at 60 in the script and at 70 + 6 by the local servers' own spend ceiling.

## What the launcher does with the credential

`railway run` injects the staging service's variables into `launch.mjs` only. The launcher:

- boots the local servers with a clean environment: `PATH`, `HOME`, the `PRI_HANDWRITING_*` variables, and local settings (`NODE_ENV=development`, a temp SQLite file, a per-run local delivery key, a small paid-call ceiling). No database URL, Supabase, Resend, billing, Twilio, session or CSRF variable is passed, so the staging database cannot be reached;
- runs the acceptance script in a second clean environment that does not contain the provider credential;
- prints variable names only, never a value, and passes all child output through a scrubber before it reaches the terminal or `server-*.log`.

With no credential it exits `2` and runs nothing. It never substitutes a mock.

## The test account

A Class 10 student is a child, so the account is registered as one, naming a guardian. The email is verified and the guardian's consent is given through the server's own routes (`/v1/account/email/verify`, `/v1/account/guardian/confirm`) using the links the local server queued in its outbox — read from the run's own temp database with the run's own local key, exactly as `server/test/support/app-harness.mjs` does. No row is written by the script and no gate is skipped; the script also checks the reader refuses the account before those two steps.

## Simulated handwriting

`simulated-ink.mjs` writes text as pen strokes (per-glyph size, slant, rotation, baseline and wobble) and returns stroke coordinates. The app's own rasterisers, running in Playwright's Chromium, turn them into the pictures that are sent: `client/src/ink/cloudRaster.js` for ink and `client/src/ink/photoRaster.js` for the photo. Every saved picture is named `SIMULATED-handwriting-*`. Nothing here is committed as a fixture.

## What it cannot show

- The request the server sends on to the provider is not observable from outside the server. That it carries only the image is proved without a network by `server/test/provider-answer-blind-check.mjs`. This run asserts what it can see: every transcribe body is `{ image }`, and the route refuses a body that names an answer or a question.
- `/v1/practice/:id/recognize` reports no latency, engine or fallback fields, so those are recorded only for `/v1/handwriting/transcribe`.
- Staging, production, Postgres, a physical iPad, Apple Pencil and real handwriting are all outside this run.

## Recognition cost measurement

**Evidence class: real provider, real localhost HTTP server, simulated handwriting images; not staging, not physical device.**

```bash
cd ~/Developer/Final-Pri-learning
railway run --service pri-learning-staging --environment staging -- \
  node <path-to-this-checkout>/tools/acceptance/launch-recognition-cost.mjs
```

`launch-recognition-cost.mjs` follows the same credential rules as `launch.mjs` (clean child environment, only `PRI_HANDWRITING_*`, temp SQLite, names never values, scrubbed output) and boots one local server whose own spend ceiling is **25 paid calls**, so the run cannot make a 26th. `recognition-cost.mjs` (which never holds the credential) reads about ten simulated pictures once each — single digit, numbers, multi-line working, two photo-sized pages, a blank page — and records, from the server's `/v1/metrics` counters, the provider calls, the model id the provider reported, input/output/reasoning tokens, latency and whether the fallback ran. It then shows that `/handwriting/transcribe` followed by `/practice/:id/recognize` on the same picture is one provider call. About 12 provider calls per run. Output: `recognition-cost-report.json` and `SIMULATED-handwriting-*` pictures in `PRI_ACCEPT_OUT`. Results and the cost model built on them: `docs/operations/recognition-cost.md`.
