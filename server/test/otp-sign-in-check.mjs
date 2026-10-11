// Pri Learning · the one sign-in card's server contract.
//
// The card (client/src/components/SignUpFlow.jsx) signs NEW and RETURNING
// students in with an emailed six-digit code. This suite drives the production
// middleware chain (server/app.js -> /v1) with the email and SMS TEST adapters
// — which send nothing and keep each code in memory — and holds the server to
// what the card relies on:
//
//   · an existing account (verified or not, with or without a password) signs
//     in with a code; nothing is created; the answer to "send a code" has the
//     same shape and status whether or not the address has an account;
//   · a code is right once: wrong codes count down and burn it, an expired or
//     spent or superseded code is refused, two simultaneous correct submits
//     make one session;
//   · the limits the card's messages name (30 s between sends, 5 an hour per
//     mailbox) are enforced, and a delivery outage is a 503 that leaves no
//     guessable challenge behind;
//   · a child's account is created limited and stays limited until a guardian
//     approves through their own channel;
//   · the session cookie is HttpOnly, SameSite=Lax, bounded, renewed by use,
//     and ended by sign-out, sign-out-everywhere and deletion;
//   · the code email is recognisably Pri Learning, states the expiry, says
//     what to do if it was not asked for, carries NO link for a sign-in code,
//     and a guardian's link can only ever point at this deployment's own
//     configured origin.
//
// Nothing here is evidence that a real provider delivered a real message.

process.env.PRI_AUTH_DELIVERY_KEY = '55'.repeat(32);
process.env.PRI_SMS_PROVIDER = 'test';
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
process.env.PRI_PUBLIC_ORIGIN = 'http://localhost:5173';

const express = (await import('express')).default;
const { startApp, checks, pendingVerificationToken } = await import('./support/app-harness.mjs');
const { readTestOutbox, clearTestOutbox } = await import('../platform/smsProvider.js');
const { OTP_MAX_ATTEMPTS, OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } = await import('../platform/otpCore.js');
const { OTP_DESTINATION_LIMIT, createOtpRouter } = await import('../platform/otp.js');
const { otpEmailMessage, otpEmailConsentLink } = await import('../platform/otpEmail.js');
const { createPlatformDb } = await import('../platform/db.js');

const c = checks();
const h = await startApp();
const raw = h.db;
const ORIGIN = { Origin: 'http://localhost:5173' };
const resetLimits = () => raw.prepare('DELETE FROM rate_limits').run();
const clearCooldown = () => raw.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'otp-cooldown%'").run();
const lastMail = to => readTestOutbox({ to, channel: 'email' }).at(-1);
const post = (path, body, jar = {}) => h.request(`/v1/account/otp${path}`, { method: 'POST', body, jar, headers: ORIGIN });
const login = (body, jar = {}) => h.request('/v1/account/login', { method: 'POST', body, jar, headers: ORIGIN });
const accounts = () => Number(raw.prepare('SELECT COUNT(*) AS n FROM accounts').get().n);
const liveSessions = id => Number(raw.prepare('SELECT COUNT(*) AS n FROM account_sessions WHERE account_id=? AND revoked_at IS NULL AND expires_at>?').get(id, Date.now()).n);
const wrongOf = code => (code === '000000' ? '111111' : '000000');
const PASSWORD = 'a-long-unusual-passphrase-93';
const setCookies = r => (typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : []);

// This suite configures a public origin, so every state-changing request
// carries it, as the shipped client's would.
async function registerAccount(harness, { name, email, password, deviceId }) {
  const jar = {};
  const response = await harness.request('/v1/account/register', { method: 'POST', jar, body: { name, email, password, deviceId, isAdult: true }, headers: ORIGIN });
  return { ...response, jar, account: response.data?.account || null };
}
async function verifyEmail(harness, accountId) {
  const token = await pendingVerificationToken(harness.db, accountId);
  return harness.request('/v1/account/email/verify', { method: 'POST', body: { token }, headers: ORIGIN });
}

/**
 * Ask for a code at the test's desk. The send limits are this suite's subject
 * in their own section (which calls /request directly); everywhere else they
 * are cleared first, and a refused send fails loudly rather than leaving a
 * later assertion to pass for the wrong reason.
 */
async function ask(email, jar = {}) {
  raw.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'otp-%'").run();
  const r = await post('/request', { channel: 'email', destination: email }, jar);
  if (r.status !== 202) throw new Error(`otp-sign-in-check: the desk could not get a code (${r.status} ${r.text})`);
  return { r, challengeId: r.data.challengeId, code: lastMail(email.toLowerCase()).code };
}

