# Legal pages: owner review, 18 November 2026

**This is for you to read before you approve the pages. It is not legal advice.**
No lawyer has reviewed any of these pages. The "not yet reviewed by a lawyer" banner is
unchanged, and so is the switch behind it (`docs/legal/review-status.json` and
`docs/legal/au/review-status.json`, both `reviewed: false`). Your approval is not a lawyer's
review and does not remove the banner. Nothing here says the pages comply with any law.

## How to read this

- Each page below says **what changed** and lists each **promise** the page makes.
- Every promise has the **code file that keeps it**. If the code did not keep a promise, the
  promise is not on the page.
- A test, `client/test/legal-owner-review-check.mjs` (part of `npm run test:legal`), checks each
  promise against the code. It reads every number from the code. If the code changes later,
  the test fails until the page is updated.
- Pages for India are in English and Hindi. The Hindi says at the top that the English governs.
  Pages for Australia are in English only. I kept the two editions apart: nothing Indian is in the
  Australian pages, and nothing Australian is in the Indian ones.

## Things I found that you should know first

1. **The old pages said things that were no longer true.** I fixed them:
   - They said the handwriting picture is not kept. Now the original handwriting or photo of a
     marked practice answer is kept for 2 years.
   - They said the app does not ask your age. It does ask (11 to 17, or "18 or older"). It keeps
     only the decision (child or adult), not the age.
   - The Australian page said every account not declared an adult needs a guardian (under 18).
     The code says guardian consent only for students **under 15**. I changed the page to match.
   - The in-app prompt and two Settings texts said "Pri keeps no copy" or "your ink stays on this
     device". I changed those texts too (English and Hindi). Because the prompt's meaning changed,
     I raised `READER_PERMISSION_VERSION` from 1 to 2. **Every student is asked for permission
     again.** The CTO should know this before release.
2. **The plans on the pages are today's code, not the plan you approved.** See "Plans" below.
3. **Hosting facts I could not fill.** The code does not say where the servers and databases are.
   - Australia: the pages still have two blanks, `{{AU_HOSTING_PROVIDER_AND_REGION}}` and
     `{{AU_DATABASE_PROVIDER_AND_REGION}}`, plus `{{CONTACT_EMAIL}}`. The page shows a "Template"
     banner until you fill them. The only repository evidence is the backup guide
     (`docs/operations/restore-runbook.md`): "Neon Sydney" for Australia and "Neon Singapore" for
     India. It names no Railway region. Please confirm the real answers.
   - India: the privacy page still says the server was in Railway's Amsterdam region on 4 October
     2026 and that a move to Supabase in Mumbai is planned. The backup guide suggests the
     database is now Neon in Singapore. **That section may be out of date.** I did not change it
     because I cannot prove either way from the code.
4. **Store listings were not changed.** `docs/release/app-store-privacy-labels.md` and
   `docs/release/play-data-safety.md` still need the stored-handwriting facts before an app goes
   to a store. I did not touch them.
5. **No screen shows a stored original yet.** The server keeps it, the student's export carries it,
   and the server would let a class teacher open the originals of handed-in work. But no student
   screen and no teacher screen displays it (`client/src/classroom/ReviewQueue.jsx` still has
   `MarkedOriginal = null`). An independent check caught that my first draft said "you can always
   see it" and "the app tells you" when over the limit. I changed the pages to say plainly that the
   app has no such screen yet. Also, exam answers never store an original, so today a teacher has
   no handed-in handwriting to see. When the viewer ships, the pages should be updated (a test
   reminds us).
6. **Guardian contact.** The pages say a guardian is asked for a name and an email address. The code
   also has a guardian phone (SMS) route, but it stays off unless an SMS provider is configured, and
   none is. If SMS is ever turned on, the pages must change first.
7. **The parent weekly report is not on the pages.** It is switched off in the code
   (`PRI_PARENT_REPORT`), so nothing happens. If it is switched on, the pages must change first.

## Plans: what you approved against what the code does

