import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDeploymentPrecedence, assertReleaseIdentity, resolveReleaseIdentity } from '../../release/release-identity.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILT_CLIENT_RELEASE = join(HERE, '..', '..', 'client', 'dist', 'release.json');

function readBuiltClientRelease() {
  try {
    return JSON.parse(readFileSync(BUILT_CLIENT_RELEASE, 'utf8'));
  } catch {
    return null;
  }
}

export function serverReleaseIdentity({ env: sourceEnv = process.env, readBuilt = readBuiltClientRelease } = {}) {
  const production = sourceEnv.NODE_ENV === 'production';
  if (!production) return resolveReleaseIdentity({ production: false, env: sourceEnv });

  const railwayRuntime = Boolean(sourceEnv.RAILWAY_DEPLOYMENT_ID);
  // The same precedence the client build applied (release/release-identity.mjs):
  // Railway's own Git SHA outranks a stale manual-candidate PRI_RELEASE_SHA, and
  // a timestamp that belonged to that stale SHA is dropped with it.
  const env = applyDeploymentPrecedence(sourceEnv);

  let identity;
  try {
    identity = resolveReleaseIdentity({ production: true, env });
  } catch (error) {
    if (!String(error?.message || '').includes('Production build timestamp is missing')) throw error;
    const built = readBuilt();
    if (!built) throw new Error('Production build timestamp is missing and built client release identity is unavailable');
    assertReleaseIdentity(built, { production: true });
    env.PRI_BUILD_TIMESTAMP = built.buildTimestamp;
    identity = resolveReleaseIdentity({ production: true, env });
  }

  // Railway runtime images must agree with the release identity baked by the
  // production client build, for both Git-triggered and explicit exact-commit
  // candidate deployments.
  if (railwayRuntime) {
    const built = readBuilt();
    if (!built) throw new Error('Railway runtime is missing built client release identity');
    assertReleaseIdentity(built, { production: true });
    for (const key of ['repository', 'branch', 'productVersion', 'curriculumVersion', 'releaseSha', 'buildTimestamp']) {
      if (identity[key] !== built[key]) throw new Error('Server/client release identity mismatch for ' + key);
    }
  }

  return identity;
}
