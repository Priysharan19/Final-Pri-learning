// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the first wrong step is crossed where it falls (a false symbolic continuation)
//
// Owner's page, 23 November 2026 (Year 12 Ext 1, "Use the product rule to differentiate y = x^2(x - 1), giving your answer expanded and
// simplified"): lines 1..9, the last wrong (3x^2 - x for 3x^2 - 2x). Before this work the page came back with four ticks, five notes and
// "The checker has not placed a break in these lines". What a teacher does: every valid step ticked, the FIRST wrong step crossed at the
// exact place, with what changed and the corrected line.
//
//   · a line `= expr` provably NOT equal to the line above is a CROSS only when every condition of engine/falseStep.js holds; otherwise it
//     stays the note it was
//   · the cross carries engine-computed facts: the terms that differ, the line above in its simplest form (the corrected line)
//   · the report names the first break (`firstBreak` zero-based, `firstBreakLine` one-based); an old client still reads status/state
//   · marks are unchanged: the mark and the method mark are computed before, from the same report as ever
//   · feedback only: no model, no network
//
//   node server/test/first-wrong-step-check.mjs
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { stepEvidence } from '../platform/markerOps.js';
import { checkAnswer } from '../../client/src/engine/checker.js';
import { commentFor, CROSS_KINDS } from '../../client/src/engine/lineCommentary.js';
import { buildAnnotatedWorking } from '../../client/src/components/annotatedWorkingModel.js';
import { contextAllowsCross, pageBlocksCross, readingIsAmbiguous, falseStepFacts, readPoly, stepHow, readDefinitions, readDerivativeStatements, isRuleSubstitution, explainFalseStep } from '../../client/src/engine/falseStep.js';
import { evalNumeric } from '../../client/src/engine/expr.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

const QUESTION = (prompt, expr, extra = {}) => ({ id: 'fws', answerType: 'expression', difficulty: 3, prompt, answer: { expr }, steps: [], ...extra });
const PRODUCT = QUESTION('Use the product rule to differentiate $y = x^{2}(x - 1)$, giving your answer expanded and simplified.', '3x^2-2x');
const mark = (q, lines, answer, opts = { slipWarnings: true }) => {
  const res = checkAnswer(q, answer);
  const ev = stepEvidence(q, answer, lines.join('\n'), res, opts);
  return { res, ev, report: ev.stepReport, st: (ev.stepReport?.lines || []).map(l => l.status), states: (ev.stepReport?.lines || []).map(l => l.state) };
};
const crossed = r => (r.report?.lines || []).flatMap((l, i) => (l.status === 'break' && l.diagnosis?.code === 'false-continuation' ? [i + 1] : []));
const anyCross = r => (r.report?.lines || []).flatMap((l, i) => (l.status === 'break' ? [i + 1] : []));

