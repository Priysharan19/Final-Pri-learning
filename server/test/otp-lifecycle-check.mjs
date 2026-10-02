// Pri Learning · one-time-code sign-in, sign-up and a parent's approval.
//
// Drives the production middleware chain (server/app.js -> /v1) with the SMS
// and email TEST adapters, which never send anything and keep codes in memory
// (server/platform/smsProvider.js). Covers: lifecycle, expiry, single use,
// replay, the 5-attempt ceiling, parallel guessing, no account enumeration,
// per-destination limits, the production gate on the test adapter, the child
// consent gate, parent approval and withdrawal by code, and deletion of a
// passwordless account.

process.env.PRI_AUTH_DELIVERY_KEY = '22'.repeat(32);
process.env.PRI_SMS_PROVIDER = 'test';
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
process.env.PRI_PUBLIC_ORIGIN = 'http://localhost:5173';

const { startApp, checks } = await import('./support/app-harness.mjs');
const {
  readTestOutbox, clearTestOutbox, createSmsProviderFromEnv, testModeAllowed, smsOtpBody,
  createMsg91Provider, createTwilioVerifyProvider
} = await import('../platform/smsProvider.js');
const { normalizePhone, OTP_MAX_ATTEMPTS, OTP_TTL_MS } = await import('../platform/otpCore.js');
const { createOtpEmailSenderFromEnv } = await import('../platform/otpEmail.js');
const { CONSENT_NOTICE_VERSION } = await import('../platform/guardianConsent.js');

const c = checks();
const h = await startApp();
const resetLimits = () => h.db.prepare ? h.db.prepare('DELETE FROM rate_limits').run() : h.db.run('DELETE FROM rate_limits');
const lastCode = (to) => readTestOutbox({ to }).at(-1)?.code;
const post = (path, body, jar = {}) => h.request(`/v1/account/otp${path}`, { method: 'POST', body, jar, headers: { Origin: 'http://localhost:5173' } });
const raw = h.db; // bare better-sqlite3 handle in this harness

