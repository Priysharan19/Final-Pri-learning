// Pri Learning · how a function's bare argument is read (FUNCTION_ARGUMENT_RULE, client/src/engine/expr.js).
//
// Students type `sin2x`, `cos 3x`, `tan2θ`, `ln2x`, `sin^2 x`, `sin²x`, `sin^2 3x`. The engine read `cos2x` as cos(2)·x, so a right answer
// was refused and (when a key was written that way) `cos(2)·x` was marked right. The rule, in one place:
//   1. Explicit brackets always win: cos(2)x is cos(2)·x.
//   2. sin cos tan sec cosec csc cot, the inverse forms, ln and exp followed (directly or after a space) by a number and ONE variable or Greek
//      letter take that product as the argument: cos2x = cos(2x), sin 3θ = sin(3θ), ln2x = ln(2x).
//   3. A power on the name is the power of the value: sin^2 x, sin²x = (sin x)²; sin^2 3x, sin²3x = (sin 3x)².
//   4. The argument stops at + or −, at a closing bracket, at * or /, and at another function name: sin2x cos3x = sin(2x)·cos(3x).
//   5. cos2 alone is cos(2).
//   6. Where the product is followed by a power, a factorial or a further factor (sin2x^2, sin2xy, sin2x(x+1)) nothing is read differently.
//   7. e^2x, sqrt2x, log2x (the 2 may be a base) have two readings: a typed final answer is right when either reading is the key and no
//      reading is a trap the question records; a working line with one is a note that asks for brackets, never ticked or crossed.
//
//   node client/test/function-argument-reading-check.mjs
import { parse, evaluate, ambiguousReadings } from '../src/engine/expr.js';
import { checkAnswer, stepCheck } from '../src/engine/checker.js';

let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

const POINTS = [{ x: 0.7, theta: 0.7 }, { x: 0.31, theta: 0.31 }, { x: 1.3, theta: 1.3 }];
const value = (text, env) => { try { const v = evaluate(parse(text), env); return typeof v === 'number' ? v : NaN; } catch { return NaN; } };
const same = (a, b) => POINTS.every(env => { const u = value(a, env), v = value(b, env); return Number.isFinite(u) && Number.isFinite(v) && Math.abs(u - v) <= 1e-9 * Math.max(1, Math.abs(v)); });
const differs = (a, b) => POINTS.some(env => { const u = value(a, env), v = value(b, env); return Number.isFinite(u) && Number.isFinite(v) && Math.abs(u - v) > 1e-6 * Math.max(1, Math.abs(v)); });

