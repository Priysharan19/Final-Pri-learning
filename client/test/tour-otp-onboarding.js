// Pri Learning · E2E flow — sign up with a phone code, a parent approves by
// code, and the student lands on the first question.
//
// Nothing is mocked on the server side. Every /v1 request the browser makes is
// forwarded to the real platform server (server/app.js, in this process, on an
// in-memory SQLite database) with the SMS and email TEST adapters
// (PRI_SMS_PROVIDER=test, PRI_AUTH_EMAIL_PROVIDER=test), which send nothing and
// keep each code in memory. The test reads the code the way a phone would
// receive it and types it into the shipped UI.

import { pathToFileURL } from 'node:url';

const SERVER_ORIGIN_SEEN = 'http://localhost:5173';

async function startPlatform() {
  process.env.PRI_AUTH_DELIVERY_KEY = process.env.PRI_AUTH_DELIVERY_KEY || '33'.repeat(32);
  process.env.PRI_SMS_PROVIDER = 'test';
  process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
  process.env.PRI_PUBLIC_ORIGIN = SERVER_ORIGIN_SEEN;
  const { startApp } = await import('../../server/test/support/app-harness.mjs');
  const sms = await import('../../server/platform/smsProvider.js');
  return { h: await startApp(), sms };
}

export const flow = {
  id: 'otp-onboarding',
  name: 'Account · phone code sign-up, a parent approves on their own page, first question',

  async run({ page, ctx, base, check, goto, shot }) {
    const { h, sms } = await startPlatform();
    try {
      await page.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);
      const seen = [];
      const proxy = async route => {
        const request = route.request();
        const url = new URL(request.url());
        seen.push(`${request.method()} ${url.pathname}`);
        const incoming = request.headers();
        const headers = { Accept: 'application/json', Origin: SERVER_ORIGIN_SEEN };
        for (const name of ['cookie', 'content-type', 'x-pri-csrf', 'x-pri-client', 'x-pri-request-id', 'idempotency-key']) {
          if (incoming[name]) headers[name] = incoming[name];
        }
        const response = await fetch(`${h.origin}${url.pathname}${url.search}`, {
          method: request.method(), headers, body: ['GET', 'HEAD'].includes(request.method()) ? undefined : request.postData() ?? undefined
        });
        const outHeaders = { 'content-type': response.headers.get('content-type') || 'application/json' };
        const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
        if (cookies.length) outHeaders['set-cookie'] = cookies.join('\n');
        const retry = response.headers.get('retry-after');
        if (retry) outHeaders['retry-after'] = retry;
        return route.fulfill({ status: response.status, headers: outHeaders, body: Buffer.from(await response.arrayBuffer()) });
      };
      await ctx.route('**/v1/**', proxy);

      await goto('/');
      await page.getByRole('button', { name: 'Create your account' }).click();
      await page.waitForSelector('[data-signup-step="role"]', { timeout: 15000 });
      await check('the account flow opens on "who is setting up"', await page.getByRole('heading', { name: 'Who is setting up Pri?' }).isVisible());
      await check('the step heading takes focus for screen readers',
        await page.evaluate(() => document.activeElement?.id === 'signup-step-title'));
      const animation = await page.locator('.signup-step').evaluate(el => getComputedStyle(el).animationName);
      await check('reduced motion removes the step animation', animation === 'none', animation);

      await page.getByTestId('signup-role-student').click();
      await page.waitForSelector('[data-signup-step="age"]');
      await page.getByTestId('signup-age-15').click();
      await page.waitForSelector('[data-signup-step="class"]');
      await check('JEE is not offered below Class 11',
        await page.getByTestId('signup-class-9').click().then(() => page.getByTestId('signup-track-jee-main').isDisabled()));
      await page.getByTestId('signup-class-11').click();
      await page.getByTestId('signup-track-jee-main').click();
      await shot('class');
      await page.getByTestId('signup-class-next').click();

      await page.waitForSelector('[data-signup-step="method"]');
      await page.locator('#signup-flow-name').fill('Asha');
      await page.locator('#signup-destination').fill('98765 43210');
      await shot('method');
      await page.getByTestId('signup-send-code').click();
      await page.waitForSelector('[data-signup-step="code"]');
      const sent = sms.readTestOutbox({ to: '+919876543210' }).at(-1);
      await check('a 6-digit code went to the +91 number through the test SMS adapter', /^\d{6}$/.test(sent?.code || ''), JSON.stringify(sent));
      await check('the SMS ends with the WebOTP origin line', /@localhost:5173 #\d{6}$/.test(sent?.body || ''));
      await check('the first box asks the keyboard for the code from the message',
        await page.locator('#signup-code-0').getAttribute('autocomplete') === 'one-time-code');
      await check('the resend button waits out its cooldown', await page.getByTestId('signup-resend').isDisabled());

      const wrong = sent.code === '000000' ? '111111' : '000000';
      await page.locator('#signup-code-0').focus();
      await page.keyboard.type(wrong);
      await page.getByRole('alert').waitFor({ timeout: 10000 });
      await check('a wrong code is refused and the boxes clear for another try',
        (await page.locator('[data-testid="signup-code-box"]').evaluateAll(els => els.map(e => e.value).join(''))) === '');

      // Typing digit by digit auto-advances box to box and submits on the sixth.
      await page.locator('#signup-code-0').focus();
      await page.keyboard.type(sent.code);
      await page.waitForSelector('[data-signup-step="parent"]', { timeout: 15000 });
      await check('a 15-year-old is asked for a parent next', await page.getByRole('heading', { name: 'Now, a parent’s approval' }).isVisible());

      const account = h.db.prepare("SELECT a.id, a.email FROM account_phones p JOIN accounts a ON a.id=p.account_id WHERE p.phone_e164='+919876543210'").get();
      await check('the account exists, keyed to the phone, with no real email', !!account && account.email.endsWith('@phone.invalid'));
      const pending = h.db.prepare('SELECT method, confirmed_at FROM guardian_consents WHERE account_id=?').get(account.id);
      await check('and it starts limited: consent pending', pending && pending.confirmed_at === null, JSON.stringify(pending));

      await page.locator('#signup-parent-name').fill('Meera');
      await page.locator('#signup-parent-destination').fill('99887 76655');
      await page.getByTestId('signup-parent-send').click();
      await page.waitForSelector('[data-signup-step="parent-wait"]');
      await check('the child’s screen only waits for the parent: no code box, no approve button',
        await page.locator('[data-testid="signup-parent-waiting"]').isVisible() &&
          await page.locator('input[autocomplete="one-time-code"]').count() === 0 &&
          await page.getByRole('button', { name: 'Approve' }).count() === 0);
      await check('and can ask for the code again once the cooldown ends', await page.getByTestId('signup-parent-resend').isDisabled());
      const parentSms = sms.readTestOutbox({ to: '+919988776655' }).at(-1);
      await check('the parent’s phone got the consent code with the address of their own page',
        parentSms?.purpose === 'guardian-consent' && /^\d{6}$/.test(parentSms.code) && parentSms.body.includes('/guardian/consent'));

      // The parent, on their own device: a separate browser context, no profile,
      // no session, nothing shared with the child's browser.
      const parentCtx = await ctx.browser().newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      try {
        await parentCtx.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);
        await parentCtx.route('**/v1/**', proxy);
        const parentPage = await parentCtx.newPage();
        await parentPage.goto(`${base}/guardian/consent`, { waitUntil: 'domcontentloaded' });
        await parentPage.getByRole('heading', { name: 'What you are agreeing to' }).waitFor({ timeout: 20000 });
        await check('the parent page shows the notice before the code can be entered',
          await parentPage.locator('#guardian-code-0').isDisabled());
        await parentPage.locator('#guardian-destination').fill('99887 76655');
        await parentPage.getByTestId('guardian-agree').check();
        await parentPage.locator('#guardian-code-0').focus();
        await parentPage.evaluate(code => {
          const data = new DataTransfer(); data.setData('text', code);
          document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
        }, parentSms.code);
        await check('pasting fills all six boxes',
          (await parentPage.locator('[data-testid="guardian-code-box"]').evaluateAll(els => els.map(e => e.value).join(''))) === parentSms.code);
        await shot('parent-wait');
        await parentPage.getByTestId('guardian-approve').click();
        await parentPage.getByText('Asha’s account is approved', { exact: false }).waitFor({ timeout: 15000 });
        await check('the parent is told whose account they approved', true);
        await check('the parent page never held a child session',
          !(await parentCtx.cookies()).some(cookie => /session/i.test(cookie.name)));
      } finally {
        await parentCtx.close();
      }

      // The child's waiting screen notices on its own and opens the first question.
      await page.waitForURL(/\/practice/, { timeout: 30000 });
      await page.waitForSelector('.shell', { timeout: 30000 });
      await check('the student lands on practice, the first question', new URL(page.url()).pathname === '/practice');
      const given = h.db.prepare('SELECT method, confirmed_at FROM guardian_consents WHERE account_id=?').get(account.id);
      await check('the parent’s approval is recorded as a phone-code consent', given.method === 'guardian-phone-otp' && given.confirmed_at > 0, JSON.stringify(given));
      await check('every step went through the real server', seen.includes('POST /v1/account/otp/verify') && seen.includes('POST /v1/account/otp/guardian/approve'));
    } finally {
      await h.close();
    }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
