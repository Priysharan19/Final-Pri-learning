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

---

# Real-photo acceptance

**Evidence class: a real photograph of a student's page, the real configured provider, a real `node server/index.js` on localhost with local SQLite. Not staging, not production, not a deployed build, not a physical device.** Extra pages labelled `SIMULATED` are typeset by the script in a handwriting face; they are nobody's handwriting.

It is the regression for the owner's failure of 2026-10-10: *"Find the least value taken by the real function f(x) = (x + 3)² + 6."* answered with a photo of ruled paper carrying unrelated set notes above the working. The app copied the sentence "least value ⇒ 6." into the answer field and could not parse it.

## Run

```bash
cd ~/Developer/Final-Pri-learning        # any directory linked to the Railway project
railway run --service pri-learning-staging --environment staging -- \
  node <path-to-this-checkout>/tools/acceptance/launch-real-photo.mjs
```

`launch-real-photo.mjs` is `launch.mjs` running `real-photo.mjs`: the same clean child environments (only `PRI_HANDWRITING_*` reach the local servers; no database, Supabase, session or billing variable), the same output scrubber, never a mock.

- `PRI_ACCEPT_PHOTO` — the photo to read. Default: `~/Developer/pri-private-fixtures/owner-photo-least-value-2026-10-10.jpg`. **The fixture is private. It is never committed, copied, saved or logged**; it is sent only to the local server's reader. With no file there the run prints `NOT VERIFIED` and exits `3` without contacting the provider.
- `PRI_ACCEPT_READS` — how many times the photo is read (5–8, default 5).
- `PRI_ACCEPT_OUT` — where the `SIMULATED-*.jpg` pages and `report.json` (transcripts only) go.

Exit code: `0` every expectation met · `1` an expectation failed · `3` nothing failed but something is NOT VERIFIED · `2` a dependency is missing. About 16 reader requests a run (at most 21–30 model calls counting fallbacks), capped at 58 in the script.

## What it drives

The app's own code, imported — not re-implemented: `client/src/ink/photoRaster.js` (image preparation, in Chromium), `client/src/photo/transcript.js` (which lines belong to the question), `client/src/photo/finalAnswer.js` (the final answer), `client/src/ink/readerFailure.js` (naming a refusal); and the server's real routes in the client's order: `/v1/handwriting/transcribe`, `/v1/practice/:id/recognize`, `/recognition/:receipt/confirm`, `/submit`, `/v1/sync/pull`.

## The twelve assertions

1. the prepared photo is accepted; 2. the real provider read it; 3. the unrelated set notation is not among the lines sent as working by default (and is still in the transcript); 4. every inequality line is read as ≥ or flagged for the student — the raw result of every read is printed, with the rate of strict-and-unflagged signs; 5. the proposed answer is `6`; 6. the answer field never holds an unparseable phrase; 7. the transcript is editable (module-level here; the browser proof is `client/test/tour-photo-answer.js`); 8. the server accepts the confirmed answer; 9. marks and feedback as the server pays them; 10. the worked solution is present; 11. the attempt is persisted for the account; 12. a replay does not double-credit.

It also records (not judges) what the marker pays for the right answer with and without the unrelated lines, a wrong answer with correct working, and strict `>` where `≥` is right; reads five `SIMULATED` adversarial pages (a natural-language final, notes with larger numbers before and after the working, two candidate finals, a non-numeric answer type) and three unreadable ones (blurred, cropped, sideways); and drills the upload and provider-timeout failures.

## The question

The server chooses every seed and refuses a caller's. To be issued the owner's exact question, the script seals a prepared-question token for it with **this run's own local key** (generated by the launcher; no deployed server holds it) and the real server binds it. A production client cannot do this, and the answer is never read from the server.

## What it cannot show

That the request the server forwards to the provider carries only the image is proved without a network by `server/test/provider-answer-blind-check.mjs`. Five reads of one page are a regression, not a measure of reading accuracy. Nothing here is evidence about the deployed build, an iPad, a phone camera's own file handling, or Apple Pencil.
