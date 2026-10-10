# Recognition: what a read costs, and how it is bounded

Status: written 2026-10-10 against branch `task/ri-p0-recognition-dedupe`. **Nothing described here is deployed.** No production or staging variable, price, plan or allowance was changed.

Every number is labelled:

- **MEASURED** — observed in this repository's code, in its tests, or in the one real-provider run described in §3.
- **MODELLED** — arithmetic on measured numbers plus stated assumptions.
- **UNVERIFIED ASSUMPTION** — a figure nobody here has confirmed. Replace it before relying on the result.

Evidence classes are never mixed: *injected/counting test provider over real HTTP* (the test suites) is one class; *real provider on a localhost server with simulated handwriting* (§3) is another. There is no evidence here from staging, production, a physical device, Apple Pencil or a student's handwriting.

## 1. Provider calls per student answer

The reader is `POST https://api.openai.com/v1/responses` (`server/platform/handwritingProvider.js`), primary model `gpt-5.6-terra`, fallback `gpt-5.6-sol`, reasoning effort `low`, image detail `high`, `store: false`, a strict JSON schema, **no `max_output_tokens`** (the schema bounds the output: at most 40 lines of 400 + 600 characters). Images are at most 750,000 decoded bytes. The fallback runs when the first read is empty, below the confidence floor (0.82) or flagged ambiguous by the model, or when the primary times out. (MEASURED, code.)

One provider call = one unit of the deployment ceiling.

| Student action | Before | After | Why |
| --- | --- | --- | --- |
| Typed answer | 0 | 0 | never reaches the reader |
| Write: transcript shown, then submitted | 2 | **1** | `/handwriting/transcribe` and `/practice/:id/recognize` each called the provider for the same picture; the receipt now reuses the transcript |
| Second try, ink unchanged | +2 | **+0** | same picture, served from the kept read |
| Second try, ink rewritten | +2 | **+1** | a changed picture is always read afresh |
| Student edits the transcript text | +0 | +0 | `/recognition/:receipt/confirm` never calls the provider |
| Blank or unreadable page | 2 per send (4 if it was also submitted) | **2 once**, then 0 for the same picture | an empty read escalates to the fallback model; the empty result is kept like any other |
| Reload re-sending identical restored strokes | +1 or +2 | **+0** | byte-identical picture; also true after a server restart, inside 15 minutes |
| Double click, two tabs, ten concurrent identical requests | one call each | **1 in total** | they join one read in flight |
| Photo: same rows as Write | same | same | the read does not depend on the input mode |

MEASURED: every "After" row is asserted in `server/test/recognition-dedupe-check.mjs` (counting test provider, real HTTP, SQLite and Postgres), and "transcript shown, then submitted = 1 call" was also observed with the real provider (§3).

**Not changed by this work:** the client decides how often to send a picture. If it reads the ink each time the writing settles, every distinct settled state is a different picture and a paid call. The server guarantees only that an *unchanged* picture is not paid for twice.

## 2. How the counters behave (verified in code and tests)

| Statement | Verdict |
| --- | --- |
| Deployment ceiling `PRI_PAID_CALLS_PER_HOUR` / `_PER_DAY`, buckets `paid-provider:hour` / `:day`, fixed windows that start at the first call after the previous window ended | Correct. One budget shared by handwriting, working check, tutor and question-photo |
| Counted when a call is attempted, before the provider is called | Correct |
| A refused request does not increment | **Was wrong in one case.** A request refused by the *day* window had already incremented the *hour* window, and that increment was committed. Fixed: a refusal now counts in neither window (`reservePaidCall`). Separately, every request, refused or not, counts against the per-account request rate limit, by design |
| A provider failure or timeout is not refunded | Correct, and kept (see §4) |
| A fallback escalation is a second unit | Correct, including the fallback tried after a primary timeout |
| Per-account limits: 240/hour on `/transcribe`; daily AI allowance refunded only for `NOT_CONFIGURED` | Partly. `/recognize` has its own 120/hour limit. The allowance (default 120/day free, 1,200/day Premium, `kind: handwriting`, shared by both routes, a fixed 24-hour window from first use) counts **requests**, not calls, and was also refunded when the ceiling refused the primary call |
| Production is 20/hour and 50/day, staging 60/300 | **NOT VERIFIED here.** Taken from the task brief; no deployed variable was read |

