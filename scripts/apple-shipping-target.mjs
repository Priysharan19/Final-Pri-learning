#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Apple shipping target (CP-04 × V1 scope, amended by #504)
//
// docs/release/PRI_V1_RELEASE_SCOPE.md §22 (owner scope change, 16 Oct 2026,
// issue #504) makes the V1 Apple target iPhone + iPad from one package, and
// docs/release/release-policy.md releases only an exact `main` SHA. So `main`
// itself declares both families and CI builds exactly that package — there is
// no scratch "engineering copy" any more.
//
// The gate (both tracked packages, which check-native-package-sync.mjs keeps
// byte-identical) requires:
//   · supportedDeviceFamilies is exactly [.pad, .phone];
//   · iPhone is portrait-only: .portrait is unconditional, and landscape left,
//     landscape right and portrait upside-down are each restricted to .pad
//     (so iPad keeps all four orientations);
//   · bundle identifier stays com.prilearning.app — changing it would make the
//     iPhone build a different app and orphan on-device student data.
//
//   node scripts/apple-shipping-target.mjs --status
//   node scripts/apple-shipping-target.mjs --check-v1   # exit 1 unless the above holds
//
// Passing this gate is configuration evidence only. It is not iPhone device,
// accessibility, store-listing or release acceptance (PRI_V1_RELEASE_SCOPE §21).
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PACKAGES = ['ios/PriLearning.swiftpm/Package.swift', 'ios/PriLearning 2.swiftpm/Package.swift'];
export const BUNDLE_ID = 'com.prilearning.app';
export const REQUIRED_FAMILIES = ['pad', 'phone'];
const FAMILIES = /supportedDeviceFamilies:\s*\[([^\]]*)\]/;
const ORIENTATIONS = /supportedInterfaceOrientations:\s*\[([\s\S]*?)\n\s*\]/;

const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

export function familiesOf(source) {
  const m = stripComments(source).match(FAMILIES);
  if (!m) throw new Error('Package.swift declares no supportedDeviceFamilies');
  return [...m[1].matchAll(/\.(pad|phone|mac|tv|watch|vision)\b/g)].map(x => x[1]);
}

/** Map of orientation → device families it is restricted to ('all' when unconditional). */
export function orientationsOf(source) {
  const m = stripComments(source).match(ORIENTATIONS);
  if (!m) throw new Error('Package.swift declares no supportedInterfaceOrientations');
  const out = {};
  for (const x of m[1].matchAll(/\.(portrait|portraitUpsideDown|landscapeLeft|landscapeRight)\b(\(\.when\(deviceFamilies:\s*\[([^\]]*)\]\)\))?/g)) {
    out[x[1]] = x[2] ? [...x[3].matchAll(/\.(\w+)/g)].map(y => y[1]) : 'all';
  }
  return out;
}

export function bundleIdOf(source) {
  const m = stripComments(source).match(/bundleIdentifier:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

/** Every reason this Package.swift is not the V1 Apple shipping target; [] when it is. */
export function shippingProblems(source) {
  const problems = [];
  const families = familiesOf(source);
  if (JSON.stringify(families) !== JSON.stringify(REQUIRED_FAMILIES)) {
    problems.push(`device families are [${families.join(', ')}], V1 requires [${REQUIRED_FAMILIES.join(', ')}] (iPhone and iPad, #504)`);
  }
  const o = orientationsOf(source);
  if (o.portrait !== 'all') problems.push('portrait must be supported on every device family');
  for (const k of ['landscapeLeft', 'landscapeRight', 'portraitUpsideDown']) {
    if (JSON.stringify(o[k]) !== '["pad"]') {
      problems.push(`${k} must be declared and restricted to iPad (iPhone is portrait-only; iPad keeps all four) — found ${JSON.stringify(o[k] ?? 'absent')}`);
    }
  }
  const extra = Object.keys(o).filter(k => !['portrait', 'landscapeLeft', 'landscapeRight', 'portraitUpsideDown'].includes(k));
  if (extra.length) problems.push(`unexpected orientations: ${extra.join(', ')}`);
  const id = bundleIdOf(source);
  if (id !== BUNDLE_ID) problems.push(`bundle identifier is ${id}, must stay ${BUNDLE_ID}`);
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2] || '--status';
  if (!['--status', '--check-v1'].includes(mode)) {
    console.error(`unknown mode ${mode} (use --status or --check-v1)`);
    process.exit(2);
  }
  let failed = false;
  let seen = 0;
  for (const rel of PACKAGES) {
    if (!existsSync(join(ROOT, rel))) continue;
    seen++;
    const source = readFileSync(join(ROOT, rel), 'utf8');
    const problems = shippingProblems(source);
    console.log(`${rel}: ${familiesOf(source).join(', ')}${problems.length ? ' — NOT the V1 shipping target' : ' — V1 shipping target (iPhone portrait + iPad all orientations)'}`);
    for (const p of problems) console.log(`  · ${p}`);
    if (problems.length) failed = true;
  }
  if (!seen) { console.log('no Apple package found'); failed = true; }
  if (mode === '--check-v1') {
    console.log(failed
      ? 'APPLE SHIPPING TARGET: FAIL — both packages must declare iPhone + iPad, iPhone portrait-only, bundle id com.prilearning.app'
      : 'APPLE SHIPPING TARGET: PASS — both packages ship iPhone (portrait) + iPad (all orientations) as com.prilearning.app');
  }
  process.exit(mode === '--check-v1' && failed ? 1 : 0);
}
