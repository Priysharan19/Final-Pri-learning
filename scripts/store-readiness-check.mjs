#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · store-facing configuration stays true to the code (CP-12)
//
// Checks what a repository can honestly check before a store submission:
//   · the Apple privacy manifest exists in both packages, is identical, is
//     copied to the bundle root, declares no tracking and no tracking domains,
//     and declares a reason for every required-reason API category it lists;
//   · the Android manifest asks for INTERNET only, refuses backup and cleartext;
//   · no signing material is tracked and release signing reads the environment;
//   · docs/release/STORE_READINESS.md keeps its status lines and owner actions.
// It never claims a store accepted anything. Exit 1 on any failure.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
let pass = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) pass++; else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };

// ── Apple privacy manifest ───────────────────────────────────────────────────
const PKGS = ['ios/PriLearning.swiftpm', 'ios/PriLearning 2.swiftpm'];
const manifests = PKGS.map(p => `${p}/PrivacyInfo.xcprivacy`);
for (const m of manifests) check(`${m} exists`, existsSync(join(ROOT, m)));
if (manifests.every(m => existsSync(join(ROOT, m)))) {
  const [a, b] = manifests.map(read);
  check('both privacy manifests are identical', a === b);
  check('privacy manifest is a plist', /^<\?xml[^>]*\?>\s*<!DOCTYPE plist/.test(a) && /<plist version="1.0">/.test(a));
  check('NSPrivacyTracking is false', /<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(a));
  check('no tracking domains', /<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/.test(a) || /<key>NSPrivacyTrackingDomains<\/key>\s*<array>\s*<\/array>/.test(a));
  check('no collected data type is used for tracking', !/<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<true\/>/.test(a));
  // The collected data types are exactly the STORE_READINESS.md §2 set: adding
  // or dropping one is a deliberate change to both, never a silent one.
  const EXPECTED_TYPES = ['EmailAddress', 'Name', 'UserID', 'DeviceID', 'OtherDataTypes', 'PurchaseHistory',
    'OtherUserContent', 'PhotosorVideos', 'ProductInteraction', 'OtherDiagnosticData', 'PerformanceData'];
  const types = [...a.matchAll(/<key>NSPrivacyCollectedDataType<\/key>\s*<string>NSPrivacyCollectedDataType(\w+)<\/string>/g)].map(x => x[1]);
  check('collected data types are exactly the documented set', types.length === EXPECTED_TYPES.length && EXPECTED_TYPES.every(t => types.includes(t)),
    `manifest: ${types.join(', ')}`);
  const linkedFalse = [...a.matchAll(/<string>NSPrivacyCollectedDataType(\w+)<\/string>\s*<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<false\/>/g)].map(x => x[1]);
  check('every collected type is declared linked (all go through the signed-in account)', linkedFalse.length === 0, linkedFalse.join(', '));
  // Required-reason APIs: what the Swift code actually calls decides what must
  // be declared, with an allowed reason for that category.
  const swift = PKGS.flatMap(p => readdirSync(join(ROOT, p), { recursive: true })
    .filter(f => String(f).endsWith('.swift')).map(f => read(join(p, String(f))))).join('\n');
  const API = {
    UserDefaults: { used: /\bUserDefaults\b|@AppStorage/, reasons: ['CA92.1', '1C8F.1', 'C56D.1', 'AC6B.1'] },
    FileTimestamp: { used: /\.(creationDate|modificationDate|contentModificationDateKey|creationDateKey)\b|attributesOfItem|getattrlist|\bstat\(/, reasons: ['DDA9.1', 'C617.1', '3B52.1', '0A2A.1'] },
    SystemBootTime: { used: /systemUptime|mach_absolute_time/, reasons: ['35F9.1', '8FFB.1', '3D61.1'] },
    DiskSpace: { used: /volumeAvailableCapacity|systemFreeSize|statfs\(/, reasons: ['85F4.1', 'E174.1', '7D9E.1', 'B728.1'] },
    ActiveKeyboards: { used: /activeInputModes/, reasons: ['3EC4.1', '54BD.1'] }
  };
  const declared = Object.fromEntries([...a.matchAll(/<string>NSPrivacyAccessedAPICategory(\w+)<\/string>\s*<key>NSPrivacyAccessedAPITypeReasons<\/key>\s*<array>([\s\S]*?)<\/array>/g)]
    .map(m => [m[1], [...m[2].matchAll(/<string>([^<]+)<\/string>/g)].map(x => x[1])]));
  for (const [category, rule] of Object.entries(API)) {
    const used = rule.used.test(swift);
    if (used) check(`required-reason API ${category} is declared with an allowed reason`, (declared[category] || []).some(r => rule.reasons.includes(r)), `declared: ${(declared[category] || []).join(',') || 'none'}`);
    else check(`required-reason API ${category} is not declared without a use`, !declared[category]);
  }
  check('no unknown required-reason category is declared', Object.keys(declared).every(k => k in API), Object.keys(declared).join(', '));
  for (const p of PKGS) check(`${p}/Package.swift copies the manifest to the bundle root`, /\.copy\("PrivacyInfo\.xcprivacy"\)/.test(read(`${p}/Package.swift`)));
  // The legal notice and the manifest must agree that handwriting can leave the device.
  check('manifest declares user content (cloud handwriting) honestly', /NSPrivacyCollectedDataTypeOtherUserContent/.test(a));
}

// ── Android manifest ────────────────────────────────────────────────────────
const manifest = read('android/app/src/main/AndroidManifest.xml');
const perms = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map(x => x[1]);
check('Android asks for INTERNET only', perms.length === 1 && perms[0] === 'android.permission.INTERNET', perms.join(', '));
check('Android refuses backup', /android:allowBackup="false"/.test(manifest) && /android:fullBackupContent="false"/.test(manifest));
check('Android refuses cleartext', /android:usesCleartextTraffic="false"/.test(manifest));
// What the built app really asks for (libraries merge permissions in). Checked
// whenever a build exists: only these may appear.
const MERGED_ALLOWED = new Set(['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'com.android.vending.BILLING',
  'com.prilearning.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION']);
const mergedDir = join(ROOT, 'android/app/build/intermediates/merged_manifest/release');
if (existsSync(mergedDir)) {
  const merged = readdirSync(mergedDir, { recursive: true }).filter(f => String(f).endsWith('AndroidManifest.xml'));
  for (const f of merged) {
    const xml = readFileSync(join(mergedDir, String(f)), 'utf8');
    const got = [...xml.matchAll(/<uses-permission(?:-sdk-23)?\s+android:name="([^"]+)"/g)].map(x => x[1]);
    const extra = got.filter(x => !MERGED_ALLOWED.has(x));
    check('merged release manifest asks only for the documented permissions', extra.length === 0, extra.join(', '));
  }
}

// ── signing material ────────────────────────────────────────────────────────
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
const secrets = tracked.filter(f => /\.(jks|keystore|p12|p8|pfx|mobileprovision|pem|key|der)$/i.test(f) || /(^|\/)(key|keystore|signing)\.properties$/i.test(f));
check('no signing material is tracked', secrets.length === 0, secrets.join(', '));
const gradle = read('android/app/build.gradle.kts');
const code = gradle.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
check('upload signing values come straight from the environment',
  /storePassword = System\.getenv\("PRI_ANDROID_UPLOAD_STORE_PASSWORD"\)/.test(code)
  && /keyAlias = System\.getenv\("PRI_ANDROID_UPLOAD_KEY_ALIAS"\)/.test(code)
  && /keyPassword = System\.getenv\("PRI_ANDROID_UPLOAD_KEY_PASSWORD"\)/.test(code)
  && (code.match(/(storePassword|keyPassword|keyAlias|storeFile)\s*=/g) || []).length === 4);
const release = code.match(/\brelease\s*\{([\s\S]*?)\n\s{8}\}/)?.[1] || '';
const assigns = [...code.matchAll(/signingConfig\s*=\s*signingConfigs\.getByName\("(\w+)"\)/g)].map(m => m[1]);
check('a release is signed only with the upload key, never the debug key',
  !!release && assigns.length === 1 && assigns[0] === 'upload' && /signingConfigs\.getByName\("upload"\)/.test(release) && !/debug/.test(release));
check('a partial set of signing variables fails the build', /uploadSet in 1\.\.3/.test(code) && /throw GradleException/.test(code));
check('release builds need an explicit versionCode', /pri\.versionCode/.test(gradle));

// ── the readiness record ────────────────────────────────────────────────────
const doc = existsSync(join(ROOT, 'docs/release/STORE_READINESS.md')) ? read('docs/release/STORE_READINESS.md') : '';
check('STORE_READINESS.md exists', !!doc);
check('submission is recorded as BLOCKED_EXTERNAL', /STORE SUBMISSION: BLOCKED_EXTERNAL/.test(doc));
check('physical validation is recorded as DEFERRED', /PHYSICAL DEVICE VALIDATION: DEFERRED/.test(doc));
check('the V1 iPad-only freeze is restated', /iPad only/.test(doc) && /BLOCKED_GOVERNANCE/.test(doc));
const flat = doc.replace(/\s+/g, ' ');
check('handwriting is never claimed to stay on the device', !/handwriting (images? )?(never|does not|doesn't) leaves? (the|this|your) device/i.test(flat.replace(/\*\*Do not\*\* declare that handwriting never leaves the device/g, ''))
  && /\*\*Do not\*\* declare that handwriting never leaves the device/.test(flat));
check('guardian confirmation is never called verifiable consent', !/\b(is|provides|gives|constitutes|counts as|amounts to) (a )?verifiable parental consent/i.test(flat.replace(/\bis \*\*not\*\* verifiable parental consent/g, '')));
for (const t of ['DeviceID', 'OtherDataTypes', 'PhotosorVideos', 'OtherUserContent', 'ProductInteraction']) {
  check(`the data table names ${t}`, new RegExp(`\\b${t}\\b`).test(doc));
}

console.log(fails.length
  ? `STORE READINESS: FAIL — ${fails.length} of ${pass + fails.length}\n  · ${fails.join('\n  · ')}`
  : `STORE READINESS: PASS — ${pass} checks (repository configuration only; no store has reviewed anything)`);
process.exit(fails.length ? 1 : 0);
