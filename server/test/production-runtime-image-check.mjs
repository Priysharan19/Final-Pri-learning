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
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
// A runtime import added by the online-only grader needs the canonical engine.
// The private mathematical source is the sole exception to the no-client-src
// rule. Pin the exact source *and* destination: an accidental whole-client or
// unauthorised web/notes source COPY must fail this contract.
const clientRuntimeCopies = copies.flatMap(tokens => {
  const sourceStart = tokens[0]?.startsWith('--from=') ? 1 : 0;
  const dest = tokens.at(-1);
  return tokens.slice(sourceStart, -1)
    .filter(src => /^(?:client(?:\/|$)|\/app\/client(?:\/|$))/.test(src))
    .map(src => [src, dest]);
});
const requiredClientCopies = [
  ['client/src/engine', './client/src/engine'],
  ['client/package.json', './client/package.json'],
  ['/app/client/dist', './client/dist']
];
const stablePairs = arr => arr.map(pair => pair.join(' -> ')).sort();
c.eq(JSON.stringify(stablePairs(clientRuntimeCopies)), JSON.stringify(stablePairs(requiredClientCopies)),
  'runtime allowlists ONLY the private maths engine, its ESM package marker and compiled web dist');

const userIndex = runtime.findIndex(line => /^USER\s+node\s*$/.test(line));
const lastCopy = runtime.reduce((last, line, index) => (/^COPY\s/.test(line) ? index : last), -1);
const cmdIndex = runtime.findIndex(line => /^CMD\s/.test(line));
c.ok(userIndex > lastCopy && userIndex < cmdIndex, 'USER node is set after the COPYs and before CMD');
c.ok(runtime.some(line => /chown\s+node:node\s+\/data/.test(line)), '/data is owned by node');
c.ok(runtime.some(line => /^HEALTHCHECK/.test(line)) && runtime.join('\n').includes('/v1/health'), 'HEALTHCHECK probes /v1/health');
c.match(runtime[cmdIndex], /server\/index\.js/, 'CMD runs server/index.js');

// ── Build-time release identity: every variable it reads is a declared ARG ──
// Docker and Railway expose a build variable only to a stage that declares it.
// A variable the identity code reads but the client-build stage does not
// declare is silently empty at build time and present at run time, which bakes
// a different SHA into client/dist/release.json from the one the server
// reports, and /v1/health fails closed on the mismatch.
const releaseIdentityModule = await import(pathToFileURL(join(ROOT, 'release', 'release-identity.mjs')));
const clientBuildStart = dockerfile.findIndex(line => /^FROM\s+\S+\s+AS\s+client-build\s*$/i.test(line));
c.ok(clientBuildStart >= 0, 'Dockerfile has a client-build stage');
const clientBuildEnd = dockerfile.findIndex((line, index) => index > clientBuildStart && /^FROM\s/i.test(line));
const clientBuild = dockerfile.slice(clientBuildStart + 1, clientBuildEnd);
const declaredArgs = new Set(clientBuild.filter(line => /^ARG\s/.test(line)).map(line => line.replace(/^ARG\s+/, '').split('=')[0].trim()));
const identitySourceEnv = new Set();
for (const file of ['release/release-identity.mjs', 'release/docker-build-identity.mjs']) {
  for (const match of readFileSync(join(ROOT, file), 'utf8').matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)) identitySourceEnv.add(match[1]);
}
c.ok(identitySourceEnv.has('RAILWAY_GIT_COMMIT_SHA') && identitySourceEnv.has('PRI_RELEASE_SHA'), `identity variables were found in the source (${[...identitySourceEnv].join(', ')})`);
for (const name of identitySourceEnv) {
  c.ok(releaseIdentityModule.DEPLOYMENT_IDENTITY_ENV.includes(name), `${name} is listed in DEPLOYMENT_IDENTITY_ENV`);
}
for (const name of releaseIdentityModule.DEPLOYMENT_IDENTITY_ENV) {
  c.ok(declaredArgs.has(name), `the client-build stage declares ARG ${name}`);
}
c.ok(clientBuild.some(line => /^RUN\s+node\s+release\/docker-build-identity\.mjs\s*$/.test(line)),
  'the client is built through the shared build-identity wrapper');
c.ok(!clientBuild.some(line => /^RUN\b.*npm run build/.test(line)), 'no client build bypasses the shared precedence');

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

// Actual staged COPY contents, not merely Dockerfile text.
for (const required of ['client/src/engine/generators/index.js', 'client/src/engine/checker.js',
  'client/src/engine/answer-forms.js', 'client/package.json']) {
  c.ok(existsSync(join(stage, required)), `${required} is available to the production grader`);
}
c.eq(JSON.stringify(readdirSync(join(stage, 'client', 'src')).sort()), JSON.stringify(['engine']),
  'no other client source directory can enter the production image');
