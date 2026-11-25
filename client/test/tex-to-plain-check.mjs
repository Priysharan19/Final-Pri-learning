// Pri Learning · the reader's TeX as engine text (engine/texToPlain.js) and its use in line marking (engine/arithmeticLines.js).
//
// Part 1  The converter: what it reads, and that anything it does not fully understand is null.
// Part 2  The rule in the checker: a TeX reading may tick or leave a note, never cross.
// Part 3  The server path (markerOps.stepEvidence), and that the reader is still handed no answer.
import { texToPlain, texToPlainWhy, EXTENDED_TEX } from '../src/engine/texToPlain.js';
import { stepCheckArithmetic } from '../src/engine/arithmeticLines.js';
import { stepEvidence } from '../../server/platform/markerOps.js';
import { parse, normalize } from '../src/engine/expr.js';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };

// ── Part 1 ───────────────────────────────────────────────────────────────────
const CASES = [
  ['\\frac{a}{b}', '((a)/(b))'], ['\\frac{1}{2}', '(1/2)'], ['\\frac{x+1}{x-1}', '((x+1)/(x-1))'], ['\\frac{x^{2}}{2}+1', '((x^(2))/2)+1'],
  ['\\frac{1}{2}x', '(1/2)*x'], ['\\frac{a}{b} c', '((a)/(b))*c'], ['\\dfrac{3}{4}', '(3/4)'],
  ['\\sqrt{x}', 'sqrt(x)'], ['\\sqrt{x+1}', 'sqrt(x+1)'], ['\\sqrt[3]{x}', 'cbrt(x)'], ['3\\sqrt{2}', '3*sqrt(2)'], ['\\sqrt{\\frac{1}{4}}', 'sqrt((1/4))'],
  ['x^{2}', 'x^(2)'], ['x^2', 'x^2'], ['e^{x}', 'e^(x)'], ['e^{x}(2x-4)', 'e^(x)*(2x-4)'], ['x^{2}y', 'x^(2)*y'], ['(x+1)^{2}', '(x+1)^(2)'], ['x^{-1}', 'x^(-1)'], ['e^{2x}+1', 'e^(2x)+1'],
  ['2\\cdot 3', '2*3'], ['2\\times 3', '2*3'], ['6\\div 2', '6/2'], ['\\left(x+1\\right)(x-1)', '(x+1)(x-1)'], ['\\left[x+1\\right]^{2}', '[x+1]^(2)'],
  ['\\sin x', 'sin(x)'], ['\\cos\\theta', 'cos(θ)'], ['\\tan 2x', 'tan(2x)'], ['\\ln x', 'ln(x)'], ['\\ln(x+1)', 'ln(x+1)'], ['\\log(2)', 'log(2)'], ['\\sin\\left(2x\\right)', 'sin(2x)'],
  ['\\pi', 'π'], ['2\\pi r', '2π r'], ['\\pi r^{2}', 'π r^(2)'], ['\\theta', 'θ'], ['\\sin\\theta=\\frac{1}{2}', 'sin(θ)=(1/2)'],
  ['\\int_{0}^{2} 3x^{2}\\,dx', '∫_{0}^{2}3x^(2)dx'], ['\\int_{-2}^{4} 12x\\,dx', '∫_{-2}^{4}12x dx'], ['\\left[ 6x^{2} \\right]_{-2}^{4}', '[6x^(2)]_{-2}^{4}'],
  ['x \\le 3', 'x<=3'], ['x \\geq 3', 'x>=3'], ['x \\ne 3', 'x!=3'], ['a \\leq b', 'a<=b'], ['5!', '5!'],
  ['12 \\div \\frac{3}{4}', '12/(3/4)'], ['6 \\div \\frac{1}{2}', '6/(1/2)'], ['\\frac{3}{2}^2', '(3/2)^2'], ['\\frac{3}{2}^{2}', '(3/2)^(2)'], ['-\\frac{1}{2}^2', '-(1/2)^2'],
  ['x^{\\frac{1}{2}}', 'x^((1/2))'], ['\\frac{1}{2x}', '(1/(2x))'], ['\\frac{1}{2}x', '(1/2)*x'], ['\\frac{1}{\\frac{1}{2}}', '(1/((1/2)))'], ['x\\frac{1}{2}', 'x*(1/2)'],
  ['2x+3=7', '2x+3=7'], ['\\frac{12x^{2}}{2}=6x^{2}', '((12x^(2))/2)=6x^(2)']
];
for (const [tex, want] of CASES) ok(texToPlain(tex) === want, `${tex} -> ${want} (got ${JSON.stringify(texToPlain(tex))})`);
const NULLS = ['x^\\frac{1}{2}', '3\\frac{1}{2}', '\\frac{1}{2}3\\frac{1}{2}', '\\foo', '\\href{a}{b}', '{x}', 'x_{1}', 'x_1', '\\sin^{2}x', '\\sin xy', '\\sqrt[4]{x}', '\\sqrt[n]{x}', '2\\frac{1}{2}', '\\frac{1}{}', '\\frac{1}', '\\int_{0}^{2} 3x', '\\int 3x\\,dx',
  '\\pm 3', '\\alpha', '\\sum_{i=1}^{3} i', '\\lim x', '\\infty', '\\left|x\\right|', '\\left.x', '\\text{ cm}', '2 3', '^{2}', 'x^{', '\\sin', '', '   ', 'x \\approx', null, undefined, 12, '\\frac{\\foo}{2}', 'a|b', 'x\\\\y'];
