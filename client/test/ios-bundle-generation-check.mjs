// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the iOS web bundles are generated, complete, and out of git.
//
// Decision D28 (1 November 2026): ios/*/Resources/Web is written by
// `npm run build && npm run sync:ios` and never committed. This deterministic
// check proves, on fixture trees, that the three pieces keep their force:
//   1. scripts/sync-ios.mjs generates a complete, byte-exact copy of
//      client/dist into both packages, clears stale files and keeps the
//      tracked placeholder; `--check` fails on a missing, altered, stale or
//      never-generated bundle and on an incomplete build (mutations below);
//   2. tools/generated-bundles-untracked-check.mjs fails when a generated file
//      is committed, when the ignore rules are missing, when the placeholder
//      is gone or ignored, and when an Android asset is tracked;
//   3. scripts/resolve-generated-conflicts.sh clears the modify/delete
//      conflicts a pre-D28 branch gets when main is merged into it, restores
//      the placeholder and leaves every other conflict for the person.
// No build is needed; everything runs in temporary directories.
//
// Usage: node client/test/ios-bundle-generation-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGES, PLACEHOLDER, REQUIRED_FILES, checkBundles, fingerprint, syncBundles } from '../../scripts/sync-ios.mjs';
import { ANDROID_TRACKED_ASSETS, GENERATED_ROOTS, audit } from '../../tools/generated-bundles-untracked-check.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RESOLVER = join(ROOT, 'scripts', 'resolve-generated-conflicts.sh');
const UNTRACKED_CLI = join(ROOT, 'tools', 'generated-bundles-untracked-check.mjs');
let pass = 0;
const failures = [];
const ok = (cond, label) => (cond ? pass++ : failures.push(label));
const throwsWith = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(String(e?.message || e)); } };
const write = (file, text) => { mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, text); };
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 'Pri Test', GIT_AUTHOR_EMAIL: 'pri-test@invalid.example', GIT_COMMITTER_NAME: 'Pri Test', GIT_COMMITTER_EMAIL: 'pri-test@invalid.example', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const git = (repo, ...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: repo, encoding: 'utf8', env: GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
const gitTry = (repo, ...args) => spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: repo, encoding: 'utf8', env: GIT_ENV });
const tmp = mkdtempSync(join(tmpdir(), 'pri-ios-bundles-'));

