# Counsel information pack — Pri Learning

**Prepared:** 2026-11-02 by the engineering team (an AI coding agent working for the owner) from
the code on `main` at `a5778a319`, replacing the 2026-10-18 pack. **This is not legal advice and
contains no legal conclusions.** It describes what the software does, lists the laws and store
policies the owner believes may be relevant, and asks questions. Where it mentions a legal
provision, it does so to frame a question for counsel, not to state how the provision applies.
Every factual statement cites the code or document it comes from so counsel can ask for it to be
checked.

**Re-checked on 2026-11-08** against `main` at `1d3829103`: nothing that leaves the device changed.
The terms' content sentence was corrected (§8.2 row 6). The short sheet to send first is
`QUESTIONS-FOR-COUNSEL.md` beside this file: the operator, the DPDP notices, consent, D17, D18, D22
and D23, each with the exact current text and where it lives in the code, held to the tree by
`tools/counsel-pack-check.mjs`.

(This file sits in `docs/legal/counsel/` rather than `docs/legal/` because `tools/legal-status.mjs`
treats every Markdown file directly in `docs/legal/` as a public notice that must have a Hindi
twin.)

The owner needs counsel to: (1) say which laws and policies apply and what they require; (2)
review, correct or approve the privacy notice, terms, refund policy, grievance page and the in-app
guardian notice, in English, and have the Hindi checked against them; (3) answer the questions in
§11, operator first. Engineering will then change the product to match.

**How a review is recorded.** The app shows "Not yet reviewed by a lawyer" above every notice.
That banner is driven by one file, `docs/legal/review-status.json`, which a person sets to
`reviewed: true` with the reviewer's name, qualification, date, languages and where the written
sign-off is kept. The build refuses the flag without those fields, refuses it if a notice was
edited after the review date, and refuses it until the sentence "no advocate has checked" is
removed from the Hindi notices and "has not yet been reviewed by a lawyer" from the English. So
counsel's sign-off letter is the thing the flag points at; nothing in the code can clear the
banner on its own.

---

## 1. The product in one page

| | |
|---|---|
| Name | Pri Learning (App Store bundle `com.prilearning.app`; Android package `com.prilearning.app`) |
| What it is | A maths practice app. Students answer questions by handwriting (Apple Pencil, stylus or finger), by photographing paper working, or by typing. The server reads the handwriting, marks the answer and records progress |
| Who it is for | Students in India: CBSE / NCERT Classes 7–12 (about ages 12–18) and JEE Main / JEE Advanced aspirants (about 16–18, plus adult repeaters). **Most users are expected to be minors.** |
| Launch scope (owner defaults of 2026-11-01, `V1_DECISIONS_2026-11-01.md`) | India only on both stores (D2). One product on web, iPhone, iPad and Android; the public launch is iPhone and iPad first because Google Play requires a 14-day closed test (D1). Sign-in by email code and password only; Apple and Google sign-in arrive together in an update; **SMS stays off** (D3). The AI tutor stays off (D4). Public origin `app.prilearning.com` / `prilearning.com` (D5, to be confirmed before the first signed build) |
| Price | Free: 20 practice questions a day and one timed paper in 30 days. Premium ₹199 a month or ₹1,499 a year: unlimited questions and papers plus JEE Advanced (D19). Handwriting and photo reads: Free 5 a day, Premium 25 a day, per kind, as modelled defaults (D20). Sold only through Apple's App Store and Google Play; web purchasing (Razorpay) exists in code but is out of the first release and refused to native clients |
| Operator | **To be decided by the owner (Q1).** The notices currently name the owner as an individual, Priysharan Tripathi, at a home address in New South Wales, Australia, as data fiduciary, contracting party, seller and grievance officer. The market is India |
| Ads / tracking | None. No advertising or analytics SDK; the app can talk only to its own server (`tools/check-client-network-boundary.mjs`; `NSPrivacyTracking = false`) |

### How marking works (relevant to "AI" questions)

- The server issues each question and keeps the expected answer to itself
  (`server/platform/practice.js`).
- A handwriting image or photo is sent to OpenAI's API for **transcription only**. The request
  never contains the question, the expected answer, the marks or the student's name
  (`FORBIDDEN_FIELDS` in `server/platform/handwriting.js`, `questionPhoto.js`).
- The transcription is shown to the student, who can correct it.
- A **deterministic marking engine** (fixed mathematical rules, no AI model) running on Pri's
  server decides the mark (`server/platform/markerOps.js`, `markerPool.js`;
  `docs/architecture/adr-0001-online-first-runtime.md`). An AI output never sets a mark.
- An optional "check my working" feature (off unless the student turns it on) sends the working
  lines **and the question text** to OpenAI to locate a mistake; it still does not set the mark
  (`server/platform/working.js`).
- On-device handwriting readers (including the "teach Pri your handwriting" calibration that
  built a personal model on the device) are retired from the shipped path (D16). The notice no
  longer describes a model that adapts to the student.
