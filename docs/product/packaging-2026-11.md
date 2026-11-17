# Packaging proposal: Free, Premium and School (November 2026)

**Status: PROPOSAL. It needs the owner's approval.** Until the owner approves it,
the code ships with today's packaging as the active one (owner defaults D19 and
D20). The proposal is already written into the code as a second packaging, so
approving it changes one line: `ACTIVE_PACKAGING_ID` in
`client/src/engine/packaging.js`. Prices and Stripe settings do not change in
this PR. Every price or Stripe change below is an **owner action**, written out
as steps in §7 and not carried out by any agent.

Risk: R4 (billing and entitlements). Branch `task/value-packaging`.

## 1. What we are trying to do

The owner's aim, in their words: an app that "will genuinely help people study
and help them improve too", and one "which they will want to pay for".

These two aims fit together only if:

- **Free is a real study tool every day.** A student who never pays still
  practises, gets their work checked, reads notes, retests what they got wrong
  and improves. A free plan that rations the learning loop hurts the students
  who most need it, and it does not earn trust.
- **Premium sells the exam edge and the volume.** It does not sell basic
  learning. A student pays for marks at stake, papers, readiness and more marked
  handwriting, because those are worth paying for in the months before an exam.
- **Every price, trial and cancellation is truthful** (Standard #42). There is
  no pressure, and no upsell during a consent, guardian, restriction, error,
  distress or exam moment.

## 2. The market today

Read from Leibniz's pricing page on 18 November 2026:

| | Leibniz Free | Leibniz Pro | Leibniz School |
|---|---|---|---|
| Price | $0 | A$9.99/month ("$2.49/week"); annual saves about $20 a year | Free for students through their school |
| Questions | 5 a day | Unlimited | — |
| AI evaluations | 5 a day | Unlimited | — |
| Difficulty levels | D1–D2 only | All (D1–D4) | — |
| Courses | Limited | All | — |
| Priorities, scaled-mark predictor | No | Yes | — |
| Hints, step-by-step solutions, progress, tasks by topic | Yes | Yes | Teacher dashboard and class analytics |
| Refund | 30-day money-back guarantee, cancel anytime | | |

Leibniz's free plan locks the harder difficulty levels. That cuts free students
off from exactly the questions that build exam readiness. **We will not do
that.** Every difficulty level is free on every packaging, and a test enforces
it (`PLAN_PROMISES.difficulties`).

This comparison is for the owner's decision only. No product copy names a
competitor or compares against one. The pricing page states our own facts.

## 3. The proposed packaging

### Free: the full study loop, every day

| | Today (D19 / D20, active) | Proposed (`value-2026-11`) |
|---|---|---|
| Practice questions | 20 a day | **No daily limit** |
| Difficulty levels | All | All |
| Typed answers checked by the deterministic engine | Yes, step by step where the edition has step feedback | Same |
| Marked handwriting reads (ink or a photo of working) | 5 a day | **10 a day** |
| "Practise this" question photos | 5 a day | **10 a day** |
| Notes and worked examples | Yes | Yes |
| Error log and spaced retests | Yes | Yes |
| Timed exam simulation | 1 every 30 days | 1 every 30 days |
| Papers in the usual board pattern | Yes (within the simulation allowance) | Same |

**Why a daily marked-handwriting allowance instead of a question cap:** typed
practice is checked by our own deterministic engine at almost no marginal cost,
so capping it rations learning to save nothing. Reading handwriting costs a
paid model call per read. That is the honest place for a daily limit, and it is
the volume a heavy pre-exam user will pay to lift. A student who reaches the
handwriting allowance can always type the answer and have it checked. That
path is never limited.

Compared with Leibniz Free (5 questions and 5 AI evaluations a day, D1–D2 only),
the proposed Free plan has unlimited questions at every level and double the
marked handwriting reads.

### Premium: the exam edge and the volume

| Capability | Server enforcement today |
|---|---|
| Marked handwriting and photo answers: up to 100 a day, per kind (proposed; 25 today) | `additional-ai-usage`, `server/platform/aiAllowance.js` |
| Unlimited exam simulations | `premium-exams`, `server/platform/exams.js` |
| Papers built around your weak topics, and targeted papers, with full marking | `premium-exams`, `exams.js` `entitlementRefusal` |
| Where the time went in each section of a paper | `premium-exams`, `exams.js` `withTimeReport` |
| The estimate of your mark, and your mistake patterns | `advanced-analytics`, `forecast.js`, `mistakeDna.js` |
| JEE Advanced track (Priyabhata) | `jee-advanced-content`, server question banks and papers |
| HSC 2027 priorities, with the marks at stake | **Pending:** hsc-forecast lane. It must gate on `advanced-analytics` at the server before it is listed. |
| The syllabus board's priority layer | **Pending:** syllabus-board lane. Same rule. |
| Exam readiness from real papers | **Pending:** hsc-forecast and exam-real lanes. Same rule. |
| The tutor's deeper help | **Pending:** tutor-policy lane (PR #996). Pri Explain is free in full today and is not sold. |

**Rule:** the pricing page lists a Premium row only when the server enforces it
(`client/test/paywall-honesty-check.mjs` §1b). The pending rows appear on the
page when their lanes land a server gate, not before. We never sell a feature
that the device alone decides, or one that does not exist yet.

Why 100 reads a day and not "unlimited": every read is a paid model call, and
the deployment-wide ceiling (D21: 120 an hour, 300 a day) protects the whole
service. Calling a capped allowance "unlimited" would be untrue. 100 a day is
more than a full paper of handwritten working plus a day's practice. The owner
can tune it with `PRI_AI_DAILY_PREMIUM_HANDWRITING` and
`PRI_AI_DAILY_PREMIUM_PHOTO` without a release. **The owner should raise the
D21 ceiling in step with paying users.**

### Price: unchanged

- Prithagoras (Australia): **A$9.99 a month or A$99 a year**, live in Stripe
  (`PRI_STRIPE_*` on prithagoras-production). This is price parity with
  Leibniz Pro, and the annual plan saves A$20.88 against twelve months. The
  pricing page shows "$9.99 a month or $99 a year (AUD)" from the edition
  table, and a test holds it equal to the AU terms and refund policy.
- Priyabhata (India): INR through the enabled providers. The price shown is the
  store's own (Apple, Google) or the server's display configuration
  (`PRI_DISPLAY_*`). No INR figure is a constant in the code.

### School: free for students

Students in a class whose school uses the teacher workspace get Premium free.
Teachers set work and see where their class is stuck. This depends on the
teacher-ws lane (`task/teacher-workspace`) adding a server-side school grant: an
entitlement source on `entitlement_support_grants` or a successor, decided by
the server and never by the device. Until that ships, the School column on the
pricing page says "Not available yet: the teacher workspace is still being
built". It does not promise the offer.

## 4. Trial or money-back guarantee: owner decision

**Recommendation: a 7-day free Premium trial that asks for no card**, once per
account. Stripe supports this simply:

- Checkout uses `payment_method_collection: if_required` together with
  `subscription_data.trial_period_days`.
- `trial_settings.end_behavior.missing_payment_method: cancel` makes a trial
  with no card on file end cleanly. It never becomes an unpaid invoice or a
  surprise charge.

This PR adds that behaviour behind `PRI_STRIPE_TRIAL_NO_CARD=1`, off by default.
One trial per account is already enforced (`billing_trial_claims`), and the
webhook already maps `trialing` and the trial's cancellation onto the
entitlement model.

Why a trial over a guarantee: a trial lets a student feel the exam edge before
any money moves. That suits under-18 users and their parents, and it does not
need a refund request to work. A money-back guarantee only helps someone who
has already paid, and it needs a refund process.

**Alternative: a 30-day money-back guarantee**, to match Leibniz. This changes
the AU refund policy (`docs/legal/au/refund-policy.md`) and the terms, so it
**needs the owner's legal review.** The present policy correctly preserves
Australian Consumer Law rights, but it promises no guarantee. Adding one is a
contractual promise and must be honoured through Stripe refunds
(`charge.refunded` already revokes the current period's Premium).

The paywall copy never says "free trial" or "guarantee" until the owner turns
one on (`paywall-honesty-check`). The account panel already states a configured
trial (`cloud.pricingSummaryTrial`) from `PRI_DISPLAY_TRIAL_DAYS`.

## 5. When an upgrade is offered, and when it never is

Upgrade offers appear only at natural value moments (`UPGRADE_MOMENTS`,
`client/src/paywall/moments.js`):

- today's marked handwriting allowance is used (the reader's own "allowance"
  block);
- today's practice cap is used (today's packaging only);
- the free exam simulation for this window is used;
- the student opens priorities or targeted papers;
- a paper has just been completed (where the time went);
- JEE Advanced (Priyabhata) and the estimate or mistake patterns (Insights).

