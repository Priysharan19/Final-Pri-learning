/**
 * Mission 004 -- PUBLIC answer-blind CBSE X/XII source-contract regression test.
 * Never add grading witnesses, exemplar solutions or private rubric tests here:
 * this repository is publicly readable. Mathematical reviewer verification
 * receipts are retained separately for restricted reviewer consumption.
 */
import assert from 'node:assert/strict';
import {CBSE_202627_ORIGINAL_EXAM_BLIND as pack} from '../src/engine/ncert/cbse-2026-27-exam-original-blind.js';
assert.equal(pack.questions.length,12);
assert.equal(pack.publicVisibility,'answer-blind');
assert.equal(pack.publicationState,'review-only-unwired');
const ids=new Set(),archetypes=new Set();
const counts=new Map();
const forbidden=new Set(['answer','answers','solution','solutionSteps','steps','markScheme','rubric','check','proof','expected','correctAnswer','grader','privateKey','scoringKey']);
for(const q of pack.questions){
 assert.ok(q.contentId&&!ids.has(q.contentId),'duplicate content identity');ids.add(q.contentId);
 assert.ok(q.archetypeId&&!archetypes.has(q.archetypeId),'fake independent reasoning archetype');archetypes.add(q.archetypeId);
 assert.ok([10,12].includes(q.grade),'incorrect grade');
 assert.ok(q.track==='CBSE-standard'&&q.provenance.includes('not-PYQ'),'fake official past-paper provenance');
 assert.ok(q.question?.length>45&&q.hint?.length>10);
 assert.ok(!q.hint.includes('The answer is'),'leading hint exposed the solution');
 for(const key of forbidden)assert.ok(!(key in q),'PUBLIC QUESTION CONTAINS PRIVILEGED ANSWER FIELD: '+q.contentId+' / '+key);
 assert.equal(q.status,'ungraded-answer-blind-public-authoring-draft');
 counts.set(q.grade,(counts.get(q.grade)||0)+1);
}
assert.equal(ids.size,12);assert.equal(archetypes.size,12);
assert.equal(counts.get(10),6);assert.equal(counts.get(12),6);
console.log('PASS 12 original CBSE X/XII questions, 12 distinct archetype identities, 6 each by grade; zero privileged solution/rubric fields in exported student items.');
console.log('Math answer verification and independent human marking review are separate restricted tasks; no server issuing or marks enabled.');
