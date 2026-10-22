# App Store "App Privacy" (nutrition label) — answers derived from the code

**Status:** engineering draft, reconciled with the code on `main` at `7bef402f7` (2026-10-18,
Phase 6 preparation). **Not entered in App Store Connect, not legally reviewed.** Every row cites
the code path that justifies it; a row marked **OWNER** is a decision the repository cannot make.

The machine-readable twin of this document is the privacy manifest
`ios/PriLearning.swiftpm/Resources/PrivacyInfo.xcprivacy` (byte-identical copy in
`ios/PriLearning 2.swiftpm/Resources/`, enforced by `scripts/check-native-package-sync.mjs`). The
two must stay in step: if the code changes what leaves the device, change this file,
`docs/release/play-data-safety.md`, the manifest and `docs/legal/privacy.md` together.
Companions: `docs/privacy/data-retention.md`, `docs/legal/counsel/COUNSEL-INFORMATION-PACK.md`.

Apple's definitions: **Collected** = transmitted off the device in a way that lets the developer
or its partners access it for longer than needed to service the request in real time. **Linked
to the user** = associated with the account. **Tracking** = linking with third-party data for
targeted advertising or advertising measurement, or sharing with a data broker.

## 0. What changed in this reconciliation (2026-10-18)

The previous draft was written before online-only server grading (ADR-0001 amendment,
2026-10-10). The mismatches found and fixed are listed in §5. In short: the manifest was missing
six data types that the code collects; the draft claimed manifest entries that did not exist; and
several rows said marks are decided on the device, which is no longer true.

## 1. Headline answers

| App Store Connect question | Answer | Why (code) |
|---|---|---|
| Do you or your third-party partners collect data from this app? | **Yes** | Checking any answer needs a signed-in account and a connection: the server issues each question and grades it (`server/platform/practice.js`, `exams.js`). Sign-in, sync and reading also send data (`accounts.js`, `sync.js`, `handwriting.js`). A signed-out device can browse but nothing is marked and no `/v1` call carries user data (`client/src/platform/cloudTransport.js`). |
| Is any data used to track the user? | **No** | No advertising or analytics SDK; `NSPrivacyTracking = false`, empty `NSPrivacyTrackingDomains`; the client may reach only its own origin (`tools/check-client-network-boundary.mjs`). |
| Privacy policy URL | `<PRI_PUBLIC_ORIGIN>/privacy` (expected `https://prilearning.com/privacy` — **OWNER** confirms the production origin). The notice is **outdated** (see `COUNSEL-INFORMATION-PACK.md` §8) and must be rewritten and reviewed before this URL is entered. | `client/src/pages/Legal.jsx`, `docs/legal/privacy.md`. |
| Account deletion (Guideline 5.1.1(v)) | In-app for every sign-in method: Settings → Account → Delete cloud account (password, Apple/Google re-auth, or a fresh one-time code). Also `<PRI_PUBLIC_ORIGIN>/account/delete-request` for someone without the app. Immediate; no grace period. | `CloudAccountSecurity.jsx` → `DELETE /v1/account`; `AccountDeleteRequest.jsx` → `/v1/account/otp/delete-request` + `/delete-confirm`; `server/test/account-deletion-public-check.mjs`. |
| Sign in with Apple (Guideline 4.8) | Present in the native shell (`ios/PriLearning.swiftpm/AppleSignInBridge.swift`) alongside Google; **OWNER** confirms both are configured on the release build. | `client/src/platform/socialSignIn.js`, `server/platform/identities.js`, `oidc.js`. |
| Sharing personal data with third-party AI (Guideline 5.1.2(i), as the owner reads it — counsel to confirm) | Handwriting images and photos go to OpenAI; with the opt-in working check, working lines and question text too. Disclosure is in Settings → Handwriting and the privacy notice; server reading is **on by default** for a signed-in adult. **OWNER / counsel:** decide whether default-on plus disclosure is the "explicit permission" Apple asks for, or whether a one-time consent prompt is needed before the first read. | `client/src/ink/cloudReader.js` rule 1; `settings.cloudHandwritingCopy` in `client/src/i18n/strings.en.js`. |

## 2. Data types — what to tick, and under which purpose

Every collected type is **Linked to you** and **Not used to track you**. Purposes are **App
Functionality** unless the row adds **Analytics** (the allow-listed operational telemetry).
Nothing is used for Third-Party Advertising, Developer's Advertising or Marketing, and nothing for
Product Personalisation in Apple's cross-user sense. The server does choose each next question
(`practice.js chooseQuestion`) from the account's own attempt history; **OWNER / counsel:** decide
whether that is "Product Personalisation" for the label (it is per-account adaptivity, not a
profile shared or used for marketing). Declaring it is the conservative answer.

