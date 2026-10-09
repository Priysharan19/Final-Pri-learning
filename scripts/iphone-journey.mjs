#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · native student journey on an iOS simulator (CP-04/CP-05)
//
// Builds the canonical Apple package, installs it fresh on an iPhone (default)
// or iPad simulator and runs JourneySelfCheck.swift.
//
// Grading is online-only and server-authoritative (owner decision 2026-10-10,
// ADR-0001). Nothing is checked, marked or revealed signed out or offline, so
// the journey has two legs and BOTH are required for a PASS:
//
//   1. no server (--journey-selfcheck, --journey-relaunch): onboarding →
//      practice → typed answer and working → strokes on the native PencilKit
//      surface, sealed in IndexedDB with one truthful save status → a photo
//      attached and not read on the device → Submit and Show solution refused
//      on the card, nothing marked, nothing in History → relaunch keeps the
//      profile, the question, the typed work and the strokes;
//   2. a real local Pri server on SQLite with a SYNTHETIC handwriting reader
//      (--journey-marking, --journey-marking-relaunch; a fresh install): a
//      server-prepared question signed out → in-card sign-in → the server
//      binds and marks it (wrong: 0 with a try left; right: full marks) → a
//      handwritten page read by the server, corrected, marked → History after
//      relaunch. The right answer comes from this process reading the server's
//      sealed copy of the issued question, never from the page.
//      If that server cannot be started the leg's steps are reported as
//      "not measured" and the journey FAILS.
//
// Writes a machine-readable evidence record (exact SHA, simulator, OS, steps)
// with --evidence <file>. Evidence tier: SIMULATOR + SYNTHETIC READER, with
// programmatic strokes. Never physical-device, Apple Pencil, real-handwriting
// or real-provider evidence.
// CP-05 adds, on the first install:
//   --cloud         a real Pri server (scripts/cloud-fixture-server.mjs, or the
//                   PRI_CLOUD_* environment) — sign in through Settings, Sync
//                   now, relaunch keeps the session, Disconnect;
//   --dynamic-type  the largest accessibility text size: the page is scaled
//                   and no screen scrolls sideways (the setting is restored).
//
//   node scripts/iphone-journey.mjs                 # an iPhone simulator
//   node scripts/iphone-journey.mjs --family ipad
//   node scripts/iphone-journey.mjs --cloud --dynamic-type --evidence out.json
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { engineeringPackage } from './apple-shipping-target.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PACKAGE = join(ROOT, 'ios/PriLearning.swiftpm');
const FIRST = ['launch', 'onboarding', 'practice', 'typedDraft', 'nativeInk', 'photoDraft', 'checkRefused', 'solutionRefused', 'nothingRecorded', 'progress', 'persistenceMarker'];
const RELAUNCH = ['relaunchProfile', 'relaunchMarker', 'relaunchDraftKept'];
// The signed-in leg. The server* steps are read by this process from the
// server's own database, request log and the stand-in reader's request log.
const MARKING = ['onlineOnboarding', 'preparedQuestion', 'signedOutRefusal', 'signInOnCard', 'typedWrongZero', 'typedCorrectFull', 'inkServerReading', 'inkCorrectedMarked', 'historyRecorded'];
const MARKING_SERVER = ['serverPreparedThenBound', 'serverGrades', 'serverReaderAnswerBlind'];
const MARKING_RELAUNCH = ['historyAfterRelaunch'];
const TIER = 'SIMULATOR + SYNTHETIC READER';
const SIGNUP = ['cloudSignUp', 'cloudLogin', 'cloudDeleteAccount'];
const CLOUD = ['cloudSignIn', 'cloudSync'];
const OFFLINE = ['offlinePractice', 'offlineSyncSafe'];
const CLOUD_RELAUNCH = ['cloudSessionKept', 'cloudReconnectSync', 'cloudDisconnect'];
const DYNAMIC = ['dynamicTypeZoom', 'dynamicTypeNoOverflow'];
const BACKGROUND = ['backgroundDraftKept'];
const A11Y = ['a11yAudit'];
const WANT_LIFECYCLE = process.argv.includes('--lifecycle');
const WANT_A11Y = process.argv.includes('--a11y');
const WANT_CLOUD = process.argv.includes('--cloud');
const WANT_DYNAMIC = process.argv.includes('--dynamic-type');

