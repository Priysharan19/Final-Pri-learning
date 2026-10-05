# Google Play Data safety form — answers derived from the code

**Status:** engineering draft, derived from the code on the branch that adds it. **Not submitted,
not legally reviewed.** Every row cites the code path that justifies it; a row marked **OWNER**
is a decision the repository cannot make. Companion documents: `docs/release/STORE_READINESS.md`
(CP-12; the iOS privacy manifest and the readiness checks), `docs/legal/privacy.md` (what the
reader is told), `docs/privacy/data-retention.md` (what the server keeps and for how long),
`docs/release/app-store-privacy-labels.md` (the Apple equivalent of this form).

If the code changes what leaves the device, change this file, the privacy notice and
`PrivacyInfo.xcprivacy` together. The notice is held to the code by
`client/test/legal-pages-check.mjs`; this file is not machine-checked.

The Android shell is post-V1 (`docs/release/PRI_V1_RELEASE_SCOPE.md` §18 freezes V1 to iPad).
Nothing here changes that; the form is prepared so the answers are ready and true when the owner
lifts the freeze.

## 1. Overview questions

| Play question | Answer | Why (code) |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | A cloud account sends data to the Pri server (`server/platform/accounts.js`, `sync.js`, `handwriting.js`). Without an account nothing is sent (`client/src/platform/cloudTransport.js` refuses with `CLOUD_DISABLED` when no origin/session). |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | Server enforces HTTPS/HSTS in production (`server/platform/headers.js`, `server/test/security-headers-check.mjs`); Android manifest refuses cleartext (`android/app/src/main/AndroidManifest.xml`, checked by `scripts/store-readiness-check.mjs`). |
| Do you provide a way for users to request that their data is deleted? | **Yes** | In-app: Settings → Account → Delete (`client/src/components/CloudAccountSecurity.jsx` → `DELETE /v1/account`, every sign-in method). Public URL (required by this form): **`<PRI_PUBLIC_ORIGIN>/account/delete-request`** (`client/src/pages/AccountDeleteRequest.jsx` → `POST /v1/account/otp/delete-request` + `/delete-confirm`, `server/platform/otp.js`). Deletion is immediate (`deleteAccountRows()` in `server/platform/accounts.js`; `docs/privacy/data-retention.md` §1–2). |
| Account deletion URL | **OWNER:** the production origin is not in the repository. The path is fixed: `/account/delete-request`. | `client/src/main.jsx` renders the page outside the router; `server/app.js` serves the SPA for any non-`/v1` path. |
| Is your app a "news app" / does it use the Play Families policy? | **OWNER** — Pri is used by children (Classes 7–12) and must be reviewed against the Families policy / Designed for Families requirement by the owner. | Child accounts are gated server-side until a guardian confirms (`server/platform/guardianConsent.js`, `requireGuardianConsent` in `router.js`); the consent is not DPDP-verifiable (`docs/release/otp-sign-in.md`). |

## 2. Data types collected

"Collected" = sent off the device to the Pri server. "Shared" = passed by the Pri server to a third
party. Every type below is **linked to the account** (the server stores it against `account_id`),
**not used for tracking** (no advertising SDK, no analytics SDK, no tracking domains —
`tools/check-client-network-boundary.mjs`, `scripts/store-readiness-check.mjs`), and **required
for the feature** rather than optional, except where the row says the user can turn it off.

