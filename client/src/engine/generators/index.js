// Registry of all question generators, keyed by subtopic id.
import { year7 } from './year7.js';
import { year8 } from './year8.js';
import { year9 } from './year9.js';
import { year10 } from './year10.js';
import { year11 } from './year11.js';
import { year12 } from './year12.js';
import { streamsStandard } from './streams-standard.js';
import { streamsExt } from './streams-ext.js';
import { makeRng } from '../qhelpers.js';

export const GENERATORS = {
  ...year7, ...year8, ...year9, ...year10, ...year11, ...year12,
  ...streamsStandard, ...streamsExt,
};

/**
 * Generate a question for a subtopic at a difficulty (1–4).
 * Returns { seed, subtopic, difficulty, ...payload }.
 */
export function generateQuestion(subtopicId, difficulty, seed) {
  const gen = GENERATORS[subtopicId];
  if (!gen) throw new Error(`No generator for subtopic ${subtopicId}`);
  const s = seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(s);
  const d = Math.min(4, Math.max(1, difficulty | 0));
  const payload = gen(rng, d);
  return { seed: s, subtopic: subtopicId, difficulty: d, ...payload };
}
