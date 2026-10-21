# PR #618 — CodeQL alert #461: recognition route rate-limiting review

**Finding:** `js/missing-rate-limiting` (high), `server/platform/practice.js:592–675`,
[GitHub alert #461](https://github.com/Priysharan19/Final-Pri-learning/security/code-scanning/461).
**Scope:** combined Task 01 + Task 02 integration. **Review position:** a static-analysis false positive
for this specific route, subject to GitHub's formal false-positive disposition.
This note does not dismiss other alerts or certify security of the entire service.

## Observed call path

- `createPracticeRouter` installs `requireSession(db)`, `requireVerifiedEmail`, and
  `requireRole('student')` before any route handler.
- The flagged `POST /:id/recognize` handler itself installs
  `rateLimit(db, 'practice-recognize', RECOGNIZE_LIMIT)` **before** the handler.
  `RECOGNIZE_LIMIT = { limit: 120, windowMs: 60 * 60 * 1000 }`.
- `rateLimit` in `server/platform/security.js` identifies the authenticated account,
  hashes it into a `practice-recognize:<sha256 prefix>` bucket, calls
  `consumeRateLimit`, and returns HTTP 429 with `RATE_LIMITED`,
  `RateLimit-Remaining`, `RateLimit-Reset` and `Retry-After` on exhaustion.
- `consumeRateLimit` uses a single database `INSERT ... ON CONFLICT ...
  DO UPDATE ... WHERE count < limit RETURNING` statement; the quota is
  persisted and competing requests cannot increment past the configured ceiling.
  This applies to SQLite and PostgreSQL; it is not a process-local counter.
- The route performs account-scoped ownership verification before accessing any
  retained read or committing a receipt. It does **not** invoke the paid reader
  for an unread image on Submit. Reuse and consent checks still apply.

## Adversarial HTTP evidence

`node server/test/abuse-limits-check.mjs`: **33/33**, including exact limit+1
and refusal headers for the mounted route-policy inventory.

`node server/test/pr618-recognition-rate-concurrency-check.mjs`:
**118 assertions on SQLite** and **118 on migrated PostgreSQL**.
Both run against the actual mounted HTTP middleware, use authenticated verified
accounts, and send safe malformed requests that never invoke a paid provider:

- Anonymous request: 401.
- First account: 110 sequential authorized invalid requests reach the body
  validator (HTTP 400) and consume 110 of its 120 units.
- Twelve simultaneous requests compete for 10 remaining units: exactly 10
  reach validation (400), exactly 2 receive 429 with machine-readable rate-limit
  headers.
- An additional request cannot bypass exhaustion: 429.
- A different authenticated account retains an independent bucket and reaches
  body validation (400).

This tests request-level limiter behavior, bucket isolation and atomicity.
It does not assess all potential denial-of-service avenues, distributed infrastructure,
or physical handwriting providers. Existing production tests cover sessions, roles,
guardian consent and body limits separately. Do not suppress the scanner rule;
record an explicit formal disposition of this **specific** alert only when authorized.

## Other issues and remaining release gates

The historical open alerts on protected `main` are separate and are not dismissed
by this evidence; security and privacy owner risk acceptance, external penetration
testing, staging configuration verification and release sign-off are outside this PR.

The independent academic examiner dossier is **PENDING** and has no relationship
to CodeQL disposition.
