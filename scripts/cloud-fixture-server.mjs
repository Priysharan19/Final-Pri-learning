#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · real Pri server for the native cloud journeys (CP-05 iPhone, CP-07 Android)
//
// TEST HARNESS ONLY — never part of the server or the app. Starts the real
// server (server/index.js) on a throwaway SQLite database, creates one adult
// fixture account through the real /v1/account/register route, and marks its
// email verified directly in that throwaway database (verification tokens are
// only ever delivered by email, which a CI runner cannot read). Prints the
// instrumentation arguments for android/scripts/run-instrumented.sh.
//
//   node scripts/cloud-fixture-server.mjs [--port 4310] [--host 10.0.2.2|127.0.0.1] [--out fixture.env]
// --host is how the device reaches this machine: 10.0.2.2 from the Android
// emulator (the default), 127.0.0.1 from an iOS simulator.
// --db <file> --restart starts the server again on an existing fixture
// database (offline → reconnect journeys) without creating anything.
// --synthetic-reader starts the same real server through
// scripts/synthetic-reader-server.mjs: the handwriting reader (the one hop to
// the model) is a scripted stand-in, every other outbound request is refused.
// Evidence from such a run is SYNTHETIC-READER evidence, never real-provider.
// Email codes: the server runs its TEST email adapter (NODE_ENV=development,
// PRI_AUTH_EMAIL_PROVIDER unset — nothing is ever sent). That adapter keeps
// what it "sent" in the server process's memory; a harness-only preload
// (--import, below) copies each message to <dir>/test-outbox.jsonl (0600) so
// the journey's test desk (scripts/journey-oracle.mjs emailCode) can read the
// code the server really issued — the way the browser suites read
// platform.sms.readTestOutbox. Never part of the server or a deployment.
// The server keeps running (detached); its log is written next to the DB.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';
import { mkdtempSync, openSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const port = Number(arg('port') || 4310);
const deviceHost = arg('host') || '10.0.2.2';
if (!['10.0.2.2', '127.0.0.1', 'localhost'].includes(deviceHost)) { console.error('--host must be 10.0.2.2, 127.0.0.1 or localhost'); process.exit(2); }
const restart = process.argv.includes('--restart');
const dbPath = arg('db') || join(mkdtempSync(join(tmpdir(), 'pri-native-cloud-')), 'platform.db');
const dir = dirname(dbPath);
if (restart && !arg('db')) { console.error('--restart needs --db <file>'); process.exit(2); }
const log = openSync(join(dir, 'server.log'), 'a');

const syntheticReader = process.argv.includes('--synthetic-reader');
const readerLog = join(dir, 'synthetic-reader.jsonl');
const readerScript = join(dir, 'synthetic-reader-script.json');
// The stand-in reader's environment: a key that is not a provider key (the
// provider hop never leaves the process), a named synthetic model, and the
// paid-call ceiling the server requires whenever a reader is configured.
const readerEnv = syntheticReader ? {
  PRI_HANDWRITING_API_KEY: 'synthetic-reader-not-a-provider-key',
  PRI_HANDWRITING_MODEL: 'synthetic-reader',
  PRI_HANDWRITING_FALLBACK_MODEL: 'synthetic-reader',
  PRI_HANDWRITING_ENDPOINT: '', PRI_HANDWRITING_PROBE_ENDPOINT: '', PRI_HANDWRITING_CONFIDENCE_FLOOR: '',
  PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000',
  PRI_SYNTHETIC_READER_LOG: readerLog, PRI_SYNTHETIC_READER_SCRIPT: readerScript
} : {};
const outboxFile = join(dir, 'test-outbox.jsonl');
// Copies the test adapter's in-memory outbox to outboxFile, polling the same
// module instance the server imports (one ESM instance per URL).
const outboxTap = `data:text/javascript,${encodeURIComponent(`
import { readTestOutbox } from ${JSON.stringify(pathToFileURL(join(ROOT, 'server/platform/smsProvider.js')).href)};
import { appendFileSync, chmodSync, writeFileSync } from 'node:fs';
const file = ${JSON.stringify(outboxFile)};
if (process.env.NODE_ENV === 'production') throw new Error('test outbox tap refused under NODE_ENV=production');
writeFileSync(file, '', { flag: 'a', mode: 0o600 }); chmodSync(file, 0o600);
const seen = new Set();
setInterval(() => {
  for (const m of readTestOutbox()) {
    const key = [m.at, m.channel, m.to, m.purpose, m.code].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    appendFileSync(file, JSON.stringify({ at: m.at, channel: m.channel, to: m.to, purpose: m.purpose, code: m.code }) + '\\n');
  }
}, 150).unref();
`)}`;
const entry = syntheticReader ? join(ROOT, 'scripts/synthetic-reader-server.mjs') : join(ROOT, 'server/index.js');

const child = spawn(process.execPath, ['--import', outboxTap, entry], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(port), PRI_PLATFORM_DB: dbPath, NODE_ENV: 'development', PRI_DATABASE_URL: '', PRI_AUTH_EMAIL_PROVIDER: '', ...readerEnv },
  detached: true,
  stdio: ['ignore', log, log],
});
child.unref();

