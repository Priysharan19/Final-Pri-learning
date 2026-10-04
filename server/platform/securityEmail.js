// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · account security notices by email
//
// One message today: "your account was just signed in to from a device it has
// not used before". It goes through the same Resend account and sender as the
// one-time codes (PRI_AUTH_EMAIL_PROVIDER=resend, PRI_RESEND_API_KEY,
// PRI_AUTH_EMAIL_FROM) and, like them, straight from the request rather than
// through auth_delivery_outbox: a notice is informational, carries no token
// and must not wait for the drain. The test adapter records the message in
// memory under the same production gate as the SMS and OTP test adapters.
//
// What the notice says is deliberate: when, and the device label the client
// declared (clipped, control characters removed). Never the address it is
// going to, never a session id, never a token, never a link to act on — a
// notice that asks the reader to click something is the phishing template.
// ─────────────────────────────────────────────────────────────────────────────
import { recordTestMessage, testModeAllowed } from './smsProvider.js';

const REQUEST_TIMEOUT_MS = 10_000;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const trim = (value) => String(value ?? '').trim();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/** A device label fit to print: no control characters, at most 40 characters. */
export function printableDeviceLabel(deviceId) {
  const clean = String(deviceId ?? '').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 40);
  return clean || 'a new device';
}

export function newDeviceEmailMessage({ deviceId, at = Date.now() } = {}) {
  const device = printableDeviceLabel(deviceId);
  const when = new Date(at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const body = `Your Pri Learning account was just signed in to from a device it had not used before (${device}) at ${when}.`;
  const tail = 'If this was you, there is nothing to do. If it was not, open Pri Learning on a device you trust, go to Settings, and choose "Sign out everywhere"; then sign in again. Pri Learning never asks for your code or password by email.';
  return {
    subject: 'New sign-in to your Pri Learning account',
    text: `${body}\n\n${tail}`,
    html: `<p>${escapeHtml(body)}</p><p>${escapeHtml(tail)}</p>`
  };
}

export function createResendSecurityEmailSender({ apiKey, from, fetchImpl = globalThis.fetch } = {}) {
  const key = trim(apiKey);
  const sender = trim(from);
  if (!key || !sender || typeof fetchImpl !== 'function') return null;
  return async ({ to, kind, deviceId, at, dedupeKey }) => {
    if (kind !== 'new-device') throw Object.assign(new Error('Unsupported security notice'), { code: 'SECURITY_NOTICE_UNSUPPORTED' });
    const message = newDeviceEmailMessage({ deviceId, at });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Auth email provider timed out')), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `pri-security/${dedupeKey}`.slice(0, 256),
          'User-Agent': 'Pri-Learning-Auth/1.0'
        },
        body: JSON.stringify({
          from: sender, to: [String(to)], subject: message.subject, text: message.text, html: message.html,
          tags: [{ name: 'category', value: 'security_notice' }]
        }),
        signal: controller.signal
      });
      if (!response.ok) throw Object.assign(new Error('Auth email provider rejected the request'), { code: `RESEND_${response.status}`, status: 503 });
      return { providerMessageId: null };
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * The security-notice sender for this deployment: Resend when configured; the
 * in-memory test sender when PRI_AUTH_EMAIL_PROVIDER=test, or outside
 * production when nothing is configured; otherwise null (no notice is sent,
 * the sign-in is still audited).
 */
export function createSecurityEmailSenderFromEnv(env = process.env, { fetchImpl } = {}) {
  const provider = trim(env.PRI_AUTH_EMAIL_PROVIDER).toLowerCase();
  const testSender = () => {
    if (!testModeAllowed(env)) {
      throw Object.assign(new Error('PRI_AUTH_EMAIL_PROVIDER=test cannot run with NODE_ENV=production unless PRI_SMS_TEST_MODE_ALLOW_STAGING=1 is set for a staging deployment.'), { code: 'EMAIL_TEST_MODE_FORBIDDEN', status: 500 });
    }
    return async ({ to, kind, deviceId, at }) => {
      recordTestMessage({ channel: 'email', to, code: null, purpose: kind, body: newDeviceEmailMessage({ deviceId, at }).text });
      return { providerMessageId: null };
    };
  };
  if (provider === 'resend') return createResendSecurityEmailSender({ apiKey: env.PRI_RESEND_API_KEY, from: env.PRI_AUTH_EMAIL_FROM, fetchImpl });
  if (provider === 'test') return testSender();
  if (!provider && trim(env.NODE_ENV) !== 'production') return testSender();
  return null;
}
