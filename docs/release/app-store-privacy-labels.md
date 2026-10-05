# App Store "App Privacy" (nutrition label) — answers derived from the code

**Status:** engineering draft, derived from the code on the branch that adds it. **Not entered in
App Store Connect, not legally reviewed.** Every row cites the code path that justifies it; a row
marked **OWNER** is a decision the repository cannot make. The machine-readable twin of this
document is the privacy manifest `ios/PriLearning.swiftpm/PrivacyInfo.xcprivacy` (PR #304 /
CP-12), which `scripts/store-readiness-check.mjs` holds to a fixed set of data types; the two must
stay in step. Companions: `docs/release/play-data-safety.md` (the Play form),
`docs/release/STORE_READINESS.md`, `docs/legal/privacy.md`, `docs/privacy/data-retention.md`.

Apple's definitions: **Collected** = transmitted off the device in a way that identifies the user,
or linked to them server-side. **Linked to the user** = associated with the account. **Tracking** =
linking with third-party data for advertising or sharing with data brokers. **Third-party data
sharing** is declared inside each type.

## 1. Headline answers

| App Store Connect question | Answer | Why (code) |
|---|---|---|
| Do you or your third-party partners collect data from this app? | **Yes** | A cloud account sends data to the Pri server (`server/platform/accounts.js`, `sync.js`, `handwriting.js`). Without an account the client makes no `/v1` call that carries user data (`client/src/platform/cloudTransport.js`). |
| Is any data used to track the user? | **No** | No advertising/analytics SDK; `NSPrivacyTracking = false` and an empty `NSPrivacyTrackingDomains` (`PrivacyInfo.xcprivacy`, enforced by `store-readiness-check`); the client may reach only its own origin (`tools/check-client-network-boundary.mjs`). |
| Privacy policy URL | `<PRI_PUBLIC_ORIGIN>/privacy` (EN; the page offers Hindi). **OWNER:** production origin; the placeholders must be filled and the notice reviewed first (`node tools/legal-status.mjs`). | `client/src/pages/Legal.jsx`, `docs/legal/privacy.md`, `client/test/legal-pages-check.mjs`. |
| Account deletion (Guideline 5.1.1(v)) | In-app for every sign-in method: Settings → Account → Delete cloud account — password, Apple/Google re-auth, or a fresh one-time code to the account's own email/phone. Also at `<PRI_PUBLIC_ORIGIN>/account/delete-request` for someone without the app. Immediate; no grace period. | `client/src/components/CloudAccountSecurity.jsx` → `DELETE /v1/account` (`accounts.js authorizeAccountDeletion`); `client/src/pages/AccountDeleteRequest.jsx` → `POST /v1/account/otp/delete-request` + `/delete-confirm` (`otp.js`); `deleteAccountRows()`; `server/test/account-deletion-public-check.mjs`; `client/test/tour-account-deletion.js`. |
| Sign in with Apple (Guideline 4.8) | Offered on the web; **OWNER:** confirm the native iPad shell exposes it, since the app also offers Google sign-in. | `client/src/platform/socialSignIn.js`, `server/platform/identities.js`, `oidc.js`. |

## 2. Data types — what to tick, and under which purpose

All collected types below are **Linked to you** and **not used for tracking**. The only purpose
is **App Functionality** (sign-in, sync, reading, billing). Nothing is used for Third-Party
Advertising, Developer's Advertising, Analytics-for-marketing, or Product Personalisation in
Apple's sense (choosing the next maths question is done on the device from the local attempt
ledger, `client/src/engine/`, and is not a cross-user profile).

