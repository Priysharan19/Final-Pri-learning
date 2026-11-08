# Staging journey proof

`tools/staging-journey-proof.mjs` drives the deployed product on Railway staging (`https://pri-learning-staging-staging.up.railway.app`) in a real browser. Nothing is stubbed: no synthetic reader, no network intercepts, no test delivery adapters. That is the difference from the CI tours, which prove the code's consistency against stubs. Each run writes `<sha>/report.md`, `<sha>/results.json` (every `/v1` request and response, with passwords, tokens, codes and cookies redacted) and screenshots.

```bash
# No account is made: release identity and first open only.
~/Developer/.pri-fleet/heavy-slot.sh L8 node tools/staging-journey-proof.mjs --sha <main SHA staging should serve>
# The whole journey. Makes synthetic test accounts on staging and deletes every one.
~/Developer/.pri-fleet/heavy-slot.sh L8 node tools/staging-journey-proof.mjs --sha <main SHA> --accounts
```

- **Staging only, by construction.** Any other origin is refused, and the deployment contract test proves this, including for the production domains.
- **`--accounts` only with the owner's authorization.** The owner gave it on 9 Nov 2026, staging only. Addresses are Resend's sink, `delivered+pri-<run>-<role>@resend.dev`, so no real person's address and no bounces against the sending domain. The run's one password is kept in a `0600` file under the OS temp directory, outside the repository, until every account is deleted. If cleanup fails, that file stays, and `node tools/staging-journey-proof.mjs --cleanup <file>` finishes the job.
- **Statuses:**
  - PASS: proved.
  - FAIL: a defect, with where, a repro and the owning lane.
  - BLOCKED: an external need, named.
  - SYNTHETIC-PASS: passed on a synthetic input. Drawn ink and rendered photos are SYNTHETIC; nothing here is device, human or examiner evidence.
- **The mailbox:** the owner's dedicated test inbox, read over IMAP (TLS only) by `tools/staging-inbox.mjs`. Its settings live only in `~/Developer/.pri-fleet/staging-inbox.env`, which must be mode 600 and outside the repo: `PRI_STAGING_INBOX_ADDRESS`, `PRI_STAGING_INBOX_IMAP_HOST`, `PRI_STAGING_INBOX_IMAP_PORT`, `PRI_STAGING_INBOX_USER` and `PRI_STAGING_INBOX_PASSWORD`. Nothing from it is printed, logged or committed.
  - Each account gets `<local>+pri-<run>-<n>@<domain>`. Evidence shows only `<inbox>+pri-<run>-<n>`, and email fields are masked in screenshots.
  - Codes are read from the subject line Pri sends, with only headers fetched (`BODY.PEEK`).
  - If a code never arrives within 120 s, that is recorded as a finding (staging delivery to that address may be restricted, for example by a Resend sandbox domain).
- **With the inbox:**
  - The adult signs up by email code, the real student path, and lands verified and inside the app.
  - A 13-year-old signs up by code, waits at the parent step, the parent approves on `/guardian/consent` with the code they were sent, and the child gets in.
  - Sign out everywhere and deletion run in Settings.
  - Code-only accounts left over are deleted through the public deletion page (`/account/delete-request`) with an inbox code.
  - Steps 4–9 (sync, typed mark, handwriting, photo, History, offline) are built next, against the real flow, now that a verified account can exist.
- **Without the inbox:** those steps are BLOCKED (mailbox) and the rest runs.

## Baseline: `1d3829103` (9 Nov 2026)

See [`1d3829103eccaf470621de7124ec1755370c460e/report.md`](1d3829103eccaf470621de7124ec1755370c460e/report.md).

| Step | Status |
|---|---|
| 0 release identity | PASS |
| 1 first open, phone and tablet | PASS |
| 2 sign-up and sign-in | **FAIL**: defect D1 below; email-code sign-up BLOCKED (mailbox) |
| 3 minor held pending guardian consent | PASS; the guardian's link BLOCKED (mailbox) |
| 4–9 sync, typed mark, handwriting, photo, History, offline | BLOCKED (mailbox: verified email) |
| 10 sign out everywhere | BLOCKED by D1 (Settings unreachable); the server half passes through the API |
| 11 in-app deletion | BLOCKED by D1; accounts deleted through `DELETE /v1/account` |

**D1 (L2 with L3).** An adult password account whose email is not verified signs in on the server, but the card stops on its class step. It says "We couldn't confirm your account's guardian approval. Please try again." The server says the guardian is not required; the real blocker is the unverified email. `onboardingAuthority.js` returns `unavailable` for an unverified adult, and `SignUpFlow.jsx` shows `signup.consentCheckUnavailable`, with no way to verify the email from there.

**Known leftovers (no action needed).** The first `--accounts` run (8–9 Nov) left two synthetic accounts on staging that it could not delete:
- `acct_40280241-440f-43d8-b35a-c6a322baf8b9`: adult, unverified, `delivered+pri-c5dddc-adult@resend.dev`
- `acct_0e0ce9c4-b675-47cf-94fd-1d2bdec17e54`: Class 8, consent pending, `delivered+pri-c5dddc-child@resend.dev`

Why: a harness bug left the password out of scope at cleanup, and it was never stored. That is fixed with the 0600 recovery file and `--cleanup`. Every later run deleted every account it made.

Both accounts are synthetic, hold no personal data and exist only on staging. By the Director's decision of 9 Nov 2026 no one deletes them by hand, and the staging database is never touched directly. Once #736's D18 erasure is enforced on staging, the pending child account will be purged by it.
