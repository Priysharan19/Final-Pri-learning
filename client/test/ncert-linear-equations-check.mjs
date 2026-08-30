import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import {
  NCERT_CLASS8_LINEAR_CONTENT,
  NCERT_CLASS8_LINEAR_DOTPOINTS,
  NCERT_CLASS8_LINEAR_COVERS,
  NCERT_CLASS8_LINEAR_GENERATOR_IDS,
  NCERT_CLASS8_LINEAR_GENERATORS,
  NCERT_CLASS8_LINEAR_WORKED_EXAMPLES,
  NCERT_CLASS8_LINEAR_EXERCISES,
  NCERT_CLASS8_LINEAR_EXERCISE_21,
  NCERT_CLASS8_LINEAR_EXERCISE_22,
  NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT
} from '../src/engine/ncert/class8-linear-production.js';
import { IN_CURRICULUM, IN_CHAPTERS, IN_CHAPTER_BY_ID, uncoveredDotpoints } from '../src/engine/curriculum-in.js';
import { indiaJunior } from '../src/engine/generators/india-junior-overlay.js';
import { bankOf, loadAllBanks, GENERATORS } from '../src/engine/generators/index.js';

await loadAllBanks();

const chapterId = 'c8-linear-equations';
const productChapter = IN_CURRICULUM.flatMap(g => g.chapters).find(c => c.id === chapterId);
const flatChapter = IN_CHAPTERS.find(c => c.id === chapterId);
const lookupChapter = IN_CHAPTER_BY_ID[chapterId];

assert.ok(productChapter && flatChapter && lookupChapter, 'Class 8 Linear Equations must exist in all curriculum views');
for (const chapter of [productChapter, flatChapter, lookupChapter]) {
  assert.deepEqual(chapter.dotpoints, [...NCERT_CLASS8_LINEAR_DOTPOINTS]);
  assert.equal(chapter.dotpoints.length, 3, 'India product contract remains exactly three dot points per chapter');
  assert.deepEqual(uncoveredDotpoints(chapter), [], 'no Linear Equations product outcome may be uncovered');
}

assert.equal(NCERT_CLASS8_LINEAR_GENERATOR_IDS.length, 7);
assert.equal(NCERT_CLASS8_LINEAR_COVERS.length, 7);
assert.equal(NCERT_CLASS8_LINEAR_CONTENT.questionBank.authoredCells, 28);
assert.equal(NCERT_CLASS8_LINEAR_CONTENT.questionBank.productDotpoints, 3);
assert.equal(NCERT_CLASS8_LINEAR_CONTENT.questionBank.sourceSkills, 7);
assert.equal(NCERT_CLASS8_LINEAR_CONTENT.questionBank.sourceExerciseQuestions, 20);
assert.equal(NCERT_CLASS8_LINEAR_CONTENT.sourcePages, 6);
assert.equal(NCERT_CLASS8_LINEAR_CONTENT.sourceMap.length, 6);
assert.match(NCERT_CLASS8_LINEAR_CONTENT.sourceMap.at(-1).coverage, /blank Notes page/i);
assert.equal(NCERT_CLASS8_LINEAR_WORKED_EXAMPLES.length, 4);
assert.equal(NCERT_CLASS8_LINEAR_EXERCISES.length, 20);
assert.equal(NCERT_CLASS8_LINEAR_EXERCISE_21.length, 10);
assert.equal(NCERT_CLASS8_LINEAR_EXERCISE_22.length, 10);

// Attached image: all 20 visible answers must agree exactly with independently solved source equations.
assert.equal(NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT.totalSourceQuestions, 20);
assert.equal(NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT.totalAttachedAnswers, 20);
assert.equal(NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT.mismatchCount, 0);
assert.deepEqual(
  NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT.confirmed.slice(0, 10).map(x => x.attachedAnswer),
  ['18', '-1', '-2', '3/2', '5', '0', '40', '10', '7/3', '4/5']
);
assert.deepEqual(
  NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT.confirmed.slice(10).map(x => x.attachedAnswer),
  ['27/10', '36', '-5', '8', '2', '7/5', '-2', '2/3', '2', '0.6']
);
assert.ok(NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT.confirmed.every(x => x.status === 'confirmed'));

