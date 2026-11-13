// Pri Learning — which NSW HSC-style papers a Prithagoras server may set
// (plan mission G4). The blueprints are the engine's (client/src/engine/
// nswExams.js); this file supplies the one thing the engine cannot know: the
// pool of APPROVED QUESTION FORMS this server issues, and so which blueprints
// are released.
//
// THE POOL. One entry per (generator, difficulty) cell the Prithagoras edition
// issues (nswBanks.js NSW_BANK_LEDGER: crosswalk-mapped, a dot point behind the
// form, a final answer, through the quality gate) — and no other. Each entry
// carries the outcome codes every question of that form is sealed with: the
// codes the crosswalk locates the form's dot point(s) at (nswQuestionIdentity
// gives a question exactly these; server/test/nsw-exam-check.mjs samples
// that). An India bank, an excluded cell, a partial or retired row, or a form
// with no dot point is never in it.
//
// THE SWITCH. PRI_NSW_EXAMS=on, on a server whose edition issues the NSW banks
// (PRI_EDITION=prithagoras). Off — the default — the routes answer 404 and a
// create naming kind 'nsw' is refused as before. Nothing here changes what a
// Priyabhata server does.
//
// A TEST BLUEPRINT. A suite or a browser tour that must sit a released paper
// end to end, while G3's pool may release no HSC-style blueprint, switches on
// NSW_TEST_BLUEPRINT with `useNswTestBlueprintForTests(true)` (in-process;
// refused unless NODE_ENV is 'test') or PRI_NSW_EXAMS_TEST_BLUEPRINT=on under
// NODE_ENV=test (a server process a tour starts). It is a short paper on two
// Extension 1 outcomes G3's pool does cover, drawn and marked by exactly the
// path every blueprint uses, through the same release check; it cites no NESA
// specification, says `test: true` everywhere, and is never listed or
// created outside a test.
import { NSW_BANK_LEDGER, nswCell } from './nswBanks.js';
import { LEGACY_CROSSWALK, NSW_OUTCOME_BY_CODE } from '../../client/src/engine/curriculum-nsw/index.js';
import { formDotpointOrdinals } from '../../client/src/engine/curriculum.js';
import {
  NSW_EXAM_BLUEPRINTS, blueprintRelease, nswExamBlueprint, outcomesOf, tallyOf,
  NSW_EXAM_LABEL, NSW_MARKING_NOTE, NSW_MIN_FORMS_PER_SLOT, DIFFICULTIES_FOR_MARKS
} from '../../client/src/engine/nswExams.js';
import { bankPolicy } from './editionBanks.js';
import { NSW_COURSE } from './nswBanks.js';

const ROW_BY_GENERATOR = new Map(LEGACY_CROSSWALK.map(row => [row.subtopicId, row]));

/** The outcome codes every question of an issued form is sealed with. */
export function formOutcomes(generator, difficulty) {
  const row = ROW_BY_GENERATOR.get(generator);
  if (!row || !nswCell(generator, difficulty)) return [];
  return [...new Set(formDotpointOrdinals(generator, difficulty).flatMap(i => row.dotpoints[i] || []))]
    .filter(code => Object.hasOwn(NSW_OUTCOME_BY_CODE, code));
}

/** G3's pool: every issued NSW cell with its outcomes. Static for a build. */
export const NSW_EXAM_POOL = Object.freeze(NSW_BANK_LEDGER.flatMap(entry => entry.cells
  .filter(cell => cell.issued)
  .map(cell => Object.freeze({ generator: entry.generator, difficulty: cell.difficulty, outcomes: Object.freeze(formOutcomes(entry.generator, cell.difficulty)) }))
  .filter(form => form.outcomes.length > 0)));

