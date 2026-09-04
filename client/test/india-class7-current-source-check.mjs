import { makeRng } from '../src/engine/qhelpers.js';
import {
  NCERT_CLASS7_2026_27_SOURCE,
  NCERT_CLASS7_2026_27_CHAPTERS,
  NCERT_CLASS7_2026_27_IDS,
  NCERT_CLASS7_2026_27_GENERATORS
} from '../src/engine/ncert/class7-2026-27-production.js';
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

const EXPECTED = [
  ['c7-large-numbers-current', 'Large Numbers Around Us'],
  ['c7-arithmetic-expressions-current', 'Arithmetic Expressions'],
  ['c7-decimals-current', 'A Peek Beyond the Point'],
  ['c7-letter-numbers-current', 'Expressions using Letter-Numbers'],
  ['c7-parallel-intersecting-lines-current', 'Parallel and Intersecting Lines'],
  ['c7-number-play-current', 'Number Play'],
  ['c7-triangles-current', 'A Tale of Three Intersecting Lines'],
  ['c7-fractions-current', 'Working with Fractions']
];

same('current Class 7 source chapter spine', NCERT_CLASS7_2026_27_CHAPTERS.map(ch => [ch.id, ch.title]), EXPECTED);
same('current Class 7 source id list', NCERT_CLASS7_2026_27_IDS, EXPECTED.map(([id]) => id));
ok('source identifies Grade 7', NCERT_CLASS7_2026_27_SOURCE.grade === 7);
ok('source records 2026–27 reprint', /2026.?27/.test(NCERT_CLASS7_2026_27_SOURCE.curriculumVersion));
ok('source records the NCERT ISBN', NCERT_CLASS7_2026_27_SOURCE.isbn === '978-93-5729-983-1');
ok('source records the official NCERT prelims PDF', NCERT_CLASS7_2026_27_SOURCE.prelims === 'https://ncert.nic.in/textbook/pdf/gegp1ps.pdf');

const live = IN_CURRICULUM.find(group => group.grade === 7);
ok('live Class 7 group exists', !!live);
same('live Class 7 uses the current source ids', live.chapters.map(ch => ch.id), EXPECTED.map(([id]) => id));
same('live Class 7 uses the current source titles', live.chapters.map(ch => ch.name), EXPECTED.map(([, title]) => title));

for (const chapter of live.chapters) {
  same(`${chapter.id} has no uncovered product outcome`, uncoveredDotpoints(chapter), []);
  const status = indiaProductionStatus(chapter, 7);
  ok(`${chapter.id} is source reviewed`, status.sourceReviewed === true);
  ok(`${chapter.id} is source-authored quality A`, status.quality === 'A');
  ok(`${chapter.id} is selectable`, status.selectable === true);

  const generator = NCERT_CLASS7_2026_27_GENERATORS[chapter.id];
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

console.log(`PASS — current NCERT Ganita Prakash Grade 7: ${checks}/${checks} source, coverage and seeded-generator checks.`);
