// server/tools/sqlite-to-postgres-export.mjs — the SQLite → Postgres data export.
//
// A seeded scratch SQLite platform database (every lazily built table family,
// awkward values: Hindi, quotes, commas, newlines, NULL beside '', a retained
// payment with no account, a mixed-case email, gaps in audit_log ids and in the
// sync cursor) is exported, and the files are checked: counts, exact
// round-trips through the CSV, NULL/'' distinction, FK order, the cursor and
// identity lifts, the preflight guard, every refusal, and that the source file
// is untouched. With PRI_TEST_PG_ADMIN_URL (node scripts/with-postgres.mjs …)
// the import is also run against a migrated scratch Postgres — plain-SQL and,
// when psql is on PATH, the \copy script — and verify.sql must come back clean.
//
//   node server/test/sqlite-to-postgres-export-check.mjs
//   node scripts/with-postgres.mjs node server/test/sqlite-to-postgres-export-check.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createPlatformDb } from '../platform/db.js';
import { ensureBillingSchema } from '../platform/billingSchema.js';
import { ensureAuthDeliverySchema } from '../platform/authDelivery.js';
import { createTelemetryRouter } from '../platform/telemetry.js';
import { createAdminRouter } from '../platform/admin.js';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../platform/schemaVersions.js';
import {
  SEEDED_TABLES, exportSqliteToPostgres, exportTables, parseCsv, postgresColumns, postgresSchema
} from '../tools/sqlite-to-postgres-export.mjs';

const EXPORT_TABLES = exportTables();

let checks = 0;
const check = (condition, message) => { checks++; assert.ok(condition, message); };
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const refusal = (fn, code, message) => {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  check(caught?.code === code, `${message} (got ${caught?.code || 'no error'}: ${caught?.message || ''})`);
};

const scratch = mkdtempSync(join(tmpdir(), 'pri-pg-export-'));
const dbPath = join(scratch, 'platform.db');
const NOW = 1_790_000_000_000; // an epoch-ms value above 2^31, exported digit for digit
const HINDI_NAME = 'प्रिय "Pri" छात्र, कक्षा 9';
const PAYLOAD = '{"answer":"x = 2, y = -1","note":"line one\nline two","quote":"she said \\"hi\\""}';
const NOTE = 'First line, with a comma\nSecond line with "quotes"\n';

