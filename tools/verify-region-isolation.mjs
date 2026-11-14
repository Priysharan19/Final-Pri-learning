#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · do two regional deployments share nothing? (plan H2)
//
// Read-only live probes of two deployments, one per edition (ADR-0002 §9). It
// creates no account, sends no credential of its own and writes nothing:
//
//   · /v1/health on each answers, and the two editions differ;
//   · /features.json each ships names that same edition (client = server);
//   · a request to each declaring the OTHER's edition in X-Pri-Edition is
//     refused 409 EDITION_MISMATCH (the deployment is refuse-only);
//   · neither grants the other's origin a CORS answer (no
//     Access-Control-Allow-Origin naming it, never `*`);
//   · OPTIONAL, only when the operator supplies one: a session cookie minted
//     for a throwaway test account on A (PRI_REGION_PROBE_COOKIE_A, the full
//     `name=value` pair) is unauthorised on B. Without it that row reports
//     "not run" — it is never assumed to have passed.
//
//   node tools/verify-region-isolation.mjs --a https://app.priyabhata.example \
//     --b https://app.prithagoras.example [--allow-http]
//
// Exit 0 only when every probe that ran passed. The output is evidence for
// docs/operations/region-isolation-verification.md; record it with the date,
// both origins and who ran it. Results against local or simulated instances
// are labelled as such by the operator and never stand in for the real ones.
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { EDITION_IDS } from '../client/edition.config.mjs';

export function parseArgs(argv) {
  const args = { a: null, b: null, allowHttp: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--allow-http') { args.allowHttp = true; continue; }
    if (!['--a', '--b'].includes(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[++i];
    if (!value) throw new Error(`${flag} needs an origin`);
    args[flag.slice(2)] = value;
  }
  if (!args.a || !args.b) throw new Error('Both --a and --b origins are required');
  return args;
}

function cleanOrigin(value, allowHttp) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) throw new Error(`${value}: https only (pass --allow-http for local instances)`);
  return url.origin;
}

async function json(fetchImpl, url, init = {}) {
  const response = await fetchImpl(url, { redirect: 'manual', ...init });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, headers: response.headers, body };
}

/**
 * Run the probes. Returns { ok, rows: [{ check, ok, detail }] }; a row with
 * ok === null did not run (no operator-supplied cookie).
 */
export async function verifyRegionIsolation({ a, b, allowHttp = false, cookieA = null, fetchImpl = globalThis.fetch }) {
  const origins = { a: cleanOrigin(a, allowHttp), b: cleanOrigin(b, allowHttp) };
  const rows = [];
  const row = (check, ok, detail) => rows.push({ check, ok, detail });
  if (origins.a === origins.b) row('the two origins differ', false, origins.a);

  const edition = {};
  for (const side of ['a', 'b']) {
    let health;
    try { health = await json(fetchImpl, `${origins[side]}/v1/health`); } catch (error) { health = { status: 0, body: null, error }; }
    const id = health.body?.edition;
    edition[side] = EDITION_IDS.includes(id) ? id : null;
    row(`${side.toUpperCase()} /v1/health names a known edition`, health.status === 200 && edition[side] !== null, `${health.status} edition=${JSON.stringify(id ?? null)}`);
    let features;
    try { features = await json(fetchImpl, `${origins[side]}/features.json`); } catch { features = { status: 0, body: null }; }
    const client = features.body?.edition ?? null;
    row(`${side.toUpperCase()} /features.json names the same edition`, features.status === 200 && edition[side] !== null && client === edition[side], `${features.status} edition=${JSON.stringify(client)}`);
  }
  row('the two deployments serve different editions', edition.a !== null && edition.b !== null && edition.a !== edition.b, `${edition.a} / ${edition.b}`);

  for (const [side, other] of [['a', 'b'], ['b', 'a']]) {
    const declared = edition[other] || EDITION_IDS.find(id => id !== edition[side]);
    let refused;
    try { refused = await json(fetchImpl, `${origins[side]}/v1/account/me`, { headers: { Accept: 'application/json', 'X-Pri-Edition': declared } }); } catch { refused = { status: 0, body: null }; }
    row(`${side.toUpperCase()} refuses a client declaring ${declared}`, refused.status === 409 && refused.body?.error?.code === 'EDITION_MISMATCH', `${refused.status} ${refused.body?.error?.code ?? ''}`.trim());
    let cors;
    try {
      cors = await fetchImpl(`${origins[side]}/v1/account/me`, { method: 'OPTIONS', redirect: 'manual', headers: { Origin: origins[other], 'Access-Control-Request-Method': 'GET' } });
    } catch { cors = null; }
    const allow = cors?.headers?.get('access-control-allow-origin') ?? null;
    row(`${side.toUpperCase()} grants ${other.toUpperCase()}'s origin no CORS answer`, cors !== null && allow !== '*' && allow !== origins[other], `allow-origin=${JSON.stringify(allow)}`);
  }

  if (cookieA) {
    let me;
    try { me = await json(fetchImpl, `${origins.b}/v1/account/me`, { headers: { Accept: 'application/json', Cookie: cookieA } }); } catch { me = { status: 0 }; }
    row("A's test-account session cookie is unauthorised on B", me.status === 401, String(me.status));
  } else {
    row("A's test-account session cookie is unauthorised on B", null, 'not run: set PRI_REGION_PROBE_COOKIE_A to a throwaway test account\'s session cookie on A');
  }
  return { ok: rows.every(r => r.ok !== false), rows, origins, editions: edition };
}

export function formatRows(rows) {
  return rows.map(r => `${r.ok === null ? 'NOT RUN' : r.ok ? 'PASS   ' : 'FAIL   '} ${r.check} — ${r.detail}`).join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = await verifyRegionIsolation({ ...args, cookieA: process.env.PRI_REGION_PROBE_COOKIE_A || null });
    console.log(formatRows(result.rows));
    console.log(result.ok ? `REGION ISOLATION LIVE: PASS — ${result.origins.a} (${result.editions.a}) / ${result.origins.b} (${result.editions.b})` : 'REGION ISOLATION LIVE: FAIL');
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(error?.message || String(error));
    process.exit(2);
  }
}
