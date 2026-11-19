// Pri Learning · the every-reading rule for bare and "= …" lines in calculus questions (CTO ruling on the owner's rule
// "a true line is never crossed"). A bare or continuation line has more than one plausible reading: (a) it equals a line
// above, (b) it is the requested derivative or integral. It is CROSSED only when the engine proves it false under every
// reading, and a true line under either reading is never crossed.
import { stepCheck, methodMarks, checkAnswer } from '../src/engine/checker.js';

let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };
const status = (meta, prompt, lines) => stepCheck(meta, lines.join('\n'), { prompt }).lines.map(l => l.status);

const D = { prompt: 'Differentiate $y = (3x + 5)^{5}$.', meta: { kind: 'expression', canonical: '15(3x + 5)^4' } };
const I = { prompt: 'Find $\\displaystyle\\int 14e^{2x}\\,dx$. (You may omit the $+C$.)', meta: { kind: 'expression', canonical: '7*e^(2*x)' } };
const P = { prompt: 'Find $\\displaystyle\\int 16(2x + 3)^{3}\\,dx$. (You may omit the $+C$.)', meta: { kind: 'expression', canonical: '2(2x + 3)^4' } };

// ── Wrong continuations are the first error ─────────────────────────────────
ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', '= 5(3x + 5)^4'])[1] === 'break', 'derivative: a wrong "= …" (missing the inner factor) is crossed');
ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', '= 243x^5 + 2025x^4'])[1] === 'break', 'derivative: a wrong expansion is crossed (it is neither the derivative nor the function)');
ok(status(I.meta, I.prompt, ['∫14e^(2x)dx', '= 7e^(2x) * 2'])[1] === 'break', 'integral: a wrong "= …" continuation (not divided by the inner factor) is crossed');
ok(status(I.meta, I.prompt, ['∫14e^(2x)dx', '= 14e^(2x)'])[1] === 'break', 'integral: "= the integrand" after the integral is crossed');
ok(status(I.meta, I.prompt, ['∫14e^(2x)dx = 14e^(2x)'])[0] !== 'ok', 'integral: "∫f dx = f" is never ticked');
ok(status(I.meta, I.prompt, ['∫14e^(2x)dx = 7e^(2x) * 2'])[0] === 'break', 'integral: "∫f dx = F" with F′ ≠ f is crossed');
const first = stepCheck(D.meta, ['y = (3x + 5)^5', '= 5(3x + 5)^4', '= 15(3x + 5)^4'].join('\n'), { prompt: D.prompt });
ok(first.firstBreak === 1, 'a wrong continuation is the first error, and a later true line does not move it');

// ── True lines under either reading are never crossed ───────────────────────
const expanded = '243x^5 + 2025x^4 + 6750x^3 + 11250x^2 + 9375x + 3125';
ok(!status(D.meta, D.prompt, ['y = (3x + 5)^5', `= ${expanded}`]).includes('break'), 'derivative: a true expansion of the function (reading a) is not crossed');
ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', '= 15(3x + 5)^4'])[1] === 'ok', 'derivative: the derivative itself is ticked');
ok(!status(P.meta, P.prompt, ['(2x + 3)^3 → ((2x + 3)^4)/4', '((2x + 3)^4)/(2(4))']).includes('break'), 'integral: a true partial (a factor pulled out) is not crossed');
ok(!status(P.meta, P.prompt, ['16(2x+3)^3', '= 16(2x+3)^3']).includes('break'), 'integral: the integrand restated is not crossed');
ok(!status(P.meta, P.prompt, ['f(x) = (2x + 3)^3', "f'(x) = 6(2x + 3)^2"]).includes('break'), 'integral: a side function and its derivative are definitions, never crossed');
ok(!status(P.meta, P.prompt, ['∫(2x + 3)^3 dx = ((2x + 3)^4)/8']).includes('break'), 'integral: a TRUE side statement "∫g dx = G" is never crossed');
ok(!status(P.meta, P.prompt, ['sin 6x + 6']).includes('break'), 'an unbracketed function argument has two readings, so it abstains');
ok(!status(I.meta, I.prompt, ['∫14e^(2x)dx', '1/6']).includes('break'), 'a line with no variable claims no antiderivative');
ok(!status(D.meta, D.prompt, ['dy/dx = 15(3x + 5)^4']).includes('break'), 'a true derivative claim is never crossed');
ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', 'dy/dx = 15(3x + 5)^4 + C'])[1] === 'break', 'derivative: an added + C is a slip');


