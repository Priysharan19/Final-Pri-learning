// Independent Wave-7 original diagram investigations and expanded 77-chapter contract.
// These are worked-study examples, not authoritative authenticated graded bank questions.
import assert from 'node:assert/strict';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { evalNumeric } from '../src/engine/expr.js';
import { loadNotesForGrade } from '../src/notes/notesIndex.js';

const cases={7:70,8:80,9:90,10:100,11:120,12:140};
const totals={7:242,8:276,9:255,10:319,11:373,12:386};
const loaders={
  7:()=>import('../src/notes/data/notes-visual-wave7-class7.js'),
  8:()=>import('../src/notes/data/notes-visual-wave7-class8.js'),
  9:()=>import('../src/notes/data/notes-visual-wave7-class9.js'),
  10:()=>import('../src/notes/data/notes-visual-wave7-class10.js'),
  11:()=>import('../src/notes/data/notes-visual-wave7-class11.js'),
  12:()=>import('../src/notes/data/notes-visual-wave7-class12.js')
};
const val=x=>evalNumeric(String(x));
const close=(a,b,t=1e-7)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b));
let authored=0,worked=0,illustrated=0,chapters=0,covered=0;
const figures=new Map;
for(const group of IN_CURRICULUM){
  const grade=group.grade,added=(await loaders[grade]()).default,all=await loadNotesForGrade(grade);
  const ordered=Object.values(added).flatMap(n=>n.examples||[]);
  assert.equal(ordered.length,cases[grade],'new authorship count changed for grade '+grade);
  assert.ok(Object.keys(added).every(id=>group.chapters.some(c=>c.id===id)),'unknown grade-chapter identifier');
  const n=Object.values(all).reduce((sum,x)=>sum+x.examples.length,0);
  assert.equal(n,totals[grade],'incomplete grade-specific lazy Notes import');
  worked+=n;
  for(const chapter of group.chapters){
    chapters++;
    const whole=all[chapter.id];
    assert.ok(whole,'missing existing curriculum chapter '+chapter.id);
    assert.equal(new Set(whole.examples.map(x=>x.question)).size,whole.examples.length,'duplicate chapter-level question '+chapter.id);
    illustrated+=whole.examples.filter(x=>x.figure).length;
    if(whole.examples.some(x=>x.figure))covered++;
  }
  for(const [chapterId,body] of Object.entries(added)){
    for(const ex of body.examples){
      authored++;
      assert.ok(ex.question?.length>=15 && Array.isArray(ex.steps) && ex.steps.length>=3 && ex.answer && ex.verify && ex.figure,'incomplete new question '+chapterId);
      assert.ok(all[chapterId].examples.some(x=>x.question===ex.question),'authored question lost in Notes loader');
      const fig=ex.figure,v=ex.verify;
      assert.ok(fig.description?.length>=25 && !/<\s*\/?\s*[a-z][\w:-]*(?:\s|\/>|>)/i.test(fig.description),'bad screen-reader diagram description');
      figures.set(fig.type,(figures.get(fig.type)||0)+1);
      const receipts=v.kind==='value'?[[v.expr,v.answer]]:v.kind==='values'?v.pairs:null;
      assert.ok(receipts?.length,'deterministic source maths receipts required');
      for(const [expr,expected] of receipts)assert.ok(close(val(expr),val(expected)),'incorrect source arithmetic for '+chapterId+': '+expr+' vs '+expected);
      if(fig.type==='plane'){
        assert.ok(fig.points.length>=2&&fig.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),'invalid coordinate plotted');
        const byId=new Map(fig.points.map(p=>[p.id,p]));
        assert.equal(byId.size,fig.points.length,'ambiguous point label');
        for(const poly of fig.polygons||[]){
          const pts=poly.vertices.map(id=>byId.get(id));
          assert.ok(pts.length>=3&&pts.every(Boolean),'missing polygon vertex');
          const double=pts.reduce((s,p,i)=>s+p.x*pts[(i+1)%pts.length].y-pts[(i+1)%pts.length].x*p.y,0);
          assert.ok(Math.abs(double)>0,'zero-area source polygon');
        }
        for(const curve of fig.curves||[]){
          assert.equal(curve.type,'quadratic');
          const x=-curve.b/(2*curve.a),y=curve.a*x*x+curve.b*x+curve.c,P=byId.get('V');
          assert.ok(P&&close(P.x,x)&&close(P.y,y),'plotted parabola vertex incorrect');
          if(ex.question.includes('gradient')){
            const Q=byId.get('P'),T=byId.get('T');
            assert.ok(Q&&T&&close((T.y-Q.y)/(T.x-Q.x),2*curve.a*Q.x+curve.b),'drawn tangent is not the derivative');
          }
        }
      } else if(fig.type==='dot-plot'){
        assert.ok(fig.values.length>=5 && fig.values.every(Number.isInteger),'invalid dot-plot values');
        assert.ok(fig.values.every((x,i)=>i===0||x>=fig.values[i-1]),'dot plot unorderable');
      } else if(fig.type==='pie'){
        assert.ok(fig.counts.length>=3&&fig.counts.length<=6&&fig.counts.every(x=>Number.isInteger(x)&&x>0),'invalid pie category');
        const sum=fig.counts.reduce((a,b)=>a+b,0);
        assert.ok(close(fig.counts.reduce((s,n)=>s+360*n/sum,0),360),'pie angles do not total 360');
        assert.ok(fig.index>=0&&fig.index<fig.counts.length);
      } else if(fig.type==='stem-leaf'){
        assert.ok(fig.values.length>=5&&fig.values.every(x=>Number.isInteger(x)&&x>=10&&x<=99),'invalid two-digit stem and leaf');
      } else if(fig.type==='motion'){
        assert.equal(fig.times.length,4);assert.equal(fig.velocities.length,4);
        assert.ok(fig.times.every((t,i)=>Number.isFinite(t)&&(i===0||t>fig.times[i-1]))&&fig.velocities.every(v=>v>=0),'invalid time/speed');
        const total=[0,1,2].reduce((s,i)=>s+(fig.times[i+1]-fig.times[i])*(fig.velocities[i]+fig.velocities[i+1])/2,0);
        if(ex.question.includes('distance'))assert.ok(close(total,parseFloat(ex.answer)),'motion trapezoid area disagrees with solution');
      } else if(fig.type==='two-box'){
        for(const a of [fig.a,fig.b])assert.ok(a.length===5&&a.every((x,i)=>Number.isFinite(x)&&(i===0||x>a[i-1])),'quartile order invalid');
      } else if(fig.type==='network'){
        assert.equal(fig.weights.length,7);
        const [ab,ac,bc,bd,cd,ce,de]=fig.weights;
        const costs=[ab+bd+de,ac+ce,ac+cd+de,ab+bc+ce,ab+bc+cd+de,ac+bc+bd+de,ab+bd+cd+ce];
        const best=Math.min(...costs);
        assert.equal(costs.filter(x=>x===best).length,1,'shortest route nonunique');
        assert.ok(close(best,val(ex.verify.answer)),'author ignored a shorter route');
      } else if(fig.type==='ellipse'){
        assert.ok(fig.a>fig.b&&fig.b>0);
        const focalSq=fig.a*fig.a-fig.b*fig.b;
        assert.ok(focalSq>0&&Number.isInteger(focalSq),'invalid ellipse focal distance');
      } else assert.fail('unknown Wave7 SVG data schema '+fig.type);
    }
  }
}
assert.equal(authored,600,'must not drop any original Wave7 worked question');
assert.equal(worked,1851,'all authored worked-study examples must be retained');
assert.equal(illustrated,1485,'full diagram-first study library count must be preserved');
assert.equal(chapters,77,'original complete curriculum spine changed');
assert.equal(covered,77,'a chapter lost all its mathematical diagrams');
assert.ok(figures.size>=8,'wave7 figure diversity collapsed');
console.log('VISUAL WAVE 7 PASS: '+authored+'/600 independent figure/answer checks; '+worked+' examples, '+illustrated+' diagrams, '+chapters+' chapters');
