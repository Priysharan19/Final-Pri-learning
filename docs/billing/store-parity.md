# Premium in both stores: products, test paths and what stays external

Scope: owner defaults D19 to D22 (`docs/release/V1_DECISIONS_2026-11-01.md`) and `PRI_V1_RELEASE_SCOPE.md` §22.4. Premium launches on iPhone, iPad and Android. StoreKit certification and Google Play Billing parity are both release blockers.

This page records what the software does in each store, how a tester exercises it, and what only the owner or a physical device can close. **Passing tests do not close either blocker.** Simulator, emulator and fixture results are synthetic evidence.

## Products

| | App Store (StoreKit 2) | Google Play Billing |
|---|---|---|
| Monthly | `com.prilearning.app.premium.monthly`, ₹199 | product `com.prilearning.app.premium.monthly`, base plan `monthly` (recommended), ₹199 |
| Yearly | `com.prilearning.app.premium.annual`, ₹1,499 | product `com.prilearning.app.premium.annual`, base plan `annual` (recommended), ₹1,499 |
| Group | subscription group "Pri Premium" (created 18 Oct 2026, **not priced**) | not created yet |
| Server variables | `PRI_APPLE_MONTHLY_PRODUCT_ID`, `PRI_APPLE_ANNUAL_PRODUCT_ID` | `PRI_GOOGLE_MONTHLY_PRODUCT_ID=com.prilearning.app.premium.monthly:monthly`, `PRI_GOOGLE_ANNUAL_PRODUCT_ID=com.prilearning.app.premium.annual:annual` (`productId:basePlanId`) |

The prices are the owner's (D19). The software never states them. The Premium screen (`client/src/paywall/`) shows the store's own `displayPrice` as the billed amount. It derives "about … a month" for the yearly plan, rounded up, only from the store's numeric price. It states a saving, rounded down, only when both real prices are known in one currency. `client/test/paywall-honesty-check.mjs` checks that no price is written into the source or the copy.

## What each store does, and where

| Step | Apple | Google |
|---|---|---|
| The account binding | `GET /v1/billing/apple/bootstrap` mints the `appAccountToken` | `GET /v1/billing/google/bootstrap` mints the opaque `obfuscatedAccountId` |
| Prices | StoreKit `Product.products`: `displayPrice`, `price`, `currencyCode`, `period` (`StoreKitBillingBridge.swift`) | `queryProductDetails` base plans: `displayPrice`, `priceMicros`, `currency`, `billingPeriod` (`PlayBilling.kt`) |
| Purchase | `product.purchase(options: [.appAccountToken])`, then the signed JWS goes to `POST /v1/billing/apple/transaction` | `launchBillingFlow` with `setObfuscatedAccountId`, then the token goes to `POST /v1/billing/google/purchase` |
| Who decides Premium | the server: Apple's chain, signature, bundle, product and token (`appleBilling.js`) | the server: re-fetched from the Play Developer API, with package, product, base plan and account id checked; **the server acknowledges** (`googleBilling.js`) |
| Finish / acknowledge | the device finishes **only after** the server accepts | the device never acknowledges or consumes |
| Restore | `AppStore.sync()`, then every current entitlement goes to the server, one by one | `queryPurchasesAsync(SUBS)`, then every token goes to `POST /v1/billing/restore/google` |
| Late and recovered purchases | `Transaction.updates` and the `Transaction.unfinished` sweep | `onPurchasesUpdated` and the unacknowledged sweep on load |
| Renewal, expiry, refund | App Store Server Notifications v2 (`/v1/billing/webhook/apple`) | Real-time developer notifications over Pub/Sub, verified as Google-signed OIDC (`/v1/billing/webhook/google`) |
| Where the student buys | the Premium screen (`/premium`) and Settings → account | the Premium screen (`/premium`) and Settings → account |
| Web | no purchase (out of V1). Premium bought in an app follows the account. | same |

What enforces Premium, and what is only local: `docs/security/PREMIUM_ENTITLEMENT_AUTHORITY.md`.

## Test paths (software, ready now)

These let a tester run real store purchases against a **staging** server. Production keeps every one of them off.

**Apple sandbox, on a TestFlight build**
1. Staging variables:
   - `PRI_APPLE_ENVIRONMENTS=Sandbox,Production`
   - `PRI_APPLE_ALLOW_SANDBOX=true`
   - Apple Root CA G3 in `PRI_APPLE_ROOT_CA_PEM` or `_FILE`
   - `PRI_APPLE_APP_ID`, `PRI_APPLE_BUNDLE_ID=com.prilearning.app`, and the two product ids
2. Register the sandbox notification URL `https://<staging origin>/v1/billing/webhook/apple` in App Store Connect.
3. On the device, a Sandbox Apple Account runs the scenarios in `storekit-certification.md` (purchase, renewal, cancellation, billing retry and grace, refund, upgrade and downgrade, restore after reinstall, account switch).
4. For each scenario record:
   - the device result;
   - `GET /v1/entitlements`;
   - a clean `node server/tools/billing-reconcile.mjs`.

**Google Play licence testers, on an internal-testing build**
1. Staging variables:
   - `PRI_GOOGLE_PACKAGE_NAME=com.prilearning.app`
   - the service account (`PRI_GOOGLE_SERVICE_ACCOUNT_JSON` or `_FILE`) with Play Console financial read access
   - the two product ids above
   - `PRI_GOOGLE_RTDN_AUDIENCE` and `PRI_GOOGLE_RTDN_SERVICE_ACCOUNT`
   - `PRI_GOOGLE_ALLOW_TEST_PURCHASES=true`. Without it, the server refuses a licence tester's purchase as `GOOGLE_TEST_PURCHASE_REJECTED`, which is also production's behaviour.
2. In Play Console:
   - add the testers' Google accounts under **License testing**;
   - create the two subscriptions and base plans;
   - point real-time developer notifications at the Pub/Sub push endpoint `https://<staging origin>/v1/billing/webhook/google`.
3. On a physical Android phone and tablet, a licence tester buys monthly, restores after reinstall, upgrades to yearly, cancels, and lets the accelerated test renewal lapse. For each step record:
   - the device result;
   - `GET /v1/entitlements`;
   - the purchase's acknowledgement state in Play Console.

Synthetic evidence that already runs in CI:
- `server/test/apple-billing-check.mjs`
- `server/test/storekit-entitlement-state-machine-check.mjs`
- `server/test/google-billing-check.mjs`
- `client/test/native-storekit-boundary-check.mjs`
- `client/test/storekit-entitlement-client-check.mjs`
- `client/test/paywall-honesty-check.mjs`
- `android/app/src/test/.../PlayBillingTest.kt`

None of it is store or device evidence.

## EXTERNAL: only people can close these

| Item | Who | Why software cannot |
|---|---|---|
| Paid Apps Agreement, tax and banking in App Store Connect; then the ₹199 / ₹1,499 price points | account holder | the products exist but cannot be priced until the agreement is active |
| Play Console: payments profile, the two subscriptions and base plans at ₹199 / ₹1,499, licence testers, the RTDN topic | account holder | Play Console authority |
| Production trust: Apple Root CA G3, `PRI_APPLE_APP_ID`, the Google service account, notification URLs | operator | production secrets and console access |
| A sandbox purchase on a physical iPhone and iPad (every scenario above) | QA with the devices | physical-device evidence |
| A licence-tester purchase on a physical Android phone and tablet | QA with the devices | physical-device evidence. Google's 14-day closed test with 12 testers is a separate gate (D1). |
| Final production transaction test on each store | release governor | after store approval |
| App Review and Play policy review of the subscription screens | account holder | store review |
