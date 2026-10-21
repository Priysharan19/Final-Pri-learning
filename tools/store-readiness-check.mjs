#!/usr/bin/env node
// STORE READINESS — store-facing configuration stays true to the code and to
// docs/release/app-store-privacy-labels.md (#506, ported from #304 / CP-12).
//
// docs/release/app-store-privacy-labels.md recorded that no content check held
// its data table and the Apple privacy manifest together. This is that check:
//   · both iOS packages carry the same privacy manifest, copied to the bundle
//     root, with no tracking, no tracking domains, every type linked;
//   · the manifest's collected data types are exactly the set the labels doc
//     records, and every one appears in the doc's table — adding or dropping a
//     type is a deliberate change to both, never a silent one;
//   · each required-reason API category the Swift code uses is declared with an
//     allowed reason, and none is declared without a use;
//   · the Android manifest asks for INTERNET only and refuses backup and
//     cleartext; no signing material is tracked, and the upload key must live
//     outside the repository.
// Repository configuration only: it never claims a store accepted anything.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
let passed = 0;
const failures = [];
const check = (condition, message) => { if (condition) passed += 1; else failures.push(message); };

// ── Apple privacy manifest ───────────────────────────────────────────────────
// The shipping package first: it is the manifest every other copy must equal.
const PKGS = readdirSync(join(ROOT, 'ios')).filter(p => p.endsWith('.swiftpm')).map(p => `ios/${p}`)
  .sort((x, y) => (y === 'ios/PriLearning.swiftpm') - (x === 'ios/PriLearning.swiftpm'));
check(PKGS.includes('ios/PriLearning.swiftpm'), `the shipping package is present (${PKGS.join(', ')})`);
const manifests = PKGS.map(p => `${p}/Resources/PrivacyInfo.xcprivacy`);
for (const m of manifests) check(existsSync(join(ROOT, m)), `${m} exists`);
const a = existsSync(join(ROOT, manifests[0])) ? read(manifests[0]) : '';
for (const m of manifests.slice(1)) check(existsSync(join(ROOT, m)) && read(m) === a, `${m} is identical to ${manifests[0]}`);
check(/^<\?xml[^>]*\?>\s*<!DOCTYPE plist/.test(a) && /<plist version="1.0">/.test(a), 'the privacy manifest is a plist');
check(/<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(a), 'NSPrivacyTracking is false');
check(/<key>NSPrivacyTrackingDomains<\/key>\s*<array(\/>|>\s*<\/array>)/.test(a), 'no tracking domains');
check(!/<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<true\/>/.test(a), 'no collected data type is used for tracking');
const types = [...a.matchAll(/<key>NSPrivacyCollectedDataType<\/key>\s*<string>NSPrivacyCollectedDataType(\w+)<\/string>/g)].map(x => x[1]);
check(types.length > 0 && new Set(types).size === types.length, `each collected type is declared once (${types.join(', ')})`);
// Each collected type is its own innermost <dict>; read keys per dict so key order does not matter.
const typeDicts = [...a.matchAll(/<dict>((?:(?!<\/?dict>)[\s\S])*?<key>NSPrivacyCollectedDataType<\/key>(?:(?!<\/?dict>)[\s\S])*?)<\/dict>/g)].map(m => m[1]);
check(typeDicts.length === types.length, `each collected type sits in its own dict (${typeDicts.length} dicts, ${types.length} types)`);
const unlinked = typeDicts.filter(d => !/<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<true\/>/.test(d))
  .map(d => (d.match(/NSPrivacyCollectedDataType(\w+)<\/string>/) || [])[1]);
check(unlinked.length === 0, `every collected type is declared linked to the signed-in account (${unlinked.join(', ')})`);
for (const p of PKGS) check(/\.copy\("Resources\/PrivacyInfo\.xcprivacy"\)/.test(read(`${p}/Package.swift`)), `${p}/Package.swift copies the manifest to the bundle root`);

