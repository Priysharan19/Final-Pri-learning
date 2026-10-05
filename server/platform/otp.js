// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · /v1/account/otp — sign up and sign in with a one-time code,
// and a parent's approval by code.
//
// NO ACCOUNT ENUMERATION. /request answers the same shape, status and work for
// an address that has an account and one that does not: a challenge is always
// created and a code always sent (a code to a new address is how sign-up
// starts). Only someone who has proved they hold the address learns whether an
// account exists, at /verify.
//
// A CHILD STAYS LIMITED. An account created here for a learner under 18 gets a
// pending guardian_consents row in the same transaction, so every gated /v1
// route (sync, classes, handwriting, tutor, billing…) refuses it until a parent
// approves — by an SMS/email code entered on the consent screen, or by the
// existing emailed link. Practice and marking never needed the server and keep
// working. The method actually used is written into the row.
// ─────────────────────────────────────────────────────────────────────────────
import { asyncRouter } from './asyncRouter.js';
import { asStore, isUniqueViolation } from './store.js';
import { consumeRateLimit, createSession, id, rateLimit, requireSession, sha256 } from './security.js';
import {
  OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS, createChallenge, destinationHash, ensureOtpSchema, maskPhone,
  normalizeDestination, normalizeEmail, normalizePhone, retireChallenge, verifyChallenge
} from './otpCore.js';
import { createSmsProviderFromEnv } from './smsProvider.js';
import { createOtpEmailSenderFromEnv } from './otpEmail.js';
import { CONSENT_NOTICE_VERSION, ageDecision, confirmConsent, consentState, withdrawConsent } from './guardianConsent.js';
import { deleteAccountRows, queueAccountToken } from './accounts.js';
import { maybeBootstrapAdmin } from './bootstrapAdmin.js';
import { clipText } from './text.js';
import { logEvent, safeCode } from './observability.js';

/** Codes one destination may be sent per hour, whoever asks. */
export const OTP_DESTINATION_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
/** Synthetic, undeliverable address for an account that signed up by phone (RFC 2606 .invalid). */
export const PHONE_ACCOUNT_EMAIL_DOMAIN = 'phone.invalid';

export const GUARDIAN_PHONE_METHOD = 'guardian-phone-otp';
export const GUARDIAN_EMAIL_OTP_METHOD = 'guardian-email-otp';
export const GUARDIAN_AWAITING_METHOD = 'awaiting-guardian-contact';
/** Every withdraw-request answers no sooner than this, match or not. */
export const WITHDRAW_REQUEST_FLOOR_MS = 900;

const invalidCode = (res, extra = {}) => res.status(400).json({ error: { code: 'OTP_INVALID', message: 'That code is not right, or it has expired. Check it, or ask for a new one.', ...extra } });
const bad = (res, code, message, status = 400) => res.status(status).json({ error: { code, message } });

export function publicOtpAccount(row, phone = null) {
  const synthetic = String(row.email || '').endsWith(`@${PHONE_ACCOUNT_EMAIL_DOMAIN}`);
  return {
    id: row.account_id || row.id,
    email: synthetic ? null : row.email,
    phone: phone ? maskPhone(phone) : null,
    name: row.name,
    role: row.role,
    emailVerified: !!row.email_verified_at && !synthetic
  };
}

function profileFrom(body) {
  const profile = body && typeof body.profile === 'object' && body.profile ? body.profile : null;
  if (!profile) return null;
  const name = clipText(String(profile.name || '').trim(), 80);
  if (!name) return { error: 'PROFILE_NAME_REQUIRED', message: 'Tell us your name.' };
  const year = profile.year == null ? undefined : String(profile.year).trim().slice(0, 4);
  // The one shared age rule (guardianConsent.js ageDecision, as /register and
  // provider sign-up): an explicit declaration is required, fail closed. The
  // parent is asked on the next screen, so guardianLater.
  const decision = ageDecision({ isAdult: profile.isAdult, year }, { guardianLater: true });
  if (!decision.ok) return { error: decision.code, message: decision.message };
  return { name, basis: decision.basis };
}

