// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the exam weight an Indian chapter carries, and the claim made
// from it
//
// The India spine used to weigh every chapter by hand in the NSW 9–14 band.
// Class X's fourteen chapters summed to 148 and Class XII's thirteen to 138,
// against a real CBSE paper of 80 marks in both cases. The ranker multiplied
// mastery by those numbers and then told the student "high exam weight" — an
// examination claim assembled from a number no board had published.
//
// This suite is the contract that stops that coming back:
//
//   · every chapter CBSE weighs reconciles to its blueprint unit — a chapter in
//     a 20-mark unit of four carries 5, and nothing is written down twice;
//   · each board class's chapter marks sum to exactly its paper's total, 80 for
//     Class X and Class XII, so a drifting blueprint fails the build instead of
//     quietly re-ranking a student's practice;
//   · a chapter no published paper weighs says so (`examSource`) rather than
//     carrying a zero or an invented share;
//   · "high exam weight" appears only on a chapter that genuinely carries more
//     of its paper than an average chapter does, never on revision material,
//     and — the point of the whole exercise — it is reachable at all on a CBSE
//     class, which it would not have been had the real marks been dropped into
//     a threshold tuned for the old scale;
//   · the Australian path is untouched: on a NSW scope the normalised share
//     reproduces the old `weight / 22` and `weight >= 12` exactly.
//
// Usage: node client/test/india-exam-weight-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { IN_CURRICULUM, IN_CHAPTERS, OLYMPIAD_TOPICS } from '../src/engine/curriculum-in.js';
import {
  INDIA_EXAM_MARK_BLUEPRINTS, INDIA_CHAPTER_EXAM_MARKS,
  indiaExamMarksFor, indiaExamFieldsFor, indiaExamMarkRoster
} from '../src/engine/indiaExamMarks.js';
import {
  CBSE_CLASS10_STANDARD_REFERENCE, CBSE_CLASS10_BASIC_REFERENCE,
  CBSE_CLASS11_ANNUAL_PATTERN, CBSE_CLASS12_STANDARD_REFERENCE,
  examBlueprintInvariant
} from '../src/engine/indiaExams.js';
import { indiaPracticeScope, indiaChapterGrade } from '../src/engine/indiaProduct.js';
import { scopeForYear } from '../src/engine/curriculum.js';
import {
  prioritiesAmong, pickNextAmong, examShares, EXAM_PULL_AT_AVERAGE, HIGH_EXAM_SHARE
} from '../src/engine/adaptive.js';

let pass = 0;
const failures = [];
let group = 'startup';
const section = name => { group = name; console.log(name); };
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return true; }
  failures.push(`${group} · ${name}${detail ? `\n      ${detail}` : ''}`);
  return false;
};
const eq = (name, actual, expected) =>
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const near = (name, actual, expected, tol = 1e-9) =>
  ok(name, Math.abs(actual - expected) <= tol, `expected ${expected} ± ${tol}, got ${actual}`);

const NOW = Date.UTC(2026, 8, 6, 4, 30, 0);
const DAY = 86400000;
const sum = xs => xs.reduce((a, b) => a + b, 0);

// The three classes a published CBSE weightage covers, and the paper each sits.
const BOARD_CLASSES = [
  [10, CBSE_CLASS10_STANDARD_REFERENCE],
  [11, CBSE_CLASS11_ANNUAL_PATTERN],
  [12, CBSE_CLASS12_STANDARD_REFERENCE]
];
const AUTHORED_CLASSES = [7, 8, 9];

// ── 1 · The blueprints themselves still add up ──────────────────────────────
section('BLUEPRINTS');
for (const [grade, blueprint] of BOARD_CLASSES) {
  ok(`Class ${grade} blueprint passes its own invariant`, examBlueprintInvariant(blueprint));
  eq(`Class ${grade} paper is 80 marks`, blueprint.totalMarks, 80);
  near(`Class ${grade} units sum to the paper's total`, sum(blueprint.units.map(u => Number(u.marks))), blueprint.totalMarks);
  ok(`Class ${grade} names at least one chapter in every unit`, blueprint.units.every(u => (u.chapters || []).length > 0));
}
// Class X Basic shares Standard's unit weightage; if that ever stops being true
// the two papers would weigh the same chapter differently and the derivation
// would have to name which one it read.
eq('Class X Basic shares Standard’s unit weightage', CBSE_CLASS10_BASIC_REFERENCE.units, CBSE_CLASS10_STANDARD_REFERENCE.units);