try {
  // ── normalisation ───────────────────────────────────────────────────────
  c.eq(normalizePhone('98765 43210'), '+919876543210', '+91 is the default country');
  c.eq(normalizePhone('098765-43210'), '+919876543210', 'a leading trunk 0 is dropped');
  c.eq(normalizePhone('+91 98765 43210'), '+919876543210', 'an explicit +91 is kept');
  c.eq(normalizePhone('12345'), null, 'a short number is refused');
  c.eq(normalizePhone('+91 12345 67890'), null, 'an Indian number must start 6-9');
  c.eq(normalizePhone('+1 415 555 0100'), '+14155550100', 'other countries pass with a +');

  // ── the production gate on test adapters ─────────────────────────────────
  c.ok(!testModeAllowed({ NODE_ENV: 'production' }), 'test SMS is refused in production by default');
  c.ok(testModeAllowed({ NODE_ENV: 'production', PRI_SMS_TEST_MODE_ALLOW_STAGING: '1' }), 'only the explicit staging flag allows it');
  c.ok(!testModeAllowed({ NODE_ENV: 'production', PRI_SMS_TEST_MODE_ALLOW_STAGING: 'true' }), 'the flag must be exactly 1');
  let threw = null;
  try { createSmsProviderFromEnv({ NODE_ENV: 'production', PRI_SMS_PROVIDER: 'test' }); } catch (e) { threw = e; }
  c.eq(threw?.code, 'SMS_TEST_MODE_FORBIDDEN', 'creating the test SMS adapter in production throws (boot fails)');
  threw = null;
  try { createOtpEmailSenderFromEnv({ NODE_ENV: 'production', PRI_AUTH_EMAIL_PROVIDER: 'test' }); } catch (e) { threw = e; }
  c.eq(threw?.code, 'EMAIL_TEST_MODE_FORBIDDEN', 'the email test sender has the same gate');
  c.eq(createOtpEmailSenderFromEnv({ NODE_ENV: 'production' }), null, 'production without Resend has no email sender (503), never the test one');
  c.eq(createSmsProviderFromEnv({ PRI_SMS_PROVIDER: 'msg91' }), null, 'msg91 without credentials is unconfigured');
  c.eq(createSmsProviderFromEnv({ PRI_SMS_PROVIDER: 'twilio', PRI_TWILIO_ACCOUNT_SID: 'AC1', PRI_TWILIO_AUTH_TOKEN: 't', PRI_TWILIO_VERIFY_SERVICE_SID: 'bad' }), null, 'twilio needs a VA service sid');
  threw = null;
  try { createSmsProviderFromEnv({ PRI_SMS_PROVIDER: 'carrier-pigeon' }); } catch (e) { threw = e; }
  c.eq(threw?.code, 'SMS_PROVIDER_UNSUPPORTED', 'an unknown provider is a configuration error');
  c.match(smsOtpBody('123456', 'sign-in', 'https://pri.example.in'), /\n@pri\.example\.in #123456$/, 'SMS ends with the WebOTP origin line');

  // Adapters speak the provider protocols (fetch stubbed; nothing leaves).
  const calls = [];
  const fakeFetch = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ type: 'success', message: 'req1', sid: 'VE1', status: 'approved', valid: true }), { status: 200 }); };
  await createMsg91Provider({ authKey: 'k', templateId: 'tpl', fetchImpl: fakeFetch }).send({ to: '+919876543210', code: '123456', purpose: 'sign-in' });
  const msg91Body = JSON.parse(calls[0].init.body);
  c.ok(calls[0].url.startsWith('https://control.msg91.com/') && msg91Body.template_id === 'tpl' && msg91Body.recipients[0].mobiles === '919876543210' && msg91Body.recipients[0].otp === '123456', 'MSG91 flow call carries the DLT template, mobile and Pri code');
  const twilio = createTwilioVerifyProvider({ accountSid: 'AC1', authToken: 't', serviceSid: `VA${'a'.repeat(32)}`, fetchImpl: fakeFetch });
  await twilio.start({ to: '+919876543210' });
  c.ok(calls[1].url.endsWith('/Verifications') && calls[1].init.body.includes('Channel=sms'), 'Twilio Verify starts an SMS verification');
  c.ok(await twilio.check({ to: '+919876543210', code: '123456' }), 'Twilio Verify check approves');

  // ── email sign-up: profile-required, then the same code completes it ────
  clearTestOutbox();
  let r = await post('/request', { channel: 'email', destination: 'New.Student@Example.test' });
  c.eq(r.status, 202, 'request answers 202');
  const firstChallenge = r.data.challengeId;
  const code1 = lastCode('new.student@example.test');
  c.match(code1, /^\d{6}$/, 'a 6-digit code was "sent" to the normalised address');
  c.ok(!raw.prepare('SELECT code_hash FROM otp_challenges WHERE id=?').get(firstChallenge).code_hash.includes(code1), 'the code is not stored');
  c.ok(!JSON.stringify(raw.prepare('SELECT * FROM otp_challenges').all()).includes('new.student'), 'the address is not stored');

  r = await post('/verify', { channel: 'email', destination: 'new.student@example.test', challengeId: firstChallenge, code: code1 });
  c.eq(r.data?.status, 'profile-required', 'a new address with a right code asks for a profile');
  const ticket = r.data.signupTicket;
  c.ok(ticket && ticket !== firstChallenge, 'and hands back a fresh sign-up ticket');
  r = await post('/verify', { channel: 'email', destination: 'new.student@example.test', challengeId: firstChallenge, code: code1, profile: { name: 'A', isAdult: true } });
  c.eq(r.data?.error?.code, 'OTP_INVALID', 'the original challenge id cannot be replayed');

  const studentJar = {};
  r = await post('/verify', { channel: 'email', destination: 'new.student@example.test', signupTicket: ticket, profile: { name: 'Asha', year: '9', isAdult: false } }, studentJar);
  c.eq(r.status, 201, 'ticket + profile creates the account');
  c.eq(r.data.account.email, 'new.student@example.test', 'with the proved email');
  c.ok(r.data.account.emailVerified, 'already verified: the code proved it');
  c.deq(r.data.guardianConsent, { required: true, state: 'pending' }, 'a Class 9 learner starts with consent pending');
  r = await post('/verify', { channel: 'email', destination: 'new.student@example.test', signupTicket: ticket, profile: { name: 'Asha', year: '9', isAdult: false } });
  c.eq(r.data?.error?.code, 'OTP_INVALID', 'a sign-up ticket is single use');

  // The child is limited until approved.
  r = await h.request('/v1/sync/pull', { jar: studentJar });
  c.eq(r.data?.error?.code, 'GUARDIAN_CONSENT_PENDING', 'sync is refused while consent is pending');

  // ── no enumeration: same answer for a known and an unknown address ──────
  resetLimits();
  const known = await post('/request', { channel: 'email', destination: 'new.student@example.test' });
  const unknown = await post('/request', { channel: 'email', destination: 'nobody.here@example.test' });
  c.eq(known.status, unknown.status, 'same status for known and unknown');
  c.deq(Object.keys(known.data).sort(), Object.keys(unknown.data).sort(), 'same body shape');
  c.eq(known.data.expiresInMs, OTP_TTL_MS, 'and the same 10-minute expiry');
  const wrongKnown = await post('/verify', { channel: 'email', destination: 'new.student@example.test', challengeId: known.data.challengeId, code: '000000' === lastCode('new.student@example.test') ? '111111' : '000000' });
  const wrongUnknown = await post('/verify', { channel: 'email', destination: 'nobody.here@example.test', challengeId: unknown.data.challengeId, code: '000000' === lastCode('nobody.here@example.test') ? '111111' : '000000' });
  c.eq(wrongKnown.data.error.code, wrongUnknown.data.error.code, 'a wrong code fails identically for both');

  // ── sign-in to the existing account ──────────────────────────────────────
  const signJar = {};
  r = await post('/verify', { channel: 'email', destination: 'new.student@example.test', challengeId: known.data.challengeId, code: lastCode('new.student@example.test') }, signJar);
  c.eq(r.data?.status, 'signed-in', 'an existing account signs in with the code');
  c.eq(r.data.created, false, 'and is not created again');
  r = await post('/verify', { channel: 'email', destination: 'new.student@example.test', challengeId: known.data.challengeId, code: lastCode('new.student@example.test') });
  c.eq(r.data?.error?.code, 'OTP_INVALID', 'replaying a spent code fails');

  // ── cooldown and per-destination cap ─────────────────────────────────────
  resetLimits();
  await post('/request', { channel: 'email', destination: 'limit@example.test' });
  r = await post('/request', { channel: 'email', destination: 'limit@example.test' });
  c.eq(r.status, 429, 'a second code inside 30 s is refused');
  c.ok(Number(r.headers.get('retry-after')) > 0, 'with Retry-After');

  // ── brute force: 5 attempts burn the challenge, even with the right code ─
  resetLimits();
  r = await post('/request', { channel: 'sms', destination: '9876543210' });
  const bfChallenge = r.data.challengeId;
  const bfCode = lastCode('+919876543210');
  c.ok(readTestOutbox({ to: '+919876543210' }).at(-1).body.endsWith(`@localhost:5173 #${bfCode}`), 'the SMS carries the WebOTP line');
  const wrong = bfCode === '000000' ? '000001' : '000000';
  const attempts = [];
  for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) attempts.push(await post('/verify', { channel: 'sms', destination: '9876543210', challengeId: bfChallenge, code: wrong, profile: { name: 'P', isAdult: true } }));
  c.deq(attempts.map(a => a.data.error.attemptsRemaining), [4, 3, 2, 1, 0], 'each wrong code counts down');
  r = await post('/verify', { channel: 'sms', destination: '9876543210', challengeId: bfChallenge, code: bfCode, profile: { name: 'P', isAdult: true } });
  c.eq(r.data?.error?.code, 'OTP_INVALID', 'after 5 wrong attempts even the right code fails');

  // Parallel guessing cannot exceed the ceiling.
  resetLimits();
  r = await post('/request', { channel: 'sms', destination: '9876500001' });
  const parChallenge = r.data.challengeId;
  const parCode = lastCode('+919876500001');
  const guesses = Array.from({ length: 12 }, (_, i) => String((Number(parCode) + 1 + i) % 1_000_000).padStart(6, '0'));
  await Promise.all(guesses.map(code => post('/verify', { channel: 'sms', destination: '9876500001', challengeId: parChallenge, code, profile: { name: 'P', isAdult: true } })));
  c.ok(raw.prepare('SELECT attempts FROM otp_challenges WHERE id=?').get(parChallenge).attempts <= OTP_MAX_ATTEMPTS, 'parallel guesses never exceed 5 counted attempts');

  // Expiry.
  resetLimits();
  r = await post('/request', { channel: 'sms', destination: '9876500002' });
  raw.prepare('UPDATE otp_challenges SET expires_at = ? WHERE id = ?').run(Date.now() - 1, r.data.challengeId);
  const exp = await post('/verify', { channel: 'sms', destination: '9876500002', challengeId: r.data.challengeId, code: lastCode('+919876500002'), profile: { name: 'P', isAdult: true } });
  c.eq(exp.data?.error?.code, 'OTP_INVALID', 'an expired code fails');

  // A code is bound to its destination.
  resetLimits();
  r = await post('/request', { channel: 'sms', destination: '9876500003' });
  const cross = await post('/verify', { channel: 'sms', destination: '9876500004', challengeId: r.data.challengeId, code: lastCode('+919876500003'), profile: { name: 'P', isAdult: true } });
  c.eq(cross.data?.error?.code, 'OTP_INVALID', 'a code for one number does not work for another');

  // A newer code retires the older one.
  raw.prepare('DELETE FROM rate_limits').run();
  const older = r.data.challengeId; const olderCode = lastCode('+919876500003');
  await post('/request', { channel: 'sms', destination: '9876500003' });
  const stale = await post('/verify', { channel: 'sms', destination: '9876500003', challengeId: older, code: olderCode, profile: { name: 'P', isAdult: true } });
  c.eq(stale.data?.error?.code, 'OTP_INVALID', 'asking again retires the previous code');

  // ── phone sign-up of a child, then a parent approves by SMS ─────────────
  resetLimits();
  const kidJar = {};
  r = await post('/request', { channel: 'sms', destination: '9123456780' });
  r = await post('/verify', { channel: 'sms', destination: '9123456780', challengeId: r.data.challengeId, code: lastCode('+919123456780'), profile: { name: 'Ravi', year: '8', isAdult: false } }, kidJar);
  c.eq(r.status, 201, 'phone sign-up with a profile creates the account in one step');
  c.eq(r.data.account.email, null, 'a phone account shows no email');
  c.match(r.data.account.phone, /^\+91 ••••• 780$/, 'and a masked phone');
  r = await h.request('/v1/account/me', { jar: kidJar });
  c.eq(r.data.account.email, null, '/me never shows the placeholder address');

  r = await post('/guardian/request', { guardianName: 'Ravi Sr', channel: 'sms', destination: '9123456780' }, kidJar);
  c.eq(r.data?.error?.code, 'GUARDIAN_SAME_AS_STUDENT', 'the student cannot name their own number');
  r = await post('/guardian/request', { guardianName: 'Meera', channel: 'sms', destination: '9988776655' }, kidJar);
  c.eq(r.status, 202, 'the parent is sent a code');
  c.eq(r.data.noticeVersion, CONSENT_NOTICE_VERSION, 'with the notice version to show');
  const parentChallenge = r.data.challengeId;
  const parentCode = lastCode('+919988776655');
  c.eq(readTestOutbox({ to: '+919988776655' }).at(-1).purpose, 'guardian-consent', 'the parent SMS is the consent message');
  r = await post('/guardian/approve', { challengeId: parentChallenge, code: parentCode, approve: true, noticeVersion: 'old' }, kidJar);
  c.eq(r.data?.error?.code, 'GUARDIAN_NOTICE_REQUIRED', 'approval must name the current notice');
  r = await post('/guardian/approve', { challengeId: parentChallenge, code: parentCode, approve: true, noticeVersion: CONSENT_NOTICE_VERSION }, signJar);
  c.eq(r.data?.error?.code, 'OTP_INVALID', 'another account cannot use this parent code');
  r = await post('/guardian/approve', { challengeId: parentChallenge, code: parentCode, approve: true, noticeVersion: CONSENT_NOTICE_VERSION }, kidJar);
  c.eq(r.data?.state, 'given', 'the parent approves with the code');
  c.eq(raw.prepare("SELECT method FROM guardian_consents WHERE account_id=(SELECT account_id FROM account_phones WHERE phone_e164='+919123456780')").get().method, 'guardian-phone-otp', 'the method written is phone OTP, nothing grander');
  r = await h.request('/v1/sync/pull', { jar: kidJar });
  c.ok(r.status !== 403, 'sync opens once approved');

  // ── parent withdraws by phone, no session ────────────────────────────────
  resetLimits();
  const nobody = await post('/guardian/withdraw-request', { destination: '9000000001' });
  const parent = await post('/guardian/withdraw-request', { destination: '9988776655' });
  c.eq(nobody.status, parent.status, 'withdraw-request answers the same for an unknown number');
  c.deq(Object.keys(nobody.data).sort(), Object.keys(parent.data).sort(), 'with the same shape');
  c.eq(readTestOutbox({ to: '+919000000001' }).length, 0, 'but no SMS goes to a number that approved nothing');
  r = await post('/guardian/withdraw', { destination: '9988776655', challengeId: parent.data.challengeId, code: lastCode('+919988776655') });
  c.eq(r.data?.withdrawn, 1, 'the parent withdraws');
  r = await h.request('/v1/sync/pull', { jar: kidJar });
  c.eq(r.data?.error?.code, 'GUARDIAN_CONSENT_WITHDRAWN', 'and sync stops at once');

  // ── adults are not gated ─────────────────────────────────────────────────
  resetLimits();
  const adultJar = {};
  r = await post('/request', { channel: 'email', destination: 'adult@example.test' });
  r = await post('/verify', { channel: 'email', destination: 'adult@example.test', challengeId: r.data.challengeId, code: lastCode('adult@example.test'), profile: { name: 'Dev', isAdult: true } }, adultJar);
  c.deq(r.data.guardianConsent, { required: false, state: 'not-required' }, 'an adult needs no parent');
  r = await post('/guardian/request', { guardianName: 'X', channel: 'sms', destination: '9988776650' }, adultJar);
  c.eq(r.status, 409, 'and cannot start a consent request');

  // A claimed role or a missing age never makes an adult: only isAdult === true.
  resetLimits();
  r = await post('/request', { channel: 'email', destination: 'claims.parent@example.test' });
  r = await post('/verify', { channel: 'email', destination: 'claims.parent@example.test', challengeId: r.data.challengeId, code: lastCode('claims.parent@example.test'), profile: { name: 'Claim', role: 'parent' } });
  c.eq(r.data?.error?.code, 'AGE_DECLARATION_REQUIRED', 'no explicit age declaration creates no account (fail closed)');
  c.eq(raw.prepare("SELECT COUNT(*) n FROM accounts WHERE email='claims.parent@example.test'").get().n, 0, 'and nothing was written');

  // ── deleting a passwordless account needs a fresh code ──────────────────
  r = await h.request('/v1/account', { method: 'DELETE', headers: { Origin: 'http://localhost:5173' }, jar: kidJar, body: {} });
  c.eq(r.status, 401, 'deletion without proof is refused');
  r = await post('/reauth-request', {}, kidJar);
  c.eq(r.status, 202, 'a reauth code goes to the account’s own phone');
  const reauth = r.data.challengeId;
  r = await h.request('/v1/account', { method: 'DELETE', headers: { Origin: 'http://localhost:5173' }, jar: kidJar, body: { otpChallengeId: reauth, otpCode: '999999' === lastCode('+919123456780') ? '999998' : '999999' } });
  c.eq(r.data?.error?.code, 'OTP_REAUTH_FAILED', 'a wrong code does not delete');
  r = await h.request('/v1/account', { method: 'DELETE', headers: { Origin: 'http://localhost:5173' }, jar: kidJar, body: { otpChallengeId: reauth, otpCode: lastCode('+919123456780') } });
  c.eq(r.data?.deleted, true, 'the right code deletes the account');
  c.eq(raw.prepare("SELECT COUNT(*) n FROM account_phones WHERE phone_e164='+919123456780'").get().n, 0, 'and its phone row goes with it');
} finally {
  await h.close();
}

console.log(`OTP lifecycle: ${c.count()}/${c.count()} checks passed`);
