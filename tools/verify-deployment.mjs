#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · is the deployment at this origin exactly the release we meant?
//
// Read-only. It sends four unauthenticated GETs (/v1/health, /v1/ready,
// /release.json, /v1/billing/config), reads no credential and changes nothing.
// It exits non-zero unless every one of these holds:
//
//   · /v1/health answers as pri-learning-platform and identifies the running
//     release/database engine;
//   · /v1/ready proves the database is reachable at the schema versions THIS
//     checkout expects and that verification email is configured;
//   · the server's release SHA is the one nominated (--sha);
//   · the web client the server ships carries the identical release identity;
//   · /v1/ready says the replica can serve (ready or degraded, never not_ready);
//   · web checkout is off: the terms and the refund policy say there is no
//     purchase on the website, and the web client offers Razorpay checkout
//     whenever this route reports it configured (CloudAccountPanel.jsx);
//   · with --engine, the database driver is the one the cutover step expects.
//   · with --edition, the deployment is that regional edition, server and
//     client alike (see the opt-in checks below).
//
//   node tools/verify-deployment.mjs --origin https://learn.example.com \
//     --sha <40-hex main SHA> [--engine postgres|sqlite]
//
// Three OPT-IN checks, for a production release (docs/operations/production-config-v1.md).
// Without them the tool sends exactly the three GETs above and prints exactly
// the rows it always has (tools/verify-deployment.test.mjs pins that byte for byte):
//
//   --require-handwriting   /v1/ready checks.handwriting.state must be `ok`: the
//                           server reader answers its provider probe. A `probing`
//                           answer is read again, at most HANDWRITING_REREADS times.
//   --expect-config <file>  the public, unauthenticated configuration matches the
//                           manifest: each probe is one more GET (never a write,
//                           never a credential) whose status and named JSON fields
//                           must equal the manifest's values, and the manifest's
//                           public origin must serve this exact release. <file> is
//                           the manifest Markdown (the block between the
//                           pri-expected-public-config markers) or a .json file.
//
//   --edition <id>          the deployment serves this regional edition
//                           (client/edition.config.mjs: priyabhata | prithagoras),
//                           on both sides: /v1/health `edition` must be it, and so
//                           must the `edition` in the /features.json the shipped
//                           web client was built with (one more GET). A server of
//                           one edition shipping the other's client never passes.
//
// Run it from a checkout at the nominated SHA, so the expected schema versions
// are the ones that build was compiled against.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../server/platform/schemaVersions.js';
import { EDITION_IDS } from '../client/edition.config.mjs';

const SHA = /^[0-9a-f]{40}$/;
// A hanging origin fails the check rather than holding the operator's terminal.
const REQUEST_TIMEOUT_MS = 15_000;
/** How often a `probing` handwriting state is read again, and how long apart. */
export const HANDWRITING_REREADS = 3;
export const HANDWRITING_REREAD_MS = 2_000;

