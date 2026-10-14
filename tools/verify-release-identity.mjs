import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertReleaseIdentity, resolveReleaseIdentity } from '../release/release-identity.mjs';

const root = process.cwd();
// A native package's release.json is stamped AFTER the exact clean-source build.
// A SHA embedded in tracked assets cannot equal its own final commit hash.
// Only this explicit packaging mode tolerates materialized derived-file drift.
const requireNative = process.argv.includes('--require-native');
const allowDerived = process.argv.includes('--allow-derived-materialization');
assert.ok(!allowDerived || requireNative, 'derived-materialization mode requires a native identity check');
const expected = resolveReleaseIdentity({ root, production: true, verifySource: !allowDerived });
if (allowDerived) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(expected.releaseSha, git(['rev-parse', 'HEAD']), 'packaged release SHA must equal checkout HEAD');
  const changed = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', 'HEAD'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const added = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const allowedRoots = ['ios/PriLearning.swiftpm/Resources/Web/', 'ios/PriLearning 2.swiftpm/Resources/Web/'];
  for (const file of [...changed, ...added]) {
    assert.ok(allowedRoots.some(prefix => file.startsWith(prefix)), `source or unapproved artifact changed during native materialization: ${file}`);
  }
}

assertReleaseIdentity(expected, { production: true });

const builtPath = join(root, 'client', 'dist', 'release.json');
assert.ok(existsSync(builtPath), 'client/dist/release.json is missing');
const built = JSON.parse(readFileSync(builtPath, 'utf8'));
assertReleaseIdentity(built, { production: true });
assert.deepEqual(built, expected, 'built web identity differs from exact candidate identity');

const nativePaths = [
  join(root, 'ios', 'PriLearning.swiftpm', 'Resources', 'Web', 'release.json'),
  join(root, 'ios', 'PriLearning 2.swiftpm', 'Resources', 'Web', 'release.json')
];
if (requireNative) {
  for (const nativePath of nativePaths) {
    assert.ok(existsSync(nativePath), `native release identity missing: ${nativePath}`);
    const native = JSON.parse(readFileSync(nativePath, 'utf8'));
    assert.deepEqual(native, expected, `native release identity drift: ${nativePath}`);
  }
}

console.log(`RELEASE IDENTITY: PASS — ${expected.productVersion} ${expected.curriculumVersion} ${expected.releaseSha}`);
