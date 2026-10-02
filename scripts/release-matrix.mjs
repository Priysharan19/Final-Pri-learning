#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · cross-platform release matrix (CP-11)
//
// One command that says whether a release candidate is ONE product everywhere:
//   · the shared web build's release identity (client/dist/release.json) is the
//     one embedded in both Apple bundles and the Android assets;
//   · the shell versions match release/metadata.json's product version;
//   · the data origins have not moved (they are every student's IndexedDB key):
//     Apple prilearning://app, Android https://appassets.androidplatform.net;
//   · the native bridge protocol and native client ids agree across JS, Swift,
//     Kotlin and the server;
//   · the compatibility floor (minimum shell builds) is documented in code.
//
//   node scripts/release-matrix.mjs                 # what exists locally
//   node scripts/release-matrix.mjs --require-native-apple    # after sync:ios
//   node scripts/release-matrix.mjs --require-native-android  # after the Gradle build
//   node scripts/release-matrix.mjs --json
// Exit 1 on any mismatch. Physical evidence is not part of this matrix and is
// never inferred from it.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveReleaseIdentity } from '../release/release-identity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = p => join(ROOT, p);
const read = p => readFileSync(at(p), 'utf8');
const json = p => JSON.parse(read(p));
const args = new Set(process.argv.slice(2));
const SHA = /^[0-9a-f]{40}$/;

const rows = [];
const fail = [];
function row(area, item, value, ok, note = '') {
  rows.push({ area, item, value, ok, note });
  if (!ok) fail.push(`${area} · ${item}: ${value}${note ? ` (${note})` : ''}`);
}
// Context, not a check: printed with '·', never counted as passing anything.
function info(area, item, value, note = '') { rows.push({ area, item, value, ok: null, note }); }
// A line that is code, not a comment (so commenting a line out fails the row).
const codeLine = (text, re) => text.split('\n').some(line => !/^\s*(\/\/|\*|#)/.test(line) && re.test(line));

// ── release identity ─────────────────────────────────────────────────────────
const meta = json('release/metadata.json');
const dist = existsSync(at('client/dist/release.json')) ? json('client/dist/release.json') : null;
row('web', 'client/dist/release.json', dist?.releaseSha?.slice(0, 12) || 'missing', !!dist && SHA.test(dist.releaseSha || ''),
  dist ? '' : 'run npm run build first');
let candidate = null;
let candidateProblem = '';
try { candidate = resolveReleaseIdentity({ root: ROOT, production: true }); } catch (e) { candidateProblem = e.message; }
row('web', 'built from this candidate', candidate?.releaseSha?.slice(0, 12) || 'unknown',
  !!dist && !!candidate && dist.releaseSha === candidate.releaseSha,
  candidate ? (dist && dist.releaseSha !== candidate.releaseSha ? `dist was built from ${dist.releaseSha.slice(0, 12)}; rebuild` : '') : candidateProblem);
row('web', 'product version', dist?.productVersion || '?', !dist || dist.productVersion === meta.productVersion, `metadata ${meta.productVersion}`);

for (const pkg of ['ios/PriLearning.swiftpm', 'ios/PriLearning 2.swiftpm']) {
  if (!existsSync(at(pkg))) continue;
  const embedded = existsSync(at(`${pkg}/Resources/Web/release.json`)) ? json(`${pkg}/Resources/Web/release.json`) : null;
  const required = args.has('--require-native-apple');
  row('apple', `${pkg} embedded release`, embedded?.releaseSha?.slice(0, 12) || 'not synced',
    embedded ? embedded.releaseSha === dist?.releaseSha : !required, embedded ? '' : 'npm run sync:ios writes it (gitignored)');
  const swift = read(`${pkg}/Package.swift`);
  const display = swift.match(/displayVersion:\s*"([^"]+)"/)?.[1];
  const build = swift.match(/bundleVersion:\s*"([^"]+)"/)?.[1];
  row('apple', `${pkg} version`, `${display} (${build})`, display === meta.productVersion && /^\d+$/.test(build || ''), `metadata ${meta.productVersion}`);
}

{
  const gradle = read('android/app/build.gradle.kts');
  const name = gradle.match(/versionName = "([^"]+)"/)?.[1];
  row('android', 'versionName', name || '?', name === meta.productVersion, `metadata ${meta.productVersion}; versionCode comes from -Ppri.versionCode`);
  const embeddedPath = 'android/app/build/generated/priWeb/web/release.json';
  const embedded = existsSync(at(embeddedPath)) ? json(embeddedPath) : null;
  row('android', 'embedded release', embedded?.releaseSha?.slice(0, 12) || 'not built',
    embedded ? embedded.releaseSha === dist?.releaseSha : !args.has('--require-native-android'), embedded ? '' : 'the Gradle build copies client/dist');
}

