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
import { asyncHandler } from './asyncRouter.js';
import { asStore, isDatabaseOverload } from './store.js';
import { tagPolicy } from './routePolicy.js';
import { clipText } from './text.js';

/**
 * The version of the notice a guardian agreed to. Bump it whenever the privacy
 * notice changes in a way that alters what a guardian is agreeing to, so an old
 * consent is visibly an old consent rather than silently carried forward.
 */
// 2026-10-02: the notice's Children section now describes this flow (it said
// no consent was recorded), and its retention section changed.
export const CONSENT_NOTICE_VERSION = '2026-10-02';

/** What was established. Deliberately not the words "verifiable consent". */
export const CONSENT_METHOD = 'guardian-email-confirmation';

/**
 * A child whose age has been recorded but whose guardian contact has not yet
 * been supplied stays behind the same consent gate. Kept here (rather than in
 * otp.js) because account recovery/completion and OTP sign-up both create this
 * state.
 */
export const GUARDIAN_AWAITING_METHOD = 'awaiting-guardian-contact';

/** The classes whose students are children by definition. */
const CHILD_CLASS = /^(7|8|9|10|11|12)$/;

const clean = (value, max) => clipText(String(value ?? '').trim(), max);

/** Is this learner a child, on what they told us at signup? */
export function learnerIsChild({ isAdult } = {}) {
  // An explicit "I am 18 or older" is taken at its word; that is the only
  // declaration a service can make. Everything else — including saying nothing,
  // or naming no class — is treated as a child, because the safe default is the
  // protective one. (Failing open here once let a direct API call that sent
  // neither field skip the guardian gate.)
  return isAdult !== true;
}

/**
 * Did the request make an age declaration at all? `isAdult` must be a real
 * boolean, or the learner must name a school class (which makes them a child).
 * A request that says nothing is refused rather than guessed about.
 */
export function hasAgeDeclaration({ isAdult, year } = {}) {
  if (typeof isAdult === 'boolean') return true;
  return CHILD_CLASS.test(String(year ?? '').trim());
}

/**
 * The one age rule every account-creating path applies (/register and provider
 * sign-up): an explicit declaration is required, and a child must name a
 * guardian. Returns { ok, basis: 'adult'|'child', guardian } or { ok:false, code, message }.
 * The student's own address (body.studentEmail, else body.email) is passed to
 * validateGuardian so a child cannot name their own mailbox as the guardian's.
 */
export function ageDecision(body = {}, { guardianLater = false } = {}) {
  const declaration = { isAdult: body.isAdult, year: body.year };
  if (!hasAgeDeclaration(declaration)) {
    return { ok: false, code: 'AGE_DECLARATION_REQUIRED', message: 'Say whether you are 18 or older, or which class you are in.' };
  }
  if (!learnerIsChild(declaration)) return { ok: true, basis: 'adult', guardian: null };
  // guardianLater: the onboarding flow (otp.js) asks for the parent on the
  // next screen. The account is created as a child with a pending consent row
  // and no guardian yet, so the gate stays closed until a parent approves.
  if (guardianLater) return { ok: true, basis: 'child', guardian: null, guardianLater: true };
  const checked = validateGuardian({ ...body, studentEmail: body.studentEmail ?? body.email });
  if (!checked.ok) return { ok: false, code: checked.code, message: checked.message };
  return { ok: true, basis: 'child', guardian: checked };
}

/**
 * A guardian's details, or the reason they cannot be used. The guardian's
 * address must be somebody else's: a child who names their own mailbox would be
 * confirming their own account, which is no confirmation at all.
 */
export function validateGuardian({ guardianName, guardianEmail, studentEmail } = {}) {
  const name = clean(guardianName, 80);
  const email = clean(guardianEmail, 160).toLowerCase();
  if (!name) return { ok: false, code: 'GUARDIAN_NAME_REQUIRED', message: 'Enter a parent or guardian’s name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, code: 'GUARDIAN_EMAIL_REQUIRED', message: 'Enter a parent or guardian’s email address.' };
  }
  if (studentEmail && email === String(studentEmail).trim().toLowerCase()) {
    return { ok: false, code: 'GUARDIAN_EMAIL_SAME_AS_STUDENT', message: 'A parent or guardian’s email address must be different from the student’s own.' };
  }
  return { ok: true, name, email };
}

/**
 * Did the request say anything about the learner's age? A new account must
 * declare it (an explicit adult, or a child with a class), so an identity
 * provider sign-in cannot create an unconsented child account by saying
 * nothing. Password registration asks the same question on its form. The same
 * rule as hasAgeDeclaration (ageDecision applies it); kept as a named alias.
 */
export function ageDeclared(declaration = {}) {
  return hasAgeDeclaration(declaration);
}

/**
 * Record that a guardian has been asked. The token is stored only as a hash,
 * the same as every other account action here.
 */
export async function recordConsentRequest(db, { accountId, name, email, tokenHash, now = Date.now() }) {
  db = asStore(db);
  await db.run(`INSERT INTO guardian_consents
      (account_id, guardian_name, guardian_email, notice_version, requested_at, confirmed_at, withdrawn_at, method)
    VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      guardian_name = excluded.guardian_name,
      guardian_email = excluded.guardian_email,
      notice_version = excluded.notice_version,
      requested_at = excluded.requested_at,
      confirmed_at = NULL,
      withdrawn_at = NULL`, [accountId, name, email, CONSENT_NOTICE_VERSION, now, CONSENT_METHOD]);
  return { accountId, tokenHash };
}

