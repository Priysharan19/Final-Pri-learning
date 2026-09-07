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
- Handwriting strokes are not uploaded by the shipped app.
- Telemetry is allow-listed and retained for 90 days
  (`server/platform/telemetry.js`).
- Password-protected profiles are encrypted at rest on the device; profiles
  without a password are not. Both limits are documented in
  `client/src/local/idb.js` and `client/src/local/auth.js`.
