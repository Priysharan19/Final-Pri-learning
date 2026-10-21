# Apple App Store — copy and reviewer pack

**Condition:** Text-only candidate for source `98a30194caf349885a24b11d75edf01ac50df428`; submit only when a certified, signed build and the claim register match. Existing detailed authored source: `docs/release/store/app-store-listing.md`. Language: English (India); availability: India first, subject to owner selection.

## Paste-ready public fields

| Field | Copy | Gate |
|---|---|---|
| App name (≤30) | **Pri Learning: Maths Practice** | Owner must verify availability and title on Connect |
| Subtitle (≤30) | **Write maths. Check your work.** | Verify actual correction and checking journey |
| Promotional text (≤170) | **Practise mathematics by writing, typing or photographing your work. Review the reading before submitting it for online checking.** | Photo/transcript/confirm path on exact build |
| Primary category | Education | Owner |
| Secondary category | None proposed | Owner |
| Keywords (≤100) | maths,mathematics,CBSE,NCERT,JEE,practice,revision,handwriting,algebra,exams | Verify no prohibited trademark implication |
| Copyright | © 2026 [CONFIRMED RIGHTS HOLDER] | Owner legal identity |
| Privacy policy URL | [VERIFIED LIVE HTTPS ORIGIN]/privacy | Legal approval and real URL HTTP check |
| Support URL | [VERIFIED LIVE SUPPORT HTTPS URL] | Working contact and support page |
| Marketing URL | [VERIFIED LIVE MARKETING HTTPS URL] | Optional; omit if not operational |
| App Store version | **1.0**; build **2** in the current Swift packages | Confirm App Store Connect record and archive |

### Full description — public candidate

Pri Learning helps students practise mathematics across CBSE/NCERT classes and JEE preparation.

**Work through a question in your own way**
Choose a practice question, write your working with a finger or compatible stylus, or type your answer. You can also choose to photograph working completed on paper.

**Check what Pri understood**
For handwriting and photographs, the app can request an online reading of your work. Review the proposed reading and correct it before submitting. Pri's server then checks the submitted answer against mathematical rules and provides feedback. Automatic marking can make mistakes.

**Keep learning**
Return to your previous attempts in History, explore practice by topic and review solutions and feedback for completed questions. Some content and tools require Premium.

**Your account and connection**
Checking answers requires a verified Pri Learning account and an internet connection. Work may remain on your device while you are offline, but it is not graded offline. Students under 18 must complete the app's guardian-permission process before using cloud learning features.

**Free and Premium**
Pri Learning includes a free practice tier. Optional Premium subscriptions provide additional practice and learning capabilities. Availability, subscription periods and the price charged are displayed before purchase in Apple's payment sheet. Subscriptions renew automatically unless cancelled in Apple Account subscription settings.

**Your privacy choices**
When you choose cloud handwriting or photo reading, an image of the work is sent through Pri Learning's server to a third-party AI reading service. You can turn cloud handwriting reading off and type answers instead. For account removal, use the deletion option in Account settings. Read the in-app privacy notice for data handling and retention details.

Pri Learning is independent of NCERT, CBSE, NTA and other examination authorities; it is not endorsed by them.

**Legal references (not literal placeholders for publication)**
- Terms of use: [LEGAL-REVIEWED LIVE TERMS URL]
- Privacy notice: [LEGAL-REVIEWED LIVE PRIVACY URL]

**Public-copy hold:** Description may be submitted only after legal consent and privacy notices, actual full journey, images, learning/solutions, Premium paywall, and independence wording are verified on the exact release. Remove features from this copy that are not accessible on that build; never assume a code path is production-enabled.

### Optional Premium wording — gated alternative
Only if the **live Apple subscription products** and the exact build's entitlement response prove all facts, replace the generic Premium paragraph above with:

> Free accounts can check up to 20 practice questions each day and run one exam simulation in a 30-day window. Premium removes these limits and includes access to JEE Advanced practice. The exact monthly and annual prices are shown in the app before purchase. Subscriptions renew automatically unless cancelled.

**Do not include ₹199 or ₹1,499** in public metadata until prices, territories, billing agreement, currency and storefront UI match. For Apple, products recorded in repository: `com.prilearning.app.premium.monthly` and `.annual`, reported as created but unpriced.

## What's New
**First release / version 1.0, conditional:**
> Introducing Pri Learning for mathematics practice. Work through questions, review your answers before online checking, and revisit completed attempts in History.

Use only on first successful 1.0 submission and after demonstrated certified navigation. Do not claim bug fixes, existing customers, exam results or version history.

## App Review — paste-ready notes after demo credentials are created

