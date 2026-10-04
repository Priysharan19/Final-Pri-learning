#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android embedded-web parity (CP-06)
//
// The Android build copies client/dist into generated assets (assets/web) via
// its `syncPriWeb` Gradle task; nothing is committed. This check proves the
// APK carries exactly the shared web build that was produced: every file's
// hash matches client/dist and release.json (the release SHA) is identical.
//
//   npm run build && (cd android && ./gradlew assembleDebug) && node scripts/sync-android.mjs --check
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'client', 'dist');
const EMBEDDED = join(ROOT, 'android', 'app', 'build', 'generated', 'priWeb', 'web');

function fingerprint(dir, base = dir, acc = {}) {
  for (const name of readdirSync(dir)) {
    if (name === '.DS_Store') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) fingerprint(full, base, acc);
    else acc[full.slice(base.length + 1)] = createHash('sha256').update(readFileSync(full)).digest('hex');
  }
  return acc;
}

if (!existsSync(join(DIST, 'index.html'))) { console.error('client/dist is missing — run `npm run build` first.'); process.exit(2); }
if (!existsSync(join(EMBEDDED, 'index.html'))) { console.error('Android embedded web is missing — run the Gradle build (syncPriWeb) first.'); process.exit(2); }

const built = fingerprint(DIST);
const embedded = fingerprint(EMBEDDED);
const names = [...new Set([...Object.keys(built), ...Object.keys(embedded)])].sort();
const differing = names.filter(n => built[n] !== embedded[n]);
const release = existsSync(join(DIST, 'release.json')) ? JSON.parse(readFileSync(join(DIST, 'release.json'), 'utf8')) : null;
const embeddedRelease = existsSync(join(EMBEDDED, 'release.json')) ? JSON.parse(readFileSync(join(EMBEDDED, 'release.json'), 'utf8')) : null;
const sameRelease = !!release && !!embeddedRelease && release.releaseSha === embeddedRelease.releaseSha && /^[0-9a-f]{40}$/.test(release.releaseSha || '');

if (differing.length || !sameRelease) {
  console.error(`ANDROID WEB PARITY: FAIL — ${differing.length} of ${names.length} files differ${sameRelease ? '' : '; release identity differs or is invalid'}`);
  for (const n of differing.slice(0, 12)) console.error(`  ${!built[n] ? 'only embedded' : !embedded[n] ? 'only in dist ' : 'differs      '}  ${n}`);
  process.exit(1);
}
console.log(`ANDROID WEB PARITY: PASS — ${names.length} files identical to client/dist; release ${release.releaseSha.slice(0, 12)}`);