Also observed: when the ceiling refuses the *fallback*, the request fails with `PAID_CAPACITY_REACHED` although the primary call was made and counted. That is existing provider-adapter behaviour and is unchanged.

After this change:

- A reused read (kept, or joined in flight) consumes **no** ceiling unit and **no** allowance unit. It still passes the per-account request rate limit.
- A kept read is served even when the ceiling or the allowance is exhausted — it needs no capacity.
- Refusals are machine-readable. `503 PAID_CAPACITY_REACHED` carries `retryable: true`, `resetAt` (epoch ms, equal to the `RateLimit-Reset` header) and `window` (`hour` or `day`). `429 AI_ALLOWANCE_EXHAUSTED` carries `retryable: true`, `resetAt`, `window: "day"`, `limit`, `plan`. Message texts are unchanged.
- Successful responses carry `reused: true|false`.
- With a key and no ceiling configured, every request is refused `503 PAID_CAPACITY_NOT_CONFIGURED`, kept read or not.
- A refused or over-allowance submit writes no receipt, no completion and no graded attempt; the question stays on the try it was on. (MEASURED, test §9c.)

## 3. Measured tokens and latency (one real-provider run)

**Evidence class: real provider, localhost server, simulated handwriting.** `tools/acceptance/launch-recognition-cost.mjs`, run once on 2026-10-10 under `railway run` with a clean child environment (only `PRI_HANDWRITING_*`, a temp SQLite file, a local ceiling of 25 calls). **12 provider calls in total.** Pictures were drawn by `tools/acceptance/simulated-ink.mjs` through the app's own rasterisers. Tokens are the provider's own `usage` object; the model is the id the provider reported back.

| Picture | Size (px) | Model reported | Input tok. | Output tok. | of which reasoning | Read latency | Fallback |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| digit `7` | 244×335 | gpt-5.6-terra | 430 | 62 | 19 | 2.39 s | no |
| number `24` | 399×343 | gpt-5.6-terra | 496 | 41 | 0 | 1.83 s | no |
| `n = 24` | 932×329 | gpt-5.6-terra | 721 | 46 | 0 | 1.92 s | no |
| `0123456789` | 1497×357 | gpt-5.6-terra | 1,001 | 75 | 26 | 2.48 s | no |
| working, 4 lines | 1873×1175 | gpt-5.6-terra | 2,944 | 141 | 0 | 2.78 s | no |
| working, 3 lines | 1512×1105 | gpt-5.6-terra | 2,341 | 103 | 0 | 2.12 s | no |
| working, 6 lines | 1449×1519 | gpt-5.6-terra | 2,974 | 222 | 35 | 4.04 s | no |
| working, 5 lines (the 4-line page after an edit) | 1702×1293 | gpt-5.6-terra | 2,981 | 292 | 120 | 3.94 s | no |
| photo page, 4 lines | 1500×1100 JPEG | gpt-5.6-terra | 2,299 | 141 | 0 | 2.16 s | no |
| photo page, 6 lines | 1500×1100 JPEG | gpt-5.6-terra | 2,299 | 185 | 0 | 2.88 s | no |
| blank page | 900×420 | gpt-5.6-terra, then gpt-5.6-sol | 812 + 812 | 40 + 26 | 14 + 0 | 3.31 s (both) | **yes** |
| receipt for the 4-line page, the photo, the digit (`/recognize`) | — | none | 0 | 0 | 0 | 4–7 ms HTTP | — |
| 4-line page and blank page sent again | — | none | 0 | 0 | 0 | 5 ms HTTP | — |

Summary (MEASURED, this run only):