try {
  // ── Seed ──────────────────────────────────────────────────────────────────
  const db = createPlatformDb(dbPath);
  ensureBillingSchema(db);
  ensureAuthDeliverySchema(db);
  createTelemetryRouter(db);
  createAdminRouter(db);
  db.exec(`
    INSERT INTO accounts(id,email,name,password_hash,email_verified_at,role,created_at,updated_at,deleted_at)
      VALUES ('a1','Student.One@Example.com','${HINDI_NAME.replaceAll("'", "''")}','$argon2id$fake',${NOW},'student',${NOW},${NOW},NULL),
             ('a2','teacher@example.com','Teacher Two',NULL,NULL,'teacher',${NOW - 5},${NOW - 5},NULL);
    INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at,revoked_at)
      VALUES ('s1','a1','hash-1','dev-1',NULL,${NOW},${NOW},${NOW + 1000},NULL);
    INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
      VALUES (2,'e2','a1','dev-1',2,'attempt','q2',${NOW + 2},'{"second":true}',${NOW + 2});
    INSERT INTO sync_entities(account_id,kind,entity_id,version,server_cursor,body_json,tombstone,updated_at)
      VALUES ('a1','profile','p1',3,3,NULL,1,${NOW});
    UPDATE sync_cursors SET value = 5 WHERE id = 1;
    INSERT INTO classes(id,teacher_account_id,name,join_code_hash,join_code,join_code_rotated_at,created_at,archived_at)
      VALUES ('c1','a2','Class 9B','jc-hash-1','',NULL,${NOW},NULL),
             ('c2','a2','Class 10A','jc-hash-2',NULL,NULL,${NOW},NULL);
    INSERT INTO class_members(class_id,student_account_id,joined_at,removed_at) VALUES ('c1','a1',${NOW},NULL);
    INSERT INTO audit_log(id,actor_account_id,action,target_kind,target_id,metadata_json,created_at)
      VALUES (1,'a2','class.create','class','c1','{}',${NOW}), (7,NULL,'housekeeping','system',NULL,'{"purged":3}',${NOW});
    INSERT INTO billing_payments(provider,payment_id,provider_subscription_id,account_id,amount,currency,status,captured_at,created_at,updated_at)
      VALUES ('web','pay_1','sub_1',NULL,49900,'INR','captured',${NOW},${NOW},${NOW});
    INSERT INTO operational_events(id,account_id,event_type,surface,metadata_json,created_at)
      VALUES ('o1','a1','sync.push','ipad','{"durationMs":120}',${NOW});
    INSERT INTO feature_flags(key,enabled,audience,config_json,updated_by,updated_at) VALUES ('tutor',1,'all','{}','a2',${NOW});
    INSERT INTO rate_limits(bucket,window_start,count) VALUES ('register:ip:1',${NOW},3);
  `);
  db.prepare(`INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
    VALUES (1,'e1','a1','dev-1',1,'attempt','q1',?,?,?)`).run(NOW + 1, PAYLOAD, NOW + 1);
  db.prepare(`INSERT INTO issue_reports(id,account_id,category,content_id,question_id,app_version,curriculum_version,context_json,note,status,created_at,resolved_at)
    VALUES ('r1','a1','wrong-answer',NULL,'q1','4.0','2026.1','{}',?,'open',?,NULL)`).run(NOTE, NOW);
  const seededCounts = Object.fromEntries(EXPORT_TABLES.map(table => {
    const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
    return [table, exists ? Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n) : null];
  }));
  check(seededCounts.tutor_cache === null, 'tutor_cache is left unbuilt in the source so the absent-table path is exercised');
  check(seededCounts.accounts === 2 && seededCounts.learning_events === 2 && seededCounts.audit_log === 2, 'seed rows are in place');
  db.close();
  const sourceBefore = sha(dbPath);

  // ── Postgres column map from the migrations ───────────────────────────────
  const pg = postgresColumns();
  const schema = postgresSchema();
  const pgTables = [...pg.keys()].sort();
  check(JSON.stringify(pgTables) === JSON.stringify([...EXPORT_TABLES, ...SEEDED_TABLES].sort()),
    `exportTables() ∪ SEEDED_TABLES is exactly the migrations' table set (${pgTables.length} tables)`);
  check(EXPORT_TABLES.every((table, i) => [...schema.get(table).references].every(parent => parent === table || EXPORT_TABLES.indexOf(parent) < i)),
    'exportTables() lists every parent before its children (foreign-key order)');
  check(schema.get('account_sessions').references.has('accounts') && schema.get('auth_delivery_outbox').references.has('account_tokens') &&
    schema.get('billing_payments').references.has('accounts'), 'references are read from create table bodies and from alter table … foreign key');
  check(pg.get('accounts').join(',') === 'id,email,name,password_hash,email_verified_at,role,created_at,updated_at,deleted_at,age_basis', 'accounts columns parsed from the create table body, then alter table … add column (age_basis, schema 9)');
  check(pg.get('billing_subscriptions').includes('state_plan') && pg.get('billing_subscriptions').includes('state_grace_until'), 'alter table … add column (billing v5) is included');
  check(!pg.get('learning_events').includes('unique') && !pg.get('accounts').includes('check'), 'table constraints are not mistaken for columns');

  // ── Export ────────────────────────────────────────────────────────────────
  const outDir = join(scratch, 'export');
  const result = exportSqliteToPostgres({ dbPath, outDir, inserts: true, now: new Date(NOW) });
  check(result.ok === true && result.outDir === outDir, 'export reports ok');
  check(sha(dbPath) === sourceBefore, 'the source database file is byte-identical after the export (opened read-only)');
  check(result.source.schemaVersion === String(SCHEMA_VERSION) && result.source.billingSchemaVersion === String(BILLING_SCHEMA_VERSION) &&
    result.target.schemaVersion === String(SCHEMA_VERSION) && result.target.billingSchemaVersion === String(BILLING_SCHEMA_VERSION),
    `manifest records source and target at schema ${SCHEMA_VERSION} / billing ${BILLING_SCHEMA_VERSION}`);

  const byName = Object.fromEntries(result.tables.map(t => [t.name, t]));
  check(result.tables.map(t => t.name).join(',') === EXPORT_TABLES.join(',') && result.totals.tableOrder.join(',') === EXPORT_TABLES.join(','), 'manifest lists every export table in FK order');
  for (const table of EXPORT_TABLES) {
    const entry = byName[table];
    const expected = seededCounts[table];
    if (expected === null) {
      check(entry.present === false && entry.exportedRows === 0 && entry.file === null, `${table}: absent in source → 0 rows, no file`);
    } else {
      check(entry.present === true && entry.sourceRows === expected && entry.exportedRows === expected && existsSync(join(outDir, entry.file)),
        `${table}: ${expected} row(s) counted, exported and written`);
    }
  }
  const totalRows = Object.values(seededCounts).reduce((sum, n) => sum + (n || 0), 0);
  // tutor_cache (tutor.js), otp_challenges and account_phones (otpCore.js) and
  // ai_usage_daily (aiUsage.js) are built lazily by their routers, so a
  // database that never served them has none.
  check(result.totals.rows === totalRows && result.totals.tablesAbsent.join(',') === 'tutor_cache,otp_challenges,account_phones,ai_usage_daily', `totals: ${totalRows} rows, tutor_cache/otp_challenges/account_phones/ai_usage_daily absent`);
  check(result.seededNotExported.join(',') === 'platform_meta,sync_cursors' && !existsSync(join(outDir, 'platform_meta.csv')) && !existsSync(join(outDir, 'sync_cursors.csv')),
    'platform_meta and sync_cursors are verified, never copied');
  for (const f of result.files) check(sha(join(outDir, f.file)) === f.sha256, `${f.file}: SHA-256 in the manifest matches the file`);

  // ── CSV round-trips ───────────────────────────────────────────────────────
  const csv = table => parseCsv(readFileSync(join(outDir, `${table}.csv`), 'utf8'));
  const accounts = csv('accounts');
  check(accounts[0].join(',') === byName.accounts.columns.join(','), 'accounts.csv header is the column list');
  const a1 = accounts.find(row => row[0] === 'a1');
  check(a1[1] === 'student.one@example.com' && result.normalised.accountEmailsLowercased === 1, 'the mixed-case email is lower-cased for the Postgres CHECK and the manifest says so');
  check(a1[2] === HINDI_NAME, 'Hindi name with quotes and a comma round-trips exactly');
  check(a1[4] === BigInt(NOW) && a1[8] === null, 'epoch-ms integer is exact; NULL deleted_at is an empty unquoted field');
  const a2 = accounts.find(row => row[0] === 'a2');
  check(a2[3] === null && a2[4] === null, 'NULL password_hash / email_verified_at stay NULL');

  const events = csv('learning_events');
  check(events[1][0] === 1n && events[2][0] === 2n, 'learning_events are written in server_cursor order');
  check(events[1][8] === PAYLOAD, 'payload with embedded newline, commas and escaped quotes round-trips exactly');

  const classes = csv('classes');
  const c1 = classes.find(row => row[0] === 'c1');
  const c2 = classes.find(row => row[0] === 'c2');
  check(c1[4] === '' && c2[4] === null, "an empty string ('') and NULL are distinguishable in the CSV (quoted vs unquoted empty)");
  const payments = csv('billing_payments');
  check(payments[1][3] === null && payments[1][4] === 49900n, 'a retained payment with no account keeps account_id NULL');
  const reports = csv('issue_reports');
  check(reports[1][8] === NOTE, 'note with trailing newline round-trips');
  check(reports[1][3] === null, 'NULL content_id stays NULL');
  const audit = csv('audit_log');
  check(audit[1][0] === 1n && audit[2][0] === 7n && audit[2][1] === null, 'audit_log keeps its ids (with the gap) and a NULL actor');

  check(result.syncCursor.sqliteValue === '5' && result.syncCursor.maxLearningEvents === '2' && result.syncCursor.maxSyncEntities === '3' && result.syncCursor.liftTo === '5',
    'the cursor lift is the max of the SQLite allocator and every stored cursor (5)');
  check(result.auditLogMaxId === '7', 'audit_log identity lift target is the highest imported id');

  // ── import-copy.sql ───────────────────────────────────────────────────────
  const copySql = readFileSync(join(outDir, 'import-copy.sql'), 'utf8');
  check(copySql.includes('\\set ON_ERROR_STOP on') && /\nbegin;\n/.test(copySql) && copySql.trimEnd().endsWith('commit;'), 'psql script stops on error and is one transaction');
  const copyLines = copySql.split('\n').filter(line => line.startsWith('\\copy pri.'));
  const presentTables = EXPORT_TABLES.filter(t => seededCounts[t] !== null);
  check(copyLines.length === presentTables.length && copyLines.every((line, i) => line.startsWith(`\\copy pri.${presentTables[i]} (`)),
    `one \\copy per present table, in FK order (${copyLines.length})`);
  check(copyLines.every(line => line.endsWith("with (format csv, header true, null '')")), "every \\copy uses CSV, header, NULL ''");
  check(copyLines.findIndex(l => l.includes('pri.accounts ')) < copyLines.findIndex(l => l.includes('pri.account_sessions ')) &&
    copyLines.findIndex(l => l.includes('pri.classes ')) < copyLines.findIndex(l => l.includes('pri.class_members ')), 'parents are copied before children');
  check(copySql.includes("raise exception 'IMPORT_SCHEMA_MISMATCH") && copySql.includes("raise exception 'IMPORT_TARGET_NOT_EMPTY: pri.accounts"),
    'preflight refuses a wrong-version or non-empty target');
  check(copySql.includes("setval('pri.sync_cursor_seq', greatest(") && copySql.includes('\n  5,\n'), 'the import lifts pri.sync_cursor_seq to at least 5');
  check(copySql.includes("pg_get_serial_sequence('pri.audit_log', 'id')") && copySql.includes(', 7, 1), true)'), 'the import lifts the audit_log identity to at least 7');
  check(!copySql.includes('sync_cursors (') && !copySql.includes('platform_meta ('), 'seeded tables are not copied');

  // ── import-inserts.sql ────────────────────────────────────────────────────
  const insertSql = readFileSync(join(outDir, 'import-inserts.sql'), 'utf8');
  check(insertSql.startsWith('--') && insertSql.includes('\nbegin;\n') && insertSql.trimEnd().endsWith('commit;'), 'plain-SQL import is one transaction');
  check(insertSql.includes('insert into pri.accounts (id, email, name,') && insertSql.includes(`'${HINDI_NAME}'`), 'INSERT literals carry the exact name');
  check(insertSql.includes("'line one\nline two'") || insertSql.includes('line one\nline two'), 'newlines inside literals are kept');
  check(insertSql.includes("'', NULL, ") , "'' and NULL are distinct SQL literals");
  check(!insertSql.includes('insert into pri.tutor_cache'), 'absent/empty tables produce no INSERT');

  // ── verify.sql ────────────────────────────────────────────────────────────
  const verifySql = readFileSync(join(outDir, 'verify.sql'), 'utf8');
  check(EXPORT_TABLES.every(t => verifySql.includes(`('${t}', ${seededCounts[t] || 0})`)), 'verify.sql states the expected count of every table (absent ones as 0)');
  check(verifySql.includes('versions_ok') && verifySql.includes('cursor_sequence_ok') && verifySql.includes('emails_lowercase_ok') && verifySql.includes('audit_log_identity_ok'),
    'verify.sql checks versions, cursor sequence, email case and the identity');

  // ── Refusals ──────────────────────────────────────────────────────────────
  refusal(() => exportSqliteToPostgres({ dbPath, outDir }), 'EXPORT_TARGET_NOT_EMPTY', 'a non-empty output directory is refused');
  refusal(() => exportSqliteToPostgres({ dbPath: join(scratch, 'missing.db'), outDir: join(scratch, 'x1') }), 'EXPORT_SOURCE_MISSING', 'a missing source is refused');
  refusal(() => exportSqliteToPostgres({ outDir: join(scratch, 'x2') }), 'USAGE', '--db is required');
  const notPlatform = join(scratch, 'other.db');
  new Database(notPlatform).exec('CREATE TABLE t(x)');
  refusal(() => exportSqliteToPostgres({ dbPath: notPlatform, outDir: join(scratch, 'x3') }), 'DB_NOT_PLATFORM', 'a non-platform SQLite file is refused');
  const oldPath = join(scratch, 'old.db');
  const old = createPlatformDb(oldPath);
  ensureBillingSchema(old);
  old.prepare("UPDATE platform_meta SET value = '7' WHERE key = 'schema_version'").run();
  old.close();
  refusal(() => exportSqliteToPostgres({ dbPath: oldPath, outDir: join(scratch, 'x4') }), 'EXPORT_SCHEMA_MISMATCH', 'a source at another schema version is refused');
  check(!existsSync(join(scratch, 'x4')) || !existsSync(join(scratch, 'x4', 'manifest.json')), 'a refused export writes no manifest');
  const extraPath = join(scratch, 'extra.db');
  const extra = createPlatformDb(extraPath);
  ensureBillingSchema(extra);
  extra.exec('ALTER TABLE rate_limits ADD COLUMN not_in_postgres TEXT');
  extra.close();
  refusal(() => exportSqliteToPostgres({ dbPath: extraPath, outDir: join(scratch, 'x5') }), 'EXPORT_COLUMN_UNKNOWN', 'a SQLite column Postgres lacks is refused before any COPY could fail');

  // ── CLI ───────────────────────────────────────────────────────────────────
  const cli = spawnSync(process.execPath, ['server/tools/sqlite-to-postgres-export.mjs', '--db', dbPath, '--out', join(scratch, 'cli-out')], { encoding: 'utf8', cwd: join(import.meta.dirname, '..', '..') });
  const cliOut = JSON.parse(cli.stdout.trim());
  check(cli.status === 0 && cliOut.ok === true && cliOut.rows === totalRows && cliOut.syncCursorLiftTo === '5' && cliOut.files.includes('import-copy.sql') && !cliOut.files.includes('import-inserts.sql'),
    'CLI prints a JSON summary (no --inserts → no inserts file)');
  const cliBad = spawnSync(process.execPath, ['server/tools/sqlite-to-postgres-export.mjs', '--db', oldPath, '--out', join(scratch, 'cli-bad')], { encoding: 'utf8', cwd: join(import.meta.dirname, '..', '..') });
  check(cliBad.status === 1 && JSON.parse(cliBad.stderr.trim()).code === 'EXPORT_SCHEMA_MISMATCH', 'CLI exits 1 with the coded refusal on stderr');

  // ── Import into a real Postgres (only under scripts/with-postgres.mjs) ────
  let postgresLeg = 'skipped (no PRI_TEST_PG_ADMIN_URL; run via node scripts/with-postgres.mjs for the import leg)';
  if (String(process.env.PRI_TEST_PG_ADMIN_URL || '').trim()) {
    const { scratchDatabase } = await import('./support/postgres.mjs');
    const verifyQueries = verifySql.split(/\n(?=-- \d\. )/).map(block => block.split('\n').filter(l => !l.startsWith('--')).join('\n').trim()).filter(Boolean);
    check(verifyQueries.length === 5, 'verify.sql holds five queries');
    const runVerify = async (client, label) => {
      const counts = await client.query(verifyQueries[0]);
      check(counts.rows.length === EXPORT_TABLES.length && counts.rows.every(r => r.result === 'ok'),
        `${label}: every row count matches (${counts.rows.filter(r => r.result !== 'ok').map(r => `${r.table_name} ${r.expected_rows}≠${r.actual_rows}`).join(', ') || 'all ok'})`);
      check((await client.query(verifyQueries[1])).rows[0].versions_ok === true, `${label}: versions_ok`);
      check((await client.query(verifyQueries[2])).rows[0].cursor_sequence_ok === true, `${label}: cursor_sequence_ok`);
      check((await client.query(verifyQueries[3])).rows[0].emails_lowercase_ok === true, `${label}: emails_lowercase_ok`);
      check((await client.query(verifyQueries[4])).rows[0].audit_log_identity_ok === true, `${label}: audit_log_identity_ok`);
      const name = await client.query("select name, email from pri.accounts where id = 'a1'");
      check(name.rows[0].name === HINDI_NAME && name.rows[0].email === 'student.one@example.com', `${label}: the Hindi name and lower-cased email are stored exactly`);
      const payload = await client.query('select payload_json from pri.learning_events where server_cursor = 1');
      check(payload.rows[0].payload_json === PAYLOAD, `${label}: payload with newline/quotes/commas is stored exactly`);
      const join_ = await client.query("select id, join_code from pri.classes order by id");
      check(join_.rows[0].join_code === '' && join_.rows[1].join_code === null, `${label}: '' and NULL arrive as '' and NULL`);
      const next = await client.query("select nextval('pri.sync_cursor_seq') as v");
      check(Number(next.rows[0].v) === 6, `${label}: the next sync cursor is 6 (above every imported cursor and the SQLite allocator)`);
      const auditNext = await client.query("insert into pri.audit_log(action,target_kind,metadata_json,created_at) values ('t','x','{}',1) returning id");
      check(Number(auditNext.rows[0].id) === 8, `${label}: the next audit_log id is 8`);
    };

    // Plain SQL
    const a = await scratchDatabase('export_inserts');
    try {
      await a.client.query(insertSql);
      await runVerify(a.client, 'inserts import');
      let again = null;
      try { await a.client.query(insertSql); } catch (error) { again = error; }
      check(String(again?.message || '').includes('IMPORT_TARGET_NOT_EMPTY'), 'inserts import: a second run is refused by the preflight (target not empty)');
    } finally { await a.drop(); }

    // psql \copy
    const psql = spawnSync('psql', ['--version'], { encoding: 'utf8' });
    if (psql.status === 0) {
      const b = await scratchDatabase('export_copy');
      try {
        const run = spawnSync('psql', [b.url, '-v', 'ON_ERROR_STOP=1', '-q', '-f', 'import-copy.sql'], { cwd: outDir, encoding: 'utf8' });
        check(run.status === 0, `psql \\copy import succeeds (${(run.stderr || '').trim().split('\n')[0] || 'no stderr'})`);
        await runVerify(b.client, '\\copy import');
        const rerun = spawnSync('psql', [b.url, '-v', 'ON_ERROR_STOP=1', '-q', '-f', 'import-copy.sql'], { cwd: outDir, encoding: 'utf8' });
        check(rerun.status !== 0 && rerun.stderr.includes('IMPORT_TARGET_NOT_EMPTY'), '\\copy import: a second run is refused by the preflight');
      } finally { await b.drop(); }
      postgresLeg = 'inserts and psql \\copy imports verified on a migrated scratch Postgres';
    } else {
      postgresLeg = 'inserts import verified on a migrated scratch Postgres (psql not on PATH: \\copy leg skipped)';
    }
  }

  console.log(`SQLITE TO POSTGRES EXPORT: PASS — ${checks}/${checks} checks — a seeded SQLite platform database exports every pri table as COPY-ready CSV with exact round-trips, FK-ordered transactional import scripts, cursor and identity lifts, verification queries and coded refusals; Postgres leg: ${postgresLeg}.`);
} catch (error) {
  console.error(`SQLITE TO POSTGRES EXPORT: FAIL — after ${checks} passing checks: ${error?.message || error}`);
  process.exit(1);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
