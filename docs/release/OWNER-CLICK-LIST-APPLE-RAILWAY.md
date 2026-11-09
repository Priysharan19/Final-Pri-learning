# Owner click-list: Apple's paid apps and the production settings on Railway

Two jobs only the owner can do, written as clicks. Part A is the App Store Connect side of selling
Premium (the Paid Apps Agreement, tax, banking and the two subscriptions). Part B sets the
production values of `docs/operations/production-config-v1.md` on Railway at the promotion.

This page names the **fields** you fill. It never suggests what goes in them: bank details, tax
identifiers and secrets are yours alone. Do not paste any of them into a chat, an issue or this
repository. App Store Connect and Railway rename their menus from time to time; the field names
are what count.

## A. App Store Connect (the Account Holder; about 30 minutes, then Apple's processing)

Only the **Account Holder** of the Apple Developer account can accept the Paid Apps Agreement. Until
it is active, the products cannot be priced, nothing can be sold, and the device script's sandbox
purchase step stays BLOCKED (`docs/release/OWNER-DEVICE-SCRIPT.md` A18).

| # | Where | What you enter | Done when |
|---|---|---|---|
| A1 | App Store Connect → **Business** (formerly "Agreements, Tax, and Banking") → **Paid Apps** → *View and Agree to Terms* | nothing: you read and accept the terms | the agreement shows as pending your information |
| A2 | Business → **Bank Accounts** → *Add Bank Account* | the bank's country or region, the account holder's name exactly as the bank holds it, the bank's code for that country (in India, the IFSC), the account number, and the payout currency | the account is listed against the Paid Apps agreement |
| A3 | Business → **Tax Forms** | the forms Apple's questionnaire asks for (for a non-US seller, a U.S. tax form, W-8BEN for an individual or W-8BEN-E for an entity, with your own tax identifier as it asks). Which entity sells V1 is still a question for counsel (`V1_DECISIONS_2026-11-01.md`, "Only people can close these") | each form shows as submitted |
| A4 | Business → **Contacts** | the senior management, finance, technical, legal and marketing contacts the agreement asks for | every required contact is filled |
| A5 | Business → Paid Apps | nothing: wait | status **Active** (Apple's review of A2–A4 can take a day or more) |
| A6 | Apps → **Pri Learning** → Monetization → **Subscriptions** → group "Pri Premium" → `com.prilearning.app.premium.monthly`, then `com.prilearning.app.premium.annual` | for each: the price (D19: ₹199 a month and ₹1,499 a year), availability (India only, D2), the English display name and description, and the review screenshot and notes | each product shows *Ready to Submit* |
| A7 | Apps → Pri Learning → **App Information** → General | nothing: copy the **Apple ID** (a number) | you have the number for `PRI_APPLE_APP_ID` (B2) |
| A8 | App Information → **App Store Server Notifications** | Production Server URL and Sandbox Server URL, both `https://app.prilearning.com/v1/billing/webhook/apple`, version 2; then *Request a Test Notification* once production serves the release | the test notification is in the server log (`production-config-v1.md` H8) |
| A9 | (only for the reconciliation history calls) Users and Access → **Integrations** → In-App Purchase → generate a key | nothing beyond the key's name; keep the downloaded key outside the repository and the server (`docs/billing/storekit-certification.md` step 6) | the key is in your own safe place |

Before the first submission, also make the App Review sandbox decision
(`production-config-v1.md` note 8).

## B. Railway at the promotion (the owner; about 10 minutes, inside the cutover window)

The order follows `docs/operations/postgres-cutover.md` §5.5 stage 4: the production variables
deploy **with or after** the fast-forward of `deploy/production`, never before.

**B1 — before the window: what must not be on production.** Open Railway → project
`profound-spontaneity` → environment `production` → service `Final-Pri-learning` → **Variables**.
Delete every one of these that is present:
every `PRI_TUTOR_*` except the two allowances in B2, `PRI_FEATURE_LINE_CHECK`, `PRI_METHOD_MARKS`,
`PRI_METHOD_MARKS_EXAMINER_RESULT`, `PRI_PARENT_REPORT_EMAILS`, `PRI_SMS_PROVIDER`, `PRI_GOOGLE_CLIENT_IDS`,
`PRI_GOOGLE_WEB_CLIENT_ID`, `PRI_APPLE_CLIENT_IDS`, `PRI_APPLE_WEB_CLIENT_ID`, and the stale manual
release identity `PRI_RELEASE_SHA` and `PRI_BUILD_TIMESTAMP` (`production-cutover-checklist.md`).
`PRI_APPLE_ALLOW_SANDBOX` is deleted too, unless note 8 chose option (a) for the review window.
Keep `PRI_PLATFORM_DB` until the owner closes the rollback window (§5.5).

**B2 — the values.** Variables → **Raw Editor**. Paste this block. Then replace each `<…>` in the
editor itself from your own records, and do not deploy yet. Set the two certificate variables
(`PRI_APPLE_ROOT_CA_PEM`, `PRI_DATABASE_SSL_ROOT_CERT`) with *New Variable*, not the Raw Editor:
each value is several lines long.

```dotenv
NODE_ENV=production
PRI_PUBLIC_ORIGIN=https://app.prilearning.com
PRI_TRUSTED_PROXY_HOPS=<the value staging proved PER-CLIENT (#653)>
PRI_PAID_CALLS_PER_HOUR=120
PRI_PAID_CALLS_PER_DAY=300
PRI_FEATURE_TUTOR=1
PRI_TUTOR_CALLS_PER_ACCOUNT_DAY=40
PRI_TUTOR_CALLS_PER_ACCOUNT_DAY_PREMIUM=120
PRI_PAST_PAPERS=1
PRI_PARENT_REPORT=on
PRI_AUTH_EMAIL_PROVIDER=resend
PRI_AUTH_EMAIL_FROM=Pri Learning <verify@mail.prilearning.com>
PRI_RESEND_API_KEY=<the production Resend key>
PRI_APPLE_MONTHLY_PRODUCT_ID=com.prilearning.app.premium.monthly
PRI_APPLE_ANNUAL_PRODUCT_ID=com.prilearning.app.premium.annual
PRI_APPLE_APP_ID=<the Apple ID from A7>
PRI_APPLE_BUNDLE_ID=com.prilearning.app
PRI_APPLE_ENVIRONMENTS=Production
PRI_DISPLAY_CURRENCY=INR
PRI_DISPLAY_MONTHLY_PRICE=199
PRI_DISPLAY_ANNUAL_PRICE=1499
PRI_ALERT_EMAIL=<the address that receives alerts>
PRI_ALERT_ENVIRONMENT=production
PRI_METRICS_TOKEN=<a new token, never staging's>
PRI_DATABASE_URL=<the session pooler URL for pri_app_production, sslmode=verify-full>
```

Add `PRI_CHILD_ERASURE=enforce` as well, but only if the release contains #736 and you have
confirmed D18 with counsel's period. The other production variables stay as
`npm run preflight` lists them (`PRI_CSRF_SECRET`, `PRI_AUTH_DELIVERY_KEY`, `PRI_MFA_KEY`, the
handwriting key and the rest). The staging test mailbox needs nothing here: it turns itself on only
in the environment named `staging`.

The tutor, past papers and the parent report are on at GO (owner decision, 10 Nov 2026), so the
web and iOS builds that ship must also be made with `PRI_FEATURE_TUTOR=1`,
`PRI_FEATURE_PAST_PAPERS=1` and `PRI_FEATURE_PARENT_REPORT=1`. `PRI_PARENT_REPORT_EMAILS` and
`PRI_FEATURE_LINE_CHECK` stay unset. In the OpenAI project of the production key, set the
US$100 monthly limit and an email alert at 80% (US$80) (`production-config-v1.md` note 4).

**B3 — the domain.** On the **staging** service, open Settings → Networking and remove
`app.prilearning.com`. On the **production** service, open Settings → Networking → *Custom Domain*
and add `app.prilearning.com`. If Railway shows a new DNS target, change the record at your
registrar, then wait for the certificate. Finally, set staging's `PRI_PUBLIC_ORIGIN` back to its
own Railway address (`production-config-v1.md` note 7).

**B4 — deploy.** Run the fast-forward that `release-nominate` printed. Railway then deploys the
release with the staged variables. If the push does not start a deployment (as on 19 Oct), open
Deployments and deploy that exact commit yourself.

**B5 — prove it.** Run `production-config-v1.md` §2, which must print
`DEPLOYMENT VERIFIED: PASS — 30/30`, then do its human checks H1–H13 and fill its §4.
