// Pri Learning · E2E flow — optional cloud account → assignment execution.
//
// This never calls a production service. Playwright intercepts the real audited
// `/v1` transport while the actual React/IndexedDB account-link and Settings UI
// run unchanged. Server contract suites separately prove authorization/CSRF;
// this flow proves the browser product wiring reaches those contracts correctly.

import { pathToFileURL } from 'node:url';

const ACCOUNT = {
  id: 'acct_e2e_student',
  name: 'Cloud Student',
  email: 'cloud.student@example.test',
  role: 'student',
  emailVerified: true
};

const ASSIGNMENT = {
  id: 'asn_e2e_algebra',
  classId: 'cls_e2e_math',
  className: 'Class 9 Mathematics',
  title: 'Cloud algebra sprint',
  dueAt: null,
  specification: {
    kind: 'practice',
    instructions: 'Complete three questions and show your working.',
    questionCount: 3
  },
  submission: null
};

export const flow = {
  id: 'cloud',
  name: 'Cloud · account, live Settings refresh, assignment hand-off',

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
      const body = request.postData() || '';
      requests.push({ path, method, body, headers: request.headers() });

      if (path === '/v1/billing/config' && method === 'GET') {
        return respond(route, 200, {
          display: { currency: 'INR', monthly: 1000, annual: 10000, trialDays: 7, advisoryOnly: true },
          webCheckout: { configured: false }
        });
      }

      if (path === '/v1/account/register' && method === 'POST') {
        authenticated = true;
        return respond(route, 201, { account: ACCOUNT }, {
          'set-cookie': 'pri_csrf=e2e-csrf; Path=/; SameSite=Lax'
        });
      }

      if (path === '/v1/account/me' && method === 'GET') {
        return authenticated
          ? respond(route, 200, { account: ACCOUNT })
          : respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/entitlements' && method === 'GET') {
        return authenticated
          ? respond(route, 200, { entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 1, issuedAt: Date.now() } })
          : respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/account/devices' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? {
          devices: [{ id: 'ses_e2e', deviceId: 'browser-e2e', current: true, lastSeenAt: Date.now(), expiresAt: Date.now() + 86400000 }]
        } : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/account/identity' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? {
          providers: [{ provider: 'password', linkedAt: Date.now() }]
        } : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/assignments' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? { assignments: [ASSIGNMENT] }
          : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === '/v1/classes' && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? {
          classes: [{ id: ASSIGNMENT.classId, name: ASSIGNMENT.className, archived: false }]
        } : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === `/v1/classes/${ASSIGNMENT.classId}` && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? {
          class: { id: ASSIGNMENT.classId, name: ASSIGNMENT.className },
          assignments: [ASSIGNMENT]
        } : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === `/v1/assignments/${ASSIGNMENT.classId}/${ASSIGNMENT.id}` && method === 'GET') {
        return respond(route, authenticated ? 200 : 401, authenticated ? { assignment: ASSIGNMENT }
          : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      if (path === `/v1/classes/${ASSIGNMENT.classId}/assignments/${ASSIGNMENT.id}/submission` && method === 'PATCH') {
        return respond(route, authenticated ? 200 : 401, authenticated ? {
          submission: { state: JSON.parse(body || '{}').state || 'started' }
        } : { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
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
    await createProfile({ name: 'Cloud Student', year: 9 });
    await goto('/settings');

    const accountPanel = page.locator('section', { has: page.locator('#cloud-account-title') });
    await check('cloud account controls render when the deployment origin is configured',
      await accountPanel.isVisible());
    await check('the fresh local profile starts disconnected from cloud',
      /Not connected/.test(await accountPanel.innerText()),
      `account panel reads ${JSON.stringify((await accountPanel.innerText()).slice(0, 180))}`);

    await accountPanel.getByRole('button', { name: 'Create account' }).click();
    await accountPanel.getByLabel('Name').fill(ACCOUNT.name);
    await accountPanel.getByLabel('Email').fill(ACCOUNT.email);
    await accountPanel.getByLabel('Password').fill('cloud-e2e-password-42');
    await accountPanel.getByRole('button', { name: 'Create and connect account' }).click();
    await accountPanel.getByText('Connected', { exact: true }).waitFor({ timeout: 15000 });

    await check('account creation links the current local profile without leaving Settings',
      new URL(page.url()).pathname === '/settings' && await accountPanel.getByText('Connected', { exact: true }).isVisible(),
      `current URL is ${page.url()}`);

    const registerCall = requests.find(row => row.path === '/v1/account/register' && row.method === 'POST');
    await check('account registration goes through the audited web transport',
      !!registerCall && registerCall.headers['x-pri-client'] === 'web-v1',
      registerCall ? JSON.stringify(registerCall.headers) : 'no register request captured');

    const registerBody = registerCall ? JSON.parse(registerCall.body || '{}') : {};
    await check('the cloud account request carries a device id but no local-profile database payload',
      typeof registerBody.deviceId === 'string' && registerBody.deviceId.startsWith('device-') &&
        !('localProfileId' in registerBody) && !('encryptionKey' in registerBody),
      JSON.stringify(registerBody));

    const inbox = page.locator('section', { has: page.locator('#assignment-inbox-title') });
    await inbox.waitFor({ state: 'visible', timeout: 15000 });
    await check('assignment inbox refreshes immediately after connect without a page reload',
      new URL(page.url()).pathname === '/settings' && await inbox.isVisible());
    await check('the assigned cloud task is visible immediately',
      await inbox.getByText(ASSIGNMENT.title, { exact: true }).isVisible());

    const classroom = page.locator('section', { has: page.locator('#classroom-title') });
    await classroom.waitFor({ state: 'visible', timeout: 15000 });
    await check('classroom panel also refreshes immediately after connect',
      await classroom.isVisible());
    await check('class membership came through the same cloud session',
      (await classroom.innerText()).includes(ASSIGNMENT.className));

    await inbox.getByRole('button', { name: 'Start assignment' }).click();
    await page.waitForURL(url => url.pathname === '/practice' && url.searchParams.get('classId') === ASSIGNMENT.classId && url.searchParams.get('assignment') === ASSIGNMENT.id, { timeout: 15000 });
    await check('starting an assignment hands off to the normal Practice route with scoped ids',
      new URL(page.url()).searchParams.get('assignment') === ASSIGNMENT.id);

    const assignmentTitle = page.getByText(ASSIGNMENT.title, { exact: true }).first();
    const assignmentProgress = page.getByText('0/3 questions completed', { exact: true }).first();
    await assignmentTitle.waitFor({ state: 'visible', timeout: 15000 });
    await assignmentProgress.waitFor({ state: 'visible', timeout: 15000 });
    await check('Practice renders the verified assignment context before serving local maths',
      await assignmentTitle.isVisible() && await assignmentProgress.isVisible(),
      `assignment card=${JSON.stringify((await assignmentTitle.locator('xpath=ancestor::div[contains(@class,"card")][1]').innerText().catch(() => '')).slice(0, 240))}`);

    await page.waitForTimeout(300);
    const startedCall = requests.find(row => row.path.endsWith(`/assignments/${ASSIGNMENT.id}/submission`) && row.method === 'PATCH');
    const startedBody = startedCall ? JSON.parse(startedCall.body || '{}') : {};
    const startedJson = JSON.stringify(startedBody);
    await check('assignment start reports only aggregate progress with the server-issued CSRF token',
      !!startedCall && startedCall.headers['x-pri-csrf'] === 'e2e-csrf' &&
        startedBody.state === 'started' && startedBody.summary?.questionsAnswered === 0,
      startedCall ? `${JSON.stringify(startedCall.headers)} ${startedJson}` : 'no submission PATCH captured');
    await check('assignment progress never uploads answers, strokes or worked solutions',
      !/["'](?:answer|steps|ink|strokes|prompt|solution)["']\s*:/.test(startedJson),
      startedJson);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
