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
| Android: INTERNET is the only permission; no backup; cleartext refused | `android/app/src/main/AndroidManifest.xml` | `store-readiness-check` |
| Android: release upload signing only from CI environment variables; no keystore in git | `android/app/build.gradle.kts` (`PRI_ANDROID_UPLOAD_*`) | `store-readiness-check` (no `*.jks`/`*.keystore`/`*.p12` tracked) |
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

**Data that never leaves the device without a cloud account:** profiles,
attempts, progress and handwriting strokes live in the WebView's IndexedDB under
the pinned origin. Without an account, nothing is sent anywhere.

**With a cloud account (optional)** the server receives the following, all for
App Functionality, all linked to the account, none used for tracking:

| Data | Why | Apple manifest type | Play Data safety |
|---|---|---|---|
| Email address | sign-in, account recovery | EmailAddress | Personal info → Email |
| Display name | shown in the app | Name | Personal info → Name |
| Account id | sync identity | UserID | Personal info → User IDs |
| Subscription status / purchase token | server-verified Premium (never trusted from the client) | PurchaseHistory | Financial info → Purchase history |
| Learning events (attempts, marks) | cross-device sync | ProductInteraction | App activity → Other actions |
| Handwriting strokes / rasterised image for cloud recognition, when used | recognition (answer-blind) | OtherUserContent | App activity → Other user-generated content |
| A photo of working, only when the student attaches one | marking that attempt | PhotosorVideos (not linked) | Photos and videos → Photos |
| Diagnostics / performance (allow-listed telemetry, 90-day retention) | reliability | OtherDiagnosticData, PerformanceData | App info and performance → Diagnostics |

Data is encrypted in transit. Users can request deletion, and in-app deletion is
available. A cloud processor (OpenAI) receives handwriting images only when
cloud recognition is used. **Do not** declare that handwriting never leaves the
device (`PRI_V1_RELEASE_SCOPE.md` §privacy).

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
  objectionable-content category. That gives 4+. Do **not** choose the Kids
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
     repo; CI reads it through `PRI_ANDROID_UPLOAD_*`.
   - Create the subscription products and base plans
     (`PRI_GOOGLE_MONTHLY_PRODUCT_ID` / `PRI_GOOGLE_ANNUAL_PRODUCT_ID`).
   - Set up RTDN: a Pub/Sub topic plus a push subscription to `/v1/billing/webhook/google`
     with OIDC, using `PRI_GOOGLE_RTDN_AUDIENCE` and `PRI_GOOGLE_RTDN_SERVICE_ACCOUNT`.
   - Grant the service account access to the Android Publisher API.
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
