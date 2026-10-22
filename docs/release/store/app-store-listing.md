# App Store listing — Pri Learning (draft for App Store Connect)

**Status:** draft prepared 2026-10-18 for Phase 6 against `main` `7bef402f7`. **Not entered in App
Store Connect.** Every product statement below is checked against the code it describes (cited in
§9). Nothing here claims superiority over another app, a level of accuracy, complete syllabus
coverage or production readiness. Where a fact belongs to the owner (prices, URLs, reviewer
account), it is marked **OWNER**.

| Fact | Value | Source |
|---|---|---|
| Bundle id | `com.prilearning.app` | `ios/PriLearning.swiftpm/Package.swift` |
| Source version / build | `4.0` (`2`) — **OWNER** decides whether App Store Connect's first version is 1.0 or 4.0 (`docs/release/V1_COMPLETION_LEDGER.md` surface 22) | `Package.swift` |
| Device families in the current build | **iPhone and iPad** (`supportedDeviceFamilies: [.pad, .phone]`; iPhone portrait-only) since #523 | `Package.swift`; `PRI_V1_RELEASE_SCOPE.md` §22 (owner scope change #504) |
| Consequence | Both the iPad and the iPhone screenshot sets in §7 are mandatory | — |
| Subscription products | `com.prilearning.app.premium.monthly`, `com.prilearning.app.premium.annual` — created in App Store Connect, **not yet priced** | owner; server reads them from `PRI_APPLE_MONTHLY_PRODUCT_ID` / `PRI_APPLE_ANNUAL_PRODUCT_ID` (`server/platform/appleBilling.js`) |
| Intended prices | ₹199 / month, ₹1,499 / year — **OWNER** sets them in App Store Connect; copy below must match what is set | owner |
| Primary market | India first (`PRI_V1_RELEASE_SCOPE.md` §5) | — |

---

## 1. Name, subtitle, promotional text

| Field | Limit | Draft | Length |
|---|---|---|---|
| App name | 30 | `Pri Learning: Maths Practice` | 28 |
| Alternative name | 30 | `Pri Learning` | 12 |
| Subtitle | 30 | `CBSE and JEE maths, by hand` | 27 |
| Alternative subtitle | 30 | `Write maths. Pri checks it` | 26 |

**Promotional text** (170; can be changed without a new build):

> Write your working with Apple Pencil or your finger. Pri reads it, and a fixed marking engine,
> not an AI model, decides the mark.

(129 characters.)

## 2. Description (4,000 limit)

> Pri Learning is a maths practice app for students in India: CBSE / NCERT Classes 7 to 12,
> JEE Main and JEE Advanced.
>
> WRITE THE WAY YOU WOULD ON PAPER
> Answer with Apple Pencil or your finger, one line of working at a time, or type if you prefer.
> You can also photograph working you did on paper, or a question from your textbook to practise
> questions like it.
>
> HOW YOUR ANSWER IS MARKED
> Your handwriting or photo is read by Pri's server. The reading only proposes what you wrote:
> you see it, and you can correct it before it counts. The mark itself is decided by Pri's
> marking engine, a fixed set of mathematical rules, never by an AI model. Marking is automatic
> and can be wrong; if you think a question was marked wrongly, report it from the question and
> we will look at it.
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
> Premium is ₹199 a month or ₹1,499 a year.
>
> WHAT PRI NEEDS
> Checking answers needs a Pri account and an internet connection. Your ink and drafts are kept
> on your device while you are offline and are read when you are back online.
>
> Students under 18 need a parent or guardian to confirm their account before Pri can check
> their answers. The parent gets a link or a code and can withdraw at any time.
>
> PRIVACY
> No ads. No tracking. We do not sell your data. Your account data is stored on Pri's servers, which
> today run on Railway in the Netherlands (Amsterdam); a move to Supabase in Mumbai is planned.
> To read your handwriting or photo, Pri's server
> sends the image to an outside AI reading service (OpenAI); it is never sent with the question,
> the answer or your name, and Pri keeps no copy of the image. If you turn on the optional
> working check, the lines of your working and the text of the question are also sent to the
> same service to find where a mistake is. You can switch server reading off
> in Settings and type your answers instead. You can delete your account in the app at any time.
>
> Pri Learning follows the NCERT syllabus and public examination patterns. It is not endorsed by,
> affiliated with or approved by NCERT, CBSE, the NTA or any examination authority.
>
> SUBSCRIPTION TERMS
> Pri Learning Premium is an auto-renewing subscription, monthly or yearly. Payment is charged to
> your Apple Account at confirmation of purchase. The subscription renews automatically unless it
> is cancelled at least 24 hours before the end of the current period; your account is charged
> for renewal within 24 hours before the end of the period. You can manage and cancel your
> subscription in your Apple Account settings after purchase.
>
> Terms of use: <PRI_PUBLIC_ORIGIN>/terms
> Privacy notice: <PRI_PUBLIC_ORIGIN>/privacy