const base = `http://127.0.0.1:${port}`;
for (let i = 0; ; i++) {
  try { if ((await fetch(`${base}/v1/health`)).ok) break; } catch { /* starting */ }
  if (i > 60) { console.error(`server did not start (log: ${join(dir, 'server.log')})`); process.exit(1); }
  await new Promise(r => setTimeout(r, 500));
}
// The answer must come from OUR child, not a stale server left on the port.
await new Promise(r => setTimeout(r, 400));
if (child.exitCode !== null) { console.error(`port ${port} is taken by another server (log: ${join(dir, 'server.log')})`); process.exit(1); }

if (restart) {
  console.log(`Real Pri server restarted on ${base} (pid ${child.pid}) with ${dbPath}. SYNTHETIC TEST FIXTURE.`);
  const out = arg('out');
  if (out) writeFileSync(out, `PRI_CLOUD_SERVER_PID=${child.pid}\n`);
  process.exit(0);
}

const email = `native-${Date.now()}@example.test`;
const password = `Fixture-${randomBytes(9).toString('base64url')}`;
const res = await fetch(`${base}/v1/account/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, name: 'Native Fixture', password, isAdult: true }),
});
if (res.status !== 201) { console.error(`register failed: ${res.status} ${await res.text()}`); process.exit(1); }

const { createPlatformDb } = await import(join(ROOT, 'server/platform/db.js'));
const db = createPlatformDb(dbPath);
const changed = db.prepare('UPDATE accounts SET email_verified_at = ? WHERE email = ?').run(Date.now(), email).changes;
db.close();
if (changed !== 1) { console.error('could not mark the fixture account verified'); process.exit(1); }

// 10.0.2.2 is the Android emulator's alias for this machine's loopback.
// A second, never-registered credential for sign-up journeys.
const newEmail = `native-new-${Date.now()}@example.test`;
const newPassword = `Fixture-${randomBytes(9).toString('base64url')}`;
const env = `PRI_CLOUD_ORIGIN=http://${deviceHost}:${port}\nPRI_CLOUD_EMAIL=${email}\nPRI_CLOUD_PASSWORD=${password}\nPRI_CLOUD_NEW_EMAIL=${newEmail}\nPRI_CLOUD_NEW_PASSWORD=${newPassword}\nPRI_CLOUD_DB=${dbPath}\nPRI_CLOUD_PORT=${port}\nPRI_CLOUD_SERVER_PID=${child.pid}\nPRI_CLOUD_SERVER_LOG=${join(dir, 'server.log')}\nPRI_CLOUD_OUTBOX=${outboxFile}\n${syntheticReader ? `PRI_CLOUD_READER=synthetic\nPRI_CLOUD_READER_LOG=${readerLog}\nPRI_CLOUD_READER_SCRIPT=${readerScript}\n` : ''}`;
const out = arg('out');
if (out) writeFileSync(out, env);
console.log(`Real Pri server on ${base} (pid ${child.pid}); fixture account ${email} (verified). SYNTHETIC TEST FIXTURE.${syntheticReader ? ' Handwriting reader: SYNTHETIC stand-in (no provider is reached).' : ''}`);
