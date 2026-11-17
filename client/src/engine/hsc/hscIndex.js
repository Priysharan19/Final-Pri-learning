// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · HSC priorities · the validated metadata, loaded once
//
// Every past-paper and sample record passes hscSchema.js at module load; a
// record that breaks the contract stops the module, so nothing downstream can
// read an untraceable or text-carrying record.
// ─────────────────────────────────────────────────────────────────────────────

import { HSC_ADVANCED_PAPERS } from './records-advanced.js';
import { HSC_EXTENSION1_PAPERS } from './records-extension1.js';
import { HSC_SAMPLE_2024 } from './sample-2024.js';
import { expandPaper } from './hscSchema.js';

/** Past HSC papers, by course, oldest first: [{ course, year, records }]. */
export const HSC_PAST_PAPERS = Object.freeze({
  advanced: Object.freeze(HSC_ADVANCED_PAPERS.map(p => Object.freeze({ course: p.course, year: p.year, source: p.source, records: expandPaper(p, 'past-paper') }))),
  extension1: Object.freeze(HSC_EXTENSION1_PAPERS.map(p => Object.freeze({ course: p.course, year: p.year, source: p.source, records: expandPaper(p, 'past-paper') })))
});

/** NESA's 2024-syllabus sample examination, by course: { course, source, records }. */
export const HSC_SAMPLE = Object.freeze(Object.fromEntries(HSC_SAMPLE_2024.map(p => [p.course, Object.freeze({ course: p.course, source: p.source, records: expandPaper(p, 'sample') })])));

/** Every record, past and sample. */
export const HSC_RECORDS = Object.freeze([
  ...Object.values(HSC_PAST_PAPERS).flatMap(papers => papers.flatMap(p => p.records)),
  ...Object.values(HSC_SAMPLE).flatMap(s => s.records)
]);

/** The years tagged for a course, oldest first. */
export function hscYearsOf(course) {
  return (HSC_PAST_PAPERS[course] || []).map(p => p.year);
}