for (const tex of NULLS) ok(texToPlain(tex) === null || (typeof tex === 'string' && tex.trim() && texToPlain(tex) !== null && false), `not understood -> null: ${JSON.stringify(tex)} (got ${JSON.stringify(texToPlain(tex))})`);
ok(texToPlain('x'.repeat(601)) === null, 'a too long TeX is not read');
// What it returns is something the engine's parser reads.
for (const tex of ['e^{x}(2x-4)', '\\frac{x+1}{x-1}', '\\sqrt[3]{x}', '\\sin\\theta=\\frac{1}{2}'.split('=')[0], '\\left(x+1\\right)^{2}', '\\pi r^{2}']) {
  let readable = true; try { parse(normalize(texToPlain(tex))); } catch { readable = false; }
  ok(readable, `the engine parses ${texToPlain(tex)}`);
}

// ── Part 1b · the EXTENDED reading (texToPlain(tex, EXTENDED_TEX)) ────────────────────────────────────────────────────────
// The base reading above is unchanged, byte for byte: every caller that does not ask for more gets it. The extended reading is asked for by a student's
// reader TeX on an Australian question, and by the author's bank. tex-faithful-check.mjs proves each of these by VALUE against an independent evaluator.
const EXT_CASES = [
  // the constructs of the author's bank (read in November 2026; each proved by value in tex-faithful-check.mjs)
  ['\\sin^{2}x', 'sin(x)^(2)'], ['\\sin^2\\theta+\\cos^2\\theta=1', 'sin(θ)^(2)+cos(θ)^(2)=1'], ['\\sin^{-1}\\tfrac12', 'arcsin((1/2))'], ['\\tan^{-1}\\dfrac{30}{40}', 'arctan((30/40))'],
  ['\\log_2 8', '(log(8)/log(2))'], ['\\log_{2}(x+1)', '(log((x+1))/log(2))'], ['\\log_a b', '(log(b)/log(a))'], ['\\log_2\\sqrt8=\\tfrac32', '(log(sqrt(8))/log(2))=(3/2)'],
  ['\\binom52=10', '(5C2)=10'], ['\\binom{n}{2}', 'ncr(n;2)'], ['{}^{7}P_{2}', '(7P2)'], ['^5C_2', '(5C2)'], ['2\\binom{4}{2}', '2*(4C2)'],
  ['90^\\circ', '90°'], ['36.9^{\\circ}', '36.9°'], ['\\sin 120^\\circ', 'sin(120°)'], ['\\sin(30^\\circ)=\\tfrac12', 'sin(30°)=(1/2)'], ['\\sin x\\cos x', 'sin(x)*cos(x)'],
  ['\\alpha+\\beta', 'alpha+beta'], ['2\\alpha\\beta', '2alpha*beta'], ['\\cos\\alpha', 'cos(alpha)'], ['\\sqrt[4]{x}', '(x)^(1/4)'], ['\\sqrt[5]{32}', '(32)^(1/5)'], ['\\left|x-3\\right|', 'abs(x-3)'],
  ["y'", "y'"], ["f'(x)", "f'(x)"], ["f''(x)", "f''(x)"], ['\\dot A=2\\pi r\\dot r', '(dotA)=2π r*(dotr)'], ['\\dot y^{2}', '(doty)^(2)'], ['16\\%', '16%'],
  ['\\int_0^{\\pi}\\sin x\\,dx=2', '∫_{0}^{π}sin(x)dx=2'], ['\\int e^{-x}dx', '∫e^(-x)dx'], ['\\int x\\,dx', '∫x dx'], ['x=\\pm4', 'x=4, x=-4'], ['x=\\dfrac{1\\pm\\sqrt5}{2}', 'x=((1+sqrt(5))/2), x=((1-sqrt(5))/2)'],
  ['2x+3=7', '2x+3=7'], ['\\frac{a}{b}', '((a)/(b))'], ['e^{x}(2x-4)', 'e^(x)*(2x-4)'], ['\\sin x', 'sin(x)'], ['2\\pi r', '2π r'], ['\\int_{0}^{2} 3x^{2}\\,dx', '∫_{0}^{2}3x^(2)dx'], ['\\left[ 6x^{2} \\right]_{-2}^{4}', '[6x^(2)]_{-2}^{4}']
];
for (const [tex, want] of EXT_CASES) ok(texToPlain(tex, EXTENDED_TEX) === want, `extended: ${tex} -> ${want} (got ${JSON.stringify(texToPlain(tex, EXTENDED_TEX))})`);
// what the base reading refuses, the extended reading reads, and what the base reading reads the extended reading reads the same
for (const [tex] of EXT_CASES.slice(0, 40)) ok(texToPlain(tex) === null || texToPlain(tex) === texToPlain(tex, EXTENDED_TEX), `extended agrees with base where base reads: ${tex}`);
for (const [tex] of CASES) ok(texToPlain(tex, EXTENDED_TEX) === texToPlain(tex) || tex === '\\sqrt[3]{x}', `extended reads every base case the same: ${tex} (${texToPlain(tex)} vs ${texToPlain(tex, EXTENDED_TEX)})`);
const EXT_NULLS = ['x^\\frac{1}{2}', '3\\frac{1}{2}', '\\foo', '\\href{a}{b}', '{x}', 'x_{1}', 'x_1', '\\sin xy', '\\sqrt[n]{x}', '2\\frac{1}{2}', '\\frac{1}{}', '\\int_{0}^{2} 3x', '\\pm 3', '\\sum_{i=1}^{3} i', '\\lim x', '\\infty', '\\left.x', '\\text{ cm}', '2 3', '^{2}', 'x^{', '\\sin', '', '   ', 'a|b', 'x\\\\y',
'\\phi', '\\lambda', '\\sin^{3.5}x', '\\ln^{-1}x', '\\log_{1}x', '\\log_{x+1}2', 'x^\\circ', '(x+1)^\\circ', '\\sin 2 3', '\\sin x y', "x'''", '\\dot x=3t', '\\dot x t=x\\dot t', '\\int x', '\\int_0^1 x=3', '\\sqrt[13]{x}', '\\left|x'];
for (const tex of EXT_NULLS) ok(texToPlain(tex, EXTENDED_TEX) === null, `extended: not understood -> null: ${JSON.stringify(tex)} (got ${JSON.stringify(texToPlain(tex, EXTENDED_TEX))})`);
ok(texToPlainWhy('\\binom52').why === '\\binom' && texToPlainWhy('\\binom52', EXTENDED_TEX).plain === '(5C2)', 'the base reading still refuses \\binom (and says which command), the extended reads it');

