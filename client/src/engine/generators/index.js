// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Generator registry — one lazily-loaded bank per year/stream.
// The whole Years 7–12 bank is over half a megabyte of source and a student
// practises inside two or three of its files, so each year and stream module is
// its own dynamic chunk instead of a static import. Banks are pulled in by the
// API layer before a request reaches the backend; `generateQuestion` itself
// stays synchronous so the local backend keeps the exact call signature it has
// always had.
// ─────────────────────────────────────────────────────────────────────────────
import { makeRng } from '../qhelpers.js';
import { dotpointById, dotpointAt, formDotpoints } from '../curriculum.js';
import { hasJeePyqGenerator, loadJeePyqGenerator } from './jee-pyq-runtime.js';

// ── Banks ────────────────────────────────────────────────────────────────────

const BANKS = {
  year7: () => import('./year7.js').then(m => m.year7),
  year8: () => import('./year8.js').then(m => m.year8),
  year9: () => import('./year9.js').then(m => m.year9),
  year10: () => import('./year10.js').then(m => m.year10),
  year11: () => import('./year11.js').then(m => m.year11),
  year12: () => import('./year12.js').then(m => m.year12),
  'streams-standard': () => import('./streams-standard.js').then(m => m.streamsStandard),
  'streams-ext': () => import('./streams-ext.js').then(m => m.streamsExt),
  // Indian curriculum chapters the NSW banks never had a topic for.
  'india-algebra': () => import('./india-algebra.js').then(m => m.indiaAlgebra),
  'india-coordinate': () => import('./india-coordinate.js').then(m => m.indiaCoordinate),
  'india-calculus': () => import('./india-calculus.js').then(m => m.indiaCalculus),
  'india-olympiad': () => import('./india-olympiad.js').then(m => m.indiaOlympiad),
  'india-foundation': () => import('./india-foundation.js').then(m => m.indiaFoundation),
  // The overlay leaves the established junior bank unchanged and adds the
  // source-audited NCERT Class 8 Chapter 1 and Chapter 2 skill generators.
  'india-junior': () => import('./india-junior-overlay.js').then(m => m.indiaJunior),
  'india-class10': () => import('./india-class10.js').then(m => m.indiaClass10),
  'india-senior': () => import('./india-senior.js').then(m => m.indiaSenior)
};

// Subtopic ids are namespaced by the bank that authors them: y9-surds lives in
// year9, ms12-loans in streams-standard, mex-complex in streams-ext.
const BANK_OF = {
  y7: 'year7', y8: 'year8', y9: 'year9', y10: 'year10', y11: 'year11', y12: 'year12',
  ms11: 'streams-standard', ms12: 'streams-standard',
  me11: 'streams-ext', me12: 'streams-ext', mex: 'streams-ext'
};

