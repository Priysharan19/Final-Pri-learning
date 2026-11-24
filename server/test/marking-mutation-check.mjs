// Pri Learning · marking mutation check.
//
// 1. The 26 lines an independent reviewer found live on main (18 false lines the marked page TICKED, 8 true authored lines it CROSSED), each
//    pinned by the class that caused it: the line is not ticked / not crossed now.
// 2. The mutation harness (tools/marking-mutation-harness.mjs) over every authored true solution page of the Years 11-12 Advanced and
//    Extension 1 generators: no true line is crossed, and no line that is provably wrong (one edit of a sign, a number, an exponent, a
//    term, a function, a limit, a base or a constant, proved false by the harness's own numeric evaluation) is ticked.
//
// Deterministic: fixed seeds, no model, no network.
import { run, judgeMutant, mutationsOf, sidesOf, sideValues } from '../../tools/marking-mutation-harness.mjs';

const G = await import('../../client/src/engine/generators/index.js');
const { stepEvidence } = await import('../platform/markerOps.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
await G.loadAllBanks();

let checks = 0, failed = 0;
const ok = (cond, label) => { checks++; if (!cond) { failed++; console.log(`FAIL: ${label}`); } };

const statusOf = (q, lines, index, typed = '99991') => {
  const ev = stepEvidence({ ...q }, typed, lines.join('\n'), checkAnswer(q, typed), { slipWarnings: true });
  const l = ev.stepReport && ev.stepReport.lines && ev.stepReport.lines[index];
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

// ── the harness over the authored pages ──────────────────────────────────────────────────────────────────────────────────────
{
  const res = await run({ seeds: [1, 2], maxPerLine: 8 });
  const t = res.totals;
  console.log(`harness: ${t.pages} pages, ${t.lines} authored lines, ${t.mutants} provably wrong mutants (${t.echoes || 0} true restatements and ${t.nameDefinitions || 0} name definitions set aside); ticks on authored lines ${t.trueTicks}`);
  ok(t.pages >= 200 && t.mutants >= 2500, `the sample is not trivial (${t.pages} pages, ${t.mutants} mutants)`);
  ok(t.trueCrosses === 0, `no authored true line is crossed (${t.trueCrosses}: ${JSON.stringify(res.failures.trueCrosses.slice(0, 3))})`);
  ok(t.falseTicks === 0, `no provably wrong mutant is ticked (${t.falseTicks}: ${JSON.stringify(res.failures.falseTicks.slice(0, 3))})`);
  ok(t.trueTicks >= 600, `authored true lines are still ticked (${t.trueTicks})`);
}

console.log(failed ? `MARKING MUTATION: FAIL: ${failed} of ${checks} checks` : `MARKING MUTATION: PASS: ${checks} checks`);
process.exit(failed ? 1 : 0);
