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
// #408/#485: "purely imaginary" was ambiguous at z=1, where w=0. The item now
// states the real-part condition and that w=0 is included, both ways round.
{
 const q3=pack.questions.find(q=>q.id==='pri-jee-adv-cplx-03');
 assert.ok(q3,'pri-jee-adv-cplx-03 exists');
 assert.ok(!/purely imaginary/i.test(q3.question),'cplx-03 does not use the ambiguous "purely imaginary"');
 assert.ok(/Re\(w\)=0/.test(q3.question)&&/w=0 included/.test(q3.question)&&/converse/.test(q3.question),'cplx-03 states Re(w)=0, includes w=0 and asks for the converse');
 assert.notEqual(q3.version,'2026.10.14.1','cplx-03 carries a new item version after its wording change');
}
console.log('PASS JEE 20/20 answer-blind original questions: 20 stable identities/archetypes; zero private solutions; no answer-revealing Argand figures; no false D4 certification.');
console.log('Restricted mathematical and difficulty assessments remain mandatory.');