// ── Unknown letters: a definition or a side formula is never crossed; a claim about the chain with a free letter is ──────────
const SIDE = [
  ['A = πr²', ['y = (3x + 5)^5', 'A = πr²']],
  ['A = pi*r^2', ['y = (3x + 5)^5', 'A = pi*r^2']],
  ['let u = 2x + 1', ['y = (3x + 5)^5', 'let u = 2x + 1']],
  ['u = 2x + 1', ['y = (3x + 5)^5', 'u = 2x + 1']],
  ['V = ∫ 3x² dx', ['y = (3x + 5)^5', 'V = ∫ 3x² dx']],
  ['let u = 2x + 1 (integral question)', ['∫14e^(2x)dx', 'let u = 2x + 1']],
  ['V = ∫ 3x² dx (integral question)', ['∫14e^(2x)dx', 'V = ∫ 3x² dx']]
];
for (const [name, lines] of SIDE) ok(!status(lines[0].startsWith('∫') ? I.meta : D.meta, lines[0].startsWith('∫') ? I.prompt : D.prompt, lines).includes('break'), `a definition or side formula is never crossed: ${name}`);
ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', "y′ = 6v"])[1] === 'break', "a claim on an established quantity with a free letter, y′ = 6v in an x question, is crossed");
ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', "dy/dx = 6v"])[1] === 'break', 'dy/dx = 6v in an x question is crossed');
ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', '= 1 + v^2'])[1] === 'break', 'a bare "= …" continuation holding a free letter is crossed (it cannot hold identically)');
ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', 'w = 3'])[1] !== 'break', 'a line whose left side is a new letter is a definition: abstain');


