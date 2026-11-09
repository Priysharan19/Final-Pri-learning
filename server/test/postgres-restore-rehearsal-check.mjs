// Pri Learning · a Postgres backup restored into an empty database, then served.
//
//   node scripts/with-postgres.mjs node server/test/postgres-restore-rehearsal-check.mjs
//
// docs/operations/postgres-cutover.md §6 and ADR-0001 require a restore drill
// before real student data: "A backup that has not been restored is not a
// backup." The production drill restores a Supabase dump or a PITR point into
// a scratch project; it needs the hosted project and the owner (#386). This
// suite rehearses the portable half of it on throwaway databases, with the same
// tools the Supabase CLI's logical dump uses:
//
//   1. A real server on a migrated Postgres, as pri_server under RLS: two
//      students sign up, answer questions (right and wrong), one holds Premium.
//   2. pg_dump -Fc of that database; pg_restore into an EMPTY database (no
//      migrations run on it: everything must come from the dump).
//   3. The restored database is compared with the source: every pri table's
//      rows, the schema version, the sync cursor sequence, row-level security
//      on every table, and every grant pri_server holds.
//   4. A new server on the restored database, as pri_server: a device signed in
//      before the backup is still signed in, passwords work, histories and
//      Premium are the same, accounts stay apart, a new answer lands after
//      every restored cursor.
//
// Physical/PITR restore of the hosted project is NOT exercised here (BLOCKED_
// EXTERNAL). pg_dump must be at least the server's major version; without one
// the suite says so and fails, rather than reporting a restore it did not do.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!String(process.env.PRI_TEST_PG_ADMIN_URL || '').trim()) {
  console.log('POSTGRES RESTORE REHEARSAL: SKIPPED — needs a throwaway Postgres (run via node scripts/with-postgres.mjs).');
  process.exit(0);
}
console.log('engine: postgres');
const scratch = mkdtempSync(join(tmpdir(), 'pri-restore-'));
process.env.NODE_ENV = 'test';
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { createPostgresStore, asStore } = await import('../platform/store.js');
const { applyVerifiedEntitlement } = await import('../platform/entitlements.js');
const { scratchDatabase, serverRoleUrl } = await import('./support/postgres.mjs');

let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const PASSWORD = 'correct-horse-battery';

// The newest pg_dump/pg_restore on this machine, as scripts/with-postgres.mjs finds initdb.
function tool(name) {
  const candidates = String(process.env.PATH || '').split(':').filter(Boolean).map(dir => join(dir, name));
  for (const version of [18, 17, 16]) candidates.push(`/opt/homebrew/opt/postgresql@${version}/bin/${name}`, `/usr/local/opt/postgresql@${version}/bin/${name}`, `/usr/lib/postgresql/${version}/bin/${name}`);
  const found = candidates.filter(path => existsSync(path)).map(path => {
    const major = Number((execFileSync(path, ['--version'], { encoding: 'utf8' }).match(/(\d+)(?:\.\d+)?/) || [])[1]);
    return { path, major };
  }).sort((a, b) => b.major - a.major);
  return found[0] || null;
}

const drive = h => {
  const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
  let n = 0;
  return {
    issue: (jar, seed) => post('/v1/practice/issue', { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed, curriculum: 'in' }, jar),
    sealed: async id => JSON.parse((await asStore(h.db).get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json).answer,
    submit: (jar, id, answer, tag) => {
      const sid = `restore-${tag}-${String(++n).padStart(3, '0')}`;
      return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid });
    },
    login: (jar, email, deviceId, password = PASSWORD) => post('/v1/account/login', { email, password, deviceId }, jar),
    me: jar => h.request('/v1/account/me', { jar }),
    billing: async jar => (await h.request('/v1/billing/status', { jar })).data?.billing,
    history: async jar => {
      const out = [];
      let cursor = 0;
      for (let page = 0; page < 50; page++) {
        const r = await h.request(`/v1/sync/pull/${cursor}`, { jar });
        assert.equal(r.status, 200, `pull ${cursor}: ${r.status}`);
        out.push(...r.data.events);
        cursor = r.data.cursor;
        if (!r.data.hasMore) break;
      }
      return out;
    }
  };
};
const graded = events => events.filter(e => e.kind === 'graded-attempt')
  .map(e => ({ id: e.id, entityId: e.entityId, correct: e.payload?.correct === true, marksEarned: e.payload?.marksEarned ?? null, serverCursor: Number(e.serverCursor) }))
  .sort((x, y) => x.serverCursor - y.serverCursor);

