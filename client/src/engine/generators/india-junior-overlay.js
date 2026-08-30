import { indiaJunior as baseIndiaJunior } from './india-junior-base.js';
import { NCERT_CLASS8_RATIONAL_GENERATORS } from '../ncert/class8-rational-production.js';

export const indiaJunior = Object.freeze({
  ...baseIndiaJunior,
  ...NCERT_CLASS8_RATIONAL_GENERATORS
});
