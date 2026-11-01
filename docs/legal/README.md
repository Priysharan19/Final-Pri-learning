# Legal pages

Five pages ship inside the app and are rendered by `client/src/pages/Legal.jsx`
from the files in this directory, so there is one copy of each and it cannot
drift from the repository. **No lawyer has reviewed any of them.** The app says
so above every notice, in the reader's language, and will stop saying so only
when a person records a lawyer's review in `review-status.json` (below).

| File | Route | Required by |
|---|---|---|
| `privacy.md` | `/privacy` | Apple App Store, Google Play, and India's Digital Personal Data Protection Act 2023 |
| `terms.md` | `/terms` | Apple App Store, Google Play |
| `refund-policy.md` | `/refund-policy` | Google Play and Apple handle their own refunds; the page says what Pri itself does and where to ask |
| `grievance.md` | `/grievance` | The DPDP Act's requirement to publish a grievance contact |
| `third-party/NOTICES.md` | `/third-party-notices` | The licences of the open-source software the app ships; **generated**, see below |

The counsel pack (`counsel/COUNSEL-INFORMATION-PACK.md`) is not a public page.
It sits in a subdirectory because `tools/legal-status.mjs` treats every
Markdown file directly in this directory as a public notice that must have a
Hindi twin.

## Status, 2 November 2026

- Every placeholder was filled on 19 October 2026 (owner's name and address,
  grievance officer, support mailbox, jurisdiction New Delhi) and
  `node tools/legal-status.mjs` reports none left.
- The notices were corrected against the code on 2 November 2026: store
  purchases on iPhone, iPad and Android instead of website purchases; grievance
  timing without a claim about what the Act "allows"; the DPDP commencement
  stated as an expectation with its basis; no claim to "follow" the Act; the
  inline counsel-review note removed from the student pages; crash reports,
  the 90-day answer record, the five-year exam record and the 30-day erasure of
  an unconfirmed child account disclosed; SMS and the on-device handwriting
  model no longer described, because neither ships.
- **Not reviewed by a lawyer.** `review-status.json` is `reviewed: false`.
  The questions for counsel, operator first, are in the counsel pack §11.

## The review switch

`review-status.json` is the one fact behind the "not yet reviewed by a lawyer"
banner. Until 1 November 2026 the banner was tied to placeholders being left in
the documents, so filling them removed the banner although nobody had reviewed
anything. Now:

- `Legal.jsx` shows the banner whenever `reviewed` is not exactly `true`.
- `client/test/legal-pages-check.mjs` refuses `reviewed: true` unless
  `reviewer`, `qualification` (in Indian law), `reviewedOn` (an ISO date that
  has happened), `languages` (`en` and `hi`) and `evidence` (where the sign-off
  is kept, outside the repository) are all filled; refuses it if any English
  notice's "Last updated" is later than `reviewedOn`, so an edit after the
  review reopens it; and requires the "no advocate has checked" sentence to be
  removed from the Hindi notices, and the "has not yet been reviewed by a
  lawyer" sentence from the English, in the same change.
- While `reviewed` is false the same suite requires those sentences to be
  present, in both languages, in every notice.
- A document that still contains a `{{PLACEHOLDER}}` gets a separate template
  banner, whatever the switch says.

Nothing in the code and no agent may set the switch. The person who does
should be able to point at the lawyer's written sign-off.

## The Hindi versions

Each notice has a sibling — `privacy.hi.md`, `terms.hi.md`,
`refund-policy.hi.md`, `grievance.hi.md` — because section 5(3) of the DPDP Act
gives a data principal the right to read the notice in English or in any
language of the Eighth Schedule, and this app ships a full Hindi interface. The
Legal page opens in the language the profile is already being read in and
offers a control to read either.

**The English governs.** Every Hindi document says so in Hindi, in its own
first paragraph, together with the fact that no lawyer has checked either
version. `legal-pages-check.mjs` asserts both sentences verbatim in all four,
above the first section, and the suite fails without them. Nobody may be able
to close the page believing they have read the operative text when they have
read a translation of it.

Both languages carry the **same placeholders**, the same sections and the same
internal links, so a paragraph added to one language and not the other is a
build failure rather than a notice that says different things depending on who
is reading it. The Hindi documents are loaded through
`client/src/i18n/legalHindi.js`, behind an `import()`, for the reason the Hindi
string catalogue is: an English reader does not download them.

The third-party notices are not translated: licence texts are reproduced as
their authors published them, and the page says so in both languages.

## Third-party notices