export function parseArgs(argv) {
  const args = { origin: null, sha: null, engine: null, edition: null, allowHttp: false, persistentStorageProven: false, authEmailProven: false, requireHandwriting: false, expectConfig: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--allow-http') { args.allowHttp = true; continue; }
    if (flag === '--persistent-storage-proven') { args.persistentStorageProven = true; continue; }
    // A real deployment (staging, production): email must be proven, not merely configured.
    if (flag === '--auth-email-proven') { args.authEmailProven = true; continue; }
    if (flag === '--require-handwriting') { args.requireHandwriting = true; continue; }
    if (!['--origin', '--sha', '--engine', '--edition', '--expect-config'].includes(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
    args[flag === '--expect-config' ? 'expectConfig' : flag.slice(2)] = value;
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

// ── --expect-config: the manifest's machine-readable block ──────────────────
export const EXPECTED_CONFIG_FORMAT = 'pri-expected-public-config';
export const EXPECTED_CONFIG_START = '<!-- pri-expected-public-config:start -->';
export const EXPECTED_CONFIG_END = '<!-- pri-expected-public-config:end -->';
// A probe is a GET of a public path: /v1/<segments>, or the two manifests the
// web build writes beside itself (/release.json, /features.json); no query, no
// dot segments, no doubled slash. Nothing here can name a write or a host.
const PROBE_PATH = /^\/(?:v1(?:\/[A-Za-z0-9_-]+)+|release\.json|features\.json)$/;
const PROBE_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const FIELD_PATH = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/;
const CONFIG_KEYS = new Set(['format', 'version', 'environment', 'publicOrigin', 'probes']);
const PROBE_KEYS = new Set(['id', 'decision', 'path', 'status', 'json']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// A matcher: { oneOf: [...] }, optionally with orAbsent: true (the field may be missing, as on a
// build from before the field existed; when present it must be one of the values).
const MATCHER_KEYS = new Set(['oneOf', 'orAbsent']);
const isOneOf = value => isObject(value) && Object.hasOwn(value, 'oneOf') && Object.keys(value).every(key => MATCHER_KEYS.has(key));

/** The problems with an expected-config object; empty when it can be checked. */
export function expectedConfigProblems(config) {
  if (!isObject(config)) return ['the expected config must be a JSON object'];
  const problems = [];
  for (const key of Object.keys(config)) if (!CONFIG_KEYS.has(key)) problems.push(`unknown key ${JSON.stringify(key)}`);
  if (config.format !== EXPECTED_CONFIG_FORMAT) problems.push(`format must be ${JSON.stringify(EXPECTED_CONFIG_FORMAT)}`);
  if (config.version !== 1) problems.push('version must be 1');
  if (config.environment !== undefined && (typeof config.environment !== 'string' || !config.environment.trim())) problems.push('environment must be a non-empty string');
  if (config.publicOrigin !== undefined) {
    let url = null;
    try { url = new URL(String(config.publicOrigin)); } catch { url = null; }
    if (!url || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/') || url.origin !== config.publicOrigin) {
      problems.push('publicOrigin must be a bare origin such as https://app.example.com');
    }
  }
  if (!Array.isArray(config.probes) || config.probes.length === 0) problems.push('probes must be a non-empty array');
  const ids = new Set();
  for (const [index, probe] of (Array.isArray(config.probes) ? config.probes : []).entries()) {
    const where = `probes[${index}]`;
    if (!isObject(probe)) { problems.push(`${where} must be an object`); continue; }
    for (const key of Object.keys(probe)) if (!PROBE_KEYS.has(key)) problems.push(`${where}: unknown key ${JSON.stringify(key)}`);
    if (typeof probe.id !== 'string' || !PROBE_ID.test(probe.id)) problems.push(`${where}: id must be lower-case kebab case`);
    else if (ids.has(probe.id)) problems.push(`${where}: duplicate id ${probe.id}`);
    else ids.add(probe.id);
    if (typeof probe.decision !== 'string' || !probe.decision.trim() || probe.decision.length > 80) problems.push(`${where}: decision must name what the probe proves (1–80 characters)`);
    if (typeof probe.path !== 'string' || !PROBE_PATH.test(probe.path)) problems.push(`${where}: path must be /v1/…, /release.json or /features.json, with no query`);
    if (probe.status !== undefined && !(Number.isInteger(probe.status) && probe.status >= 100 && probe.status <= 599)) problems.push(`${where}: status must be an HTTP status code`);
    if (probe.json !== undefined) {
      if (!isObject(probe.json) || Object.keys(probe.json).length === 0) problems.push(`${where}: json must map field paths to expected values`);
      else {
        for (const [field, expected] of Object.entries(probe.json)) {
          if (!FIELD_PATH.test(field)) problems.push(`${where}: json field ${JSON.stringify(field)} must be a dotted path`);
          if (isObject(expected) && (Object.hasOwn(expected, 'oneOf') || Object.hasOwn(expected, 'orAbsent'))
            && !(isOneOf(expected) && Array.isArray(expected.oneOf) && expected.oneOf.length > 0 && (!Object.hasOwn(expected, 'orAbsent') || expected.orAbsent === true))) {
            problems.push(`${where}: json ${field} must be { oneOf: [non-empty] } with at most orAbsent: true`);
          }
        }
      }
    }
    if (probe.status === undefined && probe.json === undefined) problems.push(`${where}: expects nothing (give status, json or both)`);
  }
  return problems;
}

/**
 * The expected public config of a manifest: a .json file, or the one fenced
 * ```json block between the pri-expected-public-config markers of a Markdown
 * manifest. Throws (a usage error) when it is missing or malformed.
 */
export function loadExpectedConfig(file) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (error) { throw new Error(`--expect-config ${file}: ${error?.code === 'ENOENT' ? 'no such file' : 'unreadable'}`); }
  let source = text;
  if (!/\.json$/i.test(file)) {
    const start = text.indexOf(EXPECTED_CONFIG_START);
    const end = text.indexOf(EXPECTED_CONFIG_END);
    if (start < 0 || end < start || text.indexOf(EXPECTED_CONFIG_START, start + 1) >= 0) {
      throw new Error(`--expect-config ${file}: needs exactly one block between ${EXPECTED_CONFIG_START} and ${EXPECTED_CONFIG_END}`);
    }
    const fenced = text.slice(start + EXPECTED_CONFIG_START.length, end).match(/^\s*```json\n([\s\S]*?)\n```\s*$/);
    if (!fenced) throw new Error(`--expect-config ${file}: the marked block must be one fenced json code block`);
    source = fenced[1];
  }
  let config;
  try { config = JSON.parse(source); } catch (error) { throw new Error(`--expect-config ${file}: not JSON (${error.message})`); }
  const problems = expectedConfigProblems(config);
  if (problems.length) throw new Error(`--expect-config ${file}: ${problems.join('; ')}`);
  return config;
}

function field(body, path) {
  let value = body;
  for (const key of path.split('.')) {
    if (!isObject(value) || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}
const show = value => (value === undefined ? 'missing' : JSON.stringify(value));

/** Why a probe's answer differs from what it expects (empty when it matches). */
export function probeMismatches(probe, answer) {
  const mismatches = [];
  if (probe.status !== undefined && answer.status !== probe.status) mismatches.push(`status ${answer.status}, expected ${probe.status}`);
  for (const [path, expected] of Object.entries(probe.json || {})) {
    const actual = field(answer.body, path);
    const absentOk = isOneOf(expected) && expected.orAbsent === true && actual === undefined;
    const ok = absentOk || (isOneOf(expected) ? expected.oneOf.some(item => isDeepStrictEqual(actual, item)) : isDeepStrictEqual(actual, expected));
    if (!ok) mismatches.push(`${path} ${show(actual)}, expected ${isOneOf(expected) ? `one of ${expected.oneOf.map(show).join(' | ')}${expected.orAbsent ? ' (or absent)' : ''}` : show(expected)}`);
  }
  return mismatches;
}

/**
 * Returns { ok, results: [{ ok, label, detail? }] }. Never throws for a failed
 * check; a network error becomes a failed check with its message.
 */
export async function verifyDeployment({ origin, sha, engine = null, edition = null, allowHttp = false, persistentStorageProven = false, authEmailProven = false, requireHandwriting = false, expectedConfig = null, fetchImpl = globalThis.fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const results = [];
  const check = (ok, label, detail) => { results.push({ ok: !!ok, label, ...(detail ? { detail } : {}) }); return !!ok; };

  const base = cleanOrigin(origin, allowHttp);
  const expectedSha = String(sha || '').toLowerCase();
  if (!check(SHA.test(expectedSha), 'nominated SHA is a full 40-hex commit', sha)) return { ok: false, results };
  if (engine !== null && !['postgres', 'sqlite'].includes(engine)) throw new Error('--engine must be postgres or sqlite');
  if (edition !== null && !EDITION_IDS.includes(edition)) throw new Error(`--edition must be one of ${EDITION_IDS.join(', ')}`);
  if (expectedConfig) {
    const problems = expectedConfigProblems(expectedConfig);
    if (problems.length) throw new Error(`expected config: ${problems.join('; ')}`);
  }

  let health, ready, web, billing;
  try {
    [health, ready, web, billing] = await Promise.all([
      getJson(fetchImpl, `${base}/v1/health`),
      getJson(fetchImpl, `${base}/v1/ready`),
      getJson(fetchImpl, `${base}/release.json`),
      getJson(fetchImpl, `${base}/v1/billing/config`)
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
  if (authEmailProven) {
    check(readyAuth.state === 'ok' && readyAuth.credential === 'valid' && readyAuth.sender !== 'unverified' && readyAuth.sender !== 'invalid',
      'verification email proven: the provider accepts the key and does not report the sender unverified',
      `state ${readyAuth.state}, code ${readyAuth.code ?? 'none'}, credential ${readyAuth.credential ?? 'unknown'}, sender ${readyAuth.sender ?? 'unknown'}`);
  }

  check(web.status === 200 && isDeepStrictEqual(web.body, h.releaseIdentity), 'web client release.json equals server release identity',
    web.status === 200 ? `web ${web.body?.releaseSha || 'unknown'}` : `status ${web.status}`);

  const readyDetail = [r.state, ...(r.failing || []), ...(r.degraded || []).map(code => `degraded:${code}`)].filter(Boolean).join(' ');
  check(ready.status === 200 && r.ready === true, '/v1/ready says this replica can serve', readyDetail || `status ${ready.status}`);
  check(!r.releaseSha || r.releaseSha === expectedSha, '/v1/ready reports the same SHA', r.releaseSha);
  // Sent as a browser, with no X-Pri-Client header: a native client is always
  // told false, which would hide the server's real answer. Turning web checkout
  // on is a change to the notices first (docs/legal/README.md), then to this.
  check(billing.status === 200 && billing.body?.webCheckout?.configured === false,
    'web checkout is off, as the terms and refund policy say',
    billing.status === 200 ? `configured ${billing.body?.webCheckout?.configured}` : `status ${billing.status}`);

  // ── opt-in: the deployment is one edition, server and client (--edition) ──
  let features = null;
  if (edition) {
    const serverEdition = h.edition;
    check(serverEdition === edition, `server edition is ${edition}`, `/v1/health edition ${show(serverEdition)}`);
    try { features = await getJson(fetchImpl, `${base}/features.json`); }
    catch (error) { features = { error: error?.message || String(error) }; }
    const clientEdition = features.error ? undefined : features.body?.edition;
    check(!features.error && features.status === 200 && clientEdition === edition, `web client was built for ${edition}`,
      features.error || (features.status === 200 ? `/features.json edition ${show(clientEdition)}` : `status ${features.status}`));
    check(serverEdition !== undefined && serverEdition === clientEdition, 'server and web client are the same edition',
      `server ${show(serverEdition)}, client ${show(clientEdition)}`);
  }

  // ── opt-in: the server reader is up (--require-handwriting) ───────────────
  if (requireHandwriting) {
    let reader = r.checks?.handwriting || {};
    // A cache miss answers `probing` while the provider probe runs in the
    // background and fills its own cache: read again, a bounded number of times.
    for (let reread = 0; reader.state === 'probing' && reread < HANDWRITING_REREADS; reread += 1) {
      await sleep(HANDWRITING_REREAD_MS);
      try { reader = (await getJson(fetchImpl, `${base}/v1/ready`)).body?.checks?.handwriting || {}; } catch { break; }
    }
    check(reader.state === 'ok', 'handwriting reader ready: /v1/ready checks.handwriting.state is ok',
      `state ${reader.state || 'missing'}, code ${reader.code ?? 'none'}`);
  }

  // ── opt-in: the public configuration matches the manifest (--expect-config) ─
  if (expectedConfig) {
    // The four reads above (#752's three, plus main's /v1/billing/config) are reused; every other path is one more GET.
    const answers = new Map([['/v1/health', health], ['/v1/ready', ready], ['/release.json', web], ['/v1/billing/config', billing]]);
    if (features) answers.set('/features.json', features);
    for (const probe of expectedConfig.probes) {
      if (!answers.has(probe.path)) {
        try { answers.set(probe.path, await getJson(fetchImpl, `${base}${probe.path}`)); }
        catch (error) { answers.set(probe.path, { error: error?.message || String(error) }); }
      }
      const answer = answers.get(probe.path);
      const label = `public config ${probe.id} (${probe.decision}): GET ${probe.path}`;
      if (answer.error) { check(false, label, answer.error); continue; }
      const mismatches = probeMismatches(probe, answer);
      check(mismatches.length === 0, label, mismatches.length ? mismatches.join('; ')
        : [probe.status !== undefined ? `status ${answer.status}` : null, ...Object.keys(probe.json || {}).map(path => `${path} ${show(field(answer.body, path))}`)].filter(Boolean).join('; '));
    }
    if (expectedConfig.publicOrigin !== undefined) {
      const label = `public origin ${expectedConfig.publicOrigin} serves this release`;
      let publicBase = null;
      try { publicBase = cleanOrigin(expectedConfig.publicOrigin, allowHttp); } catch (error) { check(false, label, error.message.replace('--origin', 'publicOrigin')); }
      if (publicBase) {
        try {
          const [publicHealth, publicWeb] = publicBase === base ? [health, web]
            : await Promise.all([getJson(fetchImpl, `${publicBase}/v1/health`), getJson(fetchImpl, `${publicBase}/release.json`)]);
          const servedSha = publicHealth.body?.releaseIdentity?.releaseSha;
          check(publicHealth.status === 200 && servedSha === expectedSha && publicWeb.status === 200 && isDeepStrictEqual(publicWeb.body, h.releaseIdentity), label,
            `server ${servedSha || 'unknown'}, web ${publicWeb.body?.releaseSha || `status ${publicWeb.status}`}${publicBase === base ? ' (the verified origin)' : ''}`);
        } catch (error) { check(false, label, error?.message || String(error)); }
      }
    }
  }

  return { ok: results.every(item => item.ok), results };
}

async function main() {
  let args;
  const usage = 'Usage: node tools/verify-deployment.mjs --origin https://… --sha <40-hex> [--engine postgres|sqlite] [--edition priyabhata|prithagoras] [--persistent-storage-proven] [--auth-email-proven] [--require-handwriting] [--expect-config <manifest>]';
  let report;
  try {
    args = parseArgs(process.argv.slice(2));
    const { expectConfig, ...options } = args;
    report = await verifyDeployment({ ...options, expectedConfig: expectConfig ? loadExpectedConfig(expectConfig) : null });
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
