// Independent formula and exposed-face checks for original Class IX solid study draft.
import assert from 'node:assert/strict';
import { class9SolidMeasure202627 as pack } from '../src/engine/ncert/class9-2026-27-solid-measure-studies.js';
assert.equal(pack.status,'draft-unwired');
assert.equal(pack.questions.length,12);
assert.equal(pack.workedExamples.length,3);
const all=[...pack.workedExamples,...pack.questions],ids=new Set(),types=new Map();
let checks=0;
const eq=(actual,expected,label)=>{assert.ok(Math.abs(actual-expected)<1e-9,label+': '+actual+' vs '+expected);checks++};
for(const item of all){
 assert.ok(!ids.has(item.id),item.id); ids.add(item.id);checks++;
 assert.ok(item.solutionSteps?.length===3 && item.answer, 'incomplete solution '+item.id);checks++;
 const p=item.check;assert.ok(p);checks++;
 if(p.kind==='cuboid'){
  eq(p.area,2*(p.l*p.w+p.l*p.h+p.w*p.h),'cuboid total area');
  eq(p.volume,p.l*p.w*p.h,'cuboid volume');
 }else if(p.kind==='open-cuboid'){
  eq(p.sheet,p.l*p.w+2*p.h*(p.l+p.w),'open cuboid sheet area');
  eq(p.capacity,p.l*p.w*p.h,'open cuboid volume');
 }else if(p.kind==='cylinder'){
  eq(p.curved,2*p.r*p.h,'cylinder lateral π coefficient');
  eq(p.volume,p.r*p.r*p.h,'cylinder volume π coefficient');
 }else if(p.kind==='closed-cylinder'){
  eq(p.curved,2*p.r*p.h,'closed cylinder lateral');
  eq(p.total,2*p.r*p.h+2*p.r*p.r,'closed cylinder total');
 }else if(p.kind==='cone'){
  eq(p.slant*p.slant,p.r*p.r+p.h*p.h,'slant Pythagoras');
  eq(p.curved,p.r*p.slant,'cone lateral π coefficient');
  eq(p.volume,p.r*p.r*p.h/3,'cone volume π coefficient');
 }else if(p.kind==='sphere'){
  eq(p.area,4*p.r*p.r,'sphere total area π coefficient');
  eq(p.volume,4*p.r**3/3,'sphere volume π coefficient');
 }else if(p.kind==='composite-hemi-cylinder'){
  eq(p.outer,2*p.r*p.h+2*p.r*p.r+p.r*p.r,'exposed composite surface π coefficient');
  eq(p.volume,p.r*p.r*p.h+(2/3)*p.r**3,'composite volume π coefficient');
  assert.ok(item.figure && item.figure.radius===p.r && item.figure.cylinderHeight===p.h,'figure dimensions mismatch');
  assert.equal(item.figure.exposedParts.length,3,'joined seam must not be exposed');
  assert.ok(!item.figure.exposedParts.includes('internal-seam'),'hidden face error');
  checks+=3;
 }else if(p.kind==='scale'){
  eq(p.areaFactor,p.k**2,'area scaling');
  eq(p.volumeFactor,p.k**3,'volume scaling');
 }else assert.fail('unsupported proof '+p.kind);
 if(item.archetypeId)types.set(item.archetypeId,(types.get(item.archetypeId)||0)+1);
}
assert.equal(ids.size,15);
assert.equal(types.size,6);
for(const [id,n] of types)assert.equal(n,2,id+' pair missing');
console.log('PASS Class IX surface-area/volume: 15 items, 6 archetypes, '+checks+' independently recomputed formula/diagram invariants.');
console.log('Exact π answers kept symbolic; no independent examiner or rendered mobile diagram certification.');