// ── 1. the table: every function, every way of writing it ───────────────────────────────────────────────────────────────
const FUNCTIONS = ['sin', 'cos', 'tan', 'sec', 'cosec', 'csc', 'cot', 'ln', 'exp', 'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan'];
let tableRows = 0;
for (const f of FUNCTIONS) {
  const rows = [
    [`${f}2x`, `${f}(2*x)`], [`${f} 2x`, `${f}(2*x)`], [`${f}2 x`, `${f}(2*x)`], [`${f} 2 x`, `${f}(2*x)`], [`${f}0.5x`, `${f}(0.5*x)`],
    [`${f}2θ`, `${f}(2*theta)`], [`${f} 3θ`, `${f}(3*theta)`], [`${f}2π`, `${f}(2*pi)`],
    [`${f}2x+1`, `${f}(2*x)+1`], [`${f}2x-1`, `${f}(2*x)-1`], [`3${f}2x`, `3*${f}(2*x)`], [`(${f}2x)`, `${f}(2*x)`], [`1/${f}2x`, `1/${f}(2*x)`],
    [`${f}2x*3`, `${f}(2*x)*3`], [`${f}2x/3`, `${f}(2*x)/3`],
    [`${f}2x ${f}3x`, `${f}(2*x)*${f}(3*x)`], [`${f}2x${f}3x`, `${f}(2*x)*${f}(3*x)`], [`${f}2x ln3x`, `${f}(2*x)*ln(3*x)`],
    [`${f}^2 x`, `(${f}(x))^2`], [`${f}^2x`, `(${f}(x))^2`], [`${f}²x`, `(${f}(x))^2`], [`${f}^2 3x`, `(${f}(3*x))^2`], [`${f}²3x`, `(${f}(3*x))^2`],
    [`${f}^2(3x)`, `(${f}(3*x))^2`], [`${f}^2 (3x)`, `(${f}(3*x))^2`], [`${f}^3 2θ`, `(${f}(2*theta))^3`],
    [`${f}(2x)`, `${f}(2*x)`], [`${f}(2)x`, `${f}(2)*x`], [`${f}(2) x`, `${f}(2)*x`], [`${f}2`, `${f}(2)`], [`${f} 2`, `${f}(2)`], [`${f}x`, `${f}(x)`], [`${f} x`, `${f}(x)`],
    [`${f}2x(x+1)`, `${f}(2)*x*(x+1)`], [`${f}2x^2`, `${f}(2)*x^2`], [`${f}2xy`, `${f}(2)*x*y`]
  ];
  for (const [input, want] of rows) {
    tableRows++;
    // (a function of a number is NaN or infinite at some points; only the points both sides define are compared, and at least one must)
    const env = { ...POINTS[0], y: 0.9 };
    const u = value(input, env), v = value(want, env);
    const both = Number.isNaN(u) && Number.isNaN(v) || (Number.isFinite(u) && Number.isFinite(v) && Math.abs(u - v) <= 1e-9 * Math.max(1, Math.abs(v)))
      || (!Number.isFinite(u) && !Number.isFinite(v) && Number.isNaN(u) === Number.isNaN(v));
    ok(both, `${JSON.stringify(input)} reads as ${want}: got ${u}, wanted ${v}`);
  }
}
ok(tableRows === 15 * 36, `the table has its rows: ${tableRows}`);
// the exact shapes the defect named, and that the old reading really was different
ok(same('cos2x', 'cos(2*x)') && differs('cos2x', 'cos(2)*x'), 'cos2x is cos(2x), not cos(2)·x');
ok(same('ln2x', 'ln(2*x)') && differs('ln2x', 'ln(2)*x'), 'ln2x is ln(2x)');
ok(same('sin^2 3x', '(sin(3*x))^2') && differs('sin^2 3x', '(sin(3)^2)*x'), 'sin^2 3x is (sin 3x)^2');
ok(same('1/2*(cos2x-cos4x)', '1/2*(cos(2*x)-cos(4*x))'), 'half the difference of two cosines, as a student types it');
// the exponent ends at a space or a superscript sign, it is not the digits 23
ok(value('sin^2 3x', { x: 0.7 }) === value('sin²3x', { x: 0.7 }) && value('x²3', { x: 2 }) === value('x^23', { x: 2 }), 'sin^2 3x and sin²3x end the exponent; a power of anything else is read as it was');
// a sign, a bracket, a function name or an operator ends the argument; a bare number is a number
ok(same('sin2x+1', 'sin(2*x)+1') && same('cos2x', 'cos(2*x)') && same('cos2', 'cos(2)') && same('tan2', 'tan(2)'), 'sin2x+1, cos2, tan2');
ok(same('sin 30', 'sin(30)') && same('cos 2.5', 'cos(2.5)'), 'a function of a plain number is unchanged');

ok(Number.isNaN(value('tan^(-1)3x', POINTS[0])) && value('sin^(-1)x', POINTS[0]) === value('arcsin(x)', POINTS[0]), 'tan^(-1)3x is still refused as ambiguous, as before; a bare letter is still the inverse');

