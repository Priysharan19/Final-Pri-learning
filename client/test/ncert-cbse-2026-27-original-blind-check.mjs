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
// Allowlist, not a denylist: a public item may carry only these keys, so no answer, witness or key can ride along.
const allowed=new Set(['contentId','contentVersion','grade','track','topic','archetypeId','provenance','rights','status','sourceURL','question','hint','diagramSpec']);
for(const q of pack.questions){
 assert.ok(q.contentId&&!ids.has(q.contentId),'duplicate content identity');ids.add(q.contentId);
 assert.ok(q.archetypeId&&!archetypes.has(q.archetypeId),'fake independent reasoning archetype');archetypes.add(q.archetypeId);
 assert.ok([10,12].includes(q.grade),'incorrect grade');
 assert.ok(['CBSE-standard','CBSE-enrichment-hold-from-core'].includes(q.track)&&q.provenance.includes('not-PYQ'),'fake official past-paper provenance');
 // Every item cites the official 2026-27 syllabus PDF for its class, never an unverified sample-paper page.
 assert.match(q.sourceURL,q.grade===10?/^https:\/\/cbseacademic\.nic\.in\/web_material\/CurriculumMain27\/SecPart1\/Maths_SecP1X_2026-27\.pdf$/:/^https:\/\/cbseacademic\.nic\.in\/web_material\/CurriculumMain27\/SecPart2\/Maths_SecP2_2026-27\.pdf$/,'unverified source: '+q.contentId);
 assert.ok(q.question?.length>45&&q.hint?.length>10);
 assert.ok(!q.hint.includes('The answer is'),'leading hint exposed the solution');
 for(const key of Object.keys(q))assert.ok(allowed.has(key),'PUBLIC QUESTION CARRIES A NON-PUBLIC FIELD: '+q.contentId+' / '+key);
 // A diagram may only restate the givens: allowlisted keys, and any ratio it shows is printed in the question.
 if(q.diagramSpec!==null){
  for(const key of Object.keys(q.diagramSpec))assert.ok(['kind','vertices','parallel','ratio','notToScale'].includes(key),'diagram carries a non-public field: '+q.contentId+' / '+key);
  assert.ok(!q.diagramSpec.ratio||q.question.includes(q.diagramSpec.ratio),'diagram shows a value the question does not give: '+q.contentId);
 }
 assert.equal(q.status,'ungraded-answer-blind-public-authoring-draft');
 counts.set(q.grade,(counts.get(q.grade)||0)+1);
}
assert.equal(ids.size,12);assert.equal(archetypes.size,12);
assert.equal(counts.get(10),6);assert.equal(counts.get(12),6);
// Held from the core bank until the examiner decides: the cubic factor theorem (outside 2026-27 Class X Polynomials),
// areas of similar triangles and area between two curves (both removed in the 2023-24 rationalisation).
assert.deepEqual(pack.questions.filter(q=>q.track==='CBSE-enrichment-hold-from-core').map(q=>q.contentId).sort(),
 ['pri-original-c10-poly-factor-01','pri-original-c10-tri-area-06','pri-original-c12-area-between-09']);
// Review-only: nothing in the app or the server imports the pack until a human examiner signs it off.
const root=new URL('../..',import.meta.url).pathname;
const importers=[];
const walk=d=>{for(const n of readdirSync(d)){if(n==='node_modules'||n.startsWith('.'))continue;const p=join(d,n);if(statSync(p).isDirectory())walk(p);else if(/\.([cm]?js|jsx|tsx?)$/.test(n)&&p!==join(root,'client/src/engine/ncert/cbse-2026-27-exam-original-blind.js')&&/cbse-2026-27-exam-original-blind|CBSE_202627_ORIGINAL_EXAM_BLIND/.test(readFileSync(p,'utf8')))importers.push(p);}};
for(const d of ['client/src','server'])walk(join(root,d));
assert.deepEqual(importers,[],'the review-only pack is imported: '+importers.join(', '));
console.log('PASS 12 original CBSE X/XII questions, 12 distinct archetype identities, 6 each by grade; zero privileged solution/rubric fields in exported student items.');
console.log('Math answer verification and independent human marking review are separate restricted tasks; no server issuing or marks enabled.');
