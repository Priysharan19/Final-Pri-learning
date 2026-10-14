/**
 * Mission 004 Class IX comprehensive 105-item acceptance check.
 * Imports the established independent 60-item calculated-answer auditor and
 * extends explicit answer/steps/hypothesis checking to all other 45 items.
 * Not a substitute for independent theorem-proof, historical provenance or
 * browser-rendered visual acceptance.
 */
import assert from 'node:assert/strict';
import './ncert-class9-presented-answer-audit-check.mjs';
import {class9Euclid202627 as euclid} from '../src/engine/ncert/class9-2026-27-euclid-studies.js';
import {class9LinesAngles202627 as angles} from '../src/engine/ncert/class9-2026-27-lines-angles-studies.js';
import {class9Quadrilaterals202627 as quads} from '../src/engine/ncert/class9-2026-27-quadrilaterals-studies.js';
const sum=a=>a.reduce((x,y)=>x+y,0);
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const equal=(a,b)=>assert.deepEqual(a,b);
const length=v=>Math.hypot(...v);
const show=(item,v)=>assert.ok(item.answer.includes(v),item.id+' displayed answer missing '+v);
const coords=v=>'('+v.join(',')+')';
let checks=0, premiseMutations=0, diagramMutations=0, answerMutations=0, stepMutations=0;
const ids=new Set();
function audit(item,section) {
 const w=item.proof||item.witness;
 assert.ok(item.id&&item.question&&item.answer,item.id+' empty material');
 assert.ok(item.steps?.length===3&&item.steps.join(' ').length>55,'inadequate or corrupted displayed steps');
 const stepTarget=independentlyExpectedStepAnchor(item,section);
 assert.ok(item.steps.join(' ').toLowerCase().includes(stepTarget.toLowerCase()),item.id+' worked steps omit calculated decisive claim: '+stepTarget);
 assert.ok(w&&typeof w.kind==='string','no theorem/parameter witness');
 if(item.figure)assert.ok(item.figure.alt?.length>=25,'missing figure or text equivalent');
 checks+=4;
 if(section==='euclid'){
  if(w.kind==='chain'||w.kind==='chain-add'){
   assert.equal(new Set(w.values).size,1,'invalid equality premise');
   if(w.kind==='chain')show(item,w.relation);
   else show(item,'a+4=c+4');
   checks+=2;
  }else if(w.kind==='segments-add'){
   assert.equal(sum(w.left),sum(w.right));
   assert.equal(w.left[0],w.right[0]);assert.equal(w.left[1],w.right[1]);
   show(item,item.id==='pl9-eucl-add-1'?'AC=DF':'GI=JL='+sum(w.left));checks+=3;
  }else if(w.kind==='segments-subtract'){
   assert.ok(w.whole[0]>w.part[0]);
   assert.equal(w.whole[0]-w.part[0],w.remainder);
   assert.equal(w.whole[1]-w.part[1],w.remainder);
   show(item,''+w.remainder);checks+=4;
  }else if(w.kind==='rectangle-area-countermodel'){
   const area1=w.a[0]*w.a[1],area2=w.b[0]*w.b[1];
   assert.equal(area1,area2);assert.notDeepEqual([...w.a].sort(),[...w.b].sort());
   assert.deepEqual(item.figure?.rectangles,[w.a,w.b],'diagram wrongly scaled');
   show(item,w.a.join('×'));show(item,w.b.join('×'));checks+=4;
  }else if(w.kind==='rectangle-perimeter-countermodel'){
   assert.equal(sum(w.a),sum(w.b));assert.notEqual(w.a[0]*w.a[1],w.b[0]*w.b[1]);
   assert.deepEqual(item.figure?.rectangles,[w.a,w.b]);
   show(item,''+(w.a[0]*w.a[1]));show(item,''+(w.b[0]*w.b[1]));checks+=4;
  }else if(w.kind==='unique-line'){
   assert.equal(w.distinct,true);assert.equal(w.count,1);
   show(item,w.noncollinearThird?'Exactly one through P,Q; none through P,Q,R':item.id==='pl9-eucl-w02'?'line through two distinct points is unique':'lines coincide');checks+=3;
  }else if(w.kind==='playfair'){
   assert.equal(w.pointOff,true);assert.equal(w.parallelCount,1);
   show(item,item.id==='pl9-eucl-parallel-1'?'Exactly one parallel through P':'must coincide');checks+=3;
  }else if(w.kind==='square'){
   assert.ok(w.side>0);assert.equal(w.diagonalSquared,2*w.side*w.side);
   show(item,w.side+'√2');checks+=3;
  }else assert.fail('unrecognised Euclid proof type: '+w.kind);
 }else if(section==='angles'){
  if(['linear-pair','co-interior','vertical'].includes(w.kind)){
   const [a,b]=w.forms;let x;
   if(w.kind==='vertical')x=(b[1]-a[1])/(a[0]-b[0]);
   else x=(180-a[1]-b[1])/(a[0]+b[0]);
   const measured=[a[0]*x+a[1],b[0]*x+b[1]];
   assert.equal(x,w.x);
   assert.ok(measured.every(n=>n>0&&n<180));
   if(w.kind==='vertical'){assert.equal(measured[0],measured[1]);assert.equal(measured[0],w.angle);}
   else {assert.equal(sum(measured),180);equal(measured,w.angles);}
   show(item,'x='+x);show(item,''+measured[0]);if(w.kind!=='vertical')show(item,''+measured[1]);checks+=7;
   const formulae=[...item.question.matchAll(/\((\d*)x([+−-]\d+)\)/g)].map(m=>[Number(m[1]||'1'),Number(m[2].replace('−','-'))]);
   equal(formulae,w.forms);checks++;
  }else if(w.kind==='corresponding'){
   assert.equal(w.theta,w.corresponding);assert.equal(w.corresponding+w.adjacent,180);
   show(item,''+w.corresponding);show(item,''+w.adjacent);
   assert.deepEqual([...item.question.matchAll(/(\d+)°/g)].map(m=>Number(m[1])),[w.theta],'shown corresponding-angle premise differs');
   if(item.figure){
    const f=item.figure;
    assert.equal(f.parallelY.length,2);assert.notEqual(f.parallelY[0],f.parallelY[1]);
    assert.equal(f.sector==='obtuse'?180-f.transversalDeg:f.transversalDeg,w.theta);
   }
   checks+=5;
  }else if(w.kind==='alternate-converse'){
   assert.equal(w.angles[0],w.angles[1]);assert.equal(w.parallel,true);
   const printedAngles=[...item.question.matchAll(/(\d+)°/g)].map(m=>Number(m[1]));
   assert.ok(printedAngles.length>=1&&printedAngles.length<=2&&printedAngles.every(n=>n===w.angles[0]),'alternate interior angle data changed');
   assert.ok(/parallel/i.test(item.answer)&&!/not parallel|cannot be parallel/i.test(item.answer));
   if(item.figure)assert.notEqual(item.figure.parallelY[0],item.figure.parallelY[1]);
   checks+=4;
  }else if(w.kind==='nonparallel-corresponding'||w.kind==='nonparallel-cointerior'){
   assert.equal(w.parallel,false);
   if(w.kind==='nonparallel-corresponding')assert.notEqual(w.angles[0],w.angles[1]);
   else assert.notEqual(sum(w.angles),180);
   assert.deepEqual([...item.question.matchAll(/(\d+)°/g)].map(m=>Number(m[1])),w.angles,'printed nonparallel angle data changed');
   assert.ok(/not parallel/i.test(item.answer)); 
   const contradiction=w.kind==='nonparallel-corresponding'
     ?w.angles[0]+'°≠'+w.angles[1]+'°'
     :w.angles[0]+'°+'+w.angles[1]+'°='+sum(w.angles)+'°';
   assert.ok(item.steps[1].includes(contradiction),item.id+' must show the true contradictory measured angles');
   assert.ok(/not parallel|cannot be parallel/i.test(item.steps[2]),item.id+' lost the necessary negative theorem conclusion');
   assert.ok(!/\b(?:are|is|must be) parallel\b/i.test(item.steps[2]) || /not parallel|cannot be parallel/i.test(item.steps[2]),
     item.id+' asserts an unjustified positive parallel conclusion');
   checks+=8;
  }else assert.fail('unrecognised angle type '+w.kind);
 }else if(section==='quadrilaterals'){
  if(w.kind==='fourth'){
   const wanted=sub(add(w.A,w.C),w.B);equal(w.D,wanted);
   equal(sub(w.B,w.A),sub(w.C,w.D));
   equal(sub(w.C,w.B),sub(w.D,w.A));
   show(item,'D='+coords(wanted));
   if(item.figure)equal(item.figure.points,[w.A,w.B,w.C,w.D]);checks+=5;
  }else if(w.kind==='diagonals'){
   const [A,B,C,D]=w.points,m=mid(A,C);
   equal(m,mid(B,D));equal(m,w.midpoint);
   show(item,coords(m));
   if(item.figure)equal(item.figure.points,w.points);checks+=4;
  }else if(w.kind==='midsegment'){
   equal(w.D,mid(w.A,w.B));equal(w.E,mid(w.A,w.C));
   const de=sub(w.E,w.D),bc=sub(w.C,w.B);
   equal(bc,[de[0]*2,de[1]*2]);
   const de2=de[0]**2+de[1]**2,bc2=bc[0]**2+bc[1]**2;
   assert.equal(de2,w.DE2);assert.equal(bc2,4*de2);
   // w.DEtext/BCtext can contain radicals; norms are derived from independent coordinates.
   const expectedText=de2===18?['3√2','6√2']:[String(length(de)),String(length(bc))];
   equal([w.DEtext,w.BCtext],expectedText);
   show(item,'DE='+expectedText[0]);show(item,'BC='+expectedText[1]);show(item,'DE∥BC');
   if(item.figure)equal(item.figure.midpoints,[w.D,w.E]);checks+=9;
  }else if(w.kind==='midpoint-converse'){
   assert.equal(w.parallel,true);assert.equal(w.onSegment,true);
   assert.equal(w.length/2,w.half);
   show(item,'AE=EC='+w.half);checks+=4;
  }else if(w.kind==='centroid'){
   equal(w.M,mid(w.B,w.C));
   const g=[(w.A[0]+w.B[0]+w.C[0])/3,(w.A[1]+w.B[1]+w.C[1])/3];
   equal(w.G,g);
   assert.equal(length(sub(g,w.A)),w.AG);assert.equal(length(sub(g,w.M)),w.GM);
   assert.equal(w.AG,2*w.GM);
   show(item,'G='+coords(g));show(item,'AG='+w.AG);show(item,'GM='+w.GM);
   if(item.figure)equal(item.figure.centroid,g);checks+=8;
  }else if(w.kind==='varignon'){
   const [A,B,C,D]=w.points;
   const mids=[mid(A,B),mid(B,C),mid(C,D),mid(D,A)];
   equal(w.mid,mids);
   equal(sub(mids[1],mids[0]),sub(mids[2],mids[3]));
   equal(sub(mids[2],mids[1]),sub(mids[3],mids[0]));
   for(let i=0;i<4;i++)show(item,'PQRS'[i]+coords(mids[i]));
   if(item.figure){equal(item.figure.points,w.points);equal(item.figure.mid,mids);}
   checks+=9;
  }else assert.fail('unrecognised quad '+w.kind);
 }else assert.fail('unrecognised section');
 return true;
}

