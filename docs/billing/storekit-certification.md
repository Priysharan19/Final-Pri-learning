# StoreKit Premium certification: code evidence and external blockers

Scope: [PRI_V1_RELEASE_SCOPE §12](../release/PRI_V1_RELEASE_SCOPE.md) (Premium is in V1, sold as an Apple StoreKit subscription with server-authoritative entitlements; web/Razorpay purchasing is **out** of V1) and hard blocker #7 ("Premium StoreKit production configuration and transaction certification must be completed").

This document separates what automated code evidence proves from what only real App Store configuration and a physical iPad can prove. **Passing tests do not close blocker #7.** The scope document says the same.

## Invariant

> The Premium entitlement always derives from authoritative, Apple-signed payment state, across retries, duplicates, cancellation, expiry, refunds, upgrades, restores, account switches and reordering. The device never decides Premium. Web purchase is never reachable from the iPad app.

## Proven in code (synthetic evidence)

All fixtures are real ES256/x5c JWS. They are signed by a throwaway root, intermediate and leaf chain that each test process generates (`server/test/support/apple-signing.mjs`) and trusts only through its own `PRI_APPLE_ROOT_CA_PEM`. Production trust roots are not touched and Apple is never contacted. **This is synthetic evidence. It is not App Store evidence.**

`server/test/storekit-entitlement-state-machine-check.mjs` runs on SQLite (CI step "StoreKit entitlement state machine and reconciliation", pinned at 172/172) and on Postgres as the `pri_server` role (`PLATFORM ON POSTGRES`, 31/31 suites). Each scenario checks two things: the resulting entitlement, and its audit trail (`billing_events` row, verified signed-data ledger row, and a clean reconciliation from that ledger).

| # | Scenario | Expected and proven |
|---|---|---|
| S1 | Purchase → `DID_RENEW` → no further event | active → active with the renewed period → free at the period end (time bound, no notification needed) |
| S2 | `DID_FAIL_TO_RENEW:GRACE_PERIOD`, restore during grace, `DID_RENEW:BILLING_RECOVERY`, `GRACE_PERIOD_EXPIRED`, `DID_FAIL_TO_RENEW` without grace | grace (Premium until Apple-signed `gracePeriodExpiresDate`) → still grace after a device restore → active → expired; no grace means past_due and not entitled |
| S3 | Voluntary cancellation: `DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_DISABLED` → `EXPIRED:VOLUNTARY` → `SUBSCRIBED:RESUBSCRIBE` | active to the period end → expired → active again; an older cancellation delivered late is stale |
| S4 | `REFUND`, late older `DID_RENEW`, `REFUND_REVERSED`, `REVOKE`; a refund reported only by the device | revoked immediately (before the period end) → stale (no resurrection) → active → revoked; the device's re-signed revoked transaction revokes |
| S5 | Upgrade monthly → annual, then the superseded monthly (`isUpgraded`) arrives; downgrade | annual product active, kept after the superseded transaction; downgrade keeps the current product until renewal |
| S6 | Restore on a new device or reinstall; mixed restore with a revoked transaction that has a later expiry | Premium restored; the identical JWS replays idempotently; the paid transaction wins |
| S7 | Account switch on one iPad (same Apple ID, two Pri accounts) | B cannot claim A's transaction (`APPLE_ACCOUNT_TOKEN_MISMATCH`); B's restore finds nothing; a crossgrade under B's token cannot re-bind A's subscription (`BILLING_ACCOUNT_MISMATCH`); no audit or ledger row is filed under B; A keeps Premium |
| S8 | Five concurrent deliveries of one notification | applied exactly once; one audit row; one ledger row; version +1 |
| S9 | `EXPIRED` before an older `DID_RENEW`; `REFUND` and `DID_RENEW` signed in the same millisecond | older event is stale; the refund wins the tie on rank |
| S10 | A captured `SUBSCRIBED` replayed after a refund | replay; Premium is not restored |
| S11 | Notification with an unknown `appAccountToken`, or none (offer code) | acknowledged with HTTP 200, no entitlement change, ledger row with no account (`--unbound`) |
| S12 | Tampered signature, edited payload, untrusted root (outer, inner and device), renewal info for another subscription, non-JWS input | each refused with its code; nothing applied; nothing stored |
| S13 | Wrong bundle id (notification and transaction), wrong App Apple ID, Sandbox on a production-only deployment, Production envelope carrying a Sandbox transaction | each refused |
| S14 | Two subscriptions on one account, one refunded; an Apple expiry while a support grant is live | Premium kept from the live source; the refunded subscription is recorded revoked |
| S15 | A server-gated Premium feature (tutor allowance) | follows the server entitlement only: up on a verified purchase, down at once on a refund |
| S17 | Several paid sources in both arrival orders: annual then monthly, monthly then annual then a monthly renewal, support grant then Apple purchase then Apple expiry, Apple purchase then grant then Apple renewal, a grant shorter than an Apple annual that is then refunded | Premium follows the longest-paying source every time; the grant survives every Apple event; reconciliation is clean, and reports a snapshot that lost the grant |
| S16 | Reconciliation | a hand-edited snapshot, a tampered ledger row, or a wrong subscription state is each reported |
| HTTP | Same flows through the production app (session, CSRF, `/v1/billing/apple/*`, `/v1/billing/webhook/apple`, `/v1/entitlements`) | a client claiming Premium without proof is refused; a forged restore or webhook gets 401; redelivery is recorded once; `/v1/entitlements` names its account |
| Native web checkout | `POST /v1/billing/checkout/web` from `X-Pri-Client: ios-native-v1` or `android-native-v1` | 403 `BILLING_WEB_CHECKOUT_NATIVE_REFUSED`; `/v1/billing/config` reports web checkout as unconfigured to native clients |
| CLI | `server/tools/billing-reconcile.mjs` | exit 0 when clean, 2 on drift, 1 on a usage error; `--evidence` reports an Apple-signed refund the server never applied, ignores another account's data, and writes nothing |

