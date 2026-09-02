import assert from 'node:assert/strict';
import {
  NCERT_CLASS10_CONTENT,
  NCERT_CLASS10_IDS,
  NCERT_CLASS10_RELEASE_AUDIT
} from '../src/engine/ncert/class10-content.js';
import { NCERT_CLASS10_EXERCISE_AUDIT } from '../src/engine/ncert/class10-exercise-audit.js';
import {
  CBSE_CLASS10_2026_27_CHAPTERS,
  CBSE_CLASS10_2026_27_REVIEWED_IDS
} from '../src/engine/ncert/class10-2026-27-production.js';
import { IN_CURRICULUM, uncoveredDotpoints } from '../src/engine/curriculum-in.js';
import { GENERATORS, loadBanksFor } from '../src/engine/generators/index.js';

const expectedIds=[
  'c10-real-numbers','c10-polynomials','c10-pair-linear-equations','c10-quadratic-equations',
  'c10-arithmetic-progressions','c10-triangles','c10-coordinate-geometry','c10-trigonometry',
  'c10-trig-applications','c10-circles','c10-areas-circles','c10-surface-volume','c10-statistics','c10-probability'
];
const expectedPages=[9,14,15,10,24,26,12,18,15,10,7,15,26,16];
const expectedExerciseCounts=[2,2,3,3,4,3,2,3,1,2,1,2,3,1];
const expectedQuestions=[10,3,12,13,49,29,20,18,15,17,14,18,22,25];

assert.deepEqual(NCERT_CLASS10_IDS,expectedIds,'14 uploaded Class X chapters remain in NCERT order');
assert.equal(NCERT_CLASS10_CONTENT.length,14);
assert.equal(NCERT_CLASS10_RELEASE_AUDIT.chapterCount,14);
assert.equal(NCERT_CLASS10_RELEASE_AUDIT.sourcePages,217);
assert.equal(NCERT_CLASS10_RELEASE_AUDIT.ncertWorkedExamples,118);
assert.equal(NCERT_CLASS10_RELEASE_AUDIT.exerciseBlocks,32);
assert.equal(NCERT_CLASS10_RELEASE_AUDIT.sourceExerciseQuestions,265);
assert.equal(NCERT_CLASS10_RELEASE_AUDIT.suppliedAnswerAppendixBlocks,31);
assert.equal(NCERT_CLASS10_RELEASE_AUDIT.suppliedAnswerExplicitEntries,230);
assert.equal(NCERT_CLASS10_RELEASE_AUDIT.noExplicitAppendixAnswerQuestions,32);
assert.equal(NCERT_CLASS10_RELEASE_AUDIT.topperNotes,70);
assert.equal(NCERT_CLASS10_RELEASE_AUDIT.priWorkedExamples,56);
assert.equal(NCERT_CLASS10_RELEASE_AUDIT.generatedDifficultyCells,56);

let pages=0,exerciseBlocks=0,questions=0,notes=0,examples=0,absentBlocks=0;
for(const [i,ch] of NCERT_CLASS10_CONTENT.entries()){
  assert.equal(ch.id,expectedIds[i],`${ch.id}: source order`);
  assert.equal(ch.num,i+1,`${ch.id}: chapter number`);
  assert.equal(ch.pages,expectedPages[i],`${ch.id}: source pages`);
  pages+=ch.pages;
  assert.ok(/^\d+-10th\.pdf$/.test(ch.sourceFile),`${ch.id}: uploaded source filename`);
  assert.equal(ch.sourceMap.length,4,`${ch.id}: full source map`);
  assert.equal(ch.notes.length,5,`${ch.id}: five dedicated topper notes`);
  assert.ok(ch.notes.every(n=>n.level==='TOPPER'&&n.points.length>=2&&n.formula&&n.trap),`${ch.id}: substantive topper notes`);
  notes+=ch.notes.length;
  assert.equal(ch.examples.length,4,`${ch.id}: four Pri worked examples`);
  assert.ok(ch.examples.every(e=>e.steps.length>=3&&e.answer&&e.topper),`${ch.id}: staged solutions`);
  examples+=ch.examples.length;
  assert.equal(ch.exercises.length,expectedExerciseCounts[i],`${ch.id}: exercise-set count`);
  exerciseBlocks+=ch.exercises.length;
  const q=ch.exercises.reduce((n,x)=>n+x.sourceQuestionCount,0);
  assert.equal(q,expectedQuestions[i],`${ch.id}: top-level source question count`);
  questions+=q;
  assert.ok(ch.exercises.every(x=>x.status==='verified'),`${ch.id}: every exercise audited`);
  absentBlocks+=ch.exercises.filter(x=>x.appendix==='absent').length;
  assert.deepEqual(ch.questionBank.difficulties,[1,2,3,4],`${ch.id}: D1-D4 practice`);
  assert.equal(ch.questionBank.offline,true,`${ch.id}: offline`);
  assert.equal(ch.questionBank.ipad,true,`${ch.id}: iPad`);
  assert.equal(ch.questionBank.pencil,true,`${ch.id}: Apple Pencil`);
  assert.equal(ch.questionBank.priReason,true,`${ch.id}: Pri Reason`);
}
assert.equal(pages,217);
assert.equal(exerciseBlocks,32);
assert.equal(questions,265);
assert.equal(notes,70);
assert.equal(examples,56);
assert.equal(absentBlocks,1,'only Exercise 1.2 lacks a dedicated Answers/Hints block');
const ex12=NCERT_CLASS10_CONTENT[0].exercises.find(x=>x.exercise==='1.2');
assert.equal(ex12?.appendix,'absent');
assert.match(ex12?.note||'',/No EXERCISE 1\.2 block|no dedicated/i);
assert.match(ex12?.note||'',/theorem|contradiction/i);

