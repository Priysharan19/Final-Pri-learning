// ─────────────────────────────────────────────────────────────────────────────
// Archive the native shell for one edition (ADR-0002): one package, two apps.
//
//   node scripts/archive-ios.mjs --edition priyabhata|prithagoras --out <dir>
//                                [--signed] [--team 8BY7H9SXY8]
//
// An SwiftPM app product carries one bundle id, so the edition is applied as
// build settings at archive time, from the table in check-native-archive.mjs:
//
//   priyabhata   com.prilearning.app          Priyabhata   AppIcon             https://app.prilearning.com
//   prithagoras  com.prilearning.prithagoras  Prithagoras  AppIconPrithagoras  https://au.prilearning.com
//
// and the bundled client must be that edition's build (client/dist built with
// PRI_EDITION=<edition>, then `npm run sync:ios`): the script refuses to archive
// otherwise, and runs the archive gate on the result. Unsigned by default
// (a local proof of what each archive embeds); --signed signs with the team's
// Apple Distribution identity for App Store Connect. Never commit-ish: nothing
// here reads or writes a credential.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITION_APPS, checkArchive } from './check-native-archive.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const edition = arg('--edition');
const out = arg('--out');
const team = arg('--team') || '8BY7H9SXY8';
const signed = process.argv.includes('--signed');
const entry = Object.entries(EDITION_APPS).find(([, v]) => v.edition === edition);
if (!entry || !out) {
  console.error('usage: archive-ios.mjs --edition priyabhata|prithagoras --out <dir> [--signed] [--team ID]');
  process.exit(2);
}
const [bundle, app] = entry;
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT, encoding: 'utf8' }).trim()) {
  console.error('the working tree has tracked changes: archive the exact commit');
  process.exit(1);
}
const built = JSON.parse(readFileSync(join(ROOT, 'client/dist/features.json'), 'utf8')).edition;
if (built !== app.edition) {
  console.error(`client/dist is the ${built} build; build it with PRI_EDITION=${app.edition} and run npm run sync:ios first`);
  process.exit(1);
}
const sync = spawnSync(process.execPath, [join(ROOT, 'scripts/sync-ios.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
if (sync.status !== 0) { console.error(sync.stdout + sync.stderr); process.exit(1); }
const sdk = (execFileSync('xcodebuild', ['-showsdks'], { encoding: 'utf8' }).match(/iphoneos(\d+(?:\.\d+)*)/) || [])[1];
if (!sdk) { console.error('no iOS SDK found'); process.exit(1); }
mkdirSync(out, { recursive: true });
const archive = join(out, `${app.edition}.xcarchive`);
const ent = join(out, 'entitlements.plist');
writeFileSync(ent, '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.developer.applesignin</key><array><string>Default</string></array></dict></plist>\n');
const settings = [
  `DEVELOPMENT_TEAM=${team}`, `PRI_CLOUD_ORIGIN=${app.origin}`, `PRODUCT_BUNDLE_IDENTIFIER=${bundle}`,
  `ASSETCATALOG_COMPILER_APPICON_NAME=${app.icon}`, `INFOPLIST_KEY_CFBundleDisplayName=${app.displayName}`,
  `CODE_SIGN_ENTITLEMENTS=${ent}`,
  // SwiftPM app products stamp the deployment target as the SDK (App Store Connect error 90725); pass the real one.
  `OTHER_LDFLAGS=-Xlinker -platform_version -Xlinker ios -Xlinker 16.0 -Xlinker ${sdk}`,
  ...(signed ? ['-allowProvisioningUpdates'] : ['CODE_SIGNING_ALLOWED=NO', 'CODE_SIGN_IDENTITY='])
];
const run = spawnSync('xcodebuild', ['archive', '-scheme', 'PriLearning', '-destination', 'generic/platform=iOS', '-archivePath', archive, ...settings],
  { cwd: join(ROOT, 'ios/PriLearning.swiftpm'), stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
writeFileSync(join(out, `${app.edition}-archive.log`), run.stdout + run.stderr);
if (run.status !== 0 || !existsSync(archive)) { console.error(`xcodebuild archive failed (log: ${join(out, `${app.edition}-archive.log`)})`); process.exit(1); }
const gate = checkArchive(archive, { sha });
console.log(`${app.edition}: ${bundle} · ${gate.info.CFBundleDisplayName} · version ${gate.info.CFBundleShortVersionString} (${gate.info.CFBundleVersion}) · origin ${gate.info.PRICloudOrigin} · web ${gate.releaseSha}`);
if (gate.problems.length) { for (const p of gate.problems) console.error(`  · ${p}`); console.error('NATIVE ARCHIVE GATE: FAIL'); process.exit(1); }
console.log(`NATIVE ARCHIVE GATE: PASS — ${archive}`);
