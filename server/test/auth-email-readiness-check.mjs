// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · auth email: readiness tells the truth, send failures are coded
//
// The defect: a deployment whose PRI_RESEND_API_KEY was refused by the provider
// ("API key is invalid") reported `authEmail: ok` on /v1/ready, because the
// check only asked whether the variables existed. The same check would hide a
// sender domain that was never verified.
//
// No network. Every provider answer here comes from an injected fetch.
//
//   1. classifyResendRejection: what each provider refusal means, by code only.
//   2. probeAuthEmail: every state (valid+verified, key invalid, sending-only
//      key, unverified/absent domain, shared test sender, timeout, network,
//      429, 5xx, malformed), its cache, and that nothing secret is returned.
//   3. readinessReport: how each state is reported, and that NONE of them makes
//      /v1/ready answer 503 — only "not configured in production" does.
//   4. The one-time-code sender: a refused send throws a specific code, is
//      counted and logged by code, and never carries the address or the code.
//   5. Over HTTP: /v1/account/otp/request answers an explicit 503 "could not be sent"
//      (never a silent 202), identically for a known and an unknown address.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const names = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_AUTH_EMAIL_PROVIDER',
  'PRI_RESEND_API_KEY', 'PRI_AUTH_EMAIL_FROM', 'PRI_HANDWRITING_API_KEY', 'PRI_MFA_KEY'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-auth-email-ready-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '5a'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
for (const name of names.slice(4)) delete process.env[name];

// Assembled at runtime so no secret-shaped literal sits in the repository.
const KEY = ['re', 'MARKERKEY', 'not', 'a', 'real', 'key', '0123456789'].join('_');
const RECIPIENT = 'learner.markeraddr@example.test';
const OWNER = 'owner.markerowner@example.test';
const CODE = '918273';
const FROM = 'Pri Learning <verify@mail.pri.example>';
const MARKERS = ['MARKERKEY', 'MARKERADDR', 'MARKEROWNER', CODE, 'MAIL.PRI.EXAMPLE'];
const leaks = value => MARKERS.filter(marker => JSON.stringify(value ?? '').toUpperCase().includes(marker));

const { checks, startApp } = await import('./support/app-harness.mjs');
const {
  classifyResendRejection, probeAuthEmail, resetAuthEmailProbeCache, authEmailSenderDomain, createResendAuthEmailTransport,
  AUTH_EMAIL_PROBE_TTL_MS, AUTH_EMAIL_PROBE_RETRY_TTL_MS
} = await import('../platform/authDelivery.js');
const { createResendOtpEmailSender } = await import('../platform/otpEmail.js');
const { readinessReport } = await import('../platform/readiness.js');
const { metrics } = await import('../platform/metrics.js');
const { setLogSink } = await import('../platform/observability.js');

const c = checks();
const json = (status, body) => new Response(JSON.stringify(body), { status });
const env = (extra = {}) => ({ NODE_ENV: 'production', PRI_AUTH_EMAIL_PROVIDER: 'resend', PRI_RESEND_API_KEY: KEY, PRI_AUTH_EMAIL_FROM: FROM, PRI_MFA_KEY: 'cd'.repeat(32), ...extra });
const domains = (list, more = false) => json(200, { object: 'list', has_more: more, data: list });
const VERIFIED = [{ id: 'd0', name: 'other.example', status: 'verified' }, { id: 'd1', name: 'Mail.Pri.Example', status: 'verified', region: 'ap-northeast-1' }];

// The provider's own refusals, as it words them. The messages quote an address
// and a domain on purpose: nothing of them may survive classification.
const REFUSAL = {
  keyInvalid400: [400, { statusCode: 400, name: 'validation_error', message: 'API key is invalid' }],
  keyInvalid403: [403, { statusCode: 403, name: 'invalid_api_key', message: 'API key is invalid' }],
  keyMissing401: [401, { statusCode: 401, name: 'missing_api_key', message: 'Missing API key in the authorization header.' }],
  restricted401: [401, { statusCode: 401, name: 'restricted_api_key', message: 'This API key is restricted to only send emails' }],
  unverified403: [403, { statusCode: 403, name: 'validation_error', message: 'The mail.pri.example domain is not verified. Please, add and verify your domain on https://resend.com/domains' }],
  testSender403: [403, { statusCode: 403, name: 'validation_error', message: `You can only send testing emails to your own email address (${OWNER}). To send emails to other recipients, please verify a domain at resend.com/domains` }],
  quota429: [429, { statusCode: 429, name: 'daily_quota_exceeded', message: 'You have reached your daily email sending quota.' }],
  rate429: [429, { statusCode: 429, name: 'rate_limit_exceeded', message: 'Too many requests.' }],
  server500: [500, { statusCode: 500, name: 'internal_server_error', message: `could not send to ${RECIPIENT}` }]
};