export function createOtpRouter(db, {
  smsProvider = undefined,
  emailSender = undefined,
  beforeDelete = null,
  env = process.env
} = {}) {
  db = asStore(db);
  ensureOtpSchema(db);
  // Resolved once, at mount. A misconfigured provider (test mode in production)
  // throws here, which stops the server booting rather than shipping it.
  const sms = smsProvider === undefined ? createSmsProviderFromEnv(env) : smsProvider;
  const sendEmail = emailSender === undefined ? createOtpEmailSenderFromEnv(env) : emailSender;
  const publicOrigin = env.PRI_PUBLIC_ORIGIN;
  const router = asyncRouter();

  async function deliver({ channel, destination, purpose, accountId = null, intent = null, now = Date.now() }) {
    if (channel === 'sms' && !sms) throw Object.assign(new Error('Phone codes are not available yet.'), { code: 'OTP_SMS_NOT_CONFIGURED', status: 503 });
    if (channel === 'email' && !sendEmail) throw Object.assign(new Error('Email codes are not available yet.'), { code: 'OTP_EMAIL_NOT_CONFIGURED', status: 503 });
    const providerName = channel === 'sms' ? sms.name : 'email';
    const delegated = channel === 'sms' && sms.generatesCode;
    const challenge = await createChallenge(db, { channel, purpose, destination, accountId, providerName, providerGeneratesCode: delegated, now });
    try {
      if (channel === 'email') await sendEmail({ challengeId: challenge.challengeId, to: destination, code: challenge.code, purpose, intent });
      else if (delegated) await sms.start({ to: destination, purpose });
      else await sms.send({ to: destination, code: challenge.code, purpose, publicOrigin });
    } catch (error) {
      await retireChallenge(db, challenge.challengeId);
      logEvent('warn', 'otp.delivery_failed', { channel, purpose, code: safeCode(error?.code) });
      throw Object.assign(new Error('The code could not be sent. Try again in a moment.'), { code: 'OTP_DELIVERY_FAILED', status: 503 });
    }
    return { challengeId: challenge.challengeId, expiresInMs: OTP_TTL_MS, resendAfterMs: OTP_RESEND_COOLDOWN_MS };
  }

  const delegatedCheck = (channel) => (channel === 'sms' && sms?.generatesCode)
    ? (destination, code) => sms.check({ to: destination, code })
    : null;

  /** Per-destination limits: a cooldown between sends and an hourly cap. Independent of whether an account exists. */
  async function destinationAllowed(channel, destination, purpose) {
    const key = destinationHash(channel, destination).slice(0, 32);
    const cooldown = await consumeRateLimit(db, `otp-cooldown:${purpose}:${key}`, { limit: 1, windowMs: OTP_RESEND_COOLDOWN_MS });
    if (!cooldown.allowed) return { allowed: false, retryAfterMs: Math.max(1000, cooldown.resetAt - Date.now()) };
    const hourly = await consumeRateLimit(db, `otp-destination:${key}`, OTP_DESTINATION_LIMIT);
    if (!hourly.allowed) return { allowed: false, retryAfterMs: Math.max(1000, hourly.resetAt - Date.now()) };
    return { allowed: true };
  }

  function sendError(res, error) {
    if (error?.status) return bad(res, error.code || 'OTP_UNAVAILABLE', error.message, error.status);
    throw error;
  }

  router.post('/request', rateLimit(db, 'otp-request', { limit: 20, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const channel = req.body?.channel === 'sms' ? 'sms' : req.body?.channel === 'email' ? 'email' : null;
    const destination = channel ? normalizeDestination(channel, req.body?.destination) : null;
    if (!destination) {
      return bad(res, 'OTP_DESTINATION_INVALID', channel === 'sms' ? 'Enter a 10-digit mobile number.' : 'Enter a valid email address.');
    }
    const limit = await destinationAllowed(channel, destination, 'sign-in');
    if (!limit.allowed) {
      res.set('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)));
      return bad(res, 'OTP_RATE_LIMITED', 'Wait a moment before asking for another code.', 429);
    }
    try {
      const sent = await deliver({ channel, destination, purpose: 'sign-in' });
      res.status(202).json({ ok: true, channel, ...sent });
    } catch (error) { return sendError(res, error); }
  });

  router.post('/verify', rateLimit(db, 'otp-verify', { limit: 30, windowMs: 15 * 60 * 1000 }), async (req, res, next) => {
    try {
      const channel = req.body?.channel === 'sms' ? 'sms' : req.body?.channel === 'email' ? 'email' : null;
      const destination = channel ? normalizeDestination(channel, req.body?.destination) : null;
      if (!destination) return invalidCode(res);
      const challengeId = String(req.body?.challengeId || '');
      const now = Date.now();
      const deviceId = String(req.body?.deviceId || 'web').slice(0, 160);

      // Look the account up first so a new-address verify without a profile
      // can answer "profile required" WITHOUT spending the code: the learner
      // then fills in age and class and submits the same code once more.
      const existing = channel === 'email'
        ? await db.get(`SELECT * FROM accounts WHERE ${db.emailEquals('email')} AND deleted_at IS NULL`, [destination])
        : await db.get(`SELECT a.* FROM account_phones p JOIN accounts a ON a.id = p.account_id
            WHERE p.phone_e164 = ? AND a.deleted_at IS NULL`, [destination]);
      const profile = existing ? null : profileFrom(req.body);
      if (profile?.error) return bad(res, profile.error, profile.message || 'Tell us your name.');

      if (!existing && !profile) {
        // Peek only: is the code right? Counted as an attempt like any other,
        // but not spent, so the same code completes sign-up.
        const peek = await db.get('SELECT id FROM otp_challenges WHERE id = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?', [challengeId.slice(0, 80), 'sign-in', now]);
        if (!peek) return invalidCode(res);
        const check = await verifyChallenge(db, { challengeId, channel, purpose: 'sign-in', destination, code: req.body?.code, delegatedCheck: delegatedCheck(channel), now });
        if (!check.ok) return invalidCode(res, check.attemptsRemaining != null ? { attemptsRemaining: check.attemptsRemaining } : {});
        // Re-open the challenge we just spent so the follow-up can spend it, and
        // reissue it under a fresh id: the old id is dead, and only the client
        // that proved the code learns the new one.
        const reissued = id('otp');
        await db.run(`UPDATE otp_challenges SET id = ?, consumed_at = NULL, code_hash = ?, expires_at = ?
          WHERE id = ?`, [reissued, `ticket:${sha256(reissued)}`, Math.min(check.challenge.expires_at, now + OTP_TTL_MS), check.challenge.id]);
        return res.json({ status: 'profile-required', signupTicket: reissued });
      }

      // A sign-up ticket (from profile-required) replaces the code.
      const ticket = String(req.body?.signupTicket || '');
      let verified;
      if (ticket && !existing) {
        const row = await db.get('SELECT * FROM otp_challenges WHERE id = ?', [ticket.slice(0, 80)]);
        const okTicket = row && row.code_hash === `ticket:${sha256(ticket)}` && row.purpose === 'sign-in' && row.channel === channel
          && row.destination_hash === destinationHash(channel, destination) && !row.consumed_at && row.expires_at > now;
        if (!okTicket) return invalidCode(res);
        const spent = await db.run('UPDATE otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL', [now, row.id]);
        if (spent.changes !== 1) return invalidCode(res);
        verified = { ok: true };
      } else {
        verified = await verifyChallenge(db, { challengeId, channel, purpose: 'sign-in', destination, code: req.body?.code, delegatedCheck: delegatedCheck(channel), now });
      }
      if (!verified.ok) return invalidCode(res, verified.attemptsRemaining != null ? { attemptsRemaining: verified.attemptsRemaining } : {});

      if (existing) {
        if (channel === 'email' && !existing.email_verified_at) {
          // PRE-REGISTRATION TAKEOVER. Until now nobody had proved this mailbox:
          // whoever registered it with a password may not own it. The code just
          // proved ownership, so everything the unproven registrant set up goes:
          // their password, every session and every pending token. The owner
          // can set a password again later through reset.
          await db.transaction(async () => {
            await db.run('UPDATE accounts SET email_verified_at = ?, password_hash = NULL, updated_at = ? WHERE id = ?', [now, now, existing.id]);
            await db.run('UPDATE account_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL', [now, existing.id]);
            await db.run('DELETE FROM auth_delivery_outbox WHERE account_id = ? AND delivered_at IS NULL', [existing.id]);
            await db.run(`UPDATE account_tokens SET consumed_at = ? WHERE account_id = ? AND consumed_at IS NULL
              AND purpose IN ('verify-email','reset-password')`, [now, existing.id]);
            await db.run('INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)',
              [existing.id, 'account.first-verified-by-otp', 'account', existing.id, JSON.stringify({ passwordCleared: !!existing.password_hash }), now]);
          });
        }
        await maybeBootstrapAdmin(db, existing.id, now);
        await createSession(db, res, existing.id, deviceId, req.get('user-agent') || '', now);
        const account = await db.get('SELECT * FROM accounts WHERE id = ?', [existing.id]);
        const phone = channel === 'sms' ? destination : null;
        const consent = await consentState(db, existing.id);
        return res.json({ status: 'signed-in', created: false, account: publicOtpAccount(account, phone), guardianConsent: { required: consent.required, state: consent.state } });
      }

      const accountId = id('acct');
      const child = profile.basis === 'child';
      const accountEmail = channel === 'email' ? destination : `${accountId}@${PHONE_ACCOUNT_EMAIL_DOMAIN}`;
      try {
        await db.transaction(async () => {
          // email_verified_at records that the account's primary contact was
          // proved by a code. For a phone account that contact is the phone;
          // the synthetic address is never shown and never deliverable.
          await db.run(`INSERT INTO accounts(id,email,name,password_hash,email_verified_at,role,age_basis,created_at,updated_at)
            VALUES (?, ?, ?, NULL, ?, 'student', ?, ?, ?)`, [accountId, accountEmail, profile.name, now, profile.basis, now, now]);
          if (channel === 'sms') {
            await db.run('INSERT INTO account_phones(account_id,phone_e164,verified_at) VALUES (?,?,?)', [accountId, destination, now]);
          }
          await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
            VALUES (?, 'free', 'free', 'none', 0, ?)`, [accountId, now]);
          if (child) {
            await db.run(`INSERT INTO guardian_consents
                (account_id, guardian_name, guardian_email, notice_version, requested_at, confirmed_at, withdrawn_at, method)
              VALUES (?, '', '', ?, ?, NULL, NULL, ?)`, [accountId, CONSENT_NOTICE_VERSION, now, GUARDIAN_AWAITING_METHOD]);
          }
        });
      } catch (err) {
        // Two sign-ups racing for one address: the loser simply signs in next time.
        if (isUniqueViolation(err)) return invalidCode(res);
        throw err;
      }
      await createSession(db, res, accountId, deviceId, req.get('user-agent') || '', now);
      const account = await db.get('SELECT * FROM accounts WHERE id = ?', [accountId]);
      res.status(201).json({
        status: 'signed-in',
        created: true,
        account: publicOtpAccount(account, channel === 'sms' ? destination : null),
        guardianConsent: child ? { required: true, state: 'pending' } : { required: false, state: 'not-required' }
      });
    } catch (err) { next(err); }
  });

  // Fresh proof for an account with no password (deleting it, for one). The
  // code goes to the account's own phone or email; the caller never names it.
  router.post('/reauth-request', requireSession(db), rateLimit(db, 'otp-reauth', { limit: 5, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const accountId = req.platformSession.account_id;
    const phone = await db.get('SELECT phone_e164 FROM account_phones WHERE account_id = ?', [accountId]);
    const account = await db.get('SELECT email FROM accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
    if (!account) return bad(res, 'ACCOUNT_NOT_FOUND', 'Account not found.', 404);
    const channel = phone ? 'sms' : 'email';
    const destination = phone ? phone.phone_e164 : normalizeEmail(account.email);
    if (!destination) return bad(res, 'OTP_DESTINATION_INVALID', 'This account has no address a code can be sent to.', 409);
    try {
      const sent = await deliver({ channel, destination, purpose: 'reauth', accountId });
      res.status(202).json({ ok: true, channel, ...sent });
    } catch (error) { return sendError(res, error); }
  });

  // ── deletion from the public web page, with no session ──────────────────
  // Apple 5.1.1(v) and Play's "Delete account" requirement want a way for a
  // person who can no longer open the app to have the account deleted, at a
  // public URL (client /account/delete-request). Proof is a code sent to the
  // address the account was made with — the same channel a password reset
  // uses, and the same proof DELETE /v1/account takes for a code-only account.
  //
  // NO ENUMERATION. /delete-request answers the same shape, status and work for
  // an address with an account and one without: a challenge is created and a
  // code sent either way (as /request does). Only someone who proves they hold
  // the mailbox learns, at /delete-confirm, whether an account was there.
  //
  // Phone-only accounts (synthetic @phone.invalid email) cannot be reached by
  // email; they delete in-app with a code to their phone (/reauth-request).
  const accountByEmail = (destination) => db.get(
    'SELECT id FROM accounts WHERE email = ? AND deleted_at IS NULL', [destination]
  );

  router.post('/delete-request', rateLimit(db, 'otp-delete-request', { limit: 10, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const destination = normalizeEmail(req.body?.email);
    if (!destination || destination.endsWith(`@${PHONE_ACCOUNT_EMAIL_DOMAIN}`)) {
      return bad(res, 'OTP_DESTINATION_INVALID', 'Enter a valid email address.');
    }
    const limit = await destinationAllowed('email', destination, 'reauth');
    if (!limit.allowed) {
      res.set('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)));
      return bad(res, 'OTP_RATE_LIMITED', 'Wait a moment before asking for another code.', 429);
    }
    try {
      const account = await accountByEmail(destination);
      // intent only changes the email copy: the mail says plainly that the code
      // deletes an account, so it cannot be passed off as a sign-in code.
      const sent = await deliver({ channel: 'email', destination, purpose: 'reauth', accountId: account?.id || null, intent: 'account-delete' });
      res.status(202).json({ ok: true, channel: 'email', ...sent });
    } catch (error) { return sendError(res, error); }
  });

  router.post('/delete-confirm', rateLimit(db, 'otp-delete-confirm', { limit: 30, windowMs: 15 * 60 * 1000 }), async (req, res, next) => {
    try {
      const destination = normalizeEmail(req.body?.email);
      if (!destination) return bad(res, 'OTP_DESTINATION_INVALID', 'Enter a valid email address.');
      const account = await accountByEmail(destination);
      // The challenge was bound to the account that held the address when the
      // code was sent (or to none). A code sent before the account existed, or
      // for a different account at the same address, does not match.
      const check = await verifyChallenge(db, {
        challengeId: String(req.body?.challengeId || ''), channel: 'email', purpose: 'reauth',
        destination, code: req.body?.code, accountId: account?.id || null
      });
      if (!check.ok) return invalidCode(res);
      if (!account) return res.json({ deleted: false, accountFound: false });
      await deleteAccountRows(db, account.id, { beforeDelete, request: req });
      res.json({ deleted: true, accountFound: true });
    } catch (error) {
      if (error?.status) return bad(res, error.code || 'ACCOUNT_DELETE_FAILED', error.message, error.status);
      next(error);
    }
  });

  // ── a parent's approval ───────────────────────────────────────────────────
  // The student's session asks; the parent's phone or mailbox receives the
  // code; the parent reads the consent screen on the student's device and
  // enters it there (or follows the emailed link, the existing flow).
  router.post('/guardian/request', requireSession(db), rateLimit(db, 'otp-guardian-request', { limit: 6, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
    try {
      const accountId = req.platformSession.account_id;
      const state = await consentState(db, accountId);
      if (!state.required) return bad(res, 'GUARDIAN_CONSENT_NOT_REQUIRED', 'This account does not need a parent’s approval.', 409);
      if (state.state === 'given') return res.json({ ok: true, alreadyApproved: true });
      // A withdrawal is the guardian's decision. The child's session must not be
      // able to start a fresh ceremony that clears it (guardianConsent.js
      // confirmConsent: withdrawal is terminal for the ceremony); only the
      // guardian, through their own channel, can grant permission again.
      if (state.state === 'withdrawn') {
        return bad(res, 'GUARDIAN_CONSENT_WITHDRAWN', 'A parent or guardian withdrew permission. Only they can change that.', 409);
      }
      const name = clipText(String(req.body?.guardianName || '').trim(), 80);
      if (!name) return bad(res, 'GUARDIAN_NAME_REQUIRED', 'Enter a parent or guardian’s name.');
      const channel = req.body?.channel === 'sms' ? 'sms' : req.body?.channel === 'email' ? 'email' : null;
      const destination = channel ? normalizeDestination(channel, req.body?.destination) : null;
      if (!destination) {
        return bad(res, channel === 'sms' ? 'GUARDIAN_PHONE_REQUIRED' : 'GUARDIAN_EMAIL_REQUIRED',
          channel === 'sms' ? 'Enter your parent’s 10-digit mobile number.' : 'Enter your parent’s email address.');
      }
      const self = await db.get('SELECT email FROM accounts WHERE id = ?', [accountId]);
      const ownPhone = await db.get('SELECT phone_e164 FROM account_phones WHERE account_id = ?', [accountId]);
      if ((channel === 'email' && normalizeEmail(self?.email) === destination) || (channel === 'sms' && ownPhone?.phone_e164 === destination)) {
        return bad(res, 'GUARDIAN_SAME_AS_STUDENT', 'Use your parent’s number or email, not your own.');
      }
      const limit = await destinationAllowed(channel, destination, 'guardian-consent');
      if (!limit.allowed) {
        res.set('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)));
        return bad(res, 'OTP_RATE_LIMITED', 'Wait a moment before asking for another code.', 429);
      }
      const now = Date.now();
      const method = channel === 'sms' ? GUARDIAN_PHONE_METHOD : GUARDIAN_EMAIL_OTP_METHOD;
      await db.transaction(async () => {
        await db.run(`UPDATE guardian_consents SET guardian_name = ?, guardian_email = ?, guardian_phone = ?,
            notice_version = ?, requested_at = ?, confirmed_at = NULL, method = ?
          WHERE account_id = ? AND withdrawn_at IS NULL`, [name, channel === 'email' ? destination : '', channel === 'sms' ? destination : null,
          CONSENT_NOTICE_VERSION, now, method, accountId]);
        // Email parents also get the existing link, so they can approve (and
        // later withdraw) from their own inbox rather than the child's device.
        if (channel === 'email') await queueAccountToken(db, accountId, destination, 'guardian-consent', now);
      });
      const sent = await deliver({ channel, destination, purpose: 'guardian-consent', accountId, now });
      res.status(202).json({ ok: true, channel, noticeVersion: CONSENT_NOTICE_VERSION, ...sent });
    } catch (error) {
      if (error?.status) return bad(res, error.code, error.message, error.status);
      next(error);
    }
  });

  // The parent approves on their OWN page (/guardian/consent), never inside
  // the child's session: no session is read here at all. The parent names the
  // phone or email the code went to and enters it; the newest live
  // guardian-consent challenge for that contact says which account it is for.
  // What this establishes is a parent-controlled channel, nothing more (see
  // docs/release/otp-sign-in.md).
  router.post('/guardian/approve', rateLimit(db, 'otp-guardian-approve', { limit: 20, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    if (req.body?.approve !== true || String(req.body?.noticeVersion || '') !== CONSENT_NOTICE_VERSION) {
      return bad(res, 'GUARDIAN_NOTICE_REQUIRED', 'Read and accept the current notice first.');
    }
    const channel = req.body?.channel === 'sms' ? 'sms' : req.body?.channel === 'email' ? 'email' : null;
    const destination = channel ? normalizeDestination(channel, req.body?.destination) : null;
    if (!destination) return invalidCode(res);
    const now = Date.now();
    const live = await db.get(`SELECT id, account_id FROM otp_challenges
      WHERE destination_hash = ? AND purpose = 'guardian-consent' AND channel = ? AND consumed_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1`, [destinationHash(channel, destination), channel, now]);
    if (!live?.account_id) return invalidCode(res);
    const check = await verifyChallenge(db, {
      challengeId: live.id, channel, purpose: 'guardian-consent', destination,
      code: req.body?.code, accountId: live.account_id, delegatedCheck: delegatedCheck(channel), now
    });
    if (!check.ok) return invalidCode(res, check.attemptsRemaining != null ? { attemptsRemaining: check.attemptsRemaining } : {});
    // The consent row must still name this contact and still be open.
    const row = await db.get('SELECT guardian_email, guardian_phone, withdrawn_at FROM guardian_consents WHERE account_id = ?', [live.account_id]);
    const named = row && (channel === 'sms' ? row.guardian_phone === destination : normalizeEmail(row.guardian_email) === destination);
    if (!named || row.withdrawn_at) return invalidCode(res);
    const confirmed = await confirmConsent(db, live.account_id, now);
    const child = await db.get('SELECT name FROM accounts WHERE id = ?', [live.account_id]);
    res.json({ ok: true, confirmed, childName: child?.name || null });
  });

  // Withdrawal by phone, for a parent who approved by SMS. No session: the
  // parent proves the phone. Same answer whether or not the number approved
  // anything — a code is "sent" either way, only a real match receives one.
  router.post('/guardian/withdraw-request', rateLimit(db, 'otp-guardian-withdraw-request', { limit: 6, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const destination = normalizePhone(req.body?.destination);
    if (!destination) return bad(res, 'GUARDIAN_PHONE_REQUIRED', 'Enter the mobile number you approved with.');
    const limit = await destinationAllowed('sms', destination, 'guardian-withdraw');
    if (!limit.allowed) {
      res.set('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)));
      return bad(res, 'OTP_RATE_LIMITED', 'Wait a moment before asking for another code.', 429);
    }
    // Same body, same status and the same wall-clock time whether or not this
    // number approved anything: a code is only SENT when a live consent names
    // it, and a delivery failure is not reported (that would leak a match).
    const started = Date.now();
    const match = await db.get(`SELECT 1 FROM guardian_consents WHERE guardian_phone = ? AND withdrawn_at IS NULL LIMIT 1`, [destination]);
    let challengeId;
    if (match) {
      try { challengeId = (await deliver({ channel: 'sms', destination, purpose: 'guardian-withdraw' })).challengeId; }
      catch { challengeId = null; }
    }
    if (!challengeId) {
      const decoy = await createChallenge(db, { channel: 'sms', purpose: 'guardian-withdraw', destination, providerName: sms?.name || 'none' });
      await retireChallenge(db, decoy.challengeId);
      challengeId = decoy.challengeId;
    }
    const wait = WITHDRAW_REQUEST_FLOOR_MS - (Date.now() - started);
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    res.status(202).json({ ok: true, channel: 'sms', challengeId, expiresInMs: OTP_TTL_MS, resendAfterMs: OTP_RESEND_COOLDOWN_MS });
  });

  router.post('/guardian/withdraw', rateLimit(db, 'otp-guardian-withdraw', { limit: 20, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const destination = normalizePhone(req.body?.destination);
    if (!destination) return invalidCode(res);
    const check = await verifyChallenge(db, {
      challengeId: String(req.body?.challengeId || ''), channel: 'sms', purpose: 'guardian-withdraw', destination,
      code: req.body?.code, delegatedCheck: delegatedCheck('sms')
    });
    if (!check.ok) return invalidCode(res, check.attemptsRemaining != null ? { attemptsRemaining: check.attemptsRemaining } : {});
    const now = Date.now();
    const rows = await db.all('SELECT account_id FROM guardian_consents WHERE guardian_phone = ? AND withdrawn_at IS NULL', [destination]);
    let withdrawn = 0;
    for (const row of rows) if (await withdrawConsent(db, row.account_id, now)) withdrawn += 1;
    res.json({ ok: true, withdrawn });
  });

  return router;
}

/** Verify a reauth code for an account with no password. Used by account deletion. */
export async function verifyReauthCode(db, accountId, { otpChallengeId, otpCode } = {}) {
  db = asStore(db);
  ensureOtpSchema(db);
  const phone = await db.get('SELECT phone_e164 FROM account_phones WHERE account_id = ?', [accountId]);
  const account = await db.get('SELECT email FROM accounts WHERE id = ?', [accountId]);
  const channel = phone ? 'sms' : 'email';
  const destination = phone ? phone.phone_e164 : normalizeEmail(account?.email);
  if (!destination) return false;
  let sms = null;
  try { sms = channel === 'sms' ? createSmsProviderFromEnv(process.env) : null; } catch { sms = null; }
  const check = await verifyChallenge(db, {
    challengeId: String(otpChallengeId || ''), channel, purpose: 'reauth', destination, code: otpCode, accountId,
    delegatedCheck: sms?.generatesCode ? (to, code) => sms.check({ to, code }) : null
  });
  return check.ok;
}
