// Pri Learning · E2E flow — authenticated admin CMS + account role operations.
//
// The browser runs the real Settings/StaffOperationsPanel and audited cloud
// transport. Playwright intercepts `/v1` so this never talks to a production
// service. Server contract tests separately prove authorization and independent
// review rules; this flow proves the product UI can drive those contracts.

import { pathToFileURL } from 'node:url';

const ADMIN = {
  id: 'acct_e2e_admin',
  name: 'Pri Admin',
  email: 'admin@example.test',
  role: 'admin',
  emailVerified: true
};

const MANAGED = {
  id: 'acct_e2e_teacher',
  name: 'Demo Teacher',
  email: 'teacher@example.test'
};

const CONTENT_KEY = 'cbse/class10/quadratics/e2e-review';

export const flow = {
  id: 'admin-cms',
  name: 'Cloud admin · CMS lifecycle and role management',

  async run({ page, ctx, base, check, goto, createProfile }) {
    let authenticated = false;
    let managedRole = 'teacher';
    let revision = null;
    let audit = [];
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

    const addAudit = (action, targetKind, targetId) => {
      audit = [{
        id: `audit-${audit.length + 1}`,
        action,
        targetKind,
        targetId,
        createdAt: Date.now()
      }, ...audit];
    };

    await ctx.route('**/v1/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();
      const bodyText = request.postData() || '';
      const headers = request.headers();
      requests.push({ path, method, body: bodyText, headers });

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
        return authenticated
          ? respond(route, 200, { entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 1, issuedAt: Date.now() } })
          : respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/account/devices' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? {
          devices: [{ id: 'ses_e2e_admin', deviceId: 'browser-e2e-admin', current: true, lastSeenAt: Date.now(), expiresAt: Date.now() + 86400000 }]
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
        return respond(route, authenticated ? 200 : 401, authenticated ? { revisions: revision ? [revision] : [] }
          : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/admin/health' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? {
          accounts: 2,
          activeSessions: 1,
          classes: 0,
          openReports: 0,
          publishedContent: revision?.status === 'published' ? 1 : 0,
          pendingDelivery: 0
        } : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/admin/users' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? {
          users: [{
            ...MANAGED,
            role: managedRole,
            entitlement: { plan: 'free', status: 'free' }
          }]
        } : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/admin/audit' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? { entries: audit }
          : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/content/drafts' && method === 'POST') {
        const body = JSON.parse(bodyText || '{}');
        revision = {
          id: 'rev_e2e_1',
          contentKey: body.contentKey,
          curriculumVersion: body.curriculumVersion,
          revision: 1,
          status: 'draft',
          source: body.source,
          body: body.body,
          createdAt: Date.now()
        };
        addAudit('content.draft.create', 'content_revision', revision.id);
        return respond(route, 201, { revision });
      }

      if (revision && path === `/v1/content/${revision.id}/submit-review` && method === 'POST') {
        revision = { ...revision, status: 'review' };
        addAudit('content.review.submit', 'content_revision', revision.id);
        return respond(route, 200, { revision });
      }

      if (revision && path === `/v1/content/${revision.id}/approve` && method === 'POST') {
        revision = { ...revision, status: 'approved' };
        addAudit('content.review.approve', 'content_revision', revision.id);
        return respond(route, 200, { revision });
      }

      if (revision && path === `/v1/content/${revision.id}/publish` && method === 'POST') {
        revision = { ...revision, status: 'published' };
        addAudit('content.publish', 'content_revision', revision.id);
        return respond(route, 200, { revision });
      }

      if (path === `/v1/admin/users/${MANAGED.id}/role` && method === 'PATCH') {
        const body = JSON.parse(bodyText || '{}');
        managedRole = String(body.role || managedRole);
        addAudit('account.role.update', 'account', MANAGED.id);
        return respond(route, 200, { account: { ...MANAGED, role: managedRole } });
      }

      if (path === '/v1/account/logout' && method === 'POST') {
        authenticated = false;
        return respond(route, 200, { ok: true });
      }

      return respond(route, authenticated ? 404 : 401, {
        error: {
          code: authenticated ? 'NOT_FOUND' : 'AUTH_REQUIRED',
          message: authenticated ? `Unhandled E2E route ${method} ${path}` : 'Sign in is required.'
        }
      });
    });

    await goto('/');
    await createProfile({ name: 'Admin Device Profile', year: 10 });
    await goto('/settings');

    const accountPanel = page.locator('section', { has: page.locator('#cloud-account-title') });
    await accountPanel.getByLabel('Email').fill(ADMIN.email);
    await accountPanel.getByLabel('Password').fill('admin-e2e-password-42');
    await accountPanel.getByRole('button', { name: 'Connect account' }).click();
    await accountPanel.getByText('Connected', { exact: true }).waitFor({ timeout: 15000 });

    const staff = page.locator('section', { has: page.locator('#staff-operations-title') });
    await staff.waitFor({ state: 'visible', timeout: 15000 });
    await check('admin operations appear immediately after cloud sign-in without reloading Settings',
      new URL(page.url()).pathname === '/settings' && await staff.isVisible());

    const loginCall = requests.find(row => row.path === '/v1/account/login' && row.method === 'POST');
    const loginBody = loginCall ? JSON.parse(loginCall.body || '{}') : {};
    await check('admin sign-in uses the audited transport and keeps the local profile id out of the account request',
      !!loginCall && loginCall.headers['x-pri-client'] === 'web-v1' &&
        typeof loginBody.deviceId === 'string' && loginBody.deviceId.startsWith('device-') &&
        !('localProfileId' in loginBody),
      loginCall ? `${JSON.stringify(loginCall.headers)} ${JSON.stringify(loginBody)}` : 'no login request captured');

    const healthText = await staff.innerText();
    await check('admin health is rendered from the authenticated management API',
      healthText.includes('Accounts') && healthText.includes('1 active sessions'));
    await check('account-role management renders the server account list',
      await staff.getByText(MANAGED.name, { exact: true }).isVisible());

    await staff.getByLabel('Content key').fill(CONTENT_KEY);
    await staff.getByLabel('Source evidence JSON').fill(JSON.stringify({
      authority: 'CBSE Academic',
      reference: 'Maths_SecP1X_2026-27',
      version: '2026-27'
    }, null, 2));
    await staff.getByLabel('Content JSON').fill(JSON.stringify({
      title: 'Quadratics E2E review fixture',
      notes: ['Source-grounded draft fixture'],
      workedExamples: [],
      questions: []
    }, null, 2));
    await staff.getByRole('button', { name: 'Create draft' }).click();
    await staff.getByText(CONTENT_KEY, { exact: true }).waitFor({ timeout: 15000 });
    await staff.getByText('draft', { exact: true }).waitFor({ timeout: 15000 });
    await check('creating a curriculum draft refreshes the revision list in place',
      await staff.getByText(CONTENT_KEY, { exact: true }).isVisible() &&
        await staff.getByText('draft', { exact: true }).isVisible());

    const draftCall = requests.find(row => row.path === '/v1/content/drafts' && row.method === 'POST');
    const draftBody = draftCall ? JSON.parse(draftCall.body || '{}') : {};
    await check('draft creation carries source/version evidence and the server-issued CSRF token',
      !!draftCall && draftCall.headers['x-pri-csrf'] === 'e2e-admin-csrf' &&
        draftBody.contentKey === CONTENT_KEY &&
        draftBody.curriculumVersion === 'CBSE-2026-27' &&
        draftBody.source?.authority === 'CBSE Academic',
      draftCall ? `${JSON.stringify(draftCall.headers)} ${JSON.stringify(draftBody)}` : 'no draft request captured');

    await staff.getByRole('button', { name: 'Submit for review' }).click();
    await staff.getByText('review', { exact: true }).waitFor({ timeout: 15000 });
    await check('the CMS can submit a draft into review through the real staff controls',
      await staff.getByText('review', { exact: true }).isVisible());

    await staff.getByRole('button', { name: 'Approve independently' }).click();
    await staff.getByText('approved', { exact: true }).waitFor({ timeout: 15000 });
    await check('the reviewed revision can reach approved state through the audited control',
      await staff.getByText('approved', { exact: true }).isVisible());

    await staff.getByRole('button', { name: 'Publish' }).click();
    await staff.getByText('published', { exact: true }).waitFor({ timeout: 15000 });
    await check('an administrator can publish an approved revision and see the published state immediately',
      await staff.getByText('published', { exact: true }).isVisible());

    const lifecyclePaths = revision ? [
      '/v1/content/drafts',
      `/v1/content/${revision.id}/submit-review`,
      `/v1/content/${revision.id}/approve`,
      `/v1/content/${revision.id}/publish`
    ] : [];
    const lifecycleCalls = lifecyclePaths.map(path => requests.find(row => row.path === path && row.method === 'POST'));
    await check('every CMS lifecycle mutation stays behind the web transport and CSRF boundary',
      lifecycleCalls.length === 4 && lifecycleCalls.every(call => call &&
        call.headers['x-pri-client'] === 'web-v1' && call.headers['x-pri-csrf'] === 'e2e-admin-csrf'),
      JSON.stringify(lifecycleCalls.map(call => call ? { path: call.path, headers: call.headers } : null)));

    await page.waitForTimeout(200);
    const afterPublish = await staff.innerText();
    await check('publishing refreshes platform health instead of leaving stale management counts',
      afterPublish.includes('1 published revisions'));

    const roleSelect = staff.getByLabel(`Role for ${MANAGED.name}`);
    await roleSelect.selectOption('support');
    await page.waitForFunction(({ name }) => {
      const select = [...document.querySelectorAll('select')].find(node => node.getAttribute('aria-label') === `Role for ${name}`);
      return select?.value === 'support';
    }, { name: MANAGED.name });
    await check('admin role changes refresh the managed account to the server-returned role',
      await roleSelect.inputValue() === 'support');

    const roleCall = requests.find(row => row.path === `/v1/admin/users/${MANAGED.id}/role` && row.method === 'PATCH');
    const roleBody = roleCall ? JSON.parse(roleCall.body || '{}') : {};
    await check('role changes use PATCH with CSRF and cannot be mistaken for client-only UI state',
      !!roleCall && roleCall.headers['x-pri-csrf'] === 'e2e-admin-csrf' && roleBody.role === 'support',
      roleCall ? `${JSON.stringify(roleCall.headers)} ${JSON.stringify(roleBody)}` : 'no role PATCH captured');

    await staff.getByText('content.publish', { exact: true }).waitFor({ timeout: 15000 });
    await check('the staff surface shows auditable publication activity after the lifecycle completes',
      await staff.getByText('content.publish', { exact: true }).isVisible());
    await check('role administration also appears in the audit activity feed',
      await staff.getByText('account.role.update', { exact: true }).isVisible());

    const adminMutations = requests.filter(row =>
      (row.path.startsWith('/v1/content/') || row.path.startsWith('/v1/admin/users/')) &&
      ['POST', 'PATCH', 'DELETE'].includes(row.method));
    await check('all captured admin/CMS mutations use the single audited client transport',
      adminMutations.length >= 5 && adminMutations.every(row => row.headers['x-pri-client'] === 'web-v1'),
      JSON.stringify(adminMutations.map(row => ({ path: row.path, method: row.method, client: row.headers['x-pri-client'] }))));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