// ── Part 2 · the rule in the checker ────────────────────────────────────────
const statuses = r => r.lines.map(l => l.status).join();
const L = (text, latex) => ({ text, latex });
// flattened text the checker cannot read; the TeX is right and true: ticked, and the line stays the student's text
{
  const line = 'ex(2x-4) = e^x(2x-4)';
  const base = stepCheckArithmetic(line);
  ok(statuses(base) === 'note', 'without the TeX the flattened line is left unread');
  const r = stepCheckArithmetic(line, { latex: [L(line, 'e^{x}(2x-4) = e^{x}(2x-4)')] });
  ok(statuses(r) === 'ok' && r.lines[0].text === line && r.lines[0].state === 'arithmetic' && r.firstBreak === -1, 'a note whose TeX reading is true is ticked, with the student\'s own text');
  ok(r.summary.checked === 1 && r.summary.unverified.length === 0, 'the summary follows the tick');
}
// a stacked fraction flattened to "a/b c": a note without TeX, ticked with it
{
  const line = '1/2 + 1/3 5/6';
  ok(statuses(stepCheckArithmetic('2x^2x = 2x^3')) === 'note', 'an ambiguous flattened line is a note');
  const r = stepCheckArithmetic('2x^2x = 2x^3', { latex: [L('2x^2x = 2x^3', '2x^{2}\\cdot x = 2x^{3}')] });
  ok(statuses(r) === 'ok', 'the TeX reading of a flattened power line is ticked when it is true');
  void line;
}
// the plain text gives a cross but the TeX reading is true: the cross becomes the misread note, never a tick
{
  const line = '1/2 + 1/3 = 2/5';
  ok(statuses(stepCheckArithmetic(line)) === 'break', 'the plain text is crossed today');
  const r = stepCheckArithmetic(line, { latex: [L(line, '\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{6}')] });
  ok(statuses(r) === 'note' && /may have been misread/.test(r.lines[0].note) && r.firstBreak === -1 && r.diagnosis === null && r.summary.wrong.length === 0, 'a cross that the TeX reading clears is the "may have been misread" note');
  ok(r.lines[0].status !== 'ok', 'it is never a tick');
}
// a cross that the TeX does not clear stays a cross; later lines never become ticks under it
{
  const lines = ['1/2 + 1/3 = 2/5', '= 5/6'];
  const r = stepCheckArithmetic(lines.join('\n'), { latex: [L('1/2 + 1/3 = 2/5', '\\frac{1}{2}+\\frac{1}{3}=\\frac{2}{5}'), L('= 5/6', '= \\frac{5}{6}')] });
  ok(statuses(r) === 'break,note', `a cross the TeX agrees with stays (${statuses(r)})`);
}
// TeX can never turn a tick or a note into a cross
{
  const line = '1/2 + 1/3 = 5/6';
  const r = stepCheckArithmetic(line, { latex: [L(line, '\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{7}')] });
  ok(statuses(r) === 'ok' && r.firstBreak === -1, 'a true line is not crossed by a TeX that makes it false');
  const note = 'ex(2x-4) = e^x(2x-4)';
  const n = stepCheckArithmetic(note, { latex: [L(note, 'e^{x}(2x-4) = e^{x}(2x-5)')] });
  ok(statuses(n) === 'note' && n.firstBreak === -1, 'a note is not crossed by a TeX that makes it false');
  const n2 = stepCheckArithmetic('x/2 3 = 3x/2', { latex: [L('x/2 3 = 3x/2', '\\frac{x}{2}\\cdot 3 = \\frac{3x}{3}')] });
  ok(!n2.lines.some(l => l.status === 'break'), 'no TeX reading produces a break line');
}
// nothing that fails validation or conversion is used; mismatched text is not matched
{
  const line = 'ex(2x-4) = e^x(2x-4)';
  ok(statuses(stepCheckArithmetic(line, { latex: [L(line, '\\href{x}{e^{x}(2x-4) = e^{x}(2x-4)}')] })) === 'note', 'hostile TeX is not used');
  ok(statuses(stepCheckArithmetic(line, { latex: [L(line, '\\foo e^{x}(2x-4) = e^{x}(2x-4)')] })) === 'note', 'TeX the converter does not understand is not used');
  ok(statuses(stepCheckArithmetic(line, { latex: [L('another line', 'e^{x}(2x-4) = e^{x}(2x-4)')] })) === 'note', 'TeX of a different line is not used');
  ok(statuses(stepCheckArithmetic(line, { latex: [L(line, 'e^{x}(2x-4) = e^{x}(2x-4)'), L(line, 'e^{x}(2x-4) = e^{x}(2x-5)')] })) === 'note', 'two readings of the same text: neither is trusted');
  ok(JSON.stringify(stepCheckArithmetic(line, { latex: [] })) === JSON.stringify(stepCheckArithmetic(line)) && JSON.stringify(stepCheckArithmetic(line, null)) === JSON.stringify(stepCheckArithmetic(line)), 'no TeX: the report is exactly what it was');
}
// a page: a TeX tick in the middle does not disturb its neighbours
{
  const page = ['3 + 4 = 7', 'ex(2x-4) = e^x(2x-4)', '5 + 5 = 10'];
  const r = stepCheckArithmetic(page.join('\n'), { latex: [L(page[1], 'e^{x}(2x-4) = e^{x}(2x-4)')] });
  ok(statuses(r) === 'ok,ok,ok' && r.lines.map(l => l.text).join('|') === page.join('|'), 'a page: the middle line ticked, the others as they were');
}

