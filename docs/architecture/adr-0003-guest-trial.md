# ADR-0003 — Guest trial: five server-marked questions without an account

- **Status:** Proposed — owner direction recorded 2026-11-18; accepted when this PR merges after an independent R4 review on the exact head.
- **Decision owner:** product owner (Priysharan19).
- **Amends:** the 2026-10-10 amendment to ADR-0001 item 5 ("Do NOT allow signed-out or offline mathematical checking"), for one bounded case only.
- **Risk:** R4 (a marking path that does not require an account; auth boundary).

## Context

A visitor today meets a sign-in wall before any question. The competitor lets a visitor try five
questions first. ADR-0001's amendment says nothing is checked, marked or revealed signed out, and
that no result is labelled as marked on the device. The reasons for that rule were: marks must come
from one deterministic engine on the server, a model must never set a mark, and the device must
never be able to produce or forge a mark. None of those reasons requires that a visitor be refused
five questions; they require that whatever is marked is marked by the server.

## Decision

**The rule, exactly.** A signed-out visitor may be issued, and may have marked, at most **5**
questions per anonymous token per day, of the **typed** or **multiple-choice** form only. Each
question is chosen and sealed by the server, each final answer is marked by the server's
deterministic engine (the marker pool; never a model, never the device), and the correct answer is
released only with that verdict, after which the question is closed. Nothing is stored about the
visitor beyond hashed counters, and nothing the visitor does is recorded as learning.

How it is held:

1. **The guest is a token, not a person.** `POST /v1/guest/session` mints an AES-GCM sealed token
   (random 128-bit id, issue time, expiry one day later; nothing else) in an HttpOnly,
   SameSite=Strict cookie scoped to `/v1/guest`. No account, session, child-data or learning row is
   created. The route takes no fields, so no personal data can be sent.
2. **CSRF.** The question, answer and steps routes also require `X-Pri-Guest-CSRF`, an HMAC of the cookie's
   own token, on top of the origin guard every browser mutation already passes.
3. **Limits, enforced on the server** (`server/platform/guestTrial.js`): 5 questions per token per
   day; 15 per client address bucket per day across any number of tokens (IPv6 collapsed to its /64);
   6 tokens minted per address per day; for IPv6 also 60 questions and 24 tokens per /48 per day (a host with a /56 or /48 can rotate /64 buckets, so the /48 is the bound that holds); a process-wide daily ceiling of 5,000 questions as a
   backstop against many addresses; a per-address route limit (120 an hour, with a separate 240 an hour for the worked steps, its counter named with the same per-purpose key as the others, so no row holds an unkeyed hash of an address); every counter is taken together or not at all: a request refused by the address, /48 or process limit gives back the token's unit, so a refusal that was not the visitor's costs them nothing; one verdict per issued
   question, and one more only after a wrong first verdict on a question that has worked steps and before its answer has been released (the first wrong verdict releases the first worked step and not the answer; each verdict is claimed once, before marking, so parallel guesses at one question cannot each be marked, and "right first time" belongs only to the single first-verdict winner); a 2 second minimum think time; at most 3 retries of an unreadable entry; and a verdict lost in transit may be re-fetched, with the same answer by the same token, for 2 minutes after it was given, from one keyed right-or-wrong counter written with the claim (the question is not marked a second time). These bound
   the feature as a marking oracle: the most one connection can learn is 15 questions a day with at most two verdicts each, with the answer only once the question is closed. Worked steps (`/v1/guest/steps`) are released one request at a time, in order, only for a question that has had a verdict, and never from the ticket; the step that states the answer closes the question as the answer does, so a retry never follows it; steps and retries spend none of the day's allowance, and "one like it" is an ordinary question that spends one, offered only once the source question is closed. No CAPTCHA is used.
4. **Typed and multiple-choice only.** A guest cannot reach handwriting or photo reading (a paid
   provider that needs the consent prompt and an account), the tutor, working checks, premium or
   archive content, or any hint beyond the first authored one. There is no history, sync or
   progress for a guest. The client shows a calm sign-up prompt after the fifth question or when a
   guest chooses handwriting or a photo.
5. **Retention.** The server keeps only `rate_limits` rows (a count and a window start under a
   hashed bucket name) for the token, the address bucket, the /48 bucket, the route limit, the issued question, the process
   ceiling and, for two minutes' use, one right-or-wrong count per answered question; the existing housekeeping sweep deletes each a day after its window opens. The question
   ticket is a stateless encrypted token held by the browser. Both privacy notices (India, Australia;
   English and Hindi) carry one plain paragraph saying this.
6. **Age and guardian rules.** A guest gives no personal data, so there is no consent step. When a
   guest signs up, the ordinary age declaration and guardian flow applies in full. **Guest answers
   are not migrated** into the new account (there is nothing stored to migrate); the sign-up prompt
   says so.
7. **Surfaces.** Web only. The native shells keep sign-in first because their cookie and CSRF jar
   is owned by the shell (ADR-0001 item 5, native bridge); a native guest trial is a later,
   separately reviewed decision.

## What does NOT change

- A signed-in account is marked exactly as before: a verified, eligible, signed-in account, a
  connection, a question the server issued under the account (`/v1/practice/issue`), the server's
  marker, an account-scoped record. None of `practice.js`'s submit path, entitlement, daily-cap,
  consent, repeat or attempt-recording code is touched; `safeQuestion` is merely exported.
- **Nothing is marked on a device.** The engine bundled in the client still never marks a new
  answer; guest answers are marked by the server and the client holds no key.
- A model never sets a mark. Handwriting stays answer-blind and online-only for accounts.
- Exams, the placement check, billing, sync and every account route remain session-gated; a guest
  token is no session and every such route answers it 401.
- Row-Level Security and server authorization on account data are unaffected: the guest routes
  read and write no account-scoped table.
- The signed-out client still labels no result "marked on this device".

## Consequences

- Three public mutations are added to `docs/security/route-inventory.json`, with a new `csrf`
  value `guest-token-hmac`. The session CSRF sweep (`security-acceptance-check` A5) is not weakened:
  it still covers every `double-submit-when-session-cookie` route and cannot silently include or
  exclude the guest routes.
- `docs/security/threat-model.md` gains T35 with its residual risk (a visitor who changes address
  gets another 15 per address; the process ceiling is the backstop).
- Abuse beyond these ceilings is an operations matter: `PRI_GUEST_TRIAL=off` turns the feature off
  without a deploy of code.
- The trial's numbers are product choices, not research results; no conversion or efficacy claim
  is made for them.
- **First screen, Prithagoras (19 November 2026, client only).** The Prithagoras first screen
  (`client/src/guest/GuestPage.jsx`) opens on a question instead of the picker. The server routes,
  limits and marking are unchanged; what changes is when the first question is asked for: once, on
  arrival, and only when the token's five are untouched and the page is visible. That question is
  one of the five whether or not it is answered. A reload, a return later the same day or a hidden
  tab asks for nothing and shows the choices. Changing topic with a question open says that the new
  question uses one of the five and the open one is left unanswered. What a visitor types is shown
  typeset by the bundled notation code (never evaluated, never sent). Priyabhata keeps the picker.
  `client/test/tour-guest-trial.js` holds each of these.

## Not decided here

- A native-shell guest trial; migration of guest answers into an account; a CAPTCHA or proof of
  work if the address limits prove too weak in production.
