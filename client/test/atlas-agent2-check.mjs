import assert from 'node:assert/strict';
import { classifySystem, clipLine, equationText, lineNature, LINE_PRESETS, MAX_ABS_COEFFICIENT, determinants } from '../src/atlas/agent2/lineMath.js';
import { buildAtlasGraph, syntheticAtlas } from '../src/atlas/agent2/graphModel.js';
import { createLaboratoryHandoff, validateLaboratoryHandoff } from '../src/atlas/agent2/mathHandoff.js';
import { chapterSelection, chapterNavigationEvent, assertChapterSelection } from '../src/atlas/agent2/identity.js';

let cases = 0;
const check = (a, b, expected) => {
  const actual = classifySystem(a, b);
  assert.equal(actual.kind, expected);
  if (actual.kind === 'unique') {
    assert.ok(Math.abs(a.a * actual.point.x + a.b * actual.point.y - a.c) < 1e-8);
    assert.ok(Math.abs(b.a * actual.point.x + b.b * actual.point.y - b.c) < 1e-8);
  } else assert.equal(actual.point, null, 'no phantom solution point');
  cases++;
};
for (const [name, lines] of Object.entries(LINE_PRESETS)) {
  check(lines[0], lines[1], name === 'degenerate' ? 'inconsistent' : name);
}
check({a:0,b:0,c:0}, {a:2,b:-1,c:4}, 'unconstrained');
check({a:0,b:0,c:0}, {a:0,b:0,c:0}, 'all-plane');
check({a:0,b:0,c:0}, {a:0,b:0,c:4}, 'inconsistent');
check({a:0,b:0,c:-1}, {a:0,b:0,c:0}, 'inconsistent');
check({a:1,b:1,c:4}, {a:-1,b:-1,c:-4}, 'coincident');
check({a:1,b:1,c:4}, {a:-1,b:-1,c:-5}, 'parallel');
for(let a1=-2;a1<=2;a1++)for(let b1=-2;b1<=2;b1++)for(let c1=-2;c1<=2;c1++)
for(let a2=-2;a2<=2;a2++)for(let b2=-2;b2<=2;b2++)for(let c2=-2;c2<=2;c2++) {
  const a={a:a1,b:b1,c:c1},b={a:a2,b:b2,c:c2};
  const r=classifySystem(a,b);
  const n1=lineNature(a),n2=lineNature(b);
  if(n1==='empty'||n2==='empty') assert.equal(r.kind,'inconsistent');
  if(n1==='line' && n2==='line') {
    const det=a1*b2-a2*b1;
    if(det!==0) assert.equal(r.kind,'unique');
    else {
      const coincide=a1*c2-a2*c1===0 && c1*b2-c2*b1===0;
      assert.equal(r.kind,coincide?'coincident':'parallel');
    }
  }
  if(r.point) {
    assert.ok(Math.abs(a1*r.point.x + b1*r.point.y - c1) < 1e-8);
    assert.ok(Math.abs(a2*r.point.x+b2*r.point.y-c2)<1e-8);
  }
  for(const eq of [a,b]) {
    const seg=clipLine(eq,8);
    if(seg) for(const pt of seg) {
      assert.ok(Math.abs(eq.a*pt.x+eq.b*pt.y-eq.c)<1e-8);
      assert.ok(Math.abs(pt.x)<=8+1e-8 && Math.abs(pt.y)<=8+1e-8);
    }
  }
  cases++;
}
assert.equal(equationText({a:0,b:0,c:1}),'0 = 1');
assert.equal(clipLine({a:0,b:0,c:0}),null);
assert.throws(()=>classifySystem({a:Infinity,b:0,c:0},{a:1,b:1,c:1}),TypeError);

