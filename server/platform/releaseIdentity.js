import { resolveReleaseIdentity } from '../../release/release-identity.mjs';

export function serverReleaseIdentity() {
  return resolveReleaseIdentity({ production: process.env.NODE_ENV === 'production' });
}
