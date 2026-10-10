// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · recognition cost measurement — launcher
//
// EVIDENCE CLASS: real provider, real localhost HTTP server, SIMULATED
// handwriting. Not staging, not production, not a physical device, not a student.
//
//   cd <a directory linked to the Railway project>
//   railway run --service pri-learning-staging --environment staging -- \
//     node <this checkout>/tools/acceptance/launch-recognition-cost.mjs
//
// Same rules as launch.mjs, which this follows line for line where it can:
//   • one real `node server/index.js` on localhost with a CLEAN environment:
//     PATH, HOME, the PRI_HANDWRITING_* variables, a temp SQLite file, a local
//     delivery key generated for this run. No database URL, Supabase, Resend,
//     billing, session or CSRF variable is passed;
//   • the measuring script runs in a second clean child WITHOUT the credential;
//   • no variable value is printed or written; all child output is scrubbed;
//   • the local server's own spend ceiling is 25 paid calls for the hour and
//     the day, so this run CANNOT make a 26th provider call whatever the
//     script does. With no credential it exits 2 and runs nothing.
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
export const PROVIDER_CALL_CAP = 25;

const providerEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name, value]) => name.startsWith('PRI_HANDWRITING_') && String(value ?? '') !== '')
);
const providerNames = Object.keys(providerEnv).sort();
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
  say('Run under `railway run --service pri-learning-staging --environment staging -- node tools/acceptance/launch-recognition-cost.mjs`.');
  say('No mock was substituted. Nothing was run.');
  process.exit(2);
}
if (process.argv.includes('--preflight')) {
  say(`preflight: provider credential present; provider variable NAMES passed to the local server: ${providerNames.join(', ')}`);
  process.exit(0);
}

const outDir = resolve(process.env.PRI_ACCEPT_OUT || mkdtempSync(join(tmpdir(), 'pri-recognition-cost-')));
mkdirSync(outDir, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), 'pri-recognition-cost-db-'));
const localDeliveryKey = randomBytes(32).toString('hex');
const base = { PATH: process.env.PATH || '', HOME: process.env.HOME || '' };

const freePort = () => new Promise((resolvePort, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolvePort(port)); });
});
const children = [];
function pipeScrubbed(child, sink) {
  for (const stream of [child.stdout, child.stderr]) {
    let carry = '';
    stream.setEncoding('utf8');
    stream.on('data', chunk => {
      carry += chunk;
      const lines = carry.split('\n');
      carry = lines.pop();
      for (const line of lines) sink(scrub(line) + '\n');
    });
    stream.on('end', () => { if (carry) sink(scrub(carry) + '\n'); });
  }
}
const stopAll = () => { for (const child of children) { try { child.kill('SIGTERM'); } catch { /* gone */ } } };
process.on('SIGINT', () => { stopAll(); process.exit(130); });
process.on('SIGTERM', () => { stopAll(); process.exit(143); });

let exitCode = 1;
try {
  say('── Pri Learning recognition cost measurement ─ launcher');
  say(`provider variable NAMES passed to the local server (values never printed): ${providerNames.join(', ')}`);
  say('not passed: any database URL, Supabase, Resend, billing, Twilio, session or CSRF variable');
  const port = await freePort();
  const dbPath = join(dataDir, 'cost.db');
  const log = createWriteStream(join(outDir, 'server-cost.log'));
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: REPO,
    env: {
      ...base, ...providerEnv,
      NODE_ENV: 'development', PORT: String(port), PRI_PLATFORM_DB: dbPath, PRI_AUTH_DELIVERY_KEY: localDeliveryKey,
      // The hard cap on what this run can spend with the provider.
      PRI_PAID_CALLS_PER_HOUR: String(PROVIDER_CALL_CAP), PRI_PAID_CALLS_PER_DAY: String(PROVIDER_CALL_CAP)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  children.push(server);
  pipeScrubbed(server, text => log.write(text));
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (server.exitCode !== null) throw new Error(`server exited during boot with code ${server.exitCode} (see server-cost.log)`);
    try { if ((await fetch(`${origin}/v1/health`)).ok) break; } catch { /* not listening yet */ }
    if (Date.now() > deadline) throw new Error('server did not become healthy within 60 s');
    await new Promise(r => setTimeout(r, 250));
  }
  say(`local server ${origin}  SQLite temp file  pid ${server.pid}  paid-call ceiling ${PROVIDER_CALL_CAP}/hour and /day`);
  say(`output directory ${outDir}`);
  const runner = spawn(process.execPath, [join(HERE, 'recognition-cost.mjs')], {
    cwd: REPO,
    // The measuring script never holds the provider credential.
    env: { ...base, PRI_ACCEPT_BASE: origin, PRI_ACCEPT_DB: dbPath, PRI_ACCEPT_OUT: outDir, PRI_AUTH_DELIVERY_KEY: localDeliveryKey, PRI_ACCEPT_CALL_CAP: String(PROVIDER_CALL_CAP) },
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
await new Promise(r => setTimeout(r, 800));
process.exit(exitCode);
