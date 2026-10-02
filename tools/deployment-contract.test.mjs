// Railway deploy contract and the post-deploy verifier (ADR-0001 phase 4).
//
// 1. railway.json builds the root Dockerfile, gates a deploy on /v1/ready (a
//    route the server actually mounts), and gives the process longer to drain
//    than its own shutdown deadline, so Railway never SIGKILLs a clean exit.
// 2. tools/verify-deployment.mjs passes only an origin serving exactly the
//    nominated SHA on both server and web, at this checkout's schema versions,
//    and fails on each single drift.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../server/platform/schemaVersions.js';
import { parseArgs, verifyDeployment } from './verify-deployment.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;
const ok = (value, message) => { assert.ok(value, message); count += 1; };

// ── 1 · railway.json ────────────────────────────────────────────────────────
const railway = JSON.parse(readFileSync(join(ROOT, 'railway.json'), 'utf8'));
ok(railway.build?.builder === 'DOCKERFILE' && railway.build?.dockerfilePath === 'Dockerfile', 'Railway builds the root Dockerfile');
ok(!railway.build?.buildCommand && !railway.deploy?.startCommand, 'Railway does not override the image build or CMD');
ok(railway.deploy?.healthcheckPath === '/v1/ready', 'the deploy healthcheck is readiness, not liveness');
const router = readFileSync(join(ROOT, 'server', 'platform', 'router.js'), 'utf8');
ok(/router\.get\('\/ready'/.test(router), '/v1/ready is a mounted route');
const index = readFileSync(join(ROOT, 'server', 'index.js'), 'utf8');
const deadline = Number(index.match(/PRI_SHUTDOWN_DEADLINE_MS\)\s*\|\|\s*([\d_]+)/)?.[1]?.replace(/_/g, ''));
ok(Number.isFinite(deadline) && railway.deploy.drainingSeconds * 1000 > deadline,
  `drainingSeconds (${railway.deploy.drainingSeconds}s) exceeds the server's shutdown deadline (${deadline}ms)`);
ok(railway.deploy?.restartPolicyType === 'ON_FAILURE', 'a crashed process is restarted, a clean exit is not');
const containerWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'deployment-image.yml'), 'utf8');
ok(containerWorkflow.includes("'railway.json'"), 'the container workflow runs when railway.json changes');

// ── 2 · preflight agrees with the server about which database is required ──
const preflight = env => execFileSync(process.execPath, [join(ROOT, 'tools', 'production-preflight.mjs')], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
ok(/^  PRI_PLATFORM_DB$/m.test(preflight({})), 'preflight asks for PRI_PLATFORM_DB on SQLite');
ok(!/^  PRI_PLATFORM_DB$/m.test(preflight({ PRI_DATABASE_URL: 'postgresql://role@db.example/postgres?sslmode=verify-full' })),
  'preflight does not ask for PRI_PLATFORM_DB once PRI_DATABASE_URL selects Postgres');
const envExample = readFileSync(join(ROOT, '.env.production.example'), 'utf8');
ok(/PRI_DATABASE_URL=/.test(envExample) && /PRI_DATABASE_SSL_ROOT_CERT=/.test(envExample), '.env.production.example documents the Postgres variables');

// ── 3 · verify-deployment ───────────────────────────────────────────────────
const SHA = 'a'.repeat(40);
const identity = { releaseSha: SHA, buildTimestamp: '2026-10-02T00:00:00.000Z', version: '4.0.0' };
function healthy() {
  return {
    health: { ok: true, service: 'pri-learning-platform', releaseIdentity: { ...identity }, schemaVersion: String(SCHEMA_VERSION),
      billingSchemaVersion: String(BILLING_SCHEMA_VERSION), storage: { persistentDatabase: true },
      database: { engine: 'postgres', reachable: true }, authDelivery: { email: true } },
    ready: { ready: true, state: 'ready', releaseSha: SHA, failing: [], degraded: [] },
    readyStatus: 200,
    web: { ...identity }
  };
}
let state = healthy();
const server = createServer((req, res) => {
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.url === '/v1/health') return send(200, state.health);
  if (req.url === '/v1/ready') return send(state.readyStatus, state.ready);
  if (req.url === '/release.json') return send(200, state.web);
  send(404, {});
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const run = (extra = {}) => verifyDeployment({ origin, sha: SHA, allowHttp: true, ...extra });

try {
  ok((await run({ engine: 'postgres' })).ok, 'a deployment at the nominated SHA on Postgres passes');

  const drifts = [
    ['a different running SHA', s => { s.health.releaseIdentity.releaseSha = 'b'.repeat(40); s.web.releaseSha = 'b'.repeat(40); }],
    ['a web bundle from another build', s => { s.web.releaseSha = 'c'.repeat(40); }],
    ['non-persistent storage', s => { s.health.storage.persistentDatabase = false; }],
    ['an unreachable database', s => { s.health.database.reachable = false; }],
    ['a database one schema version behind', s => { s.health.schemaVersion = String(SCHEMA_VERSION - 1); }],
    ['a billing schema mismatch', s => { s.health.billingSchemaVersion = String(BILLING_SCHEMA_VERSION - 1); }],
    ['no verification email provider', s => { s.health.authDelivery.email = false; }],
    ['a not_ready replica', s => { s.readyStatus = 503; s.ready = { ready: false, state: 'not_ready', failing: ['AUTH_EMAIL_NOT_CONFIGURED'], degraded: [] }; }]
  ];
  for (const [name, mutate] of drifts) {
    state = healthy();
    mutate(state);
    ok(!(await run()).ok, `fails on ${name}`);
  }

  state = healthy();
  state.health.database.engine = 'sqlite';
  ok(!(await run({ engine: 'postgres' })).ok, 'fails when --engine postgres meets a SQLite deployment');
  ok((await run()).ok, 'passes a SQLite deployment when no engine is demanded');

  state = healthy();
  state.ready = { ready: true, state: 'degraded', releaseSha: SHA, failing: [], degraded: ['HANDWRITING_PROBING'] };
  ok((await run()).ok, 'a degraded but serving replica passes');

  ok(!(await verifyDeployment({ origin, sha: 'abc123', allowHttp: true })).ok, 'a short SHA is refused');
  await assert.rejects(() => verifyDeployment({ origin, sha: SHA }), /https/); count += 1;
  await assert.rejects(() => verifyDeployment({ origin: `${origin}/app`, sha: SHA, allowHttp: true }), /bare origin/); count += 1;
  const down = await verifyDeployment({ origin: 'http://127.0.0.1:1', sha: SHA, allowHttp: true });
  ok(!down.ok && down.results.some(item => item.label === 'origin reachable'), 'an unreachable origin fails, it does not throw');

  ok(parseArgs(['--origin', 'https://x.example', '--sha', SHA, '--engine', 'postgres']).engine === 'postgres', 'CLI arguments parse');
  assert.throws(() => parseArgs(['--origin', 'https://x.example'])); count += 1;
} finally {
  server.close();
}

console.log(`DEPLOYMENT CONTRACT — PASS — ${count}/${count} checks`);
