// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · flagship handwriting acceptance — launcher
//
// Run under the Railway CLI so the real provider credential is injected into
// THIS process only:
//
//   railway run --service pri-learning-staging --environment staging -- \
//     node tools/acceptance/launch.mjs
//
// What this file does with that environment:
//
//   • It boots real Pri server processes (`node server/index.js`) on localhost
//     with a CLEAN child environment: PATH, HOME, the PRI_HANDWRITING_*
//     variables copied from its own environment, and local-only settings (a
//     temp SQLite file, a freshly generated local delivery key, a small spend
//     ceiling). Nothing else is passed through: no database URL, no Supabase,
//     Resend, billing, Twilio, session or CSRF secret. The staging database is
//     never reachable from the child because the child never learns where it is.
//   • It runs the acceptance script (flagship-handwriting.mjs) in a second
//     clean child that does NOT receive the provider credential at all.
//   • It never prints, logs or writes a variable value. Every byte of child
//     output is passed through a scrubber that replaces the credential (and
//     anything shaped like a bearer token) before it reaches a terminal or the
//     server log file.
//
// If the provider credential is not present it stops with exit code 2 and says
// so. It never substitutes a mock.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
// Which acceptance script this launcher runs. launch-real-photo.mjs sets this
// before importing the launcher; everything about the credential, the clean
// child environments and the scrubber is the same for every runner.
const RUNNER = Object.freeze({
  script: 'flagship-handwriting.mjs', title: 'flagship handwriting acceptance', passEnv: [],
  ...(globalThis.__PRI_ACCEPT_RUNNER__ || {})
});
if (!/^[a-z-]+\.mjs$/.test(RUNNER.script)) throw new Error('invalid acceptance runner');

// ── What may cross into a server child ───────────────────────────────────────
const PROVIDER_PREFIX = 'PRI_HANDWRITING_';
const providerEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name, value]) => name.startsWith(PROVIDER_PREFIX) && String(value ?? '') !== '')
);
const providerNames = Object.keys(providerEnv).sort();

// Values that must never appear in any output. Only credential-like values are
// treated as secret; a model name or a timeout is configuration, but it is
// still never printed by this file.
const secrets = [providerEnv.PRI_HANDWRITING_API_KEY].filter(v => typeof v === 'string' && v.length >= 8);
function scrub(text) {
  let out = String(text);
  for (const secret of secrets) out = out.split(secret).join('[REDACTED-CREDENTIAL]');
  return out
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}/g, '[REDACTED-KEY-SHAPE]');
}
const say = line => process.stdout.write(scrub(line) + '\n');

if (!providerEnv.PRI_HANDWRITING_API_KEY) {
  say('DEPENDENCY MISSING: PRI_HANDWRITING_API_KEY is not present in this process environment.');
  say('Run this launcher under `railway run --service pri-learning-staging --environment staging -- node tools/acceptance/<launcher>.mjs`.');
  say('No mock was substituted. Nothing was run.');
  process.exit(2);
}
if (process.argv.includes('--preflight')) {
  // Names only. Never a value.
  say(`preflight: provider credential present; provider variable NAMES passed to the local server: ${providerNames.join(', ')}`);
  process.exit(0);
}

const outDir = resolve(process.env.PRI_ACCEPT_OUT || mkdtempSync(join(tmpdir(), 'pri-flagship-')));
mkdirSync(outDir, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), 'pri-flagship-db-'));
// A local key for THIS run's temp database only: it lets the acceptance script
// read the verification and guardian links the local server queued (exactly as
// server/test/support/app-harness.mjs does) and then use the server's own
// /v1/account/email/verify and /v1/account/guardian/confirm routes.
const localDeliveryKey = randomBytes(32).toString('hex');

const base = { PATH: process.env.PATH || '', HOME: process.env.HOME || '' };

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

const children = [];
function pipeScrubbed(child, sink, prefix = '') {
  for (const stream of [child.stdout, child.stderr]) {
    let carry = '';
    stream.setEncoding('utf8');
    stream.on('data', chunk => {
      carry += chunk;
      const lines = carry.split('\n');
      carry = lines.pop();
      for (const line of lines) sink(prefix + scrub(line) + '\n');
    });
    stream.on('end', () => { if (carry) sink(prefix + scrub(carry) + '\n'); });
  }
}