// The Indian banks all author chapters whose ids begin c11-/c12-, so the prefix
// table above cannot tell them apart. These are named one by one instead —
// a chapter added to a bank has to be added here too, and india-check.mjs fails
// if it is not, because the chapter then resolves to no bank at all.
const INDIA_BANK_OF = {
  'c11-sets': 'india-algebra',
  'c11-linear-inequalities': 'india-algebra',
  'c11-binomial-theorem': 'india-algebra',
  'c12-matrices': 'india-algebra',
  'c12-determinants': 'india-algebra',
  'c11-conic-sections': 'india-coordinate',
  'c11-3d-introduction': 'india-coordinate',
  'c12-3d-geometry': 'india-coordinate',
  'c12-linear-programming': 'india-coordinate',
  'c12-differential-equations': 'india-calculus',
  'c12-applications-integrals': 'india-calculus',
  'olymp-number-theory': 'india-olympiad',
  'olymp-combinatorics': 'india-olympiad',
  'olymp-inequalities': 'india-olympiad',
  'olymp-functional-equations': 'india-olympiad',
  'olymp-geometry': 'india-olympiad',
  'olymp-polynomials': 'india-olympiad',
  'olymp-proof': 'india-olympiad',
  'c7-symmetry': 'india-foundation',
  'c7-solid-shapes': 'india-foundation',
  'c8-quadrilaterals': 'india-foundation',
  'c8-squares-roots': 'india-foundation',
  'c8-cubes-roots': 'india-foundation',
  'c9-euclid-geometry': 'india-foundation',
  'c9-triangles': 'india-foundation',
  'c9-quadrilaterals': 'india-foundation',
  'c9-circles': 'india-foundation',
  'c9-herons-formula': 'india-foundation',
  'c10-real-numbers': 'india-foundation',
  'c10-circles': 'india-foundation',
  'c7-triangle-angles': 'india-junior',
  'c8-rational-numbers': 'india-junior',
  'c8-rational-numbers-foundations': 'india-junior',
  'c8-rational-numbers-closure': 'india-junior',
  'c8-rational-numbers-commutativity': 'india-junior',
  'c8-rational-numbers-associativity': 'india-junior',
  'c8-rational-numbers-identities': 'india-junior',
  'c8-rational-numbers-distributivity': 'india-junior',
  'c8-rational-numbers-strategy': 'india-junior',
  'c8-rational-numbers-between': 'india-junior',
  'c8-linear-equations': 'india-junior',
  'c8-linear-equations-foundations': 'india-junior',
  'c8-linear-equations-both-sides': 'india-junior',
  'c8-linear-equations-fractions': 'india-junior',
  'c8-linear-equations-brackets': 'india-junior',
  'c8-linear-equations-decimals': 'india-junior',
  'c8-linear-equations-verification': 'india-junior',
  'c8-linear-equations-source-mastery': 'india-junior',
  'c8-quadrilaterals-ncert-mastery': 'india-junior',
  'c8-data-handling-ncert-mastery': 'india-junior',
  'c8-squares-roots-ncert-mastery': 'india-junior',
  'c8-cubes-roots-ncert-mastery': 'india-junior',
  'c8-comparing-quantities-ncert-mastery': 'india-junior',
  'c8-algebraic-identities-ncert-mastery': 'india-junior',
  'c8-mensuration-ncert-mastery': 'india-junior',
  'c8-exponents-ncert-mastery': 'india-junior',
  'c8-proportions-ncert-mastery': 'india-junior',
  'c8-factorisation-ncert-mastery': 'india-junior',
  'c8-graphs-ncert-mastery': 'india-junior',
  'c8-data-charts': 'india-junior',
  'c8-proportions-dir-inv': 'india-junior',
  'c9-polynomial-basics': 'india-junior',
  'c9-coordinate-geometry': 'india-junior',
  'c9-statistics-grouped': 'india-junior',
  'c9-coordinate-geometry-ncert-mastery': 'india-junior',
  'c9-linear-polynomials-ncert-mastery': 'india-junior',
  'c9-number-systems-ncert-mastery': 'india-junior',
  'c9-algebraic-identities-ncert-mastery': 'india-junior',
  'c9-circles-ncert-mastery': 'india-junior',
  'c9-perimeter-area-ncert-mastery': 'india-junior',
  'c9-probability-ncert-mastery': 'india-junior',
  'c9-sequences-progressions-ncert-mastery': 'india-junior',
  'c10-polynomial-zeroes': 'india-class10',
  'c10-triangles-current': 'india-class10',
  'c10-irrationality-proofs': 'india-class10',
  'c10-linear-graphs': 'india-class10',
  'c10-linear-solution-conditions': 'india-class10',
  'c10-quadratic-discriminant': 'india-class10',
  'c10-trig-boundary-relations': 'india-class10',
  'c10-quadratic-context': 'india-class10',
  'c10-surface-area-combo': 'india-class10',
  'c10-trigonometry-current': 'india-class10',
  'c10-trig-applications-current': 'india-class10',
  'c10-arithmetic-progressions': 'india-class10',
  'c10-coordinate-geometry': 'india-class10',
  'c10-areas-circles': 'india-class10',
  'c10-surface-volume-combo': 'india-class10',
  'c10-statistics': 'india-class10',
  'c11-sequence-means': 'india-senior',
  'c11-statistics': 'india-senior',
  'c12-relations-equivalence': 'india-senior',
  'c12-continuity-mvt': 'india-senior',
  'c12-integral-properties': 'india-senior',
  'c12-vector-algebra': 'india-senior',
  'c12-probability-bayes': 'india-senior'
};

/** Holds the generators of every bank loaded so far, keyed by subtopic id. */
export const GENERATORS = {};

const loaded = new Set();
const inflight = new Map();
const JEE_BANK_PREFIX = 'jee-pyq:';

/** The bank a subtopic id belongs to, or null if the id names no bank. */
export function bankOf(subtopicId) {
  const id = String(subtopicId ?? '');
  if (hasJeePyqGenerator(id)) return `${JEE_BANK_PREFIX}${id}`;
  return INDIA_BANK_OF[id] || BANK_OF[id.split('-')[0]] || null;
}

function bankLoader(name) {
  if (BANKS[name]) return BANKS[name];
  if (!String(name || '').startsWith(JEE_BANK_PREFIX)) return null;
  const generatorId = String(name).slice(JEE_BANK_PREFIX.length);
  return async () => {
    const generator = await loadJeePyqGenerator(generatorId);
    return generator ? { [generatorId]: generator } : {};
  };
}

