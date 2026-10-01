#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Apple shipping target gate (CP-04 × V1 scope freeze)
//
// docs/release/PRI_V1_RELEASE_SCOPE.md makes V1 iPad-only; its hard release
// blocker #1 is that the shipping target must genuinely be iPad-only. The
// cross-platform programme keeps iPhone engineering alive on main (finger ink,
// iPhone simulator CI), so the device family is applied as a deterministic,
// verifiable release step instead of being lost or forked:
//
//   node scripts/apple-shipping-target.mjs --status        # what main declares
//   node scripts/apple-shipping-target.mjs --check-v1      # exit 1 unless iPad-only
//   node scripts/apple-shipping-target.mjs --apply-v1      # make both packages iPad-only
//
// --apply-v1 rewrites only `supportedDeviceFamilies` in BOTH Swift packages
// (they must stay source-identical) and is idempotent. Run it on the V1
// release-candidate branch, then --check-v1 must pass before archiving.
// Public iPhone/Android release needs the scope-change procedure first.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['ios/PriLearning.swiftpm/Package.swift', 'ios/PriLearning 2.swiftpm/Package.swift'];
const FAMILIES = /supportedDeviceFamilies:\s*\[([^\]]*)\]/;

export function familiesOf(source) {
  const m = source.match(FAMILIES);
  if (!m) throw new Error('Package.swift declares no supportedDeviceFamilies');
  return [...m[1].matchAll(/\.(pad|phone)/g)].map(x => x[1]);
}

export function ipadOnly(source) {
  if (!FAMILIES.test(source)) throw new Error('Package.swift declares no supportedDeviceFamilies');
  return source.replace(FAMILIES, 'supportedDeviceFamilies: [\n                .pad\n            ]');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2] || '--status';
  let failed = false;
  for (const rel of PACKAGES) {
    const file = join(ROOT, rel);
    const source = readFileSync(file, 'utf8');
    if (mode === '--apply-v1') {
      writeFileSync(file, ipadOnly(source));
      console.log(`${rel}: iPad-only (V1 shipping target applied)`);
      continue;
    }
    const families = familiesOf(source);
    const v1 = families.length === 1 && families[0] === 'pad';
    console.log(`${rel}: ${families.join(', ')}${v1 ? ' — V1 shipping target (iPad-only)' : ' — NOT the V1 shipping target'}`);
    if (mode === '--check-v1' && !v1) failed = true;
  }
  if (mode === '--check-v1') {
    console.log(failed
      ? 'APPLE SHIPPING TARGET: FAIL — V1 must be iPad-only (run --apply-v1 on the release-candidate branch)'
      : 'APPLE SHIPPING TARGET: PASS — both packages are iPad-only');
  }
  process.exit(failed ? 1 : 0);
}
