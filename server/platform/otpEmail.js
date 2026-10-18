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
import { cleanPublicOrigin, postResendEmail } from './authDelivery.js';
import { recordAuthEmail } from './metrics.js';
import { logEvent, safeCode } from './observability.js';

const trim = (value) => String(value ?? '').trim();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/**
 * The parent's page on THIS deployment, or null. The origin is the server's
 * own validated PRI_PUBLIC_ORIGIN (authDelivery.js cleanPublicOrigin: a clean
 * https origin, http only for localhost outside production) and the path is
 * fixed, so a mail can never carry a link to another environment's host, to a
 * caller-chosen address, or to anything a request supplied.
 */
export function otpEmailConsentLink(origin = process.env.PRI_PUBLIC_ORIGIN) {
  try { return `${cleanPublicOrigin(origin)}/guardian/consent`; } catch { return null; }
}

/**
 * One layout for every code email: the name, one sentence, the code, how long
 * it lasts, and what to do if it was not asked for. Tables and inline styles
 * because that is what mail clients render; a single 480px column that a phone
 * shows without zooming; no image, no tracking pixel, no remote font. Sign-in
 * and deletion codes carry NO link at all — a code is typed, never clicked.
 */
function codeEmailHtml({ preheader, lead, code, expiry, tail, link = null }) {
  const digits = escapeHtml(String(code));
  const spaced = `${digits.slice(0, 3)}&nbsp;${digits.slice(3)}`;
  const linkRow = link
    ? `<tr><td style="padding:0 28px 18px;font:15px/1.5 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#48463f">Their page: <a href="${escapeHtml(link)}" style="color:#0b6e69">${escapeHtml(link)}</a></td></tr>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Pri Learning</title></head>`
    + `<body style="margin:0;padding:0;background:#f0ede6">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede6"><tr><td align="center" style="padding:24px 12px">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fdfcf9;border:1px solid #d9d5cb;border-radius:12px">`
    + `<tr><td style="padding:24px 28px 6px;font:600 17px/1.3 Georgia,'Times New Roman',serif;color:#1c1b18">Pri Learning</td></tr>`
    + `<tr><td style="padding:6px 28px 4px;font:16px/1.5 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b18">${escapeHtml(lead)}</td></tr>`
    + `<tr><td align="center" style="padding:18px 28px 10px"><div aria-label="Code ${digits.split('').join(' ')}" style="display:inline-block;padding:14px 22px;border:1px solid #1c1b18;border-radius:10px;font:700 34px/1.1 'SF Mono',Menlo,Consolas,'Courier New',monospace;letter-spacing:6px;color:#1c1b18;background:#ffffff">${spaced}</div></td></tr>`
    + `<tr><td align="center" style="padding:0 28px 18px;font:14px/1.5 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#48463f">${escapeHtml(expiry)}</td></tr>`
    + linkRow
    + `<tr><td style="padding:14px 28px 24px;border-top:1px solid #e6e2d9;font:13px/1.5 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#6b675e">${escapeHtml(tail)}</td></tr>`
    + `</table></td></tr></table></body></html>`;
}

export function otpEmailMessage(code, purpose, origin = process.env.PRI_PUBLIC_ORIGIN, { intent = null } = {}) {
  // A deletion code must never read like a sign-in code: the public
  // /account/delete-request page can be asked for by anyone who knows the
  // address, so the mail itself has to say what entering the code does.
  if (intent === 'account-delete') {
    const body = 'Someone asked to DELETE the Pri Learning account for this address. Entering this code on the account deletion page permanently deletes the account and its data. Never share it or read it out to anyone.';
    const tail = 'If you did not ask for this, ignore this email: your account stays exactly as it is. The code is valid for 10 minutes.';
    return {
      subject: `${code} is the code to delete your Pri Learning account`,
      text: `${code}\n\n${body}\n\n${tail}`,
      html: codeEmailHtml({ preheader: 'This code deletes a Pri Learning account.', lead: body, code, expiry: 'This code works for 10 minutes and only once.', tail: 'If you did not ask for this, ignore this email: your account stays exactly as it is.' })
    };
  }
  if (purpose === 'guardian-consent') {
    const link = otpEmailConsentLink(origin);
    const where = link || 'the Pri Learning parent page';
    const body = `Your child is setting up Pri Learning and has asked you to approve their account. Open ${where} yourself, read what you are agreeing to, and enter this code there.`;
    const tail = 'The code is valid for 10 minutes. If you did not expect this, ignore this email and nothing will sync.';
    return {
      subject: `${code} is the code to approve your child’s Pri Learning account`,
      text: `${code}\n\n${body}\n\n${tail}`,
      html: codeEmailHtml({
        preheader: 'Your child asked you to approve their Pri Learning account.',
        lead: 'Your child is setting up Pri Learning and has asked you to approve their account. Open the parent page yourself, read what you are agreeing to, and enter this code there.',
        code, expiry: 'This code works for 10 minutes and only once.', link,
        tail: 'If you did not expect this, ignore this email and nothing will sync.'
      })
    };
  }
  const body = 'Enter this code in Pri Learning to continue. It is valid for 10 minutes. Do not share it with anyone.';
  const tail = 'If you did not ask for it, you can ignore this email.';
  return {
    subject: `${code} is your Pri Learning code`,
    text: `${code}\n\n${body}\n\n${tail}`,
    html: codeEmailHtml({
      preheader: 'Your six-digit Pri Learning code. It works for 10 minutes.',
      lead: 'Enter this code in Pri Learning to continue.', code,
      expiry: 'This code works for 10 minutes and only once. Do not share it with anyone.',
      tail: 'If you did not ask for this code, you can ignore this email. Nobody can sign in without it.'
    })
  };
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
