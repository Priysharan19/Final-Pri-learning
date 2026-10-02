# Failure and recovery drills

Status: **the automated drills run in CI on SQLite and on a real Postgres; the staging and
production drills below are `BLOCKED_EXTERNAL` until the owner runs them and fills §4.**
V1 hard blocker #15 (`docs/release/PRI_V1_RELEASE_SCOPE.md`) is closed by the manual record
in §4, not by the automated suite alone: the suite proves the code's behaviour, the drill
proves the deployed system's (Railway, Supabase, Resend, OpenAI, the alerts in `alerts.md`).

---

## 1. Automated drills (every PR)

`server/test/failure-drills-check.mjs` — run by `npm run test:platform:ops` (SQLite) and by
`npm run test:platform:pg` (Postgres, as the `pri_server` role, through
`scripts/with-postgres.mjs`).

| Drill | How it breaks the dependency | What must hold |
|---|---|---|
| Database unavailable at runtime | Postgres: the server's connections go through a TCP relay the drill cuts (all sockets destroyed, new connections refused) and restores on the same port. SQLite: the store is faulted with the `ECONNREFUSED` a refused connection produces | `/v1/ready` → 503 `PLATFORM_DB_UNAVAILABLE` + `Retry-After: 5`; `/v1/health` stays 200 with `database.reachable: false`; authenticated reads and sync pushes → 503 `PLATFORM_DB_UNAVAILABLE`, `retryable: true`, `Retry-After`, the request id in the body; never a 500, never a guardian-consent 403; `DB_CONNECTIVITY` fires; the log names the code, never host/port/URL. When the database is back: ready again without a restart, the same session works, the refused push resent under its `Idempotency-Key` is stored once |
| Provider timeout / 5xx / 429 / malformed | The server is pointed at a local fake provider (`PRI_HANDWRITING_ENDPOINT`, `PRI_WORKING_ENDPOINT`) that hangs, answers 500, 429, or malformed JSON | Handwriting: 504 `HANDWRITING_TIMEOUT` (cut off by `PRI_HANDWRITING_TIMEOUT_MS`), 503 `HANDWRITING_PROVIDER_5XX`, 503 `HANDWRITING_PROVIDER_429`, 502 `HANDWRITING_MALFORMED` — all `retryable`. Working: 504 `WORKING_TIMEOUT`, 503 `WORKING_UNAVAILABLE`, 502 `WORKING_MALFORMED`. Failures counted by code with latency; logged without image or key; both recover on the next request once the provider does |
| Email provider failure | The Resend transport's provider answers 503 for every send | Registration still succeeds (delivery is queued); one attempt per backoff step (`RESEND_503` recorded), at most 8 attempts, purged once the link expires; the account row is unchanged (not verified, same credential, same role); the student can still sign in; nothing is logged by address. Once the provider is back, a new verification request is delivered and its link verifies |
| Process restart mid-request | (a) the push's transaction is killed after its work and before `COMMIT`; (b) the push commits and the server is restarted before the device hears back. Each time a fresh server is started on the same database | (a) nothing from the uncommitted push, not even its idempotency key, survives; the replay is applied once. (b) the replay returns the acknowledgement the device never received, byte for byte; nothing is stored twice |
| Silent partition and the consent gate | Every statement hangs (no reset); then only the guardian-consent query fails; then only the consent gate's own session lookup fails | `/v1/health` answers 200 with `database.reachable: false` within its 1.5 s bound (inside the 5 s container healthcheck); `/v1/ready` 503 `PLATFORM_DB_TIMEOUT` within its 2 s bound. With the database up, a child without guardian consent gets 403 `GUARDIAN_CONSENT_PENDING`; a failed consent read or a failed gate session lookup gets 503 `PLATFORM_DB_UNAVAILABLE` and never passes through to sync |

## 2. Manual drills on staging (owner, with go-ahead)

Run in this order, on **staging only**, with the alert routes from `alerts.md` §5 configured,
and record each in §4. Every step that touches a hosted system needs the owner's explicit
go-ahead at the time. Do not run these against production until each has passed on staging.

1. **Server down.** Railway → staging service → *Remove* the active deployment (or scale to
   0). Expect `SERVER_DOWN` within 2–3 minutes. Redeploy; expect the monitor to clear and
   `/v1/ready` → 200.
2. **Database unreachable.** Supabase → staging project → *Pause project* (or, less
   disruptive, temporarily set a wrong password on the server's login role with
   `\password`). Expect: `/v1/ready` → 503 `PLATFORM_DB_UNAVAILABLE`, `/v1/health` → 200 with
   `database.reachable: false`, app requests → 503 `PLATFORM_DB_UNAVAILABLE`, `DB_CONNECTIVITY`
   firing in `/v1/metrics`, the Railway log alert firing. Restore; expect recovery **without
   redeploying**. Record time to detect and time to recover.
3. **Email provider failure.** Set `PRI_RESEND_API_KEY` on staging to an invalid value
   (`re_invalid_drill`), redeploy, register a test account on a mailbox the owner controls.
   Expect `auth_email_failed` lines with `RESEND_401`/`RESEND_403`, `AUTH_EMAIL_FAILURES`
   after 3, `/v1/ready` `checks.authEmail.state = failing`. Restore the real key; request
   verification again; the email arrives and verifies.
4. **Handwriting provider failure.** Set `PRI_HANDWRITING_API_KEY` on staging to an invalid
   value. Expect `/v1/handwriting/status` and `/v1/ready` `checks.handwriting` to report
   `HANDWRITING_PROVIDER_AUTH`, transcription → 503 coded, the on-device reader unaffected,
   `PROVIDER_FAILURE_SPIKE` after 5 failures. Restore.
5. **Webhook failure.** From the Razorpay **test-mode** dashboard, send a test webhook with
   the staging webhook secret changed. Expect 4xx rejections counted, `WEBHOOK_FAILURES` after
   10. Restore the secret; resend; expect `ok`.
6. **Restart mid-sync.** On a test iPad/simulator signed in to staging, queue practice
   offline, reconnect, and restart the Railway service while the outbox drains. Expect the
   outbox to drain completely after the restart with no duplicate events (compare event
   counts in the account export before and after).

## 3. Production

Production repeats 1 (as a planned restart, not a removal), 2 only as part of the
`postgres-cutover.md` rehearsal window, and 6 — each only with the owner's go-ahead, inside a
maintenance window, after the staging record is complete. Drills 3–5 are not run against
production; their staging results stand for the same build.

## 4. Drill record — `BLOCKED_EXTERNAL` until filled

| Drill | Environment | Release SHA | Date / operator | Detected by (alert id) | Time to detect | Time to recover | Result / follow-up |
|---|---|---|---|---|---|---|---|
| 1 Server down | staging | — | — | — | — | — | — |
| 2 Database unreachable | staging | — | — | — | — | — | — |
| 3 Email provider failure | staging | — | — | — | — | — | — |
| 4 Handwriting provider failure | staging | — | — | — | — | — | — |
| 5 Webhook failure | staging | — | — | — | — | — | — |
| 6 Restart mid-sync | staging | — | — | — | — | — | — |

Simulator or local results never fill a staging/production row.
