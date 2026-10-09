// Pri Learning — what an account has already been shown the solution of.
//
// Practice records this when a question resolves (server/platform/practice.js,
// scope `practice-content`, key `seen-<keyed content hash>`), and seals a later
// copy of the same content as a repeat. An examination paper releases the
// solution of every question on it the moment it is finalised, so the paper's
// content is recorded here under the SAME scope and the SAME key: a practice
// copy issued afterwards is a repeat, and so is the same item (a previous-year
// question, most often) when it comes round again in a later paper.
//
// The key is the one practice computes — `'seen-' + opaqueContentHash(hash)`,
// where `hash` is the engine's digest of what the student saw (prompt, options,
// keyed answer, figure). It is keyed with the server's content key, so the row
// says nothing about the content to anyone who reads the table.
import { createHash } from 'node:crypto';
import { opaqueContentHash } from './practice.js';
import { contentHashOf } from '../../client/src/engine/contentIdentity.js';

const SEEN_AGE = 5 * 365 * 24 * 60 * 60 * 1000;
const CHUNK = 100;
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');

/**
 * The seen-keys of one item. Two, when they differ: the hash the item was
 * stamped with when it was generated (what practice keys a generated question
 * by) and the digest of the item as it stands (what a composed exam item, or a
 * part that carries no stamp of its own, is known by).
 */
export function seenKeysOf(item) {
  if (!item || typeof item !== 'object') return [];
  const hashes = new Set([contentHashOf(item)]);
  if (typeof item.contentHash === 'string' && item.contentHash) hashes.add(item.contentHash);
  return [...hashes].map(hash => 'seen-' + opaqueContentHash(hash));
}

/** Every item of a sealed exam question whose solution a result discloses. */
export function examItemsOf(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  return [payload, payload.alt, ...parts, ...parts.map(part => part?.alt)].filter(item => item && typeof item === 'object');
}

/** Which of `keys` this account has already been shown the solution of. */
export async function seenAmong(db, accountId, keys) {
  const wanted = [...new Set(keys)];
  const seen = new Set();
  for (let i = 0; i < wanted.length; i += CHUNK) {
    const chunk = wanted.slice(i, i + CHUNK);
    // Only `?` placeholders are joined into the statement; every key is bound.
    const rows = await db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-content' AND key IN (" + chunk.map(() => '?').join(',') + ')',
      [accountId, ...chunk]);
    for (const row of rows) seen.add(row.key);
  }
  return seen;
}

/** Record `keys` as seen by this account. Idempotent. */
export async function markSeen(db, accountId, keys, now) {
  const wanted = [...new Set(keys)];
  for (let i = 0; i < wanted.length; i += CHUNK) {
    const chunk = wanted.slice(i, i + CHUNK);
    // One statement per chunk. Only `?` placeholders are joined into it.
    await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES "
      + chunk.map(() => "(?,'practice-content',?,?,?,?,?)").join(',') + ' ON CONFLICT(account_id,scope,key) DO NOTHING',
      chunk.flatMap(key => [accountId, key, '{}', digest({ seen: key }), now, now + SEEN_AGE]));
  }
}
