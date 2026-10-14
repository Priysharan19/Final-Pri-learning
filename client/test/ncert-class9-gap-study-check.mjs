// Deterministic independent computation checks for author-draft Class IX content.
// Execute: node client/test/ncert-class9-gap-study-check.mjs
// This does NOT certify reasoning depth, diagram rendering, or human examiner review.
import assert from 'node:assert/strict';
import { class9Linear202627 as pack } from '../src/engine/ncert/class9-2026-27-gap-study-pack.js';

assert.equal(pack.status, 'draft-unwired-independent-review-pending');
assert.equal(pack.mode, 'study-only');
assert.equal(pack.chapter, 'Linear Equations in Two Variables');
assert.equal(pack.workedExamples.length, 3);
assert.equal(pack.questions.length, 12);
const all = [...pack.workedExamples, ...pack.questions];
const ids = new Set();
const archetypes = new Map();
let checks = 0;
const eq = (row, xy) => row[0]*xy[0] + row[1]*xy[1] === row[2];

for (const item of all) {
  assert.ok(item.id && !ids.has(item.id), 'duplicate ID ' + item.id);
  ids.add(item.id);
  assert.ok(Array.isArray(item.steps) && item.steps.length >= 3, 'incomplete worked proof ' + item.id);
  assert.ok(typeof item.answer === 'string' && item.answer.length, 'answer missing ' + item.id);
  checks += 3;
  const w = item.proof;
  assert.ok(w, 'missing independent witness ' + item.id);
  checks++;
  if (w.kind === 'unique') {
    const [[a,b],[d,e]] = w.equations;
    assert.notEqual(a*e - b*d, 0, item.id + ' determinant vanishes');
    assert.ok(eq(w.equations[0], w.xy), item.id + ' first equation fails');
    assert.ok(eq(w.equations[1], w.xy), item.id + ' second equation fails');
    if (w.nonnegativeInteger) assert.ok(w.xy.every(n => Number.isInteger(n) && n >= 0), 'ticket count invalid');
    checks += w.nonnegativeInteger ? 4 : 3;
  } else if (w.kind === 'none' || w.kind === 'same') {
    const [[a,b,c],[d,e,f]] = w.equations;
    assert.equal(a*e-b*d, 0, 'left coefficient determinant must vanish');
    const tripleProportional = a*f === c*d && b*f === c*e;
    assert.equal(tripleProportional, w.kind === 'same', 'bad line classification '+item.id);
    if (w.kind === 'same') for (const xy of w.points) {
      assert.ok(eq(w.equations[0], xy) && eq(w.equations[1], xy), 'invalid coincident witness');
      checks++;
    }
    checks += 2;
  } else if (w.kind === 'area') {
    const [a,b,c] = w.equation;
    assert.ok(a > 0 && b > 0 && c > 0, 'positive-axis assumption');
    assert.equal(w.intercepts[0], c/a, 'x intercept');
    assert.equal(w.intercepts[1], c/b, 'y intercept');
    assert.equal(w.area, (w.intercepts[0]*w.intercepts[1])/2, 'area from geometry');
    assert.ok(item.figure, 'diagram required');
    const {O, X, Y} = item.figure.points;
    assert.deepEqual(O, [0,0], 'origin');
    assert.deepEqual(X, [w.intercepts[0],0], 'x axis endpoint');
    assert.deepEqual(Y, [0,w.intercepts[1]], 'y axis endpoint');
    const cross = (X[0]-O[0])*(Y[1]-O[1]) - (X[1]-O[1])*(Y[0]-O[0]);
    assert.equal(Math.abs(cross)/2, w.area, 'figure cross-product area');
    checks += 8;
  } else if (w.kind === 'parameter') {
    const [a,b,c] = w.equation, [d,e] = w.second || [];
    assert.ok([a,b,c,d,e].every(Number.isFinite), 'parameter equation coefficients must be complete');
    assert.notEqual(a*a+b*b, 0, 'degenerate first normal vector');
    assert.equal(a*e-b*d, 0, 'non-proportional normal vectors');
    assert.equal(d, a*w.factor, 'incorrect second x coefficient');
    assert.equal(e, b*w.factor, 'incorrect second y coefficient');
    assert.equal(w.factor*c, w.k, 'incorrect dependent-system parameter');
    // A typo in the printed second equation must not pass only because the witness is correct.
    const printed = item.question.replaceAll('−','-').replaceAll(' ','');
    const expectedSecond = d+'x'+(e<0?e+'y':'+'+e+'y')+'=k';
    assert.ok(printed.includes(expectedSecond), 'printed parameter equation differs from witnessed coefficients: '+item.id);
    assert.ok(item.answer.includes('k='+w.k), 'printed student answer disagrees with computed k');
    checks += 7;
  } else {
    assert.fail('unrecognized proof type '+w.kind);
  }
  if (item.archetype) archetypes.set(item.archetype, (archetypes.get(item.archetype) || 0)+1);
  if (item.figure) {
    assert.ok(item.figure.alt && item.figure.alt.length > 30, 'accessible figure description missing');
    assert.ok(!item.figure.alt.includes(item.answer), 'answer leaked into figure alt');
    checks += 2;
  }
}
assert.equal(ids.size, 15);
assert.equal(archetypes.size, 6);
for (const [id, count] of archetypes) assert.equal(count, 2, 'archetype needs two independently instantiated exercises: '+id);
console.log('PASS Class IX original study pack: '+ids.size+' complete items, 6 reasoning archetypes, '+checks+' independent arithmetic / structure / diagram invariants.');
console.log('Boundaries: not integrated into Notes; not server graded; no independent examiner or real-browser diagram review yet.');
