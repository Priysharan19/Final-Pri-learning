# Disaster runbook: the `/v1` server on Railway + Supabase

Status: **procedures for the online-first production topology of ADR-0001** (`docs/architecture/adr-0001-online-first-runtime.md`): one Railway service built from `main`, the platform database on Supabase Postgres (Mumbai), the model provider (OpenAI) behind the server's own key. Every step below names the signal that says you are in that failure, the command or console action that recovers it, and what the student experiences meanwhile. The alert thresholds and series are `alerts.md`; the staged drills that rehearse these are `drills.md`; the database cutover itself is `postgres-cutover.md`.

Three facts shape every procedure:

1. **The deterministic engine is bundled in the client.** Marking, the on-device handwriting reading and the authored hints never need the server. A provider or server outage degrades the second reading and the tutor; it never stops a student practising or loses their work (IndexedDB on the device, synced when the server returns).
2. **Nothing here is reachable without the owner's credentials.** Railway and Supabase consoles, the OpenAI dashboard and the DNS registrar are owner-held; the repository holds no secret (`tools/secret-scan.mjs` gates every push and the built bundle).
3. **Rollback is a redeploy of a previous SHA, never a hot edit.** The image is immutable and built from `main`; `GET /v1/health` names the SHA it is running.

First step for every incident, whatever the alert: take a `requestId` from the alert's log line or Sentry issue, search Railway logs for it, and read `route`, `code`, `status` and `release`. The same `requestId` is echoed to the client in `X-Request-Id` and in every error body.

---

## 1. Model provider down (OpenAI)

**You are here when:** `PROVIDER_FAILURE_SPIKE` fires (`provider_calls_total{provider,outcome=failed}` ≥ 5 and ≥ 25% in 5 minutes); `provider_call_failed` lines with `HANDWRITING_PROVIDER_5XX`, `HANDWRITING_PROVIDER_429`, `HANDWRITING_TIMEOUT`, `WORKING_UNAVAILABLE`, `TUTOR_UNAVAILABLE`; `/v1/ready` reports `checks.handwriting` degraded (readiness stays 200: a provider is never a reason not to serve).

**Student experience:** the on-device reading stays on screen ("read on this device"); marking is unchanged; the tutor shows the authored hints (`source: fallback`). Nothing is lost.

**Do:**

1. Confirm it is the provider and not the key: a `HANDWRITING_PROVIDER_AUTH` code means the key was rejected — go to §4 (key compromise/rotation), not here.
2. Check the provider's status page and the OpenAI dashboard for the project (rate limits, billing hold).
3. If the failure is rate limiting (`_429`), lower load rather than retrying harder: set `PRI_PAID_CALLS_PER_HOUR` to roughly half the observed hourly volume in Railway variables (the service restarts). The refusal students meet is `PAID_CAPACITY_REACHED`, which the client treats as "carry on with the local reading".
4. If the provider is down, do nothing to the deployment: the routes already fail per request with a coded, retryable answer, and the client does not retry in a loop. Watch `provider_calls_total{outcome=ok}` recover.
5. Afterwards: reconcile `GET /v1/admin/ai-usage` against the provider's usage page for the day (failed calls that the provider answered are recorded; a day of silence should show near-zero tokens).

**Do not:** raise timeouts (`PRI_HANDWRITING_TIMEOUT_MS`) above the client's 55 s budget; swap to an unreviewed model name mid-incident (`PRI_HANDWRITING_MODEL` is a release decision, `docs/architecture/authoritative-architecture.md`).

## 2. Database down or saturated (Supabase Postgres)

**You are here when:** `DB_CONNECTIVITY` fires (`db_errors_total{code=PLATFORM_DB_UNAVAILABLE}` ≥ 3 in 5 minutes); `/v1/ready` → 503 `PLATFORM_DB_UNAVAILABLE`; `platform_db_pool_error` lines; or `DB_SATURATION` (`PLATFORM_DB_BUSY` / `PLATFORM_DB_TIMEOUT` ≥ 20 in 5 minutes). `/v1/health` keeps answering 200 with `database.reachable: false` by design, so the container is not restarted in a loop.

**Student experience:** anything signed-in (sync, classes, cloud reading, tutor) answers a coded 503 with `Retry-After`; the client's outbox keeps the events and resends when the server is back; practice continues locally. A signed-in session cookie is still valid when the database returns.

**Do:**

