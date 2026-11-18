// Pri Learning · the every-reading rule for bare and "= …" lines in calculus questions (CTO ruling on the owner's rule
// "a true line is never crossed"). A bare or continuation line has more than one plausible reading: (a) it equals a line
// above, (b) it is the requested derivative or integral. It is CROSSED only when the engine proves it false under every
// reading, and a true line under either reading is never crossed.
import { stepCheck } from '../src/engine/checker.js';

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

// A wrong line is never ticked, whichever reading is tried.
for (const wrong of ['= 5(3x + 5)^4', '= 3x + 5', '= 20(3x + 5)^4']) ok(status(D.meta, D.prompt, ['y = (3x + 5)^5', wrong])[1] !== 'ok', `derivative: ${wrong} is never ticked`);
for (const wrong of ['= 14e^(2x)', '= 7e^(2x) * 4', '= 28e^(2x)']) ok(status(I.meta, I.prompt, ['∫14e^(2x)dx', wrong])[1] !== 'ok', `integral: ${wrong} is never ticked`);

console.log(failures.length ? `EVERY-READING RULE: FAIL — ${failures.length} of ${pass + failures.length}\n  · ${failures.join('\n  · ')}` : `EVERY-READING RULE: PASS — ${pass}/${pass} checks — a bare or "= …" line is crossed only when false under every plausible reading; a true line under either reading is never crossed`);
if (failures.length) process.exit(1);
