// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one booted iOS simulator at a time on a CI runner.
//
// Hosted macOS runners (3 cores, 7 GB) cannot carry two booted simulators: the
// harness authors found that a second booted simulator starves a boot (commit
// 3135fba70), and the runs since #523 booted both families for the whole job
// showed `log show` reads hitting their 90 s bound and one `simctl install`
// that took 23 min 42 s and ate the job's 60-minute budget (run 39082059681).
// Every harness script therefore asks this module, before it boots or installs
// anything on CI, to shut down every OTHER booted simulator — whether or not
// its own target is already booted. A person's own simulators are never
// touched: the shutdown runs only when process.env.CI is set.
//
// The decisions are pure functions over `xcrun simctl list devices` text and
// an injectable `exec`, so the rules have a deterministic test that needs no
// Mac (client/test/simulator-fleet-check.mjs).
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';

/** Families the Native Ink lane provisions, in the order it needs them. */
export const FAMILIES = ['iPhone', 'iPad'];

/**
 * A stalled install must fail fast with a clear infrastructure fingerprint
 * rather than consume the job: 180 s per attempt (a healthy install is
 * seconds), two attempts. These are new bounds, not budgets that were raised.
 */
export const INSTALL_TIMEOUT_MS = 180_000;
export const INSTALL_ATTEMPTS = 2;

export const simctl = (args, opts = {}) =>
  execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...opts });

/**
 * Every device in `xcrun simctl list devices` text, under its runtime header
 * ("-- iOS 26.0 --"): { name, udid, state, runtime }. Unavailable-device rows
 * carry an extra "(unavailable, …)" suffix and are still parsed.
 */
export function parseDevices(listText) {
  const rows = [];
  let runtime = '';
  for (const line of String(listText || '').split('\n')) {
    const header = line.match(/^-- (.+?) --\s*$/);
    if (header) { runtime = header[1]; continue; }
    const m = line.match(/^\s+(.+?) \(([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\) \((Booted|Booting|Shutdown|Shutting Down|Creating)\)/i);
    if (m) rows.push({ name: m[1], udid: m[2].toUpperCase(), state: m[3], runtime });
  }
  return rows;
}

/** UDIDs of simulators that are booted or still booting, other than `udid`. */
export function otherBooted(listText, udid) {
  const keep = String(udid || '').toUpperCase();
  return parseDevices(listText).filter(d => /^Boot/i.test(d.state) && d.udid !== keep).map(d => d.udid);
}

/**
 * Shut down every booted simulator other than `udid` so a CI runner carries
 * one. Returns the UDIDs it shut down; [] off CI, where nothing is touched.
 */
export function keepOnlySimulator(udid, { ci = Boolean(process.env.CI), exec = simctl, log = console.log } = {}) {
  if (!ci) return [];
  const others = otherBooted(exec(['list', 'devices']), udid);
  for (const other of others) {
    log(`  shutting down booted simulator ${other} (CI keeps one simulator booted)`);
    try { exec(['shutdown', other], { timeout: 120_000 }); } catch { /* already down */ }
  }
  return others;
}

/**
 * Which family `--boot <family>` names, or null for none. Only one family may
 * be booted: naming both, or an unknown one, is refused.
 */
export function bootFamily(argv, families = FAMILIES) {
  const flags = argv.map((a, i) => (a === '--boot' ? argv[i + 1] : null)).filter(v => v !== null);
  if (!flags.length) return null;
  if (flags.length > 1) throw new Error(`--boot names one family (got ${flags.join(', ')}); CI keeps one simulator booted`);
  const want = String(flags[0] || '').toLowerCase();
  const family = families.find(f => f.toLowerCase() === want);
  if (!family) throw new Error(`--boot takes ${families.join(' or ')} (got ${JSON.stringify(flags[0] ?? '')})`);
  return family;
}

const isTimeout = error => error?.code === 'ETIMEDOUT' || (error?.signal === 'SIGKILL' && error?.status === null);

/**
 * `simctl install`, bounded and retried once. A timeout on the last attempt
 * throws an error whose message starts with "INFRASTRUCTURE:" so the failure
 * is classified as a runner stall rather than a product regression; any other
 * install error is rethrown with its own text after the same retry.
 * Returns { attempt, ms } for the attempt that succeeded.
 */
export function installApp(udid, app, { exec = simctl, log = console.log, timeoutMs = INSTALL_TIMEOUT_MS, attempts = INSTALL_ATTEMPTS } = {}) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const t0 = Date.now();
    try {
      exec(['install', udid, app], { timeout: timeoutMs, killSignal: 'SIGKILL' });
      return { attempt, ms: Date.now() - t0 };
    } catch (error) {
      last = error;
      const why = isTimeout(error)
        ? `did not finish in ${Math.round(timeoutMs / 1000)} s`
        : `failed: ${String(error?.stderr || error?.message || error).trim().split('\n')[0].slice(0, 160)}`;
      if (attempt < attempts) { log(`  (simctl install attempt ${attempt} of ${attempts} ${why}; retrying)`); continue; }
      const name = String(app).split('/').filter(Boolean).pop();
      const message = isTimeout(error)
        ? `INFRASTRUCTURE: simctl install of ${name} on ${udid} ${why} on ${attempts} attempt(s). The simulator or runner stalled; this is not a product failure — re-run the job.`
        : `simctl install of ${name} on ${udid} ${why} (${attempts} attempt(s))`;
      throw Object.assign(new Error(message), { infrastructure: isTimeout(error), cause: last });
    }
  }
  throw last; // unreachable: attempts >= 1
}
