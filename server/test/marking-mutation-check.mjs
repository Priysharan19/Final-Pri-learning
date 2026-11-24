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
// 4. A self-contained TRUE arithmetic line (`2 + 3 = 5`) inserted into every authored page is never crossed.
//
// Deterministic: fixed seeds, no model, no network.
import fs from 'node:fs';
import { run, judgeMutant, mutationsOf, sidesOf, sideValues, loadEngine, markPage, lineAt, authoredPage, typedAnswer } from '../../tools/marking-mutation-harness.mjs';

const G = await import('../../client/src/engine/generators/index.js');
const { stepEvidence, stepMetaFor } = await import('../platform/markerOps.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
await G.loadAllBanks();

const SEEDS = [1, 2, 3, 4, 5, 6];
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
}

console.log(failed ? `MARKING MUTATION: FAIL: ${failed} of ${checks} checks` : `MARKING MUTATION: PASS: ${checks} checks`);
process.exit(failed ? 1 : 0);
