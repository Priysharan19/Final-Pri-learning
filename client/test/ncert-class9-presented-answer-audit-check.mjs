// Read-only original Class IX answer audit, independently deriving final displayed values.
import assert from 'node:assert/strict';
import { class9Linear202627 as linear } from '../src/engine/ncert/class9-2026-27-gap-study-pack.js';
import { class9Congruence202627 as triangles } from '../src/engine/ncert/class9-2026-27-congruence-studies.js';
import { class9Statistics202627 as statistics } from '../src/engine/ncert/class9-2026-27-statistics-studies.js';
import { class9SolidMeasure202627 as solids } from '../src/engine/ncert/class9-2026-27-solid-measure-studies.js';

const sum=a=>a.reduce((x,y)=>x+y,0);
const near=(a,b)=>Math.abs(a-b)<1e-9;
const tokens=s=>(s.match(/-?\d+(?:\.\d+)?(?:\/\d+)?/g)||[]).map(t=>t.includes('/')?Number(t.split('/')[0])/Number(t.split('/')[1]):Number(t));
const med=a=>{const v=[...a].sort((x,y)=>x-y),n=v.length;return n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2;};
const duplicates=new Set();
function displayed(item,values){
 const actual=tokens(item.answer);
 assert.equal(actual.length,values.length,item.id+' wrong number of displayed quantities');
 values.forEach((v,i)=>assert.ok(near(actual[i],v),item.id+' displayed number '+actual[i]+' != calculated '+v));
 return values.length;
}
function audit(item,section){
 const p=item.proof||item.check,k=p.kind;
 assert.ok(item.answer&&(item.steps||item.solutionSteps).length>=3,'missing visible text');
 let checks=1;
 if(section==='linear'){
  if(k==='unique'){
   const [[a,b,c],[d,e,f]]=p.equations,det=a*e-b*d;
   assert.notEqual(det,0);
   const expected=[(c*e-b*f)/det,(a*f-c*d)/det];
   assert.ok(expected.every((v,i)=>near(v,p.xy[i])));
   checks+=displayed(item,expected);
  }else if(k==='none'||k==='same'){
   const [[a,b,c],[d,e,f]]=p.equations;
   assert.equal(a*e,b*d);
   assert.equal(a*f===c*d&&b*f===c*e,k==='same');
   assert.ok(item.answer.toLowerCase().includes(k==='none'?'no solution':'infinitely many'));
   if(k==='same')checks+=displayed(item,p.points.flat());
  }else if(k==='area'){
   const [a,b,c]=p.equation;
   checks+=displayed(item,[c*c/(2*a*b)]);
   assert.deepEqual(p.intercepts,[c/a,c/b]);
  }else if(k==='parameter'){
   const [a,b,c]=p.equation,[d,e]=p.second||[];
   assert.ok([a,b,c,d,e].every(Number.isFinite));
   assert.notEqual(a*a+b*b,0);
   assert.equal(a*e,b*d);
   assert.equal(d,a*p.factor);assert.equal(e,b*p.factor);
   const wanted=d+'x'+(e<0?e+'y':'+'+e+'y')+'=k';
   assert.ok(item.question.replaceAll('−','-').replaceAll(' ','').includes(wanted));
   checks+=displayed(item,[c*p.factor]);
  }else assert.fail('unknown linear case '+k);
 }else if(section==='solids'){
  let vals;
  if(k==='cuboid')vals=[2*(p.l*p.w+p.l*p.h+p.w*p.h),p.l*p.w*p.h];
  else if(k==='open-cuboid')vals=[p.l*p.w+2*p.h*(p.l+p.w),p.l*p.w*p.h];
  else if(k==='cylinder')vals=[2*p.r*p.h,p.r*p.r*p.h];
  else if(k==='closed-cylinder')vals=[2*p.r*p.h,2*p.r*p.h+2*p.r*p.r];
  else if(k==='cone'){const slant=Math.hypot(p.r,p.h);vals=[...(item.id==='pl9-solid-w3'?[]:[slant]),p.r*slant,p.r*p.r*p.h/3];}
  else if(k==='sphere')vals=[4*p.r*p.r,4*p.r**3/3];
  else if(k==='composite-hemi-cylinder')vals=[2*p.r*p.h+3*p.r*p.r,p.r*p.r*p.h+2*p.r**3/3];
  else if(k==='scale')vals=[p.k**2,p.k**3];
  else assert.fail('unknown solids case '+k);
  checks+=displayed(item,vals);
  if(['cone','cylinder','sphere','composite-hemi-cylinder','closed-cylinder'].includes(k)){
   assert.equal((item.answer.match(/π/g)||[]).length,2,'expected two symbolic pi quantities');
  }
  const sig=JSON.stringify(Object.entries(p).filter(([key])=>!['area','volume','curved','slant','sheet','capacity','outer','total','areaFactor','volumeFactor'].includes(key)).sort(([a],[b])=>a.localeCompare(b)));
  assert.ok(!duplicates.has(sig),'same worked/example instance repeated: '+item.id);
  duplicates.add(sig);
  const steps=(item.steps||item.solutionSteps).join(' ');
  for(const v of vals) assert.ok(tokens(steps).some(n=>near(n,v)),'answer calculation absent from visible worked steps for '+item.id+' value '+v);
  if(k==='composite-hemi-cylinder'){
   assert.deepEqual(item.figure.exposedParts,['cylinder-lateral','hemisphere-curved','bottom-disc']);
   assert.equal(item.figure.radius,p.r);
  }
  checks+=vals.length+3;
 }else if(section==='statistics'){
  let vals;
  if(k==='weighted')vals=[sum(p.values.map((v,i)=>v*p.freq[i]))/sum(p.freq)];
  else if(k==='missing'){
   const fs=p.freq.map((n,i)=>i===p.unknownIndex?p.x:n);
   assert.ok(Number.isInteger(p.x)&&p.x>=0);
   assert.ok(near(sum(fs.map((n,i)=>n*p.values[i]))/sum(fs),p.mean));
   vals=[p.x];
  }else if(k==='stacked'){
   vals=p.groups.map(g=>100*g[p.focusIndex]/sum(g));
   const winner=vals[0]>=vals[1]?'A':'B';
   assert.ok(item.answer.includes('Class '+winner),'displayed winning class differs from fractions');
   if(winner==='B')vals.reverse(); // student answer states winner first, then runner-up
   assert.equal(item.figure.groups.length,p.groups.length);
   item.figure.groups.forEach((f,i)=>assert.deepEqual(f.segments,p.groups[i]));
  }else if(k==='stacked-single')vals=[100*p.values[p.focusIndex]/sum(p.values)];
  else if(k==='percent-to-count')vals=[p.total*p.pct/100];
  else if(k==='outlier'){const a=p.original,b=[...a,p.added];vals=[sum(a)/a.length,sum(b)/b.length,med(a),med(b)];}
  else if(k==='share-count')vals=p.totals.map((n,i)=>n*p.pcts[i]/100);
  else assert.fail('unknown statistics '+k);
  checks+=displayed(item,vals);
 }else if(section==='triangles'){
  if(k==='sas'){
   assert.equal(p.included,true);
   assert.equal(p.mapping.length,3);
   if(item.id==='pl9-tri-q01')assert.ok(item.answer.includes('∠ABC=∠DEF'));
   if(item.id==='pl9-tri-q02')assert.ok(item.answer.includes('QR=YZ'));
   if(item.id==='pl9-tri-w01')assert.ok(item.answer.includes('BC=EF'));
   checks++;
  }else if(k==='sss'){
   const [a,b,c]=p.sides;
   assert.ok(a+b>c&&b+c>a&&c+a>b);
   const m=item.question.match(/∠([A-Z]{3})/);
   if(m){const map=Object.fromEntries(p.mapping.map(s=>s.split(':')));const x=[...m[1]].map(c=>map[c]).join('');assert.ok(item.answer.includes('∠'+x));}
   assert.ok(item.answer.includes('SSS'));
   checks++;
  }else if(k==='asa'){
   assert.equal(p.included,true);
   checks+=displayed(item,[180-p.angles[0]-p.angles[1]]);
   assert.equal(sum(p.angles),180);
   assert.ok(item.answer.includes('ASA'));
  }else if(k==='rhs'){
   const n=Math.sqrt(p.hypotenuse**2-p.leg**2);
   assert.ok(near(n,p.other));
   checks+=displayed(item,[n]);
  }else if(k==='ssa-two'){
   const angle=p.angleDegrees*Math.PI/180;
   const disc=4*(p.opposite**2-p.adjacent**2*Math.sin(angle)**2);
   assert.ok(disc>0);
   const s=p.adjacent*Math.cos(angle);
   assert.ok(s-Math.sqrt(disc)/2>0&&s+Math.sqrt(disc)/2>s-Math.sqrt(disc)/2);
   assert.ok(/two|not unique/i.test(item.answer));
   checks+=3;
  }else if(k==='isosceles'){
   const [a,b]=p.left,[c,d]=p.right,x=(d-b)/(a-c),apex=180-2*(a*x+b);
   assert.ok(near(x,p.x)&&near(apex,p.apex));
   checks+=displayed(item,[x,apex]);
  }else assert.fail('unknown triangle '+k);
 }else assert.fail('unknown section '+section);
 return checks;
}
let positive=0,negative=0,checks=0;
for(const [section,pack] of [['linear',linear],['triangles',triangles],['statistics',statistics],['solids',solids]]){
 for(const item of [...pack.workedExamples,...pack.questions]){
  checks+=audit(item,section);positive++;
  assert.throws(()=>audit({...item,answer:'999999 WRONG ANSWER'},section),'corrupted displayed answer must fail: '+item.id);
  negative++;
 }
}
assert.equal(positive,60);assert.equal(negative,60);
console.log('PASS 60 original displayed answers independently recomputed, '+checks+' derived-answer assertions; 60/60 corrupted displayed answers rejected.');
console.log('Not a substitute for examiner theorem proofs, exact syllabus checks or rendered visual QA.');