1. Supabase console → project health: paused project (free tier idles), CPU/IO, connection count against the pooler size. Resume a paused project; that alone fixes most "down" reports.
2. Saturation: compare `PRI_DATABASE_POOL_MAX × replicas` with the pooler's limit (`postgres-cutover.md` §1). Lower `PRI_DATABASE_POOL_MAX` or raise the pooler, never both blindly. Check for a runaway query in Supabase → Database → Query performance; the server's own statements are bounded by `PRI_DATABASE_STATEMENT_TIMEOUT_MS` (15 s default).
3. Connectivity: verify `PRI_DATABASE_URL` still names the right host and `sslmode`, and `PRI_DATABASE_SSL_ROOT_CERT` has not expired (a TLS failure is `PLATFORM_DB_TLS_INVALID` at boot, not at run time). A Supabase password rotation invalidates the URL: update the Railway variable and redeploy.
4. Regional outage: wait. Do **not** repoint `PRI_DATABASE_URL` at a different database or at SQLite; the server refuses to fall back by design, and a second writable copy is the one way to lose data for good.
5. After recovery: `/v1/ready` back to 200; `db_errors_total` flat; run `npm run test:platform:pg-live` against staging if the incident involved a Supabase maintenance upgrade (schema parity, `schema_version` 13).

**Data loss boundary:** Supabase point-in-time recovery is the restore path (owner action, `postgres-cutover.md` §6). A restore is a new database the service is repointed at, done once, with the service scaled to zero during the switch; events the devices still hold in their outboxes replay idempotently (`sync-idempotency-contract-check.mjs`).

## 3. Bad deploy: roll back to the previous SHA

**You are here when:** `HTTP_5XX_SPIKE` fires right after a deploy (`http_responses_total{class=5xx}` ≥ 10 and ≥ 5% in 5 minutes); `/v1/ready` 503 after a deploy (`PLATFORM_DB_SCHEMA_MISMATCH`, `NOT_READY`); `CLIENT_ERROR_SPIKE` (≥ 20 crash reports in 15 minutes) whose stored rows carry the new `build`; the post-deploy verifier (`tools/verify-deployment.mjs`, `deployment-image.yml`) failed loudly.

**Student experience:** depends on the fault; a crashed route shows the error boundary card ("Your saved work is safe") and reports it; the service worker keeps serving the previous bundle until the new one is fetched.

**Do (Railway):**

1. Identify the last good SHA: `GET /v1/health` → `releaseIdentity.releaseSha` on the broken deploy, and the previous deployment in Railway → Deployments (each is one `main` commit). Confirm the previous SHA's own CI was green (`main-integrity.yml`).
2. Railway → Deployments → the previous successful deployment → **Redeploy**. This rebuilds the same immutable image from that commit; nothing is edited in place. The healthcheck path is `/v1/ready`, so the rollback receives traffic only once it is ready.
3. Confirm: `curl -fsS https://<origin>/v1/health` shows the previous SHA; `curl -fsS https://<origin>/v1/ready` is 200; `firing` on `/v1/metrics` empties within the 5-minute window.
4. Schema: a rollback across a migration boundary is safe only when the migration was additive (every migration in `supabase/migrations` is, and `schema_version` is checked at boot). A rolled-back server that expects an older `schema_version` than the database carries refuses to boot (`PLATFORM_DB_SCHEMA_MISMATCH`): roll forward with a fix instead, never edit `platform_meta` by hand.
5. Then revert on `main` through a PR (`git revert <sha>`), with the failing behaviour pinned by a test, so the next deploy is the fix and not a surprise.

**Do not:** push to `main` directly; change Railway variables as a substitute for a code fix (except the spend ceilings, which exist for that); redeploy a SHA whose CI was not green.

## 4. Key compromise: rotation steps

