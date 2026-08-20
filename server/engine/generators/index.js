// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Generator registry — client registry + server-only extra forms
//
// The generators themselves have ONE source of truth: client/src/engine/. Two
// things are added here.
//
// First, the client loads its year/stream banks lazily, one dynamic chunk per
// bank, so `GENERATORS` starts empty and fills as a student navigates. Every
// server-side caller is synchronous and may touch any year at any moment, so
// this module awaits all eight banks once at import time and hands on a fully
// populated registry. Without that, `Object.keys(GENERATORS)` is [] and the
// self-check silently measures nothing.
//
// Second, extras.js — 84 further authored forms that ship on the server side
// alone — and the seeded picker that chooses between a subtopic's base
// generator and its extras.
// ─────────────────────────────────────────────────────────────────────────────
import { GENERATORS, loadAllBanks } from '../../../client/src/engine/generators/index.js';
import { EXTRA_FORMS } from './extras.js';
import { makeRng } from '../qhelpers.js';

await loadAllBanks();

export { GENERATORS };

/** Number of authored forms behind a (subtopic, difficulty) cell: the base
 *  generator counts as one; extras add more. */
export function formCount(subtopicId, d) {
  return 1 + (EXTRA_FORMS[subtopicId]?.[d]?.length || 0);
}

/**
 * Generate a question for a subtopic at a difficulty (1–4).
 * The seeded rng first picks WHICH authored form serves this question
 * (base generator or one of the extra forms), so every seed reproduces
 * the exact same question forever.
 * Returns { seed, subtopic, difficulty, ...payload }.
 */
export function generateQuestion(subtopicId, difficulty, seed) {
  const gen = GENERATORS[subtopicId];
  if (!gen) throw new Error(`No generator for subtopic ${subtopicId}`);
  const s = seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(s);
  const d = Math.min(4, Math.max(1, difficulty | 0));
  const extras = EXTRA_FORMS[subtopicId]?.[d] || [];
  const pick = extras.length ? Math.floor(rng() * (1 + extras.length)) : 0;
  const payload = pick === 0 ? gen(rng, d) : extras[pick - 1](rng);
  return { seed: s, subtopic: subtopicId, difficulty: d, ...payload };
}
