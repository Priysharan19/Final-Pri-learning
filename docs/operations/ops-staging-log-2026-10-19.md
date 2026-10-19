# Staging operations log — 2026-10-19

Environment: **staging only** (Railway project `profound-spontaneity`, environment `staging`,
service `pri-learning-staging`, region `ams`; Supabase `pri-learning-staging`
`orudxrckgxyyraopyzmn`, `ap-south-1`, Postgres, schema 12 / billing 6). Production was not
touched. No migration was applied anywhere. Operator: Claude Code session on the owner's
authority (owner: impriysharan@icloud.com). All times UTC.

Evidence class: the real deployed staging host and database. Not production, not a device,
not a student.

## 1. Backup restore rehearsal

Supabase reports `pitr_enabled: false` and **no managed backups** for the staging project
(`supabase backups list`), so a platform restore could not be rehearsed. The rehearsal used a
logical backup taken by the server's own role, restored into a throwaway local Postgres 17
(`scripts/with-postgres.mjs`). Staging was never written to.

| Step | Result |
|---|---|
| `pg_dump -n pri` as `pri_app_staging` with `PGOPTIONS=-c pri.scope=system` | **Finding: 0 data rows.** The Supabase session pooler drops `PGOPTIONS`, so the dump ran with no `pri.scope`, and the fail-closed RLS (schema 12) hid every row. The dump exited 0. **An app-role `pg_dump` is not a backup.** |
| Schema from that dump + data via `psql` in a session that runs `select set_config('pri.scope','system',false)` then `\copy pri.<table> to csv` for all 42 `pri` tables | 23 s from Railway's Supabase pooler; 14 tables non-empty |
| `pg_restore --schema-only --no-owner --no-acl` + `\copy from` (with `session_replication_role=replica`) | under 1 s; 103 `role "…" does not exist` errors (Supabase roles absent locally, grants only), **0 other errors** |
| Verify: `count(*)` per table, restored vs live staging (system scope) | **All 42 tables match** (accounts 11, account_sessions 33, account_identities 10, learning_events 19, sync_entities 5, idempotency_keys 76, …); `platform_meta` schema_version=12, billing_schema_version=6 |

The exported CSVs and the dump were deleted after verification (they held account rows).

Follow-ups:
- Production must have Supabase PITR / daily backups enabled before cutover
  (`postgres-cutover.md` §6). That is an owner action and is still open.
- Any logical backup must use a role that bypasses RLS (the project's `postgres` role via
  `supabase db dump`) or set `pri.scope=system` inside the session. A dump through
  `PGOPTIONS` on the pooler silently returns nothing.

## 2. Rollback rehearsal

Railway's `deploymentRollback` / `deploymentRedeploy` GraphQL mutations answered
`Not Authorized` to the CLI's user token. The rehearsal used the path the runbook names:
deploy the previous main SHA. Build and release identity came from `PRI_RELEASE_SHA`, set
on staging with `--skip-deploys`. A probe ran `/v1/ready` and `/v1/health` every 5 s.

| Step | From → to | Live after | Failed probes |
|---|---|---|---|
| Roll back (`railway up` of a worktree at `2fd740016`, the previous staging release) | d76725115 → 2fd740016 | 57 s after upload | 0 |
| Roll forward (`railway up` at `d76725115`) | 2fd740016 → d76725115 | 74 s including upload | 0 |

Both releases expect schema 12, so no schema step was needed. A rollback across a schema
version must follow the schema caveats in `runbook.md`: the server refuses a schema newer
than it expects.

## 3. Per-route latency (issue #524 item 3)

The source is the server's own `http_request` log lines (`ms` is handler time inside the
server, excluding the client's network). They come from the staging deployments retained by
Railway on 2026-10-18/19 (release d76725115 and earlier), 751 requests in all. App:
Railway `ams`. Database: Supabase Mumbai. The `/v1/ready` database probe measured **136 ms
p50 / 137 ms p95** per round trip (30 samples).

| Route | n | p50 ms | p95 ms | max ms |
|---|---|---|---|---|
| GET /v1/sync/pull/:cursor | 104 | 2194 | 3069 | 3941 |
| GET /v1/account/me | 106 | 333 | 850 | 1845 |
| GET /v1/ready | 100 | 137 | 1502 | 1507 |
| GET /v1/health | 69 | 274 | 1246 | 1502 |
| GET /v1/handwriting/status | 2 | 1065 | 2751 | 2751 |
| GET /v1/assignments | 2 | 697 | 865 | 865 |
| POST /v1/account/otp/request | 1 | 2260 | — | — |
| POST /v1/handwriting/transcribe | 1 | 9051 | — | — (provider read) |
| static / SPA shell | 325 | 2 | 16–38 | 48 |

Measured from the operator's machine (Australia → Amsterdam, including the client's own
network): `/v1/health` p95 1.00 s, `/v1/ready` 1.04 s, `/release.json` 0.75 s, `/` 0.91 s
(40 samples each).

Conclusion: the latency is material. `sync/pull` is about 16 round trips at 137 ms. The
`/v1/ready` p95 sits on its 1.5 s database bound. #524 item 3 (system scope set once per
pooled connection) is therefore implemented with the #441 hot-path port, not deferred.
Most authenticated samples come from acceptance runs, not real students. Treat these
numbers as a baseline, not as production expectations.

## 4. Failure drills (`drills.md` §2), 08:22–08:45 UTC