// `log show --start` takes LOCAL time; a UTC stamp would re-read hours of old runs.
const localStamp = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const argOf = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...opts });

// A freshly booted simulator can refuse a launch until SpringBoard is ready
// ("denied by service delegate (SBMainWorkspace)"). Wait for the boot to finish,
// then retry that specific refusal a few times; any other error is real.
function launchApp(device, bundleId, args = [], opts = {}) {
  try { run('xcrun', ['simctl', 'bootstatus', device, '-b'], { timeout: 600_000 }); } catch { /* best effort */ }
  for (let attempt = 1; ; attempt++) {
    try { return run('xcrun', ['simctl', 'launch', device, bundleId, ...args], opts); }
    catch (error) {
      const text = String(error?.stderr || error?.message || '');
      if (attempt >= 5 || !/SBMainWorkspace|FBSOpenApplicationServiceErrorDomain/.test(text)) throw error;
      console.log(`  (simulator not ready to launch yet; retry ${attempt})`);
      execSync('sleep 6');
    }
  }
}


function pickDevice() {
  const named = argOf('device');
  const family = (argOf('family') || 'iphone').toLowerCase();
  const pattern = family === 'ipad' ? /iPad/ : /iPhone/;
  // Devices are listed under runtime headers ("-- iOS 26.0 --"). Prefer the
  // newest runtime: an older one can need a long first boot on a CI runner.
  let runtime = [0];
  const rows = [];
  for (const l of run('xcrun', ['simctl', 'list', 'devices', 'available']).split('\n')) {
    const header = l.match(/^-- iOS ([\d.]+) --/);
    if (header) { runtime = header[1].split('.').map(Number); continue; }
    const m = l.match(/^\s+(.+?) \(([0-9A-F-]{36})\) \((\w+)\)/i);
    if (m && /^-- /.test(l) === false) rows.push({ name: m[1], udid: m[2], state: m[3], runtime });
  }
  const newer = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (b[i] || 0) - (a[i] || 0); if (d) return d; } return 0; };
  const matching = rows.filter(d => (named ? d.name === named : pattern.test(d.name))).sort((a, b) => newer(a.runtime, b.runtime));
  const pick = matching.find(d => d.state === 'Booted') || matching[0];
  if (!pick) throw new Error(`no ${named || family} simulator is available`);
  return pick;
}

function ensureBooted({ name, udid }) {
  const booted = () => run('xcrun', ['simctl', 'list', 'devices']).split('\n').some(l => l.includes(udid) && /\(Booted\)/.test(l));
  if (booted()) return;
  // On a CI runner a second booted simulator (the iPad from earlier steps)
  // starves this boot; a person's own simulators are never touched locally.
  if (process.env.CI) {
    for (const line of run('xcrun', ['simctl', 'list', 'devices']).split('\n')) {
      const other = line.match(/\(([0-9A-F-]{36})\) \(Booted\)/i)?.[1];
      if (other && other !== udid) { console.log(`  shutting down booted simulator ${other} (CI)`); try { run('xcrun', ['simctl', 'shutdown', other]); } catch { /* already down */ } }
    }
  }
  console.log(`Booting ${name}…`);
  if (process.env.CI) { try { console.log(run('xcrun', ['simctl', 'list', 'runtimes']).trim().split('\n').map(l => `  ${l}`).join('\n')); } catch { /* diagnostics only */ } }
  try { run('xcrun', ['simctl', 'boot', udid], { timeout: 900_000 }); } catch { /* already booting */ }
  try { run('xcrun', ['simctl', 'bootstatus', udid, '-b'], { timeout: 600_000 }); } catch { /* poll below */ }
  for (let i = 0; i < 60 && !booted(); i++) execSync('sleep 2');
  if (!booted()) throw new Error(`${name} did not boot`);
}

function builtApp(derived) {
  const products = join(derived, 'Build/Products/Debug-iphonesimulator');
  const apps = existsSync(products) ? readdirSync(products).filter(n => n.endsWith('.app')) : [];
  if (apps.length !== 1) throw new Error(`expected one simulator .app, found ${apps.length}`);
  return join(products, apps[0]);
}