| Play data type | Collected? | Shared? | Purpose (Play category) | Why (code) |
|---|---|---|---|---|
| **Personal info → Email address** | Yes, with a cloud account | With the email delivery provider (Resend) for verification/reset links and one-time codes | Account management | `accounts.js` register/login; `authDelivery.js`; `otpEmail.js` (`PRI_AUTH_EMAIL_PROVIDER`). |
| **Personal info → Phone number** | Yes, if the student signs in by SMS code | With the SMS provider (MSG91 or Twilio Verify, whichever the owner configures) | Account management | `otp.js` (`account_phones.phone_e164`), `smsProvider.js`. Stored in clear (E.164) so a reauth code can be sent; the OTP challenge itself holds only an HMAC of the destination (`otpCore.js`). |
| **Personal info → Name** | Yes, with a cloud account | No | App functionality | `accounts.email`/`name` (`accounts.js`); sync profile (`client/src/platform/syncWorker.js` `safeProfile`). |
| **Personal info → User IDs** | Yes | No | Account management, app functionality | Opaque `acct_…` id (`security.js id()`); never an advertising id. |
| **Personal info → Other info** (a parent/guardian's name and email **or phone**; the student's "18 or older" declaration; class/track) | Yes, for an under-18 account | Guardian email/phone with the delivery provider, to send the consent link/code | App functionality (legal compliance: DPDP guardian confirmation) | `guardianConsent.js` (`guardian_consents.guardian_name/guardian_email/guardian_phone`), `accounts.age_basis`. |
| **Financial info → Purchase history** | Yes, if the student subscribes | No (the provider tells Pri; Pri does not tell the provider anything but an opaque account token) | App functionality | `billing.js`, `razorpay.js`, `appleBilling.js`, `googleBilling.js`; `billing_payments` retained unlinked after deletion (`data-retention.md` §2). Card details never reach Pri. |
| **Financial info → Payment info** | **No** | — | — | Checkout happens at Razorpay / Google Play / App Store; the server stores only provider ids and amounts (`billingSchema.js`). |
| **App activity → App interactions** | Yes (allow-listed telemetry; off until a guardian confirms for a child) | No | Analytics (operational), app functionality | `server/platform/telemetry.js`: exactly `client-error, sync-failure, api-failure, recognition-failure, bad-question-opened, exam-completed, feature-used, trial-started, subscription-state, performance-sample` with an allow-listed metadata key set; 90-day retention (`RETENTION_MS`). |
| **App activity → Other user-generated content** (handwriting image; photo of paper working; typed working lines; problem reports) | Yes, with a cloud account; handwriting/photo reading can be turned off in Settings → Handwriting; working check is opt-in | **Yes — with OpenAI** (the image / the working and question text), `store: false`, provider may retain for abuse monitoring under its own terms | App functionality | `client/src/ink/cloudRaster.js` → `POST /v1/handwriting/transcribe` (`handwriting.js`, answer-blind: `FORBIDDEN_FIELDS`) → `handwritingProvider.js` (`PRI_HANDWRITING_ENDPOINT`, default `api.openai.com`); `working.js` → `workingProvider.js`; `questionPhoto.js`. The Pri server keeps **no copy** (`data-retention.md` §4). Problem reports: `issue_reports` (`reports.js`), free text cleared on deletion. |
| **App activity → Other actions** (learning events: attempts, marks, chapter, time taken; exam attempts; progress) | Yes, with a cloud account | No | App functionality (cross-device sync) | `sync.js` (`learning_events`, `sync_entities`), entity kinds in `client/src/platform/syncContract.js`. Marks are decided on the device before they are synced. |
| **Device or other IDs** | Yes | No | App functionality (sessions, per-device sync) | A random per-install id the app generates (`client/src/platform/cloudAccount.js` `device-<uuid>`), **not** the Android ID / advertising ID; plus a SHA-256 of the user-agent string (`security.js createSession`). |
| **Photos and videos** | Yes, only when the student attaches a photo of paper working | **Yes — with OpenAI** (the photo, resized) | App functionality | `client/src/pages/PractisePhoto.jsx` / `client/src/native/photo.js`; `questionPhoto.js` (answer-blind); the whole frame is sent (`docs/legal/privacy.md`). Camera permission is only requested in the native shells when the student opens the photo path. |
| **Location** | **No** | — | — | No location API is used; `android/app/src/main/AndroidManifest.xml` asks for INTERNET only (`store-readiness-check`). |
| **Contacts, Calendar, Messages, Audio, Files & docs, Health, Web browsing, Installed apps** | **No** | — | — | None of these APIs are used; the client network boundary allows only the Pri origin (`tools/check-client-network-boundary.mjs`). "Files" is not collected: a student may import a PDF for photo reading, which is handled as a photo above, and export their own data to a file (`GET /v1/account/export`). |
| **Crash logs / Diagnostics** | Partly — the `client-error` and `performance-sample` telemetry types above; no third-party crash SDK | No | Analytics | `telemetry.js`; no stack traces or device fingerprints beyond the allow-listed keys. **OWNER:** if Firebase Crashlytics / Play vitals beyond the default are added to the shell later, this row changes. |

### Data not sent at all (so not declared)

- Handwriting **strokes**, the on-device personal handwriting model, local profiles and local
  progress stay in the device's IndexedDB (`client/src/local/idb.js`). Only a rasterised PNG can
  leave, and only for server reading (`cloudRaster.js`).
