// Issue #622: a guardian's confirmation is bound to the notice they were
// shown. A confirmation of a stale notice is refused without spending the
// link; a confirmation given under a materially older notice no longer opens
// the account; and the version check and the write are one statement, so no
// race or rolled-back transaction can leave a confirmation the guardian did
// not give to the current notice.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';

process.env.PRI_AUTH_DELIVERY_KEY = '11'.repeat(32);

const [
  { default: express },
  { default: cookieParser },
  { openTestStore },
  { createAccountRouter },
  { decryptDeliveryToken },
  { ACCEPTED_CONSENT_NOTICE_VERSIONS, CONSENT_NOTICE_VERSION, confirmConsent, consentState, recordConsentRequest, requireGuardianConsent, withdrawConsent },
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
  const testStore = await openTestStore(undefined, { label: 'guardian_notice_version' });
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
  // This file registers more children than one address may in an hour; the
  // sign-up limit is not what it tests (rate-limit tests cover it).
  await db.run('DELETE FROM rate_limits');
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
const accept = (token, noticeVersion = CONSENT_NOTICE_VERSION) => ({ token, approve: true, noticeVersion });
const confirm = (body) => request(origin, '/account/guardian/confirm', { method: 'POST', body });
const row = (id) => db.get('SELECT confirmed_at, withdrawn_at, notice_version FROM guardian_consents WHERE account_id=?', [id]);

try {
  assert.ok(ACCEPTED_CONSENT_NOTICE_VERSIONS.includes(CONSENT_NOTICE_VERSION), 'the current notice is always accepted');
  assert.ok(!ACCEPTED_CONSENT_NOTICE_VERSIONS.includes('2026-10-02'), 'the notice before online marking and OpenAI reading needs renewal');

  // The emailed link must say which notice it accepts, and only the current one.
  const a = await registerChild(origin, 'notice-a@example.test', 'notice-ga@example.test');
  const aBearer = await guardianBearer(db, a.accountId);
  for (const [body, why] of [
    [{ token: aBearer }, 'no notice at all (an older page)'],
    [{ token: aBearer, noticeVersion: CONSENT_NOTICE_VERSION }, 'a version without approve:true'],
    [accept(aBearer, '2026-10-19'), 'the previous notice'],
    [accept(aBearer, '2099-01-01'), 'a notice this server never showed']
  ]) {
    const refused = await confirm(body);
    assert.equal(refused.status, 400, why);
    assert.equal(refused.data.error.code, 'GUARDIAN_NOTICE_REQUIRED', why);
  }
  assert.equal((await row(a.accountId)).confirmed_at, null, 'a refused notice confirms nothing');
  assert.ok(await db.get("SELECT 1 FROM account_tokens WHERE account_id=? AND purpose='guardian-consent' AND consumed_at IS NULL", [a.accountId]),
    'and does not spend the link: reloading the page still works');
  assert.deepEqual((await confirm(accept(aBearer))).data, { ok: true, confirmed: true }, 'the current notice confirms');
  assert.equal((await row(a.accountId)).notice_version, CONSENT_NOTICE_VERSION, 'and records the version agreed to');
  assert.equal((await request(origin, '/protected', { jar: a.jar })).status, 200);

  // A pending row requested under an older notice is confirmed against the
  // notice the guardian actually reads now, and records that one.
  const b = await registerChild(origin, 'notice-b@example.test', 'notice-gb@example.test');
  const bBearer = await guardianBearer(db, b.accountId);
  await db.run('UPDATE guardian_consents SET notice_version=? WHERE account_id=?', ['2026-10-02', b.accountId]);
  assert.equal((await confirm(accept(bBearer))).data.confirmed, true);
  assert.equal((await row(b.accountId)).notice_version, CONSENT_NOTICE_VERSION);

  // Legacy rows. Confirmed under an accepted older version: still given, and
  // the row is not rewritten. Confirmed under a materially older version:
  // fail closed as pending, with renewal flagged, and the history kept.
  const c = await registerChild(origin, 'notice-c@example.test', 'notice-gc@example.test');
  await db.run('UPDATE guardian_consents SET confirmed_at=?, notice_version=? WHERE account_id=?', [Date.now(), '2026-10-19', c.accountId]);
  assert.equal((await consentState(db, c.accountId)).state, 'given', 'a 2026-10-19 confirmation stands');
  assert.equal((await row(c.accountId)).notice_version, '2026-10-19', 'and is not silently relabelled');
  const d = await registerChild(origin, 'notice-d@example.test', 'notice-gd@example.test');
  const dConfirmedAt = Date.now() - 1000;
  await db.run('UPDATE guardian_consents SET confirmed_at=?, notice_version=? WHERE account_id=?', [dConfirmedAt, '2026-10-02', d.accountId]);
  const dState = await consentState(db, d.accountId);
  assert.equal(dState.state, 'pending', 'a 2026-10-02 confirmation no longer opens the account');
  assert.equal(dState.renewal, true);
  assert.equal((await request(origin, '/protected', { jar: d.jar })).data.error.code, 'GUARDIAN_CONSENT_PENDING');
  const dView = (await request(origin, '/account/guardian/state', { jar: d.jar })).data;
  assert.equal(dView.state, 'pending');
  assert.equal(dView.renewalRequired, true);
  assert.equal(dView.eligible, false);
  assert.equal(dView.noticeVersion, '2026-10-02', 'the state shows the version that was agreed');
  assert.deepEqual(await row(d.accountId), { confirmed_at: dConfirmedAt, withdrawn_at: null, notice_version: '2026-10-02' },
    'reading the state rewrites nothing');
  // Renewal is the ordinary ceremony: a new request, then the current notice.
  await recordConsentRequest(db, { accountId: d.accountId, name: 'Guardian Example', email: 'notice-gd@example.test', tokenHash: 'x' });
  assert.equal(await confirmConsent(db, d.accountId, '2026-10-02'), false, 'renewal cannot be confirmed against the stale notice');
  assert.equal(await confirmConsent(db, d.accountId, CONSENT_NOTICE_VERSION), true, 'renewal confirms against the current one');
  assert.equal((await consentState(db, d.accountId)).state, 'given');
  // Withdrawal still wins over a stale confirmation.
  const e = await registerChild(origin, 'notice-e@example.test', 'notice-ge@example.test');
  await db.run('UPDATE guardian_consents SET confirmed_at=?, notice_version=? WHERE account_id=?', [Date.now(), '2026-10-02', e.accountId]);
  assert.equal(await withdrawConsent(db, e.accountId), true);
  assert.equal((await consentState(db, e.accountId)).state, 'withdrawn');
  assert.equal(await confirmConsent(db, e.accountId, CONSENT_NOTICE_VERSION), false, 'and nothing confirms a withdrawn ceremony');

  // Races. The same link replayed in parallel confirms exactly once and
  // queues exactly one withdrawal credential.
  const f = await registerChild(origin, 'notice-f@example.test', 'notice-gf@example.test');
  const fBearer = await guardianBearer(db, f.accountId);
  const replays = await Promise.all(Array.from({ length: 8 }, () => confirm(accept(fBearer))));
  assert.equal(replays.filter(r => r.status === 200 && r.data.confirmed === true).length, 1, 'one replay wins');
  assert.ok(replays.every(r => (r.status === 200 && r.data.confirmed === true) || (r.status === 400 && r.data.error.code === 'TOKEN_INVALID')),
    'every other replay is refused as a spent link');
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM account_tokens WHERE account_id=? AND purpose='guardian-withdraw' AND consumed_at IS NULL", [f.accountId])).n, 1);

  // Confirm racing withdraw: whichever order they land in, a withdrawal is
  // never undone and the account is never left open with withdrawn_at set.
  for (let round = 0; round < 6; round += 1) {
    const g = await registerChild(origin, `notice-g${round}@example.test`, `notice-gg${round}@example.test`);
    const gBearer = await guardianBearer(db, g.accountId);
    const calls = [confirm(accept(gBearer)), request(origin, '/account/guardian/withdraw', { method: 'POST', body: { token: gBearer } })];
    if (round % 2) calls.reverse();
    await Promise.all(calls);
    const after = await row(g.accountId);
    assert.ok(after.withdrawn_at, 'the withdrawal always lands');
    assert.equal((await consentState(db, g.accountId)).state, 'withdrawn');
    assert.equal((await request(origin, '/protected', { jar: g.jar })).data.error.code, 'GUARDIAN_CONSENT_WITHDRAWN');
  }

  // Confirm racing a re-request: the re-request resets the ceremony; a
  // confirmation either lands before it (and is reset) or after it (against
  // the current notice). Never a confirmation stamped with another version.
  for (let round = 0; round < 6; round += 1) {
    const h = await registerChild(origin, `notice-h${round}@example.test`, `notice-gh${round}@example.test`);
    const results = await Promise.all([
      confirmConsent(db, h.accountId, CONSENT_NOTICE_VERSION),
      recordConsentRequest(db, { accountId: h.accountId, name: 'Guardian Example', email: `notice-gh${round}@example.test`, tokenHash: 'y' })
    ]);
    const after = await row(h.accountId);
    assert.equal(after.notice_version, CONSENT_NOTICE_VERSION);
    if (after.confirmed_at) assert.equal(results[0], true, 'a confirmed row was confirmed by this call');
  }

  // Rollback: a confirmation inside a transaction that fails afterwards leaves
  // the row exactly as it was, link unspent, nothing granted.
  const r = await registerChild(origin, 'notice-r@example.test', 'notice-gr@example.test');
  const before = await row(r.accountId);
  await assert.rejects(db.transaction(async () => {
    assert.equal(await confirmConsent(db, r.accountId, CONSENT_NOTICE_VERSION), true);
    throw new Error('simulated failure after the confirmation write');
  }), /simulated failure/);
  assert.deepEqual(await row(r.accountId), before, 'the confirmation rolled back');
  assert.equal((await consentState(db, r.accountId)).state, 'pending');
  assert.equal((await request(origin, '/protected', { jar: r.jar })).status, 403);
  const rBearer = await guardianBearer(db, r.accountId);
  await db.run('DELETE FROM rate_limits');
  assert.equal((await confirm(accept(rBearer))).data.confirmed, true, 'and the guardian can still confirm afterwards');

  console.log(`engine: ${testStore.engine}`);
  console.log('PASS — guardian confirmation is bound to the current notice, stale confirmations need renewal, and races and rollbacks never grant what was not given.');
} finally {
  await new Promise(resolve => server.close(resolve));
  await testStore.close();
}
