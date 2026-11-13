# AI budgets and the allowance day, per region (plan H7)

Pri Learning runs one deployment per regional edition (ADR-0002 §9): Priyabhata
(India) and Prithagoras (Australia) each have their own server, database, model
key and bill. This page is for the operator of either deployment. It says what
bounds the money a deployment can spend on model calls, what a student sees when
a bound is reached, how a student's "day" is counted, and which routes send
student content to a model provider.

Proven by `server/test/edition-ai-budgets-check.mjs` (SQLite and Postgres),
`client/test/edition-limit-clock-check.mjs` and
`client/test/residency-claims-check.mjs`.

## 1. The variables, per deployment

Set these on **each** deployment separately. Nothing is shared between regions,
and nothing has a regional default.

| Variable | What it bounds | Default |
| --- | --- | --- |
| `PRI_EDITION` | Which edition this deployment serves (`priyabhata`, `prithagoras`). It decides the region every number below is labelled with. | `priyabhata` |
| `PRI_HANDWRITING_API_KEY` | The model provider key. Setting it is what makes the two ceilings below **required**. | none |
| `PRI_PAID_CALLS_PER_HOUR` | Model calls this deployment may make in an hour, across every student and every paid route. | **none: required with a key** |
| `PRI_PAID_CALLS_PER_DAY` | The same, per rolling 24 hours. | **none: required with a key** |
| `PRI_AI_DAILY_FREE_*`, `PRI_AI_DAILY_PREMIUM_*` (and `PRI_AI_DAILY_FREE`, `PRI_AI_DAILY_PREMIUM`) | Per-account daily reads of handwriting, working and question photos (`server/platform/aiAllowance.js`). | Free 5, Premium 25, per kind |
| `PRI_TUTOR_CALLS_PER_ACCOUNT_DAY` | Per-account daily tutor calls (`server/platform/tutor.js`). | see `docs/product/tutor.md` |
| `PRI_FREE_PRACTICE_PER_DAY` | Free practice questions per account per **edition day** (§4). Not a model cost; listed because it uses the same day. | 20 |

A deployment with a model key and no ceiling **refuses to start**
(`assertPlatformConfig`, `spendCeilingMissing`), in either edition. That rule
has no exception for a new region: a ceiling is a budget, a budget is the
owner's decision, and a guessed default is either too low (the feature dies
quietly under load) or too high (it is not a ceiling). The Prithagoras numbers
have not been chosen; until the owner chooses them, an Australian deployment
cannot hold a key.

There is one ceiling per deployment, not one per kind of call: one key, one
bill. Fairness between students is per account (the allowances above).

## 2. Choosing a ceiling

1. Start from the monthly model budget for the region, in that region's
   currency, and the provider's price per call for the models configured
   (`PRI_HANDWRITING_MODEL`, `PRI_WORKING_MODEL`, `PRI_TUTOR_MODEL`; a read
   that escalates to `PRI_HANDWRITING_FALLBACK_MODEL` is a second unit).
2. Per day: budget ÷ 30 ÷ the dearest call's price, rounded down. That is
   `PRI_PAID_CALLS_PER_DAY`.
3. Per hour: the day figure ÷ the number of hours students are really active
   (an evening peak is shorter than 24 hours), so one bad hour cannot spend the
   day. That is `PRI_PAID_CALLS_PER_HOUR`.
