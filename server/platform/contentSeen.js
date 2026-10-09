// Pri Learning — what an account has already been shown the solution of, and
// what it has already spent a try on.
//
// Practice records "seen" when a question resolves (server/platform/practice.js,
// scope `practice-content`), and seals a later copy of the same content as a
// repeat. An examination paper releases the solution of every question on it
// the moment it is finalised, so the paper's content is recorded here under the
// SAME scope and the SAME keys: a practice copy issued afterwards is a repeat,
// and so is the same item (a previous-year question, most often) when it comes
// round again in a later paper.
//
// This file is the ONE definition of those keys. Practice and the examination
// router both import it; neither computes a key of its own.
//
// One item is known by up to three keys, and is seen when ANY of them is:
//
//   · `seen-c<…>` — the content identity (`contentIdentityOf`): the prompt, the
//     option texts as a SET, the TEXT of the keyed option (or the keyed value of
//     a written answer), the figure and the parts. It does not depend on the
//     order the options were dealt in, so the same question with its options
//     shuffled is the same content. Every new record carries it.
//   · `seen-<…>` of the engine hash the item was stamped with, and
//   · `seen-<…>` of the engine digest of the item as it stands — the two keys
//     used before the identity existed. Both include the option ORDER, so on
//     their own they let a reshuffled copy pass as new content. They are still
//     written and still read so that content recorded as seen before the
//     identity existed stays seen.
//
// Every key is an HMAC under the server's content key: a row says nothing
// about the content, its seed or its answer to anyone who reads the table, and
// a device cannot compute one.
import { createHash, createHmac } from 'node:crypto';
import { practiceContentKey } from './deliveryCrypto.js';
import { contentHashOf } from '../../client/src/engine/contentIdentity.js';

const SEEN_AGE = 5 * 365 * 24 * 60 * 60 * 1000;
// A spent try lives as long as the question it was spent on (practice.js
// MAX_AGE): a fresh copy inherits exactly what the original still holds.
const TRIED_AGE = 90 * 24 * 60 * 60 * 1000;
const CHUNK = 100;
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');

// What a device may know a question by. The engine's content id names the seed
// and its content hash is taken over the answer, so either would let a device
// with the bundled generators recover the key. These are stable per content,
// which is all the device needs them for (recently-seen lists, attempt
// records), and say nothing about it.
const keyed = value => createHmac('sha256', practiceContentKey()).update(String(value));
export const opaqueContentId = value => (value == null || value === '' ? null : 'srv:' + keyed(value).digest('base64url').slice(0, 30));
// Same shape as the engine's own content hash (16 hex), so the device stores
// and compares it exactly as before.
export const opaqueContentHash = value => (value == null || value === '' ? null : keyed('hash:' + value).digest('hex').slice(0, 16));

const norm = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const optionsOf = item => (Array.isArray(item?.mcqOptions) ? item.mcqOptions : []).map(norm);
// The keyed answer, independent of where its option was dealt: for a
// multiple-choice item the TEXT of the keyed option (never its index, and never
// the per-index distractor notes); for anything else the keyed value itself.
function keyedAnswerOf(item) {
  const answer = item?.answer ?? null;
  if (item?.answerType === 'mcq' && Array.isArray(item.mcqOptions) && answer && typeof answer === 'object') {
    const index = Number(answer.correctIndex);
    if (Number.isInteger(index) && index >= 0 && index < item.mcqOptions.length) return ['mcq', norm(item.mcqOptions[index])];
  }
  return ['key', answer];
}
function identitySubstance(item) {
  const parts = Array.isArray(item.parts)
    ? item.parts.map(part => [norm(part?.prompt), part?.answerType || null, optionsOf(part).sort(), keyedAnswerOf(part)])
    : null;
  return JSON.stringify([
    norm(item.stem), norm(item.prompt), item.answerType || null,
    optionsOf(item).sort(), keyedAnswerOf(item), norm(item.figure), parts
  ]);
}