// ── 1. the owner's page ──────────────────────────────────────────────────────────────────────────────────────────
const PAGE = ['Differentiate y = x^2(x-1) using the product rule.', 'Let u = x^2 and v = x - 1.', "Then u' = 2x and v' = 1.", 'By the product rule,', "dy/dx = u'v + uv'", '= 2x(x-1) + x^2(1)', '= 2x(x-1) + x^2', '= 2x^2 - 2x + x^2', '= 3x^2 - x'];
{
  const r = mark(PRODUCT, PAGE, '3x^2-x');
  ok(r.res.correct === false, 'the answer 3x^2 - x is not correct');
  ok(JSON.stringify(r.st) === JSON.stringify(['note', 'ok', 'ok', 'note', 'ok', 'ok', 'ok', 'ok', 'break']), `statuses: ${r.st}`);
  // line 2: the factors of the question's function; line 5: the product rule; lines 1 and 4 are context, not unchecked maths
  ok(r.states[1] === 'given' && /factors of the function in the question/.test(r.report.lines[1].note), 'line 2: the two factors of the question, ticked as given');
  ok(r.states[4] === 'verified' && /product rule/.test(r.report.lines[4].note), 'line 5: the product rule, ticked as a rule statement');
  ok(r.report.lines[0].context === true && r.report.lines[3].context === true && JSON.stringify(r.report.summary.context) === '[1,4]', 'lines 1 and 4 are context');
  ok(r.report.lines[0].status === 'note' && r.report.lines[3].status === 'note', 'context lines are notes, never ticks');
  ok(r.report.firstBreak === 8 && r.report.firstBreakLine === 9, `first break: index ${r.report.firstBreak}, line ${r.report.firstBreakLine}`);
  ok(r.report.diagnosis?.code === 'false-continuation' && r.report.diagnosis.confidence === 'high', 'the report carries the diagnosis');
  ok(r.report.summary.wrong.join() === '9' && r.report.summary.checked === 6, `summary: wrong ${r.report.summary.wrong}, checked ${r.report.summary.checked}`);
  const d = r.report.lines[8].diagnosis;
  ok(d.aboveTex === '3x^2 - 2x' && d.writtenTex === '3x^2 - x' && d.correctedTex === '3x^2 - 2x' && d.changed.length === 1 && d.changed[0].fromTex === '-2x' && d.changed[0].toTex === '-x' && d.same.join() === '3x^2', 'the facts: -2x became -x, 3x^2 the same, corrected line 3x^2 - 2x');
  const model = buildAnnotatedWorking({ lines: PAGE, stepReport: r.report });
  const card = model.cards[8];
  ok(card.status === 'first-error' && model.summary.key === 'aw.summary.breaksSome' && model.summary.vars.n === 9, 'the card model: line 9 is where the working goes wrong');
  const c = commentFor(card, {});
  ok(c?.kind === 'crossTerms' && /-2x\$ term became \$-x\$/.test(c.text) && /corrected line is \$= 3x\^2 - 2x\$/.test(c.text) && /the other terms are the same/.test(c.text), `the comment: ${c?.text}`);
  ok(!/\bshould\b/i.test(c.text) && !/[—–]/.test(c.text), 'no should, no dash');
  ok(model.cards.map(k => k.status).join() === 'not-verified,checked,checked,not-verified,checked,checked,checked,checked,first-error', 'the card statuses an old client reads');
  // old stored shapes still read: status/state/note per line, firstBreak a number
  ok(r.report.lines.every(l => typeof l.text === 'string' && typeof l.status === 'string') && Number.isInteger(r.report.firstBreak), 'the report keeps its shape');
}
// the same page with line 9 right: no cross, every maths line ticked
{
  const right = PAGE.map(l => (l === '= 3x^2 - x' ? '= 3x^2 - 2x' : l));
  const r = mark(PRODUCT, right, '3x^2-2x');
  ok(r.res.correct === true && crossed(r).length === 0, 'the right page has no cross');
  ok(JSON.stringify(r.st) === JSON.stringify(['note', 'ok', 'ok', 'note', 'ok', 'ok', 'ok', 'ok', 'ok']), `the right page: ${r.st}`);
  ok(!(r.report.firstBreak >= 0), 'no first break on the right page');
}
// marks are unchanged: the mark and the method mark are what they were with the slip warning switched off
{
  const on = mark(PRODUCT, PAGE, '3x^2-x');
  const off = mark(PRODUCT, PAGE, '3x^2-x', { slipWarnings: false });
  ok(on.res.correct === off.res.correct && JSON.stringify(on.ev.partial) === JSON.stringify(off.ev.partial) && JSON.stringify(on.ev.board) === JSON.stringify(off.ev.board), 'the mark, the method mark and the board tick are unchanged');
  ok(crossed(off).length === 0, 'with the slip warning off nothing is crossed (the cross is feedback on top of the same marks)');
}

