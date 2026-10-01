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
//
//   node scripts/iphone-journey.mjs                 # an iPhone simulator
//   node scripts/iphone-journey.mjs --family ipad
//   node scripts/iphone-journey.mjs --device "iPhone 17e" --evidence out.json
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PACKAGE = join(ROOT, 'ios/PriLearning.swiftpm');
const FIRST = ['launch', 'onboarding', 'practice', 'typedAttempt', 'feedback', 'nextQuestion', 'nativeInk', 'progress', 'persistenceMarker'];
const RELAUNCH = ['relaunchProfile', 'relaunchMarker'];

const argOf = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...opts });

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

function launchAndRead(udid, bundleId, flag, phase) {
  const started = new Date(Date.now() - 2000).toISOString().replace('T', ' ').slice(0, 19);
  run('xcrun', ['simctl', 'launch', udid, bundleId, flag]);
  let lines = [];
  for (let i = 0; i < 75; i++) {
    execSync('sleep 2');
    const log = run('xcrun', ['simctl', 'spawn', udid, 'log', 'show', '--start', started,
      '--predicate', 'eventMessage CONTAINS "PRIJOURNEY"', '--style', 'compact']);
    lines = log.split('\n').filter(l => l.includes('PRIJOURNEY') && !l.includes("'log'")).map(l => l.slice(l.indexOf('PRIJOURNEY')));
    if (lines.some(l => l.startsWith(`PRIJOURNEY summary ${phase}`)) || lines.some(l => l.startsWith('PRIJOURNEY FAIL script'))) break;
  }
  try { run('xcrun', ['simctl', 'terminate', udid, bundleId]); } catch { /* already gone */ }
  return lines;
}

const sim = pickDevice();
const udid = sim.udid;
console.log(`Native student journey on ${sim.name} (${udid}) — SYNTHETIC / SIMULATOR evidence\n`);
ensureBooted(sim);
const derived = mkdtempSync(join(tmpdir(), 'pri-journey-'));
console.log('Building…');
run('xcodebuild', ['-scheme', 'PriLearning', '-destination', `platform=iOS Simulator,id=${udid}`, '-derivedDataPath', derived, 'build'], { cwd: PACKAGE });
const app = builtApp(derived);
const bundleId = run('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', join(app, 'Info.plist')]).trim();
try { run('xcrun', ['simctl', 'terminate', udid, bundleId]); } catch { /* not running */ }
try { run('xcrun', ['simctl', 'uninstall', udid, bundleId]); } catch { /* not installed */ }
run('xcrun', ['simctl', 'install', udid, app]);

const first = launchAndRead(udid, bundleId, '--journey-selfcheck', 'first');
for (const line of first) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
const second = launchAndRead(udid, bundleId, '--journey-relaunch', 'relaunch');
for (const line of second) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);

const result = (lines, name) => {
  const hit = lines.find(l => l.startsWith(`PRIJOURNEY ok ${name}`) || l.startsWith(`PRIJOURNEY FAIL ${name}`));
  return hit ? { ok: hit.startsWith('PRIJOURNEY ok'), detail: hit.replace(/^PRIJOURNEY (ok|FAIL) \S+\s*/, '') } : { ok: false, detail: 'not reported' };
};
const steps = Object.fromEntries([...FIRST.map(n => [n, result(first, n)]), ...RELAUNCH.map(n => [n, result(second, n)])]);
const passed = Object.values(steps).filter(s => s.ok).length;
const total = FIRST.length + RELAUNCH.length;
let os = '';
try { os = run('xcrun', ['simctl', 'list', 'runtimes']).split('\n').find(l => /iOS/.test(l))?.trim() || ''; } catch { /* informational */ }
let sha = '';
try { sha = run('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).trim(); } catch { /* not a checkout */ }

const evidence = {
  schemaVersion: 1,
  evidenceClass: 'SYNTHETIC_SIMULATOR',
  physicalDevice: false,
  sha,
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
