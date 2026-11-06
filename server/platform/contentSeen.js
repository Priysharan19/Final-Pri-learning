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
// ── The canonical identity (version 2) ──────────────────────────────────────
//
// `contentIdentityOf(item)` is the identity of one question as a student would
// recognise it, and the ONLY key a new record is written under:
//
//   · `seen-c2:<…>`  — this content has been shown;
//   · `tried-c2:<…>` — a try has been spent on this content.
//
// It covers every student-visible part of the item: the stem and prompt, the
// answer form, the option texts as a SET, the keyed answer, the labels on the
// answer box (`answerPrefix`, `answerSuffix`: ₹ against $, m against m²), the
// figure, the two lists of a matching-list item, and — recursively, with the
// same rule — its alternative and each of its parts with their own figures,
// alternatives and lists. The keyed answer of a multiple-choice item is the
// TEXT of its keyed option; of a multiple-correct item, the SET of its keyed
// option texts; of anything else, the keyed value. So the same question with
// its options dealt in another order, or its correct options listed in another
// order, is one identity, and a question offering a different alternative, a
// different part figure or a different unit on the box is another. The figure
// is left out for a question its generator marks `identityIgnoresFigure` (the
// prompt alone fixes the answer and the figure only illustrates it).
//
// ── Keys written before version 2 (read, never written, never widened) ──────
//
// Records written before this version exist under up to three keys, each an
// exact function of the item the account was shown:
//
//   · `seen-c<…>` / `tried-c<…>` — the version-1 identity. It keyed a
//     multiple-correct item by its option INDICES, left out the answer-box
//     labels, the alternative of an item and the figure, alternative, stem and
//     lists of a part, and kept a matching list's rows in dealt order.
//   · `seen-<…>` of the engine hash the item was stamped with, and
//   · `seen-<…>` of the engine digest of the item as it stands — the two keys
//     used before any identity existed. Both include the option order; for an
//     item with no stamp the first falls back to its content id, then to its
//     prompt alone.
//
// The compatibility rule (docs/architecture/learning-state-identity.md):
//
//   1. Student history is never reset. Every legacy key an item would have
//      been recorded under is still read, so content recorded as seen or
//      tried before version 2 stays seen or tried until its record expires.
//   2. Legacy keys are looked up EXACTLY — the keys this very item would have
//      produced — never a family of candidates. Guessing other option orders
//      or other index tuples has been shown to match a different question's
//      record, which would suppress a student's genuinely new work.
//   3. A record that matches on a legacy key alone is honoured as a repeat
//      (a repeat is marked exactly like new work and earns no progress; no
//      mark depends on it) and, where the legacy key could not have told
//      this item from another — a multiple-correct item, labelled box,
//      alternative, part figure, part list, or the prompt-only alias of an
//      unstamped unit — the decision is REPORTED as resting on legacy
//      evidence (`repeatEvidence: 'legacy'`) rather than passed off as a
//      canonical match. The information to resolve it does not exist in the
//      row; it closes as legacy rows expire (90 days for a try, five years
//      for seen) and no new row is written under a legacy key.
//
// Every key is an HMAC under the server's content key: a row says nothing
// about the content, its seed or its answer to anyone who reads the table, and
// a device cannot compute one.
//
// Expiry is monotonic: recording a key again can only extend its life, never
// shorten it, whatever order two requests' writes reach the database in.
import { createHash, createHmac } from 'node:crypto';
import { practiceContentKey } from './deliveryCrypto.js';
import { contentHashOf, matchListOf } from '../../client/src/engine/contentIdentity.js';

export const IDENTITY_VERSION = 2;
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
const present = v => norm(v) !== '';
const optionsOf = item => (Array.isArray(item?.mcqOptions) ? item.mcqOptions : []).map(norm);
const partsOf = item => (Array.isArray(item?.parts) ? item.parts : []);
const unit = value => (value && typeof value === 'object' ? value : null);

// ── Version 2 ───────────────────────────────────────────────────────────────

/**
 * The keyed answer, independent of where its option was dealt: for a
 * multiple-choice item the TEXT of the keyed option (never its index, and never
 * the per-index distractor notes); for a multiple-correct item the SET of the
 * keyed option texts, sorted, so neither the deal nor the order the indices
 * were listed in matters; for anything else the keyed value itself. A key that
 * does not point at the options it is given (an index out of range, a
 * non-integer) is not canonicalised: it stays the raw value, exactly as it is.
 */
