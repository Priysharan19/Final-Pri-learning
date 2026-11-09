// tools/release-alert-drill.mjs against a fake staging (in-process HTTP): the
// drill sends exactly the rule's threshold of coded crash reports, confirms the
// FIRING email only from the notifier's own counter, always deletes its test
// account, never prints the token or the password, and cannot be pointed
// anywhere but staging. Hermetic: no network, no provider, no mailbox.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALERT_RULES } from '../server/platform/metrics.js';
import { STAGING_ORIGIN } from '../scripts/release-nominate.mjs';
import { DRILL_CODE, DRILL_RULE, DRILL_SURFACE, POLL_MS, PUBLIC_ORIGINS, WAIT_MS, drillReports, notifierCounts, parseArgs, runDrill } from './release-alert-drill.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;
const ok = (value, message) => { assert.ok(value, message); count += 1; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); count += 1; };

// ── the numbers the drill rests on are the code's ──────────────────────────
const rule = ALERT_RULES.find(item => item.id === DRILL_RULE);
eq(drillReports(), rule.thresholds.count, `the drill sends exactly ${DRILL_RULE}'s threshold (${rule.thresholds.count})`);
const telemetry = readFileSync(join(ROOT, 'server', 'platform', 'telemetry.js'), 'utf8');
const limit = telemetry.match(/ERROR_REPORT_RATE_LIMIT = Object\.freeze\(\{ limit: (\d+), windowMs: (\d+) \* 60 \* 1000 \}\)/);
ok(limit && Number(limit[1]) >= rule.thresholds.count && Number(limit[2]) <= rule.thresholds.minutes,
  `one account may send the threshold inside the rule's ${rule.thresholds.minutes}-minute window (rate limit ${limit?.[1]} per ${limit?.[2]} minutes), so the drill fires the rule without a second account`);