You approved the new plan on 18 November 2026. The code still ships the older packaging
(`ACTIVE_PACKAGING_ID = 'd19-d20'` in `client/src/engine/packaging.js`). The switch lands in
the next release. **The pages describe the code.** A test fails when the packaging changes, so the
pages cannot go stale without someone noticing.

| | You approved | Code today | On the pages |
|---|---|---|---|
| Free: practice questions | unlimited | 20 a day | 20 a day |
| Free: every difficulty, step checking | yes | yes | yes |
| Free: handwriting reads | 5 a day | 5 a day | 5 a day |
| Free: "Practise this" photos | 5 a day | 5 a day | 5 a day |
| Free: exam simulations | 1 a week | 1 every 30 days | 1 every 30 days |
| Premium: reads and photos | 100 and 100 a day | 25 and 25 a day | 25 and 25 a day |
| Premium: simulations | unlimited | no limit | no limit ("removes the practice and exam limits") |
| Premium price, Australia | A$9.99 / A$99 | A$9.99 / A$99 (`client/edition.config.mjs`) | A$9.99 / A$99 |

For the CTO:
- The second packaging in the file, `value-2026-11`, is not the plan you approved. It has free
  reads at **10** (you approved 5) and the exam window at **30 days** (you approved 1 a week).
  Fix it before the switch.
- Until the switch, the pages must not say "unlimited". When it lands, change the numbers in
  `docs/legal/terms.md`, its Hindi, and `docs/legal/au/terms.md`.
- India prices are not in the code. The store shows its own rupee price, and the India terms say
  so. I did not state a rupee price.
- Cancel, renew and refund rules are as coded in `server/platform/stripe.js` (Australia): cancel
  at the end of the paid period, deleting the account cancels at once, a full refund of the
  current period ends Premium at once. The Australian refund page already said this and did not
  need a change. The India refund page (store purchases) did not need a change either.

## India: privacy notice (English and Hindi)

