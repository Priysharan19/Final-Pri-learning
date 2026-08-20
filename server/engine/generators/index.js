// Registry of all question generators, keyed by subtopic id.
import { year7 } from './year7.js';
import { year8 } from './year8.js';
import { year9 } from './year9.js';
import { year10 } from './year10.js';
import { year11 } from './year11.js';
import { year12 } from './year12.js';
import { streamsStandard } from './streams-standard.js';
import { streamsExt } from './streams-ext.js';
import { EXTRA_FORMS } from './extras.js';
import { makeRng } from '../qhelpers.js';

export const GENERATORS = {
  ...year7, ...year8, ...year9, ...year10, ...year11, ...year12,
  ...streamsStandard, ...streamsExt,
};

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
