# Value metrics: definitions

These are the product funnel and the learning outcome that the packaging
proposal (`docs/product/packaging-2026-11.md`) is judged by. They sit alongside
`docs/product/progress-metrics.md`, which defines what a student sees about
their own progress.

## Principles

- **First-party only.** Every figure is computed from rows our server already
  keeps for its own work: accounts, server-checked attempts, billing records and
  the audit log. There are no third-party trackers, no analytics SDK, no device
  fingerprint and no new client event.
- **Aggregate only.** The readout returns counts and rates over many accounts.
  It never returns an account id, email, name or per-person timestamp.
- **Small cells are suppressed.** Any count from 1 to 9 is returned as `null`. A
  rate is returned only when its numerator, its denominator and their difference
  are each at least 10 (k = 10). This protects under-15 users and small cohorts.
- **Admin only.** The readout is `GET /v1/admin/funnel?days=7|30|90`. It needs
  the admin role and a verified second factor, as every admin route does.
- **Students see none of it.** No streak pressure, no "others are paying", no
  engagement score. Measurement never changes what a student sees.
- **Conversion is not learning.** A rise in trials or retention is not evidence
  that students learn more. The learning outcome below is read with the funnel,
  and it is the one that counts.

## Funnel (server/platform/valueFunnel.js)

The window is the last 7, 30 or 90 days (30 by default), in server time.

| Metric | Definition |
|---|---|
| Cohort | Student accounts created in the window and not deleted. |
| Activation | Of the cohort, accounts with at least one **server-checked answer**: a `learning_events` row of kind `graded-attempt` written by the server grader. This is the first time the product did its job for that student. |
| D1, D7, D30 return | Of activated cohort accounts whose first checked answer is at least N days old (the "eligible" accounts), those with another checked answer **N or more days after the first** ("returned on or after day N"). This counts a return to learning, not a return to open the app. |
| Trial started | Trials claimed in the window (`billing_trial_claims`, one per account). |
| Trial → paid | Of those, accounts with a payment of more than zero captured after the claim (`billing_payments`). |
| Cancellations | Student-requested cancellations in the window (`billing_subscriptions.cancel_reason = 'user'`). |
| Cancel reasons | The optional one-tap reasons given after cancelling (`audit_log` action `billing.cancel-feedback`): `price`, `notUsing`, `examDone`, `missing`, `other`. There is no free text. Only the first reason per subscription is kept, and only from an account that cancelled in the last 24 hours. |

`examDone` is a good outcome, not churn to fight. A student who finished their
exam and cancelled was served well.

## The learning outcome that matters

**Delayed independent success** is the primary outcome of the tutor-policy
experiment harness (PR #996, `server/platform/experimentReadout.js`,
`docs/product/tutor-policy.md`). That harness owns its definition: the delay,
what counts as independent (no help on the later attempt), the comparison arms
and the statistics (Wilson intervals, Newcombe differences and the
sample-ratio check). This readout does not compute it again. It names where it
lives so that conversion and learning are always read together.

Following `docs/research/EXPERIMENTATION_REPRODUCIBILITY_STATISTICAL_GOVERNANCE_V7.md`:

- No packaging change is called a learning improvement unless the delayed
  independent success readout shows it, under that harness's preregistered
  rules.
- No literature effect is turned into a target or a claim.
- A packaging experiment (for example, the trial against the guarantee) is
  run only through the same harness, with its own preregistration. It is never
  done by switching cohorts by hand.

## What is not measured

We do not measure the following: time in app as a goal, notification opens,
streaks, paywall impressions per student, or any per-student "propensity to
pay". A paywall view is not logged per person. If a paywall-to-purchase rate is
ever needed, it must be an aggregate counter with no account attached, added
through a reviewed change to this document.
