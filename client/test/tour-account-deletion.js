// Pri Learning · E2E flows — account deletion for a code-only account, in the
// app and from the public web page.
//
// Apple App Store Review Guideline 5.1.1(v) and Google Play's "Delete account"
// requirement: an account made with a one-time code (no password, no Apple or
// Google) must be deletable inside the app, and a person without the app must
// be able to have it deleted at a public URL. Nothing is mocked on the server
// side: every /v1 request the browser makes is forwarded to the real platform
// server (server/app.js, in this process, in-memory SQLite) with the email and
// SMS TEST adapters, which send nothing and keep each code in memory. The test
// reads the code the way a mailbox would and types it into the shipped UI.

import { pathToFileURL } from 'node:url';

const SERVER_ORIGIN_SEEN = 'http://localhost:5173';

async function startPlatform() {
  process.env.PRI_AUTH_DELIVERY_KEY = process.env.PRI_AUTH_DELIVERY_KEY || '55'.repeat(32);
  process.env.PRI_SMS_PROVIDER = 'test';
  process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
  process.env.PRI_PUBLIC_ORIGIN = SERVER_ORIGIN_SEEN;
  const { startApp } = await import('../../server/test/support/app-harness.mjs');
  const sms = await import('../../server/platform/smsProvider.js');
  return { h: await startApp(), sms };
}

