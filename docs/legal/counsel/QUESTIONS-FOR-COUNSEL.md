# Questions only Indian counsel can answer — Pri Learning

**Prepared:** 8 November 2026 by the engineering team (an AI coding agent working for the owner),
from `main` at `1d3829103` plus the notice corrections on `task/l7-legal-notices`; §4 quotes
the D17 prompt from pull request #737 and holds once #737 is in the same tree. **This is not
legal advice and records no legal conclusion.** Nobody qualified in Indian law has reviewed any
notice yet.

Review switch at this commit: `reviewed: false` (`docs/legal/review-status.json`).

This sheet is the short list to send. Each section names the decision the owner took on 1 November
2026 (`docs/release/V1_DECISIONS_2026-11-01.md`, D-numbers), says what the code does today, quotes
the **exact current text** the student or parent sees, and gives **where it lives** in the code. The
background — the product, infrastructure, data inventory, the guardian flow as built, and all 35
questions — is in `COUNSEL-INFORMATION-PACK.md` beside this file; question numbers below (Q1, Q2…)
are that pack's §11.

`tools/counsel-pack-check.mjs` (run by `npm run test:legal`) fails if any quoted text below is no
longer the text in the file it names, or if a location below no longer exists, so this sheet cannot
silently describe an older build. Where the text or the code does not exist yet, the sheet says
**Not yet in the code** and names the lane building it.

## How to answer

1. Answer in writing, by section, and say which text you approve, which you correct (give the
   wording), and which you reject.
2. The owner records the answer outside the repository; engineering changes the code and the
   notices in English and Hindi to match, in one change, and the Hindi is checked against the
   English.
3. Only then does a person set `docs/legal/review-status.json` to `reviewed: true`, with the
   reviewer, the qualification, the date, the languages and where the written sign-off is kept.
   The build refuses that flag without those fields, refuses it if a notice is edited after the
   review date, and nothing in the code or any agent sets it. Until it is set, the app shows "Not
   yet reviewed by a lawyer" above every notice.

---

## 1. Who the legal operator is [operator]

**Decision:** none taken. The owner's list "Only people can close these" includes written advice
from Indian counsel on who the legal operator should be. The notices name the owner as an
individual, at a home address in Australia, as data fiduciary, contracting party, seller and
grievance officer. Engineering will not replace a name or address with an entity, registration
number or address that has not been given to it.

**Current text** · `docs/legal/privacy.md`

> The person responsible for your data (the "data fiduciary") is
> Priysharan Tripathi, 5 Juniper Pl, Oakville NSW 2765, Australia.

**Current text** · `docs/legal/terms.md`

> These terms are an agreement between you and Priysharan Tripathi,
> 5 Juniper Pl, Oakville NSW 2765, Australia, about your use of Pri Learning on
> the web, on iPhone and iPad, and on Android.

**Current text** · `docs/legal/grievance.md`

> - Priysharan Tripathi
> - Grievance officer, Pri Learning
> - 5 Juniper Pl, Oakville NSW 2765, Australia
> - impriysharan@icloud.com

**Lives in** · `docs/legal/privacy.hi.md` · `Priysharan Tripathi`
**Lives in** · `docs/release/store/app-store-listing.md` · `{{OWNER_LEGAL_NAME}}`

The App Store copyright line is still the placeholder `{{OWNER_LEGAL_NAME}}`: it waits for this
answer, and is not filled with a guess.

**For counsel:**

1. Which entity should be the data fiduciary, contracting party and seller: the owner as an
   individual, an Australian company, or an Indian company? Does it need an Indian presence, and
   does the DPDP Act reach a foreign operator serving children in India? (Q1)
2. May the notices give a registered or care-of address instead of a home address, and what must
   the App Store seller name and the Play developer name match? (Q2)
3. If the operator is Australian, which Australian obligations follow it to Indian users? (Q3)
4. Which courts should the terms name (New Delhi today), and is the governing-law clause adequate?
   (Q4)
5. Must the grievance officer be a named person resident in India, and may it be the owner? (Q25)