function independentlyExpectedAnswerAnchor(item,type){
 const w=item.proof||item.witness, k=w.kind;
 if(type==='euclid'){
  if(k==='chain')return w.relation;
  if(k==='chain-add')return 'a+4=c+4';
  if(k==='segments-add')return item.id==='pl9-eucl-add-1'?'AC=DF':'GI=JL='+sum(w.left);
  if(k==='segments-subtract')return ''+(w.whole[0]-w.part[0]);
  if(k==='rectangle-area-countermodel')return w.a.join('×');
  if(k==='rectangle-perimeter-countermodel')return ''+(w.a[0]*w.a[1]);
  if(k==='unique-line')return w.noncollinearThird?'Exactly one through P,Q; none through P,Q,R':item.id==='pl9-eucl-w02'?'line through two distinct points is unique':'lines coincide';
  if(k==='playfair')return item.id==='pl9-eucl-parallel-1'?'Exactly one parallel through P':'must coincide';
  if(k==='square')return w.side+'√2';
 }
 if(type==='angles'){
  if(['linear-pair','co-interior','vertical'].includes(k)){
   const [[a,b],[d,e]]=w.forms;
   return 'x='+(k==='vertical'?(e-b)/(a-d):(180-b-e)/(a+d));
  }
  if(k==='corresponding')return ''+w.corresponding;
  if(k==='alternate-converse')return 'parallel';
  if(k.startsWith('nonparallel'))return 'not parallel';
 }
 if(type==='quadrilaterals'){
  if(k==='fourth')return 'D='+coords(sub(add(w.A,w.C),w.B));
  if(k==='diagonals')return coords(mid(w.points[0],w.points[2]));
  if(k==='midsegment')return 'DE='+w.DEtext;
  if(k==='midpoint-converse')return 'AE=EC='+(w.length/2);
  if(k==='centroid')return 'G='+coords([(w.A[0]+w.B[0]+w.C[0])/3,(w.A[1]+w.B[1]+w.C[1])/3]);
  if(k==='varignon')return 'P'+coords(mid(w.points[0],w.points[1]));
 }
 throw Error('No independent answer mutation anchor for '+item.id);
}
function independentlyExpectedStepAnchor(item,type){
 const w=item.proof||item.witness,k=w.kind;
 if(type==='euclid'){
  if(k==='chain')return w.relation;
  if(k==='chain-add')return 'a+4=c+4';
  if(k==='segments-add')return item.id==='pl9-eucl-add-1'?'AC=DF':'GI=JL='+sum(w.left);
  if(k==='segments-subtract')return ''+(w.whole[0]-w.part[0]);
  if(k==='rectangle-area-countermodel'||k==='rectangle-perimeter-countermodel')return ''+(w.a[0]*w.a[1]);
  if(k==='unique-line')return item.id==='pl9-eucl-incidence-1'?'coincide':'unique';
  if(k==='playfair')return item.id==='pl9-eucl-parallel-2'?'unique':'unique';
  if(k==='square')return w.side+'√2';
 }
 if(type==='angles'){
  if(['linear-pair','co-interior','vertical'].includes(k)){
   const [[a,b],[d,e]]=w.forms;return 'x='+(k==='vertical'?(e-b)/(a-d):(180-b-e)/(a+d));
  }
  if(k==='corresponding')return ''+w.corresponding;
  if(k==='alternate-converse')return 'parallel';
  if(k==='nonparallel-corresponding')return w.angles[0]+'°≠'+w.angles[1]+'°';
  if(k==='nonparallel-cointerior')return w.angles[0]+'°+'+w.angles[1]+'°='+sum(w.angles)+'°';
 }
 if(type==='quadrilaterals'){
  if(k==='fourth')return coords(sub(add(w.A,w.C),w.B));
  if(k==='diagonals')return coords(mid(w.points[0],w.points[2]));
  if(k==='midsegment')return w.DEtext;
  if(k==='midpoint-converse')return ''+(w.length/2);
  if(k==='centroid')return coords([(w.A[0]+w.B[0]+w.C[0])/3,(w.A[1]+w.B[1]+w.C[1])/3]);
  if(k==='varignon')return coords(mid(w.points[0],w.points[1]));
 }
 throw Error('No independently derived step target for '+item.id);
}