// ── 2 · Every chapter reconciles to its unit ────────────────────────────────
section('\nRECONCILIATION');
for (const [grade, blueprint] of BOARD_CLASSES) {
  for (const row of indiaExamMarkRoster(blueprint)) {
    const chapter = IN_CHAPTERS.find(c => c.id === row.chapterId);
    ok(`${row.chapterId} is a real chapter in the spine`, !!chapter);
    if (!chapter) continue;
    eq(`${row.chapterId} sits in Class ${grade}`, indiaChapterGrade(chapter), grade);
    near(`${row.chapterId} carries its unit's marks split evenly`, chapter.examMarks, row.unitMarks / row.unitChapters);
    near(`${row.chapterId} × its unit's chapters returns the unit's marks`, chapter.examMarks * row.unitChapters, row.unitMarks);
    eq(`${row.chapterId} names the unit it was read from`, chapter.examUnit, row.unit);
    eq(`${row.chapterId} carries the paper's total`, chapter.examTotalMarks, 80);
    eq(`${row.chapterId} is sourced from the blueprint`, chapter.examSource, 'cbse-blueprint');
    // The point of deriving rather than copying: the ranker's number and the
    // mark predictor's number are the same number.
    eq(`${row.chapterId} hands the ranker its real marks`, chapter.weight, chapter.examMarks);
  }
}

section('\nCLASS TOTALS');
for (const [grade, blueprint] of BOARD_CLASSES) {
  const chapters = IN_CURRICULUM.find(g => g.grade === grade).chapters;
  const blueprintChapters = new Set(blueprint.units.flatMap(u => u.chapters));
  eq(`Class ${grade} spine and blueprint cover the same chapters`,
    chapters.map(c => c.id).slice().sort(), [...blueprintChapters].sort());
  near(`Class ${grade} chapter marks sum to the paper's ${blueprint.totalMarks}`, sum(chapters.map(c => c.examMarks)), blueprint.totalMarks);
  near(`Class ${grade} ranker weights sum to the paper's ${blueprint.totalMarks}`, sum(chapters.map(c => c.weight)), blueprint.totalMarks);
  // The old invented band was 9–14 on a 148-mark total. A real chapter of an
  // 80-mark paper cannot reach it, so this is the assertion that fails loudly
  // if anyone reinstates a hand-typed weight on a board class.
  ok(`Class ${grade} carries no chapter left on the old 9–14 band`, chapters.every(c => c.weight < 9));
  ok(`Class ${grade} gives every chapter some of the paper`, chapters.every(c => c.examMarks > 0));
}

// ── 3 · Chapters no published paper weighs ─────────────────────────────────
section('\nUNWEIGHED GROUND');
for (const grade of AUTHORED_CLASSES) {
  const chapters = IN_CURRICULUM.find(g => g.grade === grade).chapters;
  ok(`Class ${grade} claims no examination weightage`, chapters.every(c => c.examSource === 'authored-emphasis'));
  ok(`Class ${grade} carries no marks it cannot source`, chapters.every(c => c.examMarks === null && c.examTotalMarks === null));
  // Not a zero: an absence still has to rank, so the authored editorial
  // emphasis survives and every chapter keeps a usable positive weight.
  ok(`Class ${grade} still weighs every chapter for the ranker`, chapters.every(c => Number.isFinite(c.weight) && c.weight > 0));
}
ok('the olympiad ladder claims no examination weightage', OLYMPIAD_TOPICS.every(c => c.examSource === 'authored-emphasis' && c.examMarks === null));
ok('the olympiad ladder still weighs every topic', OLYMPIAD_TOPICS.every(c => c.weight > 0));
ok('every chapter in the spine declares where its weight came from',
  IN_CHAPTERS.every(c => c.examSource === 'cbse-blueprint' || c.examSource === 'authored-emphasis'));
eq('a chapter outside every blueprint resolves to nothing', indiaExamMarksFor('c8-graphs'), null);
eq('and one inside a blueprint resolves to its unit', indiaExamMarksFor('c10-triangles').examUnit, 'geometry');
eq('the derivation covers exactly the three board classes',
  INDIA_CHAPTER_EXAM_MARKS.size, sum(INDIA_EXAM_MARK_BLUEPRINTS.map(b => b.units.reduce((n, u) => n + u.chapters.length, 0))));
ok('a chapter with neither a blueprint nor an authored weight is a build error',
  (() => { try { indiaExamFieldsFor('not-a-chapter', null); return false; } catch { return true; } })());

