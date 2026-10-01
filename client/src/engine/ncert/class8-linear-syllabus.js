// Pri Learning · NCERT Class 8 Chapter 2 (Linear Equations in One Variable) — syllabus layer
//
// The three product dot points and the skill routing beneath them, split out of
// class8-linear-production.js so the curriculum spine can read them without pulling
// the question generators and teaching content onto the boot path.
// class8-linear-production.js imports the routing from here and re-exports the rest
// unchanged.

export const NCERT_CLASS8_LINEAR_DOTPOINTS = Object.freeze([
  'Identify linear equations in one variable and solve equations with the variable on both sides using balanced operations and equivalent transposition',
  'Reduce and solve equations involving fractions, brackets and decimal coefficients by clearing denominators, expanding and combining like terms',
  'Check solutions by substitution, diagnose common algebra errors and master the complete NCERT Exercise 2.1 and 2.2 equation styles'
]);

export const NCERT_CLASS8_LINEAR_SKILLS = Object.freeze([
  ['c8-linear-equations-foundations', 'y8-ncert-linear-foundations', 0],
  ['c8-linear-equations-both-sides', 'y8-ncert-linear-both-sides', 0],
  ['c8-linear-equations-fractions', 'y8-ncert-linear-fractions', 1],
  ['c8-linear-equations-brackets', 'y8-ncert-linear-brackets', 1],
  ['c8-linear-equations-decimals', 'y8-ncert-linear-decimals', 1],
  ['c8-linear-equations-verification', 'y8-ncert-linear-verification', 2],
  ['c8-linear-equations-source-mastery', 'y8-ncert-linear-source-mastery', 2]
]);

export const NCERT_CLASS8_LINEAR_GENERATOR_IDS = Object.freeze(NCERT_CLASS8_LINEAR_SKILLS.map(([id]) => id));
export const NCERT_CLASS8_LINEAR_COVERS = Object.freeze(
  NCERT_CLASS8_LINEAR_SKILLS.map(([gen, , dp]) => Object.freeze({ gen, dp: [dp], diff: [1, 2, 3, 4] }))
);
