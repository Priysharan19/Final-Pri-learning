// Pri Learning · E2E flow — an adult whose email was never confirmed signs in
// with a password on a new device, and is taken to "Confirm your email", not
// to a false "guardian approval" dead end.
//
// L8's real staging journey on 1d3829103 found it: an account registered
// with a password (POST /v1/account/register, isAdult: true) whose address
// was never proved signs in (login 200, /me 200), chooses a class, presses
// Continue and is told "We couldn't confirm your account's guardian approval"
// — with nothing on screen that could fix it. The server's statement was
// {required:false, state:'not-required', eligible:false, emailVerified:false}.
//
// Nothing is mocked on the server side (support/online-session.mjs: real
// routes, real SQLite, real cookies and CSRF); email delivery is the server's
// TEST adapter, read the way a mailbox would be. This flow proves:
//   · the card goes to "Confirm your email", naming the address, and never
//     says a guardian is the blocker;
//   · nothing is loosened: until the address is proved the server still
//     refuses practice (403 EMAIL_UNVERIFIED) and the app does not open;
//   · a code to that address proves it, the same account opens straight into
//     Practice, and the unproved password is retired by the server's own
//     pre-registration takeover rule (otp.js), as the card says it will be;
//   · "Use a different email" signs the session out and returns to the email
//     field.

import { pathToFileURL } from 'node:url';
import { onlinePlatform } from './support/online-session.mjs';
import { freshEmail, lastEmailCode, resetOtpLimits, typeCode, waitForStep } from './support/verified-onboarding.mjs';

const CARD = '[data-signin-card="page"]';
const PASSWORD = 'unverified-adult-pass-7319';

/** Register an adult with a password over the real route, as L8's repro did; nothing confirms its email. */
async function registerUnverifiedAdult(platform, label) {
  const email = freshEmail(label);
  platform.h.db.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'register%'").run();
  const made = await platform.h.request('/v1/account/register', {
    method: 'POST', jar: {}, body: { name: `Unverified ${label}`, email, password: PASSWORD, deviceId: `api-${label}`, isAdult: true }
  });
  if (made.status !== 201) throw new Error(`tour-unverified-email: register answered ${made.status} ${made.text}`);
  return { email, id: String(made.data.account.id) };
}

/** On a fresh device: the landing card → "Sign in with password" → the class step → Continue. */
async function signInWithPasswordToClass(page, base, email) {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  const card = page.locator(CARD);
  await card.locator('#signup-destination').waitFor({ timeout: 30000 });
  await page.getByTestId('signup-use-password').click();
  await waitForStep(card, 'password');
  await page.locator('#signup-password-email').fill(email);
  await page.locator('#signup-password').fill(PASSWORD);
  await page.getByTestId('signup-password-submit').click();
  await waitForStep(card, 'class');
  await page.getByTestId('signup-class-10').click();
  await page.getByTestId('signup-class-next').click();
  return card;
}