// ── 4 · The named examples from the published weightage ────────────────────
// Spot values, so a silent re-split inside a unit cannot pass the sums above.
section('\nNAMED VALUES');
near('Algebra is 20 marks over four Class X chapters, so Polynomials carries 5', indiaExamMarksFor('c10-polynomials').examMarks, 5);
near('Geometry is 15 over two, so Triangles carries 7.5', indiaExamMarksFor('c10-triangles').examMarks, 7.5);
near('Trigonometry is 12 over two, so Introduction to Trigonometry carries 6', indiaExamMarksFor('c10-trigonometry').examMarks, 6);
near('Statistics and Probability is 11 over two, so Statistics carries 5.5', indiaExamMarksFor('c10-statistics').examMarks, 5.5);
near('Calculus is 35 over five Class XII chapters, so Integrals carries 7', indiaExamMarksFor('c12-integrals').examMarks, 7);
near('Probability is 8 marks to one chapter', indiaExamMarksFor('c12-probability').examMarks, 8);
near('Linear Programming is 5 marks to one chapter', indiaExamMarksFor('c12-linear-programming').examMarks, 5);
eq('an evenly split unit records how many chapters shared it', indiaExamMarksFor('c10-polynomials').examUnitChapters, 4);

// ── 5 · The ranker consumes a share, not a scale ───────────────────────────
section('\nNORMALISATION');
{
  const flat = [{ id: 'a', weight: 10 }, { id: 'b', weight: 10 }];
  const { average, share } = examShares(flat);
  near('an even scope averages to its own weight', average, 10);
  near('and every candidate in it is an ordinary topic', share(flat[0]), 1);

  const spread = [{ id: 'a', weight: 5 }, { id: 'b', weight: 15 }];
  const s2 = examShares(spread);
  near('a candidate at three times the average reads as 1.5', s2.share(spread[1]), 1.5);
  // Scale independence is the whole property: the same syllabus expressed in
  // CBSE marks and in NSW percentage points must rank identically.
  const scaled = spread.map(c => ({ ...c, weight: c.weight * 8 }));
  near('multiplying every weight by a constant changes no share', examShares(scaled).share(scaled[1]), s2.share(spread[1]));
  near('a candidate with no weight counts as ordinary', s2.share({ id: 'c' }), 1);
  near('an empty scope leaves the axis flat', examShares([]).share({ weight: 12 }), 1);
}

// ── 6 · The Australian path does not move ──────────────────────────────────
// The two constants are the old ones re-expressed. On a NSW scope, whose nine
// subtopics a year sum to 100, they have to return the old numbers exactly.
section('\nAUSTRALIAN PARITY');
for (const [year, pathway] of [[8, 'advanced'], [10, 'advanced'], [11, 'advanced'], [12, 'advanced']]) {
  const { own, revision } = scopeForYear(year, pathway);
  const candidates = [...own, ...revision].map(s => ({ id: s.id, weight: s.weight }));
  const { average, share } = examShares(candidates);
  near(`Year ${year} ${pathway}: an average NSW subtopic weighs 100/9`, average, 100 / 9);
  for (const c of candidates) {
    near(`Year ${year} ${pathway}: ${c.id} reproduces weight/22 exactly`, EXAM_PULL_AT_AVERAGE * share(c), c.weight / 22, 1e-12);
  }
  const firesNow = candidates.filter(c => share(c) >= HIGH_EXAM_SHARE).map(c => c.id).sort();
  const firedBefore = candidates.filter(c => c.weight >= 12).map(c => c.id).sort();
  eq(`Year ${year} ${pathway}: the same subtopics say "high exam weight"`, firesNow, firedBefore);
}
near('the high-weight threshold is the old 12 on the NSW average', HIGH_EXAM_SHARE * (100 / 9), 12);
near('an average topic still pulls what weight/22 gave it', EXAM_PULL_AT_AVERAGE * 1, (100 / 9) / 22);

// ── 7 · The claim is true where it is made ─────────────────────────────────
section('\nTHE CLAIM');

/** A student weak everywhere, so nothing is filtered out by the 88% cut. */
function weakEverywhere(ids) {
  const out = {};
  for (const id of ids) out[id] = { rating: 950, attempts: 6, correct: 2, last_at: NOW - 10 * DAY };
  return out;
}

const CLAIM = 'high exam weight';
for (const [label, track, grade] of [
  ['Class 10 CBSE', 'cbse', 10], ['Class 11 CBSE', 'cbse', 11], ['Class 12 CBSE', 'cbse', 12],
  ['Class 11 JEE Main', 'jee-main', 11], ['Class 12 JEE Main', 'jee-main', 12], ['olympiad', 'olympiad', 11]
]) {
  const { own, ahead } = indiaPracticeScope(track, grade);
  const pool = [...own, ...ahead];
  const scope = pool.map(c => ({
    id: c.id, name: c.name, year: indiaChapterGrade(c), strand: c.strand, weight: c.weight,
    rev: ahead.some(a => a.id === c.id)
  }));
  const rows = prioritiesAmong(scope, weakEverywhere(pool.map(c => c.id)), NOW, scope.length);
  ok(`${label}: every chapter is ranked`, rows.length === scope.length);
  for (const row of rows) {
    const declared = row.reason.includes(CLAIM);
    const rev = !!scope.find(s => s.id === row.subtopic)?.rev;
    ok(`${label}: ${row.subtopic} claims a high weight only when it has one`,
      declared === (!rev && row.examShare >= HIGH_EXAM_SHARE), `examShare ${row.examShare}, rev ${rev}, reason "${row.reason}"`);
  }
  ok(`${label}: revision material never claims a high weight`,
    rows.filter(r => scope.find(s => s.id === r.subtopic)?.rev).every(r => !r.reason.includes(CLAIM)));
  ok(`${label}: every row publishes the share behind its ranking`, rows.every(r => Number.isFinite(r.examShare) && r.examShare > 0));
}

