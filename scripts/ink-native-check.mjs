// ─────────────────────────────────────────────────────────────────────────────
// Runs the NATIVE reading pipeline's self-check on an iPad simulator and
// reports what it scored. Needs Xcode and a Mac; everything else in the test
// suite runs anywhere.
//
// It builds the app, discovers the product and bundle identifier from the
// actual build output, installs it, launches it with --ink-selfcheck, and reads
// the result back out of the system log. Discovering these values matters: a
// stale hard-coded bundle id previously let the app build and install and then
// made the release gate fail at launch with FrontBoard "application unknown".
//
// Usage: npm run test:ink:native [-- --device "iPad Air 11-inch (M4)"]
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = join(HERE, '../ios/PriLearning.swiftpm');

// The floor, not the target. It is deliberately conservative until the native
// benchmark itself is expanded; synthetic/browser accuracy is gated elsewhere.
const ACCURACY_FLOOR = 85;

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : null;
};

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

function pickDevice() {
  const named = argOf('device');
  if (named) return named;
  const list = run('xcrun', ['simctl', 'list', 'devices', 'available']);
  const booted = list.split('\n').find(l => /iPad/.test(l) && /Booted/.test(l));
  const any = list.split('\n').find(l => /iPad/.test(l));
  const line = booted || any;
  if (!line) throw new Error('no iPad simulator is available');
  return line.trim().replace(/\s*\([0-9A-F-]{36}\).*$/i, '');
}

function ensureBooted(device) {
  const list = run('xcrun', ['simctl', 'list', 'devices']);
  if (new RegExp(`${device.replace(/[()]/g, '\\$&')}.*Booted`).test(list)) return;
  console.log(`Booting ${device}…`);
  try { run('xcrun', ['simctl', 'boot', device]); } catch { /* already booting */ }
  for (let i = 0; i < 60; i++) {
    if (/Booted/.test(run('xcrun', ['simctl', 'list', 'devices']).split('\n')
      .filter(l => l.includes(device)).join('\n'))) return;
    execSync('sleep 2');
  }
  throw new Error(`${device} did not boot`);
}

function builtApp(derived) {
  const products = join(derived, 'Build/Products/Debug-iphonesimulator');
  if (!existsSync(products)) throw new Error(`Xcode produced no simulator products at ${products}`);
  const apps = readdirSync(products).filter(name => name.endsWith('.app')).sort();
  if (apps.length !== 1) {
    throw new Error(`expected exactly one simulator .app, found ${apps.length}: ${apps.join(', ') || 'none'}`);
  }
  return join(products, apps[0]);
}

function bundleIdentifier(app) {
  const plist = join(app, 'Info.plist');
  if (!existsSync(plist)) throw new Error(`built app has no Info.plist: ${plist}`);
  const id = run('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', plist]).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]+$/.test(id)) throw new Error(`invalid CFBundleIdentifier in built app: ${id}`);
  return id;
}

function verifyInstalled(device, bundleId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const path = run('xcrun', ['simctl', 'get_app_container', device, bundleId, 'app']).trim();
      if (path) return path;
    } catch { /* SpringBoard may need a moment to register the install */ }
    execSync('sleep 1');
  }
  throw new Error(`simulator did not register installed app ${bundleId}`);
}

const device = pickDevice();
console.log(`Native ink self-check on ${device}\n`);
ensureBooted(device);

const derived = mkdtempSync(join(tmpdir(), 'pri-ink-'));
console.log('Building…');
run('xcodebuild', [
  '-scheme', 'PriLearning',
  '-destination', `platform=iOS Simulator,name=${device}`,
  '-derivedDataPath', derived,
  'build'
], { cwd: PACKAGE, maxBuffer: 64 * 1024 * 1024 });

const app = builtApp(derived);
const bundleId = bundleIdentifier(app);
console.log(`Built ${app.split('/').pop()} (${bundleId})`);
try { run('xcrun', ['simctl', 'terminate', device, bundleId]); } catch { /* not running */ }
run('xcrun', ['simctl', 'install', device, app]);
const installed = verifyInstalled(device, bundleId);
console.log(`Installed ${bundleId} at ${installed}`);
console.log('Running…');
run('xcrun', ['simctl', 'launch', device, bundleId, '--ink-selfcheck']);

let lines = [];
for (let i = 0; i < 40; i++) {
  execSync('sleep 2');
  const log = run('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--last', '3m',
    '--predicate', 'eventMessage CONTAINS "PRIINK"', '--style', 'compact'],
    { maxBuffer: 32 * 1024 * 1024 });
  lines = log.split('\n')
    .filter(l => l.includes('PRIINK') && !l.includes("'log'"))
    .map(l => l.slice(l.indexOf('PRIINK')));
  if (lines.some(l => l.startsWith('PRIINK bridge mounted'))) break;
}

// The log window can still hold an earlier run; only the latest one is this
// run's result.
const started = lines.map((l, i) => [l, i]).filter(([l]) => l.includes('native ink self-check'));
if (started.length) lines = lines.slice(started[started.length - 1][1]);
for (const line of lines) console.log(`  ${line.replace(/^PRIINK\s*/, '')}`);

const summary = lines.find(l => l.includes('character accuracy'));
const bridge = lines.find(l => l.startsWith('PRIINK bridge mounted'));
const accuracy = summary ? Number(/accuracy ([\d.]+)%/.exec(summary)?.[1] ?? 0) : 0;

const problems = [];
if (!summary) problems.push('the self-check did not report a score');
else if (accuracy < ACCURACY_FLOOR) {
  problems.push(`character accuracy ${accuracy}% is below the ${ACCURACY_FLOOR}% floor`);
}
if (!bridge) problems.push('the bridge smoke test did not report');
else {
  if (!/mounted=yes/.test(bridge)) problems.push('the writing surface did not mount');
  if (!/positioned=yes/.test(bridge)) problems.push('the writing surface was mispositioned');
  if (!/strokesBack=[1-9]/.test(bridge)) problems.push('strokes did not survive the round trip');
  if (!/readShape=ok/.test(bridge)) problems.push('the reading was not in the shape the page expects');
}

console.log('');
if (problems.length) {
  for (const problem of problems) console.log(`FAIL — ${problem}`);
  process.exit(1);
}
console.log(`PASS — character accuracy ${accuracy}%, bridge round trip clean`);
