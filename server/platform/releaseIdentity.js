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

// ── Resolved once, not per request ──────────────────────────────────────────
// serverReleaseIdentity() can spawn `git` (twice) outside a Railway image, and
// /v1/health, /v1/ready, /v1/handwriting/status and every request log line
// need it. The deployment identity cannot change inside a running process, so
// the process resolves it once — at boot, from createPlatformRouter — and keeps
// the result, or the error: a production identity that fails closed keeps
// failing closed on every /v1/health without re-running the resolver. The key
// is the environment the resolver reads, so an in-process test that changes
// those variables gets a fresh resolution instead of a stale one.
const IDENTITY_ENV_KEYS = [
  'NODE_ENV', 'RAILWAY_DEPLOYMENT_ID', 'RAILWAY_GIT_COMMIT_SHA', 'PRI_RELEASE_SHA', 'GITHUB_SHA',
  'VERCEL_GIT_COMMIT_SHA', 'PRI_BUILD_TIMESTAMP', 'SOURCE_DATE_EPOCH'
];
let identityCache = null;

export function cachedServerReleaseIdentity(env = process.env) {
  const key = IDENTITY_ENV_KEYS.map(name => `${name}=${env[name] ?? ''}`).join('\n');
  if (!identityCache || identityCache.key !== key) {
    try {
      identityCache = { key, value: serverReleaseIdentity({ env }), error: null };
    } catch (error) {
      identityCache = { key, value: null, error };
    }
  }
  if (identityCache.error) throw identityCache.error;
  return identityCache.value;
}

/** The release SHA for log lines and readiness: never throws. */
export function releaseShaForLogs(env = process.env) {
  try {
    const sha = cachedServerReleaseIdentity(env)?.releaseSha;
    return typeof sha === 'string' && sha ? sha : 'unknown';
  } catch {
    return 'unknown';
  }
}
