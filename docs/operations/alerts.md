# Alert policy: the `/v1` server on Railway + Supabase

Status: **the server side is built and tested; the alert routing is `BLOCKED_EXTERNAL`.**
Nothing in this document has been configured on Railway, Supabase or an uptime service. Each
alert below names the signal the server already emits, the threshold and the external check
the owner has to create. Until the owner has created each one and recorded it in the table in
§5, V1 hard blocker #16 (observability/alert routing, `docs/release/PRI_V1_RELEASE_SCOPE.md`)
stays open. Do not mark it done because this file exists.

---

## 1. What the server emits

| Signal | Where | Who can read it |
|---|---|---|
| One JSON line per request: `requestId`, `method`, `route` (template, never the raw path), `status`, `ms`, `code` (the coded error, when there was one), `release` (SHA), `db` (`sqlite`/`postgres`) | stdout (`level: info`), stderr for 5xx (`level: error`) | Railway log explorer |
| Operational events: `platform_error`, `server_error`, `provider_call_failed`, `auth_email_failed`, `auth_delivery_worker_error`, `platform_db_pool_error`, `housekeeping_error`, `client_error` (a crash report a client sent: `platform`, `surface`, `code`, `fingerprint`), `error_sink_failed`, `ai_usage_record_failed` | stderr (`warn`/`error`) | Railway log explorer |
| **Error tracking** (`server/platform/errorSink.js`): every 5xx the server composes (`platform_error` / `server_error` with status ≥ 500) and every accepted crash report is captured once as an event of the same allowlisted fields — `requestId`, `release` (server SHA), `route` (template), `method`, `status`, `code`, `source` (`platform` / `app` / `client`), `platform`, `surface`, `fingerprint` — and delivered to the sink named by `PRI_SENTRY_DSN` (a Sentry-compatible envelope endpoint). With the DSN unset the sink is a counted no-op. There is no field for a message, stack, body, cookie, email or account id, so none can reach the sink | `PRI_SENTRY_DSN` (Railway variable only) | the owner's Sentry project |
| Crash reports from the web app and the native shells: `POST /v1/telemetry/error` — session, guardian consent and the device's crash-report preference required; 20 per 10 minutes per account; a closed code, platform, surface slug, scope and fingerprint, never free text | stored as `client-error` operational events (90-day retention); `client_errors_total{platform,code}` | an admin (`/v1/admin/users` export), the sink |
| Cost telemetry (`server/platform/aiUsage.js`): one row per account, UTC day and kind (`handwriting`, `working`, `question-photo`, `tutor`) with calls and the provider's input/output tokens | `ai_calls_total{kind}`, `ai_tokens_total{kind,direction}`, gauges `ai_month_estimated_inr`, `ai_budget_month_inr`, `ai_budget_month_ratio`; `GET /v1/admin/ai-usage` (admin + second factor) | an operator, an admin |
| `GET /v1/health` — **liveness**. 200 while the process answers; reports `database.reachable` (its database reads are bounded to 1.5 s so a silent partition cannot outlast the 5 s container healthcheck) but never fails because the database did | public | uptime checker, Docker `HEALTHCHECK` |
| `GET /v1/ready` — **readiness**. 200 `ready`/`degraded`, 503 `not_ready` + `Retry-After: 5`; every dependency as one state and one code | public by design (an uptime checker and the Railway deploy healthcheck need it without a credential), so it carries no counts, no failure rates, no which-provider/which-product detail and no configuration values — that detail is only on `/v1/metrics` | uptime checker, Railway deploy healthcheck |
| `GET /v1/metrics` — counters since boot and over the last 5/15 minutes, latency summaries, and every rule below evaluated as `alerts[].firing` plus a `firing` list | `Authorization: Bearer $PRI_METRICS_TOKEN` only; **closed (503 `METRICS_NOT_CONFIGURED`) in production while `PRI_METRICS_TOKEN` is unset or shorter than 32 characters** | an operator, a monitor holding the token |

Every log line is built from an allowlist of fields with fixed shapes
(`server/platform/observability.js`). Bodies, cookies, bearer tokens, emails, handwriting
images, signed URLs and provider keys have no field to travel in;
`server/test/observability-check.mjs` feeds all of them through every path and fails if any
appears. Metrics labels come from fixed alphabets (status class, provider name, coded error),
never ids or paths.

Metrics are **per replica and in memory**: they reset on restart and on deploy. With more than
one replica, query each or alert on logs instead.

## 2. The alerts

The thresholds in the table are the code (`ALERT_RULES[].thresholds` in
`server/platform/metrics.js`); `observability-check.mjs` fails unless each rule's row here
states every one of its numbers (`≥ N`, `≥ P%`, `N minutes`).