## 2. The DPDP Act notices [DPDP notice]

**Decision:** the notices are published unreviewed and say so (the review switch above); English
governs and the Hindi says so; grievances are acknowledged within 48 hours and answered within 30
days, deferring to any shorter statutory period.

**Current text** · `docs/legal/privacy.md`

> This notice explains what Pri Learning collects, why, and what you can ask us to
> do about it. It is written for students and parents in India, and it is meant to
> give you what India's Digital Personal Data Protection Act 2023 asks a notice
> to give you. It has not yet been reviewed by a lawyer; the app says so above
> this notice, and will stop saying so only when that review has happened.

**Current text** · `docs/legal/privacy.md`

> The DPDP Act's obligations on children's data, including verifiable parental
> consent for anyone under 18, are expected to take effect in May 2027, eighteen
> months after the DPDP Rules were notified in November 2025.

**Current text** · `docs/legal/grievance.md`

> 1. We acknowledge your message within **48 hours**.
> 2. We investigate and reply with an answer or a plan within **30 days** of
>    receiving it; where the law sets a shorter time for your kind of request,
>    that shorter time applies.

**Current text** · `client/src/i18n/strings.en.js` · `legal.unreviewedBody`

> This notice is published so you can read what the app does with your data. No lawyer qualified in Indian law has reviewed it yet. When that review has happened, this banner will go.

**Lives in** · `client/src/pages/Legal.jsx` · `review-status.json`
**Lives in** · `client/test/legal-pages-check.mjs` · `REVIEWED`

**For counsel:**

1. Does the privacy notice give what the DPDP Act and Rules require of a notice (itemised
   description, purposes, rights, how to withdraw, how to complain), and must it be offered in
   further languages beyond English and Hindi?
2. What is the exact commencement date of the child-data provisions (the owner's sources disagree
   between 13 and 14 May 2027), and what applies before it, including the IT Act section 43A and
   the SPDI Rules 2011? (Q6)
3. Are 48 hours to acknowledge and 30 days to answer right, given the DPDP Rules and, if they
   apply, the Consumer Protection (E-Commerce) Rules 2020? Who may exercise a child's rights?
   (Q22)
4. What breach-notification process and timelines must be documented? (Q26)
5. Is the "Not yet reviewed by a lawyer" banner, and the sentence inside each notice, adequate
   while no review has happened? (Q27)

## 3. Consent and the guardian flow [consent]

**Decision:** an account is a child's unless the student says they are 18 or older; a guardian
confirms by an email link or an email code (SMS is off at launch, D3); until then nothing is marked,
read, synced or sent. The notice the guardian reads is versioned. The flow does not verify that the
person is an adult or the child's parent, and both the code and the notice say so.

**Current text** · `client/src/i18n/strings.en.js` · `signup.ageLead`

> If you are under 18, a parent or guardian approves your account before answers can be checked or anything syncs. You can ask them on the next step.

**Current text** · `client/src/i18n/strings.en.js` · `signup.noticeWhat`

> Pri stores your child’s name, class, contact, their answers and their progress on its servers. Today those run on Railway in the Netherlands (Amsterdam); a move to Supabase in Mumbai is planned.

**Current text** · `client/src/i18n/strings.en.js` · `signup.noticeWhy`

> Pri’s server marks their answers, and a picture of their handwriting or photo is sent to OpenAI to be read. Their progress also syncs between devices and is backed up. It is never sold or used for advertising.

**Current text** · `client/src/i18n/strings.en.js` · `signup.noticeNot`

> Until you confirm, Pri’s server holds only what it needs to set up the account and reach you: their name, class and contact details, and yours. Their answers are not checked, their handwriting and photos are not read, and nothing syncs.

**Current text** · `client/src/i18n/strings.en.js` · `signup.noticeWithdraw`

> You can withdraw at any time from the link in our email (or, where sign-in by SMS is offered, from the parent screen in Pri with a code sent to your phone). Withdrawing stops everything at once: marking, handwriting and photo reading, exams and sync.