c.eq(JSON.parse(readFileSync(join(stage, 'client', 'package.json'), 'utf8')).type, 'module',
  'runtime maths engine retains the ESM package scope');
const stagedMaths = await import(pathToFileURL(join(stage, 'client', 'src', 'engine', 'generators', 'index.js')));
await stagedMaths.loadAllBanks();
const canonical = stagedMaths.generateQuestion('c11-complex-numbers', 3, 56);
c.ok(canonical?.answer && canonical?.prompt, 'canonical generator executes with ONLY packaged runtime sources');
c.eq(canonical.answer.value, 135, 'private generated maths key stays available to the server');
for (const legacy of ['server/auth.js', 'server/routes', 'server/db.js', 'server/badges.js', 'server/seed.js', 'server/engine']) {
  c.ok(!existsSync(join(stage, legacy)), `${legacy} is not in the image`);
}
for (const required of ['server/index.js', 'server/app.js', 'server/package.json', 'server/platform/router.js', 'server/tools/housekeeping.mjs', 'server/tools/promote-role.mjs', 'release/metadata.json', 'release/release-identity.mjs', 'client/dist/index.html']) {
  c.ok(existsSync(join(stage, required)), `${required} is in the image`);
}

const dataDir = join(stage, 'data');
mkdirSync(dataDir, { recursive: true });
const testReleaseSha = '0123456789abcdef0123456789abcdef01234567';
const testBuildTimestamp = '2026-09-30T00:00:00.000Z';
const releaseJsonPath = join(stage, 'client', 'dist', 'release.json');
const metadata = JSON.parse(readFileSync(join(ROOT, 'release', 'metadata.json'), 'utf8'));
const builtIdentity = (releaseSha, buildTimestamp) => ({
  schemaVersion: 1,
  repository: metadata.repository,
  branch: metadata.branch,
  productVersion: metadata.productVersion,
  curriculumVersion: metadata.curriculumVersion,
  releaseSha,
  buildTimestamp
});

// ── Build-time and run-time resolvers agree for the same deployment env ─────
// Both run against the staged image copy (no .git, exactly like the image), so
// this is the code path the container executes. "Build" is what the Docker
// client-build stage does: docker-build-identity.mjs, then vite.config.js
// applying the precedence again. "Run" is server/platform/releaseIdentity.js.
const stagedRelease = await import(pathToFileURL(join(stage, 'release', 'release-identity.mjs')));
const stagedBuild = await import(pathToFileURL(join(stage, 'release', 'docker-build-identity.mjs')));
const stagedServer = await import(pathToFileURL(join(stage, 'server', 'platform', 'releaseIdentity.js')));
const railwaySha = 'a'.repeat(40);
const staleSha = 'f'.repeat(40);
const buildNow = new Date('2026-10-01T12:34:56.789Z');
for (const [label, deployEnv] of [
  ['Railway Git deploy, no PRI_* variables', { RAILWAY_GIT_COMMIT_SHA: railwaySha }],
  ['Railway Git deploy with stale manual PRI_* variables', { RAILWAY_GIT_COMMIT_SHA: railwaySha, PRI_RELEASE_SHA: staleSha, PRI_BUILD_TIMESTAMP: '2020-01-01T00:00:00.000Z' }],
  ['Railway Git deploy with matching PRI_* variables', { RAILWAY_GIT_COMMIT_SHA: railwaySha, PRI_RELEASE_SHA: railwaySha, PRI_BUILD_TIMESTAMP: testBuildTimestamp }],
  ['explicit PRI_* candidate, no Railway SHA', { PRI_RELEASE_SHA: testReleaseSha, PRI_BUILD_TIMESTAMP: testBuildTimestamp }]
]) {
  const built = stagedRelease.resolveReleaseIdentity({
    root: stage,
    production: true,
    env: stagedRelease.applyDeploymentPrecedence(stagedBuild.dockerBuildIdentityEnv(deployEnv, buildNow))
  });
  const run = stagedServer.serverReleaseIdentity({
    env: { ...deployEnv, NODE_ENV: 'production', RAILWAY_DEPLOYMENT_ID: 'agreement-check' },
    readBuilt: () => ({ ...built })
  });
  c.eq(JSON.stringify(run), JSON.stringify(built), `build-time and run-time identity agree: ${label}`);
  c.eq(run.releaseSha, deployEnv.RAILWAY_GIT_COMMIT_SHA || deployEnv.PRI_RELEASE_SHA, `RAILWAY_GIT_COMMIT_SHA > PRI_RELEASE_SHA: ${label}`);
}
// The old failure mode, pinned: a build that never saw RAILWAY_GIT_COMMIT_SHA
// (the ARG was undeclared) must be caught as a mismatch, not served.
const blindBuild = stagedRelease.resolveReleaseIdentity({
  root: stage,
  production: true,
  env: stagedRelease.applyDeploymentPrecedence(stagedBuild.dockerBuildIdentityEnv({ PRI_RELEASE_SHA: staleSha }, buildNow))
});
let blindMismatch = null;
try {
  stagedServer.serverReleaseIdentity({
    env: { NODE_ENV: 'production', RAILWAY_DEPLOYMENT_ID: 'agreement-check', RAILWAY_GIT_COMMIT_SHA: railwaySha, PRI_RELEASE_SHA: staleSha },
    readBuilt: () => ({ ...blindBuild })
  });
} catch (error) { blindMismatch = error; }
c.match(String(blindMismatch?.message), /mismatch for releaseSha/, 'a client built without the Railway SHA is refused as a mismatch, never served');