// The regression the recalibration exists to prevent: the real marks are 5–8,
// so a threshold left at an absolute 12 would have silenced this line for every
// Indian student on every board class, forever.
for (const [grade, blueprint] of BOARD_CLASSES) {
  const chapters = IN_CURRICULUM.find(g => g.grade === grade).chapters;
  const scope = chapters.map(c => ({ id: c.id, name: c.name, year: grade, strand: c.strand, weight: c.weight, rev: false }));
  const rows = prioritiesAmong(scope, weakEverywhere(chapters.map(c => c.id)), NOW, scope.length);
  const claiming = rows.filter(r => r.reason.includes(CLAIM));
  ok(`Class ${grade}: some chapter genuinely carries a high share of the paper`, claiming.length > 0);
  ok(`Class ${grade}: not every chapter does — the line still means something`, claiming.length < rows.length);
  for (const row of claiming) {
    const chapter = chapters.find(c => c.id === row.subtopic);
    const average = blueprint.totalMarks / chapters.length;
    ok(`Class ${grade}: ${row.subtopic} claims it on real marks above the class average`,
      chapter.examMarks > average, `${chapter.examMarks} marks against an average of ${average.toFixed(2)}`);
    eq(`Class ${grade}: ${row.subtopic} claims it on a blueprint number`, chapter.examSource, 'cbse-blueprint');
  }
}
// Named, so a re-split inside Geometry that still sums to 15 cannot pass
// silently: these are the Class X chapters that carry the largest real share.
{
  const chapters = IN_CURRICULUM.find(g => g.grade === 10).chapters;
  const scope = chapters.map(c => ({ id: c.id, name: c.name, year: 10, strand: c.strand, weight: c.weight, rev: false }));
  const rows = prioritiesAmong(scope, weakEverywhere(chapters.map(c => c.id)), NOW, scope.length);
  eq('Class 10: Triangles and Circles are the chapters that carry a high share',
    rows.filter(r => r.reason.includes(CLAIM)).map(r => r.subtopic).sort(), ['c10-circles', 'c10-triangles']);
  eq('Class 12: Probability, calculus and vectors carry the high share',
    (() => {
      const c12 = IN_CURRICULUM.find(g => g.grade === 12).chapters;
      const s = c12.map(c => ({ id: c.id, name: c.name, year: 12, strand: c.strand, weight: c.weight, rev: false }));
      return prioritiesAmong(s, weakEverywhere(c12.map(c => c.id)), NOW, s.length)
        .filter(r => r.reason.includes(CLAIM)).map(r => r.subtopic).sort();
    })(),
    ['c12-applications-derivatives', 'c12-applications-integrals', 'c12-continuity-differentiability',
      'c12-differential-equations', 'c12-integrals', 'c12-probability', 'c12-vector-algebra', 'c12-3d-geometry'].sort());
}

// ── 8 · The picker reads the same share ────────────────────────────────────
section('\nTHE PICKER');
{
  // Two identical students, one on a heavy chapter and one on a light one, in
  // the same scope: the heavy chapter has to win, and by the share's margin.
  const chapters = IN_CURRICULUM.find(g => g.grade === 10).chapters;
  const candidates = chapters.map(c => ({ id: c.id, weight: c.weight, own: true }));
  const ratings = weakEverywhere(chapters.map(c => c.id));
  const picked = pickNextAmong({ candidates, ratings, reviewsDue: [], rand: 0.5, recent: [], nowMs: NOW });
  ok('the picker returns a Class 10 chapter', chapters.some(c => c.id === picked.subtopic));
  ok('and a runner-up', !!picked.nextUp);

  const heavy = examShares(candidates).share({ weight: 7.5 });
  const light = examShares(candidates).share({ weight: 5 });
  ok('a 7.5-mark chapter outweighs a 5-mark one', heavy > light);
  near('and does so by exactly the ratio of their marks', heavy / light, 1.5);
}

console.log(failures.length
  ? `\nINDIA EXAM WEIGHT: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `\nINDIA EXAM WEIGHT: PASS — ${pass}/${pass} checks — every board chapter reconciles to its published unit, each board class sums to the paper's 80 marks, and "high exam weight" is said only where the paper says so.`);
process.exit(failures.length ? 1 : 0);