| Apple data type | Collect? | Manifest type (`PrivacyInfo.xcprivacy`) | Third party receives it? | Why (code) |
|---|---|---|---|---|
| **Contact Info → Email Address** | Yes, with a cloud account | `NSPrivacyCollectedDataTypeEmailAddress` | Email delivery provider (Resend), to send links/codes | `accounts.js`; `authDelivery.js`; `otpEmail.js`. |
| **Contact Info → Phone Number** | Yes, if the student signs in by SMS code | **Not yet in the manifest — OWNER / follow-up:** add `NSPrivacyCollectedDataTypePhoneNumber` (App Functionality, linked, no tracking) to `PrivacyInfo.xcprivacy` and `scripts/store-readiness-check.mjs` when the SMS sign-in is enabled for the iPad build | SMS provider (MSG91 / Twilio Verify) | `otp.js` (`account_phones`), `smsProvider.js`. Only if `PRI_SMS_PROVIDER` is configured; otherwise phone codes answer 503 and no number is ever collected. |
| **Contact Info → Name** | Yes, with a cloud account | `NSPrivacyCollectedDataTypeName` | No | `accounts.name`; sync profile (`syncWorker.js safeProfile`). |
| **Contact Info → Physical Address** | **No** | — | — | Never asked for. Payment providers handle any billing address. |
| **Identifiers → User ID** | Yes | `NSPrivacyCollectedDataTypeUserID` | No | Opaque `acct_…` id (`security.js`). |
| **Identifiers → Device ID** | Yes | `NSPrivacyCollectedDataTypeDeviceID` | No | A random per-install id the app generates (`cloudAccount.js` `device-<uuid>`), **not** IDFV/IDFA; plus a SHA-256 of the user-agent string (`security.js createSession`). |
| **Financial Info → Purchase History** | Yes, if the student subscribes | `NSPrivacyCollectedDataTypePurchaseHistory` | No (StoreKit tells Pri via the App Store Server API; Pri sends Apple only an opaque `appAccountToken`) | `appleBilling.js`, `appleSignedData.js`, `billing_apple_accounts`; `billing_payments` retained unlinked after deletion (`data-retention.md` §2). |
| **Financial Info → Payment Info** | **No** | — | — | Checkout happens in StoreKit / at Razorpay; Pri stores provider ids and amounts only (`billingSchema.js`). |
| **User Content → Other User Content** (learning events: attempts, marks, chapter, time taken; synced profile/settings/bookmarks/tasks/custom questions; problem reports; typed working lines) | Yes, with a cloud account; working check is opt-in | `NSPrivacyCollectedDataTypeOtherUserContent` | Working lines + question text → OpenAI, only while the opt-in working check is on | `sync.js`, `client/src/platform/syncContract.js`; `reports.js`; `working.js` → `workingProvider.js` (`store: false`). Marks are decided on the device before sync. |
| **User Content → Photos or Videos** (a photo of paper working; and the rasterised image of Pencil ink, which Apple's categories fit best here) | Yes, when server reading is on (default on for a signed-in account; switchable off in Settings → Handwriting; off for an under-18 account until a guardian confirms) | `NSPrivacyCollectedDataTypePhotosorVideos` | **Yes — OpenAI** (default `api.openai.com`, `PRI_HANDWRITING_ENDPOINT`), `store: false`; the provider may retain for abuse monitoring under its own terms; Pri's server keeps no copy | `client/src/ink/cloudRaster.js` → `POST /v1/handwriting/transcribe` (`handwriting.js`, answer-blind) → `handwritingProvider.js`; `questionPhoto.js`/`questionPhotoProvider.js`; `data-retention.md` §4. Camera access is requested only when the student opens the photo path (`client/src/native/photo.js`). |
| **User Content → Audio Data, Emails or Text Messages, Gameplay Content, Customer Support** | **No** | — | — | No microphone, no messaging, no in-app support chat. The grievance address is an email the student writes to themselves (`docs/legal/grievance.md`). |
| **Usage Data → Product Interaction** | Yes (allow-listed telemetry; not for a child until consent) | `NSPrivacyCollectedDataTypeOtherDataTypes` covers it in the current manifest; **OWNER:** decide whether to declare `ProductInteraction` explicitly instead | No | `server/platform/telemetry.js`: ten event types, allow-listed metadata keys, 90-day retention. |
| **Usage Data → Advertising Data, Other Usage Data** | **No** | — | — | No ads; nothing beyond the allow-list is accepted (`TELEMETRY_EVENT_UNSUPPORTED`). |
| **Diagnostics → Crash Data / Performance Data** | Partly, through the `client-error` and `performance-sample` telemetry types; no crash-reporting SDK | within `OtherDataTypes` as above | No | `telemetry.js`. **OWNER:** if MetricKit/Crashlytics is added to the shell, declare Crash Data. |
| **Other Data** (a parent/guardian's name and email or phone; the "18 or older" declaration; class and track) | Yes, for an under-18 account | `NSPrivacyCollectedDataTypeOtherDataTypes` | Guardian email/phone → delivery provider, to send the consent link/code | `guardianConsent.js`; `accounts.age_basis`; `syncWorker.js safeProfile`. |
| **Location, Health & Fitness, Sensitive Info, Contacts, Browsing History, Search History** | **No** | — | — | No such API is used; the client's network boundary is its own origin only. |

### Not collected (and why the label can say so)

- Handwriting **strokes** and the personal handwriting model never leave the device
  (`client/src/local/idb.js`; only `cloudRaster.js`'s PNG does, and only for server reading).
- The **expected answer, solution and marks** never accompany anything sent for reading
  (`FORBIDDEN_FIELDS` in `handwriting.js`, `working.js`, `questionPhoto.js`).
- Passwords, session tokens and one-time codes are stored only as hashes (`accounts.js`,
  `security.js`, `otpCore.js`).
- Local profiles, progress and ink stay in IndexedDB and are deleted from Settings on the device,
  not by the server (`data-retention.md` §2 "Not deleted by account deletion").

### The AI tutor — **OWNER**

`server/platform/tutor.js` sends the question prompt, its verified solution steps and the answer to
the model provider when the student asks for a hint; it is behind `PRI_FEATURE_TUTOR` and dark by
default in a production build (`client/test/tour-ai-tutor.js`). If enabled, "Other User Content →
shared with OpenAI" grows to include the question text and `docs/legal/privacy.md` needs a paragraph
for it before release.

## 3. Required-reason APIs and other manifest facts

| Fact | Where | Enforced by |
|---|---|---|
| `NSPrivacyTracking = false`; no tracking domains | `ios/PriLearning.swiftpm/PrivacyInfo.xcprivacy` (+ the `PriLearning 2` mirror) | `scripts/store-readiness-check.mjs`, `scripts/check-native-package-sync.mjs` |
| Required-reason API: `UserDefaults` → `CA92.1` (the app's own settings) | same | same |
| Collected types in the manifest today: EmailAddress, Name, UserID, DeviceID, OtherDataTypes, PurchaseHistory, OtherUserContent, PhotosorVideos — each App Functionality, linked, no tracking | same | same |
| **Gap:** PhoneNumber is not declared; see §2 | — | **OWNER / follow-up** before shipping SMS sign-in on iPad |

## 4. Owner decisions before the label is entered

1. Production origin for the privacy policy and deletion URLs.
2. Add `PhoneNumber` to the manifest and the readiness check if SMS sign-in ships on iPad (§2).
3. Whether to declare `ProductInteraction`/`CrashData` explicitly rather than under
   `OtherDataTypes` (§2).
4. Whether the AI tutor flag is on in production (§2).
5. Which SMS provider is live, so the third party named in the phone-number row is right.
6. Whether a zero-data-retention arrangement exists with OpenAI (`data-retention.md` §4 records
   none); if one is made, the "third party receives it" cells and the notice change.
7. Legal review of `docs/legal/privacy.md`; the placeholders (`node tools/legal-status.mjs`).
8. Confirm Sign in with Apple is exposed in the native iPad shell (Guideline 4.8).
