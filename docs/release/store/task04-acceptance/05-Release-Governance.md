# Task 04 — evidence verdict and release-governance handoff

**Date:** 20 Oct 2026. **Exact audited main:** `98a30194caf349885a24b11d75edf01ac50df428`. **Main changed:** No. **Production changed:** No. **Submission/release:** None. **This packet:** complete documentary reconciliation candidate, not approval/certification.

## A. Existing deliverables: reconciliation verdict

| Deliverable | Existing state on main | Acceptance verdict for Task 04 |
|---|---|---|
| Apple listing, subtitle, keyword drafts | `docs/release/store/app-store-listing.md`, authored/revised 18 Oct | **Copy authored**; specific version and prices in existing draft require correction; live UI and legal gate remains |
| Apple age questionnaire and reviewer instructions | Same document §§4–7 | **Worksheet authored**; account and actual App Review flags unknown |
| Apple 13-inch iPad / Dynamic Island iPhone screenshots | Shot list only, no final screenshot set verified | **Blocked** physical exact-release capture, app-size requirements and device journey |
| Play listing | `docs/release/store/play-listing.md`, 18 Oct | **Copy authored**; incorrectly says screenshots do not exist; pricing and Families answers remain blocked |
| Play icon and feature image | Two generated PNG paths under `docs/release/store/play/` | **Existing assets**; owner selection, current-policy validation and file byte inspection are not claimed |
| Play screenshots | 12 files, `play/screenshots/README.md` dated 19 Oct | **Emulator fixture evidence** only; no exact-main/release physical certification |
| Play Data safety | Detailed table and machine check on main; revised 19 Oct | **Engineering worksheet authored**; provider-classification, active services, legal sign-off and Console submission blocked |
| Apple nutrition labels and manifests | App Privacy detailed draft and two `.xcprivacy` manifest copies | **Engineering worksheet authored**; cross-document content gate missing and owner questions unresolved |
| Child/Families/guardian assessment | Existing app/Play drafts + counsel pack | **Critical external blocker**; no legal child-consent certification |
| Account deletion | In-app and public OTP deletion paths with deterministic tests | **Code evidence**, not publicly live URL/product review proof |
| Free/Premium | Server entitlement source, Apple/Google verification modules, free allowances; owner prices proposed | **Code evidence**; real store configuration, charged prices, actual entitlement and sandbox purchases not proven |
| Device support | Apple package families phone+pad; Android app for mobile+tablet | **Declared/build-path evidence**, not physical certification |
| Release publication | No authority in this task | **Blocked by explicit instruction** |

## B. Native and store identity register

| Platform | Bundle/package | Source config | Candidate marketing/build | Hard gate |
|---|---|---|---|---|
| iPhone | `com.prilearning.app` | `ios/PriLearning.swiftpm/Package.swift` and mirrored second package | `1.0 (2)`; iOS 16+; phone portrait | Current App Store record match; archive, signing and physical tests |
| iPad | Same bundle | Same packages | `1.0 (2)`; portrait and tablet landscapes | Pencil/touch/accessibility/camera physical tests |
| Android phone | `com.prilearning.app` | `android/app/build.gradle.kts` | `versionName "4.0"`, `versionCode` provided by build; min 26 / target 36 | Google Play app registration, upload key, signed AAB and physical test |
| Android tablet | Same package | Same Gradle shell + responsive shared web | same `4.0` version name | Landscape, window size, multi-window, font-scale, photo and physical test |

**Version mismatch:** Apple 1.0 and Google 4.0 is not, by itself, evidence of different source engines; both can package the shared product. It is a public consistency and release tracking risk. Any edit to Android versionName must pass scoped engineering review; do not silently change it in metadata.

**Release identity:** Require *same source SHA* in `client/dist/release.json`, signed Apple archive, signed Android AAB and deployed `GET /v1/health`. An app store cannot guarantee runtime identity merely from bundle metadata.

## C. Claim release tiers

- **Source verified:** code/config path exists or authored docs corroborate claim at exact baseline. Example: `targetSdk=36`, dual Apple families, server-side entitlement checks.
- **Synthetic test verified:** deterministic/mock/fixture or emulator evidence, with exact commit/run labels. Example: 19 Oct Android StoreShots; not real student or production.
- **Physical verified:** test record for real device, OS, signed binary hash, named independent tester, data-safe fixture and exact backend. None established by this task.
- **Commercial verified:** actual platform product IDs, price per territory, Paid Apps Agreement, Google base plans, live sandbox purchase/restore/refund/cancel, server entitlement; none established live by this task.
- **Privacy certified:** human legal sign-off, deployed providers and geography, children/third-party permission, exact browser/deletion URL; none established by this task.
- **Store accepted:** developer portal acceptance/publication. **Neither store has been submitted by this task**.

## D. Release-blocking checklist — exact owners/evidence

