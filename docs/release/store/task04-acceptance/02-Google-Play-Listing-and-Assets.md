# Google Play — listing, graphics and genuine-capture specification

**State:** Authoring copy only. Preserve `docs/release/store/play-listing.md` and existing `docs/release/store/play/` graphics/screenshots. Package `com.prilearning.app`, `minSdk 26`, `targetSdk 36`, Android `versionName "4.0"` on audited main. Google Play product configuration has not been observed here.

## Main store listing — en-IN (candidate)

**Title (≤30):** Pri Learning: Maths Practice

**Short description (≤80):**
> Practise maths by writing, typing or photographing your working

**Full description (≤4,000):**

> Pri Learning helps students practise mathematics through questions, answers and feedback.
>
> Practise at your own pace
> Explore mathematics topics, answer questions and review your previous attempts in History.
>
> Write, type or photograph working
> Work with a finger or compatible stylus, type an answer, or choose to photograph working on paper. If you use handwriting or a photo, Pri can propose an online transcription. Review and correct the proposed text before checking your answer.
>
> Understand your result
> The server checks submitted answers against mathematical rules and returns feedback. Automatic checking can make mistakes. Revisit saved results in History.
>
> Account and guardian permission
> You need an account and internet access to check answers. Work saved locally while offline is not graded until it is checked online. Students under 18 need guardian permission before online learning features are available.
>
> Free and Premium
> A free practice tier is available. Optional Premium subscriptions unlock additional practice features where offered. Prices, renewal period and cancellation terms are shown in Google Play before purchase. You can manage subscriptions using your Google Play account.
>
> Privacy and control
> Handwriting and photo images used for online reading are sent through Pri's server to a third-party AI service. You can turn cloud handwriting reading off and type instead. Account deletion is available in Account settings and through the deletion page linked in the store's Data safety section.
>
> Pri Learning is independently developed and is not endorsed by NCERT, CBSE, NTA or examination authorities.

**Do not paste until source candidate demonstrates** all mentioned UI and the disclosure/consent, disclosure of third-party processors and guardian flow meet counsel-approved obligations.

### Release notes — initial Google Play release
> Initial release of Pri Learning for mathematics practice, online answer checking and saved question history.

## Listing fields / owner worksheet

| Field | Value or required confirmation |
|---|---|
| App category | Education |
| Default locale | English (India), confirm Console configuration |
| App type | App |
| Contains ads | No, subject to final merged manifest and SDK audit |
| Package ID | `com.prilearning.app` (do not change) |
| Version code | Positive integer strictly greater than all uploaded codes; **not yet selected** |
| Version name | Currently `4.0` in Gradle; consider `1.0` for cross-platform clarity **only through reviewed code change** |
| Pricing | Free install; paid subscription IAP, not web checkout |
| Intended subscription price | ₹199 monthly / ₹1,499 annually per scope decision; **not verified as active storefront prices** |
| Contact email | [OPERATING SUPPORT MAILBOX] — must exist |
| Website | [VERIFIED LIVE HTTPS URL], optional |
| Privacy policy | [VERIFIED LEGAL-REVIEWED HTTPS PRIVACY URL] |
| Account deletion URL | [VERIFIED LIVE ORIGIN]/account/delete-request |
| Target audience | Include 9–12, 13–15, 16–17, 18+ if actual Class 7–JEE targeting continues; legal/Play Families review required |
| IARC | Educational content; no known violence/sex/gambling; digital subscriptions yes; AI/UGC/interactivity declarations checked against final build |
| App access | Restricted: provide working adult reviewer test account in secure Console fields |
| Government/financial/health/news | No known feature except paid subscriptions; validate Console's exact categorisation |

## Feature graphic, icon and image audit

**Already authored assets (do not regenerate without reason):**
- `docs/release/store/play/icon-512.png`: nominal 512×512 PNG; verify 32-bit/alpha and <1 MB before upload.
- `docs/release/store/play/feature-graphic-1024x500.png`: nominal 1024×500, 24-bit RGB/opaque. Verify encoding, dimensions and branding before upload.
- `tools/play-graphics.mjs` and `tools/play-listing-check.mjs` generate/check these assets.

