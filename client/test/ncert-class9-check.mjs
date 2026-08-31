import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import {
  NCERT_CLASS9_CHAPTERS,
  NCERT_CLASS9_IDS,
  NCERT_CLASS9_GENERATORS,
  NCERT_CLASS9_RELEASE_AUDIT
} from '../src/engine/ncert/class9-chapters-production.js';
import { IN_CURRICULUM, IN_CHAPTERS, IN_CHAPTER_BY_ID } from '../src/engine/curriculum-in.js';
import { indiaJunior } from '../src/engine/generators/india-junior-overlay.js';
import { bankOf, GENERATORS, loadBanksFor } from '../src/engine/generators/index.js';

const expectedIds = [
  'c9-coordinate-geometry',
  'c9-linear-polynomials',
  'c9-number-systems',
  'c9-algebraic-identities',
  'c9-circles',
  'c9-perimeter-area',
  'c9-probability',
  'c9-sequences-progressions'
];
const expectedPages = [15,25,27,24,26,37,19,27];
const expectedExerciseSections = [3,7,6,6,7,4,5,4];
const expectedFormalQuestions = [24,39,43,25,43,56,28,35];

assert.deepEqual(NCERT_CLASS9_IDS, expectedIds, 'Grade 9 chapters must be in uploaded Ganita Manjari order');
assert.equal(NCERT_CLASS9_RELEASE_AUDIT.chapterCount, 8);
assert.equal(NCERT_CLASS9_RELEASE_AUDIT.sourcePages, 200);
assert.equal(NCERT_CLASS9_RELEASE_AUDIT.exerciseSections, 42);
assert.equal(NCERT_CLASS9_RELEASE_AUDIT.sourceExerciseQuestions, 293);
assert.equal(NCERT_CLASS9_RELEASE_AUDIT.authoredCells, 32);
assert.equal(NCERT_CLASS9_RELEASE_AUDIT.generatedValidationTarget, 1280);
assert.match(NCERT_CLASS9_RELEASE_AUDIT.answerVerification, /separate Grade 9 answer-key PDF/i);

const grade9 = IN_CURRICULUM.find(g=>g.grade===9);
assert.ok(grade9, 'production Class 9 group exists');
assert.deepEqual(grade9.chapters.map(ch=>ch.id), expectedIds, 'old Grade 9 spine is atomically replaced');
assert.deepEqual(IN_CHAPTERS.filter(ch=>ch.grade===9).map(ch=>ch.id), expectedIds, 'flat Class 9 lookup agrees with picker');