// a number, π and ONE letter are one product, the same as a number and one letter
ok(same('sin2πx', 'sin(2*pi*x)') && same('cos2πx+1', 'cos(2*pi*x)+1') && same('tan 2πx', 'tan(2*pi*x)') && same('sin2πx cos3x', 'sin(2*pi*x)*cos(3*x)') && same('cos2π', 'cos(2*pi)') && same('sin2θπ', 'sin(2)*theta*pi'), 'sin2πx is sin(2πx), as cos2π is cos(2π)');
const withY = (a, b) => { const e = { x: 0.7, y: 0.9 }; return Math.abs(value(a, e) - value(b, e)) < 1e-12; };
ok(withY('sin2πxy', 'sin(2)*pi*x*y') && same('sin2πx^2', 'sin(2)*pi*x^2') && same('sin2πx(x+1)', 'sin(2)*pi*x*(x+1)'), 'sin2πxy, sin2πx^2 and sin2πx(x+1) are read as they were');

// ── 2. forms that have two readings: the parser keeps the literal one, ambiguousReadings lists the others ─────────────────────────────
ok(same('e^2x', 'e^2*x') && same('sqrt2x', 'sqrt(2)*x') && same('log2x', 'log(2)*x') && same('cbrt2x', 'cbrt(2)*x'), 'the literal reading of e^2x, sqrt2x, log2x is unchanged');
const readings = ambiguousReadings;
const reads = (input, want) => readings(input).some(r => same(r, want));
ok(reads('e^2x', 'e^(2*x)'), 'e^2x also reads as e^(2x)');
ok(reads('2e^-3x', '2*e^(-3*x)'), '2e^-3x also reads as 2e^(-3x)');
ok(reads('sqrt2x', 'sqrt(2*x)') && reads('√3x', 'sqrt(3*x)'), 'sqrt2x also reads as sqrt(2x)');
ok(reads('log2x', 'log(2*x)') && reads('log2x', 'ln(x)/ln(2)'), 'log2x also reads as log(2x) and as log base 2 of x');
ok(readings('e^(2x)').length === 0 && readings('sqrt(2x)').length === 0 && readings('cos2x').length === 0 && readings('e^2').length === 0 && readings('e^x').length === 0 && readings('2x+1').length === 0, 'bracketed forms and the conventional ones have one reading');
ok(readings('xe^2x').length > 0 && readings('3xe^-3x').length > 0 && readings('12e^2x').length > 0 && readings('x e^2 x').length > 0, 'a letter, a number or nothing before e: e^2x is the same two-reading form');
for (const typed of ['e^2*x', 'e^2·x', 'e^2×x', '12*e^2*x', 'x*e^2*x', 'sqrt2*x', 'sqrt2·x', 'log2*x', 'log2×x', 'e^2 * x', 'e^-3*x', 'e^(2)x', 'sine^2x']) ok(readings(typed).length === 0, `an explicit sign means what it says, ${typed} has one reading`);
ok(readings('e^2xy').length === 0 && readings('e^2x^2').length === 0 && readings('sqrt2x(x+1)').length === 0, 'a form followed by a further factor is not listed');

