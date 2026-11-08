# Production configuration manifest — V1

Status: **a manifest, not a record of what production holds.** Nothing in this file has been set on
the production Railway service or the production Supabase project, and no lane session reads or
changes them (`AGENTS.md`; owner default D27). Production still serves SQLite at `169bcdfe`. The
owner sets these values at the cutover window (`postgres-cutover.md` §4.6 step 6), then proves them
with the command in §2 and the human checks in §3, and records the result in §4.

Every value here is a variable **name** and, where it is not a secret, its value. A secret is named
and never given: it goes into Railway's variables and nowhere else (not this repository, a chat or
a ticket). Each decision (`D4`, `D12`, …) is the owner default of
`docs/release/V1_DECISIONS_2026-11-01.md`, provisional until the owner confirms it.

## 1. The settings

| # | Setting | Production value | Decision it implements | Read by | How it is verified | On main? |
|---|---|---|---|---|---|---|
| 1 | AI tutor off | `PRI_FEATURE_TUTOR` **unset** (anything but `1` is off); `PRI_TUTOR_*` unset; client builds made **without** `PRI_FEATURE_TUTOR=1` | D4 — the tutor stays off at launch | `server/platform/tutor.js` `tutorFeatureEnabled` (every `/v1/tutor/*` path is the platform 404 before any session lookup); `client/vite.config.js` (`__PRI_FEATURE_TUTOR__`, `features.json` `tutor`) | probes `tutor-dark` (`GET /v1/tutor/status` → 404 `NOT_FOUND`; a 401 means the route is mounted, so the tutor is on) and `web-build-tutor-off` (`/features.json` → `tutor: false`) | yes |
| 2 | Method marks off | `PRI_METHOD_MARKS` **unset** (or `off`); `PRI_METHOD_MARKS_EXAMINER_RESULT` **unset** | D12 — final-answer marks only until a signed examiner result (#499) exists | `server/platform/markingPolicy.js` (any value but `on` is final-answer only; in production `on` also needs the examiner-result variable) | no public request can see it: §3 check H2 | **no — lands with #739** (L1 train 2). Until #739 is in the candidate, production would mark with method marks: the candidate must contain #739 |
| 3 | Child-data erasure enforced | `PRI_CHILD_ERASURE=enforce` | D18 — under-18 accounts whose guardian never confirmed, or withdrew, are erased after 30 days (7-day restore grace); a guardian can request erasure without the child's login | `server/platform/childErasure.js` `childErasureMode` (anything but `enforce` only counts candidates; a guardian's own request is honoured either way) | §3 check H3 (operator `/v1/health`) | **no — lands with #736** (L2). Set it only after the owner confirms D18 and counsel sets the period (the code holds 30 days, `UNCONSENTED_CHILD_RETENTION_MS`) |
| 4 | Paid-call ceiling | `PRI_PAID_CALLS_PER_HOUR=120`, `PRI_PAID_CALLS_PER_DAY=300`, plus the owner's monthly limit on the OpenAI project that holds the production key (recommended **US$100 a month**, see note 4) | D21 — 120 an hour and 300 a day, and a hard monthly limit in the OpenAI console | `server/platform/spendCeiling.js` (required at boot whenever `PRI_HANDWRITING_API_KEY` is set; shared by handwriting, working and tutor calls) | probe `paid-ceiling-set` (`/v1/ready` `checks.paidCeiling.state = ok`: both set; not their values); §3 check H4 for the numbers and the console limit | yes |
| 5 | Parent report off | `PRI_PARENT_REPORT` **unset**; `PRI_PARENT_REPORT_EMAILS` **unset**; client builds **without** `PRI_FEATURE_PARENT_REPORT=1` | D22 — the parent report is finished in code and stays off until counsel reviews email about minors | `server/platform/parentReport.js` `parentReportEnabled` (off: `/v1/parent-report` is not mounted) | probe `parent-report-dark` (`GET /v1/parent-report` → 404; a 401 means it is mounted); §3 check H5 for the build flag | server switch: **lands with #743** (L6); the 404 already holds on main, where the route does not exist |
| 6 | Proxy hops | `PRI_TRUSTED_PROXY_HOPS=<the value staging proves PER-CLIENT>`. Today both environments use `1` (`production-cutover-checklist.md` §2), and staging measured **PER-EDGE-NODE** on 8 Nov 2026 (#738): every client routed through one Railway edge node shares one rate-limit bucket. Add 1 if a CDN (Cloudflare) is put in front of `app.prilearning.com` | #653 — the anonymous rate limits count the client, never a proxy, and a forged `X-Forwarded-For` never earns a fresh bucket | `server/platform/config.js` (`trust proxy`), `server/app.js` | `node tools/verify-deployment-proxy.mjs --origin https://app.prilearning.com` from a fixed address → `PROXY IDENTITY: PER-CLIENT` (tool and method: #738, `docs/operations/railway-proxy-identity.md`) | the tool lands with #738. **Open:** the owner measures staging first (#738's runbook); if no hop count gives `PER-CLIENT`, the fix is code (L2 + security), not this variable |
| 7 | Public origin | `PRI_PUBLIC_ORIGIN=https://app.prilearning.com`; native builds archive with `PRICloudOrigin=https://app.prilearning.com`. **The custom domain moves at promotion** (note 7): until GO it is attached to the staging service, so the build tested on devices is the build that ships; at promotion the owner moves it to the production `/v1` service (Railway-issued TLS) | D5 — `app.prilearning.com` for the app, `prilearning.com` (with `/support`) for the public site | `server/platform/security.js` `originGuard` (a browser write must carry exactly this `Origin`); `authDelivery.js` / `otpEmail.js` (links in emails); `config.js` (a clean HTTPS origin in production, or no boot) | `publicOrigin` check (the origin serves exactly the nominated release: `/v1/health` and `/release.json`); §3 check H7 for the email link host and the native archive | yes (the variable); the domain is an owner step |
| 8 | Apple billing | `PRI_APPLE_MONTHLY_PRODUCT_ID=com.prilearning.app.premium.monthly`, `PRI_APPLE_ANNUAL_PRODUCT_ID=com.prilearning.app.premium.annual`, `PRI_APPLE_APP_ID=<the numeric App Apple ID from App Store Connect → App Information>`, `PRI_APPLE_BUNDLE_ID=com.prilearning.app`, `PRI_APPLE_ROOT_CA_PEM=<Apple Root CA - G3, PEM>` (or `PRI_APPLE_ROOT_CA_FILE`), `PRI_APPLE_ENVIRONMENTS=Production`, `PRI_APPLE_ALLOW_SANDBOX` **unset** (see note 8); display: `PRI_DISPLAY_CURRENCY=INR`, `PRI_DISPLAY_MONTHLY_PRICE=199`, `PRI_DISPLAY_ANNUAL_PRICE=1499` | D19 prices (₹199 a month, ₹1,499 a year); `docs/billing/storekit-certification.md` §2 production trust | `server/platform/appleBilling.js`, `appleSignedData.js`, `config.js` `platformConfigStatus` (a product id without trust and App ID fails closed), `billing.js` `commercialConfig` | probes `apple-products` and `display-prices` (`/v1/billing/config`), `billing-provider-complete` (`/v1/ready` `checks.billing.state = ok`); §3 check H8 for the store side | yes (the variables). The products are created but **not priced**: pricing needs the Paid Apps Agreement (`BLOCKED_EXTERNAL`, owner) |
| 9 | Auth email sender | `PRI_AUTH_EMAIL_PROVIDER=resend`; `PRI_RESEND_API_KEY=<production key, sending access>`; `PRI_AUTH_EMAIL_FROM=Pri Learning <verify@mail.prilearning.com>`; `mail.prilearning.com` verified in Resend (its SPF and DKIM records in the `prilearning.com` DNS) | V1 hard blocker #13 (verification and reset email); the sending domain the privacy notices name (`docs/release/play-data-safety.md`) | `server/platform/authDelivery.js` (`probeAuthEmail`), `server/platform/readiness.js` | `--auth-email-proven` and probe `auth-email-sender` (`state ok`, `credential valid`, `sender` verified, or unknown for a sending-only key); §3 check H9 for the delivered message's From and DKIM domain | yes |
| 10 | Sign-in methods | no `PRI_SMS_PROVIDER`; `PRI_GOOGLE_WEB_CLIENT_ID`, `PRI_APPLE_WEB_CLIENT_ID`, `PRI_GOOGLE_CLIENT_IDS`, `PRI_APPLE_CLIENT_IDS` **unset** | D3 — email code and password at launch; Apple and Google later, together; SMS off | `server/platform/otp.js` (`GET /v1/account/otp/channels`), `server/platform/identities.js` (`GET /v1/account/identity/providers`) | probes `sign-in-channels` and `provider-sign-in-off` | yes |
| 11 | Staging test mailbox off | nothing to set. L2's test mailbox for the reserved `@e2e.prilearning.test` addresses turns itself on only where `RAILWAY_ENVIRONMENT_NAME` is `staging`; the production environment is named `production` | the Director's 9 Nov addition: the staging journeys' inbox never exists in production | L2's change (not yet on `main`) | probe `test-mailbox-off` (`/v1/ready` `checks.testMailbox.state = off`). Until L2's change lands the field is absent and the probe accepts that (`orAbsent`); once it exists, anything but `off` fails | **no — lands with L2's test-mailbox PR** |

### Notes

4. **The monthly OpenAI limit (D21).** The server ceiling already bounds a month: 300 calls a day ×
   31 days = 9,300 calls, which is US$88.35 at the most expensive call observed (US$0.0095,
   `docs/operations/recognition-cost.md` §4) and US$46.50 at the mean (US$0.0050). Both figures are
   MODELLED from a measured sample, not an invoice. A limit of **US$100 a month** therefore never
   stops correct operation and still bounds a leaked key or a mis-set ceiling. The owner sets it on
   the OpenAI project that holds the production key, then records whether the console **refuses**
   requests at the limit or only notifies: if it only notifies, the server ceiling is the only hard
   stop, and §4 says so.
7. **One address, two services in turn.** The Director's plan (owner checklist item 2) attaches
   `app.prilearning.com` to the **staging** service until GO, with staging's `PRI_PUBLIC_ORIGIN` set to
   it, because every native build talks to that one address. At promotion, in this order: move the
   custom domain from staging to production; set production's `PRI_PUBLIC_ORIGIN` to it; set staging's
   `PRI_PUBLIC_ORIGIN` back to staging's own Railway origin (otherwise `originGuard` refuses every
   browser write on staging, whose pages no longer come from that origin). **§2 cannot tell which
   Railway service answers `app.prilearning.com`** when staging and production serve the same SHA —
   no public response names its service, by design — so H7 includes reading the Railway domain lists.
