# Premium Entitlement Authority (SEC-COMM-01)

**Status:** implemented and tested. This document is the audit map the task asked for. It covers where Premium is granted, cached and checked; what is protected by the server; and what is only enforced on the device, and why.

## 1. Where Premium is granted (the only writers)

The server table `entitlement_snapshots` is written only by `applyVerifiedEntitlement` (`server/platform/entitlements.js`), and only with `verified: true` events from:

| Source | Verification |
|---|---|
| App Store | Apple-signed JWS, certificate chain, bundle/app id, product, server-issued `appAccountToken` (`server/platform/appleBilling.js`) |
| Google Play | Re-fetch of `purchases.subscriptionsv2` with the server's service account; package, product/base plan, server-issued `obfuscatedAccountId`, one token per account (`server/platform/googleBilling.js`, CP-08) |
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

**Why AI usage is on the server.** Every cloud reading or working check is a paid provider call. Each account gets a daily allowance per kind:
- defaults: free 40, Premium 400;
- tunable with `PRI_AI_DAILY_FREE` / `PRI_AI_DAILY_PREMIUM`.

The allowance is decided **only** from `entitlement_snapshots`, through `serverEntitlementCapabilities`: a paid plan, a paying status (active/trialing, or grace until it ends) and an unexpired period. It ignores the client's offline window, because the server is the authority.

It is counted after the request has been validated and before anything reaches the provider. It sits in front of the deployment-wide spend ceiling (`server/platform/spendCeiling.js`): the ceiling protects the deployment, the allowance protects it from one account or one tampered device.

When the allowance is used up, the response is `429 AI_ALLOWANCE_EXHAUSTED` and the client falls back to on-device reading, which is unaffected.

Cloud sync and classes are account features, not Premium. They need a signed-in, verified account (and guardian consent for children), never a Premium claim.

## 4. Adversarial evidence

`server/test/premium-authority-check.mjs`, run in CI:
- **Claimed Premium:** a free account claiming Premium through request fields, headers, a forged entitlement object, a forged cached snapshot in the body, or an extra cookie never exceeds the free allowance. The provider is called exactly once per accepted request and never past the allowance.
- **Premium:** gets the Premium allowance.
- **Expired or revoked records:** an expired period, an expired grace, a revoked purchase, or a "premium" label with a non-paying status all get the free allowance.
- **Isolation:** kinds and accounts are separate, the window resets, and the server's entitlement row is untouched by any request.
- **Sync:** the sync allow-list contains no entitlement, subscription or billing kind.

Related: `client/test/entitlement-enforcement-check.mjs` (free tier and the capability map, now asserting the server enforcement point), `server/test/apple-billing-check.mjs`, `server/test/google-billing-check.mjs` and `server/test/razorpay-billing-check.mjs` (grant verification).

## 5. Provider semantics preserved

Apple, Google Play and Razorpay grant, renew, cancel and refund exactly as before. This change only **reads** the snapshot they write.
