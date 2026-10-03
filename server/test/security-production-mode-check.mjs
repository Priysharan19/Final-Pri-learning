// Production-mode security acceptance (V1 blocker #14).
//
// The same app the container runs (NODE_ENV=production, a configured
// PRI_PUBLIC_ORIGIN, the built client served from this process) must:
//   · refuse every browser mutation in the route inventory that arrives from a
//     foreign, null or missing Origin (provider webhooks are the one declared
//     exemption), and refuse a native-client claim that carries browser
//     Fetch-Metadata;
//   · send no CORS grant at all — no Access-Control-Allow-Origin, never `*`,
//     never with credentials — to a foreign Origin or a preflight;
//   · set every session cookie Secure + HttpOnly + SameSite=Lax + Path=/ on
//     every path that issues or clears one (register, login, password change,
//     /me refresh, logout), and the CSRF cookie Secure + SameSite but readable;
//   · send HSTS and an enforced CSP on the client shell, static assets, the SPA
//     fallback and /v1 alike;
//   · never redirect to another host from a static or fallback path.
// security-headers-check.mjs owns the header values themselves; this file owns
// their coverage across routes and the browser-boundary negatives.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'pri-security-production-'));
const ORIGIN = 'https://learn.pri.example';
process.env.NODE_ENV = 'production';
process.env.PRI_PUBLIC_ORIGIN = ORIGIN;
process.env.PRI_CSRF_SECRET = 'production-mode-acceptance-secret';
process.env.PRI_AUTH_DELIVERY_KEY = '33'.repeat(32);
process.env.PRI_PLATFORM_DB = join(tmp, 'platform.db');
process.env.PRI_TRUSTED_PROXY_HOPS = '0';
delete process.env.PRI_HANDWRITING_API_KEY;

const { startApp, registerAccount, verifyEmail, checks, cookieHeader } = await import('./support/app-harness.mjs');
const { loadInventory } = await import('./support/route-inventory.mjs');

const c = checks();
const distDir = join(tmp, 'dist');
mkdirSync(join(distDir, 'assets'), { recursive: true });
writeFileSync(join(distDir, 'index.html'), '<!doctype html><html><head><title>Pri</title><script type="module" src="/assets/app.js"></script></head><body></body></html>\n');
writeFileSync(join(distDir, 'assets', 'app.js'), 'export {};\n');

const h = await startApp({ dist: distDir });
const inventory = loadInventory();
const SAMPLE = { classId: 'cls_x', assignmentId: 'asn_x', studentId: 'acct_x', accountId: 'acct_x', sessionId: 'ses_x', revisionId: 'content_x', reportId: 'rpt_x', provider: 'web', cursor: '0', key: 'prod.flag' };
const concrete = path => path.replace(/:([A-Za-z]+)(\([^)]*\))?/g, (_, name) => SAMPLE[name] ?? 'x');

