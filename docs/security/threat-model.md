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
| T2 | Stolen / stale session reuse | Server-side revocation on logout, per-device revoke, sign-out-everywhere (`POST /v1/account/logout-all`), password change (rotates all), password reset (revokes all), deletion; 30-day sliding expiry | `security-acceptance-check` B |
| T3 | Broken object-level authorization (BOLA / IDOR) | No account id is ever taken from the request for self-scoped data; class/assignment routes check ownership or active membership and answer 404 otherwise; session ids revoked only within the account; sync device bound to the session; idempotency keys scoped per account | `security-acceptance-check` C; `platform-sync-pagination-check` |
| T4 | Privilege escalation (wrong role) | `requireRole` gates; role read from the account row on every request; `__proto__`/extra fields ignored; teacher role only via single-use invite | `security-acceptance-check` A2 (every role against every gate that excludes it), D (prototype pollution) |
| T5 | Unverified-email abuse (filling an account it may not own, paid features) | `requireVerifiedEmail` on sync push, class create/join, checkout, handwriting, working | `security-acceptance-check` A3; `verification-enforcement-check` |
| T6 | Child data leaving without guardian consent | `requireGuardianConsent` on sync, billing, handwriting, working (fail-closed) | `security-acceptance-check` A4; `guardian-consent-*` checks |
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
| T19 | Clickjacking / script injection in the client; a same-origin child frame reaching the parent's native bridge (`parent.webkit.messageHandlers.*`, #260) | Enforced CSP (`script-src 'self'`, `frame-ancestors 'none'`, `frame-src 'none'`, `object-src 'none'`) on the server and in both native shells, X-Frame-Options DENY, HSTS in production | `security-headers-check` (incl. real-browser CSP run); `security-production-mode-check`; `native-shell-csp-check`; iOS `--bridge-selfcheck` (debug builds) reports `subframeBlockedByCsp` / `subframeReachThroughRefused` |
| T20 | Vulnerable dependencies | `npm audit --omit=dev` floor fails CI on any runtime advisory | `tools/runtime-audit-floor.mjs` (client + server jobs) |
| T21 | Answer leakage to the handwriting model | Transcription requests carry only the ink image (answer-blind) | `handwriting-transcription-check` |
| T22 | Staff account compromise (phished or reused admin/support password) | TOTP second factor (RFC 6238, `node:crypto`) for `admin` and `support`: an unenrolled staff account reaches only `/me`, logout-all and the enrolment routes; a session must present a code before any staff route answers; role promotion and Premium grant need one presented within 15 minutes; secrets encrypted at rest under `PRI_MFA_KEY`, recovery codes hashed, each TOTP step accepted once; reset only by operator CLI | `mfa-check`; `route-inventory-check` (every staff-only route carries `mfa`) |
| T23 | A long-lived or copied session kept alive by replay | Absolute lifetime `PRI_SESSION_MAX_AGE_DAYS` (default 90) on top of the 30-day slide; admin/support idle limit 12 hours; a session past either is revoked, not merely refused | `security-hardening-check` M1; `mfa-check` |
| T24 | A child's account created by an identity provider sign-in with nobody asked | A NEW account via Google/Apple must declare age like the form (428 `CONSENT_DECLARATION_REQUIRED`, nonce unspent so the client can retry); a child must name a guardian (not their own address) and gets the same consent row and email as registration; existing accounts sign in unchanged | `oidc-consent-check` |
| T25 | A guardian who cannot withdraw because the emailed link died | Separate long-lived `guardian-withdraw` bearer issued on confirmation, exempt from housekeeping, permission-reducing only, revoked by use; email copy states both windows accurately | `security-hardening-check` H2; `guardian-consent-lifecycle-check` |
| T26 | Storage exhaustion by one account (runaway or hostile device) | Per-account quota on stored sync rows and bytes (`PRI_SYNC_MAX_BYTES_PER_ACCOUNT`, `PRI_SYNC_MAX_EVENTS`), checked inside the push transaction before any write; 413 `SYNC_QUOTA_EXCEEDED` with the figures | `security-hardening-check` M4 |
| T27 | A handler bug reading or writing another account's rows | Defence in depth under the handlers' own filters: every pri table fails closed without a declared `pri.scope`; inside `transaction({ accountScope })` RESTRICTIVE policies on the 19 account-owned tables hide every other account's row and refuse writes for it (`42501`). Shared tables, system-scope handlers and a compromised `pri_server` credential are **not** covered (§7) | `rls-fail-closed-check` (Postgres: unscoped sees nothing; per owned table read/update/delete/re-home/insert across accounts refused; shared-table behaviour pinned); `security-hardening-check` M5; `postgres-schema-live-check` / `postgres-schema-mutation-check` |
| T28 | Audit trail tampering through the server's database role | No server code updates or deletes `audit_log`; on Postgres `pri_server` has no UPDATE/DELETE on it | `security-hardening-check` M5; `postgres-schema-live-check` |
| T29 | Weak or silently truncated passwords | ≥10 characters, ≤72 bytes (bcrypt truncation → `PASSWORD_TOO_LONG`), bundled top-1000 list with digit/punctuation stems (`PASSWORD_TOO_COMMON`) at registration, reset and change | `security-hardening-check` M6 |
| T30 | Reconnaissance from the public liveness endpoint | Anonymous `/v1/health` carries ok, release identity, schema versions, engine, reachability and the two quota limits only; provider configuration flags, backlog counts and housekeeping go to `PRI_METRICS_TOKEN` holders and `/v1/admin/health` | `security-hardening-check` L3; `production-runtime-image-check` |
| T31 | Stored assignment or feedback JSON carrying unvalidated content to children | Assignment PATCH runs the same curriculum validator as POST; teacher feedback is a closed schema (`note`, `nextSteps`, `grade`, `score`, `rubric[]`) with bounded text, unknown keys refused | `security-hardening-check` M2; `platform-http-journeys-check` |
| T32 | Clear class join codes read out of a database copy | Join codes stored only encrypted (AES-GCM under the delivery key, bound to the class id); legacy clear codes encrypted by housekeeping and on reveal | `security-hardening-check` L1; `security-acceptance-check` C |

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

