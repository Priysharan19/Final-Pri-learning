# The Pri tutor

The tutor helps a student who is stuck on a **practice** question. It is grounded in the
question's verified worked solution, it answers Socratically, and it can never give the answer
or set a mark. This page describes what it does, what it refuses, and what it costs.

Feature flag: off in production unless `PRI_FEATURE_TUTOR=1` on both the client build and the
server (`client/src/tutor/flag.js`, `server/platform/tutor.js`). Without it the client shows no
Help control and the server answers 404 on every `/v1/tutor` path.

## What the student sees

1. **Three levels, in order** — a nudge, then one Socratic question, then the narrated,
   animated walkthrough of the verified solution. Each opened level is charged like a hint.
   Level 3 shows the whole solution and therefore ends the question exactly as Reveal does.
2. **A conversation** — once level 1 is open and until level 3 is, the panel offers a text box:
   *Ask the Pri tutor*. The student types a question in their own words (up to 600 characters);
   the reply appears sentence by sentence under a *Pri is thinking…* state, rendered with KaTeX
   for the mathematics. Follow-ups work: the last six turns travel with the next question. A
   conversation costs no further credit; the help was charged when level 1 opened.
3. **Fallbacks that are always safe.** Offline, refused, rate-limited, or when the model's reply
   would have given too much away, the panel shows the question's own authored hint for that
   turn and says why (*The tutor can't be reached right now…*, *The tutor's reply would have
   given too much away…*). It never crashes the card and never shows an error screen.

Everything is in both catalogues (English and Hindi); touch targets are 44px; the transcript is
an `aria-live="polite"` log so streamed text is announced.

## What the tutor may never do

- **State the final answer or the result of the next step**, in any notation: digits,
  Devanagari digits, fractions, decimals, percentages, number words in English or Hindi,
  powers, short arithmetic, or a range that brackets the value (`server/platform/tutorGuard.js`).
- **Recite a verified step word for word.** For a device question the solution it is grounded
  in arrives from the device, so a reply that echoes a whole step would merely hand back what
  the client sent.
- **Take the device's word for a server-issued question.** A question issued by
  `/v1/practice/issue` leaves the device with no answer and no solution. The request names it
  (`serverQuestionId`) and carries no prompt, step or answer; the server grounds the help in its
  own escrowed copy, read for the signed-in account only — another account's question id is a
  404, the same as an id that never existed. A body that names an issued question and also
  describes a solution is refused. Until the server has resolved the question, the answer is
  never excused in a reply (not even when the student's own working reaches it — the mark
  confirms an answer, not the tutor), the server re-runs the Step Check rather than trusting the
  device's count of verified lines, and the walkthrough level is refused
  (`server/test/tutor-issued-grounding-check.mjs`).
- **Mark.** No reply carries a verdict, score or mark. ADR-0001: AI proposes, the deterministic
  engine decides.
- **Help in an exam.** A body that says `context: "exam"`, `mode: "exam"` or names an `examId`
  is refused with `TUTOR_EXAM_LOCKED` before anything else — before the cache, before any spend.
  The local backend refuses exam rows earlier still, so an exam question never leaves the device.
- **Leave the question.** The model is told the student's message is data, never an
  instruction, and to decline anything that is not about this question. The deterministic
  guard runs regardless of what the model was told.

## Streaming, and why nothing escapes

`POST /v1/tutor/stream` answers as `text/event-stream`:

| event      | meaning |
|------------|---------|
| `meta`     | `{ level, source, model, cached }` — the stream has opened |
| `delta`    | `{ text }` — one or more complete sentences, already checked |
| `done`     | the whole reply, now cached |
| `fallback` | the reply leaked; `{ message }` is the authored hint; nothing is cached |
| `error`    | `{ code, retryable }` — provider outage, timeout, or `TUTOR_STREAM_SUPERSEDED` |

The server buffers the model's text until a sentence ends (`. ! ?` or `।` followed by a space,
or a newline — so `3.5` is never split), then runs the guard over **everything released so far
plus the new sentence**, and releases that sentence only if the whole is clean. The first leak
closes the gate: the stream ends with `fallback`, the leaked sentence never leaves the server,
and nothing from that turn is cached. A reply is capped at 900 characters on the server and 320
output tokens at the provider.

Every refusal — dark feature, exam, bad body, no key, daily allowance, deployment ceiling,
hourly rate limit — is an ordinary JSON answer **before** the first stream byte and before the
provider is contacted. A streamed turn spends exactly what a `/help` turn spends: one unit of
the per-account daily allowance (`PRI_TUTOR_CALLS_PER_ACCOUNT_DAY`, higher for premium) and one
unit of the deployment-wide paid-call ceiling (`PRI_PAID_CALLS_PER_HOUR/DAY`). The stream route
has its own per-account hourly limiter (`tutor-stream`, 60/h) beside `/help`'s (`tutor-help`,
60/h). One session may hold one open stream; a newer one closes the older with
`TUTOR_STREAM_SUPERSEDED`.

### Compatibility (release-policy CP-11)

`POST /v1/tutor/help` keeps working and now also accepts the conversational turn
(`level: "ask"` with `message` and `history`), answered request/response with the same guard
(regenerate once, then the authored hint). The device streams when it can — a browser talking
to a server that has `/v1/tutor/stream` — and falls back to `/help` when it cannot: inside a
native shell (the priNative cloud channel is request/response) or when an older server answers
404. Older shells therefore keep conversing, without progressive text.

## Caching

Replies are cached for 24 hours in `tutor_cache`.

- **Ladder levels (nudge, socratic, walkthrough)** are keyed by content only — question id and
  version, prompt, steps, answer, hints, work, level, locale. These requests carry no free text,
  so identical requests from different accounts share one reply and one model call, and the
  table never holds an account id.
