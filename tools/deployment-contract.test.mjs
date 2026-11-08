// Railway deploy contract and the post-deploy verifier (ADR-0001 phase 4).
//
// 1. railway.json builds the root Dockerfile, gates a deploy on /v1/ready (a
//    route the server actually mounts), and gives the process longer to drain
//    than its own shutdown deadline, so Railway never SIGKILLs a clean exit.
// 2. tools/verify-deployment.mjs passes only an origin serving exactly the
//    nominated SHA on both server and web, at this checkout's schema versions,
//    and fails on each single drift.
import assert from 'node:assert/strict';
// The staging journey proof (2b below): staging only, one release, no secrets in its evidence.
import { parseArgs as journeyArgs, redact as journeyRedact, report as journeyReport } from './staging-journey-proof.mjs';
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

// ── 1b · the SERVER_DOWN backstop watches both hosts and stays read-only ───
{
  const uptime = readFileSync(join(ROOT, '.github', 'workflows', 'staging-uptime.yml'), 'utf8');
  const { STAGING_ORIGIN, PRODUCTION_ORIGIN } = await import('../scripts/release-nominate.mjs');
  ok(uptime.includes(`base_url: ${STAGING_ORIGIN}`) && uptime.includes(`base_url: ${PRODUCTION_ORIGIN}`), 'the SERVER_DOWN backstop probes both the staging and the production origin the release tools use');
  ok(/fail-fast: false/.test(uptime), 'one host being down never cancels the probe of the other');
  ok(/^permissions:\n  contents: read\n\n/m.test(uptime) && !/secrets\./.test(uptime) && !/actions\/checkout/.test(uptime), 'the backstop is read-only: contents:read, no secrets, no checkout');
  ok(!/curl[^\n]*(-X|--request|--data|-d )/.test(uptime) && /\/v1\/health \/v1\/ready/.test(uptime), 'the backstop only GETs /v1/health and /v1/ready');
  ok(/BACKSTOP, not paging/.test(uptime) && /best-effort/.test(uptime), 'the workflow says it is a best-effort backstop, not the 1-minute SERVER_DOWN page');
  {
    // A hanging host must FAIL the job, not let it be cancelled at timeout-minutes (a cancelled
    // scheduled run emails nobody): the worst-case probe time must fit inside the job bound.
    const num = re => Number((uptime.match(re) || [])[1]);
    const maxTime = num(/--max-time (\d+)/), retries = num(/--retry (\d+)/), retryDelay = num(/--retry-delay (\d+)/), pause = num(/^\s*sleep (\d+)$/m);
    const paths = ((uptime.match(/for path in ([^;]+);/) || [])[1] || '').trim().split(/\s+/).length;
    const attempts = ((uptime.match(/for attempt in ([^;]+);/) || [])[1] || '').trim().split(/\s+/).length;
    const worst = paths * attempts * ((retries + 1) * maxTime + retries * retryDelay + pause);
    const bound = num(/timeout-minutes: (\d+)/) * 60;
    ok(Number.isFinite(worst) && worst > 0 && worst + 60 <= bound, `a hanging host fails the backstop before GitHub cancels it (worst case ${worst} s + 60 s setup within ${bound} s)`);
  }
  const alertsDoc = readFileSync(join(ROOT, 'docs', 'operations', 'alerts.md'), 'utf8');
  ok(/SERVER_DOWN` external \*\*backstop\*\*/.test(alertsDoc) && !/probes staging `\/v1\/health` and `\/v1\/ready` every 5 minutes/.test(alertsDoc), 'alerts.md does not claim a 5-minute check GitHub does not deliver');
}

// ── 2 · preflight agrees with the server about which database is required ──
const preflight = env => execFileSync(process.execPath, [join(ROOT, 'tools', 'production-preflight.mjs')], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
ok(/^  PRI_PLATFORM_DB$/m.test(preflight({})), 'preflight asks for PRI_PLATFORM_DB on SQLite');
ok(!/^  PRI_PLATFORM_DB$/m.test(preflight({ PRI_DATABASE_URL: 'postgresql://role@db.example/postgres?sslmode=verify-full' })),
  'preflight does not ask for PRI_PLATFORM_DB once PRI_DATABASE_URL selects Postgres');
const envExample = readFileSync(join(ROOT, '.env.production.example'), 'utf8');
ok(/PRI_DATABASE_URL=/.test(envExample) && /PRI_DATABASE_SSL_ROOT_CERT=/.test(envExample), '.env.production.example documents the Postgres variables');

// ── 2b · staging-journey-proof: staging only, one release, no secrets ──────
{
  const SHA40 = 'b'.repeat(40);
  const STAGING = 'https://pri-learning-staging-staging.up.railway.app';
  ok(journeyArgs(['--sha', SHA40]).origin === STAGING, 'the journey proof defaults to the staging origin');
  assert.throws(() => journeyArgs(['--sha', SHA40, '--origin', 'https://prilearning.com']), /refused/); count += 1;
  assert.throws(() => journeyArgs(['--sha', SHA40, '--origin', 'https://final-pri-learning-production.up.railway.app']), /refused/); count += 1;
  assert.throws(() => journeyArgs([]), /--sha/); count += 1;
  ok(journeyArgs(['--sha', SHA40, '--accounts']).accounts === true && journeyArgs(['--sha', SHA40]).accounts === false, 'accounts are made only with an explicit --accounts');
  const red = journeyRedact({ email: 'delivered+x@resend.dev', password: 'Pri-secret-staging', challengeId: 'abc', token: 't', nested: { sessionToken: 's', blockerCode: null, error: { code: 'EMAIL_UNVERIFIED' } }, blockerCode: 'GUARDIAN_CONSENT_PENDING', eligible: false });
  const flat = JSON.stringify(red);
  ok(!/Pri-secret|"abc"|"t"|"s"/.test(flat) && red.password === '[redacted]' && red.challengeId === '[redacted]', 'evidence redacts passwords, challenge ids and tokens');
  ok(red.nested.error.code === 'EMAIL_UNVERIFIED' && red.blockerCode === 'GUARDIAN_CONSENT_PENDING' && red.nested.blockerCode === null && red.eligible === false,
    'evidence keeps machine error codes, nulls and booleans');
  const md = journeyReport({ sha: SHA40, origin: STAGING, startedAt: 'a', finishedAt: 'b', accounts: true, deployed: {}, created: [{ role: 'adult', email: 'x@resend.dev' }], deleted: [], notDeleted: [{ role: 'adult', email: 'x@resend.dev', why: 'test' }],
    steps: [{ id: '2', name: 'n', status: 'FAIL', checks: [{ label: 'l', ok: false, detail: '' }], notes: [], evidence: [], shots: [], defects: [{ what: 'w', where: 'x', repro: 'r', lane: 'L2' }], blocked: [] }] });
  ok(/\| 2 · n \| \*\*FAIL\*\*/.test(md) && /\*\*Defect\*\* \(L2\)/.test(md) && /\*\*Not deleted: adult x@resend\.dev — test\.\*\*/.test(md),
    'the report lists each step\'s status, its defects with the owning lane, and every account it could not delete');
}


// ── 3 · verify-deployment ───────────────────────────────────────────────────
const SHA = 'a'.repeat(40);
const identity = { releaseSha: SHA, buildTimestamp: '2026-10-02T00:00:00.000Z', version: '4.0.0' };
function healthy() {
  return {
    // Current /v1/health is deliberately redacted: operator-only storage and
    // provider configuration are absent without PRI_METRICS_TOKEN.
    health: {
      ok: true, service: 'pri-learning-platform', releaseIdentity: { ...identity },
      schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION),
      database: { engine: 'postgres', reachable: true }
    },
    ready: {
      ready: true, state: 'ready', releaseSha: SHA, failing: [], degraded: [],
      checks: {
        database: {
          state: 'ok', code: null, engine: 'postgres',
          schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION),
          expectedSchemaVersion: String(SCHEMA_VERSION), expectedBillingSchemaVersion: String(BILLING_SCHEMA_VERSION)
        },
        authEmail: { state: 'ok', code: null, required: true }
      }
    },
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
    ['SQLite without persistent-volume proof', s => {
      s.health.database.engine = 'sqlite';
      s.ready.checks.database.engine = 'sqlite';
    }],
    ['an unreachable database', s => {
      s.health.database.reachable = false;
      s.ready.checks.database.state = 'unavailable';
    }],
    ['a database one schema version behind', s => {
      s.health.schemaVersion = String(SCHEMA_VERSION - 1);
      s.ready.checks.database.schemaVersion = String(SCHEMA_VERSION - 1);
    }],
    ['a billing schema mismatch', s => {
      s.health.billingSchemaVersion = String(BILLING_SCHEMA_VERSION - 1);
      s.ready.checks.database.billingSchemaVersion = String(BILLING_SCHEMA_VERSION - 1);
    }],
    ['no verification email provider', s => { s.ready.checks.authEmail.state = 'not_configured'; }],
    ['a not_ready replica', s => {
      s.readyStatus = 503;
      s.ready.ready = false;
      s.ready.state = 'not_ready';
      s.ready.failing = ['AUTH_EMAIL_NOT_CONFIGURED'];
    }]
  ];
  for (const [name, mutate] of drifts) {
    state = healthy();
    mutate(state);
    ok(!(await run()).ok, `fails on ${name}`);
  }

  state = healthy();
  state.health.database.engine = 'sqlite';
  state.health.storage = { persistentDatabase: true }; // legacy/operator proof for transitional SQLite
  state.ready.checks.database.engine = 'sqlite';
  ok(!(await run({ engine: 'postgres' })).ok, 'fails when --engine postgres meets a SQLite deployment');
  ok((await run()).ok, 'passes a SQLite deployment when legacy health proves persistent storage');

  state = healthy();
  state.health.database.engine = 'sqlite';
  state.ready.checks.database.engine = 'sqlite';
  ok((await run({ persistentStorageProven: true })).ok, 'passes SQLite when the caller supplies an out-of-band persistence proof');

  state = healthy();
  state.ready.state = 'degraded';
  state.ready.degraded = ['HANDWRITING_PROBE_PENDING'];
  ok((await run()).ok, 'a degraded but serving replica passes');

  ok(!(await verifyDeployment({ origin, sha: 'abc123', allowHttp: true })).ok, 'a short SHA is refused');
  await assert.rejects(() => verifyDeployment({ origin, sha: SHA }), /https/); count += 1;
  await assert.rejects(() => verifyDeployment({ origin: `${origin}/app`, sha: SHA, allowHttp: true }), /bare origin/); count += 1;
  const down = await verifyDeployment({ origin: 'http://127.0.0.1:1', sha: SHA, allowHttp: true });
  ok(!down.ok && down.results.some(item => item.label === 'origin reachable'), 'an unreachable origin fails, it does not throw');

  const parsed = parseArgs(['--origin', 'https://x.example', '--sha', SHA, '--engine', 'sqlite', '--persistent-storage-proven']);
  ok(parsed.engine === 'sqlite' && parsed.persistentStorageProven === true, 'CLI arguments parse, including the out-of-band persistence proof');
  assert.throws(() => parseArgs(['--origin', 'https://x.example'])); count += 1;
} finally {
  server.close();
}

console.log(`DEPLOYMENT CONTRACT — PASS — ${count}/${count} checks`);
