import assert from 'node:assert/strict';

// Delivery encryption is production-shaped even in this in-process contract.
process.env.PRI_AUTH_DELIVERY_KEY = '11'.repeat(32);

const [
  { default: express },
  { default: cookieParser },
  { createPlatformDb },
  { createAccountRouter },
  { decryptDeliveryToken }
] = await Promise.all([
  import('express'),
  import('cookie-parser'),
  import('../platform/db.js'),
  import('../platform/accounts.js'),
  import('../platform/deliveryCrypto.js')
]);

const db = createPlatformDb(':memory:');
const app = express();
app.use(express.json({ limit: '128kb' }));
app.use(cookieParser());
app.use('/account', createAccountRouter(db));

const server = await new Promise(resolve => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const origin = `http://127.0.0.1:${server.address().port}`;

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
    if (index <= 0) continue;
    jar[first.slice(0, index)] = first.slice(index + 1);
  }
}

async function request(path, { method = 'GET', body, jar = {} } = {}) {
  const headers = { Accept: 'application/json' };
  const cookies = cookieHeader(jar);
  if (cookies) headers.Cookie = cookies;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${origin}/account${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error'
  });
  absorbCookies(response, jar);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { status: response.status, data, headers: response.headers };
}

function pendingDelivery(accountId, kind) {
  return db.prepare(`SELECT * FROM auth_delivery_outbox
    WHERE account_id=? AND kind=? AND delivered_at IS NULL ORDER BY created_at DESC`).get(accountId, kind);
}

function deliveryToken(accountId, purpose, row) {
  assert.ok(row?.token_id && row?.token_ciphertext, `missing ${purpose} delivery envelope`);
  return decryptDeliveryToken(row.token_ciphertext, `${accountId}:${purpose}:${row.token_id}`);
}

