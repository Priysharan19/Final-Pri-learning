# Pri Learning V1 — threat model

Status: engineering threat model for V1 release blocker #14 ("Final security acceptance",
`docs/release/PRI_V1_RELEASE_SCOPE.md`). It describes the `/v1` server as it exists on `main`
together with the runtime decided in `docs/architecture/adr-0001-online-first-runtime.md`
(Railway + Supabase Postgres in Mumbai + OpenAI). It is evidence for review, not a claim that the
product is secure: no external penetration test, legal/privacy sign-off or production configuration
review is represented here.

Companion documents:

- `docs/security/route-inventory.json` — every `/v1` route with its authentication, roles,
  ownership rule, rate limit, CSRF/origin treatment and body limits (machine-checked).
- `docs/security/acceptance.md` — the automated suite, what it proves and what it does not.
- `docs/security/accepted-risks.md` — dependency audit result and residual risks awaiting owner
  acceptance.

## 1. System boundary

```
iPad (WKWebView shell, native cookie jar)  ─┐
Browser (built client, same origin)        ─┼─ HTTPS ─ Railway edge ─ /v1 Express app ─┬─ Postgres (Supabase, pri_server role)
Payment providers (Razorpay / App Store)   ─┘   webhooks (signed)                      ├─ OpenAI (handwriting, working check)
                                                                                         └─ Resend (verification / reset / guardian mail)
Guardian (email link only, no account)
```

Trust boundaries: (1) the internet → the `/v1` app; (2) the app → Postgres; (3) the app → paid
providers (outbound, key-bearing); (4) payment providers → the app (inbound webhooks); (5) the
guardian's mailbox → the app (bearer links).

## 2. Assets

| Asset | Why it matters | Where it lives |
|---|---|---|
| Accounts and sessions | Takeover gives a child's learning record, billing and class access | `accounts`, `account_sessions` (token stored as SHA-256 only), cookies `pri_cloud_session` (HttpOnly) + `pri_csrf` |
| Student learning data (minors, DPDP Act) | Personal data of children; cross-account read is release-blocking (ADR-0001) | `learning_events`, `sync_entities`, exports |
| Handwriting images | Biometric-adjacent child data; must stay answer-blind | Transit only: `/v1/handwriting/transcribe` → provider with `store: false`; never persisted server-side |
| Payment and entitlement state | Fraudulent Premium, refunds, cancellation abuse | `entitlement_snapshots`, `billing_*`; provider webhooks |
| Exam / marking integrity | A model output must never turn a wrong answer right | Deterministic marker on the client; `/v1/working/check` returns hints, not marks |
| Teacher / guardian access | Teachers see rosters and aggregate progress; guardians control consent | `classes`, `class_members`, `assignment_*`, `guardian_consents` |
| Provider secrets | OpenAI, Razorpay, Resend, Supabase service credentials, CSRF/delivery keys | Railway environment only (ADR-0001 §7) |
| Content authority | Published curriculum content reaches every student | `content_revisions` with independent review |

## 3. Actors

Anonymous internet client; signed-in student (adult, or child with pending/given/withdrawn guardian
consent); teacher; support; admin; guardian (bearer link, no session); payment provider; a
compromised or malicious paid AI provider; a script holding a stolen session cookie.

## 4. Threats and controls

