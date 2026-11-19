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

// ── Review follow-ups (R4): a formula in the student's own labels, unbracketed arguments, asked derivatives of other letters ─────
{
  const QM = { kind: 'expression', canonical: '((x-3)*2*x-(x^2+1))/(x-3)^2' }, QP = 'Differentiate $y = \\dfrac{x^2+1}{x-3}$.';
  const PM = { kind: 'expression', canonical: '3x^2*sin(x)+x^3*cos(x)' }, PP = 'Differentiate $y = x^3\\sin x$.';
  const notBreak = (m, p, lines, what) => ok(!status(m, p, lines).includes('break'), what);
  // 1. a formula in u, v labels is a formula: abstain with a note, never a tick, unless it is false after the student's own definitions
  for (const f of ['dy/dx = (v du/dx - u dv/dx)/v^2', 'dy/dx = (v*du/dx - u*dv/dx)/v^2', 'dy/dx = (v du/dx - u dv/dx)/(v^2)']) {
    ok(status(QM, QP, ['u = x^2+1', 'v = x-3', f]).at(-1) === 'note', `the quotient rule in du/dx layout is a note, not a cross: ${f}`);
    ok(status(QM, QP, [f]).at(-1) === 'note', `...also with no definitions above it: ${f}`);
  }
  for (const f of ['dy/dx = u dv/dx + v du/dx', 'dy/dx = u*dv/dx + v*du/dx', "dy/dx = u'v + uv'"]) {
    ok(status(PM, PP, ['u = x^3', 'v = sin x', f]).at(-1) === 'note', `the product rule on its own question is a note: ${f}`);
    ok(status(PM, PP, [f]).at(-1) === 'note', `...with no definitions it abstains: ${f}`);
  }
  ok(status(PM, PP, ['u = x^3', 'v = sin x', 'dy/dx = u dv/dx - v du/dx'])[2] === 'break', 'the product rule with the wrong sign is crossed once the student\'s own u, v make it false');
  ok(status(QM, QP, ['u = x^2+1', 'v = x-3', 'dy/dx = (u dv/dx - v du/dx)/v^2'])[2] === 'break', 'the quotient rule with u and v swapped is crossed from the student\'s own definitions');
  ok(status(QM, QP, ['u = x^2+1', 'v = x-3', 'dy/dx = (u dv/dx - v du/dx)/v^2'])[2] !== 'ok', '...and never ticked');
  ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', 'dy/dx = 6v'])[1] === 'break', 'a free letter with no derivative layout (6v) is still crossed');
  // 2. an unbracketed argument has two readings: crossed only when false under both, never ticked on one reading
  const S2 = { kind: 'expression', canonical: '2cos(2x)' }, S2P = 'Differentiate $y = \\sin 2x$.';
  for (const f of ['dy/dx = 2cos 2x', 'dy/dx = 2cos2x', 'dy/dx = 2 cos 2x', "y' = 2cos 2x"]) ok(status(S2, S2P, [f])[0] === 'note', `an unbracketed true argument abstains: ${f}`);
  ok(status(S2, S2P, ['dy/dx = 2cos(2x)'])[0] === 'ok', 'the bracketed form still ticks');
  for (const f of ['dy/dx = 3cos 2x', 'dy/dx = 2cos 3x', 'dy/dx = 2sin 2x']) ok(status(S2, S2P, [f])[0] === 'break', `false under every reading is still crossed: ${f}`);
  ok(status({ kind: 'expression', canonical: '2sec(2x)^2' }, 'Differentiate $y = \\tan 2x$.', ['dy/dx = 2sec^2 2x'])[0] !== 'break', 'tan: 2sec^2 2x is not crossed');
  ok(status({ kind: 'expression', canonical: '2/(2x+1)' }, 'Differentiate $y = \\ln(2x+1)$.', ['dy/dx = 2/(2x+1)'])[0] === 'ok', 'ln: the bracketed true line still ticks');
  ok(status({ kind: 'expression', canonical: '2/x' }, 'Differentiate $y = \\ln x^2$.', ['dy/dx = 2/x'])[0] !== 'break', 'ln: a true line is not crossed');
  ok(status({ kind: 'expression', canonical: '2e^(2x)' }, 'Differentiate $y = e^{2x}$.', ['dy/dx = 2e^2x'])[0] !== 'break', 'e^: e^2x is not crossed');
  ok(status({ kind: 'expression', canonical: '3cos(3x)' }, 'Differentiate $y = \\sin 3x$.', ['dy/dx = 3cos 3x'])[0] !== 'break', 'sin: 3cos 3x is not crossed');
  // 3. an asked derivative of other letters, defined by the prompt itself
  const A = { kind: 'expression', canonical: '2*pi*r' }, T = { kind: 'expression', canonical: '3t^2' };
  for (const p of ['Find $\\dfrac{dA}{dr}$ where $A = \\pi r^2$.', 'Find dA/dr if A = πr^2.', 'The area of a circle is $A = \\pi r^2$. Find $\\dfrac{dA}{dr}$.']) {
    ok(status(A, p, ['dA/dr = 3πr'])[0] === 'break', `a wrong asked derivative of A is crossed: ${p}`);
    ok(status(A, p, ['dA/dr = 2πr'])[0] === 'ok', `and the true one ticks: ${p}`);
    ok(status(A, p, ['A = πr^2', 'dA/dr = 2πr']).at(-1) !== 'break', `a definition above it does not cross the true line: ${p}`);
  }
  ok(status(T, 'Find ds/dt if s = t^3.', ['ds/dt = 5t^2'])[0] === 'break', 'ds/dt = 5t^2 is crossed when the prompt defines s = t^3');
  ok(status(T, 'Find ds/dt if s = t^3.', ['ds/dt = 3t^2'])[0] === 'ok', 'ds/dt = 3t^2 ticks');
  ok(status(T, 'Find ds/dt if s = t^3.', ['s = t^3', 'ds/dt = 3t^2']).every(x => x !== 'break'), 'the definition then the derivative: never crossed');
  notBreak(A, 'Find $\\dfrac{dA}{dr}$ where $A = \\pi r^2$.', ['A = πr^2', 'let u = r^2', 'du/dr = 2r'], 'a definition and a side derivative in the same question are never crossed');
  // 4. d/dx (x^2+1)^3 has two readings (the derivative of the whole power, or (d/dx(x^2+1))^3): not crossed, not ticked
  const CHM = { kind: 'expression', canonical: '6x(x^2+1)^2' }, CHP = 'Differentiate $y = (x^2+1)^3$.';
  ok(status(CHM, CHP, ['d/dx (x^2+1)^3 = 3(x^2+1)^2 * 2x'])[0] === 'note', 'unbracketed d/dx (x^2+1)^3: true under one reading, so a note, never crossed or ticked');
  ok(status(CHM, CHP, ['d/dx[(x^2+1)^3] = 3(x^2+1)^2 * 2x'])[0] === 'ok', 'the bracketed d/dx[...] still ticks');
  ok(status(CHM, CHP, ['d/dx[(x^2+1)^3] = 3(x^2+1)^2 * 3x'])[0] !== 'ok', 'and a false right side after the bracketed operator is never ticked');
}