try {
  const jarA = {};
  const registration = await request('/register', {
    method: 'POST', jar: jarA,
    body: { name: 'Lifecycle Student', email: 'lifecycle@example.test', password: 'initial-pass-123', deviceId: 'ipad-a' }
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.data.account.emailVerified, false);
  assert.ok(jarA.pri_cloud_session, 'registration must establish a hashed cookie session');
  assert.ok(jarA.pri_csrf, 'registration must establish the paired CSRF cookie');
  const accountId = registration.data.account.id;

  // Resending verification invalidates the older token rather than leaving two
  // live links that can be replayed later.
  const firstDelivery = pendingDelivery(accountId, 'verify-email');
  const firstVerification = deliveryToken(accountId, 'verify-email', firstDelivery);
  const resend = await request('/email/verification-request', { method: 'POST', jar: jarA, body: {} });
  assert.deepEqual(resend.data, { ok: true, alreadyVerified: false });
  const secondDelivery = pendingDelivery(accountId, 'verify-email');
  assert.notEqual(secondDelivery.token_id, firstDelivery.token_id);
  const secondVerification = deliveryToken(accountId, 'verify-email', secondDelivery);
  assert.equal((await request('/email/verify', { method: 'POST', body: { token: firstVerification } })).status, 400,
    'superseded verification token must be unusable');
  assert.equal((await request('/email/verify', { method: 'POST', body: { token: secondVerification } })).status, 200);
  assert.ok(db.prepare('SELECT email_verified_at FROM accounts WHERE id=?').get(accountId).email_verified_at);
  assert.deepEqual(
    (await request('/email/verification-request', { method: 'POST', jar: jarA, body: {} })).data,
    { ok: true, alreadyVerified: true }
  );

  // Reset-request response is enumeration-safe: an existing and an unknown email
  // receive the same public status/body.
  const knownReset = await request('/password/reset-request', { method: 'POST', body: { email: 'lifecycle@example.test' } });
  const unknownReset = await request('/password/reset-request', { method: 'POST', body: { email: 'nobody@example.test' } });
  assert.equal(knownReset.status, 200);
  assert.equal(unknownReset.status, 200);
  assert.deepEqual(knownReset.data, unknownReset.data);
  const resetDelivery = pendingDelivery(accountId, 'reset-password');
  const resetToken = deliveryToken(accountId, 'reset-password', resetDelivery);

  const reset = await request('/password/reset', { method: 'POST', jar: jarA, body: { token: resetToken, password: 'reset-pass-456' } });
  assert.equal(reset.status, 200);
  assert.equal(reset.data.signInRequired, true);
  assert.equal((await request('/me', { jar: jarA })).status, 401, 'password reset must revoke the existing session');
  assert.equal((await request('/login', { method: 'POST', body: { email: 'lifecycle@example.test', password: 'initial-pass-123', deviceId: 'old' } })).status, 401,
    'old password must stop authenticating after reset');

  const jarB = {};
  const jarC = {};
  assert.equal((await request('/login', { method: 'POST', jar: jarB, body: { email: 'lifecycle@example.test', password: 'reset-pass-456', deviceId: 'ipad-b' } })).status, 200);
  assert.equal((await request('/login', { method: 'POST', jar: jarC, body: { email: 'lifecycle@example.test', password: 'reset-pass-456', deviceId: 'ipad-c' } })).status, 200);

  const devicesBefore = await request('/devices', { jar: jarB });
  assert.equal(devicesBefore.status, 200);
  assert.equal(devicesBefore.data.devices.length, 2);
  assert.equal(devicesBefore.data.devices.filter(row => row.current).length, 1);
  assert.equal(devicesBefore.data.devices.find(row => row.current).deviceId, 'ipad-b');

  // Password change revokes every bearer session and rotates only the requesting
  // device onto a fresh token.
  const changed = await request('/password', {
    method: 'PATCH', jar: jarB,
    body: { currentPassword: 'reset-pass-456', newPassword: 'final-pass-789' }
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.sessionsRotated, true);
  assert.equal((await request('/me', { jar: jarC })).status, 401, 'other device must be revoked by password change');
  const devicesAfter = await request('/devices', { jar: jarB });
  assert.equal(devicesAfter.status, 200);
  assert.deepEqual(devicesAfter.data.devices.map(row => [row.deviceId, row.current]), [['ipad-b', true]]);

  // Revoking the current device clears the browser cookie as well as the server
  // row so the UI cannot appear signed in after the bearer was invalidated.
  const currentSession = devicesAfter.data.devices[0];
  const revoked = await request(`/devices/${currentSession.id}`, { method: 'DELETE', jar: jarB });
  assert.deepEqual(revoked.data, { revoked: true, current: true });
  assert.equal((await request('/devices', { jar: jarB })).status, 401);

  const jarD = {};
  assert.equal((await request('/login', { method: 'POST', jar: jarD, body: { email: 'lifecycle@example.test', password: 'final-pass-789', deviceId: 'ipad-d' } })).status, 200);
  const exported = await request('/export', { jar: jarD });
  assert.equal(exported.status, 200);
  assert.equal(exported.data.format, 'pri-account-export-v1');
  assert.equal(exported.data.account.id, accountId);

  assert.equal((await request('/', { method: 'DELETE', jar: jarD, body: { password: 'wrong-final-pass' } })).status, 401,
    'destructive account deletion must require fresh correct password proof');
  const deletion = await request('/', { method: 'DELETE', jar: jarD, body: { password: 'final-pass-789' } });
  assert.deepEqual(deletion.data, { deleted: true });
  assert.equal(db.prepare('SELECT 1 FROM accounts WHERE id=?').get(accountId), undefined);
  assert.equal((await request('/me', { jar: jarD })).status, 401);

  console.log('PASS — account registration, verification resend, reset, password rotation, device revocation, export and deletion lifecycle hold.');
} finally {
  await new Promise(resolve => server.close(resolve));
  db.close();
}
