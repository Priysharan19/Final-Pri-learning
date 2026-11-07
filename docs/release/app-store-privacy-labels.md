# App Store "App Privacy" (nutrition label) — answers derived from the code

**Status:** engineering draft, reconciled with the code on `main` at `a5778a319` (2026-11-02; first
reconciled at `7bef402f7`, 2026-10-18). **Not legally reviewed.** The 20 October handover records that
App Privacy was published in App Store Connect with 14 data types; that cannot be verified from the
repository and the live entry must be compared with §3 before submission. Every row cites the code
path that justifies it; a row marked **OWNER** is a decision the repository cannot make.

The machine-readable twin of this document is the privacy manifest
`ios/PriLearning.swiftpm/Resources/PrivacyInfo.xcprivacy` (byte-identical copy in
`ios/PriLearning 2.swiftpm/Resources/`, enforced by `scripts/check-native-package-sync.mjs` and
`tools/store-readiness-check.mjs`). The two must stay in step: if the code changes what leaves the
device, change this file, `docs/release/play-data-safety.md`, the manifest and
`docs/legal/privacy.md` together. Companions: `docs/privacy/data-retention.md`,
`docs/legal/counsel/COUNSEL-INFORMATION-PACK.md`.

Apple's definitions: **Collected** = transmitted off the device in a way that lets the developer
or its partners access it for longer than needed to service the request in real time. **Linked
to the user** = associated with the account. **Tracking** = linking with third-party data for
targeted advertising or advertising measurement, or sharing with a data broker.

## 0. What changed in this reconciliation (2026-11-02)

Two mismatches between this label, the Play Data safety form and the manifest are closed (§6):
coded crash reports are collected and were declared on Play but not here or in the manifest;
and the phone-number row described an SMS path that is off at launch (owner decision D3) and that
the shipped client does not show unless the server reports it live. The privacy notice was
corrected the same day and is no longer described here as outdated; it remains unreviewed by
counsel (`docs/legal/review-status.json`).

## 1. Headline answers

