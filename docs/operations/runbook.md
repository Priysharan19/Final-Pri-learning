# Incident runbook: the `/v1` server on Railway + Supabase

Status: **procedures for the online-first topology of ADR-0001**
(`docs/architecture/adr-0001-online-first-runtime.md`, including its 2026-10-10 amendment), as
of 2026-10-19. Two Railway environments run the `/v1` service from this repository: **staging**
(`pri-learning-staging`, deploys every push to `main`, backed by the Supabase staging project
`orudxrckgxyyraopyzmn`) and **production** (backed by the Supabase production project
`mgmlvkesbwmipmvnzufk`); both Supabase projects are in Mumbai (`ap-south-1`). The model
provider is OpenAI, behind the server's own key. Each procedure names the signal that says you
are in that failure, what recovers it, and what the student sees meanwhile. The thresholds and
series are `alerts.md`; staged rehearsals are `drills.md`; the database cutover is
`postgres-cutover.md`.

Nothing in this file has been rehearsed against production. Every step that touches Railway,
Supabase, OpenAI or DNS is an **owner action** with the owner's credentials; an autonomous agent
never performs it.

Four facts shape every procedure:

1. **Marking is online-only and server-authoritative.** The server runs the deterministic engine
   on a question it issued, for a verified, eligible, signed-in account. When the server or the
   database is unavailable, **nothing is checked, marked or revealed**: the student's typed and
   written work is kept on the device (IndexedDB) and is checked once the server answers again.
   The engine bundled in the client generates questions and previews notation; it never marks a
   new answer. An outage therefore stops marking — it must never lose work, and it must never
   produce a mark from anywhere but the server.
2. **A model never sets a mark.** A provider outage degrades handwriting reading, the working
   check, photo reading and the tutor; the marking authority is unaffected.
3. **No secret lives in the repository.** Railway variables are the only home for credentials
   (`tools/secret-scan.mjs` gates every push and the built bundle).
4. **Rollback is a Railway redeploy of the previous deployment, never a hot edit.** Each Railway
   deployment is one `main` commit; `GET /v1/health` names the SHA it runs.

First step for every incident: take a `requestId` from the alert's log line or the Sentry issue
(the error sink tags every event with it), search the Railway logs of the affected environment
for it, and read `route`, `code`, `status` and `release`. The same `requestId` is returned to the
client in `X-Request-Id` and in every error body.

---

## 1. Model provider down (OpenAI)

**You are here when:** `PROVIDER_FAILURE_SPIKE` fires; `provider_call_failed` lines carry
`HANDWRITING_PROVIDER_5XX`, `HANDWRITING_PROVIDER_429` or `HANDWRITING_TIMEOUT`; `/v1/ready`
reports `checks.handwriting` degraded (readiness stays 200: a provider is never a reason not to
serve).

**Student experience:** handwriting that cannot be read stays on the page with "your working is
saved and will be tried again shortly — or type your answer now"; typed answers are still marked
by the server; the tutor falls back to the authored hints. Nothing is lost.

**Do:**

1. A `*_PROVIDER_AUTH` code means the key was rejected — go to §4, not here.
2. Check the OpenAI status page and the project's usage/rate-limit page.
3. Rate limiting (`_429`): lower load, do not retry harder — reduce `PRI_PAID_CALLS_PER_HOUR`
   (Railway variable; the service restarts). Students meet `PAID_CAPACITY_REACHED`.
4. Provider down: change nothing. Requests already fail per call with a coded, retryable answer
   and the client backs off (20 s doubling to 5 minutes). Watch `provider_calls_total{outcome=ok}`.

**Do not:** raise `PRI_HANDWRITING_TIMEOUT_MS` beyond its 60 s cap; switch
`PRI_HANDWRITING_MODEL` mid-incident (a model change is a reviewed release decision).

## 2. Database down or saturated (Supabase Postgres)

**You are here when:** `DB_CONNECTIVITY` fires; `/v1/ready` → 503 `PLATFORM_DB_UNAVAILABLE`;
`platform_db_pool_error` lines; or `DB_SATURATION` (`PLATFORM_DB_BUSY` / `PLATFORM_DB_TIMEOUT`).
`/v1/health` keeps answering 200 with `database.reachable: false` by design, so the container is
not restarted in a loop.

**Student experience:** signed-in routes, **including marking**, answer a coded 503 with
`Retry-After`; work stays on the device and the outbox resends it when the server is back.
Sessions remain valid.

**Do:**

1. Supabase console → project health: CPU/IO, connection count against the pooler size.
2. Saturation: compare `PRI_DATABASE_POOL_MAX × replicas` with the pooler limit
   (`postgres-cutover.md` §1). The connection must be session mode (port 5432); the server
   refuses the transaction pooler at boot (`PLATFORM_DB_TRANSACTION_POOLER`). Statements are
   bounded by `PRI_DATABASE_STATEMENT_TIMEOUT_MS`.
3. Connectivity: confirm `PRI_DATABASE_URL` names the right project and `PRI_DATABASE_SSL_ROOT_CERT`
   is current. A database password reset invalidates the URL: update the Railway variable and
   redeploy.
