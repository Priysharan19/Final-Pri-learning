// Pri Learning · marking mutation check.
//
// 1. The 26 lines an independent reviewer found live on main (18 false lines the marked page TICKED, 8 true authored lines it CROSSED), each
//    pinned by the class that caused it: the line is not ticked / not crossed now.
// 2. The mutation harness (tools/marking-mutation-harness.mjs) over every authored true solution page of the Years 11-12 Advanced and
//    Extension 1 generators: no true line is crossed, and no line that is provably wrong (one edit of a sign, a number, an exponent, a
//    term, a function, a limit, a base or a constant, proved false by the harness's own numeric evaluation) is ticked.
//
// 3. The recorded corpus (server/test/fixtures/marking-mutation-corpus.json): every false tick and every crossed true line the harness found on
//    origin/main over seeds 1-30 (not the owner's margin-number ticks). Each is re-marked here and must not be ticked / crossed. A change that
//    brings any one of this PR's fixes back fails it (checked per file: README of the PR lists the result).
// 5. The AUTHOR BANK (server/content/qbank, server/platform/qbankPack.js), all of it, marked the way the practice route marks it: the authored
//    worked steps are never crossed; one-line provably false mutants are never ticked; and the natural pages of an equation solved by a step that
//    is not reversible (squaring, clearing a fraction, taking logarithms): the candidate roots listed one per line or in one line, then rejected
//    (`reject x = -1`, `x = -1 does not satisfy the equation`, `x ≠ -1`, `x = -1 is extraneous`, `x = -1 (rejected)`, `x = -1 fails`), the two
//    branches of ±, the solutions listed before they are checked. Every line of them is true: none is crossed, and the rejection of a candidate is
//    ticked. The false ones (a value that is a root of nothing, written as a root or as a rejection; the rejection of a real solution) are never ticked.
// 4. A self-contained TRUE arithmetic line (`2 + 3 = 5`) inserted into every authored page is never crossed.
//
// Deterministic: fixed seeds, no model, no network.
import fs from 'node:fs';
import { run, judgeMutant, mutationsOf, roundingMutants, sidesOf, sideValues, loadEngine, markPage, lineAt, authoredPage, typedAnswer } from '../../tools/marking-mutation-harness.mjs';

