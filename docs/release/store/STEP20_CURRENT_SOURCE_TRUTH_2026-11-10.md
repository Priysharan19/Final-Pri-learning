# Step 20 — Current-source store declarations and asset intake (10 Nov 2026)

**Status: INTERNAL SOURCE-TRUTH DRAFT, NOT APPROVED PUBLIC STORE COPY.**
Tested engineering source: `35159d3c4e32df18a0cf5315457f818c007f495c`.
**11 Nov 2026:** not re-run on the newest `main`, `9162147ef3ff47d9fdafc317cb91e668b2ebb102`; every result below is for `35159d3c4` only.
This document supersedes no Console configuration or legal approval. Earlier price-gated
store listing drafts remain historical and must not be published verbatim.

## Conservative product copy, pending owner and legal sign-off

**Title:** Pri Learning: Maths Practice

**Short description:** Mathematics practice with notes, worked examples and questions.

**Long-description candidate (no unsupported commercial or examination claims):**

> Pri Learning is a mathematics learning and practice app with selected topics for
> students following Indian school and entrance-exam pathways. Review notes,
> follow worked examples and practise by selecting a class, chapter or topic.
> You can type your work or write on a supported phone or tablet.
>
> Handwritten work or photographs can be read online by the app's cloud reader
> after the app asks for the required permission. Review and correct the reading
> before requesting automatic feedback. Automated recognition and marking can
> make mistakes; the app provides a route to report problems.
>
> An account and an internet connection are needed for server reading and
> checking. Writing may be stored locally as a draft when disconnected, but
> offline handwriting or photo marking is not offered. Additional account or
> guardian steps can apply to younger students.
>
> Some functions or plans may be restricted. Subscription availability, price,
> renewal, restoration, trial terms, privacy disclosures and account eligibility
> must be confirmed in the relevant store before submission.
>
> Pri Learning is not affiliated with or endorsed by any examination board.

The exact current web build contains `features.json`:
`placement=false`, `tutor=false`, `australia=false`,
`extendedTracks=false`, `examHandwriting=false`,
`pastPapers=false`, `parentReport=false`, `instrument=true`,
`skin=aurora`. **Do not advertise the false-flag features.**
Do not say the question bank covers every syllabus topic; the academic
verification is separate. Do not claim certified per-step or examiner-verified
marking until the independent examiner gate closes.

## Store-native source identity

| Source-declared fact | Current source | Store-only confirmation still required |
| --- | --- | --- |
| Apple bundle identifier | `com.prilearning.app` | Check actual App Store Connect app/version history |
| Apple device support | iPhone + iPad; iPhone portrait | Genuine current UI screenshots in accepted dimensions |
| Apple declared version | `1.0 (2)` in both Swift packages | Confirm used/uploaded builds before allocating 3 or higher |
| Android package | `com.prilearning.app` | Play Console app identity and signing |
| Android version | `versionName 4.0`; minSDK 26; targetSDK 36 | Operator-allocated distinct Play versionCode |
| Product/catalog version | `4.0`, `CATALOG-2026-09` | Not an Apple build number |
| Subscription drafts | ₹199/month and ₹1,499/year in historic copy | **Intended only**, no confirmed live product/price/introductory terms |
| Data, children, outside AI, retention | Implementation/docs under separate controls | Real provider + counsel + guardian/Apple/Google disclosures, Step 23 |

## Screenshot and graphic acceptance audit

* Apple [screenshot specification](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) currently requires an iPhone with Dynamic Island (medium display) and a 13-inch iPad for this dual-family app. Accepted example portrait sizes are **1179×2556** and **2064×2752** respectively, with 2048×2732 also accepted for the 13-inch iPad. Capture the *real final native UI*, not a mock, and record source SHA, simulator/device family, OS and screenshot hashes.
* Google Play's [screenshot requirements](https://support.google.com/googleplay/android-developer/answer/9866151) specify maximum-longest-to-shortest dimension ratio **2:1** and PNG-24/JPEG. All six existing Oct-19 **phone 1080×2400** screenshots are **2.222:1 and therefore not Play-eligible**. Existing tablet screenshots and the 512×512 icon/1024×500 graphic still need current-art and semantic validation, even if pixel ratios comply.
* `STEP20_ASSET_PROVENANCE_2026-11-10.json` inventories all 12 historical Play screenshots, the icon and feature graphic with SHA-256, pixels and eligibility. These are **archival / NOT_FOR_SUBMISSION** until genuinely recaptured against the final accepted source. No current iPhone/13-inch iPad full product-story image series was certified in this step.
* Do not reuse the October fixture screenshots just because a script reports a matching dimension, and do not substitute a stock or AI-generated image for actual running app UI.

## Decision boundary

**Step 20:** Verify canonical source, true package identity, app UI/bridge integration,
file/hashes, native compile, in-scope simulator/accessibility/security tests,
and prepare draft copy/assets that state only what this evidence shows. The two current technical uncertainties
are the inconsistent hosted iOS WebContent-recovery gates and missing fresh
product-story screenshots, not merely unsigned store approvals.

**Step 23:** Authorised device-hardware trials, independent mathematics examiner,
third-party AI/guardian/privacy/legal review, store-product version/prices/
renewal/restoration and purchase flows, signing/export/distribution, and Apple/
Google submission/approval. Those are **not claimed complete** and should
not be manufactured as Step-20 evidence.
