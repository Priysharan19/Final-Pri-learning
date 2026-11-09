// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · account RLS covers EVERY account-bearing table
//
//   node server/test/rls-account-coverage-check.mjs                     → part 1
//   node scripts/with-postgres.mjs node server/test/rls-account-coverage-check.mjs --engine=postgres
//                                                                     → parts 1–3
//
// 20261016000000_rls_fail_closed.sql scoped only the tables with a NOT NULL
// account_id; accounts, classes, class_members, assignment_*, issue_reports,
// the nullable-account billing ledgers, otp_challenges, audit_log,
// content_revisions, teacher_invites and feature_flags were readable and
// writable for every account inside transaction({ accountScope }).
// 20261019000000_rls_account_coverage.sql closes that. This suite:
//
//   1. (no database) the migration exists, is one transaction, restrictive,
//      pri_server-only, and never sub-selects (no recursive policy).
//   2. (Postgres, catalogue) enumerates every pri table that names an account —
//      a foreign key to pri.accounts, a column ending in account_id, or
//      accounts itself — and fails unless RLS is enabled, pri_server neither
//      owns the table nor bypasses RLS (so RLS is in force for it without
//      FORCE ROW LEVEL SECURITY, which this schema never uses: the owner is the
//      migrating superuser), and a RESTRICTIVE pri_account_scope policy for ALL,
//      to pri_server only, admits system scope or that account only.
//   3. (Postgres, behaviour, as a pri_server member through the store) per newly
//      covered table: account scope A reads only A's row, cannot read, update,
//      delete or INSERT B's; system scope sees both; a raw pri_server connection
//      that declares no scope sees nothing.
//
// System scope is the store's default for every statement outside an
// accountScope transaction (server/platform/store.js), so workers, admin,
// teacher/guardian flows, deletion and export are unchanged; that is asserted
// here too (system scope sees and updates every seeded row).
// ─────────────────────────────────────────────────────────────────────────────
import { SCHEMA_VERSION } from '../platform/schemaVersions.js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestedEngine } from './support/engine.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const engine = requestedEngine();
let passed = 0;
const failures = [];
const ok = (cond, label) => { if (cond) passed++; else failures.push(label); };
const eq = (actual, expected, label) => ok(JSON.stringify(actual) === JSON.stringify(expected), `${label} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);

// Each newly covered table and the column(s) that make a row an account's.
const COVERED = {
  accounts: ['id'],
  classes: ['teacher_account_id'],
  class_members: ['student_account_id'],
  assignments: ['teacher_account_id'],
  assignment_submissions: ['student_account_id'],
  assignment_feedback: ['student_account_id', 'teacher_account_id'],
  issue_reports: ['account_id'],
  billing_payments: ['account_id'],
  billing_events: ['account_id'],
  billing_apple_signed_events: ['account_id'],
  otp_challenges: ['account_id'],
  audit_log: ['actor_account_id'],
  content_revisions: ['author_account_id', 'reviewer_account_id'],
  teacher_invites: ['created_by', 'used_by'],
  feature_flags: ['updated_by']
};

// ── 1 · The migration (static) ─────────────────────────────────────────────
const FILE = join(ROOT, 'supabase', 'migrations', '20261019000000_rls_account_coverage.sql');
ok(existsSync(FILE), 'supabase/migrations/20261019000000_rls_account_coverage.sql exists');
if (existsSync(FILE)) {
  const sql = readFileSync(FILE, 'utf8').replace(/--[^\n]*/g, '');
  ok(/^\s*begin;/m.test(sql) && /^commit;\s*$/m.test(sql), 'the migration is one transaction');
  ok(/as restrictive for all to pri_server/.test(sql), 'its policies are RESTRICTIVE, FOR ALL, to pri_server only');
  ok(!/\bselect\b/i.test(sql.replace(/for t in select \* from \(values/i, '')), 'no policy sub-selects another table (no recursive RLS)');
  for (const t of Object.keys(COVERED)) ok(new RegExp(`\\('${t}',`).test(sql), `the migration covers ${t}`);
  // Train 10 decision: the version moves so a server expecting these policies
  // refuses to boot on a database without them (fail closed).
  ok(/update pri\.platform_meta set value = '13' where key = 'schema_version';/.test(sql) && SCHEMA_VERSION >= 13,
    'schema_version moves to 13 with the build (later migrations move it on: 14, 20261022000000_parent_report.sql): a server refuses a database without these policies');
}

// ── 2–3 · Live Postgres ────────────────────────────────────────────────────
if (engine === 'postgres') {
  const { scratchDatabase, serverRoleUrl, pgModule } = await import('./support/postgres.mjs');
  const { createPostgresStore } = await import('../platform/store.js');
  const pg = await pgModule();
  const scratch = await scratchDatabase('rls_account_coverage');
  const su = scratch.client;
  const url = await serverRoleUrl(scratch.name);
  const store = await createPostgresStore(url, { max: 2 });
  const raw = new pg.Client({ connectionString: url });
  await raw.connect();
  try {
    await raw.query('SET search_path TO pri');
    // Every account-bearing table.
    const fk = (await su.query(`SELECT DISTINCT c.relname AS t FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace WHERE k.contype = 'f' AND k.confrelid = 'pri.accounts'::regclass AND n.nspname = 'pri'`)).rows.map(r => r.t);
    const named = (await su.query(`SELECT DISTINCT table_name AS t FROM information_schema.columns
      WHERE table_schema = 'pri' AND column_name LIKE '%account_id'`)).rows.map(r => r.t);
    const bearing = [...new Set(['accounts', ...fk, ...named])].sort();
    ok(bearing.length >= 34, `found ${bearing.length} account-bearing pri tables`);
    const role = (await su.query("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'pri_server'")).rows[0];
    eq(role, { rolsuper: false, rolbypassrls: false }, 'pri_server is neither superuser nor BYPASSRLS');
    const meta = Object.fromEntries((await su.query(`SELECT c.relname AS t, c.relrowsecurity AS rls, pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'pri' AND c.relkind = 'r'`)).rows.map(r => [r.t, r]));
    const policies = (await su.query(`SELECT c.relname AS t, p.polpermissive AS permissive, p.polcmd AS cmd,
        ARRAY(SELECT rolname::text FROM pg_roles WHERE oid = ANY(p.polroles))::text[] AS roles,
        pg_get_expr(p.polqual, p.polrelid) AS qual, pg_get_expr(p.polwithcheck, p.polrelid) AS chk
      FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'pri' AND p.polname = 'pri_account_scope'`)).rows;
    const scopes = expr => /pri\.scope.*'system'/.test(expr || '') && /'account'/.test(expr || '') && /pri\.account_id/.test(expr || '');
    const uncovered = [];
    for (const t of bearing) {
      const p = policies.filter(x => x.t === t);
      const good = meta[t]?.rls && meta[t]?.owner !== 'pri_server' && p.length === 1 && !p[0].permissive && p[0].cmd === '*'
        && JSON.stringify(p[0].roles) === '["pri_server"]' && scopes(p[0].qual) && scopes(p[0].chk);
      if (!good) uncovered.push(t);
    }
    eq(uncovered, [], 'every account-bearing table has RLS in force for pri_server and a restrictive pri_account_scope policy');

    // Seed (superuser, bypasses RLS): one row per account per covered table.
    const NOW = 1_790_000_000_000;
    const seed = (A, n) => `
      INSERT INTO pri.accounts(id,email,name,role,created_at,updated_at) VALUES ('${A}','${A}@example.test','${A}','teacher',${NOW},${NOW});
      INSERT INTO pri.classes(id,teacher_account_id,name,join_code_hash,created_at) VALUES ('c-${A}','${A}','9B','jch-${A}',${NOW});
      INSERT INTO pri.class_members(class_id,student_account_id,joined_at) VALUES ('c-${A}','${A}',${NOW});
      INSERT INTO pri.assignments(id,class_id,teacher_account_id,title,specification_json,created_at) VALUES ('as-${A}','c-${A}','${A}','T','{}',${NOW});
      INSERT INTO pri.assignment_submissions(assignment_id,student_account_id,state,started_at,updated_at) VALUES ('as-${A}','${A}','started',${NOW},${NOW});
      INSERT INTO pri.assignment_feedback(assignment_id,student_account_id,teacher_account_id,returned_at,updated_at) VALUES ('as-${A}','${A}','${A}',${NOW},${NOW});
      INSERT INTO pri.issue_reports(id,account_id,category,created_at) VALUES ('ir-${A}','${A}','other',${NOW});
      INSERT INTO pri.billing_payments(provider,payment_id,provider_subscription_id,account_id,amount,captured_at,created_at,updated_at) VALUES ('web','pay-${A}','sub-${A}','${A}',100,${NOW},${NOW},${NOW});
      INSERT INTO pri.billing_events(provider,event_id,event_type,payload_digest,account_id,received_at) VALUES ('web','ev-${A}','x','d','${A}',${NOW});
      INSERT INTO pri.billing_apple_signed_events(event_id,kind,original_transaction_id,transaction_id,environment,signed_date,signed_payload,account_id,received_at) VALUES ('ae-${A}','transaction','o-${A}','t-${A}','Sandbox',${NOW},'p','${A}',${NOW});
      INSERT INTO pri.otp_challenges(id,account_id,channel,purpose,destination_hash,code_hash,provider,created_at,expires_at) VALUES ('otp-${A}','${A}','email','sign-in','dh-${A}','ch','test',${NOW},${NOW + 1000});
      INSERT INTO pri.audit_log(actor_account_id,action,target_kind,created_at) VALUES ('${A}','x','y',${NOW});
      INSERT INTO pri.content_revisions(id,content_key,curriculum_version,status,source_json,body_json,revision,author_account_id,reviewer_account_id,created_at) VALUES ('cr-${A}','k-${A}','v','draft','{}','{}',${n},'${A}','${A}',${NOW});
      INSERT INTO pri.teacher_invites(id,code_hash,code_prefix,created_by,used_by,created_at,expires_at) VALUES ('ti-${A}','h-${A}','p','${A}','${A}',${NOW},${NOW + 1000});
      INSERT INTO pri.feature_flags(key,enabled,updated_by,updated_at) VALUES ('flag-${A}',1,'${A}',${NOW});`;
    await su.query(`BEGIN; ${seed('acct-a', 1)} ${seed('acct-b', 2)} COMMIT;`);
    const owned = (t, A) => COVERED[t].map(c => `${c} = '${A}'`).join(' AND ');
    const count = async (q, sql) => Number((await q(sql)).n);
    const sys = sql => store.get(sql);

    // Unscoped raw pri_server: nothing. System scope: both rows.
    const unscopedSeen = [];
    const systemMissing = [];
    for (const t of Object.keys(COVERED)) {
      if (Number((await raw.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n)) unscopedSeen.push(t);
      if (await count(sys, `SELECT count(*)::int AS n FROM ${t} WHERE ${owned(t, 'acct-a')} OR ${owned(t, 'acct-b')}`) !== 2) systemMissing.push(t);
    }
    eq(unscopedSeen, [], 'a pooled pri_server connection that declares no scope sees no row of any covered table');
    eq(systemMissing, [], 'system scope (workers, admin, teacher, deletion, export) sees both accounts\' rows in every covered table');
    const sysUpdated = await store.transaction(async tx => {
      const out = {};
      for (const t of Object.keys(COVERED)) {
        if (t === 'audit_log') continue; // append-only for pri_server by grant
        out[t] = (await tx.run(`UPDATE ${t} SET ${COVERED[t][0]} = ${COVERED[t][0]} WHERE ${owned(t, 'acct-b')}`)).changes;
      }
      return out;
    });
    eq(Object.values(sysUpdated).every(n => n === 1), true, `system scope can still update another account's row in every covered table (${JSON.stringify(sysUpdated)})`);

    // Account scope A, table by table.
    const PROBE = Object.assign(new Error('rollback probe'), { code: 'PROBE' });
    const copyAs = (t, account) => `INSERT INTO ${t} SELECT * FROM jsonb_populate_record(NULL::${t},
      (SELECT to_jsonb(x) || jsonb_build_object(${COVERED[t].map(c => `'${c}', '${account}'`).join(', ')}) FROM ${t} x WHERE ${owned(t, 'acct-a')} LIMIT 1))`;
    for (const t of Object.keys(COVERED)) {
      // Each probe is rolled back, so a cross-account write that succeeds (the
      // defect) cannot cascade into the next table's probe.
      let view = null;
      await store.transaction(async tx => { view = {
        all: Number((await tx.get(`SELECT count(*)::int AS n FROM ${t}`)).n),
        own: Number((await tx.get(`SELECT count(*)::int AS n FROM ${t} WHERE ${owned(t, 'acct-a')}`)).n),
        other: Number((await tx.get(`SELECT count(*)::int AS n FROM ${t} WHERE ${owned(t, 'acct-b')}`)).n),
        updated: t === 'audit_log' ? 0 : (await tx.run(`UPDATE ${t} SET ${COVERED[t][0]} = ${COVERED[t][0]} WHERE ${owned(t, 'acct-b')}`)).changes,
        deleted: t === 'audit_log' ? 0 : (await tx.run(`DELETE FROM ${t} WHERE ${owned(t, 'acct-b')}`)).changes
      }; throw PROBE; }, { accountScope: 'acct-a' }).catch(error => { if (error?.code !== 'PROBE') view = { error: `${error?.dbCode || error?.code} ${String(error?.cause?.message || error?.message).slice(0, 80)}` }; });
      eq(view, { all: 1, own: 1, other: 0, updated: 0, deleted: 0 }, `${t}: account scope sees only its own row and cannot read, update or delete the other account's`);
      const smuggled = await store.transaction(tx => tx.run(copyAs(t, 'acct-b')), { accountScope: 'acct-a' }).catch(error => error);
      ok(String(smuggled?.dbCode || smuggled?.code) === '42501' && /row-level security/.test(String(smuggled?.cause?.message || smuggled?.message)),
        `${t}: account scope cannot INSERT a row owned by another account (got ${smuggled?.dbCode || smuggled?.code || 'no error'} ${String(smuggled?.cause?.message || smuggled?.message || '').slice(0, 80)})`);
      if (t !== 'audit_log' && t !== 'accounts') {
        const rehome = await store.transaction(tx => tx.run(`UPDATE ${t} SET ${COVERED[t].map(c => `${c} = 'acct-b'`).join(', ')} WHERE ${owned(t, 'acct-a')}`), { accountScope: 'acct-a' }).catch(error => error);
        ok(String(rehome?.dbCode || rehome?.code) === '42501', `${t}: account scope cannot hand its own row to another account (got ${rehome?.dbCode || rehome?.code || 'no error'})`);
      }
      const control = await store.transaction(async tx => { await tx.run(copyAs(t, 'acct-a')); throw PROBE; }, { accountScope: 'acct-a' }).catch(error => error);
      ok(String(control?.dbCode || control?.code) !== '42501', `${t}: control — the same INSERT for its own account is not refused by RLS (got ${control?.dbCode || control?.code})`);
    }
    // Two owner columns: a row is the account's when EITHER column names it, and
    // a third account sees it under neither. The seeds above put the same account
    // in both columns, which cannot tell `a AND (b OR c)` from `(a AND b) OR c`;
    // this mixed row (student A, teacher B) can.
    await su.query(`INSERT INTO pri.assignment_feedback(assignment_id,student_account_id,teacher_account_id,returned_at,updated_at) VALUES ('as-acct-b','acct-a','acct-b',${NOW},${NOW})`);
    const mixedSeen = {};
    for (const who of ['acct-a', 'acct-b', 'acct-c']) {
      await store.transaction(async tx => {
        mixedSeen[who] = Number((await tx.get("SELECT count(*)::int AS n FROM assignment_feedback WHERE assignment_id = 'as-acct-b' AND student_account_id = 'acct-a'")).n);
        throw PROBE;
      }, { accountScope: who }).catch(error => { if (error?.code !== 'PROBE') mixedSeen[who] = `error ${error?.dbCode || error?.code}`; });
    }
    eq(mixedSeen, { 'acct-a': 1, 'acct-b': 1, 'acct-c': 0 }, 'a feedback row with student A and teacher B is visible to A and to B, and to no third account');
    // An account scope with an empty id sees nothing of the covered tables.
    await raw.query("SELECT set_config('pri.scope', 'account', false), set_config('pri.account_id', '', false)");
    eq(Number((await raw.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n), 0, 'account scope with an empty account id sees no account row');
  } finally {
    await raw.end().catch(() => {});
    await store.close().catch(() => {});
    await scratch.drop();
  }
}

console.log(`engine: ${engine}`);
if (failures.length) {
  console.error(`RLS ACCOUNT COVERAGE: FAIL — ${failures.length} of ${passed + failures.length}\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`RLS ACCOUNT COVERAGE: PASS — ${passed}/${passed} checks${engine === 'postgres' ? ' — every account-bearing pri table is account-scoped under RLS; account scope cannot cross accounts; unscoped sees nothing; system scope unchanged' : ' (run with --engine=postgres for the live proof)'}.`);
