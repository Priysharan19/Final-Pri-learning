// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · database round trips on the hot request paths (#524 item 3)
//
//   node scripts/with-postgres.mjs node server/test/db-round-trips-check.mjs --engine=postgres
//
// Boots the shipped /v1 app on a local throwaway Postgres (never a real
// database) as a pri_server member and counts every client.query() the store
// sends — each is one network round trip — for the hot paths: practice issue,
// practice submit, sync push and sync pull. Prints the count per request and
// the local wall time; on staging/production each round trip costs the
// Railway → Supabase RTT, so the count is what matters.
//
// Pins (deterministic, from the store's contract, not from handler details):
//   · a store statement outside any transaction is ONE round trip — the session
//     is in system scope from sessionSetup(), so no BEGIN … COMMIT wraps it;
//   · every transaction still declares its scope in its BEGIN (account or
//     system), so the per-request total is what the handlers ask for, no more.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-round-trips-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'e7'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { solveLinearPrompt } = await import('./support/linear-equation.mjs');

const engine = requestedEngine();
const c = checks();
const h = await startApp({ engine });

// Count every statement the store sends on Postgres. SQLite has no network and
// no round trips; the suite then only proves the paths work.
const trace = { queries: [], on: false };
const RTT_MS = Math.max(0, Number(process.env.PRI_ROUND_TRIPS_RTT_MS) || 0);
if (engine === 'postgres') {
  const pool = h.db.pool;
  const connect = pool.connect.bind(pool);
  pool.connect = async (...args) => {
    const client = await connect(...args);
    if (!client.__priCounted) {
      client.__priCounted = true;
      const query = client.query.bind(client);
      client.query = (sql, ...rest) => {
        if (trace.on) trace.queries.push(typeof sql === 'string' ? sql : sql?.text || '');
        // PRI_ROUND_TRIPS_RTT_MS: add a simulated network round trip per statement,
        // to show what the count costs at the Railway → Supabase distance.
        if (RTT_MS > 0) return new Promise(resolve => setTimeout(resolve, RTT_MS)).then(() => query(sql, ...rest));
        return query(sql, ...rest);
      };
    }
    return client;
  };
}

async function measure(label, fn, samples = 5) {
  const rows = [];
  for (let i = 0; i < samples; i++) {
    trace.queries = [];
    trace.on = true;
    const started = process.hrtime.bigint();
    const response = await fn(i);
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    trace.on = false;
    rows.push({ status: response.status, trips: trace.queries.length, ms, queries: [...trace.queries] });
  }
  const trips = rows.map(r => r.trips).sort((a, b) => a - b);
  const ms = rows.map(r => r.ms).sort((a, b) => a - b);
  return { label, rows, trips, ms, statuses: [...new Set(rows.map(r => r.status))] };
}

const report = [];
try {
  const a = await registerAccount(h, { email: 'round.trips@example.test', deviceId: 'ipad-trips' });
  c.eq(a.status, 201, 'the student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');
  const deviceId = 'ipad-trips';

  const issued = [];
  report.push(await measure('POST /v1/practice/issue', async i => {
    const response = await h.request('/v1/practice/issue', {
      method: 'POST', jar: a.jar, body: { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed: 7000 + i, curriculum: 'in' }
    });
    if (response.data?.question) issued.push(response.data.question);
    return response;
  }));
  report.push(await measure('POST /v1/practice/:id/submit', async i => {
    const question = issued[i];
    const answer = String(solveLinearPrompt(question.prompt));
    const submissionId = `trips-submit-${i}`;
    return h.request(`/v1/practice/${question.id}/submit`, {
      method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': submissionId }, body: { submissionId, answer, mode: 'typed' }
    });
  }));
  report.push(await measure('POST /v1/sync/push (5 events + 1 entity)', async i => h.request('/v1/sync/push', {
    method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': `trips-push-${i}` },
    body: {
      schemaVersion: 1, deviceId,
      events: Array.from({ length: 5 }, (_, k) => ({ id: `trips-${i}-${k}`, deviceId, deviceSeq: i * 5 + k + 1, kind: 'practice-attempt', payload: { i, k } })),
      entities: [{ kind: 'bookmark', entityId: `trips-bookmark-${i}`, operation: 'upsert', baseVersion: 0, body: { i } }]
    }
  })));
  report.push(await measure('GET /v1/sync/pull/0', () => h.request('/v1/sync/pull/0', { jar: a.jar })));

  for (const entry of report) {
    c.ok(entry.statuses.every(s => s >= 200 && s < 300), `${entry.label}: every sample succeeded (statuses ${entry.statuses.join(',')})`);
  }
  if (engine === 'postgres') {
    console.log(`round trips per request (min/median/max of 5) and wall ms (median)${RTT_MS ? `, with a simulated ${RTT_MS} ms round trip` : ' on loopback'}:`);
    for (const entry of report) {
      console.log(`  ${entry.label.padEnd(42)} trips ${entry.trips[0]}/${entry.trips[2]}/${entry.trips[4]}  ${entry.ms[2].toFixed(1)} ms`);
    }
    if (process.env.PRI_ROUND_TRIPS_VERBOSE) {
      for (const entry of report) console.log(`\n${entry.label}\n  ${entry.rows[1].queries.map(q => q.replace(/\s+/g, ' ').slice(0, 110)).join('\n  ')}`);
    }
    const all = report.flatMap(entry => entry.rows.flatMap(row => row.queries));
    c.ok(all.length > 0, 'the store\'s statements were counted');
    const begins = all.filter(sql => /^BEGIN\b/.test(sql));
    c.eq(begins.filter(sql => !/^BEGIN ISOLATION LEVEL /.test(sql)).length, 0,
      'no store statement outside a transaction is wrapped in a bare BEGIN … COMMIT (one round trip each: system scope comes from sessionSetup)');
    c.eq(all.filter(sql => sql === 'COMMIT').length, begins.length, 'every COMMIT closes one of the store\'s declared transactions');
    c.eq(begins.filter(sql => !/; SET LOCAL pri\.scope = '(system|account)'; SET LOCAL pri\.account_id = '[A-Za-z0-9_.:-]*'$/.test(sql)).length, 0,
      'every transaction still declares its scope in its BEGIN');
  }
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const [key, value] of Object.entries(before)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}

console.log(`engine: ${engine}`);
console.log(`DB ROUND TRIPS: PASS — ${c.count()}/${c.count()} checks — the hot paths succeed${engine === 'postgres' ? '; no store statement outside a transaction costs more than one round trip, and every transaction declares its scope in its BEGIN' : ' (run with --engine=postgres to count round trips)'}.`);