**Do not publish this description until:** (a) the prices are set in App Store Connect and match;
(b) the Premium feature list is checked against the paywall on the release build; (c) the privacy
notice at `/privacy` has been rewritten to match the paragraph above (it does not yet — see
`docs/legal/counsel/COUNSEL-INFORMATION-PACK.md` §8); (d) if an introductory offer or free trial is
configured, its terms are added to the subscription paragraph.

## 3. Keywords, category, other metadata

| Field | Draft |
|---|---|
| Keywords (100) | `maths,CBSE,NCERT,JEE,JEE Main,JEE Advanced,class 10,class 12,board exam,handwriting,practice` (92 characters). Do not use competitor or brand names of other apps. |
| Primary category | **Education** |
| Secondary category | **Reference** (optional; leave blank if unsure) |
| Kids Category | **No** — see §5 |
| Copyright | `© 2026 {{OWNER_LEGAL_NAME}}` — **OWNER** |
| Content rights | Does the app contain, show or access third-party content? **OWNER / counsel:** the question bank includes official NTA / CBSE / NCERT paper material the owner has approved for use (owner decision 2026-10-02); confirm the rights basis before answering. |
| Support URL | `<PRI_PUBLIC_ORIGIN>/support` — **OWNER** (page does not exist yet; a page with `{{SUPPORT_EMAIL}}` and the grievance link is enough) |
| Marketing URL | `https://prilearning.com` — **OWNER** confirms |
| Privacy policy URL | `<PRI_PUBLIC_ORIGIN>/privacy` |
| User privacy choices URL (optional) | `<PRI_PUBLIC_ORIGIN>/account/delete-request` |
| App Privacy answers | `docs/release/app-store-privacy-labels.md` |

## 4. Age rating questionnaire

Answer from what the release build does. Apple revised the questionnaire in 2025 (new 13+, 16+
and 18+ ratings and new questions on in-app controls, capabilities and age assurance); **confirm
the current question wording in App Store Connect when entering it** — the answers below are for
the substance of each question.

| Question (substance) | Answer | Justification |
|---|---|---|
| Cartoon/fantasy or realistic violence; prolonged graphic violence | None | Maths questions only |
| Sexual content, nudity, profanity or crude humour | None | Authored and generated questions; no user-to-user content |
| Horror/fear themes; mature or suggestive themes | None | — |
| Alcohol, tobacco, drugs; medical or treatment information | None | — |
| Simulated gambling; contests | None | No wagering; badges and streaks are not prizes |
| Guns or weapons | None | — |
| Unrestricted web access | **No** | The client may reach only its own origin (`tools/check-client-network-boundary.mjs`); no browser surface |
| User-generated content shared with other users | **No** | Problem reports go only to Pri staff; no feed, profiles or sharing between students. Teacher classes exist in code but are not a public V1 surface (`PRI_V1_RELEASE_SCOPE.md` §11) |
| Messaging or chat between users | **No** | — |
| AI chatbot / assistant | **No** for the release build if `PRI_FEATURE_TUTOR` is off (`client/vite.config.js` compiles the tutor out). The handwriting reader is not conversational. **If the tutor is enabled, answer Yes.** | `server/platform/tutor.js` |
| Advertising | **No** | No ad SDK |
| Parental controls | The guardian-confirmation flow gates a child's cloud features; it is not a parental-controls feature in Apple's sense. **OWNER / counsel** decide how to describe it | `server/platform/guardianConsent.js` |
| Age assurance | **No** — the app asks for an "18 or older" declaration and the student's class; it does not verify age | `accounts.age_basis` |

