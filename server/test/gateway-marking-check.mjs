// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Marking gateway contract
//
// The gateway is the only process in the product that holds a secret and faces
// a network, so the things worth testing here are the ones that cost money or
// leak: does it refuse to start as an open proxy, does the bearer token
// actually gate anything, and does the rate limiter fire.
//
// Not one check below spends an OpenAI call. The gateway is started with no
// key at all, which is exactly what makes the ordering testable: the limiter
// and the auth check sit in front of the key check, so a request that would
// have cost money returns 401 or 429 before it can. If that order is ever
// reversed, these tests fail — which is the point of writing them this way.
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GATEWAY = join(here, '..', 'cloud', 'handwritingGateway.mjs');

let checks = 0;
const check = async (name, fn) => { await fn(); checks += 1; };

/** Start the gateway and wait until it says it is listening, or it exits. */
async function startGateway(env, { expectExit = false } = {}) {
  const child = spawn(process.execPath, [GATEWAY, '--http'], {
    env: { ...process.env, OPENAI_API_KEY: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  let err = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { err += d; });

  if (expectExit) {
    const [code] = await once(child, 'exit');
    return { child, code, out, err };
  }

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (/limits\s+\d+/.test(out)) return { child, out, err };
    if (child.exitCode !== null) throw new Error(`gateway exited early: ${err || out}`);
    await new Promise(r => setTimeout(r, 40));
  }
  child.kill('SIGKILL');
  throw new Error(`gateway did not start: ${err || out}`);
}

const stop = (child) => new Promise(resolve => {
  if (!child || child.exitCode !== null) return resolve();
  child.once('exit', resolve);
  child.kill('SIGKILL');
});

// A port unlikely to collide with the dev servers this repo runs.
let nextPort = 4831;
const port = () => String(nextPort++);

// ── It refuses to be an open proxy ───────────────────────────────────────────

await check('production without a client token refuses to start', async () => {
  const { code, err } = await startGateway(
    { NODE_ENV: 'production', PRI_CLOUD_PORT: port(), PRI_CLOUD_ALLOWED_ORIGINS: 'https://example.com' },
    { expectExit: true }
  );
  assert.equal(code, 1);
  assert.match(err, /PRI_CLOUD_CLIENT_TOKEN/);
  assert.match(err, /open proxy/);
});

await check('production without an origin allow-list refuses to start', async () => {
  const { code, err } = await startGateway(
    { NODE_ENV: 'production', PRI_CLOUD_PORT: port(), PRI_CLOUD_CLIENT_TOKEN: 'tok' },
    { expectExit: true }
  );
  assert.equal(code, 1);
  assert.match(err, /PRI_CLOUD_ALLOWED_ORIGINS/);
});

await check('production with both starts', async () => {
  const p = port();
  const { child } = await startGateway({
    NODE_ENV: 'production', PRI_CLOUD_PORT: p,
    PRI_CLOUD_CLIENT_TOKEN: 'tok', PRI_CLOUD_ALLOWED_ORIGINS: 'https://example.com'
  });
  try {
    const res = await fetch(`http://127.0.0.1:${p}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    // No key was given, and /health says so rather than claiming readiness.
    assert.equal(body.openaiConfigured, false);
  } finally { await stop(child); }
});

// ── The token gates both routes ──────────────────────────────────────────────

await check('the bearer token gates marking and recognition alike', async () => {
  const p = port();
  const { child } = await startGateway({ PRI_CLOUD_PORT: p, PRI_CLOUD_CLIENT_TOKEN: 'sekrit' });
  try {
    for (const path of ['/v1/working/mark', '/v1/handwriting/recognize']) {
      const bare = await fetch(`http://127.0.0.1:${p}${path}`, { method: 'POST', body: '{}' });
      assert.equal(bare.status, 401, `${path} answered an unauthenticated caller`);

      const wrong = await fetch(`http://127.0.0.1:${p}${path}`, {
        method: 'POST', body: '{}', headers: { authorization: 'Bearer nope' }
      });
      assert.equal(wrong.status, 401, `${path} accepted a wrong token`);

      // Right token: no key is configured, so it must fall through to 503 —
      // which proves auth passed without spending anything.
      const right = await fetch(`http://127.0.0.1:${p}${path}`, {
        method: 'POST', body: '{}', headers: { authorization: 'Bearer sekrit' }
      });
      assert.equal(right.status, 503, `${path} did not reach the key check`);
    }
  } finally { await stop(child); }
});

await check('a token of a different length is rejected, not crashed on', async () => {
  const p = port();
  const { child } = await startGateway({ PRI_CLOUD_PORT: p, PRI_CLOUD_CLIENT_TOKEN: 'sekrit' });
  try {
    const res = await fetch(`http://127.0.0.1:${p}/v1/working/mark`, {
      method: 'POST', body: '{}', headers: { authorization: 'Bearer much-much-longer-token' }
    });
    assert.equal(res.status, 401);
  } finally { await stop(child); }
});

// ── The limiter fires before anything is spent ───────────────────────────────

await check('the burst limit fires, and fires ahead of the key check', async () => {
  const p = port();
  const { child } = await startGateway({
    PRI_CLOUD_PORT: p, PRI_CLOUD_RATE_BURST: '3', PRI_CLOUD_RATE_WINDOW_MS: '60000'
  });
  try {
    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await fetch(`http://127.0.0.1:${p}/v1/working/mark`, { method: 'POST', body: '{}' });
      statuses.push(res.status);
    }
    // Three get as far as the missing key; the rest are refused before that.
    assert.deepEqual(statuses, [503, 503, 503, 429, 429]);
  } finally { await stop(child); }
});

