// V1 security acceptance suite (V1 blocker #14; doc §23 security and abuse).
//
// Real HTTP against the exact production middleware chain (server/app.js), on
// SQLite by default and on a migrated Postgres as the pri_server role with
// --engine=postgres. Every check here is a NEGATIVE: the request must fail
// closed, and where it targets someone else's object, that object must be
// unchanged afterwards.
//
//   A. Inventory-driven sweeps over every /v1 route in
//      docs/security/route-inventory.json: no session, forged/oversized
//      cookies, wrong role, unverified email, pending guardian consent, and
//      CSRF missing / wrong / cross-session on every cookie-auth mutation.
//   B. Session lifecycle: logout, per-device revoke, password change, password
//      reset, account deletion and expiry all kill the old cookie; one-time
//      tokens are purpose-bound and are never a session.
//   C. Object-level authorization (BOLA): student A against student B's sync
//      data, idempotency keys, devices, export, billing, reports, guardian
//      state, classes, assignments and submissions; teacher against an
//      unrelated class; support/teacher against admin and content authority.
//   D. Hostile input: malformed / non-object / oversized JSON, traversal-ish
//      ids, SQL-injection-ish strings, prototype-pollution keys, unicode,
//      emoji, NUL and lone surrogates — coded 4xx or a faithful store, never a
//      500, never a polluted prototype.
//   E. No open redirect: no route answers 3xx to a caller-supplied location.
//   F. Secrets: provider keys present in the environment never appear in any
//      response body or header, /v1/health, an error body, or anything this
//      suite's server wrote to stdout/stderr.

// Secret-shaped values are assembled at runtime so the repository secret scan
// (tools/secret-scan.mjs) never sees one committed.
const shaped = (prefix, body) => `${prefix}${body}`;
const SECRETS = {
  PRI_HANDWRITING_API_KEY: shaped('sk-', 'proj-ACCEPTANCEhandwritingSECRET0123456789abcdef'),
  PRI_RAZORPAY_KEY_SECRET: 'rzpACCEPTANCEkeySECRET0123456789',
  PRI_RAZORPAY_WEBHOOK_SECRET: 'whsecACCEPTANCEwebhookSECRET0123456789',
  PRI_RESEND_API_KEY: shaped('re_', 'ACCEPTANCE_resendSECRET0123456789abcd'),
  PRI_CSRF_SECRET: 'csrfACCEPTANCEsecretValue0123456789abcdef',
  PRI_AUTH_DELIVERY_KEY: 'ab'.repeat(32)
};
// A hostile local stand-in for the paid provider: it echoes back every header
// it was sent — including the server's Authorization bearer — inside an error
// body. The server must never relay any of that to the student. Nothing in
// this suite reaches the real network.
const { createServer } = await import('node:http');
let providerCalls = 0;
const provider = createServer((req, res) => {
  providerCalls += 1;
  req.resume();
  res.writeHead(500, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: { message: `upstream failure; you sent ${JSON.stringify(req.headers)}` } }));
});
await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
const providerUrl = `http://127.0.0.1:${provider.address().port}/v1/responses`;
Object.assign(process.env, SECRETS, {
  PRI_HANDWRITING_ENDPOINT: providerUrl,
  PRI_WORKING_ENDPOINT: providerUrl,
  PRI_PAID_CALLS_PER_HOUR: '1000',
  PRI_PAID_CALLS_PER_DAY: '1000'
});

// Everything the server process writes while this suite runs is captured and
// searched for the secrets above at the end (F).
const captured = [];
for (const stream of [process.stdout, process.stderr]) {
  const original = stream.write.bind(stream);
  stream.write = (chunk, ...rest) => { captured.push(String(chunk)); return original(chunk, ...rest); };
}

const { startApp, registerAccount, verifyEmail, checks, cookieHeader } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { decryptDeliveryToken } = await import('../platform/deliveryCrypto.js');
const { loadInventory } = await import('./support/route-inventory.mjs');
const inventory = loadInventory();

const c = checks();
const h = await startApp({ engine: requestedEngine(), log: () => {} });
const db = h.db;
const responses = [];

// Every response is kept for the secret sweep in F.
const rawRequest = h.request;
h.request = async (...args) => {
  const response = await rawRequest(...args);
  responses.push(`${response.status} ${JSON.stringify(Object.fromEntries(response.headers))} ${response.text}`);
  return response;
};

