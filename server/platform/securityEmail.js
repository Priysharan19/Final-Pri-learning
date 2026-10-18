// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · security notices by email (new-device sign-in)
//
// A notice goes to the account's own address through the same Resend account
// and sender as the one-time codes (PRI_AUTH_EMAIL_PROVIDER=resend,
// PRI_RESEND_API_KEY, PRI_AUTH_EMAIL_FROM), or to an in-memory outbox under the
// same production gate as the SMS/email test adapters. The notice names what
// happened, when, and the remedy inside the app — never an address, a token, a
// link or a code, so nothing in it can be phished or replayed. The address
// itself never reaches the log (observability.js accepts no such field).
// ─────────────────────────────────────────────────────────────────────────────
import { postResendEmail } from './authDelivery.js';
import { testModeAllowed } from './smsProvider.js';
import { recordAuthEmail } from './metrics.js';
import { logEvent, safeCode } from './observability.js';

const trim = value => String(value ?? '').trim();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/** A time as a person reads it, in UTC so the notice is the same on every device. */
function whenText(at) {
  const d = new Date(Number(at) || Date.now());
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${day} at ${time} UTC`;
}

/**
 * The new-device notice. No address, no link, no code, no token: the remedy is
 * described as steps inside the app, which is the only place it can be taken.
 */
export function newDeviceMessage({ at = Date.now() } = {}) {
  const when = whenText(at);
  const body = `Your Pri Learning account was signed in to from a device or browser it had not been used on before, on ${when}.`;
  const fine = 'If this was you, there is nothing to do.';
  const remedy = 'If it was not you, open Pri Learning on a device that is yours, go to Settings → Account → Sign out everywhere, then change your password or ask for a new one-time code. Pri Learning never asks for your password or a code by email.';
  return {
    subject: 'New sign-in to your Pri Learning account',
    text: `${body}\n\n${fine}\n\n${remedy}`,
    html: `<p>${escapeHtml(body)}</p><p>${escapeHtml(fine)}</p><p>${escapeHtml(remedy)}</p>`
  };
}

function messageFor(kind, details) {
  if (kind === 'new-device') return newDeviceMessage(details);
  throw Object.assign(new Error(`Unknown security notice ${kind}`), { code: 'SECURITY_NOTICE_UNKNOWN' });
}

// ── Test adapter outbox (separate from the one-time-code outbox, so a suite
//    reading "the last code sent to this address" never picks up a notice) ──
const TEST_OUTBOX_LIMIT = 200;
const testOutbox = [];

/** What the test adapter "sent". Test harness only. */
export function readTestSecurityOutbox({ to = null } = {}) {
  return testOutbox.filter(entry => !to || entry.to === to).map(entry => ({ ...entry }));
}

export function clearTestSecurityOutbox() {
  testOutbox.length = 0;
}

export function createResendSecurityEmailSender({ apiKey, from, fetchImpl = globalThis.fetch } = {}) {
  const key = trim(apiKey);
  const sender = trim(from);
  if (!key || !sender || typeof fetchImpl !== 'function') return null;
  return async ({ to, kind, idempotencyKey, ...details }) => {
    const message = messageFor(kind, details);
    try {
      const providerMessageId = await postResendEmail({
        key,
        fetchImpl,
        idempotencyKey: `pri-security/${idempotencyKey}`,
        payload: {
          from: sender, to: [String(to)], subject: message.subject, text: message.text, html: message.html,
          tags: [{ name: 'category', value: 'security' }]
        }
      });
      recordAuthEmail({ ok: true });
      return { providerMessageId };
    } catch (error) {
      const reason = safeCode(error?.code, 'DELIVERY_FAILED');
      recordAuthEmail({ ok: false, code: reason });
      logEvent('warn', 'security_email_failed', { provider: 'resend', code: reason });
      throw Object.assign(new Error('Security email provider rejected the request'), { code: reason, status: 503 });
    }
  };
}

/**
 * The security notice sender for this deployment: Resend when configured; the
 * in-memory test sender when PRI_AUTH_EMAIL_PROVIDER=test, or outside
 * production when nothing is configured; otherwise null — notices are then
 * audit rows only. The test sender obeys the same production gate as the
 * SMS/OTP test adapters.
 */
export function createSecurityEmailSenderFromEnv(env = process.env, { fetchImpl } = {}) {
  const provider = trim(env.PRI_AUTH_EMAIL_PROVIDER).toLowerCase();
  const testSender = () => {
    if (!testModeAllowed(env)) {
      throw Object.assign(new Error('PRI_AUTH_EMAIL_PROVIDER=test cannot run with NODE_ENV=production unless PRI_SMS_TEST_MODE_ALLOW_STAGING=1 is set for a staging deployment.'), { code: 'EMAIL_TEST_MODE_FORBIDDEN', status: 500 });
    }
    return async ({ to, kind, idempotencyKey, ...details }) => {
      const message = messageFor(kind, details);
      testOutbox.push({ channel: 'email', to: String(to), kind, idempotencyKey, subject: message.subject, body: message.text, at: Date.now() });
      if (testOutbox.length > TEST_OUTBOX_LIMIT) testOutbox.splice(0, testOutbox.length - TEST_OUTBOX_LIMIT);
      return { providerMessageId: null };
    };
  };
  if (provider === 'resend') return createResendSecurityEmailSender({ apiKey: env.PRI_RESEND_API_KEY, from: env.PRI_AUTH_EMAIL_FROM, fetchImpl });
  if (provider === 'test') return testSender();
  if (!provider && trim(env.NODE_ENV) !== 'production') return testSender();
  return null;
}