`docs/legal/third-party/NOTICES.md` is written by
`node tools/third-party-notices.mjs` (`npm run legal:notices`) from
`client/package-lock.json` (every production package, with the licence text
found in its installed copy) and `android/gradle/libs.versions.toml` (the
Android app's runtime libraries, with their publishers' licences). The iPhone
and iPad app uses Apple's own frameworks only. Server dependencies are not
distributed and are not listed.

`npm run test:legal` runs the generator's `--check`, so a dependency change
without a regenerated page fails CI. The page is reached by `import()` from
`Legal.jsx` only when `/third-party-notices` is opened.

## What the code does, which the text must match

The privacy notice describes real behaviour, and these are the facts it rests
on. If the code changes, the notice is wrong until it is changed too.

- Grading is online-only and server-authoritative (ADR-0001). An account and a
  connection are needed for any answer to be marked; signed out or offline the
  work waits on the device. The deterministic engine on the server decides every
  mark; the copy on the device only displays notation and old results.
- Handwriting strokes stay on the device. A picture rasterised from them, or a
  photo of paper working, is sent through the server to OpenAI to be read. That
  is on by default for a signed-in account, switchable off in Settings, off for
  an under-18 account until a guardian confirms, and never runs without an
  account (`client/src/ink/cloudReader.js`). The request is answer-blind
  (`FORBIDDEN_FIELDS` in `server/platform/handwriting.js`). `store: false` is
  not zero retention at the provider (`docs/privacy/data-retention.md` §4).
- The transcription and any correction live 90 days with the answer's receipt
  (`server/platform/practice.js` `MAX_AGE`); exam records up to five years
  (`server/platform/exams.js` `RECORD_TTL`); telemetry and coded crash reports
  90 days (`server/platform/telemetry.js`). All are deleted with the account.
- Account deletion is immediate; what survives it, unlinked, is listed in
  `docs/privacy/data-retention.md` §2 and enforced by
  `server/test/account-lifecycle-journey-check.mjs`. It is available in-app for
  every sign-in method and, for someone without the app, at
  `/account/delete-request`.
- Guardian confirmation is by email link or email code
  (`server/platform/guardianConsent.js`, `otp.js`); it is recorded as
  `guardian-email-confirmation` and is not verifiable parental consent. SMS is
  off at launch (owner decision D3): the sign-up flow shows the SMS option only
  when the server reports `channels.sms: true`, which needs `PRI_SMS_PROVIDER`.
- The 30-day erasure of an unconfirmed or withdrawn child account, and a
  guardian's erasure request without the child's login, are owner default D18
  and are being built in the accounts stream; the notice promises them from
  2 November 2026 and the counsel pack records the gap.
- Password-protected profiles are encrypted at rest on the device; profiles
  without a password are not (`client/src/local/idb.js`, `client/src/local/auth.js`).
- Subscriptions are sold only through the App Store and Google Play
  (`PRI_V1_RELEASE_SCOPE.md` §12); Razorpay is dormant and refused to native
  clients. Deleting an account does not cancel a store subscription.

## Launch checklist (owner and counsel only)

Engineering cannot complete any line below. The gate that consumes them is
`client/test/legal-pages-check.mjs` together with `node tools/legal-status.mjs`.

| # | Action (owner / counsel) | Status | Evidence it produces |
|---|---|---|---|
| 1 | Decide the legal entity that holds the data and takes the money, and its registered address | Filled 19 Oct 2026 with the owner as an individual at a home address; **operator decision still open** (counsel pack §11 Q1–Q4) | the notices name the operator |
| 2 | Appoint the grievance officer and a monitored mailbox | Filled 19 Oct 2026 (the owner; personal iCloud address) | `grievance.md` |
| 3 | Open the customer support mailbox | Same address; a `prilearning.com` mailbox has no MX record yet | `refund-policy.md` |
| 4 | Choose the jurisdiction whose courts the terms name | New Delhi, 19 Oct 2026 | `terms.md` |
| 5 | Have the English set reviewed by a lawyer qualified in Indian law; have the Hindi checked against it | **Open.** Record it in `review-status.json` | the banner goes; `legal-pages-check.mjs` enforces the paperwork |
| 6 | Confirm the notice matches the code's data path at the release SHA | Reconciled by engineering 2 Nov 2026 against `a5778a319`; counsel's confirmation open | `docs/release/app-store-privacy-labels.md` §6, `play-data-safety.md` §6b |
| 7 | Set the publication date of the filled version | 19 Oct 2026; revised 2 Nov 2026 | `**Last updated**` in all eight documents |
| 8 | Name processors in the notice if counsel requires it | Named now: Resend, Railway, Supabase (planned), OpenAI, Apple and Google | `privacy.md` "Who else sees your data" |
