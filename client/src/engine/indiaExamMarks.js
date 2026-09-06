// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what an Indian chapter is actually worth in the real paper
//
// The India spine used to give every chapter a hand-written `weight` in the
// 9–14 band. That band is the NSW convention — nine subtopics a year, summing
// to 100 — and it was carried across to a curriculum it does not describe. The
// numbers were nobody's measurement: Class X's fourteen chapters summed to 148
// and Class XII's thirteen to 138, while the paper both classes actually sit is
// 80 marks. The ranker multiplied mastery by those numbers and then told the
// student "high exam weight", which was a claim about an examination made from
// a number no examination board had ever published.
//
// The real numbers were already in the repo and unused. `indiaExams.js` carries
// the published CBSE unit weightage — Algebra 20 marks over four named Class X
// chapters, Geometry 15 over two, and so on to exactly 80 — read from the
// course-structure documents cited there. This module turns that unit weightage
// into a per-chapter figure and hands it to the curriculum.
//
// ── Why marks are split evenly inside a unit ────────────────────────────────
// CBSE publishes weightage per *unit*, not per chapter: "Algebra — 20 marks"
// over Polynomials, Pair of Linear Equations, Quadratic Equations and
// Arithmetic Progressions. There is no published split inside a unit, so the
// only honest split is the even one: 5 marks each. Any other division would be
// the same sin this module exists to undo — an invented number wearing an
// examination board's name. A chapter's share is therefore
// `unit.marks / unit.chapters.length`, and the fact that it is a derived even
// split is recorded on the chapter (`examUnitChapters`) so a surface can say so
// rather than implying the board printed 5.
//
// ── Why it is derived here and not copied into the curriculum ───────────────
// The blueprint is the source of truth for the paper. If someone corrects a
// unit's marks in `indiaExams.js` — a new course structure, a re-read of the
// PDF — the curriculum has to move with it or the two quietly disagree and the
// app starts recommending against a paper that no longer exists. Nothing here
// is written down twice: the numbers are computed from the blueprint objects at
// module load, and `india-exam-weight-check.mjs` fails the build if a class's
// chapter marks stop summing to its paper's total.
//
// ── Chapters with no published paper ────────────────────────────────────────
// CBSE publishes unit weightage for Classes X, XI and XII only. Classes VII–IX
// have no board paper in this product's scope, and neither the NTA (JEE) nor
// the IOQM organisers publish a per-chapter weightage at all — a JEE Main
// mathematics section is 25 questions drawn from the whole Class 11–12
// syllabus, and IOQM is 30 questions across every olympiad topic. For those,
// inventing a share would be the original bug with a new coat of paint. They
// keep the authored editorial emphasis they already carried, marked
// `examSource: 'authored-emphasis'`, and nothing built on top of them is
// allowed to describe that number as an examination weight.
//
// JEE tracks are the interesting case, because their chapters are the Class 11
// and Class 12 chapters and those *do* carry board marks. Those marks are used:
// they are the only published statement of how much of this syllabus each
// chapter is, and the mark predictor already reads them. What is not claimed is
// that they are JEE's weightage — the ranker's "high exam weight" line is a
// statement about a chapter's share of the student's own scope, not a promise
// about how many JEE questions it will attract.
// ─────────────────────────────────────────────────────────────────────────────
import {
  CBSE_CLASS10_STANDARD_REFERENCE,
  CBSE_CLASS11_ANNUAL_PATTERN,
  CBSE_CLASS12_STANDARD_REFERENCE
} from './indiaExams.js';

/**
 * The blueprints a chapter's marks may be read from.
 *
 * Class X Basic (241) is deliberately absent: it shares `CBSE_CLASS10_UNITS`
 * with Standard, so it is the same weightage under a second name and listing it
 * would only give one chapter two identical sources to disagree about later.
 */
export const INDIA_EXAM_MARK_BLUEPRINTS = Object.freeze([
  CBSE_CLASS10_STANDARD_REFERENCE,
  CBSE_CLASS11_ANNUAL_PATTERN,
  CBSE_CLASS12_STANDARD_REFERENCE
]);