const G = await import('../../client/src/engine/generators/index.js');
const { stepEvidence, stepMetaFor } = await import('../platform/markerOps.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
await G.loadAllBanks();

const SEEDS = [1, 2, 3, 4, 5, 6];
let checks = 0, failed = 0;
const ok = (cond, label) => { checks++; if (!cond) { failed++; console.log(`FAIL: ${label}`); } };

const statusOf = (q, lines, index, typed = '99991') => {
  const ev = stepEvidence({ ...q }, typed, lines.join('\n'), checkAnswer(q, typed), { slipWarnings: true });
  const rep = ev.shownReport || ev.stepReport, l = rep && rep.lines && rep.lines[index];
  return l ? l.status : 'none';
};
const gen = (id, d, s) => { const q = G.generateQuestion(id, d, s); if (q.stepcheck && q.stepcheck.scheme) delete q.stepcheck; return q; };

// ── the oracle itself (a harness that cannot tell a wrong line from a right one proves nothing) ────────────────────────────
ok(judgeMutant('y=2x+1', 'y=2x+2') === 'wrong', 'oracle: a changed constant is wrong');
ok(judgeMutant('(x+1)^2=x^2+2x+1', '(x+1)^2=x^2+2x+1') === null, 'oracle: an unchanged line is not a mutant');
ok(judgeMutant('2(x+3)=2x+6', '2(x+3)=2x+6 ') === null || judgeMutant('2(x+3)=2x+6', '2( x+3)=2x+6') === null, 'oracle: a respelling is not a different line');
ok(judgeMutant('x^2-1=(x-1)(x+1)', 'x^2-1=(x-1)(x+2)') === 'wrong', 'oracle: a changed factor is wrong');
ok(judgeMutant('sin^(-1)((1)/(2))=((pi)/6)', 'sin^(-1)((1)/(2))=((pi)/4)') === 'wrong', 'oracle: inverse sine against the wrong angle is wrong');
ok(judgeMutant('pi[x^2]_0^(2)', 'pi[x^2]_1^(2)') === 'wrong', 'oracle: a changed limit is wrong');
ok(sideValues('2x+1', ['x']).every(v => v !== null), 'oracle: reads a linear side');
ok(sidesOf('a = b = c').length === 3, 'oracle: splits a chain');
{
  const kinds = new Set(mutationsOf('y=2x^(2)-3x+(sin(x))/(e^(2))+pi[x^3]_1^(2)').map(m => m.kind));
  for (const k of ['sign', 'number', 'exponent', 'dropped-term', 'swapped-function', 'limit', 'wrong-base', 'wrong-constant']) ok(kinds.has(k), `mutations: ${k} is generated`);
}

// ── the reviewer's 26 lines ────────────────────────────────────────────────────────────────────────────────────────────────
// chain rule, a wrong middle piece (the question is not issued by any current generator; the line is judged on its own prompt)
{
  const q = { prompt: 'Use the chain rule to differentiate $y = (2x^2 - 4)^{2}$.', answerType: 'expression', answer: { expr: '8x(2x^2-4)' }, difficulty: 2 };
  const page = bad => ['u = 2x^2 - 4, ((du)/(dx)) = 4x', '((dy)/(du))=2u', bad];
  for (const bad of ['((dy)/(dx))=3(2x^2-4)*4x=8x(2x^2-4)', '((dy)/(dx))=7(2x^2-4)*4x=8x(2x^2-4)', '((dy)/(dx))=2(3x^2-4)*4x=8x(2x^2-4)', '((dy)/(dx))=2(7x^2-4)*4x=8x(2x^2-4)',
    '((dy)/(dx))=2(2x^3-4)*4x=8x(2x^2-4)', '((dy)/(dx))=2(2x^7-4)*4x=8x(2x^2-4)', '((dy)/(dx))=2(2x^2-5)*4x=8x(2x^2-4)', '((dy)/(dx))=2(2x^2-11)*4x=8x(2x^2-4)',
    '((dy)/(dx))=2(2x^2-4)*5x=8x(2x^2-4)', '((dy)/(dx))=2(2x^2-4)*11x=8x(2x^2-4)']) {
    ok(statusOf(q, page(bad), 2) !== 'ok', `chain rule: a wrong middle piece is not ticked: ${bad}`);
  }
  ok(statusOf(q, page('((dy)/(dx))=2(2x^2-4)*4x=8x(2x^2-4)'), 2) !== 'break', 'chain rule: the true line is not crossed');
}
{
  const q = gen('me11-poly', 4, 4);
  ok(statusOf(q, ['P\'(x) = 3x^2+18x+24=3(x+4)(x+2)', 'x=-4 or x=-2', 'k=-((-4)^3+9((-4))^2+25((-4)))', 'k=16 or k=20'], 2) !== 'ok', 'repeated root: a worked sum with one wrong number that still reaches a root is not ticked');
  ok(statusOf(q, ['P\'(x) = 3x^2+18x+24=3(x+4)(x+2)', 'x=-4 or x=-2', 'k = -((-4)^3+9((-4))^2+24((-4)))', 'k=16 or k=20'], 2) === 'ok', 'repeated root: the authored line is still ticked');
}
{
  const q = gen('me11-functions', 3, 5);
  for (const bad of ['f^(-1)(-2) = 0', 'f^(-1)(-5) = 0']) ok(statusOf(q, ['f^(-1)(x) = ((x + 1)/(2))', bad], 1) !== 'ok', `inverse notation: ${bad} is not ticked`);
  ok(statusOf(q, ['f^(-1)(x) = ((x + 1)/(2))', 'f^(-1)(-1) = 0'], 1) === 'ok', 'inverse notation: the authored line is ticked');
}
{
  const q = gen('me12-calc', 3, 3);
  const lines = lim => ['2x=x^2', 'x=0', 'x=2', 'V=π∫_{0}^{2}(R^2-r^2)dx', 'R^2=2x', 'r^2=x^2', `V = pi[((2x^2)/(2)) - ((x^3)/(3))]_${lim}^(2)`];
  ok(statusOf(q, lines(3), 6) !== 'ok', 'volume: a wrong lower limit that reaches the same value (F(3) = F(0)) is not ticked');
  ok(statusOf(q, lines(0), 6) === 'ok', 'volume: the authored limits are ticked');
}
{
  const q = gen('me12-further-calc', 2, 2);
  const lines = g => ['y = tan^(-1)(1) = ((pi)/(4))', '(3/(1+9*(1/9)))=(3/2)', `y-((π)/4)=(${g})*(x-(1/3))`];
  for (const g of ['4/2', '9/2', '3/3', '3/7']) ok(statusOf(q, lines(g), 2) !== 'ok', `tangent: gradient ${g} is not ticked`);
  ok(statusOf(q, lines('3/2'), 2) === 'ok', 'tangent: the authored gradient is ticked');
}
// the true lines that were crossed
{
  const t = (q, lines, i, label) => ok(statusOf(q, lines, i) !== 'break', `true line not crossed: ${label}`);
  t(gen('y12-explogcalc', 2, 3), ['e^(-19k) = ((1)/(2))', '-19k=-ln2'], 0, 'e^(-19k) = 1/2 (the answer is stated to 3 places)');
  t(gen('me11-functions', 2, 6), ['f(x)=1+((-7)/(2x+1))', '((-7)/(2x+1))!=0', 'f(x)!=1', 'f^(-1)'], 1, '(-7)/(2x+1) != 0');
  t(gen('y11-transform', 4, 6), ['y=(x-1)^2', 'x', '((x)/2)'], 1, 'a bare x while replacing x by x/2');
  t(gen('me12-further-calc', 3, 1), ['6[sin^(-1)x]', 'x', '(1/2)', '((sqrt(2))/2)'], 3, 'a limit value');
  t(gen('me12-further-calc', 3, 2), ['4[sin^(-1)((x)/(2))]', '((x)/2)', '((sqrt(2))/2)', '((sqrt(3))/2)'], 2, 'a limit value (2)');
  t(gen('me12-further-calc', 3, 3), ['5[sin^(-1)x]', 'x', '(1/2)', '((sqrt(3))/2)'], 3, 'a limit value (3)');
  t(gen('me12-further-calc', 3, 4), ['k[sin^(-1)((x)/(2))]_0^(1)', 'k(sin^(-1)((1)/(2)) - 0) = ((kpi)/(6))', '((kπ)/6)=2π'], 1, 'an identity that evaluates a constant');
  t(gen('me12-further-calc', 3, 5), ['3[sin^(-1)((x)/(4))]', '((x)/4)', '((sqrt(2))/2)', '((sqrt(3))/2)'], 2, 'a limit value (5)');
}


// ── the rounded-value tick reads what the question ASKS (independent review of PR #1116) ───────────────────────────────────────
{
  const q = gen('me12-binomial', 3, 23);   // "find the standard deviation, correct to 2 decimal places"
  const at = line => statusOf(q, ['9*0.15*0.85=1.1475', line], 1);
  // the correct rounding at the asked places, or to more places, is ticked
  for (const good of ['√(1.1475) ≈ 1.07', '√(1.1475) ≈ 1.071', '√(1.1475) = 1.07']) ok(at(good) === 'ok', `rounded at or beyond the asked 2 places is ticked: ${good}`);
  // a truncation that is not the rounding, too few places, one out in the last place, and finite decimals written with an equals sign are not
  for (const bad of ['√(1.1475) ≈ 1.06', '√(1.1475) ≈ 1.08', '√(1.1475) ≈ 1.1', '√(1.1475) ≈ 1.0', '(54/100)=0.5', '(30/99)=0.3', '17845.61-14000=3845.6', '1+0.08=1.0', '(54/100) ≈ 0.5']) ok(at(bad) !== 'ok', `not ticked: ${bad}`);
  // an operand the question never gave and no earlier ticked line reached: the rounding does not hide it
  for (const bad of ['√(1.16) ≈ 1.08', '√(1.1476) ≈ 1.07']) ok(at(bad) !== 'ok', `an operand nobody reached is not ticked: ${bad}`);
  ok(statusOf(q, ['√(1.1475) ≈ 1.07'], 0) !== 'ok', 'with no earlier ticked line that reached 1.1475, the calculation is not ticked');
  {
    // the review's repro: a slipped operand hidden by a rounded result (y11-data-sets d1 seed 185)
    const d = gen('y11-data-sets', 1, 185);
    const page = last => ['16*90=1440', '29*81=2349', last];
    ok(statusOf(d, page('((2349+1440)/45)=84.2'), 2) === 'ok', 'the true calculation is ticked: every operand is given or reached');
    for (const bad of ['((2349+1439)/45)=84.2', '((2349+1441)/45)=84.2', '((2348+1440)/45)=84.2', '((2350+1440)/45)=84.2', '((2349+1440)/46)=84.2', '((2349+1440)/44)=86.1']) ok(statusOf(d, page(bad), 2) !== 'ok', `one operand changed by 1, the result still a correct rounding of the changed expression: not ticked: ${bad}`);
  }
  const e = gen('me12-calc', 4, 23);        // "Find the exact area"
  for (const bad of ['x = 128/3 ≈ 42.666', '128/3 = 42.666', '128/3 ≈ 42.667', '128/3 ≈ 42.67']) ok(statusOf(e, ['A = \\int_0^{16} \\sqrt{y}\\,dy', bad], 1) !== 'ok', `an exact question never takes a decimal as correct: ${bad}`);
  // no precision asked: a correct rounding to at least 3 significant figures is ticked, fewer is not
  const f = gen('y12-financial', 2, 5);
  ok(statusOf(f, ['(1.06)^5 = 1.3382'], 0) === 'ok', 'no precision asked: 5 significant figures, a correct rounding, is ticked');
  ok(statusOf(f, ['(1.06)^5 = 1.3'], 0) !== 'ok', 'no precision asked: 2 significant figures is not ticked');
  ok(statusOf(f, ['(1.06)^5 = 1.3383'], 0) !== 'ok', 'no precision asked: one out in the last place is not ticked');
}
// ── the tick classes of engine/provedLines.js (24 November 2026): each true line is ticked, each one-edit mutant is not ──────────
{
  // a solution list: a set, in any order, with ± and degrees; a wrong element, a wrong sign in a ± pair, an extra or a foreign unit is not ticked
  const q = gen('y11-trig-ident', 2, 11);
  for (const good of ['θ = 45°, -45°', '∴ θ = -45°, 45°', 'θ = 45° or θ = -45°', 'θ = ±45°']) ok(statusOf(q, ['cosθ = √2/2', good], 1) === 'ok', `solution list: ${good} is ticked`);
  for (const bad of ['θ = 45°, -35°', 'θ = 45°, 45°', 'θ = 45°, -135°', 'θ = 45°, 315°', 'θ = ±135°', 'θ = 45°', 'θ = 45, -45 rad', 'θ = ±45° (cos is positive)']) ok(statusOf(q, ['cosθ = √2/2', bad], 1) !== 'ok', `solution list: ${bad} is not ticked`);
  ok(statusOf(q, ['cosθ = √2/2', 'θ = 45°, -45°'], 0) === 'ok', 'restated equation: the question\'s own equation is ticked');
  ok(statusOf(q, ['cosθ = √2/3', 'θ = 45°, -45°'], 0) !== 'ok', 'restated equation: a changed equation is not ticked');
  ok(statusOf(q, ['cosθ = -√2/2', 'θ = 45°, -45°'], 0) !== 'ok', 'restated equation: a changed sign is not ticked');
}
{
  // a rounded value: to the places shown, rounded or truncated; one digit out is not ticked
  const q = gen('y12-financial', 2, 5);
  for (const good of ['(1.06)^5 = 1.338226', '(1.06)^5 = 1.33823', '(1.06)^5 = 1.3382']) ok(statusOf(q, [good], 0) === 'ok', `rounded value: ${good} is ticked`);
  for (const bad of ['(1.06)^5 = 1.338227', '(1.06)^5 = 1.338216', '(1.06)^5 = 1.33824', '(1.06)^5 = 1.3383', '(1.06)^5 = 1.338326', '(1.06)^6 = 1.338226', '(1.07)^5 = 1.338226']) ok(statusOf(q, [bad], 0) !== 'ok', `rounded value: ${bad} is not ticked`);
}
{
  // a labelled substitution, true as an identity in the unknown coefficients and giving a value the question gives
  const q = gen('me11-poly', 2, 5);
  const page = l => ['P(x) = x^3 + ax^2 + bx - 1', l];
  for (const good of ['P(1) = 0: 1 + a + b - 1 = 0', 'P(-3) = 20: -27 + 9a - 3b - 1 = 20']) ok(statusOf(q, page(good), 1) === 'ok', `substitution: ${good} is ticked`);
  for (const bad of ['P(1) = 0: 1 + a + b + 1 = 0', 'P(1) = 0: 1 + 2a + b - 1 = 0', 'P(1) = 0: 1 + a - b - 1 = 0', 'P(1) = 1: 1 + a + b - 1 = 1', 'P(-3) = 20: -27 + 9a + 3b - 1 = 20', 'P(-3) = 20: -27 + 9a - 3b - 2 = 20', 'P(-3) = 21: -27 + 9a - 3b - 1 = 21', 'P(2) = 0: 8 + 4a + 2b - 1 = 0']) ok(statusOf(q, page(bad), 1) !== 'ok', `substitution: ${bad} is not ticked`);
}
{
  // a derivative statement: the operator reaches one unit, so `d/dx (ax^n) + 1 = …` is not the derivative
  const q = gen('y12-diff', 1, 7);
  for (const good of ['((d)/(du))*sin u=cos u', '((d)/(dx))(ax^n) = anx^(n-1)']) ok(statusOf(q, [good], 0) === 'ok', `derivative statement: ${good} is ticked`);
  for (const bad of ['((d)/(du))*sin u=-cos u', '((d)/(du))*sin u=cos u+1', '((d)/(dx))(ax^n) + 1 = anx^(n-1)', '((d)/(dx))(ax^n) = anx^(n-2)', '((d)/(dx))(ax^n) = ax^(n-1)']) ok(statusOf(q, [bad], 0) !== 'ok', `derivative statement: ${bad} is not ticked`);
  ok(statusOf(q, ['((d)/(dx))cos(u) = -sin(u) * u\''], 0) === 'ok', 'chain rule statement is ticked');
  ok(statusOf(q, ['((d)/(dx))cos(u) = sin(u) * u\''], 0) !== 'ok', 'chain rule statement with the wrong sign is not ticked');
}
{
  // an identity, and an equation with exactly the question's solutions; one letter changed is neither
  const q = gen('y12-diff', 1, 7);
  ok(statusOf(q, ['cos(A - B) = cos(A)cos(B) + sin(A)sin(B)'], 0) === 'ok', 'identity: a true compound-angle line is ticked');
  ok(statusOf(q, ['cos(A - B) = cos(A)cos(B) - sin(A)sin(B)'], 0) !== 'ok', 'identity: a wrong sign is not ticked');
  ok(statusOf(q, ['f(0) = 1(1)^2 + 3(1) - 4'], 0) !== 'ok', 'identity: a function value written f(0) is never read as a product');
}

// ── the second review round: four classes ────────────────────────────────────────────────────────────────────────────────────
{
  // an equation between two expressions is ticked only when its sides are EQUAL, not when they merely share roots
  const q = gen('y11-polynomials', 4, 79);
  const page = rhs => ['P(6)=0', '(x-6)', `3x^3-24x^2+27x+54=${rhs}`, 'x=6'];
  for (const bad of ['2(x-6)(x-3)(x+1)', '1(x-6)(x-3)(x+1)', '4(x-6)(x-3)(x+1)', '(x-6)(x-3)(x+1)']) ok(statusOf(q, page(bad), 2) !== 'ok', `leading constant: ${bad} is not ticked`);
  ok(statusOf(q, page('3(x-6)(x-3)(x+1)'), 2) === 'ok', 'leading constant: the true factorisation is ticked');
  ok(statusOf(q, ['3x^3-24x^2+27x+54=0', '3(x-6)(x-3)(x+1)=0'], 0) === 'ok', 'leading constant: the question restated is ticked');
  const q2 = gen('y11-polynomials', 4, 105);
  for (const bad of ['1(x+2)(x-6)(x-3)', '3(x+2)(x-6)(x-3)']) ok(statusOf(q2, ['P(-2)=0', '(x+2)', `2x^3-14x^2+72=${bad}`, 'x=-2'], 2) !== 'ok', `leading constant (seed 105): ${bad} is not ticked`);
}
{
  // a value that is no root, after a line it does not satisfy (16^(-10) and 8^(-10) are both below 1e-9, and not equal)
  const q = gen('y11-explog', 3, 108);
  const page = last => ['(2^(4))^(4x - 2) = (2^(3))^(2x - 6)', '16x-8=6x-18', '10x=-10', last];
  ok(statusOf(q, page('x=-2'), 3) !== 'ok', 'a root of nothing, written after the line that gives x = -1, is not ticked');
  ok(statusOf(q, page('x=-1'), 3) === 'ok', 'the root is ticked');
}
{
  // a limit is its value, not its spelling
  const q = gen('me12-calc', 3, 71);
  const page = lim => ['3x=x^2', 'x=0', 'x=3', 'V=π∫_{0}^{3}(R^2-r^2)dx', 'R^2=3x', 'r^2=x^2', `V = pi[((3x^2)/(2)) - ((x^3)/(3))]_0^${lim}`];
  for (const lim of ['(3)', '(3.0)', '(2+1)', '3', '3.0']) ok(statusOf(q, page(lim), 6) === 'ok', `a limit written ${lim} is the limit 3`);
  for (const lim of ['(4)', '(2.9)', '(2+2)']) ok(statusOf(q, page(lim), 6) !== 'ok', `a limit written ${lim} is not ticked`);
}
{
  // a true self-contained arithmetic line is never crossed, on a derivative page or any other
  for (const [id, d, seed] of [['y11-diff', 1, 45], ['y11-diff', 2, 3], ['y12-diff', 1, 2], ['y12-diff', 3, 5]]) {
    const q = gen(id, d, seed);
    for (const at of [0, 1, 2]) {
      const base = ['((dy)/(dx)) = 2x', 'x = 1', 'y = 3'].slice(0, 2);
      const page = base.slice(0, at).concat(['2 + 3 = 5'], base.slice(at));
      ok(statusOf(q, page, at) !== 'break', `2 + 3 = 5 is not crossed (${id} ${d} ${seed}, line ${at + 1})`);
    }
    ok(statusOf(q, ['2 + 3 = 6'], 0) !== 'ok', `2 + 3 = 6 is not ticked (${id} ${d} ${seed})`);
  }
}

// ── a function value is a claim, not a label (the area stages) ─────────────────────────────────────────────────────────────────
{
  const q = gen('y12-integration', 3, 83);
  const page = l => ['F(x) = (((3x + 3)^(4))/(12))', l, '1620'];
  for (const bad of ['F(3)=1728-108', 'F(3)F(1)=1728-108', '-F(1)=1728-108', 'F(1)=1728-108']) ok(statusOf(q, page(bad), 1) !== 'ok', `an area line that names F at a number is not ticked for the difference: ${bad}`);
  ok(statusOf(q, page('F(3)-F(1)=1728-108'), 1) === 'ok', 'F(3) - F(1) = 1728 - 108 is ticked');
  const q2 = gen('y12-integration', 3, 20);
  ok(statusOf(q2, ['F(x) = (((4x + 2)^(4))/(16))', 'F(1)=81-1', '80'], 1) !== 'ok', 'F(1) = 81 - 1 is not ticked (F(1) is 81)');
}

// ── a rounded value is ticked only as the correct rounding or truncation to the places it shows ───────────────────────────────
{
  const q = gen('y12-financial', 3, 19);
  const page = v => ['FV = a(((1+r)^n - 1)/(r)) = 2600(((1.06)^(20) - 1)/(0.06))', `(1.06)^(20) = ${v}`];
  // (1.06)^20 = 3.20713547...
  for (const bad of ['3.2070', '3.2072', '3.206', '3.208', '3.20712', '3.20715']) ok(statusOf(q, page(bad), 1) !== 'ok', `a value one digit off is not ticked: (1.06)^(20) = ${bad}`);
  ok(statusOf(q, page('3.207'), 1) === 'ok', 'the authored 3.207 is ticked');
  // 3.20714 is NOT one digit off: 3.20713547... correct to 5 places IS 3.20714, so the page shows it ticked (the pass of engine/provedLines.js, feedback only); 3.20715 above is the wrong one
  ok(statusOf(q, page('3.20714'), 1) === 'ok', '3.20714 is the correct rounding to 5 places and is ticked');
  const m = mutationsOf('x = 1') ; ok(Array.isArray(m), 'mutationsOf still reads a plain line');
  const kinds = roundingMutants('(1.06)^(20) = 3.207').map(x => x.text);
  for (const t of ['(1.06)^(20) = 3.2070', '(1.06)^(20) = 3.2072', '(1.06)^(20) = 3.206', '(1.06)^(20) = 3.208']) ok(kinds.includes(t), `the harness generates the rounding mutant ${t}`);
}

// ── a lazy `=` that begins the next step ──────────────────────────────────────────────────────────────────────────────────────
{
  // `x = π/2` then `= 8` (the area): the value the worked solution reaches, begun under an unrelated value, is the start of the next step, never a false rewrite
  for (const [d, sd] of [[3, 104], [3, 109], [4, 104], [4, 109]]) {
    const q = gen('y12-trigcalc', d, sd);
    const lines = authoredPage(q, (await import('../../client/src/engine/solutionMatch.js'))._internals.spanToPlain);
    const at = lines.findIndex(l => /^=/.test(l));
    ok(at < 0 || statusOf(q, lines, at) !== 'break', `y12-trigcalc ${d} ${sd}: the line "${lines[at]}" is not crossed`);
    ok(at >= 0, `y12-trigcalc ${d} ${sd}: the authored page has a lazy "=" line`);
  }
}

// ── a root the question states rounded (answer.tol) ──────────────────────────────────────────────────────────────────────────
{
  // the diagnosis never says a line "lost a root" or "is false" for a root it holds to within the question's own rounding
  const { diagnoseStep } = await import('../../client/src/engine/diagnose.js');
  const lost = diagnoseStep({ brokenText: 'x^2 = 2', meta: { kind: 'equation', variable: 'x', solutions: [1.41, 3], tol: 0.01 } });
  ok(lost && lost.code === 'lost-root', `rounded root: the line holds at 1.41 within the stated rounding, so only 3 is lost (${lost && lost.code})`);
  const none = diagnoseStep({ brokenText: 'x^2 = 2', meta: { kind: 'equation', variable: 'x', solutions: [1.41], tol: 0.01 } });
  ok(none === null, `rounded root: no counterexample against a root the line holds to within the stated rounding (${none && none.code})`);
  const wrong = diagnoseStep({ brokenText: 'x^2 = 5', meta: { kind: 'equation', variable: 'x', solutions: [1.41], tol: 0.01 } });
  ok(wrong !== null, 'rounded root: a line that fails at the root even within the rounding is still diagnosed');
}
{
  // the local backend names the same step metadata as the server's marker (tol included)
  const B = await import('../../client/src/local/backend.js');
  let n = 0, withTol = 0, same = 0;
  for (const id of ['y11-sine-cosine-rule', 'y12-explogcalc', 'y12-trigcalc', 'y11-explog', 'y12-appdiff']) for (let d = 1; d <= 4; d++) for (let sd = 1; sd <= 3; sd++) {
    let q; try { q = G.generateQuestion(id, d, sd); } catch { continue; }
    n++; if (q.answer && q.answer.tol > 0) withTol++;
    if (JSON.stringify(B.examStepMeta(q)) === JSON.stringify(stepMetaFor(q))) same++;
  }
  ok(n >= 40 && withTol >= 10, `step metadata sample is not trivial (${n} questions, ${withTol} with a stated rounding)`);
  ok(same === n, `the local backend and the server's marker read the same step metadata (${same} of ${n})`);
}

// ── the recorded corpus ────────────────────────────────────────────────────────────────────────────────────────────────────────
const corpus = JSON.parse(fs.readFileSync(new URL('./fixtures/marking-mutation-corpus.json', import.meta.url), 'utf8'));
let corpusFalse = 0, corpusCross = 0, corpusFalseTicked = 0, corpusCrossed = 0, corpusInserted = 0;
{
  const E = await loadEngine(new URL('../..', import.meta.url).pathname);
  const pageOf = (generator, difficulty, seed) => {
    const q = E.G.generateQuestion(generator, difficulty, seed);
    const lines = authoredPage(q, E.spanToPlain);
    return { q, lines, answer: typedAnswer(q, 'wrong', lines) };
  };
  const cache = new Map();
  const page = (g, d, s) => { const k = `${g}|${d}|${s}`; if (!cache.has(k)) cache.set(k, pageOf(g, d, s)); return cache.get(k); };
  for (const [g, d, s, i, mutant] of corpus.falseTicks) {
    const { q, lines, answer } = page(g, d, s);
    const p = lines.slice(); p[i] = mutant;
    const rl = lineAt(markPage(E, q, answer, p), p, i);
    corpusFalse++;
    if (rl && rl.status === 'ok' && !/in front of it was not read/.test(rl.note || '')) { corpusFalseTicked++; ok(false, `corpus: ${g} ${d} ${s} line ${i + 1} is ticked again: ${mutant}`); }
  }
  for (const [g, d, s, i] of corpus.trueCrosses) {
    const { q, lines, answer } = page(g, d, s);
    const p = lines;
    const rl = lineAt(markPage(E, q, answer, p), p, i);
    corpusCross++;
    if (rl && rl.status === 'break') { corpusCrossed++; ok(false, `corpus: ${g} ${d} ${s} line ${i + 1} is crossed again: ${lines[i]}`); }
  }
  let corpusIns = 0, corpusInsCrossed = 0;
  for (const [g, d, sd, at] of corpus.insertedCrosses) {
    const { q, lines, answer } = page(g, d, sd);
    const p = lines.slice(0, at).concat(['2 + 3 = 5'], lines.slice(at));
    const rl = lineAt(markPage(E, q, answer, p), p, at);
    corpusIns++;
    if (rl && rl.status === 'break') { corpusInsCrossed++; ok(false, `corpus: 2 + 3 = 5 is crossed again at line ${at + 1} of ${g} ${d} ${sd}`); }
  }
  corpusInserted = corpusIns;
  ok(corpusIns === corpus.insertedCrosses.length && corpusIns >= 90, `the inserted-line corpus was read whole (${corpusIns})`);
  ok(corpusFalse === corpus.falseTicks.length && corpusCross === corpus.trueCrosses.length, 'the corpus was read whole');
  ok(corpusFalse >= 300 && corpusCross >= 20, `the corpus is not trivial (${corpusFalse} false ticks, ${corpusCross} crossed true lines)`);
}

// ── the precision a question asks, read from its words (independent review of PR #1116) ─────────────────────────────────────────
{
  const { precisionOf } = await import('../../client/src/engine/provedLines.js');
  const P = prompt => JSON.stringify(precisionOf({ prompt }));
  const cases = [
    ['Find x, correct to two decimal places.', { dp: 2 }], ['Find x to 2 decimal places.', { dp: 2 }], ['Give the answer to three decimal places.', { dp: 3 }], ['Find x, 2 d.p.', { dp: 2 }], ['Find x (2 dp).', { dp: 2 }],
    ['Find x, one decimal place.', { dp: 1 }], ['Find $x$ to $2$ decimal places.', { dp: 2 }], ['Find x to four significant figures.', { sf: 4 }], ['Find x to 3 significant figures.', { sf: 3 }],
    ['Find x, 3 s.f.', { sf: 3 }], ['Find x (3 sf).', { sf: 3 }], ['Give the answer to the nearest cent.', { dp: 2 }], ['to the nearest dollar', { dp: 0 }], ['to the nearest whole number', { dp: 0 }],
    ['to the nearest integer', { dp: 0 }], ['to the nearest degree', { dp: 0 }], ['to the nearest minute', { dp: 0 }], ['to the nearest tenth', { dp: 1 }], ['to the nearest hundredth', { dp: 2 }], ['to the nearest thousandth', { dp: 3 }],
    ['Find the exact value.', { exact: true }], ['Find x.', {}]
  ];
  for (const [prompt, want] of cases) ok(P(prompt) === JSON.stringify(want), `precision read from "${prompt}": ${P(prompt)}`);
}

// ── the harness over the authored pages ──────────────────────────────────────────────────────────────────────────────────────
{
  const res = await run({ seeds: SEEDS, maxPerLine: 8 });
  const t = res.totals;
  const aside = Object.entries(res.setAside).sort().map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`MARKING MUTATION COUNTS: seeds ${SEEDS[0]}-${SEEDS[SEEDS.length - 1]}, ${t.pages} pages, ${t.lines} authored lines, ${t.mutants} mutants, false ticks ${t.falseTicks}, true crosses ${t.trueCrosses}, inserted true lines ${t.insertedTrue || 0} (crossed ${t.insertedTrueCrosses || 0}), authored ticks ${t.trueTicks}, margin-number ticks ${t.marginNumberTicks || 0} (owner rule, own class), name definitions ${t.nameDefinitions || 0}, set aside as true statements ${t.echoes || 0} (${aside}), corpus ${corpusFalse} false ticks, ${corpusCross} crossed true lines and ${corpusInserted} crossed inserted true lines (ticked again ${corpusFalseTicked}, crossed again ${corpusCrossed})`);
  ok(t.pages >= 200 && t.mutants >= 2500, `the sample is not trivial (${t.pages} pages, ${t.mutants} mutants)`);
  ok(t.trueCrosses === 0, `no authored true line is crossed (${t.trueCrosses}: ${JSON.stringify(res.failures.trueCrosses.slice(0, 3))})`);
  ok(t.falseTicks === 0, `no provably wrong mutant is ticked (${t.falseTicks}: ${JSON.stringify(res.failures.falseTicks.slice(0, 3))})`);
  ok(t.trueTicks >= 600 * SEEDS.length / 2, `authored true lines are still ticked (${t.trueTicks})`);
  // the probes of the new tick classes (solution lists, ± pairs, rounded values, labelled substitutions): built here, mutated one edit at a time
  ok(res.probe.mutants >= 500 && res.probe.trueLines >= 150, `the probes are not trivial (${res.probe.trueLines} true lines, ${res.probe.mutants} mutants)`);
  ok(res.probe.falseTicks === 0, `no probe mutant is ticked (${res.probe.falseTicks})`);
  for (const k of ['solution-list', 'plus-minus', 'rounded', 'rounded-operand', 'substitution']) ok(res.probe.byClass[k] && res.probe.byClass[k].falseTicks === 0 && res.probe.byClass[k].mutants > 0, `probe class ${k}: mutants ran and none was ticked`);
  ok(res.probe.trueTicked >= 0.9 * (res.probe.trueLines - (res.probe.trueCrossed || 0)), `probe true lines are ticked (${res.probe.trueTicked} of ${res.probe.trueLines}, ${res.probe.trueCrossed || 0} crossed by the topic check before this pass)`);
}

