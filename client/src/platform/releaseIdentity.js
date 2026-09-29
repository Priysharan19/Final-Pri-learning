const developmentIdentity = Object.freeze({
  schemaVersion: 1,
  repository: 'Priysharan19/Final-Pri-learning',
  branch: 'main',
  productVersion: 'development',
  curriculumVersion: 'development',
  releaseSha: 'development-unknown',
  buildTimestamp: null
});

function looksLikeReleaseIdentity(value) {
  return Boolean(
    value &&
    value.schemaVersion === 1 &&
    value.repository === 'Priysharan19/Final-Pri-learning' &&
    value.branch === 'main' &&
    /^[0-9a-f]{40}$/.test(String(value.releaseSha || ''))
  );
}

export function currentReleaseIdentity(target = globalThis) {
  if (looksLikeReleaseIdentity(target.__PRI_RELEASE_IDENTITY__)) return target.__PRI_RELEASE_IDENTITY__;
  if (looksLikeReleaseIdentity(target.__PRI_NATIVE_RELEASE_IDENTITY__)) return target.__PRI_NATIVE_RELEASE_IDENTITY__;
  return developmentIdentity;
}

export async function installReleaseIdentityDiagnostics(target = globalThis) {
  const nativeIdentity = target.__PRI_NATIVE_RELEASE_IDENTITY__;
  if (looksLikeReleaseIdentity(nativeIdentity)) {
    target.__PRI_RELEASE_IDENTITY__ = Object.freeze({ ...nativeIdentity });
    return target.__PRI_RELEASE_IDENTITY__;
  }

  try {
    const response = await fetch('/release.json', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`release manifest HTTP ${response.status}`);
    const identity = await response.json();
    if (!looksLikeReleaseIdentity(identity)) throw new Error('release manifest is invalid');
    target.__PRI_RELEASE_IDENTITY__ = Object.freeze(identity);
  } catch {
    target.__PRI_RELEASE_IDENTITY__ = developmentIdentity;
  }
  return target.__PRI_RELEASE_IDENTITY__;
}
