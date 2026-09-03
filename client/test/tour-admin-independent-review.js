// Pri Learning · E2E flow — the CMS must surface independent-review rejection.
//
// Server contract tests prove the author/reviewer identity rule itself. This
// browser flow proves the real Settings staff UI does not turn a rejected
// approval into client-only success or expose Publish after the rejection.

import { pathToFileURL } from 'node:url';

const ADMIN = {
  id: 'acct_e2e_author_admin',
  name: 'Author Admin',
  email: 'author.admin@example.test',
  role: 'admin',
  emailVerified: true
};

const REVISION = {
  id: 'rev_e2e_own_review',
  contentKey: 'cbse/class10/quadratics/own-review-e2e',
  curriculumVersion: 'CBSE-2026-27',
  revision: 4,
  status: 'review',
  createdAt: Date.now() - 60_000
};

export const flow = {
  id: 'admin-independent-review',
  name: 'Cloud admin · independent-review rejection',

  async run({ page, ctx, base, check, goto, createProfile }) {
    let authenticated = false;
    const requests = [];

    await page.addInitScript(origin => {
      window.__PRI_CLOUD_ORIGIN__ = origin;
    }, base);

    const respond = (route, status, value, headers = {}) => route.fulfill({
      status,
      contentType: 'application/json',
      headers,
      body: JSON.stringify(value)
    });

    await ctx.route('**/v1/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();
      const headers = request.headers();
      requests.push({ path, method, headers, body: request.postData() || '' });

      if (path === '/v1/billing/config' && method === 'GET') {
        return respond(route, 200, {
          display: { currency: 'INR', monthly: 1000, annual: 10000, trialDays: 7, advisoryOnly: true },
          webCheckout: { configured: false }
        });
      }

      if (path === '/v1/account/login' && method === 'POST') {
        authenticated = true;
        return respond(route, 200, { account: ADMIN }, {
          'set-cookie': 'pri_csrf=e2e-independent-review-csrf; Path=/; SameSite=Lax'
        });
      }

      if (path === '/v1/account/me' && method === 'GET') {
        return authenticated
          ? respond(route, 200, { account: ADMIN })
          : respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/entitlements' && method === 'GET') {
        return authenticated
          ? respond(route, 200, { entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 1, issuedAt: Date.now() } })
          : respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/account/devices' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? {
          devices: [{ id: 'ses_independent_review', deviceId: 'browser-independent-review', current: true, lastSeenAt: Date.now(), expiresAt: Date.now() + 86_400_000 }]
        } : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/account/identity' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? {
          providers: [{ provider: 'password', linkedAt: Date.now() }]
        } : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/assignments' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? { assignments: [] }
          : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/classes' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? { classes: [] }
          : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/content/admin/revisions' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? { revisions: [REVISION] }
          : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/admin/health' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? {
          accounts: 1,
          activeSessions: 1,
          classes: 0,
          publishedContent: 0,
          openReports: 0,
          pendingDelivery: 0
        } : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/admin/users' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? { users: [] }
          : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/admin/audit' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? { entries: [] }
          : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === `/v1/content/${REVISION.id}/approve` && method === 'POST') {
        return respond(route, 409, {
          error: {
            code: 'INDEPENDENT_REVIEW_REQUIRED',
            message: 'The author cannot approve their own revision.'
          }
        });
      }

      return respond(route, authenticated ? 404 : 401, {
        error: {
          code: authenticated ? 'NOT_FOUND' : 'AUTH_REQUIRED',
          message: authenticated ? `Unhandled independent-review E2E route ${method} ${path}` : 'Sign in is required.'
        }
      });
    });

    await goto('/');
    await createProfile({ name: 'Admin Review Profile', year: 10 });
    await goto('/settings');

    const accountPanel = page.locator('section', { has: page.locator('#cloud-account-title') });
    await accountPanel.getByLabel('Email').fill(ADMIN.email);
    await accountPanel.getByLabel('Password').fill('admin-e2e-password-42');
    await accountPanel.getByRole('button', { name: 'Connect account' }).click();
    await accountPanel.getByText('Connected', { exact: true }).waitFor({ timeout: 15_000 });

    const staff = page.locator('section', { has: page.locator('#staff-operations-title') });
    await staff.waitFor({ state: 'visible', timeout: 15_000 });
    await check('admin staff operations appear immediately after sign-in', await staff.isVisible());

    const card = staff.locator('div.card').filter({ hasText: REVISION.contentKey }).first();
    await card.waitFor({ state: 'visible', timeout: 15_000 });
    await check('the authored revision is still in review with an approval control',
      (await card.innerText()).includes('review') &&
        await card.getByRole('button', { name: 'Approve independently' }).isVisible());

    await card.getByRole('button', { name: 'Approve independently' }).click();
    const alert = staff.getByRole('alert');
    await alert.getByText('The author cannot approve their own revision.', { exact: true }).waitFor({ timeout: 15_000 });
    await check('the server independent-review rejection is surfaced to the administrator',
      await alert.isVisible());

    await check('a rejected self-approval leaves the revision in review',
      (await card.innerText()).includes('review'));
    await check('Publish is not exposed after the rejected approval',
      await card.getByRole('button', { name: 'Publish' }).count() === 0);

    const approveCall = requests.find(row => row.path === `/v1/content/${REVISION.id}/approve` && row.method === 'POST');
    await check('the rejected approval still uses audited transport and the server-issued CSRF token',
      !!approveCall && approveCall.headers['x-pri-client'] === 'web-v1' &&
        approveCall.headers['x-pri-csrf'] === 'e2e-independent-review-csrf',
      approveCall ? JSON.stringify(approveCall.headers) : 'no approve request captured');

    await check('the browser never attempts a publish after independent review fails',
      !requests.some(row => row.path === `/v1/content/${REVISION.id}/publish` && row.method === 'POST'));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
