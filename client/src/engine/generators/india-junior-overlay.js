import { NCERT_CLASS7_2026_27_GENERATORS } from '../ncert/class7-2026-27-production.js';
import { NCERT_CLASS7_PART2_2026_27_GENERATORS } from '../ncert/class7-part2-2026-27-production.js';
import { indiaJunior as baseIndiaJunior } from './india-junior.js';
import { NCERT_CLASS8_RATIONAL_GENERATORS } from '../ncert/class8-rational-production.js';
import { NCERT_CLASS8_LINEAR_GENERATORS } from '../ncert/class8-linear-production.js';
import { NCERT_CLASS8_3_13_GENERATORS } from '../ncert/class8-chapters-3-13-production.js';
import { NCERT_CLASS9_GENERATORS } from '../ncert/class9-chapters-production.js';

export const indiaJunior = Object.freeze({
  ...NCERT_CLASS7_2026_27_GENERATORS,
  ...NCERT_CLASS7_PART2_2026_27_GENERATORS,
  ...baseIndiaJunior,
  ...NCERT_CLASS8_RATIONAL_GENERATORS,
  ...NCERT_CLASS8_LINEAR_GENERATORS,
  ...NCERT_CLASS8_3_13_GENERATORS,
  ...NCERT_CLASS9_GENERATORS
});