// ── Side derivatives, definitions, assignments and partial products (review of f177f682a) ───────────────────────────────────
const CH = { meta: { kind: 'expression', canonical: '6x(x^2+1)^2' }, prompt: 'Differentiate $y = (x^2+1)^3$.' };
const none = (m, p, lines, what) => ok(!status(m, p, lines).includes('break'), what);
none(CH.meta, CH.prompt, ['u = x^2+1', 'dy/du = 3u^2', 'du/dx = 2x', 'dy/dx = 6x(x^2+1)^2'], 'chain rule written in full is never crossed (dy/du, du/dx)');
ok(status(CH.meta, CH.prompt, ['u = x^2+1', 'dy/du = 3u^2', 'du/dx = 2x', 'dy/dx = 6x(x^2+1)^2']).at(-1) === 'ok', 'and the asked derivative still ticks');
none(CH.meta, CH.prompt, ['let u = x^2+1', 'y = u^3', 'dy/du = 3u^2'], 'let u = ..., y = u^3, dy/du = 3u^2 is never crossed');
ok(status(CH.meta, CH.prompt, ['let u = x^2+1', 'y = u^3', 'dy/du = 3u^2'])[2] === 'note', '...and the true side derivative is a note');
ok(status(CH.meta, CH.prompt, ['let u = x^2+1', 'y = u^3', 'dy/du = 4u^2'])[2] === 'break', 'a false side derivative is crossed when it contradicts the student\'s own y = u^3 (dy/du = 4u^2)');
ok(status(CH.meta, CH.prompt, ['u = x^2+1', 'y = u^3', 'dy/du = 4u^2'])[2] === 'break', '...also without the word let');
none(CH.meta, CH.prompt, ['dy/du = 4u^2'], 'dy/du with no definition above cannot be proven false: abstain');
ok(status(CH.meta, CH.prompt, ['u = x^2+1', 'dy/dx = 6x(x^2+1)'])[1] === 'break', 'a wrong ASKED derivative is still crossed');
const TX = { meta: { kind: 'expression', canonical: '3x^2+2' }, prompt: 'Differentiate $y = x^3 + 2x$.' };
none(TX.meta, TX.prompt, ['s = t^3', 'ds/dt = 3t^2'], 's = t^3, ds/dt = 3t^2 inside an x question is never crossed');
ok(status(TX.meta, TX.prompt, ['s = t^3', 'ds/dt = 5t^2'])[1] === 'break', 'ds/dt = 5t^2 contradicts s = t^3: crossed');
none(TX.meta, TX.prompt, ['A = πr^2', 'dA/dr = 2πr'], 'A = pi r^2 then dA/dr = 2 pi r is never crossed');
ok(status(TX.meta, TX.prompt, ['A = πr^2', 'dA/dr = 3πr'])[1] === 'break', 'dA/dr = 3 pi r contradicts A = pi r^2: crossed');
none(TX.meta, TX.prompt, ['f(x) = x^3', 'g(x) = x^2', 'x = 2'], 'function definitions and an assignment in a derivative question abstain');
none(TX.meta, TX.prompt, ['f(x) = x^3 + 5', 'x = 7'], 'a different function definition with a different value abstains too');
ok(status(TX.meta, TX.prompt, ['y = x^3 + 2x', 'y = 5x'])[1] !== 'ok', 'a false claim about the question\'s own y is never ticked');
// expanding a product: the true partial product is never crossed; a wrong one is
const EXP = { kind: 'expression', canonical: 'x^3+6x^2+11x+6' };
const EP = 'Expand $(x+1)(x+2)(x+3)$.';
none(EXP, EP, ['(x+1)(x+2)(x+3)', '(x^2+3x+2)(x+3)', 'x^2+3x+2'], 'x^2+3x+2, the product of the first two factors, is a true partial: never crossed');
none(EXP, EP, ['x^2+3x+2'], 'the partial product as the only line is never crossed');
none(EXP, EP, ['x^2+5x+6'], '(x+2)(x+3) = x^2+5x+6 is a true partial too');
ok(status(EXP, EP, ['(x+1)(x+2)(x+3)', 'x^2+3x+3'])[1] === 'break', 'a bare line that is NOT a partial product of the question is still crossed (x^2+3x+3)');
ok(status(EXP, EP, ['x^3+6x^2+11x+7'])[0] === 'break', 'a wrong full expansion is crossed');
// incomplete roots earn nothing
{
  const eq = sol => ({ kind: 'equation', variable: 'x', solutions: sol });
  const r = stepCheck(eq([-2, 2]), 'x^2=4\nx=2', { prompt: 'Solve $x^2 = 4$.' });
  ok(r.lines.at(-1).status === 'ok' && r.lines.at(-1).state === 'incomplete' && /x = −2 is also a solution/.test(r.lines.at(-1).note), 'x^2=4 then x=2: the last line is a true line marked incomplete, naming the missing root');
  const mm = methodMarks({ meta: eq([-2, 2]), working: 'x^2=4\nx=2', marks: 3 });
  ok(mm.awarded === 0 && mm.lines.every(l => l.mark === 0), `no method credit is given for the incomplete answer (awarded ${mm.awarded})`);
  ok(mm.lost.some(l => l.key === 'marks.lost.answer'), 'and the answer mark is reported lost');
  const q = { answerType: 'working', answer: { stepMeta: eq([-2, 2]), minLines: 1 } };
  ok(checkAnswer(q, 'x^2=4\nx=2').correct !== true, 'the working x^2=4, x=2 is never marked correct');
  ok(checkAnswer({ answerType: 'set', answer: { values: [-2, 2] } }, '2').correct !== true, 'and the single root 2 is not the final answer');
  ok(methodMarks({ meta: eq([-2, 2]), working: 'x^2=4\nx=2 or x=-2', marks: 3 }).awarded >= 1, 'while the complete working earns its progress mark (the control)');
}

// A wrong line is never ticked, whichever reading is tried.
for (const wrong of ['= 5(3x + 5)^4', '= 3x + 5', '= 20(3x + 5)^4']) ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', wrong])[1] !== 'ok', `derivative: ${wrong} is never ticked`);
for (const wrong of ['= 14e^(2x)', '= 7e^(2x) * 4', '= 28e^(2x)']) ok(status(I.meta, I.prompt, ['∫14e^(2x)dx', wrong])[1] !== 'ok', `integral: ${wrong} is never ticked`);

console.log(failures.length ? `EVERY-READING RULE: FAIL — ${failures.length} of ${pass + failures.length}\n  · ${failures.join('\n  · ')}` : `EVERY-READING RULE: PASS — ${pass}/${pass} checks — a bare or "= …" line is crossed only when false under every plausible reading; a true line under either reading is never crossed`);
if (failures.length) process.exit(1);
