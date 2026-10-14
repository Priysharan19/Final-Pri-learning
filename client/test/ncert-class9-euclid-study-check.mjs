// Structure/countermodel audit for original Euclid's Geometry.
import assert from 'node:assert/strict';
import { class9Euclid202627 as pack } from '../src/engine/ncert/class9-2026-27-euclid-studies.js';
assert.equal(pack.questions.length,12);
assert.equal(pack.workedExamples.length,3);
const ids=new Set(),families=new Map();
let n=0;
function audit(x){
 assert.ok(x.id&&!ids.has(x.id));ids.add(x.id);n++;
 assert.ok(x.question&&x.answer&&x.steps?.length===3);n++;
 const p=x.proof;assert.ok(p);n++;
 if(p.kind==='chain'||p.kind==='chain-add'){
  assert.ok(p.values.every(z=>z===p.values[0]),'transitivity premise violated');
  assert.equal(new Set(p.values).size,1);n+=2;
 }else if(p.kind==='segments-add'){
  assert.equal(p.left.length,2);assert.equal(p.right.length,2);
  assert.equal(p.left[0],p.right[0]);assert.equal(p.left[1],p.right[1]);
  assert.equal(p.left[0]+p.left[1],p.right[0]+p.right[1]);n+=3;
 }else if(p.kind==='segments-subtract'){
  assert.ok(p.whole.every(z=>z>p.part[0]));
  assert.deepEqual(p.whole,[p.whole[0],p.whole[0]]);
  assert.deepEqual(p.part,[p.part[0],p.part[0]]);
  assert.equal(p.whole[0]-p.part[0],p.remainder);
  assert.ok(x.answer.includes(''+p.remainder),'student answer differs from subtraction');n+=5;
 }else if(p.kind==='rectangle-area-countermodel'){
  assert.equal(p.a[0]*p.a[1],p.b[0]*p.b[1]);
  assert.notDeepEqual([...p.a].sort((a,b)=>a-b),[...p.b].sort((a,b)=>a-b));
  assert.equal(x.figure?.rectangles.length,2);n+=3;
 }else if(p.kind==='rectangle-perimeter-countermodel'){
  assert.equal(p.a[0]+p.a[1],p.b[0]+p.b[1]);
  assert.notEqual(p.a[0]*p.a[1],p.b[0]*p.b[1]);
  assert.ok(x.answer.includes(''+p.a[0]*p.a[1])&&x.answer.includes(''+p.b[0]*p.b[1]));
  n+=3;
 }else if(p.kind==='unique-line'){
  assert.equal(p.distinct,true);
  assert.equal(p.count,1);n+=2;
 }else if(p.kind==='playfair'){
  assert.equal(p.pointOff,true);
  assert.equal(p.parallelCount,1);
  assert.ok(/parallel|coincide/i.test(x.answer),'the student-facing answer must identify uniqueness or coincidence');n+=3;
 }else if(p.kind==='square'){
  assert.ok(p.side>0);
  assert.equal(p.diagonalSquared,2*p.side*p.side);
  assert.ok(x.answer.includes(p.side+'√2'));n+=3;
 }else assert.fail('unknown justification '+p.kind);
 if(x.archetypeId)families.set(x.archetypeId,(families.get(x.archetypeId)||0)+1);
}
for(const x of [...pack.workedExamples,...pack.questions])audit(x);
assert.equal(ids.size,15);
assert.equal(families.size,6);
for(const [k,v] of families)assert.equal(v,2,k+' missing second non-identical task');
assert.ok(pack.scopeNotes.some(x=>x.includes('not yet covered')),'must not claim Sulbasutra historical coverage');
console.log('PASS Class IX Euclid: 15 study items / 6 archetypes / '+n+' axiomatic-witness, geometric and countermodel checks.');
console.log('Not a proof checker for Euclidean axiom independence; human logic reviewer required.');
