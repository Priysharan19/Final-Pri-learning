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
import { mockAccountServer } from './support/mock-account.mjs';

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

  async run({ page, ctx, base, check, goto }) {
    // The account, its session and the activation handshake (gate, first sync)
    // are the shared stand-in's; Google's part of the conversation is below.
    const mock = mockAccountServer({ account: ACCOUNT, providers: { google: { clientId: 'pri-e2e.apps.googleusercontent.com' }, apple: null } });
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
      if (path === '/v1/account/identity/nonce' && method === 'POST') return respond(route, 201, { nonce: NONCE, expiresAt: Date.now() + 600000 });
      if (path === '/v1/account/identity/google/sign-in' && method === 'POST') {
        mock.state.authenticated = true;
        return respond(route, 200, { account: ACCOUNT, created: false }, { 'set-cookie': 'pri_csrf=e2e-csrf; Path=/; SameSite=Lax' });
      }
      if (path === '/v1/account' && method === 'DELETE') {
        mock.state.authenticated = false;
        return respond(route, 200, { deleted: true });
      }
      if (await mock.handle(route)) return;
      const authenticated = mock.state.authenticated;
      if (path === '/v1/account/identity') return respond(route, 200, { providers: [{ provider: 'google', linkedAt: Date.now() }] });
      if (path === '/v1/account/devices') return respond(route, 200, { devices: [] });
      if (path === '/v1/assignments') return respond(route, 200, { assignments: [] });
      if (path === '/v1/classes') return respond(route, 200, { classes: [] });
      return respond(route, authenticated ? 404 : 401, { error: { code: authenticated ? 'NOT_FOUND' : 'AUTH_REQUIRED', message: `Unhandled E2E route ${method} ${path}` } });
    });

    // Google is offered on the landing card itself, beneath the email field:
    // the one card is where every sign-in happens now.
    await goto('/');
    const card = page.locator('[data-signin-card="page"]');
    const google = card.locator('[data-provider="google"]');
    await google.waitFor({ state: 'visible', timeout: 15000 });
    await check('Continue with Google is offered on the landing card when the deployment configures it', await google.isVisible());
    await check('Apple is not offered when the deployment names no Apple web client id', await card.locator('[data-provider="apple"]').count() === 0);

    const popupOpened = page.waitForEvent('popup', { timeout: 15000 });
    await google.click();
    const popup = await popupOpened;
    await check('the click opens a sign-in window (not blocked: it opens before any await)', !!popup);
    // A returning Google account on a device with no profile: the class is the
    // only thing asked, then the gate (session, statement, first sync) opens the app.
    await card.locator('[data-testid="signup-class-9"]').waitFor({ timeout: 20000 });
    await card.getByTestId('signup-class-9').click();
    await card.getByTestId('signup-class-next').click();
    await page.locator('.shell').waitFor({ timeout: 60000 });
    await check('Google signs the student in on the landing card; the class is asked once and the app opens, past the gate',
      new URL(page.url()).pathname === '/practice' && await page.locator('[data-testid="account-activation-gate"]').count() === 0,
      page.url());
    await check('the gate confirmed the account and ran the first sync before opening', mock.state.syncPushes >= 1 && mock.state.syncPulls >= 1);

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
    await goto('/settings');
    const panel = page.locator('section', { has: page.locator('#cloud-account-title') });
    const remove = panel.getByRole('button', { name: 'Confirm with Google and delete' });
    await remove.waitFor({ state: 'visible', timeout: 15000 });
    await check('a Google-only account is offered deletion through Google', await remove.isVisible());
    await check('deletion stays locked until DELETE is typed', await remove.isDisabled());
    await panel.getByLabel('Type DELETE').fill('DELETE');
    authorizeUrl = null;
    const secondPopup = page.waitForEvent('popup', { timeout: 15000 });
    await remove.click();
    await secondPopup;
    // The account is gone: the device profile is unlinked and the app relocks
    // at once — the gate, not a disconnected Settings page.
    await page.locator('[data-testid="account-activation-gate"]').waitFor({ timeout: 20000 });
    const deletion = requests.find(row => row.path === '/v1/account' && row.method === 'DELETE');
    const deletionBody = deletion ? JSON.parse(deletion.body || '{}') : {};
    await check('deletion carries a fresh Google token and nonce, never a bare session',
      deletionBody.provider === 'google' && deletionBody.idToken === ID_TOKEN && deletionBody.nonce === NONCE &&
        authorizeUrl?.searchParams.get('nonce') === NONCE, JSON.stringify(deletionBody));
    await check('after deletion the device profile is unlinked and the app is relocked: the gate asks for an account, nothing of the shell shows',
      await page.locator('.shell').count() === 0 && await page.locator('[data-testid="account-activation-gate"]').getAttribute('data-activation-status') === 'signin');
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
