// ─────────────────────────────────────────────────────────────────────────────
// Generates the native iOS web bundles from the client build, and checks them.
//
// ios/*/Resources/Web is what the native shell serves over prilearning://app/.
// Since decision D28 (1 November 2026) it is generated, never tracked: Vite
// gives every asset a content hash, so tracking the two 11 MB mirrors made
// every client merge conflict every open client pull request on ~300
// generated files. Only the placeholder README that keeps the folder in git
// (Package.swift declares .copy("Resources/Web")) is tracked; .gitignore
// ignores everything else and tools/generated-bundles-untracked-check.mjs
// fails CI if a generated file is ever committed again.
//
// PriLearning.swiftpm is canonical; PriLearning 2.swiftpm is retained only for
// older Swift Playgrounds installs and must never execute a different client,
// so both receive the same client/dist.
//
//   node scripts/sync-ios.mjs           generate: copy client/dist into both packages,
//                                       then prove each copy is complete
//   node scripts/sync-ios.mjs --check   verify only: exit 1 unless each bundle is a
//                                       complete, byte-exact copy of client/dist
//
// Every CI lane and the archive path run `npm run build && npm run sync:ios &&
// npm run check:ios` before any Swift step. The functions are exported so
// client/test/ios-bundle-generation-check.mjs can prove, on a fixture tree,
// that the check still fails on a missing, stale, altered or absent bundle.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, rmSync, cpSync, existsSync, mkdirSync, openSync, fstatSync, closeSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const PACKAGES = Object.freeze(['PriLearning.swiftpm', 'PriLearning 2.swiftpm']);
/** The one tracked file under Resources/Web; never a build output. */
export const PLACEHOLDER = 'README.md';
/** A production client/dist always carries these; a bundle without them is not shippable. */
export const REQUIRED_FILES = Object.freeze(['index.html', 'release.json', 'features.json']);

export function bundlesFor(root) {
  return PACKAGES.map(label => ({ label, web: join(root, 'ios', label, 'Resources', 'Web') }));
}

/**
 * Relative path → short sha256 for every regular file under dir (.DS_Store
 * skipped). Each file is opened once and both the type check and the read go
 * through that one descriptor, so nothing can be swapped under the path
 * between the two (CodeQL js/file-system-race); the directory walk uses the
 * dirent types instead of a second stat.
 */
export function fingerprint(dir, base = dir, acc = {}) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { fingerprint(full, base, acc); continue; }
    let linkedDirectory = false;
    const fd = openSync(full, 'r');
    try {
      const stat = fstatSync(fd);
      if (stat.isFile()) acc[full.slice(base.length + 1).split('\\').join('/')] = createHash('sha256').update(readFileSync(fd)).digest('hex').slice(0, 16);
      else linkedDirectory = stat.isDirectory();
    } finally {
      closeSync(fd);
    }
    if (linkedDirectory) fingerprint(full, base, acc);
  }
  return acc;
}

function requireDist(dist) {
  if (!existsSync(dist)) throw new Error(`${dist} does not exist — run \`npm run build\` first.`);
  const missing = REQUIRED_FILES.filter(name => !existsSync(join(dist, name)));
  if (missing.length) throw new Error(`client/dist is not a complete production build: missing ${missing.join(', ')} — run \`npm run build\` again.`);
  // The sync copies every top-level build entry over the bundle, keeping only
  // the tracked placeholder; a build output of the same name would overwrite
  // that tracked file and the check would then misreport it. Refuse it here,
  // before anything is copied (nothing in client/public may be called README.md).
  if (existsSync(join(dist, PLACEHOLDER))) {
    throw new Error(`client/dist carries a top-level ${PLACEHOLDER}, the name of the tracked placeholder in ios/*/Resources/Web — the sync would overwrite a tracked file. Remove it from client/public; no build output may be called ${PLACEHOLDER}.`);
  }
}

