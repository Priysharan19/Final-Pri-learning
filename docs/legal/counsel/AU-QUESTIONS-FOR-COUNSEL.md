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

## Facts the notices leave open (the four placeholders)

The Australian notices say only what the code and the repository show. Four facts are not in either, so
they are left as placeholders, and a notice with one unfilled shows as a template:

| Placeholder | What it must say | What engineering was told, and what the repository shows |
| --- | --- | --- |
| `{{AU_HOSTING_PROVIDER_AND_REGION}}` | Where the Australian server runs | Told: Railway, Singapore. The repository records no Australian service (`docs/operations/region-isolation-verification.md`: "The Prithagoras (Australia) deployment does not exist yet") |
| `{{AU_DATABASE_PROVIDER_AND_REGION}}` | Where the Australian database is held | Told: Neon Postgres, Sydney. The repository's plan names Supabase, Sydney (`ap-southeast-2`) |
| `{{AU_PAYMENT_PROCESSOR}}` | Who takes payment | Told: Stripe. The repository has no Stripe code, and Prithagoras sells through no provider (`client/edition.config.mjs`, `billing.providers` is empty; plan E5, H3) |
| `{{CONTACT_EMAIL}}` | The contact address | The address the Indian notices use; an agent session was prevented from writing it into a new file |

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
safe? Who should the legal operator be (an entity, an ABN)? Nothing in the notices claims an ABN or
GST registration.

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

The app does not ask for an age. A cloud account is a child's unless the person says they are 18 or
older, and a child's needs a parent or guardian's name and email; the guardian confirms by link or code.
The confirmation proves control of an inbox, not that the person is an adult or a guardian.

**Current text** · `docs/legal/au/privacy.md`

> When you create a cloud account it
> asks whether you are 18 or older, and unless you say you are, the account is
> treated as a child's.

**Current text** · `docs/legal/au/privacy.md`

> It shows that someone
> who can read that email inbox followed the link or entered the code. It does not
> show that they are an adult, or that they are your parent or guardian.

**Lives in** · `client/src/components/CloudAccountPanel.jsx` · `isAdult`
**Lives in** · `server/platform/childErasure.js` · `UNCONSENTED_CHILD_RETENTION_MS`
**Lives in** · `server/platform/guardianConsent.js` · `consentState`

**For counsel:** the OAIC's guidance on capacity to consent (including a presumption for those aged 15
and over) against this approach, which treats every account not declared adult as a child's; whether
that is adequate, or too strict to be practicable, for 15 to 17 year olds; whether an email
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

Prithagoras sells nothing today. The policy says so, states the Consumer Law rights, and names no refund
window of its own.

**Current text** · `docs/legal/au/refund-policy.md`

> Prithagoras Premium is not on sale at the date of this policy**, so there is
> nothing to cancel or refund today.

**Current text** · `docs/legal/au/refund-policy.md`

> Where GST applies to a
> purchase, the price you see includes it. This policy is not a statement that we
> are registered for GST

**Lives in** · `client/edition.config.mjs` · `providers: Object.freeze([])`

**For counsel:** the wording of the consumer-guarantee and remedy paragraph; GST on a digital service and
whether any statement about it is needed before registration; the processor's terms once chosen;
subscription and auto-renewal rules; whether the 48-hour and 3-business-day response times are
commitments we should make.

## 8. Recording the review

`docs/legal/au/review-status.json` is the one switch. Engineering will not set it. When a lawyer has
reviewed the English notices it records the reviewer, the qualification, the date, `en` as the language,
and where the sign-off is kept. A placeholder filled in never clears the banner.