function keyedAnswerOf(item) {
  const answer = item?.answer ?? null;
  const options = Array.isArray(item?.mcqOptions) ? item.mcqOptions : null;
  if (options && answer && typeof answer === 'object') {
    if (item.answerType === 'mcq') {
      const index = Number(answer.correctIndex);
      if (Number.isInteger(index) && index >= 0 && index < options.length) return ['mcq', norm(options[index])];
    }
    if (item.answerType === 'multi-mcq' && Array.isArray(answer.correctIndices) && answer.correctIndices.length > 0) {
      const indices = [...new Set(answer.correctIndices.map(Number))];
      if (indices.every(index => Number.isInteger(index) && index >= 0 && index < options.length)) {
        return ['multi-mcq', indices.map(index => norm(options[index])).sort()];
      }
    }
  }
  return ['key', answer];
}

/**
 * The two lists of a matching-list item with each side's rows in label order,
 * so the same associations shown in another row order are one item. Rows are
 * sorted only when every label on that side is distinct; a side with a
 * repeated or blank label keeps its dealt order (it cannot be told apart by
 * label, so it is not pretended to be).
 */
function canonicalMatchList(item) {
  const lists = matchListOf(item);
  if (!lists) return null;
  const side = rows => {
    const labels = rows.map(([label]) => label);
    if (labels.some(label => label === '') || new Set(labels).size !== labels.length) return rows;
    return [...rows].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  };
  return lists.map(side);
}

/**
 * The figure of a unit, as identity substance. A drawing is a string (SVG or a
 * description) on every question the server issues today; that string is
 * whitespace-normalised exactly as before. A structured figure (a plain object
 * or array of points, segments, labels and numbers) is encoded by value, never
 * through `String()`, which would turn every object into "[object Object]" and
 * make two different diagrams one question: object keys in sorted order, arrays
 * in their own order, and every value tagged with its JSON type, so 5 is not
 * "5" and a list is not the string that prints like it. Anything that is not
 * plain data (a function, a symbol, a bigint, a Date or Map, a class instance,
 * a non-finite number, a cycle) has no stable identity: it is refused rather
 * than collapsed into a key another question could share.
 */
const FIGURE_DEPTH = 32;
function figureSubstance(figure, depth = 0, path = new Set()) {
  if (figure == null) return depth === 0 ? '' : ['null'];
  if (typeof figure === 'string') return depth === 0 ? norm(figure) : ['s', norm(figure)];
  if (typeof figure === 'boolean') return ['b', figure];
  if (typeof figure === 'number' && Number.isFinite(figure)) return ['n', Object.is(figure, -0) ? 0 : figure];
  const refuse = why => { throw Object.assign(new TypeError(`content identity: unsupported figure (${why})`), { code: 'CONTENT_IDENTITY_UNSUPPORTED_FIGURE' }); };
  if (typeof figure !== 'object') refuse(typeof figure);
  if (depth >= FIGURE_DEPTH) refuse('nested too deeply');
  if (path.has(figure)) refuse('cycle');
  path.add(figure);
  try {
    if (Array.isArray(figure)) return ['a', Array.from(figure, value => figureSubstance(value, depth + 1, path))];
    const proto = Object.getPrototypeOf(figure);
    if (proto !== Object.prototype && proto !== null) refuse('not a plain object');
    if (Object.getOwnPropertySymbols(figure).length) refuse('symbol key');
    return ['o', Object.keys(figure).sort()
      .filter(key => figure[key] !== undefined)
      .map(key => [key, figureSubstance(figure[key], depth + 1, path)])];
  } finally {
    path.delete(figure);
  }
}

/** The substance of one unit — an item, its alternative, a part — and of what it contains. */
function unitSubstance(item) {
  if (!unit(item)) return null;
  return [
    norm(item.stem), norm(item.prompt), item.answerType || null,
    optionsOf(item).sort(), keyedAnswerOf(item),
    // What the answer box shows around the value: a currency or a unit can
    // change what the same number means (checker-core.js reads both).
    norm(item.answerPrefix), norm(item.answerSuffix),
    // A generator marks a question whose figure does not bear on its answer
    // (`identityIgnoresFigure`, a private field no student is sent): every
    // drawing of it is then one question, so a new picture is not new content.
    item.identityIgnoresFigure === true ? '' : figureSubstance(item.figure),
    canonicalMatchList(item),
    unitSubstance(unit(item.alt)),
    Array.isArray(item.parts) ? item.parts.map(part => unitSubstance(unit(part))) : null
  ];
}

