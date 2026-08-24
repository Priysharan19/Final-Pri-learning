// ─────────────────────────────────────────────────────────────────────────────
// Native iPad source-of-truth drift gate.
//
// ios/PriLearning.swiftpm is canonical. The tracked "PriLearning 2.swiftpm"
// package exists because some iPad / Swift Playgrounds installs may still open
// that copy directly. Until it is retired, every Swift source and Package.swift
// must be byte-identical. Resources/Web is gated separately by sync-ios.mjs.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CANON = join(ROOT, 'ios', 'PriLearning.swiftpm');
const COPY = join(ROOT, 'ios', 'PriLearning 2.swiftpm');

if (!existsSync(CANON) || !existsSync(COPY)) {
  console.error('FAIL — expected both native iPad packages to exist');
  process.exit(1);
}

function sourceFiles(base, dir = base, out = new Map()) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(base, full);
    if (rel === 'Resources' || rel.startsWith(`Resources/`)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) sourceFiles(base, full, out);
    else if (name.endsWith('.swift') || rel === 'Package.swift') out.set(rel, readFileSync(full));
  }
  return out;
}

const canon = sourceFiles(CANON);
const copy = sourceFiles(COPY);
const paths = [...new Set([...canon.keys(), ...copy.keys()])].sort();
const failures = [];

for (const path of paths) {
  const a = canon.get(path), b = copy.get(path);
  if (!a) failures.push(`${path}: only in PriLearning 2.swiftpm`);
  else if (!b) failures.push(`${path}: missing from PriLearning 2.swiftpm`);
  else if (!a.equals(b)) failures.push(`${path}: source differs`);
}

if (failures.length) {
  console.error('\nFAIL — native iPad package drift detected');
  for (const failure of failures) console.error(`  ${failure}`);
  console.error('\nPriLearning.swiftpm is canonical. Regenerate the duplicate before shipping.');
  process.exit(1);
}
console.log(`PASS — native iPad packages are source-identical (${paths.length} files)`);