- Per provider call, all 12: input mean **1,676**, max **2,981**; output mean **115**, max **292**; reasoning mean 18, max 120. (The provider's `output_tokens` normally includes reasoning tokens; that inclusion is an UNVERIFIED ASSUMPTION for these model ids.)
- Per `gpt-5.6-terra` call, n = 11: input mean 1,754, output mean 123.
- By kind: single-line answer (n = 4) input 662 / output 56; multi-line ink working (n = 4) input 2,810 / output 190; photo page (n = 2) input 2,299 / output 163; blank page (n = 1) two calls, 1,624 / 66 in total.
- Read latency, 11 paid reads: mean 2.7 s, min 1.8 s, max 4.0 s.
- **Fallback frequency: 1 of 11 paid reads, the blank page.** No legible simulated page escalated. Simulated ink is cleaner than a student's; real handwriting will escalate more often. NOT MEASURED for real handwriting.
- The provider did not report image-input tokens separately from input tokens.
- `/transcribe` then `/recognize` on the same picture: **one provider call**, three times out of three, each with a valid receipt.

n is 12. These are not population statistics.

## 4. Cost formula and prices

```
cost of one read = Σ over its provider calls ( input_tokens × P_in(model) + output_tokens × P_out(model) )
```

Prices: read on 2026-10-10 from the provider's pricing page (`developers.openai.com/api/docs/pricing`), standard tier, short context, per 1M tokens — `gpt-5.6-terra` **$2.00 input / $12.00 output**, `gpt-5.6-sol` **$4.00 input / $20.00 output**. The page was read through an automated page summariser, not by a person, and third-party sites quote other figures ($2.50/$15 and $5/$30). Treat these as **UNVERIFIED until the owner reads them off the pricing page or an invoice**; every figure below scales linearly with them.

At those prices (MODELLED from §3):

| Read | Cost | In ₹ at ₹88/$ |
| --- | ---: | ---: |
| Mean `gpt-5.6-terra` call | $0.0050 | ₹0.44 |
| Single-line answer | $0.0020 | ₹0.18 |
| Multi-line ink working | $0.0079 | ₹0.69 |
| Photo page | $0.0066 | ₹0.58 |
| Blank page (both models) | $0.0059 | ₹0.52 |
| Most expensive call observed | $0.0095 | ₹0.83 |

₹88 per US dollar is an **UNVERIFIED ASSUMPTION** (stated 2026-10-10, not looked up).

Per handwritten answer, clean first try: one read. For 100 / 1,000 / 10,000 answers at the mean call: **$0.50 / $4.98 / $49.78** (MODELLED); at the most expensive call observed: $0.95 / $9.47 / $94.66. Before this change the same answers cost at least twice that.

Retries and corrections: editing the transcript costs nothing; rewriting the ink costs one more read; re-sending the same picture costs nothing for 15 minutes.

**Refund rule.** A unit is given back only when this server certainly sent the provider nothing: `HANDWRITING_NOT_CONFIGURED` and `HANDWRITING_PROVIDER_CONFIG_INVALID`. It is kept for our own timeout, a 5xx, an unreachable provider, a 429, a rejection and a malformed reply. Reason: the ceiling exists to bound the bill; after a timeout or a 5xx the provider may have run the model, and "unreachable" does not distinguish a refused connection from one dropped after the request was received. Whether the provider bills a 4xx/429 is NOT VERIFIED, so those keep their unit too. The cost of being conservative is that an outage consumes ceiling units without producing reads.

## 5. Per-student monthly model

Recognition, at the mean call ($0.0050, ₹0.44) and at the most expensive call observed ($0.0095, ₹0.83). MODELLED.

| Paid reads per student per month | Mean | Conservative |
| ---: | ---: | ---: |
| 25 | $0.12 · ₹11 | $0.24 · ₹21 |
| 90 | $0.45 · ₹39 | $0.85 · ₹75 |
| 300 | $1.49 · ₹131 | $2.84 · ₹250 |

Tutor (**MODELLED, not measured** — the tutor adapter records no usage and was not called). `server/platform/tutorProvider.js`: same key, model `gpt-5.6-terra` by default, reasoning `low`, streamed replies capped at 320 output tokens; system prompt about 1,700 characters; the user message carries the question, the verified solution (up to 8,000 characters), the student's work and up to six earlier turns. Assuming 4 characters per token: typical input about 1,050 tokens, worst case about 4,900. One reply ≈ **$0.006 (₹0.52)** typical, **$0.014 (₹1.21)** worst case; a leaked-answer regeneration is a second call. Cached nudge/socratic/walkthrough replies cost nothing. Existing allowances: 40 replies/day free, 120/day Premium, 60/hour.

| Tutor replies per month | Typical | Worst case |
| ---: | ---: | ---: |
| 10 | ₹5 | ₹12 |
| 30 | ₹16 | ₹36 |
| 60 | ₹31 | ₹72 |

Revenue per subscriber per month. Assumptions (all UNVERIFIED): the listed price includes 18% GST; store commission is charged on the GST-exclusive amount; a web gateway takes 2.5% of the listed price; infrastructure is ₹15 per paying student per month (Railway, Supabase, email — not derived from an invoice).

| Price | Ex-GST | Net, store 15% | Net, store 30% | Net, web 2.5% |
| ---: | ---: | ---: | ---: | ---: |
| ₹299 | ₹253 | ₹215 | ₹177 | ₹246 |
| ₹399 | ₹338 | ₹287 | ₹237 | ₹328 |
| ₹599 | ₹508 | ₹431 | ₹355 | ₹493 |

AI cost of a usage profile against those nets (MODELLED):

| Profile per month | Mean cost | Conservative cost | Share of net at ₹399 (store 30% … web) at mean |
| --- | ---: | ---: | ---: |
| 60 reads + 20 tutor replies | ₹37 | ₹74 | 16% … 11% |
| 90 reads + 30 tutor replies | ₹55 | ₹111 | 23% … 17% |
| 120 reads + 40 tutor replies | ₹73 | ₹148 | 31% … 22% |
| 200 reads + 60 tutor replies | ₹119 | ₹239 | 50% … 36% |
| 300 reads + 60 tutor replies | ₹163 | ₹322 | 69% … 50% |

**The existing daily allowances are abuse bounds, not economic ones.** A Premium account that used its full 1,200 reads a day would cost about $180 a month at the mean call; 120 tutor replies a day about $21. Neither is covered by any price above.

### Recommendations (nothing was changed)

Target: AI cost at the mean no more than **30% of net revenue** on the worst channel (store, 30% commission).

| Plan price | 30% of worst-channel net | Recommended monthly allowance | Mean cost |
| ---: | ---: | --- | ---: |
| ₹299 | ₹53 | 90 reads + 30 tutor replies | ₹55 |
| ₹399 | ₹71 | 120 reads + 40 tutor replies | ₹73 |
| ₹599 | ₹107 | 180 reads + 55 tutor replies | ₹108 |

At the conservative per-call cost these roughly double, so the share becomes about 60% on that channel; if real handwriting escalates to the fallback often, expect to be nearer the conservative column.

- **Free:** 10 reads + 5 tutor replies a month, about ₹7 per free student at the mean (₹14 conservative), unfunded. Today's free defaults (120 reads and 40 tutor replies *per day*) allow a free account to cost more in a day than this allows in a month.
- A *monthly* allowance does not exist in the code: allowances are daily, in `rate_limits`, whose rows housekeeping purges after 24 hours. Implementing a monthly one needs a different counter. As an interim, daily values of about 6 reads and 2 tutor replies for Premium at ₹399, and 1 and 1 for free, bound the month at roughly the figures above but are harsh on a student who works in bursts.

## 6. Ceilings, quotas, and what is not a monetary cap

**A request ceiling is not a monetary cap.** It bounds calls, not dollars: a call's cost varies about fivefold with the picture (§4), and the ceiling is per process state in one database. **The only hard monetary cap is a spend limit set by the owner on the provider account or project.** Set one. Suggested starting numbers (owner decision, on the provider's dashboard): staging **$20/month**, a limited pilot **$50/month**, then about 1.5× the modelled monthly spend of the stage being run.

