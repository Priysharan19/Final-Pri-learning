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
- **The mailbox.** Email-code sign-up, the guardian's confirmation link and email verification all need to read an email. Every practice route requires a verified email (`server/platform/practice.js`: `requireVerifiedEmail`), so steps 4–9 stay BLOCKED until `PRI_STAGING_MAILBOX_CMD` names a command that prints the newest code or link for an address from a dedicated test inbox. That variable is set locally only, never in the repo or chat. The steps behind that gate are written up as BLOCKED rather than coded blind; they get implemented against the real flow once the inbox exists.

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

**Cleanup incident.** The first `--accounts` run (8–9 Nov) left two synthetic accounts on staging that cannot be deleted: `acct_40280241-440f-43d8-b35a-c6a322baf8b9` (adult, unverified) and `acct_0e0ce9c4-b675-47cf-94fd-1d2bdec17e54` (Class 8, consent pending), at `delivered+pri-c5dddc-{adult,child}@resend.dev`. The cause was a harness bug: the password was out of scope in cleanup and never stored. This is fixed (the recovery file and `--cleanup` above). They hold no personal data. There is no admin delete route and no automatic purge, so removing them is an owner action on the staging database. Every later run deleted every account it made.

**Owner actions:** (1) one readable test mailbox for `PRI_STAGING_MAILBOX_CMD`; (2) delete the two accounts above from the staging database.