try {
  // ── what the deployment can send ─────────────────────────────────────────
  let r = await h.request('/v1/account/otp/channels');
  c.eq(r.status, 200, 'GET /otp/channels answers without a session');
  c.deq(r.data, { channels: { email: true, sms: true } }, 'with both test adapters mounted it reports email and sms');
  c.eq(r.headers.get('cache-control'), 'no-store', 'and is never cached');
  {
    // The same router with no sender at all: it says so, and asking for a code is a 503.
    const bare = express();
    bare.use(express.json());
    const bareDb = createPlatformDb(':memory:');
    bare.use('/otp', createOtpRouter(bareDb, { smsProvider: null, emailSender: null, env: {} }));
    const listener = await new Promise(resolve => { const l = bare.listen(0, '127.0.0.1', () => resolve(l)); });
    const base = `http://127.0.0.1:${listener.address().port}`;
    const channels = await (await fetch(`${base}/otp/channels`)).json();
    c.deq(channels, { channels: { email: false, sms: false } }, 'a deployment with no sender reports neither channel — the card hides what it cannot do');
    const refused = await fetch(`${base}/otp/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'email', destination: 'a@example.test' }) });
    c.eq(refused.status, 503, 'and a request for an email code there is a 503');
    c.eq((await refused.json()).error.code, 'OTP_EMAIL_NOT_CONFIGURED', 'named OTP_EMAIL_NOT_CONFIGURED');
    c.eq(Number(bareDb.prepare('SELECT COUNT(*) AS n FROM otp_challenges').get().n), 0, 'with no challenge created');

    // A sender that fails (the provider is down, the key is revoked).
    const down = express();
    down.use(express.json());
    const downDb = createPlatformDb(':memory:');
    down.use('/otp', createOtpRouter(downDb, { smsProvider: null, emailSender: async () => { throw Object.assign(new Error('provider said no: secret detail'), { code: 'PROVIDER_REJECTED' }); }, env: {} }));
    const downListener = await new Promise(resolve => { const l = down.listen(0, '127.0.0.1', () => resolve(l)); });
    const downBase = `http://127.0.0.1:${downListener.address().port}`;
    const outage = await fetch(`${downBase}/otp/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'email', destination: 'outage@example.test' }) });
    const outageBody = await outage.json();
    c.eq(outage.status, 503, 'a provider outage answers 503');
    c.eq(outageBody.error.code, 'OTP_DELIVERY_FAILED', 'as OTP_DELIVERY_FAILED');
    c.ok(!JSON.stringify(outageBody).includes('secret detail') && !JSON.stringify(outageBody).includes('outage@example.test') && !('challengeId' in outageBody),
      'with nothing of the provider\'s reason, the address or a challenge in the answer');
    c.eq(Number(downDb.prepare('SELECT COUNT(*) AS n FROM otp_challenges WHERE consumed_at IS NULL').get().n), 0, 'and the challenge whose code never left is retired: nothing is left to guess at');
    await new Promise(resolve => { listener.closeAllConnections?.(); listener.close(resolve); });
    await new Promise(resolve => { downListener.closeAllConnections?.(); downListener.close(resolve); });
  }

  // ── an existing, verified password account signs in with a code ──────────
  resetLimits(); clearTestOutbox();
  const made = await registerAccount(h, { name: 'Verified', email: 'verified@example.test', password: PASSWORD, deviceId: 'd1' });
  c.eq(made.status, 201, 'a password account exists');
  await verifyEmail(h, made.account.id);
  const before = accounts();
  let a = await ask('Verified@Example.test');
  c.eq(a.r.status, 202, 'a code is sent for the address of an existing account');
  const unknown = await ask('nobody-here@example.test');
  c.eq(unknown.r.status, a.r.status, 'NO ENUMERATION: an address with no account gets the same status');
  c.deq(Object.keys(unknown.r.data).sort(), Object.keys(a.r.data).sort(), 'the same keys');
  c.deq({ ...unknown.r.data, challengeId: '' }, { ...a.r.data, challengeId: '' }, 'and the same values apart from the opaque challenge id');
  c.ok(lastMail('nobody-here@example.test')?.code && lastMail('verified@example.test')?.code, 'and a code really goes to both');
  const jar = {};
  r = await post('/verify', { channel: 'email', destination: 'verified@example.test', challengeId: a.challengeId, code: a.code, deviceId: 'card' }, jar);
  c.eq(r.status, 200, 'the right code signs the existing account in');
  c.deq({ status: r.data.status, created: r.data.created, id: r.data.account.id }, { status: 'signed-in', created: false, id: made.account.id }, 'as itself: signed-in, created:false, the same account id');
  c.eq(accounts(), before, 'no account was created');
  c.ok(raw.prepare('SELECT password_hash FROM accounts WHERE id=?').get(made.account.id).password_hash, 'a VERIFIED account keeps its password');
  c.eq((await login({ email: 'verified@example.test', password: PASSWORD })).status, 200, 'which still signs in');

  // ── the session cookie ───────────────────────────────────────────────────
  const fresh = await ask('verified@example.test');
  const cookieJar = {};
  r = await post('/verify', { channel: 'email', destination: 'verified@example.test', challengeId: fresh.challengeId, code: fresh.code }, cookieJar);
  const sessionCookie = setCookies(r).find(v => v.startsWith('pri_cloud_session='));
  c.ok(/;\s*HttpOnly/i.test(sessionCookie) && /;\s*SameSite=Lax/i.test(sessionCookie) && /;\s*Path=\//i.test(sessionCookie), 'the session cookie is HttpOnly, SameSite=Lax, Path=/');
  const maxAge = Number(/Max-Age=(\d+)/i.exec(sessionCookie)?.[1]);
  c.ok(maxAge > 29 * 86400 && maxAge <= 30 * 86400, `bounded by the 30-day idle window, never permanent (Max-Age ${maxAge})`);
  c.ok(!/;\s*Secure/i.test(sessionCookie), 'outside production (this harness) it is not marked Secure; the production flag is asserted below');
  const csrfCookie = setCookies(r).find(v => v.startsWith('pri_csrf='));
  c.ok(csrfCookie && !/HttpOnly/i.test(csrfCookie) && /SameSite=Lax/i.test(csrfCookie), 'its CSRF pair is readable by the page and SameSite=Lax');
  const token = cookieJar.pri_cloud_session;
  c.ok(!JSON.stringify(raw.prepare('SELECT * FROM account_sessions WHERE account_id=?').all(made.account.id)).includes(token), 'the raw session token is not stored (hash only)');
  r = await h.request('/v1/account/me', { jar: cookieJar });
  c.eq(r.status, 200, 'the session authenticates /me');
  c.ok(setCookies(r).some(v => v.startsWith('pri_cloud_session=')), 'and /me renews the cookie within the session\'s lifetime');
  r = await h.request('/v1/account/logout-all', { method: 'POST', jar: { pri_cloud_session: cookieJar.pri_cloud_session }, body: {}, headers: ORIGIN });
  c.eq(r.status, 403, 'a state-changing request with the session cookie but no CSRF header is refused');
  c.ok(liveSessions(made.account.id) >= 2, 'and revoked nothing');
  {
    const { setSessionCookies } = await import('../platform/security.js');
    const seen = [];
    const fakeRes = { cookie: (name, value, options) => seen.push({ name, options }) };
    const prior = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try { setSessionCookies(fakeRes, 'x'); } finally { if (prior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prior; }
    c.ok(seen.find(s => s.name === 'pri_cloud_session').options.secure === true && seen.find(s => s.name === 'pri_cloud_session').options.httpOnly === true,
      'in production the session cookie is Secure and HttpOnly');
  }

  // ── expiry of a session, sign out, sign out everywhere ───────────────────
  raw.prepare('UPDATE account_sessions SET expires_at = ? WHERE token_hash = (SELECT token_hash FROM account_sessions WHERE account_id = ? ORDER BY created_at DESC LIMIT 1)').run(Date.now() - 1000, made.account.id);
  r = await h.request('/v1/account/me', { jar: cookieJar });
  c.eq(r.status, 401, 'a session past its expiry no longer authenticates');
  r = await h.request('/v1/practice/issue', { method: 'POST', jar: cookieJar, body: {}, headers: ORIGIN });
  c.deq({ status: r.status, code: r.data?.error?.code }, { status: 401, code: 'AUTH_REQUIRED' }, 'and the route that issues a markable question answers 401 AUTH_REQUIRED — the code the card\'s "sign in again" is driven by');
  const two = {}; const three = {};
  for (const j of [two, three]) {
    const x = await ask('verified@example.test');
    await post('/verify', { channel: 'email', destination: 'verified@example.test', challengeId: x.challengeId, code: x.code }, j);
  }
  c.eq((await h.request('/v1/account/me', { jar: two })).status, 200, 'device two is signed in');
  r = await h.request('/v1/account/logout', { method: 'POST', jar: three, body: {}, headers: ORIGIN });
  c.eq(r.status, 200, 'sign out answers ok');
  c.eq((await h.request('/v1/account/me', { jar: { ...three, pri_cloud_session: three.pri_cloud_session } })).status, 401, 'and that device is signed out');
  c.eq((await h.request('/v1/account/me', { jar: two })).status, 200, 'the other device is not');
  r = await h.request('/v1/account/logout-all', { method: 'POST', jar: two, body: {}, headers: ORIGIN });
  c.ok(r.status === 200 && r.data.revoked >= 1, 'sign out everywhere revokes every live session');
  c.eq(liveSessions(made.account.id), 0, 'none is left live');
  c.eq((await h.request('/v1/account/me', { jar })).status, 401, 'including the first card sign-in');

  // ── wrong, expired, reused and superseded codes ──────────────────────────
  resetLimits();
  a = await ask('verified@example.test');
  for (let i = 1; i <= OTP_MAX_ATTEMPTS; i++) {
    r = await post('/verify', { channel: 'email', destination: 'verified@example.test', challengeId: a.challengeId, code: wrongOf(a.code) });
    c.deq({ status: r.status, code: r.data.error.code, left: r.data.error.attemptsRemaining }, { status: 400, code: 'OTP_INVALID', left: OTP_MAX_ATTEMPTS - i }, `wrong code ${i}: OTP_INVALID with ${OTP_MAX_ATTEMPTS - i} tries left`);
  }
  r = await post('/verify', { channel: 'email', destination: 'verified@example.test', challengeId: a.challengeId, code: a.code });
  c.eq(r.status, 400, 'after five wrong tries the RIGHT code is refused too: the challenge is burnt');
  c.ok(!('attemptsRemaining' in r.data.error), 'with no count to tell a burnt challenge from an unknown one');

  a = await ask('verified@example.test');
  raw.prepare('UPDATE otp_challenges SET expires_at = ? WHERE id = ?').run(Date.now() - 1, a.challengeId);
  r = await post('/verify', { channel: 'email', destination: 'verified@example.test', challengeId: a.challengeId, code: a.code });
  c.deq({ status: r.status, code: r.data.error.code }, { status: 400, code: 'OTP_INVALID' }, 'an expired code is refused');
  c.eq(OTP_TTL_MS, 10 * 60 * 1000, 'the lifetime the card and the email both state is the server\'s: 10 minutes');

  a = await ask('verified@example.test');
  const once = {};
  r = await post('/verify', { channel: 'email', destination: 'verified@example.test', challengeId: a.challengeId, code: a.code }, once);
  c.eq(r.status, 200, 'a right code works');
  r = await post('/verify', { channel: 'email', destination: 'verified@example.test', challengeId: a.challengeId, code: a.code });
  c.deq({ status: r.status, code: r.data.error.code }, { status: 400, code: 'OTP_INVALID' }, 'and only once: the same code again is refused');

  const older = await ask('verified@example.test');
  const newer = await ask('verified@example.test');
  r = await post('/verify', { channel: 'email', destination: 'verified@example.test', challengeId: older.challengeId, code: older.code });
  c.eq(r.status, 400, 'RESEND: the earlier code stops working the moment a newer one is sent');
  r = await post('/verify', { channel: 'email', destination: 'verified@example.test', challengeId: newer.challengeId, code: newer.code });
  c.eq(r.status, 200, 'and the newer one works');

  // A code is bound to the address it was sent to and to its purpose.
  a = await ask('verified@example.test');
  r = await post('/verify', { channel: 'email', destination: 'someone-else@example.test', challengeId: a.challengeId, code: a.code });
  c.eq(r.status, 400, 'a code cannot be used for a different address (change-email cannot carry a code across)');
  r = await post('/delete-confirm', { email: 'verified@example.test', challengeId: a.challengeId, code: a.code });
  c.ok(r.status === 400 && raw.prepare('SELECT 1 FROM accounts WHERE id=? AND deleted_at IS NULL').get(made.account.id), 'a sign-in code cannot be spent as a deletion code');

  // ── duplicate submit ─────────────────────────────────────────────────────
  a = await ask('verified@example.test');
  const sessionsBefore = liveSessions(made.account.id);
  const pair = await Promise.all([{}, {}].map(j => post('/verify', { channel: 'email', destination: 'verified@example.test', challengeId: a.challengeId, code: a.code }, j)));
  c.deq(pair.map(x => x.status).sort(), [200, 400], 'two simultaneous correct submits: exactly one wins');
  c.eq(liveSessions(made.account.id), sessionsBefore + 1, 'and exactly one session is made');

  // ── the limits the card names ────────────────────────────────────────────
  resetLimits();
  r = await post('/request', { channel: 'email', destination: 'limits@example.test' });
  c.eq(r.status, 202, 'first code');
  c.eq(r.data.resendAfterMs, OTP_RESEND_COOLDOWN_MS, 'the answer tells the card how long its "Resend code" must wait');
  r = await post('/request', { channel: 'email', destination: 'limits@example.test' });
  c.deq({ status: r.status, code: r.data.error.code }, { status: 429, code: 'OTP_RATE_LIMITED' }, 'a second code inside 30 s is refused');
  c.ok(Number(r.headers.get('retry-after')) >= 1 && Number(r.headers.get('retry-after')) <= 30, 'with Retry-After, which the card turns into "wait N s"');
  c.eq(readTestOutbox({ to: 'limits@example.test', channel: 'email' }).length, 1, 'and no second message was sent');
  for (let i = 2; i <= OTP_DESTINATION_LIMIT.limit; i++) {
    clearCooldown();
    c.eq((await post('/request', { channel: 'email', destination: 'limits@example.test' })).status, 202, `code ${i} of ${OTP_DESTINATION_LIMIT.limit} this hour`);
  }
  clearCooldown();
  r = await post('/request', { channel: 'email', destination: 'limits@example.test' });
  c.eq(r.status, 429, `the ${OTP_DESTINATION_LIMIT.limit + 1}th code in an hour to one mailbox is refused, whoever asks`);
  c.eq(readTestOutbox({ to: 'limits@example.test', channel: 'email' }).length, OTP_DESTINATION_LIMIT.limit, 'a mailbox cannot be flooded through this form');
  clearCooldown();
  c.eq((await post('/request', { channel: 'email', destination: 'another@example.test' })).status, 202, 'another mailbox is unaffected');
  r = await post('/request', { channel: 'email', destination: 'not-an-email' });
  c.deq({ status: r.status, code: r.data.error.code }, { status: 400, code: 'OTP_DESTINATION_INVALID' }, 'a malformed address is a 400, not a code');

  // ── the rough path the owner met on staging ──────────────────────────────
  // Registered with a password, never verified; "register" again says
  // EMAIL_EXISTS; a code proves the mailbox, and BY DESIGN clears whatever the
  // unproven registrant set — so the password stops working afterwards.
  resetLimits(); clearTestOutbox();
  const rough = await registerAccount(h, { name: 'Rough', email: 'rough@example.test', password: PASSWORD, deviceId: 'd1' });
  c.eq(rough.status, 201, 'registered with a password, unverified');
  r = await h.request('/v1/account/register', { method: 'POST', body: { name: 'Rough', email: 'rough@example.test', password: PASSWORD, isAdult: true }, headers: ORIGIN });
  c.deq({ status: r.status, code: r.data.error.code }, { status: 409, code: 'EMAIL_EXISTS' }, 'registering the same address again is EMAIL_EXISTS (unchanged policy)');
  a = await ask('rough@example.test');
  c.eq(a.r.status, 202, 'the card never meets EMAIL_EXISTS: for the same address it just sends a code');
  const roughJar = {};
  r = await post('/verify', { channel: 'email', destination: 'rough@example.test', challengeId: a.challengeId, code: a.code }, roughJar);
  c.deq({ status: r.status, created: r.data.created, verified: r.data.account.emailVerified }, { status: 200, created: false, verified: true }, 'the code signs in and verifies the existing account');
  c.eq(raw.prepare('SELECT password_hash FROM accounts WHERE id=?').get(rough.account.id).password_hash, null, 'the unproven registrant\'s password is cleared (pre-registration takeover defence)');
  c.eq((await h.request('/v1/account/me', { jar: rough.jar })).status, 401, 'and the session made at registration is revoked');
  const afterClear = await login({ email: 'rough@example.test', password: PASSWORD });
  const neverExisted = await login({ email: 'never-existed@example.test', password: PASSWORD });
  c.deq({ status: afterClear.status, body: afterClear.data }, { status: neverExisted.status, body: neverExisted.data }, 'afterwards the old password is refused exactly as an unknown address is — 401 BAD_CREDENTIALS, identical body');
  c.eq(afterClear.data.error.code, 'BAD_CREDENTIALS', 'which is why "password login failed" on staging; the code keeps working');
  a = await ask('rough@example.test');
  c.eq((await post('/verify', { channel: 'email', destination: 'rough@example.test', challengeId: a.challengeId, code: a.code })).status, 200, 'a code signs the same account in again, with no password and no reset');

  // ── /verify says nothing about an address until a correct code is shown ──
  // Every probe an attacker can make WITHOUT the code — no code, a wrong code,
  // a made-up challenge, a made-up ticket, with or without a profile, with a
  // profile that is invalid — is answered identically for an address that has
  // an account and one that does not. (Before this was fixed, an invalid
  // profile was answered PROFILE_NAME_REQUIRED / AGE_DECLARATION_REQUIRED for
  // unknown addresses only.)
  resetLimits();
  {
    const known = 'verified@example.test';
    const unknownAddress = 'no-such-student@example.test';
    const live = { [known]: await ask(known), [unknownAddress]: await ask(unknownAddress) };
    const probes = [
      ['no code, no profile', () => ({})],
      ['no code, an EMPTY profile', () => ({ profile: {} })],
      ['no code, a profile with no name', () => ({ profile: { isAdult: true } })],
      ['no code, a profile with no age', () => ({ profile: { name: 'Probe' } })],
      ['no code, a complete profile', () => ({ profile: { name: 'Probe', isAdult: true } })],
      ['a made-up challenge id and code, invalid profile', () => ({ challengeId: 'otp_00000000-0000-4000-8000-000000000000', code: '123456', profile: {} })],
      ['a made-up sign-up ticket, invalid profile', () => ({ signupTicket: 'otp_00000000-0000-4000-8000-000000000000', profile: {} })],
      ['a made-up sign-up ticket, complete profile', () => ({ signupTicket: 'otp_00000000-0000-4000-8000-000000000000', profile: { name: 'Probe', isAdult: true } })],
      ['a malformed code', () => ({ code: '12ab' })]
    ];
    for (const [label, body] of probes) {
      const answers = [];
      for (const address of [known, unknownAddress]) {
        const x = await post('/verify', { channel: 'email', destination: address, ...body() });
        answers.push({ status: x.status, body: x.data, cookie: setCookies(x).length });
      }
      c.deq(answers[0], answers[1], `/verify, ${label}: an address with an account and one without get the identical answer`);
      c.deq({ status: answers[0].status, code: answers[0].body?.error?.code, cookie: answers[0].cookie }, { status: 400, code: 'OTP_INVALID', cookie: 0 }, `and that answer is 400 OTP_INVALID with no session (${label})`);
    }
    // The LIVE challenge with a wrong code: the same answer and the same count
    // for both, whatever profile rides along.
    for (const profile of [undefined, {}, { name: 'Probe' }, { name: 'Probe', isAdult: true }]) {
      const answers = [];
      for (const address of [known, unknownAddress]) {
        const x = await post('/verify', { channel: 'email', destination: address, challengeId: live[address].challengeId, code: wrongOf(live[address].code), ...(profile === undefined ? {} : { profile }) });
        answers.push({ status: x.status, body: x.data });
      }
      c.deq(answers[0], answers[1], `/verify, the live challenge with a WRONG code and profile ${JSON.stringify(profile)}: identical for known and unknown, tries left included`);
    }
    c.eq(raw.prepare("SELECT COUNT(*) AS n FROM accounts WHERE email = ?").get(unknownAddress).n, 0, 'none of those probes created an account');
    // Only the correct code tells them apart — which is the proof of the mailbox.
    const right = { [known]: await ask(known), [unknownAddress]: await ask(unknownAddress) };
    const a1 = await post('/verify', { channel: 'email', destination: known, challengeId: right[known].challengeId, code: right[known].code, profile: {} });
    const a2 = await post('/verify', { channel: 'email', destination: unknownAddress, challengeId: right[unknownAddress].challengeId, code: right[unknownAddress].code, profile: {} });
    c.deq([a1.data.status, a2.data.status], ['signed-in', 'profile-required'], 'with the correct code — and only then — the two differ: one signs in, the other is asked for its profile');
    c.ok(!('error' in a2.data) && typeof a2.data.signupTicket === 'string', 'an invalid profile beside a correct code costs nothing: the ticket is issued, the questions are asked');
    const t1 = await post('/verify', { channel: 'email', destination: unknownAddress, signupTicket: a2.data.signupTicket, profile: {} });
    c.deq({ status: t1.status, code: t1.data.error.code }, { status: 400, code: 'PROFILE_NAME_REQUIRED' }, 'the profile is judged on the ticket, after the proof');
    const t2 = await post('/verify', { channel: 'email', destination: unknownAddress, signupTicket: a2.data.signupTicket, profile: { name: 'Probe', isAdult: true } });
    c.eq(t2.status, 201, 'and a profile error did not spend the ticket: the corrected profile completes the account');
    const t3 = await post('/verify', { channel: 'email', destination: unknownAddress, signupTicket: a2.data.signupTicket, profile: { name: 'Probe', isAdult: true } });
    c.eq(t3.status, 400, 'which is then spent');
  }

  // ── a new address: nothing is created until the questions are answered ───
  resetLimits();
  const beforeNew = accounts();
  a = await ask('new-card@example.test');
  r = await post('/verify', { channel: 'email', destination: 'new-card@example.test', challengeId: a.challengeId, code: a.code });
  c.deq({ status: r.status, state: r.data.status }, { status: 200, state: 'profile-required' }, 'a right code for a new address earns a sign-up ticket');
  c.eq(accounts(), beforeNew, 'and creates nothing');
  const ticket = r.data.signupTicket;
  r = await post('/verify', { channel: 'email', destination: 'new-card@example.test', signupTicket: ticket, profile: { name: 'Kid' } });
  c.deq({ status: r.status, code: r.data.error.code }, { status: 400, code: 'AGE_DECLARATION_REQUIRED' }, 'an account without an age declaration is refused: silence is never an adult');
  c.eq(accounts(), beforeNew, 'still nothing created');
  const kidJar = {};
  r = await post('/verify', { channel: 'email', destination: 'new-card@example.test', signupTicket: ticket, profile: { name: 'Kid', year: '10', isAdult: false } }, kidJar);
  c.eq(r.status, 201, 'with the declaration the ticket creates the account');
  c.deq(r.data.guardianConsent, { required: true, state: 'pending' }, 'UNDER 18: the account starts limited, consent pending');
  const kid = r.data.account.id;
  c.ok(raw.prepare('SELECT confirmed_at FROM guardian_consents WHERE account_id=?').get(kid).confirmed_at === null, 'nothing is recorded as confirmed');
  r = await post('/verify', { channel: 'email', destination: 'new-card@example.test', signupTicket: ticket, profile: { name: 'Kid', year: '10', isAdult: false } });
  c.eq(r.status, 400, 'the ticket is single use');
  r = await h.request('/v1/sync/pull', { method: 'POST', jar: kidJar, body: {}, headers: ORIGIN });
  c.deq({ status: r.status, code: r.data.error.code }, { status: 403, code: 'GUARDIAN_CONSENT_PENDING' }, 'the limited account is refused by a gated route');
  r = await h.request('/v1/practice/issue', { method: 'POST', jar: kidJar, body: {}, headers: ORIGIN });
  c.deq({ status: r.status, code: r.data?.error?.code }, { status: 403, code: 'GUARDIAN_CONSENT_PENDING' }, 'practice checking included');
  r = await post('/guardian/request', { guardianName: 'Meera', channel: 'email', destination: 'new-card@example.test' }, kidJar);
  c.deq({ status: r.status, code: r.data.error.code }, { status: 400, code: 'GUARDIAN_SAME_AS_STUDENT' }, 'the student\'s own address is not a guardian');
  r = await post('/guardian/request', { guardianName: 'Meera', channel: 'email', destination: 'meera@example.test' }, kidJar);
  c.eq(r.status, 202, 'the guardian is sent a code');
  const guardianMail = readTestOutbox({ to: 'meera@example.test', channel: 'email' }).filter(m => m.purpose === 'guardian-consent').at(-1);
  r = await post('/guardian/approve', { channel: 'email', destination: 'meera@example.test', code: guardianMail.code, approve: true, noticeVersion: 'wrong' }, {});
  c.eq(r.data.error.code, 'GUARDIAN_NOTICE_REQUIRED', 'approval without the current notice is refused');
  r = await post('/guardian/approve', { channel: 'email', destination: 'meera@example.test', code: guardianMail.code, approve: false, noticeVersion: (await import('../platform/guardianConsent.js')).CONSENT_NOTICE_VERSION }, {});
  c.eq(r.data.error.code, 'GUARDIAN_NOTICE_REQUIRED', 'and so is a request that does not say "approve"');
  c.eq((await h.request('/v1/sync/pull', { method: 'POST', jar: kidJar, body: {}, headers: ORIGIN })).status, 403, 'the account is still limited');
  r = await post('/guardian/approve', { channel: 'email', destination: 'meera@example.test', code: guardianMail.code, approve: true, noticeVersion: (await import('../platform/guardianConsent.js')).CONSENT_NOTICE_VERSION }, {});
  c.deq({ status: r.status, confirmed: r.data.confirmed }, { status: 200, confirmed: true }, 'the guardian\'s own code, with the notice, approves');
  r = await h.request('/v1/sync/pull', { method: 'POST', jar: kidJar, body: {}, headers: ORIGIN });
  c.ok(r.status !== 403, `and only then does the gate open (${r.status})`);

  // ── deletion still works for an account made by a code ───────────────────
  resetLimits();
  r = await post('/reauth-request', {}, kidJar);
  c.eq(r.status, 202, 'a code-only account asks for a fresh code to delete itself');
  const reauth = readTestOutbox({ to: 'new-card@example.test', channel: 'email' }).filter(m => m.purpose === 'reauth').at(-1);
  r = await h.request('/v1/account', { method: 'DELETE', jar: kidJar, body: { otpChallengeId: r.data.challengeId, otpCode: reauth.code }, headers: ORIGIN });
  c.deq({ status: r.status, deleted: r.data.deleted }, { status: 200, deleted: true }, 'and is deleted with it');
  c.eq(raw.prepare('SELECT COUNT(*) AS n FROM accounts WHERE id=?').get(kid).n, 0, 'the account row is gone');
  c.eq((await h.request('/v1/account/me', { jar: kidJar })).status, 401, 'and its session with it');

  // ── the email itself ─────────────────────────────────────────────────────
  const signIn = otpEmailMessage('483920', 'sign-in', 'https://staging.prilearning.example');
  c.eq(signIn.subject, '483920 is your Pri Learning code', 'the subject carries the code and the name');
  c.ok(signIn.html.includes('Pri Learning') && signIn.text.includes('Pri Learning'), 'it is recognisably Pri Learning, in HTML and in plain text');
  c.ok(/font:700 34px/.test(signIn.html) && signIn.html.includes('483&nbsp;920'), 'the code is the largest thing in it, grouped 3 + 3 for reading aloud');
  c.ok(/10 minutes/.test(signIn.html) && /10 minutes/.test(signIn.text), 'the expiry is stated');
  c.ok(/did not ask/.test(signIn.html) && /did not ask/.test(signIn.text), 'and what to do if it was not asked for');
  c.ok(/<meta name="viewport" content="width=device-width,initial-scale=1">/.test(signIn.html) && /max-width:480px/.test(signIn.html), 'it is a single narrow column a phone shows without zooming');
  c.ok(!/<a\b/i.test(signIn.html) && !/https?:\/\//i.test(signIn.html) && !/https?:\/\//i.test(signIn.text), 'a sign-in code email carries NO link and no URL at all — nothing to redirect');
  c.ok(!/<img\b|<script\b|<link\b/i.test(signIn.html), 'and no image, script or remote stylesheet (no tracking pixel)');
  c.ok(signIn.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length < 70, 'minimal text');
  const hostile = otpEmailMessage('<script>alert(1)</script>', 'sign-in', 'https://x.example');
  c.ok(!hostile.html.includes('<script>'), 'whatever is passed as the code is HTML-escaped');
  const removal = otpEmailMessage('111222', 'reauth', 'https://x.example', { intent: 'account-delete' });
  c.ok(/DELETE/.test(removal.html) && /delete your Pri Learning account/.test(removal.subject) && !/<a\b/i.test(removal.html), 'a deletion code says what it does and carries no link either');

  const staging = otpEmailMessage('222333', 'guardian-consent', 'https://staging.prilearning.example');
  const production = otpEmailMessage('222333', 'guardian-consent', 'https://prilearning.example');
  const hrefs = html => [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  c.deq(hrefs(staging.html), ['https://staging.prilearning.example/guardian/consent'], 'a guardian email from staging links only to staging\'s own consent page');
  c.deq(hrefs(production.html), ['https://prilearning.example/guardian/consent'], 'and one from production only to production\'s');
  c.ok(!staging.html.includes('https://prilearning.example') && !production.html.includes('staging.'), 'neither names the other environment');
  c.eq(otpEmailConsentLink('https://prilearning.example/login?next=https://evil.example'), null, 'an origin carrying a query (an open-redirect vector) yields no link');
  c.eq(otpEmailConsentLink('https://user:pw@prilearning.example'), null, 'nor one carrying credentials');
  c.eq(otpEmailConsentLink('javascript:alert(1)'), null, 'nor a non-http scheme');
  c.eq(otpEmailConsentLink('http://prilearning.example'), null, 'nor plain http for a non-local host');
  c.eq(otpEmailConsentLink(''), null, 'nor an unconfigured origin');
  c.eq(otpEmailConsentLink('https://prilearning.example/some/path'), 'https://prilearning.example/guardian/consent', 'a path on the configured origin is ignored: the link is always /guardian/consent on that origin');
  const unlinked = otpEmailMessage('222333', 'guardian-consent', 'javascript:alert(1)');
  c.ok(hrefs(unlinked.html).length === 0 && /the Pri Learning parent page/.test(unlinked.text), 'with no valid origin the guardian email names the page in words and carries no link');
  c.ok(readTestOutbox({ channel: 'email' }).filter(m => m.purpose === 'guardian-consent').every(m => m.body.includes('http://localhost:5173/guardian/consent')),
    'every guardian code this server sent names the consent page on ITS OWN configured origin');

  console.log(`OTP SIGN-IN (the sign-in card's server contract): ${c.count()}/${c.count()} checks passed`);
} finally {
  await h.close();
}
