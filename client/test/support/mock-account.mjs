// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a stood-in account server for the flows that intercept /v1
//
// A few browser flows (the cloud wiring, the admin console, Continue with
// Google) answer every /v1 request from Playwright so they can script an
// identity the real platform would not hand a test — an admin with a second
// factor, a Google identity, a consent that flips mid-page. Those flows used
// to open the app with a local profile and connect in Settings; the app now
// opens for nobody until the server has confirmed an account (issue #477), so
// their stand-in must answer what the landing card and the activation gate ask:
//
//   GET  /v1/account/otp/channels         which code channels exist
//   POST /v1/account/otp/request          a code was "sent"
//   POST /v1/account/otp/verify           the scripted account signs in
//   GET  /v1/account/me                   the live session (401 when none)
//   GET  /v1/account/guardian/state       the ONE bound statement
//   POST /v1/sync/push · GET /v1/sync/pull  the first sync, accepted whole
//   GET  /v1/entitlements · /v1/billing/config · /v1/account/identity/providers
//   POST /v1/account/logout
//
// `handle(route)` answers these and returns true; a flow's own handler takes
// everything else. The replies have the real server's shapes (server/platform/
// accounts.js, otp.js, sync.js) and nothing here is the product: the product
// code under test is the card, the gate and the shell above this seam.
// ─────────────────────────────────────────────────────────────────────────────

/** One scripted account. `guardian` is 'not-required' | 'pending' | 'given' | 'withdrawn'. */
export function mockAccountServer({ account, guardian = 'not-required', emailVerified = true, providers = { google: null, apple: null }, channels = { email: true, sms: false }, csrf = 'e2e-csrf' } = {}) {
  const state = { authenticated: false, guardian, emailVerified, account: { ...account, emailVerified }, verifies: 0, syncPushes: 0, syncPulls: 0, codes: [] };
  let cursor = 0;
  const respond = (route, status, value, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(value) });
  const unauthorised = route => respond(route, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
  const statement = () => {
    const required = state.guardian !== 'not-required';
    const blockerCode = !required || state.guardian === 'given' ? null : `GUARDIAN_CONSENT_${state.guardian.toUpperCase()}`;
    return {
      accountId: String(state.account.id), required, state: state.guardian, ageBasis: required ? 'child' : 'adult',
      blockerCode, eligible: blockerCode === null && !!state.emailVerified, emailVerified: !!state.emailVerified,
      guardianEmail: null, noticeVersion: null
    };
  };

  async function handle(route) {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path === '/v1/account/otp/channels') { await respond(route, 200, { channels }); return true; }
    if (path === '/v1/account/otp/request' && method === 'POST') {
      await respond(route, 200, { challengeId: `ch_mock_${Date.now()}`, channel: 'email', expiresInMs: 10 * 60 * 1000, resendAfterMs: 30000 });
      return true;
    }
    if (path === '/v1/account/otp/verify' && method === 'POST') {
      let body = {}; try { body = JSON.parse(request.postData() || '{}'); } catch { body = {}; }
      state.verifies++; state.codes.push(body.code || null);
      state.authenticated = true;
      await respond(route, 200, {
        status: 'signed-in', account: { ...state.account, emailVerified: state.emailVerified }, created: false,
        guardianConsent: { required: state.guardian !== 'not-required', state: state.guardian }
      }, { 'set-cookie': `pri_csrf=${csrf}; Path=/; SameSite=Lax` });
      return true;
    }
    if (path === '/v1/account/me' && method === 'GET') {
      if (!state.authenticated) await unauthorised(route);
      else await respond(route, 200, { account: { ...state.account, emailVerified: state.emailVerified } });
      return true;
    }
    if (path === '/v1/account/guardian/state' && method === 'GET') {
      if (!state.authenticated) await unauthorised(route); else await respond(route, 200, statement(), { 'cache-control': 'no-store' });
      return true;
    }
    if (path === '/v1/account/identity/providers') { await respond(route, 200, { providers }); return true; }
    if (path === '/v1/billing/config') { await respond(route, 200, { display: null, webCheckout: { configured: false } }); return true; }
    if (path === '/v1/entitlements') {
      if (!state.authenticated) await unauthorised(route);
      else await respond(route, 200, { accountId: String(state.account.id), entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 1, issuedAt: Date.now() } });
      return true;
    }
    if (path.startsWith('/v1/sync/pull/') && method === 'GET') {
      if (!state.authenticated) { await unauthorised(route); return true; }
      state.syncPulls++;
      const from = Number(path.split('/').pop()) || 0;
      await respond(route, 200, { schemaVersion: 1, cursor: Math.max(from, cursor), hasMore: false, events: [], entities: [] });
      return true;
    }
    if (path === '/v1/sync/push' && method === 'POST') {
      if (!state.authenticated) { await unauthorised(route); return true; }
      state.syncPushes++;
      let body = {}; try { body = JSON.parse(request.postData() || '{}'); } catch { body = {}; }
      cursor += 100;
      const acceptedEvents = (body.events || []).map((event, i) => ({ id: event.id, serverCursor: cursor + i, replayed: false }));
      const acceptedEntities = (body.entities || []).map((entity, i) => ({ kind: entity.kind, entityId: entity.entityId, version: (entity.baseVersion || 0) + 1, serverCursor: cursor + 50 + i }));
      await respond(route, 200, { schemaVersion: 1, cursor, acceptedEvents, acceptedEntities, fullRescanAccepted: !!body.fullRescan });
      return true;
    }
    if (path === '/v1/account/logout' && method === 'POST') { state.authenticated = false; await respond(route, 200, { ok: true }); return true; }
    return false;
  }

  return { state, handle, statement };
}

/**
 * Enter the app through the landing card against a stood-in server: the
 * scripted account is a returning one, so the card asks the class once (this
 * device has no profile yet) and the gate opens on the stand-in's statement
 * and sync. `code` is whatever the stand-in accepts — it checks nothing.
 */
export async function enterThroughCard(page, { email, year = 10, code = '123456' } = {}) {
  await page.locator('[data-signin-card="page"][data-signup-step="method"]').waitFor({ timeout: 30000 });
  await page.locator('#signup-destination').fill(email);
  await page.getByTestId('signup-send-code').click();
  await page.locator('[data-signup-step="code"]').waitFor({ timeout: 20000 });
  await page.locator('#signup-code-0').focus();
  await page.keyboard.type(code);
  await page.locator('[data-signup-step="class"]').waitFor({ timeout: 20000 });
  await page.getByTestId(`signup-class-${year}`).click();
  await page.getByTestId('signup-class-next').click();
  await page.locator('.shell').waitFor({ timeout: 60000 });
}
