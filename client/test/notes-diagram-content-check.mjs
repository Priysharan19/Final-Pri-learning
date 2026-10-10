// Mathematics diagram catalogue certification; read chart/geometry data without trusting authors' checked answers.
import assert from 'node:assert/strict';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { evalNumeric } from '../src/engine/expr.js';
import { loadNotesForGrade } from '../src/notes/notesIndex.js';
async function verifyVisuals(){
  const expected={7:14,8:16,9:22,10:24,11:25,12:24};
  const allowed=new Set(['plane','geometry','bars','numberline']);
  let visuals=0, total=0;
  const byGrade={};
  const seenQuestions=new Set(), arity={};
  const eq=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-5*Math.max(1,Math.abs(a),Math.abs(b));
  const calc=(s,env={})=>evalNumeric(String(s),env);
  for (const group of IN_CURRICULUM){
    const grade=group.grade;
    const notes=await loadNotesForGrade(grade);
    let gradeCount=0;
    for (const ch of group.chapters){
      const note=notes[ch.id];
      assert.ok(note,'missing '+ch.id);
      total+=note.examples.length;
      for (const ex of note.examples.filter(x=>x.figure)){
        visuals++;gradeCount++;
        assert.ok(!seenQuestions.has(grade+'|'+ex.question),'duplicate visual question '+ex.question);
        seenQuestions.add(grade+'|'+ex.question);
        assert.ok(ex.steps.length>=3 && ex.answer && ex.verify,'incomplete authored solution');
        const fig=ex.figure;
        assert.ok(allowed.has(fig.type),'unknown diagram kind');
        assert.ok(fig.description.length>=15 && !/<\s*script/i.test(fig.description),'bad a11y description');
        arity[fig.type]=(arity[fig.type]||0)+1;
        if(fig.type==='bars'){
          assert.ok(fig.values.length===fig.labels.length && fig.values.length>=3);
          assert.ok(fig.values.every(v=>Number.isInteger(v)&&v>=0));
          assert.ok(new Set(fig.labels).size===fig.labels.length);
        } else if(fig.type==='numberline'){
          assert.ok(fig.min<fig.max && fig.marks.length===2);
          assert.ok(fig.marks.every(m=>Number.isFinite(m.value)&&m.value>=fig.min&&m.value<=fig.max));
        } else {
          assert.ok(fig.points.length>=1);
          const byId=new Map(fig.points.map(p=>[p.id,p]));
          assert.equal(byId.size,fig.points.length,'repeated point label');
          assert.ok(fig.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
          for(const segment of fig.segments||[])assert.ok(segment.length===2 && segment.every(id=>byId.has(id)),'segment has dangling end');
          for(const poly of fig.polygons||[]){
            assert.ok(poly.vertices.length>=3&&poly.vertices.every(id=>byId.has(id)),'invalid polygon');
            const ps=poly.vertices.map(id=>byId.get(id));
            const signedArea=ps.reduce((s,p,i)=>s+p.x*ps[(i+1)%ps.length].y-ps[(i+1)%ps.length].x*p.y,0)/2;
            assert.ok(Math.abs(signedArea)>1e-8,'degenerate polygon');
          }
          for (const circle of fig.circles||[])assert.ok(circle.r>0 && [circle.cx,circle.cy,circle.r].every(Number.isFinite));
          for(const curve of fig.curves||[]){
            assert.equal(curve.type,'quadratic');
            assert.ok([curve.a,curve.b,curve.c,curve.xmin,curve.xmax].every(Number.isFinite) && curve.xmax>curve.xmin && curve.a!==0);
            if(byId.has('V')){
              const vx=-curve.b/(2*curve.a),vy=curve.a*vx*vx+curve.b*vx+curve.c,vertex=byId.get('V');
              assert.ok(eq(vx,vertex.x)&&eq(vy,vertex.y),'labelled vertex inconsistent with plotted quadratic');
            }
          }
        }
        const verify=ex.verify;
        if(verify.kind==='value'){
          assert.ok(eq(calc(verify.expr),calc(verify.answer)),ch.id+' wrong numeric receipt '+ex.question);
        } else if(verify.kind==='values'){
          assert.ok(verify.pairs.length>=2);
          for(const [a,b] of verify.pairs)assert.ok(eq(calc(a),calc(b)),ch.id+' wrong pair '+a+' vs '+b);
        } else {
          assert.fail('Unsupported diagram receipt '+verify.kind);
        }
        if(fig.type==='geometry' && fig.rightAngles?.length){
          for(const id of fig.rightAngles)assert.ok(fig.points.some(p=>p.id===id),'unlabelled right angle');
        }
      }
    }
    byGrade[grade]=gradeCount;
    assert.equal(gradeCount,expected[grade],'visual grade breadth mismatch '+grade);
  }
  assert.equal(visuals,125,'visual question count changed');
  assert.equal(total,491,'original and enriched worked examples must all be preserved');
  assert.ok(arity.plane>=70 && arity.geometry>=15 && arity.bars>=15 && arity.numberline>=4, 'diagram diversity floor');
  console.log('Visual diagram questions PASS',JSON.stringify({visuals,total,byGrade,figureKinds:arity}));
}
await verifyVisuals();