// ── the author bank ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  // as the product reads and marks a page today (no bank scope): the legacy pin below is origin/main's own, and this tree must print it unchanged
  const B = await run({ bank: true, bankScope: false, maxPerLine: 6 });
  const t = B.totals;
  console.log(`MARKING MUTATION BANK COUNTS: ${t.pages} authored pages, ${t.lines} authored lines, ${t.mutants} mutants, false ticks ${t.falseTicks}, true crosses ${t.trueCrosses}, authored ticks ${t.trueTicks}, extraneous-root pages ${t.variantPages} (${t.variantLines} lines, crossed ${t.variantCrosses}), rejections ${t.rejectLines} (ticked ${t.rejectTicked}), false variants ${t.variantMutants} (ticked ${t.variantFalseTicks}), far-out roots of nothing ${t.largeRoots || 0} (crossed ${t.largeRootsCrossed || 0}, as on origin/main), inserted true lines ${t.insertedTrue || 0}`);
  ok(t.pages >= 700 && t.mutants >= 9000, `the bank sample is not trivial (${t.pages} pages, ${t.mutants} mutants)`);
  ok(t.trueCrosses === 0, `no authored bank line and no line of an extraneous-root page is crossed (${t.trueCrosses}: ${JSON.stringify(B.failures.trueCrosses.slice(0, 3))})`);
  ok(t.falseTicks === 0, `no provably wrong bank mutant is ticked (${t.falseTicks}: ${JSON.stringify(B.failures.falseTicks.slice(0, 3))})`);
  ok(t.variantPages >= 500 && t.variantMutants >= 900, `the extraneous-root sample is not trivial (${t.variantPages} pages, ${t.variantMutants} false variants)`);
  ok(t.rejectLines >= 150 && t.rejectTicked === t.rejectLines, `every rejection of a candidate root is ticked (${t.rejectTicked} of ${t.rejectLines})`);
  ok(t.trueTicks >= 1600, `authored bank lines are still ticked (${t.trueTicks})`);
}