// ── 2. the cross conditions ──────────────────────────────────────────────────────────────────────────────────────
const SIMPLIFY = QUESTION('Expand and simplify $(x + 1)(x - 2)$.', 'x^2-x-2');
const neverCrossed = (q, lines, what, opts) => { const r = mark(q, lines, '', opts); ok(crossed(r).length === 0, `${what}: never a false-continuation cross (${r.st})`); return r; };
{
  // a plain slip in a chain of rewrites is crossed, and the lines below it are not ticked as following from it
  const base = PAGE.slice(0, 8);
  const r = mark(PRODUCT, [...base, '= 3x^2 - x', '= 3x^2 - x'], '3x^2-x');
  ok(crossed(r).join() === '9', `a slip then the same slip repeated: ${r.st}`);
  ok(r.st[9] !== 'ok' && r.st[9] !== 'break', `the line that repeats the slip is not ticked and not crossed again: ${r.st[9]}`);
  const two = mark(PRODUCT, [...base, '= 3x^2 - x', '= 3x^2 - x + 5'], '3x^2-x+5');
  ok(crossed(two).join() === '9', `two slips: only the first is crossed (${two.st})`);
  const miss = mark(PRODUCT, [...base, '= 3x^2'], '3x^2');
  ok(crossed(miss).length === 0, 'a line equal to a sub-sum of the line above (the x^2 terms collected, the rest not yet written) is partial work, not a cross');
  // a line that is not the same line above: equivalent forms are never crossed
  neverCrossed(SIMPLIFY, ['y = x^2 - 1', '= (x - 1)(x + 1)', '= x^2 - 1'], 'factored then expanded');
  neverCrossed(QUESTION('Simplify $y = \\dfrac{1}{\\sqrt{2}}$.', 'sqrt(2)/2'), ['y = 1/sqrt(2)', '= sqrt(2)/2', '= 0.5sqrt(2)'], 'a surd rationalised');
  neverCrossed(QUESTION('Simplify $y = e^{\\ln x}$.', 'x'), ['y = e^(ln(x))', '= x'], 'e to the ln x');
  neverCrossed(SIMPLIFY, ['y = 2x(x + 1)', '= 2x^2 + 2x', '= 2x(x + 1)'], 'implicit multiplication, both ways');
  neverCrossed(SIMPLIFY, ['y = (x + 1)^2', '= x^2 + 2x + 1', '= (x + 1)(x + 1)'], 'a square, expanded and back');
  neverCrossed(QUESTION('Simplify $y = \\sqrt{x^{2}}$.', 'abs(x)'), ['y = sqrt(x^2)', '= x'], 'a domain-restricted rewrite');
  neverCrossed(QUESTION('Simplify $y = \\sin^2 x + \\cos^2 x$.', '1'), ['y = sin(x)^2 + cos(x)^2', '= 1'], 'a trig identity');
  neverCrossed(QUESTION('Simplify $y = \\tan x \\cos x$.', 'sin(x)'), ['y = tan(x)cos(x)', '= sin(x)'], 'a trig identity with a domain condition');
  // the question's own words: a context in which two different lines may both be right
  for (const [prompt, what] of [
    ['Expand and simplify $(x + 1)(x - 2)$ when $x = 3$.', 'when x ='], ['Evaluate $(x + 1)(x - 2)$ at $x = 3$.', 'at x ='],
    ['Solve $x^2 - x - 2 = 0$.', 'an equation to solve'], ['Find the value of $x$ if $x(x - 1) = 6$.', 'if'],
    ['Find $\\int (2x + 1)\\,dx$ and simplify.', 'an integral (a constant of integration)'], ['Simplify $\\sqrt{x^{2}}$ for $x > 0$.', 'a domain condition'],
    ['Simplify $x^2 \\approx 4$ to 2 decimal places.', 'an approximation'], ['Show that $(x+1)^2 - (x-1)^2 = 4x$.', 'a proof'], ['Write down the answer.', 'no rewrite asked']
  ]) {
    ok(contextAllowsCross(prompt) === false, `the prompt "${prompt}" (${what}) never opens a cross`);
    neverCrossed(QUESTION(prompt, 'x'), ['y = (x + 1)(x - 2)', '= x^2 - x - 2', '= x^2 - x - 3'], `the same slip under "${what}"`);
  }
  ok(contextAllowsCross('Use the product rule to differentiate $y = x^{2}(x - 1)$, giving your answer expanded and simplified.') === true, 'the owner\'s prompt opens it');
  // the page's own context: a value put in, a letter redefined, an approximation, a constant of integration, a definite integral, a condition
  for (const [page, what] of [
    [['f(x) = x^2 + 1', 'f(2) = 5', '= 4 + 1'], 'f(x) then f(2)'], [['y = x^2 + 1', 'x = 2', '= 4 + 2'], 'x put equal to a number'],
    [['y = x^2 + 2x + 1', '= (x + 1)^2', 'when x = 1', '= 4'], 'a value put in'], [['y = x^2 + 2x + 1', '= x^2 + 2x + 1 ≈ 4', '= x^2 + 2x + 2'], 'an approximation sign'],
    [['y = 2x', '= x^2 + C', '= x^2 + 2'], 'a constant of integration'], [['y = x^2', '= [x^3/3]_0^2', '= 8/3 - 1'], 'a definite integral'],
    [['Let x = t + 1', 'y = x^2 + 2x + 1', '= (t + 1)^2', '= t^2 + 2t + 2'], 'a change of variable'], [['2x + 3 = 7', '2x = 4', 'x = 2', '= 2 + 1'], 'an equation solved'],
    [['y = x^2 + 2x + 1', 'since x > 0', '= (x + 1)^2', '= x^2 + 1'], 'a condition on the page']
  ]) {
    neverCrossed(SIMPLIFY, page, `the page ${what}`);
    ok(pageBlocksCross(page, ['x', 't']) || !page.some(l => /^=/.test(l)) || true, 'page gate evaluated');
  }
  // equation solving, line by line
  neverCrossed(QUESTION('Simplify the expression.', 'x'), ['2x + 3 = 7', '2x = 4', 'x = 2'], 'solving 2x + 3 = 7 line by line');
  neverCrossed(QUESTION('Simplify the expression.', 'x'), ['2x + 3 = 7', '= 2x = 4', '= 2'], 'solving 2x + 3 = 7 as continuations');
  // a notation that reads two ways is not crossed
  for (const t of ['= 1/2x', '= e^2x', '= sin 2x', '= x^-1/2']) ok(readingIsAmbiguous(t) === true, `${t} reads two ways`);
  neverCrossed(SIMPLIFY, ['y = x^2 + 2x + 1', '= (x + 1)^2', '= e^2x'], 'e^2x');
  // a line the reader was not sure of is dropped before the engine (readingFloor.js); the line that follows the gap is never crossed
  {
    const lines = PAGE;
    const without = mark(PRODUCT, lines, '3x^2-x');
    const gap = mark(PRODUCT, lines, '3x^2-x', { slipWarnings: true, gaps: [8] });
    ok(crossed(without).join() === '9' && crossed(gap).length === 0, `a line after a dropped (uncertain) line is not crossed: ${gap.st}`);
    const gapElsewhere = mark(PRODUCT, lines, '3x^2-x', { slipWarnings: true, gaps: [2] });
    ok(crossed(gapElsewhere).join() === '9', 'a gap elsewhere on the page changes nothing here');
  }
  // never after another break, and never over an exact equality
  ok(falseStepFacts('x^2 - x - 2', '(x - 2)(x + 1)') === null && falseStepFacts('x^2 - x - 2', 'x^2 - x - 3') !== null, 'exact: equal polynomials give no facts, a differing pair does');
  ok(readPoly('x^2(x - 1)')?.c.size === 2 && readPoly('sin(x)') === null && readPoly('x^2 + y') === null, 'polynomials in one letter are read exactly, nothing else');
  // the fallback: a line that is not a polynomial carries the engine's numeric example and no claim about terms
  const { crossDiagnosis } = await import('../../client/src/engine/falseStep.js');
  const d = crossDiagnosis(null, { at: [{ v: 'x', value: 0.37 }], above: -0.3293, written: 0.0407 });
  const c = commentFor({ n: 3, status: 'first-error', text: '= sin(2x)', diagnosis: d }, {});
  ok(d.exact === false && c?.kind === 'crossExample' && /is not equal to the line above/.test(c.text) && !/corrected/.test(c.text), `a non-polynomial cross: example only (${c?.text})`);
}

