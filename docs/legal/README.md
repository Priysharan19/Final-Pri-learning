# Legal pages

These four documents are **templates**, not legal advice, and the app renders
them with a banner saying so. Every `{{PLACEHOLDER}}` must be completed, and the
whole set reviewed by a lawyer qualified in Indian law, before the banner is
removed and the app is offered to the public.

| File | Route | Required by |
|---|---|---|
| `privacy.md` | `/privacy` | Apple App Store, Google Play, Razorpay onboarding, and India's Digital Personal Data Protection Act 2023 |
| `terms.md` | `/terms` | Apple App Store, Razorpay onboarding |
| `refund-policy.md` | `/refund-policy` | Razorpay onboarding; Apple handles its own refunds |
| `grievance.md` | `/grievance` | The DPDP Act's requirement to publish a grievance contact |

## The Hindi versions

Each notice has a sibling — `privacy.hi.md`, `terms.hi.md`,
`refund-policy.hi.md`, `grievance.hi.md` — because section 5(3) of the DPDP Act
gives a data principal the right to read the notice in English or in any
language of the Eighth Schedule, and this app ships a full Hindi interface. The
Legal page opens in the language the profile is already being read in and
offers a control to read either.

**The English governs.** Every Hindi document says so in Hindi, in its own
first paragraph, together with the fact that no lawyer has checked either
version. That paragraph is not decoration: `legal-pages-check.mjs` asserts it
verbatim in all four, above the first section, and the suite fails without it.
Nobody may be able to close the page believing they have read the operative
text when they have read a translation of it.

Both languages carry the **same placeholders**, so one fill serves both;
`legal-status.mjs` exits non-zero if they ever disagree. The suite also holds
the pair to the same sections and the same internal links, so a paragraph
added to one language and not the other is a build failure rather than a
notice that says different things depending on who is reading it.

The Hindi documents are loaded through `client/src/i18n/legalHindi.js`, behind
an `import()`, for the reason the Hindi string catalogue is: an English reader
does not download them.

## Completing them

Fill in every placeholder, in both languages — the same seven appear in each:

```
{{OWNER_LEGAL_NAME}}        the entity that will hold the data and take the money
{{OWNER_ADDRESS}}           its registered address
{{GRIEVANCE_OFFICER_NAME}}  a named person
{{GRIEVANCE_OFFICER_EMAIL}} a monitored mailbox
{{SUPPORT_EMAIL}}           where a customer writes about their subscription
{{JURISDICTION_CITY}}       whose courts the terms name
{{LAST_UPDATED}}            the date the filled version was published
```

`node tools/legal-status.mjs` lists which placeholders are still unfilled, in
which document and which language, and refuses to report a count at all while
the two languages disagree about what has to be filled.
`client/test/legal-pages-check.mjs` fails if a page is missing in either
language, if a route does not render one, if the two languages have drifted
apart, or if the "not yet reviewed" banner has been removed while placeholders
remain.

## What the code does, which the text must match

The privacy notice describes real behaviour, and these are the facts it rests
on. If the code changes, the notice is wrong until it is changed too.

- The learning engine runs on the device. Questions, handwriting recognition and
  marking need no network.
- A cloud account is optional. Without one, nothing leaves the device except
  files the person exports themselves.
- With an account, what syncs is listed in `client/src/platform/syncContract.js`.
- Handwriting strokes stay on the device. Only when a student switches on
  server reading is a picture rasterised from them (or a photo of paper
  working) sent through the server to the reading provider; the server keeps
  no copy, and `store: false` is not zero retention at the provider
  (`docs/privacy/data-retention.md` §4).
- Account deletion is immediate; what survives it, unlinked, is listed in
  `docs/privacy/data-retention.md` §2 and enforced by
  `server/test/account-lifecycle-journey-check.mjs`.
- Telemetry is allow-listed and retained for 90 days
  (`server/platform/telemetry.js`).
- Password-protected profiles are encrypted at rest on the device; profiles
  without a password are not. Both limits are documented in
  `client/src/local/idb.js` and `client/src/local/auth.js`.

## Launch checklist (status 2026-10-02 — `BLOCKED_EXTERNAL`, owner and counsel only)

Engineering cannot complete any line below: each needs a real legal entity, a named person, a
monitored mailbox or a qualified lawyer. Nothing here is filled in by code or by an agent. The
executable path is `docs/release/LAUNCH-RUNBOOK.md` §4; the gate that consumes it is
`client/test/legal-pages-check.mjs` (today: `LEGAL PAGES: PASS — 233/233 checks … while 38
placeholders remain`) together with `node tools/legal-status.mjs` (today: 7 placeholders across
4 notices in 2 languages, 8 documents).

| # | Action (owner / counsel) | Where | Evidence it produces | Consumed by |
|---|---|---|---|---|
| 1 | Decide the legal entity that holds the data and takes the money, and its registered address | `{{OWNER_LEGAL_NAME}}`, `{{OWNER_ADDRESS}}` in all 8 documents | `node tools/legal-status.mjs` no longer lists them | `legal-pages-check.mjs` (placeholder count falls in both languages together) |
| 2 | Appoint the grievance officer (a named person) and a monitored mailbox, as the DPDP Act requires to be published | `{{GRIEVANCE_OFFICER_NAME}}`, `{{GRIEVANCE_OFFICER_EMAIL}}` (`grievance.md`, `privacy.md`, both languages) | same | same; App Store / Play privacy contact |
| 3 | Open the customer support mailbox for subscription questions | `{{SUPPORT_EMAIL}}` | same | same; Razorpay onboarding (web billing is out of V1) and App Store review contact |
| 4 | Choose the jurisdiction whose courts the terms name | `{{JURISDICTION_CITY}}` (`terms.md`, `terms.hi.md`) | same | same |
| 5 | Have the English set reviewed by a lawyer qualified in Indian law (DPDP Act 2023 and its rules, Consumer Protection (E-Commerce) Rules, IT Rules grievance requirements); have the Hindi set checked against the English | review letter / sign-off kept outside the repository | written sign-off referenced in the launch record | `PRI_V1_RELEASE_SCOPE.md` §18 blocker #9; ADR-0001 "legal sign-off remains an external authority" |
| 6 | Confirm the privacy notice still matches the code's data path at the release SHA (cloud handwriting image and photo, working check, telemetry, deletion survivors) — the facts list above and `docs/privacy/data-retention.md` | `privacy.md` / `privacy.hi.md` | reviewer's confirmation in the launch record | blocker #10 (`PRI_V1_RELEASE_SCOPE.md` §18); `ios/PriLearning.swiftpm/Resources/PrivacyInfo.xcprivacy` must agree |
| 7 | Set the publication date of the filled version, in both languages | `{{LAST_UPDATED}}` | `node tools/legal-status.mjs` → 0 placeholders | `legal-pages-check.mjs` then expects the "not yet reviewed" banner to be gone; its pinned count line changes and must be updated in `.github/workflows/ci.yml` in the same PR |
| 8 | Publish the processor list named in ADR-0001 (Railway, Supabase, the model provider, the email provider) in the privacy notice's "Who else sees your data" if counsel requires named processors | `privacy.md` §"Who else sees your data" | counsel's instruction | blocker #9 |

Order matters only in one place: fill the placeholders (1–4, 7) **after** the review (5–6) has
settled the wording, so the lawyer reads the operative text once. Until every row has evidence,
the app keeps showing the banner and blocker #9 stays open. Hindi translation of counsel's
changes must land in the same PR as the English, or `legal-pages-check.mjs` fails on drift.