{
  // the same pages read and marked in the bank's own scope (solutionMatch.withBankReading: the extended TeX reading the draft bank rules use)
  const B = await run({ bank: true, bankScope: true, maxPerLine: 6 });
  const t = B.totals;
  console.log(`MARKING MUTATION BANK SCOPED COUNTS: ${t.pages} authored pages, ${t.lines} authored lines, ${t.mutants} mutants, false ticks ${t.falseTicks}, true crosses ${t.trueCrosses}, authored ticks ${t.trueTicks}, extraneous-root pages ${t.variantPages} (${t.variantLines} lines, crossed ${t.variantCrosses}), rejections ${t.rejectLines} (ticked ${t.rejectTicked}), false variants ${t.variantMutants} (ticked ${t.variantFalseTicks}), far-out roots of nothing ${t.largeRoots || 0} (crossed ${t.largeRootsCrossed || 0}), inserted true lines ${t.insertedTrue || 0}`);
  ok(t.pages >= 700 && t.mutants >= 9000, `the bank sample is not trivial (${t.pages} pages, ${t.mutants} mutants)`);
  ok(t.trueCrosses === 0, `no authored bank line and no line of an extraneous-root page is crossed (${t.trueCrosses}: ${JSON.stringify(B.failures.trueCrosses.slice(0, 3))})`);
  ok(t.falseTicks === 0, `no provably wrong bank mutant is ticked (${t.falseTicks}: ${JSON.stringify(B.failures.falseTicks.slice(0, 3))})`);
  ok(t.variantPages >= 500 && t.variantMutants >= 900, `the extraneous-root sample is not trivial (${t.variantPages} pages, ${t.variantMutants} false variants)`);
  ok(t.rejectLines >= 150 && t.rejectTicked === t.rejectLines, `every rejection of a candidate root is ticked (${t.rejectTicked} of ${t.rejectLines})`);
  ok(t.trueTicks >= 1600, `authored bank lines are still ticked (${t.trueTicks})`);
}

