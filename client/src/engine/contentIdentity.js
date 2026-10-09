// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Question content identity
//
// Every served question carries three things so an attempt stays interpretable
// after the bank behind it changes:
//
//   · contentId      — a stable id for the item: the reviewed record id for a
//                      previous-year question, otherwise generator + difficulty
//                      + seed, which reproduces the item exactly under the same
//                      content version;
//   · contentVersion — the version of the authored bank that produced it.
//                      Bump CONTENT_VERSION whenever an existing generator's
//                      output for a given seed changes (the content digest gate
//                      in client/test/content-certify.mjs refuses a changed
//                      digest under an unchanged version);
//   · contentHash    — a digest of what the student actually saw (prompt,
//                      options, keyed answer, figure). Two items with the same
//                      hash are the same question, whatever seed made them, and
//                      that is what the repeat window compares.
//
// Rows written before this existed carry none of the three. They read as
// LEGACY_CONTENT_VERSION through contentRefOf, never as the current version, so
// an old attempt is never misattributed to content it was not answered on.
// ─────────────────────────────────────────────────────────────────────────────

export const CONTENT_VERSION = '2026.10.3';
export const LEGACY_CONTENT_VERSION = 'legacy-unversioned';

/** FNV-1a over a string, two lanes, as 16 hex characters. */
export function contentDigest(text) {
  const s = String(text ?? '');
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x0100019d) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

const norm = v => String(v ?? '').replace(/\s+/g, ' ').trim();

/** The student-visible substance of a question, normalised for comparison. */
function substance(q) {
  if (!q || typeof q !== 'object') return '';
  const parts = Array.isArray(q.parts)
    ? q.parts.map(p => [norm(p?.prompt), (p?.mcqOptions || []).map(norm), p?.answer ?? null])
    : null;
  return JSON.stringify([
    norm(q.stem), norm(q.prompt), q.answerType || null,
    (Array.isArray(q.mcqOptions) ? q.mcqOptions : []).map(norm),
    q.answer ?? null, norm(q.figure), parts
  ]);
}

/** Digest of what the student saw; equal hashes mean the same question. */
export function contentHashOf(q) {
  return contentDigest(substance(q));
}

/** The stable id of an item: its reviewed record, or generator/difficulty/seed. */
export function contentIdOf(q, generatorId = q?.subtopic) {
  if (!q || typeof q !== 'object') return null;
  if (q.pyq && q.pyqId) return `pyq:${q.pyqId}`;
  if (q.custom) return null;
  const seed = Number(q.seed);
  const gen = String(generatorId || q.multipartId || '');
  if (!gen || !Number.isFinite(seed)) return null;
  return `gen:${gen}:d${Number(q.difficulty) || 0}:s${seed >>> 0}`;
}

/** The payload with its identity stamped on (a new object; the input is untouched). */
export function stampContent(q, generatorId = q?.subtopic) {
  if (!q || typeof q !== 'object') return q;
  const contentId = contentIdOf(q, generatorId);
  return {
    ...q,
    contentId: contentId || null,
    contentVersion: contentId ? CONTENT_VERSION : null,
    contentHash: contentHashOf(q)
  };
}

/**
 * Identity of one composed exam item. A composed item (a numeric question
 * turned MCQ, an assertion–reason pair, a case study) is not reproducible from
 * one generator seed, but it is reproducible from the paper: the blueprint, the
 * paper seed and the item's position. `sourceContentId` keeps the generator
 * item it was built from when there is exactly one.
 */
export function stampExamItem(payload, { blueprintId, paperSeed, order }) {
  const bp = String(blueprintId || 'paper').replace(/[^A-Za-z0-9._\-]/g, '-').slice(0, 80);
  return {
    ...payload,
    contentId: `exam:${bp}:s${Number(paperSeed) >>> 0}:q${Number(order) || 0}`,
    contentVersion: CONTENT_VERSION,
    contentHash: contentHashOf(payload),
    sourceContentId: typeof payload?.contentId === 'string' ? payload.contentId : null
  };
}

const ID_RE = /^[A-Za-z0-9:._\-+]{1,200}$/;
const VERSION_RE = /^[A-Za-z0-9._\-]{1,40}$/;
const HASH_RE = /^[0-9a-f]{16}$/;

/**
 * The content reference of an attempt or question row, with migration-safe
 * defaults: anything written before identity existed (or carrying a malformed
 * value) reads as the legacy version with no id rather than as current content.
 */
export function contentRefOf(row) {
  const src = row && typeof row === 'object' ? row : {};
  const id = typeof src.contentId === 'string' && ID_RE.test(src.contentId) ? src.contentId : null;
  const version = typeof src.contentVersion === 'string' && VERSION_RE.test(src.contentVersion) ? src.contentVersion : null;
  const hash = typeof src.contentHash === 'string' && HASH_RE.test(src.contentHash) ? src.contentHash : null;
  return {
    contentId: id,
    contentVersion: id && version ? version : LEGACY_CONTENT_VERSION,
    contentHash: hash
  };
}

/**
 * Draw a question that is not in the recent window. `draw(i)` makes the i-th
 * candidate; `accept(q)` may narrow what counts (a misconception hunt), and
 * outranks freshness when both cannot be had. Bounded:
 * a pool too small to avoid a repeat returns the best candidate with
 * `repeat: true` instead of spinning.
 */
export function drawDistinct(draw, recentHashes = [], { tries = 8, accept = null } = {}) {
  const seen = new Set(recentHashes || []);
  let first = null, firstFresh = null, firstAccepted = null;
  for (let i = 0; i < Math.max(1, tries); i++) {
    const q = draw(i);
    if (!q) continue;
    const fresh = !seen.has(contentHashOf(q));
    const ok = accept ? accept(q) : true;
    if (!first) first = q;
    if (fresh && !firstFresh) firstFresh = q;
    if (ok && !firstAccepted) firstAccepted = q;
    if (fresh && ok) return { q, repeat: false, accepted: true };
  }
  // Nothing both fresh and accepted. What `accept` asks for (a misconception
  // being repaired) outranks freshness: a repeat that can spring the slip is
  // served, flagged as a repeat, rather than a fresh question that cannot.
  if (accept && firstAccepted) return { q: firstAccepted, repeat: true, accepted: true };
  if (firstFresh) return { q: firstFresh, repeat: false, accepted: !accept };
  return { q: first, repeat: !!first, accepted: false };
}
