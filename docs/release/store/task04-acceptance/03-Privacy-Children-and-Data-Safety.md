# Apple App Privacy + Google Play Data safety — submission worksheet

**Status:** Implementation-informed proposed answers. **DO NOT click Publish/Submit.** The relevant already-authored primary tables are `docs/release/app-store-privacy-labels.md` (Apple, revised 18 October) and `docs/release/play-data-safety.md` (Play, revised 19 October); both are preserved. The English privacy notice `docs/legal/privacy.md` is **dated 19 October**, so 18 October notes stating that the notice still claims local grading must be re-audited rather than repeated. Counsel and operator evidence is still missing.

## A. Cross-platform personal-data inventory

| Data and treatment | Collection evidence | Onward service / processing | Account deletion and unresolved control |
|---|---|---|---|
| Email, name, one-time codes, verified identity and account ID | `server/platform/accounts.js`, `security.js`, `otp.js`, `authDelivery.js` | Pri server; email provider (Resend according to code/docs); Apple/Google if federated sign-in used | Accounts and bound records removed by server deletion; verify production delivery region, email contract and failure mode |
| Guardian name/email/phone, age decision, consent receipt | `guardianConsent.js`, `accounts.js` | Pri; Resend or optional SMS provider | Child's account is gated pending consent; **an email address supplied by a minor is not automatically verified parental identity**. Counsel must approve applicable Indian child-consent implementation and disclosure |
| Local ink strokes | `client/src/local/idb.js`, `client/src/ink/*` | Stored locally; rasterised image sent for cloud reading if enabled | Local profile may remain after cloud account deletion. Explain local clearing separately. Do not describe all ink as off-device or all ink as permanently on-device |
| Photo of handwritten work or question | `client/src/pages/PractisePhoto.jsx`; `server/platform/practice.js`, `questionPhoto.js` | Pri → third-party AI reading provider (OpenAI default) | Pri is documented as not retaining source image; provider retention and DPA/abuse monitoring must be confirmed; no absolute "not stored anywhere" claim |
| OCR/transcription, typed answer, corrected working, verdict, History | `practice.js`, `exams.js`, `sync.js`; `docs/privacy/data-retention.md` | Pri server; optional working-check lines + question to model provider if enabled | Transcription receipt described as 90-day; exam records may persist up to 5 years unless account deletion; verify all tables and backup retention |
| Session/device pseudonymous identifier | `cloudAccount.js`, `security.js` | Pri server (account-linked); not evidence of IDFA/AAID | Delete sessions and bound per-install records per lifecycle; validate Android SDKs do not transmit forbidden child device identifiers |
| Learning events, topic, marks and progress | `syncContract.js`, `telemetry.js`, `practice.js` | Pri server | Until deletion or configured retention; operation telemetry 90 days |
| Subscription transaction/entitlement | `appleBilling.js`, `googleBilling.js`, `entitlements.js` | Apple/Google purchase verification; Pri account entitlement | Deletion can leave unlinked legally necessary payment events; must tell user Apple/Google subscriptions require separate cancellation |
| Operational error and performance telemetry | `server/platform/telemetry.js`, `errorSink.js` | Pri server; Sentry if `PRI_SENTRY_DSN` set | No automatic assumption of "zero analytics"; privacy labels include app interactions/diagnostics; owner must verify deployed Sentry and crash classification |
| Third-party AI tutor | `server/platform/tutor.js`, feature flag `PRI_FEATURE_TUTOR` | Provider if enabled | **Flag OFF unless exact signed build and deployment show otherwise**; re-answer AI/child suitability questionnaires if enabled |

**Processing outside India:** repository records Railway production Amsterdam in early October; Supabase Mumbai is an intended cutover, not a certified currently live production location. AI processing is documented as outside India; independently confirm region/provider agreements before making geography claims.

## B. Apple App Privacy: proposed Connect selections

