# Pri Learning V1 — security acceptance suite

V1 hard blocker #14 ("Final security acceptance") requires automated, repeatable evidence that the
`/v1` server fails closed. This page lists what runs, what each part proves and what it does not.
The threat model it maps to is `docs/security/threat-model.md`.

**What this is not.** It is automated engineering evidence from in-process HTTP against the
production middleware chain, on SQLite and on a migrated Postgres as the `pri_server` role. It is not
an external penetration test, a review of the hosted Supabase/Railway configuration, or legal/privacy
sign-off. Passing it does not make the product "secure"; it makes these specific regressions fail CI.

## How to run

```bash
npm run test:platform:acceptance                       # SQLite: inventory, SQL, BOLA/authz, abuse, production boundary
node scripts/with-postgres.mjs node server/test/run-platform-postgres.mjs   # includes the acceptance + abuse suites on Postgres
npm run test:secrets                                   # secret-scan self-test + scan (tracked files, iOS bundles, client/dist if built)
node tools/runtime-audit-floor.mjs server              # npm audit --omit=dev floor (also: client)
```

CI: job **Production account, sync and commercial schema** runs the step *Security acceptance* and
the Postgres runner (pinned to its suite count, with both acceptance suites named). Job **Client build
and offline-first boundary** runs the secret scan after the build and the iOS bundle sync, so it reads
the bytes that ship.

## Parts

