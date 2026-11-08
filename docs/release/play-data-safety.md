# Google Play Data safety form — answers derived from the code

**Status:** engineering draft, reconciled with the code at `1d3829103` (2026-11-08, §6c; earlier at `a5778a319`, 2026-11-02, `795c00568`, 2026-10-19, and `7bef402f7`, 2026-10-18).
**Not submitted, not legally reviewed.** Every row cites the code path that justifies it; a row
marked **OWNER** is a decision the repository cannot make. Companions:
`docs/release/app-store-privacy-labels.md` (the Apple equivalent), `docs/legal/privacy.md` (what
the reader is told; corrected against the code on 2 Nov 2026 and unreviewed by counsel until
`docs/legal/review-status.json` says otherwise), `docs/privacy/data-retention.md` (what the server
keeps and for how long).

If the code changes what leaves the device, change this file, the Apple label document,
`PrivacyInfo.xcprivacy` and the privacy notice together. **This file is machine-checked** by
`node tools/play-data-safety-check.mjs`: it fails when the Android permissions, the advertising-ID
posture, the SDK dependency lists, the telemetry event allowlist, the answer-blind request fields
or the deletion route drift from what is declared here. The check cannot see server environment
variables (for example whether `PRI_SENTRY_DSN` is set) or contracts; those stay **OWNER** rows.
`node tools/store-readiness-check.mjs` also holds the Crash logs and Phone number rows, Step 3 and
Step 4 to the code, the Apple label and both privacy manifests.