/** The consent state of one account. */
export async function consentState(db, accountId) {
  db = asStore(db);
  // Age basis is the current authority for WHETHER consent is required except
  // for an explicit guardian withdrawal, which is permission-reducing and wins.
  // A historical pending/given row remains evidence of an earlier ceremony, not
  // authority to keep an explicitly-adult account blocked forever.
  const account = await db.get('SELECT age_basis FROM accounts WHERE id = ?', [accountId]);
  const basis = account?.age_basis ?? null;
  const row = await db.get('SELECT * FROM guardian_consents WHERE account_id = ?', [accountId]);

  // Withdrawal is permission-reducing authority and always wins, even if the
  // learner corrected their age basis after the guardian ceremony began. This
  // prevents a correction followed by a guardian withdrawal from silently
  // leaving cloud data enabled.
  if (row?.withdrawn_at) return { required: true, state: 'withdrawn', row, ageBasis: basis };

  if (basis === 'adult' || basis === 'legacy') {
    return { required: false, state: 'not-required', row: null, ageBasis: basis };
  }

  if (!row) {
    // A child whose request row is missing, or an account with no recorded age
    // decision, fails closed. The account-completion route can repair the latter
    // without weakening this gate.
    return { required: true, state: 'undeclared', row: null, ageBasis: basis };
  }
  if (row.confirmed_at) return { required: true, state: 'given', row, ageBasis: basis };
  return { required: true, state: 'pending', row, ageBasis: basis };
}

/** Exact account-action code for a consent state, or null when cloud use is allowed. */
export function consentBlockerCode(state) {
  if (!state?.required || state?.state === 'given') return null;
  if (state.state === 'undeclared') return 'AGE_DECLARATION_REQUIRED';
  if (state.state === 'pending') return 'GUARDIAN_CONSENT_PENDING';
  if (state.state === 'withdrawn') return 'GUARDIAN_CONSENT_WITHDRAWN';
  return 'GUARDIAN_CONSENT_UNAVAILABLE';
}

/** Mark a guardian's confirmation. Returns false when there was nothing to confirm. */
export async function confirmConsent(db, accountId, now = Date.now()) {
  db = asStore(db);
  // Withdrawal is terminal for the current consent ceremony. Confirmation must
  // never clear a withdrawal or re-grant sync permission from the same bearer;
  // a future re-consent flow must create a new request/authority explicitly.
  const changed = (await db.run(`UPDATE guardian_consents SET confirmed_at = ?
    WHERE account_id = ? AND confirmed_at IS NULL AND withdrawn_at IS NULL`, [now, accountId])).changes;
  return changed > 0;
}

/**
 * Withdraw it. Recorded rather than deleted, because the fact that consent was
 * given and then withdrawn is itself the thing a guardian may need shown back
 * to them — and because deleting the row would read as "never asked".
 */
export async function withdrawConsent(db, accountId, now = Date.now()) {
  db = asStore(db);
  const changed = (await db.run(`UPDATE guardian_consents SET withdrawn_at = ?
    WHERE account_id = ? AND withdrawn_at IS NULL`, [now, accountId])).changes;
  return changed > 0;
}

/**
 * Gate anything that sends a child's data to or from this server.
 *
 * Fail-closed: an account whose consent is pending or withdrawn is refused, and
 * so is one whose row cannot be read. An account with no row passes only if
 * its creation recorded an adult (accounts.age_basis 'adult', or 'legacy' for
 * accounts that predate the record); no recorded decision is refused.
 */
export function requireGuardianConsent(db) {
  db = asStore(db);
  return tagPolicy(asyncHandler(async (req, res, next) => {
    // The session is resolved here rather than read off the request, because
    // each sub-router establishes its own session INSIDE itself — so a gate
    // mounted in front of one runs before req.platformSession exists, and
    // reading it would silently let every request through. That is exactly
    // what this did until a test caught it.
    //
    // A lookup that FAILS is not "no session": it used to be caught and treated
    // as one, which sent the request on to the sub-router — whose own session
    // lookup could then succeed and run a child's sync with this gate skipped.
    // It now propagates: a database outage is the coded, retryable 503, and
    // anything else is a 500. Neither ever passes through.
    let accountId = req.platformSession?.account_id;
    if (!accountId) accountId = (await sessionFromRequest(db, req))?.account_id;
    // No session at all: the sub-router's own requireSession will answer 401.
    // This gate is about consent, not authentication.
    if (!accountId) return next();
    let state;
    try { state = await consentState(db, accountId); }
    catch (error) {
      // A database outage or overload is not a refusal: answering it with a
      // 403 told the device its sync was forbidden rather than "retry shortly".
      // It goes to the /v1 error handler as the coded, retryable 503 it is.
      if (isDatabaseOverload(error)) throw error;
      return refuse(res, 'GUARDIAN_CONSENT_UNAVAILABLE', 'This account cannot sync right now.');
    }
    const blocker = consentBlockerCode(state);
    if (!blocker) return next();
    if (blocker === 'AGE_DECLARATION_REQUIRED') {
      return refuse(res, blocker,
        'This account has no age on record, so it cannot sync until one is given. Your work stays on this device.');
    }
    if (blocker === 'GUARDIAN_CONSENT_PENDING') {
      return refuse(res, blocker,
        'A parent or guardian needs to confirm this account. Until they do, your work stays on this device — nothing is lost.');
    }
    if (blocker === 'GUARDIAN_CONSENT_WITHDRAWN') {
      return refuse(res, blocker,
        'A parent or guardian has withdrawn permission for this account to sync. Your work stays on this device.');
    }
    return refuse(res, blocker, 'This account cannot sync right now.');
  }), { guardianConsent: true });
}

function refuse(res, code, message) {
  // 403 rather than 402 or 429: this is a permission that has not been given,
  // and the student can neither pay nor wait their way past it.
  return res.status(403).json({ error: { code, message } });
}

/** The hash a confirmation link is looked up by. */
export const consentTokenHash = (raw) => sha256(String(raw));
