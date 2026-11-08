#!/usr/bin/env node
// Pri Learning · release gate for a BUILT iPhone + iPad app.
//
//   node scripts/check-native-archive.mjs <path to .app | .xcarchive | Info.plist> [--sha <40-hex>] [--probe] [--evidence <file.json>]
//
// Grading is online-only: a build whose signed Info.plist carries no server
// origin can show questions but can never mark one. The origin is an Xcode
// build setting supplied at archive time (RELEASE.md §4), so no check on the
// repository can see it — this one reads the built product.
//
// Which origin (Director decision, 9 Nov 2026, under owner default D5 "test
// what you ship"): EVERY native archive talks to exactly
// https://app.prilearning.com. Until GO that public origin fronts the STAGING
// service at the candidate SHA; at promotion it is re-pointed to production
// and the post-promotion smoke test runs. The binary is identical either way,
// so the build the device matrix certifies is the build the store receives.
// The gate refuses every other value: missing, empty, not https, a
// loopback/local/private host, a path, a raw *.railway.app host, any other
// host. With --sha the embedded web release identity must be that exact
// commit; with --probe the origin must answer as a Pri server on that commit,
// and --evidence records which backend it resolves to (backendEvidence).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolveCname as dnsResolveCname } from 'node:dns/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHIPPING_BUNDLE = 'com.prilearning.app';

/** The one origin a native archive may name (D5; RELEASE.md §4 "Cloud origin"). */
export const CANDIDATE_ORIGIN = 'https://app.prilearning.com';

/**
 * The raw Railway hosts behind the two services, as release-nominate.mjs
 * names them. They identify which service app.prilearning.com fronts (its
 * CNAME target); an archive may never name one of them directly.
 */
export const BACKEND_HOSTS = Object.freeze({
  staging: 'pri-learning-staging-staging.up.railway.app',
  production: 'final-pri-learning-production.up.railway.app'
});

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
  if (host === 'railway.app' || host.endsWith('.railway.app')) {
    return `PRICloudOrigin is a raw Railway host (${raw}); a native archive names ${CANDIDATE_ORIGIN}, which fronts the right service`;
  }
  if (url.origin !== CANDIDATE_ORIGIN) {
    return `PRICloudOrigin must be exactly ${CANDIDATE_ORIGIN} (D5: every native archive talks to the public origin; until GO it fronts staging at the candidate SHA), not ${raw}`;
  }
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
  // A built product always has a bundle id; only a bare source Info.plist
  // handed in directly may lack one, and that is never a release artefact.
  if (info.CFBundleIdentifier !== SHIPPING_BUNDLE) {
    problems.push(`bundle id is ${info.CFBundleIdentifier ?? 'missing'}, not the shipping ${SHIPPING_BUNDLE}`);
  }
  if (app && !sha) problems.push('no --sha given: a release archive is checked against the exact release commit');
  let releaseSha = null;
  const release = findReleaseJson(app);
  if (release) { try { releaseSha = JSON.parse(readFileSync(release, 'utf8')).releaseSha || null; } catch { releaseSha = null; } }
  if (sha && releaseSha !== sha) problems.push(`embedded web release is ${releaseSha || 'missing'}, not ${sha}`);
  return { problems, info, releaseSha };
}

/**
 * Ask the origin the build names whether it is a Pri server running THIS
 * release. A build pointed at a host that is not serving the same commit
 * would ship a client and a server that were never certified together.
 */
export async function probeOrigin(origin, sha, fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(new URL('/v1/health', origin), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    const body = await res.json();
    if (!res.ok || body?.service !== 'pri-learning-platform') return `${origin} did not answer as a Pri server`;
    const serving = body?.releaseIdentity?.releaseSha || null;
    if (sha && serving !== sha) return `${origin} is serving ${serving || 'an unknown release'}, not ${sha}`;
    return null;
  } catch (error) { return `${origin} could not be reached (${error?.name || 'error'})`; }
}

/**
 * What app.prilearning.com is right now, for the release evidence: its CNAME
 * chain, which service that names (BACKEND_HOSTS), the release and database
 * the server reports at /v1/health, and the web release it serves at
 * /release.json. A record says only what was observed; `backend` is
 * 'unknown' when the CNAME names neither service. Never throws.
 */
