# Questions only Australian counsel can answer — Prithagoras (Pri Learning's Australian edition)

**Prepared:** 18 November 2026 by the engineering team (an AI coding agent working for the owner).
**This is not legal advice and records no legal conclusion.** Nobody qualified in Australian law has
reviewed any Prithagoras notice yet.

Review switch at this commit: `reviewed: false` (`docs/legal/au/review-status.json`). It is separate
from the Indian switch (`docs/legal/review-status.json`): a review of one says nothing about the other.

This is the Australian counterpart of `QUESTIONS-FOR-COUNSEL.md` (which is for Indian counsel and
covers the Indian notices only). It is the short list to send to an Australian lawyer, with the **exact
current text** of the notices in `docs/legal/au/` and where each practice lives in the code. The
Indian sheet's background (`COUNSEL-INFORMATION-PACK.md`) describes the product and the guardian flow
as built and applies here too, except where it names India.

`client/test/legal-pages-au-check.mjs` (run by `npm run test:legal`) fails if any quoted text below is
no longer the text in the file it names, or if a location below no longer exists.

## How to answer

1. Answer in writing, by section, and say which text you approve, which you correct (give the wording),
   and which you reject.
2. The owner records the answer outside the repository; engineering changes the code and the notices in
   one change.
3. Only then does a person set `docs/legal/au/review-status.json` to `reviewed: true`, with the
   reviewer, the qualification, the date, the languages and where the sign-off is kept. The test
   refuses the flag without those fields or if a notice is edited after the review date. Nothing in the
   code or any agent sets it.

## Facts the notices now state (filled 2026-11-18, formerly placeholders)

The Australian notices say only what the code and the repository show. Three facts were not in either, so
they were placeholders; the owner supplied them, verified from the live infrastructure on 2026-11-18, and they are now stated plainly:

| Placeholder | What it must say | What engineering was told, and what the repository shows |
| --- | --- | --- |
| Hosting (was `AU_HOSTING_PROVIDER_AND_REGION`) | Where the Australian server runs | Railway, Singapore (`asia-southeast1`). Not recorded in the repository (`docs/operations/region-isolation-verification.md`: "The Prithagoras (Australia) deployment does not exist yet") |
| Database (was `AU_DATABASE_PROVIDER_AND_REGION`) | Where the Australian database is held | Neon (AWS), Sydney (`ap-southeast-2`). The repository's older plan named Supabase, Sydney; the live infrastructure is Neon |
| Payment processor (no longer a placeholder) | Who takes payment | Stripe: `client/edition.config.mjs` lists `stripe` for Prithagoras, in AUD, and `server/platform/stripe.js` hosts Checkout on Stripe. The prices (A$9.99 a month, A$99 a year) are set in Stripe and `PRI_DISPLAY_*`, not in code: the owner must keep the notices and Stripe in step |
| Contact email (was `CONTACT_EMAIL`) | The contact address | `prilearning19@gmail.com`, owner-supplied, now used in both editions' notices |

Counsel should be told which of these are real at the date they review. The notices must not name a
provider or a region that is not the deployment.

## 1. Does the Privacy Act apply to the operator? [operator]

The operator is an individual, at a home address in Australia. A small business operator (turnover
of $3 million or less) is generally outside the Privacy Act unless an exception applies. The notice says
the operator aims to follow the APPs and does not say the Act binds it.

**Current text** · `docs/legal/au/privacy.md`

> We aim to handle your information in line with the APPs; how
> far the Act applies to a business of our size is a question for a lawyer

**For counsel:** does the Act apply (turnover, handling of children's information, trading in personal
information)? Should the operator opt in, and is "aim to handle in line with the APPs" accurate and
safe? Who should the legal operator be (the sole trader, or an entity)? The notices name "Priysharan Tripathi trading as Pri Learning, ABN 20 192 090 394" and claim no GST registration.

## 2. Sending information overseas (APP 8) [overseas]

**Current text** · `docs/legal/au/privacy.md`

> is a company based in the United States. It receives the images,
> photos and (if you turn it on) working described above, so that they can be
> read. We do not control where it processes them.

**Current text** · `docs/legal/au/privacy.md`

> We do not currently take steps beyond choosing these providers and describing
> them to you; whether more is needed to meet APP 8 is one of the questions we have
> for a lawyer.

**Lives in** · `server/platform/handwritingProvider.js` · `https://api.openai.com/v1/responses`
**Lives in** · `.env.production.example` · `PRI_AUTH_EMAIL_PROVIDER=resend`

**For counsel:** is this disclosure enough for APP 1.4 and APP 8? What contractual steps are needed with
OpenAI, Resend and the hosting and database providers? Is "the country where it processes them" required
where practicable, and what do we say when we cannot confirm it? Should the notice say "recipient is
accountable" (APP 8.1 and s 16C) or rely on consent (APP 8.2(b))?