## 6. Findings closed by the hardening set (2026-10-02)

| Finding | Severity | Fix | Regression test |
|---|---|---|---|
| Google/Apple sign-in created a student with no `guardian_consents` row, which the consent gate reads as an adult | High | Age declaration required for a NEW identity account; child path writes the consent row and email exactly as registration; nonce unspent on refusal | `oidc-consent-check` |
| Guardian withdrawal link died: 1 h token, consumed, purged by housekeeping, while the email promised "at any time" | High | Separate long-lived `guardian-withdraw` credential, housekeeping-exempt, revoked on use; accurate email copy | `security-hardening-check` H2, `guardian-consent-lifecycle-check` |
| Admin/support had no second factor or step-up | High | TOTP enrolment/verification/step-up, enrolment-gated staff access, encrypted secrets, hashed recovery codes, CLI reset | `mfa-check` |
| No absolute session lifetime; staff sessions slid for 30 days | Medium | `PRI_SESSION_MAX_AGE_DAYS` cap; 12 h staff idle | `security-hardening-check` M1, `mfa-check` |
| Assignment PATCH stored unvalidated JSON; feedback was any object | Medium | Validator on PATCH; feedback schema | `security-hardening-check` M2 |
| Guardian email could equal the student's | Medium | `GUARDIAN_EMAIL_SAME_AS_STUDENT` on both registration paths | `security-hardening-check` M3, `oidc-consent-check` |
| No per-account sync quota | Medium | Rows + bytes quota, 413 with figures | `security-hardening-check` M4 |
| `audit_log` writable by the server role; no per-account RLS | Medium | UPDATE/DELETE revoked; restrictive account-scope policies + store plumbing | `security-hardening-check` M5, Postgres schema gates |
| Passwords >72 bytes silently truncated by bcrypt; common passwords accepted | Medium | `PASSWORD_TOO_LONG`, `PASSWORD_TOO_COMMON` | `security-hardening-check` M6 |
| Clear join code stored beside its hash | Low | Encrypted at rest | `security-hardening-check` L1 |
| `PRI_CSRF_SECRET` accepted at any length | Low | ≥32 characters in production | `security-hardening-check` L2 |
| Anonymous `/v1/health` listed configured providers and backlog counts | Low | Operator detail behind `PRI_METRICS_TOKEN` / admin health | `security-hardening-check` L3 |
| TOTP confirmation spent a step unconditionally: two sessions of one account confirming with one code at once were both accepted on Postgres (SERIALIZABLE retry re-ran the write), verifying two sessions by one step, writing two `mfa.enrol` audits and replacing the first session's recovery codes (#445) | High | Confirmation is the same compare-and-set as verification: only a still-pending enrolment of the secret that matched is confirmed, the loser writes nothing and gets `MFA_CODE_INVALID`; every spend (confirm and verify) is bound to the secret that matched | `mfa-check` forced and simultaneous two-session races on SQLite and Postgres |
| `/totp/enrol` read `confirmed_at`, then upserted `confirmed_at = NULL` unconditionally: a confirm from another session committing between the read and the write was overwritten, the factor reset to pending under the enrolling session's secret while the confirming session stayed verified against a factor no longer the account's | High | The upsert's `DO UPDATE … WHERE account_mfa.confirmed_at IS NULL` replaces only a pending row; no row written → 409 `MFA_ALREADY_ENROLLED`, no secret shown | `mfa-check` forced enrol-vs-confirm race on SQLite and Postgres |

## 7. Row-level security: exactly what is and is not covered (schema 12)

The handlers' own authorization — `WHERE account_id = ?` filters, role checks, class
membership checks — is the **primary** control on every table and every engine
(`security-acceptance-check` C proves it). Postgres row-level security
(`supabase/migrations/20261016000000_rls_fail_closed.sql`, schema 12) is defence in depth with
the precise scope below. `server/test/rls-fail-closed-check.mjs` pins each line on a live
Postgres as a `pri_server` member.

