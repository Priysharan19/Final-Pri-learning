// Server-issued OIDC nonces. A client asks for a nonce, hands it to Google or
// Apple, and the returned identity token must carry it back. The server stores
// only a hash, accepts each nonce once, and expires it after ten minutes, so a
// captured identity token cannot be replayed into a new Pri Learning session.

import { opaqueToken, sha256 } from './security.js';

export const OIDC_NONCE_TTL_MS = 10 * 60 * 1000;

export function issueOidcNonce(db, now = Date.now()) {
  const nonce = opaqueToken(24);
  const expiresAt = now + OIDC_NONCE_TTL_MS;
  db.prepare('INSERT INTO oidc_nonces(nonce_hash, created_at, expires_at) VALUES (?, ?, ?)').run(sha256(nonce), now, expiresAt);
  return { nonce, expiresAt };
}

export function consumeOidcNonce(db, nonce, now = Date.now()) {
  const value = String(nonce || '');
  if (!value || value.length > 128) return false;
  const info = db.prepare('UPDATE oidc_nonces SET consumed_at = ? WHERE nonce_hash = ? AND consumed_at IS NULL AND expires_at > ?')
    .run(now, sha256(value), now);
  return info.changes === 1;
}

export function purgeOidcNonces(db, now = Date.now()) {
  return db.prepare('DELETE FROM oidc_nonces WHERE expires_at < ? OR consumed_at IS NOT NULL').run(now).changes;
}
