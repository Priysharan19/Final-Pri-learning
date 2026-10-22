# Google Play listing — Pri Learning (draft)

**Status:** draft prepared 2026-10-18. Android phones and tablets are **in V1** since the owner's
scope change of 2026-10-16 (`docs/release/PRI_V1_RELEASE_SCOPE.md` §22, issue #504); Google Play
Billing certification is a release blocker (§22.2). **Not entered in Play Console.** The same truthfulness
rules as `app-store-listing.md` apply: no superiority, accuracy, syllabus-complete or
production-ready claims.

| Fact | Value |
|---|---|
| Package name | `com.prilearning.app` — **OWNER** confirms against `android/app/build.gradle` `applicationId` before creating the app (the package name cannot be changed later) |
| Devices | Android phones and tablets (V1, §22.1) |
| Billing | Google Play Billing (`server/platform/googleBilling.js`); web/Razorpay purchasing is out of V1 |
| Intended prices | ₹199 / month, ₹1,499 / year — **OWNER** creates and prices the Play subscription products; they are separate from the App Store products |

## 1. Store listing text

| Field | Limit | Draft | Length |
|---|---|---|---|
| App name | 30 | `Pri Learning: Maths Practice` | 28 |
| Short description | 80 | `Maths practice for CBSE Class 7–12 and JEE. Write your working by hand.` | 71 |

**Full description** (4,000):

> Pri Learning is a maths practice app for students in India: CBSE / NCERT Classes 7 to 12,
> JEE Main and JEE Advanced.
>
> WRITE THE WAY YOU WOULD ON PAPER
> Answer with a stylus or your finger, one line of working at a time, or type if you prefer. You
> can also photograph working you did on paper, or a question from your textbook to practise
> questions like it.
>
> HOW YOUR ANSWER IS MARKED
> Your handwriting or photo is read by Pri's server. The reading only proposes what you wrote:
> you see it, and you can correct it before it counts. The mark itself is decided by Pri's
> marking engine, a fixed set of mathematical rules, never by an AI model. Marking is automatic
> and can be wrong; if you think a question was marked wrongly, report it from the question.
>
> WHAT YOU CAN DO
> • Practise by class, chapter and difficulty
> • Sit timed exam simulations
> • See the worked solution once a question is finished
> • Follow your progress chapter by chapter
>
> FREE AND PREMIUM
> The free plan includes unlimited practice and 5 answers marked by the examiner each day,
> for CBSE / NCERT and JEE Main. Pri Learning Premium adds unlimited marking, mock papers, the
> full mistake notebook, the parent report, the target plan and the JEE Advanced track.
> Premium is ₹199 a month or ₹1,499
> a year, billed through Google Play
> and renewing automatically until you cancel in Google Play.
>
> WHAT PRI NEEDS
> Checking answers needs a Pri account and an internet connection. Students under 18 need a
> parent or guardian to confirm their account before Pri can check their answers.
>
> PRIVACY
> No ads. No tracking. We do not sell your data. Your account data is stored on Pri's servers, which
> today run on Railway in the Netherlands (Amsterdam); a move to Supabase in Mumbai is planned.
> To read your handwriting or photo, Pri's server
> sends the image to an outside AI reading service (OpenAI); it is never sent with the question,
> the answer or your name, and Pri keeps no copy of the image. If you turn on the optional
> working check, the lines of your working and the text of the question are also sent to the
> same service to find where a mistake is. You can switch server reading off
> and type your answers instead. You can delete your account in the app or at
> <PRI_PUBLIC_ORIGIN>/account/delete-request.
>
> Pri Learning follows the NCERT syllabus and public examination patterns. It is not endorsed by,
> affiliated with or approved by NCERT, CBSE, the NTA or any examination authority.

Play metadata policy: no emoji-only lines, no ALL-CAPS beyond section labels, no "best", "#1",
"top", "free" in the title, no testimonials, no ranking or price-promotion claims in the title or
icon.

## 2. Category, tags, contact

| Field | Draft |
|---|---|
| App or game | App |
| Category | **Education** |
| Tags (choose up to 5 offered by Play) | Education, Maths, Exam preparation, Study tools — pick from Play's list |
| Contact email | `{{SUPPORT_EMAIL}}` — **OWNER** |
| Website | `https://prilearning.com` — **OWNER** confirms |
| Privacy policy | `<PRI_PUBLIC_ORIGIN>/privacy` (must be rewritten first, see the counsel pack §8) |
| Account deletion URL | `<PRI_PUBLIC_ORIGIN>/account/delete-request` |
| Data safety | `docs/release/play-data-safety.md` |

## 3. Content rating (IARC questionnaire)

| Question (substance) | Answer | Justification |
|---|---|---|
| Category | Reference, News or Educational | — |
| Violence, fear, sexuality, language, controlled substances, crude humour | No | Maths questions only |
| Gambling or simulated gambling | No | — |
| Users can interact or exchange content | **No** | No chat, feed or sharing; teacher classes are not public in V1 |
| Shares user's current physical location with other users | No | No location API |
| Allows purchases of digital goods | **Yes** | Premium subscription via Play Billing |
| Unrestricted internet access | No | Client reaches only its own origin |
| Generative AI features producing content shown to users | **OWNER:** the handwriting reader's transcription is shown back to the student; the tutor is off unless `PRI_FEATURE_TUTOR=1`. Answer according to the release build and Play's current wording |

**Expected result:** the lowest rating band in each region (IARC 3+, PEGI 3, ESRB Everyone). The
rating describes content; it is not the target audience.

## 4. Ads, app access, government

| Play declaration | Answer |
|---|---|
| Contains ads | **No** |
| App access | Some functionality is restricted: sign-in required. Provide the **reviewer account TO BE CREATED** (adult, email verified, email + password) and instructions as in `app-store-listing.md` §6 |
| Government app | No |
| Financial features | No (subscriptions only) |
| Health | No |
| News | No |

## 5. Target audience and Families policy — OWNER / counsel decision

Play asks which age groups the app targets: 5 and under, 6–8, 9–12, 13–15, 16–17, 18 and over.

- Pri's students start at **Class 7, about 12 years old**, and run through JEE (17–18 and adult
  repeaters). A truthful answer is **9–12 (for Class 7 students who are 12), 13–15, 16–17 and 18+.**
