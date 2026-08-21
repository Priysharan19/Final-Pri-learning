// ─────────────────────────────────────────────────────────────────────────────
// Keeps ios/PriLearning.swiftpm/Resources/Web in step with the client build.
//
// The iPad app is the deployment target the README leads with, and its bundled
// copy of the web build went stale three times during one day's work — shipping
// code no figure in the README measured, including a marketing claim that had
// already been removed everywhere else. It drifted because refreshing it was a
// hand-typed rm/cp that nothing checked.
//
//   node scripts/sync-ios.mjs           copy client/dist over the bundle
//   node scripts/sync-ios.mjs --check   exit 1 if they differ (for CI)
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, rmSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'client', 'dist');
const WEB = join(ROOT, 'ios', 'PriLearning.swiftpm', 'Resources', 'Web');
const CHECK = process.argv.includes('--check');

if (!existsSync(DIST)) {
  console.error('client/dist does not exist — run `npm run build` first.');
  process.exit(2);
}

/** Every file under `dir`, as path → sha256, so a rename is a difference too. */
function fingerprint(dir, base = dir, acc = {}) {
  for (const name of readdirSync(dir)) {
    if (name === '.DS_Store') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) fingerprint(full, base, acc);
    else acc[full.slice(base.length + 1)] = createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 16);
  }
  return acc;
}

// icons/ is authored in the iOS bundle and has no counterpart in the build.
const drop = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith('icons/')));

const built = drop(fingerprint(DIST));
const bundled = existsSync(WEB) ? drop(fingerprint(WEB)) : {};

const names = [...new Set([...Object.keys(built), ...Object.keys(bundled)])].sort();
const differing = names.filter(n => built[n] !== bundled[n]);

if (!differing.length) {
  console.log(`iOS bundle matches client/dist — ${names.length} files.`);
  process.exit(0);
}

if (CHECK) {
  console.error(`iOS bundle is out of step with client/dist — ${differing.length} of ${names.length} files differ:`);
  for (const n of differing.slice(0, 12)) {
    console.error(`  ${!built[n] ? 'only in bundle' : !bundled[n] ? 'only in build ' : 'differs       '}  ${n}`);
  }
  if (differing.length > 12) console.error(`  ... and ${differing.length - 12} more`);
  console.error('\nRun `npm run sync:ios` after `npm run build`.');
  process.exit(1);
}

rmSync(join(WEB, 'assets'), { recursive: true, force: true });
for (const name of readdirSync(DIST)) {
  if (name === '.DS_Store') continue;
  cpSync(join(DIST, name), join(WEB, name), { recursive: true });
}
console.log(`iOS bundle refreshed from client/dist — ${differing.length} file(s) updated.`);
