// Independent numeric/graph test for original Class IX 2026–27 Statistics studies.
// Run: node client/test/ncert-class9-statistics-study-check.mjs
import assert from 'node:assert/strict';
import { class9Statistics202627 as pack } from '../src/engine/ncert/class9-2026-27-statistics-studies.js';
assert.equal(pack.status, 'draft-unwired-independent-review-pending');
assert.equal(pack.questions.length,12);
assert.equal(pack.workedExamples.length,3);
const all=[...pack.workedExamples,...pack.questions];
const ids=new Set(),archetypes=new Map();
let checks=0;
const sum=a=>a.reduce((x,y)=>x+y,0);
const near=(x,y)=>Math.abs(x-y)<1e-10;
const median=a=>{const v=[...a].sort((x,y)=>x-y);const n=v.length;return n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2};
for(const q of all){
 assert.ok(q.id&&!ids.has(q.id));ids.add(q.id);checks++;
 assert.ok(q.question&&q.answer&&q.steps?.length===3);checks++;
 const w=q.check;assert.ok(w);checks++;
 if(w.kind==='weighted'){
  assert.equal(w.values.length,w.freq.length);
  assert.ok(w.freq.every(z=>Number.isInteger(z)&&z>0));
  const weighted=sum(w.values.map((v,i)=>v*w.freq[i]))/sum(w.freq);
  assert.ok(near(weighted,w.mean),'weighted mean wrong: '+q.id);checks+=3;
 }else if(w.kind==='missing'){
  assert.equal(w.freq.filter(z=>z===null).length,1);
  const weights=w.freq.map((v,i)=>i===w.unknownIndex?w.x:v);
  assert.ok(Number.isInteger(w.x)&&w.x>=0);
  assert.ok(near(sum(weights.map((f,i)=>f*w.values[i]))/sum(weights),w.mean),'missing frequency wrong');
  checks+=3;
 }else if(w.kind==='stacked'){
  assert.equal(w.groups.length,w.percentages.length);
  for(let i=0;i<w.groups.length;i++){
   const g=w.groups[i];
   assert.ok(g.every(x=>Number.isInteger(x)&&x>=0));
   assert.ok(near(100*g[w.focusIndex]/sum(g),w.percentages[i]),'stacked share wrong');
   checks+=2;
  }
  assert.ok(q.figure?.groups?.length===2,'stacked chart unavailable');
  for(let i=0;i<2;i++)assert.deepEqual(q.figure.groups[i].segments,w.groups[i],'diagram count misrepresentation');
  checks+=3;
 }else if(w.kind==='stacked-single'){
  assert.ok(near(100*w.values[w.focusIndex]/sum(w.values),w.pct),'stacked single wrong');checks++;
 }else if(w.kind==='percent-to-count'){
  assert.ok(near(w.total*w.pct/100,w.count));
  assert.ok(Number.isInteger(w.count)&&w.count>=0);checks+=2;
 }else if(w.kind==='outlier'){
  const original=w.original,updated=[...original,w.added];
  assert.ok(near(sum(original)/original.length,w.meanBefore));
  assert.ok(near(sum(updated)/updated.length,w.meanAfter));
  assert.ok(near(median(original),w.medianBefore));
  assert.ok(near(median(updated),w.medianAfter));
  checks+=4;
 }else if(w.kind==='share-count'){
  for(let i=0;i<w.totals.length;i++){
   assert.ok(near(w.totals[i]*w.pcts[i]/100,w.counts[i]));
   checks++;
  }
 }else assert.fail('unknown mathematical witness '+w.kind);
 if(q.archetypeId)archetypes.set(q.archetypeId,(archetypes.get(q.archetypeId)||0)+1);
}
assert.equal(ids.size,15);
assert.equal(archetypes.size,6);
for(const [k,n] of archetypes)assert.equal(n,2,k+' has wrong instance count');
console.log('PASS Class IX statistics: 15 complete items; 6 distinct arithmetic/data-reasoning archetypes; '+checks+' independent numerical and graphic invariants.');
console.log('Unwired draft; not human examiner-certified; no real-browser graph rendering asserted.');
