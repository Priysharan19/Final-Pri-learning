import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(HERE, '..');
const SHA = /^[0-9a-f]{40}$/;

export function readReleaseMetadata(root = DEFAULT_ROOT) {
  const parsed = JSON.parse(readFileSync(join(root, 'release', 'metadata.json'), 'utf8'));
  if (parsed.schemaVersion !== 1) throw new Error('Unsupported release metadata schema');
  if (!/^\d+\.\d+$/.test(parsed.productVersion || '')) throw new Error('Invalid product version');
  if (!/^[A-Z0-9][A-Z0-9._-]{2,63}$/.test(parsed.curriculumVersion || '')) throw new Error('Invalid curriculum version');
  if (parsed.packageVersion !== `${parsed.productVersion}.0`) throw new Error('Package/product version drift');
  return Object.freeze(parsed);
}

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}
function normalizeSha(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return SHA.test(normalized) ? normalized : null;
}

function normalizeTimestamp(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const millis = Number(raw) * 1000;
    return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
  }
  const millis = Date.parse(raw);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

/**
 * The environment variables that decide a deployment's release identity, in
 * precedence order. Build time (the Docker client-build stage, via
 * release/docker-build-identity.mjs and client/vite.config.js) and run time
 * (server/platform/releaseIdentity.js) both go through
 * applyDeploymentPrecedence(), so the SHA baked into client/dist/release.json
 * and the SHA the server reports are chosen by the same rule from the same
 * variables. Every name here must be declared as an ARG in the Dockerfile
 * stage that builds the client, because Docker (and Railway) only expose a
 * build-time variable to a stage that declares it.
 */
export const DEPLOYMENT_IDENTITY_ENV = Object.freeze([
  'RAILWAY_GIT_COMMIT_SHA', 'PRI_RELEASE_SHA', 'GITHUB_SHA', 'VERCEL_GIT_COMMIT_SHA', 'PRI_BUILD_TIMESTAMP', 'SOURCE_DATE_EPOCH'
]);

/**
 * Railway's own Git SHA outranks PRI_RELEASE_SHA. When the two disagree, the
 * PRI_* pair is a stale manual-candidate value left on the service, so its
 * timestamp is dropped with it rather than being paired with a different
 * commit. Idempotent: applying it twice gives the same result, so the build
 * wrapper and vite.config.js may both apply it.
 */
export function applyDeploymentPrecedence(env = process.env) {
  const next = { ...env };
  const railwaySha = normalizeSha(env.RAILWAY_GIT_COMMIT_SHA);
  if (railwaySha && normalizeSha(env.PRI_RELEASE_SHA) !== railwaySha) {
    next.PRI_RELEASE_SHA = railwaySha;
    delete next.PRI_BUILD_TIMESTAMP;
    delete next.SOURCE_DATE_EPOCH;
  }
  return next;
}

export function resolveReleaseIdentity({ root = DEFAULT_ROOT, env = process.env, production = false, verifySource = production } = {}) {
  const metadata = readReleaseMetadata(root);
  const gitSha = normalizeSha(git(root, ['rev-parse', 'HEAD']));
  const releaseSha = normalizeSha(
    env.PRI_RELEASE_SHA || env.GITHUB_SHA || env.VERCEL_GIT_COMMIT_SHA || env.RAILWAY_GIT_COMMIT_SHA || gitSha
  );
  if (production && !releaseSha) throw new Error('Production release SHA is missing, malformed or placeholder');
  if (production && verifySource && gitSha && releaseSha !== gitSha) {
    throw new Error(`Production release SHA ${releaseSha} does not match checked-out Git SHA ${gitSha}`);
  }
  if (production && verifySource && gitSha && git(root, ['status', '--porcelain', '--untracked-files=normal'])) {
    throw new Error('Production source tree is dirty; commit the exact build source before release');
  }

  const explicitTimestamp = env.PRI_BUILD_TIMESTAMP || env.SOURCE_DATE_EPOCH;
  const commitTimestamp = releaseSha ? git(root, ['show', '-s', '--format=%cI', releaseSha]) : null;
  const buildTimestamp = normalizeTimestamp(explicitTimestamp || commitTimestamp);
  if (production && !buildTimestamp) throw new Error('Production build timestamp is missing or invalid');
  return Object.freeze({
    schemaVersion: metadata.schemaVersion,
    repository: metadata.repository,
    branch: metadata.branch,
    productVersion: metadata.productVersion,
    curriculumVersion: metadata.curriculumVersion,
    releaseSha: releaseSha || 'development-unknown',
    buildTimestamp: buildTimestamp || null
  });
}

export function assertReleaseIdentity(value, { production = true } = {}) {
  if (!value || value.schemaVersion !== 1) throw new Error('Release identity schema is invalid');
  if (value.repository !== 'Priysharan19/Final-Pri-learning') throw new Error('Release repository authority is invalid');
  if (value.branch !== 'main') throw new Error('Release branch authority is invalid');
  if (!/^\d+\.\d+$/.test(value.productVersion || '')) throw new Error('Release product version is invalid');
  if (!/^[A-Z0-9][A-Z0-9._-]{2,63}$/.test(value.curriculumVersion || '')) throw new Error('Release curriculum version is invalid');
  if (production && !SHA.test(value.releaseSha || '')) throw new Error('Production release SHA is invalid');
  if (production && !normalizeTimestamp(value.buildTimestamp)) throw new Error('Production build timestamp is invalid');
  return true;
}

export function releaseIdentityJson(options = {}) {
  const identity = resolveReleaseIdentity(options);
  assertReleaseIdentity(identity, { production: options.production ?? false });
  return `${JSON.stringify(identity, null, 2)}\n`;
}
