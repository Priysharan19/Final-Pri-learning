// Pri Learning · an equation that does not follow from the equation above it (engine/arithmeticLines.js equationRewrite, 26 Nov 2026).
//
// Crossed: a line that is one equation in the same letter as the line directly above it, a polynomial of degree 1 or 2, whose real solutions are
// neither a part of nor hold the solutions of the equations above it. Every other relation between two such lines is a TRUE line or a note, and must
// never be a cross: this file pins the wrong ones (crossed AT the line) and, much longer, the true and the undecidable ones (never crossed).
//
//   node server/test/equation-rewrite-check.mjs
import './support/hermetic.mjs';
import { stepCheckArithmetic } from '../../client/src/engine/arithmeticLines.js';
import { oneAustralianPart } from '../platform/markerOps.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
const statuses = (page, opts = { equationRewrite: true }) => stepCheckArithmetic(page.join('\n'), opts).lines.map(l => l.status);
const crossedAt = (page, opts) => statuses(page, opts).indexOf('break');
const neverCrossed = (label, page) => ok(!statuses(page).includes('break'), `${label}: a true page was crossed: ${page.join(' // ')}`);

// ── wrong rewritings: crossed at the line ──────────────────────────────────────────────────────────
for (const [page, at] of [
  [['3x+2=11', '3x=12'], 1],                           // 3x = 9 was meant
  [['2x-5=7', 'x=5'], 1],
  [['x^2-5x+6=0', '(x-2)(x+3)=0'], 1],
  [['x^2-5x+6=0', '(x-2)(x-3)=0', 'x=4'], 2],
  [['x^2-5x+6=0', 'x=(5+3)/2'], 1],
  [['4x-3=2x+7', '2x=4', 'x=2'], 1],
  [['x^2=9', 'x=4'], 1],
  [['5x=20', 'x=5'], 1],
  [['(x+1)/2=3', 'x+1=5'], 1],
  [['x^2+8x-16=0', '(x+4)^2=12'], 1]
]) ok(crossedAt(page) === at, `wrong rewriting not crossed at ${at}: ${page.join(' // ')} -> ${statuses(page)}`);

// ── off by default: no option, no cross (the client, India and every other caller are unchanged) ─────────
ok(crossedAt(['3x+2=11', '3x=12'], null) === -1 && crossedAt(['3x+2=11', '3x=12'], {}) === -1, 'the cross is off without the option');

// ── true lines and undecidable lines: never crossed ────────────────────────────────────────────────
neverCrossed('same solution, moved terms', ['3x+2=11', '3x=9', 'x=3']);
neverCrossed('multiplied through', ['x/2+1=4', 'x+2=8', 'x=6']);
neverCrossed('expanded', ['(x+1)(x+2)=0', 'x^2+3x+2=0']);
neverCrossed('completed square', ['x^2+6x=7', 'x^2+6x+9=16', '(x+3)^2=16']);
neverCrossed('one branch of a quadratic', ['x^2-5x+6=0', '(x-2)(x-3)=0', 'x-2=0', 'x=2']);
neverCrossed('second branch after the first', ['(x-1)(x-2)=0', 'x-1=0', 'x-2=0']);
neverCrossed('both roots listed one per line', ['x^2=4', 'x=2', 'x=-2']);
neverCrossed('squaring both sides adds a root (a note)', ['x-1=2', '(x-1)^2=4']);
neverCrossed('squaring adds a root, bare candidate', ['x+1=3', '(x+1)^2=9', 'x=-4', 'x=2']);
neverCrossed('dividing by the variable loses a root (a note)', ['x^2=3x', 'x=3']);
neverCrossed('dividing by the variable, linear result', ['x^2-4x=0', 'x-4=0']);
neverCrossed('two bare values and no equation', ['x=2', 'x=3']);
neverCrossed('a new fact about x after the roots', ['x^2+4x+3=0', 'x=-3', 'x=-1', 'x=0']);
neverCrossed('a different letter', ['3x+2=11', '3y=12']);
neverCrossed('two letters', ['y=2x+1', '3x=12']);
neverCrossed('a function value', ['P(0)=1/4', 'P(1)=1/2']);
neverCrossed('a function value, another letter', ['f(x)=2x+1', 'f(2)=5']);
neverCrossed('case split of an absolute value', ['2x-1=x+2', '2x-1=-(x+2)']);
neverCrossed('case split, sides swapped', ['x+2=2x-1', '-(x+2)=2x-1']);
neverCrossed('a periodic second family', ['x-π/3=0', 'x-π/3=π/2']);
neverCrossed('words between', ['3x+2=11', 'now 3x=12']);
neverCrossed('or', ['x^2=4', 'x=2 or x=-2']);
neverCrossed('a restriction', ['x^2=4', 'x>0']);
neverCrossed('a new part', ['(a) 3x+2=11', '(b) 3x=12']);
neverCrossed('a new part, label on the line above', ['(a) 2x=6', '(b) 3x+1=4']);
neverCrossed('a decimal is a rounding', ['x*12.578=50000', 'x=3975.2']);
neverCrossed('rational equation is not read', ['1/x=2', 'x=1/2']);
neverCrossed('a cubic is not read', ['x^3=8', 'x=3']);
neverCrossed('an identity (every x)', ['2(x+1)=2x+2', 'x+1=x+1']);
neverCrossed('no solution (complex)', ['x^2+1=0', 'x^2=-1']);
neverCrossed('substitution lines', ['x=2', '3(2)+1=7']);
neverCrossed('the equation given then its value', ['2x+1=7', 'x=3']);
neverCrossed('the root of a quadratic by formula', ['x^2-5x+6=0', 'x=(5+1)/2', 'x=(5-1)/2']);

// ── the question has parts, or is not Australian: the option is not set ───────────────────────────────
const nsw = { subtopic: 'y11-quadfunc', prompt: 'Solve $2x+1=7$.', steps: [{ h: 'Solve', d: '$2x=6$' }] };
ok(oneAustralianPart(nsw) === true, 'one Australian part');
ok(oneAustralianPart({ ...nsw, prompt: 'Solve (a) $2x+1=7$ (b) $3x-1=5$.' }) === false, 'two parts in the prompt');
ok(oneAustralianPart({ ...nsw, steps: [{ h: 'a', d: '$x=3$' }, { h: 'b', d: '$x=2$' }] }) === false, 'two parts in the steps');
ok(oneAustralianPart({ ...nsw, subtopic: 'cbse-x-algebra' }) === false, 'an India question never');
ok(oneAustralianPart({ ...nsw, subtopic: 'y9-algebra' }) === false, 'a question outside Years 11-12 never');
ok(oneAustralianPart({ ...nsw, subtopic: 'x', _bank: 'qb-calculus' }) === true, 'a bank question');

if (failures.length) { console.log(failures.join('\n')); console.log(`EQUATION REWRITE: FAIL ${failures.length} of ${pass + failures.length}`); process.exit(1); }
console.log(`EQUATION REWRITE: PASS: ${pass} checks`);