export const flow = {
  id: 'unverified-email',
  name: 'Account · an adult with an unconfirmed email confirms it with a code on the card, then opens Practice',

  async run({ ctx, base, check, shot }) {
    const platform = await onlinePlatform();
    const { h } = platform;
    const seen = [];
    const capture = request => {
      const target = new URL(request.url());
      if (target.pathname.startsWith('/v1/')) seen.push(`${request.method()} ${target.pathname}`);
    };

    // ── the repro: registered with a password, never confirmed ───────────────
    const learner = await registerUnverifiedAdult(platform, 'adult');
    const before = h.db.prepare('SELECT email_verified_at, password_hash FROM accounts WHERE id=?').get(learner.id);
    await check('the account exists with a password and an email nobody has confirmed', before && before.email_verified_at == null && !!before.password_hash);

    const device = await ctx.browser().newContext({ viewport: { width: 1080, height: 820 }, reducedMotion: 'reduce' });
    try {
      device.on('request', capture);
      const page = await device.newPage();
      const card = await signInWithPasswordToClass(page, base, learner.email);
      await waitForStep(card, 'verify-email');
      await shot?.('verify-email');
      await check('Continue on the class step leads to "Confirm your email", not a dead end',
        await page.getByRole('heading', { name: 'Confirm your email' }).isVisible());
      const lead = await page.locator('#signup-verify-email-lead').innerText();
      await check('the step names the address it will confirm', lead.includes(learner.email), lead);
      await check('and never says a guardian is the blocker: an adult has none',
        await page.getByText('guardian approval', { exact: false }).count() === 0 && await page.getByTestId('signup-error').count() === 0);
      await check('it says plainly that confirming by code retires the unproved password',
        await page.getByTestId('signup-verify-email-password').isVisible());
      await check('the app has not opened', await page.locator('.shell').count() === 0);

      // Nothing is loosened: the server still refuses practice for an unproved address.
      const jar = Object.fromEntries((await device.cookies()).map(c => [c.name, c.value]));
      const refused = await h.request('/v1/practice/issue', { method: 'POST', jar, body: {} });
      await check('the server still refuses practice until the address is proved (403 EMAIL_UNVERIFIED)',
        refused.status === 403 && refused.data?.error?.code === 'EMAIL_UNVERIFIED', `${refused.status} ${refused.text}`);
      const statement = await page.evaluate(async () => { const r = await fetch('/v1/account/guardian/state', { credentials: 'include' }); return r.json(); });
      await check('the server\'s bound statement is the one L8 saw: this account, nothing required, not eligible, unverified',
        String(statement.accountId) === learner.id && statement.required === false && statement.state === 'not-required' &&
          statement.eligible === false && statement.emailVerified === false, JSON.stringify(statement));

      // A code to that address proves it.
      resetOtpLimits(platform);
      await page.getByTestId('signup-verify-email-send').click();
      await page.locator('#signup-code-0').waitFor({ timeout: 15000 });
      const sent = lastEmailCode(platform, learner.email);
      await check('a 6-digit code went to that address', /^\d{6}$/.test(sent || ''));
      await typeCode(page, sent);
      await page.waitForSelector('.shell', { timeout: 60000 });
      await check('the right code opens the app straight into Practice', new URL(page.url()).pathname === '/practice', page.url());
      const after = h.db.prepare('SELECT email_verified_at, password_hash FROM accounts WHERE id=?').get(learner.id);
      await check('the same account is now confirmed', after.email_verified_at > 0);
      await check('and its unproved password was retired by the server\'s pre-registration rule, as the card said', after.password_hash == null);
      await check('no second account was made for the address',
        h.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE email=?').get(learner.email).n === 1);
      const now = await page.evaluate(async () => { const r = await fetch('/v1/account/guardian/state', { credentials: 'include' }); return r.json(); });
      await check('the server now calls this same account eligible', String(now.accountId) === learner.id && now.eligible === true && now.emailVerified === true, JSON.stringify(now));
      await check('every step went through the real server',
        seen.includes('POST /v1/account/login') && seen.includes('POST /v1/account/otp/request') && seen.includes('POST /v1/account/otp/verify'));
    } finally { await device.close(); }

    // ── "Use a different email" signs out and starts again ───────────────────
    const other = await registerUnverifiedAdult(platform, 'other');
    const second = await ctx.browser().newContext({ viewport: { width: 1080, height: 820 }, reducedMotion: 'reduce' });
    try {
      const page = await second.newPage();
      const card = await signInWithPasswordToClass(page, base, other.email);
      await waitForStep(card, 'verify-email');
      await page.getByTestId('signup-verify-email-change').click();
      await waitForStep(card, 'method');
      await check('"Use a different email" returns to an empty email field', (await page.locator('#signup-destination').inputValue()) === '');
      const me = await page.evaluate(async () => (await fetch('/v1/account/me', { credentials: 'include' })).status);
      await check('and the unconfirmed session is signed out on the server', me === 401, String(me));
      await check('the app has not opened', await page.locator('.shell').count() === 0);
    } finally { await second.close(); }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
