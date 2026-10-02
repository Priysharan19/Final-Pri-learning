# App Store billing reconciliation

Owner: platform (route owner of `server/platform/appleBilling.js`). Reviewers: security, reliability, qa-release.

This runbook covers how to check that one account's Premium entitlement still matches what Apple signed, and how to repair it when it does not. It belongs to §19 "Payments and entitlements" (V1 hard blocker #7, code side). What is proven in code and what is still blocked on external work is listed in [`docs/billing/storekit-certification.md`](../billing/storekit-certification.md).

## What the server keeps

| Store | Contents | Written by |
|---|---|---|
| `billing_apple_signed_events` | Every Apple-signed JWS the server verified, stored verbatim. That covers device transactions (purchase, restore, `Transaction.updates`) and App Store Server Notifications v2. `account_id` is NULL when a notification named no Pri account. | `server/platform/appleBilling.js` |
| `billing_events` | One audit row per applied event (`provider`, `event_id`, `event_type`, `verified=1`, `applied_at`, payload digest). The same row is what makes a second delivery a no-op. | `applyVerifiedEntitlement` |
| `billing_subscriptions` | The binding from `originalTransactionId` to an account, the ordering clock (`last_effective_at`, `last_event_rank`), and the lifecycle that subscription last applied (`state_plan`, `state_status`, `state_period_end`, `state_grace_until`). | `applyVerifiedEntitlement` |
| `entitlement_support_grants` | One row per audited support grant (period end, product). A grant is its own entitlement source, so no billing event can erase it. | `applyVerifiedEntitlement` (provider `admin`) |
| `entitlement_snapshots` | The account's current entitlement: the paid source with the latest end across every subscription and support grant the account holds. | `applyVerifiedEntitlement` |

Nothing in these tables holds a card number, an Apple ID or an email address. The signed transactions do carry the opaque `appAccountToken`, the storefront, and the price and currency. All four tables are deleted with the account (`ON DELETE CASCADE`).

## The reconciliation tool

```bash
# SQLite deployment
PRI_PLATFORM_DB=/data/pri-learning-platform.db node server/tools/billing-reconcile.mjs --account <account id>
# Supabase Postgres
PRI_DATABASE_URL=postgres://… node server/tools/billing-reconcile.mjs --account <account id>
# also list notifications that named no account
… --unbound
# include signed data the owner fetched from Apple (see below)
… --evidence apple-history.json
```

The tool only reads. It never writes to the database and never contacts Apple. It must run with the same Apple trust configuration as the server (`PRI_APPLE_ROOT_CA_PEM` or `PRI_APPLE_ROOT_CA_FILE`, `PRI_APPLE_BUNDLE_ID`, `PRI_APPLE_APP_ID`, the product ids and the environment settings), because every stored JWS is verified again rather than trusted.

For the account, the tool:

1. Verifies every stored signed record again: certificate chain to the configured root, Apple purpose OIDs, ES256 signature, bundle id, App Apple ID and environment.
2. Interprets each record with the same functions the live webhook and device paths use (`appleEventFromSigned`).
3. Replays each subscription's events under the live ordering rules:
   - a newer Apple `signedDate` wins;
   - when two events have the same `signedDate`, the higher rank wins (refund/revoke > expiry > billing failure > renewal);
   - an advisory event (a transaction whose own period has passed, or that an upgrade superseded) never ends a lifecycle that is still paid, and never moves the ordering clock.
4. Derives the account entitlement from the replayed subscriptions. Stored web/Google subscriptions and support grants (`entitlement_support_grants`; a grant made before billing schema v5 exists only in the snapshot) are taken as they are.
5. Compares the result with what is stored and prints a JSON report.

Exit status: `0` means no drift, `2` means drift was found, `1` means the tool could not run (unknown account, unreadable database or bad trust configuration).

### Findings

