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
import { consentPage, recordTestMessage, testModeAllowed } from './smsProvider.js';
import { postResendEmail } from './authDelivery.js';
import { recordAuthEmail } from './metrics.js';
import { logEvent, safeCode } from './observability.js';

const trim = (value) => String(value ?? '').trim();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function otpEmailMessage(code, purpose, origin = process.env.PRI_PUBLIC_ORIGIN, { intent = null } = {}) {
  const digits = escapeHtml(String(code));
  const big = `<p style="font-size:28px;letter-spacing:6px;font-family:monospace">${digits}</p>`;
  // A deletion code must never read like a sign-in code: the public
  // /account/delete-request page can be asked for by anyone who knows the
  // address, so the mail itself has to say what entering the code does.
  if (intent === 'account-delete') {
    const body = 'Someone asked to DELETE the Pri Learning account for this address. Entering this code on the account deletion page permanently deletes the account and its data. Never share it or read it out to anyone.';
    const tail = 'If you did not ask for this, ignore this email: your account stays exactly as it is. The code is valid for 10 minutes.';
    return {
      subject: `${code} is the code to delete your Pri Learning account`,
      text: `${code}\n\n${body}\n\n${tail}`,
      html: `${big}<p>${body}</p><p>${tail}</p>`
    };
  }
  if (purpose === 'guardian-consent') {
    const body = `Your child is setting up Pri Learning and has asked you to approve their account. Open ${escapeHtml(consentPage(origin))} yourself, read what you are agreeing to, and enter this code there.`;
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
  return async ({ challengeId, to, code, purpose, intent = null }) => {
    const message = otpEmailMessage(code, purpose, undefined, { intent });
    try {
      const providerMessageId = await postResendEmail({
        key,
        fetchImpl,
        idempotencyKey: `pri-otp/${challengeId}`,
        payload: {
          from: sender, to: [String(to)], subject: message.subject, text: message.text, html: message.html,
          tags: [{ name: 'category', value: 'otp' }]
        }
      });
      recordAuthEmail({ ok: true });
      return { providerMessageId };
    } catch (error) {
      // WHY the send was refused, by code: a revoked key, an unverified sender
      // domain and a recipient the shared test sender will not deliver to are
      // three different repairs. The address and the code never reach the log
      // (the log accepts no field that could hold them) and never reach the
      // client, which is told only that the code could not be sent (otp.js).
      const reason = safeCode(error?.code, 'DELIVERY_FAILED');
      recordAuthEmail({ ok: false, code: reason });
      logEvent('warn', 'auth_email_failed', { provider: 'resend', code: reason });
      throw Object.assign(new Error('Auth email provider rejected the request'), { code: reason, status: 503 });
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
    return async ({ to, code, purpose, intent = null }) => {
      recordTestMessage({ channel: 'email', to, code, purpose, intent, body: otpEmailMessage(code, purpose, undefined, { intent }).text });
      return { providerMessageId: null };
    };
  };
  if (provider === 'resend') return createResendOtpEmailSender({ apiKey: env.PRI_RESEND_API_KEY, from: env.PRI_AUTH_EMAIL_FROM, fetchImpl });
  if (provider === 'test') return testSender();
  if (!provider && trim(env.NODE_ENV) !== 'production') return testSender();
  return null;
}
