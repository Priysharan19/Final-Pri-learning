import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const moduleFile = join(root, 'release', 'release-identity.mjs');
const metadataFile = join(root, 'release', 'metadata.json');

assert.ok(existsSync(moduleFile), 'release identity module must exist');
assert.ok(existsSync(metadataFile), 'release metadata must exist');

const release = await import(pathToFileURL(moduleFile));
const metadata = JSON.parse(readFileSync(metadataFile, 'utf8'));
assert.equal(metadata.schemaVersion, 1);
assert.match(metadata.productVersion, /^\d+\.\d+$/);
assert.match(metadata.curriculumVersion, /^[A-Z0-9][A-Z0-9._-]{2,63}$/);

const sha = '0123456789abcdef0123456789abcdef01234567';
const id = release.resolveReleaseIdentity({
  root,
  env: { PRI_RELEASE_SHA: sha, PRI_BUILD_TIMESTAMP: '2026-09-30T00:00:00Z' },
  production: true,
  verifySource: false
});
assert.equal(id.releaseSha, sha);
assert.equal(id.productVersion, metadata.productVersion);
assert.equal(id.curriculumVersion, metadata.curriculumVersion);
assert.equal(id.buildTimestamp, '2026-09-30T00:00:00.000Z');
assert.equal(id.repository, 'Priysharan19/Final-Pri-learning');
assert.equal(id.branch, 'main');

assert.throws(() => release.resolveReleaseIdentity({
  root,
  env: { PRI_RELEASE_SHA: 'unknown', PRI_BUILD_TIMESTAMP: '2026-09-30T00:00:00Z' },
  production: true
}), /release sha/i);
assert.throws(() => release.resolveReleaseIdentity({
  root,
  env: { PRI_RELEASE_SHA: sha, PRI_BUILD_TIMESTAMP: 'not-a-time' },
  production: true,
  verifySource: false
}), /build timestamp/i);

const gitFixture = mkdtempSync(join(tmpdir(), 'pri-release-source-'));
try {
  mkdirSync(join(gitFixture, 'release'));
  writeFileSync(join(gitFixture, 'release', 'metadata.json'), JSON.stringify(metadata));
  writeFileSync(join(gitFixture, 'source.txt'), 'clean\n');
  execFileSync('git', ['-C', gitFixture, 'init', '-b', 'main'], { stdio: 'ignore' });
  execFileSync('git', ['-C', gitFixture, 'config', 'user.email', 'release@test.invalid']);
  execFileSync('git', ['-C', gitFixture, 'config', 'user.name', 'Release Test']);
  execFileSync('git', ['-C', gitFixture, 'add', '.']);
  execFileSync('git', ['-C', gitFixture, 'commit', '-m', 'fixture'], { stdio: 'ignore' });
  const fixtureSha = execFileSync('git', ['-C', gitFixture, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.throws(() => release.resolveReleaseIdentity({
    root: gitFixture,
    env: { PRI_RELEASE_SHA: sha, PRI_BUILD_TIMESTAMP: '2026-09-30T00:00:00Z' },
    production: true
  }), /does not match checked-out Git SHA/i);
  writeFileSync(join(gitFixture, 'source.txt'), 'dirty\n');
  assert.throws(() => release.resolveReleaseIdentity({
    root: gitFixture,
    env: { PRI_RELEASE_SHA: fixtureSha, PRI_BUILD_TIMESTAMP: '2026-09-30T00:00:00Z' },
    production: true
  }), /source tree is dirty/i);
} finally {
  rmSync(gitFixture, { recursive: true, force: true });
}

for (const file of ['package.json', 'client/package.json', 'server/package.json']) {
  const pkg = JSON.parse(readFileSync(join(root, file), 'utf8'));
  assert.equal(pkg.version, `${metadata.productVersion}.0`, `${file} version drift`);
}
for (const nativePackage of ['ios/PriLearning.swiftpm/Package.swift', 'ios/PriLearning 2.swiftpm/Package.swift']) {
  const body = readFileSync(join(root, nativePackage), 'utf8');
  assert.ok(body.includes(`displayVersion: "${metadata.productVersion}"`), `${nativePackage} version drift`);
}

const router = readFileSync(join(root, 'server/platform/router.js'), 'utf8');
assert.match(router, /releaseIdentity/);
const vite = readFileSync(join(root, 'client/vite.config.js'), 'utf8');
assert.match(vite, /releaseIdentity/);
const native = readFileSync(join(root, 'ios/PriLearning.swiftpm/WebShell.swift'), 'utf8');
assert.match(native, /PRI_NATIVE_RELEASE_IDENTITY/);

for (const doc of [
  'docs/architecture/repository-authority.md',
  'docs/architecture/authoritative-architecture.md',
  'docs/release/release-policy.md'
]) {
  const body = readFileSync(join(root, doc), 'utf8');
  assert.match(body, /Priysharan19\/Final-Pri-learning/);
  assert.match(body, /\bmain\b/);
}


const releasePolicy = readFileSync(join(root, 'docs', 'release', 'release-policy.md'), 'utf8');
assert.match(releasePolicy, /task\/feature branch/i, 'release policy must define the normal task/feature PR lane');

const fleetGovernance = readFileSync(join(root, '.github', 'workflows', 'pri-agent-governance.yml'), 'utf8');
assert.match(fleetGovernance, /HEAD_REF" == task\/\*/, 'fleet governance must allow reviewed task/* branches');
assert.match(fleetGovernance, /HEAD_REF" == feature\/\*/, 'fleet governance must allow reviewed feature/* branches');
assert.match(fleetGovernance, /HEAD_REF" != agent\/mission\/\*/, 'fleet governance must retain autonomous mission isolation');
assert.match(fleetGovernance, /lane=manual-governed/, 'manual task/feature branches must stay outside autonomous mission execution');

console.log('PRI-01 RELEASE AUTHORITY: PASS');
