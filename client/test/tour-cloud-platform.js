// Pri Learning · E2E flow — optional cloud account → assignment execution.
//
// This never calls a production service. Playwright intercepts the real audited
// `/v1` transport while the actual React/IndexedDB account-link and Settings UI
// run unchanged. Server contract suites separately prove authorization/CSRF;
// this flow proves the browser product wiring reaches those contracts correctly.

import { pathToFileURL } from 'node:url';
import { handwrite } from './fakeServerReader.js';

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

  async run({ page, ctx, base, check, goto, createProfile, settle }) {
    let authenticated = false;
    // The account is registered but its email is not yet verified — exactly the
    // state a student is in the minute after signing up on the device they are
    // writing on. /v1/handwriting/transcribe sits behind requireVerifiedEmail;
    // /v1/handwriting/status does not (it is a session-only readiness probe).
    let emailVerified = false;
    // Flip the guardian gate independently to reproduce the production 403
    // before the reader is called, then approve it while the page stays open.
    let guardianPending = false;
    const requests = [];
    const reader = { text: '7', requests: [] };
    const READY = {
      available: true, configured: true, usable: true, degraded: false, state: 'ready',
      model: 'e2e-stand-in', fallbackModel: null, confidenceFloor: 0.8, timeoutMs: 20000,
      lastLatencyMs: 1, lastFailureCode: null, releaseSha: null
    };

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

      // The sign-in card's road: which channels exist, a code, and the verify
      // that first earns a sign-up ticket (a new address) and then, with the
      // student's answers, makes the account.
      if (path === '/v1/account/otp/channels' && method === 'GET') return respond(route, 200, { channels: { email: true, sms: false } });
      if (path === '/v1/account/identity/providers' && method === 'GET') return respond(route, 200, { providers: { google: null, apple: null } });
      if (path === '/v1/account/otp/request' && method === 'POST') {
        return respond(route, 202, { ok: true, channel: 'email', challengeId: 'otp_e2e_challenge', expiresInMs: 600000, resendAfterMs: 30000 });
      }
      if (path === '/v1/account/otp/verify' && method === 'POST') {
        let sentBody = {};
        try { sentBody = JSON.parse(body || '{}'); } catch { sentBody = {}; }
        if (!sentBody.signupTicket) return respond(route, 200, { status: 'profile-required', signupTicket: 'otp_e2e_ticket' });
        authenticated = true;
        return respond(route, 201, { status: 'signed-in', created: true, account: ACCOUNT, guardianConsent: { required: false, state: 'not-required' } }, {
          'set-cookie': 'pri_csrf=e2e-csrf; Path=/; SameSite=Lax'
        });
      }

      if (path === '/v1/account/me' && method === 'GET') {
        return authenticated
          ? respond(route, 200, { account: { ...ACCOUNT, emailVerified } })
          : respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
      }

      // The server reader, as the real one answers: a session-only status
      // probe, and a transcribe route that refuses an unverified email.
      if (path === '/v1/handwriting/status' && method === 'GET') {
        if (!authenticated) return respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
        if (guardianPending) return respond(route, 403, { error: { code: 'GUARDIAN_CONSENT_PENDING', message: 'A parent or guardian has been emailed to confirm this account.' } });
        return respond(route, 200, READY);
      }
      if (path === '/v1/handwriting/transcribe' && method === 'POST') {
        let parsed = null;
        try { parsed = JSON.parse(body || 'null'); } catch { parsed = null; }
        reader.requests.push({ parsed, authenticated, emailVerified });
        if (!authenticated) return respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
        if (!emailVerified) return respond(route, 403, { error: { code: 'EMAIL_UNVERIFIED', message: 'Verify your email address before using this feature.' } });
        const lines = String(reader.text).split('\n').filter(Boolean).map(text => ({ text, confidence: 0.97 }));
        return respond(route, 200, { transcription: { lines, text: lines.map(l => l.text).join('\n'), confidence: 0.97, needsConfirmation: false, engine: 'cloud-e2e-stand-in' } });
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

    // ── 0 · write by hand, signed out ───────────────────────────────────────
    // Production 2026-10-05 (iPad): a student opened Practice signed out, wrote,
    // then registered on the same device and was told the reader "isn't
    // answering" — nothing was asked of the server after sign-in. This is that
    // day, with the right ending.
    const handwritingRequests = () => requests.filter(row => row.path.startsWith('/v1/handwriting/'));
    // What the student can actually read about the blocked ink: the generic
    // reader sentence is display:none while an account action is pending, so
    // only text that is rendered counts (innerText of a hidden node would
    // quietly return its textContent and prove nothing).
    const inkNotice = () => page.evaluate(() => [...document.querySelectorAll('.ink-status, [data-ink-account-recovery] p')]
      .filter(el => el.getClientRects().length > 0).map(el => el.innerText).join(' ').replace(/\s+/g, ' ').trim());
    await goto('/practice');
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    const writeTab = page.getByRole('button', { name: 'Answer by handwriting' });
    for (let i = 0; i < 6 && !(await writeTab.count()); i++) {
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      await settle();
    }
    await writeTab.click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const inkPrompt = (await page.locator('.q-prompt').innerText()).replace(/\s+/g, ' ').trim();
    const box = await page.locator('.ink-canvas-live').boundingBox();
    await handwrite(page, box, reader.text);
    const inkSignIn = page.locator('[data-ink-account-recovery] [data-ink-sign-in]');
    await inkSignIn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    const signedOutNote = await inkNotice();
    // The sentence changed with the in-card recovery (it used to read "needs a
    // Pri account … your working is saved"); what is protected is the same:
    // the ink is not read, the student is told it is an account matter and is
    // not told the reader is down.
    await check('signed out, the kept ink waits for a Pri account — the student is told that, not "the reader is down"',
      /has not been read or graded/.test(signedOutNote) && /^Sign in to check this answer$/.test((await inkSignIn.innerText().catch(() => '')).trim()) &&
        !/isn.t answering/.test(signedOutNote) && await page.locator('.ink-preview').count() === 0,
      `notice ${JSON.stringify(signedOutNote)}`);
    const signedOutActionStatus = (await page.locator('.status-line').innerText().catch(() => '')) || '';
    await check('signed out, the action bar does not blame handwriting when recognition was never attempted',
      !/couldn.?t read|rewrite your last line more clearly/i.test(signedOutActionStatus),
      `action status ${JSON.stringify(signedOutActionStatus)}`);
    await check('nothing is sent to the reader while signed out',
      handwritingRequests().length === 0 && reader.requests.length === 0,
      JSON.stringify(handwritingRequests().map(r => `${r.method} ${r.path}`)));
    const inkLink = page.locator('.ink-status-link');
    // Signed out, the way forward is the sign-in inside the card, enabled once
    // the ink is proven saved; the old "Account settings" link (a dead end for
    // a student with ink on the page) is not shown beside it. The in-card
    // sign-in itself is driven end to end by tour-write-sign-in.js.
    await page.waitForFunction(() => document.querySelector('[data-ink-sign-in]')?.disabled === false, null, { timeout: 15000 }).catch(() => {});
    await check('the notice offers sign-in on the card, not a link away to Account settings',
      await inkSignIn.isEnabled() && !(await inkLink.isVisible().catch(() => false)),
      `sign-in enabled ${await inkSignIn.isEnabled().catch(() => null)}, settings link visible ${await inkLink.isVisible().catch(() => null)}`);
    // From here on nothing reloads: a reload would wipe the module-level
    // readiness cache and hide the very bug this flow exists to catch. This
    // flow goes on to prove Settings refreshes live when an account connects,
    // so the student walks there through the app's own navigation.
    await page.evaluate(() => { window.__PRI_E2E_NO_RELOAD__ = 'kept'; });
    await page.locator('.ws-exit').click();
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
    await page.waitForURL(url => url.pathname === '/settings', { timeout: 15000 });
    // Settings is a lazy route: wait for the account panel itself, not the URL.
    await page.locator('#cloud-account-title').waitFor({ state: 'visible', timeout: 30000 });
    const registerIndexBefore = requests.length;

    const accountPanel = page.locator('section', { has: page.locator('#cloud-account-title') });
    await check('cloud account controls render when the deployment origin is configured',
      await accountPanel.isVisible());
    await check('the fresh local profile starts disconnected from cloud',
      /Not signed in/.test(await accountPanel.innerText()),
      `account panel reads ${JSON.stringify((await accountPanel.innerText()).slice(0, 180))}`);

    // The one sign-in card, in place: email → code → (a new address) the
    // account's name, age and agreement. The class is never asked: this
    // profile already has one.
    const card = accountPanel.locator('[data-signin-card]');
    await card.locator('#signup-destination').fill(ACCOUNT.email);
    await card.getByTestId('signup-send-code').click();
    await card.locator('#signup-code-0').waitFor({ state: 'visible', timeout: 15000 });
    await card.locator('#signup-code-0').fill('123456');
    await card.locator('#signup-flow-name').waitFor({ state: 'visible', timeout: 15000 });
    await card.locator('#signup-flow-name').fill(ACCOUNT.name);

    // Nothing about age is assumed, and no account is made without the notice
    // being acknowledged. A gate that renders but does not gate is worse than
    // no gate, because it looks like one — so both refusals are asserted by
    // the request that was NOT sent.
    const creating = () => requests.filter(row => row.path === '/v1/account/otp/verify' && /signupTicket/.test(row.body)).length;
    await check('a new account is asked its age outright: no age is preselected',
      await card.locator('[data-testid^="signup-age-"][aria-pressed="true"]').count() === 0);
    await card.getByTestId('signup-age-next').click();
    await check('without an age the account is not created',
      creating() === 0 && /Choose your age/.test(await card.getByTestId('signup-error').innerText()));
    await card.getByTestId('signup-age-18').click();
    await card.getByTestId('signup-age-next').click();
    await check('the notice must be acknowledged before an account can be created',
      creating() === 0 && /Tick the box to agree/.test(await card.getByTestId('signup-error').innerText()));
    await card.getByLabel('I have read the').check();
    await card.getByTestId('signup-age-next').click();
    await accountPanel.locator('[data-cloud-state]', { hasText: /^Signed in$/ }).waitFor({ timeout: 15000 });
    await check('acknowledging the notice releases the gate: one account-creating request', creating() === 1, `${creating()} request(s)`);

    await check('account creation links the current local profile without leaving Settings',
      new URL(page.url()).pathname === '/settings' && await accountPanel.locator('[data-cloud-state]', { hasText: /^Signed in$/ }).isVisible(),
      `current URL is ${page.url()}`);

    const registerCall = requests.find(row => row.path === '/v1/account/otp/verify' && row.method === 'POST' && /signupTicket/.test(row.body));
    await check('account creation goes through the audited web transport',
      !!registerCall && registerCall.headers['x-pri-client'] === 'web-v1',
      registerCall ? JSON.stringify(registerCall.headers) : 'no account-creating request captured');

    const registerBody = registerCall ? JSON.parse(registerCall.body || '{}') : {};
    await check('the cloud account request carries a device id and the declared age, but no local-profile database payload',
      typeof registerBody.deviceId === 'string' && registerBody.deviceId.startsWith('device-') && registerBody.profile?.isAdult === true &&
        !('localProfileId' in registerBody) && !('encryptionKey' in registerBody),
      JSON.stringify(registerBody));

    const inbox = page.locator('section', { has: page.locator('#assignment-inbox-title') });
    await inbox.waitFor({ state: 'visible', timeout: 15000 });
    // Settings mounts the staff console (and its authenticator gate) only for
    // admin/support roles: a student makes no second-factor request at all.
    await check('a student never meets the staff authenticator gate: no MFA status request, no panel, no console',
      await page.locator('#mfa-title').count() === 0 && await page.locator('#staff-operations-title').count() === 0 &&
        !requests.some(row => row.path.startsWith('/v1/account/mfa/')),
      JSON.stringify(requests.filter(row => row.path.startsWith('/v1/account/mfa/')).map(row => `${row.method} ${row.path}`)));
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

    // ── 1 · back to the page with the kept ink, signed in, no reload ────────
    // Reproduce the production gate: /handwriting/status is refused before any
    // transcription request can leave the device.
    guardianPending = true;
    await page.getByRole('link', { name: 'Practice', exact: true }).first().click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    await check('the same question and the kept handwriting come back, in writing mode',
      (await page.locator('.q-prompt').innerText()).replace(/\s+/g, ' ').trim() === inkPrompt,
      `prompt now ${JSON.stringify((await page.locator('.q-prompt').innerText()).slice(0, 120))}`);
    await check('without a reload', await page.evaluate(() => window.__PRI_E2E_NO_RELOAD__) === 'kept');
    await page.waitForFunction(() => /parent or guardian needs to confirm/i.test(document.querySelector('[data-ink-blocker-reason]')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    const guardianNote = await inkNotice();
    const guardianBlockedRequests = requests.slice(registerIndexBefore).filter(row => row.path.startsWith('/v1/handwriting/'));
    await check('guardian pending is named as an account action, not a handwriting failure',
      /parent or guardian needs to confirm/i.test(guardianNote), `status ${JSON.stringify(guardianNote)}`);
    await check('guardian pending stops before transcription: status is probed but the ink is not sent to the reader',
      guardianBlockedRequests.some(r => r.path === '/v1/handwriting/status') && !guardianBlockedRequests.some(r => r.path === '/v1/handwriting/transcribe'),
      JSON.stringify(guardianBlockedRequests.map(r => `${r.method} ${r.path}`)));
    const lowerWhileGated = (await page.locator('.status-line').innerText().catch(() => '')) || '';
    await check('a pre-reader account gate never tells the student to rewrite clearer handwriting',
      !/couldn.?t read|rewrite your last line more clearly/i.test(lowerWhileGated), `lower status ${JSON.stringify(lowerWhileGated)}`);
    await check('guardian pending offers Account settings as the relevant action',
      await inkLink.isVisible().catch(() => false) && (await inkLink.getAttribute('data-ink-blocker')) === 'ink.waitingGuardian');

    // Approval can arrive elsewhere while this page stays open. Focus triggers
    // the bounded fresh readiness probe; no force-quit or reload is required.
    guardianPending = false;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    // The status is now usable, the ink is sent, and the transcribe route names
    // the next real blocker: the still-unverified email.
    await page.waitForFunction(() => /Verify your email address/.test(document.querySelector('[data-ink-blocker-reason]')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    const afterSignIn = requests.slice(registerIndexBefore).filter(row => row.path.startsWith('/v1/handwriting/'));
    await check('after sign-in the device asks the server again: a status probe and the kept ink itself',
      afterSignIn.some(r => r.path === '/v1/handwriting/status') && afterSignIn.some(r => r.path === '/v1/handwriting/transcribe'),
      JSON.stringify(afterSignIn.map(r => `${r.method} ${r.path}`)));
    const verifyNote = await inkNotice();
    await check('the real blocker is shown — verify the email — not "the reader is not answering"',
      /Verify your email address/.test(verifyNote) && !/isn’t answering/.test(verifyNote),
      `status ${JSON.stringify(verifyNote)}`);
    const verifyActionStatus = (await page.locator('.status-line').innerText().catch(() => '')) || '';
    await check('email verification pending is not rendered as unreadable handwriting in the action bar',
      !/couldn.?t read|rewrite your last line more clearly/i.test(verifyActionStatus),
      `action status ${JSON.stringify(verifyActionStatus)}`);
    await check('with the way to Account settings, where a fresh verification email is sent from',
      await inkLink.isVisible().catch(() => false) && (await inkLink.getAttribute('data-ink-blocker')) === 'ink.waitingVerifyEmail');
    await check('the ink that was sent is the picture and nothing else — answer-blind, before and after sign-in',
      reader.requests.length >= 1 && reader.requests.every(r => r.parsed && JSON.stringify(Object.keys(r.parsed)) === '["image"]' && /^data:image\//.test(r.parsed.image)),
      JSON.stringify(reader.requests.map(r => r.parsed && Object.keys(r.parsed))));

    // ── 2 · the email is verified (on another device, say); the student comes
    // back to the app and the kept ink is read with no further action ───────
    emailVerified = true;
    const sentBeforeVerify = reader.requests.length;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForSelector('.ink-line', { timeout: 20000 }).catch(() => {});
    const readBack = await page.locator('.ink-line').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-text') || ''));
    await check('once verified, the kept ink is read by itself — no retyping, no reload',
      readBack.length === 1 && readBack[0] === reader.text && reader.requests.length > sentBeforeVerify,
      `read ${JSON.stringify(readBack)}; ${reader.requests.length - sentBeforeVerify} further transcribe requests`);
    await check('and the waiting notice is gone',
      await page.locator('.ink-status-line').count() === 0 && await page.locator('[data-ink-account-recovery]').count() === 0);
    await check('still without a reload', await page.evaluate(() => window.__PRI_E2E_NO_RELOAD__) === 'kept');

    // Back to Settings for the assignment hand-off. (A reload is fine from
    // here: everything the no-reload invariant guards has been asserted.)
    await goto('/settings');
    await inbox.waitFor({ state: 'visible', timeout: 15000 });

    await inbox.getByRole('button', { name: 'Start assignment' }).click();
    await page.waitForURL(url => url.pathname === '/practice' && url.searchParams.get('classId') === ASSIGNMENT.classId && url.searchParams.get('assignment') === ASSIGNMENT.id, { timeout: 15000 });
    await check('starting an assignment hands off to the normal Practice route with scoped ids',
      new URL(page.url()).searchParams.get('assignment') === ASSIGNMENT.id);

    // React Router 7 can commit history before the route tree finishes its
    // concurrent render. Prove Settings has actually left the tree before
    // looking for the same assignment title on Practice.
    await page.locator('#assignment-inbox-title').waitFor({ state: 'detached', timeout: 15000 });
    const assignmentCard = page.locator('.card', { has: page.getByText(ASSIGNMENT.title, { exact: true }) }).first();
    await assignmentCard.waitFor({ state: 'visible', timeout: 15000 });
    const assignmentCardText = await assignmentCard.innerText();
    await check('Practice renders the verified assignment context before serving local maths',
      assignmentCardText.includes(ASSIGNMENT.title) && assignmentCardText.includes('0/3 questions completed'),
      `assignment card reads ${JSON.stringify(assignmentCardText.slice(0, 320))}`);

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
