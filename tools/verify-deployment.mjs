#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · is the deployment at this origin exactly the release we meant?
//
// Read-only. It sends three unauthenticated GETs (/v1/health, /v1/ready,
// /release.json), reads no credential and changes nothing. It exits non-zero
// unless every one of these holds:
//
//   · /v1/health answers as pri-learning-platform and identifies the running
//     release/database engine;
//   · /v1/ready proves the database is reachable at the schema versions THIS
//     checkout expects and that verification email is configured;
//   · the server's release SHA is the one nominated (--sha);
//   · the web client the server ships carries the identical release identity;
//   · /v1/ready says the replica can serve (ready or degraded, never not_ready);
//   · with --engine, the database driver is the one the cutover step expects.
//
//   node tools/verify-deployment.mjs --origin https://learn.example.com \
//     --sha <40-hex main SHA> [--engine postgres|sqlite]
//
// Run it from a checkout at the nominated SHA, so the expected schema versions
// are the ones that build was compiled against.
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../server/platform/schemaVersions.js';

const SHA = /^[0-9a-f]{40}$/;
// A hanging origin fails the check rather than holding the operator's terminal.
const REQUEST_TIMEOUT_MS = 15_000;

export function parseArgs(argv) {
  const args = { origin: null, sha: null, engine: null, allowHttp: false, persistentStorageProven: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--allow-http') { args.allowHttp = true; continue; }
    if (flag === '--persistent-storage-proven') { args.persistentStorageProven = true; continue; }
    if (!['--origin', '--sha', '--engine'].includes(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
    args[flag.slice(2)] = value;
    i += 1;
  }
  if (!args.origin) throw new Error('--origin is required');
  if (!args.sha) throw new Error('--sha is required');
  return args;
}

function cleanOrigin(value, allowHttp) {
  let url;
  try { url = new URL(value); } catch { throw new Error('--origin is not a URL'); }
  const httpsOnly = !allowHttp;
  if (url.protocol !== 'https:' && (httpsOnly || url.protocol !== 'http:')) throw new Error('--origin must be https://');
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error('--origin must be a bare origin: no path, query or credentials');
  }
  return url.origin;
}

async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, body };
}

/**
 * Returns { ok, results: [{ ok, label, detail? }] }. Never throws for a failed
 * check; a network error becomes a failed check with its message.
 */
export async function verifyDeployment({ origin, sha, engine = null, allowHttp = false, persistentStorageProven = false, fetchImpl = globalThis.fetch }) {
  const results = [];
  const check = (ok, label, detail) => { results.push({ ok: !!ok, label, ...(detail ? { detail } : {}) }); return !!ok; };

  const base = cleanOrigin(origin, allowHttp);
  const expectedSha = String(sha || '').toLowerCase();
  if (!check(SHA.test(expectedSha), 'nominated SHA is a full 40-hex commit', sha)) return { ok: false, results };
  if (engine !== null && !['postgres', 'sqlite'].includes(engine)) throw new Error('--engine must be postgres or sqlite');

  let health, ready, web;
  try {
    [health, ready, web] = await Promise.all([
      getJson(fetchImpl, `${base}/v1/health`),
      getJson(fetchImpl, `${base}/v1/ready`),
      getJson(fetchImpl, `${base}/release.json`)
    ]);
  } catch (error) {
    check(false, 'origin reachable', error?.message || String(error));
    return { ok: false, results };
  }

  const h = health.body || {};
  const r = ready.body || {};
  const readyDb = r.checks?.database || {};
  const readyAuth = r.checks?.authEmail || {};
  const databaseEngine = readyDb.engine || h.database?.engine || null;
  const databaseReachable = readyDb.state === 'ok' || h.database?.reachable === true;
  const schemaVersion = readyDb.schemaVersion ?? h.schemaVersion;
  const billingSchemaVersion = readyDb.billingSchemaVersion ?? h.billingSchemaVersion;
  // Configured, not proven: a CI image carries a placeholder key, which the
  // readiness probe now reports as failing rather than ok.
  const authEmailConfigured = (typeof readyAuth.state === 'string' && readyAuth.state !== 'not_configured') || h.authDelivery?.email === true;

  check(health.status === 200 && h.ok === true, '/v1/health answers 200 ok', `status ${health.status}`);
  check(h.service === 'pri-learning-platform', 'service is pri-learning-platform', h.service);
  const runningSha = h.releaseIdentity?.releaseSha;
  check(runningSha === expectedSha, 'server release SHA is the nominated SHA', `running ${runningSha || 'unknown'}`);
  // Postgres is external durable storage. A transitional SQLite deployment
  // cannot prove its volume mount through the redacted public health surface,
  // so the caller must supply an explicit out-of-band proof (for example the
  // Railway volume inventory, or CI's mounted-file assertion).
  const persistenceProven = databaseEngine === 'postgres'
    || h.storage?.persistentDatabase === true
    || (databaseEngine === 'sqlite' && persistentStorageProven === true);
  check(persistenceProven, 'storage is persistent',
    databaseEngine === 'sqlite' && !persistenceProven ? 'SQLite needs --persistent-storage-proven after an out-of-band volume check' : undefined);
  check(databaseReachable, 'database reachable');
  if (engine) check(databaseEngine === engine, `database engine is ${engine}`, `running ${databaseEngine || 'unknown'}`);
  check(String(schemaVersion) === String(SCHEMA_VERSION), `schema_version is ${SCHEMA_VERSION}`, `running ${schemaVersion}`);
  check(String(billingSchemaVersion) === String(BILLING_SCHEMA_VERSION), `billing_schema_version is ${BILLING_SCHEMA_VERSION}`, `running ${billingSchemaVersion}`);
  check(authEmailConfigured, 'verification email provider configured');

  check(web.status === 200 && isDeepStrictEqual(web.body, h.releaseIdentity), 'web client release.json equals server release identity',
    web.status === 200 ? `web ${web.body?.releaseSha || 'unknown'}` : `status ${web.status}`);

  const readyDetail = [r.state, ...(r.failing || []), ...(r.degraded || []).map(code => `degraded:${code}`)].filter(Boolean).join(' ');
  check(ready.status === 200 && r.ready === true, '/v1/ready says this replica can serve', readyDetail || `status ${ready.status}`);
  check(!r.releaseSha || r.releaseSha === expectedSha, '/v1/ready reports the same SHA', r.releaseSha);

  return { ok: results.every(item => item.ok), results };
}

async function main() {
  let args;
  const usage = 'Usage: node tools/verify-deployment.mjs --origin https://… --sha <40-hex> [--engine postgres|sqlite] [--persistent-storage-proven]';
  let report;
  try {
    args = parseArgs(process.argv.slice(2));
    report = await verifyDeployment(args);
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exit(2);
  }
  const { ok, results } = report;
  for (const item of results) console.log(`  ${item.ok ? '✓' : '✗'} ${item.label}${item.detail ? `  (${item.detail})` : ''}`);
  const passed = results.filter(item => item.ok).length;
  console.log(`${ok ? 'DEPLOYMENT VERIFIED: PASS' : 'DEPLOYMENT VERIFIED: FAIL'} — ${passed}/${results.length}`);
  process.exit(ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
