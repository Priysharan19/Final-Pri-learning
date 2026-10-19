import assert from 'node:assert/strict';
import {class9OutcomeSupplements202627 as pack} from '../src/engine/ncert/class9-2026-27-outcome-supplements.js';
// Original CBSE 2026–27 outcome-correction witnesses are recomputed from parameters.
assert.equal(pack.questions.length,8);assert.equal(pack.workedExamples.length,2);
const all=[...pack.workedExamples,...pack.questions],ids=new Set(),archetypes=new Map();
let checks=0,answers=0;
function validate(q){
 assert.ok(!ids.has(q.id),q.id+' repeated');ids.add(q.id);checks++;
 assert.equal(q.steps.length,3);assert.ok(q.prompt&&q.answer&&(!q.hint||q.hint!==q.answer));checks+=3;
 const d=q.data;
 if(d.type==='square-pyramid'){
  const slant=Math.hypot(d.h,d.a/2),area=d.a*d.a+2*d.a*slant,vol=d.a*d.a*d.h/3;
  assert.equal(slant,d.l);assert.equal(area,d.area);assert.equal(vol,d.volume);
  for(const s of ['slant '+slant+' cm','total area '+area+' cm²','volume '+vol+' cm³'])assert.ok(q.answer.includes(s),q.id+' displayed value '+s);
  assert.ok(q.steps.some(s=>s.includes(String(vol))),'incorrect worked volume');
  checks+=7;
 }else if(d.type==='vertical-proof'){
  assert.ok(q.prompt.includes('opposite angles'));
  assert.ok(q.steps[1].includes('180°')&&q.steps[2].includes('Subtract'));
  assert.ok(q.answer.includes('∠'+d.first+'=∠'+d.second));
  checks+=4;
 }else if(d.type==='two-line-graph'){
  const [[a,b,c],[e,f,g]]=d.equations,[x,y]=d.intersection,det=a*f-b*e;
  assert.notEqual(det,0);
  assert.equal(x,(c*f-b*g)/det);assert.equal(y,(a*g-c*e)/det);
  assert.equal(a*x+b*y,c);assert.equal(e*x+f*y,g);
  assert.equal(d.plot.length,2);
  for(let i=0;i<2;i++){const [u,v,w]=d.equations[i];for(const [px,py] of d.plot[i])assert.equal(u*px+v*py,w,'invalid graph point');}
  assert.ok(q.answer.includes('intersection ('+x+','+y+')'),'wrong shown intersection');
  assert.ok(q.steps.some(s=>s.includes('('+x+','+y+')')),'correct point missing from reasoning');
  checks+=12;
 }else if(d.type==='ssa-ray'){
  const theta=d.angleDeg*Math.PI/180,projection=d.adjacent*Math.cos(theta);
  const disc=d.opposite**2-(d.adjacent*Math.sin(theta))**2;
  assert.ok(disc>0);
  const roots=[projection+Math.sqrt(disc),projection-Math.sqrt(disc)];
  assert.equal(roots.filter(t=>t>0).length,d.positiveRoots);
  for(const t of roots.filter(t=>t>0)){
    const px=t*Math.cos(theta),py=t*Math.sin(theta);
    assert.ok(Math.abs((px-d.adjacent)**2+py**2-d.opposite**2)<1e-8);
  }
  if(d.positiveRoots===2)assert.ok(q.answer.includes('two distinct triangles')&&q.answer.includes('±2√6'));
  else assert.ok(q.answer.includes('one triangle')&&q.answer.includes('+√119'));
  checks+=7;
 }else if(d.type==='stat-investigation'){
  const shares=d.counts.map((n,i)=>100*n/d.totals[i]);
  assert.deepEqual(shares,d.shares);
  assert.equal(Math.abs(shares[1]-shares[0]),d.gap);
  assert.ok(q.answer.includes('100%-stacked')&&q.answer.includes(''+shares[0]+'%')&&q.answer.includes(''+shares[1]+'%'));
  assert.ok(q.steps.some(s=>s.includes('percentage points')),'percent versus percentage points');
  checks+=5;
 }else assert.fail('unknown verification method: '+d.type);
 answers++;
 if(q.archetype)archetypes.set(q.archetype,(archetypes.get(q.archetype)||0)+1);
}
for(const q of all)validate(q);
assert.equal(ids.size,10);assert.equal(archetypes.size,4);
for(const [id,n] of archetypes)assert.equal(n,2,id+' lacks distinct example');
console.log('PASS M004 competency supplements: 10 items (8 exercises and 2 worked), 4 original archetypes, '+checks+' derived checks.');
console.log('Pending independent mathematical proof review and browser rendered diagrams.');