**Expected result:** the lowest rating (4+ under the old scale). The rating describes content, not
audience: the intended students are about 12 to 18. Do **not** tick "Made for Kids".

## 5. Decision: not in the Kids Category

Recommended: **Education, not Kids Category.** Reasons, all for the owner and counsel to confirm:

1. On the owner's reading, Apple's Kids Category is for apps designed for children 11 and under (age bands 5 and under,
   6–8, 9–11). Pri's students start at Class 7 (about 12) and run through JEE (17–18 and adult
   repeaters). The app is not designed for under-11s.
2. As we read Guidelines 1.3 and 5.1.4, Kids Category apps may not send personally identifiable information to third parties and face
   strict limits on third-party services (Guidelines 1.3 and 5.1.4). Pri sends handwriting images
   and photos to OpenAI for reading; the category would be incompatible with the core feature.
3. Kids Category requires a parental gate before links out and purchases. Pri's guardian flow is
   account-level consent, not a parental gate.

These are engineering readings of Apple's guidelines **for counsel to confirm**, not settled
interpretations. Not choosing the Kids Category is not believed to remove obligations toward
minors: on the owner's reading Guideline 5.1.4 may still apply to an app that collects data from
children, and India's DPDP Act defines a child as under 18 (counsel to confirm both). Those questions are in `docs/legal/counsel/COUNSEL-INFORMATION-PACK.md`.

## 6. App Review information

| Field | Value |
|---|---|
| Sign-in required | **Yes** — answers are checked only for a signed-in account |
| Demo account | **TO BE CREATED by the owner** on the production deployment, after cutover. Two accounts: (1) an **adult** account (age declaration "18 or older"), email verified, signed in by email + password, holding no real student data; (2) optionally a **child** account whose guardian confirmation has already been completed by the owner's own test mailbox, so the reviewer can see the confirmed state without waiting for an email. Put the credentials only in App Store Connect's sign-in fields, never in this repository |
| Contact | **OWNER**: name, phone, email |

**Review notes (paste after the accounts exist):**

> Pri Learning is a maths practice app for students in India (CBSE / NCERT Classes 7–12, JEE).
>
> Sign in: open the app, tap Sign in, choose email and password, and use the demo account in the
> sign-in fields. Answers are checked by our server, so a connection is required.
>
> To try handwriting: open Practice, pick any chapter, and write the answer with Apple Pencil or a
> finger in the writing area, then tap Check. The handwriting image is sent through our server to
> OpenAI for transcription only; the question, answer and student name are not sent with it. The
> mark is decided by our deterministic marking engine on the server, never by the AI model.
>
> Camera: used only when the student chooses to photograph paper working or a textbook question.
>
> Under-18 accounts: the app asks whether the user is 18 or older; if not, a parent or guardian
> must confirm by email link or SMS code before answers can be checked. The second demo account
> has this confirmation already completed.
>
> Subscriptions: Pri Learning Premium (monthly and annual auto-renewing subscriptions) is sold
> only through StoreKit. Restore is in Settings → Plan.
>
> Account deletion: Settings → Account → Delete cloud account. It is immediate.
>
> No ads, no tracking, no third-party analytics.

**Before submitting, check on the release build:** the menu paths above (Settings → Plan,
Settings → Account), that Sign in with Apple appears, and that restore works in the sandbox.

## 7. Screenshot shot list

Required sizes (confirm current specifications in App Store Connect):

| Device | Required? | Size (portrait) |
|---|---|---|
| iPad 13-inch | **Yes** | 2064 × 2752 or 2048 × 2732 |
| iPhone 6.9-inch | **Yes** | 1320 × 2868 or 1290 × 2796 |
| iPhone 6.5-inch | Only if App Store Connect still asks for it when 6.9-inch is supplied | 1284 × 2778 or 1242 × 2688 |

Rules: real screens from the release build on the production deployment with demo data; no real
student names, emails or photos; no device frames with fake notifications; captions state only
what the screen shows; no claims of accuracy, ranking or "best". The owner's private photo fixture
must never appear.

