// Independent deterministic checks for original Class IX 2026–27 triangle study tranche.
// Run: node client/test/ncert-class9-congruence-study-check.mjs
// Structural proof validation is NOT equivalent to independent examiner proof review.
import assert from 'node:assert/strict';
import { class9Congruence202627 as pack } from '../src/engine/ncert/class9-2026-27-congruence-studies.js';

assert.equal(pack.status, 'draft-unwired-independent-proof-review-pending');
assert.equal(pack.mode, 'study-only');
assert.equal(pack.workedExamples.length, 3);
assert.equal(pack.questions.length, 12);
const entries = [...pack.workedExamples, ...pack.questions];
const IDs = new Set(), archetypes = new Map();
let checks = 0, proofStructures = 0;
for (const ex of entries) {
  assert.ok(ex.id && !IDs.has(ex.id), 'duplicate question identity');
  IDs.add(ex.id); checks++;
  assert.ok(ex.question && ex.answer && ex.steps.length >= 3, 'incomplete question '+ex.id);
  checks++;
  const p = ex.proof;
  assert.ok(p,'missing proof witness '+ex.id); checks++;
  if (p.kind === 'sas') {
    assert.equal(p.included,true,'angle must be included in SAS');
    assert.equal(p.mapping.length, 3,'three corresponding vertices');
    assert.equal(new Set(p.mapping.map(s=>s.split(':')[0])).size,3,'source vertex permutation');
    assert.equal(new Set(p.mapping.map(s=>s.split(':')[1])).size,3,'target vertex permutation');
    checks += 4; proofStructures++;
  } else if (p.kind === 'sss') {
    const [a,b,c]=p.sides;
    assert.ok(a+b>c && a+c>b && b+c>a,'triangle inequality violated');
    assert.equal(p.mapping.length,3);checks+=2;proofStructures++;
  } else if (p.kind === 'asa') {
    const [a,b,c]=p.angles;
    assert.equal(a+b+c,180,'ASA triangle angle sum incorrect');
    assert.ok(p.angles.every(v=>v>0&&v<180),'invalid triangle angle');
    assert.equal(p.included,true,'ASA known side not included');
    checks+=3;proofStructures++;
  } else if (p.kind === 'rhs') {
    assert.ok(p.leg>0 && p.other>0 && p.hypotenuse>p.leg);
    assert.equal(p.hypotenuse**2,p.leg**2+p.other**2,'invalid right triangle dimensions');
    checks+=2;proofStructures++;
  } else if (p.kind === 'isosceles') {
    const [a,b]=p.left,[c,d]=p.right;
    const L=a*p.x+b, R=c*p.x+d;
    assert.equal(L,R,'base angles differ');
    assert.ok(L>0 && L<90,'triangle would have invalid apex angle');
    assert.equal(2*L+p.apex,180,'wrong triangle angle sum');
    checks+=3;proofStructures++;
  } else if (p.kind === 'ssa-two') {
    assert.ok(p.angleDegrees>0&&p.angleDegrees<90);
    const rad=p.angleDegrees*Math.PI/180;
    const s=Math.sin(rad), h=p.adjacent*s;
    assert.ok(Math.abs(h-p.altitude)<1e-9,'bad altitude');
    assert.ok(h<p.opposite && p.opposite<p.adjacent,'SSA not in two-positive-intersection range');
    // Ray-circle intersection: t^2 - 2*c*cos(A)*t + c^2-a^2=0.
    const c=p.adjacent,a=p.opposite;
    const discriminant=(2*c*Math.cos(rad))**2-4*(c*c-a*a);
    assert.ok(discriminant>0,'two intersections need positive discriminant');
    const t1=(2*c*Math.cos(rad)-Math.sqrt(discriminant))/2;
    const t2=(2*c*Math.cos(rad)+Math.sqrt(discriminant))/2;
    assert.ok(t1>0 && t2>t1,'both solutions must lie on positive ray');
    for (const t of [t1,t2]) {
      const X=t*Math.cos(rad),Y=t*Math.sin(rad);
      assert.ok(Math.abs((X-c)**2+Y**2-a*a)<1e-8,'not on circle');
    }
    if(ex.figure){
      assert.equal(ex.figure.angleDegrees,p.angleDegrees);
      assert.equal(ex.figure.B[0],p.adjacent);
      assert.equal(ex.figure.radius,p.opposite);
      assert.ok(ex.figure.alt && !ex.figure.alt.includes(ex.answer),'diagram leaks answer');
      checks+=4;
    }
    checks+=8;proofStructures++;
  } else assert.fail('unknown proof witness '+p.kind);
  if(ex.archetype) archetypes.set(ex.archetype,(archetypes.get(ex.archetype)||0)+1);
}
assert.equal(IDs.size,15);
assert.equal(archetypes.size,6);
for(const [k,v] of archetypes)assert.equal(v,2,'archetype lacks two instances: '+k);
console.log('PASS Class IX original congruence: '+IDs.size+' complete items; '+archetypes.size+' archetypes; '+checks+' arithmetic, geometric and structure assertions; '+proofStructures+' proof structures inspected.');
console.log('Independent mathematics examiner proof review and visual-browser rendering remain required before publication.');
