#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · run a command against a throwaway Postgres
//
//   node scripts/with-postgres.mjs <command> [args…]
//
// The command runs with PRI_TEST_PG_ADMIN_URL set to a superuser connection on
// a Postgres that exists only for this run. The Postgres suites create their
// own scratch databases inside it, apply supabase/migrations, and drop them.
//
// Where the server comes from:
//   · PRI_TEST_PG_ADMIN_URL already set (CI's `services: postgres` container):
//     used as is; nothing is started or stopped here.
//   · otherwise a local cluster is created with initdb in a temporary directory,
//     started with pg_ctl on a free loopback port with trust authentication,
//     and stopped and deleted when the command exits — pass or fail.
//
// No credential is created, read or printed: the local cluster trusts loopback
// connections and is gone when the run ends. Nothing here can reach Supabase.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const say = line => process.stderr.write(`[with-postgres] ${line}\n`);
const [command, ...args] = process.argv.slice(2);
if (!command) {
  say('usage: node scripts/with-postgres.mjs <command> [args…]');
  process.exit(2);
}

function findBinary(name) {
  const candidates = [];
  if (process.env.PG_BIN) candidates.push(join(process.env.PG_BIN, name));
  for (const dir of String(process.env.PATH || '').split(':')) if (dir) candidates.push(join(dir, name));
  for (const version of ['17', '16', '18']) {
    candidates.push(`/opt/homebrew/opt/postgresql@${version}/bin/${name}`);
    candidates.push(`/usr/local/opt/postgresql@${version}/bin/${name}`);
    candidates.push(`/usr/lib/postgresql/${version}/bin/${name}`);
  }
  if (existsSync('/usr/lib/postgresql')) {
    for (const version of readdirSync('/usr/lib/postgresql').sort().reverse()) candidates.push(`/usr/lib/postgresql/${version}/bin/${name}`);
  }
  return candidates.find(path => existsSync(path)) || null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function run(cmd, cmdArgs, env) {
  return new Promise(resolve => {
    const child = spawn(cmd, cmdArgs, { stdio: 'inherit', env, shell: false });
    const forward = signal => child.kill(signal);
    process.on('SIGINT', forward);
    process.on('SIGTERM', forward);
    child.on('exit', (code, signal) => {
      process.off('SIGINT', forward);
      process.off('SIGTERM', forward);
      resolve(code ?? (signal ? 1 : 0));
    });
    child.on('error', error => { say(`could not start ${cmd}: ${error.message}`); resolve(1); });
  });
}

async function main() {
  if (process.env.PRI_TEST_PG_ADMIN_URL) {
    say('using the Postgres named by PRI_TEST_PG_ADMIN_URL');
    return run(command, args, process.env);
  }

  const initdb = findBinary('initdb');
  const pgCtl = findBinary('pg_ctl');
  if (!initdb || !pgCtl) {
    say('initdb/pg_ctl not found. Install PostgreSQL 16+ (e.g. `brew install postgresql@17`) or set PRI_TEST_PG_ADMIN_URL.');
    return 1;
  }

  // A valid locale in the server's environment: on macOS the postmaster refuses
  // to start ("became multithreaded during startup") without one.
  const pgEnv = { ...process.env, LC_ALL: 'C', LANG: 'C' };
  const dir = mkdtempSync(join(tmpdir(), 'pri-pg-'));
  const data = join(dir, 'data');
  const port = await freePort();
  let started = false;
  const cleanup = () => {
    if (started) spawnSync(pgCtl, ['-D', data, '-m', 'immediate', 'stop'], { stdio: 'ignore' });
    started = false;
    rmSync(dir, { recursive: true, force: true });
  };
  process.on('exit', cleanup);

  try {
    const init = spawnSync(initdb, ['-D', data, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync'], { encoding: 'utf8', env: pgEnv });
    if (init.status !== 0) {
      say(`initdb failed:\n${init.stderr || init.stdout}`);
      return 1;
    }
    // TCP on loopback only; no Unix socket (temp paths can exceed its length limit).
    const options = `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories='' -c fsync=off -c max_connections=100`;
    const start = spawnSync(pgCtl, ['-D', data, '-o', options, '-l', join(dir, 'postgres.log'), '-w', '-t', '60', 'start'], { encoding: 'utf8', env: pgEnv });
    if (start.status !== 0) {
      let log = '';
      try { log = readFileSync(join(dir, 'postgres.log'), 'utf8').slice(-2000); } catch {}
      say(`pg_ctl start failed:\n${start.stderr || start.stdout}\n${log}`);
      return 1;
    }
    started = true;
    say(`throwaway Postgres on 127.0.0.1:${port}`);
    return await run(command, args, { ...process.env, PRI_TEST_PG_ADMIN_URL: `postgres://postgres@127.0.0.1:${port}/postgres` });
  } finally {
    cleanup();
  }
}

process.exitCode = await main();
