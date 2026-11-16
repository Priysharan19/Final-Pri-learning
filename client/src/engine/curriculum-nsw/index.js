// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NSW curriculum model (Prithagoras)
//
// Versioned NSW syllabus objects (plan mission G2, ADR-0002 decision 7) beside
// the legacy `nsw` course in curriculum.js, which this model does not change.
// Pure data and pure functions: the model modules import nothing outside this
// directory (legacyGenerators.js, used only by the coverage script, loads the
// legacy generator modules for their ids), do no I/O, and
// nothing here is served to a student yet (serving NSW questions is G3).
// ─────────────────────────────────────────────────────────────────────────────

import { NSW_MATHEMATICS_K10_2022 } from './k10-2022.js';
import { NSW_MATHEMATICS_STANDARD_2024 } from './standard-2024.js';
import { NSW_MATHEMATICS_ADVANCED_2024 } from './advanced-2024.js';
import { NSW_MATHEMATICS_EXTENSION1_2024 } from './extension1-2024.js';
import { NSW_MATHEMATICS_EXTENSION2_2024 } from './extension2-2024.js';
import {
  NSW_MATHEMATICS_ADVANCED_2017,
  NSW_MATHEMATICS_EXTENSION1_2017,
  NSW_MATHEMATICS_EXTENSION2_2017,
  NSW_MATHEMATICS_STANDARD_2017
} from './stage6-2017.js';
import { LEGACY_CROSSWALK, NEW_OUTCOME_GAPS, NSW_CROSSWALK, CROSSWALK_STATUSES, CROSSWALK_PLACEMENTS } from './crosswalk.js';

export {
  NSW_MATHEMATICS_K10_2022,
  NSW_MATHEMATICS_STANDARD_2024,
  NSW_MATHEMATICS_ADVANCED_2024,
  NSW_MATHEMATICS_EXTENSION1_2024,
  NSW_MATHEMATICS_EXTENSION2_2024,
  NSW_MATHEMATICS_ADVANCED_2017,
  NSW_MATHEMATICS_EXTENSION1_2017,
  NSW_MATHEMATICS_EXTENSION2_2017,
  NSW_MATHEMATICS_STANDARD_2017,
  LEGACY_CROSSWALK,
  NEW_OUTCOME_GAPS,
  NSW_CROSSWALK,
  CROSSWALK_STATUSES,
  CROSSWALK_PLACEMENTS
};

/** The syllabuses current NSW students are taught, Years 7–12 (13 Nov 2026). */
export const NSW_CURRENT_SYLLABUSES = Object.freeze([
  NSW_MATHEMATICS_K10_2022,
  NSW_MATHEMATICS_STANDARD_2024,
  NSW_MATHEMATICS_ADVANCED_2024,
  NSW_MATHEMATICS_EXTENSION1_2024,
  NSW_MATHEMATICS_EXTENSION2_2024
]);

/** Superseded syllabuses kept only so legacy codes keep their provenance. */
export const NSW_SUPERSEDED_SYLLABUSES = Object.freeze([
  NSW_MATHEMATICS_STANDARD_2017,
  NSW_MATHEMATICS_ADVANCED_2017,
  NSW_MATHEMATICS_EXTENSION1_2017,
  NSW_MATHEMATICS_EXTENSION2_2017
]);

export const NSW_SYLLABUSES = Object.freeze([...NSW_CURRENT_SYLLABUSES, ...NSW_SUPERSEDED_SYLLABUSES]);

export const NSW_SYLLABUS_BY_ID = Object.freeze(Object.fromEntries(NSW_SYLLABUSES.map(s => [s.id, s])));

/**
 * One record per outcome code of a current syllabus, with the focus area that
 * carries it. A code in two focus areas (none today) would yield two records.
 */
export function outcomesOf(syllabus) {
  return (syllabus?.focusAreas || []).flatMap(fa => fa.outcomes.map(code => Object.freeze({
    code,
    syllabus: syllabus.id,
    focusArea: fa.name,
    ...(fa.stage !== undefined ? { stage: fa.stage, kind: fa.kind, pathLabels: fa.pathLabels } : {}),
    ...(fa.year !== undefined ? { year: fa.year } : {}),
    ...(fa.course !== undefined ? { course: fa.course } : {})
  })));
}

/** Current outcome code → its record. Codes are unique across NSW syllabuses (checked). */
export const NSW_OUTCOME_BY_CODE = Object.freeze(Object.fromEntries(
  NSW_CURRENT_SYLLABUSES.flatMap(outcomesOf).map(o => [o.code, o])
));

/** Superseded 2017 topic code → { syllabus, name }. */
export const NSW_HISTORICAL_TOPIC_BY_CODE = Object.freeze(Object.fromEntries(
  NSW_SUPERSEDED_SYLLABUSES.flatMap(s => s.topics.map(t => [t.code, Object.freeze({ syllabus: s.id, name: t.name })]))
));

/** K–10 (2022) assigns outcomes to Stages: Years 7–8 are Stage 4 and Years 9–10 Stage 5. */
export const stageOfYear = year => (year <= 8 ? 4 : year <= 10 ? 5 : 6);

/**
 * Splits a legacy curriculum.js `code` label into 2017 topic codes:
 * "MA-T3/C2" → ["MA-T3", "MA-C2"]; "MS-N2/N3" → ["MS-N2", "MS-N3"].
 * Years 7–10 labels ("MA4 · Number") are not codes and give [].
 */
export function legacyTopicCodes(label) {
  const text = String(label || '').trim();
  const m = /^([A-Z]+)-([A-Z]\d)((?:\/[A-Z]\d)*)$/.exec(text);
  if (!m) return [];
  const [, prefix, first, rest] = m;
  return [first, ...rest.split('/').filter(Boolean)].map(part => `${prefix}-${part}`);
}

/** Status a legacy row must carry, from its dot points alone. */
export function derivedStatus(row) {
  const found = row.dotpoints.filter(codes => codes.length > 0).length;
  if (found === row.dotpoints.length) return 'mapped';
  return found === 0 ? 'retired' : 'partial';
}

/** Whether an outcome sits in the course and Stage/Year Pri labels the subtopic with. */
export function asLabelled(outcome, row, labelledYear) {
  if (!outcome || outcome.syllabus !== row.syllabus) return false;
  if (outcome.stage !== undefined) return outcome.stage === stageOfYear(labelledYear);
  return outcome.year === labelledYear;
}

/** Placement a legacy row must carry, given the Year Pri labels its subtopic with. */
export function derivedPlacement(row, labelledYear) {
  const codes = row.dotpoints.flat();
  const labelled = codes.filter(code => asLabelled(NSW_OUTCOME_BY_CODE[code], row, labelledYear)).length;
  if (labelled === codes.length) return 'as-labelled';
  const anyDotpointLabelled = row.dotpoints.some(dp => dp.some(code => asLabelled(NSW_OUTCOME_BY_CODE[code], row, labelledYear)));
  return anyDotpointLabelled ? 'elsewhere-in-part' : 'elsewhere';
}
