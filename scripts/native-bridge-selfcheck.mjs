#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priNative bridge self-check on an iOS simulator (CP-02)
//
// Builds the canonical Apple package, installs it on an iPad or iPhone
// simulator, launches it with --bridge-selfcheck and reads the PRIBRIDGE log
// lines BridgeSelfCheck.swift writes from inside the real WKWebView:
// deep-frozen host descriptor, no OS identity, main-frame envelope round trip,
// and a same-origin subframe refused by the sender gate.
//
//   node scripts/native-bridge-selfcheck.mjs --family ipad
//   node scripts/native-bridge-selfcheck.mjs --family iphone
//   node scripts/native-bridge-selfcheck.mjs --device "iPhone 17e"
//
// Synthetic simulator evidence. It is never evidence about a physical device.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { engineeringPackage } from './apple-shipping-target.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = join(HERE, '../ios/PriLearning.swiftpm');
const EXPECTED = ['hostPresent', 'deepFrozen', 'notReplaceable', 'noOsIdentity', 'mainRoundTrip', 'subframeRefused', 'subframeHasNoHost', 'inkPlacementZoom'];

// `log show --start` takes LOCAL time; a UTC stamp would re-read hours of old runs.
const localStamp = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const argOf = name => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : null;
};
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
  const family = (argOf('family') || 'ipad').toLowerCase();
  const pattern = named ? null : (family === 'iphone' ? /iPhone/ : /iPad/);
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
  // On a CI runner a second booted simulator (the iPad from earlier steps)
  // starves this boot; a person's own simulators are never touched locally.
  if (process.env.CI) {
    for (const line of run('xcrun', ['simctl', 'list', 'devices']).split('\n')) {
      const other = line.match(/\(([0-9A-F-]{36})\) \(Booted\)/i)?.[1];
      if (other && other !== udid) { console.log(`  shutting down booted simulator ${other} (CI)`); try { run('xcrun', ['simctl', 'shutdown', other]); } catch { /* already down */ } }
    }
  }
  console.log(`Booting ${name}…`);
  try { run('xcrun', ['simctl', 'boot', udid]); } catch { /* already booting */ }
  try { run('xcrun', ['simctl', 'bootstatus', udid, '-b'], { timeout: 600_000 }); } catch { /* fall back to polling */ }
  for (let i = 0; i < 60 && !booted(); i++) execSync('sleep 2');
  if (!booted()) throw new Error(`${name} did not boot`);
}

function builtApp(derived) {
  const products = join(derived, 'Build/Products/Debug-iphonesimulator');
  const apps = existsSync(products) ? readdirSync(products).filter(n => n.endsWith('.app')) : [];
  if (apps.length !== 1) throw new Error(`expected one simulator .app, found ${apps.length}`);
  return join(products, apps[0]);
}

const sim = pickDevice();
const device = sim.udid;
const udid = device;
console.log(`priNative bridge self-check on ${sim.name} (${sim.udid}) (synthetic simulator evidence)\n`);
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
try { run('xcrun', ['simctl', 'terminate', device, bundleId]); } catch { /* not running */ }
run('xcrun', ['simctl', 'install', device, app]);
const started = localStamp(new Date(Date.now() - 2000));
launchApp(device, bundleId, ['--bridge-selfcheck']);

let lines = [];
// A cold CI simulator can take minutes to start WebKit's processes on first launch.
const polls = process.env.CI ? 120 : 45;
for (let i = 0; i < polls; i++) {
  execSync('sleep 2');
  const log = run('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--start', started,
    '--predicate', 'eventMessage CONTAINS "PRIBRIDGE"', '--style', 'compact']);
  lines = log.split('\n').filter(l => l.includes('PRIBRIDGE') && !l.includes("'log'")).map(l => l.slice(l.indexOf('PRIBRIDGE')));
  const startAt = lines.lastIndexOf('PRIBRIDGE bridge self-check started');
  lines = startAt >= 0 ? lines.slice(startAt) : [];
  if (lines.some(l => l.startsWith('PRIBRIDGE summary'))) break;
}
// Without a summary, say why before tearing down: is the app alive, what did it
// log, did it crash. Diagnostics only — they never change the verdict.
if (!lines.some(l => l.startsWith('PRIBRIDGE summary'))) {
  const show = (label, fn) => { try { console.log(`  [diag] ${label}:\n${fn().split('\n').slice(-60).map(l => `    ${l}`).join('\n')}`); } catch (e) { console.log(`  [diag] ${label}: ${String(e.message || e).split('\n')[0]}`); } };
  show('app process', () => run('xcrun', ['simctl', 'spawn', device, 'launchctl', 'list']).split('\n').filter(l => l.includes(bundleId)).join('\n') || '(not running)');
  show('app log', () => run('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--start', started, '--style', 'compact',
    '--predicate', `process CONTAINS "Pri" OR subsystem CONTAINS "${bundleId}" OR eventMessage CONTAINS "${bundleId}"`]));
  show('crash reports', () => run('/bin/sh', ['-c', 'ls -t ~/Library/Logs/DiagnosticReports 2>/dev/null | grep -i pri | head -3 | while read f; do echo "== $f"; head -60 ~/Library/Logs/DiagnosticReports/"$f"; done']) || '(none)');
}
try { run('xcrun', ['simctl', 'terminate', device, bundleId]); } catch { /* already gone */ }
for (const line of lines) console.log(`  ${line.replace(/^PRIBRIDGE\s*/, '')}`);

const passed = EXPECTED.filter(key => lines.includes(`PRIBRIDGE ok ${key}`));
const summary = lines.find(l => l.startsWith('PRIBRIDGE summary'));
const ok = passed.length === EXPECTED.length && summary === 'PRIBRIDGE summary 0 failure(s)';
console.log(ok
  ? `\nNATIVE BRIDGE SELF-CHECK: PASS — ${passed.length}/${EXPECTED.length} on ${sim.name} (simulator)`
  : `\nNATIVE BRIDGE SELF-CHECK: FAIL — ${passed.length}/${EXPECTED.length} on ${sim.name}; ${summary || 'no summary logged'}`);
process.exit(ok ? 0 : 1);
