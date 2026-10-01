// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the server fails closed on a bad PRI_DATABASE_URL and never
// leaks it (ADR-0001 phase 2)
//
//   node server/test/platform-startup-check.mjs                    → no database server needed
//   node server/test/platform-startup-check.mjs --engine=postgres  → also boots on a real Postgres
//
// `node server/index.js` is started as a real process. In production, a
// PRI_DATABASE_URL that is malformed, unreachable or names an unmigrated
// database must stop the process with a coded error before it listens, and
// must never fall back to SQLite. Nothing the process prints may contain the
// URL's password, user or host. On a migrated Postgres it boots, /v1/health
// names the engine — and only the engine — and SIGTERM drains the pool.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestedEngine } from './support/engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..');
const engine = requestedEngine();
let checks = 0;
const ok = (cond, label) => { assert.ok(cond, label); checks++; };
const eq = (a, b, label) => { assert.equal(a, b, label); checks++; };

const SECRET = 'S3cretPassw0rdNeverLogged';
const productionEnv = (extra) => {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '0',
    PRI_PUBLIC_ORIGIN: 'https://learn.pri.example',
    PRI_CSRF_SECRET: 'startup-check-csrf',
    PRI_AUTH_DELIVERY_KEY: '55'.repeat(32),
    PRI_TRUSTED_PROXY_HOPS: '1',
    ...extra
  };
  delete env.PRI_PLATFORM_DB;
  return env;
};

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
  });
}

function run(env, { untilListening = false, timeoutMs = 20_000 } = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [join(serverRoot, 'index.js')], { cwd: serverRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result) => { if (!settled) { settled = true; clearTimeout(timer); resolve({ child, stdout, stderr, ...result }); } };
    child.stdout.on('data', chunk => {
      stdout += chunk;
      const port = stdout.match(/running on port (\d+)/);
      if (untilListening && port) finish({ listening: true, port: Number(port[1]) });
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('exit', (code, signal) => finish({ code, signal, listening: false }));
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish({ timedOut: true }); }, timeoutMs);
  });
}

const leaks = (text, ...secrets) => secrets.filter(s => s && text.includes(s));
const sqliteFile = join(mkdtempSync(join(tmpdir(), 'pri-startup-')), 'must-not-exist.db');

