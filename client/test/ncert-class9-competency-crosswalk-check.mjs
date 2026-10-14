// Official Class IX 2026–27 crosswalk source referential integrity.
// This is a source-audit, not a historical/current-competency examiner certification.
import assert from 'node:assert/strict';
import {CLASS9_202627_ACCEPTANCE_CROSSWALK as map} from '../src/engine/ncert/class9-2026-27-competency-crosswalk.js';
import {NCERT_CLASS9_SYLLABUS as overlay} from '../src/engine/ncert/class9-syllabus.js';
import {CLASS9_GAP_STUDIES,loadClass9GapStudy} from '../src/engine/ncert/class9-2026-27-study-registry.js';
import {class9OutcomeSupplements202627 as corrections} from '../src/engine/ncert/class9-2026-27-outcome-supplements.js';
const ids=new Set([...corrections.questions,...corrections.workedExamples].map(x=>x.id));
for(const chapter of CLASS9_GAP_STUDIES){
 const pack=await loadClass9GapStudy(chapter.id);
 for(const item of [...pack.questions,...pack.workedExamples]){assert.ok(!ids.has(item.id));ids.add(item.id);}
}
assert.equal(ids.size,115,'must account for 105 initial items and 10 corrections');
const overlayIds=new Set(overlay.map(x=>x.id));
assert.equal(overlayIds.size,8,'existing eight Part I chapters must remain separate');
let partial=0,uncovered=0,checked=0;
for(const outcome of map.outcomes){
 assert.ok(outcome.id&&outcome.chapter&&outcome.reason);
 assert.ok(['covered','partially covered','uncovered','out of scope','partial'].includes(outcome.state));
 if(outcome.state==='partial'||outcome.state==='partially covered'){
  partial++;
  assert.ok(outcome.evidence.length>0,outcome.id+' partial mapping needs authored example');
 }else if(outcome.state==='uncovered'){
  uncovered++;assert.equal(outcome.evidence.length,0,outcome.id+' uncovered cannot claim new evidence');
 }
 for(const id of outcome.evidence){assert.ok(ids.has(id),'missing cited study identity '+id);checked++;}
 for(const id of outcome.existingOverlay)assert.ok(overlayIds.has(id),'missing live Part I cross-reference '+id);
 assert.equal(outcome.studentVisible,false,'unwired correction must not claim live');
 assert.equal(outcome.reviewedByIndependentExaminer,false,'no fabricated review approval');
}
assert.equal(map.outcomes.length,27);
assert.equal(partial,18);assert.equal(uncovered,9);
console.log('PASS 27 CBSE IX evidence-mapped suboutcomes: 18 PARTIAL, 9 UNCOVERED, '+checked+' valid new-source ID references; original eight Part I IDs preserved.');
console.log('The map covers selected seven undedicated chapters, not the full official 15-chapter annual syllabus.');