- **Conversational turns (`ask`)** are keyed by the same content **plus** the message, the
  history **and** a truncated hash of the account. Free text a student typed is cached for that
  account alone and is never read back by another account; the table still holds no account id.
- A `fallback` is never cached: the model's reply was unusable, and the next attempt deserves a
  fresh one.

## What the server sends to the model

The question, the verified steps, the answer, the student's own work lines and typed answer,
where the deterministic checker says the work broke, the recent conversation, and the new
message — all labelled untrusted data. Never a name, email, profile or account id. Student
messages are stripped of control characters, whitespace-collapsed and bounded to 600 characters;
the history is trimmed to the last six turns on the server whatever the client sent.

## Where the pieces live

- `server/platform/tutor.js` — the routes, validation, allowances, cache and the streaming loop.
- `server/platform/tutorGuard.js` — the leak guard and the sentence-by-sentence release gate.
- `server/platform/tutorProvider.js` — the model prompts and the streaming provider call.
- `client/src/tutor/TutorHelp.jsx` — the panel; `conversation.js` — one turn on the device;
  `askRoute.js` — the local backend's `POST /practice/:id/tutor/ask`, which adds the verified
  solution the panel never sees and publishes streamed sentences as `pri:tutor-delta` events.
- `client/src/platform/cloudTransport.js` — `tutorStream`, the one streamed request the audited
  boundary makes.
- Tests: `server/test/tutor-help-check.mjs`, `server/test/tutor-stream-check.mjs`,
  `client/test/tutor-ui-check.mjs`, `server/test/tutor-why-check.mjs`, `server/test/tutor-diagnose-check.mjs`.

## "Why this step?" (F11)

After a question is resolved, every step of the verified solution has a **Why this step?**
control. It opens a short, grounded dialogue about that one step. The first turn asks why
the step is done this way, and the student may follow up in their own words.

- **Server:** `/v1/tutor/help`, level `why`, with `stepIndex` and an optional follow-up
  `message`/`history`. Device: `POST /practice/:id/tutor/why` in `client/src/local/backend.js`.
  Panel: `client/src/tutor/WhyStep.jsx`, a lazy chunk built out with the tutor.
- **Resolved only.** A server-issued question counts as resolved only by the server's own
  completion record. Anything else gets 409 `TUTOR_LEVEL_ORDER`.
- **Grounded.**
  - Every `$…$` span in a reply must be copied from the verified solution, the question or
    the student's lines. Prose may carry no digits, number words or operators. If not, the
    verified step itself is shown.
  - The prompt forbids marks and companion talk (no feelings, no personal details: V7-39).
- **Misconception (audit D1).** For a resolved server-issued question, the server's own Step
  Check misconception id is passed to the model, for both `why` and `diagnose`. The device's
  word is never taken.
- **Premium, server-side.**
  - The account's entitlement snapshot must carry `additional-ai-usage`.
  - A free account gets `PRI_TUTOR_WHY_FREE_PER_DAY` taster calls a day (default 3; `0` means
    none). After that: 402 `TUTOR_PREMIUM_REQUIRED`, before the allowance, the ceiling or the
    provider.
  - A reply already given is served from the per-account cache.
- **Spending cap.**
  - The per-account daily tutor allowance (`PRI_TUTOR_CALLS_PER_ACCOUNT_DAY`, `_PREMIUM`) and
    the deployment paid-call ceiling (`PRI_PAID_CALLS_PER_HOUR`, `PRI_PAID_CALLS_PER_DAY`)
    both apply.
  - The `PAID_CEILING_HIGH` alert (docs/operations/alerts.md) fires when either window reaches
    80%. With `PRI_ALERT_EMAIL` set, it is emailed to the operator.
- **No model** (unconfigured or failing): the verified step itself, never an error, never a
  spend.

## Turning the tutor on in production (owner's switch)

The tutor is off in every production build and on no production server until the owner
decides. Turning it on is **one variable, set in two places**:

1. **Server runtime:** `PRI_FEATURE_TUTOR=1` on the production server service. Without it,
   every `/v1/tutor/*` path is the ordinary 404.
2. **Client build:** the same `PRI_FEATURE_TUTOR=1` in the production client build
   environment. `client/vite.config.js` compiles `__PRI_FEATURE_TUTOR__` from it.
   Without it, the tutor UI, "What went wrong?" and "Why this step?" are not even built
   (`TUTOR_BUILT_OUT`).

Already required before step 1, or the server refuses to start: `PRI_HANDWRITING_API_KEY`,
`PRI_PAID_CALLS_PER_HOUR` and `PRI_PAID_CALLS_PER_DAY`. Recommended alongside: `PRI_ALERT_EMAIL`,
so the 80% alert reaches someone.

Optional tuning:

| Variable | Sets | Default |
|---|---|---|
| `PRI_TUTOR_WHY_FREE_PER_DAY` | free "Why this step?" taster calls a day | 3 |
| `PRI_TUTOR_CALLS_PER_ACCOUNT_DAY` / `_PREMIUM` | per-account daily tutor allowance | 40 / 120 |
| `PRI_TUTOR_DIAGNOSE_REASONING_EFFORT` | diagnosis reasoning effort | high |
| `PRI_TUTOR_REASONING_EFFORT` | reasoning effort for the other levels | low |
| `PRI_TUTOR_MODEL` | model | `gpt-5.6-terra` |

"Check this line so far" stays off on its own switch, `PRI_FEATURE_LINE_CHECK`. To turn it
off again, unset `PRI_FEATURE_TUTOR` on the server; the next client build removes the UI.