**Current text** · `client/src/i18n/strings.en.js` · `signup.consentAgree`

> I am this learner’s parent or guardian, and I agree.

**Current text** · `docs/legal/privacy.md`

> **What that confirmation proves, and what it does not.** It shows that someone
> who can read that email inbox followed the link or entered the code. It does
> not show that they are an adult, or that they are your parent or guardian, so
> it is not the verifiable parental consent the DPDP Act will require.

**Lives in** · `server/platform/guardianConsent.js` · `CONSENT_NOTICE_VERSION = '2026-10-22'`
**Lives in** · `server/platform/guardianConsent.js` · `ACCEPTED_CONSENT_NOTICE_VERSIONS`
**Lives in** · `server/platform/router.js` · `requireGuardianConsent`
**Lives in** · `server/platform/otpEmail.js` · `is the code to approve your child’s Pri Learning account`
**Lives in** · `client/src/components/SignUpFlow.jsx` · `channels`

**For counsel:**

1. Is this confirmation acceptable before the child-consent provisions commence, and after? May the
   app be offered to children at scale before a verifiable method exists? (Q5)
2. Which verifiable-consent method do you recommend for students mostly aged 12 to 17 whose
   guardians are reached by email; is DigiLocker-based verification practical? (Q7)
3. Is the self-declaration "18 or older" enough age-gating? (Q8)
4. Is per-account adaptive question choice "tracking or behavioural monitoring" of a child, and do
   streaks, badges or timed papers raise a well-being concern? (Q9)
5. Must the guardian also accept the terms and the subscription terms, separately from consent to
   processing? (Q11)
6. The withdrawal sentence above was corrected on 2 November 2026 without changing the notice
   version, because it describes existing behaviour and adds no processing. Was that right, and
   which guardians must confirm again when a notice changes? (Q12)
7. Should the guardian notice name OpenAI's location and retention as well as its name (it names
   OpenAI only)? (Q14)

## 4. The one-time OpenAI prompt [D17]

**Decision (D17):** "A one-time prompt naming OpenAI appears before the first read or photo.
Nothing leaves the device until it is accepted, and declining keeps the student on typed answers."
Counsel sets the wording.

**What the code does with pull request #737 (lane L4):** before the first handwriting read, photo
of working or photo of a question, the app shows a one-time prompt naming OpenAI. Nothing is sent
until the student presses "Send it to be read". "No, I'll type my answers" turns server reading
off in Settings → Handwriting; turning it back on asks again before the next read. The answer is
kept **on the device only**, per local profile and per wording version (`pri-reader-permission-v1`
in local storage); there is no server record of it. A change to what the student agrees to must
bump `READER_PERMISSION_VERSION`, which asks every student again. The setting itself is still on by
default for a signed-in account, and stays off for a child until a guardian confirms. The wording is
a draft pending your answer; the Hindi is a draft pending a native-speaker review (D11).

**Not covered by the prompt:** the optional "check my working" feature (its own setting, which
sends the working lines and the question text and calls the provider "an outside AI service"), and
exam handwriting, which is switched off in shipped builds and must be gated before it is switched
on. The Settings → Handwriting text also says "an outside AI reading service" rather than naming
OpenAI.

**Current text** · `client/src/i18n/strings.en.js` · `readerPermission.title`

> Before Pri reads your writing

**Current text** · `client/src/i18n/strings.en.js` · `readerPermission.leadInk`

> To read your handwriting, Pri’s server sends a picture of it to OpenAI, an AI company. OpenAI reads the picture and sends back the text it sees.

**Current text** · `client/src/i18n/strings.en.js` · `readerPermission.leadPhoto`

> To read a photo of your working, Pri’s server sends the photo to OpenAI, an AI company. OpenAI reads it and sends back the text it sees.

**Current text** · `client/src/i18n/strings.en.js` · `readerPermission.leadQuestionPhoto`

> To find the question in your photo, Pri’s server sends the photo to OpenAI, an AI company. OpenAI reads it and sends back the text it sees.

