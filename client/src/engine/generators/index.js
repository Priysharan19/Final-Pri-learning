// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Generator registry — one lazily-loaded bank per year/stream.
// The whole Years 7–12 bank is ~536 kB of source and a student practises inside
// two or three of its files, so each year and stream module is its own dynamic
// chunk instead of a static import. Banks are pulled in by the API layer before
// a request reaches the backend; `generateQuestion` itself stays synchronous so
// the local backend keeps the exact call signature it has always had.
// ─────────────────────────────────────────────────────────────────────────────
import { makeRng } from '../qhelpers.js';

// ── Banks ────────────────────────────────────────────────────────────────────

const BANKS = {
  year7: () => import('./year7.js').then(m => m.year7),
  year8: () => import('./year8.js').then(m => m.year8),
  year9: () => import('./year9.js').then(m => m.year9),
  year10: () => import('./year10.js').then(m => m.year10),
  year11: () => import('./year11.js').then(m => m.year11),
  year12: () => import('./year12.js').then(m => m.year12),
  'streams-standard': () => import('./streams-standard.js').then(m => m.streamsStandard),
  'streams-ext': () => import('./streams-ext.js').then(m => m.streamsExt)
};

// Subtopic ids are namespaced by the bank that authors them: y9-surds lives in
// year9, ms12-loans in streams-standard, mex-complex in streams-ext.
const BANK_OF = {
  y7: 'year7', y8: 'year8', y9: 'year9', y10: 'year10', y11: 'year11', y12: 'year12',
  ms11: 'streams-standard', ms12: 'streams-standard',
  me11: 'streams-ext', me12: 'streams-ext', mex: 'streams-ext'
};

/** Holds the generators of every bank loaded so far, keyed by subtopic id. */
export const GENERATORS = {};

const loaded = new Set();
const inflight = new Map();

/** The bank a subtopic id belongs to, or null if the id names no bank. */
export function bankOf(subtopicId) {
  return BANK_OF[String(subtopicId ?? '').split('-')[0]] || null;
}

function loadBank(name) {
  if (loaded.has(name)) return Promise.resolve();
  let job = inflight.get(name);
  if (!job) {
    job = BANKS[name]().then(bank => {
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
  return Promise.all([...new Set(names)].filter(n => BANKS[n]).map(loadBank)).then(() => { });
}

/** Load whichever banks author the given subtopic ids. */
export function loadBanksFor(subtopicIds) {
  return loadBanks(subtopicIds.map(bankOf).filter(Boolean));
}

/** Load every bank — for callers that can reach any year, such as the demo seed. */
export function loadAllBanks() {
  return loadBanks(Object.keys(BANKS));
}

// ── Generation ───────────────────────────────────────────────────────────────

/**
 * Generate a question for a subtopic at a difficulty (1–4).
 * Returns { seed, subtopic, difficulty, ...payload }.
 * Throws with `bankMissing` set when the subtopic is real but its bank has not
 * been loaded yet, which lets the API layer fetch that one bank and re-run the
 * request. Nothing is written before this point in any route that calls it.
 */
export function generateQuestion(subtopicId, difficulty, seed) {
  const gen = GENERATORS[subtopicId];
  if (!gen) {
    const bank = bankOf(subtopicId);
    if (bank && !loaded.has(bank)) {
      throw Object.assign(new Error(`Question bank "${bank}" is not loaded`), { bankMissing: true, bank, subtopic: subtopicId });
    }
    throw new Error(`No generator for subtopic ${subtopicId}`);
  }
  const s = seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(s);
  const d = Math.min(4, Math.max(1, difficulty | 0));
  const payload = gen(rng, d);
  return { seed: s, subtopic: subtopicId, difficulty: d, ...payload };
}
