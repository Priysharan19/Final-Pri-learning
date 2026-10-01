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
the Postgres runner (pinned to `26/26 suites`, with both acceptance suites named). Job **Client build
and offline-first boundary** runs the secret scan after the build and the iOS bundle sync, so it reads
the bytes that ship.

## Parts

| File | Proves |
|---|---|
| `docs/security/route-inventory.json` | The reviewed list of all 78 `/v1` routes: method, path, auth kind, roles, verified-email and guardian-consent gates, ownership rule, rate limits, CSRF and Origin treatment, body limits. |
| `server/platform/routePolicy.js` | Reads the guards really mounted in front of each handler by walking the production router (the guard factories carry a `priPolicy` tag). Each rate limit records its `identity`: `account` when `requireSession` ran before it, `ip` otherwise; a role or verified-email gate before `requireSession` is reported as out of order. |
| `server/test/route-inventory-check.mjs` | Mounted routes and inventory match exactly. A new route without an entry, a removed or changed guard (session, role, verified email, consent, rate limit, CSRF), a stale entry, or an incomplete entry fails. A session route whose limit is IP-keyed (limiter before `requireSession`) or whose role/verified gate precedes the session fails even if the inventory agrees. Self-tests prove an unlisted route, a role change, a dropped rate limit, a dropped `requireSession` and both ordering faults are each caught. |
| `server/test/sql-parameterisation-check.mjs` | Static: every `${…}` inside a SQL template in `server/platform` is a reviewed constant fragment; no request value is interpolated. |
| `server/test/security-acceptance-check.mjs` (SQLite + Postgres) | **A. Inventory sweeps** over every session route: no cookie, forged cookie, oversized cookie → 401/403; every role against every gate that excludes it → 403 `FORBIDDEN`; unverified email → 403 `EMAIL_UNVERIFIED`; pending guardian consent → 403 `GUARDIAN_CONSENT_PENDING`; every CSRF-guarded mutation with the token missing, wrong, cookie-less or from another session → 403 `CSRF_REJECTED`. **B. Session lifecycle**: logout, per-device revoke, revoking each device in turn (including the current one), password change, password reset, expiry, revoked row and deletion all kill the old cookie; reset/verify/guardian tokens are purpose-bound, single-use and are never a session. **C. BOLA**: student A vs student B's sync events, device id, idempotency keys, sessions, export, billing status, entitlements, deletion, reports and guardian state; every export section (events, entities, classes) exactly the caller's rows; non-member vs class/assignment/submission routes (404); member student vs staff routes (403); unrelated teacher vs every staff route on another teacher's class (404, nothing changed); support vs content publish/edit; hostile sync cursors. **D. Hostile input**: malformed and non-object JSON (400 `MALFORMED_JSON`), 1 MiB+ bodies (413), deep nesting, wrong content type, traversal-ish content keys and ids, SQL-injection-ish logins/names/join codes/admin search, `__proto__`/`constructor.prototype` payloads on every JSON-accepting family (prototype untouched, role unchanged), unicode/emoji/RTL names round-trip, NUL refused (400 `INVALID_TEXT`) except in sync payloads and signed provider webhooks, lone surrogates stored as U+FFFD without error, safe name clipping. **E.** No route redirects to a caller-supplied `next`/`redirect`/`returnTo`/`url`. **F. Secrets**: with provider keys in the environment and a hostile local provider that echoes the server's `Authorization` header back in its error, no secret appears in any response body/header, `/v1/health`, error body or anything the server wrote to stdout/stderr during the run. **G.** A genuinely signed Razorpay webhook carrying a NUL in customer-controlled notes is applied (entitlement changes), while a NUL in its URL and in other bodies is still refused. |
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
| route-inventory-check | 31/31 (78 routes) | n/a (no database) |
| sql-parameterisation-check | 24 reviewed interpolations | n/a |
| security-acceptance-check | 189/189 | 189/189 |
| abuse-limits-check | 27/27 | 27/27 |
| security-production-mode-check | 52/52 | n/a (headers/cookies) |
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
| `auth` | `session` (cookie session via `requireSession`), `credentials` (email + password), `bearer-token` (one-time emailed token), `oidc-token` (Apple/Google identity token + issued nonce), `provider-signature` (payment webhook), `none` (public). Only `session` is machine-derived; the rest are reviewed. |
| `roles` | Roles that pass every `requireRole` gate on the route (intersection), or `null` for any signed-in role. |
| `verifiedEmail`, `guardianConsent` | Whether `requireVerifiedEmail` / `requireGuardianConsent` sit in front of the handler. |
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
