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
//   · crash data and the phone number have one answer everywhere: the code, the
//     Apple label, every manifest and the Play Data safety form must agree, and
//     the check proves on every run that it catches each way of breaking that;
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
const collectedIn = xml => [...xml.matchAll(/<key>NSPrivacyCollectedDataType<\/key>\s*<string>NSPrivacyCollectedDataType(\w+)<\/string>/g)].map(x => x[1]);
const types = collectedIn(a);
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
const recordedIn = label => (label.match(/Collected types after this reconciliation: ([A-Za-z, ]+?) —/) || [])[1]?.split(/,\s*/).filter(Boolean) || [];
const recorded = recordedIn(doc);
check(recorded.length > 0, 'the labels doc records the collected set ("Collected types after this reconciliation: …")');
const missingFromManifest = recorded.filter(t => !types.includes(t));
const missingFromDoc = types.filter(t => !recorded.includes(t));
check(missingFromManifest.length === 0 && missingFromDoc.length === 0,
  `the manifest's collected types are exactly the labels doc's set (manifest lacks: ${missingFromManifest.join(', ') || '—'}; doc lacks: ${missingFromDoc.join(', ') || '—'})`);
for (const t of types) check(doc.includes(`\`${t}\``), `the labels table has a row for ${t}`);
// Handwriting and photos go to the reader online (#418): both must be declared.
check(types.includes('OtherUserContent') && types.includes('PhotosorVideos'), 'handwriting images and camera photos are declared (OtherUserContent, PhotosorVideos)');

// ── Crash data and phone numbers: one answer everywhere ──────────────────────
// The check above ties the manifest to the label and nothing else, so a change
// that takes CrashData out of both keeps it green while the Play form still
// declares crash logs and the app still sends them. These two answers are held
// across the code, the Apple label, every manifest and the Play form, in both
// directions, because a store reader compares them and a parent relies on them.
/** The yes or no a table row opens its second cell with; null if there is neither. */
function answerIn(table, title) {
  const row = table.split('\n').find(line => line.startsWith(`| **${title}** |`));
  const cell = row?.split('|')[2]?.replace(/\*/g, '').trim() || '';
  return /^yes\b/i.test(cell) ? true : /^no\b/i.test(cell) ? false : null;
}
/** What Play's Step 3 ticks under a heading; a parenthesis is commentary, not a tick. */
function tickedIn(play, heading) {
  const line = play.split('\n').find(l => l.startsWith(`- **${heading}:**`)) || '';
  return line.slice(line.indexOf(':**') + 3).replace(/\([^)]*\)/g, '').split(';').map(item => item.trim()).filter(Boolean);
}
const steppedIn = (play, type) => play.split('\n').some(line => line.startsWith(`| ${type} | ✓ |`));

