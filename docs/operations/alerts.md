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
| Operational events: `platform_error`, `server_error`, `provider_call_failed`, `auth_email_failed`, `auth_delivery_worker_error`, `platform_db_pool_error`, `housekeeping_error` | stderr (`warn`/`error`) | Railway log explorer |
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
| `HANDWRITING_LATENCY_P95` | the handwriting provider's read latency is p95 ≥ 4 s over ≥ 5 reads in the last 5 minutes | warn | `provider_latency_ms{provider=handwriting}` (`latency[].last5m.p95Ms` on `/v1/metrics`); `provider_call_failed` lines with `code: HANDWRITING_TIMEOUT` | A monitor polling `/v1/metrics` for `HANDWRITING_LATENCY_P95` in `firing`; OpenAI status page. See §2a for the budget and what the student sees meanwhile |
| `WEBHOOK_FAILURES` | ≥ 1 billing webhook failed to apply (5xx) in 15 minutes. Rejections (4xx: bad signature, malformed, a provider this deployment does not use) are counted as `webhook_total{outcome=rejected}` but never page — anyone can send one | page | `webhook_total{provider,outcome}`, `webhook_failures_total{provider,code}`; `platform_error` lines on `/v1/billing/webhook/:provider` | Railway log alert on `"route":"/v1/billing/webhook/:provider"` with status ≥ 500; Razorpay dashboard webhook failure notifications; App Store Server Notifications retry visibility |

### 2a. Handwriting latency budget

Target: **ink submitted → mark shown in under 4 s at p95** (release ledger task 4.7), measured
end to end on the Mumbai deployment. The server can see one part of that path, the provider
read, and records it per call as `provider_latency_ms{provider=handwriting}` (`recordProviderCall`
in `server/platform/handwriting.js`; the reading's own `latencyMs` is also returned to the
client and surfaced in `/v1/handwriting/status` as `lastLatencyMs`). `/v1/metrics` reports the
series since boot (`count`, `meanMs`, `maxMs`, `p50Ms`, `p95Ms`) and over the last 5 minutes
(`last5m.count`, `last5m.p95Ms`); `HANDWRITING_LATENCY_P95` fires from the windowed value.
The raster, upload and the deterministic marking on the device are the rest of the budget and
are not visible here; the e2e flow `client/test/tour-ink.js` is the only end-to-end timing in
the repository, and it runs against a stand-in reader, so it is **not** evidence for the
target. The production number is `BLOCKED_EXTERNAL` until the health agent measures it
against the Mumbai deployment with real reads.

What the budget's enforcement points are, and what the student sees at each:

| Time since the page settled | Server | Student |
|---|---|---|
| 0 s | the read is sent; nothing but the picture of the ink | "Reading your handwriting…" (`ink.serverReading`) |
| 5 s | — | the note changes to "Still reading your handwriting — this can take a little longer. Keep going; nothing is lost." (`ink.serverStillReading`, `STILL_READING_MS` in `client/src/ink/InkAnswer.jsx`); the ink stays on the page |
| 27 s (60% of the 45 s budget, `PRIMARY_TIMEOUT_SHARE`) | the primary model is abandoned and the fallback model is tried once inside what is left | unchanged |
| 45 s (`PRI_HANDWRITING_TIMEOUT_MS`, default 45 s, capped at 60 s) | `HANDWRITING_TIMEOUT` (504, retryable), counted as a failed provider call with that code | "Pri's handwriting reader isn't answering right now. Your working is saved and will be tried again shortly — or type your answer now." (`ink.waitingServiceDown`); the page is retried by itself with the back-off in `cloudReader.js` (20 s doubling to 5 minutes) |

`server/test/handwriting-latency-budget-check.mjs` pins each of these: the timeout is a coded
refusal inside the budget, the failed call carries its latency, the windowed p95 is reported
and the rule fires at its threshold, and the client's slow-read and timed-out states resolve
to the strings above in English and Hindi.

Every alert's first diagnostic step is the same: take a `requestId` from the alert's log
lines, search Railway logs for it, and read the `route`, `code` and `release` it carries.

## 3. Railway configuration (owner action)

1. Set `PRI_METRICS_TOKEN` on the production and staging services: at least 32 random
   characters (`openssl rand -base64 48 | tr -d '/+=\n'`). It goes into Railway variables and
   the monitor that reads `/v1/metrics` — nowhere else (not the repository, chat or a ticket).
2. Set the service **healthcheck path** to `/v1/ready` so a deploy whose database or schema is
   wrong never receives traffic. (The container `HEALTHCHECK` stays on `/v1/health`: liveness
   must not restart a process because the database is down.)
3. Create the log alerts in §2 (Railway → Observability → Alerts, or a log drain to the
   monitoring tool the owner chooses) and route them to the owner's on-call channel.

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
| `HANDWRITING_LATENCY_P95` | — | — | — | — |
| `WEBHOOK_FAILURES` | — | — | — | — |

An alert counts as configured only when this row is filled **and** the alert has been seen to
fire during a staging drill.
