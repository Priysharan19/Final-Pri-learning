# Prithagoras legal notices: a one-page summary for the owner

**Updated 18 November 2026.** The fuller, page-by-page summary, with the code file behind every promise, is `owner-review/LEGAL-REVIEW-2026-11-18.md`. Where this older page differs from it, that one is right.

**Not legal advice, and not a lawyer's review.** This is what the four notices in `docs/legal/au/` say and
commit you to, in plain English, so you can read them with the right questions in mind. The app shows
"not yet reviewed by a lawyer" above every notice, and only a lawyer's review clears it.

## What each notice says

- **Privacy.** You are the person responsible. It describes what the app collects (email, name, answers,
  handwriting pictures, the original handwriting or photo kept with each marked practice answer, a guardian's details for students under 15), why, and who else sees it: **OpenAI** (reads
  handwriting and photos, only after a one-time yes from the student) and **Resend** (sends email). It says
  the picture sent for reading is not kept (OpenAI may hold a copy briefly, as the notice says), but the original handwriting or photo of a marked practice answer is kept for 2 years and then deleted, answer records are kept 90 days and exam records up to five years, and
  deletion is immediate. It lists overseas recipients (APP 8), explains access, correction and deletion,
  and says complaints go to you first and then to the **OAIC**. It says the OAIC's Children's Online
  Privacy Code is still being developed, and that you do **not** claim to comply with it.
- **Terms.** Australian law and the NSW courts (non-exclusive). Marking is of the **final answer only**. Prithagoras
  is not affiliated with or endorsed by NESA, and is not an official HSC resource, and it does not predict an HSC mark, band or ATAR.
  Consumer-law guarantees cannot be excluded. Premium is described as a subscription at **A$9.99 a month or A$99 a year**, paid on a Stripe page.
- **Refunds.** Price, Stripe as processor (we never see a card number), cancelling in the app (Premium runs to the end
  of the paid period), and Australian Consumer Law rights apply; a full refund of the current period ends Premium at once; there is no "no refunds" wording, prices are in AUD with GST included where it applies, and the page
  does **not** say you are registered for GST.
- **Contact.** Where to write, a reply within 48 hours and an answer within 30 days, then the OAIC (privacy)
  or NSW Fair Trading (purchases). This replaces the Indian Grievance Officer page.

## What it commits you to

- Aiming to acknowledge a message in **48 hours** and answer in **30 days**, and to reply to a refund request in **3 business days** (aims, not guarantees).
  These were carried over from the Indian notices. Confirm you can keep them.
- Telling people (and the OAIC where the law requires) about a serious data breach.
- Erasing an under-15's account that no guardian confirmed after 30 days (plus 7), and keeping records only for
  the periods stated. Each of these is enforced by code and checked by a test.
- Keeping the prices in the notices equal to the prices set in Stripe (they are not in the code), and keeping the cancel button working: the notice promises both.

## Three blanks you must fill before this is live

The notices leave three facts as `{{PLACEHOLDERS}}`, because the code cannot show them. Until they are filled,
the page shows "Template". Please confirm the real answers: where the Australian **server** runs, where the
**database** is held (the brief said Neon, Sydney; the repository's plan says Supabase, Sydney), the and the **contact email**. Stripe is now named in the notices (the code sells through Stripe only).

## The five points most worth a lawyer's look

1. **Does the Privacy Act apply to you at all?** A small business with turnover under $3 million is often
   exempt. The notice says you "aim to" follow the APPs, not that you are bound. Is that wording right, and
   should you opt in or form a company?
2. **Overseas disclosure (APP 8).** Is the OpenAI and Resend wording enough, and what contract steps are
   needed? The notice admits you take no steps beyond choosing providers.
3. **Children.** A student who says they are under 15 is treated as a child, and an email click from a guardian is
   the confirmation, which does not prove they are the guardian. Is 15 the right line, is that adequate, and what
   changes once the Children's Online Privacy Code lands?
4. **Terms and consumer law.** Each clause against the unfair-contract-terms rules, the liability limit, and
   whether "not endorsed by NESA" and the references to NSW syllabuses raise any copyright or trade mark issue.
5. **Refunds, GST and the processor.** The wording of the consumer-guarantee paragraph, GST on a digital service
   before you are registered, and subscription rules once Premium is on sale.

Full question list with quotes: `docs/legal/counsel/AU-QUESTIONS-FOR-COUNSEL.md`.

## Your sign-off

`docs/legal/au/review-status.json` has an `ownerSignoff` block for **your** approval ("business owner, not a
lawyer"). Recording it **does not remove the "not yet reviewed by a lawyer" banner**; only a lawyer's review
(`reviewed`) does. Nothing in the code or any agent fills either in.
