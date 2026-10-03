// Pri Learning · NCERT Class 8 Chapter 1 (Rational Numbers) — syllabus layer
//
// The three product dot points and the skill routing beneath them, split out of
// class8-rational-production.js so the curriculum spine can read them without pulling
// the question generators and teaching content onto the boot path.
// class8-rational-production.js imports the routing from here and re-exports the rest
// unchanged.

export const NCERT_CLASS8_RATIONAL_DOTPOINTS = Object.freeze([
  'Define rational numbers and analyse closure under addition, subtraction, multiplication and division, including the non-zero divisor condition',
  'Use and distinguish commutativity, associativity, additive/multiplicative identities and additive/multiplicative inverses',
  'Use distributivity and structural fraction strategies, and construct rational numbers between two given rational numbers'
]);

export const NCERT_CLASS8_RATIONAL_SKILLS = Object.freeze([
  ['c8-rational-numbers-foundations', 'y8-ncert-rational-foundations', 0],
  ['c8-rational-numbers-closure', 'y8-ncert-rational-closure', 0],
  ['c8-rational-numbers-commutativity', 'y8-ncert-rational-commutativity', 1],
  ['c8-rational-numbers-associativity', 'y8-ncert-rational-associativity', 1],
  ['c8-rational-numbers-identities', 'y8-ncert-rational-identities', 1],
  ['c8-rational-numbers-distributivity', 'y8-ncert-rational-distributivity', 2],
  ['c8-rational-numbers-strategy', 'y8-ncert-rational-strategy', 2],
  ['c8-rational-numbers-between', 'y8-ncert-rational-between', 2]
]);

export const NCERT_CLASS8_RATIONAL_GENERATOR_IDS = Object.freeze(NCERT_CLASS8_RATIONAL_SKILLS.map(([id]) => id));

export const NCERT_CLASS8_RATIONAL_COVERS = Object.freeze(
  NCERT_CLASS8_RATIONAL_SKILLS.map(([gen, , dp]) => Object.freeze({ gen, dp: [dp], diff: [1, 2, 3, 4] }))
);
