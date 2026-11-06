// ─────────────────────────────────────────────────────────────────────────────
// Gate A: runs the native CAPTURE self-check on an iOS simulator and reports
// what it scored. Needs Xcode and a Mac; everything else in the test suite runs
// anywhere.
//
// Nothing native reads ink any more (owner decision 2026-10-02, default D16):
// the page draws the picture and the server reads it. What the shell must get
// right is capture — every stroke placed on the PencilKit surface reaches the
// page with every point and the Pencil signal (time, force, azimuth, altitude)
// intact, in the page's coordinate space — and placement, the surface sitting
// where the page said. InkSelfCheck.swift measures both deterministically with
// synthetic strokes; this script reads the result out of the system log and
// holds it to the floors below.
//
// It builds the app (or takes the one CI has already built, --app), discovers
// the product and bundle identifier from the actual build output, installs it,
// launches it with --ink-selfcheck, and reads the result back out of the
// system log. Discovering these values matters: a stale hard-coded bundle id
// previously let the app build and install and then made the release gate
// fail at launch with FrontBoard "application unknown".
//
// The simulator runtime is NAMED, never "the newest installed": on CI
// PRI_SIM_RUNTIME (or --runtime) is required, so a runner-image change cannot
// move this gate onto another iOS silently (scripts/simulator-fleet.mjs).
//
// Synthetic strokes on a simulator: a regression gate for capture, never
// Pencil, device or recognition evidence.
//
// Usage: npm run test:ink:native [-- --device "iPad Air 11-inch (M4)"] [-- --runtime 27.0]
//        node scripts/ink-native-check.mjs --app "$PRI_SIM_APP"   # CI: no second xcodebuild
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describeRuntimes, installApp, keepOnlySimulator, pickSimulator, requiredRuntime } from './simulator-fleet.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = join(HERE, '../ios/PriLearning.swiftpm');

// Release floors for capture fidelity. These are not estimates of real
// handwriting; they say the codec and the bridge lose nothing.
export const EXPECTED_CASES = 10;
// Every stroke of every case must come back: a dropped stroke is lost work.
export const STROKE_SURVIVAL_PCT = 100;
// The codec resamples PencilKit's path every 1.5 pt, and PencilKit smooths a
// control polygon; a returned path may differ from the drawn one by at most
// this, measured both ways (returned point → drawn polyline and drawn point →
// returned polyline). InkSelfCheck.swift holds the same floor
// (maxDeviationFloorPx); a regression in the transform, the units or the
// sampling shows up here before it shows up under a student's pen.
export const MAX_DEVIATION_PX = 2.0;

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : null;
};

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