**You are here when:** a provider key, the Supabase service password/URL, `PRI_CSRF_SECRET`, `PRI_AUTH_DELIVERY_KEY`, `PRI_MFA_KEY`, `PRI_METRICS_TOKEN`, `PRI_SENTRY_DSN` or a billing secret appeared anywhere outside Railway variables (a chat, a ticket, a log, a commit — `tools/secret-scan.mjs` fails CI on the key shapes it knows, but treat a report from anyone as true until proven otherwise); `HANDWRITING_PROVIDER_AUTH` on a key you did not change; unexplained provider spend (`AI_MONTHLY_BUDGET_70PCT` or the provider's own usage alert without matching `ai_calls_total`).

**Order matters: issue the new credential, deploy it, then revoke the old one** — except the model-provider key, which is revoked first because every minute it lives costs money.

| Credential | Rotate | What breaks between old and new, and what does not |
|---|---|---|
| `PRI_HANDWRITING_API_KEY` (OpenAI; also the working checker, photo reader and tutor) | Revoke the key in the OpenAI dashboard **first**; create a new project key; set it in Railway; the service restarts | Cloud reading, working check, photo and tutor answer `*_PROVIDER_AUTH` (503) until the new key is live; marking and on-device reading are untouched. Reconcile `/v1/admin/ai-usage` and the provider's usage page for the exposure window |
| `PRI_DATABASE_URL` password | Supabase → Settings → Database → reset the `pri_server` role password (or the project password if that is what the URL carries); update the URL in Railway; redeploy; the old password stops working on reset | The service fails readiness (`PLATFORM_DB_UNAVAILABLE`) between reset and redeploy: scale to the new variable immediately after the reset; outboxes replay |
| `PRI_CSRF_SECRET` | Generate 48+ random characters; set; redeploy | Every open browser session's CSRF token no longer verifies: mutations answer `CSRF_REJECTED` until the page reloads (the cookie is reissued on the next request). Native shells are unaffected |
| `PRI_AUTH_DELIVERY_KEY` | Generate a new 32-byte key; set; redeploy | Verification/reset/consent emails queued but not yet sent cannot be decrypted and are dropped by the worker as `auth_delivery_failed`; the person requests again. Already-sent links keep working (they are hashes, not ciphertext) |
| `PRI_MFA_KEY` | **Do not rotate casually**: every staff TOTP secret is encrypted under it. Rotation = every admin/support account re-enrols (`server/tools/reset-mfa.mjs` per account, then enrol again) | Staff are locked to the enrolment routes (`MFA_ENROLMENT_REQUIRED`) until they re-enrol; students unaffected |
| `PRI_METRICS_TOKEN` | Generate 32+ characters; set on the service and in the monitor that polls `/v1/metrics` | The monitor gets 401 until updated; nothing student-facing |
| `PRI_SENTRY_DSN` | Sentry → project settings → client keys → revoke and create; set | Error delivery fails (`ERROR_SINK_FAILURES`) until updated; errors are still logged |
| `PRI_RAZORPAY_*`, Apple/Google billing material | Provider dashboard; set; redeploy | Webhooks are rejected (`webhook_total{outcome=rejected}`) until the new secret is live; providers retry; entitlements reconcile (`billing-reconciliation.md`) |

After any rotation: search the Railway logs for the exposure window for `requestId`s on the routes the credential protects; if the model key was abused, the provider's usage page is the record (the server's ledger only knows calls it made); if a session or data credential was abused, the account export (`GET /v1/account/export`) and `audit_log` are what a person can be told. Record the rotation in `drills.md` with the date, the credential and who did it (no values).

## 5. Spend running away

**You are here when:** `AI_MONTHLY_BUDGET_70PCT` fires (`ai_budget_month_ratio` ≥ 0.7); `ai_calls_total{kind}` climbing faster than active accounts explain; `GET /v1/admin/ai-usage` shows one account far ahead in `topAccounts`.

**Do:** lower `PRI_PAID_CALLS_PER_DAY` (deployment ceiling: `PAID_CAPACITY_REACHED`, students keep the on-device reading) and/or `PRI_AI_DAILY_BUDGET_CALLS` (per account per day: `AI_DAILY_BUDGET_EXHAUSTED`, the engine, the on-device reader and the authored hints carry on). Both take effect on restart. One abusive account: revoke its sessions (`DELETE /v1/account/devices/:sessionId` as the account, or `logout-all`) and, if it is a tampered device, the entitlement grant path never raises the budget — nothing the device sends is read. Raise `PRI_MONTHLY_BUDGET_INR` only as a deliberate decision, and re-check the two rate variables against the provider's current price list.

## 6. Who may do what

| Action | Needs |
|---|---|
| Read logs, metrics, `/v1/admin/*` | an operator with `PRI_METRICS_TOKEN` / an admin account with a second factor |
| Redeploy a previous SHA, change a variable | Railway project access (owner) |
| Rotate a provider or database credential | the provider's/Supabase's console (owner) |
| Restore the database to a point in time | Supabase console (owner) + the cutover procedure; **irreversible for the current data**; explicit owner decision |
| Change a threshold in this document or `alerts.md` | a reviewed PR; `observability-check.mjs` pins the numbers to the code |

Nothing in this runbook is a substitute for the external configuration record in `alerts.md` §5: an alert that has never fired in a drill is not an alert.
