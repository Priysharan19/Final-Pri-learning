// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the first-wrong-step cross after adversarial review (23 November 2026)
//
// True work is never crossed. Every case here went through stepEvidence, the real marking path:
//   1  complex numbers (i, j) and constants (e): the letter is not a real variable of the question
//   2  a prompt with more than one part or target; a part label or a blank line on the page
//   3  partial work: one piece of a sum, one bracket or factor, a restart from an earlier line
//   4  `u' = 3x and v' = 1` after `u = x^2` is not ticked; "everything before is correct" only over verified ticks; method praise only
//      when the question names the method and its substitution was verified
//   5  a term is named only when it is on the line it is said to be on
//   6  a fuzzer of true-but-unusual continuations: zero crosses
//
//   node server/test/first-wrong-step-review-check.mjs
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { stepEvidence } from '../platform/markerOps.js';
import { checkAnswer } from '../../client/src/engine/checker.js';
import { contextAllowsCross, isRealVariable, isPartialWork, explainFalseStep } from '../../client/src/engine/falseStep.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

const QUESTION = (prompt, expr) => ({ id: 'fwsr', answerType: 'expression', difficulty: 3, prompt, answer: { expr }, steps: [] });
const mark = (q, lines, answer = '') => {
  const res = checkAnswer(q, answer);
  const ev = stepEvidence(q, answer, lines.join('\n'), res, { slipWarnings: true });
  return { report: ev.stepReport, st: (ev.stepReport?.lines || []).map(l => l.status) };
};
const crossed = r => (r.report?.lines || []).flatMap((l, i) => (l.status === 'break' && l.diagnosis?.code === 'false-continuation' ? [i + 1] : []));
const never = (q, lines, what) => { const r = mark(q, lines); ok(crossed(r).length === 0, `${what}: no false-continuation cross (${r.st})`); return r; };

const PRODUCT = QUESTION('Use the product rule to differentiate $y = x^{2}(x - 1)$, giving your answer expanded and simplified.', '3x^2-2x');
const PAGE = ['Differentiate y = x^2(x-1) using the product rule.', 'Let u = x^2 and v = x - 1.', "Then u' = 2x and v' = 1.", 'By the product rule,', "dy/dx = u'v + uv'", '= 2x(x-1) + x^2(1)', '= 2x(x-1) + x^2', '= 2x^2 - 2x + x^2', '= 3x^2 - x'];
ok(crossed(mark(PRODUCT, PAGE, '3x^2-x')).join() === '9', 'the owner\'s page is still crossed at line 9');

// 1  complex numbers, e
never(QUESTION('Simplify $(1 + i)^2$.', '2i'), ['y = (1 + i)^2', '= 1 + 2i + i^2', '= 2i'], '(1+i)^2');
never(QUESTION('Simplify $(1 + i)^2$.', '2i'), ['(1+i)^2', '= 1 + 2i + i^2', '= 2i'], '(1+i)^2 without a label line');
never(QUESTION('Simplify $i^3$.', '-i'), ['i^3', '= i^2*i', '= -i'], 'i^3');
never(QUESTION('Expand and simplify $(2 + 3i)(1 - i)$.', '5+i'), ['(2 + 3i)(1 - i)', '= 2 - 2i + 3i - 3i^2', '= 5 + i'], '(2+3i)(1-i)');
never(QUESTION('Expand and simplify $(3 + 2i)^2$.', '5+12i'), ['(3 + 2i)^2', '= 9 + 12i + 4i^2', '= 5 + 12i'], '(3+2i)^2');
never(QUESTION('Simplify $(1 + j)^2$.', '2j'), ['(1 + j)^2', '= 1 + 2j + j^2', '= 2j'], 'j as the imaginary unit');
never(QUESTION('Simplify $e^2 \\times e^3$.', 'e^5'), ['e^2 e^3', '= e^5', '= e^6'], 'e as a constant');
ok(isRealVariable('Simplify $x$ + x', 'x') && !isRealVariable('Simplify $i$ + i', 'i') && !isRealVariable('Simplify $j$', 'j') && !isRealVariable('Simplify $e$', 'e') && !isRealVariable('Simplify $x$', 'y'), 'i, j and e are never real variables; a letter the prompt does not use is not one either');
ok(contextAllowsCross('Simplify the complex number $(1 + i)^2$.') === false, 'a complex prompt never opens a cross');

// 2  more than one part
const MULTI = QUESTION('(a) Expand $(x+1)^2$. (b) Simplify $2x + 3x$.', 'x^2+2x+1');
ok(contextAllowsCross(MULTI.prompt) === false, 'a two-part prompt never opens a cross');
never(MULTI, ['(x+1)^2', '= x^2 + 2x + 1', '= 5x'], 'the (b) answer under the (a) line');
never(QUESTION('Expand $(x+1)^2$. Then simplify $2x + 3x$.', 'x'), ['(x+1)^2', '= x^2 + 2x + 1', '= 5x'], 'two sentences of work');
never(PRODUCT, ['y = x^2(x - 1)', '= x^3 - x^2', '(b)', '= 2x + 3x', '= 6x'], 'a part label on the page');
never(QUESTION('Expand $(x + 1)^2$.', 'x'), ['(x+1)^2', '= x^2 + 2x + 1', '', '= 2x + 3x', '= 6x'], 'a blank gap before another piece of work');
ok(contextAllowsCross('Use the product rule to differentiate $y = x^{2}(x - 1)$, giving your answer expanded and simplified.') === true, 'a single-target prompt still opens it');