| `kind` | Severity | Meaning | Action |
|---|---|---|---|
| `entitlement-plan` | critical | The stored entitlement (premium or free) differs from what the signed evidence implies. | Repair (below). If `expected` is `premium`, a paying student is locked out: treat as P1. |
| `signature-invalid` | critical | A stored payload no longer verifies. Either the row was edited or the trust configuration changed. | Check `PRI_APPLE_ROOT_CA_*` first. If that is correct, the row was tampered with: incident. |
| `ledger-mismatch` | critical | A ledger row's `original_transaction_id` does not match its signed payload. | Tampering or a bug: incident. |
| `no-signed-evidence` | critical if the stored state is paid, otherwise info | A bound subscription has no stored signed data. For example, it was bound before billing schema v5. | Fetch history (below) and run with `--evidence`. |
| `subscription-state` | warning | The subscription's stored lifecycle differs from its replayed one. | Repair (below). |
| `missing-subscription-binding` | warning | Signed data for this account names a subscription with no binding row. | Investigate. Binding happens in the same transaction as the ledger write. |
| `unbound-notification-for-account` | warning | Apple sent a notification about one of this account's subscriptions while no account was bound to it. | Usually resolved once the device submits the transaction. Repair if the entitlement is wrong. |
| `evidence-not-stored` | warning | Apple has signed data (from `--evidence`) for this account that the server never applied. Usually a lost webhook. | Repair (below). |
| `evidence-invalid` | warning | A supplied evidence item did not verify. The tool ignored it. | Check that the file came from the production App Store Server API. |
| `evidence-other-account` | info | Supplied evidence belongs to a different account (different `appAccountToken`, not bound here). The tool ignored it. | None. This is the account-isolation rule working. |

## Fetching Apple's history (owner-run, production only)

The tool never calls Apple. The App Store Connect owner fetches the history and hands the file to the operator. The calls use the App Store Server API. Each request is authenticated with a JWT that the owner signs with the App Store Connect **In-App Purchase key** (ES256, header `kid` = key id; claims `iss` = issuer id, `aud` = `appstoreconnect-v1`, `bid` = the bundle id, `iat`/`exp` at most 60 minutes apart). That key is a production secret. It never goes into this repository, the server environment, or a test.

- **Get Transaction History**: `GET https://api.storekit.itunes.apple.com/inApps/v2/history/{transactionId}` (Sandbox: `api.storekit-sandbox.itunes.apple.com`). Use any `transactionId` or the `originalTransactionId` from the report. Page through with the `revision` value until `hasMore` is false, and collect every `signedTransactions` entry.
- **Get Notification History**: `POST https://api.storekit.itunes.apple.com/inApps/v1/notifications/history` with `startDate`/`endDate` (at most 180 days back) and `originalTransactionId`. Page with `paginationToken` and collect each `notificationHistory[].signedPayload`.
- **Get All Subscription Statuses** (`GET /inApps/v1/subscriptions/{transactionId}`) is useful for a person to read. It is not needed by the tool.

Apple's own `app-store-server-library` (Node, Swift, Java or Python) wraps these calls. Save the output as:

```json
{ "signedTransactions": ["eyJ…", "…"], "signedPayloads": ["eyJ…", "…"] }
```

Then run `billing-reconcile.mjs --account <id> --evidence apple-history.json`. The report now includes Apple's evidence and shows the entitlement it implies. Nothing has been applied yet.

## Repairing drift

Repairs always go through the verified path. **Never edit `entitlement_snapshots` or `billing_subscriptions` by hand.** A hand edit is exactly what this tool reports as drift.

1. **A missed or lost notification.** POST each `signedPayload` from Get Notification History to the production webhook, exactly as Apple would:
   `curl -X POST https://<api>/v1/billing/webhook/apple -H 'Content-Type: application/json' -d '{"signedPayload":"eyJ…"}'`.
   The server verifies Apple's signature again, de-duplicates by `notificationUUID`, applies the ordering rules, and writes the audit and ledger rows. Replaying something already applied changes nothing.
2. **A purchase the device never reported.** Ask the student to open Settings → Cloud account → Restore purchases on the iPad, signed in to the right Pri account. The iPad runs `AppStore.sync()` and submits each Apple-signed transaction to `/v1/billing/apple/transaction`. A transaction bound to a different Pri account is refused there and does not stop the rest.
3. **Another account holds the subscription** (`BILLING_ACCOUNT_MISMATCH`). Apple bound the purchase to the first account's `appAccountToken`. Moving it to another account is a support decision with a human in the loop. Record it in the audit log. Do not script it.
4. **Goodwill access.** Use the audited support grant (`POST /v1/entitlements/admin/grant`). It is recorded as provider `admin` and is never mistaken for an App Store purchase.

Run the tool again after a repair. It should exit `0`.

## Notifications for no account

A notification that names no Pri account is acknowledged with HTTP 200 and changes no entitlement. Examples: no `appAccountToken` (an offer code redeemed in the App Store app), or a token whose account was deleted. The notification is stored with `account_id` NULL. Refusing it would only make Apple redeliver it for days. List these with `--unbound` (any account id works for the listing). They are expected after account deletion. Investigate them if they name a live subscription.
