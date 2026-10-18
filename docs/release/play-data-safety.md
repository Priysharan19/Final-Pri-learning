# Google Play Data safety form — answers derived from the code

**Status:** engineering draft, reconciled with the code on `main` at `7bef402f7` (2026-10-18).
**Not submitted, not legally reviewed.** Every row cites the code path that justifies it; a row
marked **OWNER** is a decision the repository cannot make. Companions:
`docs/release/app-store-privacy-labels.md` (the Apple equivalent), `docs/legal/privacy.md` (what
the reader is told — currently outdated, see `docs/legal/counsel/COUNSEL-INFORMATION-PACK.md` §8),
`docs/privacy/data-retention.md` (what the server keeps and for how long).

If the code changes what leaves the device, change this file, the Apple label document,
`PrivacyInfo.xcprivacy` and the privacy notice together. This file is not machine-checked.

Android phones and tablets are in V1 since the owner's scope change of 2026-10-16
(`docs/release/PRI_V1_RELEASE_SCOPE.md` §22, #504). The data flows are the same server flows the
iPhone and iPad apps use.

## 1. Overview questions

| Play question | Answer | Why (code) |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Grading is online-only: every checked answer is issued and graded by the server for a signed-in account (`server/platform/practice.js`, `exams.js`). Sign-in, sync, reading and telemetry also send data. Signed out, nothing carrying user data is sent (`client/src/platform/cloudTransport.js`) and nothing is marked. |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | HTTPS/HSTS in production (`server/platform/headers.js`, `server/test/security-headers-check.mjs`); the Android manifest refuses cleartext (`android/app/src/main/AndroidManifest.xml`). |
| Do you provide a way for users to request that their data is deleted? | **Yes** | In-app: Settings → Account → Delete (`DELETE /v1/account`, every sign-in method). Public URL: **`<PRI_PUBLIC_ORIGIN>/account/delete-request`** (`AccountDeleteRequest.jsx`, `otp.js`). Immediate (`deleteAccountRows()`). |
| Account deletion URL | **OWNER:** the production origin (expected `https://prilearning.com`). The path is fixed: `/account/delete-request`. | `client/src/main.jsx`; `server/app.js` serves the SPA for non-`/v1` paths. |
| Target audience and Families policy | **OWNER / counsel — see `docs/release/store/play-listing.md` §5.** Class 7 students are about 12, so a truthful target audience includes the 9–12 band; on our reading (for counsel to confirm) that brings the app under the Families policy. | Child accounts are gated server-side until a guardian confirms (`requireGuardianConsent` in `router.js`); the confirmation is not DPDP-verifiable (`guardianConsent.js` header). |

## 2. Data types collected

"Collected" = sent off the device to the Pri server. "Shared" = passed by the Pri server to a third
party **other than a service provider processing on Pri's behalf**. Play lets a developer leave
service-provider transfers out of "shared"; **OWNER / counsel** decide whether OpenAI, Resend and
the SMS provider are declared as sharing anyway. This draft declares them as shared — the
conservative answer — because the notice names them and a reader expects to see them.

Every type below is **linked to the account**, **not used for tracking or advertising**, and
**not sold**.

| Play data type | Collected? | Shared? | Required / optional | Purpose | Why (code) |
|---|---|---|---|---|---|
| **Personal info → Name** | Yes | No | Required for an account | Account management, App functionality | `accounts.name`; guardian name (`guardian_consents`). |
| **Personal info → Email address** | Yes (unless the account signed up by phone) | Yes — email delivery provider (Resend) | Required (email or phone) | Account management | `accounts.js`; `authDelivery.js`; `otpEmail.js`. A guardian's email for a child's account. |
| **Personal info → Phone number** | Yes, if the student or guardian uses an SMS code | Yes — SMS provider (MSG91 or Twilio Verify; **OWNER** names it) | Optional (alternative to email) | Account management | `otp.js` (`account_phones.phone_e164`), `smsProvider.js`; only when `PRI_SMS_PROVIDER` is configured. |
| **Personal info → User IDs** | Yes | No | Required | Account management, App functionality | Opaque `acct_…` id (`security.js`). |
| **Personal info → Other info** | Yes, from every account (the "18 or older" declaration, class and track); plus, for an under-18 account, the guardian-consent record | Guardian email/phone with the delivery provider (child accounts only) | Age declaration, class and track: required for every account. Consent record: required for a child's account | App functionality (age gate, which maths to set, guardian confirmation) | `accounts.age_basis` (a registration with no age decision is refused, `AGE_DECLARATION_REQUIRED`); class/track in the synced profile (`syncWorker.js safeProfile`); the consent record (`guardianConsent.js`). Matches the Apple "Other Data" row. |
| **Financial info → Purchase history** | Yes, if the student subscribes | No | Optional | App functionality | `appleBilling.js`, `googleBilling.js`, `billing.js`; `billing_payments` retained unlinked after deletion. Card details never reach Pri. |
| **Photos and videos → Photos** | Yes, when the student photographs paper working or a textbook question | **Yes — OpenAI**, `store: false`; the provider may retain for abuse monitoring under its own terms; Pri keeps no copy of the image | Optional (the student can type instead; Settings → Handwriting switches reading off) | App functionality | `PractisePhoto.jsx` (`capture="environment"`); `practice.js` `/:id/recognize`; `questionPhoto.js` → `questionPhotoProvider.js`. The whole frame is sent, answer-blind. |
| **App activity → Other user-generated content** | Yes | **Yes — OpenAI** (handwriting image; working lines + question text only if the opt-in working check is on) | Handwriting reading: optional (on by default, switchable off; then answers are typed). Typed answers for grading: required to be marked | App functionality | (a) Ink image: `cloudRaster.js` → `/v1/handwriting/transcribe` or `/v1/practice/:id/recognize` (answer-blind, `FORBIDDEN_FIELDS`). (b) Answers and working submitted for grading (`practice.js`, `exams.js exam-answers`). (c) The returned transcription and any student correction, kept 90 days with the recognition receipt (`practice.js` `practice-recognition`). (d) Problem reports (`reports.js`); synced settings/bookmarks/tasks/custom questions (`syncContract.js`). |
| **App activity → Other actions** | Yes | No | Required to be marked | App functionality | Graded-attempt records (`learning_events` kind `graded-attempt`) kept until deletion; exam papers and results (`exams.js`, 5-year record TTL, deleted with the account). |
| **App activity → App interactions** | Yes (blocked for a child until a guardian confirms) | No | Required for a signed-in adult | Analytics, App functionality | `telemetry.js`: `feature-used`, `exam-completed`, `trial-started`, `subscription-state`; allow-listed metadata; 90 days. |
| **App info and performance → Crash logs** | No | — | — | — | No crash SDK. **OWNER:** revisit if Crashlytics is added. |
| **App info and performance → Diagnostics** | Yes | No | Required for a signed-in adult | Analytics, App functionality | `telemetry.js`: `client-error`, `sync-failure`, `api-failure`, `recognition-failure`, `bad-question-opened`, `performance-sample`. |
| **Device or other IDs** | Yes | No | Required | App functionality | A random per-install id (`cloudAccount.js` `device-<uuid>`), not the Android ID or advertising ID; plus a SHA-256 of the user-agent (`security.js createSession`). |
| **Location, Contacts, Calendar, Messages, Audio, Files and docs, Health and fitness, Web browsing, Installed apps, Financial → payment info** | No | — | — | — | Not used; the client network boundary allows only the Pri origin. |

### Data not sent at all

- Handwriting **strokes** and the on-device personal handwriting bank stay in IndexedDB
  (`client/src/local/idb.js`, `client/src/ink/personal.js`). Only a rasterised image leaves.
- The **expected answer / solution / marks** never leave with handwriting, photos or working.
- Passwords (bcrypt hash only), session tokens (SHA-256 only), one-time codes (HMAC only).

### The AI tutor (`/v1/tutor`) — **OWNER**

Compiled out of production builds unless `PRI_FEATURE_TUTOR=1`. If enabled, tutor messages and
the question with its solution steps go to OpenAI; add them to the user-generated content row and
to the privacy notice before release.

## 3. Data handling practices

| Play question | Answer | Why (code) |
|---|---|---|
| Is this data processed ephemerally? | The **handwriting image and photo** are ephemeral on Pri's server (memory for the request only; `handwritingProvider.js`, `data-retention.md` §4). The **transcription** of them is not (90 days). Everything else is stored against the account until deletion or its stated TTL. | — |
| Is this data required or optional? | See the column in §2. Answers cannot be marked without an account, so account data is required for the core feature. | `router.js` (`/practice`, `/exams` need a session and, for a child, guardian consent). |
| Can users request deletion? | **Yes** — immediate; `data-retention.md` §2 lists the retained, unlinked categories (payment ledger, de-texted problem reports, an `account.delete` audit row). | `deleteAccountRows()`; `server/test/account-lifecycle-journey-check.mjs`. |
| Independent security review? | **No** (not claimed). | `docs/security/accepted-risks.md` R-12 (external penetration test not yet scheduled). |

## 4. Third parties the server sends data to

| Party | What | Where it is processed | Code | Configured by |
|---|---|---|---|---|
| OpenAI (default endpoint `api.openai.com`; configurable) | Handwriting image; photo; working lines + question text (opt-in); tutor (if enabled) | Outside India; **OWNER / counsel** confirm the contracting entity, region and retention terms | `handwritingProvider.js`, `questionPhotoProvider.js`, `workingProvider.js`, `tutorProvider.js` | `PRI_HANDWRITING_ENDPOINT` and related server variables |
| Resend | Address + message for links and codes | US provider (sending domain `mail.prilearning.com`) | `authDelivery.js`, `otpEmail.js` | `PRI_AUTH_EMAIL_PROVIDER` |
| MSG91 or Twilio Verify | Phone number + code | Provider-dependent | `smsProvider.js` | `PRI_SMS_PROVIDER` — **OWNER** |
| Google Play Billing / App Store | Subscription state; an opaque account token | Provider | `googleBilling.js`, `appleBilling.js` | billing env |
| Razorpay (**code present, outside V1** — web purchasing is out of scope, §12) | If web checkout were enabled: the account's email (`notify_info.notify_email`) and the opaque account id in subscription notes | Provider (India) | `server/platform/razorpay.js` (~line 380) | Razorpay env; not configured for V1. Native clients are refused web checkout (`BILLING_WEB_CHECKOUT_NATIVE_REFUSED`) |
| Supabase (processor) | The platform database after cutover | Mumbai (`ap-south-1`) | `docs/architecture/adr-0001-online-first-runtime.md` | `PRI_DATABASE_URL` |
| Railway (processor) | Hosting; request logs (method, path, status, latency — no bodies) | **OWNER** confirms the service region. On 2026-10-04 the production SQLite volume was observed in region `ams` (`docs/release/production-cutover-checklist.md`); until the Postgres cutover, production account data lives there, not in India | `server/app.js requestLogger` | deployment |

No advertising network, analytics SDK or social SDK runs in the client. Google/Apple sign-in use
the providers' own identity endpoints only when the student taps them.

## 5. Owner decisions before submission

1. The production origin for the deletion URL.
2. Target audience / Families policy (`docs/release/store/play-listing.md` §5).
3. Whether service-provider transfers are declared as "shared" (this draft: yes).
4. Which SMS provider is live.
4a. Whether problem-report free text (`issue_reports.note`, `reports.js`) is declared as user-generated content (this draft) or under a support/communications category. **OWNER / counsel.**
5. Whether the AI tutor flag is on.
6. Whether a zero-data-retention arrangement exists with OpenAI.
7. Rewrite and counsel review of `docs/legal/privacy.md`.

## 6. Mismatches found and fixed on 2026-10-18

| # | Mismatch | Fix |
|---|---|---|
| 1 | "Marks are decided on the device before they are synced" | Rewritten: server issues and grades every question |
| 2 | "Without an account nothing is sent" implied the app is fully usable signed out | Stated that nothing is marked signed out |
| 3 | The transcription text (90 days) and exam answers/results (5-year TTL) were not declared; "the server keeps no copy" applied only to the image | Declared in §2 and §3 |
| 4 | "Practise this" question photos were not described | Added to the Photos row |
| 5 | Photos row said a photo is sent "only when the student attaches a photo of paper working"; handwriting reading was described as fully optional with no consequence | Corrected: switching reading off means answers are typed |
| 6 | Telemetry split: product-interaction events and diagnostics were one row | Split into App interactions and Diagnostics |
| 7 | Railway region and pre-cutover data location (SQLite volume `ams`) were not stated; Supabase Mumbai was presented as the database | Stated in §4 |
| 8 | The "shared" definition did not address the service-provider exemption | Stated, with the conservative choice recorded |
| 9 | Independent security review row cited only internal acceptance | Points to accepted-risk R-12 |