Android phones and tablets are in V1 since the owner's scope change of 2026-10-16
(`docs/release/PRI_V1_RELEASE_SCOPE.md` §22, #504). The data flows are the same server flows the
iPhone and iPad apps use.

## 1. Overview questions

| Play question | Answer | Why (code) |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Grading is online-only: every checked answer is issued and graded by the server for a signed-in account (`server/platform/practice.js`, `exams.js`). Sign-in, sync, reading and telemetry also send data. Signed out, nothing carrying user data is sent (`client/src/platform/cloudTransport.js`) and nothing is marked. |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | HTTPS/HSTS in production (`server/platform/headers.js`, `server/test/security-headers-check.mjs`); the Android manifest refuses cleartext (`android/app/src/main/AndroidManifest.xml`, `usesCleartextTraffic="false"`). |
| Do you provide a way for users to request that their data is deleted? | **Yes** | In-app: Settings → Account → Delete (`DELETE /v1/account`, every sign-in method). Public form: **`https://app.prilearning.com/account/delete-request`** (`AccountDeleteRequest.jsx`, `otp.js`). Immediate (`deleteAccountRows()`). |
| Account deletion URL | **`https://prilearning.com/delete-account`** (D5; **OWNER** confirms D5 before the first signed build). The site page names Pri Learning and its developer, gives the in-app steps, links to the form at `https://app.prilearning.com/account/delete-request`, and shows what is removed and kept, rendered word for word from `docs/legal/privacy.md`. The site is **not deployed** and DNS is untouched: the URL must resolve before it is entered. | `site/` (generator and check, `tools/site-check.mjs`); `client/src/main.jsx`; `server/app.js` serves the SPA for non-`/v1` paths on the app host. |
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
| **Personal info → Email address** | Yes, from every account (SMS is off at launch, D3, so no account signs up by phone) | Yes — email delivery provider (Resend) | Required | Account management; Fraud prevention, security, and compliance | `accounts.js`; `authDelivery.js`; `otpEmail.js`. A guardian's email for a child's account. A new-device sign-in notice goes to the account's own address through the same Resend account (`sessionAlerts.js`, `securityEmail.js`); the notice carries no address, token, link or code. |
| **Personal info → Phone number** | **No at launch.** SMS sign-in and guardian phone codes are off (owner decision D3); the client shows the SMS option only when `GET /v1/account/otp/channels` reports `sms: true`, which needs `PRI_SMS_PROVIDER`, and both environments report `false` | — | — | — | `otp.js` (`account_phones.phone_e164`), `smsProvider.js`, `SignUpFlow.jsx` (`channels.sms`). The notice describes no mobile-number route. **If SMS is ever turned on:** tick Phone number here (shared with the SMS provider), add `PhoneNumber` to the Apple manifest and label, and describe it in `docs/legal/privacy.md`, before `PRI_SMS_PROVIDER` is set. |
| **Personal info → User IDs** | Yes | No | Required | Account management, App functionality | Opaque `acct_…` id (`security.js`). |
| **Personal info → Other info** | Yes, from every account (the "18 or older" declaration, class and track); plus, for an under-18 account, the guardian-consent record | Guardian email with the delivery provider (child accounts only) | Age declaration, class and track: required for every account. Consent record: required for a child's account | App functionality (age gate, which maths to set, guardian confirmation) | `accounts.age_basis` (a registration with no age decision is refused, `AGE_DECLARATION_REQUIRED`); class/track in the synced profile (`syncWorker.js safeProfile`); the consent record (`guardianConsent.js`). Matches the Apple "Other Data" row. |
| **Financial info → Purchase history** | Yes, if the student subscribes | No | Optional | App functionality | `appleBilling.js`, `googleBilling.js`, `billing.js`; `billing_payments` retained unlinked after deletion. Card details never reach Pri. |
| **Photos and videos → Photos** | Yes, when the student photographs paper working or a textbook question | **Yes — OpenAI**, `store: false`; the provider may retain for abuse monitoring under its own terms; Pri keeps no copy of the image | Optional (the student can type instead; Settings → Handwriting switches reading off) | App functionality | `PractisePhoto.jsx` (`capture="environment"`); `practice.js` `/:id/recognize`; `questionPhoto.js` → `questionPhotoProvider.js`. The whole frame is sent, answer-blind. |
| **App activity → Other user-generated content** | Yes | **Yes — OpenAI** (handwriting image; working lines + question text only if the opt-in working check is on) | Handwriting reading: optional (on by default, switchable off; then answers are typed). Typed answers for grading: required to be marked | App functionality | (a) Ink image: `cloudRaster.js` → `/v1/handwriting/transcribe` or `/v1/practice/:id/recognize` (answer-blind, `FORBIDDEN_FIELDS`). (b) Answers and working submitted for grading (`practice.js`, `exams.js exam-answers`). (c) The returned transcription and any student correction, kept 90 days with the recognition receipt (`practice.js` `practice-recognition`). (d) Problem reports (`reports.js`); synced settings/bookmarks/tasks/custom questions (`syncContract.js`). |
| **App activity → Other actions** | Yes | No | Required to be marked | App functionality | Graded-attempt records (`learning_events` kind `graded-attempt`) kept until deletion; exam papers and results (`exams.js`, 5-year record TTL, deleted with the account). |
| **App activity → App interactions** | Yes (blocked for a child until a guardian confirms) | No | Required for a signed-in adult | Analytics, App functionality | `telemetry.js`: `feature-used`, `exam-completed`, `trial-started`, `subscription-state`; allow-listed metadata; 90 days. |
| **App info and performance → Crash logs** | Yes (blocked for a child until a guardian confirms) | **OWNER:** No while `PRI_SENTRY_DSN` is unset (the current state, `docs/operations/alerts.md`); if the owner sets it, the coded report is forwarded to that Sentry project — declare Sentry then (or treat it as a service provider, §5 item 3) | Optional — Settings → Crash reports, on by default for a signed-in account, off with one tap, per device | Analytics (app stability) | Coded crash reports, `POST /v1/telemetry/error` (`telemetry.js` `cleanErrorReport`; client `reportCrash`, `errorReportsEnabled`): platform, surface slug, upper-case error code, scope, a hex fingerprint and the client build SHA — never the message, stack, URL or anything typed; stored as a `client-error` row for 90 days. No crash SDK in the app; the optional forward is server-side (`errorSink.js`). |
| **App info and performance → Diagnostics** | Yes | No | Required for a signed-in adult (crash reports within it are optional, see Crash logs) | Analytics, App functionality | `telemetry.js`: `client-error`, `sync-failure`, `api-failure`, `recognition-failure`, `bad-question-opened`, `performance-sample`. |
| **Device or other IDs** | Yes | No | Required | App functionality; Fraud prevention, security, and compliance | A random per-install id (`cloudAccount.js` `device-<uuid>`), not the Android ID or advertising ID; plus a SHA-256 of the user-agent (`security.js createSession`). The per-install id also decides whether a sign-in is from a new device (`sessionAlerts.js`, `session.new-device` audit row). |
| **Location, Contacts, Calendar, Messages, Audio, Files and docs, Health and fitness, Web browsing, Installed apps, Financial → payment info** | No | — | — | — | Not used; the client network boundary allows only the Pri origin. |

### Android permissions in the shipped app

The main manifest requests only `android.permission.INTERNET`. The merged release manifest
(`android/app/build/outputs/logs/manifest-merger-release-report.txt`) adds, from libraries:

| Permission | Added by | What it means for Data safety |
|---|---|---|
| `com.android.vending.BILLING` | `com.android.billingclient:billing:8.0.0` | Talks to the Play Store for purchases; no data type of its own beyond Purchase history. |
| `android.permission.ACCESS_NETWORK_STATE` | `com.google.android.datatransport:transport-backend-cct` / `transport-runtime` (transitive from `play-services-auth-api-phone` via Play services) | Reads connectivity state only; no data type. **OWNER:** Google's own Play services libraries may log their API usage to Google under Google's terms; check Google's published Data safety guidance for `play-services-auth-api-phone` and `billing` before submitting. |
| `com.prilearning.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | `androidx.core:core` | A signature-level permission internal to the app; no data type. |

No library declares `com.google.android.gms.permission.AD_ID`, and nothing in `android/` or
`client/src` reads the advertising ID.

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
| Can users request deletion? | **Yes** — immediate; `data-retention.md` §2 lists the retained, unlinked categories (payment ledger, de-texted problem reports, an `account.delete` audit row). The privacy notice also promises that an under-18 account no guardian confirmed, or whose guardian withdrew, is erased after 30 days, and that a guardian can ask for erasure without the child's login (D18): **not yet in the code** at `1d3829103`; `scripts/release-nominate.mjs` refuses a production nomination until it is (`tools/legal-promises.mjs`). | `deleteAccountRows()`; `server/test/account-lifecycle-journey-check.mjs`. |
| Independent security review? | **No** (not claimed). | `docs/security/accepted-risks.md` R-12 (external penetration test not yet scheduled). |

## 4. Third parties the server sends data to

| Party | What | Where it is processed | Code | Configured by |
|---|---|---|---|---|
| OpenAI (default endpoint `api.openai.com`; configurable) | Handwriting image; photo; working lines + question text (opt-in); tutor (if enabled) | Outside India; **OWNER / counsel** confirm the contracting entity, region and retention terms | `handwritingProvider.js`, `questionPhotoProvider.js`, `workingProvider.js`, `tutorProvider.js` | `PRI_HANDWRITING_ENDPOINT` and related server variables |
| Resend | Address + message for links and codes | US provider (sending domain `mail.prilearning.com`) | `authDelivery.js`, `otpEmail.js` | `PRI_AUTH_EMAIL_PROVIDER` |
| MSG91 or Twilio Verify (**off at launch**, D3) | Phone number + code, only if SMS is ever turned on | Provider-dependent | `smsProvider.js` | `PRI_SMS_PROVIDER` — unset; see the Phone number row before setting it |
| Google Play Billing / App Store | Subscription state; an opaque account token | Provider | `googleBilling.js`, `appleBilling.js` | billing env |
| Razorpay (**code present, outside V1** — web purchasing is out of scope, §12) | If web checkout were enabled: the account's email (`notify_info.notify_email`) and the opaque account id in subscription notes | Provider (India) | `server/platform/razorpay.js` (~line 380) | Razorpay env; not configured for V1. Native clients are refused web checkout (`BILLING_WEB_CHECKOUT_NATIVE_REFUSED`) |
| Supabase (processor) | The platform database after cutover | Mumbai (`ap-south-1`) | `docs/architecture/adr-0001-online-first-runtime.md` | `PRI_DATABASE_URL` |
| Sentry (**only if** `PRI_SENTRY_DSN` is set — unset today) | Coded crash/5xx events: request id, server release SHA, route template, method, status, error code, source, client platform, surface, fingerprint. No account id, email, message, stack or body | **OWNER** (the owner's Sentry project and its region) | `server/platform/errorSink.js` | `PRI_SENTRY_DSN` |
| Resend (operator alerts) | Alert emails to the operator (`PRI_ALERT_EMAIL`): rule id, thresholds, counts, release SHA. No user data | US provider | `server/platform/alertNotifier.js` | `PRI_ALERT_EMAIL` |
| Railway (processor) | Hosting; request logs (method, path, status, latency — no bodies) | **OWNER** confirms the service region. On 2026-10-04 the production SQLite volume was observed in region `ams` (`docs/release/production-cutover-checklist.md`); until the Postgres cutover, production account data lives there, not in India | `server/app.js requestLogger` | deployment |

No advertising network, analytics SDK, crash SDK or social SDK runs in the client. Google/Apple sign-in use
the providers' own identity endpoints only when the student taps them.

## 5. Owner decisions before submission

1. The production origin for the deletion URL: D5 sets `https://prilearning.com/delete-account`;
   confirm it, deploy the site and point DNS.
2. Target audience / Families policy (`docs/release/store/play-listing.md` §5).
3. Whether service-provider transfers are declared as "shared" (this draft: yes).
4. SMS stays off at launch (D3); confirm `PRI_SMS_PROVIDER` is unset on production at submission.
4a. Whether problem-report free text (`issue_reports.note`, `reports.js`) is declared as user-generated content (this draft) or under a support/communications category. **OWNER / counsel.**
5. Whether the AI tutor flag is on.
6. Whether a zero-data-retention arrangement exists with OpenAI.
7. Counsel review of `docs/legal/privacy.md` (corrected 2 Nov 2026), recorded in `docs/legal/review-status.json`.
8. Whether `PRI_SENTRY_DSN` will be set for release; if so, Crash logs → Shared (or service provider) and the notice names Sentry.
9. Confirm Google's Play services / Billing library data practices (§2 Android permissions) need no additional declaration.
10. Whether "Fraud prevention, security, and compliance" is ticked for Email address (new-device notices; this draft: yes).
11. D17: the one-time prompt naming OpenAI is in the release build, or the Photos and user-generated-content rows are submitted knowingly as "on by default, switchable off". Google's prominent-disclosure rule is the reason it matters here.
12. D18: the 30-day erasure and the guardian's erasure request are in the release build (the nomination gate checks this); counsel sets the period.

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

## 6a. Mismatches found and fixed on 2026-10-19 (re-verified at `795c00568`)

| # | Mismatch | Fix |
|---|---|---|
| 10 | Crash logs declared "No"; since m365 (`edf37ed4f`, `f936a7092`) the app sends coded crash reports to `POST /v1/telemetry/error`, behind a per-device Settings → Crash reports switch | Crash logs → Collected, optional; sharing with Sentry flagged OWNER (`PRI_SENTRY_DSN`) |
| 11 | §4 did not list Sentry (server-side error sink, `errorSink.js`) or the operator alert emails (`alertNotifier.js`, ops alerts) | Added to §4 with "only if configured" |
| 12 | New-device sign-in notices (`sessionAlerts.js`, `securityEmail.js`) use the email address and the per-install device id for security | Added "Fraud prevention, security, and compliance" to Email address and Device or other IDs |
| 13 | Library permissions were not recorded; the merged manifest carries `com.android.vending.BILLING`, `ACCESS_NETWORK_STATE` (datatransport, via Play services) and androidx.core's internal receiver permission | Added "Android permissions in the shipped app" under §2; Google-library practices flagged OWNER |
| 14 | "This file is not machine-checked" | `tools/play-data-safety-check.mjs` now checks it |

## 6b. Mismatches found and fixed on 2026-11-02 (re-verified at `a5778a319`)

| # | Mismatch | Fix |
|---|---|---|
| 15 | Phone number declared as collected and shared, for an SMS path that is off at launch (D3) and hidden by the client unless the server reports it live; the Apple label and manifest carried the same row | Row → No at launch with the re-enable procedure; removed from Step 3 and Step 4; Apple label and both manifests changed the same way |
| 16 | Crash logs were declared here but not on the Apple label or in the manifest | Apple label → Crash Data Yes; `CrashData` added to both manifests; the three now agree |
| 17 | The header called the privacy notice "currently outdated" | The notice was corrected on 2 Nov 2026; its review state is `docs/legal/review-status.json` |
| 18 | Step 2 assumed Sign in with Google / Apple ship in the first Android build | Owner decision D3 recorded: email code and password only in the first submission |

Re-verified and unchanged on 2026-11-02: the telemetry allowlist, `FORBIDDEN_FIELDS`, the deletion
routes, the Android permissions table and the absence of any tracking, crash or ads SDK.

Re-verified and unchanged on 2026-10-19: the daily free-plan cap (#563/#537, `practiceAllowance.js`) stores a per-account daily count in `idempotency_keys` — account data already covered by App activity; the privacy/consent copy change (#283/#284) does not change what is sent; the guardian-consent record still carries `notice_version`; the telemetry event allowlist is unchanged; no provider module (`handwritingProvider.js`, `questionPhotoProvider.js`, `workingProvider.js`, `tutorProvider.js`) changed what it sends; `FORBIDDEN_FIELDS` still exclude the expected answer, solution and marks.

## 6c. Re-checked on 2026-11-08 at `1d3829103`

`main` moved 62 commits from `a5778a319`; none changed what leaves the device. Re-verified and
unchanged: the telemetry allowlist, `FORBIDDEN_FIELDS`, `store: false`, the deletion routes, the
Android permissions, `channels.sms: false`, and the absence of any tracking, crash or ads SDK.

| # | What was stale | Fix |
|---|---|---|
| 19 | The deletion URL was a public-origin placeholder followed by `/account/delete-request` | D5: `https://prilearning.com/delete-account`, which links to the form at `https://app.prilearning.com/account/delete-request`; `tools/store-readiness-check.mjs` now refuses the placeholder and holds store URLs to the D5 hosts |
| 20 | Email address said "unless the account signed up by phone" and "Required (email or phone)" | SMS is off at launch (D3): every account has an email address |
| 21 | The D18 erasure promise and the D17 prompt were not owner items here | §5 items 11 and 12 |

## 7. Play Console entry sheet

Type these answers in Play Console → **App content → Data safety**, in this order. Anything in
**[OWNER: …]** is a decision the code cannot make; answer it yourself and do not submit while one is
open. Everything else follows from §1–§4 above.

### Step 1 — Overview

Read the overview and press **Next**.

### Step 2 — Data collection and security

| Play Console question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** |
| Which of the following methods of account creation does your app support? | **Username and password**, **Username and other authentication** (one-time code by email). Not OAuth in the first submission: owner decision D3 ships email code and password only, with Sign in with Google and Apple arriving together in an update — tick OAuth when that update is the one being submitted. **[OWNER: confirm production `/v1/account/identity/providers` matches at submission]** |
| Account deletion URL / Add a link that users can use to request that their account and associated data is deleted | **`https://prilearning.com/delete-account`** (D5) **[OWNER: confirm D5 and that the page resolves]** |
| Do you provide a way for users to request that some or all of their data is deleted, without requiring them to delete their account? | **No** (deletion is whole-account; in-app Settings → Account → Delete). **[OWNER: answer Yes only if support will delete partial data on request]** |
| Has your app successfully completed an independent security review (MASA)? | **No** |

### Step 3 — Data types (tick these, leave every other box unticked)

- **Personal info:** Name; Email address; User IDs; Other info (not Phone number: SMS is off at launch, D3)
- **Financial info:** Purchase history
- **Photos and videos:** Photos
- **App activity:** App interactions; Other user-generated content; Other actions
- **App info and performance:** Crash logs; Diagnostics
- **Device or other IDs:** Device or other IDs

Not ticked: Location, Financial info → User payment info / Credit score / Other financial info,
Personal info → Phone number / Address / Race and ethnicity / Political or religious beliefs / Sexual orientation,
Health and fitness, Messages, Audio, Files and docs, Calendar, Contacts, App activity → Web
browsing / Installed apps / In-app search history, Web browsing.

### Step 4 — Data usage and handling (one form per ticked type)

Each type below: **"Is this data processed ephemerally?"**, **"Is this data required for your app, or
can users choose whether it's collected?"** and **"Why is this user data collected / shared?"**.
For every type: not used for advertising or marketing; not sold. "Shared" follows the conservative
choice in §2 (service providers declared). **[OWNER §5 item 3: if you take the service-provider
exemption, untick "Shared" for every row whose only recipient is OpenAI, Resend or the SMS
provider.]**

| Data type | Collected | Shared | Ephemeral? | Required / optional | Collected for | Shared for |
|---|---|---|---|---|---|---|
| Name | ✓ | — | No | Required | App functionality; Account management | — |
| Email address | ✓ | ✓ (Resend) | No | Required (SMS is off, so every account has an email address) | App functionality; Account management; Fraud prevention, security, and compliance **[OWNER §5 item 10]** | Account management; Fraud prevention, security, and compliance |
| User IDs | ✓ | — | No | Required | App functionality; Account management | — |
| Other info | ✓ | ✓ (Resend — guardian contact, child accounts only) | No | Required | App functionality; Account management | Account management |
| Purchase history | ✓ | — | No | Users can choose | App functionality | — |
| Photos | ✓ | ✓ (OpenAI) | **Yes** | Users can choose | App functionality | App functionality |
| App interactions | ✓ | — | No | Required | Analytics; App functionality | — |
| Other user-generated content | ✓ | ✓ (OpenAI) | No (the image is ephemeral; the transcription is kept 90 days, so answer No) | Required | App functionality | App functionality |
| Other actions | ✓ | — | No | Required | App functionality | — |
| Crash logs | ✓ | **[OWNER §5 item 8: — while `PRI_SENTRY_DSN` is unset; ✓ (Sentry) if set]** | No | Users can choose | Analytics | Analytics (only if shared) |
| Diagnostics | ✓ | — | No | Required | Analytics; App functionality | — |
| Device or other IDs | ✓ | — | No | Required | App functionality; Fraud prevention, security, and compliance | — |

### Step 5 — Preview and submit

Check the preview against §2 and §4. **Do not submit** while any of these is open: §5 items 1–12,
`docs/release/store/play-listing.md` §5 (target audience / Families), and the privacy-notice
rewrite. Submitting is the owner's action.
