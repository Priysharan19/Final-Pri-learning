// The difficulty as a student reads it. Owner walk-through, 19 Nov 2026 (Prithagoras): the words
// (Foundation, Intermediate, Advanced, Extension), never the D1 to D4 codes. An edition without the
// walk-through fixes keeps the codes exactly as they were.
import { walkthroughFixes } from '../platform/edition.js';

/** "Foundation" for level 1, or the code "D1" where the codes stay. */
export const difficultyLabel = (d, t) => (walkthroughFixes() ? t(`difficulty.${d}`) : `D${d}`);
/** "Foundation", or "D1 · Foundation" where the codes stay. */
export const difficultyPair = (d, t) => (walkthroughFixes() ? t(`difficulty.${d}`) : `D${d} · ${t(`difficulty.${d}`)}`);
