// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · tests that name a question by (skill, difficulty, seed)
//
// Many suites pin a question by its seed and assert what the marker does with
// it. They were written against each skill's direct form. The extra structural
// forms (generators/forms/, the Priyabhata capacity work) and the Prithagoras
// capacity overlays (au-forms-apply.js) draw other shapes of question from the
// same seeds, so a pinned seed can land on a different form. A suite that pins
// seeds imports `generateQuestion` from here to get the direct form; every
// other form is marked by the sweeps over all issued questions (false-positive,
// correct-answer, decimal, precision), which use the real generator.
// ─────────────────────────────────────────────────────────────────────────────
import * as generators from '../../src/engine/generators/index.js';

export const { GENERATORS, EXTRA_FORMS, loadAllBanks, directFormsOnly } = generators;
directFormsOnly(true);

/** The direct form of the skill's question at this seed. */
export const generateQuestion = generators.generateQuestion;
