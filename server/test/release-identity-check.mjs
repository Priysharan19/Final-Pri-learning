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
