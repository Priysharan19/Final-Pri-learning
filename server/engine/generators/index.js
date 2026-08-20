// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Generator re-export — client registry + server-only extras.
// The generators have ONE source of truth: client/src/engine/generators/. This
// file holds no second copy of any generator; it layers the server's extras
// over the client's registry.
//
// Two server-side facts need the small amount of code below.
//
// Banks load lazily on the client — one dynamic chunk per year/stream, so
// `GENERATORS` starts empty and fills as a student navigates. Server-side
// callers are synchronous and may reach any year at any moment, so all eight
// banks are awaited once here, at import time. Without that,
// `Object.keys(GENERATORS)` is [] and the self-check silently measures nothing.
//
// extras.js holds 84 further authored forms that ship on the server side alone.
// They are layered into a SEPARATE registry object rather than written back
// into the client's. Wrapping the client's own registry in place would mean
// that merely importing this module changed what the client produces for a
// given seed — the same seed would stop reproducing the same question, which
// is the one property the whole self-check rests on.
// ─────────────────────────────────────────────────────────────────────────────
export * from '../../../client/src/engine/generators/index.js';

import { GENERATORS as CLIENT_GENERATORS, bankOf, loadAllBanks } from '../../../client/src/engine/generators/index.js';
import { makeRng } from '../qhelpers.js';
import { EXTRA_FORMS } from './extras.js';

await loadAllBanks();

/** The client's generators with the extras layered on — a distinct object, so
 *  the client's own registry is never touched. */
export const GENERATORS = {};

for (const [subtopicId, base] of Object.entries(CLIENT_GENERATORS)) {
  const byDifficulty = EXTRA_FORMS[subtopicId];
  if (!byDifficulty) {
    GENERATORS[subtopicId] = base;
    continue;
  }
  // The seeded rng's first draw chooses between the base generator and one of
  // that difficulty's extras, so a seed still reproduces its question forever.
  GENERATORS[subtopicId] = (rng, d) => {
    const extras = byDifficulty[d] || [];
    const pick = extras.length ? Math.floor(rng() * (1 + extras.length)) : 0;
    return pick === 0 ? base(rng, d) : extras[pick - 1](rng);
  };
}

/**
 * Same contract as the client's generateQuestion, reading the registry above.
 * Kept here rather than delegating because the client's closes over its own
 * registry, and redirecting it would mean mutating it.
 */
export function generateQuestion(subtopicId, difficulty, seed) {
  const gen = GENERATORS[subtopicId];
  if (!gen) {
    const bank = bankOf(subtopicId);
    if (bank) throw Object.assign(new Error(`Question bank "${bank}" is not loaded`), { bankMissing: true, bank, subtopic: subtopicId });
    throw new Error(`No generator for subtopic ${subtopicId}`);
  }
  const s = seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(s);
  const d = Math.min(4, Math.max(1, difficulty | 0));
  return { seed: s, subtopic: subtopicId, difficulty: d, ...gen(rng, d) };
}

/** Number of authored forms behind a (subtopic, difficulty) cell: the base
 *  generator counts as one; extras add more. */
export function formCount(subtopicId, d) {
  return 1 + (EXTRA_FORMS[subtopicId]?.[d]?.length || 0);
}
