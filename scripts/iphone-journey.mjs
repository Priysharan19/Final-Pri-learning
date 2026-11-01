#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · native student journey on an iOS simulator (CP-04/CP-05)
//
// Builds the canonical Apple package, installs it fresh on an iPhone (default)
// or iPad simulator and runs JourneySelfCheck.swift.
//
// The app is account-first (issue #477): the landing screen is one sign-in
// card and an activation gate stands in front of every route until the
// server confirms the session, the age/guardian decision and a first sync.
// Grading is online-only and server-authoritative (owner decision
// 2026-10-10, ADR-0001). The journey has these legs and ALL are required for
// a PASS:
//
//   1. no server, a fresh install (--journey-selfcheck, --journey-relaunch):
//      the app opens to the card (or the gate) and nothing opens without an
//      account — no shell, no Practice behind a deep link, nothing drafted,
//      nothing marked; the same after a relaunch;
//   2. a real local Pri server on SQLite with a SYNTHETIC handwriting reader
//      (--journey-marking, --journey-marking-relaunch; a fresh install): a new
//      student enters through the card — email, the six-digit code the
//      server's TEST email adapter issued (read by this process from the
//      server's outbox, scripts/journey-oracle.mjs emailCode; never
//      invented), name, age, class — then the server marks the work (wrong:
//      0 with a try left; right: full marks) → a handwritten page read by the
//      server, corrected, marked → History after relaunch. The right answer
//      comes from this process reading the server's sealed copy of the
//      issued question, never from the page;
//   3. offline after entry (--journey-offline-draft, --journey-offline-
//      relaunch; a fresh install, a second new address entered through the
//      card, a question opened online): the page asks, this process
//      stops the server, and the question is an offline draft — typed work,
//      strokes on the native PencilKit surface (sealed in IndexedDB with one
//      truthful save status) and a photo kept, not read on the device; the
//      card says so before any work and offers no Submit and no Show
//      solution; "Try for a markable question" asks first and changes
//      nothing; relaunched with the server still down the gate says "retry",
//      the shell does not open, and the draft is still on the device.
//   If the server cannot be started, legs 2–3 are reported "not measured"
//   and the journey FAILS. --lifecycle, --a11y and --dynamic-type run on the
//   leg-2 install while the server is up (Home needs an account).
//
// Writes a machine-readable evidence record (exact SHA, simulator, OS, steps)
// with --evidence <file>. Evidence tier: SIMULATOR + SYNTHETIC READER, with
// programmatic strokes. Never physical-device, Apple Pencil, real-handwriting
// or real-provider evidence.
// CP-05 adds, on the first install:
//   --cloud         a real Pri server (scripts/cloud-fixture-server.mjs, or the
//                   PRI_CLOUD_* environment including PRI_CLOUD_DB), on a fresh
//                   install: a new address enters through the card with the
//                   server's emailed code and deletes the account with another;
//                   the fixture address enters the same way, Sync now; opened
//                   offline the gate says "retry"; relaunch keeps the session;
//                   Disconnect. No password, no device-only profile;
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
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { openServerDesk } from './journey-oracle.mjs';
import { installApp, keepOnlySimulator } from './simulator-fleet.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PACKAGE = join(ROOT, 'ios/PriLearning.swiftpm');
// Leg 1 · no server: nothing opens without an account.
const FIRST = ['launch', 'wordmarkClearsStatusBar', 'noEntryWithoutAccount', 'deepLinkHeld', 'nothingMarked', 'persistenceMarker'];
const RELAUNCH = ['relaunchStillHeld', 'relaunchMarker'];
// The signed-in leg. The server* steps are read by this process from the
// server's own database, request log and the stand-in reader's request log.
const MARKING = ['cardOnboarding', 'firstQuestion', 'typedWrongZero', 'typedCorrectFull', 'inkServerReading', 'inkCorrectedMarked', 'historyRecorded'];
const MARKING_SERVER = ['serverAccountFromCard', 'serverGrades', 'serverReaderAnswerBlind'];
const MARKING_RELAUNCH = ['historyAfterRelaunch'];
// Leg 3 · signed in, then the server goes away.
const OFFLINE_DRAFT = ['offlineAfterEntry', 'practice', 'nativeInk', 'typedDraft', 'photoDraft', 'noCheckOffered', 'replaceKeepsWork', 'nothingRecorded', 'offlineProgress', 'offlinePersistenceMarker'];
const OFFLINE_RELAUNCH = ['offlineRelaunchGrace', 'offlineDraftOnDisk'];
const TIER = 'SIMULATOR + SYNTHETIC READER';
const SIGNUP = ['cloudSignUp', 'cloudDeleteAccount'];
const CLOUD = ['cloudSignIn', 'cloudSync'];
const OFFLINE = ['offlineGraceOpens'];
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
  // A CI runner carries one booted simulator, whether or not this one must
  // boot: the other family left booted by an earlier step starves this one
  // (scripts/simulator-fleet.mjs). A person's own simulators are never touched.
  keepOnlySimulator(udid);
  if (booted()) return;
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

