// Pri Learning · E2E flow — authenticated admin/CMS release operations.
//
// This flow exercises the real Settings account and StaffOperationsPanel UI while
// Playwright intercepts the audited /v1 transport. Server contract suites remain
// authoritative for authorization rules; this browser journey proves that the
// product exposes those rules correctly and never bypasses independent review.

import { pathToFileURL } from 'node:url';

const ADMIN = {
  id: 'acct_e2e_admin',
  name: 'Release Admin',
  email: 'release.admin@example.test',
  role: 'admin',
  emailVerified: true
};

const OTHER_USER = {
  id: 'acct_e2e_student',
  name: 'Example Student',
  email: 'student@example.test',
  role: 'student',
  entitlement: { plan: 'free', status: 'free' }
};

const EXTERNAL_KEY = 'cbse/class10/quadratics/reviewed-example';
const OWN_KEY = 'cbse/class10/quadratics/admin-authored-example';

export const flow = {
  id: 'admin-cms',
  name: 'Admin CMS · independent review, publish, roles and audit',

  async run({ page, ctx, base, check, goto, createProfile }) {
    let authenticated = false;
    let users = [
      { ...ADMIN, entitlement: { plan: 'premium', status: 'active' } },
      { ...OTHER_USER }
    ];
    let revisions = [{
      id: 'rev_external',
      contentKey: EXTERNAL_KEY,
      curriculumVersion: 'CBSE-2026-27',
      revision: 2,
      status: 'review',
      createdAt: Date.now() - 60000
    }];
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

    const requireAuth = (route, value) => authenticated
      ? respond(route, 200, value)
      : respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });

    await ctx.route('**/v1/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();
      const bodyText = request.postData() || '';
      const body = bodyText ? JSON.parse(bodyText) : {};
      requests.push({ path, method, body: bodyText, headers: request.headers() });

      if (path === '/v1/billing/config' && method === 'GET') {
        return respond(route, 200, {
          display: { currency: 'INR', monthly: 1000, annual: 10000, trialDays: 7, advisoryOnly: true },
          webCheckout: { configured: false }
        });
      }

      if (path === '/v1/account/login' && method === 'POST') {
        authenticated = true;
        return respond(route, 200, { account: ADMIN }, {
          'set-cookie': 'pri_csrf=e2e-admin-csrf; Path=/; SameSite=Lax'
        });
      }

      if (path === '/v1/account/me' && method === 'GET') {
        return authenticated
          ? respond(route, 200, { account: ADMIN })
          : respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/entitlements' && method === 'GET') {
        return requireAuth(route, {
          entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 1, issuedAt: Date.now() }
        });
      }

      if (path === '/v1/account/devices' && method === 'GET') {
        return requireAuth(route, {
          devices: [{ id: 'ses_admin_e2e', deviceId: 'browser-admin-e2e', current: true, lastSeenAt: Date.now(), expiresAt: Date.now() + 86400000 }]
        });
      }

      if (path === '/v1/account/identity' && method === 'GET') {
        return requireAuth(route, { providers: [{ provider: 'password', linkedAt: Date.now() - 86400000 }] });
      }

      // Sibling Settings panels also refresh on the shared cloud-session event.
      if (path === '/v1/assignments' && method === 'GET') return requireAuth(route, { assignments: [] });
      if (path === '/v1/classes' && method === 'GET') return requireAuth(route, { classes: [] });

      if (path === '/v1/content/admin/revisions' && method === 'GET') {
        return requireAuth(route, { revisions });
      }

      if (path === '/v1/content/drafts' && method === 'POST') {
        if (!authenticated) return respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
        const revision = {
          id: 'rev_own',
          contentKey: body.contentKey,
          curriculumVersion: body.curriculumVersion,
          revision: 1,
          status: 'draft',
          createdAt: Date.now()
        };
        revisions = [revision, ...revisions];
        return respond(route, 201, { revision });
      }

      if (path === '/v1/content/rev_own/submit-review' && method === 'POST') {
        revisions = revisions.map(row => row.id === 'rev_own' ? { ...row, status: 'review' } : row);
        return respond(route, 200, { revision: revisions.find(row => row.id === 'rev_own') });
      }

      if (path === '/v1/content/rev_own/approve' && method === 'POST') {
        return respond(route, 409, {
          error: { code: 'INDEPENDENT_REVIEW_REQUIRED', message: 'The author cannot approve their own revision.' }
        });
      }

      if (path === '/v1/content/rev_external/approve' && method === 'POST') {
        revisions = revisions.map(row => row.id === 'rev_external' ? { ...row, status: 'approved' } : row);
        return respond(route, 200, { revision: revisions.find(row => row.id === 'rev_external') });
      }

      if (path === '/v1/content/rev_external/publish' && method === 'POST') {
        revisions = revisions.map(row => row.id === 'rev_external' ? { ...row, status: 'published' } : row);
        return respond(route, 200, { revision: revisions.find(row => row.id === 'rev_external') });
      }

      if (path === '/v1/admin/health' && method === 'GET') {
        return requireAuth(route, {
          accounts: users.length,
          activeSessions: 1,
          classes: 0,
          publishedContent: revisions.filter(row => row.status === 'published').length,
          openReports: 0,
          pendingDelivery: 0
        });
      }

      if (path === '/v1/admin/users' && method === 'GET') return requireAuth(route, { users });

      if (path === `/v1/admin/users/${OTHER_USER.id}/role` && method === 'PATCH') {
        users = users.map(row => row.id === OTHER_USER.id ? { ...row, role: body.role } : row);
        return respond(route, 200, { account: users.find(row => row.id === OTHER_USER.id) });
      }

      if (path === '/v1/admin/audit' && method === 'GET') {
        return requireAuth(route, {
          entries: [{ id: 'audit_e2e', action: 'content.reviewed', targetKind: 'content_revision', targetId: 'rev_external', createdAt: Date.now() }]
        });
      }

      return respond(route, authenticated ? 404 : 401, {
        error: {
          code: authenticated ? 'NOT_FOUND' : 'AUTH_REQUIRED',
          message: authenticated ? `Unhandled admin E2E route ${method} ${path}` : 'Sign in is required.'
        }
      });
    });

    await goto('/');
    await createProfile({ name: 'Admin Local Profile', year: 12 });
    await goto('/settings');

    await check('staff operations are hidden before a cloud admin session exists',
      await page.locator('#staff-operations-title').count() === 0);

    const accountPanel = page.locator('section', { has: page.locator('#cloud-account-title') });
    await accountPanel.getByLabel('Email').fill(ADMIN.email);
    await accountPanel.getByLabel('Password').fill('admin-e2e-password-42');
    await accountPanel.getByRole('button', { name: 'Connect account' }).click();
    await accountPanel.getByText('Connected', { exact: true }).waitFor({ timeout: 15000 });

    const panel = page.locator('section', { has: page.locator('#staff-operations-title') });
    await panel.waitFor({ state: 'visible', timeout: 15000 });
    await check('admin operations appear immediately after sign-in without reloading Settings',
      new URL(page.url()).pathname === '/settings' && await panel.isVisible());
    await check('admin health and audit data are visible through the authenticated management surface',
      (await panel.innerText()).includes('Accounts') && (await panel.innerText()).includes('content.reviewed'));

    const loginCall = requests.find(row => row.path === '/v1/account/login' && row.method === 'POST');
    await check('admin sign-in uses the audited web transport',
      !!loginCall && loginCall.headers['x-pri-client'] === 'web-v1');

    await panel.getByLabel(`Role for ${OTHER_USER.name}`).selectOption('teacher');
    await panel.getByText(`${OTHER_USER.name} is now teacher.`, { exact: true }).waitFor({ timeout: 15000 });
    await check('role administration is live and reloads server-authoritative account state',
      await panel.getByLabel(`Role for ${OTHER_USER.name}`).inputValue() === 'teacher');

    await panel.getByLabel('Content key').fill(OWN_KEY);
    await panel.getByRole('button', { name: 'Create draft' }).click();
    await panel.getByText(OWN_KEY, { exact: true }).waitFor({ timeout: 15000 });
    await check('an admin can create a provenance-carrying curriculum draft through the real form',
      await panel.getByText(OWN_KEY, { exact: true }).isVisible());

    let ownCard = panel.locator('div.card').filter({ hasText: OWN_KEY }).first();
    await ownCard.getByRole('button', { name: 'Submit for review' }).click();
    await panel.getByText('Revision 1 moved through review.', { exact: true }).waitFor({ timeout: 15000 });
    ownCard = panel.locator('div.card').filter({ hasText: OWN_KEY }).first();
    await check('the authored draft moves to review before approval is even offered',
      (await ownCard.innerText()).includes('review') && await ownCard.getByRole('button', { name: 'Approve independently' }).isVisible());

    await ownCard.getByRole('button', { name: 'Approve independently' }).click();
    await panel.getByRole('alert').getByText('The author cannot approve their own revision.', { exact: true }).waitFor({ timeout: 15000 });
    await check('independent-review rejection is surfaced instead of being bypassed by the admin UI',
      await panel.getByRole('alert').isVisible() && (await ownCard.innerText()).includes('review'));

    let externalCard = panel.locator('div.card').filter({ hasText: EXTERNAL_KEY }).first();
    await externalCard.getByRole('button', { name: 'Approve independently' }).click();
    await panel.getByText('Revision 2 moved through approve.', { exact: true }).waitFor({ timeout: 15000 });
    externalCard = panel.locator('div.card').filter({ hasText: EXTERNAL_KEY }).first();
    await check('an independently authored review can be approved by the admin',
      (await externalCard.innerText()).includes('approved') && await externalCard.getByRole('button', { name: 'Publish' }).isVisible());

    await externalCard.getByRole('button', { name: 'Publish' }).click();
    await panel.getByText('Revision 2 moved through publish.', { exact: true }).waitFor({ timeout: 15000 });
    externalCard = panel.locator('div.card').filter({ hasText: EXTERNAL_KEY }).first();
    await check('only the approved revision reaches the published state',
      (await externalCard.innerText()).includes('published') && await externalCard.getByRole('button', { name: 'Publish' }).count() === 0);

    const mutating = requests.filter(row =>
      ['POST', 'PATCH', 'DELETE'].includes(row.method) && row.path !== '/v1/account/login'
    );
    await check('all authenticated admin/CMS mutations carry the server-issued CSRF token',
      mutating.length >= 5 && mutating.every(row => row.headers['x-pri-csrf'] === 'e2e-admin-csrf'),
      JSON.stringify(mutating.map(row => ({ path: row.path, csrf: row.headers['x-pri-csrf'] || null }))));

    const ownApprove = requests.find(row => row.path === '/v1/content/rev_own/approve' && row.method === 'POST');
    const externalPublish = requests.find(row => row.path === '/v1/content/rev_external/publish' && row.method === 'POST');
    await check('browser wiring hits distinct review and publish authorities rather than a client-side status toggle',
      !!ownApprove && !!externalPublish && ownApprove.headers['x-pri-client'] === 'web-v1' && externalPublish.headers['x-pri-client'] === 'web-v1');
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
