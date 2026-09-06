// Security headers contract (quality-03, cloud-18).
//
// Runs the production middleware chain in-process and proves every response —
// the control plane, 404s, the JSON-parse error path, the built client and the
// retired legacy prefix — carries the hardening headers, that the request log
// records nothing but method/path/status/latency, and that production cookies
// are Secure + HttpOnly.
//
// With --browser it additionally serves the real client/dist through the same
// app and loads it in Chromium: the enforced Content-Security-Policy must
// produce zero securitypolicyviolation events across the sign-up flow, the
// practice page (KaTeX, ink canvas) and settings.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const browserRequested = process.argv.includes('--browser');
const tmp = mkdtempSync(join(tmpdir(), 'pri-security-headers-'));

process.env.NODE_ENV = 'production';
process.env.PRI_PUBLIC_ORIGIN = 'https://learn.pri.example';
process.env.PRI_CSRF_SECRET = 'security-headers-contract-secret';
process.env.PRI_AUTH_DELIVERY_KEY = '22'.repeat(32);
process.env.PRI_PLATFORM_DB = join(tmp, 'platform.db');
// This harness is the socket, so nothing forwards for it.
process.env.PRI_TRUSTED_PROXY_HOPS = '0';
delete process.env.PRI_CSP_CONNECT_SRC;

const { startApp, registerAccount, checks } = await import('./support/app-harness.mjs');
const { contentSecurityPolicy, securityHeaderValues } = await import('../platform/headers.js');

const c = checks();

function directives(csp) {
  return Object.fromEntries(String(csp).split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const [name, ...values] = part.split(/\s+/);
    return [name, values];
  }));
}

function expectHardened(headers, label, { hsts = true } = {}) {
  const csp = headers.get('content-security-policy');
  c.ok(csp, `${label}: Content-Security-Policy present`);
  const d = directives(csp);
  c.deq(d['frame-ancestors'], ["'none'"], `${label}: frame-ancestors 'none'`);
  c.eq(headers.get('x-content-type-options'), 'nosniff', `${label}: nosniff`);
  c.eq(headers.get('referrer-policy'), 'no-referrer', `${label}: Referrer-Policy`);
  c.match(headers.get('permissions-policy'), /microphone=\(\)/, `${label}: Permissions-Policy`);
  c.eq(headers.get('x-frame-options'), 'DENY', `${label}: X-Frame-Options`);
  if (hsts) c.match(headers.get('strict-transport-security'), /^max-age=\d{7,}; includeSubDomains$/, `${label}: HSTS`);
  c.eq(headers.get('x-powered-by'), null, `${label}: no X-Powered-By`);
}

// Synthetic built client: enough to prove static hosting and the SPA fallback
// get the same headers as the control plane.
const distDir = join(tmp, 'dist');
mkdirSync(join(distDir, 'assets'), { recursive: true });
writeFileSync(join(distDir, 'index.html'), '<!doctype html><html><head><title>Pri</title><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>\n');
writeFileSync(join(distDir, 'assets', 'app.js'), 'document.getElementById("root").textContent = "ok";\n');

const logLines = [];
const h = await startApp({ dist: distDir, log: line => logLines.push(line) });

