// tools/verify-deployment.mjs: the two opt-in production checks
// (--require-handwriting, --expect-config) and proof that, without them, the
// tool still sends exactly its three GETs and prints exactly the rows it always
// has, byte for byte (docs/operations/production-config-v1.md §2).
//
// Hermetic: the "deployment" is an in-process HTTP server; the CLI runs as a
// child process against it. No network, no credential, no production.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../server/platform/schemaVersions.js';
import {
  EXPECTED_CONFIG_END, EXPECTED_CONFIG_FORMAT, EXPECTED_CONFIG_START, HANDWRITING_REREADS,
  expectedConfigProblems, loadExpectedConfig, parseArgs, probeMismatches, verifyDeployment
} from './verify-deployment.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(ROOT, 'tools', 'verify-deployment.mjs');
const MANIFEST = join(ROOT, 'docs', 'operations', 'production-config-v1.md');
const execFileP = promisify(execFile);
let count = 0;
const ok = (value, message) => { assert.ok(value, message); count += 1; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); count += 1; };

const SHA = 'a'.repeat(40);
const identity = { releaseSha: SHA, buildTimestamp: '2026-10-02T00:00:00.000Z', version: '4.0.0' };

// A production deployment that matches the manifest in every probe.
function healthy() {
  return {
    '/v1/health': [200, {
      ok: true, service: 'pri-learning-platform', releaseIdentity: { ...identity },
      schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION),
      database: { engine: 'postgres', reachable: true }
    }],
    '/v1/ready': [200, {
      ready: true, state: 'ready', releaseSha: SHA, failing: [], degraded: [],
      checks: {
        database: { state: 'ok', code: null, engine: 'postgres', schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION) },
        authEmail: { state: 'ok', code: null, required: true, credential: 'valid', sender: 'verified' },
        paidCeiling: { state: 'ok', code: null },
        billing: { state: 'ok', code: null },
        handwriting: { state: 'ok', code: null },
        working: { state: 'ok', code: null },
        staffMfa: { state: 'ok', code: null }
      }
    }],
    '/release.json': [200, { ...identity }],
    '/features.json': [200, { placement: false, extendedTracks: false, examHandwriting: false, instrument: false, tutor: true, pastPapers: true, parentReport: true }],
    '/v1/tutor/status': [401, { error: { code: 'AUTH_REQUIRED' } }],
    '/v1/parent-report': [401, { error: { code: 'AUTH_REQUIRED' } }],
    '/v1/billing/config': [200, {
      display: { currency: 'INR', monthly: 199, annual: 1499, trialDays: null, advisoryOnly: true },
      products: { appleMonthly: 'com.prilearning.app.premium.monthly', appleAnnual: 'com.prilearning.app.premium.annual', googleMonthly: null, googleAnnual: null, webMonthly: null, webAnnual: null },
      webCheckout: { provider: 'razorpay', configured: false }
    }],
    '/v1/account/otp/channels': [200, { channels: { email: true, sms: false } }],
    '/v1/account/identity/providers': [200, { providers: { google: null, apple: null } }]
  };
}