/**
 * The order-independent identity of one item, keyed and opaque (32 hex). Two
 * items share it exactly when a student would call them the same question:
 * same stem and prompt, same answer form, same options in any order, same
 * keyed answer, same figure, same parts. Different numbers make a different
 * prompt; the same prompt keyed to a different answer, or offered with a
 * different set of options, is a different identity.
 */
export function contentIdentityOf(item) {
  if (!item || typeof item !== 'object') return null;
  return keyed('identity:v1:' + identitySubstance(item)).digest('hex').slice(0, 32);
}

/**
 * The seen-keys of one item: its content identity, the hash it was stamped
 * with when it was generated, and the digest of the item as it stands (what a
 * composed exam item, or a part that carries no stamp of its own, was known by
 * before the identity existed). A question with no stamp falls back to its
 * content id, then its prompt, as practice always keyed it.
 */
export function seenKeysOf(item) {
  if (!item || typeof item !== 'object') return [];
  const hashes = new Set([contentHashOf(item)]);
  const stamped = item.contentHash ?? item.contentId ?? item.prompt;
  if (stamped != null && stamped !== '') hashes.add(String(stamped));
  return ['seen-c' + contentIdentityOf(item), ...[...hashes].map(hash => 'seen-' + opaqueContentHash(hash))];
}

/** The key under which a spent try on this content is recorded. */
export const triedKeyOf = item => 'tried-c' + contentIdentityOf(item);

/** Every item of a sealed exam question whose solution a result discloses. */
export function examItemsOf(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  return [payload, payload.alt, ...parts, ...parts.map(part => part?.alt)].filter(item => item && typeof item === 'object');
}

/**
 * Which of `keys` this account holds a live record of. A record past its
 * `expires_at` is not one: housekeeping deletes expired rows whenever it runs,
 * so honouring the expiry here keeps the answer the same before and after it.
 */
export async function seenAmong(db, accountId, keys, now = Date.now()) {
  const wanted = [...new Set(keys)];
  const seen = new Set();
  for (let i = 0; i < wanted.length; i += CHUNK) {
    const chunk = wanted.slice(i, i + CHUNK);
    // Only `?` placeholders are joined into the statement; every key is bound.
    const rows = await db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-content' AND expires_at>? AND key IN (" + chunk.map(() => '?').join(',') + ')',
      [accountId, now, ...chunk]);
    for (const row of rows) seen.add(row.key);
  }
  return seen;
}

/**
 * Record `keys` for this account. Idempotent; recording a key again renews it,
 * so a record that has expired but not yet been swept comes back to life
 * instead of silently staying dead.
 */
export async function markSeen(db, accountId, keys, now, age = SEEN_AGE) {
  const wanted = [...new Set(keys)];
  for (let i = 0; i < wanted.length; i += CHUNK) {
    const chunk = wanted.slice(i, i + CHUNK);
    // One statement per chunk. Only `?` placeholders are joined into it.
    await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES "
      + chunk.map(() => "(?,'practice-content',?,?,?,?,?)").join(',') + ' ON CONFLICT(account_id,scope,key) DO UPDATE SET expires_at=excluded.expires_at',
      chunk.flatMap(key => [accountId, key, '{}', digest({ seen: key }), now, now + age]));
  }
}

/** Has this account been shown the solution of this question's content? */
export async function contentSeen(db, accountId, item, now = Date.now()) {
  return (await seenAmong(db, accountId, seenKeysOf(item), now)).size > 0;
}

/** Record that this account has been shown the solution of this content. */
export const markContentSeen = (db, accountId, item, now) => markSeen(db, accountId, seenKeysOf(item), now);

/** Has this account already spent a try on this content, on any copy of it? */
export async function contentTried(db, accountId, item, now = Date.now()) {
  return (await seenAmong(db, accountId, [triedKeyOf(item)], now)).size > 0;
}

/** Record a try spent on this content. */
export const markContentTried = (db, accountId, item, now) => markSeen(db, accountId, [triedKeyOf(item)], now, TRIED_AGE);
