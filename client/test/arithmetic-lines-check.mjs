// Pri Learning · the arithmetic check (engine/arithmeticLines.js): line marks for
// a question that has no Step Check.
//
// Owner request, 19 November 2026: "make sure every question has line marking".
// Two photographed pages that day (a vector magnitude, a definite integral) came
// back "Your working was not verified" with no line judged.
//
// Part 1  The rules: false arithmetic is crossed, true arithmetic is ticked as
//         arithmetic only, and everything else is a note.
// Part 2  A sweep: random true arithmetic is never crossed; random false
//         arithmetic is never ticked.
// Part 3  Wiring: the server uses it only where a question has no Step Check,
//         it reaches no mark, and the result card never calls it "consistent
//         with the correct solution".
import { stepCheckArithmetic } from '../src/engine/arithmeticLines.js';
import { fullyVerifiedWorking } from '../src/engine/misconceptions.js';
import { workingEvidence, workingEvidenceCopy } from '../src/components/attemptEvidence.js';
import { buildAnnotatedWorking } from '../src/components/annotatedWorkingModel.js';
import { stepEvidence, stepMetaFor } from '../../server/platform/markerOps.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const run = lines => stepCheckArithmetic(lines.join('\n'));
const st = lines => run(lines).lines.map(l => l.status).join();

// ── Part 1 · the rules ───────────────────────────────────────────────────────
// the owner's integral page, as the live reader returned it (with the lines of another question above it)
const PAGE = ['= |[-20 -6; -4 +12]|', '196 +64 / 260', '= |[14; 8]| = sqrt(14^2 + 8^2)', '= sqrt(260)', 'Hamilton paths', '∫_-2^4 12x dx = 12∫_-2^4 x dx.', '= [12x^2/2]_-2^4', '= [6x^2]_-2^4', '= 6[x^2]_-2^4', '= 6[4^2 - 2^2]', '= 6(16 - 4) = 6 x 12', 'Ans = 72'];
let r = run(PAGE);
ok(r.firstBreak === -1, `the owner's integral page: nothing crossed (${r.lines.map(l => l.status)})`);
ok(r.lines.slice(5).map(l => l.status).join() === 'ok,ok,ok,ok,ok,ok,ok', `every line of the integral is ticked: each is true as written (${r.lines.slice(5).map(l => l.status)})`);
ok(r.lines[10].state === 'arithmetic' && r.arithmetic === true && r.source === 'value-chain', 'a tick is an arithmetic tick and the report says so');
ok(r.lines.slice(0, 5).every(l => l.status === 'note'), `vectors, words and a column sum are not judged (${r.lines.slice(0, 5).map(l => l.status)})`);

r = run(['-20 - 6 = 14']);
ok(r.lines[0].status === 'break' && /−26/.test(r.diagnosis.message) && /14/.test(r.diagnosis.message), `false arithmetic is crossed with both values (${r.diagnosis?.message})`);
ok(st(['3 × 4', '= 12', '= 13']) === 'note,ok,break' && /line above comes to 12/.test(run(['3 × 4', '= 12', '= 13']).diagnosis.message), 'a continuation is held to the line above');
ok(st(['196 + 64 = 260', '1/2 + 1/3 = 5/6', '5! = 120', '(-3)^2 = 9', '-3^2 = -9', '√16 = 4', '2(3+4) = 14', '6[4^2 - 2^2] = 72', '7 = 7']) === 'ok,ok,ok,ok,ok,ok,ok,ok,ok', 'true arithmetic is ticked');
for (const f of ['1/2 + 1/3 = 2/5', '(-3)^2 = -9', '2 + 2 = 4 = 5', '6(16 - 4) = 62', 'sqrt(16) = 5', '7 × 8 = 54', '100 - 37 = 73']) ok(st([f]) === 'break', `false arithmetic is crossed: ${f}`);
ok(st(['2 + 2 = 5', '3 + 3 = 6']) === 'break,note', 'lines after the slip are not judged');