| Id | Fires when | Severity | Server signal | External check the owner must configure |
|---|---|---|---|---|
| `SERVER_DOWN` | `/v1/health` fails 2 consecutive checks (1-minute interval) from outside Railway | page | — (a dead process cannot report itself) | An uptime monitor (e.g. Better Stack, UptimeRobot, Checkly) on `https://<production origin>/v1/health`, 1-minute interval, alert after 2 failures. A second monitor on `/v1/ready` alerting on sustained 503 (≥ 3 minutes) |
| `HTTP_5XX_SPIKE` | ≥ 10 responses with status 5xx **and** ≥ 5% of all responses in the last 5 minutes | page | `http_responses_total{class=5xx}`; `level: error` request lines | Railway log alert (or log drain → monitor) on `"event":"http_request"` with `"level":"error"` ≥ 10 in 5 min; or a monitor polling `/v1/metrics` for `HTTP_5XX_SPIKE` in `firing` |
| `DB_CONNECTIVITY` | ≥ 3 requests answered `PLATFORM_DB_UNAVAILABLE` in 5 minutes | page | `db_errors_total{code=PLATFORM_DB_UNAVAILABLE}`; `/v1/ready` → 503 `PLATFORM_DB_UNAVAILABLE`; `platform_db_pool_error` | The `/v1/ready` monitor above; Supabase project alerts (database CPU, connection count, disk) for project `orudxrckgxyyraopyzmn` (staging) and the production project; Railway log alert on `"code":"PLATFORM_DB_UNAVAILABLE"` |
| `DB_SATURATION` | ≥ 20 requests answered `PLATFORM_DB_BUSY` or `PLATFORM_DB_TIMEOUT` in 5 minutes | warn | `db_errors_total{code=PLATFORM_DB_BUSY|PLATFORM_DB_TIMEOUT}` | Railway log alert on those codes; Supabase connection-pool usage alert. Response: check `PRI_DATABASE_POOL_MAX × replicas` against the pooler size (`postgres-cutover.md` §1) |
| `AUTH_EMAIL_FAILURES` | ≥ 3 verification/reset/guardian-consent emails failed to send in 15 minutes | page | `auth_email_total{outcome=failed}`, `auth_email_failures_total{code=RESEND_<status>}`; `auth_email_failed` lines; `/v1/ready` `checks.authEmail.state = failing` | Railway log alert on `"event":"auth_email_failed"`; Resend dashboard webhook/alert for bounces and API errors on the sending domain |
| `PROVIDER_FAILURE_SPIKE` | handwriting or working provider: ≥ 5 failed calls **and** ≥ 25% of that provider's calls in 5 minutes | warn | `provider_calls_total{provider,outcome}`, `provider_failures_total{provider,code}`, `provider_latency_ms`; `provider_call_failed` lines; `/v1/ready` `checks.handwriting` | Railway log alert on `"event":"provider_call_failed"`; OpenAI usage/billing alert on the project key. The on-device reader keeps working, so this never takes the service down |
| `CLIENT_ERROR_SPIKE` | ≥ 20 crash reports accepted on `POST /v1/telemetry/error` in 15 minutes, across every platform | warn | `client_errors_total{platform,code}` (last 15 minutes); `client_error` lines; the sink's `source=client` events grouped by `code` + `surface` + `fingerprint` | Railway log alert on `"event":"client_error"` ≥ 20 in 15 min; or a monitor polling `/v1/metrics` for `CLIENT_ERROR_SPIKE` in `firing`; the Sentry project's own issue alert on new `source:client` groups. Response: read `platform`, `surface` and `code` from the lines; the stored row carries the client `build` |
| `ERROR_SINK_FAILURES` | ≥ 5 deliveries to the error sink refused or unreachable in 15 minutes | warn | `error_sink_total{outcome=failed}`; `error_sink_failed` lines (`ERROR_SINK_REFUSED` with the HTTP status, `ERROR_SINK_TIMEOUT`, `ERROR_SINK_UNREACHABLE`) | Railway log alert on `"event":"error_sink_failed"`; Sentry's quota/rate-limit notifications. Errors are still logged while the sink is down; `error_sink_total{outcome=noop}` rising instead means `PRI_SENTRY_DSN` is unset on this replica |
| `AI_MONTHLY_BUDGET_70PCT` | this calendar month's estimated model-provider spend (recorded tokens × `PRI_AI_INR_PER_MILLION_INPUT_TOKENS` / `PRI_AI_INR_PER_MILLION_OUTPUT_TOKENS`) has reached ≥ 70% of `PRI_MONTHLY_BUDGET_INR`; the gauge is re-read from the database at least every 5 minutes and after every recorded call, and ≥ 1 reading at or over the ratio fires | page (the owner) | gauges `ai_budget_month_ratio`, `ai_month_estimated_inr`, `ai_budget_month_inr`; `ai_calls_total{kind}`, `ai_tokens_total{kind,direction}`; `GET /v1/admin/ai-usage` → `month.ratio`, `month.alerting` | A monitor polling `/v1/metrics` for `AI_MONTHLY_BUDGET_70PCT` in `firing` (or `gauges.ai_budget_month_ratio ≥ 0.7`), routed to the owner; the OpenAI usage-limit email on the project key as the independent second signal. Response: `runbook.md` §5 (lower `PRI_PAID_CALLS_PER_DAY` / `PRI_AI_DAILY_BUDGET_CALLS`, or raise the budget deliberately). Unset `PRI_MONTHLY_BUDGET_INR` or rates → the gauge is absent and the rule never fires, which `/v1/ready` does not hide: production refuses to boot with a budget and no rates |
| `WEBHOOK_FAILURES` | ≥ 1 billing webhook failed to apply (5xx) in 15 minutes. Rejections (4xx: bad signature, malformed, a provider this deployment does not use) are counted as `webhook_total{outcome=rejected}` but never page — anyone can send one | page | `webhook_total{provider,outcome}`, `webhook_failures_total{provider,code}`; `platform_error` lines on `/v1/billing/webhook/:provider` | Railway log alert on `"route":"/v1/billing/webhook/:provider"` with status ≥ 500; Razorpay dashboard webhook failure notifications; App Store Server Notifications retry visibility |