> Pri Learning is an account-based maths practice app. An internet connection is required for server-issued questions and checking.
>
> Sign in with the adult review account entered in App Review's secure credential fields. The account must be verified and contain only test data. Open Practice, select a topic, complete a question, check the transcript (if handwriting/photo is used), confirm the proposed reading and inspect the server result. Open History to inspect the saved attempt.
>
> For a camera test, choose the photo-answer control and photograph a non-personal sample page. Camera access occurs only when requested. Do not submit private student content.
>
> A second child test account is optional. If supplied, its guardian must have completed permission using a real operator-controlled mailbox before the review. A child without permission cannot receive online grading.
>
> Premium purchases are made through StoreKit and entitlements are verified on the server; use Apple's testing environment as enabled for the review build. Manage/restore subscriptions under the exact menu path shown by the final build.
>
> Account deletion is in Settings → Account → Delete cloud account (confirm the exact route before submission). Deletion is account-wide; an Apple subscription must also be cancelled with Apple to stop renewal.
>
> Handwriting/photo images may be passed through the server to an external AI service to propose a transcription; the server's deterministic mathematical checker, not AI prose, determines marks. Online processing and third-party handling are disclosed in the privacy notice and consent UI.
>
> Contact the reviewer contact specified in App Store Connect for setup or access questions.

**Test-account worksheet (complete outside source control):**

| Proof | Status to fill |
|---|---|
| Adult verified login works on the submitted build | [ ] |
| Child guardian-approved login works if provided | [ ] |
| Secure credentials supplied in App Review fields, not repository | [ ] |
| Reviewer has at least one question with available working/answer | [ ] |
| No live student, personal, private photograph or real subscription is used | [ ] |
| StoreKit sandbox products, restore and purchase verified | [ ] |
| Account deletion works and cancellation warning is displayed | [ ] |
| Server origin/release SHA matches archive; review account available for review duration | [ ] |
| Support email and reviewer phone reachable | [ ] |

## Screenshot capture: certification before upload

Current Apple policy requires at least one screenshot for a **Dynamic Island iPhone (medium display)** and for a **13-inch iPad** if iPad is supported; up to 10 per required device size, PNG/JPEG. Use App Store Connect's current per-size pixel validator, not guessed device pixels. No Apple screenshots were established as final release assets in this audit.

| Frame | iPhone portrait | iPad | Caption (only if true) |
|---|---|---|---|
| 01 | Real finger-written question | Real Pencil/finger-written question | Write your working |
| 02 | Recognition + correction control | Same | Review what Pri read |
| 03 | Confirmed online verdict + criterion feedback | Same | See feedback on your answer |
| 04 | Subject/class/chapter picker | Same | Choose what to practise |
| 05 | History after app restart | Same | Return to previous attempts |
| 06 | Photo input in app | Same | Check working from a photo |
| 07 | Plan/paywall | Same | Explore Free and Premium **only after billing certification** |

1. Install exact signed build onto named physical iPhone/iPad; record `main SHA`, native build, server health SHA, OS, locale, tester, timestamp, consent route, and screenshot raw SHA-256.
2. Prepare synthetic/dummy educational content and operator-owned test account; never fabricate scoring/recognition UI or retouch results.
3. Execute guardian/email OTP, account-bound sync, finger/Pencil, photo, edit-confirm, server feedback, History/restart, offline non-marking, deletion. Save only the required screens with consent.
4. Capture native screenshots in supported orientations (iPhone portrait; iPad per accepted orientations); check accessibility text, safe areas, privacy-safe status bar.
5. Select 4–7 truthful screens per device size; capture from the *same accepted candidate and compatible server*, not the older fixture. Redact only non-product OS/test identifiers if needed; never replace product UI, model output, numbers or marks.
6. Enter images **after** ownership and independent QA approval; do not imply device certification from screenshot dimensions alone.

## App-specific policy answers
- App category: Education; **do not select Kids Category** unless owner/counsel revises product/audience and complies with its requirements. Avoid implying this exempts under-18 handling.
- Most age-rating content categories (violence, sex, gambling, substance use): no known such content in inspected math-focused source; **answer final live questionnaire from audited build**, including AI/interactivity/in-app purchase/age assurance questions. Do not pre-assert a rating.
- Account creation: **Yes**; in-app deletion required.
- Data collection: **Yes**; tracking: **No** only if exact binary and server setup match.
- Third-party AI data: **Yes**; record explicit informed permission gate before first transfer or obtain policy/counsel ruling with evidence.
- In-app purchases: **Yes** for subscribed launch, contingent on certified StoreKit.
- No ratings, learning-gain promises, endorsed-examination status or offline grading in listing.

Official: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications ; https://developer.apple.com/app-store/review/guidelines/ ; https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/