// independent review, round 1: true lines that were crossed
for (const page of [['1. 2+3 = 5'], ['3. 2+3 = 5'], ['10. 3+3=6'], ['(2) 2+3 = 5'], ['(3) 5+1 = 6'], ['2) 2+3 = 5'], ['2 + 3 = 5 (2)'], ['2 + 3 = 5 (3)'], ['2+3 = 5, 4+1 = 5'], ['2+3=5, 4+1=6'], ['1,5 + 2 = 3,5'], ['2,5 x 2 = 5'], ['1,000 + 1 = 1,001'], ['5 - 2 = 3', '- 1 = 2'], ['2+3 = 5', '+ 1 = 6'], ['5', '- 1 = 4'], ['6/2(1+2) = 1'], ['6/2(1+2) = 9'], ['48 ÷ 2(9+3) = 2'], ['10!/3!7! = 120'], ['(5)(4)(3)/(3)(2)(1) = 10'], ['5·4·3/3·2·1 = 10'], ['3 . 4 = 12'], ['3:4 = 6:8']]) ok(!/break/.test(st(page)), `a line Pri cannot read one way only is not crossed: ${page.join(' | ')} (${st(page)})`);
ok(st(['-20 - 6 = 14']) === 'break' && st(['-20 -6 = 14']) === 'break' && st(['(16 - 4) × 6 = 70']) === 'break', 'a line that begins with a negative number or a bracket is still judged');
// true as written: identities, definite integrals and bracket evaluations are ticked and never crossed
ok(st(['12x^2/2 = 6x^2', '(x+1)^2 = x^2 + 2x + 1', '2(x + 3) = 2x + 6', 'sin(x)^2 + cos(x)^2 = 1', 'x^2 - 9 = (x-3)(x+3)']) === 'ok,ok,ok,ok,ok', 'an identity is ticked');
ok(st(['(x+1)^2', '= x^2 + 2x + 1', '= x(x + 2) + 1']) === 'note,ok,ok', 'and so is a chain of them');
for (const f of ['(x+1)^2 = x^2 + 1', 'x^2 = 9', '2x + 3 = 11', 'sqrt(x^2) = x', 'y = x^2 + 3x', 'x = 3', 'f(x) = x^2', 'dy/dx = 2x', 'a = b', 'x^2 = 2x', 'ln(x^2) = 2ln(x)']) ok(st([f]) === 'note', `not an identity, so a note and never a cross: ${f} (${st([f])})`);
// independent review: a letter before a bracket may be a function; these are false lines and were ticked
for (const f of ['f(x+h) = f(x)+f(h)', 'f(a+b) = fa+fb', 'f(2x) = 2f(x)', 'f(2) = 2f', 'f(x) = fx', 'g(x) = gx', 'y(x) = yx', 'v(t) = vt', 'P(A) = PA', 'f(f(x)) = f^2x', 'd(x^2) = dx^2', 'x(t) = xt', 'a(2) = 2a', '1/2x = x/2', 'x^2x = x^3', '1/xy = y/x', 'e^2x = e^(2x)']) ok(st([f]) === 'note', `a possible function call or a line that groups two ways is not ticked: ${f} (${st([f])})`);
for (const f of ['sin x^2 = sin(x)^2', 'sin x(x+1) = x sin x + sin x', 'x(t+h) = xt+xh', 'a(x+h) = ax+ah', 'k(x+h) = kx+kh', 'x(t+1) = xt+x', 'a(b+c) = ab+ac', 'r(θ) = rθ', 'f(f(x)) = ff(x)', 'ln 2x = 2 ln x', 'sin x^2 = (sin x)^2']) ok(st([f]) === 'note', `review round 2: not ticked: ${f} (${st([f])})`);
ok(st(['x(x + 2) = x^2 + 2x', 'n(n+1)/2 = (n^2+n)/2', '2(x+3) = 2x+6', 'sin(2x) = 2sin(x)cos(x)', 'k(k+1) + 2(k+1) = (k+1)(k+2)', '(x+1)(x-1) = x^2 - 1', 'e^(2x) = (e^x)^2']) === 'ok,ok,ok,ok,ok,ok,ok', 'a bracket multiplied by x, n or a number, and a named function, are still read');
ok(st(['∫_0^3 x^2 dx = [x^3/3]_0^3', '= 27/3 - 0', '= 9']) === 'ok,ok,ok', 'a definite integral worked through is ticked line by line');
ok(st(['∫_0^3 x^2 dx = 10', '[x^3/3]_0^3 = 8', '∫_0^3 x^2 dx', '= 10']) === 'note,note,note,note', 'a wrong value for an integral is a note, never a cross (the limits may have been misread)');
ok(st(['∫_{0}^{pi} sin(x) dx = 2', '[-cos(x)]_0^π = 2', '∫_1^e 1/x dx = 1']) === 'ok,ok,ok', 'limits with π and e are read');
ok(st(['∫_0^1 1/x dx = 5', '∫_0^3 x^2 dy = 9', '[x^2 y]_0^1 = 1', '∫ x dx = x^2/2']) === 'note,note,note,note', 'an improper integral, a wrong variable, two letters and an indefinite integral are not judged');
// found by the labelled audit over every Year 11 and 12 topic (true lines that were crossed)
ok(st(['dV/dt = 9(3t + 5)^2', 't = 5', '= 20', '9 × 20^2 = 3600']) === 'note,note,note,ok', 'a `=` line after a line of letters is never crossed');
ok(st(['√[3]1 = 1', '√[3]-27 = -3', 'sqrt[3]{8} = 2']) === 'note,note,note', 'a root with an index is not read');
ok(st(['2 + 72 = 74', 'hence ans = 18']) === 'ok,note' && st(['6 × 12', 'Ans = 72']) === 'note,ok', '`ans =` is ticked when it equals the line above and never crossed');
ok(st(['500 = 340', '6000 = 18']) === 'note,note' && st(['3 × 4 = 12', '= 13']) === 'ok,break', 'two bare numbers are not judged; a continuation still is');
// handwritten trig and the name of the step (owner, 19 November: a trig proof a competitor marked step by step)
{
  const PROOF = ['LHS = (secθ - cosθ)/(cosecθ - sinθ)', 'Numerator: secθ - cosθ', '= 1/cosθ - cosθ', '= (1 - cos^2θ)/cosθ', '= sin^2θ/cosθ = sinθ tanθ', 'Denominator: cosecθ - sinθ', '= 1/sinθ - sinθ', '= (1 - sin^2θ)/sinθ', '= cos^2θ/sinθ = cosθ/tanθ', 'LHS = sinθ tanθ / (cosθ/tanθ)', '= tan^2θ × tanθ', '= tan^3θ = RHS //'];
  const p = run(PROOF);
  ok(p.lines.map(l => l.status).join() === 'note,note,ok,ok,ok,note,ok,ok,ok,note,ok,ok', `the trig proof: every step is ticked, the lines that only set up are notes (${p.lines.map(l => l.status)})`);
  ok(/reciprocal identity sec θ = 1\/cos θ/.test(p.lines[2].note) && /common denominator/.test(p.lines[3].note) && /Pythagorean identity/.test(p.lines[4].note) && /reciprocal identity cosec θ = 1\/sin θ/.test(p.lines[6].note), `each tick names the step it matches (${p.lines[2].note} | ${p.lines[6].note})`);
  ok(p.firstBreak === -1 && p.lines.every(l => l.status !== 'break'), 'and nothing is crossed');
}
ok(st(['sin θ cos θ = cos θ sin θ', 'sin 2θ = 2 sin θ cos θ', 'cos^2 x = 1 - sin^2 x', 'tan x = sin x / cos x', '1 + tan^2 A = sec^2 A', 'ln x + ln x = 2 ln x', '2sin(x)cos(x) = sin(2x)', 'cot θ = cos θ/sin θ']) === 'ok,ok,ok,ok,ok,ok,ok,ok', 'unbracketed functions of one letter are read');
for (const f of ['sec θ = 1/sin θ', '1 - cos^2 θ = cos^2 θ', 'sin 2θ = 2 sin θ', 'tan θ = cos θ/sin θ', 'sin^2 θ = sin θ^2', 'cos^-1 x = 1/cos x', 'sin^-1 x = 1/sin x', 'sin θ^2 = sin^2 θ', 'sin x y = y sin x', 'sin xy = x sin y', '1/cos θ tan θ = sin θ', 'sinθcosθ = cosθ', 'cos 2θ = 2 cos θ', 'sec θ - cos θ = sin θ', 'log 2x = 2 log x', 'tan 45 = 1']) ok(st([f]) === 'note', `a false or two-way trig line is a note: ${f} (${st([f])})`);
// independent review of the trig reading: a product after a division groups two ways; a name must be what happened
for (const f of ['1/cos θ tan θ = sin θ/cos^2 θ', '1/sin θ cos θ = cos θ/sin θ', '1/cos(θ) tan(θ) = sin(θ)/cos(θ)^2', '1/sin θ cos θ = 1/(sin θ cos θ)', '6/2(1+2) = 9', '6/2(1+2) = 1', '1/2(x+1) = (x+1)/2', '1/2x = x/2', '1/√2 x = x/√2', '1/√2 x = √2 x/2', '1/√x y = y/√x', '1/sqrt(2) x = x/sqrt(2)', '1/π x = x/π', '1/2π = π/2', '1/x√2 = √2/x', '1/π r^2 = r^2/π']) ok(st([f]) === 'note', `a product straight after a division is not read: ${f} (${st([f])})`);
for (const [f, bad] of [['cos^2 x tan x = sin x cos x tan x/tan x', /expanding|factoris/], ['sin x sin x = sin^2 x', /expanding|factoris/], ['sin x sin x = (sin x)^2', /expanding|factoris/]]) { const l = run([f]).lines[0]; ok(!bad.test(l.note || ''), `no step is named that did not happen: ${f} (${l.status}: ${l.note})`); }
ok(/Pythagorean/.test(run(['sin^2 x + cos^2 x + tan x = 1 + tan x']).lines[0].note || ''), 'sin² + cos² becoming 1 is named as the Pythagorean identity');
ok(st(['x/π = x/π', 'π r^2/π = r^2', '2π r/2 = π r']) === 'ok,ok,ok', 'π as the whole denominator or in a numerator is read');
ok(st(['x/√2 = √2 x/2', '1/√2 = √2/2']) === 'ok,ok', 'a root as the whole denominator is read');
ok(st(['sin θ/cos θ = tan θ', '(1 - cos^2 θ)/cos θ = sin^2 θ/cos θ', 'sin θ tan θ/(cos θ/tan θ) = tan^3 θ']) === 'ok,ok,ok', 'a plain quotient is still read');
ok(st(['LHS = 5', '= 6']) === 'note,note' && st(['Total: 3 + 4', '= 8']) === 'note,note' && st(['Total: 3 + 4', '= 7']) === 'note,ok', 'after a labelled line a `=` line is ticked when it agrees and never crossed');
ok(st(['(x+1)^2 = x^2 + 2x + 1']) === 'ok' && /expanding the brackets/.test(run(['(x+1)^2 = x^2 + 2x + 1']).lines[0].note) && /factorising/.test(run(['x^2 - 9 = (x-3)(x+3)']).lines[0].note), 'expanding and factorising are named');
// what the page itself defines (owner, 19 November: side by side with a competitor on his own pages)
{
  const slip = run(['e^(8k) = 3 so k = ln(3)/8', 'A = 12e^(4k) = 12e^(ln(3)/4)', 'A = 12 x 3^(1/4) grams']);
  ok(slip.lines.map(l => l.status).join() === 'ok,break,note' && /With k = ln\(3\)\/8 from above/.test(slip.diagnosis.message) && /20\.78/.test(slip.diagnosis.message), `a value carried from the line above is held to: the slip is crossed with the reason (${slip.lines.map(l => l.status)} · ${slip.diagnosis?.message})`);
  ok(st(['e^(8k) = 3 so k = ln(3)/8', 'A = 12e^(4k) = 12e^(ln(3)/2)', '= 12 sqrt(3)']) === 'ok,ok,ok', 'the same working without the slip is ticked on every line');
  const quot = run(['f(x) = (x^2 - 4x + 1)/e^x', 'u = x^2 - 4x + 1', 'v = e^x', "u' = 2x - 4", "v' = e^x", "f'(x) = (vu' - uv')/v^2", '-x^2 + 6x - 5 = 0', '(x - 5)(x - 1) = 0', 'x = 5', 'x = 1']);
  ok(quot.lines.map(l => l.status).join() === 'note,note,note,ok,ok,ok,note,ok,ok,ok', `definitions, their derivatives, the quotient rule line, an equation rearranged and its roots (${quot.lines.map(l => l.status)})`);
  ok(/derivative of u = x\^2 - 4x \+ 1/.test(quot.lines[3].note) && /same equation/.test(quot.lines[7].note) && /satisfies the equation/.test(quot.lines[8].note), 'each of those ticks says what was checked');
  ok(st(['u = x^2 - 4x + 1', "u' = 2x - 5"]) === 'note,break' && st(['y = sin(3x)', "y' = 3cos(3x)"]) === 'note,ok' && st(['y = sin(3x)', "y' = cos(3x)"]) === 'note,break', 'a wrong derivative of something the page defined is crossed');
  for (const page of [['y = sin(3x)', "y' = (3√(2))/2"], ['y = x^2', "y' = 6"], ['u = x^2', "u' = 2.0x + 0.1"], ['k = 2', 'k = 3', '2k = 6'], ['x = 2', 'x^2 = 9'], ['k = 2', 'A = k + 1 = 3.5'], ['a = 3', 'b = 4', 'c^2 = a^2 + b^2', 'c = 5'], ['x^2 = 9', 'x = 4'], ['2x + 1 = 7', '2x = 8'], ['n = 5', 'n! = 100 + 20'], ['t = 5', '3t + 5 = 21']]) ok(!/break/.test(st(page)), `not crossed: ${page.join(' | ')} (${st(page)})`);
  ok(st(['k = 2', 'A = 3k + 1 = 8']) === 'note,break' && st(['k = 2', '3k + 1 = 8']) === 'note,note' && st(['k = 2', '3k + 1 = 7']) === 'note,ok' && st(['k = 2', 'k = 3', '2k = 6']) === 'note,note,ok', 'a worked chain under a name is held to the latest value of a letter; two sides on their own may be a new equation and are never crossed');
  ok(st(['x^2 - 5x + 6 = 0', '(x - 2)(x - 3) = 0', 'x = 2', 'x = 3', 'x = 4']) === 'note,ok,ok,ok,note' && st(['2x + 1 = 7', '2x = 6', 'x = 3']) === 'note,ok,ok' && st(['2x + 1 = 7', '2x = 8', 'x = 4']) === 'note,note,ok', 'an equation rearranged and its roots are ticked; a wrong rearrangement or a non-root is a note, never a cross');
}
// independent review of the definitions pass
for (const page of [['2x = 4', 'x = 2 so 2x = 5'], ['x^2 - 4 = 0', 'x = 2 and x = 5'], ['2x = 4 so x = 2 so 3x = 7'], ['x^2 - 4 = 0', '(x-2)(x+2) = 0 so x = 3'], ['2x = 4', '4x = 8 so 1 = 2'], ['y = x^2', "y' = 2x so 1 = 2"], ['y = x^2', "y' = 2x ⇒ 2 + 2 = 5"], ['k = 2', '3k = 6 so k = 5'], ['2x = 4', 'x = 3 so x = 2'], ['2x = 4', 'x = 3 so 2x = 4 so x = 2'], ['2x = 4', '2x = 5 so 2x = 4 so x = 2'], ['2x = 4', 'x^2 = 5 so x^2 = 4 so x = 2']]) ok(!/ok/.test(st(page)), `a line is not ticked when a statement after the true one is left unjudged or false: ${page.join(' | ')} (${st(page)})`);
for (const page of [['(a) x = 3', '(b) y = 2x + 1 = 9'], ['a) t = 2', 'b) v = 3t^2 = 27'], ['(a) n = 5', '(b) S = n(n+1)/2 = 21'], ['Part a: k = 2', 'Part b: A = k + 1 = 5'], ['x = 3', 'x = 4 now', 'y = x + 1 = 5'], ['x = 3', 'Now let x = 4', 'y = x + 1 = 5'], ['r = 5', 'A = πr^2 = 25π', 'r = 3 (new)', 'A = πr^2 = 9π'], ['k = 2', '2 + 2 = 4', 'A = 3k + 1 = 8']]) ok(!/break/.test(st(page)), `a letter that may have a new value is never held to its old one: ${page.join(' | ')} (${st(page)})`);
ok(st(['x^2 - 4 = 0 so (x-2)(x+2) = 0', 'x = 2']) === 'ok,ok' && st(['2x = 4 so x = 2']) === 'ok', 'a premise before the ticked statement is allowed');
// e and π as numbers; a function value in front of a worked chain; a sign claim after it (owner, 19 November)
{
  const sign = run(['b)(ii) a(2) = (4 - 8 + 2)e^(-2) = 2e^(-2) > 0 so the displacement is a maximum']);
  ok(sign.lines[0].status === 'break' && /−0\.27/.test(sign.diagnosis.message), `the sign slip a competitor caught is crossed with both values (${sign.lines[0].status} · ${sign.diagnosis?.message})`);
  ok(st(['a(2) = (4 - 8 + 2)e^(-2) = -2e^(-2) < 0 so the displacement is a maximum']) === 'ok', 'the same line without the slip is ticked');
  ok(st(['a(2) = (4 - 8 + 2)e^(-2) = -2e^(-2) > 0 so it is a minimum']) === 'note', 'a true chain with a false sign claim after it is not ticked');
  ok(st(['e^0 = 1', 'π/2 + π/2 = π', '2π/2 = π', 'e^2 e^3 = e^5', 'f(2) = 3 + 4 = 7']) === 'ok,ok,ok,ok,ok', 'exact lines with e and π are ticked');
  ok(st(['e^2 e^3 = e^6']) === 'break' && st(['f(2) = 3 + 4 = 8']) === 'break', 'and crossed when the constant stands on every side, or under a function value');
  for (const f of ['e^2 = 4e', '3e = e + 6', 'e + 1 = 4 - e', '2e = e^2', 'e = e + 1', '2π = 6', 'e^2 = 7', 'e = 3', 'π = 22/7', '2e + 3e = 5e', '2e + 3e = 6e', '3e2 = 300', '2e-3 = 1', '1/2π = π/2', '1/2e = e/2', 'f(2) = 5', 'f(x) = 3 + 4 = 8', '2πr = 10π', 'e^x = 5', 'a(2) > 0 so max', 'x(2) = 2 + 2 = 5 > 0']) ok(st([f]) === 'note' || (f === 'x(2) = 2 + 2 = 5 > 0' && st([f]) === 'break'), `not judged: ${f} (${st([f])})`);
}
// logs in either base, a rewrite of a worked expression, and a tick that ends at a wrong answer (owner, 19 November:
// a handwriting test a competitor marked line by line)
{
  const page = run(['1/x + 1/y + 1/z = log 3 + log 2 + log 5', '= log (3 + 2 + 5) = log 10 = 1', 'so 10^1 = 10']);
  ok(page.lines.map(l => l.status).join() === 'note,break,note' && /whether log means base 10 or base e/.test(page.diagnosis.message), `the wrong log law is crossed with the reason (${page.lines.map(l => l.status)} · ${page.diagnosis?.message})`);
  ok(st(['log 3 + log 2 + log 5 = log 30', 'ln 8 = 3 ln 2', 'log 8 = 3 log 2', 'ln 3 + ln 4 = ln 12', 'log (2 × 5) = log 2 + log 5']) === 'ok,ok,ok,ok,ok', 'log laws true in either base are ticked');
  ok(st(['ln 8 = 2 ln 3']) === 'break' && st(['log 2 + log 5 = log 7']) === 'break' && st(['ln 3 + ln 4 = ln 7']) === 'break', 'and false in either base are crossed');
  for (const f of ['log 100 = 2', 'log 2 + log 5 = 1', 'ln 100 = 2', 'log 10 = 1', 'log e = 1', 'log x = 2', 'log 2x = log 2 + log x', 'log 3.0 + log 2 = log 7', 'log_2 8 = 4', 'log 3^2 = 2 log 3', 'log 3! = log 5', 'ln 2 = 0.69', '2 log 3 = log 6']) ok(st([f]) !== 'break' || f === '2 log 3 = log 6', `true in one base only, or not read one way: never crossed: ${f} (${st([f])})`);
  ok(st(['2 log 3 = log 6']) === 'break' && st(['2 log 3 = log 9']) === 'ok', 'a coefficient on a log is read');
  // independent review: a fraction after ln or log is ln(a/b) to the student
  for (const f of ['ln 1/2 = -ln 2', 'ln 1/3 = -ln 3', 'log 1/2 = -log 2', 'ln 3/2 = ln 3 - ln 2', 'ln 2/3 = ln 2 - ln 3', 'log 2/3 = log 2 - log 3', 'ln 9/2 = ln 3']) ok(st([f]) === 'note', `a fraction after a logarithm is not read: ${f} (${st([f])})`);
  ok(st(['ln 8 / ln 2 = 3', 'log 8 / log 2 = ln 8 / ln 2']) === 'ok,ok', 'a quotient of two logarithms is read');
  ok(st(['d = 3^2 + 4^2', '= 25', '= 5']) === 'note,ok,note' && st(['d = 3^2 + 4^2', '= 24', '= 5']) === 'note,break,note', 'only the first rewrite under a worked expression is held to it; a line after that is never crossed');
  ok(st(['t = 5', '= 20']) === 'note,note' && st(['v = 3(4) + 5', '= 20']) === 'note,break' && st(['v = 3(4) + 5', '= 17']) === 'note,ok' && st(['Total: 3 + 4', '= 8']) === 'note,note', 'a rewrite is held to a worked expression above it; a bare number or a labelled line above stays tick only');
}
// the owner's live page, 19 November 2026: a number from the margin read into the start of a true line
{
  const LIVE = ['8 y = 2x(4 - x).', 'Area = ∫_0^4 2x(4 - x) dx ;', '= 2∫_0^4 4x - x^2 dx', '= 2[4x^2/2 - x^3/3]_0^4', '= 2[2x^2 - x^3/3]_0^4', '16/3 = 2[2(4)^2 - 4^3/3] = 2[32 - 64/3]', '= 64/3'];
  const live = run(LIVE);
  ok(live.firstBreak === -1 && live.lines.map(l => l.status).join() === 'note,note,ok,ok,ok,ok,ok', `nothing on the page is crossed and every worked line is ticked (${live.lines.map(l => l.status)})`);
  ok(/64\/3/.test(live.lines[5].note) && /16\/3 in front of it was not read as part of the line/.test(live.lines[5].note) && !/21\.3/.test(JSON.stringify(live.lines)), `the tick says what was left out, and values are written as fractions (${live.lines[5].note})`);
  ok(st(['16/3 = 2[32 - 64/3]']) === 'note' && st(['14 = -20 - 6']) === 'note' && st(['7 = 5 + 1 = 6']) === 'note' && st(['5 = 2 + 3']) === 'ok', 'a bare number in front of worked expressions is never crossed; a true one is still ticked');
  ok(st(['-20 - 6 = 14']) === 'break' && st(['2 + 3 = 6']) === 'break' && st(['2[32 - 64/3] = 16/3']) === 'break', 'a worked expression set equal to a wrong value is still crossed');
  ok(st(['Area = 3 × 4', '= 12']) === 'note,ok' && st(['Volume = 2 + 2 = 5']) === 'break' && st(['Area = 12']) === 'note', 'a word in front of `=` is a label');
}
// what a page costs to check does not depend on what is written on it (CI's cost guards caught two earlier versions)
{
  const heavy = Array.from({ length: 16 }, () => 'sum(sum(sum(k;k;1;300);j;1;300);i;1;300) = 5');
  let at = Date.now();
  const hr = run(heavy);
  ok(Date.now() - at < 400 && hr.lines.every(l => l.status === 'note'), `sixteen lines of nested sums are checked in a bounded time and judged nowhere (${Date.now() - at} ms)`);
  at = Date.now();
  const QH = { answerType: 'numeric', answer: { value: 30 }, prompt: 'Find the value.', steps: [{ h: 'a', d: '$x = 30$' }, { h: 'b', d: '$y = 12$' }] };
  const he = stepEvidence(QH, '7', heavy.join('\n'), { correct: false });
  ok(Date.now() - at < 600 && he.partial === null, `and the same page through the server's evidence path, with the missing-steps pass (${Date.now() - at} ms)`);
}
// never crossed
for (const f of ['3x + 2 = 11', 'x = 3', 'n = 5', 'P(A) = 3', 'sin(30) = 2', 'log(100) = 3', 'ln 5 = 2', 'pi = 3', 'e^2 = 7', '50% of 80 = 30', '90° = 2', '5 cm + 3 cm = 9 cm', '2 1/2 = 5/2', '1 000 = 1000', '3 < 2', '4 ≠ 4', 'the answer is 5', '', '= 5', '6/0 = 3', '(((', '2 + = 4']) ok(!/break|ok/.test(st([f])), `not judged: "${f}" (${st([f])})`);
for (const f of ['0.5 + 0.25 = 0.8', '1000(1.05)^3 = 1157', '10/3 = 3.3', '22/7 ≈ 3', '√2 ≈ 1', '740^0.5 = 27']) ok(st([f]) === 'note', `a line that may be a rounding is not crossed: ${f}`);
ok(st(['0.5 + 0.25 = 0.75', '$500 × 1.05 = 525']) === 'ok,ok', 'exact decimals are ticked');
// another plausible reading of the handwriting makes it true: the reader may have slipped, not the student
for (const f of ['23 = 8', '32 + 42 = 25', '5 + 12 = 5.5', '102 = 100', '2 × 32 = 18', '12 + 12 = 1']) ok(st([f]) === 'note', `true under another reading, so not crossed: ${f} (${st([f])})`);
ok(st(['23 + 1 = 10', '102 = 99']) === 'break,note', 'false under every reading is still crossed');
ok(run(Array(25).fill('1 + 1 = 2')).lines.slice(20).every(l => l.status === 'note'), 'lines past the limit are not judged');

