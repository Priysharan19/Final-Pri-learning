// Deterministic example-specific vector and theorem-hypothesis checks.
import assert from 'node:assert/strict';
import { class9Quadrilaterals202627 as pack } from '../src/engine/ncert/class9-2026-27-quadrilaterals-studies.js';
assert.equal(pack.questions.length,12);assert.equal(pack.workedExamples.length,3);
const ids=new Set(),families=new Map();let checks=0;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],half=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const norm=a=>Math.hypot(...a);
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
for(const x of [...pack.workedExamples,...pack.questions]){
 assert.ok(x.id&&!ids.has(x.id));ids.add(x.id);checks++;
 assert.ok(x.question&&x.answer&&(x.steps?.length===3));checks++;
 const p=x.witness;
 if(p.kind==='fourth'){
  eq(p.D,sub(add(p.A,p.C),p.B),'fourth vertex');
  eq(sub(p.B,p.A),sub(p.C,p.D),'AB=DC directed');
  eq(sub(p.C,p.B),sub(p.D,p.A),'BC=AD directed');
  assert.ok(x.answer.includes(''+p.D[0])&&x.answer.includes(''+p.D[1]));checks++;
 }else if(p.kind==='diagonals'){
  const [A,B,C,D]=p.points;
  eq(half(A,C),half(B,D),'common diagonal midpoint');
  eq(half(A,C),p.midpoint,'stated midpoint');
  const area=Math.abs(sub(B,A)[0]*sub(D,A)[1]-sub(B,A)[1]*sub(D,A)[0]);
  assert.ok(area>0,'nondegenerate quadrilateral');
  assert.ok(x.answer.includes(''+p.midpoint[0]));checks+=2;
 }else if(p.kind==='midsegment'){
  eq(p.D,half(p.A,p.B),'D midpoint AB');
  eq(p.E,half(p.A,p.C),'E midpoint AC');
  eq(sub(p.C,p.B),sub(add(p.E,p.E),add(p.D,p.D)),'BC=2DE');
  const de=sub(p.E,p.D),bc=sub(p.C,p.B);
  assert.equal(de[0]**2+de[1]**2,p.DE2,'DE squared from coordinates');
  assert.equal(bc[0]**2+bc[1]**2,4*p.DE2,'BC squared from coordinates');
  assert.ok(x.answer.includes('DE='+p.DEtext)&&x.answer.includes('BC='+p.BCtext),'incorrect student-facing midsegment lengths');
  assert.ok(x.answer.includes('DE∥BC'));checks+=4;
 }else if(p.kind==='midpoint-converse'){
  assert.equal(p.onSegment,true);assert.equal(p.parallel,true);
  assert.equal(2*p.half,p.length);
  assert.ok(x.answer.includes(''+p.half));checks+=4;
 }else if(p.kind==='centroid'){
  eq(p.M,half(p.B,p.C),'midpoint BC');
  eq(p.G,[(p.A[0]+p.B[0]+p.C[0])/3,(p.A[1]+p.B[1]+p.C[1])/3],'centroid coordinate');
  assert.equal(norm(sub(p.G,p.A)),p.AG);
  assert.equal(norm(sub(p.G,p.M)),p.GM);
  assert.equal(p.AG,2*p.GM);
  assert.ok(x.answer.includes(''+p.AG)&&x.answer.includes(''+p.GM));
  checks+=4;
 }else if(p.kind==='varignon'){
  const [A,B,C,D]=p.points;
  const derived=[half(A,B),half(B,C),half(C,D),half(D,A)];
  eq(p.mid,derived,'all four midpoints');
  const [P,Q,S,R]=[derived[0],derived[1],derived[3],derived[2]];
  eq(sub(Q,P),sub(R,S),'PQ=SR vectors');
  eq(sub(R,Q),sub(S,P),'QR=PS vectors');
  if(x.figure)eq(x.figure.mid,p.mid,'drawing midpoint integrity');
  for(const pos of p.mid)assert.ok(x.answer.includes(''+pos[0])&&x.answer.includes(''+pos[1]),'displayed position wrong');
  checks+=4;
 }else assert.fail('unknown class IX quad proof '+p.kind);
 if(x.archetypeId)families.set(x.archetypeId,(families.get(x.archetypeId)||0)+1);
}
assert.equal(ids.size,15);assert.equal(families.size,6);
for(const [id,n] of families)assert.equal(n,2,'need paired reasoning instances '+id);
console.log('PASS Class IX quadrilaterals: 15 items; 6 archetypes; '+checks+' coordinate, vector and hypothesis checks.');
console.log('These are specific instances; formal general theorem and screen rendering review remain separate.');