- An AI tutor exists in code but is compiled out of production builds
  (`client/vite.config.js` `PRI_FEATURE_TUTOR`; D4 keeps it off).
- Method marks (partial credit for working) are off in production through a server switch until
  an independent examiner signs them off (D12; GitHub issue #499; `docs/release/EXAMINER-REQUEST.md`).
  Marks are for the final answer only until then.

---

## 2. Infrastructure and where data is processed

| Component | Provider | Location | Notes |
|---|---|---|---|
| Application server | Railway | Observed in region `ams` (Amsterdam) on 2026-10-04; **owner to confirm the region before launch** (a move nearer Mumbai is the audit's default) | Railway is a US company. The service region is a deployment setting |
| Database (today, production) | SQLite file on a Railway volume | Amsterdam, with the server | Until the Postgres cutover, production account data is stored outside India. The notice says so |
| Database (target) | Supabase Postgres | Mumbai, India (`ap-south-1`) | Cutover prepared; **does not happen without the owner's own yes on the day** (D27) because the data step is irreversible (`docs/release/production-cutover-checklist.md`) |
| Handwriting / photo reading, working check, tutor | OpenAI API (`api.openai.com`) | Outside India; region and contracting entity to be confirmed | Requests set `store: false`, which governs application state, not abuse monitoring. OpenAI's page "Data controls in the OpenAI platform" (https://developers.openai.com/api/docs/guides/your-data, retrieved 2026-11-02) states that abuse-monitoring logs are kept for up to 30 days by default, longer where the law requires or to protect its services or others from harm, and that zero data retention is an approval-based control; it also states API data is not used to train models unless the customer opts in. Pri has **no zero-data-retention arrangement** on record (`docs/privacy/data-retention.md` §4). OpenAI's under-18 guidance is a reason the owner is asking for one (Q15). Provider pages change: counsel should read the current text and the contract, not this summary |
| Email (sign-in links and codes, guardian emails, new-device notices) | Resend | US provider; sending domain `mail.prilearning.com` | Sees address and message. Named in the notice |
| SMS (codes) | None at launch (D3) | — | `server/platform/smsProvider.js` supports MSG91 or Twilio Verify, but `PRI_SMS_PROVIDER` is unset on both environments, `GET /v1/account/otp/channels` reports `sms: false`, and the shipped client shows the SMS option only when the server reports it live. The notice, the Apple label, the privacy manifest and the Play form therefore declare no phone number |
| Payments | Apple App Store (StoreKit) and Google Play Billing | Provider | Pri never sees card details (`server/platform/appleBilling.js`, `googleBilling.js`). Neither store is configured on production yet (the audit found billing `not_configured` on both environments) |
| Web payments (code present, **outside V1**) | Razorpay | India | Not configured; native clients are refused web checkout (`BILLING_WEB_CHECKOUT_NATIVE_REFUSED`) |
| Sign-in with Apple / Google | Apple, Google | Provider | Code present; **not offered in the first submission** (D3) |
| Error sink | Sentry, only if `PRI_SENTRY_DSN` is set | Owner's project | Unset at launch. If set, coded crash reports (no message, stack, URL or account id) are forwarded and the notice must name it |

---

## 3. Data collected

Fuller tables with code references: `docs/release/app-store-privacy-labels.md` §2,
`docs/release/play-data-safety.md` §2, `docs/privacy/data-retention.md`.

| Data | From whom | Why | Kept | Sent to |
|---|---|---|---|---|
| Email address | Student | Sign-in, verification, codes, new-device notices | Until account deletion | Resend |
| Name (as typed) | Student | Account | Until deletion | — |
| "Are you 18 or older?" answer; class and track | Student | Decides whether guardian confirmation is needed; which maths to set | Until deletion | — |
| Guardian's name and email; consent method, notice version, times | Student (about the guardian), guardian | Guardian confirmation for an under-18 account | Until deletion | Resend |
| Handwriting image (rasterised from strokes) and photos of paper or of a textbook question | Student | Reading the answer | **Image not kept** by Pri (memory for the request only) | **OpenAI** |
| Transcription of that image, and any correction the student types | Generated / student | Grading receipt | **90 days** (`practice.js` `MAX_AGE`) | — |
| Typed answers, working lines, exam answers | Student | Grading | Practice grade records 90 days; exam papers/answers/results up to 5 years (`exams.js` `RECORD_TTL`); all deleted with the account | Working lines + question text to **OpenAI** only if "check my working" is on |
| Graded-attempt records (question, right/wrong, marks, chapter, difficulty, mode) | Generated | Progress, choosing the next question | Until deletion | — |
| Synced profile, settings, bookmarks, tasks, custom questions | Student | Cross-device sync | Until deletion | — |
| Problem reports about a question | Student | Content quality | Free text removed on deletion; the rest kept unlinked | — |
| Telemetry (allow-listed events: errors, failures, feature used, exam completed, trial started, subscription state, performance) | Generated | Operations | 90 days; **blocked for a child until guardian confirmation** | — |
| Coded crash reports (screen, error code, fingerprint, build) | Generated, per-device switch on by default | App stability | 90 days (a `client-error` telemetry row) | Sentry only if configured (not at launch) |
| Random per-install device id; hash of user-agent; sign-in times | Generated | Sessions; new-device notices | Until deletion | — |
| Subscription state and payment ledger (amount, currency, provider reference) | Apple / Google | Entitlement; accounting | Subscription link until deletion; ledger kept **unlinked** after deletion (proposed 8 years; no purge yet) | — |
| Audit log (action, opaque ids) | Generated | Security | Proposed 2 years; append-only; no purge yet | — |

**Stays on the device:** handwriting strokes; local profiles (optionally password-encrypted);
drafts and ink waiting to be read (`client/src/local/idb.js`).

**Not collected:** phone number (SMS off), location, contacts, microphone, health data,
advertising identifiers, browsing history.

**Backups:** Supabase point-in-time backups and SQLite backups contain deleted data until they age
out; the backup retention period is a deployment setting not yet recorded for production
(`data-retention.md` §2).

---

## 4. Minors and the guardian-confirmation flow (as built)

Source: `server/platform/guardianConsent.js`, `server/platform/otp.js`,
`client/src/components/SignUpFlow.jsx`, `docs/release/otp-sign-in.md`.

1. The app does **not** ask for date of birth. At sign-up it asks the student's class and whether
   they are 18 or older. Unless the student says they are, the account is treated as a child's.
2. The student enters a parent or guardian's name and email address.
3. The guardian receives an email link (`guardian-email-confirmation`, valid 1 hour) or a
   six-digit code by email (`guardian-email-otp`) which they enter on their own page after reading
   a short notice. The method is recorded in every consent row. (A phone-code method exists in
   code and is off with SMS.)
4. Until the guardian confirms, the child's account can sign in, view and export its data, and be
   deleted — **nothing else**. It cannot practise with marking, sit exams, sync, send telemetry or
   crash reports, use handwriting reading or subscribe. Every such route returns
   `GUARDIAN_CONSENT_PENDING` (`requireGuardianConsent` in `server/platform/router.js` covers
   `/practice`, `/exams`, `/handwriting`, `/working`, `/question-photo`, `/sync`, `/billing`,
   `/telemetry`, `/tutor`, `/reports`, `/classes`, `/assignments`).
   - Because grading is online-only, **a child cannot have any answer marked before the
     guardian confirms.**
5. The guardian can withdraw at any time from a long-lived withdrawal link in the confirmation
   email. Withdrawal stops all of the above at once; the same ceremony cannot be re-used to
   consent again.
6. What the confirmation proves, as the code itself records: that someone with access to that
   inbox took the action. It does **not** establish that the person is an adult, or is the child's
   parent or lawful guardian. The code and the privacy notice both say it must not be called
   "verifiable parental consent".
7. The notice the guardian sees is versioned (`CONSENT_NOTICE_VERSION = '2026-10-22'`). The server
   accepts confirmations given under `2026-10-19` and `2026-10-22`; an older confirmation reads as
   pending and the learner asks again. Its text is in `client/src/i18n/strings.en.js` keys
   `signup.notice*` (Hindi in `strings.hi.js`). On 2026-11-02 the withdrawal sentence was changed
   from "Sync stops at once" to say that withdrawal stops marking, reading, exams and sync; the
   version was not bumped because the change describes existing behaviour and adds no processing
   (Q12 asks counsel whether that was right).
8. Handwriting reading is **on by default** for a signed-in account, but stays off for a child
   until the guardian confirms (`client/src/ink/cloudReader.js` rule 1). After confirmation it is
   on unless switched off in Settings. **Owner default D17**, built in #737: a one-time prompt
   naming OpenAI before the first handwriting read, photo of working or question photo; nothing is
   sent until it is accepted, and declining keeps the student on typed answers. The acceptance is
   kept on the device only. The notice describes it in the same train (`QUESTIONS-FOR-COUNSEL.md`
   §4 quotes the prompt; Q14 asks counsel for the wording).
9. **Owner default D18:** an under-18 account that no guardian has confirmed 30 days after it was
   created, or 30 days after a withdrawal, is closed then and erased 7 days later, and a guardian
   can request erasure without the child's login. It is being built (#736), with the automatic
   rule behind `PRI_CHILD_ERASURE=enforce`; the notice promises it (Q10 asks counsel to set the
   period; `QUESTIONS-FOR-COUNSEL.md` §5 has the switch and the seven-day window).

Children's data is not used for advertising, not shared for advertising and not sold. The server
does use each account's own attempt history to choose the next question (adaptive practice).

---

## 5. India — Digital Personal Data Protection Act 2023 and Rules

The owner's understanding, for counsel to confirm or correct: the Act was enacted in 2023; the
DPDP Rules 2025 were notified in November 2025 with phased commencement; the provisions on
children's data, including verifiable parental consent, commence eighteen months after
notification. The owner's sources disagree on the day: the code's comments say **14 May 2027**,
most commentary the owner found says **13 May 2027**, and a January 2026 proposal to shorten the
eighteen months had no Gazette notification in the sources found. The notice therefore says
"expected to take effect in May 2027, eighteen months after the DPDP Rules were notified in
November 2025" and no more. Counsel is asked for the exact date and what applies before it
(including whether the IT Act 2000 section 43A and the SPDI Rules 2011 still apply in the
interim).

Areas the owner believes are relevant (questions in §11):

| Area | What the product does today | Open point |
|---|---|---|
| Child = under 18 | Every Class 7–12 student is treated as a child unless they declare 18+ | Whether a self-declaration of 18+ is enough, and what "reasonable" age-gating looks like |
| Verifiable parental consent | Email link / code to an address the child supplies; not verified (§4.6) | What method satisfies the Rules (the owner's reading is that the Rules mention identity details already reliably held, or a token from a government-authorised entity such as DigiLocker); whether an interim method is acceptable before commencement; whether the app may be offered to children at scale before one exists |
| No tracking, behavioural monitoring or targeted advertising directed at children | No ads, no third-party tracking. The server tracks each student's attempts to choose questions and show progress | Whether per-account adaptive practice and progress tracking is "behavioural monitoring" of a child, and whether any exemption (e.g. for educational purposes) can apply to an ed-tech provider that is not an educational institution |
| No processing likely to cause a detrimental effect on a child's well-being | Streaks, badges, exam simulations | Whether any engagement feature raises this |
| Notice | `docs/legal/privacy.md` (English) and `privacy.hi.md` (Hindi), plus the in-app guardian notice | Content requirements; itemised notice; languages; whether the "not yet reviewed" banner wording is adequate while it shows |
| Consent and withdrawal | Guardian consent; withdrawal as easy as giving it | Whether **adult** students need a separate consent for OpenAI processing, or whether "legitimate uses" or contract performance applies; whether default-on reading is valid consent; whether the D17 prompt is the right form |
| Data principal rights (access, correction, erasure, grievance, nomination) | In-app export (`GET /v1/account/export`) and immediate deletion; correction by request; nomination by request | Response timelines; who exercises a child's rights; whether export must include sealed exam papers (currently not exported — `V1_COMPLETION_LEDGER.md` surface 10) |
| Grievance officer / contact | Published: the owner, as an individual, at an Australian home address, with a personal iCloud mailbox (`docs/legal/grievance.md`) | Whether a named officer, a Data Protection Officer or an India-resident contact is required; whether a home address may be replaced by a registered or care-of address |
| Grievance timing | The page promises acknowledgement within 48 hours and an answer within 30 days, deferring to any shorter statutory period; the earlier page said 3 working days and claimed 30 days was "the period the DPDP Act allows" | The owner's sources give "not more than 90 days" under the DPDP Rules' grievance provision and 48 hours / one month under the Consumer Protection (E-Commerce) Rules 2020, if they apply; counsel to confirm which periods bind and whether the promised ones are right |
| Retention and erasure | Account data until deletion; grade records 90 days; exam records up to 5 years; telemetry and crash reports 90 days; payment ledger unlinked, proposed 8 years; audit log proposed 2 years; unconfirmed or withdrawn child accounts closed 30 days after creation or withdrawal and erased 7 days later (D18, built in #736, automatic rule behind `PRI_CHILD_ERASURE=enforce`); no automatic deletion of inactive adult accounts | Whether erasure is required when the purpose is served (e.g. inactivity), and the periods |
| Cross-border transfer | OpenAI and Resend outside India; production database currently in Amsterdam until cutover; the operator may be Australian | Whether any transfer restriction or notified-country rule applies; whether production must move to Mumbai before launch; which contracting entities and regions each provider confirms (this question used to sit as an inline "COUNSEL REVIEW" note in the notice and was moved here on 2026-11-02) |
| Processors | Railway, Supabase, OpenAI, Resend, Apple, Google; Sentry only if configured; Razorpay only if web purchasing is later enabled | Whether processor contracts (DPAs) are required and with what terms; the notice now names them — counsel to confirm that is right |
| Security safeguards and breach notice | Hashing of passwords/tokens/codes, HTTPS, RLS, server authorisation (`docs/security/threat-model.md`, `acceptance.md`); no external penetration test yet (`accepted-risks.md` R-12) | What is "reasonable security"; breach-notification timelines to the Board and to users |
| Significant Data Fiduciary | Not assessed | Whether the volume of children's data could lead to designation |

Other Indian rules the owner believes may be relevant, for counsel to confirm or dismiss: Consumer
Protection Act 2019 and Consumer Protection (E-Commerce) Rules 2020 (grievance officer, price
display, refund terms — the refund policy now describes App Store and Google Play purchases only);
Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules 2021 (probably
not applicable without user-to-user content); any guidance on ed-tech and minors; GST and
record-keeping for the payment ledger (a separate tax question, outside this pack).

---

## 6. Australia — Privacy Act 1988

Australia is **not** a launch market for the first release (`PRI_V1_RELEASE_SCOPE.md` §5). The
owner raises it because the owner lives in Australia and the operating entity may be Australian.

Points for counsel:

- Whether the Privacy Act and the Australian Privacy Principles apply to an Australian operator
  whose users are in India, and whether the small business exemption is relevant.
- APP 8 (cross-border disclosure) if the operator is Australian and data goes to India (Supabase),
  the US (OpenAI, Resend) and the Netherlands (current Railway volume).
- The Children's Online Privacy Code the OAIC is developing under the Privacy and Other
  Legislation Amendment Act 2024 — whether it could apply if Australian students are later
  served.
- Whether the Online Safety Act 2021 or the social media minimum age rules have any bearing (the
  app has no user-to-user features).

---

## 7. App Store and Google Play policies on minors and AI

| Policy | Relevance | Current position (for review) |
|---|---|---|
| Apple Guideline 1.3 / Kids Category | Category for apps designed for ages 11 and under | Recommended **not** to enter the Kids Category (`docs/release/store/app-store-listing.md` §5) |
| Apple Guideline 5.1.4 (Kids) | Applies to apps that collect data from children, in or out of the Kids Category | Counsel to review the guardian flow against it |
| Apple Guideline 5.1.2(i) — sharing personal data with third-party AI | Apple asks apps to disclose and obtain explicit permission before sharing personal data with third-party AI | Owner default D17, built in #737: a one-time prompt naming OpenAI before the first read or photo; nothing sent until accepted. Counsel to confirm the wording and whether it is the "explicit permission" Apple asks for (`QUESTIONS-FOR-COUNSEL.md` §4) |
| Apple Guideline 5.1.1(v) — account deletion | In-app deletion required | Implemented, immediate; also a public no-login page |
| Apple Guideline 3.1.2 — subscriptions | Disclosure of terms | Terms and refund policy now describe App Store and Google Play purchases, auto-renewal, cancellation in the store, and that account deletion does not cancel a subscription |
| Google Play Families policy | Applies if any target age group is under 13 | Class 7 students are about 12; see `docs/release/store/play-listing.md` §5 |
| Google Play User Data policy / prominent disclosure | Disclosure of data not reasonably expected | Images to OpenAI are disclosed in-app before first use by the D17 prompt (#737) |
| Google Play AI-generated content policy | If the tutor is enabled | Off in production builds (D4) |
| App Privacy label, Play Data safety, iOS privacy manifest | Must agree with each other and the code | Reconciled on 2026-11-02 (`docs/release/app-store-privacy-labels.md` §6, `play-data-safety.md` §6b): crash reports declared in all three; no phone number while SMS is off |

---

## 8. Current legal documents and what still needs counsel

The four public documents and their Hindi twins were filled on 2026-10-19 (owner's name and
address, grievance officer, support mailbox, New Delhi courts) and corrected against the code on
2026-11-02. **None has been reviewed by a lawyer**, and each says so in its own text and in the
banner above it. `client/test/legal-pages-check.mjs` holds the two languages to the same sections
and links and pins most of the factual sentences below to the code they describe, so corrections
must be made to both languages in the same change.

### 8.1 `docs/legal/privacy.md` (and `privacy.hi.md`) — what it now says

| # | Statement | Basis in code | For counsel |
|---|---|---|---|
| 1 | An account and a connection are needed for any answer to be marked; marking is by a deterministic engine on the server; the on-device copy never sets a mark | `practice.js`, `markerOps.js`, ADR-0001 | — |
| 2 | Handwriting and photos are read online by OpenAI; the setting is on by default for a signed-in account, switchable off, off for a child until a guardian confirms, never without an account; **nothing is sent until the student agrees to a one-time prompt naming OpenAI** (D17); the request carries no question, answer or name; the whole photo frame is sent | `cloudReader.js`, `readerPermission.js` (#737), `handwriting.js` `FORBIDDEN_FIELDS`, `cloudRaster.js`, `PractisePhoto.jsx` | Q13–Q14 (lawful basis, D17 prompt wording) |
| 3 | Pri keeps no copy of the image; the transcription and any correction live 90 days; OpenAI may hold a copy for a limited time for abuse monitoring; a sent picture cannot be recalled | `handwritingProvider.js` `store: false`, `practice.js` `MAX_AGE`, `data-retention.md` §4 | Q15 (zero data retention) |
| 4 | Data is stored on Railway in Amsterdam today; a move to Supabase Mumbai is planned; OpenAI processes outside India; Resend and the stores in their own regions | `production-cutover-checklist.md`, ADR-0001 | Q19–Q21 (cross-border, processors) |
| 5 | No sign-in by SMS is offered; the notice will describe it first if it is added | `otp.js` `channels`, `SignUpFlow.jsx`; D3 | — |
| 6 | For an under-18 account: a guardian's name and email; confirmation by link or email code; what the confirmation does and does not prove; it is not verifiable parental consent; withdrawal stops marking, reading, exams and sync | `guardianConsent.js`, `otp.js` | Q5–Q12 |
| 7 | An unconfirmed or withdrawn child account is closed 30 days after creation or withdrawal and erased 7 days later, and a guardian can ask for erasure without the child's login (wording of 2026-11-09, matching #736) | **Owner default D18, built in #736 (not merged); not in the code at `1d3829103`.** `scripts/release-nominate.mjs` refuses a production nomination while the notice promises this and the code lacks it, and prints `PRI_CHILD_ERASURE=enforce` as a production setting it depends on (`tools/legal-promises.mjs`) | Q10 (period); `QUESTIONS-FOR-COUNSEL.md` §5 |
| 8 | The DPDP child-data obligations are expected in May 2027, eighteen months after the Rules were notified in November 2025 | Owner's reading; see §5 | Q6 (exact date) |
| 9 | Crash reports (screen, code, fingerprint, build; never the message, URL or anything typed), per-device switch | `telemetry.js` `cleanErrorReport`, `reportCrash` | — |
| 10 | Retention: answer text, working and transcription 90 days, while the question id, result, marks and chapter stay in the learning history until deletion; exam records up to five years; telemetry 90 days; immediate deletion; the payment ledger, de-texted problem reports and one audit row survive unlinked; backups age out; deleting the account does not cancel a store subscription | `data-retention.md` §2 | Q23–Q24 (periods; "which tax and accounting law requires us to keep") |
| 11 | Processors named: Resend, Apple and Google, Railway, Supabase (planned), OpenAI | §2 above | Q21 |
| 12 | The notice "is meant to give you what the DPDP Act asks a notice to give you" and "has not yet been reviewed by a lawyer" (it no longer claims to "follow" the Act) | `review-status.json` | Q27 (banner and status wording) |

### 8.2 `docs/legal/terms.md` (and `terms.hi.md`)

| # | Statement | For counsel |
|---|---|---|
| 1 | Agreement with the owner as an individual; use on web, iPhone, iPad and Android; governed by the laws of India, courts of New Delhi | Q1–Q4 |
| 2 | "If you are under 18, a parent or guardian must agree to these terms for you." The guardian flow records consent to data processing, not acceptance of the terms | Q11 |
| 3 | Handwriting and photos are read by an outside service (OpenAI); the mark is never decided by it | — |
| 4 | Does not predict a percentile, rank or admission; describes the estimate the progress screen shows | — |
| 5 | Subscriptions sold only through the App Store and Google Play; renew automatically; price and period shown by the store; Apple or Google handles billing, renewals and refunds; cancel in the store; account deletion does not cancel; a parent or guardian must make or approve a minor's purchase | Q28–Q30 (E-Commerce Rules; minors' purchases; whether Apple's standard EULA or custom terms apply) |
| 6 | "Pri Learning is maths practice for CBSE / NCERT Classes 7 to 12, JEE Main and JEE Advanced", not endorsed by NCERT, CBSE or the NTA (until 2026-11-08 it said the app "follows the NCERT syllabus", which the D24 wording rule forbids). The terms say nothing about past papers; D23 keeps them off for students until a rights opinion exists, through a switch not yet on `main` (`QUESTIONS-FOR-COUNSEL.md` §7) | Q31 |

### 8.3 `docs/legal/refund-policy.md` (and `refund-policy.hi.md`)

Covers App Store (Apple refunds, requested from Apple; Pri cannot issue them) and Google Play
(Google within 48 hours; Pri through the Play Console after that) on iPhone, iPad and Android;
Pri's own cases (7 days after a first purchase with nominal use; an unintended renewal within 7
days; a service fault); acknowledgement within 48 hours and a reply within 3 working days;
"nothing here takes away a right you have under Indian consumer law". It no longer describes
website purchases or an in-app cancel control. **For counsel:** Q28–Q29.

### 8.4 `docs/legal/grievance.md` (and `grievance.hi.md`)

Names the owner as grievance officer at the Australian home address and personal mailbox;
acknowledgement within 48 hours, answer within 30 days deferring to any shorter statutory period;
escalation to the Data Protection Board of India. **For counsel:** Q22, Q25–Q26.

### 8.5 In-app guardian notice (`signup.notice*`, version `2026-10-22`)

Says what Pri stores (name, class, contact, answers, progress; servers in the Netherlands today,
Mumbai planned), that the server marks answers and sends handwriting or photo pictures to OpenAI,
what is held before confirmation, and (since 2026-11-02) that withdrawal stops marking, reading,
exams and sync. **For counsel:** Q12 (whether the 2026-11-02 wording change needed a version bump
and re-confirmation), Q14 (whether it must also carry the OpenAI consent).

### 8.6 Known gaps between the notices and the code at `a5778a319`

- The 30-day erasure of unconfirmed child accounts (8.1 row 7) is promised and not yet built.
- The D17 permission prompt is built in #737 and the notice describes it in the same train; its
  acceptance is recorded on the device only, and "check my working" and exam handwriting are
  outside it (`QUESTIONS-FOR-COUNSEL.md` §4).
- The notice names the owner's home address; the operator decision (Q1) may change every name
  and address in all eight documents.

---

## 9. What the owner is asking counsel to produce

1. Advice on which laws and policies apply to the launch model in §1 (India only; minors; OpenAI
   processing; operator possibly in Australia).
2. A reviewed privacy notice, terms of use, refund policy and grievance page for India (English;
   Hindi translation checked against it), and a reviewed in-app guardian notice — or written
   corrections engineering applies and counsel then signs off.
3. A view on the guardian-confirmation method: acceptable now, acceptable until commencement, or
   to be replaced before launch; and with what.
4. Wording for the one-time OpenAI permission prompt (D17) and for the 30-day erasure (D18).
5. A list of processor agreements needed and their key terms.
6. Retention periods and grievance timings to put into code and text.
7. Wording for the store disclosures (App Store privacy label, Play Data safety).
8. Confirmation of anything in this pack that is wrong.
9. A written sign-off engineering can point `docs/legal/review-status.json` at.

Engineering will not mark any legal item complete without that written sign-off referenced in the
launch record.

---

## 10. Facts counsel may want verified

Engineering can demonstrate any of these on a staging deployment with test accounts:

- the request sent to OpenAI for a handwriting read (headers redacted), showing no question, answer
  or name;
- the consent gate refusing every route listed in §4 for an unconfirmed child account;
- deletion removing every row listed in `data-retention.md` §2, with the database scan in
  `server/test/account-lifecycle-journey-check.mjs`;
- the account export contents;
- that the SMS option is absent from the sign-up screen while the server reports `sms: false`;
- the review banner appearing on every notice while `review-status.json` is false.

---

## 11. Questions for counsel

**A. The operator, first — every other answer depends on it**

1. Which entity should be the data fiduciary, contracting party and seller: the owner as an
   individual, an Australian company, or an Indian company? Does it need an Indian presence
   (company, representative or grievance officer resident in India), and does the DPDP Act reach
   a foreign operator serving children in India?
2. May the operator's address in the notices be a registered or care-of address rather than the
   owner's home address, and what must the App Store seller name and Play developer name match?
3. If the operator is Australian, which obligations under the Australian Privacy Act follow it to
   Indian users (§6)?
4. Which courts should the terms name (currently New Delhi), and is the governing-law clause
   adequate?

**B. Children and consent**

5. Is the current guardian confirmation (§4) acceptable before the DPDP Rules' child-consent
   provisions commence? Is it acceptable after? May the app be offered to children at scale
   before a verifiable method exists?
6. What is the exact commencement date of the child-consent provisions (13 or 14 May 2027, or
   another date if the period has been shortened), and what applies in the interim?
7. What verifiable-consent method do you recommend for an app whose users are mostly 12–17 and
   whose guardians are reached by email? Is DigiLocker-based verification practical for us, and
   are there alternatives?
8. Is the student's self-declaration "I am 18 or older" sufficient age-gating, or must we do more?
9. Does per-account adaptive question selection and progress tracking count as "tracking or
   behavioural monitoring" of children? If so, does any exemption apply to us, or must we change
   the feature for under-18s? Do streaks, badges or exam simulations raise a "detrimental effect
   on well-being" concern?
10. Is 30 days the right period after which an unconfirmed or withdrawn child account is erased
    (D18), and may a guardian request erasure without the child's login on the strength of the
    withdrawal link or an email to the grievance officer?
11. Must the guardian also accept the terms of use (and the subscription terms) on the child's
    behalf, and must the flow capture that separately from consent to processing? Can a minor's
    subscription purchase through Apple or Google be relied on?
12. The in-app guardian notice's withdrawal sentence was corrected on 2026-11-02 without a version
    bump, on the view that it describes existing behaviour and adds no processing. Was that
    right? More generally, when a notice changes, which guardians must confirm again?

**C. AI processing**

13. What is the lawful basis for sending an **adult** student's handwriting images to OpenAI? Is
    default-on with disclosure enough, or is opt-in consent needed?
14. For a child, does the guardian's confirmation cover OpenAI processing, and must the guardian
    notice name OpenAI and its location (it does)? What should the one-time permission prompt
    (D17) say, and is it the "explicit permission" Apple Guideline 5.1.2(i) asks for?
15. Is OpenAI's retention for abuse monitoring (with `store: false`, no zero-data-retention
    agreement) acceptable for children's data, or should we obtain zero data retention or choose a
    different provider or region? OpenAI's page "Under-18 guidance"
    (https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance, retrieved 2026-11-02)
    says not to use its services to process personal data of children under 13, or under the
    applicable age of digital consent, without first implementing zero data retention in its API.
    What that age is for an Indian student, and whether it is 18, is for counsel; the owner has not
    concluded either way.
16. A photographed page may contain other people's data or the student's name. Is the current
    warning ("keep out of shot whatever you would not want sent") sufficient?
17. Does the "check my working" feature, which sends the question text as well as the working,
    need a separate basis or disclosure from the handwriting read?
18. If the AI tutor is later enabled (D4 keeps it off), what changes in the notice and the stores'
    age-rating answers?

**D. Cross-border and processors**

19. Are there restrictions on transferring Indian users' data to the US (OpenAI, Resend) or to the
    Netherlands (current Railway volume)? Must production move to Mumbai before launch, and must
    Railway compute move with it?
20. Which contracting entities and regions should we ask each provider (Railway, Supabase, OpenAI,
    Resend, Apple, Google) to confirm in writing for the notice's "Where your data is stored"?
21. Which processor agreements must be in place, and must processors be named in the notice (they
    are now)?

**E. Rights, retention and grievance**

22. What response times apply to access, correction, erasure and grievance requests under the
    DPDP Rules (the owner's sources say not more than 90 days) and, if they apply, the Consumer
    Protection (E-Commerce) Rules (48 hours to acknowledge, one month to redress)? The pages promise
    48 hours and 30 days; are those right, and who may exercise a child's rights?
23. What retention periods should we adopt for: grade receipts and transcriptions (now 90 days),
    exam records (now up to 5 years), telemetry and crash reports (90 days), the unlinked payment
    ledger (proposed 8 years), the audit log (proposed 2 years), backups, and inactive adult
    accounts (no limit today)?
24. The notice says the payment record is kept because "tax and accounting law requires us to
    keep" it. Which law, for which operator, and for how long?
25. Must we publish a named grievance officer, with what details, and may that person be outside
    India?
26. What breach-notification process and timelines must we document?
27. While no lawyer has reviewed the notices, the app shows "Not yet reviewed by a lawyer" above
    each one and each says so in its text. Is that wording adequate, or should the app say more or
    less while it is in that state?

**F. Consumer and store**

28. Do the Consumer Protection (E-Commerce) Rules apply to subscriptions sold only through the App
    Store and Google Play, and what must the terms and refund policy say beyond what they say now?
29. Pri cannot issue an App Store refund itself (Apple decides) but can issue a Google Play refund
    through the Play Console. Does the policy describe each store's position correctly, and may it
    promise the same cases for both?
30. Should the app use Apple's standard EULA or custom terms, and does the terms page need
    anything more for Google Play?
31. Is the "not endorsed by NCERT, CBSE, NTA" statement adequate, and what rights basis is needed
    to use official past papers in the question bank (they are off for students until you answer,
    D23)?
32. Is anything in the draft store listings (`docs/release/store/`) a claim we should not make?
33. Should the app be declared to Google Play's Families policy (9–12 age band), and are we able
    to comply with it given the OpenAI processing?
34. A problem report about a question can contain free text the student types. For the App Store
    label and Play Data safety, should that be declared as "Customer Support" data as well as user
    content?
35. The third-party notices page (`/third-party-notices`) is generated from the dependency
    licences and reproduces them in English only. Every web package is listed, but on Android it
    lists only the libraries the app declares, and says that their own dependencies ship too and
    are not listed one by one. Is that enough, or must every Android library be listed? Is anything
    more required for an app sold in India?

---

## 12. Documents attached by reference

| Document | Path |
|---|---|
| Privacy notice (EN / HI) | `docs/legal/privacy.md`, `docs/legal/privacy.hi.md` |
| Terms (EN / HI) | `docs/legal/terms.md`, `docs/legal/terms.hi.md` |
| Refund policy (EN / HI) | `docs/legal/refund-policy.md`, `docs/legal/refund-policy.hi.md` |
| Grievance (EN / HI) | `docs/legal/grievance.md`, `docs/legal/grievance.hi.md` |
| Review switch | `docs/legal/review-status.json` |
| Third-party notices (generated) | `docs/legal/third-party/NOTICES.md`, `tools/third-party-notices.mjs` |
| Legal checklist | `docs/legal/README.md` |
| Owner defaults of 2026-11-01 | `V1_DECISIONS_2026-11-01.md` (owner-side file; D-numbers above refer to it) |
| Data retention | `docs/privacy/data-retention.md` |
| App Store privacy label draft | `docs/release/app-store-privacy-labels.md` |
| Play Data safety draft | `docs/release/play-data-safety.md` |
| Store listings | `docs/release/store/app-store-listing.md`, `play-listing.md` |
| Threat model, security acceptance, accepted risks | `docs/security/threat-model.md`, `acceptance.md`, `accepted-risks.md` |
| Release scope | `docs/release/PRI_V1_RELEASE_SCOPE.md` |
| Architecture decision (online-first, OpenAI, Supabase Mumbai) | `docs/architecture/adr-0001-online-first-runtime.md` |