4. Regional outage: wait. Never repoint production at another database or at SQLite; a second
   writable copy is the one way to lose data for good.

**Data loss boundary:** Supabase point-in-time recovery is the restore path. A restore is
irreversible for the current data and needs an explicit owner decision (`postgres-cutover.md` §6).

## 3. Bad deploy: roll back to the previous deployment

**You are here when:** `HTTP_5XX_SPIKE` fires right after a deploy; `/v1/ready` 503 after a deploy
(`PLATFORM_DB_SCHEMA_MISMATCH`); `CLIENT_ERROR_SPIKE` whose stored rows carry the new `build`;
`tools/verify-deployment.mjs` failed.

**Student experience:** a crashed screen shows the error-boundary card ("your saved work is
safe") and, when the person is signed in and has not turned crash reports off, sends a coded
report; the service worker keeps the previous bundle until the new one is fetched.

**Do (Railway, owner):**

1. Find the last good deployment: Railway → the environment → Deployments. Confirm its commit's
   CI was green.
2. **Redeploy** that previous deployment. Nothing is edited in place. The healthcheck path is
   `/v1/ready`, so the rollback receives traffic only when ready.
3. Confirm: `/v1/health` shows the previous SHA, `/v1/ready` is 200, `firing` on `/v1/metrics`
   empties within the window.
4. Then revert on `main` through a reviewed PR, with the failure pinned by a test.

**Schema caveat.** The server requires the database's `schema_version` to match its own exactly
(currently 12; billing schema 6) and refuses to boot otherwise (`PLATFORM_DB_SCHEMA_MISMATCH`).
A rollback to a deployment built before a schema bump therefore **will not boot** against the
migrated database. Migrations are forward-only (`supabase/migrations`); the only reviewed
down-path is `docs/release/rollback/20261016000000_rls_fail_closed.rollback.sql` (schema 12 → 11),
run by hand as the table owner together with redeploying a schema-11 build — and it re-opens the
defect the forward migration closed. Prefer rolling forward with a fix. Never edit
`platform_meta` by hand, and apply any database change to staging first.

**Do not:** push to `main`; change variables as a substitute for a code fix (except the spend
ceilings); redeploy a commit whose CI was not green.

## 4. Key compromise: rotation

**You are here when:** a credential appeared outside Railway variables (a chat, ticket, log or
commit); `*_PROVIDER_AUTH` on a key you did not change; unexplained provider spend.

Issue the new credential, deploy it, then revoke the old one — **except the model-provider key,
which is revoked first**.

| Credential | Rotate | Meanwhile |
|---|---|---|
| `PRI_HANDWRITING_API_KEY` (OpenAI) | revoke in OpenAI first; create a project key; set in Railway | reading/working/photo/tutor answer `*_PROVIDER_AUTH`; marking unaffected |
| `PRI_DATABASE_URL` password | reset in Supabase; update the variable; redeploy | readiness fails until redeployed; outboxes replay |
| `PRI_CSRF_SECRET` | 48+ random characters; redeploy | open browser sessions get `CSRF_REJECTED` until reload |
| `PRI_AUTH_DELIVERY_KEY` | new 32-byte key; redeploy | queued unsent auth emails are dropped; people request again |
| `PRI_MFA_KEY` | avoid: every staff second factor must be re-enrolled | staff locked to enrolment until they re-enrol |
| `PRI_METRICS_TOKEN` | 32+ characters; update the monitor too | monitor gets 401 until updated |
| `PRI_SENTRY_DSN` | Sentry → client keys → revoke and create; set | `ERROR_SINK_FAILURES` until updated; errors are still logged |
| Razorpay / Apple / Google billing material | provider console; set; redeploy | webhooks rejected until live; providers retry |

Record each rotation in `drills.md` (date, credential name, who — never the value).

## 5. Crash reports and the error sink

`CLIENT_ERROR_SPIKE`: read `platform`, `surface`, `code` and `fingerprint` from the `client_error`
lines; a spike that starts with a deploy is §3. `ERROR_SINK_FAILURES`: errors are still in the
Railway logs; check the Sentry project's quota and the DSN (§4). `error_sink_total{outcome=noop}`
rising means `PRI_SENTRY_DSN` is unset on that environment.

## 6. Who may do what

| Action | Needs |
|---|---|
| Read logs, metrics, `/v1/admin/*` | an operator with `PRI_METRICS_TOKEN`; an admin account with a second factor |
| Redeploy a previous deployment, change a variable | Railway project access (owner) |
| Rotate a provider or database credential | the provider's / Supabase's console (owner) |
| Apply a migration or the reviewed rollback SQL | staging first; production only with explicit owner authority |
| Restore the database to a point in time | Supabase console (owner); irreversible for current data |
| Change a threshold here or in `alerts.md` | a reviewed PR; `observability-check.mjs` pins the numbers to the code |

An alert that has never fired in a drill is not an alert: see `alerts.md` §5.