// The reviewer's wrong lines under a stacked fraction are never ticked; the true counterparts are.
{
  const tick = (text, latex) => statuses(stepCheckArithmetic(text, { latex: [L(text, latex)] }));
  for (const [text, latex] of [['3 2 2 = 3 4', '\\frac{3}{2}^2 = \\frac{3}{4}'], ['12 ÷ 3 4 = 1', '12 \\div \\frac{3}{4} = 1'], ['6 ÷ 1 2 = 3', '6 \\div \\frac{1}{2} = 3']]) {
    ok(tick(text, latex) !== 'ok', `a false fraction line is not ticked: ${latex} (${tick(text, latex)})`);
  }
  for (const [text, latex] of [['3 2 2 = 9 4', '\\frac{3}{2}^2 = \\frac{9}{4}'], ['12 ÷ 3 4 = 16', '12 \\div \\frac{3}{4} = 16'], ['6 ÷ 1 2 = 12', '6 \\div \\frac{1}{2} = 12']]) {
    ok(tick(text, latex) === 'ok', `a true fraction line is ticked: ${latex} (${tick(text, latex)})`);
  }
  // the TeX and the text must be the same line before a note is ticked
  ok(tick('x = 2 so 2+2=5', '2+2=4') === 'note', 'words in the text that the TeX lacks: no tick');
  ok(tick('hello = 4', '2+2=4') === 'note', 'a different line: no tick');
  ok(tick('2+2=5', '2+2=4') === 'note', 'a cross is softened to the misread note, not ticked and not kept as a cross');
  // the same tokens in another ORDER are another line
  ok(tick('3 2 = 8', '2^3 = 8') === 'note', 'reordered digits (3 2 vs 2^3): no tick');
  ok(tick('1 3 = 2', '3 - 1 = 2') === 'note', 'reordered digits (1 3 vs 3-1): no tick');
  ok(tick('1 2 = 0.5', '\\frac{1}{2} = 0.5') === 'ok', '1 2 = 0.5 with the fraction: ticked');
  ok(tick('2 2 = 4', '2^2 = 4') === 'ok', '2 2 = 4 with 2^2: ticked');
  ok(tick('2 3 = 6', '2\\cdot 3 = 6') === 'ok', '2 3 = 6 with 2 times 3: ticked');
  ok(tick('8 3 = 2', '\\sqrt[3]{8} = 2') === 'note', '8 3 = 2 with the cube root of 8: no tick');
  ok(tick('2 1 = 0.5', '\\frac{1}{2} = 0.5') !== 'ok', '21 is not the fraction 1 over 2');
  // operators are compared too: the TeX may add structure only where the text has bare adjacency
  ok(tick('2 + 3 = 8 (1)', '2^3 = 8 (1)') === 'note', 'a different operator and a trailing equation number: note');
  ok(tick('2 + 3 = 8', '2^3 = 8') !== 'ok', '2 + 3 = 8 with 2^3: not ticked');
  ok(tick('2 - 3 = 8', '2^3 = 8') !== 'ok', '2 - 3 = 8 with 2^3: not ticked');
  ok(tick('2 3 = 8', '2^3 = 8') === 'ok', '2 3 = 8 with 2^3: ticked');
  ok(tick('2 5 = 10', '2\\cdot 5 = 10') === 'ok', '2 5 = 10 with 2 times 5: ticked');
  ok(tick('1 2 + 1 3 = 5 6', '\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{6}') === 'ok', 'stacked fractions flattened: ticked');
  ok(tick('2 3 = 8 (1)', '2^3 = 8 (1)') === 'note' && tick('so 2 3 = 8', '2^3 = 8') === 'note' && tick('2 3 = 8, 3', '2^3 = 8') === 'note', 'a label, a trailing number, words or a comma are never upgraded');
  // flattening loses ^ / and the dot, never + - or =
  for (const [text, latex] of [['2 3 = 5', '2 + 3 = 5'], ['3 2 = 1', '3 - 2 = 1'], ['2 5 = 3', '-2 + 5 = 3'], ['(2 3) 4 = 20', '(2 + 3) \\cdot 4 = 20'], ['2 3 4 = 14', '2 + 3 \\cdot 4 = 14'], ['2 3 4 = 14', '2 \\cdot (3 + 4) = 14'], ['2 3 8', '2 = 3 = 8']]) ok(tick(text, latex) === 'note', `the TeX may not add a sign: ${text} / ${latex} (${tick(text, latex)})`);
  ok(tick('2+2=4 so', '2+2=4') === 'note' && tick('2+2=4', '2+2=4') === 'ok', 'the same content is ticked only when the plain check already could');
}

