// Pri Learning · question variants ("tweak this question")
//
// From one seed question, produce further questions of the same kind at every
// difficulty band. A variant is never invented free-hand: it is drawn from a
// deterministic generator, so its keyed answer comes from the same code that
// built the prompt, and it is kept only when
//
//   · the deterministic marker credits its own keyed answer (engineVerify:
//     checkAnswer on the key, spelt as a student would enter it), so a variant
//     whose key the engine would not credit is dropped, never served;
//   · its content hash (contentIdentity.js) differs from the seed and from every
//     variant already kept — the same question with a new seed is not a variant.
//
// Where a variant comes from:
//   · a generated question  → the same generator. At the seed's own band the
//     variant keeps the seed's SHAPE (its prompt with every number masked) when
//     the generator can produce that shape again: the same question with new
//     numbers. At other bands it is that generator's form at the new band.
//   · an official (previous-year) record → the generators that serve the
//     record's chapter at each band. These are Pri-authored questions on the
//     same chapter, NOT reworded copies of the official item, and they say so:
//     provenance "Pri variant of <record id>", previousYearQuestion false.
//
// Nothing here marks a student's answer or claims human or examiner review.
import { generateQuestion } from './generators/index.js';
import { contentHashOf } from './contentIdentity.js';
import { IN_CHAPTERS } from './curriculum-in.js';
import { checkAnswer } from './checker.js';
import { formatRegion, formatMatrix, formatVector, formatComplex, authoredRegion } from './answer-forms.js';

export const VARIANT_BANDS = Object.freeze([1, 2, 3, 4]);

/** The prompt with every number masked: two items with one shape differ only in their numbers. */
export function shapeOf(q) {
  return String(q?.prompt ?? '').replace(/-?\d+(?:\.\d+)?/g, '#').replace(/\s+/g, ' ').trim();
}

const fmt = v => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6));

/**
 * The keyed answer spelt as a student would enter it (an MCQ by its option
 * index), or null for a type with no single typed key (working, multi-part).
 */
export function keyInputOf(q) {
  const a = q?.answer || {};
  switch (q?.answerType) {
    case 'numeric':
      if (a.canonicalInput) return a.canonicalInput;
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction && a.simplestFraction.d !== 1) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      return Number.isFinite(a.value) ? fmt(a.value) : null;
    case 'set': return Array.isArray(a.values) ? a.values.map(fmt).join(', ') : null;
    case 'point': return `(${fmt(a.x)}, ${fmt(a.y)})`;
    case 'ratio': return `${a.a}:${a.b}`;
    case 'expression': return a.expr ?? null;
    case 'mcq': return Number.isInteger(a.correctIndex) ? String(a.correctIndex) : null;
    case 'interval': { const region = authoredRegion(a); return region ? formatRegion(region, a.variable || 'x') : (a.region || null); }
    case 'matrix': return Array.isArray(a.rows) ? formatMatrix(a.rows) : null;
    case 'vector': return Array.isArray(a.components) ? formatVector(a.components) : null;
    case 'complex': return Number.isFinite(Number(a.re)) ? formatComplex({ re: Number(a.re), im: Number(a.im) }) : null;
    default: return null;
  }
}

/** The deterministic engine's verdict on a question's own key: true only when credited. */
export function engineVerify(q) {
  const input = keyInputOf(q);
  if (input == null || input === '') return false;
  try { return checkAnswer(q, input)?.correct === true; } catch { return false; }
}

/** Deterministic, well-spread seeds for the i-th draw from a base. */
const seedFor = (base, i) => Number((BigInt((base >>> 0) + 1) * 2654435761n + BigInt(i) * 40503n) % 4294967291n);

/** Generators that serve a chapter at a band, from the live covers. */
export function generatorsForChapter(chapterId, band) {
  const chapter = IN_CHAPTERS.find(c => c.id === chapterId);
  if (!chapter) return [];
  const out = [];
  for (const cover of chapter.covers || []) {
    if ((cover.diff || []).includes(band) && !String(cover.gen).startsWith('pyq-') && !out.includes(cover.gen)) out.push(cover.gen);
  }
  return out;
}