function plausibleWrongAnswer(item,type){
 const anchor=independentlyExpectedAnswerAnchor(item,type);
 assert.ok(item.answer.includes(anchor),'expected derived answer anchor absent: '+item.id+' '+anchor);
 const modified=anchor.replace(/-?\d+(?:\.\d+)?/,v=>String(Number(v)+1));
 return item.answer.replace(anchor,modified===anchor?'wrong alternative claim':modified);
}

for(const [type,pack] of [['euclid',euclid],['angles',angles],['quadrilaterals',quads]]){
 for(const original of [...pack.workedExamples,...pack.questions]){
  assert.ok(!ids.has(original.id));ids.add(original.id);
  audit(original,type);
  const wrongAnswer=plausibleWrongAnswer(original,type);
  assert.notEqual(wrongAnswer,original.answer);
  assert.throws(()=>audit({...original,answer:wrongAnswer},type),'derived-value wrong answer survived: '+original.id);
  answerMutations++;
  // Plausible mathematical errors only. Do not count target-deletion sentinels as proof tests.
  const witness=original.proof||original.witness;
  const derived=independentlyExpectedStepAnchor(original,type);
  if(/-?\d+(?:\.\d+)?/.test(derived)){
   const bad=derived.replace(/-?\d+(?:\.\d+)?/,v=>String(Number(v)+1));
   const wrongSteps=original.steps.map(s=>s.replace(derived,bad));
   if(JSON.stringify(wrongSteps)!==JSON.stringify(original.steps)){
    assert.throws(()=>audit({...original,steps:wrongSteps},type),'plausible arithmetic step mutation survived: '+original.id);
    stepMutations++;
   }
  }
  if(type==='angles'&&witness.kind.startsWith('nonparallel')){
   const last=original.steps[2];
   const flipped=last.replace('not parallel','parallel').replace('cannot be parallel','can be parallel');
   assert.notEqual(last,flipped,'no negative theorem conclusion available to challenge');
   const wrongSteps=[...original.steps.slice(0,2),flipped];
   assert.throws(()=>audit({...original,steps:wrongSteps},type),'false positive-parallel claim survived: '+original.id);
   stepMutations++;
   const target=independentlyExpectedStepAnchor(original,type);
   assert.ok(original.steps[1].includes(target),'premise contradiction not present');
   const corrupted=original.steps.map(s=>s.replace(target,target.replace(/=\d+°/, '=180°').replace('≠','=')));
   assert.notDeepEqual(corrupted,original.steps,'contradiction mutation failed');
   assert.throws(()=>audit({...original,steps:corrupted},type),'altered contradiction survived: '+original.id);
   stepMutations++;
  }
  if(original.figure){
   assert.throws(()=>audit({...original,figure:{...original.figure,alt:''}},type),'missing accessibility description survived');
   diagramMutations++;
  }
  // Parameter mutation controls on categories where question-text parameters
  // are independently parsed (all algebraic angle pairs).
  if(type==='angles'&&['linear-pair','co-interior','vertical','corresponding','alternate-converse','nonparallel-corresponding','nonparallel-cointerior'].includes(original.proof.kind)){
   const tampered=original.question.replace(/\d+/,m=>String(Number(m)+1));
   assert.throws(()=>audit({...original,question:tampered},type),'altered printed angle premise must fail');
   premiseMutations++;
  }
 }
}
assert.equal(ids.size,45,'new 45-item coverage');
assert.equal(answerMutations,45);assert.ok(stepMutations>=10,'insufficient meaningful step mutations');
console.log('PASS Mission 004 Class IX: 60 previous + 45 new = 105 displayed items checked.');
console.log('New 45: '+checks+' calculated answer/premise/geometry validations, 45/45 domain-anchored plausible wrong answers rejected; '+stepMutations+' plausible arithmetic/polarity step mutations rejected (not 45 full proofs); independent line-by-line proof audit pending.');
console.log('Also caught '+premiseMutations+' altered angle premises and '+diagramMutations+' missing required accessibility descriptions.');
console.log('LIMIT: complete independent mathematical proof/historical review and rendered figure quality still pending; older 60 did not yet receive the new step/premise mutation protocol.');
