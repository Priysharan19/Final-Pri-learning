# Store readiness — Apple App Store and Google Play (CP-12)

> **SOFTWARE IMPLEMENTATION: COMPLETE (store-facing configuration in the repo)**
> **PHYSICAL DEVICE VALIDATION: DEFERRED**
> **STORE SUBMISSION: BLOCKED_EXTERNAL** — nothing here has been submitted, reviewed
> or approved by Apple or Google, and no console has been configured by an agent.

This document lists what the repository already supplies for a store submission,
what an owner must still do in App Store Connect / Play Console, and which
answers come straight from the code. Its job is to keep the store declarations
**true to the code**. If the code changes what data leaves the device, change
this file, `PrivacyInfo.xcprivacy` and the legal notices together.
`scripts/store-readiness-check.mjs` enforces the parts that can be enforced.

V1 scope stays as `docs/release/PRI_V1_RELEASE_SCOPE.md` freezes it: **iPad only**.
iPhone and Android builds are post-V1. A public iPhone release is
**BLOCKED_GOVERNANCE** until the owner changes that scope. Nothing below
overrides the freeze.

## 1. In the repository now

| Item | Where | Enforced by |
|---|---|---|
| Apple privacy manifest, copied to the app bundle root | `ios/PriLearning.swiftpm/PrivacyInfo.xcprivacy` (+ the `PriLearning 2` mirror), `.copy("PrivacyInfo.xcprivacy")` in both `Package.swift` | `store-readiness-check`, `check-native-package-sync` |
| No tracking, no tracking domains | `NSPrivacyTracking = false`, empty `NSPrivacyTrackingDomains` | `store-readiness-check` |
| Required-reason API declared | `UserDefaults` → `CA92.1` (the app's own settings) | `store-readiness-check` |
| Android: the app's own manifest asks for INTERNET only; no backup; cleartext refused. Libraries merge in `com.android.vending.BILLING` (Play Billing), `ACCESS_NETWORK_STATE` and the AndroidX `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | `android/app/src/main/AndroidManifest.xml`; the merged release manifest | `store-readiness-check` (source manifest, plus the merged manifest against that allow-list whenever a build exists) |
| Android: release upload signing only from environment variables (all four or none; a partial set fails the build); never the debug key; no keystore in git | `android/app/build.gradle.kts` (`PRI_ANDROID_UPLOAD_*`) | `store-readiness-check` |
| Android: release builds need an explicit `-Ppri.versionCode` | `android/app/build.gradle.kts` | Gradle refuses otherwise |
| Release identity is one SHA across web, Apple and Android | `scripts/release-matrix.mjs` (CP-11) | `ci.yml`, `android-shell.yml` |
| Minimum shell build can be raised without a store release | `PRI_MIN_IOS_BUILD` / `PRI_MIN_ANDROID_BUILD` → `426 CLIENT_UPGRADE_REQUIRED` (CP-11) | `client-compatibility-check` |
| In-app account deletion | Settings → Account → Delete account (`CloudAccountSecurity.jsx`) → `DELETE /v1/account` | `account-lifecycle-contract-check`, Android `CloudJourneyTest.cloudSignUpThenDeleteAccount`, iOS journey |
| Legal notices (English + Hindi) at `/privacy`, `/terms`, `/refund-policy`, `/grievance` | `docs/legal/` | `client/test/legal-pages-check.mjs`, `npm run legal:status` |

Locally verified on 2026-10-02: `xcodebuild` puts `PrivacyInfo.xcprivacy` at the
`.app` root, and `./gradlew -Ppri.versionCode=N bundleRelease` produces an
`app-release.aab`, which is unsigned unless the upload variables are set. Both
results are **SYNTHETIC / local build** evidence. No store has accepted either.

## 2. Privacy answers taken from the code

**Without a cloud account, nothing leaves the device.** Profiles, attempts,
progress and handwriting strokes live in the WebView's IndexedDB under the pinned
origin. Handwriting **strokes** never leave the device, with or without an
account. Only a rasterised **image** can be sent, and only for cloud reading.

**With a cloud account (optional)** the server receives the data below. All of
it is linked to the account, and none of it is used for tracking or advertising.
The Apple column is exactly the set in `PrivacyInfo.xcprivacy`, and
`store-readiness-check` holds the manifest to it.

| Data | Source in code | Why | Apple manifest type (purpose) | Play Data safety |
|---|---|---|---|---|
| Email address | `accounts.js` register/login | sign-in, recovery | EmailAddress (App Functionality) | Personal info → Email address |
| Display name | `accounts.js` | shown in the app | Name (App Functionality) | Personal info → Name |
| Account id | `accounts.js` | sync identity | UserID (App Functionality) | Personal info → User IDs |
| Per-install device id | `cloudAccount.js` `deviceId` → `account_sessions.device_id`, `learning_events.device_id`, `GET /v1/account/devices` | sessions, per-device sync | DeviceID (App Functionality) | Device or other IDs |
| Profile: class/year, course, track, avatar, daily goal, handwriting setting; settings, bookmarks, tasks, custom questions | `syncWorker.js` `safeProfile`, `sync.js` entities | cross-device sync | OtherDataTypes (App Functionality) | Personal info → Other info; App activity → Other user-generated content |
| Learning records (attempts, marks) | `sync.js` | cross-device sync | OtherUserContent (App Functionality) | App activity → Other actions |
| Handwriting **image** for cloud reading (rasterised; processed, not stored) | `/v1/handwriting/transcribe` | reading the written answer (answer-blind) | OtherUserContent (App Functionality) | App activity → Other user-generated content |
| Lines of working and the question text for step checking (processed, not stored) | `/v1/working` | feedback on working steps (AI proposes, the deterministic engine decides marks) | OtherUserContent (App Functionality) | App activity → Other user-generated content |
| Photo of written working, only with cloud reading turned on (processed, not stored) | `/v1/handwriting/transcribe` (same authenticated route as ink) | transcription of the photo | PhotosorVideos (App Functionality) | Photos and videos → Photos |
| Subscription status / purchase token | `billing.js` (verified server-side; the client is never trusted) | Premium access | PurchaseHistory (App Functionality) | Financial info → Purchase history |
| Allow-listed telemetry events (e.g. feature used, exam completed, trial started) | `telemetry.js` (90-day retention) | reliability and product analytics | ProductInteraction (App Functionality, Analytics) | App activity → App interactions (Analytics) |
| Diagnostics / performance | `telemetry.js` | reliability | OtherDiagnosticData, PerformanceData (App Functionality) | App info and performance → Diagnostics |

**Guardian name and email** (`guardianConsent.js`) are collected at
registration for a learner in classes 7–12. They are a **third party's**
personal data, used only to send the confirmation and withdrawal links. Declare
them in Play Data safety (Personal info → Name, Email address; App
functionality) and describe them in the privacy notice. Whether Apple's labels
need a separate entry is an owner + legal question. The manifest already
declares Name and EmailAddress.

Data is encrypted in transit. In-app deletion exists, and deletion can be
requested on the web (§4). A cloud processor (OpenAI) receives handwriting
images and lines of working only when those cloud features are used. **Do not**
declare that handwriting never leaves the device (`PRI_V1_RELEASE_SCOPE.md`
§privacy).

## 3. Children, age rating and families — owner decision required

What the code does: a cloud account for a student is gated by
`server/platform/guardianConsent.js` (`requireGuardianConsent` in front of
`/v1/sync`, `/v1/billing`, `/v1/handwriting` and `/v1/working`). The method is
`guardian-email-confirmation`. It shows that someone with access to the
guardian's mailbox followed a link, and **nothing more**. It is **not**
verifiable parental consent, and the code says so. Local profiles, which never
reach the server, are not gated.

**Discrepancy to fix before submission:** the Children section of
`docs/legal/privacy.md` still says no guardian is contacted and no consent is
recorded. That is stale against the code above. Rewriting a legal notice is an
owner and legal action, so this PR does not change it. Agents must not describe
the gate as verifiable consent.

- **Apple:** the age rating questionnaire answers are "none" for every
  objectionable-content category, which is expected to give the lowest rating.
  Apple's questionnaire changes, so the owner confirms the result. Do **not** choose the Kids
  category until verifiable parental consent exists (the email confirmation is
  not that). The Kids category brings
  parental-gate and data-minimisation duties the app does not yet meet.
- **Google Play:** if the target audience includes under-13s, the Families
  Policy applies, along with the Families self-certification. The app has no ads
  and no third-party analytics SDK, which helps. Verifiable parental consent (beyond the
  email confirmation) is an **open product requirement**, not a solved item. India's DPDP Act
  obligations for under-18s begin on 14 May 2027.
- **Status: BLOCKED_EXTERNAL / owner + legal.** Pick the declared audience, have
  a lawyer review the notices (each `{{PLACEHOLDER}}` must be filled first), correct the stale Children section, and schedule verifiable parental consent.

## 4. Account deletion outside the app (Google Play requirement)

Play needs a web URL where a user can request deletion without installing the
app. The production web app offers the same Settings → Account → Delete account
control, backed by `DELETE /v1/account`. **Owner action:** publish that URL on
the production domain and enter it in Play Console → Data safety. Apple accepts
the in-app flow, which already exists.

## 5. Owner actions (BLOCKED_EXTERNAL)

Agents cannot do these. Each one needs a human account holder or external
authority.

1. **Apple**
   - Create the App Store Connect record, using bundle id
     `com.prilearning.app` (`Package.swift`; the shipping target is iPad-only per the V1 freeze).
   - Complete the Agreements, Tax and Banking section.
   - Create the auto-renewable subscription products whose ids match
     `PRI_APPLE_*` in `.env.production.example`.
   - Set up App Store Server Notifications V2, pointing at
     `/v1/billing/webhook/apple`.
   - Fill in App Privacy (from §2) and the age rating (from §3).
   - Supply screenshots taken on **physical** iPads (none exist; never use
     synthetic ones as device evidence).
   - Write the review notes: a demo account that the owner creates. Never commit
     its credentials.
   - Upload through TestFlight, then submit for review.
2. **Google**
   - Create the Play Console app, package `com.prilearning.app`.
   - Enrol in Play App Signing and generate the upload key. Keep it outside the
     repo. A release job can supply it through `PRI_ANDROID_UPLOAD_*`; no
     workflow builds a signed release yet.
   - Create the subscription products and base plans
     (`PRI_GOOGLE_MONTHLY_PRODUCT_ID` / `PRI_GOOGLE_ANNUAL_PRODUCT_ID`).
   - Set up RTDN: a Pub/Sub topic plus a push subscription to `/v1/billing/webhook/google`
     with OIDC, using `PRI_GOOGLE_RTDN_AUDIENCE` and `PRI_GOOGLE_RTDN_SERVICE_ACCOUNT`.
   - Grant the service account access to the Android Publisher API, and supply the
     service-account credentials (`PRI_GOOGLE_SERVICE_ACCOUNT_JSON` or `_FILE`).
     `PRI_GOOGLE_PACKAGE_NAME` defaults to `com.prilearning.app`.
   - Fill in Data safety (from §2), the target audience (from §3), the content
     rating questionnaire and the account-deletion URL (from §4).
   - Use an internal testing track first, then a staged production rollout.
     Suggested stages: 5% → 20% → 50% → 100%, with each step gated on
     crash-free sessions and `/health` billing backlog checks.
   - Remember that Android is post-V1 under the scope freeze.
3. **Legal:** fill in the placeholders in `docs/legal/*`, then get a review from
   a lawyer qualified in Indian law. The banner stays until then.
4. **Physical validation:** follow the `docs/release/` checklists on a real iPad
   with an Apple Pencil (and later on Android tablets and phones with a stylus).
   Nothing here records physical evidence.

## 6. What must stay true

- `NSPrivacyTracking` stays `false`, and no SDK that tracks may be added without
  updating §2, the manifest and Data safety together.
- No permission is added to the Android manifest without a written reason here.
- Signing material never enters git.
- Store screenshots and review notes never present simulator or emulator output
  as device evidence.
