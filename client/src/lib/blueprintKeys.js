// The India blueprints and their claims are engine data with an English source
// of truth in engine/indiaExams.js; these are their catalogue keys, so the page
// can show them in the student's language. i18n-coverage-check holds the English
// catalogue values equal to the engine's, so the two cannot drift.
export const BLUEPRINT_KEYS = {
  'cbse-x-standard-041-2025-26-reference': ['exams.bp.cbseXStandard', 'exams.bp.cbseXStandardNote'],
  'cbse-x-basic-241-2025-26-reference': ['exams.bp.cbseXBasic', 'exams.bp.cbseXBasicNote'],
  'cbse-xii-041-2025-26-reference': ['exams.bp.cbseXII', 'exams.bp.cbseXIINote'],
  'cbse-xi-annual-2025-26-school-pattern': ['exams.bp.cbseXI', 'exams.bp.cbseXINote'],
  'jee-main-paper1-mathematics-2026': ['exams.bp.jeeMain', 'exams.bp.jeeMainNote'],
  'jee-advanced-2026-structure': ['exams.bp.jeeAdvanced', 'exams.bp.jeeAdvancedNote'],
  'jee-advanced-paper1-mathematics-2024-reference': ['exams.bp.jeeAdvanced2024', 'exams.bp.jeeAdvanced2024Note'],
  'ioqm-2024-25-reference': ['exams.bp.ioqm', 'exams.bp.ioqmNote'],
};

/** A blueprint's name in the reader's language, or its engine label. */
export function blueprintLabel(t, id, fallback = '') {
  return BLUEPRINT_KEYS[id] ? t(BLUEPRINT_KEYS[id][0]) : fallback;
}