ok(/router\.post\('\/error', rateLimit\(db, 'telemetry-error', ERROR_REPORT_RATE_LIMIT\)/.test(telemetry) && /router\.use\(requireSession\(db\)\)/.test(telemetry), 'the crash-report route needs a session and is limited per account, as the drill assumes');
const notifier = readFileSync(join(ROOT, 'server', 'platform', 'alertNotifier.js'), 'utf8');
ok(/CLIENT_ERROR_SPIKE: 'warning'/.test(notifier) && /`\[Pri \$\{environment\}\] \$\{state\} \$\{ruleId\} \(\$\{severity\}\)`/.test(notifier), 'the email subject the drill tells the owner to expect is the notifier\'s');

// ── arguments: staging only ─────────────────────────────────────────────────
assert.throws(() => parseArgs(['--origin', 'https://final-pri-learning-production.up.railway.app']), /Unknown argument: --origin/); count += 1;
assert.throws(() => parseArgs(['--public-origin', 'https://evil.example']), /--public-origin must be one of/); count += 1;
eq(parseArgs([]), { publicOrigin: STAGING_ORIGIN, wait: true }, 'by default the Origin is staging\'s own and the drill waits for the email count');
eq(parseArgs(['--public-origin', 'https://app.prilearning.com', '--no-wait']), { publicOrigin: 'https://app.prilearning.com', wait: false }, 'app.prilearning.com is accepted as the Origin while it points at staging');
ok(PUBLIC_ORIGINS.length === 2 && !PUBLIC_ORIGINS.some(o => /production/.test(o)), 'no production origin is ever accepted');

// ── a fake staging ──────────────────────────────────────────────────────────
const TOKEN = 'metrics-token-not-for-output-0123456789abcdef';
let state;
const fresh = (overrides = {}) => ({
  publicOrigin: STAGING_ORIGIN, registered: null, reports: [], deleted: false, requests: [], writes: [],
  firingAfter: drillReports(), notifier: 'sends', polls: 0, refuseReportAt: null, registerCode: null, deleteFails: false, ...overrides
});
const server = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : null;
  const send = (status, data, cookies = []) => { res.writeHead(status, { 'content-type': 'application/json', ...(cookies.length ? { 'set-cookie': cookies } : {}) }); res.end(JSON.stringify(data)); };
  state.requests.push(`${req.method} ${req.url}`);
  const cookie = String(req.headers.cookie || '');
  const signedIn = cookie.includes('pri_cloud_session=s1') && cookie.includes('pri_csrf=c1');
  if (req.method !== 'GET') {
    state.writes.push({ path: req.url, origin: req.headers.origin, csrf: req.headers['x-pri-csrf'] || null });
    if (req.headers.origin !== state.publicOrigin) return send(403, { error: { code: 'ORIGIN_REJECTED' } });
  }
  if (req.method === 'POST' && req.url === '/v1/account/register') {
    if (state.registerCode) return send(400, { error: { code: state.registerCode } });
    state.registered = body;
    return send(201, { account: { id: 'acct_drill' }, verificationRequired: true }, ['pri_cloud_session=s1; Path=/; HttpOnly', 'pri_csrf=c1; Path=/']);
  }
  if (req.method === 'POST' && req.url === '/v1/telemetry/error') {
    if (!signedIn || req.headers['x-pri-csrf'] !== 'c1') return send(401, { error: { code: 'AUTH_REQUIRED' } });
    if (state.refuseReportAt !== null && state.reports.length + 1 >= state.refuseReportAt) return send(429, { error: { code: 'RATE_LIMITED' } });
    state.reports.push(body);
    return send(202, { accepted: 1 });
  }
  if (req.method === 'GET' && req.url === '/v1/metrics') {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: { code: 'METRICS_UNAUTHORIZED' } });
    state.polls += 1;
    const firing = state.reports.length >= state.firingAfter;
    const counters = {};
    if (firing && state.polls >= 3) {
      const outcome = { sends: 'firing_sent', disabled: 'disabled', fails: 'failed' }[state.notifier];
      if (outcome) counters[`alert_notifications_total{outcome=${outcome},rule=${DRILL_RULE}}`] = { total: 1, last5m: 1, last15m: 1 };
    }
    counters[`alert_notifications_total{outcome=firing_sent,rule=HTTP_5XX_SPIKE}`] = { total: 7, last5m: 0, last15m: 0 };
    return send(200, { counters, alerts: ALERT_RULES.map(r => ({ id: r.id, firing: firing && r.id === DRILL_RULE })), firing: firing ? [DRILL_RULE] : [] });
  }
  if (req.method === 'DELETE' && req.url === '/v1/account') {
    if (!signedIn || state.deleteFails || body?.password !== state.registered?.password || body?.accountId !== 'acct_drill') return send(401, { error: { code: 'REAUTH_REQUIRED' } });
    state.deleted = true;
    return send(200, { deleted: true }, ['pri_cloud_session=; Path=/; Max-Age=0', 'pri_csrf=; Path=/; Max-Age=0']);
  }
  send(404, { error: { code: 'NOT_FOUND' } });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const clock = () => { let t = 0; return { now: () => t, sleep: async ms => { t += ms; } }; };
const drill = (overrides = {}, options = {}) => { state = fresh(overrides); const c = clock(); return runDrill({ base, token: TOKEN, publicOrigin: state.publicOrigin, now: c.now, sleep: c.sleep, stamp: 'test01', ...options }); };
const leaks = result => result.lines.some(line => line.includes(TOKEN) || (state.registered && line.includes(state.registered.password)));