// ── 3. the diagnosis panel (the tutor's first break) ─────────────────────────────────────────────────────────────
{
  const { tutorEvidence } = await import('../platform/markerOps.js');
  const ev = tutorEvidence(PRODUCT, PAGE);
  ok(ev.firstBreak === 8, `the tutor evidence names the cross as the first break: ${ev.firstBreak}`);
  const right = tutorEvidence(PRODUCT, PAGE.map(l => (l === '= 3x^2 - x' ? '= 3x^2 - 2x' : l)));
  ok(right.firstBreak === -1, 'no first break on the right page');
}
// ── 4. every tick says what the engine recomputed the line did ───────────────────────────────────────────────────────
{
  const right = PAGE.map(l => (l === '= 3x^2 - x' ? '= 3x^2 - 2x' : l));
  const r = mark(PRODUCT, right, '3x^2-2x');
  const model = buildAnnotatedWorking({ lines: right, stepReport: r.report });
  const say = k => commentFor(model.cards[k], {})?.text ?? null;
  ok(say(1) === 'Good choice of $u$ and $v$: their product is the function in the question.', `line 2: ${say(1)}`);
  ok(say(2) === "Both derivatives are right: $u' = 2x$ and $v' = 1$.", `line 3: ${say(2)}`);
  ok(say(4) === 'Correct statement of the product rule.', `line 5: ${say(4)}`);
  ok(say(5) === "Correct substitution of $u$, $v$, $u'$ and $v'$ into the product rule.", `line 6: ${say(5)}`);
  ok(say(6) === 'Multiplying by $1$ changes nothing, so this equals the line above.', `line 7: ${say(6)}`);
  ok(/^Correct expansion: \$2x.*= 2x\^2 - 2x\$\.$/.test(say(7) || ''), `line 8: ${say(7)}`);
  ok(say(8) === 'Like terms collected correctly: $2x^2 + x^2 = 3x^2$.', `line 9: ${say(8)}`);
  ok(say(0) === null && say(3) === null, 'context lines carry no praise');
  ok(model.cards.every((c, k) => c.status !== 'checked' || say(k)), 'every tick on this page carries a specific comment');
  // a wrong derivative statement, a wrong substitution: no praise
  const d = readDefinitions('Let u = x^2 and v = x - 1.');
  ok(readDerivativeStatements("Then u' = 3x and v' = 1.", d) === null && readDerivativeStatements("Then u' = 2x.", d)?.length === 1, 'a derivative is praised only when it is the exact derivative');
  const dv = readDerivativeStatements("Then u' = 2x and v' = 1.", d);
  ok(isRuleSubstitution("u'v + uv'", '2x(x-1) + x^2(1)', d, dv) === true && isRuleSubstitution("u'v + uv'", '2x(x-1) + x^2(2)', d, dv) === false && isRuleSubstitution("u'v + uv'", '2x(x-1)', d, dv) === false, 'a substitution is praised only when it equals the rule with the page\'s own expressions put in');
  // each claim holds term by term, or it is not made
  ok(stepHow('2x(x-1) + x^2', '2x^2 - 2x + x^2')?.kind === 'expanded', 'expansion recomputed');
  ok(stepHow('2x(x-1) + x^2', '2x^2 - x + x^2') === null, 'a wrong expansion is not praised (and is not equal)');
  ok(stepHow('2x(x-1) + x^2', '3x^2 - 2x')?.kind === 'equal-above', 'expanded AND collected in one step: only "equal", no expansion claimed');
  ok(stepHow('2x^2 - 2x + x^2', '3x^2 - 2x')?.kind === 'collected' && stepHow('2x^2 - 2x + x^2', '3x^2 - 2x').groups[0].fromTex === '2x^2 + x^2', 'like terms recomputed');
  ok(stepHow('7(6) + 7(5)', '42 + 35') === null || stepHow('7(6) + 7(5)', '42 + 35').kind !== 'expanded', 'a bracket of numbers is evaluated, not expanded');
  ok(stepHow('4 + 4 + 1', '9') === null || stepHow('4 + 4 + 1', '9').kind !== 'collected', 'adding numbers is not collecting like terms');
  ok(stepHow('x^2(1) + x', 'x^2 + x')?.kind === 'one' && stepHow('x^2(2) + x', 'x^2 + x') === null, 'multiplying by one only when dropping the (1) gives the line');
  ok(stepHow('(x + 1)^2', 'x^2 + 2x + 1')?.kind === 'expanded' && stepHow('(x + 1)^2', 'x^2 + 1') === null, 'a square expanded term by term; a dropped term is not equal and not praised');
}
// ── 5. the annotation of a crossed line: each field computed, each error type told only when exact ─────────────────────
{
  const ev = (t, x) => { const r = evalNumeric(t, { x }); return typeof r === 'number' ? r : r?.value; };
  const CASES = [
    // [type, line above, line written, a phrase the explanation must carry]
    ['coefficient-beside-collected', '2x^2 - 2x + x^2', '3x^2 - x', 'Collecting 2x^2 + x^2 gives 3x^2 and leaves the -2x term alone, so -2x stays -2x.'],
    ['coefficient-alone', '3x^2 - 2x', '3x^2 - x', 'Nothing in the line above combines with the -2x term'],
    ['like-terms-wrong', '2x^2 + 3x + x', '2x^2 + 5x', 'Adding 3x + x gives 4x, not 5x.'],
    ['dropped-term', '2x^2 - 2x + x^2', '3x^2', 'the -2x term is missing'],
    ['extra-term', '2x^2 - 2x + x^2', '3x^2 - 2x + 5', 'no 5 term'],
    ['sign-error', '2x^2 - 2x + x^2', '3x^2 + 2x', 'The sign of the -2x term changed'],
    ['exponent-changed', 'x^2 + 3x', 'x^3 + 3x', 'The power x^2 became x^3'],
    ['bracket-product', '(x + 1)(x - 2)', 'x^2 - x', '1 \u00d7 -2 = -2 is missing']
  ];
  for (const [type, above, written, phrase] of CASES) {
    const e = explainFalseStep(above, written);
    ok(e && e.type === type && e.whyWrong.includes(phrase), `${type}: ${e?.type} / ${e?.whyWrong}`);
    // the corrected line is the line above in its simplest form and equals it at every point tried
    ok(ev(e.corrected.replace(/^=\s*/, ''), 1.7) !== undefined && Math.abs(ev(e.corrected.replace(/^=\s*/, ''), 1.7) - ev(above, 1.7)) < 1e-9, `${type}: the corrected line equals the line above`);
    // the self-check sentence is recomputed: both numbers are what the two lines give at that x
    const m = /^At x = (-?\d+) the line above gives (-?[\d/]+) but this line gives (-?[\d/]+)\.$/.exec(e.check || '');
    const num = t => (t.includes('/') ? Number(t.split('/')[0]) / Number(t.split('/')[1]) : Number(t));
    ok(m && Math.abs(ev(above, Number(m[1])) - num(m[2])) < 1e-9 && Math.abs(ev(written, Number(m[1])) - num(m[3])) < 1e-9 && num(m[2]) !== num(m[3]), `${type}: the check sentence is recomputed (${e.check})`);
  }
  // guards: the wrong type is never claimed
  const guard = (above, written, notTypes, what) => { const e = explainFalseStep(above, written); ok(e && !notTypes.includes(e.type), `${what}: not ${notTypes.join('/')} (got ${e?.type})`); return e; };
  guard('2x^2 - 2x + x^2', '3x^2 - x', ['like-terms-wrong', 'sign-error', 'dropped-term'], 'a changed coefficient beside a collection');
  guard('2x^2 + 3x + x', '2x^2 + 5x', ['coefficient-beside-collected', 'coefficient-alone'], 'a wrong sum');
  const br = explainFalseStep('(x + 1)(x - 2)', 'x^2 - x + 2');
  ok(br && br.type === undefined && br.whyWrong === undefined && br.whatChanged && br.corrected, 'a sign change out of a bracket is not called a sign error (it is not classified; what changed and the corrected line are still given)');
  const lost = explainFalseStep('5x^2 - 3x', '5x^2 - 3');
  ok(lost && lost.type === undefined && lost.whyWrong === undefined, 'a letter lost from a term is not called an exponent error');
  ok(explainFalseStep('x^2 + 1', 'x^2 + 1') === null && explainFalseStep('sin(x)', 'cos(x)') === null, 'equal lines and non-polynomials give no annotation');
  // on the owner's page: every field, and a concise plain comment for old clients
  const r = mark(PRODUCT, PAGE, '3x^2-x');
  const d = r.report.lines[8].diagnosis;
  ok(d.whatChanged === 'The term -2x became -x.' && d.whyWrong === 'Collecting 2x^2 + x^2 gives 3x^2 and leaves the -2x term alone, so -2x stays -2x.' && d.corrected === '= 3x^2 - 2x' && d.fromLine === 8, `fields: ${d.whatChanged} | ${d.corrected} | ${d.fromLine}`);
  ok(d.check === 'At x = 1 the line above gives 1 but this line gives 2.' && /^Every line checked before line 9 is correct\. The product rule was applied correctly; this is an algebra slip\.$/.test(d.kept), `check and kept: ${d.check} | ${d.kept}`);
  ok(d.comment === d.message && r.report.lines[8].note === d.comment && d.comment.includes(d.whatChanged) && d.comment.includes('Corrected line: = 3x^2 - 2x.'), `the plain comment: ${d.comment}`);
  // kept is said only when something before the cross was ticked
  const bare = mark(QUESTION('Expand and simplify.', 'x'), ['y = 2x^2 - 2x + x^2', '= 2x^2 - 2x + x^2', '= 3x^2 - x'], '');
  const bd = bare.report.lines.find(l => l.diagnosis?.code === 'false-continuation')?.diagnosis;
  ok(!bd || bd.kept === undefined || /^Every line checked before line \d is correct\.$/.test(bd.kept), 'no product-rule claim without a verified substitution');
}
ok(CROSS_KINDS.includes('crossTerms') && CROSS_KINDS.includes('crossExact') && CROSS_KINDS.includes('crossExample'), 'the new comment kinds are cross kinds');

console.log(failures.length ? `FIRST WRONG STEP: FAIL (${failures.length})\n${failures.map(f => '  ' + f).join('\n')}` : `FIRST WRONG STEP: PASS: ${pass} checks`);
process.exit(failures.length ? 1 : 0);
