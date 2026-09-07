// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a guardian's confirmation before a child's data leaves
//
// Under the DPDP Act a child is anyone under 18 — no COPPA-style under-13 line,
// no GDPR-style 13-to-16 tier — and every Class 7 to 12 student is one. The app
// asks which class you are in at signup, so it cannot claim not to know.
//
// WHERE THE LINE IS. A profile on the device is not ours to consent to: it
// never reaches this server, and nothing about it is processed by anybody. A
// cloud account is, so the consent gates the cloud account and nothing else.
// That is what makes gating it acceptable rather than a wall — the whole app,
// including every question, all the marking and all the handwriting, works with
// no account at all.
//
// WHAT THIS ACTUALLY ESTABLISHES, said plainly because the privacy notice has
// to repeat it: somebody with access to the guardian's mailbox followed a link.
// That is all. It does NOT establish that they are an adult, and it does not
// establish that they are this child's parent, which is what Rule 10 will
// require from 14 May 2027 — by identity details the fiduciary already reliably
// holds, or a DigiLocker token. Nothing here may be called "verifiable parental
// consent", and the method is written into every row so no later reader can
// mistake it for more than it is.
//
// Withdrawal is as easy as giving it: the same email carries a withdraw link,
// and withdrawing stops sync at once.
// ─────────────────────────────────────────────────────────────────────────────
import { sessionFromRequest, sha256 } from './security.js';

/**
 * The version of the notice a guardian agreed to. Bump it whenever the privacy
 * notice changes in a way that alters what a guardian is agreeing to, so an old
 * consent is visibly an old consent rather than silently carried forward.
 */
export const CONSENT_NOTICE_VERSION = '2026-09-07';

/** What was established. Deliberately not the words "verifiable consent". */
export const CONSENT_METHOD = 'guardian-email-confirmation';

/** The classes whose students are children by definition. */
const CHILD_CLASS = /^(7|8|9|10|11|12)$/;

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

/** Is this learner a child, on what they told us at signup? */
export function learnerIsChild({ isAdult, year } = {}) {
  // An explicit "I am 18 or older" is taken at its word; that is the only
  // declaration a service can make. Everything else — including saying nothing —
  // is treated as a child, because the safe default is the protective one.
  if (isAdult === true) return false;
  if (isAdult === false) return true;
  return CHILD_CLASS.test(String(year ?? '').trim());
}

/** A guardian's details, or the reason they cannot be used. */
export function validateGuardian({ guardianName, guardianEmail } = {}) {
  const name = clean(guardianName, 80);
  const email = clean(guardianEmail, 160).toLowerCase();
  if (!name) return { ok: false, code: 'GUARDIAN_NAME_REQUIRED', message: 'Enter a parent or guardian’s name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, code: 'GUARDIAN_EMAIL_REQUIRED', message: 'Enter a parent or guardian’s email address.' };
  }
  return { ok: true, name, email };
}

/**
 * Record that a guardian has been asked. The token is stored only as a hash,
 * the same as every other account action here.
 */
export function recordConsentRequest(db, { accountId, name, email, tokenHash, now = Date.now() }) {
  db.prepare(`INSERT INTO guardian_consents
      (account_id, guardian_name, guardian_email, notice_version, requested_at, confirmed_at, withdrawn_at, method)
    VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      guardian_name = excluded.guardian_name,
      guardian_email = excluded.guardian_email,
      notice_version = excluded.notice_version,
      requested_at = excluded.requested_at,
      confirmed_at = NULL,
      withdrawn_at = NULL`)
    .run(accountId, name, email, CONSENT_NOTICE_VERSION, now, CONSENT_METHOD);
  return { accountId, tokenHash };
}

/** The consent state of one account. */
export function consentState(db, accountId) {
  const row = db.prepare('SELECT * FROM guardian_consents WHERE account_id = ?').get(accountId);
  if (!row) return { required: false, state: 'not-required' };
  if (row.withdrawn_at) return { required: true, state: 'withdrawn', row };
  if (row.confirmed_at) return { required: true, state: 'given', row };
  return { required: true, state: 'pending', row };
}

/** Mark a guardian's confirmation. Returns false when there was nothing to confirm. */
export function confirmConsent(db, accountId, now = Date.now()) {
  const changed = db.prepare(`UPDATE guardian_consents SET confirmed_at = ?, withdrawn_at = NULL
    WHERE account_id = ? AND confirmed_at IS NULL`).run(now, accountId).changes;
  return changed > 0;
}

/**
 * Withdraw it. Recorded rather than deleted, because the fact that consent was
 * given and then withdrawn is itself the thing a guardian may need shown back
 * to them — and because deleting the row would read as "never asked".
 */
export function withdrawConsent(db, accountId, now = Date.now()) {
  const changed = db.prepare(`UPDATE guardian_consents SET withdrawn_at = ?
    WHERE account_id = ? AND withdrawn_at IS NULL`).run(now, accountId).changes;
  return changed > 0;
}

/**
 * Gate anything that sends a child's data to or from this server.
 *
 * Fail-closed: an account whose consent is pending or withdrawn is refused, and
 * so is one whose row cannot be read. An account with no row at all is an adult
 * or a pre-existing account and passes — the row is written at registration
 * precisely so that "no row" is unambiguous.
 */
export function requireGuardianConsent(db) {
  return (req, res, next) => {
    // The session is resolved here rather than read off the request, because
    // each sub-router establishes its own session INSIDE itself — so a gate
    // mounted in front of one runs before req.platformSession exists, and
    // reading it would silently let every request through. That is exactly
    // what this did until a test caught it.
    let accountId = req.platformSession?.account_id;
    if (!accountId) {
      try { accountId = sessionFromRequest(db, req)?.account_id; } catch { accountId = null; }
    }
    // No session at all: the sub-router's own requireSession will answer 401.
    // This gate is about consent, not authentication.
    if (!accountId) return next();
    let state;
    try { state = consentState(db, accountId); }
    catch { return refuse(res, 'GUARDIAN_CONSENT_UNAVAILABLE', 'This account cannot sync right now.'); }
    if (!state.required || state.state === 'given') return next();
    if (state.state === 'pending') {
      return refuse(res, 'GUARDIAN_CONSENT_PENDING',
        'A parent or guardian has been emailed to confirm this account. Until they do, your work stays on this device — nothing is lost.');
    }
    return refuse(res, 'GUARDIAN_CONSENT_WITHDRAWN',
      'A parent or guardian has withdrawn permission for this account to sync. Your work stays on this device.');
  };
}

function refuse(res, code, message) {
  // 403 rather than 402 or 429: this is a permission that has not been given,
  // and the student can neither pay nor wait their way past it.
  return res.status(403).json({ error: { code, message } });
}

/** The hash a confirmation link is looked up by. */
export const consentTokenHash = (raw) => sha256(String(raw));
