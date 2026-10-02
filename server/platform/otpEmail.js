// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one-time codes by email
//
// A code is sent in the request, not through auth_delivery_outbox: outbox rows
// hang off an account (a code for a new address has none yet), and a
// 10-minute code cannot wait for the 30-second drain. It uses the same Resend
// account and sender as the outbox (PRI_AUTH_EMAIL_PROVIDER=resend,
// PRI_RESEND_API_KEY, PRI_AUTH_EMAIL_FROM). The raw code exists only in this
// call; it is never stored or logged.
// ─────────────────────────────────────────────────────────────────────────────
import { recordTestMessage, testModeAllowed } from './smsProvider.js';

const REQUEST_TIMEOUT_MS = 10_000;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const trim = (value) => String(value ?? '').trim();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function otpEmailMessage(code, purpose) {
  const digits = escapeHtml(String(code));
  const big = `<p style="font-size:28px;letter-spacing:6px;font-family:monospace">${digits}</p>`;
  if (purpose === 'guardian-consent') {
    const body = 'Your child is setting up Pri Learning and has asked you to approve their account. Read what you are agreeing to on their screen, then enter this code there.';
    const tail = 'The code is valid for 10 minutes. If you did not expect this, ignore this email and nothing will sync.';
    return {
      subject: `${code} is the code to approve your child’s Pri Learning account`,
      text: `${code}\n\n${body}\n\n${tail}`,
      html: `${big}<p>${body}</p><p>${tail}</p>`
    };
  }
  const body = 'Enter this code in Pri Learning to continue. It is valid for 10 minutes. Do not share it with anyone.';
  const tail = 'If you did not ask for it, you can ignore this email.';
  return { subject: `${code} is your Pri Learning code`, text: `${code}\n\n${body}\n\n${tail}`, html: `${big}<p>${body}</p><p>${tail}</p>` };
}

export function createResendOtpEmailSender({ apiKey, from, fetchImpl = globalThis.fetch } = {}) {
  const key = trim(apiKey);
  const sender = trim(from);
  if (!key || !sender || typeof fetchImpl !== 'function') return null;
  return async ({ challengeId, to, code, purpose }) => {
    const message = otpEmailMessage(code, purpose);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Auth email provider timed out')), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `pri-otp/${challengeId}`.slice(0, 256),
          'User-Agent': 'Pri-Learning-Auth/1.0'
        },
        body: JSON.stringify({
          from: sender, to: [String(to)], subject: message.subject, text: message.text, html: message.html,
          tags: [{ name: 'category', value: 'otp' }]
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
 * The email code sender for this deployment: Resend when configured; the
 * in-memory test sender when PRI_AUTH_EMAIL_PROVIDER=test, or outside
 * production when nothing is configured; otherwise null (email codes answer
 * 503). The test sender obeys the same production gate as the SMS test adapter.
 */
export function createOtpEmailSenderFromEnv(env = process.env, { fetchImpl } = {}) {
  const provider = trim(env.PRI_AUTH_EMAIL_PROVIDER).toLowerCase();
  const testSender = () => {
    if (!testModeAllowed(env)) {
      throw Object.assign(new Error('PRI_AUTH_EMAIL_PROVIDER=test cannot run with NODE_ENV=production unless PRI_SMS_TEST_MODE_ALLOW_STAGING=1 is set for a staging deployment.'), { code: 'EMAIL_TEST_MODE_FORBIDDEN', status: 500 });
    }
    return async ({ to, code, purpose }) => {
      recordTestMessage({ channel: 'email', to, code, purpose, body: otpEmailMessage(code, purpose).text });
      return { providerMessageId: null };
    };
  };
  if (provider === 'resend') return createResendOtpEmailSender({ apiKey: env.PRI_RESEND_API_KEY, from: env.PRI_AUTH_EMAIL_FROM, fetchImpl });
  if (provider === 'test') return testSender();
  if (!provider && trim(env.NODE_ENV) !== 'production') return testSender();
  return null;
}
