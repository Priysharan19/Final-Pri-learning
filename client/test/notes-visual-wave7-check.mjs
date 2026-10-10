// Wave 7 regression: 120 original graph-based worked questions, independent source inventory.
import assert from 'node:assert/strict';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { evalNumeric } from '../src/engine/expr.js';
import { loadNotesForGrade } from '../src/notes/notesIndex.js';
const expected=Object.freeze({7:20,8:20,9:20,10:20,11:20,12:20});
const depths=Object.freeze({7:192,8:216,9:185,10:239,11:273,12:266});
const eq=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(a),Math.abs(b));
let inspected=0,library=0,visual=0,covered=0;
for (const g of IN_CURRICULUM){
 const mod=await import('../src/notes/data/notes-visual-wave7-class'+g.grade+'.js');
 const extra=mod.default,notes=await loadNotesForGrade(g.grade);
 assert.ok(Object.keys(extra).every(id=>g.chapters.some(c=>c.id===id)));
 const arr=Object.values(extra).flatMap(c=>c.examples);
 assert.equal(arr.length,expected[g.grade]);
 const gradeCount=Object.values(notes).reduce((n,c)=>n+c.examples.length,0);
 assert.equal(gradeCount,depths[g.grade]);
 library+=gradeCount;
 for (const chapter of g.chapters){
  assert.ok(notes[chapter.id].examples.some(ex=>ex.figure),'illustrated chapter lost: '+chapter.id);
  covered++;
  visual+=notes[chapter.id].examples.filter(ex=>ex.figure).length;
  assert.equal(new Set(notes[chapter.id].examples.map(ex=>ex.question)).size,notes[chapter.id].examples.length,'duplicate question: '+chapter.id);
 }
 for (const [id,section] of Object.entries(extra))for (const ex of section.examples){
  inspected++;
  assert.ok(notes[id].examples.some(e=>e.question===ex.question),'loader missed '+id);
  assert.ok(ex.question && ex.figure?.description && ex.steps.length>=3 && ex.answer && ex.verify);
  const v=ex.verify,pairs=v.kind==='value'?[[v.expr,v.answer]]:v.kind==='values'?v.pairs:null;
  assert.ok(pairs?.length>0,'non-deterministic answer');
  for(const [a,b] of pairs) assert.ok(eq(evalNumeric(String(a)),evalNumeric(String(b))),'mathematical mismatch '+id);
  if(ex.figure.type==='plane'){
   for(const polygon of ex.figure.polygons||[]){
    const pts=polygon.vertices.map(k=>ex.figure.points.find(p=>p.id===k));
    assert.ok(pts.every(Boolean));
    const area=pts.reduce((sum,p,i)=>sum+p.x*pts[(i+1)%pts.length].y-pts[(i+1)%pts.length].x*p.y,0)/2;
    assert.ok(Math.abs(area)>0,'degenerate shape');
   }
  }
  if(ex.figure.type==='geometry' && ex.figure.points.some(p=>p.id==='E')){
   const ps=Object.fromEntries(ex.figure.points.map(p=>[p.id,p]));
   assert.ok(eq(ps.D.x/ps.B.x,ps.E.y/ps.C.y),'similar triangles not drawn to scale');
  }
 }
}
assert.equal(inspected,120);
assert.equal(library,1371);
assert.equal(visual,1005);
assert.equal(covered,77);
console.log('Wave 7 source PASS — 120/120 new; '+library+' worked; '+visual+' graphic; 77/77 chapters');
