// Pri Learning · what NSW practice may be OFFERED (Prithagoras)
//
// The earliest contract: the device offers only what the server can issue. A
// Prithagoras server issues a (generator, difficulty) cell only when it passed
// every gate (server/platform/nswBanks.js); a cell it does not issue cannot be
// marked, so offering it hands the student a question nothing will ever check.
// Everything the device shows or asks for on the NSW course goes through these
// helpers: the levels a selector lists, the dot points marked `generated`, the
// subtopics smart practice may pick, and the cell a request finally names.
//
// NSW_ISSUED_CELLS is a generated copy of the server's ledger, held equal to
// it by server/test/nsw-offer-check.mjs. Pure: no I/O.
import { NSW_ISSUED_CELLS } from './nswIssuedCells.js';

const NONE = Object.freeze([]);

/** The difficulties the server issues for a generator, ascending; [] when none. */
export function nswIssuedLevels(generator) {
  return typeof generator === 'string' && Object.hasOwn(NSW_ISSUED_CELLS, generator) ? NSW_ISSUED_CELLS[generator] : NONE;
}

/** Is this (generator, difficulty) cell one the server issues? */
export function nswCellIssued(generator, difficulty) {
  return nswIssuedLevels(generator).includes(Number(difficulty));
}

/** The levels of a dot point (curriculum.js `forms`) the server issues. */
export function nswIssuedForms(generator, forms) {
  const issued = nswIssuedLevels(generator);
  return (Array.isArray(forms) ? forms : []).filter(d => issued.includes(d));
}

/** The nearest of `levels` to `want` (ties go to the easier), or null when there is none. */
export function nearestLevel(levels, want) {
  if (!levels.length) return null;
  const d = Math.min(4, Math.max(1, Number(want) || 1));
  return levels.reduce((best, f) => {
    const gap = Math.abs(f - d), bestGap = Math.abs(best - d);
    return gap < bestGap || (gap === bestGap && f < best) ? f : best;
  });
}

/**
 * The cell an NSW request may name: the difficulty asked for when it is
 * issued, otherwise the nearest issued one — within the dot point's own issued
 * levels when a dot point is asked for and has any, else across the
 * generator's (the dot point is then dropped: no issued form exercises it).
 * Null when the server issues nothing from this generator.
 *
 * @param {{ generator: string, difficulty: number, dotpoint?: string|null, dotpointForms?: number[]|null }} ask
 * @returns {{ difficulty: number, dotpoint: string|null, moved: boolean }|null}
 */
export function nswOfferedCell({ generator, difficulty, dotpoint = null, dotpointForms = null }) {
  const all = nswIssuedLevels(generator);
  if (!all.length) return null;
  const own = dotpoint ? nswIssuedForms(generator, dotpointForms) : NONE;
  const levels = own.length ? own : all;
  const d = nearestLevel(levels, difficulty);
  return { difficulty: d, dotpoint: own.length ? dotpoint : null, moved: d !== Number(difficulty) || (!!dotpoint && !own.length) };
}
