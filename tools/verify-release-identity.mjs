import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertReleaseIdentity, resolveReleaseIdentity } from '../release/release-identity.mjs';

const root = process.cwd();
const expected = resolveReleaseIdentity({ root, production: true });
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
const requireNative = process.argv.includes('--require-native');
for (const nativePath of nativePaths) {
  if (!existsSync(nativePath)) {
    if (requireNative) assert.fail(`native release identity missing: ${nativePath}`);
    continue;
  }
  const native = JSON.parse(readFileSync(nativePath, 'utf8'));
  assert.deepEqual(native, expected, `native release identity drift: ${nativePath}`);
}

console.log(`RELEASE IDENTITY: PASS — ${expected.productVersion} ${expected.curriculumVersion} ${expected.releaseSha}`);