| # | Screen | Caption (draft) | Notes |
|---|---|---|---|
| 1 | A question with handwritten working in progress (Pencil) | Write your working by hand | Class 10 arithmetic progression or similar |
| 2 | The reading shown back to the student, with the correct-it control | See what Pri read, and fix it | Show an honest, slightly imperfect read corrected by the student |
| 3 | A finished question with the mark and the worked solution | Your mark, then the worked solution | Mark decided by the engine; no "AI marked" wording. Do not caption per-step method marks: the method rubric is off in production until the examiner review (#499) |
| 4 | Chapter picker by class (CBSE / NCERT) | Classes 7 to 12, chapter by chapter | Do not imply every chapter is complete |
| 5 | JEE Main / JEE Advanced track choice | JEE Main and JEE Advanced practice | Mark JEE Advanced as Premium if the screen does |
| 6 | Exam simulation in progress (timer visible) | Timed exam simulations | — |
| 7 | Progress by chapter | Follow your progress | — |
| 8 | Photo of paper working being read | Photograph working done on paper | Staged page with no name on it |
| 9 | Plan screen (free vs Premium, prices) | Free plan, or Premium | Only after prices are set |
| 10 | Settings → Handwriting privacy text | You choose whether the server reads your writing | Optional; supports the privacy answers |

iPhone set (portrait only — the iPhone build does not rotate): shots 1 (handwriting with a finger, not Pencil), 2, 3, 4, 6, 7 and 8. Caption 1 on iPhone: "Write your working with your finger". Capture on a physical iPhone from the release build; no simulator status bars.

App preview video: optional; if made, a 15–30 s screen recording of shots 1–3 with no voice-over
claims.

## 8. Things in this listing that are deliberately absent

- No "best", "No. 1", "most accurate", "AI-powered marking", "complete syllabus", "41 years of
  papers", "guaranteed marks/rank" or comparison with any other app.
- No teacher or parent-portal features (out of V1).
- No Hindi listing yet (English is sufficient for V1; `PRI_V1_RELEASE_SCOPE.md` §3).
- No Australian curricula (out of V1).

## 9. Where each statement comes from

| Statement | Code |
|---|---|
| CBSE / NCERT 7–12, JEE Main, JEE Advanced | `PRI_V1_RELEASE_SCOPE.md` §6; generators under `client/src/engine/generators/` |
| Server reads handwriting/photos; answer-blind; image not kept | `server/platform/handwriting.js`, `practice.js`, `handwritingProvider.js`; `data-retention.md` §4 |
| Reading proposes, student can correct | `practice.js` `/:id/recognition/:receipt/confirm` |
| Marks decided by the deterministic engine | `server/platform/markerOps.js`, `markerPool.js`; ADR-0001 |
| Free: unlimited practice, 5 marked answers/day, no mock papers | `client/src/engine/practiceAllowance.js`, `client/src/engine/examAllowance.js`, `server/platform/practiceAllowance.js` |
| Premium lifts the daily practice cap | `client/src/local/entitlementGate.js` (`UNLIMITED_PRACTICE`, device-local counter at `POST /practice/next` and `/history/:id/retry`) |
| Premium lifts the exam-simulation limit | `server/platform/exams.js` `entitlementRefusal` (`premium-exams`); `client/src/local/indiaExamBackend.js` |
| JEE Advanced is Premium | `client/src/local/backend.js` (`requireCapability(…, JEE_ADVANCED)`), `indiaExamBackend.js`, `exams.js` |
| Not claimed | `advanced-pri-explain` and `advanced-analytics` are declared in `entitlements.js` but not enforced as gates today, so the listing does not advertise them. Add them to the copy only when a gate exists |
| Needs account + connection; ink kept offline | `client/src/i18n/strings.en.js` `settings.localPlanSub`, `verdict.statusSavedWaitingSignIn`; `authoritative-architecture.md` |
| Under-18 guardian confirmation by link or code | `guardianConsent.js`, `otp.js` |
| Server reading can be switched off | `client/src/ink/cloudReader.js`; `settings.cloudHandwritingCopy` |
| In-app deletion | `CloudAccountSecurity.jsx` → `DELETE /v1/account` |
| No ads / tracking | `PrivacyInfo.xcprivacy`; `tools/check-client-network-boundary.mjs` |
