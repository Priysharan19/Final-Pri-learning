# One-time-code sign-in and a parent's approval

What shipped, how to switch it on in Railway, and what only the owner can do.

## What it does

- **Sign up / sign in with a 6-digit code** sent by SMS (+91 by default) or email. Same endpoint for both; an address with an account signs in, a new one signs up. `server/platform/otp.js`, `server/platform/otpCore.js`.
- **Google / Apple** stay as in PR #296; the onboarding flow calls them with `guardianLater: true` so a child's parent is asked on the next screen.
- **A parent's approval** (DPDP Act, under 18): the student enters the parent's phone or email. The code (and, for email, the existing link) goes to the parent, and the parent approves **on their own page, `/guardian/consent`**, on their own device: it shows the plain-language notice, they tick agreement, name the phone/email the code went to, and enter the code. No child session is involved. The child's screen only says "waiting for your parent", can resend (rate-limited), and moves on by itself once the parent approves. Until approval the account is limited: every gated `/v1` route (sync, classes, handwriting, tutor, billing, reports, working) answers `GUARDIAN_CONSENT_PENDING`; practice and marking on the device keep working. Once a guardian withdraws, the child's session cannot start a new request (409 `GUARDIAN_CONSENT_WITHDRAWN`).
- **Withdrawal**: the parent screen in the app (`I'm a parent` → Withdraw consent) sends a code to the approving phone; entering it withdraws every consent that phone gave and sync stops at once. Email parents keep the withdraw link.
- **Account deletion** for a passwordless (code-only) account requires a fresh code sent to the account's own phone/email.

## The one sign-in card (seamless sign-in)

The landing screen, every in-question "Sign in to check this answer", and Settings → Your Pri account all mount the same component (`client/src/components/SignUpFlow.jsx`):

1. **Email → "Continue with email" → the six-digit code, in the same card.** No navigation, no reload, and no "create account / sign in" choice first: `POST /v1/account/otp/request` then `/verify` sign an existing account in (verified or not, with or without a password) and answer `profile-required` for a new address.
2. **A new address** is then asked, still in the card, only what an account needs: first name, age (11–17 or "18 or older" — never inferred), and an explicit agreement to the terms and privacy notice. On the landing screen the class is asked next; inside a page the profile's class is used and never asked again. Under 18, the parent step follows with the reason for it stated.
3. **Only what the server reports is offered.** Google/Apple from `GET /v1/account/identity/providers`; a phone code only when `GET /v1/account/otp/channels` reports an SMS provider. `GET /v1/account/otp/channels` is new, public and read-only: `{ channels: { email, sms } }` from deployment configuration alone (no account, address or session is read; `Cache-Control: no-store`; inventoried in `docs/security/route-inventory.json`).
4. **"Sign in with password"** is a small option for accounts that have one. A wrong password and an unknown address get the same words, with the email code offered as the way out. Password *registration* is no longer offered in the client; `POST /v1/account/register` is unchanged on the server.
5. **A linked profile signing in again never becomes a second account** (`allowCreate={false}`): an address with no account is told so and the unused sign-up ticket is dropped. A session for an account other than the profile's is ended rather than kept beside it.
6. **The card reads nothing and submits nothing.** It has no access to handwriting, photos or answers, and Submit stays the student's own action. Whether the page then reads kept ink is the page's rule, not the card's: on this tree the reader's existing behaviour applies (at most one read, asserted in `client/test/tour-sign-in-card.js`); the "zero paid reads on sign-in" assertions land with read-on-request (PR #440) and are listed in that tour file under `DEFERRED TO THE READ-MY-ANSWER PR`.
7. **`/verify` says nothing about an address until a correct code is shown.** The code (or the sign-up ticket a code earned) is checked before anything that depends on whether an account exists; a sign-up profile is validated only on the ticket, after the proof.

No limit, expiry, attempt ceiling or cookie attribute changed; the one enumeration change tightens `/verify` (point 7). The server contract the card relies on is held in `server/test/otp-sign-in-check.mjs`; the card's own rules in `client/test/sign-in-card-check.mjs`; the journeys (Chromium and WebKit) in `client/test/tour-sign-in-card.js`. Those journeys read codes from the in-memory test mail adapter: they are not evidence that a real provider delivered a real message.

**The code email** (`server/platform/otpEmail.js`): one narrow column, "Pri Learning", the code as the largest element, the 10-minute single-use expiry, and "if you did not ask for this". A sign-in or deletion code email carries **no link and no URL**. A guardian's email links only to `/guardian/consent` on this deployment's own validated `PRI_PUBLIC_ORIGIN` (`otpEmailConsentLink`); an origin with a query, credentials, a non-http scheme, or plain http for a non-local host yields no link at all.

## What this consent is, and is not

This is **parent-controlled-channel consent**: `guardian-phone-otp` / `guardian-email-otp` / `guardian-email-confirmation` record that someone holding the named phone or inbox read the notice on the parent page and approved. It does **not** verify identity or age: it is not DigiLocker-verified, and it does not prove the person is an adult or this child's parent.

**Residual risk:** a child who controls a second phone number or inbox can enter it as the "parent" and approve themselves. The server refuses only the child's own phone/email; it cannot tell a parent's second number from a child's.

**Follow-up (tracked):** DPDP Rule 10 requires verifiable parental consent from **14 May 2027** — verification against identity details already reliably held, or a DigiLocker token. That is not built; it must replace or sit on top of this flow before that date.

## Account takeover by pre-registration

If someone registered an address with a password and never verified it, the first one-time-code sign-in to that address proves the real owner. In one transaction it clears the unproven password, revokes every session, spends every pending verify/reset token and writes an `account.first-verified-by-otp` audit row. Password login for unverified accounts is otherwise unchanged (a candidate follow-up: refuse password sign-in for accounts left unverified past a deadline).

## Security properties (tested in `server/test/otp-lifecycle-check.mjs`)

| Property | How |
| --- | --- |
| Code never stored | HMAC-SHA256 of `challengeId:code` under a key derived from `PRI_AUTH_DELIVERY_KEY` |
| Address never stored for codes | HMAC of the destination; the client re-sends it to verify |
| 10-minute expiry, single use | conditional `UPDATE … WHERE consumed_at IS NULL` |
| 5 attempts, race-safe | attempt counted atomically before the compare |
| Constant-time compare | `crypto.timingSafeEqual` |
| No enumeration | `/otp/request` and `/guardian/withdraw-request` answer identically for known and unknown addresses; withdraw-request also answers no sooner than a fixed 900 ms floor, sends nothing when no consent names the number, and never reports a delivery failure |
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