try {
  const health = await h.request('/v1/health');
  c.eq(health.status, 200, 'health responds');
  expectHardened(health.headers, '/v1/health');
  c.eq(health.headers.get('cache-control'), 'no-store', 'control plane stays uncacheable');

  const missing = await h.request('/v1/does-not-exist');
  c.eq(missing.status, 404, 'unknown platform route is 404');
  expectHardened(missing.headers, '/v1 404');

  const shell = await h.request('/', { headers: { Accept: 'text/html' } });
  c.eq(shell.status, 200, 'client shell served');
  c.match(shell.headers.get('content-type'), /text\/html/, 'shell is HTML');
  c.match(shell.text, /\/assets\/app\.js/, 'shell body is the built index');
  expectHardened(shell.headers, 'client shell');

  const asset = await h.request('/assets/app.js', { headers: { Accept: '*/*' } });
  c.eq(asset.status, 200, 'asset served');
  expectHardened(asset.headers, 'static asset');

  const spa = await h.request('/practice/some/deep/route', { headers: { Accept: 'text/html' } });
  c.eq(spa.status, 200, 'SPA fallback serves the shell');
  c.match(spa.text, /\/assets\/app\.js/, 'SPA fallback body is the shell');
  expectHardened(spa.headers, 'SPA fallback');

  // cloud-02 / quality-01: the legacy /api Express stack is not mounted in
  // production; every legacy path is a hard 410, not a 6-character-password
  // register endpoint.
  for (const [method, path] of [['POST', '/api/auth/login'], ['POST', '/api/auth/register'], ['GET', '/api/me'], ['GET', '/api/curriculum']]) {
    const legacy = await h.request(path, { method, body: method === 'POST' ? { email: 'a@b.c', password: 'short1' } : undefined });
    c.eq(legacy.status, 410, `${method} ${path} is gone in production`);
    c.eq(legacy.data?.error?.code, 'LEGACY_API_REMOVED', `${method} ${path} names the removal`);
  }
  expectHardened((await h.request('/api/anything')).headers, 'legacy 410');

  // Body-parse failure reaches the app-level error handler; headers were set
  // before any parser ran, so even that path is hardened.
  const badJson = await h.request('/v1/account/register', { method: 'POST', rawBody: '{not json', headers: { 'Content-Type': 'application/json' } });
  c.eq(badJson.status, 400, 'malformed JSON is rejected');
  expectHardened(badJson.headers, 'parse error');

  // CSP content: only same-origin scripts, no inline or eval, no plugins, no
  // base hijack, forms and connections stay home.
  const d = directives(health.headers.get('content-security-policy'));
  c.deq(d['default-src'], ["'self'"], "default-src 'self'");
  c.deq(d['script-src'], ["'self'"], "script-src is exactly 'self'");
  c.deq(d['object-src'], ["'none'"], "object-src 'none'");
  c.deq(d['base-uri'], ["'self'"], "base-uri 'self'");
  c.deq(d['form-action'], ["'self'"], "form-action 'self'");
  c.deq(d['connect-src'], ["'self'"], 'connect-src defaults to self only');
  c.ok(!/unsafe-eval/.test(health.headers.get('content-security-policy')), 'no unsafe-eval anywhere');
  c.ok(d['style-src'].includes("'self'"), 'style-src includes self');

  // Operator-extendable connect-src, validated: only clean https origins pass.
  process.env.PRI_CSP_CONNECT_SRC = 'https://api.pri.example, javascript:alert(1) http://insecure.example https://ok.example:8443/path';
  const extended = directives(contentSecurityPolicy());
  c.deq(extended['connect-src'], ["'self'", 'https://api.pri.example'], 'PRI_CSP_CONNECT_SRC admits only clean https origins');
  delete process.env.PRI_CSP_CONNECT_SRC;

  const dev = securityHeaderValues({ production: false });
  c.eq(dev['Strict-Transport-Security'], undefined, 'HSTS is only sent in production');
  c.ok(dev['Content-Security-Policy'].includes("frame-ancestors 'none'"), 'CSP is enforced in development too');
  c.eq(dev['Cross-Origin-Opener-Policy'], 'same-origin-allow-popups', 'COOP keeps sign-in popups working');

  // Production cookies: the session bearer is HttpOnly + Secure + SameSite.
  const reg = await registerAccount(h, { email: 'headers.student@example.test' });
  c.eq(reg.status, 201, 'registration works behind the production origin guard');
  const setCookies = reg.headers.getSetCookie();
  const session = setCookies.find(x => x.startsWith('pri_cloud_session='));
  c.match(session, /HttpOnly/i, 'session cookie HttpOnly');
  c.match(session, /Secure/i, 'session cookie Secure in production');
  c.match(session, /SameSite=Lax/i, 'session cookie SameSite=Lax');
  const csrf = setCookies.find(x => x.startsWith('pri_csrf='));
  c.ok(csrf && !/HttpOnly/i.test(csrf), 'CSRF cookie is readable by the client script');

  // Request log: method, path, status, latency — never query strings, cookies,
  // bodies, user agents or emails.
  await h.request('/v1/health?email=someone@example.test&token=abc');
  await h.request('/v1/health', { headers: { 'x-pri-request-id': 'req-abc.1' } });
  await h.request('/v1/health', { headers: { 'x-pri-request-id': '<script>alert(1)</script>' } });
  const serialized = JSON.stringify(logLines);
  c.ok(logLines.length >= 10, `request log has one line per request (${logLines.length})`);
  c.ok(logLines.every(line => typeof line.method === 'string' && typeof line.path === 'string' && Number.isInteger(line.status) && typeof line.ms === 'number' && line.ms >= 0 && !Number.isNaN(Date.parse(line.ts))), 'every log line is {ts, method, path, status, ms}');
  const allowedKeys = new Set(['ts', 'method', 'path', 'status', 'ms', 'requestId']);
  c.ok(logLines.every(line => Object.keys(line).every(key => allowedKeys.has(key))), 'log lines carry no other fields');
  c.ok(!serialized.includes('someone@example.test') && !serialized.includes('token=abc') && !serialized.includes('?'), 'query strings never reach the log');
  c.ok(!serialized.includes('headers.student@example.test') && !serialized.includes('correct-horse-battery') && !/pri_cloud_session/.test(serialized), 'bodies and cookies never reach the log');
  c.ok(logLines.some(line => line.requestId === 'req-abc.1'), 'a well-formed X-Pri-Request-Id is echoed for correlation');
  c.ok(!serialized.includes('<script>'), 'a malformed request id is dropped, not logged');
  const shellLine = logLines.find(line => line.path === '/' && line.status === 200);
  c.ok(shellLine, 'static responses are logged too');
} finally {
  await h.close();
}

