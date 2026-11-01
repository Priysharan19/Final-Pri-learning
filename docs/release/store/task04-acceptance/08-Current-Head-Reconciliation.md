# Task 04 — Current-head store documentation reconciliation

**Audit date:** 20 October 2026. **Source baseline:** `98a30194caf349885a24b11d75edf01ac50df428`. **Authority:** Issue #504. **Lane:** reviewed `task/*`, documentation-only. **No release approval or device certification.**

## What was preserved
The original nine-file Task 04 package is copied byte-for-byte into this directory: six deliverable files, the original README, JSON validation manifest and SHA-256 checksums. Its ZIP was independently inspected: nine entries, zero CRC errors, all matched the extracted originals, and eight recorded SHA-256 file checks passed. This file is an additive reconciliation and does not invalidate that historical manifest.

## Corrections on current main
1. Apple version is **1.0 (build 2)** in BOTH Swift packages and `ios/app-store-version.json`; source `com.prilearning.app`, iOS 16+, phone portrait, iPad all orientations. The historical Apple listing incorrectly stated 4.0 (2).
2. Android package is `com.prilearning.app` with **versionName 4.0**, minSdk 26, targetSdk 36 and a required positive distinct `versionCode`. This document does not change native versions. Recommendation: preserve the independently recorded native versions until Android owner and Play Console holder approve any public version alignment; always bind both artifacts and deployed backend to one source SHA and build hashes.
3. Apple currently requires a Dynamic Island **medium-display iPhone** screenshot and a **13-inch iPad** screenshot for iPad-capable apps. Capture per App Store Connect accepted pixels rather than relying on an outdated '6.9-inch mandatory' table.
4. **12 existing Android emulator screenshots** were taken on 19 October against a fixture account/server and synthetic ink; no physical-device/production acceptance. Pixel 7 screenshots are 1080×2400 (2.22:1), exceeding Google's 2:1 general screenshot maximum. Real exact-build Play-conformant capture still needed.
5. The 19-Oct revision of `docs/legal/privacy.md` describes online server marking, unlike the stale assertions in an earlier 18-Oct counsel pack and Apple listing. It has NOT been legally approved or verified against the live origin, exact backend and processors.
6. ₹199 per month and ₹1,499 per year are OWNER INTENDED amounts, not verified live storefront prices. The old `tools/play-listing-check.mjs` insists the draft description contain these intended amounts. Passing that checker is NOT proof prices exist. Preserve historical document, use price-conditional copy from the pack, and ask reliability/commercial for a separate validator change if unpriced public copy is promoted.
7. `docs/release/app-store-privacy-labels.md` says Apple Crash Data not collected; Google Data safety includes app-generated crash/error reports. This taxonomy is **pending Apple/privacy-counsel review**, not silently resolved by assuming absence of an SDK. Customer Support, per-account adaptive personalization, Sentry state and service-provider-sharing exemptions also remain open.
8. Apple Guidelines 5.1.2(i) require explicit permission before third-party AI sharing. Default cloud reading and email-based guardian confirmation alone are NOT certified child compliance. Guardian disclosure/consent version repair belongs to Task 03 Issue #622, not this documentation PR.

## Claim and evidence register
`04-Claim-Register.csv` has 36 claims: **18 SOURCE_VERIFIED**, **12 CONDITIONAL**, **4 BLOCKED**, **1 DOCUMENTED_NOT_LIVE_VERIFIED**, **1 HISTORICAL_DOCUMENTED**. SOURCE_VERIFIED means a repo file or test-backed implementation exists; it does not certify production, a device, human academic examination, price, legal compliance or store approval.

## Required independent acceptance
- QA/release owner and independent reviewer: exact-head diff and docs integrity; no fabricated screenshots or new product claims.
- Task 03 #622 + qualified counsel: under-18 pre-consent wording, valid guardian verification, notice-version migration, withdrawal behavior and child identity/data handling. No Task 03 source changes in this PR.
- Platform/security + legal: Apple explicit AI data consent, OpenAI provider terms and retention, Google Families SDK/identifiers, final privacy-manifest and Data Safety classification, real production settings.
- Commercial + account holders: Apple agreement/product/price and physical StoreKit sandbox; Google subscription/base-plan and Play license-testing, server-authoritative entitlement/restore/refund/grace; no price in live marketing until proved.
- Mathematical examiner #499: independent rubric sign-off before promising method-credit display as globally certified. Keep unapproved production method flag OFF.
- Mobile QA: real iPhone, iPad, Android phone/tablet, identical source release SHA, signed builds, history/sync/deletion/OTP, finger/Pencil/photo, VoiceOver/TalkBack and app recovery.
- Release governor: exact new main SHA, hosted CI, deployment health, secure reviewer accounts, real published legal URLs, separate human approval for store submissions.

## Official guidance checked 20 October 2026
- Apple App Review: https://developer.apple.com/app-store/review/guidelines/
- Apple screenshots: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Apple age rating: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating
- Google Families: https://support.google.com/googleplay/android-developer/answer/9893335
- Google Play assets: https://support.google.com/googleplay/android-developer/answer/9866151
- Google Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google personal developer testing: https://support.google.com/googleplay/android-developer/answer/14151465
- Android target API: https://developer.android.com/google/play/requirements/target-sdk

**Verdict:** documentation integrated in a candidate review PR, NOT independently accepted until approval and exact-head CI. Release publication remains blocked on evidence and explicit authorization.
