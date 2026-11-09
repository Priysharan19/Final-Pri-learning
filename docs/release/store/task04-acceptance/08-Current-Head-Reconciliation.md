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

## Re-checked at merge into the release-tooling branch, 2 November 2026

Checked against `main` `a5778a319` by `agent/mission/reliability/m-finish-14-ops-release-tooling`
(PR #624 was 182 commits behind `main` at the time; the merge was clean). Nothing below is a
store submission, a legal opinion or an acceptance.

| Statement above | Still true on main? | Evidence |
|---|---|---|
| Apple marketing version **1.0 (build 2)** in both Swift packages | yes | `ios/PriLearning.swiftpm/Package.swift` `displayVersion: "1.0"`, `bundleVersion: "2"`; `ios/app-store-version.json` present |
| Android `versionName "4.0"`, `minSdk 26`, `targetSdk 36`, operator-supplied `versionCode` | yes | `android/app/build.gradle.kts` lines 48–91 |
| Twelve 19-October **emulator** screenshots, six phone and six tablet, with provenance | yes | `docs/release/store/play/screenshots/{phone,tablet}/` and its `README.md` (synthetic strokes, fixture server; not physical evidence) |
| ₹199 / ₹1,499 are intended, not live, prices | yes | V1 decision D19 (1 November 2026) keeps the amounts; no storefront product has been priced |
| Privacy notice revised 19 October, not legally approved | yes | `docs/legal/privacy.md` "Last updated: 19 October 2026"; counsel review still open (`V1_DECISIONS_2026-11-01.md`, "Only people can close these") |

Decisions of 1 November 2026 that the pack must follow before any copy is entered in a console
(`~/Developer/pri-finish/V1_DECISIONS_2026-11-01.md`, provisional until the owner confirms):

- **D3** sign-in at launch is email code and password; Apple and Google sign-in arrive together in
  an update and SMS stays off. Reviewer-access notes that promise an SMS code are stale.
- **D12** method marks are off in production behind a server switch; store copy describes marks
  for the final answer only.
- **D23** past papers are off for students until a rights opinion exists.
- **D1 / D2** India only on both stores; the public launch is iPhone and iPad first, with the
  Android software finished but its closed test pending.
- **D24** only the plain coverage wording; never "complete", "every chapter", "certified" or any
  accuracy, question-count or percentile claim.

## Re-checked on 8 November 2026 against `main` `1d3829103` (lane L7)

Files 01–07 and the README in this directory are the original Task 04 package, byte for byte
(`CHECKSUMS.sha256`), and are not edited. Where they and the primary drafts disagree, the primary
drafts win: `docs/release/app-store-privacy-labels.md`, `docs/release/play-data-safety.md`,
`docs/release/store/app-store-listing.md` and `docs/release/store/play-listing.md`. Nothing below is
a store submission, a legal opinion or an acceptance.

| Open point in this package | State now | Where |
|---|---|---|
| Crash Data: Apple said No, Play said Yes (03 §B, §E item 3; item 7 above) | **Closed 2 Nov.** Collected in all three: Apple label Yes (optional), Play Crash logs Yes, `CrashData` in both iOS manifests; `tools/store-readiness-check.mjs` holds them to `reportCrash` and `POST /v1/telemetry/error` | labels §6 row 12; Play §6b row 16 |
| Optional SMS and phone number declared (03 §E item 5) | **Closed 2 Nov.** SMS is off at launch (D3); Phone number removed from both manifests and both forms, with the re-enable procedure beside each; the listings no longer mention an SMS code | labels §6 row 13; Play §6b row 15; listings §10 and §8 |
| "No third-party analytics" in review notes (03 §E item 4) | **Closed 8 Nov.** The notes say no third-party analytics or crash SDK, and that Pri's server keeps operational telemetry and coded crash reports, which App Privacy declares | `app-store-listing.md` §6 |
| Privacy notice "revised 19 Oct, not legally approved" (item 5 above) | Corrected against the code on 2 Nov; **still not reviewed by counsel**, shown on every notice by the switch `docs/legal/review-status.json` (`reviewed: false`), which nothing in code or any agent sets | `docs/legal/README.md` |
| Privacy URL `[LIVE COUNSEL-APPROVED HTTPS]/privacy`; deletion URL `[PRODUCTION VERIFIED HTTPS ORIGIN]/account/delete-request` (03 §B, §C) | D5 values written in: `https://prilearning.com/privacy`, `/support`, `/terms`, and `https://prilearning.com/delete-account` linking to the form at `https://app.prilearning.com/account/delete-request`. The site is **not deployed** and DNS is untouched; each URL must resolve, and counsel must have approved the notice, before it is entered | labels §1; Play §1 and Step 2 |
| Explicit permission before third-party AI (03 §B, §D; item 8 above) | **Built with #737; wording open.** D17's one-time prompt names OpenAI before the first handwriting read, photo of working or question photo; nothing is sent until the student agrees, and declining keeps typed answers. The record is on the device only. The notice, labels, Play form and listings describe it in the same train. Counsel still approves the wording; the opt-in working check and exam handwriting (flag off) are outside the prompt | labels §1 and §4 item 3; Play §5 item 11; counsel questions on D17 |
| Unconfirmed child accounts (03 §D) | **Open.** D18 (erasure after 30 days; a guardian can ask for erasure without the child's login) is promised in the privacy notice and **not yet in the code**; `scripts/release-nominate.mjs` refuses a production nomination until it is (`tools/legal-promises.mjs`) | labels §1; Play §3 |
| Past-paper content rights (01 content-rights row) | D23: past papers are off for students until a rights opinion exists | `app-store-listing.md` §3 |
| Customer Support classification; Apple Product Personalisation; service-provider "shared" exemption; Families target audience | **Open**, owner and counsel | labels §2 and §4; Play §5; `docs/legal/counsel/QUESTIONS-FOR-COUNSEL.md` |