const captured = [];
setLogSink((level, line) => { captured.push(line); });
let harness = null;
try {
  // ── 1 · classification ─────────────────────────────────────────────────────
  const expectCode = {
    keyInvalid400: 'AUTH_EMAIL_KEY_INVALID', keyInvalid403: 'AUTH_EMAIL_KEY_INVALID', keyMissing401: 'AUTH_EMAIL_KEY_INVALID',
    restricted401: 'AUTH_EMAIL_KEY_RESTRICTED', unverified403: 'AUTH_EMAIL_SENDER_UNVERIFIED',
    testSender403: 'AUTH_EMAIL_TEST_SENDER_RECIPIENT_REFUSED', quota429: 'AUTH_EMAIL_QUOTA_EXCEEDED',
    rate429: 'RESEND_429', server500: 'RESEND_500'
  };
  for (const [label, code] of Object.entries(expectCode)) {
    c.eq(classifyResendRejection(...REFUSAL[label]), code, `provider refusal ${label} is coded ${code}`);
  }
  c.eq(classifyResendRejection(422, null), 'RESEND_422', 'a refusal with no readable body keeps its status code');
  c.eq(classifyResendRejection('nonsense', { message: 5 }), 'RESEND_BAD_RESPONSE', 'a refusal with no status is a bad response, not a guess');
  c.eq(classifyResendRejection(400, { name: 'validation_error', message: 'Invalid `to` field.' }), 'RESEND_400', 'an ordinary validation error is NOT mistaken for a bad key');

  c.eq(authEmailSenderDomain(FROM), 'mail.pri.example', 'the sender domain is read from a display-name From');
  c.eq(authEmailSenderDomain('verify@Mail.Pri.Example'), 'mail.pri.example', 'and from a bare address, lower-cased');
  for (const bad of ['', 'Pri Learning', 'verify@', 'verify@localhost', 'a b@c.d', 'Pri <not-an-address>']) {
    c.eq(authEmailSenderDomain(bad), null, `"${bad}" has no sender domain`);
  }

  // ── 2 · the probe ──────────────────────────────────────────────────────────
  const probeWith = async (answer, extraEnv = {}, options = {}) => {
    const seen = [];
    const fetchImpl = async (url, init) => { seen.push({ url: String(url), init }); return answer(init); };
    const value = await probeAuthEmail({ env: env(extraEnv), fetchImpl, cache: false, ...options });
    return { value, seen };
  };

  let run = await probeWith(async () => domains(VERIFIED));
  c.deq([run.value.credential, run.value.keyScope, run.value.sender, run.value.code], ['valid', 'full', 'verified', null], 'a full-access key whose sender domain is verified');
  c.eq(run.seen.length, 1, 'one provider call');
  c.ok(run.seen[0].url.startsWith('https://api.resend.com/domains') && run.seen[0].init.method === 'GET', 'a read-only GET of the domain list: nothing is sent to anyone');
  c.eq(run.seen[0].init.headers.Authorization, `Bearer ${KEY}`, 'authenticated with the configured key');
  c.ok(run.seen[0].init.signal instanceof AbortSignal, 'and bounded by an abort signal');
  c.eq(leaks(run.value).length, 0, 'the probe result carries no key, address or domain');

  for (const label of ['keyInvalid400', 'keyInvalid403', 'keyMissing401']) {
    run = await probeWith(async () => json(...REFUSAL[label]));
    c.deq([run.value.credential, run.value.code], ['invalid', 'AUTH_EMAIL_KEY_INVALID'], `${label}: the credential is invalid`);
  }

  run = await probeWith(async () => json(...REFUSAL.restricted401));
  c.deq([run.value.credential, run.value.keyScope, run.value.sender, run.value.code], ['valid', 'sending', 'unknown', null],
    'a sending-only key is VALID; the domain cannot be checked, which is unknown and not a failure');

  run = await probeWith(async () => domains([{ id: 'd1', name: 'mail.pri.example', status: 'pending' }]));
  c.deq([run.value.credential, run.value.sender, run.value.code], ['valid', 'unverified', 'AUTH_EMAIL_SENDER_UNVERIFIED'], 'a sender domain still pending verification is unverified');
  run = await probeWith(async () => domains([{ id: 'd0', name: 'other.example', status: 'verified' }]));
  c.deq([run.value.sender, run.value.code], ['unverified', 'AUTH_EMAIL_SENDER_UNVERIFIED'], 'a sender domain that is not in the account is unverified');
  run = await probeWith(async () => domains([{ id: 'd0', name: 'pri.example', status: 'verified' }]));
  c.eq(run.value.sender, 'unverified', 'a verified PARENT domain does not verify a subdomain sender');
  run = await probeWith(async () => domains([{ id: 'd0', name: 'other.example', status: 'verified' }], true));
  c.deq([run.value.sender, run.value.code], ['unknown', null], 'absent from one page of a longer list is unknown, never "unverified"');

  run = await probeWith(async () => domains(VERIFIED), { PRI_AUTH_EMAIL_FROM: 'Pri Learning <onboarding@resend.dev>' });
  c.deq([run.value.credential, run.value.sender, run.value.code], ['valid', 'test_sender', 'AUTH_EMAIL_TEST_SENDER'], 'the shared resend.dev sender is reported as the test sender');
  run = await probeWith(async () => json(...REFUSAL.restricted401), { PRI_AUTH_EMAIL_FROM: 'onboarding@resend.dev' });
  c.deq([run.value.credential, run.value.sender, run.value.code], ['valid', 'test_sender', 'AUTH_EMAIL_TEST_SENDER'], 'and is recognised even with a sending-only key');
  run = await probeWith(async () => json(...REFUSAL.keyInvalid400), { PRI_AUTH_EMAIL_FROM: 'onboarding@resend.dev' });
  c.eq(run.value.code, 'AUTH_EMAIL_KEY_INVALID', 'an invalid key outranks the test sender');
  run = await probeWith(async () => domains(VERIFIED), { PRI_AUTH_EMAIL_FROM: 'Pri Learning' });
  c.deq([run.value.sender, run.value.code], ['invalid', 'AUTH_EMAIL_SENDER_INVALID'], 'a From value with no address is invalid');

  run = await probeWith(async () => { throw Object.assign(new TypeError(`fetch failed for ${KEY}`), { cause: { code: 'ENOTFOUND' } }); });
  c.deq([run.value.credential, run.value.sender, run.value.code], ['unknown', 'unknown', 'AUTH_EMAIL_PROVIDER_UNREACHABLE'], 'a network failure is unknown: neither ok nor "key invalid"');
  c.eq(leaks(run.value).length, 0, 'and the thrown text is not carried');
  run = await probeWith(init => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))), {}, { timeoutMs: 40 });
  c.deq([run.value.credential, run.value.code], ['unknown', 'AUTH_EMAIL_PROVIDER_TIMEOUT'], 'a provider that never answers is cut off at the probe timeout and is unknown');
  run = await probeWith(async () => json(...REFUSAL.rate429));
  c.deq([run.value.credential, run.value.code], ['unknown', 'RESEND_429'], 'a rate-limited probe is unknown');
  run = await probeWith(async () => json(...REFUSAL.server500));
  c.deq([run.value.credential, run.value.code], ['unknown', 'RESEND_500'], 'a provider 5xx is unknown');
  run = await probeWith(async () => new Response('<html>gateway</html>', { status: 200 }));
  c.deq([run.value.credential, run.value.sender, run.value.code], ['valid', 'unknown', 'RESEND_BAD_RESPONSE'], 'a 200 that is not the domain list proves the key and nothing about the sender');

  const unconfigured = await probeAuthEmail({ env: { NODE_ENV: 'production' }, fetchImpl: async () => { throw new Error('must not be called'); }, cache: false });
  c.deq([unconfigured.configured, unconfigured.code], [false, 'AUTH_EMAIL_NOT_CONFIGURED'], 'with no transport configured the provider is never called');

  // Cache: a definite answer is kept for minutes, an unknown one retried sooner.
  resetAuthEmailProbeCache();
  let calls = 0;
  let answer = async () => domains(VERIFIED);
  const counted = async () => { calls += 1; return answer(); };
  const t0 = 1_800_000_000_000;
  await probeAuthEmail({ env: env(), fetchImpl: counted, now: t0 });
  await probeAuthEmail({ env: env(), fetchImpl: counted, now: t0 + AUTH_EMAIL_PROBE_TTL_MS - 1 });
  c.eq(calls, 1, 'a definite answer is served from the cache for the whole TTL');
  await probeAuthEmail({ env: env(), fetchImpl: counted, now: t0 + AUTH_EMAIL_PROBE_TTL_MS + 1 });
  c.eq(calls, 2, 'and asked again after it');
  await probeAuthEmail({ env: env({ PRI_RESEND_API_KEY: `${KEY}_rotated` }), fetchImpl: counted, now: t0 + AUTH_EMAIL_PROBE_TTL_MS + 2 });
  c.eq(calls, 3, 'a rotated key is never answered from the old key’s cache entry');
  resetAuthEmailProbeCache();
  calls = 0;
  answer = async () => json(...REFUSAL.server500);
  await probeAuthEmail({ env: env(), fetchImpl: counted, now: t0 });
  await probeAuthEmail({ env: env(), fetchImpl: counted, now: t0 + AUTH_EMAIL_PROBE_RETRY_TTL_MS - 1 });
  c.eq(calls, 1, 'an unknown answer is still cached, so an outage cannot be hammered');
  answer = async () => domains(VERIFIED);
  const recovered = await probeAuthEmail({ env: env(), fetchImpl: counted, now: t0 + AUTH_EMAIL_PROBE_RETRY_TTL_MS + 1 });
  c.deq([calls, recovered.sender], [2, 'verified'], 'but only briefly: recovery is seen within the short retry window');
  resetAuthEmailProbeCache();

  // ── 3 · readiness ──────────────────────────────────────────────────────────
  // One real app for sections 3 and 5. The provider's host is answered here;
  // every other request (this suite's own HTTP to the app) passes through.
  Object.assign(process.env, { PRI_AUTH_EMAIL_PROVIDER: 'resend', PRI_RESEND_API_KEY: KEY, PRI_AUTH_EMAIL_FROM: FROM });
  const realFetch = globalThis.fetch;
  let providerAnswer = async () => json(...REFUSAL.keyInvalid400);
  const providerCalls = [];
  globalThis.fetch = async (url, init) => {
    if (!String(url?.url || url).startsWith('https://api.resend.com/')) return realFetch(url, init);
    providerCalls.push(String(url));
    return providerAnswer();
  };
  harness = await startApp({ engine: 'sqlite' });
  const db = harness.db;
  metrics.reset();
  const report = (probe, extraEnv = {}, options = {}) => readinessReport(db, { env: env(extraEnv), authEmailProbe: probe, probeWaitMs: 80, ...options });
  const viaFetch = answer2 => ({ env: probeEnv }) => probeAuthEmail({ env: probeEnv, fetchImpl: (url, init) => answer2(init), cache: false, timeoutMs: 40 });
  const readinessCases = [
    ['verified sender', viaFetch(async () => domains(VERIFIED)), 'ok', null, 'valid', 'verified', 'ready'],
    ['sending-only key', viaFetch(async () => json(...REFUSAL.restricted401)), 'ok', null, 'valid', 'unknown', 'ready'],
    ['invalid key (400)', viaFetch(async () => json(...REFUSAL.keyInvalid400)), 'failing', 'AUTH_EMAIL_KEY_INVALID', 'invalid', 'unknown', 'degraded'],
    ['invalid key (403)', viaFetch(async () => json(...REFUSAL.keyInvalid403)), 'failing', 'AUTH_EMAIL_KEY_INVALID', 'invalid', 'unknown', 'degraded'],
    ['unverified sender', viaFetch(async () => domains([{ name: 'mail.pri.example', status: 'failed' }])), 'failing', 'AUTH_EMAIL_SENDER_UNVERIFIED', 'valid', 'unverified', 'degraded'],
    ['provider timeout', viaFetch(init => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))), 'unknown', 'AUTH_EMAIL_PROVIDER_TIMEOUT', 'unknown', 'unknown', 'degraded'],
    ['network down', viaFetch(async () => { throw new TypeError('fetch failed'); }), 'unknown', 'AUTH_EMAIL_PROVIDER_UNREACHABLE', 'unknown', 'unknown', 'degraded'],
    ['provider 5xx', viaFetch(async () => json(...REFUSAL.server500)), 'unknown', 'RESEND_500', 'unknown', 'unknown', 'degraded'],
    ['provider 429', viaFetch(async () => json(...REFUSAL.rate429)), 'unknown', 'RESEND_429', 'unknown', 'unknown', 'degraded'],
    ['probe throws', async () => { throw new Error(KEY); }, 'unknown', 'AUTH_EMAIL_PROBE_FAILED', 'unknown', 'unknown', 'degraded'],
    ['probe still running', () => new Promise(resolve => setTimeout(() => resolve({ credential: 'valid', sender: 'verified', code: null }), 400)), 'probing', 'AUTH_EMAIL_PROBE_PENDING', 'unknown', 'unknown', 'degraded']
  ];
  for (const [label, probe, state, code, credential, sender, overall] of readinessCases) {
    const started = Date.now();
    const r = await report(probe);
    const check = r.checks.authEmail;
    c.deq([check.state, check.code, check.credential, check.sender], [state, code, credential, sender], `readiness, ${label}: authEmail is ${state}${code ? ` (${code})` : ''}`);
    c.deq([r.state, r.ready, r.failing], [overall, true, []], `readiness, ${label}: the replica is ${overall} and still serves (HTTP 200) — never not_ready`);
    if (code) c.ok(r.degraded.includes(code), `readiness, ${label}: the code is listed under degraded`);
    c.deq(Object.keys(check).sort(), ['code', 'credential', 'required', 'sender', 'state'], `readiness, ${label}: coded fields only`);
    c.eq(leaks(r).length, 0, `readiness, ${label}: no key, address or domain`);
    c.ok(Date.now() - started < 1_000, `readiness, ${label}: answered without waiting for the provider`);
  }
  const testSender = await report(viaFetch(async () => domains(VERIFIED)), { PRI_AUTH_EMAIL_FROM: 'Pri Learning <onboarding@resend.dev>' });
  c.deq([testSender.checks.authEmail.state, testSender.checks.authEmail.code, testSender.state, testSender.ready], ['degraded', 'AUTH_EMAIL_TEST_SENDER', 'degraded', true],
    'readiness: the shared test sender is degraded with its own code (it reaches only the account owner)');

  // A burst of readiness checks during a slow probe shares ONE provider call.
  let slowCalls = 0;
  const slow = () => { slowCalls += 1; return new Promise(resolve => setTimeout(() => resolve({ credential: 'valid', sender: 'verified', code: null }), 200)); };
  const burst = await Promise.all(Array.from({ length: 12 }, () => report(slow)));
  c.deq([slowCalls, burst.every(r => r.checks.authEmail.state === 'probing')], [1, true], 'twelve concurrent readiness checks make one provider call between them');
  await new Promise(resolve => setTimeout(resolve, 260));

  // Recent sends that all failed still degrade a deployment whose key is valid.
  metrics.reset();
  metrics.inc('auth_email_total', { outcome: 'failed' });
  let r = await report(viaFetch(async () => domains(VERIFIED)));
  c.deq([r.checks.authEmail.state, r.checks.authEmail.code, r.ready], ['failing', 'AUTH_EMAIL_DELIVERY_FAILING', true], 'sends that all failed are still reported, with the key valid');
  r = await report(viaFetch(async () => json(...REFUSAL.keyInvalid400)));
  c.eq(r.checks.authEmail.code, 'AUTH_EMAIL_KEY_INVALID', 'and the root cause (an invalid key) is named ahead of the symptom');
  metrics.reset();

  // The only auth-email state that takes a replica out is unchanged.
  r = await readinessReport(db, { env: { NODE_ENV: 'production', PRI_MFA_KEY: 'cd'.repeat(32) }, authEmailProbe: async () => { throw new Error('must not be called'); } });
  c.deq([r.ready, r.failing], [false, ['AUTH_EMAIL_NOT_CONFIGURED']], 'production with no transport at all is still not_ready');
  r = await readinessReport(db, { env: { NODE_ENV: 'development' }, authEmailProbe: async () => { throw new Error('must not be called'); } });
  c.deq([r.ready, r.state, r.checks.authEmail.state], [true, 'degraded', 'not_configured'], 'outside production it only degrades, and the provider is not probed');

  // ── 4 · the one-time-code sender ───────────────────────────────────────────
  const sendCases = [
    ['invalid key', async () => json(...REFUSAL.keyInvalid400), 'AUTH_EMAIL_KEY_INVALID'],
    ['unverified sender domain', async () => json(...REFUSAL.unverified403), 'AUTH_EMAIL_SENDER_UNVERIFIED'],
    ['recipient refused by the test sender', async () => json(...REFUSAL.testSender403), 'AUTH_EMAIL_TEST_SENDER_RECIPIENT_REFUSED'],
    ['quota exhausted', async () => json(...REFUSAL.quota429), 'AUTH_EMAIL_QUOTA_EXCEEDED'],
    ['provider 5xx', async () => json(...REFUSAL.server500), 'RESEND_500'],
    ['network failure', async () => { throw new TypeError(`fetch failed ${RECIPIENT} ${KEY}`); }, 'AUTH_EMAIL_PROVIDER_UNREACHABLE']
  ];
  for (const [label, fetchImpl, code] of sendCases) {
    metrics.reset();
    captured.length = 0;
    const send = createResendOtpEmailSender({ apiKey: KEY, from: FROM, fetchImpl });
    let thrown = null;
    try { await send({ challengeId: 'otp_test', to: RECIPIENT, code: CODE, purpose: 'sign-in' }); } catch (error) { thrown = error; }
    c.deq([thrown?.code, thrown?.status], [code, 503], `code send, ${label}: throws ${code}, a 503`);
    c.eq(leaks([thrown?.message, thrown?.code]).length, 0, `code send, ${label}: the error carries no address, key or code`);
    const line = captured.map(text => JSON.parse(text)).find(entry => entry.event === 'auth_email_failed');
    c.deq([line?.code, line?.provider, line?.level], [code, 'resend', 'warn'], `code send, ${label}: logged as auth_email_failed with the specific code`);
    c.deq(Object.keys(line || {}).sort(), ['code', 'event', 'level', 'provider', 'ts'], `code send, ${label}: and with nothing else`);
    c.eq(leaks(captured).length, 0, `code send, ${label}: no address, key or code in any log line`);
    const counters = metrics.snapshot().counters;
    c.ok(counters['auth_email_total{outcome=failed}']?.total === 1 && counters[`auth_email_failures_total{code=${code}}`]?.total === 1, `code send, ${label}: counted as a failure under its code`);
  }
  metrics.reset();
  let sentBody = null;
  const okSend = createResendOtpEmailSender({ apiKey: KEY, from: FROM, fetchImpl: async (url, init) => { sentBody = JSON.parse(init.body); return json(200, { id: '4ef9a417-02e9-4d39-ad75-9611e0fcc33c' }); } });
  const sent = await okSend({ challengeId: 'otp_ok', to: RECIPIENT, code: CODE, purpose: 'sign-in' });
  c.eq(sent.providerMessageId, '4ef9a417-02e9-4d39-ad75-9611e0fcc33c', 'an accepted code send returns the provider message id');
  c.deq([sentBody.from, sentBody.to, sentBody.subject.includes(CODE)], [FROM, [RECIPIENT], true], 'and was sent from the configured sender to the one recipient');
  c.eq(metrics.snapshot().counters['auth_email_total{outcome=sent}']?.total, 1, 'and is counted as sent');

  // The outbox transport (verification, reset and guardian links) uses the same codes.
  const linkTransport = createResendAuthEmailTransport({ apiKey: KEY, from: FROM, fetchImpl: async () => json(...REFUSAL.unverified403) });
  let linkError = null;
  try { await linkTransport({ outboxId: 'out_1', to: RECIPIENT, kind: 'verify-email', actionUrl: 'http://localhost:5173/account-action#action=verify-email&token=t' }); } catch (error) { linkError = error; }
  c.eq(linkError?.code, 'AUTH_EMAIL_SENDER_UNVERIFIED', 'a link email refused for an unverified sender carries the same specific code');
  c.eq(leaks([linkError?.message]).length, 0, 'and no provider text');

  // ── 5 · over HTTP: an explicit failure, the same for every address ─────────
  try {
    resetAuthEmailProbeCache();
    const known = 'known.markeraddr@example.test';
    await harness.db.run(`INSERT INTO accounts(id,email,name,password_hash,email_verified_at,role,age_basis,created_at,updated_at)
      VALUES ('acct_known', ?, 'Known', NULL, ?, 'student', 'adult', ?, ?)`, [known, Date.now(), Date.now(), Date.now()]);
    captured.length = 0;
    const answers = [];
    for (const destination of [known, 'nobody.markeraddr@example.test']) {
      const response = await harness.request('/v1/account/otp/request', { method: 'POST', body: { channel: 'email', destination } });
      answers.push([response.status, response.data?.error?.code, response.data?.error?.message, Object.keys(response.data || {}).sort().join(',')]);
      c.eq(leaks(response.text).length, 0, 'the refusal names no address, key or provider text');
    }
    c.deq(answers[0].slice(0, 2), [503, 'OTP_DELIVERY_FAILED'], 'a code that could not be sent is an explicit 503 OTP_DELIVERY_FAILED, never a silent 202');
    c.match(answers[0][2], /could not be sent/i, 'and the learner is told the code could not be sent');
    c.deq(answers[0], answers[1], 'a known and an unknown address get the identical answer: nothing is disclosed about either');
    const lines = captured.map(text => JSON.parse(text));
    c.eq(lines.filter(entry => entry.event === 'auth_email_failed' && entry.code === 'AUTH_EMAIL_KEY_INVALID').length, 2, 'each refused send is logged with AUTH_EMAIL_KEY_INVALID');
    c.eq(leaks(captured).length, 0, 'and no log line carries an address, the key or a code');
    c.eq((await harness.db.get('SELECT COUNT(*) AS n FROM otp_challenges WHERE consumed_at IS NULL')).n, 0, 'no live challenge is left behind for a code nobody received');

    const ready = await harness.request('/v1/ready');
    c.deq([ready.status, ready.data.state, ready.data.checks.authEmail.state, ready.data.checks.authEmail.code], [200, 'degraded', 'failing', 'AUTH_EMAIL_KEY_INVALID'],
      '/v1/ready over HTTP: 200, degraded, authEmail failing with AUTH_EMAIL_KEY_INVALID');
    c.eq(leaks(ready.text).length, 0, 'and its body carries no key, address or domain');

    // The provider recovers (or the key is replaced): both surfaces follow.
    providerAnswer = async () => domains(VERIFIED);
    resetAuthEmailProbeCache();
    metrics.reset();
    const healthy = await harness.request('/v1/ready');
    c.deq([healthy.status, healthy.data.checks.authEmail.state, healthy.data.checks.authEmail.sender], [200, 'ok', 'verified'], 'with a valid key and a verified sender, authEmail is ok again');
    c.ok(providerCalls.every(url => url === 'https://api.resend.com/emails' || url.startsWith('https://api.resend.com/domains')), 'only the send and the domain-list endpoints were ever called');
  } finally {
    globalThis.fetch = realFetch;
  }
  c.ok(true, 'the suite reached its end');

  console.log(`AUTH EMAIL READINESS: PASS — ${c.count()}/${c.count()} checks — a refused key and an unverified sender are reported by code instead of "ok", a sending-only key is valid, an outage is unknown, no probed state fails readiness, and a refused send is an explicit coded failure identical for every address.`);
} finally {
  setLogSink(null);
  if (harness) await harness.close?.();
  for (const [name, value] of Object.entries(prior)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  rmSync(scratch, { recursive: true, force: true });
}