/**
 * Copy client/dist into both packages. Every generated file already in a
 * bundle is removed first, so a stale hashed asset from an earlier build can
 * never survive beside the new one; the tracked placeholder is kept.
 */
export function syncBundles({ root, dist = join(root, 'client', 'dist') }) {
  requireDist(dist);
  const files = Object.keys(fingerprint(dist)).length;
  const results = [];
  for (const bundle of bundlesFor(root)) {
    mkdirSync(bundle.web, { recursive: true });
    for (const name of readdirSync(bundle.web)) {
      if (name === PLACEHOLDER) continue;
      rmSync(join(bundle.web, name), { recursive: true, force: true });
    }
    for (const name of readdirSync(dist)) {
      if (name === '.DS_Store') continue;
      cpSync(join(dist, name), join(bundle.web, name), { recursive: true });
    }
    results.push({ label: bundle.label, files });
  }
  return results;
}

/**
 * Prove each bundle is a complete, byte-exact copy of client/dist: every build
 * file present with the same hash, nothing generated beyond the build, and the
 * required release/feature manifests among them. A bundle that was never
 * generated is a failure, not a skip.
 */
export function checkBundles({ root, dist = join(root, 'client', 'dist') }) {
  requireDist(dist);
  const built = fingerprint(dist);
  const builtNames = Object.keys(built);
  const problems = [];
  const reports = [];
  for (const bundle of bundlesFor(root)) {
    const present = existsSync(bundle.web) ? readdirSync(bundle.web).filter(n => n !== PLACEHOLDER && n !== '.DS_Store') : [];
    if (!present.length) {
      problems.push(`${bundle.label}: web bundle has not been generated — run \`npm run sync:ios\` after \`npm run build\`.`);
      reports.push({ label: bundle.label, generated: false, files: 0, differing: [] });
      continue;
    }
    const bundled = fingerprint(bundle.web);
    delete bundled[PLACEHOLDER];
    const names = [...new Set([...builtNames, ...Object.keys(bundled)])].sort();
    const differing = names.filter(n => built[n] !== bundled[n]).map(file => ({
      file,
      kind: !built[file] ? 'stale: only in bundle' : !bundled[file] ? 'missing: only in build' : 'differs from build'
    }));
    reports.push({ label: bundle.label, generated: true, files: names.length, differing });
    if (differing.length) {
      problems.push(`${bundle.label}: web bundle is not a complete copy of client/dist — ${differing.length} of ${names.length} files differ.`);
    }
  }
  return { ok: problems.length === 0, problems, reports, built: builtNames.length };
}

function printReport(result) {
  for (const report of result.reports) {
    if (!report.generated) continue;
    if (!report.differing.length) console.log(`${report.label} web bundle is a complete copy of client/dist — ${report.files} files.`);
    else {
      console.error(`${report.label} web bundle is out of step with client/dist — ${report.differing.length} of ${report.files} files differ:`);
      for (const d of report.differing.slice(0, 12)) console.error(`  ${d.kind.padEnd(24)} ${d.file}`);
      if (report.differing.length > 12) console.error(`  ... and ${report.differing.length - 12} more`);
    }
  }
  for (const problem of result.problems) console.error(problem);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const check = process.argv.includes('--check');
  try {
    if (!check) {
      for (const r of syncBundles({ root })) console.log(`${r.label} web bundle generated from client/dist — ${r.files} files.`);
    }
    const result = checkBundles({ root });
    printReport(result);
    if (!result.ok) {
      console.error(check
        ? '\nIOS BUNDLES: FAIL — run `npm run build && npm run sync:ios`, then `npm run check:ios`. The bundles are generated, never committed.'
        : '\nIOS BUNDLES: FAIL — the sync did not produce a complete copy of client/dist.');
      process.exit(1);
    }
    console.log(`IOS BUNDLES: PASS — both packages carry a complete copy of client/dist (${result.built} files, release.json and features.json included).`);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}
