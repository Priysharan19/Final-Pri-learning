// ─────────────────────────────────────────────────────────────────────────────
// Runs the NATIVE reading pipeline's self-check on an iPad simulator and
// reports what it scored. Needs Xcode and a Mac; everything else in the test
// suite runs anywhere.
//
// It builds the app (or takes the one CI has already built, --app), discovers
// the product and bundle identifier from the actual build output, installs it,
// launches it with --ink-selfcheck, and reads the result back out of the
// system log. Discovering these values matters: a stale hard-coded bundle id
// previously let the app build and install and then made the release gate
// fail at launch with FrontBoard "application unknown".
//
// The native benchmark is deterministic synthetic ink. It is not a claim about
// arbitrary real handwriting, but it IS a regression gate for the full shipped
// PencilKit → Vision → maths-decoder pipeline. Once that pipeline reaches an
// exact benchmark result, a later release is not allowed to trade exact
// structure away while hiding behind a high per-character percentage.
//
// Usage: npm run test:ink:native [-- --device "iPad Air 11-inch (M4)"]
//        node scripts/ink-native-check.mjs --app "$PRI_SIM_APP"   # CI: no second xcodebuild
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { installApp, keepOnlySimulator, parseDevices } from './simulator-fleet.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = join(HERE, '../ios/PriLearning.swiftpm');

// These are release floors, not estimates of real-writer accuracy. The current
// benchmark reaches 10/10 exact and 100.0% characters on the macOS/iPad runner.
// Exact-expression accuracy is the stronger gate because a single structural
// error can change the mathematics while barely moving character accuracy.
const ACCURACY_FLOOR = 99.5;
const EXPECTED_CASES = 10;
const EXACT_FLOOR = 10;

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : null;
};

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

function pickDevice() {
  const named = argOf('device');
  const rows = parseDevices(run('xcrun', ['simctl', 'list', 'devices', 'available']));
  const matching = rows.filter(d => (named ? d.name === named : /iPad/.test(d.name)));
  const pick = matching.find(d => d.state === 'Booted') || matching[0];
  if (!pick) throw new Error(`no ${named || 'iPad'} simulator is available`);
  return pick;
}

function ensureBooted({ name, udid }) {
  const booted = () => run('xcrun', ['simctl', 'list', 'devices']).split('\n').some(l => l.includes(udid) && /\(Booted\)/.test(l));
  // A CI runner carries one booted simulator, whether or not this one must
  // boot: another family left booted by an earlier step starves this one
  // (scripts/simulator-fleet.mjs). A person's own simulators are never touched.
  keepOnlySimulator(udid);
  if (booted()) return;
  console.log(`Booting ${name}…`);
  try { run('xcrun', ['simctl', 'boot', udid]); } catch { /* already booting */ }
  try { run('xcrun', ['simctl', 'bootstatus', udid, '-b'], { timeout: 600_000 }); } catch { /* poll below */ }
  for (let i = 0; i < 60 && !booted(); i++) execSync('sleep 2');
  if (!booted()) throw new Error(`${name} did not boot`);
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

const sim = pickDevice();
const device = sim.udid;
console.log(`Native ink self-check on ${sim.name} (${device})\n`);
ensureBooted(sim);

// CI builds the canonical package once and hands the .app to every step
// (--app); a second xcodebuild here cost 4–5 minutes of a 60-minute job.
let app = argOf('app');
if (app) {
  if (!existsSync(join(app, 'Info.plist'))) throw new Error(`--app is not a built simulator app: ${app}`);
} else {
  const derived = mkdtempSync(join(tmpdir(), 'pri-ink-'));
  console.log('Building…');
  run('xcodebuild', [
    '-scheme', 'PriLearning',
    '-destination', `platform=iOS Simulator,id=${device}`,
    '-derivedDataPath', derived,
    'build'
  ], { cwd: PACKAGE, maxBuffer: 64 * 1024 * 1024 });
  app = builtApp(derived);
}

const bundleId = bundleIdentifier(app);
console.log(`${argOf('app') ? 'Using' : 'Built'} ${app.split('/').pop()} (${bundleId})`);
try { run('xcrun', ['simctl', 'terminate', device, bundleId]); } catch { /* not running */ }
const install = installApp(device, app);
const installed = verifyInstalled(device, bundleId);
console.log(`Installed ${bundleId} at ${installed} (${(install.ms / 1000).toFixed(1)} s, attempt ${install.attempt})`);
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
const exactMatch = summary ? /(\d+)\/(\d+) exact/.exec(summary) : null;
const exact = Number(exactMatch?.[1] ?? 0);
const cases = Number(exactMatch?.[2] ?? 0);

const problems = [];
if (!summary) {
  problems.push('the self-check did not report a score');
} else {
  if (accuracy < ACCURACY_FLOOR) {
    problems.push(`character accuracy ${accuracy}% is below the ${ACCURACY_FLOOR}% floor`);
  }
  if (!exactMatch) {
    problems.push('the self-check did not report exact-expression coverage');
  } else if (cases !== EXPECTED_CASES) {
    problems.push(`native benchmark ran ${cases} cases; expected ${EXPECTED_CASES}`);
  } else if (exact < EXACT_FLOOR) {
    problems.push(`exact expressions ${exact}/${cases} is below the ${EXACT_FLOOR}/${EXPECTED_CASES} floor`);
  }
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
console.log(`PASS — character accuracy ${accuracy}%, exact ${exact}/${cases}, bridge round trip clean`);