const graph=syntheticAtlas();
assert.ok(graph.nodes.length>10);
assert.ok(graph.layers.prerequisite.length>0);
assert.ok(graph.layers.conceptual.length>0);
assert.ok(graph.layers.evidence.length>0);
assert.ok(graph.layers.evidence.every(e=>e.simulated));
assert.ok(graph.nodes.every(n=>n.evidence.count===0 && n.evidence.accuracy===null));
const clean=buildAtlasGraph();
assert.equal(clean.layers.evidence.length,0);
assert.ok(clean.nodes.every(n=>n.evidence.state==='no observed evidence'));
assert.deepEqual(clean.nodes.map(n=>[n.id,n.x,n.y]),syntheticAtlas().nodes.map(n=>[n.id,n.x,n.y]));
assert.equal(clean.nodes.find(n=>n.id==='c10-pair-linear-equations').id, 'c10-pair-linear-equations');
assert.equal(buildAtlasGraph({evidenceLinks:[{source:'c9-coordinate-geometry',target:'c10-pair-linear-equations',verified:false}]}).layers.evidence.length,0);
for(const name of Object.keys(graph.layers))for(const e of graph.layers[name]){
  assert.ok(graph.nodes.some(n=>n.id===e.source) && graph.nodes.some(n=>n.id===e.target));
  assert.ok(e.meaning && e.provenance);
}
// Domain boundary: the user's near-MAX_SAFE_INTEGER counterexample must be
// rejected, not silently classified using rounded floating-point determinants.
const n = Number.MAX_SAFE_INTEGER;
const bigA = {a:n,b:n-1,c:n}, bigB = {a:n-1,b:n-2,c:n-1};
const exactD = BigInt(n)*BigInt(n-2)-BigInt(n-1)*BigInt(n-1);
const exactDx = BigInt(n)*BigInt(n-2)-BigInt(n-1)*BigInt(n-1);
const exactDy = BigInt(n)*BigInt(n-1)-BigInt(n-1)*BigInt(n);
assert.equal(exactD,-1n);
assert.equal(exactDx,-1n);
assert.equal(exactDy,0n);
assert.equal(exactDx/exactD,1n);
assert.equal(exactDy/exactD,0n);
assert.throws(() => classifySystem(bigA,bigB), /\[-6, 6\]/);
assert.throws(() => determinants(bigA,bigB), /\[-6, 6\]/);
assert.equal(MAX_ABS_COEFFICIENT,6);
assert.doesNotThrow(() => classifySystem({a:6,b:-6,c:6},{a:-6,b:-6,c:-6}));
assert.throws(() => classifySystem({a:7,b:0,c:0},{a:0,b:1,c:0}),RangeError);
assert.throws(() => classifySystem({a:0,b:0,c:-7},{a:0,b:0,c:0}),RangeError);
assert.throws(() => classifySystem({a:-6,b:6,c:6},{a:6,b:0,c:7}),RangeError);

for(const [name, equations] of Object.entries(LINE_PRESETS)) {
  const q=createLaboratoryHandoff(equations);
  const v=classifySystem(...equations);
  assert.equal(q.workedExplanation.classification,v.kind);
  assert.equal(q.experiment.coefficients[0].a,equations[0].a);
  assert.equal(q.experiment.coefficients[1].c,equations[1].c);
  assert.ok(q.question.text.includes(equationText(equations[0])));
  assert.ok(q.question.text.includes(equationText(equations[1])));
  assert.equal(q.synthetic,true);
  assert.equal(q.ungraded,true);
  assert.equal(validateLaboratoryHandoff(JSON.parse(JSON.stringify(q))).question.text,q.question.text);
  assert.throws(()=>validateLaboratoryHandoff({...q,question:{...q.question,text:'tampered'}}), /Modified/);
  if(v.kind==='unique') {
    assert.equal(q.question.type,'solve-and-explain');
    assert.equal(q.workedExplanation.conclusion.includes(v.exactPoint.x.text),true);
  } else {
    assert.equal(q.question.type,'classify-solution-set');
    assert.equal(q.exactPoint,null);
  }
}
const thirds = createLaboratoryHandoff([{a:3,b:0,c:1},{a:0,b:3,c:2}]);
assert.equal(thirds.exactPoint.x.text,'1/3');
assert.equal(thirds.exactPoint.y.text,'2/3');
assert.equal(thirds.workedExplanation.conclusion,'Unique solution: (1/3, 2/3).');
for(const [kind,lines] of [
  ['unconstrained',[{a:0,b:0,c:0},{a:1,b:2,c:3}]],
  ['all-plane',[{a:0,b:0,c:0},{a:0,b:0,c:0}]],
  ['inconsistent',[{a:0,b:0,c:3},{a:1,b:2,c:3}]]
]) {
  const h=createLaboratoryHandoff(lines);
  assert.equal(h.workedExplanation.classification,kind);
  assert.equal(h.exactPoint,null);
  assert.equal(h.question.type,'classify-solution-set');
}
console.log('PASS PRI ATLAS Agent 2: '+cases+' exhaustive small-integer cases plus bounded-domain, exact-fraction and synthetic-question handoff regressions');

const unverified = buildAtlasGraph({attempts: [{subtopic:'c10-pair-linear-equations',correct:true}]});
assert.equal(unverified.nodes.find(n=>n.id==='c10-pair-linear-equations').evidence.count,0);

const chapter=chapterSelection('c10-pair-linear-equations');
assert.equal(chapter.kind,'curriculum-chapter');
assert.equal(chapter.conceptId,null);
assert.equal(chapterNavigationEvent(chapter.id,'atlas-agent2').chapterId,chapter.id);
assert.equal(assertChapterSelection(chapter).id,chapter.id);
assert.throws(()=>assertChapterSelection({...chapter,conceptId:'linear-equations'}),TypeError);
assert.throws(()=>chapterSelection('linear-equations'),RangeError);
const labHandoff=createLaboratoryHandoff(LINE_PRESETS.unique);
assert.equal(labHandoff.selection.kind,'curriculum-chapter');
assert.equal(labHandoff.conceptId,null);