function loadBank(name) {
  const loader = bankLoader(name);
  if (!loader || loaded.has(name)) return Promise.resolve();
  let job = inflight.get(name);
  if (!job) {
    job = loader().then(bank => {
      Object.assign(GENERATORS, bank);
      loaded.add(name);
      inflight.delete(name);
    }, err => {
      inflight.delete(name);
      throw err;
    });
    inflight.set(name, job);
  }
  return job;
}

/** Load the named banks; unknown names are ignored. Resolves once all are in. */
export function loadBanks(names) {
  return Promise.all([...new Set(names)].filter(Boolean).map(loadBank)).then(() => { });
}

/** Load whichever banks author the given subtopic ids. */
export function loadBanksFor(subtopicIds) {
  return loadBanks(subtopicIds.map(bankOf).filter(Boolean));
}

/** Load every authored bank — reviewed JEE PYQs stay demand-loaded by chapter. */
export function loadAllBanks() {
  return loadBanks(Object.keys(BANKS));
}

// ── Dot-point resolution ─────────────────────────────────────────────────────
// A question is generated by one authored form, and a form exercises one or
// more of its subtopic's dot points. Three declarations are consulted, most
// specific first, and they are not all made at the same resolution:
//
//   1. the payload — a generator may return `dotpoint` / `dotpoints` for the
//      branch it just took. This is the only declaration that describes THIS
//      question, and so the only one that can be exact about a form that asks
//      about perimeter on one branch and area on the next;
//   2. the generator function — `gen.dotpoints = { 1: [0], 2: [1] }` lets a
//      bank declare per difficulty without touching every return statement.
//      Bank-authored, but still one declaration per (subtopic, difficulty);
//   3. DOTPOINT_FORMS in curriculum.js — the registry-side table, at the same
//      resolution as 2: it knows a cell and cannot know a branch.
//
// Only 1 is per question. 2 and 3 describe a cell, so what they say about the
// single question in hand is only ever as sharp as that cell: a cell naming one
// dot point pins every question it makes to that dot point, while a cell naming
// two cannot say which of them any one question is. `dotpointExact` is built on
// that distinction rather than on membership of the list, because membership is
// a property of the cell rather than of the question in front of the student.
//
// Ordinals are 0-based within the subtopic; ids and `subtopic#slug` keys are
// accepted too, so a bank can write whichever reads better at the call site.

/** Normalise one declared reference to a dot point of `subtopicId`, or null. */
function toDotpoint(subtopicId, ref) {
  if (ref == null) return null;
  if (typeof ref === 'number') return dotpointAt(subtopicId, ref);
  const dp = dotpointById(ref);
  return dp && dp.subtopic === subtopicId ? dp : null;
}

function declaredOn(source, subtopicId) {
  if (!source) return null;
  const raw = source.dotpoints ?? source.dotpoint;
  if (raw == null) return null;
  const list = (Array.isArray(raw) ? raw : [raw]).map(r => toDotpoint(subtopicId, r)).filter(Boolean);
  return list.length ? list : null;
}

/**
 * The dot points a generated payload exercises, which declaration produced
 * them, and whether that declaration was made for this question or for the
 * whole (subtopic, difficulty) cell it came out of.
 */
function dotpointsOf(gen, subtopicId, difficulty, payload) {
  const fromPayload = declaredOn(payload, subtopicId);
  if (fromPayload) return { list: fromPayload, source: 'payload', perQuestion: true };
  const perDifficulty = gen?.dotpoints?.[difficulty];
  const fromGenerator = perDifficulty == null ? null : declaredOn({ dotpoints: perDifficulty }, subtopicId);
  if (fromGenerator) return { list: fromGenerator, source: 'generator', perQuestion: false };
  const fromRegistry = formDotpoints(subtopicId, difficulty);
  return { list: fromRegistry, source: fromRegistry.length ? 'registry' : null, perQuestion: false };
}

/**
 * The difficulty to generate at when a dot point has been asked for. A dot
 * point is only reachable through the difficulties whose form exercises it, so
 * a requested difficulty that cannot deliver it is snapped to the nearest one
 * that can (ties go to the easier). With no difficulty asked for, the seed
 * chooses — through its own rng, so the generator's stream is untouched and a
 * three-argument call still reproduces its question exactly.
 *
 * A difficulty the caller did ask for is honoured even when another one would
 * deliver the dot point exactly and this one only shares it with a sibling.
 * Moving a student off the level they asked for to earn a cleaner
 * `dotpointExact` would be trading the thing they asked for for a label.
 */