// ── data origins (never change: they key every student's local data) ────────
for (const pkg of ['ios/PriLearning.swiftpm', 'ios/PriLearning 2.swiftpm']) {
  if (!existsSync(at(pkg))) continue;
  const shell = read(`${pkg}/WebShell.swift`);
  row('origin', `Apple (${pkg.split('/')[1]})`, 'prilearning://app',
    codeLine(shell, /forURLScheme: "prilearning"/) && codeLine(shell, /URL\(string: "prilearning:\/\/app\/"\)/), 'WebShell scheme + start URL');
}
{
  const asset = read('android/app/src/main/java/com/prilearning/app/shell/AssetOrigin.kt');
  row('origin', 'Android', 'https://appassets.androidplatform.net',
    /const val DOMAIN = "appassets\.androidplatform\.net"/.test(asset) && /const val ORIGIN = "https:\/\/appassets\.androidplatform\.net"/.test(asset), 'AssetOrigin');
}

// ── protocol and native client identities ────────────────────────────────────
{
  const js = Number(read('client/src/platform/native/envelope.js').match(/export const PROTOCOL = (\d+);/)?.[1]);
  const swift = Number(read('ios/PriLearning.swiftpm/NativeHostBridge.swift').match(/static let protocolVersion = (\d+)/)?.[1]);
  const kotlin = Number(read('android/app/src/main/java/com/prilearning/app/bridge/Envelope.kt').match(/const val PROTOCOL = (\d+)/)?.[1]);
  row('protocol', 'priNative envelope', `js ${js} · swift ${swift} · kotlin ${kotlin}`, js === swift && swift === kotlin && js >= 1);
  const applePkgs = ['ios/PriLearning.swiftpm', 'ios/PriLearning 2.swiftpm'].filter(p => existsSync(at(p)));
  const ios = applePkgs.every(p => codeLine(read(`${p}/NativeCloudBridge.swift`), /"ios-native-v1"/));
  const android = /CLIENT_ID = "android-native-v1"/.test(read('android/app/src/main/java/com/prilearning/app/cloud/CloudConfig.kt'));
  const server = /new Set\(\['ios-native-v1', 'android-native-v1'\]\)/.test(read('server/platform/security.js'));
  row('protocol', 'native client ids', 'ios-native-v1 · android-native-v1', ios && android && server, 'shells and the server agree');
  const compat = existsSync(at('server/platform/clientCompatibility.js')) ? read('server/platform/clientCompatibility.js') : '';
  const wired = codeLine(read('server/platform/router.js'), /router\.use\(clientCompatibility\(\)\)/);
  row('compatibility', 'minimum shell builds', 'PRI_MIN_IOS_BUILD · PRI_MIN_ANDROID_BUILD',
    codeLine(compat, /PRI_MIN_IOS_BUILD/) && codeLine(compat, /PRI_MIN_ANDROID_BUILD/) && codeLine(compat, /CLIENT_UPGRADE_REQUIRED/) && wired,
    wired ? 'server answers 426 below the floor' : 'clientCompatibility() is not mounted in router.js');
  const sendsBuildIos = applePkgs.every(p => codeLine(read(`${p}/NativeCloudBridge.swift`), /X-Pri-Shell-Build/));
  const sendsBuildAndroid = codeLine(read('android/app/src/main/java/com/prilearning/app/cloud/NativeCloud.kt'), /X-Pri-Shell-Build/);
  row('compatibility', 'shells send their build', 'X-Pri-Shell-Build', sendsBuildIos && sendsBuildAndroid);
}

// ── evidence classes (stated, never inferred) ────────────────────────────────
// Where each evidence class is produced. These rows prove nothing about a run:
// CI results live in the workflow runs for this SHA, physical evidence nowhere yet.
info('evidence', 'S0 contracts / S1 browser lane', 'ci.yml (required checks)');
info('evidence', 'S2 iOS simulator lane', existsSync(at('.github/workflows/native-ink.yml')) ? 'native-ink.yml' : 'missing');
info('evidence', 'S2 Android emulator lane', existsSync(at('.github/workflows/android-shell.yml')) ? 'android-shell.yml' : 'missing');
info('evidence', 'P physical', 'NONE recorded — DEFERRED', 'never inferred from S0–S2');

if (args.has('--json')) {
  console.log(JSON.stringify({ releaseSha: dist?.releaseSha || null, productVersion: meta.productVersion, ok: fail.length === 0, rows }, null, 2));
} else {
  for (const r of rows) console.log(`${r.ok === null ? '·' : r.ok ? '✓' : '✗'} ${r.area.padEnd(13)} ${r.item.padEnd(38)} ${r.value}${r.note ? `  — ${r.note}` : ''}`);
  console.log(fail.length
    ? `\nRELEASE MATRIX: FAIL — ${fail.length} mismatch(es)\n  · ${fail.join('\n  · ')}`
    : `\nRELEASE MATRIX: PASS — ${rows.filter(r => r.ok !== null).length} checks — one release identity ${dist?.releaseSha?.slice(0, 12) || ''}, pinned origins, one protocol.`);
}
process.exit(fail.length ? 1 : 0);
