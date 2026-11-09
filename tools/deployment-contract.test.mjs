// Railway deploy contract and the post-deploy verifier (ADR-0001 phase 4).
//
// 1. railway.json builds the root Dockerfile, gates a deploy on /v1/ready (a
//    route the server actually mounts), and gives the process longer to drain
//    than its own shutdown deadline, so Railway never SIGKILLs a clean exit.
// 2. tools/verify-deployment.mjs passes only an origin serving exactly the
//    nominated SHA on both server and web, at this checkout's schema versions,
//    and fails on each single drift.
// 3. tools/verify-deployment-proxy.mjs (#653) tells a server that counts its
//    anonymous rate limits per client apart from one that counts the proxy's
//    edge node, or that a forged X-Forwarded-For can escape.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../server/platform/schemaVersions.js';
import { parseArgs, verifyDeployment } from './verify-deployment.mjs';
import { classify } from './verify-deployment-proxy.mjs';

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
// #218: production refuses to start with no mail transport, so preflight must
// list the three auth-email variables as required, not optional.
const bare = preflight({});
for (const name of ['PRI_AUTH_EMAIL_PROVIDER', 'PRI_RESEND_API_KEY', 'PRI_AUTH_EMAIL_FROM']) {
  ok(new RegExp(`^  ${name}$`, 'm').test(bare), `preflight asks for ${name} as a required variable`);
}
ok(!/'re_[A-Za-z0-9]/.test(bare), 'preflight never prints anything shaped like a Resend key');
const email = from => preflight({ PRI_AUTH_EMAIL_PROVIDER: 'resend', PRI_RESEND_API_KEY: 'set', PRI_AUTH_EMAIL_FROM: from });
ok(!/^  PRI_AUTH_EMAIL_FROM$/m.test(email('Pri Learning <verify@mail.prilearning.com>')) && !/Auth email will not reach/.test(email('Pri Learning <verify@mail.prilearning.com>')),
  'a readable sender on a real domain is accepted without a warning');
ok(/Resend's test sender/.test(email('Pri <onboarding@resend.dev>')), 'preflight warns that the resend.dev test sender reaches nobody but the account owner');
ok(/example domain/.test(email('Pri Learning <noreply@example.com>')), 'preflight warns when the template\'s example sender was pasted unchanged');
ok(/not an address the server can read/.test(email('Pri Learning')), 'preflight warns about a sender with no address');
ok(/only provider the server supports/.test(preflight({ PRI_AUTH_EMAIL_PROVIDER: 'smtp' })), 'preflight warns about an unsupported provider');
ok(/PRI_DATABASE_URL=/.test(envExample) && /PRI_DATABASE_SSL_ROOT_CERT=/.test(envExample), '.env.production.example documents the Postgres variables');
// D3: launch signs in with an email code and a password. SMS, Apple and Google
// stay off, so the template leaves them unset and preflight flags a leftover.
ok(!/^PRI_SMS_PROVIDER=\S/m.test(envExample) && !/^PRI_(GOOGLE|APPLE)_(WEB_CLIENT_ID|CLIENT_IDS)=\S/m.test(envExample),
  '.env.production.example leaves SMS, Google and Apple sign-in off (D3)');
ok(!/launch keeps off/.test(bare), 'preflight raises no sign-in warning when SMS, Google and Apple are unset');
ok(/PRI_SMS_PROVIDER is set/.test(preflight({ PRI_SMS_PROVIDER: 'msg91' })), 'preflight warns that a set PRI_SMS_PROVIDER offers phone codes at launch (D3)');
ok(/PRI_GOOGLE_CLIENT_IDS is set/.test(preflight({ PRI_GOOGLE_CLIENT_IDS: 'id.apps.googleusercontent.com' }))
  && /PRI_APPLE_CLIENT_IDS, PRI_APPLE_WEB_CLIENT_ID are set/.test(preflight({ PRI_APPLE_CLIENT_IDS: 'com.example', PRI_APPLE_WEB_CLIENT_ID: 'com.example.web' })),
  'preflight warns that Google or Apple sign-in would show at launch (D3)');

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

// ── 4 · verify-deployment-proxy: whose address the rate limiters count ─────
{
  const t0 = 1_800_000_000; // a run that started at this second
  const open = t0 + 60;     // a window opened during the run
  const sample = (node, reset, forged = false) => ({ node, reset, forged });
  const nodes = ['sin1.a', 'sin1.b', 'sin1.c'];
  // One client at a fixed address: one bucket whichever edge node carries it.
  const fixed = [...Array(12)].map((_, i) => sample(nodes[i % 3], open));
  const clean = classify([...fixed, ...[...Array(4)].map((_, i) => sample(nodes[i % 3], open, true))], t0);
  ok(clean.verdict === 'SINGLE-BUCKET', 'one bucket across edge nodes, forged headers inside it: SINGLE-BUCKET (consistent with per-client, not proof)');
  const spoofed = classify([...fixed, sample('sin1.a', open, true), sample('sin1.b', open + 3, true)], t0);
  ok(spoofed.verdict === 'SPOOFABLE', 'a forged X-Forwarded-For that gets a bucket of its own is SPOOFABLE');
  // The staging measurement of 8 Nov 2026: one bucket per edge node.
  const perNode = classify([...Array(12)].map((_, i) => sample(nodes[i % 3], open + (i % 3))), t0);
  ok(perNode.verdict === 'PER-EDGE-NODE', 'one bucket per edge node over several nodes is PER-EDGE-NODE');
  // A client whose own address changes per connection: buckets vary within a node.
  const rotating = classify([...Array(12)].map((_, i) => sample(nodes[i % 3], open + i)), t0);
  ok(rotating.verdict === 'INCONCLUSIVE', 'a client whose address changes per connection is INCONCLUSIVE, not a pass');
  const single = classify([...Array(12)].map(() => sample('sin1.a', open)), t0);
  ok(single.verdict === 'INCONCLUSIVE', 'a single edge node cannot tell node from client: INCONCLUSIVE');
  // A bucket that existed before the run can roll over during it; it is not counted.
  const stale = classify([...Array(12)].map((_, i) => sample(nodes[i % 3], t0 + 10 + (i % 3))), t0);
  ok(stale.verdict === 'INCONCLUSIVE' && stale.facts.counted === 0, 'buckets opened before the run are not counted');
  const once = classify([sample('sin1.a', open), sample('sin1.b', open + 1), ...[...Array(8)].map(() => sample('sin1.c', open + 2))], t0);
  ok(once.verdict !== 'PER-EDGE-NODE', 'a node seen once is not enough to call the identity per node');
  // Review of #738: two per-node buckets opened in the same second share a Reset; Remaining shows it.
  const rem = (node, reset, remaining, forged = false) => ({ node, reset, remaining, forged });
  const collide = classify([rem('sin1.a', open, 59), rem('sin1.b', open, 59), rem('sin1.a', open, 58), rem('sin1.b', open, 58), rem('sin1.a', open, 57), rem('sin1.b', open, 57), rem('sin1.a', open, 56), rem('sin1.b', open, 56), rem('sin1.a', open, 55, true)], t0);
  ok(collide.verdict !== 'SINGLE-BUCKET' && collide.facts.collided, 'buckets sharing a Reset second (Remaining repeats) are never read as one bucket');
  const plainRun = [...Array(9)].map((_, i) => rem(nodes[i % 3], open, 59 - i));
  const staleForged = classify([...plainRun, rem('sin1.a', t0 + 5, 40, true)], t0);
  ok(staleForged.verdict === 'SPOOFABLE', 'a forged request landing in an older bucket of its own is an escape, even though its window is not fresh');
  const realIpOnly = classify([...plainRun, { node: 'sin1.a', reset: open, remaining: 49, realIpOnly: true }], t0);
  ok(realIpOnly.verdict === 'INCONCLUSIVE' && /no forged/.test(realIpOnly.reason), 'X-Real-IP samples never satisfy the forged-request guard');
  ok(classify(plainRun.slice(0, 5).concat(rem('sin1.a', open, 50, true)), t0).verdict === 'INCONCLUSIVE', 'too few plain samples is INCONCLUSIVE, never a pass');
  ok(/'SINGLE-BUCKET' \? 0 : out\.verdict === 'INCONCLUSIVE' \? 2 : 1/.test(readFileSync(join(ROOT, 'tools', 'verify-deployment-proxy.mjs'), 'utf8')), 'only SINGLE-BUCKET exits 0');
  const staging = readFileSync(join(ROOT, '.github', 'workflows', 'release-staging-proof.yml'), 'utf8');
  ok(/set \+e\n\s+node tools\/verify-deployment-proxy\.mjs/.test(staging), 'the advisory step turns off bash -e before the probe, so a red verdict cannot fail the proof');
  const proxySource = readFileSync(join(ROOT, 'tools', 'verify-deployment-proxy.mjs'), 'utf8');
  ok(/agent: false/.test(proxySource) && !/method: '(POST|PUT|PATCH|DELETE)'/.test(proxySource) && /'\/v1\/content\/published-index'/.test(proxySource),
    'the proxy probe only sends anonymous GETs to the published content index, each on a new connection');
}

console.log(`DEPLOYMENT CONTRACT — PASS — ${count}/${count} checks`);
