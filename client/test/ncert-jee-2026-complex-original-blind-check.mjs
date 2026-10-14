// Public answer-blind JEE Advanced Complex Numbers source integrity test.
// Do not import reviewer/privileged mathematical solutions in this PUBLIC repository.
import assert from 'node:assert/strict';
import {JEE_2026_COMPLEX_ORIGINAL_BLIND as pack} from '../src/engine/ncert/jee-2026-complex-original-blind.js';
assert.equal(pack.questions.length,20);assert.equal(pack.verifiedStudentProblems,20);
assert.equal(pack.independentExaminerCertified,false);
assert.equal(pack.publicVisibility,'answer-blind-only');
const ids=new Set(),archetypes=new Set();
const prohibited=new Set(['answer','correctAnswer','workedSolution','solution','solutionSteps','steps','markScheme','rubric','proof','verifier','check','scoringKey','privateReview','equalityAnswer']);
for(const q of pack.questions){
 assert.ok(!ids.has(q.id));ids.add(q.id);
 assert.ok(!archetypes.has(q.archetypeId));archetypes.add(q.archetypeId);
 assert.ok(q.track==='JEE-Advanced' && q.original===true);
 assert.ok(q.difficulty.includes('review-pending') && !/D4|hardest|certified-hard/i.test(q.difficulty));
 assert.ok(q.question.length>=20 && q.firstHint.length>=15);
 assert.equal(q.diagram,null,'solved locus figure would leak answer before attempt');
 for(const key of prohibited)assert.ok(!(key in q),'private scoring data in public source: '+key);
 assert.ok(q.reviewState.includes('blind-difficulty-review-pending'));
}
assert.equal(ids.size,20);assert.equal(archetypes.size,20);
console.log('PASS JEE 20/20 answer-blind original questions: 20 stable identities/archetypes; zero private solutions; no answer-revealing Argand figures; no false D4 certification.');
console.log('Restricted mathematical and difficulty assessments remain mandatory.');
