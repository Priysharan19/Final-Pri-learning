// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Generator re-export — client registry + server-only extras.
// The generators have ONE source of truth: client/src/engine/generators/. This
// file holds no second `generateQuestion`; it re-exports the client's, so the
// two modules hand back the same function object.
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
// They are layered onto the registry rather than into a forked generator: each
// subtopic's entry is wrapped so the seeded rng's first draw chooses between the
// base generator and one of that difficulty's extras. The client's
// `generateQuestion` then runs unchanged, and every seed still reproduces the
// same question forever.
// ─────────────────────────────────────────────────────────────────────────────
export * from '../../../client/src/engine/generators/index.js';

import { GENERATORS, loadAllBanks } from '../../../client/src/engine/generators/index.js';
import { EXTRA_FORMS } from './extras.js';

await loadAllBanks();

for (const [subtopicId, base] of Object.entries(GENERATORS)) {
  const byDifficulty = EXTRA_FORMS[subtopicId];
  if (!byDifficulty) continue;
  GENERATORS[subtopicId] = (rng, d) => {
    const extras = byDifficulty[d] || [];
    const pick = extras.length ? Math.floor(rng() * (1 + extras.length)) : 0;
    return pick === 0 ? base(rng, d) : extras[pick - 1](rng);
  };
}

/** Number of authored forms behind a (subtopic, difficulty) cell: the base
 *  generator counts as one; extras add more. */
export function formCount(subtopicId, d) {
  return 1 + (EXTRA_FORMS[subtopicId]?.[d]?.length || 0);
}
