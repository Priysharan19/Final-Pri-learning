# Premium Entitlement Authority (SEC-COMM-01)

**Status:** implemented and tested. This document is the audit map the task asked for. It covers where Premium is granted, cached and checked; what is protected by the server; and what is only enforced on the device, and why.

## 1. Where Premium is granted (the only writers)

The server table `entitlement_snapshots` is written only by `applyVerifiedEntitlement` (`server/platform/entitlements.js`), and only with `verified: true` events from:

| Source | Verification |
|---|---|
| App Store | Apple-signed JWS, certificate chain, bundle/app id, product, server-issued `appAccountToken` (`server/platform/appleBilling.js`) |
| Google Play | The purchase token is re-fetched from the Play Developer API with the deployment's service account; package name, a configured product and base plan, and the server-issued `obfuscatedAccountId` must all match, and the server acknowledges the purchase itself (`server/platform/googleBilling.js`, CP-08). Real-time notifications are verified as Google-signed OIDC. Unconfigured, `/v1/billing/*/google` answer 503 and Google cannot grant Premium. |
| Razorpay (web) | Webhook signature over the raw body; server-created checkout bound to the account (`server/platform/razorpay.js`) |
| Support grant | Admin/support role, audited, unique event id (`server/platform/entitlements.js`) |

No route accepts a plan, status or capability from a client. Clients cannot push `entitlement`, `subscription` or billing state through sync. The server's sync allow-list (`CLIENT_ENTITY` in `server/platform/sync.js`) excludes them, and `server/test/premium-authority-check.mjs` pins that.

## 2. Where it is cached

`GET /v1/entitlements` returns a snapshot (`publicEntitlement`). The client keeps the last one with the linked account in IndexedDB (`client/src/platform/cloudAccount.js`). It reads it through `client/src/platform/entitlements.js`, which fails closed when the paid period or the **7-day offline window** has passed. The cache exists so the product keeps working offline. It is **UI and offline state, not authority**.

## 3. Where it is checked

