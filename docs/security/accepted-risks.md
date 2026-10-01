# Pri Learning V1 — dependency audit and residual security risks

Status: **proposed — awaiting owner acceptance.** Engineering records these here; it does not accept
risk on the owner's behalf. Each entry names why it is not fixed in code now and what bounds it.

## 1. Dependency audit (`npm audit --omit=dev`, 2026-10-02)

| Package root | Lockfile | Runtime advisories | Including dev | Action |
|---|---|---|---|---|
| `/` (root) | none | n/a — `package.json` declares no dependencies | n/a | none |
| `client/` | `client/package-lock.json` | 0 | 0 | none |
| `server/` | `server/package-lock.json` | 0 | 0 | none |

No high or critical advisory exists, so no lockfile change was needed and nothing is accepted. CI
keeps this true: `tools/runtime-audit-floor.mjs` fails on **any** runtime advisory for client and
server.

## 2. Residual risks

| # | Risk | Bound today | Why not fixed now | Proposed owner decision |
|---|---|---|---|---|
| R-1 | `POST /v1/account/register` answers 409 `EMAIL_EXISTS`, so registration reveals whether an address has an account | 8 registrations / hour / IP; login and reset do not enumerate | Changing it needs a verify-first sign-up UX (product change) | Accept for V1; revisit with the sign-up redesign |
| R-2 | A guardian address can receive one consent email per child registration; no per-guardian-address cap | 8 registrations / hour / IP | A cap could block siblings registering together; needs product input | Accept for V1, monitor outbox volume per destination |
| R-3 | `GET /v1/content/published/:key` is anonymous and has no app-level rate limit | Public data, `Cache-Control: public, max-age=60`, indexed single-row lookup; the catalogue index is limited (60/min) | Schools behind one NAT refresh packs together; a per-IP limit risks blocking a classroom | Rate-limit at the Railway edge / CDN |
| R-4 | Per-IP limits are only as good as `PRI_TRUSTED_PROXY_HOPS` | Production refuses to start without it; `proxy-identity-contract-check` | Deployment configuration, not code | Verify the value on the Railway release candidate |
| R-5 | Login lockout lets anyone who knows a student's email lock new sign-ins for 15 minutes | Existing sessions keep working (tested); lockout does not reveal account existence | Standard trade-off against credential stuffing | Accept |
| R-6 | No single "sign out everywhere" endpoint | Revoking each device (tested) and password change/reset revoke all sessions | Feature work, not a vulnerability | Accept; consider for post-V1 |
| R-7 | Session cookie is SameSite=Lax, CSP keeps `style-src 'unsafe-inline'` | Double-submit CSRF token + production Origin check on every mutation; `script-src 'self'` only | Lax is needed for top-level navigations back from providers; inline styles are required by React/KaTeX | Accept |
| R-8 | Guardian consent establishes mailbox access only, not parentage | Documented in `guardianConsent.js`; method written into every row | DPDP Rule 10 verifiable consent is a legal/product programme | External legal authority |
| R-9 | Secret scan is pattern-based; a secret with no recognisable prefix (e.g. a Razorpay key secret) is not detected | Secrets live only in Railway variables (ADR-0001 §7); committed `.env` files fail by name; responses/logs are checked at runtime | Entropy scanning has a high false-positive rate on this repository's corpora | Accept; rotate on any suspected exposure |
| R-10 | Admin user search treats `%` and `_` as wildcards | Admin-only, read-only; values are bound parameters | Intended search behaviour | Accept |
| R-11 | Hosted configuration is not covered: Supabase RLS on the live project, network rules, backups, Railway WAF | Migration-text RLS parity check closes tables to client API roles | Needs the real projects and owner access | Verify on staging before production (ADR-0001 §8) |
| R-12 | No external penetration test | This suite | Requires an external party | Owner to schedule before public launch |
