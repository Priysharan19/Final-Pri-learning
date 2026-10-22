/**
 * Mission 004 -- PUBLIC answer-blind CBSE X/XII source-contract regression test.
 * Never add grading witnesses, exemplar solutions or private rubric tests here:
 * this repository is publicly readable. Mathematical reviewer verification
 * receipts are retained separately for restricted reviewer consumption.
 */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {CBSE_202627_ORIGINAL_EXAM_BLIND as pack} from '../src/engine/ncert/cbse-2026-27-exam-original-blind.js';
assert.equal(pack.questions.length,12);
assert.equal(pack.publicVisibility,'answer-blind');
assert.equal(pack.publicationState,'review-only-unwired');
assert.equal(pack.independentExaminerCertified,false,'no human examiner has certified this pack (#483)');
const ids=new Set(),archetypes=new Set();
const counts=new Map();
const forbidden=new Set(['answer','answers','solution','solutionSteps','steps','markScheme','rubric','check','proof','expected','correctAnswer','grader','privateKey','scoringKey']);
for(const q of pack.questions){
 assert.ok(q.contentId&&!ids.has(q.contentId),'duplicate content identity');ids.add(q.contentId);
 assert.ok(q.archetypeId&&!archetypes.has(q.archetypeId),'fake independent reasoning archetype');archetypes.add(q.archetypeId);
 assert.ok([10,12].includes(q.grade),'incorrect grade');
 assert.ok(['CBSE-standard','CBSE-enrichment-hold-from-core'].includes(q.track)&&q.provenance.includes('not-PYQ'),'fake official past-paper provenance');
 // Every item cites the official 2026-27 syllabus PDF for its class, never an unverified sample-paper page.
 assert.match(q.sourceURL,q.grade===10?/^https:\/\/cbseacademic\.nic\.in\/web_material\/CurriculumMain27\/SecPart1\/Maths_SecP1X_2026-27\.pdf$/:/^https:\/\/cbseacademic\.nic\.in\/web_material\/CurriculumMain27\/SecPart2\/Maths_SecP2_2026-27\.pdf$/,'unverified source: '+q.contentId);
 assert.ok(q.question?.length>45&&q.hint?.length>10);
 assert.ok(!q.hint.includes('The answer is'),'leading hint exposed the solution');
 for(const key of forbidden)assert.ok(!(key in q),'PUBLIC QUESTION CONTAINS PRIVILEGED ANSWER FIELD: '+q.contentId+' / '+key);
 assert.equal(q.status,'ungraded-answer-blind-public-authoring-draft');
 counts.set(q.grade,(counts.get(q.grade)||0)+1);
}
assert.equal(ids.size,12);assert.equal(archetypes.size,12);
assert.equal(counts.get(10),6);assert.equal(counts.get(12),6);
// The cubic factor-theorem item is outside core 2026-27 Class X Polynomials: it stays held from the core bank.
assert.equal(pack.questions.find(q=>q.contentId==='pri-original-c10-poly-factor-01').track,'CBSE-enrichment-hold-from-core');
// Review-only: nothing in the app or the server imports the pack until a human examiner signs it off.
const root=new URL('../..',import.meta.url).pathname;
const importers=[];
const walk=d=>{for(const n of readdirSync(d)){if(n==='node_modules'||n.startsWith('.'))continue;const p=join(d,n);if(statSync(p).isDirectory())walk(p);else if(/\.(m?js|jsx)$/.test(n)&&readFileSync(p,'utf8').includes('cbse-2026-27-exam-original-blind'))importers.push(p);}};
for(const d of ['client/src','server'])walk(join(root,d));
assert.deepEqual(importers,[],'the review-only pack is imported: '+importers.join(', '));
console.log('PASS 12 original CBSE X/XII questions, 12 distinct archetype identities, 6 each by grade; zero privileged solution/rubric fields in exported student items.');
console.log('Math answer verification and independent human marking review are separate restricted tasks; no server issuing or marks enabled.');