| ID | Priority | Release gate | Owner | Required acceptance evidence |
|---|---|---|---|---|
| G01 | P0 | Same released product across four device categories | Mobile QA / integration | One release SHA, four real-device journey records with source evidence; `scripts/device-matrix-record.mjs validate` |
| G02 | P0 | Guardian/child flows lawful and safe | Owner + qualified counsel | Written reviewed age and verifiable parental permission decision; first AI-transfer consent proof; honest Families targeting |
| G03 | P0 | Explicit third-party AI permission and provider terms | Security/privacy + counsel | First-use consent UI capture and server tests; OpenAI retention/processor terms; blocked child until permission |
| G04 | P0 | Account deletion and legal notices | Owner + operator + counsel | Live privacy/support/deletion URLs, real test-account lifecycle, retained-data audit, bilingual legal approval |
| G05 | P0 | Fairness & marking representation | Independent mathematical examiner | #499 signed final assessment; leave unapproved method-rubric switch OFF; mark breakdown from verified server only |
| G06 | P0 | Payment certification Apple | App Store account holder + QA | Paid Apps Agreement/real product price, sandbox purchase/restore/refund, signed notifications, matching backend entitlements |
| G07 | P0 | Payment certification Google | Play Console holder + QA | Real products/base plans, Pub/Sub RTDN, license-test buy/renew/restore/refund, protected server authority |
| G08 | P0 | Production/staging identity and DB cutover | Release governor + operator | Approved Postgres cutover and Railway source, 24h staging soak, exact health SHA, backup restore, ready dependencies |
| G09 | P0 | Native artifacts and accounts | Apple/Google account holder | App Store archive, Play signed AAB and integrity/SHA, entitlement setup, proper certificates/profiles/keys |
| G10 | P0 | Privacy labels/SDK/permissions and audience | Legal + platform security | Reconciled Apple/Google forms, iOS privacy manifest content audit, merged APK manifest, SDK and live env proof |
| G11 | P1 | Screenshot certification | Product marketing + QA | Owner-approved unchanged exact-build captures from each target category, resolutions and licenses |
| G12 | P1 | Reviewer access and support | Owner / mobile QA | Long-lived test credentials in portal only, backup review path, contact mailbox, live content, terms and paywall |
| G13 | P1 | Store operational rules | Owner | Google account type and 12×14-day gate if applicable; valid export declarations and Apple age-rating questions |
| G14 | P0 | Authorized launch | Owner + independent reviewer | Signed go/no-go referencing *exact new main SHA*, all CI, physical and external gates, and explicit separate permission to submit |

No gate is closed merely because this workbook or an older draft says “done in code.” Issue #504 targets all four devices; issue #499 remains examiner gate as recorded in scope §22.4. Release-checklist documents and CI may have moved since the snapshot; reverify exact head before claiming any gate passed.

## E. Rejection-risk register (sorted by potential severity)

| Risk | Severity | Evidence from audit | Mitigation |
|---|---|---|---|
| Under-13/mixed-audience data handling or AI upload without specific permission | Critical | Default cloud reading; guardian e-mail not independently verified; Google Families/Apple AI rules | Consent engineering, legal ruling, real child negative test, operator contract approvals |
| Inaccessible app account / reviewer credentials | High | Account/OTP/guardian must work online; no reviewer account evidenced | Approved adult test credentials in portals and reliable review backend |
| Misleading metadata/price/features | High | Existing copy includes unpriced ₹ amounts and screenshots from old fixture; method marks pending | Use conditional copy, real paywall pricing and exact-build captures; disable unverified claims |
| Subscription rejection | High | Apple products reported created not priced, Google provider only coded | Pricing agreement, product IDs, sandbox tests, restore/cancel, unlinked server events |
| Incorrect Data safety or nutrition label | High | Processor/service provider classification, Sentry/phone flags open | Deployed environment inventory and legal cross-form sign-off |
| Account deletion or data retention mismatch | High | Cloud deletion vs local profiles and billing survivors | Real deletion test, accessible web link, cancellation disclaimer and clear retention notice |
| iPhone/iPad/tablet layout or crash | High | Config alone no physical acceptance | Real-device journey, Dynamic Type/TalkBack/VoiceOver, orientation, pen/touch photo permission |
| Rights/IP/exam endorsement | Medium–High | NCERT/CBSE/NTA question-origin and content rights review open | Confirm rights provenance, don't imply endorsement or reproduce protected exam assets in screenshots |
| Play closed-test access | Medium–High | Account type not verified | If applicable: 12 opted-in testers for continuous 14 days and Google approval |
| Different app versions/payload origin | High | Android 4.0 vs Apple 1.0; source/production can drift | Record app, content and backend exact SHAs and verify signed artifacts |

## F. What Task 04 actually finishes

**Complete now:** Source-based reconciliation analysis, conservative candidate App Store/Play public descriptions, release notes, field-count checks, shot-by-shot plans and provenance, store reviewer instructions, privacy/Data safety questionnaires with unresolved answers explicitly identified, implementation-linked marketing claim register, and accountable release handoff.

**Not complete:** Physical Apple/Android captures, pricing/agreements/products shown live, Apple/Google account entry, finalized store age/privacy disclosures, external legal/guardian approval, real app-review credential, final archive/AAB, Play testing, publication. These require actual evidence or human authority beyond this repository audit.

## G. Governance and next engineering handoff

The repository's `AGENTS.md` requires a single authorized specialist-writer lease/mission and protected branch→PR review; it forbids direct main changes and release without owner authority. **This packet was created outside the repo; no branch/PR or store write was performed.** To incorporate it, assign a scoped documentation mission to the eligible writer and produce a reviewed PR that: (1) preserves the existing 17–19 Oct files; (2) corrects the version and screenshot contradictions; (3) reconciles final privacy/telemetry taxonomy and price gating; (4) updates QA gates and screenshot manifest; (5) links the signed reviewer and source-SHA evidence. This is a documentation integration, not proof of release acceptance.

## H. Verified official policy links

- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Apple account deletion: https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/
- Apple screenshots: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Google listing field limits: https://support.google.com/googleplay/android-developer/answer/9859152
- Google preview media: https://support.google.com/googleplay/android-developer/answer/9866151
- Google Families: https://support.google.com/googleplay/android-developer/answer/9893335
- Google Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google personal-account testing: https://support.google.com/googleplay/android-developer/answer/14151465
- Android target API 2026: https://developer.android.com/google/play/requirements/target-sdk