// What a restore must carry, read with a superuser client so nothing is hidden by RLS.
async function shape(client) {
  const tables = (await client.query("SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='pri' AND c.relkind='r' ORDER BY c.relname")).rows;
  const rows = {};
  for (const t of tables) rows[t.relname] = Number((await client.query(`SELECT COUNT(*) AS n FROM pri."${t.relname.replace(/"/g, '""')}"`)).rows[0].n);
  const grants = (await client.query("SELECT table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee='pri_server' AND table_schema='pri' ORDER BY 1,2")).rows.map(r => `${r.table_name}:${r.privilege_type}`);
  const policies = (await client.query("SELECT tablename, policyname, cmd, roles::text AS roles, qual, with_check FROM pg_policies WHERE schemaname='pri' ORDER BY 1,2")).rows;
  const sequence = (await client.query('SELECT last_value FROM pri.sync_cursor_seq')).rows[0].last_value;
  const usage = (await client.query("SELECT has_schema_privilege('pri_server','pri','USAGE') AS usage, has_sequence_privilege('pri_server','pri.sync_cursor_seq','USAGE') AS seq")).rows[0];
  return { tables: tables.map(t => [t.relname, t.relrowsecurity, t.relforcerowsecurity]), rows, grants, policies, sequence: String(sequence), usage };
}