`client/test/storekit-entitlement-client-check.mjs` (in `npm test`) covers the device side:

- a snapshot answered for a different account (the device-wide session now belongs to another profile's account) is refused, so Premium cannot leak between two students on one iPad;
- an unattributed Premium snapshot is refused;
- a stretched offline window lapses seven days after issue;
- a tampered cache is overwritten by the next server refresh, after which the Premium gate refuses;
- `createWebBillingCheckout` refuses inside a native shell without sending a request.

### Defects found and fixed (each has a regression above)

| Id | Defect | Fix |
|---|---|---|
| D1 | A device transaction was keyed on `transactionId` alone. When StoreKit re-signed the same transaction with `revocationDate` (refund), the new statement was treated as a "replay" of the purchase and ignored. | Event id is `tx:<transactionId>:<digest of the signed bytes>`. Order is still decided by Apple's `signedDate`. |
| D2 | Restore picked the transaction with the latest `expiresDate`, even when it was revoked or lapsed and a paid one was present. | Paid transactions are ranked first. |
| D3 | A lapsed transaction from the device (for example a restore during grace) applied as `expired` and cut a paying student off mid-grace. | Such events are **advisory**: they never end a lifecycle the subscription last verified as paid. Time alone ends it at its own end. |
| D4 | An advisory event advanced the ordering clock, so an older but authoritative notification (a delayed grace) arriving after it was dropped as stale. | Advisory events do not move the ordering clock. |
| D5 | The superseded monthly transaction (`isUpgraded`) from `Transaction.updates` applied as `expired` and removed the annual Premium just bought. | Treated as advisory (same rule as D3). |
| D6 | The account entitlement was "whatever the last event said". Refunding or expiring one subscription removed Premium that a second, still-paid subscription or a support grant provided. A shorter paid source arriving after a longer one (a monthly bought while an annual runs, an Apple purchase during a support grant) shortened Premium. A support grant lived only in the snapshot, so the next billing event erased it. | Per-subscription lifecycle state and durable support-grant rows (`entitlement_support_grants`), both billing schema v5. On every event the entitlement is the paid source with the latest end across the event and all other sources (`selectEntitlementSource`), whatever the arrival order. Reconciliation considers grants too. |
| D7 | The server capped Premium by the `offline_until` stored at the last billing event. So `/v1/entitlements` and server-gated features (tutor allowance) stopped reporting Premium **seven days after each purchase or renewal**, which is three weeks of every monthly period. | The seven-day offline window is issued fresh on every read and never extends past the paid lifecycle. |
| D8 | A notification that named no Pri account answered 409, so Apple kept redelivering it for days. | Acknowledged and stored with no account, for the operator. |
| D9 | `/v1/entitlements` did not say which account it answered for. With a device-wide session, a second profile signing in made the first profile's refresh file the other account's Premium under it. | The response carries `accountId`. The device refuses a mismatched answer, and refuses unattributed Premium. |
| D10 | The client offline window was not bounded by its issue time. | `offlineUntil ≤ issuedAt + 7 days` on the device as well as the server. |
| D11 | Web (Razorpay) checkout was hidden in the native UI, but nothing else stopped a native client from reaching it. | The server refuses it for native clients (403). `/v1/billing/config` reports it unconfigured there. The transport refuses it in a native shell before any request. |
| D12 | The iPad "Restore App Store purchases" loop stopped at the first transaction bound to another Pri account. | Each transaction is tried (`acceptEachTransaction` in `nativeBilling.js`, tested in the client suite). Only a total failure is reported. |
| — | Device transaction and restore verification (subscription binding, ledger row) committed separately from the entitlement change; a failed apply could leave an orphan ledger row. | `/v1/billing/apple/transaction` and Apple restore verify and apply in one transaction, as the webhook does. |
| — | Renewal info was not tied to the notification's subscription. | `signedRenewalInfo.originalTransactionId` must match (`APPLE_NOTIFICATION_MISMATCH`). |

### Feature gates and offline behaviour

- **Server-gated Premium** reads only `entitlement_snapshots`, through `publicEntitlement`. No request field, header or device state can raise it. Today the only server-gated Premium use is the tutor allowance (`tutorDailyLimit`). `POST /v1/billing/apple/transaction` and `/restore/apple` change the entitlement only after Apple's chain, signature, app identity, product and `appAccountToken` all verify.
- **Device-gated Premium** covers the local-first content listed in `client/src/local/entitlementGate.js` `CAPABILITY_ENFORCEMENT`: unlimited practice, exams, the JEE Advanced track, advanced Explain and analytics. It reads the server-issued snapshot that the device stored for the linked account. It is usable only while the server lifecycle (period end, or grace end) **and** the offline window (at most seven days from issue, never past the lifecycle) are both valid. Otherwise it fails closed with `offline-entitlement-expired` and asks for a refresh.
- **Bounded, documented limitation.** Premium content runs offline on the device, so a student who edits IndexedDB on a device they control (for example a jailbroken iPad or browser devtools on the web) can unlock local-only Premium content until the next refresh. The next successful refresh replaces the edited cache with the server's answer. That student never gains server-side Premium, server-gated allowances, or anything synced to another device. Closing this fully would require server-signed snapshots verified on the device, which is not in V1.

## BLOCKED_EXTERNAL (cannot be proven in code)

Each item below needs real-world authority or hardware. None of them can be faked, and the synthetic evidence above stands in for none of them.

1. **App Store Connect products.** The auto-renewable subscription group, the monthly and annual products, their final product ids (set as `PRI_APPLE_MONTHLY_PRODUCT_ID` / `PRI_APPLE_ANNUAL_PRODUCT_ID`), price tiers, the billing grace period setting, and review metadata. Owner: App Store Connect account holder.
2. **Production trust configuration.** Apple Root CA G3 (from apple.com/certificateauthority) deployed as `PRI_APPLE_ROOT_CA_PEM`/`_FILE`, plus `PRI_APPLE_APP_ID` (App Apple ID), `PRI_APPLE_BUNDLE_ID`, `PRI_APPLE_ENVIRONMENTS=Production`. `PRI_APPLE_ALLOW_SANDBOX` stays unset in production. Owner: deployment operator.
3. **App Store Server Notifications v2 URLs.** The production and sandbox URLs (`/v1/billing/webhook/apple`) registered in App Store Connect, and a "Request a Test Notification" round trip observed in the server logs. Owner: account holder and operator.
4. **Sandbox transactions on a physical iPad.** With a Sandbox Apple ID on a TestFlight build against a deployment with Sandbox explicitly allowed: purchase, renewal (accelerated sandbox clock), auto-renew off → expiry, a billing-retry and grace test, a refund requested through the sandbox, upgrade/downgrade, restore after reinstall, and an account switch on the same iPad. Each needs the device result, the server snapshot and a clean `billing-reconcile` run recorded as physical evidence. Owner: QA with a real iPad.
5. **Final production transaction test** on a physical iPad after release approval. Owner: release governor.
6. **In-App Purchase key** for the owner-run App Store Server API history calls in the reconciliation runbook. It is held by the account holder and never stored in the repository or the server environment.
7. **App Review and legal.** Subscription terms, refund policy and privacy disclosures accepted by App Store review. Owner: legal and account holder.

Until items 1–5 are recorded as physical evidence, blocker #7 remains **open**.

### Status annotations (2026-10-02; append-only)

| Item | Status on 2026-10-02 | Exact human action still needed | Evidence file / command that closes it |
|---|---|---|---|
| Code (tables above) | **software-complete**: `npm run test:platform:commerce` and the Postgres runner (`PLATFORM ON POSTGRES: PASS — 32/32 suites`) pass on `main`; billing schema version 6 (`server/platform/schemaVersions.js`) | none | CI job *Production account, sync and commercial schema* |
| 1 App Store Connect products | `BLOCKED_EXTERNAL` | account holder creates the subscription group, monthly and annual products, grace period, review metadata; hands the final product ids to the operator | Railway variables `PRI_APPLE_MONTHLY_PRODUCT_ID`, `PRI_APPLE_ANNUAL_PRODUCT_ID` set; `GET /v1/health` operator view (`PRI_METRICS_TOKEN`) → `billingProviders.apple: true` |
| 2 Production trust | `BLOCKED_EXTERNAL` | operator downloads Apple Root CA G3 from apple.com/certificateauthority and sets `PRI_APPLE_ROOT_CA_PEM` (or `_FILE`), `PRI_APPLE_APP_ID`, `PRI_APPLE_BUNDLE_ID`, `PRI_APPLE_ENVIRONMENTS=Production`; leaves `PRI_APPLE_ALLOW_SANDBOX` unset in production | production boot no longer lists `PRI_APPLE_ROOT_CA_PEM or PRI_APPLE_ROOT_CA_FILE` / `PRI_APPLE_APP_ID` as missing (`platformConfigStatus`); `GET /v1/ready` → `billing` ready |
| 3 Server Notifications v2 URLs | `BLOCKED_EXTERNAL` | account holder registers `https://<origin>/v1/billing/webhook/apple` (production and sandbox) and presses *Request a Test Notification* | server log line for the test notification and its `billing_events` row (`server/tools/billing-reconcile.mjs --evidence`) |
| 4 Sandbox transactions on a physical iPad | `BLOCKED_EXTERNAL` | QA with a real iPad, a Sandbox Apple ID and a TestFlight build against a deployment with Sandbox explicitly allowed runs the eight scenarios listed above | per-scenario device result + `/v1/entitlements` snapshot + clean `node server/tools/billing-reconcile.mjs` exit 0, recorded in the release record (`ios/PriLearning.swiftpm/RELEASE.md` §11) |
| 5 Final production transaction | `BLOCKED_EXTERNAL` | release governor, after App Review approval, on a physical iPad | same record |
| 6 In-App Purchase key | `BLOCKED_EXTERNAL` | account holder keeps it outside the repository and the server | the reconciliation runbook's history call succeeds; the key appears nowhere in `npm run test:secrets` |
| 7 App Review and legal | `BLOCKED_EXTERNAL` | account holder submits; counsel signs off (`docs/legal/README.md` launch checklist) | App Store Connect review state in the release record |

The ordered owner path for all of these is `docs/release/LAUNCH-RUNBOOK.md` §5.
