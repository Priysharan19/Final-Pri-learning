// ─────────────────────────────────────────────────────────────────────────────
// Runs the NATIVE reading pipeline's self-check on an iPad simulator and
// reports what it scored. Needs Xcode and a Mac; everything else in the test
// suite runs anywhere.
//
// It builds the app, installs it, launches it with --ink-selfcheck, and reads
// the result back out of the system log. It fails when the character accuracy
// drops below the floor below, or when the bridge smoke test does not pass —
// so a change that quietly breaks the writing surface is caught here rather
// than by a student.
//
// Usage: npm run test:ink:native [-- --device "iPad Air 11-inch (M4)"]
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = join(HERE, '../ios/PriLearning.swiftpm');
const BUNDLE_ID = 'com.prilearning.app';

// The floor, not the target. It is set below the score the pipeline reaches so
// that ordinary drift does not fail the build, and far enough above chance
// that a broken stage cannot slip through.
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
  // simctl bootstatus can hang past the point the device is usable; polling the
  // device list is the thing that actually settles.
  for (let i = 0; i < 60; i++) {
    if (/Booted/.test(run('xcrun', ['simctl', 'list', 'devices']).split('\n')
      .filter(l => l.includes(device)).join('\n'))) return;
    execSync('sleep 2');
  }
  throw new Error(`${device} did not boot`);
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

const app = join(derived, 'Build/Products/Debug-iphonesimulator/Pri Learning.app');
try { run('xcrun', ['simctl', 'terminate', device, BUNDLE_ID]); } catch { /* not running */ }
run('xcrun', ['simctl', 'install', device, app]);
console.log('Running…');
run('xcrun', ['simctl', 'launch', device, BUNDLE_ID, '--ink-selfcheck']);

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