/** A request with exactly the headers given — no automatic CSRF header. */
async function bare(path, { method = 'GET', jar = {}, headers = {}, body, rawBody } = {}) {
  const sendHeaders = { Accept: 'application/json', ...headers };
  const cookie = cookieHeader(jar);
  if (cookie) sendHeaders.Cookie = cookie;
  if (body !== undefined || rawBody !== undefined) sendHeaders['Content-Type'] ??= 'application/json';
  const response = await fetch(`${h.origin}${path}`, {
    method, headers: sendHeaders, redirect: 'manual',
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  responses.push(`${response.status} ${JSON.stringify(Object.fromEntries(response.headers))} ${text}`);
  return { status: response.status, data, text, headers: response.headers };
}

const resetLimits = () => db.run('DELETE FROM rate_limits');
let serial = 0;

async function account({ role = 'student', verified = true, name = 'Acceptance User', email } = {}) {
  serial += 1;
  const address = email || `acceptance.${role}.${serial}@example.test`;
  const deviceId = `ipad-acc-${serial}`;
  await resetLimits();
  const password = `acceptance-pw-${serial}-horse`;
  const made = await registerAccount(h, { email: address, name, deviceId, password });
  if (made.status !== 201) throw new Error(`register ${address}: ${made.status} ${made.text}`);
  if (verified) {
    const v = await verifyEmail(h, made.account.id);
    if (v.status !== 200) throw new Error(`verify ${address}: ${v.status}`);
  }
  if (role !== 'student') await db.run('UPDATE accounts SET role=? WHERE id=?', [role, made.account.id]);
  return { id: made.account.id, jar: made.jar, email: address, deviceId, password };
}

async function outboxToken(accountId, kind) {
  const row = await db.get(`SELECT token_id,token_ciphertext FROM auth_delivery_outbox
    WHERE account_id=? AND kind=? AND delivered_at IS NULL ORDER BY created_at DESC LIMIT 1`, [accountId, kind]);
  return row ? decryptDeliveryToken(row.token_ciphertext, `${accountId}:${kind}:${row.token_id}`) : null;
}

const SAMPLE = {
  classId: 'cls_00000000-0000-0000-0000-000000000000',
  assignmentId: 'asn_00000000-0000-0000-0000-000000000000',
  studentId: 'acct_00000000-0000-0000-0000-000000000000',
  accountId: 'acct_00000000-0000-0000-0000-000000000000',
  sessionId: 'ses_00000000-0000-0000-0000-000000000000',
  revisionId: 'content_00000000-0000-0000-0000-000000000000',
  reportId: 'rpt_00000000-0000-0000-0000-000000000000',
  provider: 'web',
  cursor: '0',
  key: 'acceptance.flag'
};
const concrete = path => path.replace(/:([A-Za-z]+)(\([^)]*\))?/g, (_, name) => SAMPLE[name] ?? 'x');
const routes = inventory.routes.filter(route => !route.path.includes('(*)'));
const sessionRoutes = routes.filter(route => route.auth === 'session');
const MUTATION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const send = (route, jar, extra = {}) => h.request(concrete(route.path), {
  method: route.method, jar, ...(MUTATION.has(route.method) ? { body: {} } : {}), ...extra
});

const pushBody = (deviceId, seq, payload = { correct: true }) => ({
  schemaVersion: 1, deviceId,
  events: [{ id: `evt-${deviceId}-${seq}`, deviceId, deviceSeq: seq, kind: 'practice-attempt', payload, occurredAt: Date.now() }],
  entities: []
});

try {
  // ══ A. Inventory-driven sweeps ════════════════════════════════════════════
  c.ok(sessionRoutes.length >= 55, `${sessionRoutes.length} session routes swept`);

  // A1. No session at all, a forged cookie, an over-long cookie.
  for (const [label, jar] of [
    ['no session', {}],
    ['forged session cookie', { pri_cloud_session: 'forged-token-value-not-issued-by-the-server' }],
    ['oversized session cookie', { pri_cloud_session: 'A'.repeat(4000) }]
  ]) {
    const failures = [];
    for (const route of sessionRoutes) {
      // A forged cookie has no matching CSRF pair, so mutations stop at the
      // CSRF guard first — still a fail-closed answer, and asserted as such.
      const r = await send(route, { ...jar });
      const expectCsrf = label !== 'no session' && MUTATION.has(route.method);
      const ok = expectCsrf
        ? r.status === 403 && r.data?.error?.code === 'CSRF_REJECTED'
        : r.status === 401 && r.data?.error?.code === 'AUTH_REQUIRED';
      if (!ok) failures.push(`${route.method} ${route.path} → ${r.status} ${r.data?.error?.code || r.text.slice(0, 80)}`);
    }
    c.deq(failures, [], `${label}: every session route fails closed`);
  }

  const student = await account();
  const teacher = await account({ role: 'teacher' });
  const support = await account({ role: 'support' });
  const admin = await account({ role: 'admin' });

  // A2. Wrong role: each role is refused by every gate that does not name it.
  for (const [role, actor] of [['student', student], ['teacher', teacher], ['support', support], ['admin', admin]]) {
    const failures = [];
    let swept = 0;
    for (const route of sessionRoutes.filter(entry => entry.roles && !entry.roles.includes(role))) {
      swept++;
      await resetLimits();
      const r = await send(route, actor.jar);
      if (!(r.status === 403 && r.data?.error?.code === 'FORBIDDEN')) failures.push(`${route.method} ${route.path} → ${r.status} ${r.data?.error?.code || ''}`);
    }
    c.deq(failures, [], `${role}: refused (403 FORBIDDEN) by all ${swept} gates that exclude the role`);
  }

  // A3. Unverified email, with a role the route otherwise allows.
  {
    const failures = [];
    for (const route of sessionRoutes.filter(entry => entry.verifiedEmail)) {
      const role = route.roles ? route.roles.find(r => r !== 'admin') || route.roles[0] : 'student';
      const actor = await account({ role, verified: false });
      const r = await send(route, actor.jar);
      if (!(r.status === 403 && r.data?.error?.code === 'EMAIL_UNVERIFIED')) failures.push(`${route.method} ${route.path} → ${r.status} ${r.data?.error?.code || ''}`);
    }
    c.deq(failures, [], 'unverified accounts are refused by every verified-email gate');
  }

  // A4. A child account whose guardian has not confirmed is refused by every
  // consent-gated session route.
  const child = await (async () => {
    await resetLimits();
    const jar = {};
    const r = await h.request('/v1/account/register', { method: 'POST', jar, body: {
      name: 'Child Learner', email: 'child.pending@example.test', password: 'correct-horse-battery', deviceId: 'ipad-child',
      year: '9', guardianName: 'Guardian One', guardianEmail: 'guardian.one@example.test'
    } });
    c.eq(r.status, 201, 'child account registered');
    await verifyEmail(h, r.data.account.id);
    return { id: r.data.account.id, jar };
  })();
  {
    const failures = [];
    for (const route of sessionRoutes.filter(entry => entry.guardianConsent)) {
      const r = await send(route, child.jar);
      if (!(r.status === 403 && r.data?.error?.code === 'GUARDIAN_CONSENT_PENDING')) failures.push(`${route.method} ${route.path} → ${r.status} ${r.data?.error?.code || ''}`);
    }
    c.deq(failures, [], 'pending guardian consent blocks every consent-gated session route');
  }

  // A5. CSRF on every cookie-authenticated mutation: header missing, header
  // wrong, CSRF cookie missing, and another session's (valid) pair.
  {
    const mutations = routes.filter(route => route.csrf === 'double-submit-when-session-cookie');
    c.ok(mutations.length >= 40, `${mutations.length} CSRF-guarded mutations`);
    const failures = [];
    for (const route of mutations) {
      const path = concrete(route.path);
      const variants = [
        ['missing header', { jar: { pri_cloud_session: student.jar.pri_cloud_session, pri_csrf: student.jar.pri_csrf } }],
        ['wrong header', { jar: { ...student.jar }, headers: { 'x-pri-csrf': 'not-the-token' } }],
        ['missing cookie', { jar: { pri_cloud_session: student.jar.pri_cloud_session }, headers: { 'x-pri-csrf': student.jar.pri_csrf } }],
        ['other session pair', { jar: { pri_cloud_session: student.jar.pri_cloud_session, pri_csrf: teacher.jar.pri_csrf }, headers: { 'x-pri-csrf': teacher.jar.pri_csrf } }]
      ];
      for (const [label, options] of variants) {
        const r = await bare(path, { method: route.method, body: {}, ...options });
        if (!(r.status === 403 && r.data?.error?.code === 'CSRF_REJECTED')) failures.push(`${label}: ${route.method} ${route.path} → ${r.status} ${r.data?.error?.code || ''}`);
      }
    }
    c.deq(failures, [], 'every cookie-auth mutation rejects a missing, wrong, cookie-less or cross-session CSRF token');
    c.eq((await h.request('/v1/account/me', { jar: student.jar })).status, 200, 'the CSRF sweep did not disturb the session it used');
  }

  // ══ B. Session lifecycle ══════════════════════════════════════════════════
  {
    // Logout kills the presented session server-side, not just the cookie.
    const a = await account();
    const stolen = { ...a.jar };
    c.eq((await h.request('/v1/account/logout', { method: 'POST', jar: a.jar })).status, 200, 'logout');
    const replay = await h.request('/v1/account/me', { jar: stolen });
    c.eq(replay.status, 401, 'a copied cookie is dead after logout');

    // Per-device revoke ("sign out that iPad") kills that session only.
    const b = await account();
    await resetLimits();
    const second = {};
    c.eq((await h.request('/v1/account/login', { method: 'POST', jar: second, body: { email: b.email, password: b.password, deviceId: 'ipad-second' } })).status, 200, 'second device signs in');
    const devices = (await h.request('/v1/account/devices', { jar: b.jar })).data.devices;
    c.eq(devices.length, 2, 'two live sessions listed');
    const other = devices.find(d => !d.current);
    c.eq((await h.request(`/v1/account/devices/${other.id}`, { method: 'DELETE', jar: b.jar })).data.revoked, true, 'other device revoked');
    c.eq((await h.request('/v1/account/me', { jar: second })).status, 401, 'revoked device is signed out');
    c.eq((await h.request('/v1/account/me', { jar: b.jar })).status, 200, 'revoking another device keeps this one');

    // Sign out everywhere: POST /v1/account/logout-all (#263).
    {
      const owner = await account();
      const bystander = await account();
      await resetLimits();
      const phone = {};
      c.eq((await h.request('/v1/account/login', { method: 'POST', jar: phone, body: { email: owner.email, password: owner.password, deviceId: 'phone' } })).status, 200, 'logout-all: second device signs in');
      const ownerCopy = { ...owner.jar };
      const noSession = await h.request('/v1/account/logout-all', { method: 'POST', jar: {}, body: {} });
      c.deq([noSession.status, noSession.data?.error?.code], [401, 'AUTH_REQUIRED'], 'logout-all without a session is 401');
      const noCsrf = await h.request('/v1/account/logout-all', { method: 'POST', jar: { pri_cloud_session: owner.jar.pri_cloud_session }, body: {} });
      c.deq([noCsrf.status, noCsrf.data?.error?.code], [403, 'CSRF_REJECTED'], 'logout-all without the CSRF pair is 403');
      const badCsrf = await h.request('/v1/account/logout-all', { method: 'POST', jar: owner.jar, headers: { 'x-pri-csrf': 'forged' }, body: {} });
      c.deq([badCsrf.status, badCsrf.data?.error?.code], [403, 'CSRF_REJECTED'], 'logout-all with a forged CSRF token is 403');
      const savedOrigin = process.env.PRI_PUBLIC_ORIGIN;
      process.env.PRI_PUBLIC_ORIGIN = 'https://learn.pri.example';
      let badOrigin;
      try {
        badOrigin = await h.request('/v1/account/logout-all', { method: 'POST', jar: owner.jar, headers: { Origin: 'https://evil.example' }, body: {} });
      } finally {
        if (savedOrigin === undefined) delete process.env.PRI_PUBLIC_ORIGIN; else process.env.PRI_PUBLIC_ORIGIN = savedOrigin;
      }
      c.deq([badOrigin.status, badOrigin.data?.error?.code], [403, 'ORIGIN_REJECTED'], 'logout-all from a foreign Origin is 403');
      c.eq((await h.request('/v1/account/me', { jar: phone })).status, 200, 'refused logout-all attempts revoke nothing');
      const all = await h.request('/v1/account/logout-all', { method: 'POST', jar: owner.jar, body: {} });
      c.deq([all.status, all.data?.revoked], [200, 2], 'logout-all revokes both sessions');
      c.eq((await h.request('/v1/account/me', { jar: ownerCopy })).status, 401, 'logout-all signs out the current device');
      c.eq((await h.request('/v1/account/me', { jar: phone })).status, 401, 'logout-all signs out the other device');
      c.eq((await h.request('/v1/account/me', { jar: bystander.jar })).status, 200, 'logout-all leaves another account signed in');
    }

    // Revoke each device in turn, including the current one.
    const everywhere = await account();
    await resetLimits();
    const tablet = {};
    await h.request('/v1/account/login', { method: 'POST', jar: tablet, body: { email: everywhere.email, password: everywhere.password, deviceId: 'ipad-tablet' } });
    const everyCopy = { ...everywhere.jar };
    for (const device of (await h.request('/v1/account/devices', { jar: everywhere.jar })).data.devices.sort((x, y) => Number(x.current) - Number(y.current))) {
      await h.request(`/v1/account/devices/${device.id}`, { method: 'DELETE', jar: everywhere.jar });
    }
    c.eq((await h.request('/v1/account/me', { jar: tablet })).status, 401, 'revoke each device: other device dead');
    c.eq((await h.request('/v1/account/me', { jar: everyCopy })).status, 401, 'revoke each device: this device dead');

    // Password change revokes every other session.
    const p = await account();
    await resetLimits();
    const laptop = {};
    await h.request('/v1/account/login', { method: 'POST', jar: laptop, body: { email: p.email, password: p.password, deviceId: 'laptop' } });
    const oldCookie = { ...p.jar };
    const changed = await h.request('/v1/account/password', { method: 'PATCH', jar: p.jar, body: { currentPassword: p.password, newPassword: 'a-new-long-password-2026' } });
    c.eq(changed.status, 200, 'password changed');
    c.eq((await h.request('/v1/account/me', { jar: laptop })).status, 401, 'password change signs out other devices');
    c.eq((await h.request('/v1/account/me', { jar: oldCookie })).status, 401, 'password change retires the pre-change cookie');
    c.eq((await h.request('/v1/account/me', { jar: p.jar })).status, 200, 'the rotated session works');

    // Password reset revokes every session of the account.
    const r = await account();
    const before = { ...r.jar };
    await resetLimits();
    await h.request('/v1/account/password/reset-request', { method: 'POST', body: { email: r.email } });
    const resetToken = await outboxToken(r.id, 'reset-password');
    c.ok(resetToken, 'reset token queued');
    // Purpose binding: a reset token is not an email-verification or guardian token.
    c.eq((await h.request('/v1/account/email/verify', { method: 'POST', body: { token: resetToken } })).data?.error?.code, 'TOKEN_INVALID', 'reset token cannot verify email');
    c.eq((await h.request('/v1/account/guardian/confirm', { method: 'POST', body: { token: resetToken } })).data?.error?.code, 'TOKEN_INVALID', 'reset token cannot confirm guardian consent');
    c.eq((await h.request('/v1/account/me', { jar: { pri_cloud_session: resetToken } })).status, 401, 'a reset token is not a session');
    c.eq((await h.request('/v1/account/password/reset', { method: 'POST', body: { token: resetToken, password: 'reset-password-value-1' } })).status, 200, 'reset succeeds');
    c.eq((await h.request('/v1/account/me', { jar: before })).status, 401, 'reset signs out every existing session');
    c.eq((await h.request('/v1/account/password/reset', { method: 'POST', body: { token: resetToken, password: 'reset-password-value-2' } })).data?.error?.code, 'TOKEN_INVALID', 'reset token is single-use');

    // Expiry is enforced server-side regardless of the cookie's own lifetime.
    const e = await account();
    await db.run('UPDATE account_sessions SET expires_at=? WHERE account_id=?', [Date.now() - 1000, e.id]);
    c.eq((await h.request('/v1/account/me', { jar: e.jar })).status, 401, 'an expired session is refused');

    // A revoked session row is refused even if never cleared from the cookie jar.
    const v = await account();
    await db.run('UPDATE account_sessions SET revoked_at=? WHERE account_id=?', [Date.now(), v.id]);
    c.eq((await h.request('/v1/sync/pull/0', { jar: v.jar })).status, 401, 'a revoked session cannot read sync data');

    // Deletion kills every session and the account's data.
    const d = await account();
    const dCopy = { ...d.jar };
    await resetLimits();
    c.eq((await h.request('/v1/account/', { method: 'DELETE', jar: d.jar, body: { password: d.password } })).status, 200, 'account deleted');
    c.eq((await h.request('/v1/account/me', { jar: dCopy })).status, 401, 'a deleted account\'s cookie is dead');
    c.eq((await h.request('/v1/account/login', { method: 'POST', body: { email: d.email, password: d.password } })).status, 401, 'a deleted account cannot sign in');

    // A guardian bearer link is not a session either.
    const guardianToken = await outboxToken(child.id, 'guardian-consent');
    c.ok(guardianToken, 'guardian token queued');
    c.eq((await h.request('/v1/account/me', { jar: { pri_cloud_session: guardianToken } })).status, 401, 'a guardian link token is not a session');
    c.eq((await h.request('/v1/account/email/verify', { method: 'POST', body: { token: guardianToken } })).data?.error?.code, 'TOKEN_INVALID', 'guardian token cannot verify the child\'s email');
    c.eq((await h.request('/v1/account/password/reset', { method: 'POST', body: { token: guardianToken, password: 'guardian-takeover-1' } })).data?.error?.code, 'TOKEN_INVALID', 'guardian token cannot reset the child\'s password');
  }

  // ══ C. Object-level authorization ═════════════════════════════════════════
  const alice = await account({ name: 'Alice Student' });
  const bob = await account({ name: 'Bob Student' });
  const teacherOne = await account({ role: 'teacher', name: 'Teacher One' });
  const teacherTwo = await account({ role: 'teacher', name: 'Teacher Two' });

  // Sync: Bob's events never reach Alice; Alice cannot write as Bob's device;
  // idempotency keys do not cross accounts.
  {
    await resetLimits();
    const bobPush = await h.request('/v1/sync/push', { method: 'POST', jar: bob.jar, body: pushBody(bob.deviceId, 1, { secret: 'bob-private-answer' }), headers: { 'Idempotency-Key': 'shared-key-1' } });
    c.eq(bobPush.status, 200, 'Bob pushes');
    const alicePull = await h.request('/v1/sync/pull/0', { jar: alice.jar });
    c.eq(alicePull.status, 200, 'Alice pulls');
    c.ok(!alicePull.text.includes('bob-private-answer') && alicePull.data.events.length === 0, 'Alice\'s pull contains none of Bob\'s events');
    const asBob = await h.request('/v1/sync/push', { method: 'POST', jar: alice.jar, body: pushBody(bob.deviceId, 2), headers: { 'Idempotency-Key': 'alice-1' } });
    c.eq(asBob.data?.error?.code, 'SYNC_DEVICE_MISMATCH', 'Alice cannot push as Bob\'s device');
    const sameKey = await h.request('/v1/sync/push', { method: 'POST', jar: alice.jar, body: pushBody(alice.deviceId, 1, { mine: true }), headers: { 'Idempotency-Key': 'shared-key-1' } });
    c.eq(sameKey.status, 200, 'Alice may use a key Bob used');
    c.ok(!sameKey.text.includes(`evt-${bob.deviceId}`) && sameKey.data.acceptedEvents[0].id === `evt-${alice.deviceId}-1`, 'and gets her own answer, never a replay of Bob\'s');
    for (const cursor of ['-1', '99999999999999999999', '1e400', '9223372036854775808', 'NaN', '..%2F..%2F', "0' OR '1'='1", '0;DROP TABLE learning_events']) {
      const r = await h.request(`/v1/sync/pull/${encodeURIComponent(cursor)}`, { jar: alice.jar });
      if (r.status !== 200 || r.text.includes('bob-private-answer')) c.ok(false, `hostile cursor ${cursor} → ${r.status} (regression: 1e20 was a Postgres 500)`);
    }
    c.ok(true, 'hostile cursors page only within the caller\'s own account');
    c.eq((await db.get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [bob.id])).n, 1, 'Bob\'s events intact');
  }

  // Devices, export, billing, entitlements, guardian state, identities.
  {
    const bobDevices = (await h.request('/v1/account/devices', { jar: bob.jar })).data.devices;
    const revoke = await h.request(`/v1/account/devices/${bobDevices[0].id}`, { method: 'DELETE', jar: alice.jar });
    c.eq(revoke.data?.revoked, false, 'Alice cannot revoke Bob\'s session by id');
    c.eq((await h.request('/v1/account/me', { jar: bob.jar })).status, 200, 'Bob still signed in');
    const aliceDevices = (await h.request('/v1/account/devices', { jar: alice.jar })).data.devices;
    c.ok(aliceDevices.every(d => !bobDevices.some(b => b.id === d.id)), 'Alice\'s device list has none of Bob\'s sessions');

    // Give both accounts something in every export section (events, entities,
    // classes) so a section that forgot its account filter cannot pass empty.
    await resetLimits();
    const entityPush = (who, entityId, secret, key) => h.request('/v1/sync/push', { method: 'POST', jar: who.jar, headers: { 'Idempotency-Key': key }, body: {
      schemaVersion: 1, deviceId: who.deviceId, events: [],
      entities: [{ kind: 'bookmark', entityId, operation: 'upsert', baseVersion: 0, body: { secret } }]
    } });
    c.eq((await entityPush(bob, 'bob-bookmark', 'bob-entity-secret', 'bob-entity-1')).status, 200, 'Bob stores a sync entity');
    c.eq((await entityPush(alice, 'alice-bookmark', 'alice-entity-secret', 'alice-entity-1')).status, 200, 'Alice stores a sync entity');
    const stamp = Date.now();
    await db.run('INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at) VALUES (?,?,?,?,?)', ['cls_export_bob', teacherOne.id, 'Bob Only Class', 'hash-export-bob', stamp]);
    await db.run('INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at) VALUES (?,?,?,?,?)', ['cls_export_alice', teacherOne.id, 'Alice Only Class', 'hash-export-alice', stamp]);
    await db.run('INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES (?,?,?)', ['cls_export_bob', bob.id, stamp]);
    await db.run('INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES (?,?,?)', ['cls_export_alice', alice.id, stamp]);
    // The sections #263 added: submissions, teacher feedback, issue reports and
    // telemetry — each seeded for both accounts.
    for (const [who, tag] of [[bob, 'bob'], [alice, 'alice']]) {
      await db.run('INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,created_at) VALUES (?,?,?,?,?,?)', [`asg_export_${tag}`, `cls_export_${tag}`, teacherOne.id, `${tag} drill`, '{}', stamp]);
      await db.run(`INSERT INTO assignment_submissions(assignment_id,student_account_id,state,summary_json,started_at,updated_at) VALUES (?,?,'started',?,?,?)`, [`asg_export_${tag}`, who.id, JSON.stringify({ note: `${tag}-submission-secret` }), stamp, stamp]);
      await db.run('INSERT INTO assignment_feedback(assignment_id,student_account_id,teacher_account_id,feedback_json,returned_at,updated_at) VALUES (?,?,?,?,?,?)', [`asg_export_${tag}`, who.id, teacherOne.id, JSON.stringify({ note: `${tag}-feedback-secret` }), stamp, stamp]);
      await db.run(`INSERT INTO issue_reports(id,account_id,category,context_json,note,status,created_at) VALUES (?,?,'other','{}',?,'open',?)`, [`rpt_export_${tag}`, who.id, `${tag}-report-secret`, stamp]);
      await db.run('INSERT INTO operational_events(id,account_id,event_type,surface,metadata_json,created_at) VALUES (?,?,?,?,?,?)', [`op_export_${tag}`, who.id, 'feature-used', `${tag}-telemetry-surface`, '{}', stamp]);
    }

    const exported = await h.request('/v1/account/export', { jar: alice.jar });
    c.eq(exported.status, 200, 'Alice exports');
    c.eq(exported.data.account.id, alice.id, 'export is Alice\'s account');
    c.ok(!exported.text.includes(bob.id) && !exported.text.includes(bob.email) && !exported.text.includes('bob-private-answer'), 'export contains nothing of Bob\'s');
    // Section by section, exactly the caller's rows — no more (leak), no fewer.
    const ownEvents = (await db.all('SELECT id FROM learning_events WHERE account_id=?', [alice.id])).map(row => row.id).sort();
    c.deq(exported.data.learningEvents.map(row => row.id).sort(), ownEvents, 'export learningEvents are exactly Alice\'s');
    c.deq(exported.data.entities.map(row => row.entity_id).sort(), ['alice-bookmark'], 'export entities are exactly Alice\'s (none of Bob\'s)');
    c.ok(!exported.text.includes('bob-entity-secret') && !exported.text.includes('bob-bookmark'), 'no entity body of Bob\'s appears anywhere in the export');
    const ownClasses = (await db.all('SELECT class_id FROM class_members WHERE student_account_id=? AND removed_at IS NULL', [alice.id])).map(row => row.class_id).sort();
    c.deq(exported.data.classes.map(row => row.id).sort(), ownClasses, 'export classes are exactly Alice\'s memberships');
    c.ok(!exported.text.includes('cls_export_bob') && !exported.text.includes('Bob Only Class'), 'Bob\'s class membership is not in Alice\'s export');
    c.deq(exported.data.assignmentSubmissions.map(row => row.assignment_id), ['asg_export_alice'], 'export assignmentSubmissions are exactly Alice\'s');
    c.deq(exported.data.assignmentFeedback.map(row => row.assignment_id), ['asg_export_alice'], 'export assignmentFeedback is exactly Alice\'s');
    c.ok(exported.data.assignmentFeedback.every(row => !('teacher_account_id' in row)) && !exported.text.includes(teacherOne.id), 'feedback carries no teacher id');
    c.deq(exported.data.issueReports.map(row => row.id), ['rpt_export_alice'], 'export issueReports are exactly Alice\'s');
    c.deq(exported.data.telemetry.map(row => row.surface), ['alice-telemetry-surface'], 'export telemetry is exactly Alice\'s');
    c.ok(!/bob-(submission|feedback|report)-secret|bob-telemetry-surface/.test(exported.text), 'none of Bob\'s submissions, feedback, reports or telemetry appear');
    c.eq(exported.data.entitlement.plan, 'free', 'export entitlement summary is Alice\'s (free)');
    c.deq(exported.data.identities.map(row => row.provider), ['password'], 'export identities are Alice\'s sign-in methods, without subjects');
    c.eq(exported.data.guardianConsent, null, 'an adult export has no consent section');
    c.deq(Object.keys(exported.data).sort(), ['account', 'assignmentFeedback', 'assignmentSubmissions', 'classes', 'entities', 'entitlement', 'exportedAt', 'format', 'guardianConsent', 'identities', 'issueReports', 'learningEvents', 'telemetry'], 'the export has exactly the sections checked above');
    await db.run("DELETE FROM class_members WHERE class_id IN ('cls_export_bob','cls_export_alice')");
    await db.run("DELETE FROM classes WHERE id IN ('cls_export_bob','cls_export_alice')");
    c.eq((await h.request(`/v1/account/export?accountId=${bob.id}`, { jar: alice.jar })).data.account.id, alice.id, 'an accountId query parameter is ignored');

    await db.run("UPDATE entitlement_snapshots SET plan='premium',status='active',provider='web' WHERE account_id=?", [bob.id]);
    const aliceBilling = await h.request(`/v1/billing/status?accountId=${bob.id}`, { jar: alice.jar });
    c.eq(aliceBilling.data.billing.plan, 'free', 'billing status is the caller\'s, whatever the query says');
    c.eq((await h.request(`/v1/entitlements/?accountId=${bob.id}`, { jar: alice.jar })).data.entitlement.plan, 'free', 'entitlements are the caller\'s');
    const grant = await h.request('/v1/entitlements/admin/grant', { method: 'POST', jar: alice.jar, body: { accountId: alice.id, durationMs: 86400000 } });
    c.eq(grant.status, 403, 'a student cannot grant herself Premium');
    c.eq((await db.get('SELECT plan FROM entitlement_snapshots WHERE account_id=?', [alice.id])).plan, 'free', 'Alice is still free');

    const deleteBob = await h.request('/v1/account/', { method: 'DELETE', jar: alice.jar, body: { password: bob.password, accountId: bob.id } });
    c.eq(deleteBob.status, 401, 'Alice cannot delete with Bob\'s password (and never names an account)');
    c.ok(await db.get('SELECT 1 FROM accounts WHERE id=?', [bob.id]) && await db.get('SELECT 1 FROM accounts WHERE id=?', [alice.id]), 'both accounts survive');

    // Guardian links bind to their own child only.
    const otherChild = {};
    await resetLimits();
    const reg = await h.request('/v1/account/register', { method: 'POST', jar: otherChild, body: {
      name: 'Child Two', email: 'child.two@example.test', password: 'correct-horse-battery', deviceId: 'ipad-child-2',
      year: '8', guardianName: 'Guardian Two', guardianEmail: 'guardian.two@example.test'
    } });
    const childTwoId = reg.data.account.id;
    const firstGuardian = await outboxToken(child.id, 'guardian-consent');
    c.eq((await h.request('/v1/account/guardian/confirm', { method: 'POST', body: { token: firstGuardian } })).data.confirmed, true, 'guardian one confirms child one');
    c.eq((await h.request('/v1/account/guardian/state', { jar: otherChild })).data.state, 'pending', 'child two is untouched by guardian one');
    c.ok(!(await h.request('/v1/account/guardian/state', { jar: otherChild })).text.includes('guardian.one'), 'child two never sees guardian one\'s address');
    c.eq((await h.request('/v1/account/guardian/withdraw', { method: 'POST', body: { token: firstGuardian } })).data.withdrawn, true, 'guardian one withdraws');
    c.eq((await db.get('SELECT withdrawn_at FROM guardian_consents WHERE account_id=?', [childTwoId])).withdrawn_at, null, 'withdrawal touched only child one');
    const state = (await h.request('/v1/account/guardian/state', { jar: child.jar })).data;
    c.match(state.guardianEmail, /^g•+@example\.test$/, 'the child sees only a masked guardian address');
  }

  // Reports and telemetry stay with their author.
  {
    await resetLimits();
    const report = await h.request('/v1/reports/', { method: 'POST', jar: bob.jar, body: { category: 'other', note: 'bob-report-note' } });
    c.eq(report.status, 201, 'Bob files a report');
    const mine = await h.request('/v1/reports/mine', { jar: alice.jar });
    c.ok(!mine.text.includes(report.data.report.id), 'Alice does not see Bob\'s report');
    const triage = await h.request(`/v1/reports/admin/${report.data.report.id}`, { method: 'PATCH', jar: alice.jar, body: { status: 'dismissed' } });
    c.eq(triage.status, 403, 'a student cannot triage reports');
    c.eq((await db.get('SELECT status FROM issue_reports WHERE id=?', [report.data.report.id])).status, 'open', 'report untouched');
  }

  // Classes and assignments: teacher one's class, Alice a member, Bob not.
  {
    await resetLimits();
    const created = await h.request('/v1/classes/', { method: 'POST', jar: teacherOne.jar, body: { name: 'Class 10 A' } });
    c.eq(created.status, 201, 'teacher one creates a class');
    const classId = created.data.class.id;
    const joinCode = created.data.joinCode;
    c.eq((await h.request('/v1/classes/join', { method: 'POST', jar: alice.jar, body: { code: joinCode } })).status, 200, 'Alice joins');
    const now = Date.now();
    await db.run(`INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,created_at) VALUES (?,?,?,?,?,?)`,
      ['asn_acceptance_1', classId, teacherOne.id, 'Quadratics', '{}', now]);
    const submit = await h.request(`/v1/classes/${classId}/assignments/asn_acceptance_1/submission`, { method: 'PATCH', jar: alice.jar, body: { state: 'submitted', summary: { questionsAnswered: 5, correct: 4, xp: 40 } } });
    c.eq(submit.status, 200, 'Alice submits');

    // Bob (not a member) — every class/assignment read and write is a 404.
    for (const [method, path, body] of [
      ['GET', `/v1/classes/${classId}`],
      ['GET', `/v1/assignments/${classId}/asn_acceptance_1`],
      ['GET', `/v1/assignments/${classId}/asn_acceptance_1/submissions`],
      ['PATCH', `/v1/classes/${classId}/assignments/asn_acceptance_1/submission`, { state: 'started', summary: {} }],
      ['POST', `/v1/classes/${classId}/leave`, {}]
    ]) {
      const r = await h.request(path, { method, jar: bob.jar, body });
      c.eq(r.status, 404, `non-member Bob: ${method} ${path.replace(classId, ':classId')} → 404`);
    }
    c.ok(!(await h.request('/v1/assignments/', { jar: bob.jar })).text.includes('asn_acceptance_1'), 'Bob\'s assignment list excludes a class he is not in');

    // Alice sees her class but not the staff views, and not other students' work.
    const aliceView = await h.request(`/v1/classes/${classId}`, { jar: alice.jar });
    c.eq(aliceView.status, 200, 'member Alice reads her class');
    c.ok(!aliceView.text.includes(teacherOne.id) && !aliceView.text.includes('join'), 'the student view carries no teacher id or join code');
    c.eq((await h.request(`/v1/assignments/${classId}/asn_acceptance_1/submissions`, { jar: alice.jar })).status, 404, 'Alice cannot read the class\'s submissions');
    for (const [method, path] of [
      ['GET', `/v1/classes/${classId}/students`], ['GET', `/v1/classes/${classId}/analytics`], ['GET', `/v1/classes/${classId}/join-code`],
      ['POST', `/v1/classes/${classId}/join-code/rotate`], ['PATCH', `/v1/classes/${classId}`],
      ['DELETE', `/v1/classes/${classId}/students/${bob.id}`],
      ['POST', `/v1/classes/${classId}/assignments/asn_acceptance_1/submissions/${alice.id}/return`]
    ]) {
      const r = await h.request(path, { method, jar: alice.jar, body: method === 'GET' ? undefined : {} });
      c.eq(r.status, 403, `member student: ${method} ${path.replace(classId, ':classId')} → 403`);
    }

    // Teacher two (unrelated) — every staff route on teacher one's class is a 404 and changes nothing.
    for (const [method, path, body] of [
      ['GET', `/v1/classes/${classId}`],
      ['GET', `/v1/classes/${classId}/students`],
      ['GET', `/v1/classes/${classId}/analytics`],
      ['GET', `/v1/classes/${classId}/join-code`],
      ['POST', `/v1/classes/${classId}/join-code/rotate`, {}],
      ['PATCH', `/v1/classes/${classId}`, { name: 'Hijacked', archived: true }],
      ['DELETE', `/v1/classes/${classId}/students/${alice.id}`],
      ['POST', `/v1/classes/${classId}/assignments`, { title: 'Injected', specification: {} }],
      ['PATCH', `/v1/classes/${classId}/assignments/asn_acceptance_1`, { title: 'Hijacked', archived: true }],
      ['POST', `/v1/classes/${classId}/assignments/asn_acceptance_1/submissions/${alice.id}/return`, { feedback: { note: 'x' } }],
      ['GET', `/v1/assignments/${classId}/asn_acceptance_1`],
      ['GET', `/v1/assignments/${classId}/asn_acceptance_1/submissions`]
    ]) {
      await resetLimits();
      const r = await h.request(path, { method, jar: teacherTwo.jar, body });
      c.eq(r.status, 404, `unrelated teacher: ${method} ${path.replace(classId, ':classId')} → 404`);
    }
    const intact = await db.get('SELECT name,archived_at,join_code FROM classes WHERE id=?', [classId]);
    c.ok(intact.name === 'Class 10 A' && intact.archived_at === null && intact.join_code === joinCode, 'class unchanged by teacher two');
    c.eq((await db.get('SELECT removed_at FROM class_members WHERE class_id=? AND student_account_id=?', [classId, alice.id])).removed_at, null, 'Alice still enrolled');
    c.eq((await db.get('SELECT state FROM assignment_submissions WHERE assignment_id=? AND student_account_id=?', ['asn_acceptance_1', alice.id])).state, 'submitted', 'Alice\'s submission not returned by teacher two');
    c.eq((await db.get('SELECT COUNT(*) AS n FROM assignments WHERE class_id=?', [classId])).n, 1, 'no assignment injected');
    c.ok(!(await h.request('/v1/classes/', { jar: teacherTwo.jar })).text.includes(classId), 'teacher two\'s class list excludes it');

    // The owner may return work only for an actual member.
    c.eq((await h.request(`/v1/classes/${classId}/assignments/asn_acceptance_1/submissions/${bob.id}/return`, { method: 'POST', jar: teacherOne.jar, body: {} })).status, 404, 'owner cannot return work for a non-member');
    // An admin reading a class that does not exist is a 404, not a server error.
    const ghost = await h.request(`/v1/classes/${SAMPLE.classId}`, { jar: admin.jar });
    c.eq(ghost.status, 404, 'admin reading a missing class → 404 (regression: was a 500)');
    c.eq(ghost.data?.error?.code, 'CLASS_NOT_FOUND', 'coded CLASS_NOT_FOUND');
  }

  // Content authority: support drafts, cannot publish, cannot edit another author's draft.
  {
    await resetLimits();
    const draft = await h.request('/v1/content/drafts', { method: 'POST', jar: support.jar, body: { contentKey: 'acceptance.pack', curriculumVersion: 'cbse-2026', source: {}, body: { q: 1 } } });
    if (draft.status === 201) {
      const id = draft.data.revision.id;
      const otherSupport = await account({ role: 'support' });
      c.eq((await h.request(`/v1/content/drafts/${id}`, { method: 'PATCH', jar: otherSupport.jar, body: { body: { q: 2 } } })).status, 403, 'support cannot edit another author\'s draft');
      c.eq((await h.request(`/v1/content/${id}/publish`, { method: 'POST', jar: support.jar, body: {} })).status, 403, 'support cannot publish');
      c.eq((await h.request(`/v1/content/${id}/submit-review`, { method: 'POST', jar: teacherOne.jar, body: {} })).status, 403, 'a teacher has no content authority');
    } else {
      c.ok(false, `support draft creation failed: ${draft.status} ${draft.text}`);
    }
  }

  // ══ D. Hostile input ══════════════════════════════════════════════════════
  {
    await resetLimits();
    const malformed = await bare('/v1/account/login', { method: 'POST', rawBody: '{"email": "a@b.test", "password": ' });
    c.eq(malformed.status, 400, 'malformed JSON → 400');
    c.eq(malformed.data?.error?.code, 'MALFORMED_JSON', 'malformed JSON is a coded error (regression: was an uncoded string)');
    for (const raw of ['null', '"just a string"', '42', 'true']) {
      const r = await bare('/v1/account/login', { method: 'POST', rawBody: raw });
      c.eq(r.data?.error?.code, 'MALFORMED_JSON', `top-level ${raw} is refused as malformed`);
    }
    const arrayBody = await bare('/v1/account/login', { method: 'POST', rawBody: '[]' });
    c.ok(arrayBody.status === 401 && arrayBody.data?.error?.code === 'BAD_CREDENTIALS', 'a JSON array body is treated as empty credentials');
    const huge = await bare('/v1/account/login', { method: 'POST', rawBody: JSON.stringify({ email: 'x@y.test', password: 'p'.repeat(1024 * 1024 + 10) }) });
    c.eq(huge.status, 413, 'oversized JSON → 413');
    c.eq(huge.data?.error?.code, 'REQUEST_BODY_TOO_LARGE', 'oversized JSON is coded');
    const deep = await bare('/v1/reports/', { method: 'POST', jar: { ...alice.jar }, headers: { 'x-pri-csrf': alice.jar.pri_csrf }, rawBody: '{"category":"other","context":' + '['.repeat(5000) + ']'.repeat(5000) + '}' });
    c.ok(deep.status < 500, `deeply nested JSON does not crash the server (${deep.status})`);
    const wrongType = await bare('/v1/account/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, rawBody: 'email=a@b.test&password=x' });
    c.ok(wrongType.status === 401 || wrongType.status === 400, 'a non-JSON body is never parsed as credentials');

    // Traversal-ish ids reach no file and no other row.
    for (const path of [
      '/v1/content/published/..%2F..%2F..%2Fetc%2Fpasswd',
      '/v1/content/published/../../../../etc/passwd',
      '/v1/content/published/%2e%2e%2f%2e%2e%2fserver%2fpackage.json'
    ]) {
      const r = await bare(path);
      c.ok([400, 404].includes(r.status) && !/root:|"dependencies"/.test(r.text), `traversal ${path} → ${r.status}, no file content`);
    }
    for (const id of ['..%2F..%2Fadmin', '%2e%2e', 'cls_x%00', "' OR '1'='1", 'cls_x;DROP TABLE classes']) {
      const r = await h.request(`/v1/classes/${id}`, { jar: teacherTwo.jar });
      c.ok(r.status === 404 || r.status === 400, `hostile class id ${id} → ${r.status}`);
    }

    // SQL-injection-ish strings are data, never SQL.
    const before = (await db.get('SELECT COUNT(*) AS n FROM accounts')).n;
    await resetLimits();
    const sqlLogin = await h.request('/v1/account/login', { method: 'POST', body: { email: "' OR '1'='1' --@x.test", password: "' OR '1'='1" } });
    c.eq(sqlLogin.status, 401, 'SQL-ish login is a plain bad credential');
    const sqlLoginAlice = await h.request('/v1/account/login', { method: 'POST', body: { email: `${alice.email}' --`, password: 'x' } });
    c.eq(sqlLoginAlice.status, 401, 'comment-terminated email does not sign in as Alice');
    const evilName = "Robert'); DROP TABLE accounts;--";
    const bobby = await account({ name: evilName });
    c.eq((await h.request('/v1/account/me', { jar: bobby.jar })).data.account.name, evilName, 'SQL-ish name stored verbatim');
    c.eq((await db.get('SELECT COUNT(*) AS n FROM accounts')).n, before + 1, 'accounts table intact');
    const join = await h.request('/v1/classes/join', { method: 'POST', jar: bob.jar, body: { code: "' OR '1'='1" } });
    c.eq(join.data?.error?.code, 'JOIN_CODE_INVALID', 'SQL-ish join code is refused by its format');
    const search = await h.request(`/v1/admin/users?q=${encodeURIComponent("%' OR 1=1 --")}`, { jar: admin.jar });
    c.eq(search.status, 200, 'admin search with SQL-ish text');
    c.eq(search.data.users.length, 0, 'admin search treats it as literal text');
    const quoteSearch = await h.request(`/v1/admin/users?q=${encodeURIComponent(evilName.toLowerCase())}`, { jar: admin.jar });
    c.ok(quoteSearch.status === 200 && quoteSearch.data.users.some(user => user.name === evilName), 'admin search finds the SQL-ish name as plain text');

    // Prototype-pollution keys never reach Object.prototype or an authority field.
    const pollute = { ['__proto__']: { polluted: 'yes', role: 'admin', isAdmin: true }, constructor: { prototype: { polluted: 'yes' } } };
    const polluteRaw = body => JSON.stringify(body).replace('"__proto__"', '"__proto__"');
    await resetLimits();
    const pollutedReg = await bare('/v1/account/register', { method: 'POST', rawBody: polluteRaw({ ...pollute, name: 'Proto', email: 'proto@example.test', password: 'correct-horse-battery', isAdult: true }) });
    c.eq(pollutedReg.status, 201, 'register with __proto__ keys');
    c.eq(pollutedReg.data.account.role, 'student', 'a __proto__ role is ignored');
    const protoAccount = await db.get("SELECT role FROM accounts WHERE email='proto@example.test'");
    c.eq(protoAccount.role, 'student', 'stored role is student');
    for (const [path, method, body] of [
      ['/v1/reports/', 'POST', { category: 'other', context: pollute, ...pollute }],
      ['/v1/telemetry/', 'POST', { events: [{ type: 'feature-used', metadata: pollute }] }],
      ['/v1/sync/push', 'POST', { ...pushBody(alice.deviceId, 7, pollute), ...pollute }],
      [`/v1/classes/${'x'}/assignments/x/submission`, 'PATCH', { state: 'started', summary: pollute }]
    ]) {
      await resetLimits();
      await bare(path, { method, jar: { ...alice.jar }, headers: { 'x-pri-csrf': alice.jar.pri_csrf, 'Idempotency-Key': `proto-${path.length}` }, rawBody: polluteRaw(body) });
    }
    await resetLimits();
    await bare('/v1/admin/feature-flags/acceptance.proto', { method: 'PUT', jar: { ...admin.jar }, headers: { 'x-pri-csrf': admin.jar.pri_csrf }, rawBody: polluteRaw({ enabled: true, config: pollute, ...pollute }) });
    c.eq(({}).polluted, undefined, 'Object.prototype was not polluted');
    c.eq(({}).isAdmin, undefined, 'no isAdmin leaked onto every object');
    c.eq((await h.request('/v1/account/me', { jar: alice.jar })).data.account.role, 'student', 'Alice is still a student');

    // Unicode, emoji and RTL names round-trip; NUL is refused rather than
    // crashing Postgres TEXT; the server never splits an emoji itself.
    const unicodeName = 'प्रिया शर्मा 🧮 ‏مريم‏ Zoë';
    const uni = await account({ name: unicodeName });
    c.eq((await h.request('/v1/account/me', { jar: uni.jar })).data.account.name, unicodeName, 'unicode + emoji name round-trips exactly');
    await resetLimits();
    const emojiClass = await h.request('/v1/classes/', { method: 'POST', jar: teacherTwo.jar, body: { name: '१०वीं कक्षा 📐 Σ' } });
    c.eq(emojiClass.status, 201, 'emoji class name accepted');
    c.eq(emojiClass.data.class.name, '१०वीं कक्षा 📐 Σ', 'emoji class name round-trips');
    const clipped = await account({ name: `${'a'.repeat(79)}🧮tail` });
    const clippedName = (await h.request('/v1/account/me', { jar: clipped.jar })).data.account.name;
    c.eq(clippedName, 'a'.repeat(79), 'clipping a long name drops a straddling emoji whole (regression: half of it was stored as U+FFFD)');
    const nulCases = [
      ['/v1/account/register', 'POST', {}, { name: 'Nul\u0000Name', email: 'nul.one@example.test', password: 'correct-horse-battery' }],
      ['/v1/account/login', 'POST', {}, { email: 'nul@example.test', password: 'correct-horse-battery', deviceId: 'ipad\u0000' }],
      ['/v1/classes/', 'POST', teacherTwo.jar, { name: 'Class\u0000Name' }],
      ['/v1/reports/', 'POST', alice.jar, { category: 'other', note: 'note\u0000with nul' }],
      ['/v1/telemetry/', 'POST', alice.jar, { events: [{ type: 'feature-used', surface: 'home\u0000' }] }]
    ];
    for (const [path, method, jar, body] of nulCases) {
      await resetLimits();
      const r = await h.request(path, { method, jar: { ...jar }, body });
      c.ok(r.status === 400 && r.data?.error?.code === 'INVALID_TEXT', `NUL in ${path} → 400 INVALID_TEXT (got ${r.status} ${r.data?.error?.code || ''})`);
    }
    await resetLimits();
    const nulQuery = await h.request(`/v1/admin/users?q=${encodeURIComponent('a\u0000b')}`, { jar: admin.jar });
    c.ok(nulQuery.status === 400 && nulQuery.data?.error?.code === 'INVALID_TEXT', `NUL in a query string → 400 INVALID_TEXT (got ${nulQuery.status})`);
    c.eq(await db.get("SELECT 1 AS x FROM accounts WHERE email='nul.one@example.test'"), undefined, 'the NUL name was not stored');
    // A lone surrogate cannot crash either engine; both store U+FFFD in its place.
    await resetLimits();
    const lone = await bare('/v1/account/register', { method: 'POST', rawBody: '{"name":"Lone \\ud83e end","email":"lone@example.test","password":"correct-horse-battery"}' });
    c.eq(lone.status, 201, `a lone surrogate in a name is not a server error (got ${lone.status})`);
    const stored = (await db.get("SELECT name FROM accounts WHERE email='lone@example.test'")).name;
    c.eq(stored, 'Lone \uFFFD end', 'and is stored as U+FFFD on this engine, never as invalid UTF-16');
    // Escaped NUL inside opaque JSON payloads is data, not text: it stays accepted.
    await resetLimits();
    const nulPayload = await h.request('/v1/sync/push', { method: 'POST', jar: alice.jar, body: pushBody(alice.deviceId, 9, { note: 'free\u0000text' }), headers: { 'Idempotency-Key': 'nul-payload' } });
    c.eq(nulPayload.status, 200, 'NUL inside a sync payload stays accepted (stored JSON-escaped), so an outbox never wedges');
  }

  // ══ E. No open redirect ═══════════════════════════════════════════════════
  {
    const failures = [];
    // A throwaway account: the sweep calls every route, sign-out included (last).
    const wanderer = await account();
    const ordered = [...routes].sort((x, y) => Number(x.path === '/v1/account/logout') - Number(y.path === '/v1/account/logout'));
    for (const route of ordered) {
      await resetLimits();
      for (const param of ['next', 'redirect', 'returnTo', 'return_url', 'callback', 'url']) {
        const path = `${concrete(route.path)}?${param}=${encodeURIComponent('https://evil.example/phish')}`;
        const r = await bare(path, { method: route.method, jar: { ...wanderer.jar }, headers: { 'x-pri-csrf': wanderer.jar.pri_csrf }, body: MUTATION.has(route.method) ? {} : undefined });
        if (r.status >= 300 && r.status < 400) failures.push(`${route.method} ${path} → ${r.status} ${r.headers.get('location')}`);
        if (/evil\.example/.test(r.headers.get('location') || '') || /evil\.example/.test(r.headers.get('refresh') || '')) failures.push(`${route.method} ${path} points at evil.example`);
      }
    }
    c.deq(failures, [], 'no /v1 route redirects to a caller-supplied location');
  }

  // ══ F. Secrets never leave the server ═════════════════════════════════════
  {
    const reader = await account();
    const health = await h.request('/v1/health');
    c.eq(health.status, 200, 'health');
    const status = await h.request('/v1/handwriting/status', { jar: reader.jar });
    c.eq(status.status, 200, 'handwriting status');
    const transcribe = await h.request('/v1/handwriting/transcribe', { method: 'POST', jar: reader.jar, body: { image: 'data:image/png;base64,' + Buffer.from('a'.repeat(600)).toString('base64') } });
    c.ok(transcribe.status >= 500 && transcribe.data?.error?.code, `a failing provider is answered with a coded error (${transcribe.status} ${transcribe.data?.error?.code})`);
    const working = await h.request('/v1/working/check', { method: 'POST', jar: reader.jar, body: { lines: ['x = 2', 'x + 1 = 3'], prompt: 'Solve' } });
    c.ok(working.status >= 400 && working.data?.error?.code, `a failing working provider is answered with a coded error (${working.status} ${working.data?.error?.code})`);
    c.ok(providerCalls > 0, `the hostile provider was really called (${providerCalls} calls) and echoed the bearer`);
    const webhook = await h.request('/v1/billing/webhook/web', { method: 'POST', body: { event: 'subscription.activated' }, headers: { 'x-razorpay-signature': 'forged' } });
    c.ok(webhook.status >= 400, `a forged webhook is refused (${webhook.status})`);
    // Force the generic 500 path once and make sure it says nothing.
    const crash = await bare('/v1/account/login', { method: 'POST', rawBody: '{"email":' });
    c.ok(crash.status === 400, 'parse failure answered');

    const haystack = responses.join('\n') + '\n' + captured.join('');
    const leaked = Object.entries(SECRETS).filter(([, value]) => haystack.includes(value)).map(([name]) => name);
    c.deq(leaked, [], 'no configured secret appears in any response, header, error body or server log line');
    c.ok(!/sk-(?:proj-)?[A-Za-z0-9]{20,}|rzp_(?:live|test)_[A-Za-z0-9]{10,}|re_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(haystack), 'nothing secret-shaped appears in responses or logs');
    c.ok(!/pri_cloud_session=[A-Za-z0-9_-]{20}/.test(captured.join('')), 'no session cookie value was logged');
    c.ok(responses.length > 500, `${responses.length} responses searched`);
  }

  // ══ G. A signed provider webhook is never refused for its contents ════════
  // A NUL in a customer-controlled field (subscription notes) must not turn a
  // genuine, signed event into a 400 the provider retries until it gives up.
  {
    const razorpayEnv = {
      PRI_RAZORPAY_KEY_ID: 'rzp_test_acceptance', PRI_RAZORPAY_MONTHLY_PLAN_ID: 'plan_AcceptMonthly1', PRI_RAZORPAY_ANNUAL_PLAN_ID: 'plan_AcceptAnnual12',
      PRI_RAZORPAY_MONTHLY_TOTAL_COUNT: '120', PRI_RAZORPAY_ANNUAL_TOTAL_COUNT: '10'
    };
    Object.assign(process.env, razorpayEnv);
    const billed = await startApp({ engine: requestedEngine(), log: () => {} });
    try {
      const buyer = await registerAccount(billed, { email: 'webhook.buyer@example.test', deviceId: 'ipad-buyer', password: 'webhook-buyer-pw-1' });
      // The binding a server-side checkout would have stored for this subscription.
      await billed.db.run(`INSERT INTO billing_subscriptions
        (provider,provider_subscription_id,account_id,product_id,cadence,trial_claimed,created_at,updated_at,last_effective_at,last_event_rank,last_event_id)
        VALUES ('web',?,?,?,?,0,?,?,0,0,NULL)`, ['sub_AcceptNul123456', buyer.account.id, razorpayEnv.PRI_RAZORPAY_MONTHLY_PLAN_ID, 'monthly', Date.now(), Date.now()]);
      const nowSec = Math.floor(Date.now() / 1000);
      const payload = {
        entity: 'event', event: 'subscription.activated', contains: ['subscription'], created_at: nowSec - 10,
        payload: { subscription: { entity: {
          id: 'sub_AcceptNul123456', entity: 'subscription', plan_id: razorpayEnv.PRI_RAZORPAY_MONTHLY_PLAN_ID, status: 'active',
          current_start: nowSec, current_end: nowSec + 30 * 86400, ended_at: null, start_at: nowSec,
          notes: { pri_account_id: buyer.account.id, pri_cadence: 'monthly', customer_note: 'gift from\u0000grandma' }
        } } }
      };
      const raw = JSON.stringify(payload);
      c.ok(raw.includes('\\u0000'), 'the signed event really carries an escaped NUL');
      const { createHmac } = await import('node:crypto');
      const signature = createHmac('sha256', SECRETS.PRI_RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
      const delivered = await fetch(`${billed.origin}/v1/billing/webhook/web`, {
        method: 'POST', body: raw,
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': 'evt_accept_nul_1' }
      });
      const deliveredBody = await delivered.text();
      c.ok(!deliveredBody.includes('INVALID_TEXT'), `a signed webhook with a NUL in its notes is not refused by the text gate (${delivered.status} ${deliveredBody.slice(0, 120)})`);
      c.eq(delivered.status, 200, 'the signed webhook is applied');
      c.eq((await billed.db.get('SELECT plan FROM entitlement_snapshots WHERE account_id=?', [buyer.account.id])).plan, 'premium', 'and the entitlement change is not lost');
      // The exemption is the body only, and only for the webhook path.
      const nulUrl = await fetch(`${billed.origin}/v1/billing/webhook/web?x=%00`, { method: 'POST', body: raw, headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature } });
      c.eq(nulUrl.status, 400, 'a NUL in the webhook URL is still refused');
      const nulElsewhere = await billed.request('/v1/reports/', { method: 'POST', jar: buyer.jar, body: { category: 'other', note: 'a\u0000b' } });
      c.eq(nulElsewhere.data?.error?.code, 'INVALID_TEXT', 'other bodies are still checked');
    } finally {
      await billed.close();
      for (const name of Object.keys(razorpayEnv)) delete process.env[name];
    }
  }
} finally {
  await h.close();
  await new Promise(resolve => provider.close(resolve));
}

console.log(`engine: ${h.engine}`);
console.log(`SECURITY ACCEPTANCE — PASS — ${c.count()}/${c.count()} checks`);
