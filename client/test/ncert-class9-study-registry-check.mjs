// Draft-only registry contract and lazy imports: no production Notes wiring.
import assert from 'node:assert/strict';
import {CLASS9_GAP_STUDIES,CLASS9_GAP_STUDY_STATUS,loadClass9GapStudy} from '../src/engine/ncert/class9-2026-27-study-registry.js';
assert.equal(CLASS9_GAP_STUDY_STATUS,'source-only-unwired-review-pending');
assert.equal(CLASS9_GAP_STUDIES.length,7);
assert.equal(new Set(CLASS9_GAP_STUDIES.map(x=>x.id)).size,7);
const seen=new Set();
let count=0;
for(const chapter of CLASS9_GAP_STUDIES){
 assert.ok(chapter.competencies.length);
 assert.ok(typeof chapter.loader==='function');
 const pack=await loadClass9GapStudy(chapter.id);
 assert.equal(pack.questions.length,12,'question count '+chapter.id);
 assert.equal(pack.workedExamples.length,3,'worked count '+chapter.id);
 assert.ok(/draft|unwired|pending/i.test(pack.status),'no unapproved certified status '+chapter.id);
 for(const item of [...pack.questions,...pack.workedExamples]){
  assert.ok(!seen.has(item.id),'duplicate global student identity '+item.id);
  seen.add(item.id);
  assert.ok(item.question&&item.answer,'missing real worked content '+item.id);
  assert.ok(item.solutionSteps?.length>=3||item.steps?.length>=3,'incomplete worked solution');
  count++;
 }
}
assert.equal(count,105);
await assert.rejects(loadClass9GapStudy('untrusted-client-path'),RangeError);
console.log('PASS 7 lazy-loaded CBSE IX source packs, 84 original student exercises, 21 worked lessons, 105 unique identities, unknown chapter rejected.');
console.log('Registry is NOT connected to Notes or to authoritative server grading.');