function pickDevice() {
  const named = argOf('device');
  const runtime = requiredRuntime();
  const listing = run('xcrun', ['simctl', 'list', 'devices', 'available']);
  const pick = pickSimulator(listing, { family: 'iPad', named, runtime });
  if (!pick) {
    throw new Error(`no ${named || 'iPad'} simulator is available${runtime ? ` on the pinned iOS ${runtime} runtime` : ''} (installed: ${describeRuntimes(listing) || 'none'}). The runtime is named on purpose; install it rather than letting the gate move to another iOS.`);
  }
  return { ...pick, pinnedRuntime: runtime };
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

/** Pure: judge the PRIINK lines of one run. Exported for the deterministic test. */
export function judge(lines) {
  const summary = lines.find(l => l.includes('capture fidelity:'));
  const bridge = lines.find(l => l.startsWith('PRIINK bridge mounted='));
  const problems = [];
  let figures = null;
  if (!summary) {
    problems.push('the self-check did not report a capture-fidelity score');
  } else {
    const m = /capture fidelity: (\d+)\/(\d+) cases · strokes ([\d.]+)% \((\d+)\/(\d+)\) · max deviation ([\d.]+|inf|nan) px \(floor ([\d.]+)\) · fields (ok|BAD)/.exec(summary);
    if (!m) problems.push(`the capture-fidelity line could not be read: ${summary}`);
    else {
      figures = { passed: Number(m[1]), cases: Number(m[2]), strokePct: Number(m[3]), strokesBack: Number(m[4]), strokesSent: Number(m[5]), maxDeviation: Number(m[6]), floor: Number(m[7]), fields: m[8] };
      if (figures.cases !== EXPECTED_CASES) problems.push(`capture self-check ran ${figures.cases} cases; expected ${EXPECTED_CASES}`);
      if (figures.passed !== figures.cases) problems.push(`capture fidelity ${figures.passed}/${figures.cases} cases is below the ${figures.cases}/${figures.cases} floor`);
      if (!(figures.strokePct >= STROKE_SURVIVAL_PCT) || figures.strokesBack !== figures.strokesSent) problems.push(`strokes survived ${figures.strokesBack}/${figures.strokesSent}; every stroke must come back`);
      if (!(figures.maxDeviation <= MAX_DEVIATION_PX)) problems.push(`max point deviation ${figures.maxDeviation} px is above the ${MAX_DEVIATION_PX} px floor`);
      if (figures.floor !== MAX_DEVIATION_PX) problems.push(`the Swift self-check holds a different deviation floor (${figures.floor} px) from this gate (${MAX_DEVIATION_PX} px); keep them equal`);
      if (figures.fields !== 'ok') problems.push('a Pencil field (time, force, azimuth, altitude) or the JSON round trip was lost');
    }
  }
  // A draft restored on relaunch must come back exactly as the page sent it,
  // or each restore → save cycle moves the student's ink a little further.
  const restore = lines.find(l => l.includes('restore identity:'));
  if (!restore) problems.push('the self-check did not report restore identity');
  else {
    const r = /restore identity: (\d+)\/(\d+) cases · cycles=(\d+) identical=(yes|NO) new=(reencoded|BAD) altered=(reencoded|BAD)/.exec(restore);
    if (!r) problems.push(`the restore-identity line could not be read: ${restore}`);
    else {
      if (Number(r[2]) !== EXPECTED_CASES || r[1] !== r[2]) problems.push(`restore identity ${r[1]}/${r[2]} cases; every case must restore exactly`);
      if (!(Number(r[3]) >= 5)) problems.push(`restore identity ran ${r[3]} cycles; expected at least 5`);
      if (r[4] !== 'yes') problems.push('a restored stroke the student did not touch came back changed (draft drift)');
      if (r[5] !== 'reencoded') problems.push('a new stroke after a restore was not read from the canvas');
      if (r[6] !== 'reencoded') problems.push('a changed restored stroke was replaced by its stale original');
    }
  }
  if (!bridge) problems.push('the bridge smoke test did not report');
  else {
    const b = /mounted=(yes|NO) positioned=(yes|NO) strokesSent=(\d+) strokesBack=(\d+) placement=(ok|BAD)/.exec(bridge);
    if (!b) problems.push(`the bridge line could not be read: ${bridge}`);
    else {
      if (b[1] !== 'yes') problems.push('the writing surface did not mount');
      if (b[2] !== 'yes') problems.push('the writing surface was mispositioned');
      if (!(Number(b[4]) > 0) || b[3] !== b[4]) problems.push(`strokes did not survive the bridge round trip (${b[4]}/${b[3]})`);
      if (b[5] !== 'ok') problems.push('the placement maths at a page scale other than 1 is wrong');
    }
  }
  return { problems, figures };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith('ink-native-check.mjs')) {
  const sim = pickDevice();
  const device = sim.udid;
  console.log(`Native capture self-check on ${sim.name} (${device}, ${sim.runtime}${sim.pinnedRuntime ? `, pinned to iOS ${sim.pinnedRuntime}` : ', runtime not pinned: local run'})\n`);
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
  // Read the log from the launch onwards, not a sliding "--last 3m" window: on
  // a cold hosted runner one `log show` can take long enough that lines the
  // app wrote at launch slide out of a window measured from each query (the
  // iOS 27 lane polled for 7.5 minutes and saw nothing).
  const pad = n => String(n).padStart(2, '0');
  const t0 = new Date(Date.now() - 5000);
  const since = `${t0.getFullYear()}-${pad(t0.getMonth() + 1)}-${pad(t0.getDate())} ${pad(t0.getHours())}:${pad(t0.getMinutes())}:${pad(t0.getSeconds())}`;
  const launchedAt = Date.now();
  const launch = run('xcrun', ['simctl', 'launch', device, bundleId, '--ink-selfcheck']);
  console.log(`  launched: ${String(launch).trim()}`);

  let lines = [];
  for (let i = 0; i < 40; i++) {
    execSync('sleep 2');
    const log = run('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--start', since,
      '--predicate', 'eventMessage CONTAINS "PRIINK"', '--style', 'compact'],
      { maxBuffer: 32 * 1024 * 1024 });
    lines = log.split('\n')
      .filter(l => l.includes('PRIINK') && !l.includes("'log'"))
      .map(l => l.slice(l.indexOf('PRIINK')));
    if (lines.some(l => l.startsWith('PRIINK bridge mounted'))) break;
  }

  // The log window can still hold an earlier run; only the latest one is this
  // run's result.
  const started = lines.map((l, i) => [l, i]).filter(([l]) => l.includes('native capture self-check'));
  if (started.length) lines = lines.slice(started[started.length - 1][1]);
  for (const line of lines) console.log(`  ${line.replace(/^PRIINK\s*/, '')}`);

  const { problems, figures } = judge(lines);
  console.log('');
  if (problems.length) {
    for (const problem of problems) console.log(`FAIL — ${problem}`);
    // Say why: is the app still running, and what did it log since launch?
    console.log(`\n  ${((Date.now() - launchedAt) / 1000).toFixed(0)} s after launch. App log since ${since} (last 40 lines):`);
    try {
      const own = run('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--start', since,
        '--predicate', `process == "${app.split('/').pop().replace(/\.app$/, '')}"`, '--style', 'compact'],
        { maxBuffer: 32 * 1024 * 1024 });
      for (const l of String(own).trim().split('\n').slice(-40)) console.log(`    ${l}`);
    } catch (error) { console.log(`    (log show failed: ${error.message.split('\n')[0]})`); }
    try { console.log(`  running apps: ${run('xcrun', ['simctl', 'spawn', device, 'launchctl', 'list']).split('\n').filter(l => /prilearning/i.test(l)).join(' | ') || 'none matching com.prilearning'}`); } catch { /* best effort */ }
    process.exit(1);
  }
  console.log(`PASS — capture fidelity ${figures.passed}/${figures.cases} cases, ${figures.strokesBack}/${figures.strokesSent} strokes back, max deviation ${figures.maxDeviation} px (floor ${MAX_DEVIATION_PX}), Pencil fields intact, bridge mounted and positioned on ${sim.name} (${sim.runtime}). Synthetic strokes on a simulator: capture evidence only.`);
}
