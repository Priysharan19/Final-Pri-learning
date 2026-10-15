import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { resolveReleaseIdentity } from '../../release/release-identity.mjs';
import { startApp } from './support/app-harness.mjs';

const expected = resolveReleaseIdentity({ production: false });
const harness = await startApp();
try {
  const health = await harness.request('/v1/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.data.releaseIdentity, expected);
  assert.match(health.data.releaseIdentity.releaseSha, /^[0-9a-f]{40}$/);
  for (const forbidden of ['token', 'secret', 'email', 'student', 'password']) {
    assert.ok(!JSON.stringify(health.data.releaseIdentity).toLowerCase().includes(forbidden));
  }
  console.log(`SERVER RELEASE IDENTITY: PASS — ${expected.releaseSha}`);
} finally {
  await harness.close();
}

// The hermetic harness switches source verification off for in-process suites.
// Prove the production resolver itself still refuses a dirty tree (and a SHA
// that is not the checkout) whenever verification is on — its default.
{
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { serverReleaseIdentity, setReleaseSourceVerification } = await import('../platform/releaseIdentity.js');
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const fixture = mkdtempSync(join(tmpdir(), 'pri-release-dirty-'));
  try {
    const git = (...args) => execFileSync('git', ['-C', fixture, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    git('init', '-q');
    git('config', 'user.email', 'fixture@example.test');
    git('config', 'user.name', 'fixture');
    mkdirSync(join(fixture, 'release'));
    copyFileSync(join(repoRoot, 'release', 'metadata.json'), join(fixture, 'release', 'metadata.json'));
    git('add', '.');
    git('commit', '-q', '-m', 'fixture');
    const head = git('rev-parse', 'HEAD');
    const env = { NODE_ENV: 'production' };
    const readBuilt = () => null;
    setReleaseSourceVerification(true);
    assert.equal(serverReleaseIdentity({ env, readBuilt, root: fixture }).releaseSha, head, 'clean production checkout resolves');
    assert.throws(() => serverReleaseIdentity({ env: { ...env, PRI_RELEASE_SHA: 'a'.repeat(40) }, readBuilt, root: fixture }),
      /does not match checked-out Git SHA/, 'production refuses a release SHA that is not the checkout');
    writeFileSync(join(fixture, 'untracked.txt'), 'dirty\n');
    assert.throws(() => serverReleaseIdentity({ env, readBuilt, root: fixture }), /source tree is dirty/,
      'production refuses a dirty source tree by default');
    setReleaseSourceVerification(false);
    assert.equal(serverReleaseIdentity({ env, readBuilt, root: fixture }).releaseSha, head, 'only the in-process test switch skips verification');
    console.log('SERVER RELEASE IDENTITY: PASS — production refuses a dirty source tree');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}