/** Every disagreement between the code, the Apple label, the manifests and the Play form. */
function privacyDisagreements({ label, play, manifestFiles, clientTelemetry, serverTelemetry }) {
  const problems = [];
  const hold = (topic, expected, statements) => {
    for (const [where, said] of Object.entries(statements)) {
      if (said !== expected) problems.push(`${topic}: expected ${expected}, but ${where} says ${said}`);
    }
  };
  const inEachManifest = type => Object.fromEntries(manifestFiles.map(([file, xml]) => [file, collectedIn(xml).includes(type)]));

  // The reporter and the route it posts to are what make crash data collected.
  const crashPath = /^export async function reportCrash\b/m.test(clientTelemetry) && /router\.post\('\/error'/.test(serverTelemetry);
  hold('crash data', crashPath, {
    'the labels doc collected set': recordedIn(label).includes('CrashData'),
    ...inEachManifest('CrashData'),
    'the Apple Crash Data row': answerIn(label, 'Diagnostics → Crash Data'),
    'the Play Crash logs row': answerIn(play, 'App info and performance → Crash logs'),
    'Play Step 3': tickedIn(play, 'App info and performance').includes('Crash logs'),
    'Play Step 4': steppedIn(play, 'Crash logs')
  });

  // SMS is off at launch (D3), which the Play row records. Turning it on is a
  // change to all of these together, never to one of them.
  const phone = answerIn(play, 'Personal info → Phone number');
  if (phone === null) problems.push('phone number: the Play row answers neither yes nor no');
  hold('phone number', phone, {
    'the labels doc collected set': recordedIn(label).includes('PhoneNumber'),
    ...inEachManifest('PhoneNumber'),
    'the Apple Phone Number row': answerIn(label, 'Contact Info → Phone Number'),
    'Play Step 3': tickedIn(play, 'Personal info').includes('Phone number'),
    'Play Step 4': steppedIn(play, 'Phone number')
  });
  return problems;
}

const stated = {
  label: doc,
  play: read('docs/release/play-data-safety.md'),
  manifestFiles: manifests.filter(m => existsSync(join(ROOT, m))).map(m => [m, read(m)]),
  clientTelemetry: read('client/src/platform/telemetry.js'),
  serverTelemetry: read('server/platform/telemetry.js')
};
const disagreements = privacyDisagreements(stated);
check(disagreements.length === 0, `crash data and the phone number have one answer in the code, the Apple label, the manifests and the Play form (${disagreements.join('; ') || 'they do'})`);

// A check that cannot fail proves nothing, so each way of breaking the agreement
// is applied here to the real documents, in memory, on every run. The first is
// the mutation that once left this file and the Play check green.
const withManifests = (world, edit) => ({ ...world, manifestFiles: world.manifestFiles.map(([file, xml]) => [file, edit(xml)]) });
const withoutCrashType = xml => xml.replace('NSPrivacyCollectedDataTypeCrashData', 'NSPrivacyCollectedDataTypeRemoved');
const withPhoneType = xml => xml.replace('<string>NSPrivacyCollectedDataTypeName</string>', '<string>NSPrivacyCollectedDataTypeName</string><!-- -->\n<key>NSPrivacyCollectedDataType</key><string>NSPrivacyCollectedDataTypePhoneNumber</string>');
const BREAKAGES = {
  'CrashData removed from the manifests and the label line, the Play form unchanged': world => ({
    ...withManifests(world, withoutCrashType), label: world.label.replace(', CrashData,', ',')
  }),
  'CrashData removed from one manifest': world => ({
    ...world, manifestFiles: world.manifestFiles.map(([file, xml], i) => [file, i === 0 ? withoutCrashType(xml) : xml])
  }),
  'the Apple Crash Data row says No': world => ({ ...world, label: world.label.replace('| **Diagnostics → Crash Data** | **Yes**', '| **Diagnostics → Crash Data** | **No**') }),
  'the Play Crash logs row says No': world => ({ ...world, play: world.play.replace('| **App info and performance → Crash logs** | Yes', '| **App info and performance → Crash logs** | No') }),
  'Play Step 3 does not tick Crash logs': world => ({ ...world, play: world.play.replace('- **App info and performance:** Crash logs; Diagnostics', '- **App info and performance:** Diagnostics') }),
  'Play Step 4 has no Crash logs form': world => ({ ...world, play: world.play.replace('| Crash logs | ✓ |', '| Crash logs | — |') }),
  'the crash reporter removed while every document still declares it': world => ({ ...world, clientTelemetry: world.clientTelemetry.replace('export async function reportCrash', 'async function retiredCrashReporter') }),
  'the crash route removed while every document still declares it': world => ({ ...world, serverTelemetry: world.serverTelemetry.replace("router.post('/error'", "router.post('/retired'") }),
  'PhoneNumber in the manifests while the Play row says No at launch': world => withManifests(world, withPhoneType),
  'the Apple Phone Number row says Yes': world => ({ ...world, label: world.label.replace('| **Contact Info → Phone Number** | **No at launch**', '| **Contact Info → Phone Number** | **Yes**') }),
  'the Play Phone number row says Yes alone': world => ({ ...world, play: world.play.replace('| **Personal info → Phone number** | **No at launch.**', '| **Personal info → Phone number** | **Yes.**') }),
  'Play Step 3 ticks Phone number': world => ({ ...world, play: world.play.replace('- **Personal info:** Name;', '- **Personal info:** Name; Phone number;') })
};
for (const [breakage, apply] of Object.entries(BREAKAGES)) {
  check(privacyDisagreements(apply(stated)).length > 0, `the agreement check catches: ${breakage}`);
}

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