| Capability | What it unlocks | Enforced at | Class |
|---|---|---|---|
| `unlimited-practice` | more than 20 practice questions/day | **server** (`server/platform/practiceAllowance.js` in `POST /v1/practice/issue`, `POST /v1/practice/:id/repeat` and `POST /v1/practice/notebook/:attemptId/twin`, #537, D19); the local backend (`client/src/local/entitlementGate.js`) keeps a courtesy pre-check | **server-issued question** |
| `premium-exams` | more than 1 exam simulation / 30 days | **server** (`server/platform/exams.js` counts the account's sealed papers in `POST /v1/exams`); local backend pre-check | **server-issued paper** |
| `jee-advanced-content` | the JEE Advanced track | **server** for what is the track's own: its papers (`exams.js`) and its own question banks (`jee-advanced-*`, `pyq-jee-advanced-*`; `practiceAllowance.js` at issue, bind, repeat and twin, D19). Local backend for the track as a whole, on the resolved track | **server-issued paper / question**, plus the device's track gate |
| `advanced-pri-explain` | adaptive teaching plan / checkpoints | client (`PriExplainV5`) | offline, bundled logic |
| `advanced-analytics` | progress priorities, knowledge map, teacher export | client | offline, derived from local data |
| `additional-ai-usage` | a larger daily allowance of cloud handwriting reading and working checks | **server** (`server/platform/aiAllowance.js` in `POST /v1/handwriting/transcribe` and `POST /v1/working/check`) | **server-paid operation** |

**Why the practice cap and the exam allowance are on the server.** Since #418 every creditable question is issued by the server (`POST /v1/practice/issue`; owner decision 2026-10-10, online-only grading), so a cap enforced only on the device was unenforced for a modified client, a cleared device or a second device (#537). The server decides the free daily cap per **account**, where the question is issued:
- **The day** is the Indian calendar day — Asia/Kolkata, UTC+05:30, no daylight saving (`practiceDay`). The practice route serves only the India curriculum, and the device's own gate uses the same calendar for every India profile unless the student set another zone; where they differ, the server's answer stands and its refusal carries the server's reset instant.
- **The count** is one row per account and day in `idempotency_keys` (scope `practice-daily`, key the day), written in the same transaction as the question it counts, under the account's issue lock — so two devices racing for the twentieth question get exactly one. Only a question that is really issued is counted: a replayed issue (same `Idempotency-Key`, or the same account re-binding a prepared question) returns the stored question and counts nothing; a refusal writes nothing and never burns a prepared token. "The same question again" from History (`/repeat`) counts, as the device's own retry does.
- **What counts:** the Practice surface's modes — `practice`, `review`, `task` (`CAPPED_PRACTICE_MODES`, `client/src/engine/practiceAllowance.js`, one definition shared with the device). Rush, Match and the placement check are not counted on either side: the free plan's own copy is "20 practice questions a day, and everything else unlimited".
- **Premium** is decided from `entitlement_snapshots` through `serverEntitlementCapabilities` (`unlimited-practice`), exactly as the AI allowance is. An expired period, a lapsed grace, a "premium" label with a non-paying status, or any plan claimed in a header or body grants nothing.
- **The refusal** is `402 FREE_CAP_REACHED` — the same code and fields the device's own gate uses (`capability`, `used`, `limit`, `resetAt`, `timeZone`), with RFC 9110 `Retry-After` and `RateLimit-Reset` at the day's end — so the one paywall (`FreeCapNotice`) explains it with the server's count and the server's midnight. A question issued before the cap is still marked and revealed at the cap: the cap is on issue, never on a submission.
- **Configuration:** `PRI_FREE_PRACTICE_PER_DAY` (default 20, the figure the product's copy states). A value that is not a positive integer stops a production boot. Test suites that are about marking, not the cap, raise it by configuration; the cap itself is proved at its default.
- **On the device,** a server refusal is not worked around: the local backend throws it as the gate error (`serverGateRefusal`) rather than falling back to a prepared question or a draft, and a prepared question opened signed out cannot be bound — and so cannot be marked — by a capped account (the card names the refusal `free-cap`).

**Evidence:** `server/test/practice-daily-cap-check.mjs` (SQLite and Postgres under RLS: 20 issued, the 21st refused with `Retry-After`; replays never counted twice; two devices racing for the last question; a capped bind leaves the prepared token for another account; repeat counted; Rush/Match/placement uncounted; Premium unlimited, a lapsed period free; the day turning over at midnight IST), `client/test/server-daily-cap-client-check.mjs` (the device meets the server's refusal through the real dispatcher, does not fall back, cannot bind a prepared question, a second device is refused at a count of zero, Premium lifts it) and `client/test/tour-free-cap.js` (the cap screen in a browser after a second device used the day's questions; a capped account cannot have a signed-out question checked).

**JEE Advanced (D19, "which the server enforces").** The server refuses to a free account everything that is the JEE Advanced track's own:
- **its papers:** `POST /v1/exams` with a `jee-advanced` blueprint is `402 PREMIUM_REQUIRED` (`exams.js`);
- **its own question banks:** a generator named `jee-advanced-<chapter>` (the question department) or `pyq-jee-advanced-<chapter>` (the source-cited archive) is `402 PREMIUM_REQUIRED` at `POST /v1/practice/issue`, at the bind of a prepared question (which keeps its token), at "the same question again" and at a notebook twin. It is decided from `entitlement_snapshots` before anything is generated, escrowed or counted, and never at submission. One definition, `PREMIUM_PRACTICE_CONTENT` in `client/src/engine/practiceAllowance.js`.

What it does **not** refuse, stated so nobody relies on it: the JEE Advanced track's ordinary chapter questions at difficulty 3–4 are the same items JEE Main serves on the free plan. They are free content, and the server issues them to anyone; a modified client that asks for them gets nothing JEE Main does not already give a free account. The device's track gate (`entitlementGate.js`, on the resolved track) is what keeps a free student out of the JEE Advanced track as a whole. Today the server does not yet carry the track's own banks at all (they are loaded on demand on the device only), so a Premium request for one answers `422 PRACTICE_CONTENT_UNSUPPORTED`; the gate is in place for when they are served.

**Notebook twins count.** A twin (`POST /v1/practice/notebook/:attemptId/twin`) is a question issued in the capped `review` mode, so it counts toward the free day and is refused at the cap like a History repeat. Before D19 it was issued uncounted, which made a filed wrong answer an unlimited free supply of server-marked questions. Rush, Match and the placement check remain uncounted, as the free plan's copy has always said ("everything else unlimited"); the owner should confirm that reading of D19's "20 questions a day".

**Evidence:** `server/test/premium-practice-content-check.mjs` (SQLite and Postgres under RLS).

**Why the remaining three are local.** Their content and logic ship inside the app, so it works with no network: explanations, analytics over local data, and the device's gate on the JEE Advanced track as a whole (its server-issued parts are above). A device that rewrites its own IndexedDB can unlock them **on that device only**. Nothing reaches the server, no other account is affected, and no server cost is incurred. Preventing that would need DRM over bundled content. That is a commercial trade-off, not a security boundary, and it is recorded here rather than hidden.

**Why AI usage is on the server.** Cloud readings and working checks are paid provider calls. Each account gets an allowance per kind over a rolling 24-hour window:
- **Unit:** one request. One ink reading sent when the writing settles, one photo reading, or one working check. A request that escalates to the fallback model is two provider calls but one unit; the deployment spend ceiling counts provider calls.
- **Defaults (owner default D20):** reads of the student's own writing (ink, or a photo of written working, both through `/v1/handwriting/transcribe`) **5 a day free and 25 a day Premium**; "Practise this" question photos (`/v1/question-photo`) **5 and 25**, as their own kind; working checks, which are not reads and are not named by D20, keep **120 and 1200**. A read happens only when the student asks for it (Read, or Submit binding a read they were shown; a kept or in-flight read reused by Submit costs nothing). These are modelled defaults, not measured figures, to be revisited after real cost data. The deployment-wide paid-call ceiling is unchanged (D21: 120 an hour, 300 a day, `spendCeiling.js`).
- **Configuration:** per kind, `PRI_AI_DAILY_FREE_HANDWRITING` / `PRI_AI_DAILY_PREMIUM_HANDWRITING`, `PRI_AI_DAILY_FREE_PHOTO` / `PRI_AI_DAILY_PREMIUM_PHOTO`, `PRI_AI_DAILY_FREE_WORKING` / `PRI_AI_DAILY_PREMIUM_WORKING`. The older `PRI_AI_DAILY_FREE` / `PRI_AI_DAILY_PREMIUM` still apply to every kind a per-kind variable does not name, so **a deployment that set them does not get D20 until they are unset**. A value that is not a positive integer, or Premium below free for any kind, stops a production boot. Premium is never applied below free.

The allowance is decided **only** from `entitlement_snapshots`, through `serverEntitlementCapabilities`: a paid plan, a paying status (active/trialing, or grace until it ends) and an unexpired period. It ignores the client's offline window, because the server is the authority.

It is counted after the request has been validated and before anything reaches the provider. It sits in front of the deployment-wide spend ceiling (`server/platform/spendCeiling.js`): the ceiling protects the deployment, the allowance protects it from one account or one tampered device.

**Refunds:** a unit is given back when the request delivered nothing and cost nothing, i.e. the deployment ceiling refused it or the provider is not configured. Provider errors and timeouts are not refunded, because the provider may have been charged.

**When the allowance is used up**, the response is `429 AI_ALLOWANCE_EXHAUSTED` with `resetAt`. The client (`client/src/ink/cloudReader.js`) then stops sending requests until `resetAt` (or 30 minutes, if the reset time is implausible). An entitlement change, such as an upgrade, clears that at once. The student sees honest copy:
- **Handwriting and photos:** the shipped path has no on-device reader (D16), so the student is told today's reads are used, when they come back, and that a typed answer is still checked. The server's refusal says the same, names the kind (`kind`) and, on the free plan, Premium's figure.

Cloud sync and classes are account features, not Premium. They need a signed-in, verified account (and guardian consent for children), never a Premium claim.

**Also mapped (no Premium on the server):**
- `/v1/content/published` and `/published-index` are anonymous by design. No Premium-only content may be published through the CMS, and the client does not consume CMS content today.
- Teacher assignments may name the `jee-advanced` track. They are stored on the server and delivered to any student; only the local backend enforces the track, as for all bundled content.
- The legacy `/api` routes exist only outside production.
- No other route reads a plan or capability from client input (whole-server sweep in the SEC-COMM-01 review).

## 4. Adversarial evidence

`server/test/premium-authority-check.mjs`, run in CI (52 unconditional checks; the suite fails if the count changes):
- **D20 at its defaults, over HTTP:** a free account gets exactly 5 reads of its writing and, separately, exactly 5 question photos; Premium exactly 25 of each; the refusal promises no on-device reader. The configuration rules per kind, the older global override and Premium-below-free are checked without a server.
- **Claimed Premium:** premium claims in the body are refused before anything is counted. A free account gets **exactly** the free allowance, with exactly that many provider calls. With the allowance used up, every header or cookie claim (`x-pri-entitlement`, `x-pri-plan`, `x-pri-capabilities`, an extra entitlement cookie, a native client id) is still refused as free with the free limit, and nothing reaches the provider.
- **Premium:** active Premium, a trial, grace before it ends, and a support grant all get exactly the Premium allowance. An upgrade in the middle of a window takes effect at once.
- **Expired or revoked records:** an expired period, an expired grace, a revoked purchase, or a "premium" label with a non-paying status all get exactly the free allowance.
- **Isolation:** the working-check allowance is exhausted separately, accounts are separate, and the window resets.
- **Refunds:** a full deployment ceiling refuses without charging the student's allowance and without calling the provider.
- **Client:** `client/test/cloud-handwriting-client-check.mjs` covers the exhausted state, no retries until the reset, clearing on an entitlement change, and the implausible-reset back-off.
- **Scope of the device test:** the device-side "tampered cache" is covered by the server never reading it. The server test sends forged claims over HTTP; it does not drive a tampered IndexedDB through the real client.
- **Sync:** the sync allow-list contains no entitlement, subscription or billing kind.

Related: `client/test/entitlement-enforcement-check.mjs` (free tier and the capability map, now asserting the server enforcement point), `server/test/apple-billing-check.mjs`, `server/test/google-billing-check.mjs` and `server/test/razorpay-billing-check.mjs` (grant verification).

## 5. Provider semantics preserved

Apple, Google Play and Razorpay grant, renew, cancel and refund exactly as before. This change only **reads** the snapshot they write.