| # | Threat | Control | Automated evidence |
|---|---|---|---|
| T1 | Unauthenticated access to account-scoped routes | `requireSession` on every account-scoped route; session token looked up by hash, `revoked_at IS NULL`, `expires_at > now`, account not deleted | `security-acceptance-check` A1 (no / forged / oversized cookie on all session routes); `route-inventory-check` (guard really mounted) |
| T2 | Stolen / stale session reuse | Server-side revocation on logout, per-device revoke (single sign-out-everywhere endpoint: PR #263), password change (rotates all), password reset (revokes all), deletion; 30-day sliding expiry | `security-acceptance-check` B |
| T3 | Broken object-level authorization (BOLA / IDOR) | No account id is ever taken from the request for self-scoped data; class/assignment routes check ownership or active membership and answer 404 otherwise; session ids revoked only within the account; sync device bound to the session; idempotency keys scoped per account | `security-acceptance-check` C; `platform-sync-pagination-check` |
| T4 | Privilege escalation (wrong role) | `requireRole` gates; role read from the account row on every request; `__proto__`/extra fields ignored; teacher role only via single-use invite | `security-acceptance-check` A2 (every role against every gate that excludes it), D (prototype pollution) |
| T5 | Unverified-email abuse (filling an account it may not own, paid features) | `requireVerifiedEmail` on sync push, class create/join, checkout, handwriting, working | `security-acceptance-check` A3; `verification-enforcement-check` |
| T6 | Child data leaving without guardian consent | `requireGuardianConsent` on sync, billing, handwriting, working, telemetry, classes, assignments and reports (fail-closed); `/account` stays open for the consent ceremony, export and deletion | `security-acceptance-check` A4; `guardian-consent-*` checks (`guardian-consent-coverage-check` drives pending → given → withdrawn and an adult over each) |
| T7 | CSRF on cookie-authenticated mutations | Double-submit HMAC token bound to the session + `Origin` must equal `PRI_PUBLIC_ORIGIN` in production; native exception only without browser Fetch-Metadata; SameSite=Lax | `security-acceptance-check` A5 (missing/wrong/cross-session on every mutation); `security-production-mode-check` (foreign, look-alike, downgraded, null, missing Origin on every mutation); `native-origin-csrf-check` |
| T8 | Cross-origin reads | No CORS policy is ever emitted | `security-production-mode-check` (preflight + credentialed request on every route) |
| T9 | Credential stuffing / brute force | Login 12/15 min per IP + per-email lockout (10 failures); bcrypt cost 12 with equal-cost dummy compare; 256-bit one-time tokens | `abuse-limits-check`; `login-lockout-check` |
| T10 | Mail bombing / enumeration via reset and verification | Reset request answers `ok` for every address; 6/h per IP **and 3/h per mailbox**; verification resend 5/h per account and replaces the pending mail | `abuse-limits-check` |
| T11 | Paid AI cost abuse | Per-account limits (240/h handwriting, 120/h working) + one deployment-wide paid-call ceiling, required whenever a key is set | `abuse-limits-check`; `spend-ceiling-check` |
| T12 | Injection (SQL) | Every request value is a bound parameter; the only SQL interpolations are reviewed constant fragments | `sql-parameterisation-check` (static); `security-acceptance-check` D (SQL-ish logins, names, join codes, admin search, sync cursors) |
| T13 | Malformed / hostile input crashing handlers | 1 MiB transport cap; coded 400 `MALFORMED_JSON`, 413 `REQUEST_BODY_TOO_LARGE`; NUL refused with 400 `INVALID_TEXT`; cursors clamped | `security-acceptance-check` D; `request-size-contract-check` |
| T14 | Prototype pollution | JSON.parse own-property semantics; handlers copy allow-listed fields; plain-object checks | `security-acceptance-check` D asserts `Object.prototype` untouched and role unchanged |
| T15 | Open redirect / phishing | No route redirects; static hosting never redirects off-site | `security-acceptance-check` E; `security-production-mode-check` |
| T16 | Secret disclosure (responses, logs, repository, shipped bundles) | Secrets only in environment; health exposes booleans only; error bodies are `{code, message}`; request log is method/path/status/latency; provider error bodies are never relayed; repository + iOS bundle + built client scanned | `security-acceptance-check` F (hostile provider echoes the bearer; nothing reaches the client or the log); `tools/secret-scan.mjs` in CI |
| T17 | Forged payment events | Webhooks verified by provider signature inside the apply transaction; restore/transaction results must bind to the session account | `razorpay-billing-check`, `apple-billing-check`, `billing-webhook-router-check` |
| T18 | Content tampering | Support drafts, an independent reviewer approves, only admin publishes/rolls back | `content-review-contract-check`; `security-acceptance-check` C |
| T19 | Clickjacking / script injection in the client | Enforced CSP (`script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), X-Frame-Options DENY, HSTS in production | `security-headers-check` (incl. real-browser CSP run); `security-production-mode-check` |
| T20 | Vulnerable dependencies | `npm audit --omit=dev` floor fails CI on any runtime advisory | `tools/runtime-audit-floor.mjs` (client + server jobs) |
| T21 | Answer leakage to the handwriting model | Transcription requests carry only the ink image (answer-blind) | `handwriting-transcription-check` |

## 5. Findings fixed by this acceptance work

| Finding | Impact | Fix | Regression test |
|---|---|---|---|
| An admin reading `GET /v1/classes/<id>` for an id with no class crashed with a TypeError → 500 | Server error on a crafted id (availability, noisy alerts) | 404 `CLASS_NOT_FOUND` | `security-acceptance-check` C |
| NUL (`\u0000`) in any stored text (name, email, device id, class name, report note, telemetry surface, an id in the URL) reached Postgres, which refuses it → 500 on sign-up/sign-in/etc. on the production engine (SQLite stored it) | Any caller could make core routes fail on Postgres; inconsistent engines | `rejectUnsafeText` refuses NUL in the URL, query and JSON body with 400 `INVALID_TEXT` (sync push payloads and signed provider webhooks exempt — stored JSON-escaped, or never stored as text) | `security-acceptance-check` D (fails with 500 on Postgres without the fix) |
| Name clipping (`slice(0, 80)`) could cut an emoji in half, storing a lone surrogate (rewritten to U+FFFD by the driver) | Silent data corruption of student/guardian names | `clipText` never splits a surrogate pair; OIDC names cleaned with `storableText` | `security-acceptance-check` D |
| `GET /v1/sync/pull/99999999999999999999` (or `1e400`) reached Postgres as a bigint out of range → 500 | Crafted cursor forced a server error | Cursor clamped to the safe-integer range | `security-acceptance-check` C (Postgres) |
| Malformed or non-object JSON answered with an uncoded `{ error: "Something went wrong on the server." }` under a 400 | Clients could not distinguish a client mistake from a server fault | Coded `MALFORMED_JSON` (and other body-parser codes) | `security-acceptance-check` D |
| Password-reset mail was limited per IP only | A distributed caller could mail-bomb one student's inbox | Additional cap of 3 reset emails per mailbox per hour; caller sees an identical `ok` | `abuse-limits-check` |
| `GET /v1/account/export` had no rate limit | A stolen session could pull the full history repeatedly; one account could monopolise the database | 10 exports per account per hour | `route-inventory-check`, `abuse-limits-check` |

## 6. Out of scope here

External penetration testing; Supabase project configuration (RLS on the hosted project, network
restrictions, backups) beyond the migration-text parity check; Railway edge/WAF configuration;
iOS binary hardening and App Store review; legal/DPDP sign-off; human review of guardian identity
(the guardian link establishes mailbox access only — see `server/platform/guardianConsent.js`).
