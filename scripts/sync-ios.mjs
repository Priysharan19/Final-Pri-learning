// ─────────────────────────────────────────────────────────────────────────────
// Keeps every tracked native iPad web bundle in step with the client build.
// PriLearning.swiftpm is canonical; PriLearning 2.swiftpm is retained only for
// older Swift Playgrounds installs and must never execute a different client.
//
//   node scripts/sync-ios.mjs           copy client/dist over both bundles
//   node scripts/sync-ios.mjs --check   exit 1 if either bundle differs
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, rmSync, cpSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'client', 'dist');
const BUNDLES = [
  { label: 'PriLearning.swiftpm', web: join(ROOT, 'ios', 'PriLearning.swiftpm', 'Resources', 'Web') },
  { label: 'PriLearning 2.swiftpm', web: join(ROOT, 'ios', 'PriLearning 2.swiftpm', 'Resources', 'Web') },
];
const CHECK = process.argv.includes('--check');

if (!existsSync(DIST)) {
  console.error('client/dist does not exist — run `npm run build` first.');
  process.exit(2);
}

function fingerprint(dir, base = dir, acc = {}) {
  for (const name of readdirSync(dir)) {
    if (name === '.DS_Store') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) fingerprint(full, base, acc);
    else acc[full.slice(base.length + 1)] = createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 16);
  }
  return acc;
}
const drop = m => Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith('icons/')));
const built = drop(fingerprint(DIST));
let failed = false;

for (const bundle of BUNDLES) {
  const bundled = existsSync(bundle.web) ? drop(fingerprint(bundle.web)) : {};
  const names = [...new Set([...Object.keys(built), ...Object.keys(bundled)])].sort();
  const differing = names.filter(n => built[n] !== bundled[n]);

  if (!differing.length) {
    console.log(`${bundle.label} web bundle matches client/dist — ${names.length} files.`);
    continue;
  }
  if (CHECK) {
    failed = true;
    console.error(`${bundle.label} web bundle is out of step with client/dist — ${differing.length} of ${names.length} files differ:`);
    for (const n of differing.slice(0, 12)) console.error(`  ${!built[n] ? 'only in bundle' : !bundled[n] ? 'only in build ' : 'differs       '}  ${n}`);
    if (differing.length > 12) console.error(`  ... and ${differing.length - 12} more`);
    continue;
  }

  mkdirSync(bundle.web, { recursive: true });
  rmSync(join(bundle.web, 'assets'), { recursive: true, force: true });
  for (const name of readdirSync(DIST)) {
    if (name === '.DS_Store') continue;
    cpSync(join(DIST, name), join(bundle.web, name), { recursive: true });
  }
  console.log(`${bundle.label} web bundle refreshed from client/dist — ${differing.length} file(s) updated.`);
}

if (failed) {
  console.error('\nRun `npm run sync:ios` after `npm run build` to refresh both tracked iPad bundles.');
  process.exit(1);
}
