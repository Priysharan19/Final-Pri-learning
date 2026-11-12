# Billing provider per edition

Plan mission E5 (ADR-0002, `docs/architecture/regional-editions-plan.md`). One table decides which payment providers a deployment sells through: the `billing` block of its edition in `client/edition.config.mjs`. The server reads it through `server/platform/billingProviders.js`; the client build receives one constant derived from it.

| Edition | `billing.providers` | Currency | Premium on sale |
| --- | --- | --- | --- |
| Priyabhata (India) | `razorpay`, `apple`, `google` | INR | Yes, as before this mission |
| Prithagoras (Australia) | none | AUD | **No.** Owner decision O2 (provider, AUD prices, GST, in-app purchase arrangement) is open |

Provider ids and the route family each one owns:

| Provider id | Route family | Routes |
| --- | --- | --- |
| `razorpay` | `web` | `POST /v1/billing/checkout/web`, `POST /v1/billing/web/cancel`, `POST /v1/billing/restore/web`, `POST /v1/billing/webhook/web` |
| `apple` | `apple` | `GET /v1/billing/apple/bootstrap`, `POST /v1/billing/apple/transaction`, `POST /v1/billing/restore/apple`, `POST /v1/billing/webhook/apple` |
| `google` | `google` | `GET /v1/billing/google/bootstrap`, `POST /v1/billing/google/purchase`, `POST /v1/billing/restore/google`, `POST /v1/billing/webhook/google` |

## What a Priyabhata deployment does

What it did before. `GET /v1/billing/config` is byte for byte the reply `main` gave at `7452deada` for the same variables (`server/test/billing-edition-check.mjs` holds that reply as a literal, and its Priyabhata half passes unchanged against `main`'s own server code). The edition gate on each route is a pass-through. One new start-up rule applies: in production `PRI_DISPLAY_CURRENCY`, when set, must be `INR`.

## What a Prithagoras deployment does

- `GET /v1/billing/config` answers `available: false`, currency `AUD`, every price, trial and product id `null`, `webCheckout.provider: null`, whatever the deployment variables hold.
- Every route in the table above answers `404 BILLING_NOT_AVAILABLE_IN_EDITION` before a session is read, a rate-limit row is written or an adapter is reached.
- A payment event for an unlisted provider is refused the same way however well it is signed, and counted as `rejected` (never `failed`, so it cannot page an operator). An Australian server never applies an Indian payment.
- `GET /v1/billing/status` and `GET /v1/billing/manage` still answer. An entitlement the account already holds (an administrator's grant) is honoured; `manage` names no provider and offers nothing to cancel.
- In production the server refuses to start while a variable of an unlisted provider is set (`PRI_RAZORPAY_*`, `PRI_WEB_*_PRICE_ID`, `PRI_APPLE_*_PRODUCT_ID`, `PRI_GOOGLE_*_PRODUCT_ID`, `PRI_GOOGLE_SERVICE_ACCOUNT_*`, `PRI_GOOGLE_RTDN_*`) or `PRI_DISPLAY_CURRENCY` is not `AUD`. The message names the variable, never its value. Sign-in identifiers (`PRI_APPLE_CLIENT_IDS`, `PRI_GOOGLE_CLIENT_IDS`) are not payment variables.
- The client build is told Premium is not on sale (`__PRI_PREMIUM_ON_SALE__` is `false`). It selects no store, so no StoreKit or Google Play flow starts and no price is requested. The Premium screen and the account panel say "Premium is not on sale in the app yet. Everything in the free plan works as usual." and show no price, plan, purchase or restore control. Free allowances and Premium gating are unchanged: nothing is unlocked.

## Proof

| Claim | Suite |
| --- | --- |
| Both editions through the real router, same requests, same variables; signed Razorpay webhook refused with no row written; start-up refusals | `server/test/billing-edition-check.mjs` (SQLite and Postgres) |
| The table: both editions declare `billing`; unknown or repeated provider, wrong currency, missing block are problems | `client/test/edition-config-check.mjs` |
| No store, price or purchase control without a provider, in source | `client/test/paywall-honesty-check.mjs` §4b |
| A built Prithagoras client on a Prithagoras server, in a browser | `client/test/tour-paywall-edition.js` (synthetic shell; no device, store or provider involved) |

No Prithagoras payment has been taken, tested or simulated against a real provider, and no AUD price exists anywhere in the repository.

## When O2 is decided (plan H3)

1. Add the provider id to `BILLING_PROVIDERS` and to Prithagoras's `billing.providers` in `client/edition.config.mjs`.
2. Add its adapter (verifier, checkout, lifecycle) beside `razorpay.js` and its route family to `ROUTE_FAMILY_PROVIDER` and `PROVIDER_VARIABLES` in `server/platform/billingProviders.js`; mount it in `server/app.js`.
3. Add its product and price variables, and let `commercialConfig()` report them for that provider.
4. Give the Prithagoras web paywall its checkout (today the web screen has none in either edition) and, for store purchases, the Apple and Google products of a Prithagoras listing (owner decision O3).
5. Update the pinned Prithagoras replies in `server/test/billing-edition-check.mjs` and the tour.

Creating a provider account, registering webhooks at the provider and setting live credentials need the owner's explicit authority (`AGENTS.md`).