4. Check it against `paid_calls_total{edition=…,outcome=spent}` on
   `GET /v1/metrics` after the first week, and against the provider's own usage
   page. Revisit after real cost data (D20's allowances are modelled figures).

## 3. What happens at 80% and at 100%

**At 80%** of either window, every paid call that crosses the line is counted
(`paid_ceiling_high_total{window}`), and the `PAID_CEILING_HIGH` alert fires
(`docs/operations/alerts.md`). Its email subject names the edition and region,
for example `[Pri production] FIRING PAID_CEILING_HIGH (warning) · Prithagoras, region AU`,
and every alert email's body carries an `Edition:` line. Students notice
nothing yet.

**At 100%** the route refuses **before** anything is sent to the provider and
before anything is marked (503 `PAID_CAPACITY_REACHED`, `RateLimit-Reset`,
`resetAt`). Reading and marking are online-only, so the student is told plainly
that the page was **not read or marked**, when the limit lifts, and that typing
the answer stays open; the page stops re-sending until then. The lift time is
written in the student's own clock: an NSW profile reads it in en-AU on its own
timezone (`client/src/lib/locale.js` `limitClock`); an India profile reads it
exactly as before. There is **no fallback** to another region's key, model or
deployment.

A read the provider was provably never sent (`HANDWRITING_NOT_CONFIGURED`,
`HANDWRITING_PROVIDER_CONFIG_INVALID`) gives its unit back
(`paid_calls_total{outcome=refunded}`). A timeout or provider error does not:
the provider may have done billable work.

**What the operator sees.** `GET /v1/metrics` (holder of `PRI_METRICS_TOKEN`)
reports `deployment: { edition, brand, region }` and
`paid_calls_total{edition, outcome=spent|refused|refunded}`. The operator health
view (`/v1/health` with the metrics token, `/v1/admin/health`) reports
`paidCeiling: { edition, region, required, perHour, perDay, alertRatio }`, never
the key.

## 4. The allowance day

A student's free-practice day is the **edition's calendar day**
(`server/platform/practiceAllowance.js` `practiceDay(now, edition)`):

| Edition | Day | Notes |
| --- | --- | --- |
| Priyabhata | `Asia/Kolkata`, 00:00 IST | Computed exactly as before editions existed (fixed +05:30 offset); shown equal to `main`'s function at every sampled instant of a year. |
| Prithagoras | `Australia/Sydney`, local midnight | Daylight saving included: the first Sunday of October is a 23-hour day, the first Sunday of April a 25-hour day. |

The timezone is taken from the edition table (`client/edition.config.mjs`
`timezone`), copied into `client/src/engine/practiceAllowance.js`
(`practiceDayTimeZone`) because the engine folder may not read that table; a
test holds the two equal. The device's own courtesy gate counts in the
profile's timezone, which for an India or NSW profile is the same calendar by
default; where they differ the server's answer stands.

The rolling AI windows (the per-account allowances, the tutor's day, the paid
ceilings) are **24-hour windows, not calendar days**, and are unchanged.

## 5. Model-path inventory

Every route that sends student content to a model provider. Each counts one
unit of the deployment's paid-call ceiling per model call, before the call.
`server/test/edition-ai-budgets-check.mjs` fails if a module that spends from
the ceiling is missing from this table.

| Module | Routes | What is sent | Endpoint variable (default) | Model variable |
| --- | --- | --- | --- | --- |
| `recognitionOps.js` (via `handwriting.js`, `exams.js`) | `POST /v1/handwriting/transcribe`; a handwritten exam answer (`/v1/exams`) | The image of the student's written page. Answer-blind: no expected answer, solution or mark. | `PRI_HANDWRITING_ENDPOINT` (`https://api.openai.com/v1/responses`) | `PRI_HANDWRITING_MODEL`, `PRI_HANDWRITING_FALLBACK_MODEL` |
| `working.js` | `POST /v1/working/check` | The question prompt and the student's lines of working. | `PRI_WORKING_ENDPOINT`, else `PRI_HANDWRITING_ENDPOINT` (`https://api.openai.com/v1/responses`) | `PRI_WORKING_MODEL` |
| `questionPhoto.js` | `POST /v1/question-photo/identify` | The photograph of a question the student wants to practise. | `PRI_HANDWRITING_ENDPOINT` (shared handwriting configuration) | `PRI_HANDWRITING_MODEL` |
| `tutor.js` | `POST /v1/tutor/help`, `/v1/tutor/stream` and the tutor's other model levels | The question, the student's lines, the verified solution steps the server holds, and a bounded free-text message with a trimmed history. | `PRI_TUTOR_ENDPOINT`, else `PRI_WORKING_ENDPOINT`, else `PRI_HANDWRITING_ENDPOINT` (`https://api.openai.com/v1/responses`) | `PRI_TUTOR_MODEL`, else `PRI_WORKING_MODEL` |

Practice Submit (`paid: false`) reuses a read already paid for and never starts
a provider call. Every module above uses the one key, `PRI_HANDWRITING_API_KEY`.

**Not verified: where the provider processes any of this.** The default
endpoint is the provider's global API. Neither the provider's contractual terms
for regional processing nor a technical confirmation of the endpoint each
deployment uses exist for either region. Storing data with a provider in a
region (the database in Supabase's Mumbai region, for example) is **not**
processing it there (ADR-0002 §10). Until both exist, nothing the product says
may claim that a student's work, handwriting or data stays in, never leaves, or
is processed in India or Australia; `client/test/residency-claims-check.mjs`
fails any string catalogue, the app's `index.html`, or any file under
`marketing/` or `site/` that does.

## 6. Not finishable by software

- **The Prithagoras ceiling numbers** — the owner's budget.
- **Whether model processing is regional** — the provider's terms plus a
  technical confirmation of the endpoint; until then, no residency claim.
- **A separate provider account or key for Australia** — the owner, with H1.
