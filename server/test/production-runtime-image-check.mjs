// Production runtime image contract (cloud-02, quality-01, cloud-18).
//
// Docker is not assumed. The runtime stage of the Dockerfile is parsed for its
// COPY set, that exact set is staged into a temp directory (node_modules
// linked, the built client synthesised), and server/index.js is booted there
// with NODE_ENV=production. That proves the legacy /api Express stack is
// neither present in the image nor reachable, that the process starts as a
// self-contained unit, that housekeeping ran at startup, that the request log
// is method/path/status/ms only, and that the Dockerfile drops root.

import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const { checks } = await import('./support/app-harness.mjs');
const c = checks();

const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8').split('\n');
const runtimeStart = dockerfile.findIndex(line => /^FROM\s+\S+\s+AS\s+runtime\s*$/i.test(line));
c.ok(runtimeStart >= 0, 'Dockerfile has a runtime stage');
const runtime = dockerfile.slice(runtimeStart + 1);
const copies = runtime.filter(line => /^COPY\s/.test(line)).map(line => line.replace(/^COPY\s+/, '').trim().split(/\s+/));
c.ok(copies.length >= 3, `runtime stage has COPY instructions (${copies.length})`);
c.ok(!copies.some(tokens => tokens[0] === 'server' || tokens[0] === 'server/'), 'the runtime stage no longer copies the whole server directory');
c.ok(!copies.some(tokens => tokens.some(t => t.startsWith('client/src'))), 'client source is not in the image');
const userIndex = runtime.findIndex(line => /^USER\s+node\s*$/.test(line));
const lastCopy = runtime.reduce((last, line, index) => (/^COPY\s/.test(line) ? index : last), -1);
const cmdIndex = runtime.findIndex(line => /^CMD\s/.test(line));
c.ok(userIndex > lastCopy && userIndex < cmdIndex, 'USER node is set after the COPYs and before CMD');
c.ok(runtime.some(line => /chown\s+node:node\s+\/data/.test(line)), '/data is owned by node');
c.ok(runtime.some(line => /^HEALTHCHECK/.test(line)) && runtime.join('\n').includes('/v1/health'), 'HEALTHCHECK probes /v1/health');
c.match(runtime[cmdIndex], /server\/index\.js/, 'CMD runs server/index.js');

