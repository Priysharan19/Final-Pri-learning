#!/usr/bin/env node
// Pri Learning platform database restore.
//
//   node server/tools/restore.mjs --from /data/backups/pri-learning-platform-20260906T101500Z.db \
//        [--db /data/pri-learning-platform.db] [--force]
//
// Stop the server first. The backup is validated (integrity_check, foreign
// keys, platform_meta) BEFORE anything is touched, copied next to the live
// database, validated again, and only then swapped in with atomic renames. The
// previous database and its WAL/SHM sidecars are kept as *.pre-restore-<ts>.
import { chmodSync, copyFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DB_PATH, timestampLabel, verifyPlatformDatabase } from './backup.mjs';

function toolError(code, message) {
  return Object.assign(new Error(message), { code });
}

export function restorePlatformDb({
  from,
  dbPath = process.env.PRI_PLATFORM_DB || DEFAULT_DB_PATH,
  now = new Date(),
  force = false
} = {}) {
  if (!from) throw toolError('USAGE', '--from <backup.db> is required');
  const backup = resolve(String(from));
  const target = resolve(String(dbPath));
  if (!existsSync(backup)) throw toolError('RESTORE_SOURCE_MISSING', `backup not found: ${backup}`);
  if (backup === target) throw toolError('RESTORE_SOURCE_IS_TARGET', 'the backup and the live database are the same file');

  // A non-empty WAL means either a running server or an unclean shutdown; both
  // must be resolved by a human before the file underneath is replaced.
  const wal = `${target}-wal`;
  if (!force && existsSync(wal) && statSync(wal).size > 0) {
    throw toolError('RESTORE_DATABASE_BUSY', `${wal} is not empty: stop the server (SIGTERM checkpoints and removes it) or pass --force`);
  }

  const before = verifyPlatformDatabase(backup);
  const label = timestampLabel(now);
  const staging = `${target}.restore-${label}.tmp`;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(backup, staging);
  chmodSync(staging, 0o600);
  try {
    verifyPlatformDatabase(staging);
  } catch (error) {
    rmSync(staging, { force: true });
    throw error;
  }

  let previous = null;
  if (existsSync(target)) {
    previous = `${target}.pre-restore-${label}`;
    renameSync(target, previous);
    for (const suffix of ['-wal', '-shm']) {
      if (existsSync(`${target}${suffix}`)) renameSync(`${target}${suffix}`, `${previous}${suffix}`);
    }
  } else {
    for (const suffix of ['-wal', '-shm']) rmSync(`${target}${suffix}`, { force: true });
  }
  renameSync(staging, target);
  const after = verifyPlatformDatabase(target);
  return { ok: true, path: target, restoredFrom: backup, previous, backup: before, ...after };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--from') options.from = argv[++index];
    else if (arg === '--db') options.dbPath = argv[++index];
    else if (arg === '--force') options.force = true;
    else throw toolError('USAGE', `unknown argument ${arg}`);
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = restorePlatformDb(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: error?.code || 'RESTORE_FAILED', message: error?.message || String(error) }));
    process.exit(1);
  }
}