async function raw(path, { method = 'GET', headers = {}, jar = {}, body } = {}) {
  const sendHeaders = { Accept: 'application/json', ...headers };
  const cookie = cookieHeader(jar);
  if (cookie) sendHeaders.Cookie = cookie;
  if (body !== undefined) sendHeaders['Content-Type'] = 'application/json';
  const response = await fetch(`${h.origin}${path}`, { method, headers: sendHeaders, redirect: 'manual', body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = null; }
  return { status: response.status, headers: response.headers, data, text };
}

function sessionCookieOk(setCookie, label) {
  const session = setCookie.find(value => value.startsWith('pri_cloud_session='));
  const csrf = setCookie.find(value => value.startsWith('pri_csrf='));
  c.ok(session, `${label}: sets the session cookie`);
  for (const flag of [/;\s*HttpOnly/i, /;\s*Secure/i, /;\s*SameSite=Lax/i, /;\s*Path=\//i]) c.match(session, flag, `${label}: session cookie ${flag.source.replace(/[;\\s*]/g, '')}`);
  c.ok(csrf && /;\s*Secure/i.test(csrf) && /;\s*SameSite=Lax/i.test(csrf) && !/HttpOnly/i.test(csrf), `${label}: CSRF cookie Secure + SameSite, readable by the page`);
}

try {
  // ── Origin guard over every browser mutation in the inventory ─────────────
  const reg = await registerAccount(h, { email: 'production.student@example.test', password: 'production-password-1' });
  c.eq(reg.status, 201, 'registration with the product Origin');
  sessionCookieOk(reg.headers.getSetCookie(), 'register');
  await verifyEmail(h, reg.account.id);
  const jar = reg.jar;

  const mutations = inventory.routes.filter(route => route.origin !== 'not-applicable');
  const failures = [];
  for (const route of mutations) {
    const path = concrete(route.path);
    for (const [label, headers] of [
      ['foreign Origin', { Origin: 'https://evil.example' }],
      ['look-alike Origin', { Origin: `${ORIGIN}.evil.example` }],
      ['http downgrade Origin', { Origin: ORIGIN.replace('https:', 'http:') }],
      ['null Origin', { Origin: 'null' }],
      ['no Origin', {}],
      ['native claim with Fetch-Metadata', { 'X-Pri-Client': 'ios-native-v1', 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'cors' }]
    ]) {
      const r = await raw(path, { method: route.method, headers: { ...headers, 'x-pri-csrf': jar.pri_csrf }, jar, body: {} });
      const rejected = r.status === 403 && r.data?.error?.code === 'ORIGIN_REJECTED';
      if (route.origin === 'enforced' && !rejected) failures.push(`${label}: ${route.method} ${route.path} → ${r.status} ${r.data?.error?.code || ''}`);
      if (route.origin === 'exempt-provider-webhook' && label === 'foreign Origin' && r.data?.error?.code === 'ORIGIN_REJECTED') failures.push(`webhook ${route.path} should be exempt`);
      if (route.origin === 'exempt-provider-callback' && label === 'foreign Origin' && r.data?.error?.code === 'ORIGIN_REJECTED') failures.push(`provider callback ${route.path} should be exempt`);
    }
  }
  c.deq(failures, [], `all ${mutations.length} browser mutations refuse foreign, look-alike, downgraded, null and missing Origins`);
  c.eq((await h.request('/v1/account/me', { jar })).status, 200, 'the Origin sweep changed nothing for the session');

  // ── No CORS grant, ever ────────────────────────────────────────────────────
  const corsFailures = [];
  for (const route of inventory.routes) {
    const path = concrete(route.path);
    const preflight = await raw(path, { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': route.method, 'Access-Control-Request-Headers': 'x-pri-csrf,content-type' } });
    const simple = await raw(path, { method: 'GET', headers: { Origin: 'https://evil.example' }, jar });
    for (const [label, r] of [['preflight', preflight], ['credentialed GET', simple]]) {
      if (r.headers.get('access-control-allow-origin') || r.headers.get('access-control-allow-credentials')) corsFailures.push(`${label} ${route.method} ${route.path}: ACAO=${r.headers.get('access-control-allow-origin')} ACAC=${r.headers.get('access-control-allow-credentials')}`);
    }
  }
  c.deq(corsFailures, [], 'no route grants CORS to a foreign origin (no ACAO, no credentials) on preflight or credentialed requests');
  const sameOrigin = await raw('/v1/health', { headers: { Origin: ORIGIN } });
  c.eq(sameOrigin.headers.get('access-control-allow-origin'), null, 'not even the product origin needs or gets a CORS grant');

  // ── Cookie flags on every path that issues or clears a session ────────────
  const login = await raw('/v1/account/login', { method: 'POST', headers: { Origin: ORIGIN }, body: { email: 'production.student@example.test', password: 'production-password-1' } });
  c.eq(login.status, 200, 'login');
  sessionCookieOk(login.headers.getSetCookie(), 'login');
  const me = await raw('/v1/account/me', { jar });
  sessionCookieOk(me.headers.getSetCookie(), '/me refresh');
  const changed = await raw('/v1/account/password', { method: 'PATCH', headers: { Origin: ORIGIN, 'x-pri-csrf': jar.pri_csrf }, jar, body: { currentPassword: 'production-password-1', newPassword: 'production-password-2' } });
  c.eq(changed.status, 200, 'password change');
  sessionCookieOk(changed.headers.getSetCookie(), 'password change');
  const rotated = {};
  for (const value of changed.headers.getSetCookie()) { const [pair] = value.split(';'); const i = pair.indexOf('='); rotated[pair.slice(0, i)] = pair.slice(i + 1); }
  const logout = await raw('/v1/account/logout', { method: 'POST', headers: { Origin: ORIGIN, 'x-pri-csrf': rotated.pri_csrf }, jar: rotated });
  c.eq(logout.status, 200, 'logout');
  const cleared = logout.headers.getSetCookie().find(value => value.startsWith('pri_cloud_session='));
  c.ok(cleared && /Expires=Thu, 01 Jan 1970/i.test(cleared) && /;\s*Secure/i.test(cleared) && /;\s*HttpOnly/i.test(cleared), 'logout clears the session cookie with the same Secure + HttpOnly attributes');

  // ── HSTS + CSP on every kind of response ───────────────────────────────────
  for (const [label, path, accept] of [
    ['client shell', '/', 'text/html'],
    ['static asset', '/assets/app.js', '*/*'],
    ['SPA fallback', '/practice/deep/link', 'text/html'],
    ['/v1', '/v1/health', 'application/json'],
    ['/v1 404', '/v1/nope', 'application/json']
  ]) {
    const r = await raw(path, { headers: { Accept: accept } });
    c.match(r.headers.get('strict-transport-security') || '', /^max-age=\d{7,}; includeSubDomains$/, `${label}: HSTS`);
    const csp = r.headers.get('content-security-policy') || '';
    c.ok(/script-src 'self'(;|$)/.test(csp) && /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp), `${label}: enforced CSP (script-src self only, no framing, no plugins)`);
    c.eq(r.headers.get('content-security-policy-report-only'), null, `${label}: CSP is enforced, not report-only`);
  }

  // ── No open redirect from static hosting or the SPA fallback ──────────────
  const redirectFailures = [];
  for (const path of ['//evil.example', '//evil.example/', '//evil.example/assets', '/%2F%2Fevil.example', '/%5Cevil.example', '/\\evil.example', '/assets', '/assets/..%2F..%2F', '/.%2F%2Fevil.example', '/?next=https://evil.example', '/login?redirect=https%3A%2F%2Fevil.example']) {
    const r = await raw(path, { headers: { Accept: 'text/html' } });
    const location = r.headers.get('location') || '';
    if (/evil\.example/i.test(location) || /^\/\//.test(location) || /^\/\\/.test(location) || /^[a-z]+:/i.test(location)) redirectFailures.push(`${path} → ${r.status} Location: ${location}`);
  }
  c.deq(redirectFailures, [], 'static and fallback paths never redirect off-site');

  // ── Production error bodies say nothing about the server ──────────────────
  const notFound = await raw('/v1/does-not-exist');
  c.deq(Object.keys(notFound.data.error).sort(), ['code', 'message'], 'a /v1 error is {code, message} only');
  c.ok(!/at \w+ \(|node_modules|\/server\/|sqlite|postgres/i.test(notFound.text), 'no stack, path or engine detail in an error body');
  const legacy = await raw('/api/auth/login', { method: 'POST', headers: { Origin: ORIGIN }, body: {} });
  c.eq(legacy.status, 410, 'the legacy /api surface is gone in production');
} finally {
  await h.close();
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`SECURITY PRODUCTION MODE — PASS — ${c.count()}/${c.count()} checks`);