/**
 * The order-independent identity of one item, keyed and opaque (32 hex). Two
 * items share it exactly when a student would call them the same question:
 * same stem and prompt, same answer form, same options in any order, same
 * keyed answer (or set of keyed answers), same labels on the answer box, same
 * figure, same lists, same alternative, same parts each with its own figure,
 * alternative and lists. Different numbers make a different prompt; the same
 * prompt keyed to a different answer, offered with a different set of options,
 * asked in a different unit, or with a different alternative beside it, is a
 * different identity.
 */
export function contentIdentityOf(item) {
  if (!unit(item)) return null;
  return keyed(`identity:v${IDENTITY_VERSION}:` + JSON.stringify(unitSubstance(item))).digest('hex').slice(0, 32);
}

/** The one key a new seen-record of this item is written under. */
export const seenKeyOf = item => 'seen-c2:' + contentIdentityOf(item);
/** The one key a new spent-try record of this item is written under. */
export const triedKeyOf = item => 'tried-c2:' + contentIdentityOf(item);

// ── Version 1 and the engine-hash keys: read for records that predate v2 ────

// The version-1 substance, kept byte for byte: a record written under it is
// found only if this produces exactly the string it produced then.
function legacyKeyedAnswerOf(item) {
  const answer = item?.answer ?? null;
  if (item?.answerType === 'mcq' && Array.isArray(item.mcqOptions) && answer && typeof answer === 'object') {
    const index = Number(answer.correctIndex);
    if (Number.isInteger(index) && index >= 0 && index < item.mcqOptions.length) return ['mcq', norm(item.mcqOptions[index])];
  }
  return ['key', answer];
}
function legacySubstance(item) {
  const parts = Array.isArray(item.parts)
    ? item.parts.map(part => [norm(part?.prompt), part?.answerType || null, optionsOf(part).sort(), legacyKeyedAnswerOf(part)])
    : null;
  return JSON.stringify([
    norm(item.stem), norm(item.prompt), item.answerType || null,
    optionsOf(item).sort(), legacyKeyedAnswerOf(item),
    item.identityIgnoresFigure === true ? '' : norm(item.figure), parts,
    ...(matchListOf(item) ? [matchListOf(item)] : [])
  ]);
}

/** The version-1 identity of an item (32 hex): what its records were keyed by before v2. Read only. */
export function legacyContentIdentityOf(item) {
  if (!unit(item)) return null;
  return keyed('identity:v1:' + legacySubstance(item)).digest('hex').slice(0, 32);
}

/**
 * Whether the version-1 identity (or the engine hash) of this item could also
 * have been that of a different question — that is, whether the item carries
 * something those projections left out: a multiple-correct key, a label on
 * the answer box, an alternative, or a part with its own figure, stem, lists,
 * labels or alternative. A match on such a key is honoured, and reported as
 * legacy evidence. (The prompt-only alias of an unstamped unit is ambiguous
 * whatever the unit; repeatEvidenceOf reports it by the key that matched.)
 */
export function legacyIdentityAmbiguous(item) {
  if (!unit(item)) return false;
  const lossy = u => !!u && ((u.answerType === 'multi-mcq' && Array.isArray(u.mcqOptions)) || present(u.answerPrefix) || present(u.answerSuffix));
  const partLossy = part => !!unit(part) && (lossy(part) || !!unit(part.alt) || present(part.figure) || present(part.stem) || !!matchListOf(part));
  return lossy(item) || !!unit(item.alt) || partsOf(item).some(partLossy);
}

/** The legacy stamp key of an item that has no stamp: its prompt alone, which names no question exactly. Null when stamped. */
function promptAliasOf(item) {
  const stamp = item.contentHash ?? item.contentId;
  if (stamp != null && stamp !== '') return null;
  return item.prompt != null && item.prompt !== '' ? 'seen-' + opaqueContentHash(String(item.prompt)) : null;
}