// The labels doc and the manifest agree on the collected set.
const doc = read('docs/release/app-store-privacy-labels.md');
const recorded = (doc.match(/Collected types after this reconciliation: ([A-Za-z, ]+?) —/) || [])[1]?.split(/,\s*/).filter(Boolean) || [];
check(recorded.length > 0, 'the labels doc records the collected set ("Collected types after this reconciliation: …")');
const missingFromManifest = recorded.filter(t => !types.includes(t));
const missingFromDoc = types.filter(t => !recorded.includes(t));
check(missingFromManifest.length === 0 && missingFromDoc.length === 0,
  `the manifest's collected types are exactly the labels doc's set (manifest lacks: ${missingFromManifest.join(', ') || '—'}; doc lacks: ${missingFromDoc.join(', ') || '—'})`);
for (const t of types) check(doc.includes(`\`${t}\``), `the labels table has a row for ${t}`);
// Handwriting and photos go to the reader online (#418): both must be declared.
check(types.includes('OtherUserContent') && types.includes('PhotosorVideos'), 'handwriting images and camera photos are declared (OtherUserContent, PhotosorVideos)');

// Required-reason APIs: what the Swift code calls decides what must be declared.
const swift = PKGS.flatMap(p => readdirSync(join(ROOT, p), { recursive: true })
  .filter(f => String(f).endsWith('.swift')).map(f => read(join(p, String(f))))).join('\n');
const API = {
  UserDefaults: { used: /\bUserDefaults\b|@AppStorage/, reasons: ['CA92.1', '1C8F.1', 'C56D.1', 'AC6B.1'] },
  FileTimestamp: { used: /\.(creationDate|modificationDate|contentModificationDateKey|creationDateKey)\b|attributesOfItem|getattrlist|\bstat\(/, reasons: ['DDA9.1', 'C617.1', '3B52.1', '0A2A.1'] },
  SystemBootTime: { used: /systemUptime|mach_absolute_time/, reasons: ['35F9.1', '8FFB.1', '3D61.1'] },
  DiskSpace: { used: /volumeAvailableCapacity|systemFreeSize|statfs\(/, reasons: ['85F4.1', 'E174.1', '7D9E.1', 'B728.1'] },
  ActiveKeyboards: { used: /activeInputModes/, reasons: ['3EC4.1', '54BD.1'] },
};
const declared = Object.fromEntries([...a.matchAll(/<string>NSPrivacyAccessedAPICategory(\w+)<\/string>\s*<key>NSPrivacyAccessedAPITypeReasons<\/key>\s*<array>([\s\S]*?)<\/array>/g)]
  .map(m => [m[1], [...m[2].matchAll(/<string>([^<]+)<\/string>/g)].map(x => x[1])]));
for (const [category, rule] of Object.entries(API)) {
  if (rule.used.test(swift)) check((declared[category] || []).some(r => rule.reasons.includes(r)), `required-reason API ${category} is used and declared with an allowed reason (declared: ${(declared[category] || []).join(',') || 'none'})`);
  else check(!declared[category], `required-reason API ${category} is not declared without a use`);
}
check(Object.keys(declared).every(k => k in API), `no unknown required-reason category is declared (${Object.keys(declared).join(', ')})`);

// ── Android manifest ─────────────────────────────────────────────────────────
const android = read('android/app/src/main/AndroidManifest.xml');
const perms = [...android.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map(x => x[1]);
check(perms.length === 1 && perms[0] === 'android.permission.INTERNET', `Android asks for INTERNET only (${perms.join(', ')})`);
check(/android:allowBackup="false"/.test(android) && /android:fullBackupContent="false"/.test(android), 'Android refuses backup');
check(/android:usesCleartextTraffic="false"/.test(android), 'Android refuses cleartext');

// ── signing material ─────────────────────────────────────────────────────────
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
const secrets = tracked.filter(f => /\.(jks|keystore|p12|p8|pfx|mobileprovision)$/i.test(f) || /(^|\/)(key|keystore|signing|upload-signing)\.properties$/i.test(f));
check(secrets.length === 0, `no signing material is tracked (${secrets.join(', ')})`);
const gradle = read('android/app/build.gradle.kts');
check(/the upload keystore must live outside the repository/.test(gradle), 'release signing refuses an upload keystore inside the repository');
check(/require\(!bundleRequested \|\| unsignedRelease\)/.test(gradle), 'a release bundle without the upload key fails closed');

const total = passed + failures.length;
if (failures.length) {
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`STORE READINESS: FAIL — ${passed}/${total} checks`);
  process.exit(1);
}
console.log(`STORE READINESS: PASS — ${passed}/${total} checks — repository configuration only; no store has reviewed anything.`);