export async function backendEvidence(origin, {
  sha = null,
  fetchImpl = globalThis.fetch,
  resolveCname = dnsResolveCname,
  now = () => new Date().toISOString()
} = {}) {
  const record = { origin, checkedAt: now(), cname: [], backend: 'unknown', health: null, webReleaseSha: null, sha, problems: [] };
  let host = null;
  try { host = new URL(origin).hostname; } catch { record.problems.push(`not a URL: ${origin}`); return record; }
  try {
    let name = host;
    for (let hop = 0; hop < 5; hop++) {
      const next = (await resolveCname(name))[0];
      if (!next) break;
      record.cname.push(String(next).toLowerCase().replace(/\.$/, ''));
      name = next;
    }
  } catch { /* no CNAME (an A record) or no DNS answer: recorded as an empty chain */ }
  const target = record.cname.at(-1) || null;
  record.backend = target === BACKEND_HOSTS.staging ? 'staging' : target === BACKEND_HOSTS.production ? 'production' : 'unknown';
  if (record.backend === 'unknown') record.problems.push(`${host} does not resolve to a known Pri service (CNAME ${target || 'none'})`);
  const getJson = async path => {
    const res = await fetchImpl(new URL(path, origin), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  try {
    const body = await getJson('/v1/health');
    record.health = {
      service: body?.service ?? null,
      releaseSha: body?.releaseIdentity?.releaseSha ?? null,
      databaseEngine: body?.database?.engine ?? null,
      schemaVersion: body?.schemaVersion ?? null
    };
    if (record.health.service !== 'pri-learning-platform') record.problems.push(`${origin}/v1/health did not answer as a Pri server`);
  } catch (error) { record.problems.push(`${origin}/v1/health could not be read (${error?.message || error?.name || 'error'})`); }
  try { record.webReleaseSha = (await getJson('/release.json'))?.releaseSha ?? null; }
  catch (error) { record.problems.push(`${origin}/release.json could not be read (${error?.message || error?.name || 'error'})`); }
  if (sha) {
    if (record.health && record.health.releaseSha !== sha) record.problems.push(`${origin} server is on ${record.health.releaseSha || 'an unknown release'}, not ${sha}`);
    if (record.webReleaseSha !== sha) record.problems.push(`${origin}/release.json is ${record.webReleaseSha || 'missing'}, not ${sha}`);
  }
  return record;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const shaAt = args.indexOf('--sha');
  const sha = shaAt >= 0 ? args[shaAt + 1] : null;
  const evidenceAt = args.indexOf('--evidence');
  const target = args.find((a, i) => !a.startsWith('--') && (shaAt < 0 || i !== shaAt + 1) && (evidenceAt < 0 || i !== evidenceAt + 1));
  if (!target) { console.error('usage: node scripts/check-native-archive.mjs <.app | .xcarchive | Info.plist> [--sha <40-hex>] [--probe] [--evidence <file.json>]'); process.exit(2); }
  const { problems, info, releaseSha } = checkArchive(target, { sha });
  // --probe: also require the named origin to be a Pri server on this release.
  if (args.includes('--probe') && !originProblem(info.PRICloudOrigin)) {
    const unreachable = await probeOrigin(info.PRICloudOrigin.trim(), sha);
    if (unreachable) problems.push(unreachable);
    // Release evidence: which service the public origin fronts right now, on which release.
    const evidence = await backendEvidence(info.PRICloudOrigin.trim(), { sha });
    console.log(`origin ${evidence.origin} → ${evidence.cname.join(' → ') || 'no CNAME'} · backend ${evidence.backend} · server ${evidence.health?.releaseSha || '?'} on ${evidence.health?.databaseEngine || '?'} · web ${evidence.webReleaseSha || '?'}`);
    problems.push(...evidence.problems.filter(p => !problems.includes(p)));
    const at = args.indexOf('--evidence');
    if (at >= 0 && args[at + 1]) writeFileSync(args[at + 1], JSON.stringify({ format: 'pri-native-archive-origin', version: 1, archive: target, bundle: info, embeddedWebReleaseSha: releaseSha, origin: evidence }, null, 2) + '\n');
  }
  console.log(`bundle ${info.CFBundleIdentifier ?? '?'} · version ${info.CFBundleShortVersionString ?? '?'} (${info.CFBundleVersion ?? '?'}) · web release ${releaseSha ?? 'not found'} · origin ${info.PRICloudOrigin || '(empty)'}`);
  if (problems.length) { console.error(`NATIVE ARCHIVE GATE: FAIL\n  · ${problems.join('\n  · ')}`); process.exit(1); }
  console.log(`NATIVE ARCHIVE GATE: PASS — the built app names ${CANDIDATE_ORIGIN} and the shipping bundle id.`);
}