function provenanceFor(seed, origin) {
  const official = !!(seed?.pyq || origin.recordId);
  return Object.freeze({
    authoredBy: 'pri-generator',
    checkedBy: 'deterministic-engine',
    humanReviewed: false,
    examinerReviewed: false,
    previousYearQuestion: false,
    variantOf: official ? `pyq:${origin.recordId}` : origin.seedContentId,
    label: official ? `Pri variant of ${origin.recordId}` : `Pri variant of ${origin.seedContentId}`
  });
}

/**
 * Variants of `seed` at every requested band.
 *
 *   seed      a generated question (with `subtopic`, `difficulty`, `seed`) or an
 *             official record (with `pyq`/`pyqId` or `id` and `chapterId`)
 *   options   { verify(q) → boolean   defaults to engineVerify; a stricter
 *                                      check may be passed, never a looser one
 *               bands = [1,2,3,4], perBand = 3, tries = 80 per band,
 *               generator              override the source generator }
 *
 * Returns { variants: [{ band, generator, seed, question, provenance, sameShape }],
 *           shortfall: [{ band, wanted, got, reason }] }. A band the source
 * cannot serve, or cannot fill with verified distinct items inside `tries`, is
 * reported in `shortfall` rather than padded.
 */
export function variantsOf(seed, options = {}) {
  const { bands = VARIANT_BANDS, perBand = 3, tries = 80 } = options;
  // A caller's check is applied ON TOP of the engine's, never instead of it.
  const extra = options.verify;
  if (extra !== undefined && typeof extra !== 'function') throw new TypeError('options.verify must be a function');
  const verify = q => engineVerify(q) && (extra ? extra(q) === true : true);
  const official = !!(seed?.pyq || seed?.pyqId || (seed?.id && seed?.chapterId && !seed?.subtopic));
  const recordId = official ? String(seed.pyqId || seed.id) : null;
  const generator = options.generator || (official ? null : seed?.subtopic);
  if (!official && !generator) throw new TypeError('a generated seed needs its generator id (q.subtopic or options.generator)');
  const seedHash = contentHashOf(seed);
  const seedShape = shapeOf(seed);
  const seedBand = Number(seed?.difficulty) || null;
  const seedContentId = seed?.contentId || (generator ? `gen:${generator}:d${seedBand ?? 0}:s${Number(seed?.seed) >>> 0}` : null);
  const provenance = provenanceFor(seed, { recordId, seedContentId });
  const base = Number(seed?.seed) || [...String(recordId || seedContentId)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

  const seen = new Set([seedHash]);
  const variants = [];
  const shortfall = [];
  for (const band of bands) {
    const sources = official ? generatorsForChapter(seed.chapterId, band) : [generator];
    if (!sources.length) { shortfall.push({ band, wanted: perBand, got: 0, reason: 'no generator serves this chapter at this band' }); continue; }
    // At the seed's own band a generated seed's variants keep its shape when the
    // generator can give it; the first pass asks for that, the second accepts any form.
    const wantShape = !official && band === seedBand;
    let got = 0, rejected = 0;
    for (const pass of wantShape ? [true, false] : [false]) {
      for (let i = 0; i < tries && got < perBand; i++) {
        const gen = sources[i % sources.length];
        const s = seedFor(base + band * 7919 + (pass ? 0 : 104729), i);
        let q;
        try { q = generateQuestion(gen, band, s); } catch { rejected += 1; continue; }
        if (!q) { rejected += 1; continue; }
        const sameShape = shapeOf(q) === seedShape;
        if (pass && !sameShape) continue;
        const h = contentHashOf(q);
        if (seen.has(h)) continue;
        let ok = false;
        try { ok = verify(q) === true; } catch { ok = false; }
        if (!ok) { rejected += 1; continue; }
        seen.add(h);
        variants.push(Object.freeze({ band, generator: gen, seed: s, question: q, provenance, sameShape, contentHash: h }));
        got += 1;
      }
    }
    if (got < perBand) shortfall.push({ band, wanted: perBand, got, reason: rejected ? `${rejected} draws failed verification or generation` : 'the source generator has too few distinct items at this band' });
  }
  return { variants, shortfall };
}