Recommended request ceilings, from a demand model rather than a guess (MODELLED). Assumptions: 1.3 provider calls per handwritten answer after this change (one read, 25% of answers get a rewritten second try, 3% blank pages at two calls, rounded up); 1.1 calls per tutor reply; the budget is shared by all paid routes.

| Stage | Demand model | Calls/day | Suggested day / hour ceiling | Worst-case daily cost at the ceiling ($0.0095 a call) |
| --- | --- | ---: | --- | ---: |
| Staging QA | one acceptance run (~24 calls) plus manual checks | < 150 | 300 / 60 (as now, per the brief) | $2.85 |
| Limited pilot | 20 students × (10 handwritten answers + 5 tutor replies) a day | 370 | 500 / 150 | $4.75 |
| Launch, 500 daily students | same per-student usage | 9,250 | 12,000 / 2,500 | $114 |

The hourly figures assume half of a pilot's students, or a fifth of launch's, work in the same hour.

**Can the current production ceiling (20/hour, 50/day, unchanged by owner decision) support a limited real-student pilot after this change?** Only a very small one, and with no room for the tutor or the working check, which draw on the same budget.

- Day: 50 ÷ 1.3 ≈ **38 handwritten answers a day across the whole deployment** (before this change: 50 ÷ 2.6 ≈ 19). That is 3 students × 10 answers (39 calls), or 10 students × 3 answers. 5 students × 8 answers = 52 calls, over the day ceiling.
- Hour: 20 ÷ 1.3 ≈ **15 answers in any hour**. Three students doing five handwritten answers each in the same hour is 19.5 calls — at the limit.
- Each tutor reply or working check takes a unit from the same 50.

