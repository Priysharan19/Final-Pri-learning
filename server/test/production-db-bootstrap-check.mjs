import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dbModule = new URL('../platform/db.js', import.meta.url).href;

function importDb(cwd, databasePath) {
  const env = { ...process.env, NODE_ENV: 'production', PRI_PLATFORM_DB: databasePath };
  const source = `import(${JSON.stringify(dbModule)});`;
  return spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd,
    env,
    encoding: 'utf8'
  });
}

const unsafeCwd = mkdtempSync(join(tmpdir(), 'pri-db-unsafe-'));
try {
  const unsafe = importDb(unsafeCwd, 'relative-platform.db');
  assert.notEqual(unsafe.status, 0, 'production import must fail before opening a relative database');
  assert.match(`${unsafe.stdout}\n${unsafe.stderr}`, /absolute|persistent/i);
  assert.equal(existsSync(join(unsafeCwd, 'relative-platform.db')), false,
    'invalid production storage must not create an ephemeral SQLite file before config validation');
} finally {
  rmSync(unsafeCwd, { recursive: true, force: true });
}

const safeCwd = mkdtempSync(join(tmpdir(), 'pri-db-safe-'));
try {
  const safePath = join(safeCwd, 'data', 'platform.db');
  mkdirSync(dirname(safePath), { recursive: true });
  const safe = importDb(safeCwd, safePath);
  assert.equal(safe.status, 0, `absolute production DB import failed:\n${safe.stdout}\n${safe.stderr}`);
  assert.equal(existsSync(safePath), true, 'validated absolute production storage should open normally');
} finally {
  rmSync(safeCwd, { recursive: true, force: true });
}

console.log('PASS — production validates PRI_PLATFORM_DB before SQLite can create a file.');
