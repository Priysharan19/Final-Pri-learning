// Independently audits 300 figure-bearing study problems added in diagram wave 5.
// Deliberately does not claim server-question authority or independent expert proof review.
import assert from 'node:assert/strict';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { evalNumeric } from '../src/engine/expr.js';
import { loadNotesForGrade } from '../src/notes/notesIndex.js';

const expected=Object.freeze({7:38,8:60,9:38,10:59,11:60,12:70});
const expectedNotes=Object.freeze({7:127,8:141,9:100,10:139,11:163,12:146});
const loaders={
  7:()=>import('../src/notes/data/notes-visual-wave5-class7.js'),
  8:()=>import('../src/notes/data/notes-visual-wave5-class8.js'),
  9:()=>import('../src/notes/data/notes-visual-wave5-class9.js'),
  10:()=>import('../src/notes/data/notes-visual-wave5-class10.js'),
  11:()=>import('../src/notes/data/notes-visual-wave5-class11.js'),
  12:()=>import('../src/notes/data/notes-visual-wave5-class12.js')
};
const close=(a,b,tol=1e-7)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
const checkNumber=n=>typeof n==='number'&&Number.isFinite(n);
const types=new Map();
let inspected=0,allTotal=0;
for(const group of IN_CURRICULUM) {
  const grade=group.grade,extra=(await loaders[grade]()).default,base=await loadNotesForGrade(grade);
  assert.equal(Object.keys(base).length,group.chapters.length,'curriculum mismatch');
  assert.ok(Object.keys(extra).every(id=>group.chapters.some(ch=>ch.id===id)), 'unknown supplement chapter');
  const examples=Object.values(extra).flatMap(n=>n.examples||[]);
  assert.equal(examples.length,expected[grade], 'grade-specific visual inventory changed');
  assert.equal(Object.values(base).reduce((n,r)=>n+r.examples.length,0),expectedNotes[grade], 'grade total or loader integration changed');
  allTotal+=Object.values(base).reduce((n,r)=>n+r.examples.length,0);
  for(const [chapterId,notes] of Object.entries(extra)) {
    const all=base[chapterId].examples;
    for(const ex of notes.examples) {
      inspected++;
      assert.ok(ex.question && ex.steps.length>=3 && ex.answer && ex.verify && ex.figure);
      assert.ok(all.some(item=>item.question===ex.question),'visual study was not merged into Notes page');
      const f=ex.figure;
      assert.ok(f.description.length>=25,'accessible figure description absent');
      assert.ok(!/</.test(f.description),'no HTML in figure text');
      types.set(f.type,(types.get(f.type)||0)+1);
      const v=ex.verify,items=v.kind==='value'?[[v.expr,v.answer]]:v.kind==='values'?v.pairs:null;
      assert.ok(items?.length || v.kind==='roots', 'all new diagram answers must have deterministic receipts');
      if(v.kind==='roots'){
        for(const root of v.answers)assert.ok(close(evalNumeric(v.f, {x:evalNumeric(root)}),0),chapterId+' invalid cube root');
      } else for(const [a,b] of items)assert.ok(close(evalNumeric(a),evalNumeric(b)),chapterId+' mismatch: '+a+' vs '+b);
      if(f.type==='venn'){
        assert.ok([f.a,f.b,f.ab,f.out].every(n=>Number.isInteger(n)&&n>=0));
      } else if(f.type==='placevalue'){
        assert.ok(f.index>=0&&f.index<f.digits.length && f.digits.every(n=>Number.isInteger(n)&&n>=0&&n<=9));
      } else if(f.type==='tape'){
        assert.ok(f.a>0&&f.b>0&&f.total%(f.a+f.b)===0,'ratio chart must show equal integral shares');
      } else if(f.type==='parallel'){
        const theta=Math.atan2(180,180/Math.tan(f.angle*Math.PI/180))*180/Math.PI;
        assert.ok(close(theta,f.angle),'displayed transversal must have stated angle');
      } else if(f.type==='matrix'){
        assert.equal(f.entries.length,4);
        assert.ok(f.entries.every(Number.isInteger));
      } else if(f.type==='unitcircle'){
        assert.ok([0,30,45,60,90,120,135,150,180,210,225,240,270,300,315,330].includes(f.deg));
        const trig=ex.question.includes('sin(')?Math.sin(f.deg*Math.PI/180):Math.cos(f.deg*Math.PI/180);
        assert.ok(close(trig,evalNumeric(ex.answer),1e-6),'trigonometric value not grounded in angle');
      } else if(f.type==='sector'){
        assert.ok(f.r>0&&f.angle>0&&f.angle<360);
      } else if(f.type==='cuboid'){
        assert.ok([f.l,f.w,f.h].every(n=>Number.isInteger(n)&&n>0));
      } else if(f.type==='tree'){
        assert.ok(f.a>0 && f.a<f.ad && f.sa>0 && f.sa<f.sad && f.sb>0 && f.sb<f.sbd);
      } else if(f.type==='pascal'){
        assert.ok(Number.isInteger(f.n)&&f.n>=3&&f.n<=8);
        assert.ok(Number.isInteger(f.k)&&f.k>=0&&f.k<=f.n);
      } else if(f.type==='dots'){
        assert.ok(f.rows>=2&&f.rows<=10);
      } else if(f.type==='interval'){
        assert.ok(f.a<f.b && typeof f.lc==='boolean' && typeof f.rc==='boolean');
      } else if(f.type==='square-grid'||f.type==='cube-grid'){
        assert.ok(Number.isInteger(f.n)&&f.n>=2&&f.n<=12);
      } else if(f.type==='algebra-area'){
        assert.ok(Number.isInteger(f.a)&&f.a>0 && Number.isInteger(f.b)&&f.b>0);
      } else if(f.type==='prime-bars'){
        assert.ok(f.A.length===3&&f.B.length===3&&[...f.A,...f.B].every(n=>Number.isInteger(n)&&n>=0));
      } else if(f.type==='slope-field'){
        assert.ok(Number.isInteger(f.m)&&f.m>0&&Number.isInteger(f.c));
        for(const x of [-2,-1,0,1,2]){
          const y=t=>f.m*t*t/2+f.c,h=1e-5;
          assert.ok(close((y(x+h)-y(x-h))/(2*h),f.m*x,1e-5), 'slope field not derivative-consistent');
        }
      } else if(f.type==='plane'){
        assert.ok(f.points.length>=3 && f.points.every(pt=>checkNumber(pt.x)&&checkNumber(pt.y)));
        if(f.polygons){
          for(const polygon of f.polygons){
            const pts=polygon.vertices.map(id=>f.points.find(pt=>pt.id===id));
            assert.ok(pts.every(Boolean),'dangling polygon vertex');
            const area=Math.abs(pts.reduce((s,p,i)=>s+p.x*pts[(i+1)%pts.length].y-pts[(i+1)%pts.length].x*p.y,0)/2);
            assert.ok(area>0,'shaded region must have nonzero area');
          }
        }
      } else assert.fail('Unsupported new figure type '+f.type);
    }
  }
}
assert.equal(inspected,325,'expected 325 exact new worked problems');
assert.equal(allTotal,816,'491 previously authored examples plus 325 new visuals');
assert.ok(types.size>=12,'insufficient visual geometry diversity');
console.log('VISUAL WAVE 5: PASS — '+inspected+'/325 figure-driven examples, 816 total, '+types.size+' distinct graphic families');
