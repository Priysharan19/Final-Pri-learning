// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT Class 11 — JEE D4 forms for the single-template chapters
//
// Five Class 11 chapters reached the JEE tracks' hardest level (D4) for all
// three of their dot points through ONE whole-chapter generator, whose D4 rung
// is a single routine template about one dot point at most: "how many proper
// subsets", "how many integers satisfy |ax + b| < c", "the term independent of
// x", "the eccentricity of x²/a² − y²/b² = 1", "the x-coordinate of a
// centroid". That is the pattern issue #408 found in Complex Numbers. Each
// module below writes one original D4 form per dot point; the coverage table
// (curriculum-in-hardest-covers.js) claims each at D4 only, at its own dot
// point, and retires the whole-chapter generator's D4 rung there.
//
// Provenance: original, parameterised, every key computed from the drawn
// parameters, each re-derived from its rendered prompt by an independent solver
// (client/test/support/india-jee-d4-*-solvers.mjs). No human maths review yet;
// no board or examiner approval is claimed.
// ─────────────────────────────────────────────────────────────────────────────
import { forms as sets } from './india-class11-jee-d4-sets.js';
import { forms as inequalities } from './india-class11-jee-d4-inequalities.js';
import { forms as binomial } from './india-class11-jee-d4-binomial.js';
import { forms as conics } from './india-class11-jee-d4-conics.js';
import { forms as space } from './india-class11-jee-d4-3d.js';

export const class11JeeD4Forms = Object.freeze({ ...sets, ...inequalities, ...binomial, ...conics, ...space });
