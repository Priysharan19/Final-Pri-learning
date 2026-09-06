// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · who the rate limiters think you are
//
// Every anonymous limit on this server — 8 registrations an hour, 6 password
// reset emails an hour, the login lockout — counts against `req.ip`, and
// `req.ip` is derived from X-Forwarded-For according to how many proxies the
// deployment says are in front of it. That number is not guessable from inside
// the process and both wrong answers are silent:
//
//   · too high — the server believes a header the client writes, so one socket
//     rotating X-Forwarded-For gets a fresh identity per request and the limits
//     never fire. That is 20 accounts and 20 verification emails from one
//     connection.
//   · too low — everyone behind the proxy shares one bucket, and one busy
//     school locks out every other school.
//
// So the topology is configuration with no default, production refuses to boot
// without it, and this contract proves both halves: the boot gate, and that a
// spoofed X-Forwarded-For cannot buy a second rate bucket.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const names = ['NODE_ENV', 'PRI_PUBLIC_ORIGIN', 'PRI_CSRF_SECRET', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PLATFORM_DB', 'PRI_TRUSTED_PROXY_HOPS'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-proxy-identity-'));

process.env.NODE_ENV = 'production';
process.env.PRI_PUBLIC_ORIGIN = 'https://learn.pri.example';
process.env.PRI_CSRF_SECRET = 'proxy-identity-contract-secret';
process.env.PRI_AUTH_DELIVERY_KEY = '55'.repeat(32);
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
delete process.env.PRI_TRUSTED_PROXY_HOPS;

const { startApp, checks } = await import('./support/app-harness.mjs');
const { createPlatformDb } = await import('../platform/db.js');
const { assertPlatformConfig, platformConfigStatus, trustedProxyHops } = await import('../platform/config.js');

const c = checks();
const ORIGIN = process.env.PRI_PUBLIC_ORIGIN;

// ── 1 · Production will not start on a guess ─────────────────────────────────
c.ok(platformConfigStatus().missing.includes('PRI_TRUSTED_PROXY_HOPS'), 'an unset hop count is reported as missing production configuration');
c.ok(!platformConfigStatus().ok, 'and the configuration is not ok without it');
c.ok(await rejects(() => assertPlatformConfig(), /PRI_TRUSTED_PROXY_HOPS/), 'production startup refuses to continue');
c.ok(await rejects(() => trustedProxyHops(), error => error?.code === 'TRUSTED_PROXY_HOPS_NOT_CONFIGURED'), 'resolving the hop count fails closed rather than defaulting');

for (const bad of ['one', '-1', '1.5', '9', '80', ' ']) {
  process.env.PRI_TRUSTED_PROXY_HOPS = bad;
  c.ok(await rejects(() => trustedProxyHops(), error => error?.code === 'TRUSTED_PROXY_HOPS_INVALID' || error?.code === 'TRUSTED_PROXY_HOPS_NOT_CONFIGURED'),
    `"${bad}" is not a proxy topology`);
}
for (const [value, expected] of [['0', 0], ['1', 1], ['2', 2]]) {
  process.env.PRI_TRUSTED_PROXY_HOPS = value;
  c.eq(trustedProxyHops(), expected, `${value} hop(s) is accepted`);
}
c.eq(trustedProxyHops({ NODE_ENV: 'test' }), 0, 'development and the contracts talk to the socket, which is zero hops');
process.env.PRI_TRUSTED_PROXY_HOPS = '0';
c.deq(platformConfigStatus().missing, [], 'a stated topology completes the production configuration');

// ── 2 · A spoofed X-Forwarded-For cannot buy a second rate bucket ────────────
// This harness IS the socket: nothing forwards for it, so the honest hop count
// is 0 and every request below is the same client however it labels itself.
const db = createPlatformDb(':memory:');
const app = await startApp({ db, production: true });
try {
  const statuses = [];
  for (let i = 0; i < 12; i += 1) {
    const response = await app.request('/v1/account/register', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'X-Forwarded-For': `203.0.113.${i}` },
      body: { email: `spoof-${i}@example.test`, name: 'Test', password: 'correct-horse-battery' }
    });
    statuses.push(response.status);
  }
  c.ok(statuses.includes(429), `the registration limit still fires behind a rotating X-Forwarded-For (${statuses.join(',')})`);
  c.eq(statuses.filter(status => status === 201).length, 8, 'exactly the advertised 8 registrations per hour are accepted');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 8, 'and only those accounts exist');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM auth_delivery_outbox').get().n, 8, 'so a single socket cannot queue a verification email per spoofed address');
  c.eq(db.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE bucket LIKE 'register:%'").get().n, 1,
    'twelve spoofed client addresses produce exactly one rate bucket');

  // The same for the password-reset mailer, which spends a real email each time.
  const resetStatuses = [];
  for (let i = 0; i < 10; i += 1) {
    const response = await app.request('/v1/account/password/reset-request', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'X-Forwarded-For': `198.51.100.${i}` },
      body: { email: 'spoof-0@example.test' }
    });
    resetStatuses.push(response.status);
  }
  c.eq(db.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE bucket LIKE 'reset-request:%'").get().n, 1,
    'reset requests from ten spoofed addresses share one bucket too');
  c.ok(db.prepare("SELECT COUNT(*) AS n FROM auth_delivery_outbox WHERE kind='reset-password'").get().n <= 6,
    'and the mailer stops at its advertised hourly limit');
} finally {
  await app.close();
  db.close();
}

// ── 3 · An operator can find out what to set ────────────────────────────────
const envExample = readFileSync(join(ROOT, '.env.production.example'), 'utf8');
c.ok(/^PRI_TRUSTED_PROXY_HOPS=/m.test(envExample), '.env.production.example carries the variable');
c.match(envExample, /0\s+the process is reachable directly/, 'and says what 0 means');
const deployment = readFileSync(join(ROOT, 'docs', 'production-deployment.md'), 'utf8');
c.match(deployment, /PRI_TRUSTED_PROXY_HOPS/, 'the deployment contract documents it');
c.match(deployment, /X-Forwarded-For/, 'and names the header the number governs');
const preflight = readFileSync(join(ROOT, 'tools', 'production-preflight.mjs'), 'utf8');
c.match(preflight, /PRI_TRUSTED_PROXY_HOPS/, 'the preflight tool lists it among the required variables');

rmSync(scratch, { recursive: true, force: true });
for (const name of names) {
  if (prior[name] === undefined) delete process.env[name];
  else process.env[name] = prior[name];
}
console.log(`PROXY IDENTITY — PASS — ${c.count()}/${c.count()} checks — the proxy topology is stated, validated at boot, and a spoofed X-Forwarded-For buys no second rate bucket.`);

/** True when `fn` throws and the thrown error matches. */
async function rejects(fn, expected) {
  try {
    fn();
    return false;
  } catch (error) {
    if (typeof expected === 'function') return !!expected(error);
    if (expected instanceof RegExp) return expected.test(String(error?.message || ''));
    return true;
  }
}