**Current text** · `client/src/i18n/strings.en.js` · `readerPermission.what`

> For handwriting, only a picture drawn from your strokes is sent: not the question, not the answer, not your name. A photo is sent as you took it, so keep your name and anything private out of the frame.

**Current text** · `client/src/i18n/strings.en.js` · `readerPermission.keep`

> Pri does not keep the picture. OpenAI is asked not to store it, but says it may keep it for up to 30 days to check for misuse, and does not use it to train its models by default.

**Current text** · `client/src/i18n/strings.en.js` · `readerPermission.marks`

> The reading only suggests what you wrote. You check it, and Pri’s own marker decides the mark, never the AI.

**Current text** · `client/src/i18n/strings.en.js` · `readerPermission.choice`

> Nothing is sent until you choose. If you would rather not, you can type every answer instead, and change this later in Settings → Handwriting.

**Current text** · `client/src/i18n/strings.en.js` · `readerPermission.accept`

> Send it to be read

**Current text** · `client/src/i18n/strings.en.js` · `readerPermission.decline`

> No, I’ll type my answers

**Current text** · `docs/legal/privacy.md`

> **Nothing is sent until you agree.** The first time a picture would be sent —
> your handwriting, a photo of your working or a photo of a question — the app
> asks your permission once, naming OpenAI. If you say no, reading is turned
> off and you type your answers; if you turn it back on, you are asked again
> before the next picture. Your answer is kept on your device, for that
> profile, and the app asks again whenever what it tells you changes.

**Current text** · `client/src/i18n/strings.en.js` · `settings.cloudHandwritingCopy`

> Handwriting and photos are read only by this server reader; the on-device reader is not accurate enough to mark from. It is on by default for a signed-in account, and you can turn it off here — but then handwriting and photos are not read at all, and you type your answers instead. While it is on, a picture drawn from your strokes or your photo is sent through Pri’s server to an outside AI reading service to be read. It is a picture of your writing only — never the question, never the answer, never your name. Pri keeps no copy; the reading service is asked not to store it, but may hold it for a limited time under its own safety-monitoring rules. The reading only proposes what you wrote: Pri’s own marker decides the mark.

**Current text** · `docs/legal/privacy.md`

> It is your camera's picture, resized and re-encoded but not
> otherwise altered — so whatever is in the frame is sent, which can include the
> printed question, a name written on the page, or anything else on the paper.

**Lives in** · `client/src/ink/readerPermission.js` · `export const READER_PERMISSION_VERSION = 1;`
**Lives in** · `client/src/ink/readerPermission.js` · `pri-reader-permission-v1`
**Lives in** · `client/src/ink/ReaderPermission.jsx` · `role="dialog" aria-modal="true"`
**Lives in** · `client/src/i18n/strings.hi.js` · `'readerPermission.leadInk'`
**Lives in** · `client/src/ink/cloudReader.js` · `export function cloudReadingEnabled`
**Lives in** · `server/platform/handwriting.js` · `FORBIDDEN_FIELDS`

**For counsel:**

1. Is the prompt's wording above right, in English and in Hindi, and is it the "explicit
   permission" Apple Guideline 5.1.2(i) asks for before personal data goes to a third-party AI?
   (Q14)
2. Is a record kept only on the device (per profile and wording version, no server copy) enough
   evidence that the student agreed, or must the server record the acceptance?
3. For an adult student, is an accept button the right lawful basis, or does contract performance
   or a legitimate use apply? (Q13)
4. For a child, the student accepts the prompt after the guardian has confirmed the account. Must
   the guardian accept it as well, or does the guardian's confirmation (whose notice names OpenAI)
   cover it? (Q14)
5. Must "check my working", which also sends the question text, have its own prompt naming OpenAI,
   and must the Settings text name OpenAI rather than "an outside AI reading service"? (Q17)
6. Is OpenAI's abuse-monitoring retention (no zero-data-retention agreement is on record) acceptable
   for children's data, given OpenAI's own under-18 guidance? (Q15)