try {
  // ── 1 · sync generates a complete copy; check proves it ────────────────────
  const fx = join(tmp, 'sync');
  const dist = join(fx, 'client', 'dist');
  const distFiles = {
    'index.html': '<!doctype html><html><head><script type="module" src="/assets/index-aaaa1111.js"></script></head><body></body></html>\n',
    'release.json': '{\n  "releaseSha": "a".repeat(40)\n}\n',
    'features.json': '{\n  "placement": false\n}\n',
    'sw.js': 'self.addEventListener("install", () => {});\n',
    'assets/index-aaaa1111.js': 'console.log("entry");\n',
    'assets/index-aaaa1111.css': 'body{margin:0}\n',
    'icons/icon-192.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]).toString('binary')
  };
  for (const [rel, body] of Object.entries(distFiles)) {
    mkdirSync(join(dist, rel, '..'), { recursive: true });
    writeFileSync(join(dist, rel), rel.endsWith('.png') ? Buffer.from(body, 'binary') : body);
  }
  const webs = PACKAGES.map(pkg => join(fx, 'ios', pkg, 'Resources', 'Web'));
  for (const web of webs) write(join(web, PLACEHOLDER), '# placeholder\n');
  write(join(webs[0], 'assets', 'index-old0000.js'), 'stale from an earlier build\n');
  write(join(webs[1], 'leftover.txt'), 'stale\n');

  ok(PACKAGES.length === 2 && PACKAGES[0] === 'PriLearning.swiftpm', 'the canonical package comes first, the compatibility copy second');
  ok(JSON.stringify(REQUIRED_FILES) === JSON.stringify(['index.html', 'release.json', 'features.json']), 'a complete build means index.html, release.json and features.json');

  const synced = syncBundles({ root: fx });
  ok(synced.length === 2 && synced.every(r => r.files === Object.keys(distFiles).length), `sync reports every build file for both packages (${JSON.stringify(synced)})`);
  const built = fingerprint(dist);
  for (const [i, web] of webs.entries()) {
    const copy = fingerprint(web);
    ok(copy[PLACEHOLDER] !== undefined, `${PACKAGES[i]}: the tracked placeholder survives the sync`);
    delete copy[PLACEHOLDER];
    ok(JSON.stringify(copy) === JSON.stringify(built), `${PACKAGES[i]}: the bundle is a byte-exact copy of client/dist`);
  }
  ok(!existsSync(join(webs[0], 'assets', 'index-old0000.js')) && !existsSync(join(webs[1], 'leftover.txt')), 'a stale file from an earlier build does not survive the sync');
  const clean = checkBundles({ root: fx });
  ok(clean.ok && clean.problems.length === 0 && clean.built === Object.keys(distFiles).length, `a fresh sync passes the check (${clean.problems.join('; ')})`);
  ok(clean.reports.every(r => r.generated && r.differing.length === 0 && r.files === clean.built), 'the check counts every build file in both bundles');

  // ── 2 · mutations the check must catch ─────────────────────────────────────
  const mutate = (label, apply, expect) => {
    apply();
    const r = checkBundles({ root: fx });
    ok(!r.ok && expect(r), `${label} fails the check (${r.problems.join('; ') || 'passed'})`);
    syncBundles({ root: fx });
    ok(checkBundles({ root: fx }).ok, `${label}: a re-sync repairs it`);
  };
  mutate('a build file missing from the compatibility bundle',
    () => rmSync(join(webs[1], 'assets', 'index-aaaa1111.css')),
    r => r.reports[1].differing.some(d => d.file === 'assets/index-aaaa1111.css' && /missing/.test(d.kind)) && r.reports[0].differing.length === 0);
  mutate('an altered index.html in the canonical bundle',
    () => writeFileSync(join(webs[0], 'index.html'), '<!doctype html><script>alert(1)</script>\n'),
    r => r.reports[0].differing.some(d => d.file === 'index.html' && /differs/.test(d.kind)));
  mutate('a stale hashed asset beside the new one',
    () => writeFileSync(join(webs[0], 'assets', 'index-zzzz9999.js'), 'old\n'),
    r => r.reports[0].differing.some(d => d.file === 'assets/index-zzzz9999.js' && /stale/.test(d.kind)));
  mutate('a release.json from another commit',
    () => writeFileSync(join(webs[1], 'release.json'), '{\n  "releaseSha": "b".repeat(40)\n}\n'),
    r => r.reports[1].differing.some(d => d.file === 'release.json'));
  mutate('a features.json with a flag switched on',
    () => writeFileSync(join(webs[0], 'features.json'), '{\n  "placement": true\n}\n'),
    r => r.reports[0].differing.some(d => d.file === 'features.json'));
  mutate('a bundle that was never generated',
    () => { for (const n of readdirSync(webs[1])) if (n !== PLACEHOLDER) rmSync(join(webs[1], n), { recursive: true, force: true }); },
    r => r.problems.some(p => /has not been generated/.test(p)) && r.reports[1].generated === false);
  mutate('a bundle folder that does not exist at all',
    () => rmSync(webs[1], { recursive: true, force: true }),
    r => r.problems.some(p => /has not been generated/.test(p)));
  ok(existsSync(webs[1]) && !existsSync(join(webs[1], PLACEHOLDER)), 'a re-sync recreates the folder; the placeholder itself comes back from git, never from the sync');
  write(join(webs[1], PLACEHOLDER), '# placeholder\n');

  // An incomplete build is refused by sync and check alike, before any copy.
  for (const required of REQUIRED_FILES) {
    const body = readFileSync(join(dist, required));
    rmSync(join(dist, required));
    ok(throwsWith(() => syncBundles({ root: fx }), new RegExp(`not a complete production build: missing ${required}`)), `sync refuses a client/dist without ${required}`);
    ok(throwsWith(() => checkBundles({ root: fx }), new RegExp(`not a complete production build: missing ${required}`)), `check refuses a client/dist without ${required}`);
    writeFileSync(join(dist, required), body);
  }
  ok(throwsWith(() => checkBundles({ root: fx, dist: join(fx, 'nowhere') }), /does not exist — run `npm run build` first/), 'no client/dist at all is named as such');
  ok(checkBundles({ root: fx }).ok, 'the fixture is whole again');

  // ── 3 · the untracked guard on a fixture repository ────────────────────────
  const repo = join(tmp, 'guard');
  mkdirSync(repo, { recursive: true });
  git(repo, 'init', '-q', '-b', 'main');
  cpSync(join(ROOT, '.gitignore'), join(repo, '.gitignore'));
  mkdirSync(join(repo, 'android'), { recursive: true });
  cpSync(join(ROOT, 'android', '.gitignore'), join(repo, 'android', '.gitignore'));
  for (const root of GENERATED_ROOTS) write(join(repo, root, PLACEHOLDER), '# placeholder\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'placeholders');
  const good = audit(repo);
  ok(good.problems.length === 0 && good.tracked.length === 2, `a repository that tracks only the placeholders passes (${good.problems.join('; ')})`);
  ok(spawnSync(process.execPath, [UNTRACKED_CLI, '--repo', repo], { encoding: 'utf8' }).status === 0, 'the CLI exits 0 on it');

  // Mutation: a generated file forced into git.
  write(join(repo, GENERATED_ROOTS[0], 'assets', 'index-abcd1234.js'), 'generated\n');
  git(repo, 'add', '-f', join(GENERATED_ROOTS[0], 'assets', 'index-abcd1234.js'));
  git(repo, 'commit', '-qm', 'oops');
  const trackedBundle = audit(repo);
  ok(trackedBundle.problems.some(p => /generated file is tracked: ios\/PriLearning\.swiftpm\/Resources\/Web\/assets\/index-abcd1234\.js/.test(p)), 'a committed generated file is named');
  const cli = spawnSync(process.execPath, [UNTRACKED_CLI, '--repo', repo], { encoding: 'utf8' });
  ok(cli.status === 1 && /GENERATED BUNDLES UNTRACKED: FAIL/.test(cli.stderr), 'the CLI exits 1 and says FAIL');
  git(repo, 'rm', '-q', '--cached', join(GENERATED_ROOTS[0], 'assets', 'index-abcd1234.js'));
  git(repo, 'commit', '-qm', 'untrack again');
  rmSync(join(repo, GENERATED_ROOTS[0], 'assets'), { recursive: true, force: true });
  ok(audit(repo).problems.length === 0, 'removing it from the index restores the pass');

  // Mutation: the ignore rules disappear.
  const ignoreText = readFileSync(join(repo, '.gitignore'), 'utf8');
  writeFileSync(join(repo, '.gitignore'), ignoreText.split('\n').filter(l => !/Resources\/Web/.test(l)).join('\n'));
  const noRules = audit(repo);
  ok(noRules.problems.filter(p => /generated path is not ignored/.test(p)).length >= 2 * 5, `without the ignore rules every generated sample is reported (${noRules.problems.length} problems)`);
  writeFileSync(join(repo, '.gitignore'), ignoreText);

  // Mutation: the placeholder itself is ignored, so it could never be committed.
  writeFileSync(join(repo, '.gitignore'), ignoreText.split('\n').filter(l => !l.startsWith('!ios/')).join('\n'));
  ok(audit(repo).problems.some(p => /placeholder is ignored/.test(p)), 'an ignore rule that swallows the placeholder is reported');
  writeFileSync(join(repo, '.gitignore'), ignoreText);

  // Mutation: the placeholder is deleted from git.
  git(repo, 'rm', '-q', join(GENERATED_ROOTS[1], PLACEHOLDER));
  git(repo, 'commit', '-qm', 'drop placeholder');
  ok(audit(repo).problems.some(p => new RegExp(`placeholder is not tracked: ${GENERATED_ROOTS[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(p)), 'a missing placeholder is reported');
  write(join(repo, GENERATED_ROOTS[1], PLACEHOLDER), '# placeholder\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'placeholder back');
  ok(audit(repo).problems.length === 0, 'restoring it passes again');

  // Mutation: an Android web asset committed under src/main/assets.
  write(join(repo, ANDROID_TRACKED_ASSETS, 'web', 'index.html'), '<html></html>\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'android asset');
  ok(audit(repo).problems.some(p => /tracked Android asset: android\/app\/src\/main\/assets\/web\/index\.html/.test(p)), 'a tracked Android asset is reported');

  // ── 4 · the conflict resolver on a pre-D28 branch ──────────────────────────
  const merge = join(tmp, 'merge');
  mkdirSync(merge, { recursive: true });
  git(merge, 'init', '-q', '-b', 'main');
  for (const root of GENERATED_ROOTS) {
    write(join(merge, root, 'index.html'), 'old index\n');
    write(join(merge, root, 'assets', 'index-aaaa0000.js'), 'old chunk\n');
    write(join(merge, root, 'sw.js'), 'old sw\n');
  }
  write(join(merge, 'client', 'src', 'app.js'), 'base\n');
  write(join(merge, 'docs', 'note.md'), 'base\n');
  git(merge, 'add', '-A');
  git(merge, 'commit', '-qm', 'base: tracked bundles');
  // The feature branch rebuilt the client and committed the new hashed bundle.
  git(merge, 'checkout', '-qb', 'feature');
  for (const root of GENERATED_ROOTS) {
    writeFileSync(join(merge, root, 'index.html'), 'feature index\n');
    rmSync(join(merge, root, 'assets', 'index-aaaa0000.js'));
    write(join(merge, root, 'assets', 'index-bbbb1111.js'), 'feature chunk\n');
  }
  write(join(merge, 'client', 'src', 'app.js'), 'feature\n');
  git(merge, 'add', '-A');
  git(merge, 'commit', '-qm', 'feature: client change plus synced bundle');
  // main untracked the bundles (this PR) and also edited the same source line.
  git(merge, 'checkout', '-q', 'main');
  git(merge, 'rm', '-r', '-q', '--cached', ...GENERATED_ROOTS);
  for (const root of GENERATED_ROOTS) {
    rmSync(join(merge, root), { recursive: true, force: true });
    write(join(merge, root, PLACEHOLDER), '# generated, see README\n');
  }
  writeFileSync(join(merge, '.gitignore'), GENERATED_ROOTS.flatMap(r => [`${r}/*`, `!${r}/${PLACEHOLDER}`]).join('\n') + '\n');
  write(join(merge, 'client', 'src', 'app.js'), 'main\n');
  write(join(merge, 'docs', 'note.md'), 'main\n');
  git(merge, 'add', '-A');
  git(merge, 'commit', '-qm', 'main: untrack generated bundles');
  git(merge, 'checkout', '-q', 'feature');
  const attempted = gitTry(merge, 'merge', 'main', '-m', 'merge main');
  ok(attempted.status !== 0, 'merging main into the pre-D28 branch stops on conflicts');
  const unmergedBefore = git(merge, 'diff', '--name-only', '--diff-filter=U').trim().split('\n').filter(Boolean);
  ok(unmergedBefore.filter(f => /Resources\/Web\//.test(f)).length === 2 * 1 && unmergedBefore.includes('client/src/app.js'),
    `the conflicts are the modified bundle files plus the real source conflict (${unmergedBefore.join(', ')})`);

  const dry = spawnSync('bash', [RESOLVER, '--dry-run'], { cwd: merge, encoding: 'utf8', env: GIT_ENV });
  ok(dry.status === 0 && /would remove from index/.test(dry.stdout) && /would restore README\.md/.test(dry.stdout), 'the dry run describes the change');
  ok(git(merge, 'diff', '--name-only', '--diff-filter=U').trim().split('\n').filter(Boolean).length === unmergedBefore.length, 'and changes nothing');

  const resolved = spawnSync('bash', [RESOLVER], { cwd: merge, encoding: 'utf8', env: GIT_ENV });
  ok(resolved.status === 0, `the resolver exits 0 (${resolved.stderr.trim()})`);
  const unmergedAfter = git(merge, 'diff', '--name-only', '--diff-filter=U').trim().split('\n').filter(Boolean);
  ok(JSON.stringify(unmergedAfter) === JSON.stringify(['client/src/app.js']), `only the real source conflict remains (${unmergedAfter.join(', ')})`);
  ok(/conflicts remaining outside the generated roots:\n\s+client\/src\/app\.js/.test(resolved.stdout), 'and it is listed for the person');
  const indexed = git(merge, 'ls-files', '-s', '--', ...GENERATED_ROOTS).trim().split('\n').filter(Boolean);
  ok(indexed.length === 2 && indexed.every(l => /^100644 [0-9a-f]{40} 0\t/.test(l) && l.endsWith(`/${PLACEHOLDER}`)), `the index holds exactly the two placeholders at stage 0 (${indexed.join(' | ')})`);
  for (const root of GENERATED_ROOTS) {
    const left = existsSync(join(merge, root)) ? readdirSync(join(merge, root)) : [];
    ok(JSON.stringify(left) === JSON.stringify([PLACEHOLDER]), `${root}: the working tree keeps only the placeholder (${left.join(', ')})`);
    ok(readFileSync(join(merge, root, PLACEHOLDER), 'utf8') === '# generated, see README\n', `${root}: the placeholder is main's copy`);
  }
  ok(readFileSync(join(merge, 'docs', 'note.md'), 'utf8') === 'main\n', 'a cleanly merged file outside the roots is untouched');
  ok(/<<<<<<< /.test(readFileSync(join(merge, 'client', 'src', 'app.js'), 'utf8')), 'the source conflict is left exactly as git made it');
  write(join(merge, 'client', 'src', 'app.js'), 'resolved\n');
  git(merge, 'add', 'client/src/app.js');
  git(merge, 'commit', '-qm', 'merge main');
  ok(git(merge, 'log', '--oneline', '-1').includes('merge main'), 'the merge then commits');
  ok(audit(merge).problems.filter(p => !/not ignored: android/.test(p)).length === 0, 'and the merged branch passes the untracked guard');
  ok(spawnSync('bash', [RESOLVER], { cwd: merge, encoding: 'utf8', env: GIT_ENV }).status === 0 && git(merge, 'status', '--short').trim() === '', 'running the resolver again on a clean tree is a no-op');
  ok(spawnSync('bash', [RESOLVER, '--nonsense'], { cwd: merge, encoding: 'utf8', env: GIT_ENV }).status === 2, 'an unknown argument is refused');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failures.length) {
  for (const f of failures) console.log('  ✖ ' + f);
  console.log(`IOS BUNDLE GENERATION: FAIL — ${pass}/${pass + failures.length} checks.`);
  process.exit(1);
}
console.log(`IOS BUNDLE GENERATION: PASS — ${pass}/${pass} checks — sync produces a complete copy of client/dist, the check catches a missing, altered, stale or absent bundle, the guard keeps generated files out of git, and the resolver clears pre-D28 merge conflicts.`);
