// Pri Learning · First impression — users can escape a stalled Google window.
// Run after a client build: node client/test/tour-first-impression.js --no-build
//
// The Google account page is deliberately never completed. A real human can
// close it or encounter a provider-side refusal; the Pri card must offer an
// explicit cancel and restore the original choices without creating a user.
// No real Google account, token, payment or provider request is used.
import { pathToFileURL } from 'node:url';

export const flow = {
  id: 'welcome-popup-cancellation',
  name: 'Welcome · social popup can be cancelled with no account mutation',

  async run({ page, ctx, base, goto, check }) {
    const requests = [];
    await page.addInitScript(origin => {
      window.__PRI_CLOUD_ORIGIN__ = origin;
    }, base);

    const respond = (route, status, body) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(body)
    });

    await ctx.route('https://accounts.google.com/**', route => route.fulfill({
      status: 200, contentType: 'text/html',
      body: '<!doctype html><title>Google sign-in test</title><p>Waiting for a user to choose an account.</p>'
    }));
    await ctx.route('**/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      requests.push(method + ' ' + path);
      if (path === '/v1/account/identity/providers') return respond(route, 200, {
        providers: { google: { clientId: 'pri-e2e.apps.googleusercontent.com' }, apple: null }
      });
      if (path === '/v1/account/otp/channels') return respond(route, 200, {
        channels: { email: true, sms: false }
      });
      if (path === '/v1/account/identity/nonce') return respond(route, 201, {
        nonce: 'e2e-cancel-0123456789', expiresAt: Date.now() + 600000
      });
      return respond(route, 401, { error: { code: 'AUTH_REQUIRED' } });
    });

    await goto('/');
    const google = page.locator('[data-provider="google"]');
    await google.waitFor({ state: 'visible', timeout: 15000 });
    await check('the configured Google option is full-width, not half-width',
      await google.evaluate(el => {
        const r = el.getBoundingClientRect();
        const p = el.parentElement.getBoundingClientRect();
        return r.width >= p.width - 2;
      }));
    await check('email sign-in makes the code expectation explicit',
      /code|कोड/i.test(await page.locator('.signup-method-hint').innerText()));

    const popupPromise = page.waitForEvent('popup', { timeout: 15000 });
    await google.click();
    const popup = await popupPromise;
    await page.getByTestId('signup-cancel-social').waitFor({ state: 'visible', timeout: 15000 });
    await check('a stalled provider window has an explicit cancel action',
      await page.getByTestId('signup-cancel-social').isVisible());
    await page.getByTestId('signup-cancel-social').click();
    await page.waitForFunction(() => !document.querySelector('[data-testid="signup-cancel-social"]'), null, { timeout: 15000 });
    await check('the Google sign-in action is enabled again', await google.isEnabled());
    const notice = await page.getByTestId('signup-notice').innerText().catch(() => '');
    await check('the cancellation is explained instead of trapping the learner',
      /cancel|रद्द/i.test(notice), notice);
    await check('the old provider popup is closed', popup.isClosed());
    await check('cancelling cannot issue a Google account sign-in request',
      !requests.some(r => r.startsWith('POST /v1/account/identity/google/sign-in')),
      JSON.stringify(requests.filter(r => r.includes('identity'))));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