// ── 3. final answers ────────────────────────────────────────────────────────────────────────────────────────────────────
const expr = (key, extra = {}) => ({ answerType: 'expression', prompt: 'Simplify.', answer: { expr: key }, ...extra });
const right = (key, typed, extra) => checkAnswer(expr(key, extra), typed).correct === true;
// the reviewer's questions
ok(right('1/2*(cos(2*x)-cos(4*x))', '1/2(cos2x-cos4x)') && right('1/2*(cos(2*x)-cos(4*x))', '1/2(cos(2x)-cos(4x))') && right('1/2*(cos(2*x)-cos(4*x))', '0.5(cos 2x - cos 4x)'), 'sin x sin 3x as a difference of cosines: the usual written form is right');
ok(!right('1/2*(cos(2*x)-cos(4*x))', '1/2*(cos(2)-cos(4))*x'), 'cos(2)−cos(4) times x is not the difference of cosines');
ok(!right('1/2*(cos2x-cos4x)', '1/2*(cos(2)-cos(4))*x') && right('1/2*(cos2x-cos4x)', '1/2*(cos(2*x)-cos(4*x))'), 'a key serialised as cos2x means cos(2x): cos(2)·x is wrong');
ok(right('cos(2)*x', 'cos(2)x') && !right('cos(2)*x', 'cos2x') && !right('cos(2)*x', 'cos 2x'), 'a key that really is cos(2)·x is typed with its bracket; cos2x is a different answer');
for (const [key, typed] of [['sin(2*x)', 'sin2x'], ['sin(2*x)', 'sin 2x'], ['cos(3*theta)', 'cos 3θ'], ['tan(2*theta)', 'tan2θ'], ['ln(2*x)', 'ln2x'], ['ln(2*x)+1', 'ln 2x + 1'], ['sin(x)^2', 'sin^2 x'],
  ['sin(x)^2', 'sin²x'], ['cos(3*x)^2', 'cos^2(3x)'], ['sin(3*x)^2', 'sin^2 3x'], ['sin(3*x)^2', 'sin²3x'], ['sin(2*x)*cos(3*x)', 'sin2x cos3x'], ['sec(2*x)^2', 'sec^2 2x'], ['exp(2*x)', 'exp2x'],
  ['3*sin(2*x)*cos(x)', '3sin2x cos x'], ['arctan(2*x)', 'arctan2x'], ['cosec(3*x)', 'cosec 3x'], ['cot(2*x)/2', 'cot2x/2']]) {
  ok(right(key, typed), `${typed} is right for ${key}`);
}
for (const [key, typed] of [['sin(2*x)', 'sin(2)x'], ['sin(2*x)', 'sin2'], ['sin(2*x)', 'sin x'], ['sin(2*x)', '2sin x'], ['sin(2*x)', 'sin2x+1'], ['sin(x)^2', 'sin2x'], ['cos(3*x)^2', 'cos(3)^2x'], ['cos(2*x)', 'cos^2x'], ['sin(2*x)', 'sin2x^2'], ['ln(2*x)', 'ln2+x'], ['ln(2*x)', 'ln(2)x'], ['sin(2*x)', 'sin(2+x)'], ['sin(2*x)', '2sin(x)']]) {
  ok(!right(key, typed), `${typed} is wrong for ${key}`);
}
// two readings: either reaches the key
ok(right('2*e^(2*x)', '2e^2x') && right('2*e^(2*x)', '2e^(2x)') && right('e^(-3*x)', 'e^-3x') && right('2*e^(2)*x', '2e^2x') && right('2*e^(2)*x', '2e^(2)x'), 'e^2x: right if either reading is the key');
ok(right('sqrt(2*x)', 'sqrt2x') && right('sqrt(2)*x', 'sqrt2x') && right('sqrt(2*x)', '√2x') && !right('sqrt(2*x)', 'sqrt(2)x'), 'sqrt2x: either reading; an explicit bracket is only itself');
ok(right('log(2*x)', 'log2x') && right('ln(x)/ln(2)', 'log2x') && right('log(2)*x', 'log2x') && !right('ln(2*x)', 'log2x'), 'log2x: log(2x), log base 2 of x or log(2)·x');
// an explicit multiplication sign is what it says: e²·x is NOT e^(2x)
for (const [key, typed] of [['e^(2*x)', 'e^2*x'], ['e^(2*x)', 'e^2·x'], ['e^(2*x)', 'e^2×x'], ['e^(2*x)', 'e^2 * x'], ['12*e^(2*x)', '12*e^2*x'], ['12*e^(2*x)', '12e^2*x'], ['x*e^(2*x)', 'x*e^2*x'], ['x*e^(2*x)', 'xe^2*x'], ['e^(-3*x)', 'e^-3*x'],
  ['sqrt(2*x)', 'sqrt2*x'], ['sqrt(2*x)', 'sqrt2·x'], ['log(2*x)', 'log2*x'], ['log(2*x)', 'log2×x']]) ok(!right(key, typed), `${typed} is wrong for ${key}`);