| Apple data type | Tick? | Manifest type | Third party receives it | Why (code) |
|---|---|---|---|---|
| **Contact Info → Email Address** | Yes | `EmailAddress` | Resend (email delivery), for links and codes | `accounts.js`; `authDelivery.js`; `otpEmail.js`. Includes a guardian's email for a child's account (`guardianConsent.js`), and a parent's email for the Premium weekly report (`parentReport.js`, `parent_report_links`; double opt-in; Resend delivers the confirmation and the weekly report). |
| **Contact Info → Phone Number** | Yes | `PhoneNumber` (**added**) | SMS provider (MSG91 or Twilio Verify — **OWNER** names the live one) | `otp.js` (`account_phones`), guardian phone code (`GUARDIAN_PHONE_METHOD`), `smsProvider.js`. Collected only when `PRI_SMS_PROVIDER` is configured; declared because the shipped client offers the path. |
| **Contact Info → Name** | Yes | `Name` | No | `accounts.name`; guardian name (`guardian_consents.guardian_name`). |
| **Contact Info → Physical Address, Other Contact Info** | No | — | — | Never asked for. |
| **Identifiers → User ID** | Yes | `UserID` | No (Apple receives only an opaque `appAccountToken` for StoreKit) | Opaque `acct_…` id (`security.js`). |
| **Identifiers → Device ID** | Yes (conservative) | `DeviceID` (**added**) | No | A random per-install id the app generates (`cloudAccount.js` `device-<uuid>`), not IDFV/IDFA, stored with sessions and synced events; plus a SHA-256 of the user-agent (`security.js createSession`). |
| **Financial Info → Purchase History** | Yes, if the student subscribes | `PurchaseHistory` | No | `appleBilling.js`, `appleSignedData.js`; `billing_payments` retained unlinked after deletion (`data-retention.md` §2). |
| **Financial Info → Payment Info, Credit Info, Other Financial Info** | No | — | — | StoreKit handles payment; Pri stores provider ids and amounts only (`billingSchema.js`). |
| **User Content → Photos or Videos** | Yes | `PhotosorVideos` (**added**) | **OpenAI**, `store: false`; the provider may retain for abuse monitoring under its own terms; Pri's server keeps no copy of the image | A camera photo of paper working (`practice.js` `/:id/recognize` mode `photo`, `questionPhoto`), or of a textbook question for "Practise this" (`server/platform/questionPhoto.js` → `questionPhotoProvider.js`). Camera only when the student opens the photo path (`client/src/pages/PractisePhoto.jsx`). |
| **User Content → Other User Content** | Yes | `OtherUserContent` | **OpenAI** for the handwriting image and, if the opt-in working check is on, the working lines with the question text; nothing else | (a) The rasterised image of Pencil/finger ink sent for reading (`client/src/ink/cloudRaster.js` → `/v1/handwriting/transcribe` or `/v1/practice/:id/recognize`; answer-blind: `FORBIDDEN_FIELDS`). (b) Typed answers and working submitted for server grading (`practice.js` grade; `exams.js` `exam-answers`). (c) The transcription text the server keeps with each recognition receipt and any student correction — **90 days** (`practice.js` scope `practice-recognition`, `MAX_AGE`). (d) Synced profile/settings/bookmarks/tasks/custom questions (`syncContract.js`). (e) Problem reports (`reports.js`). |
| **User Content → Audio, Emails or Text Messages, Gameplay Content** | No | — | — | No microphone, no messaging. |
| **User Content → Customer Support** | **OWNER / counsel** — this draft says No and counts problem reports under Other User Content | — | No | A problem report about a question carries free text the student types (`issue_reports.note`, `reports.js`; cleared on deletion). Whether Apple's "data generated by the user during a customer support request" covers it is undecided; ticking Customer Support as well is the conservative answer. |
| **Usage Data → Product Interaction** | Yes (not for a child until a guardian confirms) | `ProductInteraction` (**added**) | No | `telemetry.js` events `feature-used`, `exam-completed`, `trial-started`, `subscription-state`; allow-listed metadata; 90-day retention. Purposes: Analytics, App Functionality. |
| **Usage Data → Other Usage Data** | Yes | `OtherUsageData` | No | Server-graded attempt records (`learning_events` kind `graded-attempt`: question id, correct, marks, subtopic, difficulty, mode, input mode) kept until account deletion; exam papers and results (`exams.js`, record TTL 5 years, deleted with the account). |
| **Usage Data → Advertising Data** | No | — | — | No ads. |
| **Diagnostics → Performance Data** | Yes | `PerformanceData` (**added**) | No | `telemetry.js` `performance-sample`. Purposes: Analytics, App Functionality. |
| **Diagnostics → Other Diagnostic Data** | Yes | `OtherDiagnosticData` | No | `telemetry.js` `client-error`, `sync-failure`, `api-failure`, `recognition-failure`, `bad-question-opened`. |
| **Diagnostics → Crash Data** | No | — | — | No crash-reporting SDK. **OWNER:** if MetricKit/Crashlytics is added, declare it. |
| **Other Data** | Yes | `OtherDataTypes` (**added**) | Guardian email/phone → the delivery provider; the weekly report's aggregate summary → the email provider (Resend), to the confirmed parent only | The "18 or older" declaration (`accounts.age_basis`), class and track, the guardian-consent record (method, notice version, times), and the parent weekly report's link state and per-week send ledger (`parent_report_links`, `parent_report_sends`: status, times, skip reason, provider message id). The report itself is computed from existing graded-attempt rows and not stored. **No new Apple data type**: the report adds a recipient Email Address (already ticked) and derives everything else from Other Usage Data (already ticked). |
| **Location, Health & Fitness, Sensitive Info, Contacts, Browsing History, Search History** | No | — | — | No such API; the client network boundary is its own origin. |

