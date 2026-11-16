#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// GENERATED BUNDLES STAY OUT OF GIT (decision D28, 1 November 2026).
//
// ios/*/Resources/Web is written by `npm run build && npm run sync:ios` and is
// never committed: only the placeholder README that keeps the folder in git is
// tracked. This check reads git itself and refuses:
//   • any tracked file under either generated root other than the placeholder;
//   • a missing placeholder (Package.swift's .copy("Resources/Web") needs the
//     folder to exist before the first sync);
//   • an ignore rule that no longer covers a generated file, or that covers the
//     placeholder;
//   • a tracked file under android/app/src/main/assets (the Gradle build copies
//     client/dist into a generated, ignored directory instead).
// It is deliberately dependency-free so it runs before any package install.
//
//   node tools/generated-bundles-untracked-check.mjs            # this repository
//   node tools/generated-bundles-untracked-check.mjs --repo DIR # a fixture (the regression test)
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const GENERATED_ROOTS = Object.freeze([
  'ios/PriLearning.swiftpm/Resources/Web',
  'ios/PriLearning 2.swiftpm/Resources/Web'
]);
export const PLACEHOLDER = 'README.md';
export const ANDROID_TRACKED_ASSETS = 'android/app/src/main/assets';
export const ANDROID_GENERATED_SAMPLE = 'android/app/build/generated/priWeb/web/index.html';
/** Representative generated paths; every one must be ignored. */
export const MUST_IGNORE = Object.freeze([
  ...GENERATED_ROOTS.flatMap(root => [
    `${root}/index.html`, `${root}/release.json`, `${root}/features.json`, `${root}/sw.js`,
    `${root}/assets/index-0123abcd.js`, `${root}/assets/index-0123abcd.css`, `${root}/icons/icon-192.png`
  ]),
  ANDROID_GENERATED_SAMPLE
]);

function makeGit(repo) {
  return (args, input) => {
    try {
      return { status: 0, stdout: execFileSync('git', args, { cwd: repo, encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] }) };
    } catch (error) {
      return { status: typeof error.status === 'number' ? error.status : 128, stdout: String(error.stdout || '') };
    }
  };
}

/** Returns { problems, tracked } for the repository at repo. */
export function audit(repo, git = makeGit(repo)) {
  const problems = [];
  const listed = git(['ls-files', '-z', '--', ...GENERATED_ROOTS]);
  if (listed.status !== 0) return { problems: [`git ls-files failed in ${repo}`], tracked: [] };
  const tracked = listed.stdout.split('\0').filter(Boolean);
  const placeholders = GENERATED_ROOTS.map(root => `${root}/${PLACEHOLDER}`);
  for (const placeholder of placeholders) {
    if (!tracked.includes(placeholder)) problems.push(`placeholder is not tracked: ${placeholder} (Package.swift needs the folder to exist before the first sync)`);
  }
  for (const file of tracked) {
    if (!placeholders.includes(file)) problems.push(`generated file is tracked: ${file} — git rm --cached it; bundles come from npm run build && npm run sync:ios`);
  }
  // check-ignore exits 0 when the path is ignored, 1 when it is not. --no-index
  // asks about the rules alone, so a generated file someone force-added still
  // counts as covered and a tracked placeholder is still seen if a rule
  // swallows it.
  for (const path of MUST_IGNORE) {
    const r = git(['check-ignore', '-q', '--no-index', '--', path]);
    if (r.status !== 0) problems.push(`generated path is not ignored: ${path}`);
  }
  for (const placeholder of placeholders) {
    const r = git(['check-ignore', '-q', '--no-index', '--', placeholder]);
    if (r.status === 0) problems.push(`placeholder is ignored and could not be committed: ${placeholder}`);
  }
  const android = git(['ls-files', '-z', '--', ANDROID_TRACKED_ASSETS]);
  for (const file of android.stdout.split('\0').filter(Boolean)) {
    problems.push(`tracked Android asset: ${file} — the Gradle build copies client/dist into app/build/generated/priWeb`);
  }
  return { problems, tracked };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const at = process.argv.indexOf('--repo');
  const repo = at > 0 ? process.argv[at + 1] : join(dirname(fileURLToPath(import.meta.url)), '..');
  const { problems, tracked } = audit(repo);
  if (problems.length) {
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error(`GENERATED BUNDLES UNTRACKED: FAIL — ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(`GENERATED BUNDLES UNTRACKED: PASS — ${GENERATED_ROOTS.length} generated roots track only their placeholder (${tracked.length} file(s)), ${MUST_IGNORE.length} generated paths are ignored, no tracked Android asset.`);
}
