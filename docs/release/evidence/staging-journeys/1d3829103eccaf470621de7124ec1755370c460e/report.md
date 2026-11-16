# Staging journey proof · 1d3829103

Origin `https://pri-learning-staging-staging.up.railway.app` · started 2026-11-08T13:24:55.780Z · finished 2026-11-08T13:27:08.006Z · accounts made and deleted by this run.
Deployed: web `1d3829103eccaf470621de7124ec1755370c460e`, server `1d3829103eccaf470621de7124ec1755370c460e`, readiness `1d3829103eccaf470621de7124ec1755370c460e`, built 2026-11-07T07:12:14.000Z, database postgres.

Real deployed product, real browser (Playwright Chromium, headless), nothing stubbed. Drawn ink and rendered photos are SYNTHETIC inputs; nothing here is device, human or examiner evidence.

| Step | Status | What was proved or found |
|---|---|---|
| 0 · Release identity: staging serves the nominated SHA | **PASS** | 2/2 checks |
| 1 · First open: the app loads, offers sign-in and can be installed (phone 390×844, tablet 820×1180) | **PASS** | 7/7 checks |
| 2 · Sign-up and sign-in (email code on the card; a password account signs in before verifying) | **FAIL** | 4/5 checks · DEFECT: an ADULT whose email is not verified signs in with a password and is told "We couldn’t confirm your account’s guardian approval. Please try again." — the guardian is not the blocker (the server's /guardian/state says required:false, not-required, eligible:false because emailVerified:false), and the card offers no way to verify the email, so the student is stuck (L2 (account/activation logic) with L3 (card copy)) · BLOCKED: email-code sign-up cannot finish: the six-digit code goes to a mailbox this harness cannot read (no account is created without it). Closes when PRI_STAGING_MAILBOX_CMD reads a dedicated test inbox. |
| 3 · Minor account: guardian consent requested, account held pending | **PASS** | 4/4 checks · BLOCKED: the guardian confirmation link goes to the guardian mailbox, which this harness cannot read |
| 4 · Account-bound sync and recovery (second browser, same progress and History) | **BLOCKED** | BLOCKED: there is no marked work to compare until step 5 runs |
| 5 · Server-issued question, typed answer, server mark (and the #723 ₹/crore form) | **BLOCKED** | 1/1 checks · BLOCKED: the unverified account never got past the sign-in card (step 2), so Practice could not be opened in the app · BLOCKED: marking needs a verified email (server/platform/practice.js: requireVerifiedEmail on every practice route) |
| 6 · Handwritten answer through the real reader (SYNTHETIC ink) | **BLOCKED** | BLOCKED: reading and marking a handwritten answer are practice routes, behind the verified-email gate |
| 7 · Photo answer through the real reader (SYNTHETIC photo) | **BLOCKED** | BLOCKED: the photo path issues and marks through the same verified-email gate |
| 8 · History and persistence after reload, both browsers | **BLOCKED** | BLOCKED: there are no marked attempts to find until steps 5–7 run |
| 9 · Offline mid-answer: the draft is kept and read when back online | **BLOCKED** | BLOCKED: needs an issued question to answer |
| 10 · Sign out everywhere: a second browser is signed out | **BLOCKED** | 3/3 checks · BLOCKED: Settings could not be opened: the unverified account never got past the sign-in card (step 2) |
| 11 · Account deletion in the app (Settings → Cloud account), and cleanup | **BLOCKED** | BLOCKED: in-app deletion is in Settings, which the unverified account cannot reach (step 2) |

## 0 · Release identity: staging serves the nominated SHA — PASS

- ✔ web, server and readiness all report the nominated SHA — `{"web":"1d3829103eccaf470621de7124ec1755370c460e","server":"1d3829103eccaf470621de7124ec1755370c460e","ready":"1d3829103eccaf470621de7124ec1755370c460e","buildTimestamp":"2026-11-07T07:12:14.000Z","engine":"postgres"}`
- ✔ /v1/ready says the replica can serve — `ready`
- /v1 evidence: 3 request(s) in results.json (step 0)

## 1 · First open: the app loads, offers sign-in and can be installed (phone 390×844, tablet 820×1180) — PASS

- ✔ phone: the sign-in card is shown to a new visitor
- ✔ phone: a web app manifest with a name and icons (installable) — `{"href":"/manifest.webmanifest","status":200,"name":"Pri Learning","display":"standalone","icons":3,"start":"/"}`
- ✔ phone: a service worker is installed and active (opens again offline)
- ✔ tablet: the sign-in card is shown to a new visitor
- ✔ tablet: a web app manifest with a name and icons (installable) — `{"href":"/manifest.webmanifest","status":200,"name":"Pri Learning","display":"standalone","icons":3,"start":"/"}`
- ✔ tablet: a service worker is installed and active (opens again offline)
- ✔ no uncaught errors on first open
- Screenshots: [01-1-phone-first-open.png](01-1-phone-first-open.png), [02-1-tablet-first-open.png](02-1-tablet-first-open.png)
- /v1 evidence: 6 request(s) in results.json (step 1)

## 2 · Sign-up and sign-in (email code on the card; a password account signs in before verifying) — FAIL

- ✔ email-code sign-up: the card sends a code and shows the six code boxes
- ✔ a password account is registered (POST /v1/account/register, as Settings → Cloud account does) — `201 {"account":{"id":"acct_e8da3b42-7c42-46b0-828c-c646c8352eac","email":"delivered+pri-d91d72-adult@resend.dev","name":"Staging Proof Adult","role":"student","emailVerified":false},"verificationRequired":true}`
- ✔ the server signs the password account in before its email is verified (session for that account) — `200`
- ✔ the account is still unverified (its code never left the mailbox)
- ✖ held at the card, the student is told the email must be verified — `We couldn’t confirm your account’s guardian approval. Please try again.`
- **Defect** (L2 (account/activation logic) with L3 (card copy)): an ADULT whose email is not verified signs in with a password and is told "We couldn’t confirm your account’s guardian approval. Please try again." — the guardian is not the blocker (the server's /guardian/state says required:false, not-required, eligible:false because emailVerified:false), and the card offers no way to verify the email, so the student is stuck. Where: client/src/components/onboardingAuthority.js decideOnboardingAuthority (an unverified adult returns "unavailable") → SignUpFlow.jsx finish() shows signup.consentCheckUnavailable. Repro: POST /v1/account/register {isAdult:true} (as Settings → Cloud account does), then on a new device: "Sign in with password" on the card, class 10, Continue.
- **Blocked:** email-code sign-up cannot finish: the six-digit code goes to a mailbox this harness cannot read (no account is created without it). Closes when PRI_STAGING_MAILBOX_CMD reads a dedicated test inbox.
- Note: the card stays on its class step and says: "We couldn’t confirm your account’s guardian approval. Please try again."
- Screenshots: [03-2-email-code-sent.png](03-2-email-code-sent.png), [04-2-password-sign-in.png](04-2-password-sign-in.png)
- /v1 evidence: 16 request(s) in results.json (step 2)

## 3 · Minor account: guardian consent requested, account held pending — PASS

- ✔ a Class 8 account names its guardian and is registered — `201 {"account":{"id":"acct_c98e1f36-5f89-493e-9d93-4882e95b49ba","email":"delivered+pri-d91d72-child@resend.dev","name":"Staging Proof Child","role":"student","emailVerified":false},"verificationRequired":true}`
- ✔ the server holds the account pending guardian consent — `{"accountId":"acct_c98e1f36-5f89-493e-9d93-4882e95b49ba","required":true,"state":"pending","ageBasis":"child","blockerCode":"GUARDIAN_CONSENT_PENDING","eligible":false,"emailVerified":false,"guardianEmail":"d••••••••••••••••••••••••••••@resend.dev","noticeVersion":"2026-10-22","renewalRequired":fals`
- ✔ practice is refused to it before consent (403 GUARDIAN_CONSENT_PENDING; the gate that answers first is recorded, not assumed) — `403 GUARDIAN_CONSENT_PENDING`
- ✔ signing in shows the guardian step, not the app — `card step parent, shell open false`
- **Blocked:** the guardian confirmation link goes to the guardian mailbox, which this harness cannot read; closes with PRI_STAGING_MAILBOX_CMD reading a dedicated test inbox, then: open the link, confirm, and check the account opens
- Screenshots: [05-3-child-sign-in.png](05-3-child-sign-in.png)
- /v1 evidence: 14 request(s) in results.json (step 3)

## 4 · Account-bound sync and recovery (second browser, same progress and History) — BLOCKED

- **Blocked:** there is no marked work to compare until step 5 runs; that needs a verified email, so the mailbox (PRI_STAGING_MAILBOX_CMD).

## 5 · Server-issued question, typed answer, server mark (and the #723 ₹/crore form) — BLOCKED

- ✔ the server refuses an unverified account a question (EMAIL_UNVERIFIED), as designed — `403 EMAIL_UNVERIFIED`
- **Blocked:** the unverified account never got past the sign-in card (step 2), so Practice could not be opened in the app
- **Blocked:** marking needs a verified email (server/platform/practice.js: requireVerifiedEmail on every practice route); verification needs the code from the mailbox. Closes with PRI_STAGING_MAILBOX_CMD.
- /v1 evidence: 1 request(s) in results.json (step 5)

## 6 · Handwritten answer through the real reader (SYNTHETIC ink) — BLOCKED

- **Blocked:** reading and marking a handwritten answer are practice routes, behind the verified-email gate; that needs a verified email, so the mailbox (PRI_STAGING_MAILBOX_CMD).

## 7 · Photo answer through the real reader (SYNTHETIC photo) — BLOCKED

- **Blocked:** the photo path issues and marks through the same verified-email gate; that needs a verified email, so the mailbox (PRI_STAGING_MAILBOX_CMD).

## 8 · History and persistence after reload, both browsers — BLOCKED

- **Blocked:** there are no marked attempts to find until steps 5–7 run; that needs a verified email, so the mailbox (PRI_STAGING_MAILBOX_CMD).

## 9 · Offline mid-answer: the draft is kept and read when back online — BLOCKED

- **Blocked:** needs an issued question to answer; that needs a verified email, so the mailbox (PRI_STAGING_MAILBOX_CMD).

## 10 · Sign out everywhere: a second browser is signed out — BLOCKED

- ✔ a second browser signs in to the same account — `200`
- ✔ API only: POST /v1/account/logout-all revokes the account's sessions — `200 {"ok":true,"revoked":3}`
- ✔ the second browser is signed out (its /v1/account/me answers 401) — `401`
- **Blocked:** Settings could not be opened: the unverified account never got past the sign-in card (step 2)
- Screenshots: [06-10-second-browser-after.png](06-10-second-browser-after.png)
- /v1 evidence: 11 request(s) in results.json (step 10)

## 11 · Account deletion in the app (Settings → Cloud account), and cleanup — BLOCKED

- **Blocked:** in-app deletion is in Settings, which the unverified account cannot reach (step 2); the public deletion page sends an email code to the mailbox. The accounts are deleted below through DELETE /v1/account with the password (the route the Settings form calls), labelled API cleanup
- /v1 evidence: 10 request(s) in results.json (step 11)

## Test accounts

Made: adult delivered+pri-d91d72-adult@resend.dev, child delivered+pri-d91d72-child@resend.dev.
Deleted: adult (API cleanup (DELETE /v1/account with the password)), child (API cleanup (DELETE /v1/account with the password)).
**Not deleted: none.**