Every alert's first diagnostic step is the same: take a `requestId` from the alert's log
lines, search Railway logs for it, and read the `route`, `code` and `release` it carries. The
same `requestId` is a tag on the sink event, so a Sentry issue and a Railway log line meet on
it. What to do next, per failure, is `docs/operations/runbook.md`.

## 3. Railway configuration (owner action)

1. Set `PRI_METRICS_TOKEN` on the production and staging services: at least 32 random
   characters (`openssl rand -base64 48 | tr -d '/+=\n'`). It goes into Railway variables and
   the monitor that reads `/v1/metrics` — nowhere else (not the repository, chat or a ticket).
2. Set the service **healthcheck path** to `/v1/ready` so a deploy whose database or schema is
   wrong never receives traffic. (The container `HEALTHCHECK` stays on `/v1/health`: liveness
   must not restart a process because the database is down.)
3. Create the log alerts in §2 (Railway → Observability → Alerts, or a log drain to the
   monitoring tool the owner chooses) and route them to the owner's on-call channel.
4. Create the Sentry project (or any sink that accepts the envelope endpoint) and set
   `PRI_SENTRY_DSN` on the production and staging services. It is a Railway variable only; a
   DSN in the repository, a chat or a ticket is a leak (`tools/secret-scan.mjs` does not know
   its shape — treat it with the same care as a provider key). Unset, the sink is a no-op and
   `error_sink_total{outcome=noop}` says so.
5. Set `PRI_MONTHLY_BUDGET_INR` and the two INR-per-million-token rates from the provider's
   price list (and the current exchange rate); re-check the rates when the price list or the
   model changes. `PRI_AI_DAILY_BUDGET_CALLS` bounds one account's day across every paid kind
   (default 400).

## 4. Supabase configuration (owner action)

1. Enable the project's email/Slack alerts for database health, connection saturation and
   disk usage on staging and production.
2. Confirm point-in-time recovery/backups are on for production before cutover
   (`postgres-cutover.md` §6).

## 5. Configuration record — `BLOCKED_EXTERNAL` until filled

| Alert | Tool and check name | Route (who is paged) | Configured by / date | Fired once in a drill (`drills.md`) |
|---|---|---|---|---|
| `SERVER_DOWN` | — | — | — | — |
| `HTTP_5XX_SPIKE` | — | — | — | — |
| `DB_CONNECTIVITY` | — | — | — | — |
| `DB_SATURATION` | — | — | — | — |
| `AUTH_EMAIL_FAILURES` | — | — | — | — |
| `PROVIDER_FAILURE_SPIKE` | — | — | — | — |
| `WEBHOOK_FAILURES` | — | — | — | — |
| `CLIENT_ERROR_SPIKE` | — | — | — | — |
| `ERROR_SINK_FAILURES` | — | — | — | — |
| `AI_MONTHLY_BUDGET_70PCT` | — | — | — | — |

An alert counts as configured only when this row is filled **and** the alert has been seen to
fire during a staging drill.
