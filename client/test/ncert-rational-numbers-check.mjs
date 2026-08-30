import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import {
  NCERT_CLASS8_RATIONAL_CONTENT,
  NCERT_CLASS8_RATIONAL_DOTPOINTS,
  NCERT_CLASS8_RATIONAL_COVERS,
  NCERT_CLASS8_RATIONAL_GENERATOR_IDS,
  NCERT_CLASS8_RATIONAL_GENERATORS,
  NCERT_CLASS8_RATIONAL_WORKED_EXAMPLES,
  NCERT_CLASS8_RATIONAL_SOURCE_CHECKS,
  NCERT_CLASS8_RATIONAL_EXERCISE_ANSWER_AUDIT
} from '../src/engine/ncert/class8-rational-production.js';
import { IN_CURRICULUM, IN_CHAPTERS, IN_CHAPTER_BY_ID, uncoveredDotpoints } from '../src/engine/curriculum-in.js';
import { indiaJunior } from '../src/engine/generators/india-junior-overlay.js';
import { bankOf, loadAllBanks, GENERATORS } from '../src/engine/generators/index.js';

await loadAllBanks();

const chapterId = 'c8-rational-numbers';
const productChapter = IN_CURRICULUM.flatMap(g => g.chapters).find(c => c.id === chapterId);
const flatChapter = IN_CHAPTERS.find(c => c.id === chapterId);
const lookupChapter = IN_CHAPTER_BY_ID[chapterId];

assert.ok(productChapter && flatChapter && lookupChapter, 'Class 8 Rational Numbers must exist in all curriculum views');
for (const chapter of [productChapter, flatChapter, lookupChapter]) {
  assert.deepEqual(chapter.dotpoints, [...NCERT_CLASS8_RATIONAL_DOTPOINTS], 'every product view must expose the three production outcomes');
  assert.equal(chapter.dotpoints.length, 3, 'India product contract remains exactly three dot points per chapter');
  assert.deepEqual(uncoveredDotpoints(chapter), [], 'no Rational Numbers product outcome may be uncovered');
}

assert.equal(NCERT_CLASS8_RATIONAL_GENERATOR_IDS.length, 8);
assert.equal(NCERT_CLASS8_RATIONAL_COVERS.length, 8);
assert.equal(NCERT_CLASS8_RATIONAL_CONTENT.questionBank.authoredCells, 32);
assert.equal(NCERT_CLASS8_RATIONAL_CONTENT.questionBank.productDotpoints, 3);
assert.equal(NCERT_CLASS8_RATIONAL_CONTENT.questionBank.sourceSkills, 8);
assert.equal(NCERT_CLASS8_RATIONAL_CONTENT.source.pages, 14);
assert.equal(NCERT_CLASS8_RATIONAL_CONTENT.sourceMap.at(-1).pages, '14');
assert.match(NCERT_CLASS8_RATIONAL_CONTENT.sourceMap.at(-1).coverage, /no additional mathematical statement/i);
assert.equal(NCERT_CLASS8_RATIONAL_WORKED_EXAMPLES.length, 3);
assert.equal(NCERT_CLASS8_RATIONAL_SOURCE_CHECKS.length, 14);
assert.deepEqual(NCERT_CLASS8_RATIONAL_WORKED_EXAMPLES.map(x => x.answer), [
  '$-\\frac{125}{462}$', '$\\frac12$', '$-\\frac12$'
]);

// User-provided answer-key crop: the four visible answers must agree exactly.
assert.deepEqual(
  NCERT_CLASS8_RATIONAL_EXERCISE_ANSWER_AUDIT.attachedKeyConfirmed.map(x => x.answer),
  ['Multiplicative identity', 'Commutativity of multiplication', 'Multiplicative inverse', 'Rational number']
);
assert.equal(NCERT_CLASS8_RATIONAL_EXERCISE_ANSWER_AUDIT.sourceOnly.answer, 'Associativity of multiplication');
assert.match(NCERT_CLASS8_RATIONAL_EXERCISE_ANSWER_AUDIT.sourceOnly.note, /not shown in the attached answer-key crop/i);

// Eight fine skills are routed beneath the three product outcomes.
assert.deepEqual(
  NCERT_CLASS8_RATIONAL_COVERS.map(c => c.dp[0]),
  [0, 0, 1, 1, 1, 2, 2, 2]
);
for (const cover of NCERT_CLASS8_RATIONAL_COVERS) {
  assert.deepEqual(cover.diff, [1, 2, 3, 4]);
  assert.equal(bankOf(cover.gen), 'india-junior', `${cover.gen} must lazy-load from the India junior bank`);
}

for (const id of NCERT_CLASS8_RATIONAL_GENERATOR_IDS) {
  assert.equal(typeof NCERT_CLASS8_RATIONAL_GENERATORS[id], 'function', `${id} must be authored`);
  assert.equal(typeof indiaJunior[id], 'function', `${id} must be registered in the India junior overlay`);
  assert.equal(typeof GENERATORS[id], 'function', `${id} must be reachable through the production registry`);
}

let numeric = 0;
let mcqs = 0;
for (const [gi, id] of NCERT_CLASS8_RATIONAL_GENERATOR_IDS.entries()) {
  const gen = indiaJunior[id];
  for (let diff = 1; diff <= 4; diff++) {
    for (let sample = 0; sample < 40; sample++) {
      const q = gen(makeRng(0x8c100000 + gi * 10000 + diff * 100 + sample), diff);
      assert.equal(typeof q.prompt, 'string');
      assert.ok(q.prompt.length > 20, `${id} D${diff} prompt should be substantive`);
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

assert.ok(numeric > 0, 'the bank must contain handwriting-ready numeric questions');
assert.ok(mcqs > 0, 'the bank must contain precise conceptual property checks');

console.log(`NCERT Class 8 Rational Numbers: 3 product outcomes, ${NCERT_CLASS8_RATIONAL_GENERATOR_IDS.length} generators × 4 levels audited; ${numeric + mcqs} sampled questions passed; attached Exercise 1.1 answers verified.`);
