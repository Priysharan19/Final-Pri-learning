// Pri Learning · E2E flow — authenticated admin/CMS operations.
//
// The browser uses the real Settings/StaffOperationsPanel and audited `/v1`
// transport. Network responses are intercepted locally so this is deterministic
// and cannot mutate a production account. Server contract suites separately own
// authorization rules; this flow proves the product UI reaches those contracts
// with CSRF, bounded payloads and the intended content-review state machine.
import { pathToFileURL } from 'node:url';

const ADMIN = {
  id: 'acct_e2e_admin',
  name: 'Curriculum Admin',
  email: 'curriculum.admin@example.test',
  role: 'admin',
  emailVerified: true
};
const TEACHER = {
  id: 'acct_e2e_teacher',
  name: 'Test Teacher',
  email: 'teacher@example.test',
  role: 'teacher',
  entitlement: { plan: 'free', status: 'free' }
};
const PEER_REVISION = {
  id: 'rev_peer_1',
  contentKey: 'cbse/class10/polynomials/peer-reviewed',
  curriculumVersion: 'CBSE-2026-27',
  revision: 1,
  status: 'review',
  authorAccountId: 'acct_support_author',
  createdAt: 1788370200000
};

export const flow = {
  id: 'staff',
  name: 'Staff · CMS review, publish, admin health and role controls',

  async run({ page, ctx, base, check, goto, createProfile }) {
    let authenticated = false;
    let teacherRole = 'teacher';
    let revisions = [{ ...PEER_REVISION }];
    const requests = [];
    let revisionCounter = 2;

    await page.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);

    const respond = (route, status, value, headers = {}) => route.fulfill({
      status,
      contentType: 'application/json',
      headers,
      body: JSON.stringify(value)
    });
    const authError = route => respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
    const revisionPayload = row => ({ ...row });

    await ctx.route('**/v1/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();
      const rawBody = request.postData() || '';
      const body = rawBody ? JSON.parse(rawBody) : {};
      requests.push({ path, method, body, rawBody, headers: request.headers() });

      if (path === '/v1/billing/config' && method === 'GET') {
        return respond(route, 200, {
          display: { currency: 'INR', monthly: 1000, annual: 10000, trialDays: 7, advisoryOnly: true },
          webCheckout: { configured: false }
        });
      }
      if (path === '/v1/account/register' && method === 'POST') {
        authenticated = true;
        return respond(route, 201, { account: ADMIN }, {
          'set-cookie': 'pri_csrf=e2e-admin-csrf; Path=/; SameSite=Lax'
        });
      }
      if (path === '/v1/account/me' && method === 'GET') {
        return authenticated ? respond(route, 200, { account: ADMIN }) : authError(route);
      }
      if (path === '/v1/entitlements' && method === 'GET') {
        return authenticated
          ? respond(route, 200, { entitlement: { plan: 'premium', status: 'active', provider: 'test', sourceVersion: 1, issuedAt: Date.now() } })
          : authError(route);
      }
      if (path === '/v1/account/devices' && method === 'GET') {
        return authenticated ? respond(route, 200, {
          devices: [{ id: 'ses_admin_e2e', deviceId: 'browser-admin-e2e', current: true, lastSeenAt: Date.now(), expiresAt: Date.now() + 86400000 }]
        }) : authError(route);
      }
      if (path === '/v1/account/identity' && method === 'GET') {
        return authenticated ? respond(route, 200, { providers: [{ provider: 'password', linkedAt: Date.now() }] }) : authError(route);
      }
      if (path === '/v1/assignments' && method === 'GET') {
        return authenticated ? respond(route, 200, { assignments: [] }) : authError(route);
      }
      if (path === '/v1/classes' && method === 'GET') {
        return authenticated ? respond(route, 200, { classes: [] }) : authError(route);
      }

      if (path === '/v1/content/admin/revisions' && method === 'GET') {
        return authenticated ? respond(route, 200, { revisions: revisions.map(revisionPayload) }) : authError(route);
      }
      if (path === '/v1/content/drafts' && method === 'POST') {
        if (!authenticated) return authError(route);
        const revision = {
          id: `rev_admin_${revisionCounter}`,
          contentKey: body.contentKey,
          curriculumVersion: body.curriculumVersion,
          revision: revisionCounter++,
          status: 'draft',
          authorAccountId: ADMIN.id,
          source: body.source,
          body: body.body,
          createdAt: Date.now()
        };
        revisions = [revision, ...revisions];
        return respond(route, 201, { revision });
      }
      const submit = path.match(/^\/v1\/content\/([^/]+)\/submit-review$/);
      if (submit && method === 'POST') {
        if (!authenticated) return authError(route);
        revisions = revisions.map(row => row.id === submit[1] ? { ...row, status: 'review' } : row);
        return respond(route, 200, { revision: revisions.find(row => row.id === submit[1]) });
      }
      const approve = path.match(/^\/v1\/content\/([^/]+)\/approve$/);
      if (approve && method === 'POST') {
        if (!authenticated) return authError(route);
        const row = revisions.find(item => item.id === approve[1]);
        if (!row) return respond(route, 404, { error: { code: 'NOT_FOUND', message: 'Revision not found.' } });
        if (row.authorAccountId === ADMIN.id) {
          return respond(route, 409, { error: { code: 'INDEPENDENT_REVIEW_REQUIRED', message: 'Authors cannot approve their own revision.' } });
        }
        revisions = revisions.map(item => item.id === approve[1] ? { ...item, status: 'approved', approvedBy: ADMIN.id } : item);
        return respond(route, 200, { revision: revisions.find(item => item.id === approve[1]) });
      }
      const publish = path.match(/^\/v1\/content\/([^/]+)\/publish$/);
      if (publish && method === 'POST') {
        if (!authenticated) return authError(route);
        revisions = revisions.map(row => row.id === publish[1] ? { ...row, status: 'published', publishedAt: Date.now() } : row);
        return respond(route, 200, { revision: revisions.find(row => row.id === publish[1]) });
      }

      if (path === '/v1/admin/health' && method === 'GET') {
        return authenticated ? respond(route, 200, {
          accounts: 42,
          activeSessions: 9,
          classes: 6,
          publishedContent: revisions.filter(row => row.status === 'published').length,
          openReports: 1,
          pendingDelivery: 0
        }) : authError(route);
      }
      if (path === '/v1/admin/users' && method === 'GET') {
        return authenticated ? respond(route, 200, {
          users: [{ ...TEACHER, role: teacherRole }, ADMIN]
        }) : authError(route);
      }
      const roleChange = path.match(/^\/v1\/admin\/users\/([^/]+)\/role$/);
      if (roleChange && method === 'PATCH') {
        if (!authenticated) return authError(route);
        if (roleChange[1] === TEACHER.id) teacherRole = body.role;
        return respond(route, 200, { account: { ...TEACHER, role: teacherRole } });
      }
      if (path === '/v1/admin/audit' && method === 'GET') {
        return authenticated ? respond(route, 200, {
          entries: [
            { id: 'audit_1', action: 'content.review.submitted', targetKind: 'content_revision', targetId: 'rev_peer_1', createdAt: Date.now() - 1000 },
            { id: 'audit_2', action: 'account.role.updated', targetKind: 'account', targetId: TEACHER.id, createdAt: Date.now() - 2000 }
          ]
        }) : authError(route);
      }
      if (path === '/v1/account/logout' && method === 'POST') {
        authenticated = false;
        return respond(route, 200, { ok: true });
      }

      return respond(route, authenticated ? 404 : 401, {
        error: { code: authenticated ? 'NOT_FOUND' : 'AUTH_REQUIRED', message: authenticated ? `Unhandled E2E route ${method} ${path}` : 'Sign in is required.' }
      });
    });

    await goto('/');
    await createProfile({ name: 'Admin Local Profile', year: 10 });
    await goto('/settings');

    const staffPanel = page.locator('section', { has: page.locator('#staff-operations-title') });
    await check('staff operations are hidden before an authenticated staff session', !(await staffPanel.isVisible()));

    const accountPanel = page.locator('section', { has: page.locator('#cloud-account-title') });
    await accountPanel.getByRole('button', { name: 'Create account' }).click();
    await accountPanel.getByLabel('Name').fill(ADMIN.name);
    await accountPanel.getByLabel('Email').fill(ADMIN.email);
    await accountPanel.getByLabel('Password').fill('admin-e2e-password-42');
    await accountPanel.getByRole('button', { name: 'Create and connect account' }).click();
    await accountPanel.getByText('Connected', { exact: true }).waitFor({ timeout: 15000 });
    await staffPanel.waitFor({ state: 'visible', timeout: 15000 });

    await check('admin cloud session reveals the real curriculum operations surface',
      await staffPanel.getByText('Curriculum operations', { exact: true }).isVisible() &&
      await staffPanel.getByText('Admin', { exact: true }).isVisible());
    await check('admin health summary is rendered from the authenticated endpoint',
      (await staffPanel.innerText()).includes('42') && (await staffPanel.innerText()).includes('9 active sessions'));
    await check('peer-authored review is available for independent approval',
      await staffPanel.getByText(PEER_REVISION.contentKey, { exact: true }).isVisible());

    const contentKey = 'cbse/class10/trigonometry/e2e-draft';
    await staffPanel.getByLabel('Content key').fill(contentKey);
    await staffPanel.getByLabel('Source evidence JSON').fill(JSON.stringify({
      authority: 'CBSE', reference: 'Class X Mathematics 2026-27', version: '2026-27'
    }, null, 2));
    await staffPanel.getByLabel('Content JSON').fill(JSON.stringify({
      title: 'E2E trigonometry lesson', notes: ['Exact values'], workedExamples: [], questions: []
    }, null, 2));
    await staffPanel.getByRole('button', { name: 'Create draft' }).click();
    await staffPanel.getByText(new RegExp(`Draft ${contentKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} revision`)).waitFor({ timeout: 15000 });

    const createCall = requests.find(row => row.path === '/v1/content/drafts' && row.method === 'POST');
    await check('content draft mutation uses audited web transport plus server-issued CSRF',
      !!createCall && createCall.headers['x-pri-client'] === 'web-v1' && createCall.headers['x-pri-csrf'] === 'e2e-admin-csrf',
      createCall ? JSON.stringify(createCall.headers) : 'no content draft request captured');
    await check('CMS draft payload contains source/content only and no local learning or handwriting data',
      !!createCall && createCall.body.contentKey === contentKey &&
      createCall.body.source?.authority === 'CBSE' && createCall.body.body?.title === 'E2E trigonometry lesson' &&
      !/["'](?:localProfileId|answer|steps|ink|strokes|handwriting|encryptionKey)["']\s*:/.test(createCall.rawBody),
      createCall?.rawBody || 'no content draft request captured');

    const ownCard = staffPanel.locator('.card', { hasText: contentKey }).last();
    await ownCard.getByRole('button', { name: 'Submit for review' }).click();
    await staffPanel.getByText(/moved through review/).waitFor({ timeout: 15000 });
    const reviewCall = requests.find(row => /\/submit-review$/.test(row.path) && row.method === 'POST');
    await check('submitting a draft for review is a CSRF-protected state transition',
      !!reviewCall && reviewCall.headers['x-pri-csrf'] === 'e2e-admin-csrf');

    const peerCard = staffPanel.locator('.card', { hasText: PEER_REVISION.contentKey }).last();
    await peerCard.getByRole('button', { name: 'Approve independently' }).click();
    await staffPanel.getByText(/moved through approve/).waitFor({ timeout: 15000 });
    const approveCall = requests.find(row => /\/approve$/.test(row.path) && row.method === 'POST');
    await check('independent approval targets the peer revision through the audited transport',
      approveCall?.path === `/v1/content/${PEER_REVISION.id}/approve` && approveCall.headers['x-pri-csrf'] === 'e2e-admin-csrf');

    const approvedPeer = staffPanel.locator('.card', { hasText: PEER_REVISION.contentKey }).last();
    await approvedPeer.getByRole('button', { name: 'Publish' }).click();
    await staffPanel.getByText(/moved through publish/).waitFor({ timeout: 15000 });
    const publishCall = requests.find(row => /\/publish$/.test(row.path) && row.method === 'POST');
    await check('publishing independently reviewed content is an admin CSRF-protected mutation',
      publishCall?.path === `/v1/content/${PEER_REVISION.id}/publish` && publishCall.headers['x-pri-csrf'] === 'e2e-admin-csrf');
    await check('published revision state is reflected back into the UI after reload',
      (await staffPanel.locator('.card', { hasText: PEER_REVISION.contentKey }).last().innerText()).includes('published'));

    const roleSelect = staffPanel.getByLabel(`Role for ${TEACHER.name}`);
    await roleSelect.selectOption('support');
    await staffPanel.getByText(`${TEACHER.name} is now support.`, { exact: true }).waitFor({ timeout: 15000 });
    const roleCall = requests.find(row => row.path === `/v1/admin/users/${TEACHER.id}/role` && row.method === 'PATCH');
    await check('role changes are sent as the minimal role-only admin payload with CSRF',
      !!roleCall && roleCall.body.role === 'support' && Object.keys(roleCall.body).length === 1 && roleCall.headers['x-pri-csrf'] === 'e2e-admin-csrf',
      roleCall ? `${JSON.stringify(roleCall.headers)} ${roleCall.rawBody}` : 'no role update captured');
    await check('role reload reflects the server-authoritative value', await roleSelect.inputValue() === 'support');
    await check('audit activity remains visible to administrators',
      (await staffPanel.innerText()).includes('content.review.submitted') && (await staffPanel.innerText()).includes('account.role.updated'));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
