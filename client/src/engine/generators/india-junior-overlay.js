import { indiaJunior as baseIndiaJunior } from './india-junior.js';
import { NCERT_CLASS8_RATIONAL_GENERATORS } from '../ncert/class8-rational-production.js';
import { NCERT_CLASS8_LINEAR_GENERATORS } from '../ncert/class8-linear-production.js';
import { NCERT_CLASS8_3_13_GENERATORS } from '../ncert/class8-chapters-3-13-production.js';

export const indiaJunior = Object.freeze({
  ...baseIndiaJunior,
  ...NCERT_CLASS8_RATIONAL_GENERATORS,
  ...NCERT_CLASS8_LINEAR_GENERATORS,
  ...NCERT_CLASS8_3_13_GENERATORS
});