**What changed:** the short version; the device list; the handwriting reading paragraph; four new
items (reading after a pause, stored original, AI help); the children paragraph (age); the list of
who else sees data; retention; rights; and three new sections ("Teachers and classes", "Safety
messages", "Product measurement and experiments").

| Promise on the page | Code file that keeps it |
|---|---|
| An original handwriting or photo is kept with each marked practice answer | `server/platform/originalWork.js` (`keepOriginal`), called from `server/platform/practice.js` |
| It is kept 2 years (730 days), then deleted automatically | `originalWork.js` (`ORIGINAL_RETENTION_MS`), `server/platform/housekeeping.js` |
| It is deleted with the account | `supabase/migrations/20261118010000_attempt_originals.sql` (`on delete cascade`) |
| It is in the data export | `server/platform/accounts.js` |
| Who can open it: only the student (via the export); a class teacher only for work handed in; **the app has no screen for it yet** | `originalWork.js` (the `handedIn` check), `server/platform/classroom.js` (`TEACHER_VISIBILITY`), `server/platform/accounts.js` |
| No admin screen or parent report opens it | `server/platform/admin.js`, `server/platform/parentReport.js` do not read it |
| Limit of 40 MB of handwriting and 24 MB of photos; past it the answer is still marked | `originalWork.js` (`ORIGINAL_QUOTA`, `keepOriginal`) |
| A "Practise this" photo is not kept | `server/platform/questionPhoto.js` never calls `keepOriginal` |
| The reader never sees the expected answer | `server/platform/handwritingProvider.js`, `server/platform/handwriting.js` |
| You confirm the reading and AI does not decide marks | `client/src/ink/confirmGate.js`; marking is `server/platform/practice.js` (the deterministic engine) |
| Reading starts by itself after a pause of about 1.3 seconds; turn it off in Settings → Reading my handwriting | `client/src/ink/InkAnswer.jsx`, `client/src/lib/autoRead.js`, `client/src/pages/Settings.jsx` |
| AI help sends the question, our solution, your working and what you type to OpenAI, never name, email or profile | `server/platform/tutor.js`, `server/platform/tutorProvider.js` |
| A reply may be cached 24 hours; help given is recorded 90 days | `tutor.js` (`TUTOR_CACHE_TTL_MS`), `server/platform/attemptSupport.js` |
| AI text is labelled as AI | `client/src/tutor/AiLabel.jsx`, `tutor.fromTutor` in `client/src/i18n/strings.en.js` |
| Learning records say "on your own" or "with help", decided by the server | `server/platform/attemptSupport.js` (`docs/product/attempt-support.md`) |
| The app asks your age and keeps only child or adult | `client/src/components/SignUpFlow.jsx`, `server/platform/guardianConsent.js`, `server/platform/otp.js` |
| A distress message gets a calm reply and Tele-MANAS 14416, no AI, nobody told, not stored | `server/platform/tutorSafety.js`, `server/platform/tutor.js` |
| Counts across accounts only, hidden under 10, admin plus second factor | `server/platform/valueFunnel.js`, `server/platform/admin.js` |
| No third-party analytics, ads or trackers | `server/platform/headers.js` (script-src 'self'), `client/package.json` has none |
| The tutor-policy experiment is built and off | `server/platform/helpPlan.js` (dark by default), `server/platform/experiments/*.json` |
| An invitation record is kept after deletion without leading to you | `supabase/migrations/20261001000000_platform_schema.sql` (`audit_log.actor_account_id ... on delete set null`), `server/platform/referral.js` |

The old promises are unchanged (90-day answer records, 5-year exams, 30 + 7 day child erasure,
guardian email confirmation).

## India: terms (English and Hindi)

**What changed:** the "what the app is" section (stored original, AI labelled, teachers, teacher
marks kept separate); the subscription section (today's free plan and what Premium changes); the
invitation trial (any earlier free trial blocks a second; only who invited whom is kept).

| Promise on the page | Code file that keeps it |
|---|---|
| Free plan numbers (20 a day, 5 and 5, 1 every 30 days); Premium 25 and 25 | `client/src/engine/packaging.js`, `server/platform/aiAllowance.js`, `server/platform/practiceAllowance.js`, `server/platform/exams.js` |
| Reads are counted over 24 hours; practice by the Indian calendar day | `aiAllowance.js` (`AI_WINDOW_MS`), `client/src/engine/practiceAllowance.js` |
| Every difficulty and step checking are free | `packaging.js` (`PLAN_PROMISES`) |
| Trial: 7 days, new account (under 7 days old), at most 5 friends per 30 days | `server/platform/referral.js` (`REFERRAL`) |
| One trial per person, no card, no charge, ends by itself, no cash value | `referral.js` (`billing_trial_claims`, a dated grant) |
| Web only | `referral.js` (`REFERRAL_WEB_ONLY`) |
| We never keep a friend's email or phone; only who invited whom | `referral.js` (`referral.code`, `referral.joined`) |
| A child needs guardian consent first | `server/platform/router.js` (`requireGuardianConsent` on `/referral`) |
| Store purchases; no purchase on the website | `server/platform/billingProviders.js`, `client/edition.config.mjs`, `tools/verify-deployment.mjs` |

The India refund page and the Grievances page are unchanged.

## Australia: privacy notice

**What changed:** everything in the India notice above, with Australian wording (information,
Kids Helpline 1800 55 1800, school year, topic), plus:
- **Children:** guardian consent for students **under 15** only. 15 and over need none. The page says we
  picked 15 because of how privacy guidance is commonly read and that we ask a lawyer whether it is right.
- **Retention list:** "four things" are kept after deletion (the invitation record is the new one).
- Unchanged: the Privacy Act and APP wording, "we aim to" follow the APPs, OpenAI, Stripe and Resend
  named as overseas recipients (APP 8), the OAIC complaint path, and the Children's Online
  Privacy Code paragraph ("we do not claim to comply").

| Promise on the page | Code file that keeps it |
|---|---|
| Guardian consent only under 15 | `server/platform/guardianConsent.js` (`AU_GUARDIAN_AGE = 15`) |
| Kids Helpline 1800 55 1800 | `server/platform/tutorSafety.js` |
| OpenAI reads handwriting and does AI help; Stripe takes payment; Resend sends email | `tutorProvider.js`, `handwritingProvider.js`, `server/platform/stripe.js`, `.env.production.example` |
| Teachers and teacher marks | `classroom.js`, `supabase/migrations/20261118000000_teacher_workspace.sql` (`teacher_marks`: who, when, append-only) |
| Everything in the India table, for the same files | as above |

## Australia: terms

**What changed:** the same "what the app is" and subscription changes (Sydney calendar day for
practice); the invitation trial (a student under 15 needs guardian approval first); and the
NESA paragraph.

- **NESA line (exact):** "Prithagoras is not affiliated with or endorsed by NESA, the NSW
  Education Standards Authority, or approved by any other examination authority." The terms also
  say the plain-language description beside each NESA outcome code is our own, not NESA's.
  The code keeps this: `client/src/progress/SyllabusBoard.jsx` shows each outcome's code with our
  own description, "never NESA's wording".
- Price, Stripe, cancel at the end of the period, and consumer-law wording are as before
  (`stripe.js`, `client/edition.config.mjs`).

## Australia: refund policy and contact

Unchanged. The refund policy already matched `stripe.js` and the prices. The contact page still
needs `{{CONTACT_EMAIL}}` from you.

## Questions only a lawyer can answer

1. **The Children's Online Privacy Code (due 10 December 2026).** Will it apply to us? What must
   change in sign-up, in how we describe handwriting and photos, and in the 2-year storage of a
   child's handwriting? The page says we do not claim to comply with it.
2. **India's DPDP Rules.** Is an email click from a guardian enough, or do we need verifiable
   parental consent before the date the children's rules apply? Is a "data fiduciary" outside
   India, serving Indian children, treated differently? Does keeping a child's pen strokes
   (position, time, pressure, tilt) need extra care? Are the cross-border transfers to OpenAI and
   Neon/Railway allowed as described?
3. **Consumer law, refunds and trials.** Is the Australian refund page right under the Australian
   Consumer Law? Is the Indian refund policy right under Indian consumer law? Is the 7-day invite
   trial (no card, no charge, one per person, ends by itself) described in a way that is not
   misleading in either country? Is rewarding a child with a free trial for inviting a friend
   allowed? Are our "no refund after use" rules fair?
4. **NESA codes.** Do we need permission, a licence or a notice to show NESA outcome codes with our
   own descriptions? Is the "not affiliated with or endorsed by NESA" line enough?
5. **Does the Privacy Act apply to us at all** (a small business exemption), and is "we aim to
   follow the APPs" the right wording?
6. **Overseas recipients (APP 8).** Is naming OpenAI, Stripe and Resend, and choosing them, enough?
7. **Kept handwriting.** Is 2 years a reasonable period for the stated purpose? Is it right that a
   class teacher sees an original only for work handed in? Do students and guardians need a
   clearer way to see or delete only the originals?
8. **The distress message.** We tell no one. Is that right, or do we owe a duty (for example to a
   guardian or school) when a child may be at risk? Is "not a crisis service" enough?
9. **Teacher access to children's work.** Is joining a class with a code enough for a teacher to
   see a child's handed-in work, and who must consent?
10. **"No third-party trackers".** Is this safe to say, given that Stripe, OpenAI, Apple and Google
    handle data on their own pages?
11. **Terms.** Each clause against unfair-contract-terms rules; the liability limit; New South
    Wales and New Delhi courts. The Australian terms say a parent must agree to the terms and to any
    purchase for anyone under 18, while sign-up asks for a guardian only under 15. Is that
    consistent?
12. **The Hindi.** The Hindi is a translation and needs a native-speaker review (decision D11).

## What I did not do

- I did not set `reviewed: true` anywhere, fill the owner sign-off, or claim any legal review.
- I did not change the banner, its switch or `client/src/pages/Legal.jsx`.
- I did not touch the store listings, the counsel question sheets' other sections, or hosting
  facts that the code cannot show.

Questions for counsel are also in `docs/legal/counsel/QUESTIONS-FOR-COUNSEL.md` and
`docs/legal/counsel/AU-QUESTIONS-FOR-COUNSEL.md`.
