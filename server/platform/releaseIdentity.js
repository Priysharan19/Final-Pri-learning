import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleaseIdentity, resolveReleaseIdentity } from '../../release/release-identity.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILT_CLIENT_RELEASE = join(HERE, '..', '..', 'client', 'dist', 'release.json');

function readBuiltClientRelease() {
  try {
    return JSON.parse(readFileSync(BUILT_CLIENT_RELEASE, 'utf8'));
  } catch {
    return null;
  }
}

export function serverReleaseIdentity() {
  const production = process.env.NODE_ENV === 'production';
  if (!production) return resolveReleaseIdentity({ production: false });

  const railwayGitSha = String(process.env.RAILWAY_GIT_COMMIT_SHA || '').trim();
  const railwayRuntime = Boolean(process.env.RAILWAY_DEPLOYMENT_ID);
  const env = { ...process.env };

  // A normal Railway GitHub deployment is authoritative to Railway's own
  // exact commit SHA. This deliberately outranks any temporary manual-candidate
  // PRI_RELEASE_SHA/PRI_BUILD_TIMESTAMP values left on the service.
  if (railwayGitSha) {
    env.PRI_RELEASE_SHA = railwayGitSha;
    delete env.PRI_BUILD_TIMESTAMP;
    delete env.SOURCE_DATE_EPOCH;
  }

  let identity;
  try {
    identity = resolveReleaseIdentity({ production: true, env });
  } catch (error) {
    if (!String(error?.message || '').includes('Production build timestamp is missing')) throw error;
    const built = readBuiltClientRelease();
    if (!built) throw new Error('Production build timestamp is missing and built client release identity is unavailable');
    assertReleaseIdentity(built, { production: true });
    env.PRI_BUILD_TIMESTAMP = built.buildTimestamp;
    identity = resolveReleaseIdentity({ production: true, env });
  }

  // Railway runtime images must agree with the release identity baked by the
  // production client build, for both Git-triggered and explicit exact-commit
  // candidate deployments.
  if (railwayRuntime) {
    const built = readBuiltClientRelease();
    if (!built) throw new Error('Railway runtime is missing built client release identity');
    assertReleaseIdentity(built, { production: true });
    for (const key of ['repository', 'branch', 'productVersion', 'curriculumVersion', 'releaseSha', 'buildTimestamp']) {
      if (identity[key] !== built[key]) throw new Error('Server/client release identity mismatch for ' + key);
    }
  }

  return identity;
}