function difficultyFor(dp, difficulty, seed) {
  const forms = dp.forms;
  if (!forms.length) return null;
  if (difficulty == null) return forms[Math.floor(makeRng((seed ^ 0x5bf03635) >>> 0)() * forms.length)];
  const d = Math.min(4, Math.max(1, difficulty | 0));
  if (forms.includes(d)) return d;
  return forms.reduce((best, f) => {
    const gap = Math.abs(f - d), bestGap = Math.abs(best - d);
    return gap < bestGap || (gap === bestGap && f < best) ? f : best;
  });
}

// ── Generation ───────────────────────────────────────────────────────────────

/**
 * Generate a question for a subtopic at a difficulty (1–4).
 * Returns { seed, subtopic, difficulty, dotpoint, dotpoints, dotpointSource,
 * ...payload }.
 *
 * `dotpoints` is every dot point the declaration behind this question credits,
 * as ids; `dotpoint` is the single id when — and only when — the question can
 * honestly be pinned to one, and null otherwise, so a caller is never handed a
 * dot point the question only half exercises. `dotpointSource` records which
 * declaration produced them ('payload' — this question's own branch;
 * 'generator' or 'registry' — the cell it came from) or null when nothing
 * stands behind the cell.
 *
 * Pass `dotpointId` to REQUEST one: the difficulty is then resolved to one that
 * exercises it, and the result carries `dotpointRequested` plus `dotpointExact`.
 *
 * `dotpointExact` is a claim about THIS question, not about the cell that made
 * it. It is true only when the question is pinned to what was asked for: the
 * generator declared the dot points of the branch it took, or the cell-level
 * declaration behind it names that dot point and nothing else — in which case
 * every question that form makes is on target. It is false wherever nothing in
 * this repo can show the question is on target:
 *
 *   · no authored form exercises the dot point at all, so the question is a
 *     subtopic-level stand-in;
 *   · the declaration behind this question is a cell that also names a sibling.
 *     `y7-area` D1 covers both "Perimeter of polygons and composite shapes" and
 *     "Area of rectangles, triangles and parallelograms" and splits roughly
 *     evenly between them, so a request for either cannot be honoured exactly by
 *     that declaration alone. Some dot points are reachable only through cells
 *     like that; others have both a cell that names them alone and a shared one,
 *     and for those it depends on which difficulty the question came out at.
 *
 * So false means "not provably this dot point", not "not this dot point". A
 * caller wanting the weaker, cell-level claim should read `dotpoints` — the flag
 * deliberately does not answer it, because reading membership of that list as
 * proof is the mistake this flag exists to stop. Only a per-branch declaration
 * in the bank turns a shared cell exact; relabelling DOTPOINT_FORMS cannot,
 * since the ambiguity is in the form and not in the table. Callers can test up
 * front with `difficultiesForDotpoint` in curriculum.js, and
 * `tools/dotpoint-coverage.mjs` reports which dot points are exactly targeted
 * and which are only ever shared.
 *
 * The three-argument signature is unchanged: same rng draws, same question for
 * the same seed.
 *
 * Throws with `bankMissing` set when the subtopic is real but its bank has not
 * been loaded yet, which lets the API layer fetch that one bank and re-run the
 * request. Nothing is written before this point in any route that calls it.
 */
export function generateQuestion(subtopicId, difficulty, seed, dotpointId) {
  const gen = GENERATORS[subtopicId];
  if (!gen) {
    const bank = bankOf(subtopicId);
    if (bank && !loaded.has(bank)) {
      throw Object.assign(new Error(`Question bank "${bank}" is not loaded`), { bankMissing: true, bank, subtopic: subtopicId });
    }
    throw new Error(`No generator for subtopic ${subtopicId}`);
  }
  const s = seed ?? Math.floor(Math.random() * 2 ** 31);
  let requested = null;
  let want = difficulty;
  if (dotpointId != null) {
    requested = toDotpoint(subtopicId, dotpointId);
    if (!requested) throw new Error(`No dot point ${dotpointId} in subtopic ${subtopicId}`);
    want = difficultyFor(requested, difficulty, s) ?? difficulty;
  }
  const rng = makeRng(s);
  const d = Math.min(4, Math.max(1, want | 0));
  const payload = gen(rng, d);
  const q = { seed: s, subtopic: subtopicId, difficulty: d, ...payload };
  const { list, source, perQuestion } = dotpointsOf(gen, subtopicId, d, payload);
  q.dotpoints = list.map(dp => dp.id);
  q.dotpoint = list.length === 1 ? list[0].id : null;
  q.dotpointSource = source;
  if (requested) {
    q.dotpointRequested = requested.id;
    // A per-question declaration names the branch, so membership of its list is
    // proof. A cell-level one only pins the question when it names that dot
    // point alone — which is exactly `q.dotpoint`.
    q.dotpointExact = perQuestion ? q.dotpoints.includes(requested.id) : q.dotpoint === requested.id;
  }
  return q;
}