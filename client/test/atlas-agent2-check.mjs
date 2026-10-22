import assert from 'node:assert/strict';
import { classifySystem, clipLine, equationText, lineNature, LINE_PRESETS } from '../src/atlas/agent2/lineMath.js';
import { buildAtlasGraph, syntheticAtlas } from '../src/atlas/agent2/graphModel.js';

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
console.log('PASS PRI ATLAS Agent 2: '+cases+' exhaustive line-system cases; 3 typed graph layers; deterministic positions; no invented evidence');

const unverified = buildAtlasGraph({attempts: [{subtopic:'c10-pair-linear-equations',correct:true}]});
assert.equal(unverified.nodes.find(n=>n.id==='c10-pair-linear-equations').evidence.count,0);