const stage = mkdtempSync(join(tmpdir(), 'pri-runtime-image-'));
for (const tokens of copies) {
  const fromStage = tokens[0].startsWith('--from=') ? tokens.shift() : null;
  const dest = tokens.pop();
  const destPath = join(stage, dest.replace(/^\.\//, ''));
  if (fromStage) {
    for (const src of tokens) {
      if (src.endsWith('client/dist')) {
        mkdirSync(join(destPath, 'assets'), { recursive: true });
        writeFileSync(join(destPath, 'index.html'), '<!doctype html><html><head><title>Pri</title><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>\n');
        writeFileSync(join(destPath, 'assets', 'app.js'), 'document.getElementById("root").textContent = "ok";\n');
      } else if (src.endsWith('node_modules')) {
        mkdirSync(dirname(destPath), { recursive: true });
        symlinkSync(join(ROOT, 'server', 'node_modules'), destPath, 'dir');
      } else {
        throw new Error(`unexpected multi-stage COPY source ${src}`);
      }
    }
    continue;
  }
  const directory = dest.endsWith('/') || tokens.length > 1;
  for (const src of tokens) {
    const target = directory ? join(destPath, basename(src)) : destPath;
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(ROOT, src), target, { recursive: true });
  }
}

for (const legacy of ['server/auth.js', 'server/routes', 'server/db.js', 'server/badges.js', 'server/seed.js', 'server/engine', 'client/src']) {
  c.ok(!existsSync(join(stage, legacy)), `${legacy} is not in the image`);
}
for (const required of ['server/index.js', 'server/app.js', 'server/package.json', 'server/platform/router.js', 'server/tools/housekeeping.mjs', 'server/tools/promote-role.mjs', 'client/dist/index.html']) {
  c.ok(existsSync(join(stage, required)), `${required} is in the image`);
}

const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port: free } = probe.address();
    probe.close(() => resolve(free));
  });
});
const dataDir = join(stage, 'data');
mkdirSync(dataDir, { recursive: true });
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: 'production',
  PORT: String(port),
  PRI_PUBLIC_ORIGIN: 'https://learn.pri.example',
  PRI_CSRF_SECRET: 'runtime-image-contract-secret',
  PRI_AUTH_DELIVERY_KEY: '33'.repeat(32),
  PRI_PLATFORM_DB: join(dataDir, 'pri-learning-platform.db'),
  PRI_AUTH_EMAIL_PROVIDER: 'resend',
  PRI_RESEND_API_KEY: 'contract-key-not-real',
  PRI_AUTH_EMAIL_FROM: 'Pri Learning <noreply@pri.example>'
};
const child = spawn(process.execPath, ['server/index.js'], { cwd: stage, env, stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '';
let stderr = '';
child.stdout.on('data', chunk => { stdout += chunk; });
child.stderr.on('data', chunk => { stderr += chunk; });
let exited = null;
child.on('exit', (code, signal) => { exited = { code, signal }; });
const origin = `http://127.0.0.1:${port}`;

async function waitForHealth() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`server exited before becoming healthy: ${JSON.stringify(exited)}\n${stderr}`);
    try {
      const r = await fetch(`${origin}/v1/health`);
      if (r.ok) return r;
    } catch { /* not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`server never became healthy\nstdout: ${stdout}\nstderr: ${stderr}`);
}

try {
  const health = await waitForHealth();
  const body = await health.json();
  c.eq(body.ok, true, 'health ok');
  c.eq(body.service, 'pri-learning-platform', 'health names the platform');
  c.eq(body.storage.persistentDatabase, true, 'persistent storage acknowledged');
  c.ok(Number.isInteger(body.housekeeping?.lastRunAt), 'housekeeping ran at startup and is reported by health');
  c.ok(existsSync(env.PRI_PLATFORM_DB), 'database created at PRI_PLATFORM_DB');

  for (const [method, path] of [['GET', '/api/auth/me'], ['POST', '/api/auth/login'], ['POST', '/api/auth/register'], ['GET', '/api/curriculum']]) {
    const r = await fetch(`${origin}${path}`, { method, headers: { 'Content-Type': 'application/json', Origin: env.PRI_PUBLIC_ORIGIN }, body: method === 'POST' ? JSON.stringify({ email: 'x@y.z', password: 'abcdef' }) : undefined });
    c.eq(r.status, 410, `${method} ${path} answers 410 in the production image`);
    c.eq((await r.json()).error?.code, 'LEGACY_API_REMOVED', `${method} ${path} names the removal`);
  }

  const shell = await fetch(`${origin}/`);
  c.eq(shell.status, 200, 'client shell served from the image');
  c.match(await shell.text(), /\/assets\/app\.js/, 'shell body served');
  c.match(shell.headers.get('content-security-policy'), /frame-ancestors 'none'/, 'shell carries the CSP');
  c.match(shell.headers.get('strict-transport-security'), /max-age=/, 'shell carries HSTS in production');
  c.eq(shell.headers.get('x-content-type-options'), 'nosniff', 'shell carries nosniff');
  c.eq((await fetch(`${origin}/assets/app.js`)).status, 200, 'assets served');
  const spa = await fetch(`${origin}/practice`);
  c.eq(spa.status, 200, 'SPA fallback served');
  c.match(await spa.text(), /\/assets\/app\.js/, 'SPA fallback is the shell');
  const missing = await fetch(`${origin}/v1/nope`);
  c.eq(missing.status, 404, 'unknown platform route 404');
  c.match(missing.headers.get('content-security-policy'), /default-src 'self'/, '404 carries the CSP');
  await fetch(`${origin}/v1/health?secret=do-not-log`);
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
}

const jsonLines = stdout.split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
c.ok(jsonLines.some(line => line.method === 'GET' && line.path === '/v1/health' && line.status === 200 && typeof line.ms === 'number'), 'request log lines are JSON with method/path/status/ms');
c.ok(jsonLines.some(line => line.path === '/api/auth/login' && line.status === 410), 'legacy refusals are logged');
c.ok(!stdout.includes('do-not-log') && !stdout.includes('?'), 'query strings never reach the log');
c.ok(!/cookie|user-agent|password/i.test(stdout), 'no cookies, user agents or credentials in the log');
c.eq(stderr.trim(), '', `no errors on stderr during boot and requests (${stderr.trim().slice(0, 200)})`);
rmSync(stage, { recursive: true, force: true });
assert.ok(c.count() > 20);
console.log(`PRODUCTION RUNTIME IMAGE — PASS — ${c.count()}/${c.count()} checks`);
