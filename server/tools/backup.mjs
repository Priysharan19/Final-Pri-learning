#!/usr/bin/env node
// Pri Learning platform database backup.
//
//   node server/tools/backup.mjs [--db /data/pri-learning-platform.db] [--out /data/backups] [--keep 14]
//
// Produces a timestamped, self-contained copy of the SQLite platform database
// with `VACUUM INTO` (transactionally consistent even while the server is
// serving traffic) and refuses to keep a copy that fails `integrity_check`.
// Never imports server/platform/db.js: that module opens the live database.
import Database from 'better-sqlite3';
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DB_PATH = join(here, '..', 'data', 'pri-learning-platform.db');
export const BACKUP_PREFIX = 'pri-learning-platform-';
const BACKUP_NAME = /^pri-learning-platform-\d{8}T\d{6}Z\.db$/;

function toolError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

export function timestampLabel(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Open a database file read-only and prove it is a healthy Pri platform DB:
 * integrity_check == ok, no dangling foreign keys, platform_meta present.
 */
export function verifyPlatformDatabase(path) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const integrity = db.pragma('integrity_check').map(row => row.integrity_check);
    if (integrity.length !== 1 || integrity[0] !== 'ok') {
      throw toolError('DB_INTEGRITY_FAILED', `integrity_check failed for ${path}`, { integrity: integrity.slice(0, 10) });
    }
    const foreignKeys = db.pragma('foreign_key_check');
    if (foreignKeys.length) throw toolError('DB_FOREIGN_KEYS_INVALID', `foreign_key_check reported ${foreignKeys.length} violation(s) in ${path}`);
    let meta;
    try {
      meta = Object.fromEntries(db.prepare('SELECT key,value FROM platform_meta').all().map(row => [row.key, row.value]));
    } catch {
      throw toolError('DB_NOT_PLATFORM', `${path} is not a Pri Learning platform database (no platform_meta table)`);
    }
    if (!meta.schema_version) throw toolError('DB_NOT_PLATFORM', `${path} has no platform schema_version`);
    const tables = Number(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get()?.n || 0);
    const accounts = Number(db.prepare('SELECT COUNT(*) AS n FROM accounts').get()?.n || 0);
    return {
      integrity: 'ok',
      schemaVersion: meta.schema_version,
      billingSchemaVersion: meta.billing_schema_version || null,
      tables,
      accounts
    };
  } finally {
    db.close();
  }
}

function pruneBackups(dir, keep) {
  const names = readdirSync(dir).filter(name => BACKUP_NAME.test(name)).sort();
  const excess = Math.max(0, names.length - keep);
  const removed = names.slice(0, excess);
  for (const name of removed) rmSync(join(dir, name), { force: true });
  return removed.map(name => join(dir, name));
}

export function backupPlatformDb({
  dbPath = process.env.PRI_PLATFORM_DB || DEFAULT_DB_PATH,
  outDir = null,
  now = new Date(),
  keep = 0
} = {}) {
  const source = resolve(String(dbPath));
  if (!existsSync(source)) throw toolError('BACKUP_SOURCE_MISSING', `platform database not found: ${source}`);
  const dir = resolve(outDir ? String(outDir) : join(dirname(source), 'backups'));
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const target = join(dir, `${BACKUP_PREFIX}${timestampLabel(now)}.db`);
  if (existsSync(target)) throw toolError('BACKUP_TARGET_EXISTS', `backup already exists: ${target}`);

  // VACUUM INTO reads inside one read transaction, so a running server can keep
  // committing; the copy is a consistent snapshot with the WAL folded in.
  const live = new Database(source, { fileMustExist: true });
  try {
    live.pragma('busy_timeout = 15000');
    live.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  } finally {
    live.close();
  }

  let verified;
  try {
    chmodSync(target, 0o600);
    verified = verifyPlatformDatabase(target);
  } catch (error) {
    rmSync(target, { force: true });
    throw error;
  }
  const pruned = Number.isInteger(keep) && keep > 0 ? pruneBackups(dir, keep) : [];
  return { ok: true, path: target, bytes: statSync(target).size, ...verified, pruned };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--db') options.dbPath = argv[++index];
    else if (arg === '--out') options.outDir = argv[++index];
    else if (arg === '--keep') options.keep = Number(argv[++index]);
    else throw toolError('USAGE', `unknown argument ${arg}`);
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = backupPlatformDb(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: error?.code || 'BACKUP_FAILED', message: error?.message || String(error) }));
    process.exit(1);
  }
}