Release under test: `967e23174` (main after #579), deployed by `railway up` from a detached
worktree at that SHA. Detection came from an operator probe that read `/v1/ready`,
`/v1/health` and `/v1/metrics` (bearer `PRI_METRICS_TOKEN`) every 5–8 s. **No external
uptime monitor or alert route is configured yet** (`alerts.md` §5 is empty), so no alert
reached a human in any drill. "Fired" below means `/v1/metrics` listed the alert.

| # | Break | Detected | Time to detect | Recovery | Result |
|---|---|---|---|---|---|
| 1 Server down | `railway down` 08:22:50 | probe: `/v1/ready` and `/v1/health` 404 (Railway edge) | 6 s | `railway up` at 08:24:29; ready 200 at 08:26:47 | **PASS with gap.** 3 min 51 s unavailable, 2 min 18 s of it the rebuild. No `SERVER_DOWN` monitor exists to page anyone |
| 2 Database unreachable | 08:27:48: `alter role pri_app_staging nologin` plus `pg_terminate_backend` on its 2 sessions | `/v1/ready` 503 `PLATFORM_DB_UNAVAILABLE`, `/v1/health` 200 with `database.reachable: false`; log `platform_db_pool_error code=57P01`, no host or URL | 14 s | `alter role … login` at 08:30:10; ready 200 at 08:30:32 **with no redeploy** | **FAIL (finding A).** App requests during the outage returned **500 `INTERNAL`** (log `platform_error code="XX000"`), not 503 `PLATFORM_DB_UNAVAILABLE`, and **`DB_CONNECTIVITY` never fired**; `HTTP_5XX_SPIKE` fired instead |
| 3 Email provider | 08:31:17: `PRI_RESEND_API_KEY=re_invalid_drill` (redeploy) | `/v1/ready` `authEmail` failing at boot; 4 code requests → 503 `OTP_DELIVERY_FAILED`; `auth_email_failed code=AUTH_EMAIL_KEY_INVALID`, no address logged; **`AUTH_EMAIL_FAILURES` fired** | at boot (< 2 min) | real key restored 08:37:07; a code request to `delivered+d3ok@resend.dev` at 08:38:28 → Resend `delivered` | **PASS.** The code was not redeemed, so no account was created; "link verifies" is covered by the CI drill only |
| 4 Handwriting provider | 08:38:55: invalid `PRI_HANDWRITING_API_KEY` (redeploy) | `/v1/ready` `handwriting: unavailable / HANDWRITING_PROVIDER_AUTH` (state `degraded`, still 200) | at boot, 08:40:29 | real key restored 08:40:44; `hw=ok` at 08:43:00 | **PARTIAL.** Readiness passed. A transcription 503 and `PROVIDER_FAILURE_SPIKE` need a signed-in student session, which this operator does not hold, so they were not exercised |
| 5 Webhook | not run | — | — | — | **BLOCKED_EXTERNAL.** Staging has no billing provider configured (`billing: not_configured`), so there is no webhook secret to break. Unsigned POSTs to `/v1/billing/webhook/web` get **503 `BILLING_PROVIDER_NOT_CONFIGURED`** (finding B). Needs Razorpay test-mode keys on staging |
| 6 Restart mid-sync | not run | — | — | — | **BLOCKED_EXTERNAL.** Needs a test iPad or simulator signed in to staging with an offline outbox. Drill 1 shows restart and recovery only |

Findings:

- **A (R3/R4 reliability, release-relevant).** `classifyStoreError` (`server/platform/store.js`)
  maps `08*`, `57P01-3` and `53300` to `PLATFORM_DB_UNAVAILABLE`. Supavisor answers a login
  it cannot make with `XX000`, and Postgres auth failures (`28000`, `28P01`) are not listed
  either, so a real credential or pooler outage looks like a server bug (500): no
  `Retry-After`, no `DB_CONNECTIVITY`. `/v1/ready` reports correctly because readiness maps
  any probe failure. Fix: treat pooler and auth SQLSTATEs from connection acquisition as
  unavailable, with a regression test in `failure-drills-check.mjs`. Not fixed here.
- **B (low).** An unauthenticated POST to an unconfigured billing webhook returns 503, so
  anyone can trigger `HTTP_5XX_SPIKE`. It should be a 4xx or excluded from the 5xx rule.
- **C.** Drills 1–4 restored every variable to its pre-drill value. `PRI_RELEASE_SHA` on
  staging is set to `967e23174` so release identity matches the `railway up` upload. It is
  removed when staging next deploys from GitHub.

## 5. Staging Supabase has no backups or PITR. Owner steps

Status on 2026-10-19: `pitr_enabled: false`, and `supabase backups list` returns none for
`orudxrckgxyyraopyzmn` (staging) on the current plan. Staging holds acceptance data only, but
the same plan question applies to the production project `mgmlvkesbwmipmvnzufk`
(`pri-learning-production-india`) before any Postgres cutover. Only the owner can change
billing.

1. Supabase dashboard → Organization → Billing: move the organization to the **Pro** plan
   (daily backups, 7-day retention). This is a payment action.
2. Project `pri-learning-production-india` → Database → Backups → **Point in Time Recovery**:
   enable the add-on (needs Pro and at least a Small compute add-on). Repeat for staging only
   if a staging restore drill is wanted.
3. Confirm from a terminal:
   `supabase backups list --project-ref mgmlvkesbwmipmvnzufk` shows a daily backup, and
   the project settings show `pitr_enabled: true`.
4. Until then, take logical backups with the **project's `postgres` role**, never the app
   role (§1: an app-role dump through the pooler silently contains no rows):
   `supabase link --project-ref <ref>` then
   `supabase db dump --linked --schema pri -f pri-schema.sql` and
   `supabase db dump --linked --schema pri --data-only -f pri-data.sql`. Store them encrypted
   outside the repository.
5. Rehearse one restore (`postgres-cutover.md` §6.3) and record it here before the
   production cutover.
