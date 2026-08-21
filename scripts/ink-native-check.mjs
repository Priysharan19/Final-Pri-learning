// ─────────────────────────────────────────────────────────────────────────────
// Runs the NATIVE reading pipeline's self-check on an iPad simulator and
// reports what it scored. Needs Xcode and a Mac; everything else in the test
// suite runs anywhere.
//
// It builds the app, installs it, launches it with --ink-selfcheck, and reads
// the result back out of the system log. It fails when either accuracy or exact
// expression coverage regresses, when the deterministic geometry checks fail,
// or when the bridge smoke test does not pass.
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

// Floors prevent regression; they are deliberately not presented as targets.
// V9 has now demonstrated 99.0% characters and 9/10 exact on this fixed native
// simulator corpus. A future change is not allowed to quietly fall back to the
// old 85% / 6-of-10 gate and still call itself healthy.
const ACCURACY_FLOOR = 99;
const EXACT_FLOOR = 9;
const EXPECTED_CASES = 10;
const EXPECTED_GEOMETRY_CHECKS = 10;

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
  // Do not stop at the bridge line: geometry intentionally runs after the
  // Vision benchmark, and an early break used to produce a false "not
  // reported" failure even when the app was still finishing its checks.
  const hasSummary = lines.some(l => l.includes('character accuracy'));
  const hasBridge = lines.some(l => l.startsWith('PRIINK bridge mounted'));
  const hasGeometry = lines.some(l => l.startsWith('PRIINK geometry '));
  if (hasSummary && hasBridge && hasGeometry) break;
}

// The log window can still hold an earlier run; only the latest one is this
// run's result.
const started = lines.map((l, i) => [l, i]).filter(([l]) => l.includes('native ink self-check'));
if (started.length) lines = lines.slice(started[started.length - 1][1]);
for (const line of lines) console.log(`  ${line.replace(/^PRIINK\s*/, '')}`);

const summary = lines.find(l => l.includes('character accuracy'));
const bridge = lines.find(l => l.startsWith('PRIINK bridge mounted'));
const geometry = [...lines].reverse().find(l => l.startsWith('PRIINK geometry '));
const accuracy = summary ? Number(/accuracy ([\d.]+)%/.exec(summary)?.[1] ?? 0) : 0;
const exactMatch = summary ? /(\d+)\/(\d+) exact/.exec(summary) : null;
const exact = Number(exactMatch?.[1] ?? 0);
const cases = Number(exactMatch?.[2] ?? 0);
const geometryMatch = geometry ? /PASS (\d+)\/(\d+)/.exec(geometry) : null;
const geometryPassed = Number(geometryMatch?.[1] ?? 0);
const geometryCases = Number(geometryMatch?.[2] ?? 0);
const perf = lines
  .map(l => /PRIINK perf recognition .* ([\d.]+)ms/.exec(l))
  .filter(Boolean)
  .map(m => Number(m[1]));

const problems = [];
if (!summary) problems.push('the self-check did not report a score');
else {
  if (accuracy < ACCURACY_FLOOR) {
    problems.push(`character accuracy ${accuracy}% is below the ${ACCURACY_FLOOR}% floor`);
  }
  if (cases !== EXPECTED_CASES) {
    problems.push(`native benchmark ran ${cases} cases; expected ${EXPECTED_CASES}`);
  } else if (exact < EXACT_FLOOR) {
    problems.push(`exact expressions ${exact}/${cases} is below the ${EXACT_FLOOR}/${EXPECTED_CASES} floor`);
  }
}
if (!geometry) problems.push('the deterministic geometry checks did not report');
else if (!geometryMatch || geometryPassed !== EXPECTED_GEOMETRY_CHECKS || geometryCases !== EXPECTED_GEOMETRY_CHECKS) {
  problems.push(`geometry regression check failed: ${geometry.replace(/^PRIINK\s*/, '')}`);
}
if (!bridge) problems.push('the bridge smoke test did not report');
else {
  if (!/mounted=yes/.test(bridge)) problems.push('the writing surface did not mount');
  if (!/positioned=yes/.test(bridge)) problems.push('the writing surface was mispositioned');
  if (!/strokesBack=[1-9]/.test(bridge)) problems.push('strokes did not survive the round trip');
  if (!/readShape=ok/.test(bridge)) problems.push('the reading was not in the shape the page expects');
}

console.log('');
if (perf.length) {
  const sorted = [...perf].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(`Simulator recognition timing sample: median ${median.toFixed(1)} ms across ${perf.length} bridge reading(s).`);
  console.log('This is software recognition time, not Apple Pencil touch-to-photon latency.');
}
if (problems.length) {
  for (const problem of problems) console.log(`FAIL — ${problem}`);
  process.exit(1);
}
console.log(`PASS — character accuracy ${accuracy}%, exact ${exact}/${cases}, geometry ${geometryPassed}/${geometryCases}, bridge round trip clean`);