let routes = healthy();
let readyQueue = []; // successive /v1/ready bodies (for the `probing` re-read)
const requests = [];
const server = createServer((req, res) => {
  requests.push(`${req.method} ${req.url}`);
  let entry = routes[req.url];
  if (req.url === '/v1/ready' && readyQueue.length) entry = readyQueue.shift();
  const [status, body] = entry || [404, { error: { code: 'NOT_FOUND' } }];
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const scratch = mkdtempSync(join(tmpdir(), 'pri-verify-deployment-'));
const noSleep = async () => {};
const run = (extra = {}) => verifyDeployment({ origin, sha: SHA, allowHttp: true, sleep: noSleep, ...extra });
const cli = async args => {
  try { const { stdout } = await execFileP(process.execPath, [TOOL, ...args], { encoding: 'utf8' }); return { code: 0, stdout, stderr: '' }; }
  catch (error) { return { code: error.code, stdout: error.stdout, stderr: error.stderr }; }
};
const reset = () => { routes = healthy(); readyQueue = []; requests.length = 0; };
// The manifest's own block, with its public origin pointed at the fake host.
const manifestConfig = loadExpectedConfig(MANIFEST);
const localConfig = { ...manifestConfig, publicOrigin: origin };

try {
  // ── 1 · the default behaviour is byte for byte what it was ────────────────
  // The rows and the summary main printed before these flags existed
  // (captured from tools/verify-deployment.mjs at 1d3829103 against this host).
  const golden = engineAndProven => [
    `  ✓ nominated SHA is a full 40-hex commit  (${SHA})`,
    '  ✓ /v1/health answers 200 ok  (status 200)',
    '  ✓ service is pri-learning-platform  (pri-learning-platform)',
    `  ✓ server release SHA is the nominated SHA  (running ${SHA})`,
    '  ✓ storage is persistent',
    '  ✓ database reachable',
    ...(engineAndProven ? ['  ✓ database engine is postgres  (running postgres)'] : []),
    `  ✓ schema_version is ${SCHEMA_VERSION}  (running ${SCHEMA_VERSION})`,
    `  ✓ billing_schema_version is ${BILLING_SCHEMA_VERSION}  (running ${BILLING_SCHEMA_VERSION})`,
    '  ✓ verification email provider configured',
    ...(engineAndProven ? ['  ✓ verification email proven: the provider accepts the key and does not report the sender unverified  (state ok, code none, credential valid, sender verified)'] : []),
    `  ✓ web client release.json equals server release identity  (web ${SHA})`,
    '  ✓ /v1/ready says this replica can serve  (ready)',
    `  ✓ /v1/ready reports the same SHA  (${SHA})`,
    // Main's web-checkout row (#727, Train 3), added after 1d3829103.
    '  ✓ web checkout is off, as the terms and refund policy say  (configured false)',
    `DEPLOYMENT VERIFIED: PASS — ${engineAndProven ? '15/15' : '13/13'}`,
    ''
  ].join('\n');
  // Main's web-checkout row (#727) reads /v1/billing/config as well.
  const threeGets = ['GET /v1/health', 'GET /release.json', 'GET /v1/ready', 'GET /v1/billing/config'].sort();
  for (const [name, args, proven] of [
    ['bare', ['--origin', origin, '--sha', SHA, '--allow-http'], false],
    ['--engine postgres --auth-email-proven', ['--origin', origin, '--sha', SHA, '--allow-http', '--engine', 'postgres', '--auth-email-proven'], true]
  ]) {
    reset();
    const out = await cli(args);
    eq([out.code, out.stdout], [0, golden(proven)], `default CLI (${name}) prints exactly the rows it always has`);
    eq([...requests].sort(), threeGets, `default CLI (${name}) sends exactly main's four GETs, once each`);
  }
  // The handwriting state and every probe path are ignored unless asked for.
  reset();
  routes['/v1/ready'][1].checks.handwriting = { state: 'unavailable', code: 'HANDWRITING_PROVIDER_AUTH' };
  routes['/v1/ready'][1].degraded = ['HANDWRITING_PROVIDER_AUTH'];
  routes['/v1/ready'][1].state = 'degraded';
  routes['/v1/tutor/status'] = [404, { error: { code: 'NOT_FOUND', message: 'Platform endpoint not found.' } }];
  const quiet = await run({ engine: 'postgres', authEmailProven: true });
  ok(quiet.ok && quiet.results.length === 15, "without the flags a degraded reader and a dark tutor change nothing: 15/15 as before (14 + main's web-checkout row)");
  eq([...requests].sort(), threeGets, "and nothing beyond main's four GETs is requested");

  // ── 2 · --require-handwriting ─────────────────────────────────────────────
  reset();
  let report = await run({ engine: 'postgres', authEmailProven: true, requireHandwriting: true });
  ok(report.ok && report.results.length === 16, 'a ready reader passes: 16/16');
  eq(report.results.at(-1), { ok: true, label: 'handwriting reader ready: /v1/ready checks.handwriting.state is ok', detail: 'state ok, code none' }, 'the handwriting row comes after every standard row');
  for (const [state, code] of [['degraded', 'HANDWRITING_PROVIDER_429'], ['unavailable', 'HANDWRITING_PROVIDER_AUTH'], ['not_configured', null]]) {
    reset();
    routes['/v1/ready'][1].checks.handwriting = { state, code };
    report = await run({ requireHandwriting: true });
    ok(!report.ok && report.results.at(-1).ok === false && report.results.at(-1).detail === `state ${state}, code ${code ?? 'none'}`, `a reader that is ${state} fails the release`);
  }
  reset();
  delete routes['/v1/ready'][1].checks.handwriting;
  report = await run({ requireHandwriting: true });
  ok(!report.ok && report.results.at(-1).detail === 'state missing, code none', 'a /v1/ready without a handwriting check fails');
  // `probing` is read again, a bounded number of times, then decided.
  reset();
  const probing = () => { const body = structuredClone(healthy()['/v1/ready'][1]); body.checks.handwriting = { state: 'probing', code: 'HANDWRITING_PROBE_PENDING' }; return [200, body]; };
  readyQueue = [probing(), probing(), healthy()['/v1/ready']];
  let sleeps = 0;
  report = await run({ requireHandwriting: true, sleep: async () => { sleeps += 1; } });
  ok(report.ok && sleeps === 2 && requests.filter(r => r === 'GET /v1/ready').length === 3, 'a probe still running is read again and passes once it answers ok');
  reset();
  readyQueue = Array.from({ length: 10 }, probing);
  sleeps = 0;
  report = await run({ requireHandwriting: true, sleep: async () => { sleeps += 1; } });
  ok(!report.ok && sleeps === HANDWRITING_REREADS && requests.filter(r => r === 'GET /v1/ready').length === 1 + HANDWRITING_REREADS
    && report.results.at(-1).detail === 'state probing, code HANDWRITING_PROBE_PENDING', `a probe that never answers fails after ${HANDWRITING_REREADS} re-reads, not forever`);

  // ── 3 · the manifest's machine-readable block ─────────────────────────────
  eq(manifestConfig.format, EXPECTED_CONFIG_FORMAT, 'the manifest block declares its format');
  eq(manifestConfig.publicOrigin, 'https://app.prilearning.com', 'the public origin is D5\'s app.prilearning.com');
  const probe = id => manifestConfig.probes.find(item => item.id === id);
  eq([probe('tutor-on')?.path, probe('tutor-on')?.status], ['/v1/tutor/status', 401], 'owner 10 Nov: the tutor route is mounted (401 without a session; a 404 means the switch is off)');
  eq(probe('web-build-tutor-on')?.json, { tutor: true }, 'owner 10 Nov: the web build was made with the tutor');
  eq([probe('parent-report-on')?.path, probe('parent-report-on')?.status], ['/v1/parent-report', 401], 'owner 10 Nov: the parent report is mounted');
  eq(probe('web-build-parent-report-on')?.json, { parentReport: true }, 'owner 10 Nov: the web build was made with the parent report');
  eq(probe('web-build-past-papers-on')?.json, { pastPapers: true }, 'owner 10 Nov: the web build was made with past papers');
  ok(!JSON.stringify(manifestConfig).includes('lineCheck'), 'the line check has no public probe: §3 H13 checks it is off');
  eq(probe('paid-ceiling-set')?.json, { 'checks.paidCeiling.state': 'ok' }, 'D21: the paid-call ceiling is configured');
  eq(probe('apple-products')?.json, { 'products.appleMonthly': 'com.prilearning.app.premium.monthly', 'products.appleAnnual': 'com.prilearning.app.premium.annual' }, 'the Apple product ids are the App Store Connect ones');
  eq(probe('display-prices')?.json, { 'display.currency': 'INR', 'display.monthly': 199, 'display.annual': 1499 }, 'D19: ₹199 a month, ₹1,499 a year');
  eq(probe('billing-provider-complete')?.json, { 'checks.billing.state': 'ok' }, 'Apple trust and App ID are set with the products');
  eq(probe('auth-email-sender')?.json, { 'checks.authEmail.state': 'ok', 'checks.authEmail.credential': 'valid', 'checks.authEmail.sender': { oneOf: ['verified', 'unknown'] } }, 'the sender is never unverified, invalid or the test sender');
  eq([probe('sign-in-channels')?.json, probe('provider-sign-in-off')?.json], [{ 'channels.email': true, 'channels.sms': false }, { 'providers.google': null, 'providers.apple': null }], 'D3: email code on; SMS, Apple and Google sign-in off');
  eq([probe('test-mailbox-off')?.path, probe('test-mailbox-off')?.json], ['/v1/ready', { 'checks.testMailbox.state': { oneOf: ['off'], orAbsent: true } }], 'the staging-only test mailbox is off in production (absent until L2\'s change lands)');
  const doc = readFileSync(MANIFEST, 'utf8');
  for (const [decision, needle] of [['D4', 'PRI_FEATURE_TUTOR'], ['D12', 'PRI_METHOD_MARKS'], ['D18', 'PRI_CHILD_ERASURE=enforce'], ['D21', 'PRI_PAID_CALLS_PER_HOUR=120'], ['D21', 'PRI_PAID_CALLS_PER_DAY=300'],
    ['D22', 'PRI_PARENT_REPORT'], ['#653', 'PRI_TRUSTED_PROXY_HOPS'], ['D5', 'PRI_PUBLIC_ORIGIN=https://app.prilearning.com'], ['Apple billing', 'PRI_APPLE_ROOT_CA_PEM'], ['sender', 'verify@mail.prilearning.com']]) {
    ok(doc.includes(needle), `the manifest table states ${decision}: ${needle}`);
  }
  ok(doc.includes(`DEPLOYMENT VERIFIED: PASS — ${15 + 1 + manifestConfig.probes.length + 1}/${15 + 1 + manifestConfig.probes.length + 1}`), 'the manifest states the full count the production check prints');
  // The owner's Railway click-list pastes these values: it must agree with the manifest, hold secrets
  // only as <placeholders>, and set none of the variables the manifest requires unset.
  const clickList = readFileSync(join(ROOT, 'docs', 'release', 'OWNER-CLICK-LIST-APPLE-RAILWAY.md'), 'utf8');
  const block = (clickList.match(/```dotenv\n([\s\S]*?)\n```/) || [])[1] || '';
  const env = Object.fromEntries(block.split('\n').filter(line => /^[A-Z0-9_]+=/.test(line)).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  eq([env.PRI_PUBLIC_ORIGIN, env.PRI_APPLE_MONTHLY_PRODUCT_ID, env.PRI_APPLE_ANNUAL_PRODUCT_ID],
    [manifestConfig.publicOrigin, probe('apple-products').json['products.appleMonthly'], probe('apple-products').json['products.appleAnnual']], 'the click-list pastes the manifest\'s origin and Apple product ids');
  eq([env.PRI_DISPLAY_CURRENCY, Number(env.PRI_DISPLAY_MONTHLY_PRICE), Number(env.PRI_DISPLAY_ANNUAL_PRICE)],
    [probe('display-prices').json['display.currency'], probe('display-prices').json['display.monthly'], probe('display-prices').json['display.annual']], 'and its D19 display prices');
  eq([env.PRI_PAID_CALLS_PER_HOUR, env.PRI_PAID_CALLS_PER_DAY, env.PRI_APPLE_ENVIRONMENTS, env.NODE_ENV], ['120', '300', 'Production', 'production'], 'and D21\'s ceilings, Production-only Apple and NODE_ENV');
  ok(/verify@mail\.prilearning\.com/.test(env.PRI_AUTH_EMAIL_FROM || ''), 'and the auth email sender of row 9');
  for (const secret of ['PRI_RESEND_API_KEY', 'PRI_METRICS_TOKEN', 'PRI_DATABASE_URL', 'PRI_APPLE_APP_ID', 'PRI_TRUSTED_PROXY_HOPS']) ok(/^<[^>]+>$/.test(env[secret] || ''), `${secret} is a <placeholder> the owner fills, never a value`);
  eq([env.PRI_FEATURE_TUTOR, env.PRI_TUTOR_CALLS_PER_ACCOUNT_DAY, env.PRI_TUTOR_CALLS_PER_ACCOUNT_DAY_PREMIUM, env.PRI_PAST_PAPERS, env.PRI_PARENT_REPORT], ['1', '40', '120', '1', 'on'], 'owner 10 Nov: tutor on with its 40 / 120 daily allowances, past papers on, parent report on');
  const mustBeUnset = ['PRI_FEATURE_LINE_CHECK', 'PRI_FEATURE_STEP_COACH', 'PRI_METHOD_MARKS', 'PRI_METHOD_MARKS_EXAMINER_RESULT', 'PRI_PARENT_REPORT_EMAILS', 'PRI_SMS_PROVIDER', 'PRI_GOOGLE_CLIENT_IDS', 'PRI_GOOGLE_WEB_CLIENT_ID', 'PRI_APPLE_CLIENT_IDS', 'PRI_APPLE_WEB_CLIENT_ID', 'PRI_APPLE_ALLOW_SANDBOX'];
  ok(mustBeUnset.every(name => !(name in env)) && Object.keys(env).filter(name => name.startsWith('PRI_TUTOR_')).sort().join() === 'PRI_TUTOR_CALLS_PER_ACCOUNT_DAY,PRI_TUTOR_CALLS_PER_ACCOUNT_DAY_PREMIUM', 'the pasted block sets none of the variables the manifest requires unset');
  ok(mustBeUnset.every(name => clickList.split('**B2')[0].includes(`\`${name}\``)), 'and step B1 names every one of them for deletion');

  // ── 4 · --expect-config against a matching and a drifting deployment ─────
  reset();
  report = await run({ engine: 'postgres', authEmailProven: true, requireHandwriting: true, expectedConfig: localConfig });
  ok(report.ok && report.results.length === 15 + 1 + localConfig.probes.length + 1, `a deployment matching the manifest passes ${report.results.length}/${report.results.length}`);
  eq(report.results.slice(0, 15).map(r => r.label), (await run({ engine: 'postgres', authEmailProven: true })).results.map(r => r.label), 'the standard rows keep their order; the new rows only follow them');
  reset();
  await run({ expectedConfig: localConfig });
  eq([...new Set(requests)].length, requests.length, 'each path is requested once: the probes reuse /v1/ready and each other');
  ok(requests.every(r => r.startsWith('GET ')), 'every request the config check makes is a GET');
  const drifts = [
    ['tutor-on', 'the tutor switch off on the server', r => { r['/v1/tutor/status'] = [404, { error: { code: 'NOT_FOUND', message: 'Platform endpoint not found.' } }]; }],
    ['web-build-tutor-on', 'a web build made without the tutor', r => { r['/features.json'][1].tutor = false; }],
    ['parent-report-on', 'the parent report switch off on the server', r => { r['/v1/parent-report'] = [404, { error: { code: 'NOT_FOUND', message: 'Platform endpoint not found.' } }]; }],
    ['web-build-parent-report-on', 'a web build made without the parent report', r => { r['/features.json'][1].parentReport = false; }],
    ['web-build-past-papers-on', 'a web build made without past papers', r => { r['/features.json'][1].pastPapers = false; }],
    ['paid-ceiling-set', 'no paid-call ceiling (D21)', r => { r['/v1/ready'][1].checks.paidCeiling = { state: 'missing', code: 'PAID_CAPACITY_NOT_CONFIGURED' }; }],
    ['apple-products', 'a wrong Apple product id', r => { r['/v1/billing/config'][1].products.appleAnnual = 'com.prilearning.app.premium.yearly'; }],
    ['display-prices', 'a display price that is not D19', r => { r['/v1/billing/config'][1].display.monthly = 299; }],
    ['billing-provider-complete', 'Apple products without trust or App ID', r => { r['/v1/ready'][1].checks.billing = { state: 'incomplete', code: 'BILLING_CONFIG_INCOMPLETE' }; }],
    ['auth-email-sender', 'an unverified sender domain', r => { r['/v1/ready'][1].checks.authEmail.sender = 'unverified'; r['/v1/ready'][1].checks.authEmail.state = 'failing'; }],
    ['auth-email-sender', 'the provider\'s shared test sender', r => { r['/v1/ready'][1].checks.authEmail.sender = 'test_sender'; r['/v1/ready'][1].checks.authEmail.state = 'degraded'; }],
    ['sign-in-channels', 'SMS on (D3)', r => { r['/v1/account/otp/channels'][1].channels.sms = true; }],
    ['provider-sign-in-off', 'Google web sign-in on (D3)', r => { r['/v1/account/identity/providers'][1].providers.google = { clientId: 'x.apps.googleusercontent.com' }; }],
    ['provider-sign-in-off', 'a providers answer missing a field', r => { delete r['/v1/account/identity/providers'][1].providers.apple; }],
    ['test-mailbox-off', 'the staging test mailbox on in production', r => { r['/v1/ready'][1].checks.testMailbox = { state: 'on', code: null }; }],
    ['test-mailbox-off', 'a test mailbox reporting no state', r => { r['/v1/ready'][1].checks.testMailbox = { code: null, state: null }; }]
  ];
  for (const [id, name, mutate] of drifts) {
    reset();
    mutate(routes);
    report = await run({ expectedConfig: localConfig });
    const failed = report.results.filter(r => !r.ok).map(r => r.label);
    ok(!report.ok && failed.length === 1 && failed[0].startsWith(`public config ${id} `), `fails on ${name}, and only on ${id}`);
  }
  reset();
  routes['/v1/billing/config'][1].display.monthly = 299;
  report = await run({ expectedConfig: localConfig });
  eq(report.results.find(r => !r.ok)?.detail, 'display.monthly 299, expected 199', 'a mismatch names the field, the value seen and the value expected');
  // orAbsent: a field that does not exist yet passes; once it exists only the listed values pass.
  reset();
  report = await run({ expectedConfig: localConfig });
  ok(report.ok && report.results.find(r => /test-mailbox-off/.test(r.label))?.detail === 'checks.testMailbox.state missing', 'a build without the test mailbox passes test-mailbox-off (the field is absent)');
  reset();
  routes['/v1/ready'][1].checks.testMailbox = { state: 'off', code: null };
  ok((await run({ expectedConfig: localConfig })).ok, 'a test mailbox reporting off passes');
  reset();
  routes['/v1/ready'][1].checks.testMailbox = { state: 'on', code: null };
  report = await run({ expectedConfig: localConfig });
  eq(report.results.find(r => !r.ok)?.detail, 'checks.testMailbox.state "on", expected one of "off" (or absent)', 'a test mailbox reporting on fails, and the message says absent would have passed');
  eq(probeMismatches({ json: { a: { oneOf: [1] } } }, { status: 200, body: {} }), ['a missing, expected one of 1'], 'without orAbsent a missing field still fails a oneOf');
  // The public origin must serve this release; it is not merely reachable.
  const other = createServer((req, res) => {
    const body = req.url === '/v1/health' ? { ...healthy()['/v1/health'][1], releaseIdentity: { ...identity, releaseSha: 'b'.repeat(40) } }
      : req.url === '/release.json' ? { ...identity, releaseSha: 'b'.repeat(40) } : {};
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  await new Promise(resolve => other.listen(0, '127.0.0.1', resolve));
  try {
    reset();
    report = await run({ expectedConfig: { ...localConfig, publicOrigin: `http://127.0.0.1:${other.address().port}` } });
    ok(!report.ok && report.results.at(-1).label.startsWith('public origin ') && report.results.at(-1).ok === false, 'a public origin serving another release fails');
  } finally { other.close(); }
  reset();
  report = await run({ expectedConfig: { ...localConfig, publicOrigin: 'http://127.0.0.1:1' } });
  ok(!report.ok && report.results.at(-1).ok === false, 'an unreachable public origin fails, it does not throw');
  // An https deployment served by a stub fetch (no network): the manifest's
  // public origin is held to https exactly as --origin is.
  const stubbed = [];
  const stubFetch = async url => {
    const { origin: host, pathname } = new URL(url);
    stubbed.push(`${host}${pathname}`);
    const [status, body] = healthy()[pathname] || [404, {}];
    return { status, json: async () => structuredClone(body) };
  };
  report = await verifyDeployment({ origin: 'https://app.prilearning.com', sha: SHA, fetchImpl: stubFetch, expectedConfig: manifestConfig, sleep: noSleep });
  ok(report.ok && report.results.at(-1).detail === `server ${SHA}, web ${SHA} (the verified origin)`, 'verifying app.prilearning.com itself proves the public origin with the reads already made');
  ok(stubbed.every(item => item.startsWith('https://app.prilearning.com/')), 'and asks no other host');
  report = await verifyDeployment({ origin: 'https://pri.up.railway.app', sha: SHA, fetchImpl: stubFetch, expectedConfig: { ...manifestConfig, publicOrigin: 'http://app.prilearning.com' }, sleep: noSleep });
  eq([report.ok, report.results.at(-1).detail], [false, 'publicOrigin must be https://'], 'without --allow-http a plain-http public origin is refused, not fetched');
  ok(!stubbed.some(item => item.startsWith('http://')), 'nothing was requested over plain http');

  // ── 5 · a malformed manifest is refused before anything is requested ────
  const bad = [
    ['an unknown top-level key', c => ({ ...c, extra: true })],
    ['the wrong format', c => ({ ...c, format: 'something-else' })],
    ['another version', c => ({ ...c, version: 2 })],
    ['no probes', c => ({ ...c, probes: [] })],
    ['a probe with a query', c => ({ ...c, probes: [{ id: 'q', decision: 'x', path: '/v1/ready?x=1', status: 200 }] })],
    ['a probe with a dot segment', c => ({ ...c, probes: [{ id: 'dots', decision: 'x', path: '/v1/../admin', status: 200 }] })],
    ['a probe of another host', c => ({ ...c, probes: [{ id: 'host', decision: 'x', path: 'https://evil.example/v1/ready', status: 200 }] })],
    ['a probe outside /v1', c => ({ ...c, probes: [{ id: 'outside', decision: 'x', path: '/admin', status: 200 }] })],
    ['a duplicate probe id', c => ({ ...c, probes: [c.probes[0], c.probes[0]] })],
    ['a probe expecting nothing', c => ({ ...c, probes: [{ id: 'empty', decision: 'x', path: '/v1/ready' }] })],
    ['an unknown probe key', c => ({ ...c, probes: [{ ...c.probes[0], method: 'POST' }] })],
    ['an empty oneOf', c => ({ ...c, probes: [{ id: 'one', decision: 'x', path: '/v1/ready', json: { 'checks.authEmail.sender': { oneOf: [] } } }] })],
    ['orAbsent without oneOf', c => ({ ...c, probes: [{ id: 'abs', decision: 'x', path: '/v1/ready', json: { 'checks.testMailbox.state': { orAbsent: true } } }] })],
    ['orAbsent that is not true', c => ({ ...c, probes: [{ id: 'abs', decision: 'x', path: '/v1/ready', json: { 'checks.testMailbox.state': { oneOf: ['off'], orAbsent: 'yes' } } }] })],
    ['a matcher with an unknown key', c => ({ ...c, probes: [{ id: 'abs', decision: 'x', path: '/v1/ready', json: { 'checks.testMailbox.state': { oneOf: ['off'], orMissing: true } } }] })],
    ['a public origin with a path', c => ({ ...c, publicOrigin: 'https://app.prilearning.com/app' })]
  ];
  for (const [name, mutate] of bad) {
    const config = mutate(structuredClone(manifestConfig));
    ok(expectedConfigProblems(config).length > 0, `refused: ${name}`);
    reset();
    await assert.rejects(() => run({ expectedConfig: config }), /expected config/); count += 1;
    eq(requests.length, 0, `nothing is requested for a manifest with ${name}`);
  }
  eq(probeMismatches({ status: 404, json: { 'a.b': null } }, { status: 404, body: { a: {} } }), ['a.b missing, expected null'], 'a missing field never equals null');

  // ── 6 · the CLI ───────────────────────────────────────────────────────────
  const parsed = parseArgs(['--origin', 'https://x.example', '--sha', SHA, '--require-handwriting', '--expect-config', MANIFEST]);
  ok(parsed.requireHandwriting === true && parsed.expectConfig === MANIFEST, 'both flags parse');
  const plain = parseArgs(['--origin', 'https://x.example', '--sha', SHA]);
  ok(plain.requireHandwriting === false && plain.expectConfig === null, 'both are off unless given');
  assert.throws(() => parseArgs(['--origin', 'https://x.example', '--sha', SHA, '--expect-config'])); count += 1;
  const write = (name, text) => { const path = join(scratch, name); writeFileSync(path, text); return path; };
  const asMarkdown = config => `# fixture\n\n${EXPECTED_CONFIG_START}\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\n${EXPECTED_CONFIG_END}\n`;
  reset();
  let out = await cli(['--origin', origin, '--sha', SHA, '--allow-http', '--engine', 'postgres', '--auth-email-proven', '--require-handwriting', '--expect-config', write('local.md', asMarkdown(localConfig))]);
  const total = 15 + 1 + localConfig.probes.length + 1;
  ok(out.code === 0 && out.stdout.endsWith(`DEPLOYMENT VERIFIED: PASS — ${total}/${total}\n`), `the CLI passes a matching deployment ${total}/${total}`);
  ok(out.stdout.startsWith(golden(true).split('\nDEPLOYMENT VERIFIED')[0]), 'and prints the standard rows first, unchanged');
  reset();
  out = await cli(['--origin', origin, '--sha', SHA, '--allow-http', '--expect-config', write('local.json', JSON.stringify(localConfig))]);
  ok(out.code === 0, 'a .json manifest is read whole');
  reset();
  routes['/v1/tutor/status'] = [404, { error: { code: 'NOT_FOUND', message: 'Platform endpoint not found.' } }];
  out = await cli(['--origin', origin, '--sha', SHA, '--allow-http', '--expect-config', write('drift.md', asMarkdown(localConfig))]);
  ok(out.code === 1 && /✗ public config tutor-on \(AI tutor on \(server\), owner 10 Nov\): GET \/v1\/tutor\/status {2}\(status 404, expected 401\)/.test(out.stdout), 'a drift exits 1 and names the probe');
  for (const [name, text] of [
    ['no block', '# nothing here\n'],
    ['two blocks', asMarkdown(localConfig) + asMarkdown(localConfig)],
    ['not fenced json', `${EXPECTED_CONFIG_START}\n{}\n${EXPECTED_CONFIG_END}\n`],
    ['malformed', asMarkdown({ ...localConfig, version: 3 })]
  ]) {
    reset();
    out = await cli(['--origin', origin, '--sha', SHA, '--allow-http', '--expect-config', write(`bad-${name.replace(/\s/g, '-')}.md`, text)]);
    ok(out.code === 2 && /--expect-config/.test(out.stderr) && requests.length === 0, `a manifest with ${name} is a usage error (exit 2) and nothing is requested`);
  }
  reset();
  out = await cli(['--origin', origin, '--sha', SHA, '--allow-http', '--expect-config', join(scratch, 'missing.md')]);
  ok(out.code === 2 && /no such file/.test(out.stderr), 'a missing manifest is a usage error');

  // ── --edition: one deployment, one edition, server and client alike (plan E2) ──
  const asEdition = (server, client) => {
    reset();
    if (server !== undefined) routes['/v1/health'][1].edition = server;
    if (client !== undefined) routes['/features.json'][1].edition = client;
  };
  const editionRows = report => report.results.slice(-3).map(item => [item.ok, item.label]);
  asEdition('priyabhata', 'priyabhata');
  let checked = await run({ edition: 'priyabhata' });
  ok(checked.ok && checked.results.length === 13 + 3, 'a Priyabhata deployment passes --edition priyabhata, with three more rows');
  eq(editionRows(checked), [[true, 'server edition is priyabhata'], [true, 'web client was built for priyabhata'], [true, 'server and web client are the same edition']], 'the three rows name the server, the client and their agreement');
  eq([...requests].sort(), [...threeGets, 'GET /features.json'].sort(), '--edition costs exactly one more GET (/features.json)');
  asEdition('priyabhata', 'priyabhata');
  checked = await run({ edition: 'prithagoras' });
  ok(!checked.ok, '--edition prithagoras FAILS against a Priyabhata deployment');
  eq(editionRows(checked), [[false, 'server edition is prithagoras'], [false, 'web client was built for prithagoras'], [true, 'server and web client are the same edition']], 'both sides are reported as the wrong edition, and as agreeing with each other');
  asEdition('prithagoras', 'prithagoras');
  ok((await run({ edition: 'prithagoras' })).ok, 'a Prithagoras deployment passes --edition prithagoras');
  asEdition('prithagoras', 'priyabhata');
  checked = await run({ edition: 'prithagoras' });
  eq(editionRows(checked), [[true, 'server edition is prithagoras'], [false, 'web client was built for prithagoras'], [false, 'server and web client are the same edition']], 'a Prithagoras server shipping a Priyabhata client fails');
  asEdition('priyabhata', 'prithagoras');
  ok(!(await run({ edition: 'prithagoras' })).ok && !(await run({ edition: 'priyabhata' })).ok, 'a split deployment passes under neither edition');
  asEdition(undefined, undefined);
  checked = await run({ edition: 'priyabhata' });
  eq(editionRows(checked).map(([pass]) => pass), [false, false, false], 'a deployment from before editions (no edition on either side) fails all three rows, never passes by both being absent');
  asEdition('priyabhata', undefined);
  ok(!(await run({ edition: 'priyabhata' })).ok, 'a client build that names no edition fails');
  asEdition('priyabhata', 'priyabhata');
  delete routes['/features.json'];
  checked = await run({ edition: 'priyabhata' });
  ok(!checked.ok && checked.results.some(item => !item.ok && item.label === 'web client was built for priyabhata' && item.detail === 'status 404'), 'a deployment with no /features.json fails and says so');
  asEdition('priyabhata', 'priyabhata');
  out = await cli(['--origin', origin, '--sha', SHA, '--allow-http', '--edition', 'prithagoras']);
  ok(out.code === 1 && /✗ server edition is prithagoras {2}\(\/v1\/health edition "priyabhata"\)/.test(out.stdout) && out.stdout.endsWith('DEPLOYMENT VERIFIED: FAIL — 14/16\n'), 'the CLI exits 1 for --edition prithagoras against a Priyabhata deployment and names what is running');
  asEdition('priyabhata', 'priyabhata');
  out = await cli(['--origin', origin, '--sha', SHA, '--allow-http', '--edition', 'priyabhata']);
  ok(out.code === 0 && out.stdout.startsWith(golden(false).split('\nDEPLOYMENT VERIFIED')[0]) && out.stdout.endsWith('DEPLOYMENT VERIFIED: PASS — 16/16\n'), 'the CLI passes the right edition 16/16, with the standard rows first and unchanged');
  reset();
  out = await cli(['--origin', origin, '--sha', SHA, '--allow-http', '--edition', 'typo']);
  ok(out.code === 2 && /--edition must be one of priyabhata, prithagoras/.test(out.stderr) && requests.length === 0, 'an unknown edition is a usage error (exit 2) and nothing is requested');
  eq(parseArgs(['--origin', origin, '--sha', SHA]).edition, null, 'without --edition no edition is expected');
} finally {
  server.close();
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`VERIFY DEPLOYMENT FLAGS: PASS — ${count}/${count} checks`);