**How the scope is declared.** Every pri table carries a RESTRICTIVE `pri_scope_required` policy:
a statement sees and writes nothing unless `pri.scope` is `system` or `account`. The store
(`server/platform/store.js`) puts each of its own pooled sessions in `pri.scope = 'system'` once,
in `sessionSetup()`, before the session's first statement. A transaction opened with
`transaction({ accountScope })` declares `pri.scope = 'account'` and `pri.account_id` with
`SET LOCAL` in its `BEGIN`; every other transaction re-declares `system` the same way. `SET LOCAL`
reverts to the session's system scope at COMMIT/ROLLBACK, so one request's account never reaches
the next. The account id must match `^[A-Za-z0-9_.:-]{1,200}$` (server ids are `acct_<uuid>`) or
the transaction is refused (`STORE_ACCOUNT_SCOPE_INVALID`) before any SQL is sent.

- **Covered — fail closed for connections outside the store.** A `pri_server` connection that is
  not one of the store's sessions (psql with the role, a script, another service) declares no
  scope and sees no row of any pri table; its inserts fail `42501`. A misspelt or empty scope is
  the same as none.
- **Covered — account-owned tables in account scope.** The 19 tables with a `NOT NULL account_id`
  (`account_identities`, `account_sessions`, `account_tokens`, `auth_delivery_outbox`,
  `guardian_consents`, `account_phones`, `account_mfa`, `account_mfa_recovery_codes`,
  `entitlement_snapshots`, `entitlement_support_grants`, `billing_subscriptions`,
  `billing_trial_claims`, `billing_apple_accounts`, `billing_google_accounts`,
  `billing_google_purchases`, `idempotency_keys`, `learning_events`, `sync_entities`,
  `operational_events`): in an account-scope transaction another account's rows are invisible,
  updates and deletes reach none of them, re-homing an own row to another account fails `42501`,
  and **inserting a row for another account fails `42501`** — per table, whatever the SQL says.
  Today account scope is opened by sync push and pull, practice issue, recognize, recognition
  confirm, reveal and submit, the examination routes, and the recognition receipt.
- **Not covered — shared tables in account scope.** The 23 tables without a `NOT NULL account_id`
  (`accounts`, `classes`, `class_members`, `assignments`, `assignment_submissions`,
  `assignment_feedback`, `audit_log`, `billing_events`, `billing_payments`, `billing_refunds`,
  `billing_apple_signed_events`, `billing_google_notifications`, `content_revisions`,
  `feature_flags`, `issue_reports`, `login_attempts`, `oidc_nonces`, `otp_challenges`,
  `platform_meta`, `rate_limits`, `sync_cursors`, `teacher_invites`, `tutor_cache`) are **readable
  and writable from account scope exactly as from system scope**: an account-scope transaction
  can read every account row and class membership, insert an account or a membership, and rename
  another account. Only the table grants limit them (`audit_log` has no UPDATE/DELETE,
  `sync_cursors` no writes). The test pins this list and this behaviour so that any change is a
  deliberate edit.
- **Not covered — system scope.** Every statement outside an account-scope transaction runs in
  system scope and sees every row. That includes **all authentication, session, MFA, OTP,
  guardian-consent, billing, entitlement, teacher/class, admin and housekeeping handlers**, and
  the session lookup that identifies the caller on every request. Their isolation rests entirely
  on server authorization in the handler.
- **Not a boundary against a compromised `pri_server` credential or server process.** `pri.scope`
  is an ordinary setting the connection declares for itself: anyone holding the `pri_server`
  login (or code execution in the server) can `SET pri.scope = 'system'` and read or write every
  row. It protects against handler bugs and against connections that forget to declare a scope,
  not against an attacker with the database credential. Credential secrecy (Railway sealed
  variables, `docs/architecture/adr-0001-online-first-runtime.md`) is that control.
- **Not covered — SQLite.** One process, one file; the scope is recorded but nothing enforces it.

**How this meets AGENTS.md's "Row-Level Security plus server authorization on every
client-reachable record".** Every pri table has RLS enabled and fails closed for an undeclared
scope, and server authorization covers every client-reachable record. Per-account *RLS* isolation
is narrower than that sentence might be read to say: it applies to the 19 account-owned tables
inside account-scope transactions only. The sentence is unchanged; this note records what it
means in the code today. Extending account scope to more handlers, or giving the shared tables
their own policies, is tracked as R-15 in `accepted-risks.md`.

## 8. Out of scope here

External penetration testing; Supabase project configuration (RLS on the hosted project, network
restrictions, backups) beyond the migration-text parity check; Railway edge/WAF configuration;
iOS binary hardening and App Store review; legal/DPDP sign-off; human review of guardian identity
(the guardian link establishes mailbox access only — see `server/platform/guardianConsent.js`).