// One row per top-level source question prevents an aggregate chapter count from
// hiding a dropped exercise item. Rows describe verification authority without
// duplicating the copyrighted source wording.
assert.equal(NCERT_CLASS10_EXERCISE_AUDIT.length,265,'every top-level textbook exercise question has an audit identity');
assert.equal(new Set(NCERT_CLASS10_EXERCISE_AUDIT.map(row=>row.id)).size,265,'exercise audit identities must be unique');
assert.ok(NCERT_CLASS10_EXERCISE_AUDIT.every(row=>row.status==='verified'));
assert.ok(NCERT_CLASS10_EXERCISE_AUDIT.every(row=>row.solutionContract.progressiveHints&&row.solutionContract.workedSolution&&row.solutionContract.finalAnswer&&row.solutionContract.handwriting&&row.solutionContract.priReason&&row.solutionContract.offline));
const ex12Rows=NCERT_CLASS10_EXERCISE_AUDIT.filter(row=>row.exercise==='1.2');
assert.equal(ex12Rows.length,3);
assert.ok(ex12Rows.every(row=>row.answerBlockPresent===false&&row.verificationBasis==='source-theorem-proof-method'));
assert.equal(NCERT_CLASS10_EXERCISE_AUDIT.filter(row=>row.answerBlockPresent).length,262,'all questions outside Exercise 1.2 belong to exercise blocks represented in the supplied appendix');

// Current-exam truth remains a separate, fail-closed contract. Full-book-only
// material may be taught but must not silently become an examinable outcome.
const grade10=IN_CURRICULUM.find(g=>g.grade===10);
assert.ok(grade10);
assert.equal(CBSE_CLASS10_2026_27_CHAPTERS.length,14);
assert.equal(CBSE_CLASS10_2026_27_REVIEWED_IDS.size,14,'all current Class X chapters are reviewed');
for(const ch of grade10.chapters) assert.equal(uncoveredDotpoints(ch).length,0,`${ch.id}: no current outcome uncovered`);
const currentText=CBSE_CLASS10_2026_27_CHAPTERS.map(ch=>ch.dotpoints.join(' ')).join(' ').toLowerCase();
assert.ok(!currentText.includes('division algorithm'),'book-only polynomial/Euclid division material is not promoted');
assert.ok(!currentText.includes('ogive'),'book-only ogive material is not promoted');
assert.ok(!currentText.includes('recast'),'book-only recasting material is not promoted');
assert.ok(NCERT_CLASS10_CONTENT.some(ch=>ch.sourceMap.some(s=>s.currentExam===false)),'book-only source material is retained explicitly');

const currentGenerators=[...new Set(CBSE_CLASS10_2026_27_CHAPTERS.flatMap(ch=>ch.covers.map(c=>c.gen)))];
await loadBanksFor(currentGenerators);
for(const id of currentGenerators) assert.equal(typeof GENERATORS[id],'function',`${id}: production generator loads`);

console.log(`PASS — NCERT Class X full book: ${NCERT_CLASS10_CONTENT.length}/14 chapters, ${pages}/217 pages, ${exerciseBlocks}/32 exercise blocks, ${questions}/265 top-level source questions.`);
console.log(`PASS — ${NCERT_CLASS10_EXERCISE_AUDIT.length}/265 exercise audit identities, ${notes} topper notes, ${examples} worked examples, D1-D4 + offline/iPad/Pencil/Pri Reason contracts.`);
console.log('PASS — supplied Answers/Hints coverage is represented honestly: 31/32 exercise blocks; Exercise 1.2 is theorem-derived because the appendix has no dedicated block.');