| Apple prompt | Proposed answer | Gating / rationale |
|---|---|---|
| Does developer/partners collect data? | **Yes** | Account/auth, answers, synced learning and billing records |
| Used for tracking? | **No, conditional on final binary and processors** | Both `PrivacyInfo.xcprivacy` manifest copies set `NSPrivacyTracking=false`; recheck SDK telemetry and deployment |
| Contact Info → Name / Email / Phone | **Yes** | Name, sign-in email, optional SMS/guardian contact; phone may be optional |
| Identifiers → User ID / Device ID | **Yes (conservative)** | Account opaque ID and per-install pseudonymous device token |
| Financial Info → Purchase History | **Yes** | Subscription status/transaction reference; no known developer-collected card numbers |
| User Content → Photos or Videos | **Yes** | Photo to model via Pri server, even if Pri doesn't retain the raw photo |
| User Content → Other User Content | **Yes** | Written/typed/corrected answers, transcript and synced user content |
| Usage Data → Product Interaction / Other Usage Data | **Yes** | Learning and operational events |
| Diagnostics → Performance Data / Other Diagnostic Data | **Yes** | Timings, error/failed operation codes; do not call this 'no analytics' |
| Other Data | **Yes** | Age declaration, class/track, guardian state |
| User Content → Customer Support | **DECISION REQUIRED** | Free-text user-submitted question reports might fall under support requests |
| Diagnostics → Crash Data | **DECISION REQUIRED** | Apple draft says No because no crash SDK; Google draft says Yes for structured in-app error reports. Determine final definition with Apple and live capture type; don't omit a category merely because data lacks a dedicated SDK |
| Linked to user | **Yes for listed classes** | Account and session binding in primary manifest |
| Used for advertising/tracking | **No if final audit confirms** | No advertising SDK identified; compare Apple's app-level label with final embedded libraries |
| Collected for Product Personalization | **DECISION REQUIRED** | Server chooses a student's next question from their attempts; Apple classification must reflect current definitions |
| Sharing with third-party AI | **Yes** | Requires specific pre-transfer disclosure and **explicit permission** (Apple 5.1.2(i)) before uploading personal data |
| Privacy URL | **[LIVE COUNSEL-APPROVED HTTPS]/privacy** | Test publicly accessible URL; not a generic placeholder |
| Account deletion | **Yes, in app** | `DELETE /v1/account`; confirm current UI path, real credentials and subscription cancellation warning |

**Privacy manifest caveat:** Apple's `PrivacyInfo.xcprivacy` is not the same as the App Store Connect App Privacy questionnaire. Both must be accurate independently; `docs/release/app-store-privacy-labels.md` acknowledges a manifest/doc cross-check is not yet implemented.

**Apple minor audience:** The app may avoid Apple's Kids Category because its stated audience begins around Class 7, but it still processes under-18 account and images. The guardian confirmation and AI third-party transfer need counsel's approval. Do not set an age rating from educational genre alone; fill every contemporary App Store Connect age-rating question from the exact release binary.

## C. Google Play Data safety: proposed answer sheet

| Console question | Answer for candidate | Verification / caution |
|---|---|---|
| Collect or share personal data? | **Yes** | The shared server ingests contact, activity, photos and answers |
| Encrypted in transit? | **Yes if release origin uses HTTPS exclusively** | Android `usesCleartextTraffic=false`; production TLS, redirect and any SDK traffic need verification |
| Account creation available? | **Yes** | Email/password, OTP and potentially social sign-in; select *only* methods actually available in Android candidate |
| In-app deletion available? | **Yes, candidate implementation** | Test with authenticated account and external email-proof path, from real build |
| External deletion URL | `[PRODUCTION VERIFIED HTTPS ORIGIN]/account/delete-request` | Public URL must resolve and work without having the app installed |
| Optional partial data deletion? | **No evidence** | Whole-account deletion route established; do not answer Yes unless verified partial deletion route exists |
| Independent security review/MASA? | **No verified independent MASA** | Automated CI is not MASA |
| Data sold? | **No, conditional on provider contracts** | Legal declarations must match actual use and agreements |
| Ads? | **No, subject to dependency check** | No advertising SDK asserted by repo; confirm merged permissions and SDK data |
| Data types — Personal info | Name, email, User IDs, optional phone, other personal information (guardian/class/age) | Source: primary Play sheet §2 |
| Data types — Financial | Purchase history | Google Play Billing verification; not credit-card detail |
| Data types — Photos/videos | Photos | Camera work/question photograph routed to external reading |
| Data types — App activity | App interactions; other user-generated content; other actions | Events, typed working, answers and grading |
| Data types — App info/performance | Diagnostics and crash/error logs **pending taxonomy confirmation** | `telemetry.js` records structured events, some user-opt-out; Sentry feature flag must be inspected |
| Data types — Device or other IDs | Yes | Pseudonymous device UUID; transitive Play services usage must be audited |
| "Shared" columns | **Pending provider-contract decision** | Play's service-provider exception may apply to Pri's contracted processors; otherwise declare OpenAI/Resend/SMS transfers; do not assume exemption from product design alone |
| Photos processed ephemerally? | **Undecided — do not automatically tick Yes** | Pri's own server may not persist image, but external AI provider may retain content for abuse review; verify Google's specific definition and written provider terms |
| Target audience | **9–12, 13–15, 16–17, 18+ if intended audience remains Class 7+** | Owner and counsel must sign target audience and child legal basis; do not misdeclare age to avoid Families |
| IARC content rating | **Complete live IARC from exact build** | No known violence/sex/gambling; evaluate AI, user content, purchase and webview fields accurately, don't invent rating |

