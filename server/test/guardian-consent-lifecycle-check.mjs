import assert from 'node:assert/strict';

process.env.PRI_AUTH_DELIVERY_KEY = '11'.repeat(32);

const [
  { default: express },
  { default: cookieParser },
  { openTestStore },
  { createAccountRouter },
  { decryptDeliveryToken },
  { requireGuardianConsent },
  { runHousekeeping }
] = await Promise.all([
  import('express'),
  import('cookie-parser'),
  import('./support/engine.mjs'),
  import('../platform/accounts.js'),
  import('../platform/deliveryCrypto.js'),
  import('../platform/guardianConsent.js'),
  import('../platform/housekeeping.js')
]);

async function makeHarness() {
  // SQLite by default; `--engine=postgres` runs it on a migrated Postgres.
  const testStore = await openTestStore(undefined, { label: 'guardian_lifecycle' });
  const db = testStore.store;
  const app = express();
  app.use(express.json({ limit: '128kb' }));
  app.use(cookieParser());
  app.use('/account', createAccountRouter(db));
  app.get('/protected', requireGuardianConsent(db), (req, res) => res.json({ ok: true }));
  return { db, app, testStore };
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

async function guardianBearer(db, accountId, kind = 'guardian-consent') {
  const row = await db.get(`SELECT o.token_id,o.token_ciphertext
    FROM auth_delivery_outbox o
    WHERE o.account_id=? AND o.kind=?
    ORDER BY o.created_at DESC LIMIT 1`, [accountId, kind]);
  assert.ok(row, `${kind} delivery envelope must exist`);
  return decryptDeliveryToken(row.token_ciphertext, `${accountId}:${kind}:${row.token_id}`);
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

const { db, app, testStore } = await makeHarness();
const { server, origin } = await serve(app);

try {
  // pending -> withdraw -> confirm must never re-grant the same ceremony.
  const first = await registerChild(origin, 'guardian-one@example.test', 'guardian1@example.test');
  const firstBearer = await guardianBearer(db, first.accountId);
  assert.equal((await request(origin, '/protected', { jar: first.jar })).status, 403, 'pending child sync must fail closed');
  const preConfirmWithdraw = await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: firstBearer } });
  assert.deepEqual(preConfirmWithdraw.data, { ok: true, withdrawn: true });
  const confirmAfterWithdraw = await request(origin, '/account/guardian/confirm', { method: 'POST', body: { token: firstBearer } });
  assert.equal(confirmAfterWithdraw.status, 200);
  assert.deepEqual(confirmAfterWithdraw.data, { ok: true, confirmed: false });
  assert.equal((await db.get('SELECT confirmed_at,withdrawn_at FROM guardian_consents WHERE account_id=?', [first.accountId])).confirmed_at, null);
  assert.equal((await request(origin, '/protected', { jar: first.jar })).data.error.code, 'GUARDIAN_CONSENT_WITHDRAWN');

  // confirm -> withdraw ends withdrawn, and repeated withdrawal is idempotent.
  const second = await registerChild(origin, 'guardian-two@example.test', 'guardian2@example.test');
  const secondBearer = await guardianBearer(db, second.accountId);
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
  const thirdBearer = await guardianBearer(db, third.accountId);
  await db.run(`UPDATE account_tokens SET created_at=?, expires_at=?, consumed_at=?
    WHERE account_id=? AND purpose='guardian-consent'`, [Date.now() - 2 * 60 * 60 * 1000, Date.now() - 60 * 60 * 1000, Date.now() - 90 * 60 * 1000, third.accountId]);
  assert.equal((await request(origin, '/account/guardian/confirm', { method: 'POST', body: { token: thirdBearer } })).status, 400,
    'expired/consumed guardian bearer must never elevate permission');
  assert.deepEqual((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: thirdBearer } })).data,
    { ok: true, withdrawn: true }, 'expired/consumed bearer may still reduce permission');

  // Purpose and account isolation: unrelated action tokens cannot withdraw,
  // and one guardian bearer can affect only the account named by its token row.
  const fourth = await registerChild(origin, 'guardian-four@example.test', 'guardian4@example.test');
  const fourthBearer = await guardianBearer(db, fourth.accountId);
  const verifyRow = (await db.get(`SELECT o.token_id,o.token_ciphertext FROM auth_delivery_outbox o
    WHERE o.account_id=? AND o.kind='verify-email' ORDER BY o.created_at DESC LIMIT 1`, [fourth.accountId]));
  const verifyBearer = decryptDeliveryToken(verifyRow.token_ciphertext, `${fourth.accountId}:verify-email:${verifyRow.token_id}`);
  assert.equal((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: verifyBearer } })).status, 400,
    'verify-email bearer must not cross into guardian authority');
  assert.equal((await db.get('SELECT withdrawn_at FROM guardian_consents WHERE account_id=?', [fourth.accountId])).withdrawn_at, null);
  assert.deepEqual((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: fourthBearer } })).data,
    { ok: true, withdrawn: true });

  // The withdrawal link a guardian keeps: issued on confirmation, it outlives
  // the one-hour confirmation token and every housekeeping pass, and works
  // long after the confirmation link has been purged — then exactly once.
  const fifth = await registerChild(origin, 'guardian-five@example.test', 'guardian5@example.test');
  const fifthConfirm = await guardianBearer(db, fifth.accountId);
  assert.equal((await request(origin, '/account/guardian/confirm', { method: 'POST', body: { token: fifthConfirm } })).data.confirmed, true);
  const fifthWithdraw = await guardianBearer(db, fifth.accountId, 'guardian-withdraw');
  assert.notEqual(fifthWithdraw, fifthConfirm, 'the withdrawal credential is a separate bearer');
  const sixHoursOn = Date.now() + 6 * 60 * 60 * 1000 + 60_000;
  const swept = await runHousekeeping(db, sixHoursOn);
  assert.ok(swept.tokens >= 1, 'housekeeping purges the spent confirmation token');
  assert.equal(await db.get("SELECT 1 FROM account_tokens WHERE account_id=? AND purpose='guardian-consent'", [fifth.accountId]), undefined, 'the confirmation token is gone');
  assert.ok(await db.get("SELECT 1 FROM account_tokens WHERE account_id=? AND purpose='guardian-withdraw' AND consumed_at IS NULL", [fifth.accountId]), 'the withdrawal credential survives');
  assert.equal((await request(origin, '/account/guardian/confirm', { method: 'POST', body: { token: fifthConfirm } })).status, 400, 'the confirmation link still dies after its hour');
  assert.equal((await request(origin, '/protected', { jar: fifth.jar })).status, 200, 'consent stands meanwhile');
  assert.deepEqual((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: fifthWithdraw } })).data,
    { ok: true, withdrawn: true }, 'the kept link withdraws after housekeeping has run');
  assert.equal((await request(origin, '/protected', { jar: fifth.jar })).data.error.code, 'GUARDIAN_CONSENT_WITHDRAWN');
  assert.equal((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: fifthWithdraw } })).status, 400,
    'the credential is revoked by the withdrawal it performed');
  assert.equal((await request(origin, '/account/guardian/confirm', { method: 'POST', body: { token: fifthWithdraw } })).status, 400,
    'and could never confirm');

  // Account deletion must revoke the guardian bearer by FK cascade.
  assert.equal((await request(origin, '/account/', {
    method: 'DELETE', jar: fourth.jar, body: { password: 'guardian-pass-123' }
  })).status, 200);
  assert.equal((await db.get(`SELECT 1 FROM account_tokens WHERE account_id=? AND purpose='guardian-consent'`, [fourth.accountId])), undefined);
  assert.equal((await request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: fourthBearer } })).status, 400,
    'deleted account must leave no guardian bearer authority');

  console.log(`engine: ${testStore.engine}`);
  console.log('PASS — guardian consent confirmation is bounded, withdrawal is monotonic/idempotent, and authority stays purpose/account scoped.');
} finally {
  await new Promise(resolve => server.close(resolve));
  await testStore.close();
}
