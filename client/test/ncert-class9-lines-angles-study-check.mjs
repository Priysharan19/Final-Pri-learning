// Independent numerical and geometric premise test for Class IX Lines & Angles.
import assert from 'node:assert/strict';
import { class9LinesAngles202627 as pack } from '../src/engine/ncert/class9-2026-27-lines-angles-studies.js';
assert.equal(pack.workedExamples.length,3);assert.equal(pack.questions.length,12);
let checks=0;const ids=new Set(),families=new Map();
for(const x of [...pack.workedExamples,...pack.questions]){
 assert.ok(!ids.has(x.id));ids.add(x.id);checks++;
 assert.ok(x.question&&x.answer&&x.steps?.length===3);checks++;
 const p=x.proof;
 if(p.kind==='linear-pair'||p.kind==='co-interior'){
  const measures=p.forms.map(([a,b])=>a*p.x+b);
  assert.deepEqual(measures,p.angles);
  assert.equal(measures[0]+measures[1],180);
  assert.ok(measures.every(a=>a>0&&a<180));
  for(const v of [p.x,...measures])assert.ok(x.answer.includes(''+v));
  checks+=7;
 }else if(p.kind==='vertical'){
  const [a,b]=p.forms.map(([m,c])=>m*p.x+c);
  assert.equal(a,b);assert.equal(a,p.angle);
  assert.ok(a>0&&a<180);
  assert.ok(x.answer.includes(''+p.x)&&x.answer.includes(''+a));
  checks+=5;
 }else if(p.kind==='corresponding'){
  assert.equal(p.theta,p.corresponding);
  assert.equal(p.corresponding+p.adjacent,180);
  assert.ok(x.answer.includes(''+p.corresponding)&&x.answer.includes(''+p.adjacent));
  if(x.figure){
   assert.equal(x.figure.parallelY.length,2);
   assert.notEqual(...x.figure.parallelY);
   const rayDeg=x.figure.transversalDeg;
   assert.ok(Math.abs(Math.sin(rayDeg*Math.PI/180))>0.01);
   const actualSector=x.figure.sector==='obtuse'?180-rayDeg:rayDeg;
   assert.equal(actualSector,p.theta,'diagram sector angle must match reported angle');
   checks+=4;
  }
  checks+=3;
 }else if(p.kind==='alternate-converse'){
  assert.ok(p.angles.every(z=>z===p.angles[0]));
  assert.equal(p.parallel,true);
  assert.ok(/parallel/i.test(x.answer));
  if(x.figure)assert.notEqual(x.figure.parallelY[0],x.figure.parallelY[1]);
  checks+=4;
 }else if(p.kind==='nonparallel-corresponding'){
  assert.notEqual(p.angles[0],p.angles[1]);
  assert.equal(p.parallel,false);
  assert.ok(/not parallel/i.test(x.answer));checks+=3;
 }else if(p.kind==='nonparallel-cointerior'){
  assert.notEqual(p.angles[0]+p.angles[1],180);
  assert.equal(p.parallel,false);
  assert.ok(/not parallel/i.test(x.answer));checks+=3;
 }else assert.fail('unrecognised case '+p.kind);
 if(x.archetypeId)families.set(x.archetypeId,(families.get(x.archetypeId)||0)+1);
}
assert.equal(ids.size,15);assert.equal(families.size,6);
for(const [id,n] of families)assert.equal(n,2,id+' incomplete pair');
console.log('PASS Lines and Angles: 15 complete items, 6 archetypes, '+checks+' checks (including diagram acute/obtuse sectors). Independent proof review pending.');
