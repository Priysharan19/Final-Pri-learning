#!/usr/bin/env node
// Pri Learning · Google Play Data safety drift check
//
// docs/release/play-data-safety.md declares what the Android app collects and
// shares. This check fails when the code drifts from those declarations:
// permissions, advertising-ID use, tracking/crash/ads SDKs, the telemetry
// event allowlist, answer-blind request fields and the deletion route. It
// reads source files only; it cannot see server environment variables or
// contracts, which stay OWNER rows in the document.
//
//   node tools/play-data-safety-check.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const DOC = read('docs/release/play-data-safety.md');

const results = [];
function check(name, fn) {
  try {
    const problem = fn();
    results.push({ name, ok: !problem, problem });
  } catch (error) {
    results.push({ name, ok: false, problem: error.message });
  }
}

function walk(rel, exts, out = []) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    if (entry === 'node_modules' || entry === 'build' || entry === '.gradle' || entry === '.kotlin' || entry.startsWith('.')) continue;
    const child = join(abs, entry);
    if (statSync(child).isDirectory()) walk(relative(ROOT, child), exts, out);
    else if (exts.some(ext => entry.endsWith(ext))) out.push(relative(ROOT, child));
  }
  return out;
}

const permissionsIn = xml => [...xml.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map(m => m[1]);
const docRow = label => {
  const line = DOC.split('\n').find(l => l.startsWith(`| **${label}**`));
  if (!line) throw new Error(`the doc has no "${label}" row in §2`);
  return line;
};
const backticked = text => [...text.matchAll(/`([a-z][a-z0-9-]+)`/g)].map(m => m[1]);
const setOf = (src, name) => {
  const m = src.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) throw new Error(`no ${name} set found`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort();
};
const frozenList = (rel) => {
  const m = read(rel).match(/export const FORBIDDEN_FIELDS = Object\.freeze\(\[([\s\S]*?)\]\)/);
  if (!m) throw new Error(`${rel} exports no FORBIDDEN_FIELDS`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
};
const sameSet = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// 1. Main manifest: INTERNET only, cleartext refused.
const MAIN_MANIFEST = 'android/app/src/main/AndroidManifest.xml';
check('main manifest requests only INTERNET', () => {
  const perms = permissionsIn(read(MAIN_MANIFEST));
  return sameSet(perms, ['android.permission.INTERNET']) ? null : `main manifest requests ${perms.join(', ') || 'nothing'}`;
});
check('main manifest refuses cleartext traffic', () =>
  /android:usesCleartextTraffic="false"/.test(read(MAIN_MANIFEST)) ? null : 'usesCleartextTraffic="false" is missing');

// 2. Every permission the libraries merge in is declared in the doc. The merged
//    manifest exists only after an Android build; without it, the declared
//    list is still checked against the libraries that are known to add them.
check('merged-manifest permissions are all declared in the doc', () => {
  const merged = 'android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml';
  // On CI (after bundleRelease) the merged manifest must exist; a silent
  // fallback there would check the doc against itself.
  if (process.env.PRI_REQUIRE_MERGED_MANIFEST === '1' && !existsSync(join(ROOT, merged))) return `${merged} is missing — build the release variant first`;
  const perms = existsSync(join(ROOT, merged))
    ? permissionsIn(read(merged)).map(p => p.replace(/^\$\{applicationId\}/, 'com.prilearning.app'))
    : ['android.permission.INTERNET', 'com.android.vending.BILLING', 'android.permission.ACCESS_NETWORK_STATE'];
  const missing = perms.filter(p => p !== 'android.permission.INTERNET' && !DOC.includes(`\`${p}\``));
  return missing.length ? `undeclared permissions: ${missing.join(', ')}` : null;
});
check('no AD_ID permission declared anywhere in android/', () => {
  const hits = walk('android', ['.xml', '.kts', '.gradle']).filter(f => /permission\.AD_ID/.test(read(f)));
  return hits.length ? `AD_ID in ${hits.join(', ')}` : null;
});

// 3. No advertising-ID use in the app code.
check('no advertising-ID use in android/ or client/src', () => {
  const pattern = /AdvertisingIdClient|getAdvertisingIdInfo|advertisingId|ads-identifier|permission\.AD_ID|ANDROID_ID\b/;
  const hits = [...walk('android/app/src', ['.kt', '.java', '.xml']), ...walk('client/src', ['.js', '.jsx', '.mjs', '.ts', '.tsx'])]
    .filter(f => pattern.test(read(f)));
  return hits.length ? `advertising/hardware ID referenced in ${hits.join(', ')}` : null;
});

// 4. No analytics, crash, attribution or ads SDKs in the app's dependencies.
const SDK = /firebase|crashlytics|analytics|admob|play-services-ads|\bads\b|sentry|bugsnag|datadog|amplitude|mixpanel|segment|appsflyer|adjust|branch|posthog|newrelic|instabug|facebook|onesignal|clevertap|moengage|appcenter/i;
check('no tracking/crash/ads SDK in android/gradle/libs.versions.toml', () => {
  const libs = read('android/gradle/libs.versions.toml').split('\n').filter(l => /module\s*=|id\s*=/.test(l) && SDK.test(l));
  return libs.length ? `found: ${libs.map(l => l.trim()).join(' | ')}` : null;
});
check('no tracking/crash/ads SDK in client/package.json', () => {
  const pkg = JSON.parse(read('client/package.json'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies }).filter(d => SDK.test(d));
  return deps.length ? `found: ${deps.join(', ')}` : null;
});

// 5. The telemetry allowlist (server and client) equals the doc's App
//    interactions + Diagnostics rows.
check('telemetry allowlist equals the doc App interactions + Diagnostics events', () => {
  const declared = [...new Set([
    ...backticked(docRow('App activity → App interactions').split('|')[6]),
    ...backticked(docRow('App info and performance → Diagnostics').split('|')[6])
  ].filter(name => !name.endsWith('.js')))].sort();
  const server = setOf(read('server/platform/telemetry.js'), 'EVENTS');
  const client = setOf(read('client/src/platform/telemetry.js'), 'TYPES');
  if (!sameSet(server, client)) return `server EVENTS [${server}] differ from client TYPES [${client}]`;
  return sameSet(server, declared) ? null : `code allows [${server}], doc declares [${declared}]`;
});

// 6. Handwriting, photo and working request bodies stay answer-blind.
for (const [rel, required] of [
  ['server/platform/handwriting.js', ['expected', 'expectedAnswer', 'answer', 'solution', 'marks', 'question']],
  ['server/platform/questionPhoto.js', ['expected', 'expectedAnswer', 'answer', 'solution', 'marks']],
  ['server/platform/working.js', ['expected', 'expectedAnswer', 'answer', 'solution', 'marks']]
]) {
  check(`${rel} FORBIDDEN_FIELDS exclude the expected answer`, () => {
    const fields = frozenList(rel);
    const missing = required.filter(f => !fields.includes(f));
    if (missing.length) return `missing ${missing.join(', ')}`;
    return /FORBIDDEN_FIELDS\.includes/.test(read(rel)) ? null : 'FORBIDDEN_FIELDS is declared but never enforced';
  });
}

// 7. The deletion paths the doc promises exist.
check('in-app deletion route DELETE /v1/account exists', () => {
  if (!/router\.use\('\/account', createAccountRouter/.test(read('server/platform/router.js'))) return 'router.js no longer mounts /account';
  return /router\.delete\('\/', requireSession/.test(read('server/platform/accounts.js')) ? null : "accounts.js has no router.delete('/')";
});
check('public deletion page /account/delete-request exists', () => {
  if (!DOC.includes('/account/delete-request')) return 'the doc no longer names /account/delete-request';
  return read('client/src/main.jsx').includes("'/account/delete-request'") ? null : 'client/src/main.jsx no longer serves /account/delete-request';
});

// 8. The doc says it is machine-checked.
check('doc states it is machine-checked by this script', () =>
  DOC.includes('**This file is machine-checked** by') && DOC.includes('tools/play-data-safety-check.mjs') ? null : 'the doc does not say it is machine-checked');

const passed = results.filter(r => r.ok).length;
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : ` — ${r.problem}`}`);
if (passed === results.length) {
  console.log(`PLAY DATA SAFETY: PASS — ${passed}/${results.length} checks`);
} else {
  console.log(`PLAY DATA SAFETY: FAIL — ${passed}/${results.length} checks`);
  process.exitCode = 1;
}
