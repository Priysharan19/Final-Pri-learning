import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import {
  NCERT_CLASS8_CHAPTERS_3_13,
  NCERT_CLASS8_3_13_IDS,
  NCERT_CLASS8_3_13_GENERATOR_IDS,
  NCERT_CLASS8_3_13_GENERATORS,
  NCERT_CLASS8_3_13_RELEASE_AUDIT
} from '../src/engine/ncert/class8-chapters-3-13-production.js';
import { IN_CHAPTER_BY_ID } from '../src/engine/curriculum-in.js';
import { indiaJunior } from '../src/engine/generators/india-junior-overlay.js';
import { bankOf, GENERATORS, loadBanksFor } from '../src/engine/generators/index.js';

const expectedIds = [
  'c8-quadrilaterals',
  'c8-data-handling',
  'c8-squares-roots',
  'c8-cubes-roots',
  'c8-comparing-quantities',
  'c8-algebraic-identities',
  'c8-mensuration',
  'c8-exponents',
  'c8-proportions',
  'c8-factorisation',
  'c8-graphs'
];

assert.deepEqual(NCERT_CLASS8_3_13_IDS, expectedIds, 'Chapters 3–13 must be present in exact NCERT order');
assert.equal(NCERT_CLASS8_3_13_RELEASE_AUDIT.chapterCount, 11);
assert.equal(NCERT_CLASS8_3_13_RELEASE_AUDIT.sourcePages, 150);
assert.equal(NCERT_CLASS8_3_13_RELEASE_AUDIT.exerciseCount, 31);
assert.equal(NCERT_CLASS8_3_13_RELEASE_AUDIT.sourceExerciseQuestions, 185);
assert.equal(NCERT_CLASS8_3_13_RELEASE_AUDIT.authoredCells, 44);

let generated = 0;
let numeric = 0;
let conceptual = 0;

for (const [chapterIndex, id] of expectedIds.entries()) {
  const content = NCERT_CLASS8_CHAPTERS_3_13[id];
  assert.ok(content, `${id}: source content exists`);
  assert.equal(content.chapterNumber, chapterIndex + 3, `${id}: chapter number`);
  assert.equal(content.dotpoints.length, 3, `${id}: exactly three product outcomes`);
  assert.ok(content.sourceMap.length >= 3, `${id}: page-by-page/section source map`);
  assert.ok(content.notes.length >= 4, `${id}: topper notes`);
  assert.ok(content.examples.length >= 2, `${id}: worked examples`);
  assert.equal(content.answerAudit.length, content.exercises.length, `${id}: every exercise audited`);
  assert.ok(content.answerAudit.every(x => x.status === 'confirmed'), `${id}: all attached answer entries confirmed`);
  assert.ok(content.answerAudit.every(x => x.attachedAnswers && x.attachedAnswers.length > 0), `${id}: answer-key evidence retained`);
  assert.ok(content.examples.every(x => x.steps.length >= 3 && x.answer && x.topper), `${id}: fully worked examples`);
  assert.equal(content.questionBank.authoredCells, 4, `${id}: four dedicated mastery cells`);

  const chapter = IN_CHAPTER_BY_ID[id];
  assert.ok(chapter, `${id}: production curriculum chapter exists`);
  assert.equal(chapter.dotpoints.length, 3, `${id}: production curriculum has three outcomes`);
  const covered = new Set(chapter.covers.flatMap(c => c.dp));
  assert.deepEqual([...covered].sort(), [0,1,2], `${id}: no uncovered product outcome`);
  assert.ok(chapter.covers.every(c => c.diff.every(d => d >= 1 && d <= 4)), `${id}: valid difficulty coverage`);

  const generatorId = content.generatorId;
  assert.equal(bankOf(generatorId), 'india-junior', `${generatorId}: bank routing`);
  assert.equal(typeof indiaJunior[generatorId], 'function', `${generatorId}: overlay registration`);
  assert.equal(typeof NCERT_CLASS8_3_13_GENERATORS[generatorId], 'function', `${generatorId}: source registry`);

  for (let diff = 1; diff <= 4; diff++) {
    for (let sample = 0; sample < 40; sample++) {
      const seed = (0x8c000000 + chapterIndex * 100000 + diff * 1000 + sample) >>> 0;
      const form = NCERT_CLASS8_3_13_GENERATORS[generatorId](makeRng(seed), diff);
      generated++;
      assert.ok(typeof form.prompt === 'string' && form.prompt.trim().length > 8, `${generatorId} D${diff}: prompt`);
      assert.ok(Array.isArray(form.hints) && form.hints.length >= 3, `${generatorId} D${diff}: progressive hints`);
      assert.ok(Array.isArray(form.steps) && form.steps.length >= 3, `${generatorId} D${diff}: full worked solution`);
      assert.ok(form.steps.every(step => step && typeof step.h === 'string' && typeof step.d === 'string'), `${generatorId} D${diff}: structured solution stages`);
      assert.ok(['numeric','mcq'].includes(form.answerType), `${generatorId} D${diff}: supported answer type`);
      if (form.answerType === 'numeric') {
        numeric++;
        assert.ok(Number.isFinite(Number(form.answer?.value)), `${generatorId} D${diff}: finite numeric answer`);
      } else {
        conceptual++;
        assert.ok(Array.isArray(form.mcqOptions) && form.mcqOptions.length >= 2, `${generatorId} D${diff}: MCQ options`);
        assert.ok(Number.isInteger(form.answer?.correctIndex), `${generatorId} D${diff}: MCQ correct index`);
      }
    }
  }
}

assert.equal(generated, 1760, '11 chapters × 4 difficulties × 40 seeded forms');
assert.ok(numeric > 1000, 'bank must contain substantial handwriting-ready numeric practice');
assert.ok(conceptual > 100, 'bank must retain conceptual/classification practice');

await loadBanksFor(NCERT_CLASS8_3_13_GENERATOR_IDS);
for (const id of NCERT_CLASS8_3_13_GENERATOR_IDS) {
  assert.equal(typeof GENERATORS[id], 'function', `${id}: production dynamic registry`);
}

console.log(`PASS — NCERT Class 8 Chapters 3–13: ${generated} seeded forms, ${numeric} numeric handwriting-ready, ${conceptual} conceptual.`);
console.log('PASS — 150/150 uploaded chapter pages, 31/31 exercise sections and 185 top-level source exercise questions represented in the release audit.');