| File | Proves |
|---|---|
| `docs/security/route-inventory.json` | The reviewed list of all 101 `/v1` routes: method, path, auth kind, roles, verified-email, guardian-consent and second-factor (`mfa`) gates, ownership rule, rate limits, CSRF and Origin treatment, body limits. |
| `server/platform/routePolicy.js` | Reads the guards really mounted in front of each handler by walking the production router (the guard factories carry a `priPolicy` tag). Each rate limit records its `identity`: `account` when `requireSession` ran before it, `ip` otherwise; a role or verified-email gate before `requireSession` is reported as out of order. |
| `server/test/mfa-check.mjs` (SQLite + Postgres) | Staff second factor: RFC 6238 vectors, ±1 step, each step once; secrets encrypted and bound to the account, recovery codes hashed, production without `PRI_MFA_KEY` cannot enrol (503); an unenrolled admin reaches only `/me`, logout-all and the enrolment routes (every other route 403 `MFA_ENROLMENT_REQUIRED`); a fresh sign-in is `MFA_REQUIRED` until a code is presented; role change and Premium grant are `MFA_STEP_UP_REQUIRED` after 15 minutes and change nothing; recovery codes once each; staff sessions idle out at 12 h; readiness reports `MFA_KEY_MISSING`; the operator reset CLI removes the factor and revokes every session. |
| `server/test/oidc-consent-check.mjs` (SQLite + Postgres) | A new Google/Apple account with no age declaration is 428 `CONSENT_DECLARATION_REQUIRED` with the nonce unspent and no account; the retry with `isAdult: true` (same token and nonce) creates it; a child without a guardian, or naming their own address, is refused; a child with a guardian gets the consent row, the one-hour token and the email exactly as registration writes them and cannot sync until confirmed; an existing account signs in with no declaration. |
| `server/test/security-hardening-check.mjs` (SQLite + Postgres) | The hardening set: guardian withdrawal credential across housekeeping (H2); session absolute lifetime and staff idle (M1); assignment PATCH validation and feedback schema (M2); guardian ≠ student email (M3); sync quota 413 with figures and nothing stored (M4); audit log append-only in code and by migration, per-account RLS scope proven on Postgres (M5); password length/common list on register, reset and change (M6); encrypted join codes including legacy rows (L1); CSRF secret length (L2); anonymous vs operator `/v1/health` (L3). |
| `server/test/route-inventory-check.mjs` | Mounted routes and inventory match exactly. A new route without an entry, a removed or changed guard (session, role, verified email, consent, rate limit, CSRF), a stale entry, or an incomplete entry fails. A session route whose limit is IP-keyed (limiter before `requireSession`) or whose role/verified gate precedes the session fails even if the inventory agrees. Self-tests prove an unlisted route, a role change, a dropped rate limit, a dropped `requireSession` and both ordering faults are each caught. |
| `server/test/sql-parameterisation-check.mjs` | Static: every `${…}` inside a SQL template in `server/platform` is a reviewed constant fragment; no request value is interpolated. |
| `server/test/security-acceptance-check.mjs` (SQLite + Postgres) | **A. Inventory sweeps** over every session route: no cookie, forged cookie, oversized cookie → 401/403; every role against every gate that excludes it → 403 `FORBIDDEN`; unverified email → 403 `EMAIL_UNVERIFIED`; pending guardian consent → 403 `GUARDIAN_CONSENT_PENDING`; every CSRF-guarded mutation with the token missing, wrong, cookie-less or from another session → 403 `CSRF_REJECTED`. **B. Session lifecycle**: logout, per-device revoke, revoking each device in turn (including the current one), password change, password reset, expiry, revoked row and deletion all kill the old cookie; reset/verify/guardian tokens are purpose-bound, single-use and are never a session. **C. BOLA**: student A vs student B's sync events, device id, idempotency keys, sessions, export, billing status, entitlements, deletion, reports and guardian state; every export section (events, entities, classes) exactly the caller's rows; non-member vs class/assignment/submission routes (404); member student vs staff routes (403); unrelated teacher vs every staff route on another teacher's class (404, nothing changed); support vs content publish/edit; hostile sync cursors. **D. Hostile input**: malformed and non-object JSON (400 `MALFORMED_JSON`), 1 MiB+ bodies (413), deep nesting, wrong content type, traversal-ish content keys and ids, SQL-injection-ish logins/names/join codes/admin search, `__proto__`/`constructor.prototype` payloads on every JSON-accepting family (prototype untouched, role unchanged), unicode/emoji/RTL names round-trip, NUL refused (400 `INVALID_TEXT`) except in sync payloads and signed provider webhooks, lone surrogates stored as U+FFFD without error, safe name clipping. **E.** No route redirects to a caller-supplied `next`/`redirect`/`returnTo`/`url`. **F. Secrets**: with provider keys in the environment and a hostile local provider that echoes the server's `Authorization` header back in its error, no secret appears in any response body/header, `/v1/health`, error body or anything the server wrote to stdout/stderr during the run. **G.** A genuinely signed Razorpay webhook carrying a NUL in customer-controlled notes is applied (entitlement changes), while a NUL in its URL and in other bodies is still refused. **Ledger 2.6/2.7 (in B and C)**: a sign-in from an unseen device sends exactly one notice to the account's own address (no address, token or link in it) and one audit row with empty metadata, a known device sends none; demotion out of a staff role retires the account's sessions while a student→teacher promotion keeps them; the export is refused (`401 REAUTH_REQUIRED`, naming the available proof) when the session's last proof is older than `REAUTH_FRESH_MS` or absent, a wrong password / another account's password / a cross-site attempt change nothing, the right proof rotates the token (old cookie dead, no extra session row) and unlocks the export, every export is audited with counts only. **I. Ledger 2.9**: every parameterised session route called with a second account's REAL ids (class, assignment, submission, report, session, account, content revision) answers without a crash, without anything of that account in the body, and leaves that account's rows unchanged; session-token tampering (bit flips, truncation, padding, the stored hash, JWT alg=none and HS256 forgeries naming an admin or another account, another account's session id, the CSRF token) is `401 AUTH_REQUIRED` on `/me` and on sync; every cookie-authenticated mutation refuses a cross-site HTML form post (`application/x-www-form-urlencoded`, foreign Origin, no custom header); the production header set carries HSTS (≥ 1 year, subdomains) and an enforced CSP (`default-src 'self'`, same-origin scripts with no eval or inline, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`), development over http does not pin HSTS, and the running server really sends the CSP on `/v1`. |
| `server/test/abuse-limits-check.mjs` (SQLite + Postgres) | Every declared limiter bucket admits exactly its limit and then answers 429 `RATE_LIMITED` with `RateLimit-Remaining: 0` and a `RateLimit-Reset` inside the window. Login lockout (10 failures, right password still refused, `Retry-After`, other emails and existing sessions unaffected). Reset mail capped at 3 per mailbox per hour with an identical answer for every caller and for unknown addresses. Join-code guessing stops at 20/h. Handwriting (240/h) and working check (120/h) limit per account, not globally. Verification resend 5/h, replacing rather than stacking mail. |
| `server/test/security-production-mode-check.mjs` | With `NODE_ENV=production`: every browser mutation refuses foreign, look-alike, downgraded, `null` and missing Origins and a native claim with Fetch-Metadata (webhooks exempt); no CORS grant on any route (preflight or credentialed); session cookie Secure + HttpOnly + SameSite=Lax + Path=/ on register, login, `/me` refresh and password change, and cleared with the same attributes on logout; HSTS and an enforced CSP on the shell, static assets, SPA fallback and `/v1`; no off-site redirect from static/fallback paths; error bodies carry `{code, message}` only. |
| `tools/secret-scan.mjs` + `tools/secret-scan.test.mjs` | High-signal secret patterns (OpenAI `sk-`/`sk-proj-`, Stripe live, Razorpay `rzp_live_`, Resend `re_…`, PEM private keys, JWTs, AWS key id/secret, GitHub, Slack, Google API keys, Postgres URLs with an embedded password) over every tracked file — iOS bundles included — and `client/dist`. A committed `.env` fails by name. Findings print masked. The self-test plants one value per pattern at runtime and proves near-misses stay clean. |
| `tools/runtime-audit-floor.mjs` (existing) | `npm audit --omit=dev` fails CI on any runtime advisory (client and server). |

Existing suites this builds on rather than duplicates: `security-headers-check` (header values,
CSP under a real browser), `native-origin-csrf-check`, `proxy-identity-contract-check`,
`login-lockout-check`, `verification-enforcement-check`, `guardian-consent-*`,
`account-deletion-reauth-check`, `platform-sync-pagination-check`, `spend-ceiling-check`, the billing
suites and `request-size-contract-check`.

## Results at the time of writing (2026-10-02, this branch)

| Suite | SQLite | Postgres 17 |
|---|---|---|
| route-inventory-check | 31/31 (90 routes) | n/a (no database) |
| sql-parameterisation-check | 24 reviewed interpolations | n/a |
| security-acceptance-check | 218/218 | 218/218 |
| abuse-limits-check | 29/29 | 29/29 |
| security-production-mode-check | 52/52 | n/a (headers/cookies) |
| mfa-check | 101/101 | 101/101 |
| oidc-consent-check | 32/32 | 32/32 |
| security-hardening-check | 141/141 | 144/144 (three Postgres-only RLS checks) |
| secret scan | 1,126 tracked files + 95 `client/dist` files: 0 findings | — |
| `npm audit --omit=dev` | client 0, server 0; root declares no dependencies | — |

## Vulnerabilities found and fixed

See `threat-model.md` §5: admin missing-class 500; NUL text crashing Postgres
(500 on sign-up, sign-in, class create, reports, telemetry, ids in URLs); emoji-splitting name
clipping; out-of-range sync cursor 500 on Postgres; uncoded malformed-JSON errors; per-mailbox reset
mail bombing; unlimited account export. Each has a regression test in the suites above that fails
without the fix.

## Limits of the route walk

- **Order is checked only where it changes who is protected**: a limiter's position relative to
  `requireSession` (account- vs IP-keyed) and role/verified gates before the session. Other orderings
  (for example a consent gate relative to a rate limit) are not checked.
- **Path-scoped middleware** (`router.use('/sync', gate)`) is attributed only to a router mounted at
  exactly the same path. A gate on a prefix that a differently-mounted router also matches would not
  be attributed to that router's routes. `router.js` mounts every gate beside its own router today;
  the behavioural sweeps in `security-acceptance-check.mjs` (A4: consent) are the backstop.

## Sign-out-everywhere (closed by #263)

`POST /v1/account/logout-all` is in `route-inventory.json` (session, account-keyed limit after
`requireSession`, CSRF + Origin, own account only). Section B proves: no session → 401, missing or
forged CSRF → 403, foreign Origin → 403, refused attempts revoke nothing, a successful call revokes
every session of the caller including the current one, and another account stays signed in.

## Residual risks

Listed with proposed handling in `docs/security/accepted-risks.md`. They need owner acceptance; this
page does not accept them.

## Inventory fields

| Field | Meaning |
|---|---|
| `auth` | `session` (cookie session via `requireSession`), `credentials` (email + password), `bearer-token` (one-time emailed token), `oidc-token` (Apple/Google identity token + issued nonce), `provider-signature` (payment webhook), `operator-token` (`Authorization: Bearer $PRI_METRICS_TOKEN`, `/v1/metrics` only), `none` (public). `session` and `operator-token` are machine-derived from the tagged guards; the rest are reviewed. |
| `roles` | Roles that pass every `requireRole` gate on the route (intersection), or `null` for any signed-in role. |
| `verifiedEmail`, `guardianConsent` | Whether `requireVerifiedEmail` / `requireGuardianConsent` sit in front of the handler. |
| `mfa` | The staff second-factor gate (`requireMfa`): `false`, `true` (a code verified on this session), or `{ "stepUpMs": N }` (one presented inside that window). Machine-derived; every route whose roles are only `admin`/`support` must carry it, except the enrolment ceremony under `/v1/account/mfa/`. |
| `ownership` | The object-level rule, in words: which rows the caller can reach and what answer anything else gets. |
| `rateLimits` | Every `rateLimit` bucket in front of the handler: key, limit, window, and `identity` (`account` if keyed by the session account, `ip` if it runs before any session). |
| `csrf` | `double-submit-when-session-cookie` for mutations behind `csrfGuard`. |
| `origin` | `enforced` (production Origin must equal `PRI_PUBLIC_ORIGIN`), `exempt-provider-webhook`, or `not-applicable` for reads. |
| `bodyLimit`, `innerLimits` | The 1 MiB transport cap for mutations, and any tighter per-field limit the handler applies. |

## Adding a route

1. Mount it with the guards it needs (`requireSession`, `requireRole`, `requireVerifiedEmail`,
   `requireGuardianConsent`, `rateLimit`).
2. Add its entry to `docs/security/route-inventory.json`, including a real `ownership` sentence.
3. `node server/test/route-inventory-check.mjs` must pass; the sweeps in
   `security-acceptance-check.mjs` and `abuse-limits-check.mjs` pick the route up automatically.
4. If it touches another account's objects, add an explicit BOLA case to section C.