try {
  // ── 1 · Malformed URL ─────────────────────────────────────────────────────
  for (const bad of [`mysql://pri:${SECRET}@db.internal:3306/pri`, 'not a url', `postgres://pri:${SECRET}@/nohost`]) {
    const result = await run(productionEnv({ PRI_DATABASE_URL: bad, PRI_PLATFORM_DB: sqliteFile }));
    eq(result.code, 1, `a malformed PRI_DATABASE_URL stops the process (${bad.split(':')[0]})`);
    ok(/platform_db_unavailable \{"code":"PLATFORM_DB_URL_INVALID"\}/.test(result.stderr), `with the coded error PLATFORM_DB_URL_INVALID (${result.stderr.trim().slice(0, 120)})`);
    eq(leaks(result.stdout + result.stderr, SECRET, 'db.internal').length, 0, 'and prints nothing of the URL');
    ok(!/running on port/.test(result.stdout), 'it never listens');
  }
  ok(!existsSync(sqliteFile), 'and never falls back to opening a SQLite file');

  // ── 2 · Unreachable database ──────────────────────────────────────────────
  const closedPort = await freePort();
  const unreachable = await run(productionEnv({ PRI_DATABASE_URL: `postgres://pri_app:${SECRET}@127.0.0.1:${closedPort}/pri` }));
  eq(unreachable.code, 1, 'an unreachable Postgres stops the process');
  ok(/platform_db_unavailable \{"code":"PLATFORM_DB_UNAVAILABLE"\}/.test(unreachable.stderr), `with the coded error PLATFORM_DB_UNAVAILABLE (${unreachable.stderr.trim().slice(0, 120)})`);
  eq(leaks(unreachable.stdout + unreachable.stderr, SECRET, 'pri_app', String(closedPort)).length, 0, 'and prints neither the password, the user nor the address');

  if (engine === 'postgres') {
    const { pgModule, adminUrl, scratchDatabase, serverRoleUrl } = await import('./support/postgres.mjs');

    // ── 3 · Reachable but not migrated ─────────────────────────────────────
    const pg = await pgModule();
    const admin = new pg.Client({ connectionString: adminUrl() });
    await admin.connect();
    const empty = `pri_startup_empty_${process.pid}`;
    await admin.query(`CREATE DATABASE ${empty}`);
    try {
      const emptyUrl = new URL(adminUrl());
      emptyUrl.pathname = `/${empty}`;
      const unmigrated = await run(productionEnv({ PRI_DATABASE_URL: emptyUrl.toString() }));
      eq(unmigrated.code, 1, 'a reachable but unmigrated Postgres stops the process');
      ok(/platform_db_unavailable \{"code":"PLATFORM_DB_NOT_MIGRATED"\}/.test(unmigrated.stderr), `with the coded error PLATFORM_DB_NOT_MIGRATED (${unmigrated.stderr.trim().slice(0, 120)})`);
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS ${empty} WITH (FORCE)`);
      await admin.end();
    }

    // ── 4 · Migrated: boots, reports only the engine, shuts down cleanly ────
    const scratch = await scratchDatabase('startup');
    try {
      const url = await serverRoleUrl(scratch.name);
      const parsed = new URL(url);
      const env = { ...process.env, PORT: '0', PRI_DATABASE_URL: url, PRI_AUTH_DELIVERY_KEY: '55'.repeat(32) };
      delete env.NODE_ENV;
      delete env.PRI_PLATFORM_DB;
      const booted = await run(env, { untilListening: true });
      ok(booted.listening, `the server boots on a migrated Postgres (${(booted.stderr || '').trim().slice(0, 160)})`);
      try {
        const response = await fetch(`http://127.0.0.1:${booted.port}/v1/health`);
        const text = await response.text();
        const health = JSON.parse(text);
        eq(response.status, 200, 'health responds');
        eq(health.database?.engine, 'postgres', '/v1/health reports database.engine = postgres');
        eq(health.schemaVersion, '6', 'and the migrated schema version');
        eq(leaks(text, parsed.username, parsed.hostname + ':' + parsed.port, scratch.name, 'postgres://').length, 0, 'health names no user, host, port, database or URL');
        ok(/platform_db_open \{ engine: 'postgres' \}/.test(booted.stdout), 'the boot log names only the engine');
        eq(leaks(booted.stdout + booted.stderr, parsed.username, scratch.name, 'postgres://').length, 0, 'and the logs carry nothing of the URL');
      } finally {
        const exited = new Promise(resolve => booted.child.on('exit', (code, signal) => resolve({ code, signal })));
        let out = '';
        booted.child.stdout.on('data', chunk => { out += chunk; });
        booted.child.kill('SIGTERM');
        const { code } = await exited;
        eq(code, 0, 'SIGTERM shuts the server down cleanly');
        ok(/platform_db_closed \{"reason":"drained","closed":true,"checkpoint":null\}/.test(out), `and drains the Postgres pool (${out.trim().slice(-120)})`);
      }
    } finally {
      await scratch.drop();
    }
  }

  console.log(`engine: ${engine}`);
  console.log(`PLATFORM STARTUP: PASS — ${checks}/${checks} checks — a malformed, unreachable${engine === 'postgres' ? ' or unmigrated' : ''} PRI_DATABASE_URL fails closed with a coded error and leaks nothing${engine === 'postgres' ? '; a migrated Postgres boots, reports only its engine and drains on SIGTERM' : ''}.`);
} finally {
  rmSync(dirname(sqliteFile), { recursive: true, force: true });
}