// `during` runs once while the phase is live: after `duringAfterMs`, or —
// with `duringWhen` — as soon as the page asks for it. While a page-gated
// `during` is still due, the (slow, up to 90 s) log read is not started: a
// read that blocks the runner would hold the switch back past the page's own
// wait (#528). `duringDeadlineMs` bounds that hold; after it the log is read
// as usual and the page reports its own failure.
function launchAndRead(udid, bundleId, flag, phase, childEnv = {}, { during = null, duringAfterMs = 20_000, duringWhen = null, duringDeadlineMs = 240_000, tick = null, loops = 75 } = {}) {
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
    if (duringWhen && !duringDone) {
      // Poll the page's request every half second, without reading the log.
      while (!duringDone && Date.now() - t0 < duringDeadlineMs) {
        execSync('sleep 0.5');
        if (tick) tick();
        if (duringWhen()) { duringDone = true; during(); }
      }
      duringDone = true;
    } else if (tick) { for (let k = 0; k < 4; k++) { execSync('sleep 0.5'); tick(); } } else execSync('sleep 2');
    if (!duringDone && Date.now() - t0 >= duringAfterMs) { duringDone = true; during(); }
    // One read is bounded: on a loaded machine `log show` inside a simulator
    // has hung for many minutes, and an unbounded read then hangs the whole
    // journey with nothing reported. A read that does not come back is not a
    // result — the next pass reads again, and a phase whose summary is never
    // read is reported "not reported" and fails the journey.
    let log;
    try {
      log = run('xcrun', ['simctl', 'spawn', udid, 'log', 'show', '--start', started,
        '--predicate', 'eventMessage CONTAINS "PRIJOURNEY"', '--style', 'compact'], { timeout: 90_000, killSignal: 'SIGKILL' });
    } catch (e) {
      console.log(`  (log read ${i + 1} of ${phase} did not come back: ${String(e.code || e.signal || e.message).slice(0, 60)})`);
      continue;
    }
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
// `main` declares iPhone + iPad (the V1 shipping target, #504), so both
// families build the canonical package itself. --app reuses a prebuilt
// simulator .app (CI builds once and runs every step against it).
let app = argOf('app');
if (!app) {
  const derived = mkdtempSync(join(tmpdir(), 'pri-sim-'));
  console.log('Building the canonical package…');
  run('xcodebuild', ['-scheme', 'PriLearning', '-destination', `platform=iOS Simulator,id=${udid}`, '-derivedDataPath', derived, 'build'], { cwd: PACKAGE });
  app = builtApp(derived);
}
const bundleId = run('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', join(app, 'Info.plist')]).trim();
try { run('xcrun', ['simctl', 'terminate', udid, bundleId]); } catch { /* not running */ }
try { run('xcrun', ['simctl', 'uninstall', udid, bundleId]); } catch { /* not installed */ }
installApp(udid, app);