7. Is the photograph warning sufficient? (Q16)

## 5. Erasure of an unconfirmed or withdrawn child account [D18]

**Decision (D18):** "Accounts of under-18s whose guardian never confirmed, or withdrew, are erased
after 30 days, and a guardian can request erasure without the child's login." Counsel sets the
period.

**What the code does at `1d3829103`:** neither the erasure job nor the guardian's erasure request
exists. The privacy notice already promises both. A production nomination is refused while the
notice promises them and the nominated commit lacks them, so the promise cannot reach production
ahead of the code.

**What the accounts stream builds (pull request #736, lane L2, not merged):**

- **Who:** only a student account recorded as a child at creation. "Never confirmed" counts from
  the account's creation (asking again does not restart the clock); "withdrawn" counts from the
  withdrawal. Adults, older accounts with no age on record, staff, and a child whose guardian
  confirmed an older notice are never selected.
- **Two steps.** On day 30 the account is closed: it can no longer sign in, its sessions end, its
  links and codes are spent and its unsent mail is dropped. Seven days later (`ERASURE_GRACE_MS`)
  it is erased through the same deletion transaction as an account holder's own deletion. The
  seven days are an operator's window to see the counts and restore an account closed by mistake;
  a guardian confirming during them does not reopen it.
- **The switch.** Because D18 is provisional and the period is yours to set, the automatic 30-day
  rule acts only where the operator sets `PRI_CHILD_ERASURE=enforce`; otherwise it only counts the
  accounts it would close. A guardian's own erasure request is honoured in every mode: the account
  stops working at once and is erased seven days later.
- **The guardian's route:** `POST /v1/account/guardian/erase`, reached from a second link in the
  withdrawal email (the confirmation link works too).
- The notice now says what that code does ("closed", then "erased 7 days later"). The nomination
  prints `PRI_CHILD_ERASURE=enforce` as a production setting the notice depends on, for the
  operator to confirm; code cannot see production's settings.

**Current text** · `docs/legal/privacy.md`

> **If no parent or guardian has confirmed the account 30 days after it was
> created**, or 30 days after a parent or guardian withdraws, the account is
> closed: it stops working and every sign-in on it ends. Everything it holds is
> erased 7 days later. A parent or guardian can also ask us to erase the account
> without the child's login, from the link in our email or by writing to the
> address under Your rights; it then stops working at once and is erased 7 days
> later.

**Lives in** · `tools/legal-promises.mjs` · `PROMISES`
**Lives in** · `tools/legal-promises.mjs` · `PRI_CHILD_ERASURE=enforce`
**Lives in** · `scripts/release-nominate.mjs` · `legalPromiseGaps`

**Not yet in the code:** the erasure job (`runChildErasure` in `server/platform/childErasure.js`,
run by housekeeping every six hours, with `UNCONSENTED_CHILD_RETENTION_MS` = 30 days and
`ERASURE_GRACE_MS` = 7 days) and the guardian's route. Both are in #736; this section names their
files once it merges.

**For counsel:**

1. Is 30 days the right period, counted from creation for an account no guardian confirmed and
   from the withdrawal for one a guardian withdrew? (Q10)
2. Is a seven-day window between closing the account and erasing it acceptable, for the automatic
   rule and for a guardian's own request? Must the notice say what happens during it?
3. May the app launch with the automatic rule switched off (counting only) until you set the
   period, given that the notice promises it? Engineering's position is that the notice is true
   only where `PRI_CHILD_ERASURE=enforce` is set, so production must set it or the notice must
   change first.
4. May a guardian request erasure without the child's login on the strength of the withdrawal or
   confirmation link, or an email to the grievance officer, given that the confirmation does not
   establish who the guardian is? (Q10)
5. Must erasure reach backups within a stated period, and must the notice give that period? (Q23)

## 6. Email to parents about minors [D22]

**Decision (D22):** "The parent report is finished in code behind a flag that stays off until
counsel reviews email about minors."

**What the code does at `1d3829103`:** Pri emails a guardian only to confirm or withdraw the
child's account. It emails the student's own address for sign-in codes, deletion codes and
new-device sign-in notices. No report about a child's learning is emailed to anyone. The weekly
parent report is in pull request #659 (`task/parent-report-weekly`, lane L6), not merged, and
sends only where `PRI_PARENT_REPORT_EMAILS=on`, to an address that has confirmed twice (double
opt-in), as its own header describes.

**Current text** · `docs/legal/privacy.md`

> - **Email delivery** (Resend) for verification links, password reset links,
>   one-time codes and the confirmation sent to a parent or guardian.

**Lives in** · `server/platform/otpEmail.js` · `guardian-consent`
**Lives in** · `server/platform/securityEmail.js` · `New sign-in to your Pri Learning account`
**Lives in** · `server/platform/sessionAlerts.js` · `session.new-device`

**Not yet in the code:** the parent report and its email (pull request #659). Its text is quoted
here when it merges, before the flag is turned on.

**For counsel:**

1. May Pri email a parent or guardian a weekly summary of a minor's practice (questions answered,
   chapters, marks), and on what basis: the guardian's confirmation of the account, a separate
   opt-in, or the child's own agreement as well?
2. What must the privacy notice and the guardian notice say before that email is switched on?
3. May Pri email a minor directly for sign-in codes and security notices, as it does today, and is
   anything else needed (for example a copy to the guardian)?
4. Does the guardian need to be re-confirmed when the report is introduced, given the guardian
   notice does not mention it today? (Q12)

## 7. Past-paper rights [D23]

**Decision (D23):** "Off for students until a rights opinion exists. Generated questions cover
every chapter without them." (The second sentence is the owner's internal planning note, not public
wording; public copy never says "every chapter", D24.)

