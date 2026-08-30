// Keep the established Year 8 bank intact and add the source-audited NCERT
// Rational Numbers forms. y8-* ids intentionally live in this bank so the
// existing lazy bank resolver needs no special-case routing.
import { year8 as baseYear8 } from './year8-base.js';
import { NCERT_CLASS8_RATIONAL_GENERATORS } from '../ncert/class8-rational-numbers.js';

export const year8 = {
  ...baseYear8,
  ...NCERT_CLASS8_RATIONAL_GENERATORS
};