| App Store Connect question | Answer | Why (code) |
|---|---|---|
| Do you or your third-party partners collect data from this app? | **Yes** | Checking any answer needs a signed-in account and a connection: the server issues each question and grades it (`server/platform/practice.js`, `exams.js`). Sign-in, sync and reading also send data (`accounts.js`, `sync.js`, `handwriting.js`). A signed-out device can browse but nothing is marked and no `/v1` call carries user data (`client/src/platform/cloudTransport.js`). |
| Is any data used to track the user? | **No** | No advertising or analytics SDK; `NSPrivacyTracking = false`, empty `NSPrivacyTrackingDomains`; the client may reach only its own origin (`tools/check-client-network-boundary.mjs`). |
| Privacy policy URL | `<PRI_PUBLIC_ORIGIN>/privacy` (expected `https://prilearning.com/privacy` — **OWNER** confirms the production origin, decision D5). The notice was filled on 19 Oct and corrected against the code on 2 Nov 2026; it is **not yet reviewed by counsel** and says so above itself until `docs/legal/review-status.json` records a review. | `client/src/pages/Legal.jsx`, `docs/legal/privacy.md`. |
| Account deletion (Guideline 5.1.1(v)) | In-app for every sign-in method: Settings → Account → Delete cloud account (password, Apple/Google re-auth, or a fresh one-time code to the account's email). Also `<PRI_PUBLIC_ORIGIN>/account/delete-request` for someone without the app. Immediate; no grace period. | `CloudAccountSecurity.jsx` → `DELETE /v1/account`; `AccountDeleteRequest.jsx` → `/v1/account/otp/delete-request` + `/delete-confirm`; `server/test/account-deletion-public-check.mjs`. |
| Sign in with Apple (Guideline 4.8) | Present in the native shell (`ios/PriLearning.swiftpm/AppleSignInBridge.swift`) alongside Google. Owner decision D3: the first submission ships email code and password only, and Apple and Google arrive together in an update, so neither is offered and 4.8 is not engaged. **OWNER** confirms the production `/v1/account/identity/providers` answer matches before submission. | `client/src/platform/socialSignIn.js`, `server/platform/identities.js`, `oidc.js`. |
| Sharing personal data with third-party AI (Guideline 5.1.2(i), as the owner reads it — counsel to confirm) | Handwriting images and photos go to OpenAI; with the opt-in working check, working lines and question text too. Today: disclosure in Settings → Handwriting and the privacy notice; server reading is **on by default** for a signed-in adult. Owner default D17: a one-time prompt naming OpenAI before the first read or photo, with nothing sent until it is accepted and a declined path that stays typed-only — being built in the handwriting stream. Until it lands, this row and `privacy.md` describe default-on; when it lands, both change. | `client/src/ink/cloudReader.js` rule 1; `settings.cloudHandwritingCopy` in `client/src/i18n/strings.en.js`. |

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
| **Contact Info → Email Address** | Yes | `EmailAddress` | Resend (email delivery), for links and codes | `accounts.js`; `authDelivery.js`; `otpEmail.js`. Includes a guardian's email for a child's account (`guardianConsent.js`). |
| **Contact Info → Phone Number** | **No at launch** | — (removed 2026-11-02) | — | SMS sign-in and guardian phone codes are off at launch (owner decision D3). The shipped client shows the SMS option only when `GET /v1/account/otp/channels` reports `sms: true` (`SignUpFlow.jsx`, `AccountActivationGate.jsx`), which needs `PRI_SMS_PROVIDER`; both environments report `false`, and the notice describes no mobile-number route. **If SMS is ever turned on:** add `PhoneNumber` to both manifests, tick it here, add it to the Play form and to `docs/legal/privacy.md` in the same change, before the variable is set. |
| **Contact Info → Name** | Yes | `Name` | No | `accounts.name`; guardian name (`guardian_consents.guardian_name`). |
| **Contact Info → Physical Address, Other Contact Info** | No | — | — | Never asked for. |
| **Identifiers → User ID** | Yes | `UserID` | No (Apple receives only an opaque `appAccountToken` for StoreKit) | Opaque `acct_…` id (`security.js`). |
| **Identifiers → Device ID** | Yes (conservative) | `DeviceID` | No | A random per-install id the app generates (`cloudAccount.js` `device-<uuid>`), not IDFV/IDFA, stored with sessions and synced events; plus a SHA-256 of the user-agent (`security.js createSession`). |
| **Financial Info → Purchase History** | Yes, if the student subscribes | `PurchaseHistory` | No | `appleBilling.js`, `appleSignedData.js`; `billing_payments` retained unlinked after deletion (`data-retention.md` §2). |
| **Financial Info → Payment Info, Credit Info, Other Financial Info** | No | — | — | StoreKit handles payment; Pri stores provider ids and amounts only (`billingSchema.js`). |
| **User Content → Photos or Videos** | Yes | `PhotosorVideos` | **OpenAI**, `store: false`; the provider may retain for abuse monitoring under its own terms; Pri's server keeps no copy of the image | A camera photo of paper working (`practice.js` `/:id/recognize` mode `photo`, `questionPhoto`), or of a textbook question for "Practise this" (`server/platform/questionPhoto.js` → `questionPhotoProvider.js`). Camera only when the student opens the photo path (`client/src/pages/PractisePhoto.jsx`). |
| **User Content → Other User Content** | Yes | `OtherUserContent` | **OpenAI** for the handwriting image and, if the opt-in working check is on, the working lines with the question text; nothing else | (a) The rasterised image of Pencil/finger ink sent for reading (`client/src/ink/cloudRaster.js` → `/v1/handwriting/transcribe` or `/v1/practice/:id/recognize`; answer-blind: `FORBIDDEN_FIELDS`). (b) Typed answers and working submitted for server grading (`practice.js` grade; `exams.js` `exam-answers`). (c) The transcription text the server keeps with each recognition receipt and any student correction — **90 days** (`practice.js` scope `practice-recognition`, `MAX_AGE`). (d) Synced profile/settings/bookmarks/tasks/custom questions (`syncContract.js`). (e) Problem reports (`reports.js`). |
| **User Content → Audio, Emails or Text Messages, Gameplay Content** | No | — | — | No microphone, no messaging. |
| **User Content → Customer Support** | **OWNER / counsel** — this draft says No and counts problem reports under Other User Content | — | No | A problem report about a question carries free text the student types (`issue_reports.note`, `reports.js`; cleared on deletion). Whether Apple's "data generated by the user during a customer support request" covers it is undecided; ticking Customer Support as well is the conservative answer. |
| **Usage Data → Product Interaction** | Yes (not for a child until a guardian confirms) | `ProductInteraction` | No | `telemetry.js` events `feature-used`, `exam-completed`, `trial-started`, `subscription-state`; allow-listed metadata; 90-day retention. Purposes: Analytics, App Functionality. |
| **Usage Data → Other Usage Data** | Yes | `OtherUsageData` | No | Server-graded attempt records (`learning_events` kind `graded-attempt`: question id, correct, marks, subtopic, difficulty, mode, input mode) kept until account deletion; exam papers and results (`exams.js`, record TTL 5 years, deleted with the account). |
| **Usage Data → Advertising Data** | No | — | — | No ads. |
| **Diagnostics → Crash Data** | **Yes** (optional: per-device Settings → Crash reports switch, on by default for a signed-in account; blocked for a child until a guardian confirms) | `CrashData` (**added 2026-11-02**) | No while `PRI_SENTRY_DSN` is unset (the launch state); **OWNER:** if it is set, the coded report is forwarded to that Sentry project and Sentry must be named here, on Play and in the notice | Coded crash reports, `client/src/platform/telemetry.js` `reportCrash` (called from `ErrorBoundary.jsx`) → `POST /v1/telemetry/error` → `server/platform/telemetry.js` `cleanErrorReport`: platform, surface slug, an upper-case error code, scope, a hex fingerprint and the client build SHA — never the message, stack, URL or anything typed; stored as a `client-error` row for 90 days; optional server-side forward in `errorSink.js`. No crash SDK in the app. Matches Play's "Crash logs" row. |
| **Diagnostics → Performance Data** | Yes | `PerformanceData` | No | `telemetry.js` `performance-sample`. Purposes: Analytics, App Functionality. |
| **Diagnostics → Other Diagnostic Data** | Yes | `OtherDiagnosticData` | No | `telemetry.js` `client-error` (the row the crash report is stored as), `sync-failure`, `api-failure`, `recognition-failure`, `bad-question-opened`. |
| **Other Data** | Yes | `OtherDataTypes` | Guardian email → the delivery provider | The "18 or older" declaration (`accounts.age_basis`), class and track, and the guardian-consent record (method, notice version, times). |
| **Location, Health & Fitness, Sensitive Info, Contacts, Browsing History, Search History** | No | — | — | No such API; the client network boundary is its own origin. |

### Not collected (and why the label can say so)

- Handwriting **strokes** stay on the device (`client/src/local/idb.js`); only the rasterised
  image leaves, for reading.
- The **expected answer, solution and marks** never accompany anything sent for reading
  (`FORBIDDEN_FIELDS` in `handwriting.js`, `working.js`, `questionPhoto.js`).
- Passwords, session tokens and one-time codes are stored only as hashes.
- A **phone number**: see the row above; the path is off and hidden at launch.

### The AI tutor — **OWNER**

`server/platform/tutor.js` sends the question, its verified solution steps and the student's
message to the model provider. It is compiled out of production builds unless
`PRI_FEATURE_TUTOR=1` (`client/vite.config.js`); owner decision D4 keeps it off at launch. If it
is enabled, the "Other User Content → OpenAI" row grows to include tutor messages, the 2025 App
Store age-rating questions about AI assistants must be answered Yes, and `docs/legal/privacy.md`
needs a paragraph before release.

## 3. Required-reason APIs and other manifest facts

| Fact | Where | Enforced by |
|---|---|---|
| `NSPrivacyTracking = false`; no tracking domains | `ios/PriLearning.swiftpm/Resources/PrivacyInfo.xcprivacy` (+ mirror) | `tools/store-readiness-check.mjs` |
| Required-reason API: `UserDefaults` → `CA92.1` | same | same |
| Collected types after this reconciliation: EmailAddress, Name, UserID, DeviceID, PurchaseHistory, PhotosorVideos, OtherUserContent, ProductInteraction, OtherUsageData, CrashData, PerformanceData, OtherDiagnosticData, OtherDataTypes — all linked, none tracking | same | Held together by `tools/store-readiness-check.mjs` (CI: Suites policy and contracts): the manifest's collected types must equal the set on this line, and each needs a row in the table above. The same check holds crash data and the phone number to one answer across the code (`reportCrash` and `POST /v1/telemetry/error`), this file, both manifests and the Play form, and proves on every run that it catches each way of breaking that. |

Thirteen types. The handover's "14 published types" cannot be reconciled from here; if the live
entry has a fourteenth, it is either Phone Number (remove it unless SMS is turned on) or an entry
this document does not justify, and the live entry should be brought to this line, not the other
way round.

## 4. Owner decisions before the label is entered

1. Production origin for the privacy policy and deletion URLs (D5).
2. Counsel review of `docs/legal/privacy.md`, recorded in `docs/legal/review-status.json`.
3. Guideline 5.1.2(i): D17 (one-time OpenAI prompt) is the default; confirm it has landed in the
   release build, or that default-on plus disclosure is submitted knowingly.
4. Whether to tick Product Personalisation for server-side question selection (§2).
5. Whether problem-report free text is also declared as Customer Support (§2).
6. SMS stays off (D3); confirm `PRI_SMS_PROVIDER` is unset on production at submission.
7. Whether the AI tutor flag is on in production (D4 says off).
8. Whether a zero-data-retention arrangement exists with OpenAI (`data-retention.md` §4 records
   none); if one is made, the third-party cells and the notice change.
9. Whether `PRI_SENTRY_DSN` will be set on production; if so, Crash Data gains a third party.

## 5. Mismatches found and fixed on 2026-10-18

| # | Mismatch | Fix |
|---|---|---|
| 1 | Manifest lacked **PhotosorVideos**, yet a camera photo of working or of a question is sent to OpenAI; this file claimed the manifest declared it | Added to both manifests |
| 2 | Manifest lacked **PhoneNumber** (SMS sign-in, guardian phone code) | Added to both manifests (removed again on 2026-11-02, §6) |
| 3 | This file claimed the manifest declared **DeviceID**; it did not | Added (conservative) |
| 4 | This file claimed the manifest declared **OtherDataTypes** (age declaration, guardian record); it did not | Added |
| 5 | Product-interaction and performance telemetry were folded into OtherDiagnosticData only | Added **ProductInteraction** and **PerformanceData**; OtherDiagnosticData keeps the error/failure events |
| 6 | Manifest declares **OtherUsageData** (learning events); this file did not list it | Listed (§2) |
| 7 | Rows said "Marks are decided on the device before sync" and that question choice happens on the device | Rewritten: the server issues and grades every question (online-only grading) |
| 8 | Server-side retention of the **transcription text** (90 days with the recognition receipt) and of **exam answers/results** (5-year record TTL, deleted with the account) was not mentioned; "the server keeps no copy" was true only of the image | Stated in the Other User Content and Other Usage Data rows; `data-retention.md` idempotency row updated |
| 9 | "Practise this" (photo of a textbook question to OpenAI, `questionPhoto.js`) was not described | Added to the Photos row |
| 10 | Manifest path cited without `Resources/`; `scripts/store-readiness-check.mjs` cited as an enforcing check but does not exist | Paths corrected; `tools/store-readiness-check.mjs` now exists and runs in CI |
| 11 | Manifest comment on OtherUserContent said server reading is opt-in ("when the person switches on") and that the mark is decided on the device | Comment rewritten in both copies (on by default, switchable off; server engine decides) |

## 6. Mismatches found and fixed on 2026-11-02 (re-verified at `a5778a319`)

| # | Mismatch | Fix |
|---|---|---|
| 12 | **Crash Data** declared "No — no crash-reporting SDK", while the app has sent coded crash reports to `POST /v1/telemetry/error` since m365 and Play's Data safety declared Crash logs as collected | Crash Data → Yes, optional; `CrashData` added to both manifests with the Analytics and App Functionality purposes; the three documents now agree |
| 13 | **Phone Number** declared as collected for an SMS path that is off at launch (D3) and that the client hides unless the server reports it live; the notice described a mobile-number route that does not exist on either environment | Row → No at launch with the re-enable procedure; `PhoneNumber` removed from both manifests; Play form and notice changed the same way |
| 14 | The privacy-policy row called the notice "outdated" and the counsel pack §8 listed errors that were fixed on 19 Oct | Row rewritten: filled and corrected, unreviewed by counsel; the review state is `docs/legal/review-status.json` |
| 15 | Sign in with Apple row assumed both providers ship | Owner decision D3 recorded: neither in the first submission |
| 16 | The 5.1.2(i) row left the consent prompt as an open question | Owner default D17 recorded, with the fact that it is not yet in the code |

Re-verified and unchanged on 2026-11-02: the telemetry event allowlist (`EVENTS` / `TYPES`);
`FORBIDDEN_FIELDS` in `handwriting.js`, `working.js` and `questionPhoto.js`; `store: false` on every
provider call; the deletion routes; the client network boundary; `NSPrivacyTracking = false`.