- On the owner's reading of Play's policy (**for counsel to confirm**), selecting any group under
  13 brings the app under the **Families policy**, which as we understand it requires, among other
  things: the app and its SDKs comply with Families requirements; personal data from
  children is collected only with disclosure and in line with applicable law; no transmission of
  device identifiers such as the advertising ID from children; content appropriate for children;
  and the Families self-certified ads SDK rule (Pri has no ads, so that part is satisfied).
- Excluding 9–12 would be inaccurate if Class 7 students are 12; our understanding (counsel to
  confirm) is that Play treats a misdeclared audience as a policy violation.
- Pri sends a child's handwriting images to OpenAI after guardian confirmation. Whether that is
  acceptable under the Families policy's data rules, with the current (non-verifiable)
  confirmation, is a question for counsel (`docs/legal/counsel/COUNSEL-INFORMATION-PACK.md` §11 question 26).

Recommended to bring to counsel: declare 9–12 through 18+, accept the Families policy, and do
not apply for the "Teacher Approved" programme until counsel has reviewed the consent flow.

## 6. Graphics and screenshot shot list

| Asset | Spec (confirm in Play Console) |
|---|---|
| App icon | 512 × 512 PNG, 32-bit, the P′ mark (owner decision 2026-10-02) — **generated:** `docs/release/store/play/icon-512.png` |
| Feature graphic | 1024 × 500 JPG or 24-bit PNG; wordmark, P′ mark and the first sentence of the short description on ruled paper; no price or ranking text — **generated:** `docs/release/store/play/feature-graphic-1024x500.png` (24-bit RGB, no alpha) |
| Phone screenshots | 2–8, 16:9 or 9:16, each side 320–3840 px; at least 4 at 1080 px or more for promotion eligibility |
| 7-inch tablet screenshots | Up to 8; required for tablet listing |
| 10-inch tablet screenshots | Up to 8; required for tablet listing |

Both graphics are rendered by `node tools/play-graphics.mjs` from `client/public/favicon.svg` and the
`client/src/theme.css` tokens; `node tools/play-listing-check.mjs` checks §1 and the graphics.

**Screenshots: still to capture — none exist yet.** They must be real captures from the Android
release build on hardware or an emulator; none are generated or mocked.

Shots (same order and captions as `app-store-listing.md` §7, captured on Android hardware from the
release build with demo data): handwriting in progress; reading shown back with the correction
control; finished question with mark and solution; chapter picker; JEE tracks; exam simulation;
progress; photo of paper working; plan screen (after prices are set). No real student data, no
owner private photo, no claims beyond what the screen shows.

## 7. Release tracks

1. Internal testing (up to 100 testers, owner's own test accounts).
2. Closed testing — a new personal developer account must run a closed test with at least 12
   testers for 14 days before production access (Play's rule for personal accounts created after
   November 2023; **OWNER** confirms whether the account is personal or organisation).
3. Production, staged rollout.
