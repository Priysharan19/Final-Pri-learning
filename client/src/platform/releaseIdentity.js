import { readReleaseIdentityManifest } from './cloudTransport.js';
import { hostReleaseIdentity } from './native/host.js';

const developmentIdentity = Object.freeze({
  schemaVersion: 1,
  repository: 'Priysharan19/Final-Pri-learning',
  branch: 'main',
  productVersion: 'development',
  curriculumVersion: 'development',
  releaseSha: 'development-unknown',
  buildTimestamp: null
});

const STORAGE_KEY = 'pri.releaseIdentity.v1';

function looksLikeReleaseIdentity(value) {
  return Boolean(
    value &&
    value.schemaVersion === 1 &&
    value.repository === 'Priysharan19/Final-Pri-learning' &&
    value.branch === 'main' &&
    /^[0-9a-f]{40}$/.test(String(value.releaseSha || ''))
  );
}

function storedIdentity(target) {
  try {
    const parsed = JSON.parse(target.localStorage?.getItem(STORAGE_KEY) || 'null');
    return looksLikeReleaseIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistIdentity(target, identity) {
  try { target.localStorage?.setItem(STORAGE_KEY, JSON.stringify(identity)); } catch { /* diagnostics must not block app startup */ }
}

export function currentReleaseIdentity(target = globalThis) {
  if (looksLikeReleaseIdentity(target.__PRI_RELEASE_IDENTITY__)) return target.__PRI_RELEASE_IDENTITY__;
  const nativeIdentity = hostReleaseIdentity(target);
  if (looksLikeReleaseIdentity(nativeIdentity)) return nativeIdentity;
  return storedIdentity(target) || developmentIdentity;
}

export async function installReleaseIdentityDiagnostics(target = globalThis) {
  const nativeIdentity = hostReleaseIdentity(target);
  if (looksLikeReleaseIdentity(nativeIdentity)) {
    target.__PRI_RELEASE_IDENTITY__ = Object.freeze({ ...nativeIdentity });
    persistIdentity(target, target.__PRI_RELEASE_IDENTITY__);
    return target.__PRI_RELEASE_IDENTITY__;
  }

  try {
    const identity = await readReleaseIdentityManifest();
    if (!looksLikeReleaseIdentity(identity)) throw new Error('release manifest is invalid');
    target.__PRI_RELEASE_IDENTITY__ = Object.freeze(identity);
    persistIdentity(target, target.__PRI_RELEASE_IDENTITY__);
  } catch {
    target.__PRI_RELEASE_IDENTITY__ = Object.freeze(storedIdentity(target) || developmentIdentity);
  }
  return target.__PRI_RELEASE_IDENTITY__;
}
