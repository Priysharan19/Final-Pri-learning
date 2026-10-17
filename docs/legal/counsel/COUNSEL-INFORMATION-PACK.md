# Counsel information pack — Pri Learning

**Prepared:** 2026-10-18 by the engineering team (an AI coding agent working for the owner) from
the code on `main` at `7bef402f7`. **This is not legal advice and contains no legal conclusions.**
It describes what the software does, lists the laws and store policies the owner believes may be
relevant, and asks questions. Where it mentions a legal provision, it does so to frame a question
for counsel, not to state how the provision applies. Every factual statement cites the code or
document it comes from so counsel can ask for it to be checked.

(This file sits in `docs/legal/counsel/` rather than `docs/legal/` because `tools/legal-status.mjs`
treats every Markdown file directly in `docs/legal/` as a public notice that must have a Hindi
twin.)

The owner needs counsel to: (1) say which laws and policies apply and what they require; (2)
rewrite or approve the privacy notice, terms, refund policy, grievance page and the in-app guardian
notice; (3) answer the questions in §11. Engineering will then change the product to match.

---

## 1. The product in one page

| | |
|---|---|
| Name | Pri Learning (App Store bundle `com.prilearning.app`) |
| What it is | A maths practice app. Students answer questions by handwriting (Apple Pencil or finger), by photographing paper working, or by typing. The server reads the handwriting, marks the answer and records progress |
| Who it is for | Students in India: CBSE / NCERT Classes 7–12 (about ages 12–18) and JEE Main / JEE Advanced aspirants (about 16–18, plus adult repeaters). **Most users are expected to be minors.** |
| Launch scope | India first; iPhone, iPad, Android phones and Android tablets (owner scope change of 2026-10-16, `docs/release/PRI_V1_RELEASE_SCOPE.md` §22, #504) |
| Price | Free tier (20 practice questions a day, one exam simulation every 30 days). Premium subscription, intended ₹199 / month or ₹1,499 / year, sold through Apple's App Store and Google Play. Web purchasing via Razorpay exists in code but is out of the first release |
| Operator | **To be decided by the owner** — the legal entity, its country and registered address are placeholders (`{{OWNER_LEGAL_NAME}}`, `{{OWNER_ADDRESS}}` in `docs/legal/*.md`). The owner is based in Sydney, Australia; the market is India. This matters for §6 and §7 |
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
- An AI tutor exists in code but is compiled out of production builds
  (`client/vite.config.js` `PRI_FEATURE_TUTOR`).
- Method-mark rubrics for some question types are switched off in production pending review by a
  qualified examiner (GitHub issue #499; `docs/release/EXAMINER-REQUEST.md`).

---

## 2. Infrastructure and where data is processed

| Component | Provider | Location | Notes |
|---|---|---|---|
| Application server | Railway | **To be confirmed by the owner** | Railway is a US company. The service region is a deployment setting |
| Database (target) | Supabase Postgres | Mumbai, India (`ap-south-1`) | Production cutover **not yet done** (`docs/release/production-cutover-checklist.md`) |
| Database (today, production) | SQLite file on a Railway volume | Observed in Railway region `ams` (Amsterdam) on 2026-10-04 | Until cutover, production account data is stored outside India. The in-app guardian notice says data is stored "on its servers in India" (§8.3) |
| Handwriting / photo reading, working check, tutor | OpenAI API (`api.openai.com`) | Outside India; region and contracting entity to be confirmed | Requests set `store: false`. OpenAI's API terms allow it to keep inputs for a limited period for abuse monitoring; Pri has **no zero-data-retention arrangement** on record (`docs/privacy/data-retention.md` §4) |
| Email (sign-in links, codes, guardian emails) | Resend | US provider; sending domain `mail.prilearning.com` | Sees address and message |
| SMS (codes) | MSG91 or Twilio Verify — **not yet chosen** | Provider-dependent | Only if configured (`server/platform/smsProvider.js`) |
| Payments | Apple App Store (StoreKit) and Google Play Billing | Provider | Pri never sees card details (`server/platform/appleBilling.js`, `googleBilling.js`) |
| Web payments (code present, **outside V1**) | Razorpay | India | If web checkout were enabled, Razorpay would receive the account's email (`notify_info.notify_email`) and the opaque account id (`server/platform/razorpay.js` ~line 380). Not configured for V1; native clients are refused web checkout |
| Sign-in with Apple / Google | Apple, Google | Provider | Only when the student taps them (`client/src/platform/socialSignIn.js`) |

---

## 3. Data collected

Fuller tables with code references: `docs/release/app-store-privacy-labels.md` §2,
`docs/release/play-data-safety.md` §2, `docs/privacy/data-retention.md`.

| Data | From whom | Why | Kept | Sent to |
|---|---|---|---|---|
| Email address **or** mobile number | Student | Sign-in, verification, codes | Until account deletion | Email / SMS provider |
| Name (as typed) | Student | Account | Until deletion | — |
| "Are you 18 or older?" answer; class and track | Student | Decides whether guardian confirmation is needed; which maths to set | Until deletion | — |
| Guardian's name and email or mobile number; consent method, notice version, times | Student (about the guardian), guardian | Guardian confirmation for an under-18 account | Until deletion | Email / SMS provider |
| Handwriting image (rasterised from strokes) and photos of paper or of a textbook question | Student | Reading the answer | **Image not kept** by Pri (memory for the request only) | **OpenAI** |
| Transcription of that image, and any correction the student types | Generated / student | Grading receipt | **90 days** (`practice.js` `MAX_AGE`) | — |
| Typed answers, working lines, exam answers | Student | Grading | Practice grade records 90 days; exam papers/answers/results up to 5 years (`exams.js` `RECORD_TTL`); all deleted with the account | Working lines + question text to **OpenAI** only if "check my working" is on |
| Graded-attempt records (question, right/wrong, marks, chapter, difficulty, mode) | Generated | Progress, choosing the next question | Until deletion | — |
| Synced profile, settings, bookmarks, tasks, custom questions | Student | Cross-device sync | Until deletion | — |
| Problem reports about a question | Student | Content quality | Free text removed on deletion; the rest kept unlinked | — |
| Telemetry (allow-listed events: errors, failures, feature used, exam completed, trial started, subscription state, performance) | Generated | Operations | 90 days; **blocked for a child until guardian confirmation** | — |
| Random per-install device id; hash of user-agent; sign-in times | Generated | Sessions | Until deletion | — |
| Subscription state and payment ledger (amount, currency, provider reference) | Apple / Google | Entitlement; accounting | Subscription link until deletion; ledger kept **unlinked** after deletion (proposed 8 years; no purge yet) | — |
| Audit log (action, opaque ids) | Generated | Security | Proposed 2 years; append-only; no purge yet | — |

**Stays on the device:** handwriting strokes and the personal handwriting bank; local profiles
(optionally password-encrypted); drafts and ink waiting to be read (`client/src/local/idb.js`).

**Not collected:** location, contacts, microphone, health data, advertising identifiers, browsing
history.

**Backups:** Supabase point-in-time backups and SQLite backups contain deleted data until they age
out; the backup retention period is a deployment setting not yet recorded for production
(`data-retention.md` §2).

---

## 4. Minors and the guardian-confirmation flow (as built)

Source: `server/platform/guardianConsent.js`, `server/platform/otp.js`,
`client/src/components/SignUpFlow.jsx`, `docs/release/otp-sign-in.md`.

1. The app does **not** ask for date of birth. At sign-up it asks the student's class and whether
   they are 18 or older. Unless the student says they are, the account is treated as a child's.
2. The student enters a parent or guardian's name and email address **or** mobile number.
3. The guardian receives either an email link (`guardian-email-confirmation`, valid 1 hour) or a
   six-digit code (`guardian-email-otp` / `guardian-phone-otp`) which they enter on their own page
   after reading a short notice. The method is recorded in every consent row.
4. Until the guardian confirms, the child's account can sign in, view and export its data, and be
   deleted — **nothing else**. It cannot practise with marking, sit exams, sync, send telemetry,
   use handwriting reading or subscribe. Every such route returns `GUARDIAN_CONSENT_PENDING`
   (`requireGuardianConsent` in `server/platform/router.js` covers `/practice`, `/exams`,
   `/handwriting`, `/working`, `/question-photo`, `/sync`, `/billing`, `/telemetry`, `/tutor`,
   `/reports`, `/classes`, `/assignments`).
   - Because grading is now online-only, **a child cannot have any answer marked before the
     guardian confirms.**
5. The guardian can withdraw at any time (a long-lived withdrawal link in the confirmation email,
   or a code to the same phone). Withdrawal stops all of the above at once; the same ceremony
   cannot be re-used to consent again.
6. What the confirmation proves, as the code itself records: that someone with access to that
   inbox or phone number took the action. It does **not** establish that the person is an adult,
   or is the child's parent or lawful guardian. The code and the current privacy notice both say
   it must not be called "verifiable parental consent".
7. The notice the guardian sees is versioned (`CONSENT_NOTICE_VERSION = '2026-10-02'`). Its text
   is in `client/src/i18n/strings.en.js` keys `signup.notice*` and is **outdated** (§8.3).
8. Handwriting reading is **on by default** for a signed-in account, but stays off for a child
   until the guardian confirms (`client/src/ink/cloudReader.js` rule 1). After confirmation it is
   on unless switched off in Settings.

Children's data is not used for advertising, not shared for advertising and not sold. The server
does use each account's own attempt history to choose the next question (adaptive practice).

---

## 5. India — Digital Personal Data Protection Act 2023 and Rules

The owner's understanding, for counsel to confirm or correct: the Act was enacted in 2023; the
DPDP Rules were notified in November 2025 with phased commencement; the code and notice assume the
substantive obligations, including verifiable consent for children, commence on **14 May 2027**.
Counsel is asked to confirm the dates and what applies before then (including whether the IT Act
2000 section 43A and the SPDI Rules 2011 still apply in the interim).

Areas the owner believes are relevant (questions in §11):

| Area | What the product does today | Open point |
|---|---|---|
| Child = under 18 | Every Class 7–12 student is treated as a child unless they declare 18+ | Whether a self-declaration of 18+ is enough, and what "reasonable" age-gating looks like |
| Verifiable parental consent | Email link / code to an address the child supplies; not verified (§4.6) | What method satisfies the Rules (the owner's reading is that the Rules mention identity details already reliably held, or a token from a government-authorised entity such as DigiLocker); whether an interim method is acceptable before commencement |
| No tracking, behavioural monitoring or targeted advertising directed at children | No ads, no third-party tracking. The server tracks each student's attempts to choose questions and show progress | Whether per-account adaptive practice and progress tracking is "behavioural monitoring" of a child, and whether any exemption (e.g. for educational purposes) can apply to an ed-tech provider that is not an educational institution |
| No processing likely to cause a detrimental effect on a child's well-being | Streaks, badges, exam simulations | Whether any engagement feature raises this |
| Notice | `docs/legal/privacy.md` (English) and `privacy.hi.md` (Hindi), plus the in-app guardian notice | Content requirements; itemised notice; languages |
| Consent and withdrawal | Guardian consent; withdrawal as easy as giving it | Whether **adult** students need a separate consent for OpenAI processing, or whether "legitimate uses" or contract performance applies; whether default-on reading is valid consent |
| Data principal rights (access, correction, erasure, grievance, nomination) | In-app export (`GET /v1/account/export`) and immediate deletion; correction by request; nomination by request | Response timelines; who exercises a child's rights; whether export must include sealed exam papers (currently not exported — `V1_COMPLETION_LEDGER.md` surface 10) |
| Grievance officer / contact | Placeholder `{{GRIEVANCE_OFFICER_NAME}}`, `{{GRIEVANCE_OFFICER_EMAIL}}` (`docs/legal/grievance.md`) | Whether a named officer, a Data Protection Officer or an India-resident contact is required |
| Retention and erasure | Account data until deletion; grade records 90 days; exam records up to 5 years; telemetry 90 days; payment ledger unlinked, proposed 8 years; audit log proposed 2 years; no automatic deletion of inactive accounts | Whether erasure is required when the purpose is served (e.g. inactivity), and the periods |
| Cross-border transfer | OpenAI and Resend outside India; production database currently in Amsterdam until cutover | Whether any transfer restriction applies; whether the guardian notice's "servers in India" statement must change |
| Processors | Railway, Supabase, OpenAI, Resend, SMS provider, Apple, Google; Razorpay only if web purchasing is later enabled (code present, outside V1) | Whether processor contracts (DPAs) are required and with what terms; whether processors must be named in the notice |
| Security safeguards and breach notice | Hashing of passwords/tokens/codes, HTTPS, RLS, server authorisation (`docs/security/threat-model.md`, `acceptance.md`); no external penetration test yet (`accepted-risks.md` R-12) | What is "reasonable security"; breach-notification timelines to the Board and to users |
| Significant Data Fiduciary | Not assessed | Whether the volume of children's data could lead to designation |

Other Indian rules the owner believes may be relevant, for counsel to confirm or dismiss: Consumer
Protection Act 2019 and Consumer Protection (E-Commerce) Rules 2020 (grievance officer, price
display, refund terms); Information Technology (Intermediary Guidelines and Digital Media Ethics
Code) Rules 2021 (probably not applicable without user-to-user content); any guidance on ed-tech
and minors; GST and record-keeping for the payment ledger.

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
| Apple Guideline 5.1.2(i) — sharing personal data with third-party AI | Apple asks apps to disclose and obtain explicit permission before sharing personal data with third-party AI | Handwriting reading is default-on with in-app disclosure. Whether a separate consent prompt is needed is an open question |
| Apple Guideline 5.1.1(v) — account deletion | In-app deletion required | Implemented, immediate |
| Apple Guideline 3.1.2 — subscriptions | Disclosure of terms | Draft text in the listing |
| Google Play Families policy | Applies if any target age group is under 13 | Class 7 students are about 12; see `docs/release/store/play-listing.md` §5 |
| Google Play User Data policy / prominent disclosure | Disclosure of data not reasonably expected | Images to OpenAI should be disclosed in-app before first use |
| Google Play AI-generated content policy | If the tutor is enabled | Off in production builds |

---

## 8. Current legal documents and where they are outdated

The four public documents are templates with seven placeholders, in English and Hindi
(`docs/legal/README.md`; `node tools/legal-status.mjs`). They were last revised before the
2026-10-10 decision to make grading online-only. **None has been reviewed by a lawyer.** The Hindi
versions (`*.hi.md`) mirror the English and carry the same errors; the English governs. The
automated check `client/test/legal-pages-check.mjs` requires the two languages to stay in
section-for-section step, so corrections must be made to both in the same change.

### 8.1 `docs/legal/privacy.md` (and `privacy.hi.md`)

| # | Statement in the notice | What the code does now |
|---|---|---|
| 1 | "Questions, handwriting recognition, marking and your progress all run on your own device." | The server issues and marks every question; handwriting is read by the server via OpenAI |
| 2 | "You can use the whole app without an account and without a network." | Signed out or offline, nothing is marked; ink and drafts are kept until the student is signed in and online |
| 3 | "What stays on your device … Every question you have answered, your answers, your marks and your history." | Answers, marks and history are recorded on the server (graded-attempt records; grade receipts 90 days; exam records up to 5 years) |
| 4 | "A Pri cloud account is optional. It exists so your progress can follow you to a second device, so a teacher can set work, and so a subscription can be verified." | An account is needed to have any answer checked |
| 5 | Server reading "keeps no copy: it is not written to our database" | True of the **image**. The **transcription** and any student correction are written to the database for 90 days |
| 6 | "your mark is always decided by the marking engine on your own device" | Decided by the deterministic engine **on the server** |
| 7 | Working check: "Your mark is decided on your device either way." | On the server |
| 8 | Photos: describes a photo of paper working only | "Practise this" also sends a photo of a textbook/worksheet question to OpenAI (`server/platform/questionPhoto.js`) |
| 9 | "Learning events: that you answered a question, which chapter it belonged to, whether you were right, and how long you took." | Also: the server-issued question, submitted answers and working, transcriptions, exam papers and answers, marks |
| 10 | Children: "Everything works without an account, and without an account nothing leaves the device." | Without an account nothing is marked. A child cannot have anything marked until the guardian confirms |
| 11 | "Your teacher, if you join their class" | Teacher features are not a public product in the first release |
| 12 | "we do not build behavioural profiles for anything other than choosing the next maths question" | Question choice is now made by the server from the account's history; wording and the §5 "behavioural monitoring" question apply |
| 13 | "Who else sees your data" lists categories but does not name Railway, Supabase or Resend, or say where they process data | Processors and locations in §2 above; cross-border processing not mentioned |
| 14 | No statement of where data is stored | Production data is on a Railway volume observed in Amsterdam until the Supabase Mumbai cutover |
| 15 | Retention: "Learning events on our server are kept while your account is open." | Also: grade receipts and transcriptions 90 days; exam records up to 5 years |
| 16 | "The DPDP Act's substantive obligations … commence on 14 May 2027." | Stated as fact; counsel to confirm |
| 17 | Placeholders: owner name, address, grievance officer name and email, support email, jurisdiction city, last-updated date | Unfilled |

### 8.2 `docs/legal/terms.md` (and `terms.hi.md`)

| # | Statement | Issue |
|---|---|---|
| 1 | "The learning half works offline; the cloud half needs a network" | Marking needs a network and an account |
| 2 | "Pri Learning generates practice questions, reads handwriting, marks working" | Does not say that reading is done by a third-party AI service |
| 3 | "If you are under 18, a parent or guardian must agree to these terms for you." | The guardian flow records consent to data processing, not acceptance of the terms; counsel to decide whether the flow must also capture acceptance of the terms |
| 4 | Subscriptions paragraph | No prices or plan names; whether Apple's standard EULA or a custom EULA is used is undecided |
| 5 | Placeholders | Unfilled |

### 8.3 In-app guardian notice (`client/src/i18n/strings.en.js`, `signup.notice*`; Hindi equivalents)

| Key | Text | Issue |
|---|---|---|
| `signup.noticeWhat` | "Pri stores your child's name, class, contact and their practice progress on its servers in India." | Production data is currently stored in Amsterdam; handwriting images go to OpenAI outside India; the list omits handwriting images, photos, answers and transcriptions |
| `signup.noticeWhy` | "This is only so their progress syncs between devices and is backed up." | The data is also used to read and mark every answer |
| `signup.noticeNot` | "Practice, marking and handwriting work on this device without any of this." | Not true: marking needs the account and the guardian's confirmation |
| `signup.noticeWithdraw` | "… Sync stops at once." | Withdrawal also stops marking, reading and exams |

Changing this notice requires bumping `CONSENT_NOTICE_VERSION` (`guardianConsent.js`) so existing
confirmations are visibly against the old notice. The owner must decide whether guardians who
confirmed under the old notice are asked again.

### 8.4 Other text that is outdated (engineering will fix once counsel settles the wording)

- `docs/legal/README.md` "What the code does": "Questions, handwriting recognition and marking
  need no network"; "Only when a student switches on server reading".
- `server/platform/guardianConsent.js` header comment: "the whole app … works with no account at
  all".
- `docs/privacy/data-retention.md` §1 table: "practice, marking and on-device handwriting are
  unaffected" for an unverified or pending account.
- `docs/legal/refund-policy.md` and `grievance.md`: no known factual errors; placeholders unfilled;
  the Razorpay refund paragraphs describe web purchasing, which is out of the first release.

---

## 9. What the owner is asking counsel to produce

1. Advice on which laws and policies apply to the launch model in §1 (India first; minors; OpenAI
   processing; operator possibly in Australia).
2. A rewritten privacy notice, terms of use, refund policy and grievance page for India (English;
   Hindi translation checked against it), and a rewritten in-app guardian notice.
3. A view on the guardian-confirmation method: acceptable now, acceptable until commencement, or
   to be replaced before launch; and with what.
4. A list of processor agreements needed and their key terms.
5. Retention periods to put into code.
6. Wording for the store disclosures (App Store privacy label, Play Data safety, any in-app
   consent prompt for AI processing).
7. Confirmation of anything in this pack that is wrong.

Engineering will not mark any legal item complete without counsel's written sign-off referenced in
the launch record (`docs/legal/README.md` checklist).

---

## 10. Facts counsel may want verified

Engineering can demonstrate any of these on a staging deployment with test accounts:

- the request sent to OpenAI for a handwriting read (headers redacted), showing no question, answer
  or name;
- the consent gate refusing every route listed in §4 for an unconfirmed child account;
- deletion removing every row listed in `data-retention.md` §2, with the database scan in
  `server/test/account-lifecycle-journey-check.mjs`;
- the account export contents.

---

## 11. Questions for counsel

**Entity and jurisdiction**

1. Which entity should be the data fiduciary and contracting party, and does it need an Indian
   presence (company, representative or grievance officer resident in India)?
2. If the operator is Australian, which obligations under the Australian Privacy Act follow it to
   Indian users?
3. Which courts should the terms name?

**Children and consent**

4. Is the current guardian confirmation (§4) acceptable before the DPDP Rules' child-consent
   provisions commence? Is it acceptable after?
5. What verifiable-consent method do you recommend for an app whose users are mostly 12–17 and
   whose guardians are reached by email or mobile number? Is DigiLocker-based verification
   practical for us, and are there alternatives?
6. Is the student's self-declaration "I am 18 or older" sufficient age-gating, or must we do more?
7. Does per-account adaptive question selection and progress tracking count as "tracking or
   behavioural monitoring" of children? If so, does any exemption apply to us, or must we change
   the feature for under-18s?
8. Do streaks, badges or exam simulations raise any "detrimental effect on well-being" concern?
9. Must the guardian also accept the terms of use (and the subscription terms) on the child's
   behalf? Can a minor's subscription purchase through Apple be relied on?
10. If the guardian notice changes, must guardians who confirmed under the old notice confirm
    again?

**AI processing**

11. What is the lawful basis for sending an **adult** student's handwriting images to OpenAI? Is
    default-on with disclosure enough, or is opt-in consent needed?
12. For a child, does the guardian's confirmation cover OpenAI processing, and must the notice name
    OpenAI and its location?
13. Is OpenAI's retention for abuse monitoring (with `store: false`, no zero-data-retention
    agreement) acceptable for children's data, or should we obtain zero data retention or choose a
    different provider or region?
14. A photographed page may contain other people's data or the student's name. Is the current
    warning ("keep out of shot whatever you would not want sent") sufficient?
15. Apple Guideline 5.1.2(i): in your view, does our flow obtain "explicit permission" for
    third-party AI processing?

**Cross-border and processors**

16. Are there restrictions on transferring Indian users' data to the US (OpenAI, Resend) or to the
    Netherlands (current Railway volume)? Must production move to Mumbai before launch?
17. Which processor agreements must be in place, and must processors be named in the notice?
17a. A problem report about a question can contain free text the student types (`issue_reports.note`). For the App Store label and Play Data safety, should that be declared as "Customer Support" data as well as user content?

**Rights, retention, grievance**

18. What response times apply to access, correction, erasure and grievance requests, and who may
    exercise a child's rights?
19. Must the account export include sealed exam papers and detailed marks?
20. What retention periods should we adopt for: grade receipts and transcriptions (now 90 days),
    exam records (now up to 5 years), telemetry (90 days), the unlinked payment ledger (proposed
    8 years), the audit log (proposed 2 years), backups, and inactive accounts (no limit today)?
21. Must we publish a named grievance officer, and with what details?
22. What breach-notification process and timelines must we document?

**Consumer and store**

23. Do the Consumer Protection (E-Commerce) Rules apply to subscriptions sold only through the App
    Store / Play, and what must the terms and refund policy say?
24. Is the "not endorsed by NCERT, CBSE, NTA" statement adequate, and what rights basis is needed
    to use official past papers in the question bank?
25. Is anything in the draft store listings (`docs/release/store/`) a claim we should not make?
26. Should the app be declared to Google Play's Families policy (9–12 age band), and are we able to
    comply with it given the OpenAI processing?

---

## 12. Documents attached by reference

| Document | Path |
|---|---|
| Privacy notice (EN / HI) | `docs/legal/privacy.md`, `docs/legal/privacy.hi.md` |
| Terms (EN / HI) | `docs/legal/terms.md`, `docs/legal/terms.hi.md` |
| Refund policy (EN / HI) | `docs/legal/refund-policy.md`, `docs/legal/refund-policy.hi.md` |
| Grievance (EN / HI) | `docs/legal/grievance.md`, `docs/legal/grievance.hi.md` |
| Legal checklist | `docs/legal/README.md` |
| Data retention | `docs/privacy/data-retention.md` |
| App Store privacy label draft | `docs/release/app-store-privacy-labels.md` |
| Play Data safety draft | `docs/release/play-data-safety.md` |
| Store listings | `docs/release/store/app-store-listing.md`, `play-listing.md` |
| Threat model, security acceptance, accepted risks | `docs/security/threat-model.md`, `acceptance.md`, `accepted-risks.md` |
| Release scope | `docs/release/PRI_V1_RELEASE_SCOPE.md` |
| Architecture decision (online-first, OpenAI, Supabase Mumbai) | `docs/architecture/adr-0001-online-first-runtime.md` |
