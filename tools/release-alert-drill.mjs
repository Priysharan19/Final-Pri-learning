#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · fire one real alert on STAGING, end to end, harming nothing
//
// docs/operations/alerts.md §3a. Once PRI_ALERT_EMAIL is set on staging, this
// proves the whole server-side alert path: a rule of metrics.js ALERT_RULES is
// evaluated, alertNotifier.js (every 60 s) sends the FIRING email through the
// auth-email Resend path, and it reaches the owner's inbox. It trips
// CLIENT_ERROR_SPIKE, the one rule a drill can fire without breaking anything:
// the rule needs its threshold of coded crash reports in its window, and one
// account may send exactly that many (telemetry.js, 20 per 10 minutes).
//
// On staging only, it:
//   1. registers one adult password test account at a Resend sink address
//      (delivered+pri-alert-drill-<stamp>@resend.dev: delivered, never a person);
//   2. sends the rule's threshold of crash reports, coded ALERT_DRILL, from the
//      surface `alert-drill`;
//   3. with PRI_METRICS_TOKEN in the environment, reads /v1/metrics until the
//      rule is firing and the notifier has counted a FIRING email for it;
//   4. deletes the test account with its password, even after a failure.
// Every request goes to the staging host. The token and the password are never
// printed. Metrics are per replica: with more than one staging replica the
// reports can be split between them, and the rule may not fire.
//
//   node tools/release-alert-drill.mjs [--public-origin https://app.prilearning.com] [--no-wait]
//
// --public-origin is the Origin staging's PRI_PUBLIC_ORIGIN expects: staging's
// own address (the default), or app.prilearning.com while that domain points at
// staging (docs/operations/production-config-v1.md note 7).
//
// Exit 0 fired (or, with --no-wait or no token, sent) · 1 did not fire or the
// account was not deleted · 2 refused or usage.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ALERT_RULES } from '../server/platform/metrics.js';
import { STAGING_ORIGIN } from '../scripts/release-nominate.mjs';

export const DRILL_RULE = 'CLIENT_ERROR_SPIKE';
export const DRILL_CODE = 'ALERT_DRILL';
export const DRILL_SURFACE = 'alert-drill';
/** The Origin values staging may expect: its own address, or the app domain while it points at staging. */
export const PUBLIC_ORIGINS = Object.freeze([STAGING_ORIGIN, 'https://app.prilearning.com']);
const REQUEST_TIMEOUT_MS = 15_000;
export const WAIT_MS = 180_000;
export const POLL_MS = 10_000;

/** How many reports trip the rule: its own threshold, read from the code. */
export function drillReports(rules = ALERT_RULES) {
  const rule = rules.find(item => item.id === DRILL_RULE);
  if (!rule || !Number.isInteger(rule.thresholds?.count) || rule.thresholds.count < 1) throw new Error(`${DRILL_RULE} has no count threshold`);
  return rule.thresholds.count;
}

export function parseArgs(argv) {
  const args = { publicOrigin: STAGING_ORIGIN, wait: true };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--no-wait') { args.wait = false; continue; }
    if (flag === '--public-origin') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error('--public-origin needs a value');
      if (!PUBLIC_ORIGINS.includes(value)) throw new Error(`--public-origin must be one of ${PUBLIC_ORIGINS.join(', ')}`);
      args.publicOrigin = value;
      i += 1;
      continue;
    }
    // There is deliberately no --origin: the drill only ever talks to staging.
    throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