console.log(`SECURITY HEADERS — PASS — ${c.count()}/${c.count()} checks`);

if (browserRequested) {
  const realDist = join(ROOT, 'client', 'dist');
  if (!existsSync(join(realDist, 'index.html'))) {
    console.error('--browser needs the built client: run npm run build --prefix client first.');
    process.exit(1);
  }
  const b = checks();
  const clientRequire = createRequire(join(ROOT, 'client', 'package.json'));
  const playwright = await import(pathToFileURL(clientRequire.resolve('@playwright/test')).href);
  const chromium = playwright.chromium || playwright.default?.chromium;
  if (!chromium) throw new Error('Playwright chromium launcher not found in client/node_modules');

  const served = await startApp({ dist: realDist });
  const browser = await chromium.launch({ headless: true });
  const routesLoaded = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    await context.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', event => {
        window.__cspViolations.push({
          directive: event.violatedDirective,
          blocked: event.blockedURI,
          source: event.sourceFile,
          line: event.lineNumber,
          sample: event.sample
        });
      });
    });
    const page = await context.newPage();
    const consoleCsp = [];
    const pageErrors = [];
    page.on('console', message => { if (/Content Security Policy|Refused to/i.test(message.text())) consoleCsp.push(message.text()); });
    page.on('pageerror', error => pageErrors.push(String(error?.message || error)));

    const violations = async () => page.evaluate(() => window.__cspViolations || []);
    const goto = async (path) => {
      const response = await page.goto(`${served.origin}${path}`, { waitUntil: 'load' });
      b.match(response.headers()['content-security-policy'], /frame-ancestors 'none'/, `${path}: document response carries the enforced CSP`);
      await page.waitForSelector('.auth-wrap .hero-title, .auth-card, .shell', { timeout: 30000 });
      routesLoaded.push(path);
    };

    await goto('/');
    // Make a profile the way a student does — through the real hero and
    // create form — so the app's own storage, worker and style paths run.
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.waitForSelector('.sso-btn', { timeout: 15000 });
    await page.getByRole('button', { name: /Continue without an email/ }).click();
    await page.waitForSelector('.auth-card input.input', { timeout: 15000 });
    await page.getByPlaceholder('e.g. Priysharan').fill('CSP Student');
    await page.locator('.auth-card select').first().selectOption('9');
    await page.getByRole('button', { name: 'Start learning' }).click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    b.ok(true, 'profile created through the live UI under the enforced CSP');

    await goto('/practice');
    const katex = await page.waitForSelector('.katex', { timeout: 20000 }).catch(() => null);
    b.ok(katex, 'practice page rendered KaTeX (inline style attributes) under the CSP');
    await page.waitForTimeout(1500);
    await goto('/exams');
    await goto('/settings');
    await page.waitForTimeout(1000);

    const found = await violations();
    if (found.length || consoleCsp.length) {
      console.error('CSP violations:', JSON.stringify(found, null, 2));
      console.error('console:', consoleCsp);
    }
    b.eq(found.length, 0, 'zero securitypolicyviolation events across the loaded routes');
    b.eq(consoleCsp.length, 0, 'no CSP refusals in the console');
    b.deq(pageErrors, [], 'no uncaught page errors');
    b.ok(routesLoaded.length >= 4, `routes exercised: ${routesLoaded.join(' ')}`);
  } finally {
    await browser.close();
    await served.close();
  }
  console.log(`SECURITY HEADERS BROWSER — PASS — ${b.count()}/${b.count()} checks (${routesLoaded.length} routes, 0 CSP violations)`);
}

rmSync(tmp, { recursive: true, force: true });
