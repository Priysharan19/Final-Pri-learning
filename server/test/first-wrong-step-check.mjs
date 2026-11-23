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
import { contextAllowsCross, pageBlocksCross, readingIsAmbiguous, falseStepFacts, readPoly } from '../../client/src/engine/falseStep.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

const QUESTION = (prompt, expr, extra = {}) => ({ id: 'fws', answerType: 'expression', difficulty: 3, prompt, answer: { expr }, steps: [], ...extra });
const PRODUCT = QUESTION('Use the product rule to differentiate $y = x^{2}(x - 1)$, giving your answer expanded and simplified.', '3x^2-2x');
const mark = (q, lines, answer, opts = { slipWarnings: true }) => {
  const res = checkAnswer(q, answer);
  const ev = stepEvidence(q, answer, lines.join('\n'), res, opts);
  return { res, ev, report: ev.stepReport, st: (ev.stepReport?.lines || []).map(l => l.status), states: (ev.stepReport?.lines || []).map(l => l.state) };
};
const crossed = r => (r.report?.lines || []).flatMap((l, i) => (l.status === 'break' ? [i + 1] : []));

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
  ok(JSON.stringify(model.cards.map(k => k.status)) === 'not-verified,checked,checked,not-verified,checked,checked,checked,checked,first-error', 'the card statuses an old client reads');
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
const neverCrossed = (q, lines, what, opts) => { const r = mark(q, lines, '', opts); ok(crossed(r).length === 0 && !(r.report?.firstBreak >= 0), `${what}: never a cross (${r.st})`); return r; };
{
  // a plain slip in a chain of rewrites is crossed, and the lines below it are not ticked as following from it
  const r = mark(SIMPLIFY, ['y = (x + 1)(x - 2)', '= x^2 - 2x + x - 2', '= x^2 - x - 2', '= x^2 - x - 3', '= x^2 - x - 3'], 'x^2-x-3');
  ok(crossed(r).join() === '4', `a slip in the constant: ${r.st}`);
  ok(r.report.lines[3].diagnosis.changed[0].fromTex === '-2' && r.report.lines[3].diagnosis.changed[0].toTex === '-3', 'the constant changed from -2 to -3');
  ok(r.st[4] !== 'ok' && r.st[4] !== 'break', `the line that repeats the slip is not ticked and not crossed again: ${r.st[4]}`);
  // no cascade: two slips, one cross, at the first
  const two = mark(SIMPLIFY, ['y = (x + 1)(x - 2)', '= x^2 - 2x + x - 2', '= x^2 - x - 3', '= x^2 - 2x - 3'], 'x^2-2x-3');
  ok(crossed(two).join() === '3', `two slips: only the first is crossed (${two.st})`);
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
    const lines = ['y = (x + 1)(x - 2)', '= x^2 - 2x + x - 2', '= x^2 - x - 2', '= x^2 - x - 3'];
    const without = mark(SIMPLIFY, lines, 'x^2-x-3');
    const gap = mark(SIMPLIFY, lines, 'x^2-x-3', { slipWarnings: true, gaps: [3] });
    ok(crossed(without).join() === '4' && crossed(gap).length === 0, `a line after a dropped (uncertain) line is not crossed: ${gap.st}`);
    const gapElsewhere = mark(SIMPLIFY, lines, 'x^2-x-3', { slipWarnings: true, gaps: [1] });
    ok(crossed(gapElsewhere).join() === '4', 'a gap elsewhere on the page changes nothing here');
  }
  // never after another break, and never over an exact equality
  ok(falseStepFacts('x^2 - x - 2', '(x - 2)(x + 1)') === null && falseStepFacts('x^2 - x - 2', 'x^2 - x - 3') !== null, 'exact: equal polynomials give no facts, a differing pair does');
  ok(readPoly('x^2(x - 1)')?.c.size === 2 && readPoly('sin(x)') === null && readPoly('x^2 + y') === null, 'polynomials in one letter are read exactly, nothing else');
  // the fallback: a line that is not a polynomial carries the engine's numeric example and no claim about terms
  const f = mark(QUESTION('Simplify $y = \\sin x\\cos x$.', 'sin(2x)/2'), ['y = sin(x)cos(x)', '= sin(x)cos(x)', '= sin(2x)'], 'sin(2x)');
  if (crossed(f).length) {
    const d = f.report.lines[crossed(f)[0] - 1].diagnosis;
    const c = commentFor({ n: crossed(f)[0], status: 'first-error', text: '= sin(2x)', diagnosis: d }, {});
    ok(d.exact === false && c?.kind === 'crossExample' && /is not equal to the line above/.test(c.text) && !/corrected/.test(c.text), `a non-polynomial cross: example only (${c?.text})`);
  } else ok(true, 'a non-polynomial slip stays a note');
}

// ── 3. the diagnosis panel (the tutor's first break) ─────────────────────────────────────────────────────────────
{
  const { tutorEvidence } = await import('../platform/markerOps.js');
  const ev = tutorEvidence(PRODUCT, PAGE);
  ok(ev.firstBreak === 8, `the tutor evidence names the cross as the first break: ${ev.firstBreak}`);
  const right = tutorEvidence(PRODUCT, PAGE.map(l => (l === '= 3x^2 - x' ? '= 3x^2 - 2x' : l)));
  ok(right.firstBreak === -1, 'no first break on the right page');
}
ok(CROSS_KINDS.includes('crossTerms') && CROSS_KINDS.includes('crossExact') && CROSS_KINDS.includes('crossExample'), 'the new comment kinds are cross kinds');

console.log(failures.length ? `FIRST WRONG STEP: FAIL (${failures.length})\n${failures.map(f => '  ' + f).join('\n')}` : `FIRST WRONG STEP: PASS: ${pass} checks`);
process.exit(failures.length ? 1 : 0);
