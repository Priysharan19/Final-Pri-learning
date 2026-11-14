// tools/verify-region-isolation.mjs: stubbed-fetch cases, then the real tool
// against two local server instances (one per edition, separate databases).
// Local instances are a simulation of two regions, never evidence about the
// real deployments.
//
//   node tools/verify-region-isolation.test.mjs
import '../server/test/support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;
process.env.PRI_AUTH_DELIVERY_KEY = process.env.PRI_AUTH_DELIVERY_KEY || '7c'.repeat(32);

const { parseArgs, verifyRegionIsolation, formatRows } = await import('./verify-region-isolation.mjs');
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

// ── Arguments ────────────────────────────────────────────────────────────────
ok(parseArgs(['--a', 'https://a.example', '--b', 'https://b.example']).b === 'https://b.example', 'two origins parse');
for (const bad of [[], ['--a', 'https://a.example'], ['--x', '1']]) {
  let threw = false; try { parseArgs(bad); } catch { threw = true; }
  ok(threw, `refuses ${JSON.stringify(bad)}`);
}
await assert.rejects(() => verifyRegionIsolation({ a: 'http://a.example', b: 'https://b.example', fetchImpl: async () => { throw new Error('no'); } }), /https only/); n++;

// ── Stubbed deployments ───────────────────────────────────────────────────────
function stub(world) {
  return async (url, init = {}) => {
    const u = new URL(url);
    const site = world[u.origin];
    const reply = (status, body, headers = {}) => new Response(body === null ? null : JSON.stringify(body), { status, headers });
    if (u.pathname === '/v1/health') return reply(200, { ok: true, edition: site.edition });
    if (u.pathname === '/features.json') return reply(200, { edition: site.client ?? site.edition });
    if (init.method === 'OPTIONS') return reply(204, null, site.cors ? { 'Access-Control-Allow-Origin': site.cors } : {});
    if (u.pathname === '/v1/account/me') {
      const declared = init.headers?.['X-Pri-Edition'];
      if (declared && declared !== site.edition && !site.ignoresHeader) return reply(409, { error: { code: 'EDITION_MISMATCH' } });
      if (init.headers?.Cookie && site.acceptsCookie) return reply(200, { account: { id: 'x' } });
      return reply(401, { error: { code: 'UNAUTHENTICATED' } });
    }
    return reply(404, null);
  };
}
const A = 'https://a.example';
const B = 'https://b.example';
const good = () => ({ [A]: { edition: 'priyabhata' }, [B]: { edition: 'prithagoras' } });
const run = async (world, extra = {}) => verifyRegionIsolation({ a: A, b: B, fetchImpl: stub(world), ...extra });
{
  const r = await run(good());
  ok(r.ok, `two isolated deployments pass\n${formatRows(r.rows)}`);
  ok(r.rows.some(x => x.ok === null && /not run/.test(x.detail)), 'the cookie probe reports "not run" without a cookie, never a pass');
  ok((await run(good(), { cookieA: 'pri_session=abc' })).ok, 'a cookie unknown to B passes');
}
const failing = async (mutate, label) => { const w = good(); mutate(w); const r = await run(w); ok(!r.ok, `${label} fails\n${formatRows(r.rows)}`); };
await failing(w => { w[B].edition = 'priyabhata'; }, 'two deployments of the same edition');
await failing(w => { w[A].client = 'prithagoras'; }, 'a client built for the other edition');
await failing(w => { w[B].ignoresHeader = true; }, 'a deployment that ignores X-Pri-Edition');
await failing(w => { w[A].cors = B; }, 'a CORS grant to the other origin');
await failing(w => { w[B].cors = '*'; }, 'a wildcard CORS grant');
{
  const w = good(); w[B].acceptsCookie = true;
  ok(!(await run(w, { cookieA: 'pri_session=abc' })).ok, "B accepting A's session cookie fails");
}

// ── The runbook is checked ────────────────────────────────────────────────────
{
  const { readFileSync, existsSync } = await import('node:fs');
  const doc = readFileSync(new URL('../docs/operations/region-isolation-verification.md', import.meta.url), 'utf8');
  const rows = doc.split('\n').filter(line => /^\| R\d+ \|/.test(line));
  ok(rows.length >= 15, `the checklist has its rows (${rows.length})`);
  for (const line of rows) {
    const cells = line.split(/(?<!\\)\|/).map(x => x.trim()).filter(Boolean);
    const status = cells.at(-1);
    // A row is either not yet verified, or verified with a dated ops-log record that exists.
    const record = /^VERIFIED \d{4}-\d{2}-\d{2} (docs\/operations\/\S+\.md)$/.exec(status);
    ok(status === 'NOT YET VERIFIED' || (record && existsSync(new URL(`../${record[1]}`, import.meta.url))), `${cells[0]}: status is honest (${status})`);
  }
  ok(/Status: \*\*NOT YET VERIFIED\.\*\*/.test(doc) === rows.every(l => /NOT YET VERIFIED \|$/.test(l)), 'the page-level status matches the rows');
  ok(doc.includes('tools/verify-region-isolation.mjs') && doc.includes('bindDatabaseEdition'), 'the runbook names the tool and the binding');
}

// ── Two local instances (simulated regions) ───────────────────────────────────
const { startApp } = await import('../server/test/support/app-harness.mjs');
const dist = edition => {
  const dir = mkdtempSync(join(tmpdir(), `pri-region-${edition}-`));
  writeFileSync(join(dir, 'features.json'), JSON.stringify({ edition }));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>t</title>');
  return dir;
};
const started = [];
try {
  delete process.env.PRI_EDITION;
  const india = await startApp({ log: () => {}, dist: dist('priyabhata') });
  started.push(india);
  process.env.PRI_EDITION = 'prithagoras';
  const au = await startApp({ log: () => {}, dist: dist('prithagoras') });
  started.push(au);
  delete process.env.PRI_EDITION;
  const live = await verifyRegionIsolation({ a: india.origin, b: au.origin, allowHttp: true });
  ok(live.ok && live.editions.a === 'priyabhata' && live.editions.b === 'prithagoras', `two local instances pass the live probes\n${formatRows(live.rows)}`);
  const same = await verifyRegionIsolation({ a: india.origin, b: india.origin, allowHttp: true });
  ok(!same.ok, 'one instance probed as both regions fails');
} finally {
  for (const h of started) await h.close();
}

console.log(`VERIFY REGION ISOLATION TOOL: PASS — ${n} checks (stubbed deployments and two local instances; simulated, not live evidence)`);
