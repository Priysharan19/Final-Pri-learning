# Data retention and account lifecycle

**Status:** engineering statement of what the code does today. **Not legally reviewed**
(V1 blocker #10/#12 — legal sign-off is `BLOCKED_EXTERNAL`). Where a period below depends on
law rather than code, it is marked *proposed* and must be confirmed by counsel before release.

**Enforced by:** `server/test/account-lifecycle-journey-check.mjs`, which runs on SQLite
(`npm run test:platform`) and on Postgres as the `pri_server` role (`npm run test:platform:pg`).
It encodes the table below as data, drives a real account through deletion over HTTP, and then
scans **every** table in the database for the deleted address, name and account id. A table
added later that keeps any of them fails that scan until this document and the deletion path
are updated together.

The user-facing summary is `docs/legal/privacy.md` ("How long we keep it"). If this document
and the notice disagree, the code is checked and one of them is wrong.

---

## 1. Account states

There is no deletion grace period. `accounts.deleted_at` exists in the schema but is never set:
deletion is a hard `DELETE` in one transaction, effective immediately.

| State | How an account enters it | API behaviour | UI behaviour |
| --- | --- | --- | --- |
| **Unverified** | `POST /v1/account/register` (201, `verificationRequired: true`) | Signed in. `/me` reports `emailVerified: false`. `POST /sync/push`, `POST /classes`, `POST /classes/join`, `POST /billing/checkout/web`, `POST /handwriting/transcribe`, `POST /working/check` answer **403 `EMAIL_UNVERIFIED`**. Export, devices, logout, logout-all, password change, deletion and resend all work. | Cloud panel shows the verification prompt; practice, marking and on-device handwriting are unaffected. |
| **Active** | The one-time link from the `verify-email` outbox row is spent (`POST /email/verify`) | Every route the role allows. | Normal. |
| **Guardian consent required** (under 18) | Registration with `isAdult` not `true` and a guardian name + email (the shipped client sends `isAdult: false` unless the student ticks "I am 18 or older") | Sign-in, `/me`, verification, `/guardian/state`, export, devices, logout(-all), password change and deletion work. **Every other cloud route fails closed with 403 `GUARDIAN_CONSENT_PENDING`** (or `_WITHDRAWN`, or `_UNAVAILABLE` if the consent row cannot be read): `/sync`, `/classes`, `/assignments`, `/reports`, `/telemetry`, `/billing`, `/handwriting`, `/working`. Confirmation (`POST /guardian/confirm`, one-time, 1 h) opens them; withdrawal (`POST /guardian/withdraw`) closes them again, permanently for that ceremony. | Cloud panel shows "waiting for a parent or guardian" with the masked address; the app is fully usable offline. |
| **Deleted** | `DELETE /v1/account` with fresh proof (current password, or a fresh Apple/Google identity token + server nonce) | Every session token is dead (401 `AUTH_REQUIRED`); login answers 401 `BAD_CREDENTIALS` exactly as for a wrong password; every outstanding verification/reset/guardian link answers 400 `TOKEN_INVALID`. The address is free: registering it again creates a new, empty, unverified account with a new id. | Signed out; local profiles on the device are untouched (they were never the server's). |

A web subscription is cancelled at the provider (immediately, not at cycle end) **before** the rows
are deleted; if the provider cannot confirm the cancellation, deletion is refused with
`BILLING_PROVIDER_REQUEST_FAILED` and nothing is deleted (`platform-http-journeys-check.mjs`).
An Apple subscription cannot be cancelled by the server; the student must cancel it in their
Apple ID settings (residual risk, §6).

### Sessions

| Event | Effect |
| --- | --- |
| Login / register | New opaque 32-byte token; only its SHA-256 is stored. |
| Use | Sliding expiry: at most once a minute, `expires_at` moves to now + 30 days and the cookie is re-issued with the full lifetime. The token itself is not rotated on use. |
| Logout | That session's row is revoked; cookies cleared. |
| Logout-all (`POST /v1/account/logout-all`) | Every unrevoked session of the account is revoked, including the caller's. |
| Password change | Every session revoked; the requesting device gets a fresh token. |
| Password reset | Every session revoked; no session is issued (sign in again). |
| Deletion | Rows deleted (cascade). |

### One-time links

Verify-email and reset-password links live 1 hour; guardian-confirmation links 1 hour. Each is
stored as a SHA-256 hash in `account_tokens`, delivered through `auth_delivery_outbox` as an
AES-GCM envelope bound to the token id, and spent with a compare-and-set so exactly one request
can use it. Requesting a new link of the same kind supersedes (spends) the older one. Expired,
superseded and replayed links all answer 400 `TOKEN_INVALID`.

---

## 2. What deletion does, table by table

"Deleted" means the row is gone. "Retained, unlinked" means the row stays with its account
column set to `NULL` by `ON DELETE SET NULL`; nothing in it names, contains or links to the
person. Location for every row is the platform database: SQLite on the Railway volume, or the
`pri` schema on Supabase Postgres (Mumbai) after cutover.

### Deleted immediately

| Table | What it held |
| --- | --- |
| `accounts` | email, name, bcrypt password hash, role, timestamps |
| `account_identities` | password / Apple / Google sign-in links (provider subject, email at link) |
| `account_sessions` | session token hashes, device ids, user-agent hashes |
| `account_tokens` | one-time link hashes |
| `auth_delivery_outbox` | encrypted link envelopes and destination addresses (including a guardian's) |
| `guardian_consents` | guardian name and email, notice version, confirmation/withdrawal times |
| `learning_events` | synced attempts, progress and mastery events |
| `sync_entities` | synced profile, settings, bookmarks, favourites, tasks, custom questions |
| `idempotency_keys` | cached sync responses |
| `entitlement_snapshots` | current plan |
| `operational_events` | allow-listed telemetry |
| `class_members` | class memberships (as a student) |
| `assignment_submissions` | aggregate assignment progress |
| `assignment_feedback` | teacher feedback addressed to the student |
| `billing_subscriptions` | provider subscription ↔ account binding, cancellation state |
| `billing_trial_claims` | trial-eligibility reservation |
| `billing_apple_accounts` | the StoreKit `appAccountToken` |

If the deleted account is a **teacher**, `classes` and `assignments` they own cascade too, which
removes their students' memberships, submissions and feedback for those classes (§6).

### Retained, unlinked

| Table | What remains | Why | For how long |
| --- | --- | --- | --- |
| `billing_payments` | provider, provider payment id, provider subscription id, amount (paise), currency, status, timestamps. `account_id` → `NULL`. | Record of money actually taken: tax/accounting, refunds and chargebacks arriving after deletion. Changed in billing schema 4 (`supabase/migrations/20261003000000_billing_payment_retention.sql`); before it, the cascade deleted the ledger. | *Proposed:* 8 years (Companies Act 2013 s.128(5); GST record-keeping). **No automated purge exists yet.** |
| `billing_refunds` | provider refund id, payment id, amount, status | Same ledger. Never had an account column. | As `billing_payments`. |
| `billing_events` | provider, event id, event type, verified flag, SHA-256 digest of the payload, timestamps. `account_id` → `NULL`. | Webhook idempotency (a replayed event must not re-apply) and an audit trail of what the provider told us. The payload itself is never stored. | As `billing_payments`. |
| `issue_reports` | category, content/question id, app and curriculum version, status. `account_id` → `NULL`; **`note` and `context_json` are cleared in the deletion transaction** (they can hold free text the student typed). | Content-quality: a "wrong answer" report about a question stays useful after the reporter leaves. | Until resolved/dismissed and pruned (no automated purge yet). |
| `audit_log` | action, target kind/id, non-personal metadata, timestamp. `actor_account_id` → `NULL`. One `account.delete` row whose `target_id` is the deleted (now unresolvable) account id and whose metadata is `{}`. | Security and billing audit trail; proof a deletion happened. Metadata never carries email, name or free text (checked by the PII scan). Some rows may carry the deleted account's opaque id as `target_id` or `studentId`; with the account row gone it resolves to nobody. | *Proposed:* 2 years. No automated purge yet. |
| `teacher_invites.used_by`, `content_revisions.author/reviewer_account_id`, `feature_flags.updated_by` | Set to `NULL`. | Staff tooling history. | Indefinite. |

### Short-lived rows keyed by a hash, not by the account

| Table | Key | Lifetime |
| --- | --- | --- |
| `login_attempts` | SHA-256 of the submitted email | Purged by housekeeping after the lockout window |
| `rate_limits` | SHA-256 of account id or IP | Purged by housekeeping after 24 h |
| `oidc_nonces` | nonce hash | Purged by housekeeping after expiry |

### Not deleted by account deletion

- **Device data.** Local profiles, progress, ink and learned handwriting live in the device's own
  storage and are deleted from Settings on that device, not by the server.
- **Backups.** SQLite backups made by `server/tools/backup.mjs` (`--keep N`, default prune count set
  by the operator) and Supabase point-in-time backups contain deleted data until they age out.
  The retention of those backups is a deployment setting, not code; it must be stated in the
  release evidence for the exact deployment.
- **Logs.** The request log records method, path, status and latency only
  (`server/app.js requestLogger`, asserted by `security-headers-check.mjs`); the error log records
  request id, path, method, code and status. Neither records bodies, tokens, emails or images.
  Railway's own log retention applies to these lines.
- **Email provider.** Verification/reset/guardian emails already delivered sit in the
  recipient's mailbox and in the email provider's delivery logs under its own retention.

There are **no storage buckets**: the server writes no files other than the SQLite database and
its backups, and uses no Supabase Storage, S3 or similar.

---

## 3. Data export

`GET /v1/account/export` (`pri-account-export-v1`, `Cache-Control: no-store`) returns: the profile
(id, email, name, role, verification and timestamps), sign-in methods (provider + link time,
never the provider subject), learning events, sync entities, current class memberships,
assignment submissions, the account's own issue reports, an entitlement summary (plan, status,
provider, period end) and, for an under-18 account, the consent state with the guardian address
masked. It never contains password, token or user-agent hashes, delivery envelopes, the session
cookie, or anything of another account (teacher, classmates, guardian in full) — asserted on both
engines.

---

## 4. Handwriting, photos and working sent to the cloud

What is true in the code today:

- **Off by default, per profile.** `cloudHandwriting` and the working-check setting are opt-in
  switches in Settings; both need a signed-in, verified cloud account, and for an under-18 account
  a confirmed guardian (`/handwriting` and `/working` are behind `requireGuardianConsent`).
- **What is sent.** For ink, a PNG rasterised on the device from the student's own stroke
  coordinates (`client/src/ink/cloudRaster.js`) — no question, expected answer, name or profile;
  the server refuses any body carrying those fields (`HANDWRITING_NOT_ANSWER_BLIND`). For a photo
  of paper working, the camera image resized and re-encoded — whatever is in the frame. For the
  working check, the written lines and the question text, never the expected answer.
- **Pri's server does not persist it.** The image is held in memory for the length of the
  request (≤ 750,000 decoded bytes), forwarded to the configured provider, and dropped. It is not
  written to the database, to disk, to a bucket or to any log. The response (the transcription
  text) is returned to the device and is likewise not stored server-side.
- **The provider.** By default `https://api.openai.com/v1/responses` (configurable with
  `PRI_HANDWRITING_ENDPOINT`). Every request sets `store: false`
  (`server/platform/handwritingProvider.js`, `server/platform/workingProvider.js`).
  **What `store: false` does and does not mean:** it tells the Responses API not to keep the
  response object for later retrieval. It is *not* a zero-data-retention agreement: under the
  provider's standard API terms, inputs may be retained for a limited period (OpenAI states up to
  30 days) for abuse and misuse monitoring, and are not used for training by default. No
  zero-data-retention arrangement is recorded for this deployment; if one is made, this section
  and the notice must say so. Earlier code comments said "nothing is retained by the provider";
  that overstated it and has been corrected.
- **Turning the setting off** stops the next request; nothing already sent can be recalled from
  the provider by Pri.

### Wording audit (V1 blocker #10)

Every in-app and legal sentence that claimed or implied handwriting never leaves the device, and
what was done:

| Where | Before | Now |
| --- | --- | --- |
| `strings.en.js` `app.dataStaysHere` (account menu) | "All data stays on this device — private by design." | Stored on this device; nothing sent unless a cloud account or server reading is switched on. |
| `strings.en.js` `login.heroPrivacy` | "…profiles, progress and handwriting stay on this device…" | Stored on this device; handwriting read on a server only if switched on. |
| `strings.en.js` `login.point4` | "…stays on this device unless you choose cloud sync" | "…unless you choose cloud sync or server reading". |
| `strings.en.js` `settings.cloudHandwritingCopy` | Did not say where the picture goes or what is kept. | Names the outside reading service, that Pri keeps no copy, and that the service may hold it briefly. |
| `docs/legal/privacy.md` handwriting/photo paragraph | "…is not kept after that, not used to train anyone's model" | Pri keeps no copy; the provider may for a limited period under its own policy. |
| `docs/legal/privacy.md` working-check paragraph | "…is not kept afterwards" | Same correction. |
| `docs/legal/privacy.md` Children | "does not ask for or record a parent's consent" (false since #210) | Describes the shipped confirmation flow and says plainly it is not verifiable parental consent. |
| `docs/legal/privacy.md` How long we keep it | "When you delete your account, we delete your data." | Immediate deletion, plus the three unlinked retentions above. |
| `docs/legal/README.md` | "Handwriting strokes are not uploaded by the shipped app." | Strokes stay; an opt-in raster/photo is sent. |
| `server/platform/handwritingProvider.js` header | "Nothing is retained by the provider (`store: false`)" | States what `store: false` does and does not do. |

Hindi counterparts (`strings.hi.js`, `privacy.hi.md`) were changed with them. Sentences that
remain and are accurate: `login.authFoot` (nothing leaves without a cloud account — server reading
requires one), `settings.accountsValue`, `settings.cloudOffFor`, `settings.handwritingBrowser`
("corrections stay local" — they do), `client/src/native/photo.js` (the on-device OCR path).

---

## 5. Under-18 accounts

The confirmation shows only that someone with access to the guardian's mailbox followed a link
(`guardian_consents.method = 'guardian-email-confirmation'`). It is not verifiable parental consent
under DPDP Rule 10 (commencing 14 May 2027) and must not be described as such. The consent notice
version was bumped to `2026-10-02` with this change, so consents given against the earlier notice
are distinguishable.

---

## 6. Residual risks and open items

- **Real email delivery** (verification, reset, guardian) is not proven: the journey reads the
  outbox, which is exactly what the delivery worker sends, but no message reaches a real inbox in
  CI. `BLOCKED_EXTERNAL` (email provider credentials and a live deployment).
- **Legal review** of this document, the periods marked *proposed*, and both language versions of
  the notice: `BLOCKED_EXTERNAL`.
- **No automated purge** for retained billing ledger, issue reports or audit log rows.
- **Teacher deletion** removes the teacher's classes and, with them, their students' submissions
  and feedback in those classes. Students keep their own synced learning data.
- **Apple subscriptions** are not cancelled by deletion (the server cannot); the deletion UI must
  tell the student to cancel in Apple ID settings.
- **Provider-side retention** of cloud-handwriting inputs is governed by the provider, not Pri.
- **Backups** retain deleted data until they age out; the period is per deployment.