- The **expected answer / solution / marks** never leave the device with handwriting or working
  (`handwriting.js`, `working.js`, `questionPhoto.js` `FORBIDDEN_FIELDS`; `HANDWRITING_NOT_ANSWER_BLIND`).
- Passwords (bcrypt hash only), session tokens (SHA-256 only), one-time codes (HMAC only).

### The AI tutor (`/v1/tutor`) — **OWNER**

`server/platform/tutor.js` sends the question prompt, its verified solution steps and the answer
to the model provider when the student asks for a hint. It is behind `PRI_FEATURE_TUTOR` and
**dark by default in a production build** (`client/test/tour-ai-tutor.js`). If the owner enables
it, "Other user-generated content → shared with OpenAI" above also covers the question text, and
`docs/legal/privacy.md` must gain a paragraph for it before release.

## 3. Data handling practices

| Play question | Answer | Why (code) |
|---|---|---|
| Is this data processed ephemerally? | Handwriting image, photo, working text: **yes on Pri's server** (held in memory for the request only, `handwritingProvider.js`; `data-retention.md` §4). Everything else: **no** (stored against the account until deletion). | — |
| Is this data required or optional? | Email **or** phone, name, user id, device id: **required** for a cloud account. Handwriting/photo reading: **optional** (`settings.cloudHandwriting`, on by default once signed in, switchable off). Working check: **optional** (opt-in). Telemetry: required for a signed-in adult; blocked for a child until consent. Guardian details: required for an under-18 account. Purchase history: only if the student subscribes. | `client/src/pages/Settings.jsx`, `requireGuardianConsent` (`router.js`). |
| Can users request deletion? | **Yes** — see §1; immediate; `docs/privacy/data-retention.md` §2 lists the three retained, unlinked categories (payment ledger, de-texted problem reports, an `account.delete` audit row). | `deleteAccountRows()`; `server/test/account-lifecycle-journey-check.mjs`; `server/test/account-deletion-public-check.mjs`. |
| Independent security review? | **No** (not claimed). | `docs/security/acceptance.md` is internal. **OWNER:** commission one before claiming the badge. |

## 4. Third parties the server shares with (for the "shared" answers)

| Party | What | Code | Configured by |
|---|---|---|---|
| OpenAI (default endpoint; configurable) | Handwriting image; photo of paper; working lines + question text; (tutor, if enabled) | `handwritingProvider.js`, `workingProvider.js`, `questionPhotoProvider.js`, `tutorProvider.js` | `PRI_HANDWRITING_ENDPOINT`, server env only |
| Resend (email) | Address + message for verification/reset/consent links and codes | `authDelivery.js`, `otpEmail.js` | `PRI_AUTH_EMAIL_PROVIDER`, `PRI_RESEND_API_KEY` |
| MSG91 or Twilio Verify (SMS) | Phone number + code message | `smsProvider.js` | `PRI_SMS_PROVIDER` — **OWNER** picks one (`docs/release/otp-sign-in.md`) |
| Razorpay / Google Play Billing / App Store | Subscription state; an opaque account token | `razorpay.js`, `googleBilling.js`, `appleBilling.js` | billing env |
| Supabase (Mumbai) | The database itself, as a processor | `docs/architecture/adr-0001-online-first-runtime.md` | `PRI_DATABASE_URL` |
| Railway | Hosting, request logs (method, path, status, latency — no bodies, no emails) | `server/app.js requestLogger`; `security-headers-check.mjs` | deployment |

No advertising network, no analytics SDK, no social SDK runs in the client
(`tools/check-client-network-boundary.mjs`; Google/Apple sign-in use the providers' own
identity endpoints only when the student taps them, `client/src/platform/socialSignIn.js`).

## 5. Owner decisions before submission

1. The production origin for the deletion URL (§1).
2. Families policy / target audience declaration (§1).
3. Which SMS provider is live, so the "shared with" party is named correctly (§4).
4. Whether the AI tutor flag is on in production (§2).
5. Whether a zero-data-retention arrangement exists with OpenAI (`data-retention.md` §4 says none is
   recorded); if one is made, the "shared" rows and the notice change.
6. Legal review of `docs/legal/privacy.md` and the placeholders (`node tools/legal-status.mjs`).
