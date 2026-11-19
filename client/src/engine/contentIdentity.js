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

// 2026.11.0 — Class 8 Rational Numbers and Linear Equations serve original
// forms instead of NCERT-numbered items; typesetting defects (double signs,
// unit coefficients, +0 terms) fixed across 16 generators; past papers behind
// a default-off switch (content honesty stream, Nov 2026).
// 2026.11.1 — Class 9 mastery generators widened: wide integer ranges and two
// or three shapes per cell (some cells served 2–8 questions in all); the skill,
// answer type, hints and worked solution of every cell are unchanged in kind.
// 2026.11.2 — Class 9 factorising MCQ: equivalent factorisations are one
// option, written in one factor order; no wrong option expands to the key.
// 2026.11.7 — Merge Train 8: the JEE archive (#795, 2026.11.6) and the Class 9
// widening (#812, 2026.11.2 above) together; neither version alone describes it.
// 2026.11.8 — Distinct-question widening (L5): Class X surface-area combinations
// (any multiple-of-7 radius, every whole-number cone, a capsule form, free cube
// radius), trigonometry triples and heights, situational quadratics, linear-pair
// methods; Class 9 rectangle-from-vertices and two-point linear relation ranges.
// Every form, answer type, hint and worked step is unchanged in kind.
// 2026.11.14 — c10-linear-pair-methods D2 back on its original ranges, so its certified seeds reproduce (#838 D25).
// 2026.11.9 — CBSE Class X 2025 Set 30/1/2 Section A: ten official questions
// with the Board's key and Pri-authored steps join the archive (the eight it
// shares with 30/1/1 are not repeated). (2026.11.8 is the distinct-question
// widening, #838; whichever lands second re-derives the digest.)
// 2026.11.10 — the same tranche grown to Sets 30/1/3 and 30/2/1 (25 more records).
// 2026.11.11 — CBSE Class XII 2025 Set 65/2/1 Section A: 17 official questions.
// 2026.11.15 — Merge Train 15: the archive on demand (#847), CBSE X 2025 30/1/2,
// 30/1/3, 30/2/1 and XII 65/2/1 Section A (#840, #845), JEE Main 2026 S2 (#842),
// the distinct-question widening (#838) and the Board-scheme contract (#844)
// together; no single PR's version above describes the merged content.
// 2026.11.16 — CBSE XII 2025 65/2/1 Q24, the first Section B record on the Board-scheme
// contract (#846), restacked on Train 15.
// 2026.11.37 — Train editions-25: the merged content of the 33 branches together; the extra Priyabhata
// forms no longer draw a "- 0" term (Class 7 integers) or a "0^3" limit (Class 12 average value), which the
// zero-term typesetting rule of the content certification refuses.
// 2026.11.38 — Train editions-25 review fixes: no floating-point artefacts in the Years 9-10 overlays (variation,
// scale drawings), no "${" at the start of a combinations span, and every extra form that states a number of
// decimal places keys the matching tolerance band.
// 2026.11.39 — Train editions-25 independent-review fixes: a skill's forms are drawn in proportion to the questions each
// can serve (the direct form no longer shadowed by small extra forms, which cut the distinct-question counts), a
// designed wrong answer that equals the key is dropped, `N decimal places` reads every digit of N, and the
// exact-value slips name any angle.
// 2026.11.40 — Train editions-25 CI fix: Some Applications of Trigonometry (c10-trig-applications) draws only
// figure-bearing heights-and-distances forms (the right-triangle ratio, the ladder and two new ones, a kite string
// and an angle of depression); the table and identity expressions stay in the Trigonometry chapter.
// 2026.11.43 — The every-reading rule for bare and "= …" lines (y12-integration's derived step check is back on; the landing demo is
//              judged with its question), merged with 2026.11.42's NSW content gaps. Served questions are unchanged except where the
//              merge changed them; the digests are regenerated on the merged tree.
// 2026.11.44 — Graph-sketch forms: y11-quadfunc D2 and y12-appdiff D2/D3 gain five forms in which the student states a graph's
//              intercepts and turning points (answerType 'graph-sketch'). Adding forms to those cells changes which question a
//              given seed draws (612 of 900 sampled draws), so every seed in them is a different question from 2026.11.43's.
// 2026.11.42 — Past-paper keys carry the paper's own published acceptance band (answer.officialRange) in the served payload, so the
//              marker's exact-value and uncalled-for-band rules leave that band alone (16 JEE Advanced chapter digests).
// 2026.11.41 — Walk-through maths fixes: a grouped-data mode question has one modal class; a numeric key is judged
// by the band its wording asks for (an exact key carries none, a key to three decimals says so, "exactly" is exact,
// "to the nearest degree" names its place, a list of solutions is bounded by the precision named); a negative number
// raised to a power is bracketed in every worked line; Areas Related to Circles serves plane figures (two new forms,
// arc length and the perimeter of a sector) and Surface Areas and Volumes serves solids (two new forms, the curved
// surface of a cylinder and the surface of a sphere); the pump question asks how much is removed; the earlier
// energy-rate, factorise-fully and Year 7 mode corrections are part of this version.
// 2026.11.42 — NSW content gaps: Advanced and Extension 1 cells that had no question now have verified forms; a set
// of rational solutions prints as fractions; a previous-year question keeps the exam's published band; the key-format
// repairs (a constant key, a plain percentage box, a plain value box) and the wider parameter ranges change what
// those generators serve.
export const CONTENT_VERSION = '2026.11.44';
/**
 * A sealed token that re-generates a question from (generator, difficulty, seed) (a prepared practice question, a guest
 * ticket) carries the content version it was minted under (`c`). A token with no `c` was minted before that field existed,
 * under this version or an earlier one: it is read as this version, so it binds only while it is still in force and is
 * stale after any later bump. Never change this value when bumping CONTENT_VERSION.
 */
export const UNVERSIONED_TOKEN_CONTENT_VERSION = '2026.11.43';
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
    q.answer ?? null, norm(q.figure), parts,
    // A matching-list item keeps its question in the two lists: its prompt is
    // the same sentence on every such item and its options are only codes
    // ("P → 2, Q → 1, …"). Without the lists, two different matching items that
    // happened to share a code set had one hash — "the same question twice" on
    // a paper that held two different questions. Appended only when present,
    // so the hash of every other question is unchanged.
    ...(matchListOf(q) ? [matchListOf(q)] : [])
  ]);
}

/** The two lists of a matching-list item, normalised; null for anything else. */
export function matchListOf(q) {
  const lists = q?.matchList;
  if (!lists || typeof lists !== 'object' || !Array.isArray(lists.left) || !Array.isArray(lists.right)) return null;
  const side = rows => rows.map(row => [norm(row?.key), norm(row?.text)]);
  return [side(lists.left), side(lists.right)];
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
