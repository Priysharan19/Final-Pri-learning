// Exact structural handoff to the existing StudyDiagram JSX contract, NOT pixel/screenshot acceptance.
import assert from 'node:assert/strict';
import {getAllClass9FigureHandoffs} from '../src/engine/ncert/class9-2026-27-notes-figure-adapter.js';
const handoffs=await getAllClass9FigureHandoffs();
assert.equal(handoffs.length,19,'original figure manifest census changed');
const supported=handoffs.filter(x=>x.status==='existing-Notes-contract-compatible-not-visually-certified');
const blocked=handoffs.filter(x=>x.status==='requires-existing-Notes-renderer-extension');
assert.equal(supported.length,15);
assert.equal(blocked.length,4);
const reasons=blocked.map(x=>x.sourceKind).sort();
assert.deepEqual(reasons,['hemi-on-cylinder','hemi-on-cylinder','stacked-bar','stacked-bar']);
let checks=0;
for(const h of supported){
 const f=h.figure;
 assert.ok(['plane','geometry'].includes(f.type));
 assert.ok(f.description.length>=30);
 assert.equal(h.targetComponent,'client/src/notes/StudyDiagram.jsx');
 assert.equal(h.displayGate,'after-attempt-or-in-worked-solution');
 assert.ok(f.points.length>=3);
 const ids=new Set();
 for(const p of f.points){
  assert.ok(typeof p.id==='string'&&!ids.has(p.id),'duplicate geometry label');
  assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),'nonfinite visual coordinate');
  ids.add(p.id);checks+=3;
 }
 for(const [a,b] of f.segments||[]){
  assert.ok(ids.has(a)&&ids.has(b),'unknown geometric segment endpoint');
  assert.notEqual(a,b,'degenerate segment');checks+=2;
 }
 for(const c of f.circles||[]){assert.ok(Number.isFinite(c.cx)&&Number.isFinite(c.cy)&&c.r>0);checks++;}
 for(const poly of f.polygons||[]){assert.ok(poly.vertices.length>=3&&poly.vertices.every(p=>ids.has(p)));checks++;}
}
console.log('PASS 19 original figure specs mapped: 15 structurally compatible with existing StudyDiagram, 4 explicitly held for supported-renderer extension; '+checks+' coordinate/segment/semantic checks.');
console.log('ZERO diagrams accepted by actual rendered desktop/mobile screenshot review; this test is a handoff contract only.');