// ── Part 2b · the extended reading in the checker (opts.extendedTex, set for an Australian question only) ───────────────────
// A reading of the reader's TeX may tick or leave a note, never cross. With the extended reading: no line is ever crossed BY the TeX, a false TeX never ticks a
// line the text did not already tick, the statuses are never worse than the base reading's, and without the option the report is exactly what it was.
{
  const PAIRS = [
    ['sin 30° = 1/2', '\\sin 30^\\circ = \\frac{1}{2}', '\\sin 30^\\circ = \\frac{1}{3}'],
    ['sin2x + cos2x = 1', '\\sin^{2}x+\\cos^{2}x=1', '\\sin^{2}x+\\cos^{2}x=2'],
    ['5C2 = 10', '\\binom{5}{2}=10', '\\binom{5}{2}=11'], ['5 2 = 10', '\\binom52=10', '\\binom52=12'],
    ['log2 8 = 3', '\\log_2 8=3', '\\log_2 8=4'], ['2 3 = 8', '2^{3}=8', '2^{3}=9'], ['x = 4 or -4', 'x=\\pm4', 'x=\\pm5'],
    ['∫(0 to 2) 3x^2 dx = 8', '\\int_{0}^{2}3x^{2}\\,dx=8', '\\int_{0}^{2}3x^{2}\\,dx=9'], ['180° = π', '180^\\circ = \\pi', '180^\\circ = 2\\pi'],
    ['tan^-1 1 = π/4', '\\tan^{-1}1=\\frac{\\pi}{4}', '\\tan^{-1}1=\\frac{\\pi}{3}'], ["y' = 2x", "y'=2x", "y'=3x"],
    ['1 2 + 1 3 = 5 6', '\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{6}', '\\frac{1}{2}+\\frac{1}{3}=\\frac{2}{5}'], ['4! = 24', '4!=24', '4!=25'], ['16% of 50 = 8', '16\\%\\cdot50=8', '16\\%\\cdot50=9'],
    ['alpha beta = 3', '\\alpha\\beta=3', '\\alpha\\beta=4'], ['dotx = 2', '\\dot x=2', '\\dot x=3'], ['3 + 4 = 8', '3+4=7', '3+4=9'], ['2 3 = 8 so', '2^{3}=8', '2^{3}=9']
  ];
  const stat = (text, latex, extended) => stepCheckArithmetic(text, { latex: [{ text, latex }], ...(extended ? { extendedTex: true } : {}) }).lines.map(l => l.status);
  for (const [text, good, bad] of PAIRS) {
    const plain = stepCheckArithmetic(text).lines.map(l => l.status);
    for (const latex of [good, bad]) {
      const base = stat(text, latex, false), ext = stat(text, latex, true);
      const rank = { ok: 2, note: 1, break: 0 };
      ok(ext.every((st, i) => rank[st] >= rank[base[i]] || (plain[i] === 'break' && st === 'note')), `extended is never worse than base: ${text} / ${latex} (${base} -> ${ext})`);
      ok(ext.every((st, i) => st !== 'break' || plain[i] === 'break'), `the TeX never crosses a line the text did not cross: ${text} / ${latex} (${ext})`);
    }
    ok(stat(text, bad, true).every((st, i) => st !== 'ok' || plain[i] === 'ok'), `a false TeX ticks nothing the text did not tick: ${text} / ${bad} (${stat(text, bad, true)})`);
  }
  // no option: the report is exactly what it was
  for (const [text, good] of PAIRS) ok(JSON.stringify(stepCheckArithmetic(text, { latex: [{ text, latex: good }] })) === JSON.stringify(stepCheckArithmetic(text, { latex: [{ text, latex: good }], extendedTex: false })), `without extendedTex the report is unchanged: ${text}`);
}