let generated=0,numeric=0,conceptual=0,pages=0,exerciseSections=0,questions=0;
const generatorIds=[];
for (const [i,id] of expectedIds.entries()) {
  const content=NCERT_CLASS9_CHAPTERS[i];
  assert.equal(content.id,id,`${id}: source object order`);
  assert.equal(content.num,i+1,`${id}: chapter number`);
  assert.equal(content.pages,expectedPages[i],`${id}: uploaded page count`);
  pages+=content.pages;
  assert.equal(content.dotpoints.length,3,`${id}: three product outcomes`);
  assert.ok(content.skills.length>=7,`${id}: source skills retained`);
  assert.equal(content.sourceMap.length,4,`${id}: full source map sections`);
  assert.equal(content.notes.length,5,`${id}: dedicated topper notes`);
  assert.ok(content.notes.every(n=>n.points.length>=2&&n.formula&&n.edge),`${id}: topper notes are substantive`);
  assert.equal(content.examples.length,4,`${id}: four worked examples`);
  assert.ok(content.examples.every(e=>e.steps.length>=3&&e.answer&&e.topper),`${id}: worked examples are fully staged`);
  assert.equal(content.exercises.length,expectedExerciseSections[i],`${id}: formal exercise section count`);
  assert.equal(content.answerAudit.length,content.exercises.length,`${id}: every exercise section audited`);
  exerciseSections+=content.answerAudit.length;
  const qCount=content.answerAudit.reduce((n,x)=>n+x.sourceQuestionCount,0);
  const verified=content.answerAudit.reduce((n,x)=>n+x.verifiedQuestionCount,0);
  assert.equal(qCount,expectedFormalQuestions[i],`${id}: formal source prompt count`);
  assert.equal(verified,qCount,`${id}: every formal source prompt verified`);
  questions+=qCount;
  assert.ok(content.answerAudit.every(x=>x.status==='verified'),`${id}: answer audit status`);
  assert.ok(content.answerAudit.every(x=>/separate Grade 9 answer-key PDF/i.test(x.verificationBasis)),`${id}: transparent answer-key provenance`);
  assert.ok(content.exercises.every(ex=>content.exerciseMethods[ex]?.length>40),`${id}: solution method for every exercise`);
  assert.equal(content.questionBank.authoredCells,4,`${id}: four mastery cells`);

  const chapter=IN_CHAPTER_BY_ID[id];
  assert.ok(chapter,`${id}: production lookup`);
  assert.deepEqual(chapter.dotpoints,content.dotpoints,`${id}: production dotpoints match source layer`);
  assert.equal(chapter.covers.length,1,`${id}: one dedicated mastery family`);
  assert.deepEqual(chapter.covers[0].dp,[0,1,2],`${id}: all outcomes covered`);
  assert.deepEqual(chapter.covers[0].diff,[1,2,3,4],`${id}: all difficulty levels covered`);

  const gid=content.questionBank.generator;
  generatorIds.push(gid);
  assert.equal(bankOf(gid),'india-junior',`${gid}: production bank routing`);
  assert.equal(typeof indiaJunior[gid],'function',`${gid}: India overlay registration`);
  assert.equal(typeof NCERT_CLASS9_GENERATORS[gid],'function',`${gid}: source generator registry`);

  for(let diff=1;diff<=4;diff++) for(let sample=0;sample<40;sample++) {
    const seed=(0x9c000000+i*100000+diff*1000+sample)>>>0;
    const form=NCERT_CLASS9_GENERATORS[gid](makeRng(seed),diff);
    generated++;
    assert.ok(typeof form.prompt==='string'&&form.prompt.trim().length>8,`${gid} D${diff}: prompt`);
    assert.ok(Array.isArray(form.hints)&&form.hints.length>=3,`${gid} D${diff}: progressive hints`);
    assert.ok(Array.isArray(form.steps)&&form.steps.length>=3,`${gid} D${diff}: full worked solution`);
    assert.ok(form.steps.every(s=>s&&typeof s.h==='string'&&typeof s.d==='string'),`${gid} D${diff}: structured solution stages`);
    assert.ok(['numeric','mcq'].includes(form.answerType),`${gid} D${diff}: supported answer type`);
    if(form.answerType==='numeric'){
      numeric++;
      assert.ok(Number.isFinite(Number(form.answer?.value)),`${gid} D${diff}: finite handwriting-ready answer`);
    } else {
      conceptual++;
      assert.ok(Array.isArray(form.mcqOptions)&&form.mcqOptions.length>=2,`${gid} D${diff}: options`);
      assert.ok(Number.isInteger(form.answer?.correctIndex),`${gid} D${diff}: keyed option`);
    }
  }
}
assert.equal(pages,200,'all 200 uploaded pages represented');
assert.equal(exerciseSections,42,'all 42 formal exercise sections represented');
assert.equal(questions,293,'all 293 formal exercise prompts represented');
assert.equal(generated,1280,'8 chapters × 4 levels × 40 deterministic samples');
assert.ok(numeric>800,'substantial AI-handwriting-ready numeric practice');
assert.ok(conceptual>100,'substantial conceptual reasoning practice');

await loadBanksFor(generatorIds);
for(const id of generatorIds) assert.equal(typeof GENERATORS[id],'function',`${id}: dynamic production registry`);

console.log(`PASS — Grade 9 Ganita Manjari: ${generated} seeded forms (${numeric} numeric handwriting-ready, ${conceptual} conceptual).`);
console.log('PASS — 8/8 chapters, 200/200 uploaded pages, 42/42 formal exercise sections and 293/293 formal exercise prompts represented and verified.');