const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port: free } = probe.address();
    probe.close(() => resolve(free));
  });
});
const baseEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: 'production',
  PORT: String(port),
  PRI_PUBLIC_ORIGIN: 'https://learn.pri.example',
  PRI_CSRF_SECRET: 'runtime-image-contract-secret-32chars-long',
  // The operator's view of /v1/health (storage, providers, housekeeping) is
  // answered only to this bearer in production (operatorHealth.js).
  PRI_METRICS_TOKEN: 'runtime-image-metrics-token-32chars-long',
  PRI_AUTH_DELIVERY_KEY: '33'.repeat(32),
  PRI_PLATFORM_DB: join(dataDir, 'pri-learning-platform.db'),
  // Nothing forwards for this child: the test talks straight to its socket.
  PRI_TRUSTED_PROXY_HOPS: '0',
  PRI_AUTH_EMAIL_PROVIDER: 'resend',
  PRI_RESEND_API_KEY: 'contract-key-not-real',
  PRI_AUTH_EMAIL_FROM: 'Pri Learning <noreply@pri.example>'
};
const origin = `http://127.0.0.1:${port}`;

async function bootImage(caseEnv) {
  const env = { ...baseEnv, ...caseEnv };
  const child = spawn(process.execPath, ['server/index.js'], { cwd: stage, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const run = { child, env, stdout: '', stderr: '', exited: null };
  child.stdout.on('data', chunk => { run.stdout += chunk; });
  child.stderr.on('data', chunk => { run.stderr += chunk; });
  child.on('exit', (code, signal) => { run.exited = { code, signal }; });
  return run;
}

async function waitForHealth(run) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (run.exited) throw new Error(`server exited before becoming healthy: ${JSON.stringify(run.exited)}\n${run.stderr}`);
    try {
      const r = await fetch(`${origin}/v1/health`);
      if (r.ok) return r;
    } catch { /* not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`server never became healthy\nstdout: ${run.stdout}\nstderr: ${run.stderr}`);
}

async function stopImage(run) {
  // Only wait for an exit that is still coming. When the child died on its own
  // — a boot that fails closed on missing configuration, say — this await never
  // settled, and Node exits 0 on an unsettled top-level await: the contract
  // reported success by falling silent, which is the one thing a contract may
  // not do.
  if (!run.exited) {
    run.child.kill('SIGTERM');
    await new Promise(resolve => run.child.once('exit', resolve));
  }
}

// ── Case 1 · Railway Git deployment with stale manual PRI_* values ──────────
writeFileSync(releaseJsonPath, JSON.stringify(builtIdentity(testReleaseSha, testBuildTimestamp), null, 2));
const railway = await bootImage({
  RAILWAY_GIT_COMMIT_SHA: testReleaseSha,
  RAILWAY_DEPLOYMENT_ID: 'runtime-image-contract',
  // These simulate stale values from an earlier manual exact-candidate deploy.
  // Railway's own Git SHA and the newly built client identity must outrank them.
  PRI_RELEASE_SHA: staleSha,
  PRI_BUILD_TIMESTAMP: '2020-01-01T00:00:00.000Z'
});
try {
  const health = await waitForHealth(railway);
  const body = await health.json();
  c.eq(body.ok, true, 'health ok');
  c.eq(body.service, 'pri-learning-platform', 'health names the platform');
  c.eq(body.releaseIdentity?.releaseSha, testReleaseSha, 'Railway: health reports Railway\'s Git SHA over a stale PRI_RELEASE_SHA');
  c.eq(body.releaseIdentity?.buildTimestamp, testBuildTimestamp, 'Railway: health reports the timestamp baked into the client build');
  c.eq(body.storage, undefined, 'anonymous health does not say whether or where the database persists');
  c.eq(body.identityProviders, undefined, 'anonymous health does not list configured identity providers');
  c.eq(body.housekeeping, undefined, 'anonymous health carries no housekeeping counts');
  const operatorBody = await (await fetch(`${origin}/v1/health`, { headers: { Authorization: `Bearer ${railway.env.PRI_METRICS_TOKEN}` } })).json();
  c.eq(operatorBody.storage.persistentDatabase, true, 'persistent storage acknowledged to the operator token');
  c.ok(Number.isInteger(operatorBody.housekeeping?.lastRunAt), 'housekeeping ran at startup and is reported by health to the operator token');
  c.ok(existsSync(railway.env.PRI_PLATFORM_DB), 'database created at PRI_PLATFORM_DB');

  for (const [method, path] of [['GET', '/api/auth/me'], ['POST', '/api/auth/login'], ['POST', '/api/auth/register'], ['GET', '/api/curriculum']]) {
    const r = await fetch(`${origin}${path}`, { method, headers: { 'Content-Type': 'application/json', Origin: railway.env.PRI_PUBLIC_ORIGIN }, body: method === 'POST' ? JSON.stringify({ email: 'x@y.z', password: 'abcdef' }) : undefined });
    c.eq(r.status, 410, `${method} ${path} answers 410 in the production image`);
    c.eq((await r.json()).error?.code, 'LEGACY_API_REMOVED', `${method} ${path} names the removal`);
  }

  const anonIssue = await fetch(`${origin}/v1/practice/issue`, {
    method: 'POST',
    headers: { Origin: railway.env.PRI_PUBLIC_ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ generator: 'c11-complex-numbers', difficulty: 3, curriculum: 'in' })
  });
  c.eq(anonIssue.status, 401, 'real production image mounts server issue endpoint but requires authentication');
  c.eq((await anonIssue.json()).error?.code, 'AUTH_REQUIRED', 'anonymous issuance refuses without leaking canonical answers');

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
  await stopImage(railway);
}

const jsonLines = railway.stdout.split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
c.ok(jsonLines.some(line => line.event === 'http_request' && line.method === 'GET' && line.route === '/v1/health' && line.status === 200 && typeof line.ms === 'number'), 'request log lines are JSON with method/route/status/ms');
c.ok(jsonLines.some(line => line.event === 'http_request' && line.route === '/v1/health' && line.release === testReleaseSha && line.db === 'sqlite' && typeof line.requestId === 'string'), 'request log lines name the request id, the release SHA and the database engine');
c.ok(jsonLines.some(line => line.route === '/api/<unmatched>' && line.status === 410 && line.code === 'LEGACY_API_REMOVED'), 'legacy refusals are logged with their code');
c.ok(!railway.stdout.includes('do-not-log') && !railway.stdout.includes('?'), 'query strings never reach the log');
c.ok(!/cookie|user-agent|password/i.test(railway.stdout), 'no cookies, user agents or credentials in the log');
c.eq(railway.stderr.trim(), '', `no errors on stderr during boot and requests (${railway.stderr.trim().slice(0, 200)})`);

// ── Case 2 · Plain PRI_RELEASE_SHA/PRI_BUILD_TIMESTAMP (non-Railway) ────────
// GitHub CI's image build and any non-Railway host supply the identity
// explicitly; no Railway variables are present at all.
const plainSha = '89abcdef0123456789abcdef0123456789abcdef';
const plainTimestamp = '2026-09-29T08:00:00.000Z';
writeFileSync(releaseJsonPath, JSON.stringify(builtIdentity(plainSha, plainTimestamp), null, 2));
const plain = await bootImage({ PRI_RELEASE_SHA: plainSha, PRI_BUILD_TIMESTAMP: plainTimestamp });
try {
  const body = await (await waitForHealth(plain)).json();
  c.eq(body.ok, true, 'plain PRI_*: health ok');
  c.eq(body.releaseIdentity?.releaseSha, plainSha, 'plain PRI_*: health reports PRI_RELEASE_SHA');
  c.eq(body.releaseIdentity?.buildTimestamp, plainTimestamp, 'plain PRI_*: health reports PRI_BUILD_TIMESTAMP');
  const web = await (await fetch(`${origin}/release.json`)).json();
  c.eq(JSON.stringify(web), JSON.stringify(body.releaseIdentity), 'plain PRI_*: /release.json equals the health identity');
} finally {
  await stopImage(plain);
}
c.eq(plain.stderr.trim(), '', `plain PRI_*: no errors on stderr (${plain.stderr.trim().slice(0, 200)})`);
rmSync(stage, { recursive: true, force: true });
assert.ok(c.count() > 20);
console.log(`PRODUCTION RUNTIME IMAGE — PASS — ${c.count()}/${c.count()} checks`);