### Not collected (and why the label can say so)

- Handwriting **strokes** stay on the device (`client/src/local/idb.js`); only the rasterised
  image leaves, for reading.
- The **expected answer, solution and marks** never accompany anything sent for reading
  (`FORBIDDEN_FIELDS` in `handwriting.js`, `working.js`, `questionPhoto.js`).
- Passwords, session tokens and one-time codes are stored only as hashes.

### The AI tutor — **OWNER**

`server/platform/tutor.js` sends the question, its verified solution steps and the student's
message to the model provider. It is compiled out of production builds unless
`PRI_FEATURE_TUTOR=1` (`client/vite.config.js`). If it is enabled, the "Other User Content →
OpenAI" row grows to include tutor messages, the 2025 App Store age-rating questions about AI
assistants must be answered Yes, and `docs/legal/privacy.md` needs a paragraph before release.

## 3. Required-reason APIs and other manifest facts

| Fact | Where | Enforced by |
|---|---|---|
| `NSPrivacyTracking = false`; no tracking domains | `ios/PriLearning.swiftpm/Resources/PrivacyInfo.xcprivacy` (+ mirror) | `scripts/check-native-package-sync.mjs` (identity of the two copies only) |
| Required-reason API: `UserDefaults` → `CA92.1` | same | same |
| Collected types after this reconciliation: EmailAddress, PhoneNumber, Name, UserID, DeviceID, PurchaseHistory, PhotosorVideos, OtherUserContent, ProductInteraction, OtherUsageData, PerformanceData, OtherDiagnosticData, OtherDataTypes — all linked, none tracking | same | Held together by `tools/store-readiness-check.mjs` (CI: Suites policy and contracts): the manifest's collected types must equal the set on this line, and each needs a row in the table above. |

## 4. Owner decisions before the label is entered

1. Production origin for the privacy policy and deletion URLs.
2. Rewrite and counsel review of `docs/legal/privacy.md` (it still says marking runs on the device).
3. Guideline 5.1.2(i): whether default-on server reading needs an explicit first-use consent.
4. Whether to tick Product Personalisation for server-side question selection (§2).
4a. Whether problem-report free text is also declared as Customer Support (§2).
5. Which SMS provider is live (phone-number row), or confirm SMS is off.
6. Whether the AI tutor flag is on in production.
7. Whether a zero-data-retention arrangement exists with OpenAI (`data-retention.md` §4 records
   none); if one is made, the third-party cells and the notice change.

## 5. Mismatches found and fixed on 2026-10-18

| # | Mismatch | Fix |
|---|---|---|
| 1 | Manifest lacked **PhotosorVideos**, yet a camera photo of working or of a question is sent to OpenAI; this file claimed the manifest declared it | Added to both manifests |
| 2 | Manifest lacked **PhoneNumber** (SMS sign-in, guardian phone code) | Added to both manifests |
| 3 | This file claimed the manifest declared **DeviceID**; it did not | Added (conservative) |
| 4 | This file claimed the manifest declared **OtherDataTypes** (age declaration, guardian record); it did not | Added |
| 5 | Product-interaction and performance telemetry were folded into OtherDiagnosticData only | Added **ProductInteraction** and **PerformanceData**; OtherDiagnosticData keeps the error/failure events |
| 6 | Manifest declares **OtherUsageData** (learning events); this file did not list it | Listed (§2) |
| 7 | Rows said "Marks are decided on the device before sync" and that question choice happens on the device | Rewritten: the server issues and grades every question (online-only grading) |
| 8 | Server-side retention of the **transcription text** (90 days with the recognition receipt) and of **exam answers/results** (5-year record TTL, deleted with the account) was not mentioned; "the server keeps no copy" was true only of the image | Stated in the Other User Content and Other Usage Data rows; `data-retention.md` idempotency row updated |
| 9 | "Practise this" (photo of a textbook question to OpenAI, `questionPhoto.js`) was not described | Added to the Photos row |
| 10 | Manifest path cited without `Resources/`; `scripts/store-readiness-check.mjs` cited as an enforcing check but does not exist | Paths corrected; check gap recorded as a follow-up |
| 11 | Manifest comment on OtherUserContent said server reading is opt-in ("when the person switches on") and that the mark is decided on the device | Comment rewritten in both copies (on by default, switchable off; server engine decides) |