let source = null, target = null, sourceStore = null, targetStore = null, before = null, after = null;
try {
  const dump = tool('pg_dump'), restore = tool('pg_restore');
  const serverMajor = Number((await (async () => {
    const s = await scratchDatabase('restore_probe', { migrations: [] });
    try { return (await s.client.query('SHOW server_version_num')).rows[0].server_version_num; } finally { await s.drop(); }
  })()).slice(0, -4));
  ok(dump && restore && dump.major >= serverMajor && restore.major >= serverMajor,
    `pg_dump/pg_restore ${dump?.major ?? 'missing'}/${restore?.major ?? 'missing'} can read a Postgres ${serverMajor} server (install postgresql-client-${serverMajor} if not)`);

  // ── 1 · a live Postgres platform ─────────────────────────────────────────
  source = await scratchDatabase('restore_source');
  sourceStore = await createPostgresStore(await serverRoleUrl(source.name));
  before = await startApp({ db: sourceStore });
  const b1 = drive(before);
  const asha = await registerAccount(before, { name: 'Asha', email: 'asha.restore@example.test', deviceId: 'ipad-asha' });
  const ravi = await registerAccount(before, { name: 'Ravi', email: 'ravi.restore@example.test', deviceId: 'phone-ravi' });
  eq([(await verifyEmail(before, asha.account.id)).status, (await verifyEmail(before, ravi.account.id)).status], [200, 200], 'two students signed up and verified on Postgres');
  for (const [who, tag, seeds] of [[asha, 'asha', [6101, 6102, 6103]], [ravi, 'ravi', [6201, 6202]]]) {
    for (const [i, seed] of seeds.entries()) {
      const q = await b1.issue(who.jar, seed);
      eq(q.status, 201, `${tag}: question ${i + 1} issued`);
      const right = (await b1.sealed(q.data.question.id)).value;
      let s = await b1.submit(who.jar, q.data.question.id, i === 1 ? Number(right) + 7 : right, tag);
      if (i === 1) s = await b1.submit(who.jar, q.data.question.id, Number(right) + 9, tag);
      eq([s.status, s.data?.correct, s.data?.resolved], [200, i !== 1, true], `${tag}: question ${i + 1} resolved ${i !== 1 ? 'right' : 'wrong'}`);
    }
  }
  const T = Date.now();
  await source.client.query(`INSERT INTO pri.billing_subscriptions(provider,provider_subscription_id,account_id,product_id,cadence,trial_claimed,created_at,updated_at)
    VALUES ('web','sub_Restore01',$1,'plan_monthly','monthly',0,$2,$2)`, [asha.account.id, T]);
  const applied = await applyVerifiedEntitlement(sourceStore, { verified: true, provider: 'web', accountId: asha.account.id, providerSubscriptionId: 'sub_Restore01',
    productId: 'plan_monthly', eventId: 'evt-restore-1', effectiveAt: T, eventRank: 1, now: T, eventType: 'subscription.charged', plan: 'premium', status: 'active', currentPeriodEnd: T + 30 * 86_400_000 });
  ok(applied && !applied.replayed && !applied.stale, 'Asha holds Premium from a verified event');
  const ashaBefore = graded(await b1.history(asha.jar));
  const raviBefore = graded(await b1.history(ravi.jar));
  eq([ashaBefore.length, raviBefore.length], [3, 2], 'their histories hold three and two marked attempts');
  const billingBefore = { asha: await b1.billing(asha.jar), ravi: await b1.billing(ravi.jar) };
  eq([billingBefore.asha?.plan, billingBefore.ravi?.plan], ['premium', 'free'], 'Asha is Premium, Ravi is free');
  await before.close();
  before = null;
  await sourceStore.close();
  sourceStore = null;
  const sourceShape = await shape(source.client);
  ok(sourceShape.tables.length >= 20 && sourceShape.tables.every(([, rls]) => rls === true), `the source: ${sourceShape.tables.length} pri tables, every one under row-level security`);

  // ── 2 · dump, and restore into an empty database ─────────────────────────
  const file = join(scratch, 'pri.dump');
  execFileSync(dump.path, ['--format=custom', '--file', file, source.url], { stdio: ['ignore', 'ignore', 'pipe'] });
  target = await scratchDatabase('restore_target', { migrations: [] });
  eq((await target.client.query("SELECT COUNT(*)::int AS n FROM pg_namespace WHERE nspname='pri'")).rows[0].n, 0, 'the target starts empty: no pri schema, no migration run');
  execFileSync(restore.path, ['--exit-on-error', '--single-transaction', '--dbname', target.url, file], { stdio: ['ignore', 'ignore', 'pipe'] });

  // ── 3 · the restored database is the source ──────────────────────────────
  const targetShape = await shape(target.client);
  eq(targetShape.rows, sourceShape.rows, `every pri table holds the same rows (${Object.values(sourceShape.rows).reduce((a, b) => a + b, 0)} rows in ${Object.keys(sourceShape.rows).length} tables)`);
  eq(targetShape.tables, sourceShape.tables, 'row-level security is on, and forced where it was, on every restored table');
  eq(targetShape.policies, sourceShape.policies, `the ${sourceShape.policies.length} row-level policies are restored exactly`);
  eq(targetShape.grants, sourceShape.grants, `pri_server holds exactly the ${sourceShape.grants.length} table grants it held`);
  eq(targetShape.usage, sourceShape.usage, 'and its schema and sequence usage');
  eq(targetShape.sequence, sourceShape.sequence, 'the sync cursor sequence resumes where it was');
  const versions = async client => (await client.query("SELECT key, value FROM pri.platform_meta WHERE key LIKE '%version%' ORDER BY key")).rows;
  eq(await versions(target.client), await versions(source.client), 'the recorded schema versions are the same');

  // ── 4 · the server on the restored database, as pri_server ───────────────
  targetStore = await createPostgresStore(await serverRoleUrl(target.name));
  after = await startApp({ db: targetStore });
  const a1 = drive(after);
  const kept = await a1.me(asha.jar);
  eq([kept.status, kept.data?.account?.id], [200, asha.account.id], 'a device signed in before the backup is still signed in after the restore');
  const ashaJar = {}, raviJar = {};
  eq((await a1.login(ashaJar, 'asha.restore@example.test', 'ipad-asha-2')).status, 200, 'Asha signs in with her password');
  eq((await a1.login(raviJar, 'RAVI.Restore@example.test', 'phone-ravi-2')).status, 200, 'Ravi signs in (email case-insensitive)');
  const wrong = await a1.login({}, 'asha.restore@example.test', 'ipad-x', 'not-her-password');
  ok(wrong.status === 401 || wrong.status === 400, `a wrong password is still refused (${wrong.status})`);
  eq(graded(await a1.history(ashaJar)), ashaBefore, 'Asha\'s history is the same events, ids, cursors and marks');
  eq(graded(await a1.history(raviJar)), raviBefore, 'and so is Ravi\'s');
  eq({ asha: await a1.billing(ashaJar), ravi: await a1.billing(raviJar) }, billingBefore, 'Premium and free are as they were');
  const ashaIds = new Set(ashaBefore.map(e => e.id));
  eq(graded(await a1.history(raviJar)).filter(e => ashaIds.has(e.id)), [], 'neither sees the other\'s attempts');
  const q = await a1.issue(ashaJar, 6104);
  const s = await a1.submit(ashaJar, q.data.question.id, (await a1.sealed(q.data.question.id)).value, 'asha-after');
  eq([q.status, s.status, s.data?.correct, s.data?.authoritative], [201, 200, true, true], 'a new question is issued and marked on the restored database');
  const ashaNow = graded(await a1.history(ashaJar));
  ok(ashaNow.length === 4 && ashaNow[3].serverCursor > Math.max(...ashaBefore.map(e => e.serverCursor), ...raviBefore.map(e => e.serverCursor)),
    `the new attempt lands after every restored cursor (${ashaNow[3]?.serverCursor})`);

  console.log(`POSTGRES RESTORE REHEARSAL: PASS — ${count}/${count} checks — a pg_dump of a live Postgres platform restored into an empty database carries every row, RLS policy, pri_server grant and the cursor sequence, and the real server on it keeps sessions, passwords, histories, marks and Premium, keeps accounts apart, and marks new answers after the restored cursors. Throwaway databases only; physical/PITR restore of the hosted project is not exercised.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (before) await before.close().catch(() => {});
  if (after) await after.close().catch(() => {});
  if (sourceStore) await sourceStore.close?.().catch(() => {});
  if (targetStore) await targetStore.close?.().catch(() => {});
  if (source) await source.drop().catch(() => {});
  if (target) await target.drop().catch(() => {});
  rmSync(scratch, { recursive: true, force: true });
}