// ── the live defect: Solve √(x+5) = x − 1 (A11-F1-172, answer 4) ─────────────────────────────────────────────────────────────────────────
{
  const pack = await import('../platform/qbankPack.js');
  const { MARKER_OPS, markerView } = await import('../platform/markerOps.js');
  await pack.ensureQbank({ ...process.env, PRI_EDITION: 'prithagoras' }, { strict: true });
  const q = markerView(pack.qbankEntryQuestion('A11-F1-172', 17));
  const mark = (working, answer = '4') => MARKER_OPS.practice({ q, answer, working, evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
  // the page the student sees (the rejection ticks are DISPLAY ONLY, markerOps `shownReport`); `deterministic` is the report the marks read
  const rows = (working, answer) => { const e = mark(working, answer).evidence; return (e.shownReport || e.stepReport).lines; };
  const deterministic = (working, answer) => mark(working, answer).evidence.stepReport.lines;
  const live = rows('x^2-3x-4=0\nx=-1\nx=4');
  ok(live.map(l => l.status).join() === 'ok,note,ok', `the live page: the squared equation ticked, x = -1 a note, x = 4 ticked (${live.map(l => l.status)})`);
  ok(/candidate/.test(live[1].note) && !/false/.test(live[1].note) && live[2].note == null, `x = -1 is called a candidate; the stray note on x = 4 is gone (${live[1].note} | ${live[2].note})`);
  ok(rows('x^2-3x-4=0\nx=-1 or x=4')[1].status !== 'break' && rows('x^2-3x-4=0\nx=4 or x=-1')[1].status !== 'break', 'x = -1 or x = 4 in one line is not crossed');
  ok(rows('x^2-3x-4=0\nx=±1')[1].status === 'break', 'x = ±1 names 1, a root of nothing: it is crossed');
  for (const reject of ['reject x=-1', 'x=-1 does not satisfy', 'x ≠ -1', 'x = -1 is extraneous', 'x = -1 (rejected)', 'x=-1 fails', 'x = -1 is not a solution', '-1 is rejected', 'x = -1 is rejected']) {
    const r = rows(`x^2-3x-4=0\nx=-1\n${reject}\nx=4`);
    ok(r[2].status === 'ok' && r[1].status === 'note' && r[3].status === 'ok', `"${reject}" is ticked after the candidate, the candidate stays a note, x = 4 is ticked (${r.map(l => l.status)})`);
    ok(deterministic(`x^2-3x-4=0\nx=-1\n${reject}\nx=4`)[2].status !== 'ok', `"${reject}" is NOT ticked in the deterministic report that pays`);
    if (!reject.includes('≠')) ok(rows(`x^2-3x-4=0\n${reject}\nx=4`)[1].status === 'ok', `"${reject}" is ticked straight after the squared equation`);
  }
  // a value that is a root of neither is never a candidate and never ticked, as a root or as a rejection; a real solution is never rejected
  ok(rows('x^2-3x-4=0\nx=7')[1].status === 'break', 'x = 7 (a root of nothing) is crossed');
  for (const w of ['reject x=7', 'x ≠ 7', 'x=7 does not satisfy', 'reject x=4', 'x ≠ 4', 'x = 4 is extraneous']) ok(rows(`x^2-3x-4=0\n${w}`)[1].status !== 'ok', `"${w}" is not ticked`);
  ok(rows('x^2-3x-4=0\nx=-1\nx=7')[2].status !== 'ok', 'x = 7 after the candidate is not ticked');
  // (review of 25 Nov) a value far out on the number line is a root of nothing on an exponential equation: crossed, never a candidate, never rejected as one
  {
    const qe = markerView(pack.qbankEntryQuestion('A11-E1-140', 17));
    const re = w => MARKER_OPS.practice({ q: qe, answer: '99991', working: w, evidenceIfWrong: true, policy: { methodMarks: true } }, () => {}).evidence.stepReport.lines;
    ok(re('5^(2x-1)=5^(3x-6)\nx=-12')[1].status === 'break', 'A11-E1-140: x = -12 is crossed, as on main');
    for (const w of ['reject x=-12', 'x ≠ -30', 'x = -12 is extraneous', 'x=-30 does not satisfy']) ok(re(`5^(2x-1)=5^(3x-6)\n${w}`)[1].status !== 'ok', `A11-E1-140: "${w}" is not ticked`);
    ok(re('5^(2x-1)=5^(3x-6)\nx=-30\nx ≠ -30')[2].status !== 'ok', 'A11-E1-140: x ≠ -30 after x = -30 is not ticked');
    for (const id of ['A11-E1-028', 'A11-E1-073']) {
      const qx = markerView(pack.qbankEntryQuestion(id, 17));
      let crossed = 0, n = 0;
      for (let x = -40; x <= -13; x++) { n++; const r = MARKER_OPS.practice({ q: qx, answer: '99991', working: `9^x=27^(x-1)\nx=${x}`, evidenceIfWrong: true, policy: { methodMarks: true } }, () => {}).evidence.stepReport.lines; if (r[1].status === 'break') crossed++; }
      ok(crossed === n, `${id}: x = -40 ... -13 are each crossed (${crossed} of ${n})`);
    }
  }
  // a rejection that says the opposite is never ticked
  for (const neg of ['x=-1 rejected or is it', 'x=-1 rejected and accepted', 'x=-1 rejected?', 'x=-1 rejected maybe', 'x=-1 is not rejected', 'x=-1 is not extraneous', 'x=-1 does not fail', 'x=-1 is not wrong', 'x=-1 is not false', 'x=-1 is NOT rejected', 'x=-1 does not satisfy but works', 'x=-1 is rejected but it works', 'x=-1 is valid']) {
    ok(rows(`x^2-3x-4=0\nx=-1\n${neg}\nx=4`)[2].status !== 'ok', `"${neg}" is not ticked`);
  }
  ok(rows('x^2-3x-4=0\nx ≠ -1')[1].status !== 'ok', 'the symbol alone is not read as a rejection unless it directly follows the candidate');
  // a root of a line the page could not judge is no candidate: crossed as on main
  ok(rows('(x-4)(x+7)=0\nx=-7\nx=4')[1].status === 'break', '(x-4)(x+7) = 0 does not make x = -7 a candidate: it is crossed, as on main');
  // the final answer is the answer check's alone: both roots as the answer is still wrong; the candidate alone is wrong; 4 is right
  ok(mark('x^2-3x-4=0\nx=-1\nx=4', '-1, 4').result.correct === false && mark('x^2-3x-4=0\nx=-1', '-1').result.correct === false && mark('x^2-3x-4=0\nx=4', '4').result.correct === true, 'the answer mark is unchanged: -1, 4 and -1 are wrong, 4 is right');
  // India reads a page as it did: a question not sealed by the Australian edition has no candidate reading
  const { stepEvidence } = await import('../platform/markerOps.js');
  const india = stepEvidence({ prompt: q.prompt, answerType: 'numeric', answer: { value: 4 }, answerPrefix: 'x =', steps: q.steps, difficulty: 2 }, '4', 'x^2-3x-4=0\nx=-1\nx=4', { correct: true }, { slipWarnings: true }).stepReport.lines;
  ok(india[1].status === 'break', `a question the Australian edition has not sealed reads the page as it always did (${india.map(l => l.status)})`);
}

// ── a value of the student's OWN function is a claim (QA 26 Nov 2026, item 12) ───────────────────────────────────────────────
// `F(x) = -5x^4` then `F(0) = 3`: F(0) is 0 by the student's own line. Crossed (alone or in a list) when it provably contradicts the definition
// written on the page; never crossed when true, undecidable, rounded, redefined, given by the question, or in an unknown angle unit.
{
  const { stepCheckArithmetic } = await import('../../client/src/engine/arithmeticLines.js');
  const arith = lines => stepCheckArithmetic(lines.join('\n')).lines.map(l => l.status);
  const q = G.generateQuestion('y12-integration', 1, 32);
  const topic = lines => { const typed = '-405'; const ev = stepEvidence({ ...q }, typed, lines.join('\n'), checkAnswer(q, typed), { slipWarnings: true }); return (ev.shownReport || ev.stepReport).lines.map(l => l.status); };
  const D = 'F(x) = -5x^4';
  // the defect: wrong values are crossed, on a question with no Step Check and on one with a plan
  ok(arith([D, 'F(3) = -405', 'F(0) = 3'])[2] === 'break', 'F(0) = 3 after F(x) = -5x^4 is crossed');
  ok(arith([D, 'F(3) = -405, F(0) = 3'])[1] === 'break', 'a list F(3) = -405, F(0) = 3 is crossed for its wrong part');
  ok(arith(['f(x) = x^2', 'f(3) = 10'])[1] === 'break', 'f(3) = 10 after f(x) = x^2 is crossed');
  ok(arith(['f(x) = x^2', 'f(1/2) = 1/4'])[1] !== 'break' && arith(['f(x) = x^2', 'f(2) = 1/4'])[1] === 'break', 'fractions are exact: f(1/2) = 1/4 is not crossed, f(2) = 1/4 is');
  ok(topic([D, 'F(3) = -405', 'F(0) = 3', '-405-0=-405'])[2] === 'break', 'on a question with a plan the crossed line is crossed on the card too');
  ok(topic([D, 'F(3) = -405, F(0) = 3'])[1] === 'break', 'a plan question: the list is crossed');
  // never a false cross
  ok(arith([D, 'F(3) = -405', 'F(0) = 0']).every(s => s !== 'break') && arith([D, 'F(3) = -405, F(0) = 0']).every(s => s !== 'break'), 'true values are never crossed');
  ok(topic([D, 'F(3) = -405, F(0) = 0', '-405-0=-405']).every(s => s !== 'break'), 'a true list on a plan question is never crossed');
  ok(arith(['F(x) = x^3 - x^2', 'F(3) = 18, F(0) = 0', 'F(1) = 0']).every(s => s !== 'break'), 'true values of x^3 - x^2 are never crossed');
  ok(arith(['f(x) = x^2', 'f(3) = 9.1']).every(s => s !== 'break') && arith(['f(x) = x^2', 'f(1.5) = 5']).every(s => s !== 'break'), 'a decimal is a rounding, never crossed');
  ok(arith(['f(x) = sin(x)', 'f(90) = 5']).every(s => s !== 'break') && arith(['f(x) = log(x)', 'f(100) = 5']).every(s => s !== 'break'), 'an unknown angle unit or log base is never crossed');
  ok(arith(['f(x) = e^2x', 'f(1) = 3']).every(s => s !== 'break'), 'an unbracketed exponent that can be read two ways is never crossed');
  ok(arith(['g(x) = x^2', 'f(3) = 10']).every(s => s !== 'break'), 'a function the page did not define is never judged');
  ok(arith(['f(x) = x^2', 'f(x) = x^2 + 1', 'f(3) = 10']).every(s => s !== 'break') && arith(['f(x) = x^2', 'f(x) = x^2 + 1', 'f(3) = 9']).every(s => s !== 'break'), 'a letter set twice may name either: nothing is crossed against it');
  ok(arith(['y = x^2', 'y = 2x', 'y(3) = 9']).every(s => s !== 'break') && arith(['y = 3x', 'y(2) = 9']).every(s => s !== 'break'), 'a letter that names an equation, not a function f(x), is never held to a value');
  ok(arith(['f(x) = x^2', 'f = 4', 'f(3) = 10']).every(s => s !== 'break'), 'a letter set again is no longer the function');
  ok(arith(['f(x) = x^2', '(b) f(3) = 10']).every(s => s !== 'break'), 'a new part of the question drops the definition');
  ok(arith(['f(x) = x^2', 'f(3) = 9 or 10']).every(s => s !== 'break'), 'a line that is not purely value claims is not read');
  // review of #1126: when in doubt, a note
  const none = lines => arith(lines).every(x => x !== 'break');
  ok(none(['k = 2', 'f(x) = kx', 'k = 5', 'f(3) = 15']) && none(['k = 2', 'f(x) = kx', 'f(3) = 6', 'k = 5', 'f(3) = 15']) && none(['k = 2', 'f(x) = kx', 'f(3) = 7']), 'a definition built on a letter that is set again is never judged');
  ok(none(['f(x) = πx', 'f(2) = 6']) && none(['f(x) = e^x', 'f(1) = 3']) && none(['f(x) = √2 x', 'f(2) = 3']) && none(['f(x) = sqrt(x)', 'f(2) = 1']), 'an irrational value may be rounded: never crossed');
  ok(none(['f(x) = x^0', 'f(0) = 5']) && none(['f(x) = 0^x', 'f(0) = 5']) && none(['f(x) = x^x', 'f(0) = 5']) && none(['f(x) = 1/x', 'f(0) = 5']) && none(['f(x) = x^(-1)', 'f(0) = 5']), 'undefined or conventional values (0^0, 1/0) are never crossed');
  ok(none(['f(x) = x^2 3', 'f(2) = 5']) && none(['f(x) = 2 3x', 'f(1) = 5']), 'a definition that reads two ways is never judged');
  ok(none(['f(x) = ln(x)', 'f(1) = 4']) && none(['f(x) = abs(x)', 'f(-2) = 5']) && none(['f(x) = exp(x)', 'f(0) = 5']), 'named functions (ln, log, abs, exp) are never judged');
  ok(arith(['f(x) = 2x + 1', 'f(3) = 8'])[1] === 'break' && arith(['f(x) = (x - 1)^2', 'f(3) = 5'])[1] === 'break', 'whole-number polynomials are still judged');
  ok(none(['f(x) = x^2^3', 'f(2) = 64']) && none(['f(x) = x^2^3', 'f(2) = 256']) && none(['f(x) = (x^2)^3', 'f(2) = 5']), 'a stacked power may be read either way: never judged (nor the bracketed one, held to the notes)');
  ok(none(['f(x) = 8/2*x', 'f(2) = 2']) && none(['f(x) = 8/2*x', 'f(2) = 8']) && none(['f(x) = 8/2x', 'f(2) = 2']) && none(['f(x) = 8/2 x', 'f(2) = 8']), 'a division followed by a product or juxtaposition may be read either way: never judged');
  ok(arith(['f(x) = x/2', 'f(4) = 3'])[1] === 'break' && arith(['f(x) = x^(2)', 'f(3) = 10'])[1] === 'break' && none(['f(x) = x/2', 'f(4) = 2']), 'the plain readings (x/2, x^(2)) are still judged, true ones never crossed');
  // generated true pages: no cross, and the same ticks that pay
  { let pages = 0, crossed = 0;
    for (const fam of ['y12-integration', 'y12-diff', 'y12-appdiff', 'me12-calc', 'y12-series']) for (let d = 1; d <= 4; d++) for (let sd = 1; sd <= 20; sd++) {
      let g; try { g = G.generateQuestion(fam, d, sd); } catch { continue; }
      const lines = (g.solution || g.steps || []).map(x => String(x.d || '').replace(/\$/g, '').replace(/\\[;,]/g, ' ')).filter(Boolean);
      if (!lines.length) continue;
      pages++;
      const st = (() => { try { return (stepEvidence({ ...g }, '99991', lines.join('\n'), checkAnswer(g, '99991'), { slipWarnings: true }).shownReport || {}).lines || []; } catch { return []; } })();
      crossed += st.filter(l => l.valueChain?.rule === 'function-value').length;
    }
    ok(pages >= 150 && crossed === 0, `generated authored pages are never crossed by the function-value rule (${pages} pages, ${crossed})`); }
  // the final-answer marks are unchanged by the cross
  { const withCross = stepEvidence({ ...q }, '-405', [D, 'F(3) = -405', 'F(0) = 3'].join('\n'), checkAnswer(q, '-405'), { slipWarnings: true });
    const without = stepEvidence({ ...q }, '-405', [D, 'F(3) = -405', 'F(0) = 0'].join('\n'), checkAnswer(q, '-405'), { slipWarnings: true });
    ok(JSON.stringify(withCross.topicTicks) === JSON.stringify(without.topicTicks), 'the cross copies no mark: the ticks that pay are the same'); }
}

console.log(failed ? `MARKING MUTATION: FAIL: ${failed} of ${checks} checks` : `MARKING MUTATION: PASS: ${checks} checks`);
process.exit(failed ? 1 : 0);
