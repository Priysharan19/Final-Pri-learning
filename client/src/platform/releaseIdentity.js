/* global __PRI_RELEASE_IDENTITY__ */

const fallbackIdentity = Object.freeze({
  schemaVersion: 1,
  repository: 'Priysharan19/Final-Pri-learning',
  branch: 'main',
  productVersion: 'development',
  curriculumVersion: 'development',
  releaseSha: 'development-unknown',
  buildTimestamp: null
});

export const releaseIdentity = Object.freeze(
  typeof __PRI_RELEASE_IDENTITY__ === 'object' && __PRI_RELEASE_IDENTITY__
    ? __PRI_RELEASE_IDENTITY__
    : fallbackIdentity
);

export function installReleaseIdentityDiagnostics(target) {
  const destination = target || globalThis;
  destination.__PRI_RELEASE_IDENTITY__ = releaseIdentity;
  return releaseIdentity;
}