8. **App Review buys in Apple's sandbox.** A reviewer testing the Premium purchase uses a sandbox
   account against the build under review, which talks to the production server. With
   `PRI_APPLE_ENVIRONMENTS=Production` and `PRI_APPLE_ALLOW_SANDBOX` unset (the value
   `docs/billing/storekit-certification.md` and `LAUNCH-RUNBOOK.md` 5.2 set), `appleBilling.js`
   refuses that sandbox-signed transaction, so the reviewer's purchase cannot unlock Premium.
   **Owner decision, recorded in §4 before the first submission:** either (a) for the review window
   only, set `PRI_APPLE_ALLOW_SANDBOX=true` and `PRI_APPLE_ENVIRONMENTS=Production,Sandbox`, then
   remove both once the build is approved (during that window a TestFlight tester's free sandbox
   purchase also unlocks Premium on production), or (b) keep refusing sandbox and accept that review
   may fail on the purchase. L9's recommendation is (a), because (b) risks a rejection on the one
   flow a reviewer is sure to try. Whichever is chosen, the `apple-products` probes are the same.

## 2. The machine check

The values are set on Railway with part B of `docs/release/OWNER-CLICK-LIST-APPLE-RAILWAY.md`, which
also holds the App Store Connect steps for row 8. Then, from a checkout at the nominated SHA:

```bash
npm run verify:deployment -- --origin https://app.prilearning.com --sha <40-hex SHA> \
  --engine postgres --auth-email-proven \
  --require-handwriting --expect-config docs/operations/production-config-v1.md
```

`--require-handwriting` requires `/v1/ready` `checks.handwriting.state = ok` (a `probing` answer is
read again, three times at most). `--expect-config` reads the block below and checks every probe
with one more unauthenticated GET each (never a write, never a credential), plus the public origin.
Both flags are opt-in: without them `verify-deployment` sends its three GETs and prints the same
14 rows as always (`tools/verify-deployment.test.mjs` pins that byte for byte).

Expected result: `DEPLOYMENT VERIFIED: PASS — 27/27` (the 14 standard rows, the handwriting row, the
eleven probes and the public origin). Against **staging** the same command is a rehearsal and some rows
differ on purpose (a staging build made with the tutor on, staging's billing products): read each
failed row rather than counting.

The block between the markers is the manifest's machine-readable half. It holds only what an
anonymous caller can already see; a change to a value above changes it here in the same commit.
A value is matched exactly, or with `{ "oneOf": [...] }`; `"orAbsent": true` beside `oneOf` also
accepts a field that does not exist yet (row 11, before L2's change), and still refuses any other
value once it does.

<!-- pri-expected-public-config:start -->
```json
{
  "format": "pri-expected-public-config",
  "version": 1,
  "environment": "production",
  "publicOrigin": "https://app.prilearning.com",
  "probes": [
    { "id": "tutor-dark", "decision": "D4 AI tutor off (server)", "path": "/v1/tutor/status", "status": 404, "json": { "error.code": "NOT_FOUND" } },
    { "id": "web-build-tutor-off", "decision": "D4 AI tutor off (web build)", "path": "/features.json", "status": 200, "json": { "tutor": false } },
    { "id": "parent-report-dark", "decision": "D22 parent report off", "path": "/v1/parent-report", "status": 404 },
    { "id": "paid-ceiling-set", "decision": "D21 paid-call ceiling configured", "path": "/v1/ready", "json": { "checks.paidCeiling.state": "ok" } },
    { "id": "apple-products", "decision": "Apple billing product ids", "path": "/v1/billing/config", "status": 200, "json": { "products.appleMonthly": "com.prilearning.app.premium.monthly", "products.appleAnnual": "com.prilearning.app.premium.annual" } },
    { "id": "display-prices", "decision": "D19 display prices", "path": "/v1/billing/config", "status": 200, "json": { "display.currency": "INR", "display.monthly": 199, "display.annual": 1499 } },
    { "id": "billing-provider-complete", "decision": "Apple billing trust and App ID", "path": "/v1/ready", "json": { "checks.billing.state": "ok" } },
    { "id": "auth-email-sender", "decision": "auth email sender domain", "path": "/v1/ready", "json": { "checks.authEmail.state": "ok", "checks.authEmail.credential": "valid", "checks.authEmail.sender": { "oneOf": ["verified", "unknown"] } } },
    { "id": "sign-in-channels", "decision": "D3 email code on, SMS off", "path": "/v1/account/otp/channels", "status": 200, "json": { "channels.email": true, "channels.sms": false } },
    { "id": "provider-sign-in-off", "decision": "D3 Apple and Google sign-in later", "path": "/v1/account/identity/providers", "status": 200, "json": { "providers.google": null, "providers.apple": null } },
    { "id": "test-mailbox-off", "decision": "staging-only test mailbox off", "path": "/v1/ready", "json": { "checks.testMailbox.state": { "oneOf": ["off"], "orAbsent": true } } }
  ]
}
```
<!-- pri-expected-public-config:end -->

### Rehearsal on staging, 9 Nov 2026 (read-only GETs)

`node tools/verify-deployment.mjs --origin https://pri-learning-staging-staging.up.railway.app --sha 1d3829103eccaf470621de7124ec1755370c460e --engine postgres --auth-email-proven --require-handwriting --expect-config docs/operations/production-config-v1.md`
→ `DEPLOYMENT VERIFIED: FAIL — 21/26`. The 14 standard rows and the handwriting row pass, and so do
`tutor-dark`, `web-build-tutor-off`, `parent-report-dark`, `paid-ceiling-set`, `auth-email-sender`
(sender `unknown`: a sending-only key) and `sign-in-channels`. The five failures are staging facts,
not tool faults, and each is a production step to get right:

| Row | Staging answered | What production needs |
|---|---|---|
| `apple-products` | both product ids `null` | the Apple variables of row 8 |
| `display-prices` | both prices `null` | `PRI_DISPLAY_MONTHLY_PRICE=199`, `PRI_DISPLAY_ANNUAL_PRICE=1499` |
| `billing-provider-complete` | `not_configured` | Apple trust and App ID with the products (row 8) |
| `provider-sign-in-off` | a Google web client id is set on staging | none on production (D3): do not copy staging's Google sign-in variables |
| public origin | `fetch failed`: `app.prilearning.com` does not answer yet | the custom domain (owner checklist item 2, note 7) |

**Again on `63deeb757`, later on 9 Nov, with row 11's probe added: `FAIL — 23/27`.** `app.prilearning.com`
now answers with staging's release (the domain is attached to staging, as note 7 plans), so the
public-origin row passes, as does `test-mailbox-off` (the field does not exist yet). The four billing
and sign-in rows above still fail, for the same staging reasons.

## 3. The human checks (what no public request can see)

Variable checks read **names and non-secret values only**, in Railway → production → `/v1` service →
Variables (or `railway variables --service <production service>` by the owner). Never paste a secret
into a record.

| Check | Row | What the owner does | Pass when |
|---|---|---|---|
| H2 | 2 | Confirm neither `PRI_METHOD_MARKS` nor `PRI_METHOD_MARKS_EXAMINER_RESULT` exists on the service | both absent (or `PRI_METHOD_MARKS=off`), and the candidate SHA contains #739 |
| H3 | 3 | `curl -s -H "Authorization: Bearer $PRI_METRICS_TOKEN" https://app.prilearning.com/v1/health \| jq .housekeeping.lastRun.childErasure` after the first housekeeping pass (at boot, then every 6 h) | `mode` is `"enforce"`; `eraseFailed` and `scheduleFailed` are 0 |
| H4 | 4 | Read `PRI_PAID_CALLS_PER_HOUR` and `PRI_PAID_CALLS_PER_DAY`; open the OpenAI project of the production key → limits | `120` and `300`; the monthly limit is set and §4 records whether it refuses or only notifies |
| H5 | 5 | Confirm `PRI_PARENT_REPORT` and `PRI_PARENT_REPORT_EMAILS` are absent; after #743, `curl -s https://app.prilearning.com/features.json` | both absent; `parentReport` is `false` |
| H6 | 6 | Run `tools/verify-deployment-proxy.mjs` (#738) from a fixed address | `PROXY IDENTITY: PER-CLIENT` |
| H7 | 7 | Railway → production `/v1` service → Settings → Networking lists `app.prilearning.com`, and the staging service no longer does (note 7); register one owner-controlled address on production (`postgres-cutover.md` §4.6 step 8), then delete it; run `node scripts/check-native-archive.mjs <archive> --sha <SHA> --probe` on the iOS archive | the domain is on production only; the verification link starts `https://app.prilearning.com/`; the archive gate passes with `PRICloudOrigin` = `https://app.prilearning.com` |
| H8 | 8 | App Store Connect: both products priced at ₹199 / ₹1,499 in India; App Store Server Notifications v2 production and sandbox URLs `https://app.prilearning.com/v1/billing/webhook/apple`, then *Request a Test Notification* (`docs/billing/storekit-certification.md` step 3); note 8 decided | test notification logged and stored; the note 8 choice recorded below |
| H9 | 9 | In the smoke registration's email (H7), read the From header and the DKIM signature's `d=` | From `verify@mail.prilearning.com`; DKIM passes for `mail.prilearning.com` (`tools/acceptance/auth-email.mjs` checks the From with `PRI_ACCEPT_EXPECT_SENDER`) |

## 4. Record (filled by the owner at the cutover window)

| Item | Value or result | By | When (UTC) | Evidence |
|---|---|---|---|---|
| Release SHA verified | | | | |
| §2 `verify:deployment … --expect-config` | `DEPLOYMENT VERIFIED: PASS — n/n` | | | |
| H2 method marks | | | | |
| H3 child erasure mode | | | | |
| H4 ceilings and OpenAI monthly limit (refuses / notifies only) | | | | |
| H5 parent report | | | | |
| H6 proxy identity | | | | |
| H7 email link host and native archive | | | | |
| H8 App Store products, notifications, note 8 decision | | | | |
| H9 sender From and DKIM | | | | |

An agent never fills this table: every row is a person's observation of production.