So: yes for about three students working at different times, typing most answers; no for a class. When the ceiling is reached the server refuses with `resetAt`, and nothing of the student's attempt is consumed.

Per-account quotas and abuse protections, recommended: keep the per-account request rate limits (240/h, 120/h) as flood protection; set the daily allowances from §5 rather than the current defaults; keep verified email and guardian consent as preconditions; alert on `provider_calls_total`, `provider_tokens_total` and `recognition_reads_total{source}` from `/v1/metrics` (a falling share of `cache`/`inflight` means clients are re-sending changed pictures); and watch the provider's own usage dashboard, which is the only source of billed amounts.

## 7. Where kept reads live: invariants, privacy, restart

**Storage.** A completed read is one row in the existing `idempotency_keys` table: `scope = 'recognition-read'`, `key` = HMAC-SHA-256 (server key derived from `PRI_AUTH_DELIVERY_KEY`) over the account id, the image type, the SHA-256 of the decoded image bytes and the reader configuration; `response_json` = the transcript record; `expires_at` = paid read + 15 minutes. No schema change and no migration. The table could be reused because it already has: a per-account primary key `(account_id, scope, key)`; Row-Level Security by account for the server role on Postgres; an `expires_at` that housekeeping deletes on (startup and every six hours); `ON DELETE CASCADE` from `accounts`; and it already holds reading receipts, with their transcripts, for 90 days.

**What is stored.** The transcript only (lines, text, confidences, engine label, flags), at most 64 kB. Never the image, and never its plain digest — a database reader cannot test whether an account submitted a known picture without the server key. Who can read it: the server role, and only for the owning account; it is returned only to a live, verified, consented session of that account.

**How long.** Reusable for 15 minutes from the paid read; reuse does not extend it. The row is deleted at the same account's next paid read or at the next housekeeping pass, whichever is first — so up to about six hours physically, 15 minutes usefully. Account deletion removes the rows at once (cascade; asserted in the suite, and the table is in the account-deletion journey's zero-rows list). Guardian-consent withdrawal does not delete them, but the routes that could return them are refused from that moment (tested), and they expire.

**Why 15 minutes.** One attempt at a question — write, read, check the transcript, submit, second try — is minutes. Fifteen covers a pause or a reload without keeping a child's transcript for this purpose longer than one sitting. A read is a pure function of the picture and the configuration, so the TTL is not about staleness.

**Restart.** Completed reads survive a restart (they are in the database). A read that was in flight when the process died is lost; its unit was counted and is not refunded; the retry is a new paid read.

**Replicas.** Completed reads are shared by every replica, because every replica uses the same database and derives the same key. **Single-flight is per process**: with one replica (Railway today, per the brief — NOT VERIFIED here) concurrent identical requests always make one call; with N replicas, identical requests that land on different replicas at the same instant, before either has finished, can make up to N calls. Each is still counted against the ceiling, so the ceiling is never exceeded. A cross-replica reservation (a `pending` row under the same key with a short lease, polled by the other replica) is possible in this table but was not built: it adds polling and lease-expiry failure modes to a marking-adjacent path for a deployment that has one replica. Build it before running more than one.

**Empty and uncertain reads are kept**, because they are the provider's answer for that exact picture and the most expensive one. **Failures are not**: a timeout, 5xx, rejection, refusal, or a read whose fallback attempt failed leaves no row, so an explicit retry is a real read.

**Configuration changes** (model, fallback, reasoning effort, confidence floor, endpoint, prompt, schema) change the key, so old rows are simply never found again and expire.

## 8. Not verified

- Production and staging ceiling values and replica count (from the brief, not read).
- Provider prices (read by an automated summariser; third-party figures differ) and the INR rate.
- Whether the provider bills rejected (4xx/429) requests; whether `output_tokens` includes reasoning tokens for these models.
- Token counts, latency and fallback frequency for real handwriting, real photos, or real devices.
- Tutor token usage (modelled only); working-check and question-photo costs (not examined).
- Any behaviour on staging or production: nothing here is deployed.
