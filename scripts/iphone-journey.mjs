#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · native student journey on an iOS simulator (CP-04/CP-05)
//
// Builds the canonical Apple package, installs it fresh on an iPhone (default)
// or iPad simulator and runs JourneySelfCheck.swift twice:
//   1. --journey-selfcheck : onboarding → practice → typed attempt marked →
//      feedback → next → native ink reading → progress → persistence marker;
//   2. --journey-relaunch  : after terminating the app, the profile and marker
//      survived the relaunch.
// Writes a machine-readable evidence record (exact SHA, simulator, OS, steps)
// with --evidence <file>. Labelled SYNTHETIC / SIMULATOR — never physical.
// CP-05 adds, on the same install:
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
import { tmpdir } from 'node:os';
import { engineeringPackage } from './apple-shipping-target.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PACKAGE = join(ROOT, 'ios/PriLearning.swiftpm');
const FIRST = ['launch', 'onboarding', 'practice', 'typedAttempt', 'feedback', 'nextQuestion', 'nativeInk', 'nativePhoto', 'progress', 'persistenceMarker'];
const RELAUNCH = ['relaunchProfile', 'relaunchMarker'];
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
  try { run('xcrun', ['simctl', 'bootstatus', device, '-b']); } catch { /* best effort */ }
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
  const rows = run('xcrun', ['simctl', 'list', 'devices', 'available']).split('\n')
    .map(l => l.match(/^\s+(.+?) \(([0-9A-F-]{36})\) \((\w+)\)/i)).filter(Boolean)
    .map(([, name, udid, state]) => ({ name, udid, state }))
    .filter(d => (named ? d.name === named : pattern.test(d.name)));
  const pick = rows.find(d => d.state === 'Booted') || rows[0];
  if (!pick) throw new Error(`no ${named || family} simulator is available`);
  return pick;
}

function ensureBooted({ name, udid }) {
  const booted = () => run('xcrun', ['simctl', 'list', 'devices']).split('\n').some(l => l.includes(udid) && /\(Booted\)/.test(l));
  if (booted()) return;
  console.log(`Booting ${name}…`);
  try { run('xcrun', ['simctl', 'boot', udid]); } catch { /* already booting */ }
  try { run('xcrun', ['simctl', 'bootstatus', udid, '-b']); } catch { /* poll below */ }
  for (let i = 0; i < 60 && !booted(); i++) execSync('sleep 2');
  if (!booted()) throw new Error(`${name} did not boot`);
}

function builtApp(derived) {
  const products = join(derived, 'Build/Products/Debug-iphonesimulator');
  const apps = existsSync(products) ? readdirSync(products).filter(n => n.endsWith('.app')) : [];
  if (apps.length !== 1) throw new Error(`expected one simulator .app, found ${apps.length}`);
  return join(products, apps[0]);
}

function launchAndRead(udid, bundleId, flag, phase, childEnv = {}, { during = null, duringAfterMs = 20_000 } = {}) {
  const started = localStamp(new Date(Date.now() - 2000));
  // SIMCTL_CHILD_* reaches the app's environment (DEBUG builds read the cloud
  // origin override and the journey's fixture account from it).
  const env = { ...process.env };
  for (const [k, v] of Object.entries(childEnv)) env[`SIMCTL_CHILD_${k}`] = v;
  launchApp(udid, bundleId, [flag], { env });
  let lines = [];
  const t0 = Date.now();
  let duringDone = !during;
  for (let i = 0; i < 75; i++) {
    execSync('sleep 2');
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
console.log(`Native student journey on ${sim.name} (${udid}) — SYNTHETIC / SIMULATOR evidence\n`);
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

const first = launchAndRead(udid, bundleId, '--journey-selfcheck', 'first');
for (const line of first) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
const second = launchAndRead(udid, bundleId, '--journey-relaunch', 'relaunch');
for (const line of second) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);

// Successful logouts in the fixture server's request log (null when unknown).
function serverLogouts(fixture) {
  try {
    const log = readFileSync(fixture.PRI_CLOUD_SERVER_LOG, 'utf8');
    return (log.match(/"path":"\/v1\/account\/logout","status":200/g) || []).length;
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

const result = (lines, name) => {
  const hit = lines.find(l => l.startsWith(`PRIJOURNEY ok ${name}`) || l.startsWith(`PRIJOURNEY FAIL ${name}`));
  return hit ? { ok: hit.startsWith('PRIJOURNEY ok'), detail: hit.replace(/^PRIJOURNEY (ok|FAIL) \S+\s*/, '') } : { ok: false, detail: 'not reported' };
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
  physicalDevice: false,
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
  ? `\nNATIVE JOURNEY: PASS — ${passed}/${total} steps on ${sim.name} (SYNTHETIC / SIMULATOR)`
  : `\nNATIVE JOURNEY: FAIL — ${passed}/${total} steps on ${sim.name}`);
process.exit(passed === total ? 0 : 1);
