# One-time-code sign-in and a parent's approval

What shipped, how to switch it on in Railway, and what only the owner can do.

## What it does

- **Sign up / sign in with a 6-digit code** sent by SMS (+91 by default) or email. Same endpoint for both; an address with an account signs in, a new one signs up. `server/platform/otp.js`, `server/platform/otpCore.js`.
- **Google / Apple** stay as in PR #296; the onboarding flow calls them with `guardianLater: true` so a child's parent is asked on the next screen.
- **A parent's approval** (DPDP Act, under 18): the student enters the parent's phone or email; the parent gets a code, reads the notice on the student's screen, ticks agreement and enters the code. Email parents also get the existing confirm/withdraw link. Until approval the account is limited: every gated `/v1` route (sync, classes, handwriting, tutor, billing, reports, working) answers `GUARDIAN_CONSENT_PENDING`; practice and marking on the device keep working.
- **Withdrawal**: the parent screen in the app (`I'm a parent` → Withdraw consent) sends a code to the approving phone; entering it withdraws every consent that phone gave and sync stops at once. Email parents keep the withdraw link.
- **Account deletion** for a passwordless (code-only) account requires a fresh code sent to the account's own phone/email.

What the recorded method means, stated plainly (as `guardianConsent.js` does for email): `guardian-phone-otp` records that someone holding that phone entered a code on the student's device after the notice was shown. It does not prove the person is an adult or this child's parent. It is not DigiLocker-grade verifiable parental consent, which Rule 10 will require from 14 May 2027.

## Security properties (tested in `server/test/otp-lifecycle-check.mjs`)

| Property | How |
| --- | --- |
| Code never stored | HMAC-SHA256 of `challengeId:code` under a key derived from `PRI_AUTH_DELIVERY_KEY` |
| Address never stored for codes | HMAC of the destination; the client re-sends it to verify |
| 10-minute expiry, single use | conditional `UPDATE … WHERE consumed_at IS NULL` |
| 5 attempts, race-safe | attempt counted atomically before the compare |
| Constant-time compare | `crypto.timingSafeEqual` |
| No enumeration | `/otp/request` and `/guardian/withdraw-request` answer identically for known and unknown addresses |
| Rate limits | per IP (20/h request, 30/15 min verify), per destination (30 s cooldown, 5 codes/h) |
| Test adapter cannot reach production | `PRI_SMS_PROVIDER=test` / `PRI_AUTH_EMAIL_PROVIDER=test` throw at boot when `NODE_ENV=production` unless `PRI_SMS_TEST_MODE_ALLOW_STAGING=1` |

## Railway environment variables (server service only — never the client)

| Variable | Required | Notes |
| --- | --- | --- |
| `PRI_SMS_PROVIDER` | for phone codes | `msg91` (recommended for India), `twilio`, or `test` (staging only). Unset: phone codes answer 503 `OTP_SMS_NOT_CONFIGURED`; email still works. |
| `PRI_MSG91_AUTH_KEY` | msg91 | MSG91 → API → Auth key |
| `PRI_MSG91_OTP_TEMPLATE_ID` | msg91 | Flow/template id of the DLT-approved sign-in template |
| `PRI_MSG91_GUARDIAN_TEMPLATE_ID` | msg91, optional | DLT template for the parent message; falls back to the sign-in template |
| `PRI_TWILIO_ACCOUNT_SID` | twilio | `AC…` |
| `PRI_TWILIO_AUTH_TOKEN` | twilio | |
| `PRI_TWILIO_VERIFY_SERVICE_SID` | twilio | `VA…` (Verify service) |
| `PRI_SMS_TEST_MODE_ALLOW_STAGING` | staging only | `1` lets the test adapters run on a production-mode staging deploy. **Never set on production.** |
| `PRI_AUTH_EMAIL_PROVIDER`, `PRI_RESEND_API_KEY`, `PRI_AUTH_EMAIL_FROM` | already set | Email codes reuse the existing Resend configuration. |
| `PRI_AUTH_DELIVERY_KEY` | already set | Codes and destinations are HMAC'd under a key derived from it; no new secret. |
| `PRI_PUBLIC_ORIGIN` | already set | Its host goes into the WebOTP line of every SMS. |

## Database

`supabase/migrations/20261006000000_otp_sign_in.sql` — additive only (two new tables, one nullable column), RLS on, `pri_server` only, `schema_version` → 9. Apply it to Supabase before deploying this server build; the server refuses to boot against schema 8 (`PLATFORM_DB_SCHEMA_MISMATCH`).

## Owner steps (real-world, cannot be done from the repo)

### Option A — MSG91 (India, DLT)

1. **DLT registration** (TRAI requires it for every commercial SMS to Indian numbers): register Pri Learning as a Principal Entity on a DLT portal (Jio TrueConnect, Vodafone Idea Vilpower, Airtel, or BSNL). Needs the business PAN/GST and a letter of authorisation. Takes ~2–7 working days.
2. Register a **sender ID / header** (6 letters, e.g. `PRILRN`) on the DLT portal.
3. Register **content templates** (category: *Service Implicit* / OTP). Templates must match the text the app sends, with the variable as `{#var#}`, and **end with the WebOTP line** so Android can autofill:
   - Sign-in: `{#var#} is your Pri Learning code. Valid 10 minutes. Do not share it.` followed by a blank line and `@<your PRI_PUBLIC_ORIGIN host> #{#var#}`
   - Parent: `{#var#} is the code to approve your child's Pri Learning account. Read what you are agreeing to on their screen before you enter it. Valid 10 minutes.` + the same WebOTP line.
4. In MSG91: add the DLT entity id, sender id and the approved template ids; create a **Flow** per template whose variable is named `otp`.
5. Set `PRI_SMS_PROVIDER=msg91`, `PRI_MSG91_AUTH_KEY`, `PRI_MSG91_OTP_TEMPLATE_ID` (and optionally `PRI_MSG91_GUARDIAN_TEMPLATE_ID`) in Railway → server service → Variables. Redeploy.
6. Send yourself a code from the deployed app and confirm it arrives and autofills on an Android phone.

### Option B — Twilio Verify (faster to start, costlier for India)

1. Create a Twilio account, upgrade from trial, create a **Verify service** (code length 6, 10-minute expiry).
2. For Indian numbers Twilio uses its own pre-registered DLT route; no DLT work on your side, but check Twilio's current India pricing.
3. Set `PRI_SMS_PROVIDER=twilio`, `PRI_TWILIO_ACCOUNT_SID`, `PRI_TWILIO_AUTH_TOKEN`, `PRI_TWILIO_VERIFY_SERVICE_SID`. Redeploy.
   Twilio generates its own code; Pri still enforces expiry, attempt ceiling, replay and rate limits around it. Twilio's message text is not Pri's, so the WebOTP line depends on Twilio's template settings.

### Staging / e2e

Set `PRI_SMS_PROVIDER=test` and `PRI_AUTH_EMAIL_PROVIDER=test` on a non-production deploy (or on a production-mode staging deploy, additionally `PRI_SMS_TEST_MODE_ALLOW_STAGING=1`). No message leaves the server; codes are held in memory for the harness (`readTestOutbox` in `server/platform/smsProvider.js`). `client/test/tour-otp-onboarding.js` drives the whole flow this way.

### Legal

The parent notice text (`signup.notice*` in `client/src/i18n/strings.en.js`) and `CONSENT_NOTICE_VERSION` must match the published privacy notice. Legal/privacy sign-off of that text is an owner action.