**For each collected Play data class:** enter required vs optional (email and phone depend on enabled sign-in methods), purpose (account management, app functionality, security, analytics for coded diagnostics and interactions), transience (no for account-linked retained records), and third-party sharing only after contract classification. A parent email address is personal information even if it doesn't belong to the student.

## D. Children's and guardian decision record — publication-blocking

| Question for owner/counsel | Current engineering fact | Required resolution before release |
|---|---|---|
| Is 9–12 targeted? | Class 7 ~12, JEE 17+/adult; yes on intended positioning | Counsel validates target groups; declare truthfully in Play; apply Families rules as required |
| Does guardian actually verify parental capacity? | Source docs admit email/link/code can be forwarded to a child-supplied contact; no independent parent identity assurance | Approved age/parent-verification method satisfying applicable Indian DPDP requirements; test with real, operator-controlled account |
| Is AI data transfer specifically consented? | Default cloud reading for eligible signed-in accounts; user can disable; provider OpenAI | Explicit, versioned opt-in disclosure before **first upload**, guardian authorization as appropriate; counsel verifies control works on every device |
| Are all dependent third parties appropriate for mixed child audience? | Google Play Billing, Play phone auth; external OpenAI/Resend; SDK and processor terms not verified | SDK/provider Families compliance audit, contracts, controller/processor classification, region, retention, children safeguards |
| Can guardian withdraw? | Server guardian-withdraw flow documented | E2E with OTP provider, revocation and account switching on real build, no leaked child content |
| Can user delete account remotely? | Server and public OTP deletion route written | Production URL HTTP check and test-account deletion proof; confirm backup retention and unpaid ongoing subscription warnings |
| Are child-targeted monetization claims compliant? | Premium required for V1; store payment only | Paywall age route, adult action where required, no pressure/false savings, real subscriptions sandboxed |

## E. Must-reconcile text differences (identified on source baseline)

1. `docs/release/store/app-store-listing.md` and `play-listing.md` still present the intended ₹199/₹1,499 prices as though live; vendor-side product/price and agreements not verified.
2. The 18 October counsel pack labels `docs/legal/privacy.md` out of date; the privacy notice was revised on 19 October and now describes online grading, AI reader and Amsterdam→Mumbai cutover. **Do a new same-SHA diff/legal audit**, not a blanket rewrite.
3. Apple privacy-label draft says Crash Data **No**; Google Play draft lists Crash logs **Yes** for coded client errors. It may be a definitional distinction, but it must be resolved from Google's and Apple's category definitions and actual binary.
4. The Apple document sometimes uses "no third-party analytics" in review notes while server operational analytics is collected. Replace with "no ad tracking" if true; don't imply no usage/performance telemetry.
5. The privacy/manifests and drafted forms list optional SMS data although launch SMS provider is not yet chosen; recheck final sign-in options.
6. The customer-support classification for in-app issue reports and Apple Product Personalisation classification remain owner/counsel decisions.
7. Account deletion may delete cloud rows yet keep **local** profiles; public descriptions must distinguish them.

## F. Sign-off evidence sheet

- Owner/operator: `PRI_PUBLIC_ORIGIN=[verified]`; current `GET /v1/health.releaseIdentity.releaseSha=[value]`; post-cutover region and processor matrix `[signed evidence]`.
- Provider: OpenAI contract/retention and permission flow signed `[date/person/reference]`; provider conditions for minors `[reference]`.
- Final Android APK/AAB SDK/permission list, device IDs, billing and sign-in methods `[SHA/hash/report]`.
- Final iOS archive `PrivacyInfo.xcprivacy` included and App Privacy selections reviewed `[archive hash]`.
- Counsel: English and Hindi notices, DPDP consent and Families assessment `[signed reference; not secrets]`.
- QA: genuine adult/child/deletion/revocation/price/receipt checks `[build SHA]`.
- Account holder: personally reads current live Console questions and enters **approved**, consistent answers. `[timestamp/reference]`.

## Official policy references (verified 20 Oct 2026)

Apple third-party AI permission and child rules: https://developer.apple.com/app-store/review/guidelines/  
Apple account deletion: https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/  
Apple privacy details: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy  
Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469  
Play deletion: https://support.google.com/googleplay/android-developer/answer/13327111  
Play Families: https://support.google.com/googleplay/android-developer/answer/9893335