// 3  partial work
const EXP = QUESTION('Expand and simplify $(x+1)(x-2)$.', 'x^2-x-2');
never(EXP, ['(x+1)(x-2)', '= x(x-2) + 1(x-2)', '= x^2 - 2x'], 'one piece of a sum expanded');
never(EXP, ['2(x+1)(x-2)', '= 2(x^2 - x - 2)', '= (x+1)(x-2)'], 'one factor');
never(EXP, ['x^2 + 2x + 1 + 3x', '= x^2 + 5x + 1', '= x^2 + 2x + 1'], 'a restart from an earlier line');
ok(isPartialWork('x(x-2) + 1(x-2)', 'x^2 - 2x') && isPartialWork('2(x+1)(x-2)', '(x+1)(x-2)') && !isPartialWork('2x^2 - 2x + x^2', '3x^2 - x'), 'partial work is told from a real slip');

// 4  the false derivative statement, and what is said about the lines before a cross
{
  const bad = PAGE.map(l => (l.startsWith('Then') ? "Then u' = 3x and v' = 1." : l));
  const rb = mark(PRODUCT, bad, '3x^2-x');
  ok(rb.st[2] !== 'ok', `u' = 3x and v' = 1 is not ticked: ${rb.st[2]}`);
  const cross = rb.report.lines.find(l => l.diagnosis?.code === 'false-continuation');
  ok(!cross || !cross.diagnosis.kept, `no "everything before is correct" over a line that was not ticked (${cross?.diagnosis?.kept})`);
  const right = PAGE.map(l => (l.startsWith('Then') ? "Then u' = 2x and v' = 1." : l));
  const rk = mark(PRODUCT, right, '3x^2-x').report.lines[8].diagnosis;
  ok(/^Every line checked before line 9 is correct\. The product rule was applied correctly; this is an algebra slip\.$/.test(rk.kept), `kept on the verified page: ${rk.kept}`);
  const named = QUESTION('Differentiate $y = x^{2}(x - 1)$, giving your answer expanded and simplified.', '3x^2-2x');
  const rn = mark(named, PAGE, '3x^2-x').report.lines[8].diagnosis;
  ok(rn && !/product rule/.test(rn.kept || ''), `method praise only when the question names the method (${rn?.kept})`);
}

// 4b  a derived quantity of a defined symbol is never a premise: it ticks only when the engine verifies EVERY claim on the line
{
  const SIN = QUESTION('Differentiate $y = x^{2}\\sin x$ using the product rule.', '2x sin(x) + x^2 cos(x)');
  const line2 = (def, claim) => mark(SIN, [def, claim]).report.lines[1];
  const D = 'Let u = x^2 and v = sin x';
  ok(line2(D, "u' = 3x and v' = cos x").status === 'note', "u' = 3x and v' = cos x is a note (u' is wrong)");
  ok(line2(D, "u' = 2x and v' = -cos x").status === 'note', "v' = -cos x is a note");
  ok(line2(D, "u' = 3x").status === 'note' && line2('Let u = x^2', "Then u' = 3x").status === 'note', "u' = 3x alone is a note (and not a cross)");
  ok(mark(SIN, [D, "u' = 3x and v' = cos x"]).st.every(s => s !== 'break'), 'no cross from the false derivative line');
  ok(line2(D, "u' = 2x and v' = cos x").status === 'ok', "u' = 2x and v' = cos x ticks: both verified");
  ok(line2('Let u = x^2', "Then u' = 2x").status === 'ok', "u' = 2x ticks");
  ok(mark(PRODUCT, PAGE.map(l => (l.startsWith('Then') ? "Then u' = 3x and v' = 1." : l))).st[2] === 'note', 'the polynomial false case is a note');
  const good = mark(PRODUCT, PAGE, '3x^2-x');
  ok(good.st[2] === 'ok' && good.report.lines[8].status === 'break', "the owner's page is unchanged: line 3 ticked, line 9 crossed");
}

