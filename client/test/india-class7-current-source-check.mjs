import { makeRng } from '../src/engine/qhelpers.js';
import {
  NCERT_CLASS7_2026_27_SOURCE as PART1_SOURCE,
  NCERT_CLASS7_2026_27_CHAPTERS as PART1_CHAPTERS,
  NCERT_CLASS7_2026_27_IDS as PART1_IDS,
  NCERT_CLASS7_2026_27_GENERATORS as PART1_GENERATORS
} from '../src/engine/ncert/class7-2026-27-production.js';
import {
  NCERT_CLASS7_PART2_2026_27_SOURCE as PART2_SOURCE,
  NCERT_CLASS7_PART2_2026_27_CHAPTERS as PART2_CHAPTERS,
  NCERT_CLASS7_PART2_2026_27_IDS as PART2_IDS,
  NCERT_CLASS7_PART2_2026_27_GENERATORS as PART2_GENERATORS
} from '../src/engine/ncert/class7-part2-2026-27-production.js';
import { IN_CURRICULUM, uncoveredDotpoints } from '../src/engine/curriculum-in.js';
import { indiaProductionStatus } from '../src/engine/indiaProductionMeta.js';

let checks = 0;
function ok(label, condition) {
  checks += 1;
  if (!condition) throw new Error(`FAIL — ${label}`);
}
function same(label, actual, expected) {
  ok(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`, JSON.stringify(actual) === JSON.stringify(expected));
}

const EXPECTED_PART1 = [
  ['c7-large-numbers-current', 'Large Numbers Around Us'],
  ['c7-arithmetic-expressions-current', 'Arithmetic Expressions'],
  ['c7-decimals-current', 'A Peek Beyond the Point'],
  ['c7-letter-numbers-current', 'Expressions using Letter-Numbers'],
  ['c7-parallel-intersecting-lines-current', 'Parallel and Intersecting Lines'],
  ['c7-number-play-current', 'Number Play'],
  ['c7-triangles-current', 'A Tale of Three Intersecting Lines'],
  ['c7-fractions-current', 'Working with Fractions']
];
const EXPECTED_PART2 = [
  ['c7-geometric-twins-current', 'Geometric Twins'],
  ['c7-integer-operations-current', 'Operations with Integers'],
  ['c7-common-ground-current', 'Finding Common Ground'],
  ['c7-decimal-operations-current', 'Another Peek Beyond the Point'],
  ['c7-connecting-dots-current', 'Connecting the Dots…'],
  ['c7-constructions-tilings-current', 'Constructions and Tilings'],
  ['c7-finding-unknown-current', 'Finding the Unknown']
];
const EXPECTED = [...EXPECTED_PART1, ...EXPECTED_PART2];
const SOURCE_CHAPTERS = [...PART1_CHAPTERS, ...PART2_CHAPTERS];
const GENERATORS = { ...PART1_GENERATORS, ...PART2_GENERATORS };

same('Part I source chapter spine', PART1_CHAPTERS.map(ch => [ch.id, ch.title]), EXPECTED_PART1);
same('Part II source chapter spine', PART2_CHAPTERS.map(ch => [ch.id, ch.title]), EXPECTED_PART2);
same('combined current Class 7 source chapter spine', SOURCE_CHAPTERS.map(ch => [ch.id, ch.title]), EXPECTED);
same('combined current Class 7 source id list', [...PART1_IDS, ...PART2_IDS], EXPECTED.map(([id]) => id));
ok('both sources identify Grade 7', PART1_SOURCE.grade === 7 && PART2_SOURCE.grade === 7);
ok('Part I records the 2026–27 reprint', /2026.?27/.test(PART1_SOURCE.curriculumVersion));
ok('Part I records the NCERT ISBN', PART1_SOURCE.isbn === '978-93-5729-983-1');
ok('Part II records the NCERT ISBN', PART2_SOURCE.isbn === '978-93-5729-156-9');
ok('Part I records the official NCERT prelims PDF', PART1_SOURCE.prelims === 'https://ncert.nic.in/textbook/pdf/gegp1ps.pdf');
ok('Part II records the official NCERT prelims PDF', PART2_SOURCE.prelims === 'https://ncert.nic.in/textbook/pdf/gegp2ps.pdf');

const live = IN_CURRICULUM.find(group => group.grade === 7);
ok('live Class 7 group exists', !!live);
same('live Class 7 uses all current source ids from both parts', live.chapters.map(ch => ch.id), EXPECTED.map(([id]) => id));
same('live Class 7 uses all current source titles from both parts', live.chapters.map(ch => ch.name), EXPECTED.map(([, title]) => title));
same('live Class 7 contains exactly 15 current chapters', live.chapters.length, 15);

const part2Set = new Set(PART2_IDS);
for (const chapter of live.chapters) {
  same(`${chapter.id} has no uncovered product outcome`, uncoveredDotpoints(chapter), []);
  const status = indiaProductionStatus(chapter, 7);
  ok(`${chapter.id} is source reviewed`, status.sourceReviewed === true);
  ok(`${chapter.id} is source-authored quality A`, status.quality === 'A');
  ok(`${chapter.id} is selectable`, status.selectable === true);
  const expectedSource = part2Set.has(chapter.id) ? PART2_SOURCE : PART1_SOURCE;
  ok(`${chapter.id} cites the correct NCERT edition`, status.source?.edition === expectedSource.curriculumVersion);
  ok(`${chapter.id} cites the correct NCERT ISBN`, status.source?.isbn === expectedSource.isbn);
  ok(`${chapter.id} cites the correct NCERT prelims`, status.source?.ncertTextbook === expectedSource.prelims);

  const generator = GENERATORS[chapter.id];
  ok(`${chapter.id} has a dedicated current generator`, typeof generator === 'function');
  for (let diff = 1; diff <= 4; diff += 1) {
    const cover = chapter.covers.find(c => c.gen === chapter.id && c.diff.includes(diff));
    ok(`${chapter.id} D${diff} has a declared source outcome`, !!cover && cover.dp.length > 0);
    for (let seed = 1; seed <= 24; seed += 1) {
      const q = generator(makeRng(seed * 7919 + diff * 101), diff);
      ok(`${chapter.id} D${diff} seed ${seed} returns a prompt`, typeof q?.prompt === 'string' && q.prompt.length > 10);
      ok(`${chapter.id} D${diff} seed ${seed} returns a supported answer type`, q?.answerType === 'numeric' || q?.answerType === 'mcq');
      ok(`${chapter.id} D${diff} seed ${seed} returns an answer`, !!q?.answer);
      ok(`${chapter.id} D${diff} seed ${seed} declares its exact source outcome`, cover.dp.includes(q?.dotpoint));
      ok(`${chapter.id} D${diff} seed ${seed} has hints`, Array.isArray(q?.hints) && q.hints.length > 0);
      ok(`${chapter.id} D${diff} seed ${seed} has worked steps`, Array.isArray(q?.steps) && q.steps.length > 0);
      if (q.answerType === 'mcq') {
        ok(`${chapter.id} D${diff} seed ${seed} has at least two options`, Array.isArray(q.mcqOptions) && q.mcqOptions.length >= 2);
        ok(`${chapter.id} D${diff} seed ${seed} has a valid correct option`, Number.isInteger(q.answer.correctIndex) && q.answer.correctIndex >= 0 && q.answer.correctIndex < q.mcqOptions.length);
      } else {
        ok(`${chapter.id} D${diff} seed ${seed} has a finite numeric answer`, Number.isFinite(Number(q.answer.value)));
      }
    }
  }
}

console.log(`PASS — current NCERT Ganita Prakash Grade 7 Parts I–II: ${checks}/${checks} source, coverage and seeded-generator checks across 15 chapters.`);
