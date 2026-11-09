# Counsel pack — what to send, and what comes back

This directory is for the owner to send to a lawyer qualified in Indian law. Nothing in it is legal
advice, and nothing in it says a review has happened: `docs/legal/review-status.json` is
`reviewed: false`, and the app shows "Not yet reviewed by a lawyer" above every notice until a
person changes that.

## Send

1. `QUESTIONS-FOR-COUNSEL.md` — the questions only counsel can answer, each with the exact text the
   app shows today and where it lives in the code. Start here.
2. `COUNSEL-INFORMATION-PACK.md` — the background: the product, where data goes, what is collected,
   the guardian flow as built, the store policies, and all 35 questions.
3. The eight notices they refer to: `../privacy.md`, `../terms.md`, `../refund-policy.md`,
   `../grievance.md` and their Hindi twins (`*.hi.md`). English governs; the Hindi is a translation
   to be checked against it.

Export them from the same commit, and say which commit in the covering email, so counsel's answer
refers to text that can be found again. Do not send `.env` files, credentials, student data or
anything from a production database.

## What comes back

A written answer by section. The owner keeps it outside the repository. Engineering then changes the
notices (both languages), the guardian notice, the store disclosures and the code in one change,
and only after that does a person record the review in `docs/legal/review-status.json`: reviewer,
qualification, date, languages and where the sign-off is kept. `client/test/legal-pages-check.mjs`
refuses the flag without those fields or if a notice was edited after the review date. No agent
sets it.

## Open by design until counsel answers

- Who the legal operator is, and every name and address that follows from it. The App Store
  copyright line stays `{{OWNER_LEGAL_NAME}}` until then.
- The D17 prompt wording (the prompt is not built yet), the D18 period, whether D22's parent email
  may be switched on, and the D23 rights basis for past papers.