function launchAndRead(udid, bundleId, flag, phase, childEnv = {}, { during = null, duringAfterMs = 20_000, tick = null, loops = 75 } = {}) {
  const started = localStamp(new Date(Date.now() - 2000));
  // SIMCTL_CHILD_* reaches the app's environment (DEBUG builds read the cloud
  // origin override and the journey's fixture account from it).
  const env = { ...process.env };
  for (const [k, v] of Object.entries(childEnv)) env[`SIMCTL_CHILD_${k}`] = v;
  launchApp(udid, bundleId, [flag], { env });
  let lines = [];
  const t0 = Date.now();
  let duringDone = !during;
  for (let i = 0; i < loops; i++) {
    // With an oracle to serve, look twice a second-and-a-half rather than
    // letting the page wait on the (slow) log read.
    if (tick) { for (let k = 0; k < 4; k++) { execSync('sleep 0.5'); tick(); } } else execSync('sleep 2');
    if (!duringDone && Date.now() - t0 >= duringAfterMs) { duringDone = true; during(); }
    const log = run('xcrun', ['simctl', 'spawn', udid, 'log', 'show', '--start', started,
      '--predicate', 'eventMessage CONTAINS "PRIJOURNEY"', '--style', 'compact']);
    lines = log.split('\n').filter(l => l.includes('PRIJOURNEY') && !l.includes("'log'")).map(l => l.slice(l.indexOf('PRIJOURNEY')));
    // Only this launch: everything after its own "started <phase>" line.
    const start = lines.lastIndexOf(`PRIJOURNEY started ${phase}`);
    lines = start >= 0 ? lines.slice(start) : [];
    if (lines.some(l => l.startsWith(`PRIJOURNEY summary ${phase}`))) { execSync('sleep 3'); break; } // let WebKit flush storage
    if (lines.some(l => /^PRIJOURNEY FAIL (script|unreadable)/.test(l))) break;
  }
  try { run('xcrun', ['simctl', 'terminate', udid, bundleId]); } catch { /* already gone */ }
  return lines;
}

const sim = pickDevice();
const udid = sim.udid;
console.log(`Native student journey on ${sim.name} (${udid}) — ${TIER} evidence (programmatic strokes; not a physical device, a Pencil or a real provider)\n`);
ensureBooted(sim);
// `main` is iPad-only (the V1 shipping target); an iPhone simulator run builds
// the engineering copy that adds the iPhone family. --app reuses a prebuilt
// simulator .app (CI builds once and runs every step against it).
let app = argOf('app');
if (!app) {
  const derived = mkdtempSync(join(tmpdir(), 'pri-sim-'));
  const pkg = /iPhone/.test(sim.name) ? engineeringPackage(join(derived, 'pkg')) : PACKAGE;
  console.log(`Building ${pkg === PACKAGE ? 'the canonical package' : 'the iPhone engineering copy'}…`);
  run('xcodebuild', ['-scheme', 'PriLearning', '-destination', `platform=iOS Simulator,id=${udid}`, '-derivedDataPath', derived, 'build'], { cwd: pkg });
  app = builtApp(derived);
}
const bundleId = run('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', join(app, 'Info.plist')]).trim();
try { run('xcrun', ['simctl', 'terminate', udid, bundleId]); } catch { /* not running */ }
try { run('xcrun', ['simctl', 'uninstall', udid, bundleId]); } catch { /* not installed */ }
run('xcrun', ['simctl', 'install', udid, app]);

console.log('Leg 1 · no server: drafts are kept, nothing is checked, marked or revealed …');
const first = launchAndRead(udid, bundleId, '--journey-selfcheck', 'first', {}, { loops: 110 });
for (const line of first) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
const second = launchAndRead(udid, bundleId, '--journey-relaunch', 'relaunch');
for (const line of second) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);

// Successful logouts in the fixture server's request log (null when unknown).
function serverLogouts(fixture) {
  try {
    const log = readFileSync(fixture.PRI_CLOUD_SERVER_LOG, 'utf8');
    // Structured request logs name the route ("route", from #262) — older builds used "path".
    return (log.match(/"(?:route|path)":"\/v1\/account\/logout","status":200/g) || []).length;
  } catch { return null; }
}