// 5  a term is named only when it is on the line it is said to be on
{
  const sg = mark(QUESTION('Simplify $x^2 - 2x + x - 2$.', 'x^2-x-2'), ['y = x^2 - 2x + x - 2', '= x^2 + x - 2']);
  const d = sg.report.lines.find(l => l.diagnosis?.code === 'false-continuation')?.diagnosis;
  ok(!d || (!/sign of the -x term/.test(d.whyWrong || '') && !/term -x became/.test(d.whatChanged || '')), `no term named that is not on the line above (${d?.whatChanged} | ${d?.whyWrong})`);
  const e1 = explainFalseStep('x^2 - 2x + x - 2', 'x^2 + x - 2');
  ok(e1 && !/sign of the/.test(e1.whyWrong || '') && /Collected, the x terms come to -x in the line above and x in this line/.test(e1.whatChanged) && /Adding -2x \+ x gives -x, not x/.test(e1.whyWrong), `x terms collected: ${e1?.whatChanged} | ${e1?.whyWrong}`);
  const e2 = explainFalseStep('3x + 3x + 4x', '-10x');
  ok(!/sign of the 10x term/.test(e2.whyWrong || '') && /Adding 3x \+ 3x \+ 4x gives 10x, not -10x/.test(e2.whyWrong), `3x+3x+4x: ${e2?.whyWrong}`);
  const e3 = explainFalseStep('2x^2 - 2x + x^2', '3x^2 + 2x');
  ok(e3.type === 'sign-error' && /sign of the -2x term/.test(e3.whyWrong), 'a sign error is still named when both terms are on their lines');
}

// 6  the fuzzer: true-but-unusual continuations, zero crosses
{
  let seed = 4242; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pickOf = a => a[ri(0, a.length - 1)];
  const sgn = c => (c < 0 ? '-' : '+');
  const lin = (c, d) => `${c === 1 ? '' : c}x ${sgn(d)} ${Math.abs(d)}`;
  const polyTxt = cs => { let o = ''; [[2, cs[2]], [1, cs[1]], [0, cs[0]]].forEach(([d, c]) => { if (!c) return; const m = Math.abs(c); const b = d === 0 ? `${m}` : `${m === 1 ? '' : m}${d === 1 ? 'x' : 'x^2'}`; o += o === '' ? `${c < 0 ? '-' : ''}${b}` : ` ${sgn(c)} ${b}`; }); return o || '0'; };
  let pages = 0, lines = 0, crosses = 0; const bad = [];
  for (let n = 0; n < (Number(process.env.FUZZ_N) || 150); n++) {
    const a = ri(1, 3), b = ri(-5, 5) || 2, c = ri(1, 3), d = ri(-5, 5) || 3;
    const prod = [b * d, a * d + b * c, a * c];
    const both = `(${lin(a, b)})(${lin(c, d)})`;
    const families = [
      [`y = ${both}`, `= ${a === 1 ? '' : a}x(${lin(c, d)}) ${sgn(b)} ${Math.abs(b)}(${lin(c, d)})`, `= ${polyTxt(prod)}`],                               // one bracket distributed first
      [`y = ${both}`, `= ${polyTxt([0, 0, a * c])} ${sgn(a * d)} ${Math.abs(a * d)}x ${sgn(b * c)} ${Math.abs(b * c)}x ${sgn(b * d)} ${Math.abs(b * d)}`, `= ${polyTxt(prod)}`],   // one term at a time
      [`y = ${polyTxt(prod)}`, `= ${polyTxt([0, prod[1], 0])} ${sgn(prod[2])} ${Math.abs(prod[2])}x^2 ${sgn(prod[0])} ${Math.abs(prod[0])}`.replace(/^= (?:\+ )?/, '= '), `= ${polyTxt(prod)}`],   // reordering
      [`y = ${both} + 3x`, `= ${polyTxt(prod)}`, `= ${polyTxt([prod[0], prod[1] + 3, prod[2]])}`],                                                          // a sub-expression worked first
      [`y = ${both}`, `= ${polyTxt(prod)}`, `= ${both}`],                                                                                                   // a restarted line
      [`y = ${both}`, `= ${polyTxt(prod)}`, `= ${ri(2, 9)}x + ${ri(2, 9)}x`],                                                                              // the answer to another part
      [`(${a} + ${Math.abs(b)}i)(${c} - i)`, `= ${a * c} - ${a}i + ${Math.abs(b) * c}i - ${Math.abs(b)}i^2`, `= ${a * c + Math.abs(b)} + ${Math.abs(b) * c - a}i`]   // complex
    ];
    for (const page of families) {
      const another = /^= \d+x \+ \d+x$/.test(page[2]);
      const q = another ? QUESTION(`(a) Expand $${both}$. (b) Simplify $2x + 3x$.`, 'x') : QUESTION(pickOf(['Expand and simplify the expression.', `Simplify $y = ${both}$.`, `Expand $${both}$ and simplify.`]), 'x');
      const r = mark(q, page);
      pages++; lines += page.length;
      if (crossed(r).length) { crosses++; if (bad.length < 3) bad.push(JSON.stringify(page)); }
    }
  }
  ok(crosses === 0, `fuzz: ${crosses} false crosses over ${pages} true pages (${lines} lines) ${bad.join(' ')}`);
  console.log(`fuzz: ${pages} true pages, ${lines} lines, ${crosses} crosses`);
}

console.log(failures.length ? `FIRST WRONG STEP REVIEW: FAIL (${failures.length})\n${failures.map(f => '  ' + f).join('\n')}` : `FIRST WRONG STEP REVIEW: PASS: ${pass} checks`);
process.exit(failures.length ? 1 : 0);