/** Forward the browser's /v1 calls to the in-process server, cookies and CSRF pair included. */
function proxyTo(h, seen = []) {
  return async route => {
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
}

const lastCode = (sms, to) => sms.readTestOutbox({ to }).at(-1)?.code;
const wrongCode = right => (right === '000000' ? '111111' : '000000');
const typeCode = async (page, firstBoxId, code) => {
  await page.locator(`#${firstBoxId}`).focus();
  await page.keyboard.type(code);
};

/** An adult, code-only email account made the way the server makes one. Returns its id. */
async function makeCodeOnlyAccount(h, sms, email, name) {
  const post = (path, body, jar) => h.request(`/v1/account/otp${path}`, { method: 'POST', body, jar, headers: { Origin: SERVER_ORIGIN_SEEN } });
  const jar = {};
  const sent = await post('/request', { channel: 'email', destination: email });
  const verified = await post('/verify', { channel: 'email', destination: email, challengeId: sent.data.challengeId, code: lastCode(sms, email), profile: { name, isAdult: true } }, jar);
  if (verified.data?.status !== 'signed-in') throw new Error(`could not make the account: ${JSON.stringify(verified.data)}`);
  return { id: verified.data.account.id, jar };
}

export const flows = [
  {
    id: 'account-delete-public',
    name: 'Account · deletion from the public page, no sign-in, by email code',

    async run({ page, ctx, base, check, shot }) {
      const { h, sms } = await startPlatform();
      try {
        await page.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);
        const seen = [];
        await ctx.route('**/v1/**', proxyTo(h, seen));

        sms.clearTestOutbox();
        const leaver = await makeCodeOnlyAccount(h, sms, 'leaver@example.test', 'Leaver');
        h.db.prepare('DELETE FROM rate_limits').run();
        sms.clearTestOutbox();

        await page.goto(`${base}/account/delete-request`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Delete your Pri Learning account' }).waitFor({ timeout: 20000 });
        await check('the public page opens with no profile and no session',
          !(await ctx.cookies()).some(cookie => /session/i.test(cookie.name)));
        await check('it tells the reader how to delete inside the app, for every sign-in method',
          await page.getByText('Settings → Account → Delete cloud account', { exact: false }).isVisible()
          && await page.getByText('a code sent to your email address or mobile number', { exact: false }).isVisible());
        await check('and what deletion removes and what survives it, as the privacy notice says',
          await page.getByText('with no waiting period', { exact: false }).isVisible()
          && await page.getByText('record of any payment', { exact: false }).isVisible());
        await check('and links to the privacy notice',
          await page.locator('a[href="/privacy"]').count() === 1);

        await page.getByTestId('delete-request-lang-hi').click();
        await page.getByRole('heading', { name: 'अपना Pri Learning खाता मिटाएँ' }).waitFor({ timeout: 10000 });
        await check('the page reads in Hindi too', await page.getByText('ऐप में', { exact: true }).isVisible());
        await shot('hindi');
        await page.getByTestId('delete-request-lang-en').click();
        await page.getByRole('heading', { name: 'Delete your Pri Learning account' }).waitFor({ timeout: 10000 });

        await page.locator('#delete-request-email').fill('Leaver@Example.test');
        await page.getByTestId('delete-request-send').click();
        await page.locator('#delete-request-code-0').waitFor({ timeout: 15000 });
        const code = lastCode(sms, 'leaver@example.test');
        await check('a 6-digit code went to the account’s address through the test email adapter', /^\d{6}$/.test(code || ''));
        await check('the page does not say whether an account exists',
          await page.getByText('If there is an account for that address', { exact: false }).isVisible());

        await check('a confirm button is there for a pasted code; typing the sixth digit submits by itself',
          await page.getByTestId('delete-request-confirm').isDisabled());
        await typeCode(page, 'delete-request-code-0', wrongCode(code));
        await page.getByRole('alert').waitFor({ timeout: 10000 });
        await check('a wrong code is refused and nothing is deleted',
          !!h.db.prepare('SELECT 1 FROM accounts WHERE id=?').get(leaver.id));
        await shot('wrong-code');

        await typeCode(page, 'delete-request-code-0', code);
        await page.getByTestId('delete-request-done').waitFor({ timeout: 15000 });
        await check('the right code deletes the account and the page says so',
          await page.getByTestId('delete-request-done').getAttribute('data-outcome') === 'deleted');
        await check('the account row is gone', !h.db.prepare('SELECT 1 FROM accounts WHERE id=?').get(leaver.id));
        const me = await h.request('/v1/account/me', { jar: leaver.jar, headers: { Origin: SERVER_ORIGIN_SEEN } });
        await check('its session is dead', me.status === 401);
        const receipt = h.db.prepare("SELECT actor_account_id, metadata_json FROM audit_log WHERE action='account.delete' AND target_id=?").get(leaver.id);
        await check('one audit receipt with no actor and no personal data', !!receipt && receipt.actor_account_id === null && receipt.metadata_json === '{}');
        await check('no table still names the person',
          !h.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
            .some(({ name }) => JSON.stringify(h.db.prepare(`SELECT * FROM "${name}"`).all()).toLowerCase().includes('leaver@example.test')));
        await check('every step went through the real server',
          seen.includes('POST /v1/account/otp/delete-request') && seen.includes('POST /v1/account/otp/delete-confirm'));
        await shot('deleted');
      } finally {
        await h.close();
      }
    }
  },
  {
    id: 'account-delete-in-app',
    name: 'Account · a code-only account deletes itself in Settings with a fresh code',

    async run({ page, ctx, base, check, goto, shot }) {
      const { h, sms } = await startPlatform();
      try {
        await page.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);
        const seen = [];
        await ctx.route('**/v1/**', proxyTo(h, seen));

        // Sign up as an adult with an email code, through the shipped flow.
        await goto('/');
        await page.getByRole('button', { name: 'Create your account' }).click();
        await page.waitForSelector('[data-signup-step="role"]', { timeout: 15000 });
        await page.getByTestId('signup-role-student').click();
        await page.waitForSelector('[data-signup-step="age"]');
        await page.getByTestId('signup-age-18').click();
        await page.waitForSelector('[data-signup-step="class"]');
        await page.getByTestId('signup-class-12').click();
        await page.getByTestId('signup-class-next').click();
        await page.waitForSelector('[data-signup-step="method"]');
        await page.getByTestId('signup-channel-email').click();
        await page.locator('#signup-flow-name').fill('Ravi');
        await page.locator('#signup-destination').fill('ravi.leaver@example.test');
        sms.clearTestOutbox();
        await page.getByTestId('signup-send-code').click();
        await page.waitForSelector('[data-signup-step="code"]');
        const signIn = lastCode(sms, 'ravi.leaver@example.test');
        await check('a sign-up code went to the email address', /^\d{6}$/.test(signIn || ''));
        await typeCode(page, 'signup-code-0', signIn);
        await page.waitForSelector('.shell', { timeout: 30000 });
        const account = h.db.prepare("SELECT id, password_hash FROM accounts WHERE email='ravi.leaver@example.test'").get();
        await check('the account exists with no password and no Apple/Google link',
          !!account && account.password_hash === null
          && h.db.prepare('SELECT COUNT(*) AS n FROM account_identities WHERE account_id=?').get(account.id).n === 0);

        // Settings → Account: the deletion control for an account with no password.
        await page.goto(`${base}/settings#cloud-account-title`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#cloud-account-title', { timeout: 30000 });
        await page.getByTestId('cloud-delete-send-code').waitFor({ timeout: 30000 });
        await check('the Account panel offers deletion by a code sent to the account’s own address',
          await page.getByText('This account has no password', { exact: false }).isVisible());
        await check('and tells an Apple subscriber to cancel in Apple ID settings as well',
          await page.getByText('cancel the subscription in your Apple ID settings', { exact: false }).isVisible());
        await shot('account-panel');

        sms.clearTestOutbox();
        await page.getByTestId('cloud-delete-send-code').click();
        await page.locator('#cloud-delete-code-0').waitFor({ timeout: 15000 });
        const reauth = sms.readTestOutbox({ to: 'ravi.leaver@example.test' }).at(-1);
        await check('a fresh code went to the account’s own email; the browser never named the destination',
          reauth?.purpose === 'reauth' && /^\d{6}$/.test(reauth.code) && !seen.some(line => line.includes('example.test')));

        await typeCode(page, 'cloud-delete-code-0', reauth.code);
        await check('the delete button stays disabled until DELETE is typed',
          await page.getByTestId('cloud-delete-with-code').isDisabled());
        await page.locator('#cloud-delete-phrase').fill('DELETE');
        await check('and enables once it is', !(await page.getByTestId('cloud-delete-with-code').isDisabled()));

        // A wrong code first: nothing is deleted and the boxes clear.
        await page.locator('#cloud-delete-code-0').focus();
        for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
        await typeCode(page, 'cloud-delete-code-0', wrongCode(reauth.code));
        await page.getByTestId('cloud-delete-with-code').click();
        await page.getByRole('alert').waitFor({ timeout: 10000 });
        await check('a wrong code deletes nothing', !!h.db.prepare('SELECT 1 FROM accounts WHERE id=?').get(account.id));

        await typeCode(page, 'cloud-delete-code-0', reauth.code);
        await page.getByTestId('cloud-delete-with-code').click();
        await page.waitForFunction(() => !document.querySelector('#cloud-delete-code-0'), { timeout: 20000 });
        await check('the right code deletes the account', !h.db.prepare('SELECT 1 FROM accounts WHERE id=?').get(account.id));
        await check('the deletion went through DELETE /v1/account with a code, through the real server',
          seen.includes('POST /v1/account/otp/reauth-request') && seen.includes('DELETE /v1/account'));
        await check('the local profile on the device is untouched (deletion is of the cloud account, not the device)',
          (await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name || ''))).some(name => /pri/i.test(name)));
        await shot('deleted');
      } finally {
        await h.close();
      }
    }
  }
];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows(flows) ? 1 : 0);
}