let signupLines = [];
let cloudLines = [];
let offlineLines = [];
let cloudRelaunchLines = [];
let cloudServer = null;
const localPost = (port, path, body) => new Promise(resolve => {
  // Raw node:http: a native-shaped request (no Origin / Fetch Metadata).
  import('node:http').then(({ request }) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'POST', headers: { 'content-type': 'application/json', 'x-pri-client': 'ios-native-v1' } },
      res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', () => resolve(0)); req.end(JSON.stringify(body));
  });
});
if (WANT_CLOUD) try {
  let fixture = process.env.PRI_CLOUD_ORIGIN ? {
    PRI_CLOUD_ORIGIN: process.env.PRI_CLOUD_ORIGIN, PRI_CLOUD_EMAIL: process.env.PRI_CLOUD_EMAIL, PRI_CLOUD_PASSWORD: process.env.PRI_CLOUD_PASSWORD,
  } : null;
  if (!fixture) {
    const out = join(mkdtempSync(join(tmpdir(), 'pri-fixture-')), 'fixture.env');
    execFileSync(process.execPath, [join(HERE, 'cloud-fixture-server.mjs'), '--port', '4331', '--host', '127.0.0.1', '--out', out], { stdio: 'inherit' });
    fixture = Object.fromEntries(readFileSync(out, 'utf8').trim().split('\n').map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
    cloudServer = fixture;
  }
  if (!cloudServer && process.env.PRI_CLOUD_SERVER_LOG) fixture.PRI_CLOUD_SERVER_LOG = process.env.PRI_CLOUD_SERVER_LOG;
  const childEnv = {
    PRI_CLOUD_ORIGIN: fixture.PRI_CLOUD_ORIGIN, PRI_JOURNEY_EMAIL: fixture.PRI_CLOUD_EMAIL, PRI_JOURNEY_PASSWORD: fixture.PRI_CLOUD_PASSWORD,
    PRI_JOURNEY_NEW_EMAIL: fixture.PRI_CLOUD_NEW_EMAIL || '', PRI_JOURNEY_NEW_PASSWORD: fixture.PRI_CLOUD_NEW_PASSWORD || '',
  };
  const show = lines => { for (const line of lines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`); };
  const port = Number(fixture.PRI_CLOUD_PORT || new URL(fixture.PRI_CLOUD_ORIGIN).port);
  console.log(`\nCloud journey against ${fixture.PRI_CLOUD_ORIGIN} (real Pri server, fixture accounts) …`);
  if (childEnv.PRI_JOURNEY_NEW_EMAIL) {
    signupLines = launchAndRead(udid, bundleId, '--journey-cloud-signup', 'cloudSignUp', childEnv);
    show(signupLines);
  }
  cloudLines = launchAndRead(udid, bundleId, '--journey-cloud', 'cloud', childEnv);
  show(cloudLines);
  if (cloudServer?.PRI_CLOUD_SERVER_PID && fixture.PRI_CLOUD_DB) {
    // Offline: the cloud server goes away (the device cannot reach it).
    try { process.kill(Number(cloudServer.PRI_CLOUD_SERVER_PID)); } catch { /* gone */ }
    execSync('sleep 1');
    offlineLines = launchAndRead(udid, bundleId, '--journey-offline', 'offline', childEnv);
    show(offlineLines);
    // Reconnect: the same server and database come back.
    const out = join(mkdtempSync(join(tmpdir(), 'pri-fixture-')), 'restart.env');
    execFileSync(process.execPath, [join(HERE, 'cloud-fixture-server.mjs'), '--port', String(port), '--host', '127.0.0.1', '--db', fixture.PRI_CLOUD_DB, '--restart', '--out', out], { stdio: 'inherit' });
    cloudServer.PRI_CLOUD_SERVER_PID = readFileSync(out, 'utf8').match(/PRI_CLOUD_SERVER_PID=(\d+)/)[1];
  }
  const logoutsBefore = serverLogouts(fixture);
  cloudRelaunchLines = launchAndRead(udid, bundleId, '--journey-cloud-relaunch', 'cloudRelaunch', childEnv);
  show(cloudRelaunchLines);
  // Server-side proof that Disconnect logged the session out (not only that the label changed).
  const logoutsAfter = serverLogouts(fixture);
  if (logoutsBefore !== null) {
    cloudRelaunchLines.push(logoutsAfter > logoutsBefore
      ? `PRIJOURNEY ok serverLogoutRecorded ${logoutsAfter - logoutsBefore} logout(s) answered 200`
      : `PRIJOURNEY FAIL serverLogoutRecorded no successful logout reached the server`);
  }
  // Server-side proof: the deleted account can no longer sign in.
  if (childEnv.PRI_JOURNEY_NEW_EMAIL) {
    const status = await localPost(port, '/v1/account/login', { email: childEnv.PRI_JOURNEY_NEW_EMAIL, password: childEnv.PRI_JOURNEY_NEW_PASSWORD });
    signupLines.push(status === 401 ? `PRIJOURNEY ok serverDeletedAccountRefused login ${status}` : `PRIJOURNEY FAIL serverDeletedAccountRefused login ${status}`);
  }
} finally {
  // Never leave a fixture server behind, whatever failed.
  if (cloudServer?.PRI_CLOUD_SERVER_PID) { try { process.kill(Number(cloudServer.PRI_CLOUD_SERVER_PID)); } catch { /* already gone */ } }
}

let backgroundLines = [];
let a11yLines = [];
if (WANT_LIFECYCLE) {
  console.log('\nBackground → foreground …');
  backgroundLines = launchAndRead(udid, bundleId, '--journey-background', 'background', {}, {
    during: () => {
      // The phase needs ~30 s to reach a typed question; switch apps after it.
      try { run('xcrun', ['simctl', 'launch', udid, 'com.apple.Preferences']); } catch { /* best effort */ }
      execSync('sleep 4');
      try { run('xcrun', ['simctl', 'launch', udid, bundleId]); } catch { /* already running: brought forward */ }
    },
    duringAfterMs: 35_000,
  });
  for (const line of backgroundLines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
}
if (WANT_A11Y) {
  console.log('\nAccessibility smoke in the real web view …');
  a11yLines = launchAndRead(udid, bundleId, '--journey-a11y', 'a11y');
  for (const line of a11yLines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
}

let dynamicLines = [];
if (WANT_DYNAMIC) {
  console.log('\nLargest accessibility text size …');
  run('xcrun', ['simctl', 'ui', udid, 'content_size', 'accessibility-extra-extra-extra-large']);
  try { dynamicLines = launchAndRead(udid, bundleId, '--journey-dynamic-type', 'dynamicType'); }
  finally { try { run('xcrun', ['simctl', 'ui', udid, 'content_size', 'large']); } catch { /* best effort */ } }
  for (const line of dynamicLines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
}

// ── Leg 2 · a real local server marks the work ───────────────────────────────
// A fresh install, so the student starts signed out with the server reachable.
// DEBUG builds read PRI_CLOUD_ORIGIN from the launch environment (and accept
// http only for loopback); a Release build has neither (NativeCloudBridge.swift).
const READER_TEXT = '7';
const WRONG = '-987654';
let markingLines = [];
let markingRelaunchLines = [];
let markingNotMeasured = null;
{
  let server = null;
  try {
    console.log(`\nLeg 2 · a real local Pri server marks the work — ${TIER} …`);
    const out = join(mkdtempSync(join(tmpdir(), 'pri-marking-')), 'fixture.env');
    try {
      execFileSync(process.execPath, [join(HERE, 'cloud-fixture-server.mjs'), '--port', '4332', '--host', '127.0.0.1', '--synthetic-reader', '--out', out], { stdio: 'inherit' });
    } catch (error) { throw new Error(`the local server did not start (${String(error?.message || error).split('\n')[0]})`); }
    server = Object.fromEntries(readFileSync(out, 'utf8').trim().split('\n').map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
    if (server.PRI_CLOUD_READER !== 'synthetic') throw new Error('the local server is not running the synthetic reader');
    writeFileSync(server.PRI_CLOUD_READER_SCRIPT, JSON.stringify({ text: READER_TEXT, confidence: 0.6 }));
    // The server's own database, read-only: the "teacher's desk".
    const Database = createRequire(join(ROOT, 'server/package.json'))('better-sqlite3');
    const db = new Database(server.PRI_CLOUD_DB, { readonly: true, fileMustExist: true });
    const account = db.prepare('SELECT id FROM accounts WHERE email=?').get(server.PRI_CLOUD_EMAIL);
    if (!account) throw new Error('the fixture account is missing from the local server');
    const rows = (scope, extra = '', ...args) => db.prepare(`SELECT key,response_json,created_at FROM idempotency_keys WHERE account_id=? AND scope=? ${extra} ORDER BY created_at, rowid`).all(account.id, scope, ...args);

    /** The sealed answer of the question this account was issued last. */
    const sealedAnswer = () => {
      const issued = rows('practice-question').at(-1);
      if (!issued) return { supported: false, reason: 'nothing issued' };
      const question = JSON.parse(issued.response_json);
      const a = question.answer || {};
      let text = null;
      if (question.answerType === 'numeric') {
        if (a.canonicalInput) text = String(a.canonicalInput);
        else if (a.simplestFraction) text = `${a.simplestFraction.n}/${a.simplestFraction.d}`;
        else if (a.value !== undefined) text = String(a.value);
      }
      const fromPrepared = rows('practice-prepared').some(r => JSON.parse(r.response_json)?.question?.id === issued.key);
      // A statable answer the stand-in reader and the scripted miss cannot be mistaken for.
      const supported = typeof text === 'string' && text.length > 0 && text.length <= 40 && text !== READER_TEXT && text !== WRONG;
      return { supported, text: supported ? text : null, answerType: question.answerType, serverQuestionId: issued.key, fromPrepared, readerText: READER_TEXT };
    };
    const oracleDir = mkdtempSync(join(tmpdir(), 'pri-oracle-'));
    const answered = new Set();
    const tick = () => {
      for (const name of readdirSync(oracleDir)) {
        const n = name.match(/^ask-(\d+)\.json$/)?.[1];
        if (!n || answered.has(n)) continue;
        let ask = null;
        try { ask = JSON.parse(readFileSync(join(oracleDir, name), 'utf8')); } catch { continue; }
        let reply;
        try { reply = ask.kind === 'answer' ? sealedAnswer() : { supported: false, reason: 'unknown question' }; }
        catch (error) { reply = { supported: false, reason: String(error?.message || error).slice(0, 120) }; }
        writeFileSync(join(oracleDir, `reply-${n}.json`), JSON.stringify({ n: Number(n), ...reply }));
        answered.add(n);
      }
    };

    try { run('xcrun', ['simctl', 'terminate', udid, bundleId]); } catch { /* not running */ }
    try { run('xcrun', ['simctl', 'uninstall', udid, bundleId]); } catch { /* not installed */ }
    run('xcrun', ['simctl', 'install', udid, app]);
    const childEnv = { PRI_CLOUD_ORIGIN: server.PRI_CLOUD_ORIGIN, PRI_JOURNEY_EMAIL: server.PRI_CLOUD_EMAIL, PRI_JOURNEY_PASSWORD: server.PRI_CLOUD_PASSWORD, PRI_JOURNEY_ORACLE_DIR: oracleDir };
    markingLines = launchAndRead(udid, bundleId, '--journey-marking', 'marking', childEnv, { tick, loops: 130 });
    for (const line of markingLines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);

    // What the SERVER holds, whatever the screen said.
    const verdict = (name, fn) => {
      let detail;
      try { detail = fn(); markingLines.push(`PRIJOURNEY ok ${name} ${detail}`); }
      catch (error) { markingLines.push(`PRIJOURNEY FAIL ${name} ${String(error?.message || error).slice(0, 200)}`); }
      console.log(`  ${markingLines.at(-1).replace(/^PRIJOURNEY\s*/, '')}`);
    };
    const requests = () => readFileSync(server.PRI_CLOUD_SERVER_LOG, 'utf8').split('\n').filter(l => l.includes('"http_request"')).map(l => { try { return JSON.parse(l); } catch { return {}; } });
    const completed = () => rows('practice-completion').map(c => {
      const question = JSON.parse(rows('practice-question', 'AND key=?', c.key)[0].response_json);
      const grades = rows('practice-grade', "AND key LIKE ? || ':%'", c.key).map(g => JSON.parse(g.response_json));
      const event = db.prepare("SELECT payload_json FROM learning_events WHERE account_id=? AND kind='graded-attempt' AND entity_id=?").get(account.id, c.key);
      return { id: c.key, prompt: String(question.prompt || ''), grades, inputMode: event ? JSON.parse(event.payload_json).inputMode : null };
    });
    verdict('serverPreparedThenBound', () => {
      const log = requests();
      const prepared = log.filter(r => r.method === 'POST' && r.route === '/v1/practice/prepare' && r.status === 200).length;
      const bound = rows('practice-prepared').length;
      if (!prepared) throw new Error('the server prepared no question for the signed-out student');
      if (bound !== 1) throw new Error(`${bound} prepared question(s) bound to the account, expected 1`);
      return `${prepared} question(s) prepared signed out, 1 bound to the account at check time, ${rows('practice-question').length} issued in all`;
    });
    verdict('serverGrades', () => {
      const done = completed();
      const typed = done.filter(q => q.inputMode === 'typed');
      const ink = done.filter(q => q.inputMode === 'ink');
      if (done.length !== 2 || typed.length !== 1 || ink.length !== 1) throw new Error(`completed questions by input: ${JSON.stringify(done.map(q => q.inputMode))}`);
      const [miss, hit] = typed[0].grades;
      if (typed[0].grades.length !== 2 || miss.authoritative !== true || miss.correct !== false || miss.invalid !== false || miss.marksEarned !== 0 ||
          miss.resolved !== false || miss.triesLeft !== 1) throw new Error(`typed miss: ${JSON.stringify(typed[0].grades.map(g => [g.correct, g.invalid, g.marksEarned, g.marksPossible, g.triesLeft]))}`);
      if (hit.authoritative !== true || hit.correct !== true || hit.resolved !== true || hit.marksEarned !== hit.marksPossible || !(hit.marksPossible > 0)) throw new Error(`typed hit: ${JSON.stringify([hit.correct, hit.marksEarned, hit.marksPossible])}`);
      const [read] = ink[0].grades;
      if (ink[0].grades.length !== 1 || read.authoritative !== true || read.correct !== true || read.resolved !== true || read.marksEarned !== read.marksPossible || !(read.marksPossible > 0)) throw new Error(`ink: ${JSON.stringify(ink[0].grades.map(g => [g.correct, g.marksEarned, g.marksPossible]))}`);
      const confirmed = rows('practice-recognition').map(r => JSON.parse(r.response_json)).filter(r => r.questionId === ink[0].id);
      if (confirmed.length < 2) throw new Error(`${confirmed.length} reading receipt(s) for the handwritten question; expected the reader's and the student's correction`);
      return `typed: 0/${miss.marksPossible} with 1 try left, then ${hit.marksEarned}/${hit.marksPossible}; handwritten: ${read.marksEarned}/${read.marksPossible} on a corrected reading (${confirmed.length} receipts)`;
    });
    verdict('serverReaderAnswerBlind', () => {
      let entries = [];
      try { entries = readFileSync(server.PRI_CLOUD_READER_LOG, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { /* none */ }
      const reads = entries.filter(e => e.kind === 'reader');
      const refused = entries.filter(e => e.kind === 'refused');
      if (!reads.length) throw new Error('the stand-in reader was never asked');
      if (refused.length) throw new Error(`outbound requests were attempted: ${refused.map(e => e.target).join(', ')}`);
      const prompts = completed().map(q => JSON.stringify(q.prompt).slice(1, 25)).filter(p => p.length >= 12);
      const leaked = reads.filter(e => e.images !== 1 || e.imageIsDataUrl !== true || prompts.some(p => String(e.nonImageText).includes(p)));
      if (leaked.length) throw new Error(`${leaked.length} reader request(s) carried more than one picture or question text`);
      return `${reads.length} request(s) to the SYNTHETIC reader: one picture each, no question text; no other outbound request`;
    });
    db.close();

    markingRelaunchLines = launchAndRead(udid, bundleId, '--journey-marking-relaunch', 'markingRelaunch', childEnv);
    for (const line of markingRelaunchLines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
  } catch (error) {
    markingNotMeasured = String(error?.message || error).split('\n')[0].slice(0, 200);
    console.log(`  NOT MEASURED — ${markingNotMeasured}`);
  } finally {
    if (server?.PRI_CLOUD_SERVER_PID) { try { process.kill(Number(server.PRI_CLOUD_SERVER_PID)); } catch { /* already gone */ } }
  }
}

const result = (lines, name) => {
  const hit = lines.find(l => l.startsWith(`PRIJOURNEY ok ${name}`) || l.startsWith(`PRIJOURNEY FAIL ${name}`));
  return hit ? { ok: hit.startsWith('PRIJOURNEY ok'), detail: hit.replace(/^PRIJOURNEY (ok|FAIL) \S+\s*/, '') } : { ok: false, detail: 'not reported' };
};
// A marking step with no line was not run: it is never counted as passed.
const marked = (lines, name) => {
  const r = result(lines, name);
  return r.detail === 'not reported' ? { ok: false, detail: `not measured${markingNotMeasured ? `: ${markingNotMeasured}` : ''}` } : r;
};
const steps = Object.fromEntries([
  ...FIRST.map(n => [n, result(first, n)]), ...RELAUNCH.map(n => [n, result(second, n)]),
  ...(WANT_CLOUD ? [
    ...SIGNUP.map(n => [n, result(signupLines, n)]), ['serverDeletedAccountRefused', result(signupLines, 'serverDeletedAccountRefused')],
    ...CLOUD.map(n => [n, result(cloudLines, n)]), ...OFFLINE.map(n => [n, result(offlineLines, n)]),
    ...CLOUD_RELAUNCH.map(n => [n, result(cloudRelaunchLines, n)]),
    ['serverLogoutRecorded', result(cloudRelaunchLines, 'serverLogoutRecorded')],
  ] : []),
  ...(WANT_DYNAMIC ? DYNAMIC.map(n => [n, result(dynamicLines, n)]) : []),
  ...(WANT_LIFECYCLE ? BACKGROUND.map(n => [n, result(backgroundLines, n)]) : []),
  ...(WANT_A11Y ? A11Y.map(n => [n, result(a11yLines, n)]) : []),
  ...[...MARKING, ...MARKING_SERVER].map(n => [n, marked(markingLines, n)]),
  ...MARKING_RELAUNCH.map(n => [n, marked(markingRelaunchLines, n)]),
]);
// The ink facts must match the hardware: iPhone writes with a finger by default
// and has no stylus; iPad is stylus-first. (Finger *touch* input itself remains
// a physical-device gate: injected strokes bypass the drawing policy.)
const wantFacts = /iPhone/.test(sim.name) ? 'stylus=false fingerDefault=true' : 'stylus=true fingerDefault=false';
if (steps.nativeInk.ok && !steps.nativeInk.detail.startsWith(wantFacts)) {
  steps.nativeInk = { ok: false, detail: `expected ${wantFacts}; got ${steps.nativeInk.detail}` };
}
const passed = Object.values(steps).filter(s => s.ok).length;
const total = Object.keys(steps).length;
let os = '';
try { os = run('xcrun', ['simctl', 'list', 'runtimes']).split('\n').find(l => /iOS/.test(l))?.trim() || ''; } catch { /* informational */ }
let sha = '';
let dirty = null;
try { sha = run('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).trim(); } catch { /* not a checkout */ }
try { dirty = run('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT }).trim().length > 0; } catch { /* not a checkout */ }
// The device's own runtime, not the first one installed.
try {
  const devices = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', '-j'])).devices;
  for (const [runtime, list] of Object.entries(devices)) if (list.some(d => d.udid === udid)) os = runtime.replace(/^com\.apple\.CoreSimulator\.SimRuntime\./, '');
} catch { /* informational */ }

const evidence = {
  schemaVersion: 1,
  evidenceClass: 'SYNTHETIC_SIMULATOR',
  evidenceTier: TIER,
  physicalDevice: false,
  // What is real and what is not, so the record cannot be over-read.
  real: ['the built client in the shipped WKWebView shell', 'the native PencilKit surface and priInk bridge', 'IndexedDB / localStorage persistence across a relaunch',
    'the Pri /v1 server (accounts, sessions, prepare / issue / recognise / confirm / grade) on a local SQLite file'],
  synthetic: ['an iOS simulator, not a device', 'strokes placed on the surface programmatically, not written with a Pencil or finger',
    'the handwriting reader: a scripted stand-in at the provider hop that never looks at the picture', 'a fixture account verified in the local database'],
  notEvidenceFor: ['a physical iPad or Apple Pencil', 'real handwriting recognition accuracy', 'a real model provider', 'the production or staging deployment'],
  sha,
  dirtyWorkingTree: dirty,
  simulator: { name: sim.name, udid, runtime: os },
  workflow: process.env.GITHUB_WORKFLOW || 'local',
  run: process.env.GITHUB_RUN_ID || null,
  timestamp: new Date().toISOString(),
  steps,
  result: passed === total ? 'PASS' : 'FAIL',
};
const out = argOf('evidence');
if (out) writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(passed === total
  ? `\nNATIVE JOURNEY: PASS — ${passed}/${total} steps on ${sim.name} (${TIER})`
  : `\nNATIVE JOURNEY: FAIL — ${passed}/${total} steps on ${sim.name} (${TIER})${Object.entries(steps).filter(([, s]) => !s.ok).map(([n, s]) => `\n  ✗ ${n}: ${s.detail}`).join('')}`);
process.exit(passed === total ? 0 : 1);