// ── Review round 2: the prompt-defined context only ADDS crosses for lines provably false against the derivative of the prompt's own definition ──
{
  // Differential list: every line here is TRUE (or a legitimate abstention) and was a note on the path before the prompt-defined context
  // existed, so none may be a break. Each entry: [canonical, prompt, lines].
  const TRUE_LINES = [
    ['12', 'Find dA/dr when r = 2 if A = 3r^2.', ['dA/dr = 6r']],
    ['12', 'Find dA/dr at r = 2 if A = 3r^2.', ['dA/dr = 6r']],
    ['12', 'Evaluate dA/dr when r=2 if A = 3r^2.', ['dA/dr = 6r']],
    ['12', 'Find the value of dA/dr when r = 2 if A = 3r^2.', ['dA/dr = 6r', '= 12']],
    ['4', 'Find dA/dr when r = 2, where A = r^2.', ['dA/dr = 2r', '= 4']],
    ['4', 'Find $\\dfrac{dA}{dr}$ when $r = 2$, where $A = r^2$.', ['dA/dr = 2r', '= 4']],
    ['6t', 's = t^3. Find ds/dt and hence d²s/dt².', ['ds/dt = 3t^2']],
    ['6t', 's = t^3. Find ds/dt and hence d^2s/dt^2.', ['ds/dt = 3t^2']],
    ['6t', 'Given s = t^3, find the second derivative; first find ds/dt.', ['ds/dt = 3t^2']],
    ['2*pi*r', 'Find dA/dr where A = πr^2.', ['dA/dr = 6.28r']],
    ['2*pi*r', 'Find dA/dr where A = πr^2.', ['dA/dr = 3.14 * 2r']],
    ['2*pi*r', 'Find dA/dr where A = πr^2.', ['dA/dr = 6.283r']],
    ['2*pi*r', 'Find dA/dr where A = πr^2. Use π = 3.14.', ['dA/dr = 6.28r']],
    ['1/(2*sqrt(r))', 'A = sqrt(r). Find dA/dr.', ['dA/dr = 1/2 * r^-1/2']],
    ['1/(2*sqrt(r))', 'A = sqrt(r). Find dA/dr.', ['dA/dr = 1/2 r^-1/2']],
    ['2*pi*r', 'Find dA/dr where A = πr^2.', ['A = πr^2', 'dA/dr = 2πr']],
    ['3t^2', 'Find ds/dt if s = t^3.', ['s = t^3', 'ds/dt = 3t^2']]
  ];
  for (const [c, p, lines] of TRUE_LINES) ok(!status({ kind: 'expression', canonical: c }, p, lines).includes('break'), `a true line is never crossed: ${p} · ${lines.join(' ; ')}`);
  // and the unbracketed fraction exponent and a rounded π hold on the plain y = f(x) path as well
  ok(!status({ kind: 'expression', canonical: '1/(2*sqrt(x))' }, 'Differentiate $y = \\sqrt{x}$.', ['dy/dx = 1/2 * x^-1/2']).includes('break'), 'y = sqrt(x): x^-1/2 can be read two ways, so it is not crossed');
  ok(status({ kind: 'expression', canonical: '1/(2*sqrt(r))' }, 'A = sqrt(r). Find dA/dr.', ['dA/dr = 1/2 * r^(-1/2)'])[0] === 'ok', 'the bracketed true exponent still ticks');
  ok(status({ kind: 'expression', canonical: '1/(2*sqrt(r))' }, 'A = sqrt(r). Find dA/dr.', ['dA/dr = 1/3 * r^(-1/2)'])[0] === 'break', 'and a false one with a bracketed exponent is crossed');
  ok(status({ kind: 'expression', canonical: '2*pi*r' }, 'Find dA/dr where A = πr^2.', ['dA/dr = 2πr'])[0] === 'ok', 'the exact 2πr ticks');
  // a false line is still crossed when the question is the plain first derivative of what the prompt defines
  ok(status({ kind: 'expression', canonical: '6r' }, 'Find dA/dr if A = 3r^2.', ['dA/dr = 5r'])[0] === 'break', 'dA/dr = 5r for A = 3r^2 is crossed');
  ok(status({ kind: 'expression', canonical: '6r' }, 'Find dA/dr if A = 3r^2.', ['dA/dr = 6r'])[0] === 'ok', 'dA/dr = 6r for A = 3r^2 ticks');
  // a canonical that is not the derivative of the definition (a value, a higher derivative) never builds the context
  ok(status({ kind: 'expression', canonical: '12' }, 'Find dA/dr if A = 3r^2 at the point r = 2.', ['dA/dr = 5r']).every(x => x !== 'break'), 'a value asked at a point: a general derivative line is not held to the value');
  ok(status({ kind: 'expression', canonical: '6t' }, 'Find d2s/dt2 for s = t^3.', ['ds/dt = 4t^2']).every(x => x !== 'break'), 'a second derivative asked: the first-derivative line is not held to it');
}

// A wrong line is never ticked, whichever reading is tried.
for (const wrong of ['= 5(3x + 5)^4', '= 3x + 5', '= 20(3x + 5)^4']) ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', wrong])[1] !== 'ok', `derivative: ${wrong} is never ticked`);
for (const wrong of ['= 14e^(2x)', '= 7e^(2x) * 4', '= 28e^(2x)']) ok(status(I.meta, I.prompt, ['∫14e^(2x)dx', wrong])[1] !== 'ok', `integral: ${wrong} is never ticked`);

console.log(failures.length ? `EVERY-READING RULE: FAIL — ${failures.length} of ${pass + failures.length}\n  · ${failures.join('\n  · ')}` : `EVERY-READING RULE: PASS — ${pass}/${pass} checks — a bare or "= …" line is crossed only when false under every plausible reading; a true line under either reading is never crossed`);
if (failures.length) process.exit(1);
