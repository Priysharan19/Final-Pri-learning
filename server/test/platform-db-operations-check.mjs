import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, closeSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Database operations for the single-writer SQLite platform volume (cloud-08,
// cicd-16): WAL + synchronous=NORMAL, checkpoint-and-close, the v3 -> v4 column
// migrations on a pre-existing file, VACUUM INTO backups gated by
// integrity_check, restore that validates before swapping, the CLI entry points
// and a real `node server/index.js` process stopped with SIGTERM / SIGINT.
const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..');
const scratch = mkdtempSync(join(tmpdir(), 'pri-db-ops-'));
const previousEnv = { PRI_PLATFORM_DB: process.env.PRI_PLATFORM_DB };
process.env.PRI_PLATFORM_DB = join(scratch, 'module-level.db');

const [
  { createPlatformDb, checkpointPlatformDb, closePlatformDb },
  { ensureBillingSchema, BILLING_SCHEMA_VERSION },
  { backupPlatformDb, verifyPlatformDatabase },
  { restorePlatformDb }
] = await Promise.all([
  import('../platform/db.js'),
  import('../platform/billingSchema.js'),
  import('../tools/backup.mjs'),
  import('../tools/restore.mjs')
]);

let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const now = Date.now();
function seedAccount(db, id) {
  db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at) VALUES (?,?,?,'hash','student',?,?)`).run(id, `${id}@example.test`, id, now, now);
}
function accountCount(path) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try { return db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n; } finally { db.close(); }
}
function columns(path, table) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try { return db.pragma(`table_info('${table}')`).map(row => row.name); } finally { db.close(); }
}

async function runServerAndSignal(dbPath, signal) {
  const env = { ...process.env, PRI_PLATFORM_DB: dbPath, PORT: '0', PRI_SHUTDOWN_DEADLINE_MS: '5000', PRI_AUTH_DELIVERY_KEY: '55'.repeat(32) };
  delete env.NODE_ENV;
  delete env.PRI_PUBLIC_ORIGIN;
  const child = spawn(process.execPath, [join(serverRoot, 'index.js')], { cwd: serverRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const exit = new Promise(resolve => child.on('exit', (code, exitSignal) => resolve({ code, signal: exitSignal })));
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`server did not start within 20s: ${stderr}`)); }, 20_000);
    const poll = () => {
      const match = stdout.match(/running on port (\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); return; }
      if (child.exitCode !== null) { clearTimeout(timer); reject(new Error(`server exited early: ${stderr}`)); return; }
      setTimeout(poll, 50);
    };
    poll();
  });
  const health = await fetch(`http://127.0.0.1:${port}/v1/health`);
  assert.equal(health.status, 200);
  const registration = await fetch(`http://127.0.0.1:${port}/v1/account/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Shutdown', email: `shutdown-${signal.toLowerCase()}@example.test`, password: 'shutdown-pass-123', deviceId: 'ipad' })
  });
  assert.equal(registration.status, 201, await registration.text());
  const walBeforeSignal = existsSync(`${dbPath}-wal`) ? statSync(`${dbPath}-wal`).size : 0;
  child.kill(signal);
  const timeout = new Promise((_, reject) => setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`${signal}: server did not exit within 15s\n${stdout}\n${stderr}`)); }, 15_000));
  const result = await Promise.race([exit, timeout]);
  return { ...result, stdout, stderr, walBeforeSignal };
}

try {
  // ── Durability pragmas + checkpoint on close ─────────────────────────────
  const livePath = join(scratch, 'live', 'platform.db');
  const live = createPlatformDb(livePath);
  check(live.pragma('journal_mode', { simple: true }) === 'wal', 'platform database runs in WAL mode');
  check(live.pragma('synchronous', { simple: true }) === 1, 'synchronous=NORMAL (1) on the WAL connection');
  check(live.pragma('foreign_keys', { simple: true }) === 1, 'foreign keys stay enforced');
  seedAccount(live, 'acct-wal');
  check(existsSync(`${livePath}-wal`) && statSync(`${livePath}-wal`).size > 0, 'committed rows sit in the WAL before a checkpoint');
  const checkpoint = checkpointPlatformDb(live);
  // SQLite reports frame counters relative to the current WAL generation, so
  // the durable evidence is: not busy, every reported frame backfilled, and the
  // file itself truncated (asserted next).
  check(checkpoint.busy === 0 && checkpoint.checkpointed === checkpoint.log, `checkpoint completed without a busy writer (${JSON.stringify(checkpoint)})`);
  check(statSync(`${livePath}-wal`).size === 0, 'TRUNCATE checkpoint empties the WAL');
  const closed = closePlatformDb(live);
  check(closed.closed === true && !!closed.checkpoint && live.open === false, 'closePlatformDb checkpoints then closes');
  check(!existsSync(`${livePath}-wal`), 'closing the last connection removes the WAL sidecar');
  check(closePlatformDb(live).closed === false, 'closing twice is a harmless no-op');
  check(accountCount(livePath) === 1, 'the main file alone contains the committed row after close');

  // ── v3 -> v4 migrations on a pre-existing database ───────────────────────
  const legacyPath = join(scratch, 'legacy', 'platform.db');
  {
    // Build the v3 shape by hand: classes without join_code columns and
    // billing_subscriptions without cancellation columns.
    mkdirSync(dirname(legacyPath), { recursive: true });
    const v3 = new Database(legacyPath);
    v3.pragma('foreign_keys = ON');
    v3.exec(`
      CREATE TABLE platform_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO platform_meta(key,value) VALUES ('schema_version','3');
      INSERT INTO platform_meta(key,value) VALUES ('billing_schema_version','2');
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password_hash TEXT,
        email_verified_at INTEGER, role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','teacher','support','admin')),
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
      );
      CREATE TABLE classes (
        id TEXT PRIMARY KEY, teacher_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name TEXT NOT NULL, join_code_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, archived_at INTEGER
      );
      CREATE TABLE billing_subscriptions (
        provider TEXT NOT NULL CHECK(provider IN ('apple','google','web')), provider_subscription_id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, product_id TEXT NOT NULL,
        cadence TEXT CHECK(cadence IN ('monthly','annual') OR cadence IS NULL),
        trial_claimed INTEGER NOT NULL DEFAULT 0 CHECK(trial_claimed IN (0,1)),
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_effective_at INTEGER NOT NULL DEFAULT 0,
        last_event_rank INTEGER NOT NULL DEFAULT 0, last_event_id TEXT, PRIMARY KEY(provider, provider_subscription_id)
      );
    `);
    v3.prepare(`INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES ('acct-legacy','legacy@example.test','Legacy','teacher',?,?)`).run(now, now);
    v3.prepare(`INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at) VALUES ('cls-legacy','acct-legacy','Class 9','hash-legacy',?)`).run(now);
    v3.prepare(`INSERT INTO billing_subscriptions(provider,provider_subscription_id,account_id,product_id,cadence,created_at,updated_at)
      VALUES ('web','sub_Legacy00000001','acct-legacy','plan_Legacy1234567','monthly',?,?)`).run(now, now);
    v3.close();
  }
  const migrated = createPlatformDb(legacyPath);
  const billingVersion = ensureBillingSchema(migrated);
  const classColumns = migrated.pragma("table_info('classes')").map(row => row.name);
  check(classColumns.includes('join_code') && classColumns.includes('join_code_rotated_at'), 'v4 adds recoverable join-code columns to an existing classes table');
  const legacyClass = migrated.prepare("SELECT name,join_code_hash,join_code,join_code_rotated_at FROM classes WHERE id='cls-legacy'").get();
  check(legacyClass?.name === 'Class 9' && legacyClass.join_code_hash === 'hash-legacy' && legacyClass.join_code === null, 'pre-v4 classes keep their hash and have no revealed code until rotated');
  const billingColumns = migrated.pragma("table_info('billing_subscriptions')").map(row => row.name);
  check(['cancel_requested_at', 'cancel_mode', 'cancel_reason'].every(c => billingColumns.includes(c)), 'billing schema v3 adds cancellation columns to an existing table');
  check(migrated.prepare("SELECT cancel_requested_at FROM billing_subscriptions WHERE provider_subscription_id='sub_Legacy00000001'").get()?.cancel_requested_at === null, 'existing bindings are not marked cancelled by the migration');
  const tables = new Set(migrated.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
  check(tables.has('billing_payments') && tables.has('billing_refunds') && tables.has('learning_events'), 'new ledger tables and core tables exist after migration');
  check(migrated.prepare("SELECT value FROM platform_meta WHERE key='schema_version'").get().value === '6', 'schema version advances to 6');
  check(migrated.pragma("table_info('idempotency_keys')").some(row => row.name === 'request_digest'), 'schema v5 gives an existing database the idempotency request digest');
  check(migrated.prepare("SELECT value FROM platform_meta WHERE key='billing_schema_version'").get().value === String(BILLING_SCHEMA_VERSION) && billingVersion === BILLING_SCHEMA_VERSION, 'billing schema version advances');
  check(migrated.pragma('foreign_key_check').length === 0, 'migration leaves referential integrity valid');
  closePlatformDb(migrated);
  const reopened = createPlatformDb(legacyPath);
  ensureBillingSchema(reopened);
  check(reopened.pragma("table_info('classes')").filter(row => row.name === 'join_code').length === 1, 'migration is idempotent on reopen');
  closePlatformDb(reopened);

  // ── Backup: VACUUM INTO + integrity gate while the server is running ─────
  const source = createPlatformDb(livePath);
  seedAccount(source, 'acct-second');
  const backupDir = join(scratch, 'backups');
  const t1 = new Date('2026-09-06T10:15:00Z');
  const first = backupPlatformDb({ dbPath: livePath, outDir: backupDir, now: t1 });
  check(first.ok === true && first.path === join(backupDir, 'pri-learning-platform-20260906T101500Z.db'), 'backup file is timestamped');
  check(first.integrity === 'ok' && first.schemaVersion === '6' && first.accounts === 2 && first.bytes > 0, 'backup is verified after VACUUM INTO');
  check((statSync(first.path).mode & 0o777) === 0o600, 'backup file is owner-only');
  check(accountCount(first.path) === 2, 'backup contains rows that were still only in the WAL of the live database');
  check(!existsSync(`${first.path}-wal`), 'backup is a single self-contained file');
  assert.throws(() => backupPlatformDb({ dbPath: livePath, outDir: backupDir, now: t1 }), error => error?.code === 'BACKUP_TARGET_EXISTS');
  checks++;
  seedAccount(source, 'acct-third');
  const second = backupPlatformDb({ dbPath: livePath, outDir: backupDir, now: new Date('2026-09-07T10:15:00Z') });
  const third = backupPlatformDb({ dbPath: livePath, outDir: backupDir, now: new Date('2026-09-08T10:15:00Z'), keep: 2 });
  check(third.pruned.length === 1 && third.pruned[0] === first.path && !existsSync(first.path) && existsSync(second.path) && existsSync(third.path), '--keep prunes only the oldest backups');
  check(second.accounts === 3 && third.accounts === 3, 'later backups include later rows');
  assert.throws(() => backupPlatformDb({ dbPath: join(scratch, 'missing.db'), outDir: backupDir }), error => error?.code === 'BACKUP_SOURCE_MISSING');
  checks++;
  check(readdirSync(backupDir).every(name => /^pri-learning-platform-\d{8}T\d{6}Z\.db$/.test(name)), 'backup directory holds only timestamped backups');
  closePlatformDb(source);

  const garbage = join(scratch, 'garbage.db');
  writeFileSync(garbage, Buffer.alloc(8192, 0x41));
  assert.throws(() => verifyPlatformDatabase(garbage), 'a non-SQLite file is rejected');
  checks++;
  const foreign = join(scratch, 'foreign.db');
  { const f = new Database(foreign); f.exec('CREATE TABLE t(x)'); f.close(); }
  assert.throws(() => verifyPlatformDatabase(foreign), error => error?.code === 'DB_NOT_PLATFORM');
  checks++;
  const corrupt = join(scratch, 'corrupt.db');
  copyFileSync(second.path, corrupt);
  {
    // Keep the header page intact, destroy a b-tree page: opens fine, fails integrity_check.
    const fd = openSync(corrupt, 'r+');
    writeSync(fd, Buffer.alloc(4096, 0xff), 0, 4096, 4096);
    closeSync(fd);
  }
  assert.throws(() => verifyPlatformDatabase(corrupt), 'a corrupted platform file fails integrity_check');
  checks++;

  // ── Restore: validate before swap, keep the previous file ────────────────
  const drift = createPlatformDb(livePath);
  seedAccount(drift, 'acct-drift');
  assert.throws(() => restorePlatformDb({ from: second.path, dbPath: livePath, now: t1 }), error => error?.code === 'RESTORE_DATABASE_BUSY');
  checks++;
  closePlatformDb(drift);
  check(accountCount(livePath) === 4, 'live database drifted to 4 accounts before restore');
  const before = sha(livePath);
  assert.throws(() => restorePlatformDb({ from: corrupt, dbPath: livePath }), 'a corrupt backup is refused');
  checks++;
  assert.throws(() => restorePlatformDb({ from: foreign, dbPath: livePath }), error => error?.code === 'DB_NOT_PLATFORM');
  checks++;
  assert.throws(() => restorePlatformDb({ from: join(scratch, 'nope.db'), dbPath: livePath }), error => error?.code === 'RESTORE_SOURCE_MISSING');
  checks++;
  assert.throws(() => restorePlatformDb({ from: livePath, dbPath: livePath }), error => error?.code === 'RESTORE_SOURCE_IS_TARGET');
  checks++;
  check(sha(livePath) === before && readdirSync(dirname(livePath)).every(name => !name.includes('.restore-')), 'a refused restore leaves the live database untouched and no staging file behind');
  const restored = restorePlatformDb({ from: second.path, dbPath: livePath, now: new Date('2026-09-09T00:00:00Z') });
  check(restored.ok === true && restored.integrity === 'ok' && restored.accounts === 3 && restored.backup.accounts === 3, 'restore swaps in the verified backup');
  check(accountCount(livePath) === 3 && existsSync(restored.previous) && accountCount(restored.previous) === 4, 'the previous database is kept beside the restored one');
  check(restored.previous === `${livePath}.pre-restore-20260909T000000Z` && !existsSync(`${livePath}.restore-20260909T000000Z.tmp`), 'staging file is renamed away and the previous file is labelled');
  const served = createPlatformDb(livePath);
  check(served.prepare("SELECT value FROM platform_meta WHERE key='schema_version'").get().value === '6' && served.pragma('journal_mode', { simple: true }) === 'wal', 'the restored file opens under the platform in WAL mode');
  closePlatformDb(served);

  // ── CLI entry points ─────────────────────────────────────────────────────
  const cliBackup = JSON.parse(execFileSync(process.execPath, [join(serverRoot, 'tools', 'backup.mjs'), '--db', livePath, '--out', join(scratch, 'cli-backups')], { encoding: 'utf8' }));
  check(cliBackup.ok === true && cliBackup.accounts === 3 && existsSync(cliBackup.path), 'backup CLI prints a JSON receipt for a verified file');
  const cliTarget = join(scratch, 'cli-restore', 'platform.db');
  const cliRestore = JSON.parse(execFileSync(process.execPath, [join(serverRoot, 'tools', 'restore.mjs'), '--from', cliBackup.path, '--db', cliTarget], { encoding: 'utf8' }));
  check(cliRestore.ok === true && cliRestore.previous === null && accountCount(cliTarget) === 3, 'restore CLI can seed an empty volume');
  let cliFailure = null;
  try {
    execFileSync(process.execPath, [join(serverRoot, 'tools', 'restore.mjs'), '--from', garbage, '--db', livePath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) { cliFailure = error; }
  check(cliFailure?.status === 1 && /"ok":false/.test(String(cliFailure?.stderr || '')), 'restore CLI exits non-zero with a JSON error on an invalid backup');
  check(accountCount(livePath) === 3, 'a failed CLI restore leaves the live database untouched');

  // ── Graceful shutdown of the real server process ─────────────────────────
  for (const signal of ['SIGTERM', 'SIGINT']) {
    const serverDb = join(scratch, `shutdown-${signal}`, 'platform.db');
    const result = await runServerAndSignal(serverDb, signal);
    check(result.code === 0, `${signal}: process exits 0 (got code ${result.code}, signal ${result.signal})\n${result.stderr}`);
    check(/platform_shutdown/.test(result.stdout) && /platform_db_closed/.test(result.stdout), `${signal}: shutdown checkpoints and closes the platform db`);
    check(result.walBeforeSignal > 0, `${signal}: the WAL held committed rows before the signal`);
    check(!existsSync(`${serverDb}-wal`) || statSync(`${serverDb}-wal`).size === 0, `${signal}: no WAL content is left behind`);
    const verified = verifyPlatformDatabase(serverDb);
    check(verified.integrity === 'ok' && verified.accounts === 1, `${signal}: the account registered before the signal survived in the main file`);
  }

  console.log(`PLATFORM DB OPERATIONS: PASS — ${checks}/${checks} checks — WAL+NORMAL, checkpoint-and-close, v3->v4 column migrations, VACUUM INTO backups gated by integrity_check, validate-before-swap restore, CLI receipts and SIGTERM/SIGINT shutdown of server/index.js hold.`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
  if (previousEnv.PRI_PLATFORM_DB === undefined) delete process.env.PRI_PLATFORM_DB;
  else process.env.PRI_PLATFORM_DB = previousEnv.PRI_PLATFORM_DB;
}
