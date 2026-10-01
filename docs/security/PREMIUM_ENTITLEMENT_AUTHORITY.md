# Premium Entitlement Authority (SEC-COMM-01)

**Status:** implemented and tested. This document is the audit map the task asked for. It covers where Premium is granted, cached and checked; what is protected by the server; and what is only enforced on the device, and why.

## 1. Where Premium is granted (the only writers)

The server table `entitlement_snapshots` is written only by `applyVerifiedEntitlement` (`server/platform/entitlements.js`), and only with `verified: true` events from:

| Source | Verification |
|---|---|
| App Store | Apple-signed JWS, certificate chain, bundle/app id, product, server-issued `appAccountToken` (`server/platform/appleBilling.js`) |
| Google Play | **Not on `main` at the time of this change.** The Google verifier is CP-08, a separate PR. Until it merges there is no Google verifier: `/v1/billing/restore/google` and `/v1/billing/webhook/google` answer 503, and Google **cannot** grant Premium. |
| Razorpay (web) | Webhook signature over the raw body; server-created checkout bound to the account (`server/platform/razorpay.js`) |
| Support grant | Admin/support role, audited, unique event id (`server/platform/entitlements.js`) |

No route accepts a plan, status or capability from a client. Clients cannot push `entitlement`, `subscription` or billing state through sync. The server's sync allow-list (`CLIENT_ENTITY` in `server/platform/sync.js`) excludes them, and `server/test/premium-authority-check.mjs` pins that.

## 2. Where it is cached

`GET /v1/entitlements` returns a snapshot (`publicEntitlement`). The client keeps the last one with the linked account in IndexedDB (`client/src/platform/cloudAccount.js`). It reads it through `client/src/platform/entitlements.js`, which fails closed when the paid period or the **7-day offline window** has passed. The cache exists so the product keeps working offline. It is **UI and offline state, not authority**.

## 3. Where it is checked

| Capability | What it unlocks | Enforced at | Class |
|---|---|---|---|
| `unlimited-practice` | more than 20 practice questions/day | local backend (`client/src/local/entitlementGate.js`) | offline, bundled content |
| `premium-exams` | more than 1 exam simulation / 30 days | local backend | offline, bundled content |
| `jee-advanced-content` | the JEE Advanced track | local backend, on the resolved track | offline, bundled content |
| `advanced-pri-explain` | adaptive teaching plan / checkpoints | client (`PriExplainV5`) | offline, bundled logic |
| `advanced-analytics` | progress priorities, knowledge map, teacher export | client | offline, derived from local data |
| `additional-ai-usage` | a larger daily allowance of cloud handwriting reading and working checks | **server** (`server/platform/aiAllowance.js` in `POST /v1/handwriting/transcribe` and `POST /v1/working/check`) | **server-paid operation** |

**Why the first five are local.** Their content and logic ship inside the app, so it works with no network: questions, papers, explanations, analytics over local data. A device that rewrites its own IndexedDB can unlock them **on that device only**. Nothing reaches the server, no other account is affected, and no server cost is incurred. Preventing that would need DRM over bundled content. That is a commercial trade-off, not a security boundary, and it is recorded here rather than hidden.

**Why AI usage is on the server.** Cloud readings and working checks are paid provider calls. Each account gets an allowance per kind over a rolling 24-hour window:
- **Unit:** one request. One ink reading sent when the writing settles, one photo reading, or one working check. A request that escalates to the fallback model is two provider calls but one unit; the deployment spend ceiling counts provider calls.
- **Defaults:** free 120 and Premium 1200. The free figure leaves room for the 20 free practice questions a day with several readings each. These are starting values, not measured figures; size them from production telemetry.
- **Configuration:** `PRI_AI_DAILY_FREE` / `PRI_AI_DAILY_PREMIUM`. A value that is not a positive integer, or Premium below free, stops a production boot. Premium is never applied below free.

The allowance is decided **only** from `entitlement_snapshots`, through `serverEntitlementCapabilities`: a paid plan, a paying status (active/trialing, or grace until it ends) and an unexpired period. It ignores the client's offline window, because the server is the authority.

It is counted after the request has been validated and before anything reaches the provider. It sits in front of the deployment-wide spend ceiling (`server/platform/spendCeiling.js`): the ceiling protects the deployment, the allowance protects it from one account or one tampered device.

**Refunds:** a unit is given back when the request delivered nothing and cost nothing, i.e. the deployment ceiling refused it or the provider is not configured. Provider errors and timeouts are not refunded, because the provider may have been charged.

**When the allowance is used up**, the response is `429 AI_ALLOWANCE_EXHAUSTED` with `resetAt`. The client (`client/src/ink/cloudReader.js`) then stops sending requests until `resetAt` (or 30 minutes, if the reset time is implausible). An entitlement change, such as an upgrade, clears that at once. The student sees honest copy:
- **Handwriting:** the on-device reading stays on screen and keeps working.
- **Photos:** on the web there is no on-device photo reader, so the student is told the allowance is used and asked to type the working. In the Apple shell, Vision still reads the photo on device.

Cloud sync and classes are account features, not Premium. They need a signed-in, verified account (and guardian consent for children), never a Premium claim.

**Also mapped (no Premium on the server):**
- `/v1/content/published` and `/published-index` are anonymous by design. No Premium-only content may be published through the CMS, and the client does not consume CMS content today.
- Teacher assignments may name the `jee-advanced` track. They are stored on the server and delivered to any student; only the local backend enforces the track, as for all bundled content.
- The legacy `/api` routes exist only outside production.
- No other route reads a plan or capability from client input (whole-server sweep in the SEC-COMM-01 review).

## 4. Adversarial evidence

`server/test/premium-authority-check.mjs`, run in CI (44 unconditional checks; the suite fails if the count changes):
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

Apple and Razorpay grant, renew, cancel and refund exactly as before. This change only **reads** the snapshot they write. Google Play is not on `main` yet (see §1).
