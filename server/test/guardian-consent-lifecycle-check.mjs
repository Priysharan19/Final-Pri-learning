import assert from 'node:assert/strict';

process.env.PRI_AUTH_DELIVERY_KEY = '11'.repeat(32);

const [
  { default: express },
  { default: cookieParser },
  { createPlatformDb },
  { createAccountRouter },
  { decryptDeliveryToken },
  { requireGuardianConsent }
] = await Promise.all([
  import('express'),
  import('cookie-parser'),
  import('../platform/db.js'),
  import('../platform/accounts.js'),
  import('../platform/deliveryCrypto.js'),
  import('../platform/guardianConsent.js')
]);

function makeHarness() {
  const db = createPlatformDb(':memory:');
  const app = express();
  app.use(express.json({ limit: '128kb' }));
  app.use(cookieParser());
  app.use('/account', createAccountRouter(db));
  app.get('/protected', requireGuardianConsent(db), (req, res) => res.json({ ok: true }));
  return { db, app };
}

function cookieHeader(jar) {
  return Object.entries(jar).filter(([, value]) => value !== '').map(([name, value]) => `${name}=${value}`).join('; ');
}

function absorbCookies(response, jar) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  for (const raw of values) {
    const first = String(raw).split(';', 1)[0];
    const index = first.indexOf('=');
    if (index > 0) jar[first.slice(0, index)] = first.slice(index + 1);
  }
}

async function serve(app) {
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function request(origin, path, { method = 'GET', body, jar = {} } = {}) {
  const headers = { Accept: 'application/json' };
  const cookies = cookieHeader(jar);
  if (cookies) headers.Cookie = cookies;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${origin}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error'
  });
  absorbCookies(response, jar);
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

function guardianBearer(db, accountId) {
  const row = db.prepare(`SELECT o.token_id,o.token_ciphertext
    FROM auth_delivery_outbox o
    WHERE o.account_id=? AND o.kind='guardian-consent'
    ORDER BY o.created_at DESC LIMIT 1`).get(accountId);
  assert.ok(row, 'guardian delivery envelope must exist');
  return decryptDeliveryToken(row.token_ciphertext, `${accountId}:guardian-consent:${row.token_id}`);
}

async function registerChild(origin, email, guardianEmail, jar = {}) {
  const response = await request(origin, '/account/register', {
    method: 'POST', jar,
    body: {
      name: 'Guardian Lifecycle Student', email, password: 'guardian-pass-123',
      deviceId: `device-${email}`, isAdult: false, year: '9',
      guardianName: 'Guardian Example', guardianEmail
    }
  });
  assert.equal(response.status, 201);
  return { accountId: response.data.account.id, jar };
}

const { db, app } = makeHarness();
const { server, origin } = await serve(app);

try {
  // pending -> withdraw -> confirm must never re-grant the same ceremony.
  const first = await registerChild(origin, 'guardian-one@example.test', 'guardian1@example.test');
  const firstBearer = guardianBearer(db, first.accountId);
  assert.equal((await request(origin, '/protected', { jar: first.jar })).status, 403, 'pending child sync must fail closed');
  const preConfirmWithdraw = await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: firstBearer } });
  assert.deepEqual(preConfirmWithdraw.data, { ok: true, withdrawn: true });
  const confirmAfterWithdraw = await request(origin, '/account/guardian/confirm', { method: 'POST', body: { token: firstBearer } });
  assert.equal(confirmAfterWithdraw.status, 200);
  assert.deepEqual(confirmAfterWithdraw.data, { ok: true, confirmed: false });
  assert.equal(db.prepare('SELECT confirmed_at,withdrawn_at FROM guardian_consents WHERE account_id=?').get(first.accountId).confirmed_at, null);
  assert.equal((await request(origin, '/protected', { jar: first.jar })).data.error.code, 'GUARDIAN_CONSENT_WITHDRAWN');

  // confirm -> withdraw ends withdrawn, and repeated withdrawal is idempotent.
  const second = await registerChild(origin, 'guardian-two@example.test', 'guardian2@example.test');
  const secondBearer = guardianBearer(db, second.accountId);
  const confirmed = await request(origin, '/account/guardian/confirm', { method: 'POST', body: { token: secondBearer } });
  assert.deepEqual(confirmed.data, { ok: true, confirmed: true });
  assert.equal((await request(origin, '/protected', { jar: second.jar })).status, 200, 'confirmed child sync should pass');
  assert.deepEqual((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: secondBearer } })).data,
    { ok: true, withdrawn: true });
  assert.deepEqual((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: secondBearer } })).data,
    { ok: true, withdrawn: false });
  assert.equal((await request(origin, '/protected', { jar: second.jar })).data.error.code, 'GUARDIAN_CONSENT_WITHDRAWN');

  // Late withdrawal remains permission-reducing after expiry and consumption,
  // while confirmation remains bounded to the one-hour ceremony window.
  const third = await registerChild(origin, 'guardian-three@example.test', 'guardian3@example.test');
  const thirdBearer = guardianBearer(db, third.accountId);
  db.prepare(`UPDATE account_tokens SET created_at=?, expires_at=?, consumed_at=?
    WHERE account_id=? AND purpose='guardian-consent'`).run(Date.now() - 2 * 60 * 60 * 1000, Date.now() - 60 * 60 * 1000, Date.now() - 90 * 60 * 1000, third.accountId);
  assert.equal((await request(origin, '/account/guardian/confirm', { method: 'POST', body: { token: thirdBearer } })).status, 400,
    'expired/consumed guardian bearer must never elevate permission');
  assert.deepEqual((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: thirdBearer } })).data,
    { ok: true, withdrawn: true }, 'expired/consumed bearer may still reduce permission');

  // Purpose and account isolation: unrelated action tokens cannot withdraw,
  // and one guardian bearer can affect only the account named by its token row.
  const fourth = await registerChild(origin, 'guardian-four@example.test', 'guardian4@example.test');
  const fourthBearer = guardianBearer(db, fourth.accountId);
  const verifyRow = db.prepare(`SELECT o.token_id,o.token_ciphertext FROM auth_delivery_outbox o
    WHERE o.account_id=? AND o.kind='verify-email' ORDER BY o.created_at DESC LIMIT 1`).get(fourth.accountId);
  const verifyBearer = decryptDeliveryToken(verifyRow.token_ciphertext, `${fourth.accountId}:verify-email:${verifyRow.token_id}`);
  assert.equal((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: verifyBearer } })).status, 400,
    'verify-email bearer must not cross into guardian authority');
  assert.equal(db.prepare('SELECT withdrawn_at FROM guardian_consents WHERE account_id=?').get(fourth.accountId).withdrawn_at, null);
  assert.deepEqual((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: fourthBearer } })).data,
    { ok: true, withdrawn: true });

  // Account deletion must revoke the guardian bearer by FK cascade.
  assert.equal((await request(origin, '/account/', {
    method: 'DELETE', jar: fourth.jar, body: { password: 'guardian-pass-123' }
  })).status, 200);
  assert.equal(db.prepare(`SELECT 1 FROM account_tokens WHERE account_id=? AND purpose='guardian-consent'`).get(fourth.accountId), undefined);
  assert.equal((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: fourthBearer } })).status, 400,
    'deleted account must leave no guardian bearer authority');

  console.log('PASS — guardian consent confirmation is bounded, withdrawal is monotonic/idempotent, and authority stays purpose/account scoped.');
} finally {
  await new Promise(resolve => server.close(resolve));
  db.close();
}