**Feature graphic direction:** P′ brand mark, readable "Pri Learning", restrained warm paper background and a single line "Work through maths, your way". Do not depict an imaginary app UI or fabricated model output, awards, prices, Google logos, ranking, student photographs or an endorsement. Only refresh the existing graphic after owner review; do not upload unreviewed marketing artwork.

### Existing screenshots — provenance is mandatory
`docs/release/store/play/screenshots/README.md` records six phone and six tablet PNG files captured on **Android 36 emulators on 19 Oct 2026**, Pixel 7 profile (1080×2400 portrait) and Pixel Tablet profile (2560×1600 landscape). They exercised `StoreShots` against a **local fixture server and synthetic account** and used injected synthetic strokes. They are **genuine screenshots of that emulator state**; not production, physical, human ink or certified current-main release builds.

| Number | Existing emulator file (under each phone/tablet directory) | Valid claim |
|---|---|---|
| 01 | `01-sign-in.png` | Real emulator account-first screen |
| 02 | `02-practice-question.png` | Server-issued fixture question |
| 03 | `03-write.png` | Writing screen with **synthetic strokes** |
| 04 | `04-photo.png` | Photo-answer screen |
| 05 | `05-feedback.png` | Deterministic server fixture feedback |
| 06 | `06-history.png` | History / Review screen |

Do **not** call these physical captures or final release screenshots. The older `play-listing.md` and closed-testing runbook incorrectly say no screenshots exist; the README is newer. Whether any emulator images are acceptable for publication depends on precise truthful representation of the same reviewed product and current app build; this pack recommends re-capturing on the accepted build.

### Production candidate screenshot matrix

| Store slot | Android phone | Android tablet | Capture test |
|---|---|---|---|
| Sign-in / guardian | portrait | suitable landscape | OTP/account privacy |
| Question | portrait | landscape | Server question ID and class |
| Write | finger or supported pen | finger or supported pen | No false recognition/marking claim |
| Correct transcript | portrait | landscape | Edited reading before confirm |
| Feedback | portrait | landscape | Receipt/marks reflect actual server |
| History | portrait | landscape | Persisted after restart |
| Photo | portrait | landscape | Operated with dummy page |
| Plan (conditional) | portrait | landscape | Prices/entitlements certified |

**Play asset rules:** feature graphic 1024×500 JPG/24-bit PNG; icon 512×512 32-bit PNG; at least two product screenshots (JPG/24-bit PNG no alpha), each side 320–3840px and max side no more than 2× min side for the general screenshot specification. Keep separate phone and tablet assets; include screen sizes/slots offered by current Console. A 1080×2400 phone crop is a tall 2.22 ratio, so check which category's screenshot constraints and recommendation eligibility apply — **do not blindly upload**. Play's promotional placement criteria can be stricter than the general upload requirements.

**Capture procedure:** physical phone and tablet on the same immutable release AAB/SHA and correct server, honest test account, dummy handwriting/photo, record versionCode/bundle SHA/device/OS/locale/source paths, crop only OS area if permitted, check for PII and no deceptive markup, then independent QA and owner sign-off. Re-run Play listing checks after final asset selection.

## Reviewer test-access notes
> Sign in using the verified adult test account supplied in the secure Play Console App access section. Open Practice and request a maths question. The account/server connection is needed to check a submitted answer. For handwriting or a paper-photo answer, review the proposed text and confirm it before online grading. Open History to inspect the saved attempt. A child account is gated until guardian approval. Optional Premium is verified by the backend after Google Play Billing confirmation. The test app uses no real student content. The Account settings contain the account-deletion flow.

Before giving these notes to Google, verify exact menu labels, use a functioning test deployment and license-tester purchase/restore.

## Testing and signing
- Current `android/app/build.gradle.kts` requires explicit `-Ppri.versionCode` and external upload key for a signed release; no upload evidence from this task.
- `targetSdk 36` meets Google's 31 August 2026 new-app target API 36 requirement.
- If using a **personal Play developer account created after 13 November 2023**, obtain at least **12 continuously opted-in closed testers for 14 days** and apply for production access; do not infer account type. Records must come from real testers.
- Conduct initial internal test, closed testing where required, then separately authorize any production action.

Official: https://support.google.com/googleplay/android-developer/answer/9859152 ; https://support.google.com/googleplay/android-developer/answer/9866151 ; https://developer.android.com/google/play/requirements/target-sdk ; https://support.google.com/googleplay/android-developer/answer/14151465
