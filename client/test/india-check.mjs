// Run the established India curriculum suite first, then the source-level NCERT
// Rational Numbers audit. Keeping the existing npm test:india entry point means
// CI cannot accidentally validate the curriculum without validating this bank.
await import('./india-check-base.mjs');
await import('./ncert-rational-numbers-check.mjs');