try {
  // ── the drill fires the rule and confirms the email from the notifier's count
  let result = await drill();
  eq([result.ok, result.outcome], [true, 'fired'], 'the drill fires CLIENT_ERROR_SPIKE and sees the notifier count a FIRING email for it');
  eq(state.reports.length, drillReports(), 'it sends exactly the threshold of reports, not one more');
  ok(state.reports.every(r => r.code === DRILL_CODE && r.surface === DRILL_SURFACE && r.platform === 'web' && r.scope === 'app' && /^[0-9a-f]{16}$/.test(r.fingerprint)), 'every report is coded ALERT_DRILL from the alert-drill surface, with no free text');
  ok(/^delivered\+pri-alert-drill-test01@resend\.dev$/.test(state.registered.email) && state.registered.isAdult === true, 'the test account is an adult at a Resend sink address, never a person');
  ok(state.deleted, 'the test account is deleted at the end');
  ok(state.writes.every(w => w.origin === STAGING_ORIGIN) && state.writes.filter(w => w.path !== '/v1/account/register').every(w => w.csrf === 'c1'), 'every write carries the expected Origin and, once signed in, the CSRF token');
  ok(!leaks(result), 'neither the metrics token nor the password appears in the output');
  ok(result.lines.some(line => /1 new/.test(line)), 'a FIRING email counted for another rule is not mistaken for the drill\'s');
  eq(notifierCounts({ counters: { 'alert_notifications_total{outcome=firing_sent,rule=HTTP_5XX_SPIKE}': { total: 9 }, 'alert_notifications_total{outcome=firing_sent,rule=CLIENT_ERROR_SPIKE}': { total: 2 } } }), { firingSent: 2, disabled: 0, failed: 0 }, 'notifierCounts reads only the drill rule\'s counters');

  result = await drill({ publicOrigin: 'https://app.prilearning.com' });
  ok(result.outcome === 'fired' && state.writes.every(w => w.origin === 'https://app.prilearning.com'), 'with app.prilearning.com on staging, the Origin is that domain and the requests still go to the staging host');

  // ── without a token, or with --no-wait, it sends and says what to expect ──
  result = await drill({}, { token: '' });
  ok(result.ok && result.outcome === 'sent' && !state.requests.includes('GET /v1/metrics') && state.deleted && result.lines.some(l => /FIRING CLIENT_ERROR_SPIKE \(warning\)/.test(l)), 'without PRI_METRICS_TOKEN it sends, deletes the account and names the email to expect; it does not claim the alert fired');
  result = await drill({}, { wait: false });
  ok(result.ok && result.outcome === 'sent' && state.polls === 0, '--no-wait never reads /v1/metrics');

  // ── each way it can fail is named, and the account is still deleted ───────
  result = await drill({ notifier: 'disabled' });
  ok(!result.ok && result.outcome === 'not-fired' && result.lines.some(l => /notifier is disabled: set PRI_ALERT_EMAIL/.test(l)) && state.deleted, 'a firing rule with the notifier off says to set PRI_ALERT_EMAIL');
  result = await drill({ notifier: 'fails' });
  ok(!result.ok && result.lines.some(l => /email failed to send/.test(l)) && state.deleted, 'a failed send says so');
  result = await drill({ firingAfter: 10_000 });
  ok(!result.ok && result.outcome === 'not-fired' && state.polls === 1 + WAIT_MS / POLL_MS + 1 && result.lines.some(l => /did not fire/.test(l)) && state.deleted, `a rule that never fires stops after ${WAIT_MS / 60_000} minutes (one read before, then one every ${POLL_MS / 1000} s), and the account is deleted`);
  result = await drill({ refuseReportAt: 5 });
  ok(!result.ok && state.reports.length === 4 && result.lines.some(l => /crash report 5 of 20 refused/.test(l)) && state.deleted, 'a refused report stops the drill, it is not retried, and the account is deleted');
  result = await drill({ deleteFails: true });
  ok(!result.ok && result.outcome === 'fired' && result.lines.some(l => /NOT deleted/.test(l)), 'an account that could not be deleted fails the drill and says how to remove it');

  // ── refused before anything is created ─────────────────────────────────────
  result = await drill({}, { token: 'wrong-token' });
  ok(result.outcome === 'refused' && state.registered === null && !state.requests.some(r => r.startsWith('POST')), 'a refused metrics token stops the drill before any account exists');
  result = await drill({ publicOrigin: 'https://app.prilearning.com' }, { publicOrigin: STAGING_ORIGIN });
  ok(result.outcome === 'refused' && result.lines.some(l => /pass --public-origin/.test(l)) && state.reports.length === 0, 'an Origin staging rejects is reported with the flag that fixes it, and nothing else is sent');
  ok(!leaks(result), 'still nothing secret in the output');
} finally {
  server.close();
}

console.log(`ALERT DRILL: PASS — ${count}/${count} checks`);