/** A chapter that no published paper weighs. Not a zero — an absence. */
export const AUTHORED_EMPHASIS = Object.freeze({
  examMarks: null,
  examTotalMarks: null,
  examUnit: null,
  examUnitName: null,
  examUnitMarks: null,
  examUnitChapters: null,
  examBlueprint: null,
  examSource: 'authored-emphasis'
});

function buildIndex() {
  const byChapter = new Map();
  for (const blueprint of INDIA_EXAM_MARK_BLUEPRINTS) {
    for (const unit of blueprint.units || []) {
      const chapters = unit.chapters || [];
      if (!chapters.length) continue;
      const marks = Number(unit.marks) / chapters.length;
      for (const chapterId of chapters) {
        // A chapter in two blueprints would mean two papers claiming the same
        // ground, which `examBlueprintInvariant` already forbids inside one
        // blueprint. Across blueprints it would be a silent overwrite, so it is
        // a load-time failure instead.
        if (byChapter.has(chapterId)) {
          throw new Error(`India exam marks: ${chapterId} is claimed by two blueprints (${byChapter.get(chapterId).examBlueprint} and ${blueprint.id})`);
        }
        byChapter.set(chapterId, Object.freeze({
          examMarks: marks,
          examTotalMarks: Number(blueprint.totalMarks),
          examUnit: unit.id,
          examUnitName: unit.name,
          examUnitMarks: Number(unit.marks),
          examUnitChapters: chapters.length,
          examBlueprint: blueprint.id,
          examSource: 'cbse-blueprint'
        }));
      }
    }
  }
  return byChapter;
}

/** chapterId → the marks it carries in its paper, or absent when none does. */
export const INDIA_CHAPTER_EXAM_MARKS = buildIndex();

/** The published marks for one chapter id, or null when no paper weighs it. */
export function indiaExamMarksFor(chapterId) {
  return INDIA_CHAPTER_EXAM_MARKS.get(String(chapterId || '')) || null;
}

/**
 * The exam fields a chapter carries, and the `weight` the ranker is handed.
 *
 * `weight` is the field every existing consumer already reads, so it is where
 * the truth has to land: for a chapter in a published paper it is that paper's
 * marks — Triangles is 7.5 because Geometry is 15 marks over two chapters —
 * and for a chapter no paper weighs it stays the authored editorial emphasis.
 * The two live on different scales on purpose, and nothing may compare them
 * across scopes: the ranker normalises a candidate list against its own average
 * before using it, so "how heavy is this chapter" is always answered relative
 * to the other chapters the same student could practise next.
 *
 * `authoredWeight` is the number declared in the curriculum. It is required
 * only when no blueprint covers the chapter; a blueprint chapter should declare
 * `null` and let the paper decide, and a chapter with neither is a build error
 * rather than a silent zero.
 */
export function indiaExamFieldsFor(chapterId, authoredWeight = null) {
  const blueprint = indiaExamMarksFor(chapterId);
  if (blueprint) return { weight: blueprint.examMarks, ...blueprint };
  const authored = Number(authoredWeight);
  if (!Number.isFinite(authored) || authored <= 0) {
    throw new Error(`India curriculum: ${chapterId} has no blueprint marks and no authored weight to fall back on`);
  }
  return { weight: authored, ...AUTHORED_EMPHASIS };
}

/**
 * Every chapter one blueprint weighs, with the marks each carries. Used by the
 * contract suite to prove the curriculum and the paper still agree.
 */
export function indiaExamMarkRoster(blueprint) {
  return (blueprint?.units || []).flatMap(unit => (unit.chapters || []).map(chapterId => ({
    chapterId, unit: unit.id, unitMarks: Number(unit.marks),
    unitChapters: (unit.chapters || []).length,
    marks: Number(unit.marks) / (unit.chapters || []).length
  })));
}