async function bootServer(label, { timeoutMs = null, paidCalls }) {
  const port = await freePort();
  const dbPath = join(dataDir, `${label}.db`);
  const env = {
    ...base,
    ...providerEnv,
    NODE_ENV: 'development',
    PORT: String(port),
    PRI_PLATFORM_DB: dbPath,
    PRI_AUTH_DELIVERY_KEY: localDeliveryKey,
    // A hard local ceiling on what this run can spend with the provider.
    PRI_PAID_CALLS_PER_HOUR: String(paidCalls),
    PRI_PAID_CALLS_PER_DAY: String(paidCalls)
  };
  if (timeoutMs !== null) env.PRI_HANDWRITING_TIMEOUT_MS = String(timeoutMs);
  const log = createWriteStream(join(outDir, `server-${label}.log`));
  const child = spawn(process.execPath, ['server/index.js'], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  pipeScrubbed(child, text => log.write(text));
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server ${label} exited during boot with code ${child.exitCode} (see server-${label}.log)`);
    try {
      const res = await fetch(`${origin}/v1/health`);
      if (res.ok) break;
    } catch { /* not listening yet */ }
    if (Date.now() > deadline) throw new Error(`server ${label} did not become healthy within 60 s`);
    await new Promise(r => setTimeout(r, 250));
  }
  return { origin, dbPath, pid: child.pid };
}

function stopAll() {
  for (const child of children) { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
}
process.on('SIGINT', () => { stopAll(); process.exit(130); });
process.on('SIGTERM', () => { stopAll(); process.exit(143); });

let exitCode = 1;
try {
  say(`── Pri Learning ${RUNNER.title} ─ launcher`);
  say(`provider variable NAMES passed to the local servers (values never printed): ${providerNames.join(', ')}`);
  say('not passed: any database URL, Supabase, Resend, billing, Twilio, session or CSRF variable');
  // Server A: the journey. Server B: identical, but the reading budget is the
  // smallest the provider adapter accepts, for the timeout drill.
  const main = await bootServer('main', { paidCalls: 70 });
  const slow = await bootServer('timeout', { timeoutMs: 2000, paidCalls: 6 });
  say(`local server (main)    ${main.origin}  SQLite temp file  pid ${main.pid}`);
  say(`local server (timeout) ${slow.origin}  SQLite temp file  pid ${slow.pid}  PRI_HANDWRITING_TIMEOUT_MS=2000`);
  say(`output directory       ${outDir}`);

  const runner = spawn(process.execPath, [join(HERE, RUNNER.script)], {
    cwd: REPO,
    env: {
      ...base,
      // Named, non-secret settings of the runner only (a fixture path, a read
      // count). Never a provider, database, session or billing variable.
      ...Object.fromEntries(RUNNER.passEnv.filter(name => /^PRI_ACCEPT_[A-Z_]+$/.test(name) && process.env[name]).map(name => [name, process.env[name]])),
      // The acceptance script never holds the provider credential.
      PRI_ACCEPT_BASE: main.origin,
      PRI_ACCEPT_DB: main.dbPath,
      PRI_ACCEPT_TIMEOUT_BASE: slow.origin,
      PRI_ACCEPT_TIMEOUT_DB: slow.dbPath,
      PRI_ACCEPT_OUT: outDir,
      PRI_AUTH_DELIVERY_KEY: localDeliveryKey,
      ...(process.env.PRI_ACCEPT_ISSUE_BOUND ? { PRI_ACCEPT_ISSUE_BOUND: process.env.PRI_ACCEPT_ISSUE_BOUND } : {}),
      ...(process.env.PRI_ACCEPT_SEED ? { PRI_ACCEPT_SEED: process.env.PRI_ACCEPT_SEED } : {})
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  children.push(runner);
  pipeScrubbed(runner, text => process.stdout.write(text));
  exitCode = await new Promise(resolveExit => runner.once('exit', code => resolveExit(code ?? 1)));
} catch (error) {
  say(`launcher failed: ${error?.message || 'unknown error'}`);
  exitCode = 1;
} finally {
  stopAll();
}
// Give the servers a moment to checkpoint and close their temp databases.
await new Promise(r => setTimeout(r, 800));
process.exit(exitCode);
