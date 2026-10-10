// Wave 6 mathematical-and-diagram regression. This is study content,
// NOT independent exam-level mathematical certification or student grading.
import assert from 'node:assert/strict';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { evalNumeric } from '../src/engine/expr.js';
import { loadNotesForGrade } from '../src/notes/notesIndex.js';

const load={
  7:()=>import('../src/notes/data/notes-visual-wave6-class7.js'),
  8:()=>import('../src/notes/data/notes-visual-wave6-class8.js'),
  9:()=>import('../src/notes/data/notes-visual-wave6-class9.js'),
  10:()=>import('../src/notes/data/notes-visual-wave6-class10.js'),
  11:()=>import('../src/notes/data/notes-visual-wave6-class11.js'),
  12:()=>import('../src/notes/data/notes-visual-wave6-class12.js')
};
const gradeCases=Object.freeze({7:45,8:55,9:65,10:80,11:90,12:100});
const gradeExamples=Object.freeze({7:192,8:216,9:185,10:239,11:273,12:266});
const eq=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(a),Math.abs(b));
const n=x=>evalNumeric(String(x));
const num=x=>typeof x==='number' && Number.isFinite(x);
const kinds=new Set();
const shapes=new Set();
let checked=0,all=0,visual=0,chapters=0,visuallyCovered=0;
for(const group of IN_CURRICULUM){
  const grade=group.grade;
  const supplements=(await load[grade]()).default;
  const notes=await loadNotesForGrade(grade);
  assert.equal(group.chapters.length,Object.keys(notes).length,'chapter mapping changed');
  const examples=Object.values(supplements).flatMap(x=>x.examples||[]);
  assert.equal(examples.length,gradeCases[grade],'wave-6 grade record count changed');
  const count=Object.values(notes).reduce((sum,ch)=>sum+ch.examples.length,0);
  assert.equal(count,gradeExamples[grade],'grade Notes loader dropped a supplemental pack');
  all+=count;
  for(const ch of group.chapters){
    chapters++;
    const full=notes[ch.id];
    assert.ok(full && full.examples.length>=4,'chapter omitted '+ch.id);
    if(full.examples.some(x=>x.figure))visuallyCovered++;
    assert.equal(new Set(full.examples.map(x=>x.question)).size,full.examples.length,'duplicate question '+ch.id);
    visual+=full.examples.filter(x=>x.figure).length;
  }
  for(const [chapterId,body] of Object.entries(supplements)){
    assert.ok(group.chapters.some(ch=>ch.id===chapterId),'invented chapter ID');
    for(const ex of body.examples){
      checked++;
      assert.ok(notes[chapterId].examples.some(x=>x.question===ex.question),'loader omitted original inquiry question');
      assert.ok(ex.question && ex.answer && ex.steps.length>=3,'incomplete worked question');
      const f=ex.figure,v=ex.verify;
      assert.ok(f.description.length>=35 && !/[<>]/.test(f.description),'unsafe or inaccessible diagram description');
      shapes.add(f.type);
      assert.ok(['value','values'].includes(v.kind),'unsupported verification record');
      const receipts=v.kind==='value'?[[v.expr,v.answer]]:v.pairs;
      for(const [a,b] of receipts)assert.ok(eq(n(a),n(b)),'wrong worked maths: '+chapterId+' '+a+' vs '+b);
      if(f.type==='plane'||f.type==='geometry'){
        assert.ok(f.points.every(p=>num(p.x)&&num(p.y)),'invalid plotted points');
        const points=new Map(f.points.map(p=>[p.id,p]));
        assert.equal(points.size,f.points.length,'duplicate point ID');
        for(const polygon of f.polygons||[]){
          const list=polygon.vertices.map(id=>points.get(id));
          assert.ok(list.every(Boolean),'broken polygon');
          const twice=list.reduce((sum,p,i)=>sum+p.x*list[(i+1)%list.length].y-list[(i+1)%list.length].x*p.y,0);
          assert.ok(Math.abs(twice)>0,'degenerate shaded polygon');
        }
        for(const curve of f.curves||[]){
          const h=-curve.b/(2*curve.a),p=points.get('V');
          assert.ok(p && eq(h,p.x)&&eq(curve.a*h*h+curve.b*h+curve.c,p.y),'parabolic vertex disagrees with curve');
        }
        if(f.type==='geometry' && points.has('D') && points.has('E')){
          const A=points.get('A'),B=points.get('B'),C=points.get('C'),D=points.get('D'),E=points.get('E');
          const ratio=(D.x-A.x)/(B.x-A.x);
          assert.ok(eq((E.y-A.y)/(C.y-A.y),ratio),'similar triangle not drawn to scale');
          const full=Math.hypot(B.x-C.x,B.y-C.y),inner=Math.hypot(D.x-E.x,D.y-E.y);
          assert.ok(eq(inner/full,ratio),'similarity answer diagram inconsistent');
        }
      } else if(f.type==='histogram'){
        assert.ok(f.width>0 && f.counts.length>=4 && f.counts.every(Number.isInteger));
      } else if(f.type==='box-plot'){
        assert.ok(f.min<f.q1&&f.q1<f.med&&f.med<f.q3&&f.q3<f.max,'invalid quartile ordering');
      } else if(f.type==='trig-wave'){
        assert.ok(f.amp>0&&Number.isInteger(f.k)&&f.k>=1,'invalid sine wave');
        const extrema=[...Array(4*f.k)].map((_,i)=>f.amp*Math.sin(f.k*Math.PI*(1+2*i)/(2*f.k)));
        assert.ok(extrema.every(num),'nonfinite wave extrema');
      } else if(f.type==='scatter'){
        assert.ok(f.xy.length>=4 && f.xy.every(([x,y])=>eq(f.m*x+f.b,y)),'plotted scatter not collinear with described trend');
      } else if(f.type==='exponential'){
        assert.ok(f.base>1 && Number.isInteger(f.base),'invalid exponential curve base');
      } else if(f.type==='piecewise'){
        assert.ok(f.left!==f.right,'piecewise graph without actual jump');
      } else if(f.type==='lattice'){
        assert.ok(Number.isInteger(f.east)&&Number.isInteger(f.north)&&f.east>0&&f.north>0);
      } else assert.fail('unrecognised visual source schema '+f.type);
    }
  }
}
assert.equal(checked,435,'435 new inquiry questions must survive content loading');
assert.equal(chapters,77,'expected all curriculum chapters');
assert.equal(visuallyCovered,77,'all 77 chapters must contain a proper visual study question');
assert.equal(all,1371,'1,251 total authored worked examples expected');
assert.equal(visual,1005,'885 diagram-led examples expected');
assert.ok(shapes.size>=9,'source diagram diversity regressed');
console.log('WAVE 6 PASS: '+checked+'/435 newly-authored graphical studies; '+all+' worked; '+visual+' visuals; '+visuallyCovered+'/77 chapters covered');