// ── Part 2 · sweep ───────────────────────────────────────────────────────────
function rngOf(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = rngOf(20261119);
const int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
let trueCrossed = 0, falseTicked = 0, trueTicked = 0, falseCrossed = 0, n = 0;
for (let k = 0; k < 4000; k++) {
  const a = int(-30, 30), b = int(1, 30), c = int(2, 9), op = ['+', '-', '*'][int(0, 2)];
  const lhs = `${a} ${op} ${b}`, v = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const forms = [[`${lhs} = ${v}`, v], [`${c}(${lhs}) = ${c * v}`, c * v], [`(${lhs})^2 = ${v * v}`, v * v], [`${lhs} = ${v * c}/${c}`, v]];
  for (const [line] of forms) { n++; const s = st([line]); if (s === 'break') { trueCrossed++; if (trueCrossed < 4) console.error('true crossed', line); } if (s === 'ok') trueTicked++; }
  const wrong = v + int(1, 9) * (rng() < 0.5 ? 1 : -1);
  for (const line of [`${lhs} = ${wrong}`, `${lhs} = ${v}`.replace(/= /, `= ${wrong} = `)]) { const s = st([line]); if (s === 'ok') { falseTicked++; if (falseTicked < 4) console.error('false ticked', line); } if (s === 'break') falseCrossed++; }
}
ok(trueCrossed === 0, `no true arithmetic line is crossed (${trueCrossed} of ${n})`);
ok(falseTicked === 0, `no false arithmetic line is ticked (${falseTicked})`);
ok(trueTicked === n, `every true line of the sweep is ticked (${trueTicked} of ${n})`);
ok(falseCrossed >= 6000, `most false lines are crossed; the rest read true another way and are notes (${falseCrossed} of 8000)`);

// ── Part 3 · wiring ──────────────────────────────────────────────────────────
const Q = { answerType: 'numeric', answer: { value: 72 }, prompt: 'Evaluate $\\int_{-2}^{4} 12x\\,dx$.', marks: 1 };
ok(stepMetaFor(Q) === null, 'the question has no Step Check meta');
let e = stepEvidence(Q, '72', PAGE.join('\n'), { correct: true });
ok(e.stepReport?.arithmetic === true && e.partial === null, 'the server attaches the arithmetic report and no partial credit');
e = stepEvidence(Q, '70', ['6(16 - 4) = 6 x 12', '= 70'].join('\n'), { correct: false });
ok(e.stepReport?.firstBreak === 1 && e.partial === null && !e.board, 'a wrong answer with true arithmetic above it earns no method mark');
ok(stepEvidence(Q, '72', '2\n2\n+\nx = 4', { correct: true }).stepReport === null, 'a page with no arithmetic on it gets no report at all');
ok(stepEvidence({ ...Q, answerType: 'mcq' }, '1', '2 + 2 = 5', { correct: false }).stepReport === null, 'multiple choice gets no report');
ok(stepEvidence({ ...Q, boardScheme: [{ marks: 1, text: 'x' }] }, '70', '2 + 2 = 4', { correct: false }).stepReport?.arithmetic !== true, 'a Board-scheme question is never given the arithmetic report');
const WITH = { answerType: 'numeric', answer: { value: 4 }, answerPrefix: 'x =', prompt: '$2x + 3 = 11$' };
ok(stepEvidence(WITH, '4', '2x = 8\nx = 4', { correct: true }).stepReport?.arithmetic !== true, 'a question with a Step Check keeps its own report');
{ // independent review, round 1: a milestone tick must not be worded as an arithmetic check
  const QM = { answerType: 'numeric', answer: { value: 99 }, prompt: 'Find the value.', steps: [{ h: 'a', d: '$p = 8$' }, { h: 'b', d: '$q = 4$' }] };
  const w = ['2+3 = 5', 'p = 8', 'q = 4'];
  const rep = stepEvidence(QM, '99', w.join('\n'), { correct: true }).stepReport;
  ok(rep.arithmetic === true && rep.lines.map(l => l.status).join() === 'ok,note,note', `no milestone tick is added to an arithmetic report (${rep.lines.map(l => l.status)})`);
  const evm = workingEvidence({ res: { stepReport: { ...rep, lines: rep.lines.map((l, i) => (i === 2 ? { ...l, status: 'ok', state: undefined } : l)) } }, submitted: { hasWorking: true, lines: w } });
  ok(evm.checked.join() === '1', `only arithmetic ticks are listed as arithmetic (${evm.checked})`);
}
{ // a tick must not sit on the line that ends at the student's own wrong answer
  const QW = { answerType: 'numeric', answer: { value: 30 }, prompt: 'Find the value.', steps: [] };
  const wrong = stepEvidence(QW, '10', '2 + 3 = 5\nso 10^1 = 10', { correct: false }).stepReport;
  ok(wrong.lines.map(l => l.status).join() === 'ok,note' && /was not accepted as the answer/.test(wrong.lines[1].note), `the line that ends at the wrong answer is a note that says so (${wrong.lines.map(l => l.status)})`);
  const right = stepEvidence(QW, '30', '5 × 6 = 30', { correct: true }).stepReport;
  ok(right.lines[0].status === 'ok', 'a line that ends at the right answer keeps its tick');
  // the typed answer is never parsed or evaluated for this note (CI's cost-of-marking guard caught an earlier version)
  let term = '170!'; while (term.length < 11800) term += '+170!';
  const at = Date.now();
  const huge = stepEvidence(QW, `sum(${term};k;1;10000)`, '2 + 3 = 5\nso 10^1 = 10', { correct: false }).stepReport;
  ok(Date.now() - at < 400 && huge.lines.map(l => l.status).join() === 'ok,ok', `a twelve-thousand-character answer costs nothing extra and changes no tick (${Date.now() - at} ms)`);
  ok(stepEvidence(QW, 'x = 10', 'so 10^1 = 10', { correct: false }).stepReport.lines[0].status === 'ok', 'an answer that is not a plain number is not read for this note');
  const other = stepEvidence(QW, '10', '2 + 3 = 5', { correct: false }).stepReport;
  ok(other.lines[0].status === 'ok', 'a true line that does not end at the wrong answer keeps its tick');
}
ok(fullyVerifiedWorking(run(['2 + 2 = 4'])) === false, 'an arithmetic report is no verified transition');

const lines = ['6(16 - 4) = 6 x 12', '= 72'];
const ev = workingEvidence({ res: { stepReport: run(lines) }, submitted: { hasWorking: true, lines } });
const copy = workingEvidenceCopy(ev, { correct: true });
ok(ev?.kind === 'arithmetic' && copy?.key === 'verdict.workingArithmetic', `the result card uses the arithmetic sentence (${JSON.stringify(ev)})`);
ok(!/consistent with the correct solution/.test(JSON.stringify(en[copy.key])) && /not checked/.test(JSON.stringify(en[copy.key])), 'which never says the lines are consistent with the solution');
ok(typeof en['aw.body.arithmetic'] === 'string' && typeof hi['aw.body.arithmetic'] === 'string' && typeof en['mp.why.arithmetic'] === 'string' && typeof hi['mp.why.arithmetic'] === 'string' && hi['verdict.workingArithmetic'], 'the wording exists in both languages');
const model = buildAnnotatedWorking({ stepReport: run(lines), lines });
ok(model?.cards?.length === 2 && model.cards.every(c => c.status === 'checked' && c.valueChain === 'arithmetic'), `the marked page shows them as arithmetic ticks (${JSON.stringify(model?.cards?.map(c => [c.status, c.valueChain]))})`);

console.log(`ARITHMETIC LINES: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — false arithmetic crossed, true arithmetic ticked as arithmetic only, no mark from it`);
if (fail) process.exit(1);