// ── Part 3 · the server path ────────────────────────────────────────────────
{
  const q = { id: 'q', form: 'x', answerType: 'number', answer: { value: 7 }, prompt: 'Find $x$.' };   // no Step Check: the arithmetic check runs
  const line = 'ex(2x-4) = e^x(2x-4)';
  const flat = stepEvidence(q, '7', line, { correct: false });
  const withTex = stepEvidence(q, '7', line, { correct: false }, { latex: [L(line, 'e^{x}(2x-4) = e^{x}(2x-4)')] });
  ok(!flat.stepReport || !flat.stepReport.lines.some(l => l.status === 'ok'), 'stepEvidence: flattened plain text is not ticked');
  ok(withTex.stepReport?.lines?.[0]?.status === 'ok' && withTex.stepReport.lines[0].text === line, 'stepEvidence: the right TeX ticks it, text kept');
  const cross = stepEvidence(q, '7', '3 + 4 = 7\n1/2 + 1/3 = 2/5', { correct: false }, { latex: [L('1/2 + 1/3 = 2/5', '\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{6}')] });
  ok(cross.stepReport?.lines?.[1]?.status === 'note' && /misread/.test(cross.stepReport.lines[1].note) && !cross.stepReport.lines.some(l => l.status === 'break'), 'stepEvidence: a cross the TeX clears becomes a note');
  const stays = stepEvidence(q, '7', '3 + 4 = 7', { correct: true }, { latex: [L('3 + 4 = 7', '3+4=8')] });
  ok(stays.stepReport?.lines?.[0]?.status === 'ok', 'stepEvidence: a true line stays true');
  ok(JSON.stringify(stepEvidence(q, '7', line, { correct: false }, null)) === JSON.stringify(flat), 'stepEvidence: no TeX, same reply');
}
// The extended reading reaches the checker for an Australian question only (India's reading is exactly what it was).
{
  const ops = readFileSync(new URL('../../server/platform/markerOps.js', import.meta.url), 'utf8');
  ok(/\.\.\.\(candidateRoots\(q\) \? \{ extendedTex: true \} : \{\}\)/.test(ops), 'markerOps passes extendedTex only for a question sealed for the Australian edition (candidateRoots)');
  const solution = readFileSync(new URL('../src/engine/solutionMatch.js', import.meta.url), 'utf8');
  ok(/if \(!bankReading\) return spanToPlainBraced\(span, false\);/.test(solution), 'solutionMatch reads a generated question exactly as it did; the bank has its own scope');
}
// 0^0 is never read (no tick can come from it); 10^0 and 0^1 are ordinary.
ok(texToPlain('0^0 = 1') === null && texToPlain('0^{0} = 1') === null && texToPlain('2 + 0^{0} = 3') === null, '0^0 converts to null');
ok(texToPlain('10^0 = 1') !== null && texToPlain('0^{1} = 0') !== null && texToPlain('2^{0} = 1') !== null, '10^0, 0^1 and 2^0 still convert');
// The reader is answer-blind: the prompt it is given names no answer, solution, mark or expected working.
{
  const src = readFileSync(new URL('../../server/platform/handwritingProvider.js', import.meta.url), 'utf8');
  const prompt = src.slice(src.indexOf('Write `latex` as a faithful display-only transcription'), src.indexOf('Write `latex` as a faithful display-only transcription') + 200);
  ok(/display-only/.test(prompt) && !/answer|solution|expected|mark/i.test(prompt.split('\n')[0]), 'the reader is still only asked for a display-only latex of what is on the page');
  const practice = readFileSync(new URL('../../server/platform/practice.js', import.meta.url), 'utf8');
  ok(/workingLatex = readLines\.filter/.test(practice) && !/transcribe\([^)]*workingLatex/.test(practice), 'the TeX flows from the reader to the marker only, never back to the reader');
}

console.log(`TEX TO PLAIN: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — TeX read only to tick or note, never to cross; unknown TeX is null`);
if (fail) process.exit(1);