await check('a rate-limited response says when to come back', async () => {
  const p = port();
  const { child } = await startGateway({ PRI_CLOUD_PORT: p, PRI_CLOUD_RATE_BURST: '1' });
  try {
    await fetch(`http://127.0.0.1:${p}/v1/working/mark`, { method: 'POST', body: '{}' });
    const res = await fetch(`http://127.0.0.1:${p}/v1/working/mark`, { method: 'POST', body: '{}' });
    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.code, 'RATE_LIMITED');
    assert.equal(body.scope, 'burst');
    assert.ok(body.retryAfter > 0);
    // The student-facing string never blames them and never mentions billing.
    assert.match(body.error, /Try again in a moment/);
  } finally { await stop(child); }
});

await check('the daily cap is separate from the burst window', async () => {
  const p = port();
  const { child } = await startGateway({
    PRI_CLOUD_PORT: p, PRI_CLOUD_RATE_BURST: '100', PRI_CLOUD_RATE_DAILY: '2'
  });
  try {
    const statuses = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await fetch(`http://127.0.0.1:${p}/v1/working/mark`, { method: 'POST', body: '{}' });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses, [503, 503, 429, 429]);
    const last = await fetch(`http://127.0.0.1:${p}/v1/working/mark`, { method: 'POST', body: '{}' });
    assert.equal((await last.json()).scope, 'daily');
  } finally { await stop(child); }
});

// ── Route surface ────────────────────────────────────────────────────────────

await check('the routes are exactly the two that exist', async () => {
  const p = port();
  const { child } = await startGateway({ PRI_CLOUD_PORT: p });
  try {
    const missing = await fetch(`http://127.0.0.1:${p}/v1/anything-else`, { method: 'POST', body: '{}' });
    assert.equal(missing.status, 404);

    const wrongMethod = await fetch(`http://127.0.0.1:${p}/v1/working/mark`);
    assert.equal(wrongMethod.status, 405);

    // /health is the one GET, and it must not need a token to answer — a
    // platform health check cannot carry one.
    const health = await fetch(`http://127.0.0.1:${p}/health`);
    assert.equal(health.status, 200);
  } finally { await stop(child); }
});

await check('every response carries a request id to correlate with the logs', async () => {
  const p = port();
  const { child } = await startGateway({ PRI_CLOUD_PORT: p });
  try {
    for (const path of ['/health', '/v1/working/mark', '/v1/nope']) {
      const res = await fetch(`http://127.0.0.1:${p}${path}`, { method: path === '/health' ? 'GET' : 'POST', body: path === '/health' ? undefined : '{}' });
      const body = await res.json();
      assert.match(String(body.requestId || ''), /^[0-9a-f-]{36}$/, `${path} returned no request id`);
    }
  } finally { await stop(child); }
});

console.log(`✔ GATEWAY MARKING SUITE PASSED — ${checks}/${checks} checks`);
