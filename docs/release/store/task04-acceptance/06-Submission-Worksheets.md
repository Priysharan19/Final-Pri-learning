# Store Console entry and certification worksheets

**Owner-facing worksheet.** Mark each row `PASS`, `FAIL`, or `NOT TESTED` and attach a private evidence record. A checked field here is not store submission. For policies, use the current portal's wording and keep the signed final form separately from this repo.

## Apple App Store Connect entry sheet

| Field/step | Prepared value or required input | Status | Evidence link / reviewer |
|---|---|---|---|
| App name | Pri Learning: Maths Practice | [ ] | |
| Bundle ID | `com.prilearning.app`; verify registered App ID | [ ] | |
| Version | `1.0` source; current build `2` (must equal archive) | [ ] | |
| Device support | iPhone portrait + iPad | [ ] | |
| Subtitle | Write maths. Check your work. | [ ] | |
| Promo text and full description | `01-Apple-Listing-and-Review.md` gated copy | [ ] | |
| Keywords / category | Listed in Apple pack | [ ] | |
| Support URL | [working HTTPS + owner contact] | [ ] | |
| Privacy notice URL | [counsel-reviewed and publicly available] | [ ] | |
| Terms URL | [counsel-reviewed] | [ ] | |
| Copyright/owner/legal representative | [confirmed] | [ ] | |
| Content rights and educational independence | [counsel-reviewed] | [ ] | |
| Age rating | [exact full questionnaire archived] | [ ] | |
| App Privacy / nutrition label | `03-Privacy-Children-and-Data-Safety.md` resolved | [ ] | |
| Privacy manifest in signed archive | [validated] | [ ] | |
| Export compliance | [completed using actual encryption use] | [ ] | |
| Sign in with Apple / login parity | [actual working configurations] | [ ] | |
| Premium group and product IDs | monthly `.monthly` + annual `.annual`, verify actual Connect records | [ ] | |
| Paid Apps Agreement + tax/banking | [active] | [ ] | |
| Price schedule per territory | [exact Connect schedule; don't paste unchecked ₹] | [ ] | |
| StoreKit sandbox purchase, renew, cancel, refund, restore | [signed real-device scenarios] | [ ] | |
| Reviewer adult demo credentials | [private App Review fields only] | [ ] | |
| Guardian approved reviewer account (optional) | [private only, properly consented] | [ ] | |
| Screenshot iPhone Dynamic Island size | [1–10 valid genuine exact-release captures] | [ ] | |
| Screenshot iPad 13-inch size | [1–10 valid genuine exact-release captures] | [ ] | |
| Review notes | Apple pack, updated to actual UI paths | [ ] | |
| TestFlight / external physical QA / support contact | [report links] | [ ] | |
| Independent security/exam/consent gate | [formal human sign-offs] | [ ] | |
| Submit for review | **NO AUTHORIZATION IN THIS TASK** | BLOCKED | |

## Google Play Console entry sheet

| Field/step | Prepared value or required input | Status | Evidence link / reviewer |
|---|---|---|---|
| App name | Pri Learning: Maths Practice | [ ] | |
| Package | `com.prilearning.app` | [ ] | |
| App / Category | App / Education | [ ] | |
| Short and full descriptions | `02-Google-Play-Listing-and-Assets.md` gated | [ ] | |
| Default language | English (India) | [ ] | |
| Developer account type | [personal/organization + date] | [ ] | |
| Play account verification | [fully verified] | [ ] | |
| Play App Signing and upload key | [operator evidence; secrets OFF repo] | [ ] | |
| `versionCode` / `versionName` | [unique code] / currently `4.0` (source) | [ ] | |
| AAB SHA-256/source SHA/backend SHA | [immutable exact values] | [ ] | |
| Target API | 36 source; signed AAB audit | [ ] | |
| Icon 512×512 and graphic 1024×500 | Existing paths, verified final bytes | [ ] | |
| Phone screenshot slots | Genuine same-SHA captures; provenance report | [ ] | |
| Tablet screenshot slots | Genuine same-SHA captures; provenance report | [ ] | |
| Content rating (IARC) | [every question recorded] | [ ] | |
| Audience & Families | Class 7+ age targeting + counsel sign-off | [ ] | |
| Ads | No if final SDK audit supports | [ ] | |
| Data safety questionnaire | Third parties, telemetry and deletion resolved | [ ] | |
| Privacy policy / deletion URL | [publicly reachable real URLs] | [ ] | |
| App access & reviewer login | [secure Console fields; re-test] | [ ] | |
| Premium SKU/base plans/prices | [real Play Console and test evidence] | [ ] | |
| Developer API/RTDN/service account | [verified on safe staging] | [ ] | |
| License-test purchase/cancel/refund/restore | [signed Android device] | [ ] | |
| App Links signing SHA | [Google app signing cert, not upload cert] | [ ] | |
| Internal testing | [approved, user-authorized] | [ ] | |
| Closed 12 testers × 14 days (if applicable) | [real opted-in tester proof] | [ ] | |
| Google production access | [granted by Google, if required] | [ ] | |
| Submit/release | **NO AUTHORIZATION IN THIS TASK** | BLOCKED | |

## Exact-release shot provenance form (repeat for each frame)

| Key | Entry |
|---|---|
| Store / device category | [Apple iPhone / Apple iPad / Android phone / Android tablet] |
| Original raw filename | [path] |
| Intended listing frame and claim | [01–08 / approved caption] |
| Source SHA | [40-char git SHA] |
| Native archive / AAB SHA-256 | [hash] |
| Backend `/v1/health.releaseIdentity.releaseSha` | [40-char SHA] |
| Device model / OS | [real device and version] |
| Capture tester / date/time | [operator-approved person, timestamp] |
| Test account consent / whether student is minor | [adult synthetic account preferred; don't record email] |
| Method | [real screenshot from native product, not mock; no fake grading] |
| AI transcript and marking provenance | [server receipt id **stored privately**; never exposed to store] |
| Privacy clearance and UI authenticity QA | [signed reviewer] |
| Apple / Google slot technical validator | [pass/fail with screenshot pixel dimensions] |
| Final file hash and uploader approver | [hash; signed owner approval] |

## Four-device critical journey result sheet

| Step | iPhone | iPad | Android phone | Android tablet |
|---|---|---|---|---|
| Fresh signed install / exact source identity | [ ] | [ ] | [ ] | [ ] |
| OTP delivery with real operator-owned inbox | [ ] | [ ] | [ ] | [ ] |
| Guardian-gated child account (including negative pending case) | [ ] | [ ] | [ ] | [ ] |
| Same account sync / recovery and account isolation | [ ] | [ ] | [ ] | [ ] |
| Server-issued actual question | [ ] | [ ] | [ ] | [ ] |
| Finger/stylus handwriting / correction before submission | [ ] | [ ] | [ ] | [ ] |
| Real permitted photo / provider flow / correction | [ ] | [ ] | [ ] | [ ] |
| Server-receipt-bound grading / truthful feedback | [ ] | [ ] | [ ] | [ ] |
| History survives restart and cross-device sync | [ ] | [ ] | [ ] | [ ] |
| Offline: draft preserved; **no offline marking** | [ ] | [ ] | [ ] | [ ] |
| Subscription purchase / restore / cancel / refund | [ ] | [ ] | [ ] | [ ] |
| Delete account + provider billing warning | [ ] | [ ] | [ ] | [ ] |
| Screen readers and text scaling | [ ] | [ ] | [ ] | [ ] |
| Landscape, portrait, safe areas and keyboard | [ ] | [ ] | [ ] | [ ] |

Only a **separately authenticated human** may mark real physical-device results. Device-matrix recorder in repo requires real hardware, person, OS and 40-hex build SHA. Emulator runs remain useful lower-tier evidence, not substitutes.

## Publication sign-off

| Gate | Decision/evidence |
|---|---|
| Selected immutable `main` candidate SHA | [not nominated] |
| Independent technical reviewer + exact diff | [not obtained by this task] |
| Current required CI and security checks | [not run by this task] |
| Independent mathematical examiner | [pending, Issue #499] |
| Apple review account/product/pricing | [not verified in Console] |
| Google Play account/product/pricing | [not verified in Console] |
| Counsel/child privacy and content rights | [not signed off] |
| Four physical-device results | [not verified] |
| Staging/production matching SHA | [not verified] |
| Explicit owner authorization to upload/store-submit | **Not granted** |
| Decision | **HOLD: NO PUBLICATION** |
