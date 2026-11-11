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
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describeRuntimes, installApp, keepOnlySimulator, pickSimulator, requiredRuntime } from './simulator-fleet.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = join(HERE, '../ios/PriLearning.swiftpm');
const EXPECTED = ['hostPresent', 'deepFrozen', 'notReplaceable', 'noOsIdentity', 'mainRoundTrip', 'subframeRefused', 'subframeReachThroughRefused', 'subframeHasNoHost', 'inkPlacementZoom'];
// The content-process leg: this process ends the app's real WebContent process
// (SIGKILL, as iOS's memory pressure does) with the native ink surface mounted.
const CONTENT_END = ['inkMountedBeforeContentEnd', 'pageAliveAfterContentEnd', 'bridgeAfterContentEnd', 'inkDroppedAfterContentEnd', 'recoveryPolicy'];

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


// The device is chosen as every harness script chooses it
// (scripts/simulator-fleet.mjs pickSimulator): a booted match first, else the
// newest that satisfies the PINNED runtime. It once took the newest runtime
// installed, so on the iOS 27 lane the iPhone self-check booted an iOS 27.2
// phone the journey then shut down for its own iOS 27.0 one: two cold boots
// (about seven minutes each) and a self-check off the pinned iOS.
// The pin is read when a device is picked, never at import: a suite that
// imports judgeContentEnd under CI=true has no PRI_SIM_RUNTIME and no simulator.
function pickDevice() {
  const PINNED_RUNTIME = requiredRuntime();
  const named = argOf('device');
  const family = (argOf('family') || 'ipad').toLowerCase() === 'iphone' ? 'iPhone' : 'iPad';
  const listing = run('xcrun', ['simctl', 'list', 'devices', 'available']);
  const pick = pickSimulator(listing, { family, named, runtime: PINNED_RUNTIME });
  if (!pick) throw new Error(`no ${named || family} simulator is available${PINNED_RUNTIME ? ` on the pinned iOS ${PINNED_RUNTIME} runtime` : ''} (installed: ${describeRuntimes(listing) || 'none'})`);
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

/** The content-process leg's verdict from the app's PRIBRIDGE lines. */
export function judgeContentEnd(lines) {
  const problems = [];
  const ended = lines.filter(l => l.startsWith('PRIBRIDGE contentProcessEnded'))
    .map(l => { const m = l.match(/n=(\d+) action=(\w+) inkMounted=(\w+)/); return m ? { n: Number(m[1]), action: m[2], ink: m[3] === 'true' } : null; })
    .filter(Boolean);
  // The first reload is judged in full; later loads are killed mid-way on purpose.
  for (const key of CONTENT_END) if (!lines.some(l => l === `PRIBRIDGE ok ${key}` || l === `PRIBRIDGE ok ${key} (load 1)`)) problems.push(`${key} not ok`);
  if (!ended.length) problems.push('the shell never saw its content process end');
  else {
    if (ended[0].n !== 1 || ended[0].action !== 'reload') problems.push(`first end was ${JSON.stringify(ended[0])}, not a reload`);
    if (ended.some(e => e.ink)) problems.push('the ink surface was still mounted after the content process ended');
    if (ended.some(e => e.action === 'reload' && e.n > 2)) problems.push('reloaded more than twice inside 30 s');
  }
  const stopped = ended.find(e => e.action === 'stopped');
  if (!stopped) problems.push('repeated ends never stopped the reloads');
  else if (stopped.n !== 3) problems.push(`stopped at end ${stopped.n}, not the third inside 30 s`);
  if (!lines.includes('PRIBRIDGE contentStopped shown')) problems.push('the native stopped screen was not shown');
  if (!lines.some(l => l === 'PRIBRIDGE recovery 1 summary 0 failure(s)')) problems.push('the first reload did not pass every check');
  return { ok: problems.length === 0, problems, stoppedAt: stopped?.n };
}

if (process.argv[1] && fileURLToPath(import.meta.url) !== process.argv[1]) { /* imported for its judge */ } else main();
function main() {
const sim = pickDevice();
const device = sim.udid;
const udid = device;
console.log(`priNative bridge self-check on ${sim.name} (${sim.udid}) (synthetic simulator evidence)\n`);
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
try { run('xcrun', ['simctl', 'terminate', device, bundleId]); } catch { /* not running */ }
installApp(device, app);
// BridgeSelfCheck.say also writes every PRIBRIDGE line to
// Documents/PRIBRIDGE.log in the app's container. On the hosted iOS 27 image
// `log show` returned nothing for the app and this step ran 47 minutes into the
// job timeout, so the file is read first, a stale one is removed before
// launch, and every `log show` has a hard timeout.
let reportFile = null;
try {
  const container = run('xcrun', ['simctl', 'get_app_container', device, bundleId, 'data'], { timeout: 60_000 }).trim();
  if (container) { reportFile = join(container, 'Documents', 'PRIBRIDGE.log'); rmSync(reportFile, { force: true }); }
} catch { /* no data container yet: the log is the only channel */ }
const fromFile = () => {
  try { return reportFile && existsSync(reportFile) ? readFileSync(reportFile, 'utf8').split('\n').filter(l => l.startsWith('PRIBRIDGE')) : []; }
  catch { return []; }
};
const fromLog = () => {
  try {
    return run('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--start', started,
      '--predicate', 'eventMessage CONTAINS "PRIBRIDGE"', '--style', 'compact'], { timeout: 90_000 })
      .split('\n').filter(l => l.includes('PRIBRIDGE') && !l.includes("'log'")).map(l => l.slice(l.indexOf('PRIBRIDGE')));
  } catch { return []; }
};
const started = localStamp(new Date(Date.now() - 2000));
launchApp(device, bundleId, ['--bridge-selfcheck', '--bridge-content-end']);

let lines = [];
let source = 'none';
// A cold CI simulator can take minutes to start WebKit's processes on first launch.
const polls = process.env.CI ? 120 : 45;
const deadline = Date.now() + polls * 2_000 + 120_000;
for (let i = 0; i < polls && Date.now() < deadline; i++) {
  execSync('sleep 2');
  const filed = fromFile();
  if (filed.length) { lines = filed; source = 'container file'; }
  else { lines = fromLog(); if (lines.length) source = 'unified log'; }
  const startAt = lines.lastIndexOf('PRIBRIDGE bridge self-check started');
  lines = startAt >= 0 ? lines.slice(startAt) : [];
  if (lines.some(l => l.startsWith('PRIBRIDGE summary'))) break;
}
console.log(`  read from: ${source}${reportFile ? ` (${reportFile})` : ''}`);
// Without a summary, say why before tearing down: is the app alive, what did it
// log, did it crash. Diagnostics only — they never change the verdict.
if (!lines.some(l => l.startsWith('PRIBRIDGE summary'))) {
  const show = (label, fn) => { try { console.log(`  [diag] ${label}:\n${fn().split('\n').slice(-60).map(l => `    ${l}`).join('\n')}`); } catch (e) { console.log(`  [diag] ${label}: ${String(e.message || e).split('\n')[0]}`); } };
  show('app process', () => run('xcrun', ['simctl', 'spawn', device, 'launchctl', 'list']).split('\n').filter(l => l.includes(bundleId)).join('\n') || '(not running)');
  show('app log', () => run('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--start', started, '--style', 'compact',
    '--predicate', `process CONTAINS "Pri" OR subsystem CONTAINS "${bundleId}" OR eventMessage CONTAINS "${bundleId}"`]));
  show('crash reports', () => run('/bin/sh', ['-c', 'ls -t ~/Library/Logs/DiagnosticReports 2>/dev/null | grep -i pri | head -3 | while read f; do echo "== $f"; head -60 ~/Library/Logs/DiagnosticReports/"$f"; done']) || '(none)');
}
// ── The page's WebContent process ends ──
// On a simulator the app's WebContent process is a host process whose parent
// is this device's launchd_sim. Kill it once with ink on the native surface:
// the page must come back as the app, the bridge must answer and the surface
// must be gone. Then keep killing each new one as soon as it starts: more than
// two ends inside 30 s must stop reloading and show the native screen.
const readLines = () => {
  const all = fromFile().length ? fromFile() : fromLog();
  const startAt = all.lastIndexOf('PRIBRIDGE bridge self-check started');
  return startAt >= 0 ? all.slice(startAt) : all;
};
function webContentPids() {
  const ps = run('/bin/ps', ['-axo', 'pid=,ppid=,command=']).split('\n').map(l => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean);
  const sims = ps.filter(([, , , cmd]) => cmd.startsWith('launchd_sim') && cmd.includes(udid)).map(([, pid]) => pid);
  return ps.filter(([, , ppid, cmd]) => sims.includes(ppid) && cmd.includes('com.apple.WebKit.WebContent')).map(([, pid]) => Number(pid));
}
const waitFor = (test, seconds) => {
  for (let i = 0; i < seconds * 2; i++) { const got = test(); if (got) return got; execSync('sleep 0.5'); }
  return null;
};
const contentLog = [];
const kill = pid => { try { process.kill(pid, 'SIGKILL'); contentLog.push(`killed WebContent ${pid}`); return true; } catch { return false; } };
if (lines.some(l => l.startsWith('PRIBRIDGE summary'))) {
  if (!waitFor(() => readLines().includes('PRIBRIDGE ready for content process end'), 60)) contentLog.push('the app never armed the content-process leg');
  else {
    const first = webContentPids();
    if (!first.length) contentLog.push('no WebContent process found under this device');
    first.forEach(kill);
    waitFor(() => readLines().some(l => l.startsWith('PRIBRIDGE recovery 1 summary')), 120);
    // Crash loop: kill each new process as it starts, until the shell stops
    // reloading. Polled every half second with no wait between kills: a new
    // process can be a spare WebKit starts beside the page's own, and killing
    // it ends nothing. The loop used to wait up to 20 s for an end after each
    // kill, so a spare could hold the page's real kill back past the shell's
    // 30 s window and reset its count (Train 18, c71e21be4: ends n=1,2,1,2
    // from 5 kills). The verdict is unchanged: judgeContentEnd still needs the
    // stop on the third end inside 30 s and the native stopped screen.
    let seen = new Set(first);
    const ends = () => readLines().filter(l => l.startsWith('PRIBRIDGE contentProcessEnded')).length;
    const loopStart = Date.now();
    let lastNew = Date.now();
    while (!readLines().some(l => /action=stopped/.test(l)) && ends() < 6 && Date.now() - loopStart < 120_000) {
      const fresh = webContentPids().filter(p => !seen.has(p));
      if (fresh.length) { lastNew = Date.now(); fresh.forEach(p => { seen.add(p); kill(p); }); }
      else if (Date.now() - lastNew > 30_000) { contentLog.push('no new WebContent process started'); break; }
      execSync('sleep 0.5');
    }
    contentLog.push(`crash loop: ${seen.size - first.length} process(es) killed after the first end, ${ends()} end(s) seen in ${Math.round((Date.now() - loopStart) / 1000)} s`);
    waitFor(() => readLines().includes('PRIBRIDGE contentStopped shown'), 20);
  }
  lines = readLines();
}

try { run('xcrun', ['simctl', 'terminate', device, bundleId]); } catch { /* already gone */ }
for (const line of lines) console.log(`  ${line.replace(/^PRIBRIDGE\s*/, '')}`);
for (const line of contentLog) console.log(`  [content leg] ${line}`);

const passed = EXPECTED.filter(key => lines.includes(`PRIBRIDGE ok ${key}`));
const summary = lines.find(l => l.startsWith('PRIBRIDGE summary'));
const content = judgeContentEnd(lines);
const ok = passed.length === EXPECTED.length && summary === 'PRIBRIDGE summary 0 failure(s)' && content.ok;
for (const problem of content.problems) console.log(`  ✖ content process: ${problem}`);
console.log(ok
  ? `\nNATIVE BRIDGE SELF-CHECK: PASS — ${passed.length}/${EXPECTED.length} on ${sim.name} (simulator); content process ended: page reloaded, ink surface dropped, reloads stop after ${content.stoppedAt} ends in 30 s`
  : `\nNATIVE BRIDGE SELF-CHECK: FAIL — ${passed.length}/${EXPECTED.length} on ${sim.name}; ${summary || 'no summary logged'}; content process ${content.ok ? 'ok' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
}
