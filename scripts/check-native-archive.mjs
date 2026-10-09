#!/usr/bin/env node
// Pri Learning · release gate for a BUILT iPad app.
//
//   node scripts/check-native-archive.mjs <path to .app | .xcarchive | Info.plist> [--sha <40-hex>]
//
// Grading is online-only: a build whose signed Info.plist carries no production
// server origin can show questions but can never mark one. The origin is an
// Xcode build setting supplied at archive time (RELEASE.md §4), so no check on
// the repository can see it — this one reads the built product. It fails when
// PRICloudOrigin is missing, empty, not https, a loopback/local host, or not a
// bare origin; when the bundle id is not the shipping one; and, with --sha,
// when the embedded web release identity is not that exact commit.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SHIPPING_BUNDLE = 'com.prilearning.app';

export function originProblem(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'PRICloudOrigin is empty: this build could never mark an answer';
  if (/\$\(|\$\{/.test(raw)) return `PRICloudOrigin is an unsubstituted build setting (${raw})`;
  let url;
  try { url = new URL(raw); } catch { return `PRICloudOrigin is not a URL (${raw})`; }
  if (url.protocol !== 'https:') return `PRICloudOrigin must be https (${raw})`;
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) return `PRICloudOrigin must be a bare origin (${raw})`;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.test') ||
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host === '[::1]' || !host.includes('.')) {
    return `PRICloudOrigin points at a local or private host (${raw})`;
  }
  if (/staging/i.test(host)) return `PRICloudOrigin points at a staging host (${raw})`;
  return null;
}

/** Read string keys from an XML or binary Info.plist. */
export function readPlist(path, keys) {
  const out = {};
  const text = readFileSync(path);
  if (text.slice(0, 6).toString() === 'bplist') {
    for (const key of keys) {
      try { out[key] = execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', path], { encoding: 'utf8' }).trim(); }
      catch { out[key] = undefined; }
    }
    return out;
  }
  const xml = text.toString('utf8');
  for (const key of keys) {
    const m = xml.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
    out[key] = m ? m[1].replace(/&amp;/g, '&') : (new RegExp(`<key>${key}</key>\\s*<string\\s*/>`).test(xml) ? '' : undefined);
  }
  return out;
}

function findApp(path) {
  if (!existsSync(path)) throw new Error(`no such path: ${path}`);
  if (statSync(path).isFile()) return { plist: path, app: null };
  if (path.endsWith('.app')) return { plist: join(path, 'Info.plist'), app: path };
  const apps = join(path, 'Products', 'Applications');
  const name = existsSync(apps) ? readdirSync(apps).find(n => n.endsWith('.app')) : null;
  if (!name) throw new Error(`no .app inside ${path}`);
  return { plist: join(apps, name, 'Info.plist'), app: join(apps, name) };
}

function findReleaseJson(app) {
  if (!app) return null;
  const stack = [app];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (name === 'release.json') return full;
      if (statSync(full).isDirectory() && !name.endsWith('.framework')) stack.push(full);
    }
  }
  return null;
}

export function checkArchive(path, { sha = null } = {}) {
  const { plist, app } = findApp(path);
  const info = readPlist(plist, ['PRICloudOrigin', 'CFBundleIdentifier', 'CFBundleShortVersionString', 'CFBundleVersion']);
  const problems = [];
  const origin = originProblem(info.PRICloudOrigin);
  if (origin) problems.push(origin);
  if (info.CFBundleIdentifier !== undefined && info.CFBundleIdentifier !== SHIPPING_BUNDLE) {
    problems.push(`bundle id is ${info.CFBundleIdentifier}, not the shipping ${SHIPPING_BUNDLE}`);
  }
  let releaseSha = null;
  const release = findReleaseJson(app);
  if (release) { try { releaseSha = JSON.parse(readFileSync(release, 'utf8')).releaseSha || null; } catch { releaseSha = null; } }
  if (sha && releaseSha !== sha) problems.push(`embedded web release is ${releaseSha || 'missing'}, not ${sha}`);
  return { problems, info, releaseSha };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const shaAt = args.indexOf('--sha');
  const sha = shaAt >= 0 ? args[shaAt + 1] : null;
  const target = args.find((a, i) => !a.startsWith('--') && (shaAt < 0 || i !== shaAt + 1));
  if (!target) { console.error('usage: node scripts/check-native-archive.mjs <.app | .xcarchive | Info.plist> [--sha <40-hex>]'); process.exit(2); }
  const { problems, info, releaseSha } = checkArchive(target, { sha });
  console.log(`bundle ${info.CFBundleIdentifier ?? '?'} · version ${info.CFBundleShortVersionString ?? '?'} (${info.CFBundleVersion ?? '?'}) · web release ${releaseSha ?? 'not found'} · origin ${info.PRICloudOrigin || '(empty)'}`);
  if (problems.length) { console.error(`NATIVE ARCHIVE GATE: FAIL\n  · ${problems.join('\n  · ')}`); process.exit(1); }
  console.log('NATIVE ARCHIVE GATE: PASS — the built app names an https production server origin and the shipping bundle id.');
}