**What the code does at `1d3829103`:** two archives of transcribed past papers are in the client
bundle: a source-cited archive of NTA, JAB and CBSE papers and a reviewed JEE catalogue. Nothing on
`main` keeps them from students. Lane L5's default-off switch, which keeps both from every student
route and timed paper until `PRI_PAST_PAPERS=1` on the server or `PRI_FEATURE_PAST_PAPERS=1` in the
client build, is on its branch and not yet merged. No written rights record exists for any row.

**Current text** · `docs/legal/terms.md`

> Questions, solutions and explanations are ours. Your work is yours: what you
> write and answer belongs to you, and we claim no ownership of it.

**Current text** · `docs/legal/terms.md`

> Pri Learning is maths practice for CBSE / NCERT Classes 7 to 12, JEE Main and
> JEE Advanced. It is not endorsed by, affiliated with or approved by NCERT, CBSE,
> the NTA or any examination authority.

**Lives in** · `client/src/engine/pyq/pyqArchive.js` · `export`
**Lives in** · `client/src/engine/generators/jee-pyq-runtime.js` · `export`
**Lives in** · `docs/release/store/app-store-listing.md` · `Past papers are **off for students**`

**Not yet in the code:** the default-off switch (lane L5, `client/src/engine/pastPapers.js` on its
branch).

**For counsel:**

1. On what rights basis, if any, may transcriptions of NTA, JAB and CBSE question papers be used in
   a paid app, with or without attribution? (Q31)
2. Does "Questions, solutions and explanations are ours" need qualifying for material whose
   copyright Pri does not hold?
3. Is the "not endorsed by NCERT, CBSE or NTA" sentence adequate, and must it appear in the store
   listings as well (it does)? (Q31)

## 8. The rest of the pack

The remaining questions in `COUNSEL-INFORMATION-PACK.md` §11 are not repeated here: cross-border
transfer and processors (Q19–Q21), retention periods and the payment ledger (Q23–Q24), consumer law
and the store refund positions (Q28–Q30), the draft store listings (Q32), Google Play's Families
policy (Q33), whether problem reports are "Customer Support" data (Q34) and the third-party notices
(Q35). Counsel's answers to them change the notices, the store disclosures and the code in the same
way as the sections above.
