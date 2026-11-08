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
  - A 13-year-old signs up by code, waits at the parent step, the parent approves on `/guardian/consent` with the code they were sent, and the child gets in. Then the parent withdraws from the link in their email, and the child's next question is refused (`403 GUARDIAN_CONSENT_WITHDRAWN`). The run also checks that a parent who approved by code is sent a withdrawal link to keep.
  - Steps 4–9 run as the verified adult, on the phone (WebKit), in the order a student meets them (`tools/staging-journey-steps.mjs`):
    - **5:** a typed answer. A surely wrong answer is tried twice: the open try says only "wrong", and the second resolves with the server's worked solution and marking criteria. "Same question" from History then gets the revealed key typed in, and it must earn full marks. Nothing knows an answer in advance: the key is learnt the way a student learns it. It also notes (never as pass or fail) what happens to `₹<amount>` typed on a ₹-priced crore, lakh or million box (#723).
    - **6:** SYNTHETIC ink (strokes from `tools/acceptance/simulated-ink.mjs`, replayed as pointer events) goes through the real reader.
      - D17: from the first stroke until the student accepts the prompt naming OpenAI, no request may reach `/v1/handwriting*` or `/recognize`. A build without the prompt fails this check.
      - The transcript is then corrected explicitly and confirmed. The server must report the reading as corrected, with a receipt.
      - The same Submit is sent again and must return the same attempt, buying no read.
    - **7:** a SYNTHETIC photo (`tools/acceptance/synthetic-png.mjs`) is attached, read once, the answer confirmed, and the server marks it.
    - **9:** the phone goes offline mid-answer. Nothing is marked, the student is told why, and the draft is kept. Back online, Try again is marked exactly once.
    - **4:** a second browser (Chromium tablet) signs in to the same account by code, and its History holds the same marked attempts.
    - **8:** both browsers are reloaded, and both still show every marked attempt.
    - Steps 6 and 7 are SYNTHETIC-PASS at best.
  - **Paid reads:** every request to `/v1/handwriting*`, `/recognize` and question-photo identify is counted. So is a Submit that bought a read.
    - The profile caps a run's paid reads (`train` 6, `full` 20). A full journey buys 2: one ink read and one photo read.
    - That is inside D20 (5 a day per kind on Free) and D21 (120 an hour for the deployment).
    - A 429 or 503 cap from the reader is recorded as a note.
  - **`--profile full`** adds two steps for a second verified account, B:
    - **12:** isolation. B's submit, repeat, reveal and hint on A's question id must each answer `404 QUESTION_NOT_FOUND`.
    - **13:** the free practice cap. B is issued questions until the server refuses with `402 FREE_CAP_REACHED`, and Practice must show the cap screen.
  - Sign out everywhere (on the step-4 browser) and deletion run in Settings.
  - Code-only accounts left over are deleted through the public deletion page (`/account/delete-request`) with an inbox code.
  - The guardian's links come from message bodies: `tools/staging-journey-mail.mjs` fetches only those two subjects, with `BODY.PEEK`, and never prints or stores the link.
- **Without the inbox:** those steps are BLOCKED (mailbox) and the rest runs.

## Local proof (not staging evidence)

The account steps cannot be tried on staging until the inbox exists, so `tools/staging-journey-local.mjs` runs the same journey code against the in-process platform from `client/test/support/online-session.mjs`. That means the real server routes, database and marking engine, and the built client, with three stand-ins:

- The handwriting reader is a SYNTHETIC stand-in. It returns the text the harness drew and never looks at the picture.
- Codes come from the server's test email outbox, read through the inbox's own subject parser.
- Links come from the undelivered auth-delivery outbox.

The free cap runs at its shipped 20, and the paid-call ceiling at 120 an hour and 300 a day.

```bash
node --input-type=module -e "const { ensureBuild } = await import('./client/test/e2e.mjs'); ensureBuild(true);"
~/Developer/.pri-fleet/heavy-slot.sh L8 node tools/staging-journey-local.mjs [--profile full] [--dist <another client build>]
```

- Its report opens with "LOCAL journey proof (not staging)".
- Evidence is written outside the repository.
- The entry takes no origin. `runJourney` accepts a loopback origin only with the in-process platform object in hand, so the CLI still refuses everything but staging. The deployment contract test proves both.
- A local SYNTHETIC-PASS says the harness and the product agree on the flow. It is not evidence about the real reader or staging.

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
