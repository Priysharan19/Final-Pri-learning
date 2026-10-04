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
| R-1 | `POST /v1/account/register` answers 409 `EMAIL_EXISTS`, so registration reveals whether an address has an account | 8 registrations / hour / IP; login and reset do not enumerate | Changing it needs a verify-first sign-up UX (product change) | **Owner sign-off required** (accounts of minors; account enumeration). Proposed: accept for V1 and revisit with the sign-up redesign |
| R-2 | A guardian address can receive one consent email per child registration; no per-guardian-address cap | 8 registrations / hour / IP | A cap could block siblings registering together; needs product input | Accept for V1, monitor outbox volume per destination |
| R-3 | `GET /v1/content/published/:key` is anonymous and has no app-level rate limit | Public data, `Cache-Control: public, max-age=60`, indexed single-row lookup; the catalogue index is limited (60/min) | Schools behind one NAT refresh packs together; a per-IP limit risks blocking a classroom | Rate-limit at the Railway edge / CDN |
| R-4 | Per-IP limits are only as good as `PRI_TRUSTED_PROXY_HOPS` | Production refuses to start without it; `proxy-identity-contract-check` | Deployment configuration, not code | Verify the value on the Railway release candidate |
| R-5 | Login lockout lets anyone who knows a student's email lock new sign-ins for 15 minutes | Existing sessions keep working (tested); lockout does not reveal account existence | Standard trade-off against credential stuffing | Accept |
| R-6 | No single "sign out everywhere" endpoint | — | **Closed by #263**: `POST /v1/account/logout-all` is inventoried and its negatives (no session, bad CSRF/Origin, revokes every session including the current one, another account unaffected) are in `security-acceptance-check.mjs` §B | Closed |
| R-7 | Session cookie is SameSite=Lax, CSP keeps `style-src 'unsafe-inline'` | Double-submit CSRF token + production Origin check on every mutation; `script-src 'self'` only | Lax is needed for top-level navigations back from providers; inline styles are required by React/KaTeX | Accept |
| R-8 | Guardian consent establishes mailbox access only, not parentage | Documented in `guardianConsent.js`; method written into every row | DPDP Rule 10 verifiable consent is a legal/product programme | External legal authority |
| R-9 | Secret scan is pattern-based; a secret with no recognisable prefix (e.g. a Razorpay key secret) is not detected | Secrets live only in Railway variables (ADR-0001 §7); committed `.env` files fail by name; responses/logs are checked at runtime | Entropy scanning has a high false-positive rate on this repository's corpora | Accept; rotate on any suspected exposure |
| R-10 | Admin user search treats `%` and `_` as wildcards | Admin-only, read-only; values are bound parameters | Intended search behaviour | Accept |
| R-11 | Hosted configuration is not covered: Supabase RLS on the live project, network rules, backups, Railway WAF | Migration-text RLS parity check closes tables to client API roles | Needs the real projects and owner access | Verify on staging before production (ADR-0001 §8) |
| R-12 | No external penetration test | This suite | Requires an external party | Owner to schedule before public launch |
| R-13 | Staff second factor is TOTP (a shared secret), not a phishing-resistant hardware key | Secret encrypted at rest, each 30-second step accepted once, step-up for promotion/grant, 12 h idle, enrolment-gated access; reset only by operator CLI | WebAuthn needs the admin UI and a credential store; no new dependency policy | Accept for V1; revisit with the admin console |
| R-14 | A staff account without `PRI_MFA_KEY` in production cannot enrol (503) rather than falling back to a development key | `/v1/ready` reports `MFA_KEY_MISSING`; boot refuses when `PRI_BOOTSTRAP_ADMIN_EMAIL` is set without the key | Deployment configuration | Set the key before promoting the first admin |
| R-15 | Per-account restrictive RLS covers the sync tables inside scoped transactions only (threat-model §7); other tables rely on handler authorization | `security-acceptance-check` C (BOLA) on every table; schema gates pin the policies | Scoping every handler is a broad refactor | Accept; extend handler by handler |
| R-16 | The guardian's withdrawal link is a long-lived bearer in a mailbox: anyone with that mailbox can withdraw | It can only reduce permission, is revoked on use, dies with the account; the same mailbox already held confirmation authority | A withdrawal that needs a login defeats "as easy as giving it" | Accept |
| R-17 | Join codes are encrypted under `PRI_AUTH_DELIVERY_KEY`; rotating that key makes stored codes unrevealable until rotated | Reveal answers 409 `JOIN_CODE_UNAVAILABLE`; rotate issues a new code; joining is unaffected (hash) | A dedicated key is one more secret to manage | Accept; note in the key-rotation runbook |
| R-18 | The common-password list is a bundled 1,000 entries plus digit/punctuation stems, not a breach-corpus check | 10-character minimum, 72-byte cap, per-IP and per-email login limits and lockout | A k-anonymity breach lookup is an outbound dependency on a third party | Accept for V1 |
| R-19 | Teachers whose class predates encrypted codes see the clear code once more on reveal, after which it is re-stored encrypted; housekeeping encrypts the rest at the next pass | Window is one housekeeping interval (6 h) after deploy | — | Accept |

## 3. Closed by the 2026-10-02 hardening set

H1 identity sign-in consent, H2 guardian withdrawal credential, H3 staff TOTP, M1 session lifetime, M2
assignment/feedback validation, M3 guardian ≠ student email, M4 sync quota, M5 append-only audit log and
per-account RLS scope, M6 password policy, L1 encrypted join codes, L2 CSRF secret length, L3 health
exposure — each with a regression test named in `docs/security/threat-model.md` §6.