ok(right('x*e^(2*x)', 'xe^2x') && right('x*e^(2*x)', 'x e^2x') && right('3*x*e^(-3*x)', '3xe^-3x'), 'xe^2x is the two-reading form too');
// …except when the other reading is a trap the question records, or the answer is wrong either way
ok(!right('2*e^(2*x)', '2e^2x', { traps: [{ expr: '2*e^2*x', why: 'Treated e^2x as e^2 times x.' }] }), 'e^2x is not accepted when e^2·x is a recorded trap');
ok(!right('2*e^(2*x)', '2e^2x', { traps: [{ expr: '2*e^(2*x)+1', why: 'x' }, { expr: '2*e^(2)*x', why: 'x' }] }), 'a recorded trap on any reading refuses it');
ok(right('2*e^(2*x)', '2e^2x', { traps: [{ expr: '2*e^(x)', why: 'Forgot the inner 2.' }] }), 'an unrelated trap does not refuse it');
ok(!right('3*e^(2*x)', '2e^2x') && !right('sqrt(2*x)', 'sqrt3x') && !right('log(2*x)', 'log3x'), 'a wrong answer is wrong under every reading');

// ── 4. lines: a line with two readings is a note, never ticked and never crossed ──────────────────────────────────────────────────────
const I = { prompt: 'Find $\\displaystyle\\int 14e^{2x}\\,dx$. (You may omit the $+C$.)', meta: { kind: 'expression', canonical: '7*e^(2*x)' } };
const D = { prompt: 'Differentiate $y = \\sqrt{2x}$.', meta: { kind: 'expression', canonical: '1/sqrt(2*x)' } };
const statuses = (c, lines) => stepCheck(c.meta, lines.join('\n'), { prompt: c.prompt }).lines.map(l => l.status);
for (const [c, lines] of [[I, ['∫14e^(2x)dx', '7e^2x']], [I, ['∫14e^(2x)dx', '= 7e^2x']], [I, ['∫14e^(2x)dx', '7e^2x + C']], [I, ['∫14e^(2x)dx', '14e^2x']], [D, ['y = sqrt(2x)', 'dy/dx = 1/sqrt2x']], [D, ['y = sqrt(2x)', 'dy/dx = 1/sqrt2x']]]) {
  const got = statuses(c, lines);
  ok(got[1] === 'note', `a line with two readings is a note, not ${got[1]}: ${JSON.stringify(lines)}`);
}
// the readings disagree: a note. They agree it is false: crossed. An explicit sign: judged as written.
const line = text => statuses(I, ['∫14e^(2x)dx', text])[1];
ok(line('7e^2x') === 'note' && line('7xe^2x') === 'break' && line('5e^2x') === 'break' && line('x7e^2x') === 'break', 'a line false under both readings is crossed (5e^2x, 7xe^2x)');
ok(line('7e^2*x') === 'break' && line('7e^2·x') === 'break' && line('7e^(2x)') === 'ok', 'an explicit sign is judged as written');
ok(statuses(I, ['∫14e^(2x)dx', '7e^2x', '7e^(2x)']).join() === 'note,note,ok', 'a held line does not stop the next line being judged');
ok(statuses(I, ['∫14e^(2x)dx', '7e^(2x)'])[1] === 'ok' && statuses(I, ['∫14e^(2x)dx', '14e^(2x)'])[1] !== 'ok', 'the bracketed lines are judged as ever (the same verdicts as origin/main)');

if (failures.length) { console.error(`FUNCTION ARGUMENT READING: FAIL ${failures.length} of ${pass + failures.length}`); for (const f of failures.slice(0, 40)) console.error(`  ${f}`); process.exit(1); }
console.log(`FUNCTION ARGUMENT READING: PASS ${pass}/${pass} checks`);
