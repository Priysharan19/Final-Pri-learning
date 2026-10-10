// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · auth email acceptance — launcher
//
// Run under the Railway CLI so the real email credential is injected into THIS
// process only:
//
//   cd ~/Developer/Final-Pri-learning
//   railway run --service Final-Pri-learning --environment production -- \
//     node <this checkout>/tools/acceptance/launch-auth-email.mjs
//
// What this file does with that environment:
//
//   • It boots real Pri server processes (`node server/index.js`) on localhost
//     with a CLEAN child environment: PATH, HOME, the three auth-email
//     variables copied from its own environment (PRI_AUTH_EMAIL_PROVIDER,
//     PRI_RESEND_API_KEY, PRI_AUTH_EMAIL_FROM) and local-only settings (a temp
//     SQLite file, a freshly generated PRI_AUTH_DELIVERY_KEY, PRI_PUBLIC_ORIGIN
//     set to the localhost origin). NOTHING else is passed through: no database
//     URL, no Supabase, session, CSRF, handwriting, billing or SMS variable.
//     The production database is unreachable because no child ever learns
//     where it is.
//   • A second server gets a deliberately INVALID key (generated here), for the
//     "what does a broken credential look like" drill.
//   • It runs auth-email.mjs in a clean child. That child DOES receive the
//     email key, because the only way to read a message sent to Resend's test
//     sink is Resend's own API. It receives nothing else from Railway.
//   • It never prints, logs or writes a variable value. Every byte of child
//     output — to the terminal and to the server log files — passes through a
//     scrubber that removes the key, bearer tokens, cookies and the local part
//     of every email address.
//
// With no credential it stops with exit code 2. It never substitutes a mock.
// It never runs `railway variables`.
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

// ── The only variables that may cross into a child ───────────────────────────
const PASSED = ['PRI_AUTH_EMAIL_PROVIDER', 'PRI_RESEND_API_KEY', 'PRI_AUTH_EMAIL_FROM'];
const emailEnv = Object.fromEntries(PASSED.map(name => [name, String(process.env[name] ?? '').trim()]).filter(([, value]) => value !== ''));
const realKey = emailEnv.PRI_RESEND_API_KEY || '';
// Shaped like a key, generated here, known to no provider.
const invalidKey = ['re', 'acceptance', 'invalid', randomBytes(12).toString('hex')].join('_');

/** The sender this run expects; an address of the service itself, not of a person. */
const EXPECTED_SENDER = process.env.PRI_ACCEPT_EXPECT_SENDER || 'verify@mail.prilearning.com';

const secrets = [realKey].filter(value => value.length >= 8);
function scrub(text) {
  let out = String(text);
  for (const secret of secrets) out = out.split(secret).join('[REDACTED-CREDENTIAL]');
  return out
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g, 'Bearer [REDACTED]')
    .replace(/\bre_[A-Za-z0-9_-]{8,}/g, '[REDACTED-KEY-SHAPE]')
    .replace(/\b(pri_[a-z_]+)=[^;\s"']+/g, '$1=[REDACTED]')
    // Every address loses its local part, except the service's own sender.
    .replace(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g, (whole, domain) => (whole.toLowerCase() === EXPECTED_SENDER.toLowerCase() ? whole : `***@${domain}`));
}
const say = line => process.stdout.write(scrub(line) + '\n');

if ((emailEnv.PRI_AUTH_EMAIL_PROVIDER || '').toLowerCase() !== 'resend' || !realKey || !emailEnv.PRI_AUTH_EMAIL_FROM) {
  const missing = PASSED.filter(name => !emailEnv[name]);
  say(`DEPENDENCY MISSING: ${missing.length ? missing.join(', ') + ' not present' : 'PRI_AUTH_EMAIL_PROVIDER is not "resend"'} in this process environment.`);
  say('Run this launcher under `railway run --service Final-Pri-learning --environment production -- node tools/acceptance/launch-auth-email.mjs`.');
  say('No mock was substituted. Nothing was run. Nothing was sent.');
  process.exit(2);
}
if (process.argv.includes('--preflight')) {
  say(`preflight: auth email credential present; variable NAMES passed to the local servers (values never printed): ${PASSED.join(', ')}`);
  process.exit(0);
}

const outDir = resolve(process.env.PRI_ACCEPT_OUT || mkdtempSync(join(tmpdir(), 'pri-auth-email-')));
mkdirSync(outDir, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), 'pri-auth-email-db-'));
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

async function bootServer(label, key) {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const logPath = join(outDir, `server-${label}.log`);
  const env = {
    ...base,
    NODE_ENV: 'development',
    PORT: String(port),
    PRI_PLATFORM_DB: join(dataDir, `${label}.db`),
    // Local to this run's temp database; never the deployed service's key.
    PRI_AUTH_DELIVERY_KEY: randomBytes(32).toString('hex'),
    PRI_PUBLIC_ORIGIN: origin,
    // The link-email worker polls at its fastest allowed interval.
    PRI_AUTH_EMAIL_POLL_MS: '5000',
    PRI_AUTH_EMAIL_PROVIDER: emailEnv.PRI_AUTH_EMAIL_PROVIDER,
    PRI_AUTH_EMAIL_FROM: emailEnv.PRI_AUTH_EMAIL_FROM,
    PRI_RESEND_API_KEY: key
  };
  const log = createWriteStream(logPath);
  const child = spawn(process.execPath, ['server/index.js'], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  pipeScrubbed(child, text => log.write(text));
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
  return { origin, logPath, pid: child.pid };
}

function stopAll() {
  for (const child of children) { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
}
process.on('SIGINT', () => { stopAll(); process.exit(130); });
process.on('SIGTERM', () => { stopAll(); process.exit(143); });

let exitCode = 1;
try {
  say('── Pri Learning auth email acceptance ─ launcher');
  say(`variable NAMES passed to the local servers (values never printed): ${PASSED.join(', ')}`);
  say('not passed: any database URL, Supabase, session, CSRF, handwriting, billing or SMS variable');
  const main = await bootServer('main', realKey);
  const broken = await bootServer('invalid-key', invalidKey);
  say(`local server (main)         ${main.origin}  temp SQLite  pid ${main.pid}  real Resend key`);
  say(`local server (invalid key)  ${broken.origin}  temp SQLite  pid ${broken.pid}  key generated by this launcher, known to no provider`);
  say(`output directory            ${outDir}`);

  const runner = spawn(process.execPath, [join(HERE, 'auth-email.mjs')], {
    cwd: REPO,
    env: {
      ...base,
      PRI_ACCEPT_BASE: main.origin,
      PRI_ACCEPT_INVALID_BASE: broken.origin,
      PRI_ACCEPT_INVALID_LOG: broken.logPath,
      PRI_ACCEPT_MAIN_LOG: main.logPath,
      PRI_ACCEPT_OUT: outDir,
      PRI_ACCEPT_EXPECT_SENDER: EXPECTED_SENDER,
      // Needed to read the messages back from Resend's test sink. Nothing else.
      PRI_RESEND_API_KEY: realKey,
      PRI_AUTH_EMAIL_FROM: emailEnv.PRI_AUTH_EMAIL_FROM
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
await new Promise(r => setTimeout(r, 800));
process.exit(exitCode);
