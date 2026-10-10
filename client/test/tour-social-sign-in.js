// Pri Learning · E2E flow — Continue with Google, in a real browser.
//
// Nothing reaches Google. Playwright stands in for accounts.google.com by
// answering the popup's authorize request with the redirect Google would send:
// back to /auth/callback.html on this origin with the identity token in the
// fragment. Everything between — the popup opened from the click, the nonce
// from the server, the state, the service worker leaving the callback page
// alone, the BroadcastChannel hand-back and the account link — is the shipped
// build. The server's own verification of the token is server/test/
// oidc-verification-check.mjs.

import { pathToFileURL } from 'node:url';

const ACCOUNT = {
  id: 'acct_e2e_social',
  name: 'Social Student',
  email: 'social.student@example.test',
  role: 'student',
  emailVerified: true
};
const NONCE = 'e2e-server-nonce-0123456789';
const ID_TOKEN = 'e2e-header.e2e-payload.e2e-signature';

export const flow = {
  id: 'social',
  name: 'Cloud · Continue with Google signs in, and Google confirms deletion',

  async run({ page, ctx, base, check, goto, createProfile }) {
    let authenticated = false;
    const requests = [];
    let authorizeUrl = null;

    await page.addInitScript(origin => {
      window.__PRI_CLOUD_ORIGIN__ = origin;
    }, base);

    const respond = (route, status, value, headers = {}) => route.fulfill({
      status, contentType: 'application/json', headers, body: JSON.stringify(value)
    });

    await ctx.route('https://accounts.google.com/**', async route => {
      authorizeUrl = new URL(route.request().url());
      const fragment = new URLSearchParams({ state: authorizeUrl.searchParams.get('state') || '', id_token: ID_TOKEN });
      return route.fulfill({ status: 302, headers: { location: `${authorizeUrl.searchParams.get('redirect_uri')}#${fragment}` } });
    });

    await ctx.route('**/v1/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      requests.push({ path, method, body: request.postData() || '', headers: request.headers() });
      if (path === '/v1/billing/config') return respond(route, 200, { display: null, webCheckout: { configured: false } });
      if (path === '/v1/account/identity/providers') {
        return respond(route, 200, { providers: { google: { clientId: 'pri-e2e.apps.googleusercontent.com' }, apple: null } });
      }
      if (path === '/v1/account/identity/nonce' && method === 'POST') return respond(route, 201, { nonce: NONCE, expiresAt: Date.now() + 600000 });
      if (path === '/v1/account/identity/google/sign-in' && method === 'POST') {
        authenticated = true;
        return respond(route, 200, { account: ACCOUNT, created: false }, { 'set-cookie': 'pri_csrf=e2e-csrf; Path=/; SameSite=Lax' });
      }
      if (path === '/v1/account/me') {
        return authenticated ? respond(route, 200, { account: ACCOUNT }) : respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }
      if (path === '/v1/entitlements') {
        return authenticated
          ? respond(route, 200, { accountId: ACCOUNT.id, entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 1, issuedAt: Date.now() } })
          : respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }
      if (path === '/v1/account' && method === 'DELETE') {
        authenticated = false;
        return respond(route, 200, { deleted: true });
      }
      if (path === '/v1/account/logout' && method === 'POST') return respond(route, 200, { ok: true });
      if (path === '/v1/account/identity') return respond(route, 200, { providers: [{ provider: 'google', linkedAt: Date.now() }] });
      if (path === '/v1/account/devices') return respond(route, 200, { devices: [] });
      if (path === '/v1/account/guardian/state') return respond(route, 200, { required: false, state: 'not-required' });
      if (path === '/v1/assignments') return respond(route, 200, { assignments: [] });
      if (path === '/v1/classes') return respond(route, 200, { classes: [] });
      return respond(route, authenticated ? 404 : 401, { error: { code: authenticated ? 'NOT_FOUND' : 'AUTH_REQUIRED', message: `Unhandled E2E route ${method} ${path}` } });
    });

    await goto('/');
    await createProfile({ name: 'Social Student', year: 9 });
    await goto('/settings');
    const panel = page.locator('section', { has: page.locator('#cloud-account-title') });
    const google = panel.getByRole('button', { name: 'Continue with Google' });
    await google.waitFor({ state: 'visible', timeout: 15000 });
    await check('Continue with Google is offered when the deployment configures it', await google.isVisible());
    await check('Apple is not offered when the deployment names no Apple web client id',
      !(await panel.getByRole('button', { name: 'Continue with Apple' }).isVisible()));

    const popupOpened = page.waitForEvent('popup', { timeout: 15000 });
    await google.click();
    const popup = await popupOpened;
    await check('the click opens a sign-in window (not blocked: it opens before any await)', !!popup);
    await panel.locator('[data-cloud-state]', { hasText: /^Signed in$/ }).waitFor({ timeout: 20000 });
    await check('the profile ends up connected without leaving Settings',
      new URL(page.url()).pathname === '/settings' && await panel.locator('[data-cloud-state]', { hasText: /^Signed in$/ }).isVisible());

    await check('the popup went to Google with this deployment\'s client id and the server nonce',
      authorizeUrl?.searchParams.get('client_id') === 'pri-e2e.apps.googleusercontent.com' &&
        authorizeUrl?.searchParams.get('nonce') === NONCE &&
        authorizeUrl?.searchParams.get('response_type') === 'id_token',
      String(authorizeUrl));
    await check('Google is asked to return to the callback page on this origin',
      authorizeUrl?.searchParams.get('redirect_uri') === `${base}/auth/callback.html`, String(authorizeUrl));
    const signIn = requests.find(row => row.path === '/v1/account/identity/google/sign-in');
    const body = signIn ? JSON.parse(signIn.body || '{}') : {};
    await check('the token from the callback reaches the server with its nonce',
      body.idToken === ID_TOKEN && body.nonce === NONCE, JSON.stringify(body));
    await check('"Sign in" asks the server not to create an account and sends no age details',
      body.createAccount === false && !('guardianEmail' in body) && !('year' in body), JSON.stringify(body));
    await check('the sign-in goes through the audited web transport',
      signIn?.headers['x-pri-client'] === 'web-v1', JSON.stringify(signIn?.headers || {}));
    await popup.waitForEvent('close', { timeout: 5000 }).catch(() => {});
    await check('the sign-in window closes itself', popup.isClosed());

    // A Google-only account has no password: deleting it is a fresh Google
    // sign-in, with the same nonce gate, after typing DELETE.
    const remove = panel.getByRole('button', { name: 'Confirm with Google and delete' });
    await remove.waitFor({ state: 'visible', timeout: 15000 });
    await check('a Google-only account is offered deletion through Google', await remove.isVisible());
    await check('deletion stays locked until DELETE is typed', await remove.isDisabled());
    await panel.getByLabel('Type DELETE').fill('DELETE');
    authorizeUrl = null;
    const secondPopup = page.waitForEvent('popup', { timeout: 15000 });
    await remove.click();
    await secondPopup;
    await panel.locator('[data-cloud-state]', { hasText: /^Not signed in$/ }).waitFor({ timeout: 20000 });
    const deletion = requests.find(row => row.path === '/v1/account' && row.method === 'DELETE');
    const deletionBody = deletion ? JSON.parse(deletion.body || '{}') : {};
    await check('deletion carries a fresh Google token and nonce, never a bare session',
      deletionBody.provider === 'google' && deletionBody.idToken === ID_TOKEN && deletionBody.nonce === NONCE &&
        authorizeUrl?.searchParams.get('nonce') === NONCE, JSON.stringify(deletionBody));
    await check('after deletion the local profile is disconnected and stays on this device',
      await panel.getByText('Not connected', { exact: true }).isVisible());
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