/** A short paper on outcomes G3's pool covers. Tests only (see the header). */
export const NSW_TEST_BLUEPRINT = Object.freeze({
  id: 'nsw-test-extension-1-short', course: 'extension-1', label: 'Mathematics Extension 1 (test paper)', year: 12,
  syllabus: 'nsw-mathematics-extension1-11-12-2024', syllabusVersion: '2024', firstExamined: 2027,
  readingMin: 1, workingMin: 10, totalMarks: 8, test: true,
  spec: Object.freeze({ sectionIMarks: 2, sectionIIMarks: 6, sectionIIItems: [3, 3] }),
  source: Object.freeze({ authority: 'none', document: 'Test paper: no examination specification', url: null, accessed: null, test: true }),
  sections: Object.freeze([
    Object.freeze({ id: 'I', label: 'Section I', marksEach: 1, slots: Object.freeze([
      Object.freeze({ section: 'I', outcome: 'ME1-12-02', marks: 1, difficulties: DIFFICULTIES_FOR_MARKS[1] }),
      Object.freeze({ section: 'I', outcome: 'ME1-11-02', marks: 1, difficulties: DIFFICULTIES_FOR_MARKS[1] })
    ]) }),
    Object.freeze({ id: 'II', label: 'Section II', slots: Object.freeze([
      Object.freeze({ section: 'II', outcome: 'ME1-12-02', marks: 2, difficulties: DIFFICULTIES_FOR_MARKS[2] }),
      Object.freeze({ section: 'II', outcome: 'ME1-12-02', marks: 2, difficulties: DIFFICULTIES_FOR_MARKS[2] }),
      Object.freeze({ section: 'II', outcome: 'ME1-11-02', marks: 2, difficulties: DIFFICULTIES_FOR_MARKS[2] })
    ]) })
  ])
});

let testBlueprintOn = false;

/** Tests only: list and allow NSW_TEST_BLUEPRINT (see the header). */
export function useNswTestBlueprintForTests(on) {
  if (process.env.NODE_ENV !== 'test') {
    throw Object.assign(new Error('The NSW test paper is never offered outside a test.'), { code: 'NSW_EXAMS_CONFIG_INVALID' });
  }
  testBlueprintOn = on === true;
}
const testBlueprint = (env = process.env) => (testBlueprintOn
  || (env.NODE_ENV === 'test' && String(env.PRI_NSW_EXAMS_TEST_BLUEPRINT || '').toLowerCase() === 'on')) ? NSW_TEST_BLUEPRINT : null;

/** The pool of approved forms: G3's, and nothing else, in every process. */
export const nswExamPool = () => NSW_EXAM_POOL;

/** The blueprints this process may list: the five, and the test paper only in a test that asked. */
export function nswBlueprints(env = process.env) {
  const extra = testBlueprint(env);
  return extra ? [...NSW_EXAM_BLUEPRINTS, extra] : NSW_EXAM_BLUEPRINTS;
}

/** Is the NSW paper kind switched on for this server? */
export function nswExamsOn(env = process.env) {
  return String(env.PRI_NSW_EXAMS || '').trim().toLowerCase() === 'on' && bankPolicy().curriculum === NSW_COURSE;
}

/** The release of every blueprint on the pool in force. */
export function nswReleases(pool = nswExamPool()) {
  return nswBlueprints().map(b => blueprintRelease(b, pool));
}

/** One blueprint's release on the pool in force, or null for an unknown id. */
export function nswRelease(id, pool = nswExamPool()) {
  const b = nswExamBlueprint(id) || (testBlueprint()?.id === id ? NSW_TEST_BLUEPRINT : null);
  return b ? { blueprint: b, release: blueprintRelease(b, pool) } : null;
}

/**
 * What the device lists (GET /v1/exams/nsw): every blueprint, released or
 * not, with what it covers and — for one that is not released — which
 * outcomes have no approved forms or too few. Codes and Pri's own labels only:
 * no NESA wording, no question, no answer.
 */
export function nswExamCatalogue(pool = nswExamPool()) {
  return {
    label: NSW_EXAM_LABEL, marking: 'final-answer-only', markingNote: NSW_MARKING_NOTE,
    minFormsPerSlot: NSW_MIN_FORMS_PER_SLOT,
    papers: nswBlueprints().map(b => {
      const release = blueprintRelease(b, pool);
      const tally = tallyOf(b);
      return {
        id: b.id, ...(b.test ? { test: true } : {}), course: b.course, label: b.label, year: b.year, syllabus: b.syllabus, syllabusVersion: b.syllabusVersion,
        readingMin: b.readingMin, workingMin: b.workingMin, totalMarks: tally.totalMarks, questions: tally.items,
        sections: b.sections.map(s => ({ id: s.id, label: s.label, questions: s.slots.length, marks: s.slots.reduce((n, slot) => n + slot.marks, 0) })),
        source: { authority: b.source.authority, document: b.source.document, url: b.source.url, accessed: b.source.accessed },
        outcomes: outcomesOf(b),
        released: release.released,
        missingOutcomes: release.missingOutcomes, thinOutcomes: release.thinOutcomes,
        unfillableSlots: release.unfillable.length
      };
    })
  };
}
