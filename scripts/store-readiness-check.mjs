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
import { existsSync, readFileSync } from 'node:fs';
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
  const categories = [...a.matchAll(/<string>(NSPrivacyAccessedAPICategory\w+)<\/string>/g)].map(x => x[1]);
  check('required-reason API categories are declared', categories.length >= 1);
  const reasonBlocks = [...a.matchAll(/<key>NSPrivacyAccessedAPITypeReasons<\/key>\s*<array>([\s\S]*?)<\/array>/g)];
  check('every API category carries at least one reason', reasonBlocks.length === categories.length
    && reasonBlocks.every(r => /<string>[0-9A-F]{4}\.\d<\/string>/.test(r[1])));
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

// ── signing material ────────────────────────────────────────────────────────
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
const secrets = tracked.filter(f => /\.(jks|keystore|p12|p8|mobileprovision|pem)$/i.test(f) && !/test|fixture/i.test(f));
check('no signing material is tracked', secrets.length === 0, secrets.join(', '));
const gradle = read('android/app/build.gradle.kts');
check('release signing reads only the environment', /System\.getenv\("PRI_ANDROID_UPLOAD_KEYSTORE"\)/.test(gradle)
  && !/storePassword\s*=\s*"/.test(gradle) && !/keyPassword\s*=\s*"/.test(gradle));
check('release builds need an explicit versionCode', /pri\.versionCode/.test(gradle));

// ── the readiness record ────────────────────────────────────────────────────
const doc = existsSync(join(ROOT, 'docs/release/STORE_READINESS.md')) ? read('docs/release/STORE_READINESS.md') : '';
check('STORE_READINESS.md exists', !!doc);
check('submission is recorded as BLOCKED_EXTERNAL', /STORE SUBMISSION: BLOCKED_EXTERNAL/.test(doc));
check('physical validation is recorded as DEFERRED', /PHYSICAL DEVICE VALIDATION: DEFERRED/.test(doc));
check('the V1 iPad-only freeze is restated', /iPad only/.test(doc) && /BLOCKED_GOVERNANCE/.test(doc));
check('handwriting is not declared device-only', /never leaves the\s+device/.test(doc) && /\*\*Do not\*\* declare/.test(doc));
check('guardian confirmation is not called verifiable consent', /not\*\*\s+verifiable parental consent/.test(doc));

console.log(fails.length
  ? `STORE READINESS: FAIL — ${fails.length} of ${pass + fails.length}\n  · ${fails.join('\n  · ')}`
  : `STORE READINESS: PASS — ${pass} checks (repository configuration only; no store has reviewed anything)`);
process.exit(fails.length ? 1 : 0);