Each offer says what Premium adds at that moment, the edition's price where it
has one, and "Cancel anytime", in one line with a link to the Premium screen.
It is a sentence, not a modal. It has no timer, no countdown, no scarcity, no
pre-selected plan and no guilt.

An offer is **never** shown during sign-up consent, a guardian flow, an error,
an account restriction, a distress response or an exam in progress
(`FORBIDDEN_UPGRADE_CONTEXTS`). It is never shown to a Premium account, or where
nothing is on sale. `client/test/value-packaging-check.mjs` tests every
moment × every forbidden context, and fails if a sign-up, guardian, error, exam
room, desk or placement screen ever links to Premium.

**Cancelling is as easy as subscribing.** The cancel button sits next to the
subscribe buttons in the same account panel. After a cancellation succeeds, the
student may tap one optional reason from a closed set (price, not using it
enough, exam over, missing something, something else). The reason is never
required and changes nothing about the cancellation.

## 6. Measurement

See `docs/product/value-metrics.md`. In brief: the measurement is first-party,
aggregate only, uses no third-party trackers, is safe for under-15s, and is
read from rows the server already keeps. It covers activation (first checked
answer), D1, D7 and D30 return, trial → paid, and cancel reasons, in an
admin-only readout (`GET /v1/admin/funnel`, admin role plus second factor, cells
under 10 suppressed). The learning outcome that matters, delayed independent
success, comes from the tutor-policy experiment harness (PR #996). Conversion is
never read as learning, and students never see engagement mechanics.

## 7. Owner actions (not executed by any agent)

**A. Approve the packaging.** Tell the CTO session "approve value-2026-11",
optionally with changed figures. An agent then opens a one-line PR setting
`ACTIVE_PACKAGING_ID = 'value-2026-11'` (with any figure changes), updates the
pins in `paywall-honesty-check`, and updates any legal or marketing text that
quotes "20 questions a day". When that merges:

1. Free practice is uncapped. The server stops refusing practice issues (an
   explicit `PRI_FREE_PRACTICE_PER_DAY` on a deployment still caps it; remove
   that variable if it is set).
2. Reads become 10 free and 100 Premium per kind, unless overridden by
   `PRI_AI_DAILY_*`.
3. Raise the D21 paid-call ceiling (`PRI_PAID_CALLS_PER_HOUR`,
   `PRI_PAID_CALLS_PER_DAY`) and the OpenAI monthly hard limit to match the
   expected Premium volume.

**B. If you choose the 7-day no-card trial (Prithagoras):**

1. In Railway → prithagoras-production → Variables, set
   `PRI_DISPLAY_TRIAL_DAYS=7` and `PRI_STRIPE_TRIAL_NO_CARD=1`, then redeploy.
2. In the Stripe Dashboard (live mode), you do not need to change the Price
   objects. The trial is set per Checkout Session by the server.
3. Make one test-mode purchase first. Check that checkout asks for no card, that
   Premium shows as trialing, and that the trial ends with a cancelled
   subscription when no card is added.
4. Update `docs/legal/au/refund-policy.md` and the terms to describe the trial
   (length, no card, what happens at the end), then get legal review.

**C. If you choose the 30-day money-back guarantee instead:**

1. Legal review of new wording in `docs/legal/au/refund-policy.md` and the
   terms.
2. Decide how a request is made (the contact address already in the policy)
   and who issues the Stripe refund (Stripe Dashboard → Payments → Refund).
3. Only after that, allow the words "money-back guarantee" in the paywall
   copy, through a reviewed change to `paywall-honesty-check`.

**D. Prices** stay at A$9.99 and A$99. If they ever change: create new Stripe
Price objects (Stripe prices are immutable), set `PRI_STRIPE_MONTHLY_PRICE_ID`
and `PRI_STRIPE_ANNUAL_PRICE_ID`, update `commerce.listPrice` in
`client/edition.config.mjs`, and update the AU terms and refund policy in the
same PR. `value-packaging-check` fails if the code and the legal documents
disagree.

**E. School:** approve "free for students through a school using the teacher
workspace" as the School offer, so the teacher-ws lane can build the server
grant.

## 8. Decisions needed from the owner

1. **Trial or guarantee:** a 7-day no-card trial (recommended), or a 30-day
   money-back guarantee (needs legal review), or neither.
2. **Final free allowances:** uncapped practice and 10 handwriting reads plus
   10 question photos a day (proposed), or other figures.
3. **Premium read allowance:** 100 a day per kind (proposed), and the matching
   D21 ceiling.
4. **School offer:** free Premium for students in a teacher-workspace class.

## 9. What this PR changes, and what it leaves as it is

Changed, behind the config, with no change in what a student is allowed today:

- One packaging config (`client/src/engine/packaging.js`), read by the server
  and the client for every allowance.
- Upgrade offers only at value moments, through one rule (`moments.js`), with
  tests for every forbidden context.
- The Premium screen as a pricing page (Free / Premium / School, the edition's
  true differentiators, the edition's price, "cancel anytime"), in both
  editions.
- The web Premium screen no longer tells a Prithagoras student that Premium is
  "bought in the app". Where a web provider is configured, it points to the
  account panel, where subscribing and cancelling sit side by side.
- An optional one-tap cancel reason, and an admin-only aggregate funnel.
- The no-card trial switch for Stripe (off).

Unchanged: prices, Stripe configuration, the free caps students meet today, and
every server enforcement point.
