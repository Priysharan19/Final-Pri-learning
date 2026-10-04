// Pri Learning · E2E support — RFC 6238 TOTP for the browser tours.
//
// The staff second factor is proved on the server in server/platform/mfa.js
// (base32 secret, HMAC-SHA1, 30-second steps, six digits, ±1 step of drift).
// The browser tours mock `/v1` inside Playwright, so they need the same
// arithmetic twice: once to play the authenticator app a staff member would
// hold, and once in the mock server to accept exactly the code that app shows
// and refuse everything else. Only node:crypto, no dependency.
import { createHmac, randomBytes, randomInt } from 'node:crypto';

export const TOTP_PERIOD_S = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1;
export const RECOVERY_CODE_COUNT = 8;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text || '').toUpperCase().replace(/[\s=-]/g, '');
  if (!clean || /[^A-Z2-7]/.test(clean)) throw new Error('Invalid base32 secret.');
  const bytes = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function hotp(secret, counter, digits = TOTP_DIGITS) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export const totpCounter = (nowMs = Date.now(), periodS = TOTP_PERIOD_S) => Math.floor(nowMs / 1000 / periodS);

/** The six digits an authenticator app shows right now for a base32 secret (or raw buffer). */
export function totp(secret, nowMs = Date.now()) {
  const key = Buffer.isBuffer(secret) ? secret : base32Decode(secret);
  return hotp(key, totpCounter(nowMs));
}

/** A six-digit string that no step within ±window of now produces — a guaranteed wrong code. */
export function wrongTotp(secret, nowMs = Date.now(), window = TOTP_WINDOW) {
  const key = Buffer.isBuffer(secret) ? secret : base32Decode(secret);
  const current = totpCounter(nowMs);
  const live = new Set();
  for (let step = current - window; step <= current + window; step++) live.add(hotp(key, step));
  let candidate = '000000';
  while (live.has(candidate)) candidate = String(Number(candidate) + 1).padStart(6, '0');
  return candidate;
}

/** Mirror of server/platform/mfa.js matchTotp: the matching step, or null. */
export function matchTotp(secret, code, { nowMs = Date.now(), window = TOTP_WINDOW, lastUsedCounter = null } = {}) {
  const key = Buffer.isBuffer(secret) ? secret : base32Decode(secret);
  const submitted = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(submitted)) return null;
  const current = totpCounter(nowMs);
  let matched = null;
  for (let step = current - window; step <= current + window; step++) {
    if (hotp(key, step) === submitted && (lastUsedCounter === null || step > lastUsedCounter)) matched = step;
  }
  return matched;
}

export function otpauthUri({ secret, account, issuer = 'Pri Learning' }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD_S) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function mintRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const codes = new Set();
  while (codes.size < count) {
    const digits = Array.from({ length: 10 }, () => String(randomInt(0, 10))).join('');
    codes.add(`${digits.slice(0, 5)}-${digits.slice(5)}`);
  }
  return [...codes];
}

/**
 * A mock of the four `/v1/account/mfa/*` routes plus the staff gate, with the
 * server's state machine (server/platform/mfa.js, security.js requireMfa):
 *
 *   · before `confirm`, every staff route is 403 MFA_ENROLMENT_REQUIRED;
 *   · `confirm` accepts only the live code for the issued secret (401
 *     MFA_CODE_INVALID otherwise), marks the session verified and hands out
 *     eight recovery codes once;
 *   · a step-up route (role change, Premium grant) is 403 MFA_STEP_UP_REQUIRED
 *     when the last accepted code is older than `stepUpWindowMs`, and `verify`
 *     spends a step so the same code cannot be replayed.
 *
 * `handle(path, method, bodyText)` returns `{ status, body }` for an MFA route
 * or null; `gate()` returns the refusal every other staff route must give
 * before enrolment, or null; `stepUp()` the same for a step-up route.
 */