## 3. Children and students [children]

The app asks an age at sign-up (11 to 17, or 18 or older) and keeps only the decision it makes from it,
not the age. In Prithagoras a student who is under 15, or who gives no age, is a child's account: it needs
a parent or guardian's name and email, and the guardian confirms by link or code. A student of 15 or older
needs no guardian. The confirmation proves control of an inbox, not that the person is an adult or a
guardian.

**Current text** · `docs/legal/au/privacy.md`

> A student under 15 needs a
> parent or guardian to confirm the account. A student who is 15 or older does
> not, and nor does an adult.

**Current text** · `docs/legal/au/privacy.md`

> It shows that someone
> who can read that email inbox followed the link or entered the code. It does not
> show that they are an adult, or that they are your parent or guardian.

**Lives in** · `server/platform/guardianConsent.js` · `AU_GUARDIAN_AGE = 15`
**Lives in** · `server/platform/childErasure.js` · `UNCONSENTED_CHILD_RETENTION_MS`
**Lives in** · `server/platform/guardianConsent.js` · `consentState`

**For counsel:** the OAIC's guidance on capacity to consent (including a presumption for those aged 15
and over) against this approach, which sets the line at 15 on the age a student states and treats a
missing age as a child; whether 15 is the right line, and whether relying on a stated age is adequate; whether an email
confirmation is acceptable under the Act for a minor's account; the 30-day closure and 7-day erasure
rule for an unconfirmed account; the guardian's erasure route.

## 4. The Children's Online Privacy Code [code]

**Current text** · `docs/legal/au/privacy.md`

> At
> the date of this notice we have not treated any such Code as being in force, and
> we do not claim to comply with one.

**For counsel:** the Code's status at the date you review (the notice says only that the OAIC may issue one), when it will apply, and what it will require of an app used mainly by minors. The notice
must not claim compliance until counsel says so.

## 5. Access, correction, complaints and breach [rights]

**Current text** · `docs/legal/au/privacy.md`

> We aim to acknowledge your message within 48 hours and
> answer within 30 days.

**Current text** · `docs/legal/au/privacy.md`

> If we discover a data breach affecting
> your information that is likely to cause serious harm, we will tell you, and the
> OAIC where the Privacy Act requires it.

**Lives in** · `docs/legal/au/contact.md` · `We aim to acknowledge your message within **48 hours**`

**For counsel:** are 48 hours and 30 days acceptable commitments (they were carried over from the Indian
notice, not chosen for Australia)? Is the OAIC the right escalation, and is the Notifiable Data Breaches
statement accurate for this operator? The Spam Act 2003 and the statutory tort for serious invasions of
privacy: do either bear on the verification and guardian emails?

## 6. Terms: Australian Consumer Law, liability, jurisdiction [terms]

**Current text** · `docs/legal/au/terms.md`

> Our services come with guarantees that cannot be excluded under the Australian
> Consumer Law.

**Current text** · `docs/legal/au/terms.md`

> These terms are governed by the laws of New South Wales, Australia. You and we
> submit to the non-exclusive jurisdiction of the courts of New South Wales.

**Current text** · `docs/legal/au/terms.md`

> Marking is of the final answer only.

**Lives in** · `server/platform/editionMarking.js` · `UNCERTIFIED_EDITIONS`

**For counsel:** each clause against the unfair contract terms regime for consumer contracts; the
limitation of liability; whether non-exclusive NSW jurisdiction is right; whether "not endorsed by NESA"
and the references to NSW syllabuses raise any copyright or trade mark question (the research file
`docs/research/NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md` §5.7 records NESA's licence terms and asks
this).

## 7. Refunds, GST and the payment processor [refunds]

Prithagoras sells Premium through Stripe (a hosted Checkout). The policy states the prices, the cancellation rule (at the period end), the Consumer Law rights, and names no refund window of its own; a full refund of the current period ends Premium at once.

**Current text** · `docs/legal/au/refund-policy.md`

> Premium is **A$9.99 a month** or **A$99 a year**, in Australian dollars (AUD).

**Current text** · `docs/legal/au/refund-policy.md`

> Where GST applies to a
> purchase, the price you see includes it. This policy is not a statement that we
> are registered for GST

**Lives in** · `client/edition.config.mjs` · `providers: Object.freeze(['stripe'])`

**For counsel:** the wording of the consumer-guarantee and remedy paragraph; GST on a digital service and
whether any statement about it is needed before registration; Stripe's terms and its overseas processing (APP 8);
subscription and auto-renewal rules; whether the 48-hour and 3-business-day response times are
commitments we should make.

## 8. Recording the review

`docs/legal/au/review-status.json` is the one switch. Engineering will not set it. When a lawyer has
reviewed the English notices it records the reviewer, the qualification, the date, `en` as the language,
and where the sign-off is kept. A placeholder filled in never clears the banner.
