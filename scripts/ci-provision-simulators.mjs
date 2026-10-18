#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · deterministic iOS simulator provisioning for Native Ink CI.
//
// V1 ships on iPhone and iPad (PRI_V1_RELEASE_SCOPE §22, #504), so the Swift
// job needs one available simulator of EACH family. Hosted macOS images do not
// always ship one (a run logged "No iPad simulator is available on this
// runner"), so for each family with no available device this creates one from
// the newest installed iOS runtime and a device type that runtime supports,
// then boots every chosen device and waits for it. It fails clearly only when
// no iOS runtime is installed or no device type of a family is supported.
//
//   node scripts/ci-provision-simulators.mjs            # iPhone + iPad
//   node scripts/ci-provision-simulators.mjs --no-boot  # create only
//   node scripts/ci-provision-simulators.mjs --create   # always create (tests the create path)
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';

const FAMILIES = ['iPhone', 'iPad'];
// Preferred device types, in order: a standard 6.1" iPhone (393pt, the width
// the journey's Dynamic Type step was certified at) and a standard iPad.
const PREFERRED = {
  iPhone: ['iPhone 16', 'iPhone 17', 'iPhone 16 Pro', 'iPhone 17 Pro', 'iPhone 15'],
  iPad: ['iPad (A16)', 'iPad Air 11-inch (M4)', 'iPad Pro 11-inch (M5)', 'iPad Pro 11-inch (M4)', 'iPad (10th generation)'],
};
const simctl = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const json = (...args) => JSON.parse(simctl('list', ...args, '-j'));
const version = v => String(v).split('.').map(Number);
const newer = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (b[i] || 0) - (a[i] || 0); if (d) return d; } return 0; };
const fail = msg => { console.log(`::error::${msg}`); process.exit(1); };

const runtimes = json('runtimes').runtimes
  .filter(r => r.isAvailable !== false && (r.platform === 'iOS' || /SimRuntime\.iOS-/.test(r.identifier)))
  .sort((a, b) => newer(version(a.version), version(b.version)));
if (!runtimes.length) fail('No iOS simulator runtime is installed on this runner (xcrun simctl list runtimes)');

const deviceTypes = json('devicetypes').devicetypes;
const devices = json('devices', 'available').devices;
const chosen = [];

for (const family of FAMILIES) {
  // An existing available device on the newest runtime that has one (the
  // journey scripts pick devices by /iPhone/ and /iPad/ anywhere in the name).
  let pick = null;
  for (const rt of process.argv.includes('--create') ? [] : runtimes) {
    const d = (devices[rt.identifier] || []).find(x => x.isAvailable !== false && x.name.includes(family));
    if (d) { pick = { ...d, runtime: rt }; break; }
  }
  if (!pick) {
    const rt = runtimes[0];
    const supported = new Set((rt.supportedDeviceTypes || []).map(t => t.identifier));
    const types = deviceTypes
      .filter(t => (t.productFamily ? t.productFamily === family : t.name.startsWith(family)))
      .filter(t => !supported.size || supported.has(t.identifier))
      .filter(t => t.name.startsWith(family))
      // Deterministic fallback when no preferred type exists: the newest device
      // type of the family (highest minimum runtime), name as the tie-break.
      .sort((a, b) => (a.minRuntimeVersion || 0) - (b.minRuntimeVersion || 0) || a.name.localeCompare(b.name));
    const type = PREFERRED[family].map(n => types.find(t => t.name === n)).find(Boolean) || types[types.length - 1];
    if (!type) fail(`No ${family} device type is supported by ${rt.name} (${rt.identifier})`);
    const name = `Pri CI ${type.name}`;
    console.log(`Creating ${name} (${type.identifier}) on ${rt.name}`);
    const udid = simctl('create', name, type.identifier, rt.identifier).trim();
    pick = { name, udid, state: 'Shutdown', runtime: rt };
  }
  console.log(`${family}: ${pick.name} (${pick.udid}) on ${pick.runtime.name}`);
  chosen.push(pick);
}

if (!process.argv.includes('--no-boot')) {
  for (const d of chosen) {
    if (d.state !== 'Booted') {
      try { simctl('boot', d.udid); } catch (e) { if (!/current state: Booted/.test(String(e.stderr))) throw e; }
    }
    simctl('bootstatus', d.udid, '-b');
    console.log(`Booted ${d.name}`);
  }
}
console.log(`SIMULATORS: PASS — ${chosen.map(d => d.name).join(' + ')}`);