export function createMfaMock({ email, stepUpWindowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const state = {
    secret: null,          // Buffer, issued by enrol
    confirmedAt: null,
    verifiedAt: null,
    lastUsedCounter: null,
    recoveryCodes: [],
    usedRecovery: new Set(),
    calls: []
  };
  const refusal = (status, code, message, extra = {}) => ({ status, body: { error: { code, message, ...extra } } });
  const invalid = () => refusal(401, 'MFA_CODE_INVALID', 'That code was not accepted. Check the time on your device and try again.');

  const status = () => {
    const t = now();
    return {
      required: true,
      enrolled: !!state.confirmedAt,
      pendingEnrolment: !!state.secret && !state.confirmedAt,
      verified: !!state.verifiedAt,
      verifiedAt: state.verifiedAt,
      stepUpFresh: !!state.verifiedAt && t - state.verifiedAt <= stepUpWindowMs,
      stepUpWindowMs
    };
  };

  return {
    state,
    status,
    /** Force the last accepted code to look older than the step-up window. */
    ageVerification(ms = stepUpWindowMs + 1000) {
      if (state.verifiedAt) state.verifiedAt -= ms;
    },
    gate() {
      if (!state.confirmedAt) return refusal(403, 'MFA_ENROLMENT_REQUIRED', 'Staff accounts must set up an authenticator app before using this feature.');
      if (!state.verifiedAt) return refusal(403, 'MFA_REQUIRED', 'Enter the code from your authenticator app to continue.');
      return null;
    },
    stepUp() {
      const gated = this.gate();
      if (gated) return gated;
      if (now() - state.verifiedAt > stepUpWindowMs) {
        return refusal(403, 'MFA_STEP_UP_REQUIRED', 'Enter the code from your authenticator app again to confirm this action.', { stepUpWindowMs });
      }
      return null;
    },
    handle(path, method, bodyText = '') {
      if (!path.startsWith('/v1/account/mfa/')) return null;
      state.calls.push({ path, method });
      let body = {};
      try { body = JSON.parse(bodyText || '{}'); } catch { body = {}; }
      const t = now();
      if (path === '/v1/account/mfa/status' && method === 'GET') return { status: 200, body: status() };
      if (path === '/v1/account/mfa/totp/enrol' && method === 'POST') {
        if (state.confirmedAt) return refusal(409, 'MFA_ALREADY_ENROLLED', 'An authenticator app is already set up for this account.');
        state.secret = randomBytes(20);
        state.lastUsedCounter = null;
        const encoded = base32Encode(state.secret);
        return { status: 201, body: { secret: encoded, otpauthUri: otpauthUri({ secret: encoded, account: email }), issuer: 'Pri Learning', algorithm: 'SHA1', digits: TOTP_DIGITS, period: TOTP_PERIOD_S } };
      }
      if (path === '/v1/account/mfa/totp/confirm' && method === 'POST') {
        if (!state.secret) return refusal(409, 'MFA_ENROLMENT_MISSING', 'Start by requesting an authenticator secret.');
        if (state.confirmedAt) return refusal(409, 'MFA_ALREADY_ENROLLED', 'An authenticator app is already set up for this account.');
        const step = matchTotp(state.secret, body.code, { nowMs: t });
        if (step === null) return invalid();
        state.confirmedAt = t;
        state.lastUsedCounter = step;
        state.verifiedAt = t;
        state.recoveryCodes = mintRecoveryCodes();
        return { status: 200, body: { enrolled: true, verifiedAt: t, recoveryCodes: state.recoveryCodes } };
      }
      if (path === '/v1/account/mfa/verify' && method === 'POST') {
        if (!state.confirmedAt) return refusal(409, 'MFA_ENROLMENT_REQUIRED', 'Set up an authenticator app first.');
        if (body.recoveryCode !== undefined) {
          const clean = String(body.recoveryCode).replace(/[\s-]/g, '');
          const hit = state.recoveryCodes.find(code => code.replace(/-/g, '') === clean && !state.usedRecovery.has(code));
          if (!hit) return invalid();
          state.usedRecovery.add(hit);
          state.verifiedAt = t;
          return { status: 200, body: { verified: true, verifiedAt: t, method: 'recovery-code', recoveryCodesRemaining: state.recoveryCodes.length - state.usedRecovery.size } };
        }
        const step = matchTotp(state.secret, body.code, { nowMs: t, lastUsedCounter: state.lastUsedCounter });
        if (step === null) return invalid();
        state.lastUsedCounter = step;
        state.verifiedAt = t;
        return { status: 200, body: { verified: true, verifiedAt: t, method: 'totp' } };
      }
      return refusal(404, 'NOT_FOUND', `Unhandled MFA route ${method} ${path}`);
    }
  };
}