/** A cookie-jar client: every request goes to `base`; writes carry `publicOrigin` and the CSRF token. */
export function client(base, publicOrigin, fetchImpl = globalThis.fetch) {
  const jar = {};
  return async function request(path, { method = 'GET', body, headers = {} } = {}) {
    const send = { accept: 'application/json', ...headers };
    const write = !['GET', 'HEAD'].includes(method);
    if (write) send.origin = publicOrigin;
    const cookies = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookies) send.cookie = cookies;
    if (write && jar.pri_csrf) send['x-pri-csrf'] = jar.pri_csrf;
    if (body !== undefined) send['content-type'] = 'application/json';
    const response = await fetchImpl(base + path, { method, headers: send, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    for (const raw of response.headers.getSetCookie?.() || []) {
      const first = String(raw).split(';', 1)[0];
      const at = first.indexOf('=');
      if (at > 0) {
        const value = first.slice(at + 1);
        if (value === '') delete jar[first.slice(0, at)]; else jar[first.slice(0, at)] = value;
      }
    }
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    return { status: response.status, data, code: data?.error?.code || null };
  };
}

/** The FIRING emails the notifier has counted for the drill rule (outcome firing_sent), and any other outcome seen. */
export function notifierCounts(snapshot) {
  const out = { firingSent: 0, disabled: 0, failed: 0 };
  for (const [key, value] of Object.entries(snapshot?.counters || {})) {
    if (!key.startsWith('alert_notifications_total{') || !key.includes(`rule=${DRILL_RULE}`)) continue;
    const total = Number(value?.total) || 0;
    if (key.includes('outcome=firing_sent')) out.firingSent += total;
    else if (key.includes('outcome=disabled')) out.disabled += total;
    else if (key.includes('outcome=failed')) out.failed += total;
  }
  return out;
}

/**
 * Returns { ok, outcome: 'fired' | 'sent' | 'not-fired' | 'refused', lines: [...] }.
 * `base` is the staging origin; only a test passes another (a loopback fake).
 */
export async function runDrill({
  base = STAGING_ORIGIN, publicOrigin = STAGING_ORIGIN, wait = true, token = process.env.PRI_METRICS_TOKEN || '',
  fetchImpl = globalThis.fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => Date.now(),
  stamp = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
} = {}) {
  const lines = [];
  const say = line => lines.push(line);
  const reports = drillReports();
  const request = client(base, publicOrigin, fetchImpl);
  const metrics = async () => {
    const response = await fetchImpl(`${base}/v1/metrics`, { headers: { accept: 'application/json', authorization: `Bearer ${token}` }, redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    return { status: response.status, body };
  };
  const email = `delivered+pri-alert-drill-${stamp}@resend.dev`;
  const password = `Drill-${randomBytes(18).toString('base64url')}`;

  let before = null;
  if (token && wait) {
    const first = await metrics();
    if (first.status !== 200) {
      say(`✗ /v1/metrics refused the token (status ${first.status}, ${first.body?.error?.code || 'no code'}): check PRI_METRICS_TOKEN`);
      return { ok: false, outcome: 'refused', lines };
    }
    before = notifierCounts(first.body);
    say(`· before: ${DRILL_RULE} ${first.body.firing?.includes(DRILL_RULE) ? 'already firing' : 'not firing'}; FIRING emails counted for it on this replica: ${before.firingSent}`);
  }

  const registered = await request('/v1/account/register', { method: 'POST', body: { name: 'Pri alert drill', email, password, isAdult: true, year: 10, deviceId: 'alert-drill' } });
  if (registered.status !== 201) {
    say(`✗ test account not created (status ${registered.status}, ${registered.code || 'no code'})${registered.code === 'ORIGIN_REJECTED' ? ': pass --public-origin with the origin staging expects' : ''}`);
    return { ok: false, outcome: 'refused', lines };
  }
  const accountId = registered.data?.account?.id || null;
  say(`✓ test account created at a Resend sink address (${email.replace(/^delivered\+/, 'delivered+…').replace(/-[a-z0-9]+@/, '-…@')})`);

  let deleted = false;
  let outcome = 'sent';
  try {
    let sent = 0;
    for (let i = 0; i < reports; i += 1) {
      const fingerprint = randomBytes(8).toString('hex');
      const result = await request('/v1/telemetry/error', { method: 'POST', body: { platform: 'web', code: DRILL_CODE, surface: DRILL_SURFACE, scope: 'app', fingerprint, at: now() } });
      if (result.status !== 202) { say(`✗ crash report ${i + 1} of ${reports} refused (status ${result.status}, ${result.code || 'no code'})`); break; }
      sent += 1;
    }
    say(`${sent === reports ? '✓' : '✗'} ${sent} of ${reports} coded crash reports accepted (code ${DRILL_CODE}, surface ${DRILL_SURFACE})`);
    if (sent < reports) outcome = 'not-fired';
    else if (!wait) say(`· not waiting (--no-wait). Expect the email "[Pri <PRI_ALERT_ENVIRONMENT>] FIRING ${DRILL_RULE} (warning)" within about 2 minutes`);
    else if (!token) say(`· no PRI_METRICS_TOKEN in this shell, so the firing is not confirmed here. Expect the email "[Pri <PRI_ALERT_ENVIRONMENT>] FIRING ${DRILL_RULE} (warning)" within about 2 minutes`);
    else {
      outcome = 'not-fired';
      const deadline = now() + WAIT_MS;
      let last = null;
      while (now() <= deadline) {
        const read = await metrics();
        if (read.status === 200) {
          last = { firing: read.body.firing?.includes(DRILL_RULE) === true, counts: notifierCounts(read.body) };
          if (last.firing && last.counts.firingSent > before.firingSent) { outcome = 'fired'; break; }
        }
        await sleep(POLL_MS);
      }
      if (outcome === 'fired') say(`✓ ${DRILL_RULE} is firing and the notifier counted a FIRING email for it (${last.counts.firingSent - before.firingSent} new)`);
      else if (last?.firing && last.counts.disabled > before.disabled) say(`✗ ${DRILL_RULE} is firing but the notifier is disabled: set PRI_ALERT_EMAIL (and the Resend variables) on staging`);
      else if (last?.firing && last.counts.failed > before.failed) say(`✗ ${DRILL_RULE} is firing but the email failed to send: check PRI_RESEND_API_KEY and PRI_AUTH_EMAIL_FROM`);
      else if (last?.firing) say(`✗ ${DRILL_RULE} is firing but no FIRING email was counted within ${WAIT_MS / 60_000} minutes (a 30-minute cooldown after an earlier episode suppresses it)`);
      else say(`✗ ${DRILL_RULE} did not fire on the replica that answered /v1/metrics (more than one staging replica splits the reports)`);
    }
  } finally {
    const removed = await request('/v1/account', { method: 'DELETE', body: { password, ...(accountId ? { accountId } : {}) } }).catch(error => ({ status: 0, code: error?.name || 'ERROR' }));
    deleted = removed.status === 200 && removed.data?.deleted === true;
    say(`${deleted ? '✓' : '✗'} test account ${deleted ? 'deleted' : `NOT deleted (status ${removed.status}, ${removed.code || 'no code'}): delete it from Settings on staging`}`);
  }
  return { ok: deleted && outcome !== 'not-fired', outcome, lines };
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(`${error.message}\nUsage: node tools/release-alert-drill.mjs [--public-origin ${PUBLIC_ORIGINS.join('|')}] [--no-wait]`); process.exit(2); }
  const result = await runDrill({ publicOrigin: args.publicOrigin, wait: args.wait });
  for (const line of result.lines) console.log(`  ${line}`);
  const title = { fired: 'FIRED', sent: 'SENT (not confirmed here)', 'not-fired': 'NOT FIRED', refused: 'REFUSED' }[result.outcome];
  console.log(`ALERT DRILL: ${title} — ${DRILL_RULE} on ${STAGING_ORIGIN}`);
  process.exit(result.outcome === 'refused' ? 2 : result.ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
