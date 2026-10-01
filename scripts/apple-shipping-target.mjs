#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Apple shipping target (CP-04 × V1 scope freeze)
//
// docs/release/PRI_V1_RELEASE_SCOPE.md makes V1 iPad-only (hard blocker #1),
// and docs/release/release-policy.md releases only an exact `main` SHA. So
// `main` itself declares iPad only — it is always the V1 shipping target — and
// iPhone engineering (finger ink, iPhone simulator CI) builds from a scratch
// copy that adds the iPhone family. Nothing is ever archived from that copy.
//
//   node scripts/apple-shipping-target.mjs --status
//   node scripts/apple-shipping-target.mjs --check-v1           # exit 1 unless iPad-only
//   node scripts/apple-shipping-target.mjs --engineering-package <dir>
//        copies ios/PriLearning.swiftpm to <dir>/PriLearning.swiftpm with
//        iPad + iPhone families and prints the package path (simulator CI only)
//
// A public iPhone release needs the V1 scope-change procedure, then a reviewed
// change to `main`, not this helper.
// ─────────────────────────────────────────────────────────────────────────────
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['ios/PriLearning.swiftpm/Package.swift', 'ios/PriLearning 2.swiftpm/Package.swift'];
const FAMILIES = /supportedDeviceFamilies:\s*\[([^\]]*)\]/;

export function familiesOf(source) {
  const m = source.match(FAMILIES);
  if (!m) throw new Error('Package.swift declares no supportedDeviceFamilies');
  return [...m[1].matchAll(/\.(pad|phone)/g)].map(x => x[1]);
}

function withFamilies(source, families) {
  if (!FAMILIES.test(source)) throw new Error('Package.swift declares no supportedDeviceFamilies');
  const list = families.map(f => `                .${f}`).join(',\n');
  return source.replace(FAMILIES, `supportedDeviceFamilies: [\n${list}\n            ]`);
}
export const ipadOnly = source => withFamilies(source, ['pad']);
export const withPhone = source => withFamilies(source, ['pad', 'phone']);

/** Copy the canonical package to <dir> with the iPhone family added. */
export function engineeringPackage(dir) {
  const out = join(resolve(dir), 'PriLearning.swiftpm');
  mkdirSync(resolve(dir), { recursive: true });
  cpSync(join(ROOT, 'ios/PriLearning.swiftpm'), out, { recursive: true });
  const pkg = join(out, 'Package.swift');
  writeFileSync(pkg, withPhone(readFileSync(pkg, 'utf8')));
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2] || '--status';
  if (mode === '--engineering-package') {
    const dir = process.argv[3];
    if (!dir) { console.error('usage: --engineering-package <dir>'); process.exit(2); }
    console.log(engineeringPackage(dir));
    process.exit(0);
  }
  if (!['--status', '--check-v1'].includes(mode)) {
    console.error(`unknown mode ${mode} (use --status, --check-v1 or --engineering-package <dir>)`);
    process.exit(2);
  }
  let failed = false;
  for (const rel of PACKAGES) {
    if (!existsSync(join(ROOT, rel))) continue;
    const families = familiesOf(readFileSync(join(ROOT, rel), 'utf8'));
    const v1 = families.length === 1 && families[0] === 'pad';
    console.log(`${rel}: ${families.join(', ')}${v1 ? ' — V1 shipping target (iPad-only)' : ' — NOT the V1 shipping target'}`);
    if (!v1) failed = true;
  }
  if (mode === '--check-v1') console.log(failed ? 'APPLE SHIPPING TARGET: FAIL — main must be iPad-only for V1' : 'APPLE SHIPPING TARGET: PASS — both packages are iPad-only');
  process.exit(mode === '--check-v1' && failed ? 1 : 0);
}