/** Every legacy key this exact item was recorded under before v2 (read only; never written). */
function legacySeenKeysOf(item) {
  const hashes = new Set([contentHashOf(item)]);
  const stamped = item.contentHash ?? item.contentId ?? item.prompt;
  if (stamped != null && stamped !== '') hashes.add(String(stamped));
  return ['seen-c' + legacyContentIdentityOf(item), ...[...hashes].map(hash => 'seen-' + opaqueContentHash(hash))];
}

/**
 * The keys under which this item may be recorded as seen, canonical first,
 * then every legacy key. Read with all of them; write with `seenKeyOf` alone.
 */
export function seenKeysOf(item) {
  if (!unit(item)) return [];
  return [seenKeyOf(item), ...legacySeenKeysOf(item)];
}

/** The keys under which a try on this content may be recorded, canonical first. */
export function triedKeysOf(item) {
  if (!unit(item)) return [];
  return [triedKeyOf(item), 'tried-c' + legacyContentIdentityOf(item)];
}

/**
 * Why `known` (the live keys of an account, from seenAmong) makes this item a
 * repeat: null when it does not. `legacy` says the match rests on a key written
 * before v2; `ambiguous` says that key could not have told this item from
 * another (the projection it was taken over dropped something this item has,
 * or it is the prompt-only alias of an unstamped unit), so the decision is
 * reported as legacy evidence.
 */
export function repeatEvidenceOf(item, known) {
  if (!known || known.size === 0) return null;
  const [canonical, ...legacy] = seenKeysOf(item);
  if (known.has(canonical)) return { key: canonical, legacy: false, ambiguous: false };
  const hit = legacy.find(key => known.has(key));
  if (!hit) return null;
  return { key: hit, legacy: true, ambiguous: hit === promptAliasOf(item) || legacyIdentityAmbiguous(item) };
}

/** Every item of a sealed exam question whose solution a result discloses. */
export function examItemsOf(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  return [payload, payload.alt, ...parts, ...parts.map(part => part?.alt)].filter(item => item && typeof item === 'object');
}

// ── The records ─────────────────────────────────────────────────────────────

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
 * instead of silently staying dead. Renewal is monotonic: the row keeps the
 * LATER of its expiry and the new one, so a request that started earlier and
 * committed later (practice captures `now` before it marks; a paper is marked
 * off the request thread before its transaction opens) can never shorten what
 * a later request already recorded — and housekeeping can never sweep a row a
 * later exposure should have kept. Same statement on SQLite and Postgres.
 */
export async function markSeen(db, accountId, keys, now, age = SEEN_AGE) {
  const wanted = [...new Set(keys)];
  for (let i = 0; i < wanted.length; i += CHUNK) {
    const chunk = wanted.slice(i, i + CHUNK);
    // One statement per chunk. Only `?` placeholders are joined into it.
    await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES "
      + chunk.map(() => "(?,'practice-content',?,?,?,?,?)").join(',')
      + ' ON CONFLICT(account_id,scope,key) DO UPDATE SET expires_at=CASE WHEN idempotency_keys.expires_at > excluded.expires_at THEN idempotency_keys.expires_at ELSE excluded.expires_at END',
      chunk.flatMap(key => [accountId, key, '{}', digest({ seen: key }), now, now + age]));
  }
}

/** Why this account's records make this item a repeat (see repeatEvidenceOf), or null. */
export async function contentSeenEvidence(db, accountId, item, now = Date.now()) {
  return repeatEvidenceOf(item, await seenAmong(db, accountId, seenKeysOf(item), now));
}

/** Has this account been shown the solution of this question's content? */
export async function contentSeen(db, accountId, item, now = Date.now()) {
  return (await contentSeenEvidence(db, accountId, item, now)) !== null;
}

/** Record that this account has been shown the solution of this content (under the canonical key alone). */
export const markContentSeen = (db, accountId, item, now) => markSeen(db, accountId, [seenKeyOf(item)], now);

/** Has this account already spent a try on this content, on any copy of it? */
export async function contentTried(db, accountId, item, now = Date.now()) {
  return (await seenAmong(db, accountId, triedKeysOf(item), now)).size > 0;
}

/** Record a try spent on this content (under the canonical key alone). */
export const markContentTried = (db, accountId, item, now) => markSeen(db, accountId, [triedKeyOf(item)], now, TRIED_AGE);
