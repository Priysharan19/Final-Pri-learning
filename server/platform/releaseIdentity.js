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

  // Prefer the normal authority path. In a source checkout it can derive the
  // commit timestamp from Git; GitHub CI supplies explicit release variables.
  // Railway's runtime image intentionally contains no .git and Railway supplies
  // the exact Git SHA but no timestamp, so only that specific missing-timestamp
  // case may fall back to the identity baked into the already-verified client.
  try {
    return resolveReleaseIdentity({ production: true });
  } catch (error) {
    if (!String(error?.message || '').includes('Production build timestamp is missing')) throw error;
  }

  const built = readBuiltClientRelease();
  if (!built) throw new Error('Production build timestamp is missing and built client release identity is unavailable');
  assertReleaseIdentity(built, { production: true });

  const env = { ...process.env, PRI_BUILD_TIMESTAMP: built.buildTimestamp };
  const identity = resolveReleaseIdentity({ production: true, env });
  for (const key of ['repository', 'branch', 'productVersion', 'curriculumVersion', 'releaseSha', 'buildTimestamp']) {
    if (identity[key] !== built[key]) {
      throw new Error('Server/client release identity mismatch for ' + key);
    }
  }
  return identity;
}