console.log('Leg 1 · no server: the app opens to the sign-in card and nothing opens without an account …');
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
if (WANT_CLOUD) try {
  // The codes the card needs come from the server's own test outbox, so a
  // given server must also name its database (and outbox) on this machine.
  let fixture = process.env.PRI_CLOUD_ORIGIN && process.env.PRI_CLOUD_DB ? {
    PRI_CLOUD_ORIGIN: process.env.PRI_CLOUD_ORIGIN, PRI_CLOUD_EMAIL: process.env.PRI_CLOUD_EMAIL, PRI_CLOUD_NEW_EMAIL: process.env.PRI_CLOUD_NEW_EMAIL,
    PRI_CLOUD_DB: process.env.PRI_CLOUD_DB, PRI_CLOUD_OUTBOX: process.env.PRI_CLOUD_OUTBOX,
  } : null;
  if (!fixture) {
    const out = join(mkdtempSync(join(tmpdir(), 'pri-fixture-')), 'fixture.env');
    execFileSync(process.execPath, [join(HERE, 'cloud-fixture-server.mjs'), '--port', '4331', '--host', '127.0.0.1', '--out', out], { stdio: 'inherit' });
    fixture = Object.fromEntries(readFileSync(out, 'utf8').trim().split('\n').map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
    cloudServer = fixture;
  }
  if (!cloudServer && process.env.PRI_CLOUD_SERVER_LOG) fixture.PRI_CLOUD_SERVER_LOG = process.env.PRI_CLOUD_SERVER_LOG;
  // The codes: only those the server's TEST email adapter issued, from its
  // outbox, and only to the two fixture addresses of this leg.
  const addresses = [fixture.PRI_CLOUD_EMAIL, fixture.PRI_CLOUD_NEW_EMAIL].filter(Boolean).map(a => a.toLowerCase());
  const codeDesk = openServerDesk({ dbPath: fixture.PRI_CLOUD_DB, email: addresses[0], outboxPath: fixture.PRI_CLOUD_OUTBOX });
  const codeDir = mkdtempSync(join(tmpdir(), 'pri-cloud-oracle-'));
  const served = new Set();
  const codeTick = () => {
    for (const name of readdirSync(codeDir)) {
      const n = name.match(/^ask-(\d+)\.json$/)?.[1];
      if (!n || served.has(n)) continue;
      let ask = null;
      try { ask = JSON.parse(readFileSync(join(codeDir, name), 'utf8')); } catch { continue; }
      const to = String(ask.to || '').toLowerCase();
      if (ask.kind !== 'emailCode' || !addresses.includes(to)) {
        writeFileSync(join(codeDir, `reply-${n}.json`), JSON.stringify({ n: Number(n), reason: 'not a code this leg can read' }));
        served.add(n); continue;
      }
      const code = codeDesk.emailCode(to, ask.purpose || 'sign-in');
      if (!code) continue;   // not sent yet: ask again on the next tick
      writeFileSync(join(codeDir, `reply-${n}.json`), JSON.stringify({ n: Number(n), code }));
      served.add(n);
    }
  };
  const childEnv = {
    PRI_CLOUD_ORIGIN: fixture.PRI_CLOUD_ORIGIN, PRI_JOURNEY_EMAIL: addresses[0] || '', PRI_JOURNEY_NEW_EMAIL: (fixture.PRI_CLOUD_NEW_EMAIL || '').toLowerCase(),
    PRI_JOURNEY_ORACLE_DIR: codeDir,
  };
  // A fresh install: nothing on the device has an account yet.
  try { run('xcrun', ['simctl', 'terminate', udid, bundleId]); } catch { /* not running */ }
  try { run('xcrun', ['simctl', 'uninstall', udid, bundleId]); } catch { /* not installed */ }
  installApp(udid, app);
  const show = lines => { for (const line of lines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`); };
  const port = Number(fixture.PRI_CLOUD_PORT || new URL(fixture.PRI_CLOUD_ORIGIN).port);
  console.log(`\nCloud journey against ${fixture.PRI_CLOUD_ORIGIN} (real Pri server, fixture accounts) …`);
  if (childEnv.PRI_JOURNEY_NEW_EMAIL) {
    signupLines = launchAndRead(udid, bundleId, '--journey-cloud-signup', 'cloudSignUp', childEnv, { tick: codeTick });
    show(signupLines);
  }
  // A new launch numbers its asks from 1 again: start the relay empty.
  for (const name of readdirSync(codeDir)) rmSync(join(codeDir, name), { force: true });
  served.clear();
  cloudLines = launchAndRead(udid, bundleId, '--journey-cloud', 'cloud', childEnv, { tick: codeTick });
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
  // Server-side proof: the account the card made is deleted in the server's own database.
  if (childEnv.PRI_JOURNEY_NEW_EMAIL) {
    const live = codeDesk.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE email=? AND deleted_at IS NULL').get(childEnv.PRI_JOURNEY_NEW_EMAIL).n;
    const made = codeDesk.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE email=?').get(childEnv.PRI_JOURNEY_NEW_EMAIL).n;
    signupLines.push(live === 0 && made <= 1 ? `PRIJOURNEY ok serverDeletedAccountRefused no live account for the address (${made} row(s) kept as deleted)` : `PRIJOURNEY FAIL serverDeletedAccountRefused ${live} live account(s) for the deleted address`);
  }
  codeDesk.close();
} finally {
  // Never leave a fixture server behind, whatever failed.
  if (cloudServer?.PRI_CLOUD_SERVER_PID) { try { process.kill(Number(cloudServer.PRI_CLOUD_SERVER_PID)); } catch { /* already gone */ } }
}

let backgroundLines = [];
let a11yLines = [];
let dynamicLines = [];
// --lifecycle, --a11y and --dynamic-type run inside leg 2 (they need a signed-in student).
// `cloudEnv` points the app at the running server, so the gate can let the student in.
function optionalLegs(cloudEnv) {
if (WANT_LIFECYCLE) {
  console.log('\nBackground → foreground …');
  // The page types an unsent answer and then asks (ask-1.json through the
  // journey relay) to be backgrounded; the switch follows that request, not a
  // fixed delay, and the reply tells the page whether it happened.
  const relay = mkdtempSync(join(tmpdir(), 'pri-background-'));
  backgroundLines = launchAndRead(udid, bundleId, '--journey-background', 'background', { PRI_CLOUD_ORIGIN: cloudEnv.PRI_CLOUD_ORIGIN, PRI_JOURNEY_ORACLE_DIR: relay }, {
    duringWhen: () => existsSync(join(relay, 'ask-1.json')),
    during: () => {
      const t = Date.now();
      let switched = true, reason = '';
      try { run('xcrun', ['simctl', 'launch', udid, 'com.apple.Preferences'], { timeout: 240_000 }); } catch (e) { switched = false; reason = String(e?.message || e).split('\n')[0].slice(0, 80); }
      execSync('sleep 4');
      try { run('xcrun', ['simctl', 'launch', udid, bundleId], { timeout: 240_000 }); } catch { /* already running: brought forward */ }
      writeFileSync(join(relay, 'reply-1.json'), JSON.stringify({ n: 1, switched, reason, ms: Date.now() - t }));
      console.log(`  (switched to Settings and back in ${((Date.now() - t) / 1000).toFixed(1)} s)`);
    },
  });
  for (const line of backgroundLines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
}
if (WANT_A11Y) {
  console.log('\nAccessibility smoke in the real web view …');
  a11yLines = launchAndRead(udid, bundleId, '--journey-a11y', 'a11y', { PRI_CLOUD_ORIGIN: cloudEnv.PRI_CLOUD_ORIGIN });
  for (const line of a11yLines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
}

if (WANT_DYNAMIC) {
  console.log('\nLargest accessibility text size …');
  run('xcrun', ['simctl', 'ui', udid, 'content_size', 'accessibility-extra-extra-extra-large']);
  try { dynamicLines = launchAndRead(udid, bundleId, '--journey-dynamic-type', 'dynamicType', { PRI_CLOUD_ORIGIN: cloudEnv.PRI_CLOUD_ORIGIN }); }
  finally { try { run('xcrun', ['simctl', 'ui', udid, 'content_size', 'large']); } catch { /* best effort */ } }
  for (const line of dynamicLines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
}

}

// ── Leg 2 · a real local server marks the work ───────────────────────────────
// A fresh install: the student makes an account on the card with the server
// reachable. The address is the fixture server's never-registered one.
// DEBUG builds read PRI_CLOUD_ORIGIN from the launch environment (and accept
// http only for loopback); a Release build has neither (NativeCloudBridge.swift).
const READER_TEXT = '7';
const WRONG = '-987654';
let markingLines = [];
let markingRelaunchLines = [];
let markingNotMeasured = null;
let offlineDraftLines = [];
let offlineRelaunchLines = [];
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
    // The server's own database, read-only: the "teacher's desk" (shared with
    // the Android journey's relay, scripts/journey-oracle.mjs).
    const student = String(server.PRI_CLOUD_NEW_EMAIL || '').toLowerCase();
    if (!/@example\.test$/.test(student)) throw new Error('the local server named no fresh fixture address for the student');
    const offlineStudent = `journey-offline-${Date.now()}@example.test`;
    const desk = openServerDesk({ dbPath: server.PRI_CLOUD_DB, email: student, avoid: [READER_TEXT, WRONG], outboxPath: server.PRI_CLOUD_OUTBOX });
    const { db, rows, completed } = desk;
    /** The sealed answer of the question this account was issued last. */
    const sealedAnswer = () => ({ ...desk.sealedAnswer(), readerText: READER_TEXT });
    const oracleDir = mkdtempSync(join(tmpdir(), 'pri-oracle-'));
    const answered = new Set();
    const tick = () => {
      for (const name of readdirSync(oracleDir)) {
        const n = name.match(/^ask-(\d+)\.json$/)?.[1];
        if (!n || answered.has(n)) continue;
        let ask = null;
        try { ask = JSON.parse(readFileSync(join(oracleDir, name), 'utf8')); } catch { continue; }
        let reply;
        if (ask.kind === 'emailCode') {
          // Only the code the server issued to the student's address, from its
          // test outbox; until it is there, ask again on the next tick.
          const code = [student, offlineStudent].includes(ask.to) ? desk.emailCode(ask.to) : null;
          if (!code) continue;
          writeFileSync(join(oracleDir, `reply-${n}.json`), JSON.stringify({ n: Number(n), code }));
          answered.add(n);
          continue;
        }
        if (ask.kind === 'goOffline') {
          let offline = false, reason = '';
          try { process.kill(Number(server.PRI_CLOUD_SERVER_PID)); offline = true; } catch (error) { reason = String(error?.message || error).slice(0, 80); }
          if (offline) execSync('sleep 1');
          writeFileSync(join(oracleDir, `reply-${n}.json`), JSON.stringify({ n: Number(n), offline, reason }));
          answered.add(n);
          continue;
        }
        try { reply = ask.kind === 'answer' ? sealedAnswer() : { supported: false, reason: 'unknown question' }; }
        catch (error) { reply = { supported: false, reason: String(error?.message || error).slice(0, 120) }; }
        writeFileSync(join(oracleDir, `reply-${n}.json`), JSON.stringify({ n: Number(n), ...reply }));
        answered.add(n);
      }
    };

    try { run('xcrun', ['simctl', 'terminate', udid, bundleId]); } catch { /* not running */ }
    try { run('xcrun', ['simctl', 'uninstall', udid, bundleId]); } catch { /* not installed */ }
    installApp(udid, app);
    const childEnv = { PRI_CLOUD_ORIGIN: server.PRI_CLOUD_ORIGIN, PRI_JOURNEY_EMAIL: student, PRI_JOURNEY_ORACLE_DIR: oracleDir };
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
    verdict('serverAccountFromCard', () => {
      // The account the card made, as the server holds it, and the code it sent.
      const rowsFor = db.prepare('SELECT id, email_verified_at FROM accounts WHERE email=? AND deleted_at IS NULL').all(student);
      if (rowsFor.length !== 1) throw new Error(`${rowsFor.length} account(s) for the student's address, expected 1`);
      const sent = desk.sentTo(student);
      if (!sent.length) throw new Error('the server sent the student no sign-in code');
      const signIns = requests().filter(r => r.method === 'POST' && r.route === '/v1/account/otp/verify' && r.status === 200).length;
      return `1 account made through the card (${rowsFor[0].email_verified_at ? 'email verified' : 'email not marked verified'}); ${sent.length} sign-in code(s) sent by the TEST email adapter; ${signIns} code verification(s) answered 200`;
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

    markingRelaunchLines = launchAndRead(udid, bundleId, '--journey-marking-relaunch', 'markingRelaunch', childEnv);
    for (const line of markingRelaunchLines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);

    // The optional native legs, on this signed-in install while the server is up.
    optionalLegs(childEnv);

    // Leg 3 · the page asks, this process stops the server (goOffline above).
    console.log('\nLeg 3 · offline after entry: the work is an unmarkable draft and stays on the device …');
    // Each launch numbers its asks from 1 again: start the relay empty, so an
    // old reply is never read as this launch's answer.
    for (const name of readdirSync(oracleDir)) rmSync(join(oracleDir, name), { force: true });
    answered.clear();
    // Its own fresh install and address: the daily free-question cap is real
    // product behaviour, and the marking profile has used much of it.
    try { run('xcrun', ['simctl', 'terminate', udid, bundleId]); } catch { /* not running */ }
    try { run('xcrun', ['simctl', 'uninstall', udid, bundleId]); } catch { /* not installed */ }
    installApp(udid, app);
    const offlineEnv = { ...childEnv, PRI_JOURNEY_NEW_EMAIL: offlineStudent };
    offlineDraftLines = launchAndRead(udid, bundleId, '--journey-offline-draft', 'offlineDraft', offlineEnv, { tick, loops: 120 });
    for (const line of offlineDraftLines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
    offlineRelaunchLines = launchAndRead(udid, bundleId, '--journey-offline-relaunch', 'offlineRelaunch', offlineEnv);
    for (const line of offlineRelaunchLines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
    db.close();
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
  ...OFFLINE_DRAFT.map(n => [n, marked(offlineDraftLines, n)]),
  ...OFFLINE_RELAUNCH.map(n => [n, marked(offlineRelaunchLines, n)]),
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
    'the handwriting reader: a scripted stand-in at the provider hop that never looks at the picture', 'a fixture account verified in the local database', 'email delivery: the server\'s TEST email adapter (the code is read from its outbox, nothing is sent)'],
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