// Important source-reading guard: Exercise 2.2 Q3 contains a minus before 8x/3.
const q22_3 = NCERT_CLASS8_LINEAR_EXERCISE_22[2];
assert.match(q22_3.prompt, /7-\\frac\{8x\}\{3\}/);
assert.equal(q22_3.answer.n, -5);
assert.equal(q22_3.answer.d, 1);

assert.deepEqual(NCERT_CLASS8_LINEAR_COVERS.map(c => c.dp[0]), [0, 0, 1, 1, 1, 2, 2]);
for (const cover of NCERT_CLASS8_LINEAR_COVERS) {
  assert.deepEqual(cover.diff, [1, 2, 3, 4]);
  assert.equal(bankOf(cover.gen), 'india-junior', `${cover.gen} must lazy-load from the India junior bank`);
}
for (const id of NCERT_CLASS8_LINEAR_GENERATOR_IDS) {
  assert.equal(typeof NCERT_CLASS8_LINEAR_GENERATORS[id], 'function', `${id} must be authored`);
  assert.equal(typeof indiaJunior[id], 'function', `${id} must be registered in the India junior overlay`);
  assert.equal(typeof GENERATORS[id], 'function', `${id} must be reachable through production registry`);
}

let numeric = 0;
let mcqs = 0;
for (const [gi, id] of NCERT_CLASS8_LINEAR_GENERATOR_IDS.entries()) {
  const gen = indiaJunior[id];
  for (let diff = 1; diff <= 4; diff++) {
    for (let sample = 0; sample < 40; sample++) {
      const q = gen(makeRng(0x8c200000 + gi * 10000 + diff * 100 + sample), diff);
      assert.equal(typeof q.prompt, 'string');
      assert.ok(q.prompt.length > 5, `${id} D${diff} prompt must not be empty/trivial`);
      assert.ok(Array.isArray(q.hints) && q.hints.length >= 3, `${id} D${diff} needs progressive hints`);
      assert.ok(Array.isArray(q.steps) && q.steps.length >= 3, `${id} D${diff} needs a full worked solution`);
      for (const step of q.steps) {
        assert.equal(typeof step.h, 'string');
        assert.equal(typeof step.d, 'string');
        assert.ok(step.h && step.d);
      }
      if (q.answerType === 'numeric') {
        numeric++;
        assert.ok(Number.isFinite(Number(q.answer?.value)), `${id} D${diff} numeric answer must be finite`);
      } else if (q.answerType === 'mcq') {
        mcqs++;
        assert.ok(Array.isArray(q.mcqOptions) && q.mcqOptions.length >= 2);
        assert.ok(Number.isInteger(q.answer?.correctIndex));
        assert.ok(q.answer.correctIndex >= 0 && q.answer.correctIndex < q.mcqOptions.length);
      } else {
        assert.fail(`${id} D${diff} uses unsupported answer type ${q.answerType}`);
      }
    }
  }
}
assert.ok(numeric > 0, 'bank must contain handwriting-ready numeric solution questions');
assert.ok(mcqs > 0, 'bank must contain conceptual equation checks');

for (const item of NCERT_CLASS8_LINEAR_EXERCISES) {
  assert.ok(item.steps.length >= 3, `Exercise ${item.exercise} Q${item.q} needs a full source solution`);
}

console.log(`NCERT Class 8 Linear Equations: 6/6 source pages, 20/20 attached answers, ${NCERT_CLASS8_LINEAR_GENERATOR_IDS.length} generators × 4 levels, ${numeric + mcqs} seeded forms audited.`);
