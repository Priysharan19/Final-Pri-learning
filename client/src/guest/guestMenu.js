// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the question picker may offer (guest trial, ADR-0003)
//
// One pure module, one answer to "which years, courses, chapters and levels may
// this edition's picker list?", computed from the same availability helpers the
// existing pickers use and from nothing else:
//
//   Priyabhata   the bundled India syllabus: the CBSE / NCERT class, and JEE
//                Main for Classes 11-12 (JEE Advanced is Premium, so it is not
//                offered to a visitor). A level is listed only when an authored
//                form sits at it inside the track's window
//                (indiaRequestableDifficulties).
//   Prithagoras  the NSW syllabus: Years 7-12, the senior courses in 11-12. A
//                level is listed only when the server issues that cell
//                (nswIssuedLevels, the generated copy of the server's ledger).
//
// A chapter with no level, and a course with no chapter, is not listed at all:
// nothing here invents a choice the server would refuse. No I/O.
// ─────────────────────────────────────────────────────────────────────────────
import { indiaProductSections, indiaRequestableDifficulties, resolveIndiaTarget } from '../engine/indiaProduct.js';
import { CURRICULUM, PATHWAYS, STREAM_CURRICULUM, streamSubtopics } from '../engine/curriculum.js';
import { collapseList, entryIssuedLevels, resolveSide } from '../engine/curriculum.js';
import { offeredYears, pathwayOffered, defaultOffering } from '../platform/edition.js';

const YEARS = Object.freeze([7, 8, 9, 10, 11, 12]);
const FORMS = Object.freeze(['typed', 'choice', 'written']);
export const PICKER_FORMS = FORMS;

const isIndia = edition => edition === 'priyabhata';

// India: the free tracks a visitor may try.
const INDIA_TRACKS = Object.freeze([
  Object.freeze({ key: 'cbse', label: 'CBSE / NCERT', from: 7 }),
  Object.freeze({ key: 'jee-main', label: 'JEE Main', from: 11 })
]);

// NSW: the senior courses, by the stream they draw their chapters from.
const NSW_SENIOR = Object.freeze([
  Object.freeze({ key: 'advanced', label: PATHWAYS.advanced.short, stream: null }),
  Object.freeze({ key: 'standard', label: PATHWAYS.standard.short, stream: y => `standard-${y}` }),
  Object.freeze({ key: 'ext1', label: PATHWAYS.ext1.short, stream: y => `ext1-${y}` }),
  Object.freeze({ key: 'ext2', label: PATHWAYS.ext2.short, stream: y => (y === 12 ? 'ext2-12' : null), only: 12 })
]);

/**
 * The school years the picker offers: the same six in both editions, less the years an edition does not offer
 * (owner decision, 19 Nov 2026: Prithagoras offers Years 11 and 12; India's offering is none, so all six).
 */
export const guestYears = () => offeredYears(YEARS);

/** The courses (NSW) or tracks (India) available in a year: [{ key, label }]. `mathsLabel` names the single junior NSW course. */
export function coursesFor(edition, year, { mathsLabel = 'Mathematics' } = {}) {
  const y = Number(year);
  if (!guestYears().includes(y)) return [];
  // A course with no chapter that has a question is not listed (owner decision 2026-11-18).
  const offered = list => list.filter(c => chaptersFor(edition, y, c.key).length > 0);
  if (isIndia(edition)) return offered(INDIA_TRACKS.filter(t => y >= t.from).map(({ key, label }) => ({ key, label })));
  if (y <= 10) return offered([{ key: 'core', label: mathsLabel }]);
  return offered(NSW_SENIOR.filter(c => (c.only === undefined || c.only === y) && pathwayOffered(c.key)).map(({ key, label }) => ({ key, label })));
}

function indiaSection(year, courseKey) {
  const sections = indiaProductSections();
  return courseKey === 'cbse'
    ? sections.years.find(s => s.year === year && s.track === 'cbse')
    : sections.streams.find(s => s.track === courseKey && s.year === year);
}

function nswChapters(year, courseKey) {
  // One entry per topic: a `-forms` companion is listed under its base (engine/curriculum.js).
  if (courseKey === 'core' || courseKey === 'advanced') return (CURRICULUM.find(c => c.year === year)?.subtopics || []).map(s => ({ ...s, year }));
  const spec = NSW_SENIOR.find(c => c.key === courseKey);
  const stream = spec?.stream ? spec.stream(year) : null;
  return stream && STREAM_CURRICULUM[stream] ? streamSubtopics(stream) : [];
}

/**
 * The chapters of a year and course that really have questions, with the levels
 * each really has: [{ id, name, strand, levels }]. Order is the syllabus's own.
 */
export function chaptersFor(edition, year, courseKey) {
  const y = Number(year);
  if (isIndia(edition)) {
    const section = indiaSection(y, courseKey);
    if (!section) return [];
    return section.chapters
      .map(ch => ({ id: ch.id, name: ch.name, strand: ch.strand || '', levels: indiaRequestableDifficulties(ch, { track: section.track, grade: section.year }) }))
      .filter(ch => ch.levels.length > 0);
  }
  return collapseList(nswChapters(y, courseKey))
    .map(s => ({ id: s.id, name: s.name, strand: s.strand || '', levels: entryIssuedLevels(s.id) }))
    .filter(ch => ch.levels.length > 0);
}

/**
 * The request a choice becomes: { generator, difficulty, track } for the guest
 * route, or null when the choice is not one this edition offers (a stale saved
 * pick, a level the chapter lacks). `random` only breaks ties between the
 * chapter's own generators (India); it never changes what is on offer.
 */
export function guestTarget(edition, { year, course, chapter, difficulty }, random = Math.random) {
  const y = Number(year);
  const row = chaptersFor(edition, y, course).find(ch => ch.id === chapter);
  const d = Number(difficulty);
  if (!row || !row.levels.includes(d)) return null;
  // One of the generators behind a topic answers; the server still refuses any it does not issue.
  if (!isIndia(edition)) return { generator: resolveSide(row.id, { difficulty: d, seed: random() }).subtopic, difficulty: d, track: null };
  const section = indiaSection(y, course);
  const target = resolveIndiaTarget(section.chapters.find(ch => ch.id === chapter), { difficulty: d, track: section.track, grade: section.year, random });
  // A past-paper archive question is never part of the trial.
  if (!target || target.pyq || target.windowed === false || target.difficulty !== d) return null;
  return { generator: target.generator, difficulty: d, track: section.track };
}

/** A saved or defaulted choice, brought back to something this edition offers (never throws). */
export function settleChoice(edition, choice = {}, { defaultYear = 9 } = {}) {
  const years = guestYears();
  // (a year the edition does not offer falls back to its own default: Prithagoras Year 12, owner decision 19 Nov 2026)
  const year = years.includes(Number(choice.year)) ? Number(choice.year) : (years.includes(Number(defaultYear)) ? Number(defaultYear) : (defaultOffering()?.year ?? 9));
  const courses = coursesFor(edition, year);
  const course = courses.some(c => c.key === choice.course) ? choice.course : courses[0]?.key || null;
  const chapters = course ? chaptersFor(edition, year, course) : [];
  const chapter = chapters.some(c => c.id === choice.chapter) ? choice.chapter : chapters[0]?.id || null;
  const levels = chapters.find(c => c.id === chapter)?.levels || [];
  const difficulty = levels.includes(Number(choice.difficulty)) ? Number(choice.difficulty) : (levels.includes(2) ? 2 : levels[0] ?? null);
  const form = FORMS.includes(choice.form) ? choice.form : 'typed';
  return { year, course, chapter, difficulty, form };
}
