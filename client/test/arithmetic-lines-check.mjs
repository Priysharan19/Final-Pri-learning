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
import { stepCheckArithmetic, exactForm } from '../src/engine/arithmeticLines.js';
import { questionFacts } from '../src/engine/questionFacts.js';
import { plainComment, dollarsBalanced, mathSpan, fragmentTex, derivativeMarkTex, typesetDerivativeMarks } from '../src/engine/commentTex.js';
import { fullyVerifiedWorking } from '../src/engine/misconceptions.js';
import { workingEvidence, workingEvidenceCopy } from '../src/components/attemptEvidence.js';
import { buildAnnotatedWorking } from '../src/components/annotatedWorkingModel.js';
import { stepEvidence, stepMetaFor } from '../../server/platform/markerOps.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
// Every comment any test page below produces, kept for the typesetting checks at the end.
const comments = new Set();
import { createHash } from 'node:crypto';
const verdictHash = createHash('sha256');
let reportsSeen = 0;
const keep = report => { reportsSeen++; verdictHash.update(JSON.stringify([report.firstBreak, (report.lines || []).map(l => [l.status, l.state])])); for (const l of report.lines || []) if (l.note) comments.add(l.note); if (report.diagnosis?.message) comments.add(report.diagnosis.message); return report; };
const run = lines => keep(stepCheckArithmetic(lines.join('\n')));
// A comment's maths is TeX between dollars; the assertions below read it as the plain sentence it stands for.
const plain = plainComment;
const st = lines => run(lines).lines.map(l => l.status).join();

// ── Part 1 · the rules ───────────────────────────────────────────────────────
// the owner's integral page, as the live reader returned it (with the lines of another question above it)
const PAGE = ['= |[-20 -6; -4 +12]|', '196 +64 / 260', '= |[14; 8]| = sqrt(14^2 + 8^2)', '= sqrt(260)', 'Hamilton paths', '∫_-2^4 12x dx = 12∫_-2^4 x dx.', '= [12x^2/2]_-2^4', '= [6x^2]_-2^4', '= 6[x^2]_-2^4', '= 6[4^2 - 2^2]', '= 6(16 - 4) = 6 x 12', 'Ans = 72'];
let r = run(PAGE);
ok(r.firstBreak === -1, `the owner's integral page: nothing crossed (${r.lines.map(l => l.status)})`);
ok(r.lines.slice(5).map(l => l.status).join() === 'ok,ok,ok,ok,ok,ok,ok', `every line of the integral is ticked: each is true as written (${r.lines.slice(5).map(l => l.status)})`);
ok(r.lines[10].state === 'arithmetic' && r.arithmetic === true && r.source === 'value-chain', 'a tick is an arithmetic tick and the report says so');
// (20 November 2026: numeric column vectors are now read, tick only. The magnitude line and `= sqrt(260)` under it are ticked;
//  the bare magnitude of a vector, the inline column sum and the words stay notes, and nothing on the page is crossed.)
// (21 November 2026: the same page is the owner's own slip, -20 - 6 written as 14 while the line above comes to √740. That line was ticked
//  before; it is now a warning NOTE, never a tick and never a cross, and the `= sqrt(260)` under it is no longer ticked from it.)
ok(r.lines.slice(0, 5).map(l => l.status).join() === 'note,note,note,note,note', `the vector slip is a note, not a tick (${r.lines.slice(0, 5).map(l => l.status)})`);
ok(r.lines[2].vectorWarning === true && /does not equal the earlier line/.test(plain(r.lines[2].note)) && /√260/.test(plain(r.lines[2].note)) && /√740/.test(plain(r.lines[2].note)), `the slip line says what to check (${r.lines[2].note})`);
ok(r.firstBreak === -1 && r.lines.every(l => l.status !== 'break'), 'the vector slip is never crossed');

r = run(['-20 - 6 = 14']);
ok(r.lines[0].status === 'break' && /−26/.test(plain(r.diagnosis.message)) && /14/.test(plain(r.diagnosis.message)), `false arithmetic is crossed with both values (${r.diagnosis?.message})`);
ok(st(['3 × 4', '= 12', '= 13']) === 'note,ok,break' && /line above comes to 12/.test(plain(run(['3 × 4', '= 12', '= 13']).diagnosis.message)), 'a continuation is held to the line above');
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
  ok(/reciprocal identity sec θ = 1\/cos θ/.test(plain(p.lines[2].note)) && /common denominator/.test(plain(p.lines[3].note)) && /Pythagorean identity/.test(plain(p.lines[4].note)) && /reciprocal identity cosec θ = 1\/sin θ/.test(plain(p.lines[6].note)), `each tick names the step it matches (${p.lines[2].note} | ${p.lines[6].note})`);
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
ok(st(['(x+1)^2 = x^2 + 2x + 1']) === 'ok' && /expanding brackets/.test(run(['(x+1)^2 = x^2 + 2x + 1']).lines[0].note) && /the difference of two squares/.test(run(['x^2 - 9 = (x-3)(x+3)']).lines[0].note), 'expanding and factorising are named');
// what the page itself defines (owner, 19 November: side by side with a competitor on his own pages)
{
  const slip = run(['e^(8k) = 3 so k = ln(3)/8', 'A = 12e^(4k) = 12e^(ln(3)/4)', 'A = 12 x 3^(1/4) grams']);
  ok(slip.lines.map(l => l.status).join() === 'ok,break,note' && /With k = ln\(3\)\/8 from above/.test(plain(slip.diagnosis.message)) && /12√3/.test(plain(slip.diagnosis.message)) && Math.abs(12 * Math.sqrt(3) - 20.7846) < 1e-4, `a value carried from the line above is held to: the slip is crossed with the reason (${slip.lines.map(l => l.status)} · ${slip.diagnosis?.message})`);
  ok(st(['e^(8k) = 3 so k = ln(3)/8', 'A = 12e^(4k) = 12e^(ln(3)/2)', '= 12 sqrt(3)']) === 'ok,ok,ok', 'the same working without the slip is ticked on every line');
  const quot = run(['f(x) = (x^2 - 4x + 1)/e^x', 'u = x^2 - 4x + 1', 'v = e^x', "u' = 2x - 4", "v' = e^x", "f'(x) = (vu' - uv')/v^2", '-x^2 + 6x - 5 = 0', '(x - 5)(x - 1) = 0', 'x = 5', 'x = 1']);
  ok(quot.lines.map(l => l.status).join() === 'note,note,note,ok,ok,ok,note,ok,ok,ok', `definitions, their derivatives, the quotient rule line, an equation rearranged and its roots (${quot.lines.map(l => l.status)})`);
  ok(/derivative of u = x\^2 - 4x \+ 1/.test(plain(quot.lines[3].note)) && /same equation/.test(plain(quot.lines[7].note)) && /satisfies the equation/.test(plain(quot.lines[8].note)), 'each of those ticks says what was checked');
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
  ok(sign.lines[0].status === 'break' && /−0\.27/.test(plain(sign.diagnosis.message)), `the sign slip a competitor caught is crossed with both values (${sign.lines[0].status} · ${sign.diagnosis?.message})`);
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
  ok(page.lines.map(l => l.status).join() === 'note,break,note' && /whether log means base 10 or base e/.test(plain(page.diagnosis.message)), `the wrong log law is crossed with the reason (${page.lines.map(l => l.status)} · ${page.diagnosis?.message})`);
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
  ok(/64\/3/.test(plain(live.lines[5].note)) && /16\/3 in front of it was not read as part of the line/.test(plain(live.lines[5].note)) && !/21\.3/.test(JSON.stringify(live.lines)), `the tick says what was left out, and values are written as fractions (${live.lines[5].note})`);
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
  const rep = stepEvidence(QM, '99', w.join('\n'), { correct: true }, { solutionMatch: false }).stepReport;
  ok(rep.arithmetic === true && rep.lines.map(l => l.status).join() === 'ok,note,note', `no milestone tick is added to an arithmetic report (${rep.lines.map(l => l.status)})`);
  // The worked-solution pass (solutionMatch.js) now recognises `p = 8` and `q = 4` as steps of the worked solution: a verified
  // tick that names the step, never an arithmetic one, and the page is then not an arithmetic-only report (each line has its state).
  const matched = stepEvidence(QM, '99', w.join('\n'), { correct: true }).stepReport;
  ok(matched.arithmetic !== true && matched.solutionMatched === true && matched.lines.map(l => `${l.status}:${l.state}`).join() === 'ok:arithmetic,ok:verified,ok:verified' && matched.lines.every(l => !l.milestone) && /step 1 of the worked solution/.test(matched.lines[1].note), `the worked-solution pass ticks p = 8 and q = 4 as verified steps (${matched.lines.map(l => `${l.status}:${l.state}`)})`);
  const evm = workingEvidence({ res: { stepReport: { ...rep, lines: rep.lines.map((l, i) => (i === 2 ? { ...l, status: 'ok', state: undefined } : l)) } }, submitted: { hasWorking: true, lines: w } });
  ok(evm.checked.join() === '1', `only arithmetic ticks are listed as arithmetic (${evm.checked})`);
}
{ // a tick must not sit on the line that ends at the student's own wrong answer
  const QW = { answerType: 'numeric', answer: { value: 30 }, prompt: 'Find the value.', steps: [] };
  const wrong = stepEvidence(QW, '10', '2 + 3 = 5\nso 10^1 = 10', { correct: false }).stepReport;
  ok(wrong.lines.map(l => l.status).join() === 'ok,note' && /was not accepted as the answer/.test(plain(wrong.lines[1].note)), `the line that ends at the wrong answer is a note that says so (${wrong.lines.map(l => l.status)})`);
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

// ── Part 4 · values in exact form, and comments as maths ─────────────────────
{
  const plainOf = v => exactForm(v).plain, texOf = v => exactForm(v).tex;
  const cases = [[21.333333333333332, '64/3', '\\frac{64}{3}'], [-Math.sqrt(3), '−√3', '-\\sqrt{3}'], [Math.sqrt(3) / 2, '√3/2', '\\frac{\\sqrt{3}}{2}'],
    [Math.PI / 3, 'π/3', '\\frac{\\pi}{3}'], [2 * Math.PI / 3, '2π/3', '\\frac{2\\pi}{3}'], [12 * Math.sqrt(3), '12√3', '12\\sqrt{3}'],
    [-1.7320508, '−1.7321', '-1.7321'], [20.78461, '20.7846', '20.7846'], [7, '7', '7'], [-0, '0', '0'], [0.5, '1/2', '\\frac{1}{2}'], [-5 / 12, '−5/12', '-\\frac{5}{12}'],
    [3 * Math.sqrt(2) / 2, '3√2/2', '\\frac{3\\sqrt{2}}{2}'], [Math.PI, 'π', '\\pi'], [-Math.PI / 2, '−π/2', '-\\frac{\\pi}{2}'], [Math.sqrt(2), '√2', '\\sqrt{2}'],
    [Math.sqrt(0.5), '√2/2', '\\frac{\\sqrt{2}}{2}'], [1.4142, '1.4142', '1.4142'], [Math.sqrt(53), '7.2801', '7.2801'], [1 / 13, '0.0769', '0.0769']];
  for (const [v, plainWant, texWant] of cases) ok(plainOf(v) === plainWant && texOf(v) === texWant, `exact form of ${v}: ${plainOf(v)} · ${texOf(v)}`);
  // an exact form is only ever used when it reproduces the value
  let wrongForm = 0;
  for (let k = 0; k < 4000; k++) {
    const v = (Math.sin(k * 12.9898) * 43758.5453 % 1) * 40 + (k % 7 ? 0 : 1) * k / 13;
    const f = exactForm(v).plain.replace('−', '-');
    const m = f.match(/^(-?)(\d*)(√(\d+)|π)?(?:\/(\d+))?$/);
    if (!m) continue;
    const num = m[3] ? (m[2] === '' ? 1 : +m[2]) * (m[3] === 'π' ? Math.PI : Math.sqrt(+m[4])) : +m[2];
    const got = (m[1] ? -1 : 1) * num / (m[5] ? +m[5] : 1);
    if (Math.abs(got - v) > 1e-4 * Math.max(1, Math.abs(v)) && !/\./.test(f)) wrongForm++;
  }
  ok(wrongForm === 0, `an exact form always reproduces its value (${wrongForm} wrong)`);
  // a line of constants says what the plain-number path says
  ok(plain(run(['2 + 3 = 5']).lines[0].note) === 'Both sides come to 5.', 'a line of constants: both sides come to the value');
  const con = run(['3 × 4', '= 12', '= 12']);
  ok(con.lines.every(l => !/for every value of the letters/.test(l.note || '')), 'no comment says "for every value of the letters" about constants');
  ok(/^This equals the line above: 12\.$/.test(plain(con.lines[2].note || '')) , `a continuation of constants: this equals the line above (${con.lines[2].note})`);
  const live = run(['16/3 = 2[2(4)^2 - 4^3/3]', '= 2[32 - 64/3]', '= 64/3']);
  ok(live.lines.some(l => /\$\\frac\{\d+\}\{\d+\}\$/.test(l.note || '')), `a fraction in a comment is a stacked fraction in TeX (${live.lines.map(l => l.note)})`);
  // every comment: dollars pair up, the TeX renders, and nothing is left as an engine's plain notation
  const all = [...comments];
  ok(all.length >= 30, `the test pages produced ${all.length} distinct comments`);
  ok(all.every(dollarsBalanced), `every comment has balanced dollars (${all.filter(c => !dollarsBalanced(c)).join(' | ')})`);
  const katex = (await import('katex')).default;
  let spans = 0, bad = [];
  for (const c of all) for (const m of c.matchAll(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g)) {
    spans++;
    try { katex.renderToString(m[1], { throwOnError: true, strict: 'error' }); } catch (e) { bad.push(`${m[1]} (${e.message})`); }
  }
  ok(spans >= 20 && bad.length === 0, `${spans} maths spans in comments all render in KaTeX (${bad.join(' | ')})`);
  ok(all.every(c => !/[—–]/.test(c)), 'no comment contains a dash');
}


// ── Part 5 · words only: the rule a tick names, and "This simplifies to" ─────────
// Owner, 19 November 2026 (a competitor's comments name the rule a step uses and say when an answer should be
// simplified). Both are WORDS added to a comment. No line is ticked, crossed or left as a note because of them.
{
  // 5.0 no verdict moved: every page the sweeps above ran (24497 of them, every one of their lines' status and state,
  // and where the first cross fell) hashes to the value recorded BEFORE these words were added. Re-recorded on 21 November 2026 (the owner's vector slip
  // is now a warning note, see PAGE above; hashing every page but that one gives the same digest on the old and the new engine, 4d0ecafa1c49).
  // Re-recorded on 20 November 2026:
  // exactly one of those pages moved, the owner's vector page (PAGE above: its magnitude line and `= sqrt(260)` are now ticked, tick only);
  // the other 24496 verdicts are those of the previous digest, found by running the previous engine over the same pages.
  ok(reportsSeen === 24497 && verdictHash.copy().digest('hex') === 'f2c42cfd16afc3e4e5cd6ab18e7dec53289d0d2e0f832cf84ffa05b7abce8ade', `no verdict changed across ${reportsSeen} pages (digest ${verdictHash.copy().digest('hex').slice(0, 12)})`);
  // (placed after 5.0 so the pages it runs are not part of the recorded digest)
  // independent review of the typesetting: a whole number with float noise is printed as that whole number
  ok(!/144/.test(JSON.stringify(run(['6[4^2 - 2^2] = 6(16 - 4)', '= 72']).lines)) && !/\\frac\{\d+\}\{2\}\$\./.test(run(['0.1 + 0.2 + 71.7 = 72']).lines[0].note || ''), 'no value is printed as an unreduced fraction of a whole number');

  // 5.1 the phrase for each rule is the working view's own label, lower-cased
  const { RULE_PHRASES } = await import('../src/engine/arithmeticLines.js');
  const { STEP_RULE_IDS } = await import('../src/engine/stepJustify.js');
  for (const id of STEP_RULE_IDS) {
    const key = 'aw.rule.' + id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    ok(typeof RULE_PHRASES[id] === 'string' && typeof en[key] === 'string' && RULE_PHRASES[id].replace(/^the /, '').toLowerCase() === en[key].toLowerCase(), `the phrase for ${id} is the label ${key}: "${RULE_PHRASES[id]}" / "${en[key]}"`);
  }

  // 5.2 A.1 a tick names the rule justifyStep proves for the two sides (or the older namer's fuller wording)
  const SAME = 'Both sides are the same expression, written two ways.';
  const named = [
    ['sec(x) = 1/cos(x)', 'the reciprocal identity sec x = 1/cos x'], ['cosec(x) = 1/sin(x)', 'the reciprocal identity cosec x = 1/sin x'],
    ['cot(x) = 1/tan(x)', 'the reciprocal identity cot x = 1/tan x'], ['tan(x) = sin(x)/cos(x)', 'the quotient identity'], ['cot(x) = cos(x)/sin(x)', 'the quotient identity'],
    ['sin(2x) = 2sin(x)cos(x)', 'the double-angle formula for sine'], ['sin(a + b) = sin(a)cos(b) + cos(a)sin(b)', 'the compound-angle formula for sine'],
    ['cos(a - b) = cos(a)cos(b) + sin(a)sin(b)', 'the compound-angle formula for cosine'], ['tan(a + b) = (tan(a) + tan(b))/(1 - tan(a)tan(b))', 'the compound-angle formula for tangent'],
    ['1/x + 1/y = (x + y)/(xy)', 'writing as one fraction over a common denominator'], ['(a + b)/c = a/c + b/c', 'splitting a fraction'],
    ['(a/b)/(c/d) = (a/b)(d/c)', 'dividing by a fraction (multiply by its reciprocal)'], ['(a/b)(c/d) = (ac)/(bd)', 'multiplying fractions'],
    ['((x + 3)(x - 3))/(x - 3) = x + 3', 'cancelling a common factor'], ['(6x)/(3y) = (2x)/y', 'cancelling a common factor'],
    ['2(x + 1) = 2x + 2', 'expanding brackets'], ['(x + 1)(x + 2) = x^2 + 3x + 2', 'expanding brackets'], ['x^2 + 3x = x(x + 3)', 'factorising'],
    ['x^2 + 5x + 6 = (x + 2)(x + 3)', 'factorising'], ['(x + 3)(x - 3) = x^2 - 9', 'the difference of two squares'],
    ['x^2 × x^3 = x^5', 'the index law: multiplying powers'], ['(x^2)^3 = x^6', 'the index law: power of a power'],
    ['tan(x)cos(x) = sin(x)', 'the quotient identity and cancelling a common factor']];
  for (const [line, name] of named) {
    const r = run([line]);
    ok(r.lines[0].status === 'ok' && plain(r.lines[0].note) === `${SAME} It matches ${name}.`, `names the step: ${line} (${plain(r.lines[0].note)})`);
  }
  // …and nothing is named where justifyStep and the older namer have nothing to say (the tick itself is unchanged)
  for (const line of ['x + 1 = 1 + x', 'x^2 - 1 = x^2 - 1', '2x = x + x', 'x + y = y + x', 'a(b + c) = a(b + c)']) {
    const r = run([line]);
    ok(r.lines.every(l => !/It matches/.test(l.note || '')), `no rule is named for ${line} (${r.lines.map(l => plain(l.note || ''))})`);
  }
  // a step whose two sides are not the line above is not named from it: the continuation below is held to ITS source
  { const r = run(['x^2 + 3x', '= x(x + 3)']);
    ok(r.lines[1].status === 'ok' && /It matches factorising\.$/.test(plain(r.lines[1].note)) && !/It matches/.test(r.lines[0].note || ''), `a continuation is named from the line above (${r.lines.map(l => plain(l.note))})`); }

  // 5.3 A.2 the rule behind a derivative tick, from the shape of the function the page defined
  const D = "This is the derivative of ";
  const derivs = [
    [['y = cos(2x)', "y' = -2sin(2x)"], 'y = cos(2x), by the chain rule with the inner derivative 2.'],
    [['y = (3x+1)^5', "y' = 15(3x+1)^4"], 'y = (3x + 1)^5, by the chain rule with the inner derivative 3.'],
    [['y = ln(2x+5)', "y' = 2/(2x+5)"], 'y = ln(2x + 5), by the chain rule with the inner derivative 2.'],
    [['y = sin(x/3)', "y' = cos(x/3)/3"], 'y = sin(x/3), by the chain rule with the inner derivative 1/3.'],
    [['y = (1-2x)^3', "y' = -6(1-2x)^2"], 'y = (1 - 2x)^3, by the chain rule with the inner derivative −2.'],
    [['y = (x/4+1)^2', "y' = (x/4+1)/2"], 'y = (x/4 + 1)^2, by the chain rule with the inner derivative 1/4.'],
    [['y = 3sin(2x)', "y' = 6cos(2x)"], 'y = 3sin(2x), by the chain rule with the inner derivative 2.'],
    [['y = e^(2x)', "y' = 2*e^(2x)"], 'y = e^(2x), by the chain rule with the inner derivative 2.'],
    [['y = e^(-3t^2)', "y' = -6t*e^(-3t^2)"], 'y = e^{-3t^2}, by the chain rule.'],
    [['y = (x^2+1)^3', "y' = 6x(x^2+1)^2"], 'y = (x^2 + 1)^3, by the chain rule.'],
    [['y = sin(x)^2', "y' = 2sin(x)cos(x)"], 'y = sin(x)^2, by the chain rule.'],
    [['y = cos(x+1)', "y' = -sin(x+1)"], 'y = cos(x + 1), by the chain rule.'],
    [['y = sin(x^2)', "y' = 2x cos(x^2)"], 'y = sin(x^2), by the chain rule.'],
    [['u = x^2 - 4x + 1', "u' = 2x - 4"], 'u = x^2 - 4x + 1, by the power rule.'],
    [['y = x^3 + 2x', "y' = 3x^2 + 2"], 'y = x^3 + 2x, by the power rule.'],
    [['y = 5x^4 - x^2', "y' = 20x^3 - 2x"], 'y = 5x^4 - x^2, by the power rule.'],
    [['y = 3x^2', "y' = 6x"], 'y = 3x^2, by the power rule.'],
    [['y = x^2', "y' = 2x"], 'y = x^2, by the power rule.'],
    [['y = -x^3', "y' = -3x^2"], 'y = -x^3, by the power rule.'],
    [['y = x^2/3', "y' = 2x/3"], 'y = \\frac{x^2}{3}, by the power rule.'],
    [['f(x) = x^3 - 3x', "f'(x) = 3x^2 - 3"], 'f = x^3 - 3x, by the power rule.'],
    [['y = x^2 sin(x)', "y' = 2x sin(x) + x^2 cos(x)"], 'y = x^2 sin(x), by the product rule.'],
    [['y = x e^(2x)', "y' = e^(2x) + 2x*e^(2x)"], 'y = xe^(2x), by the product rule.'],
    [['y = x^2 cos(x)', "y' = 2x cos(x) - x^2 sin(x)"], 'y = x^2 cos(x), by the product rule.'],
    [['y = (x+1)(x+2)', "y' = 2x + 3"], 'y = (x + 1)(x + 2), by the product rule.'],
    [['y = x/(x+1)', "y' = 1/(x+1)^2"], 'y = x/(x + 1), by the quotient rule.'],
    [['y = (x^2)/(x+3)', "y' = (x^2+6x)/(x+3)^2"], 'y = \\frac{x^2}{x + 3}, by the quotient rule.'],
    [['y = (x+2)/(x+5)', "y' = 3/(x+5)^2"], 'y = (x + 2)/(x + 5), by the quotient rule.']];
  for (const [page, tail] of derivs) {
    const r = run(page);
    ok(r.firstBreak === -1 && r.lines.map(l => l.status).join() === 'note,ok' && plain(r.lines[1].note) === D + tail, `names the rule: ${page.join(' ; ')} (${plain(r.lines[1].note || '')})`);
  }
  // the raw comment keeps the maths as TeX the client typesets
  ok(run(['y = cos(2x)', "y' = -2sin(2x)"]).lines[1].note === "This is the derivative of $y = \\cos\\left(2x\\right)$, by the chain rule with the inner derivative $2$.", `the chain-rule comment is TeX (${run(['y = cos(2x)', "y' = -2sin(2x)"]).lines[1].note})`);
  ok(run(['y = sin(x/3)', "y' = cos(x/3)/3"]).lines[1].note.endsWith('with the inner derivative $\\frac{1}{3}$.'), 'a fractional inner derivative is a stacked fraction');

  // 5.4 nothing is named: elementary derivatives, a constant times a function, sums, mixtures, three factors, a constant
  // numerator, implicit functions, a definition that is not the source, a page that moved to a new part
  const none = [
    [['y = sin(x)', "y' = cos(x)"], 'y = sin(x).'], [['y = cos(x)', "y' = -sin(x)"], 'y = cos(x).'], [['y = e^x', "y' = e^x"], 'y = e^x.'],
    [['y = 2^x', "y' = 2^x*ln(2)"], 'y = 2^x.'], [['y = 1/x', "y' = -1/x^2"], 'y = 1/x.'], [['y = 1/(x+5)', "y' = -1/(x+5)^2"], 'y = 1/(x + 5).'],
    [['y = x^2 + sin(x)', "y' = 2x + cos(x)"], 'y = x^2 + sin(x).'], [['y = sin(x) + cos(x)', "y' = cos(x) - sin(x)"], 'y = sin(x) + cos(x).'],
    [['y = 3x', "y' = 3"], 'y = 3x.'], [['y = 3x + 2', "y' = 3"], 'y = 3x + 2.'], [['y = x', "y' = 1"], 'y = x.'],
    [['y = x^2 + (3x+1)^5', "y' = 2x + 15(3x+1)^4"], 'y = x^2 + (3x + 1)^5.'], [['y = x sin(x) cos(x)', "y' = sin(x)cos(x) + x cos(x)^2 - x sin(x)^2"], 'y = xsin(x)cos(x).'],
    [['y = 3sin(x)', "y' = 3cos(x)"], 'y = 3sin(x).'], [['y = x^2 e^x sin(x)', "y' = 2x e^x sin(x) + x^2 e^x sin(x) + x^2 e^x cos(x)"], 'y = x^2e^xsin(x).']];
  for (const [page, tail] of none) {
    const r = run(page);
    ok(r.lines[1].status === 'ok' && plain(r.lines[1].note) === D + tail && !/rule|inner derivative/.test(r.lines[1].note), `names nothing: ${page.join(' ; ')} (${plain(r.lines[1].note || '')})`);
  }
  // no tick, so no rule: a definition by another letter, a different part, a wrong claim, an implicit relation, a pair the engine does not read
  const unticked = [
    ['u = x^2 + 1', 'y = u^3', "y' = 6x(x^2+1)^2"], ['u = 2x + 1', 'y = u^3', "y' = 6(2x+1)^2"], ['y = x^2', "z' = 2x"], ['y = x^2', "y' = 3x^2"], ['y = x^2', "y' = 2x + 1"],
    ['y = cos(2x)', '(b) Find y\'', "y' = -2sin(2x)"], ['x^2 + y^2 = 25', '2x + 2y y\' = 0'], ['x^2 + y^2 = 25', "y' = -x/y"], ['y = x^x', "y' = x^x(ln(x)+1)"],
    ['y = sqrt(x)', "y' = 1/(2sqrt(x))"], ['y = 5', "y' = 0"]];
  for (const page of unticked) {
    const r = run(page);
    ok(r.lines.every(l => !/rule|inner derivative|It matches/.test(plain(l.note || ''))), `no rule where nothing is ticked: ${page.join(' ; ')} (${r.lines.map(l => l.status)})`);
  }
  // a function defined with another letter's value put in is not named (the page shows u^3, not the expansion)
  ok(!/rule/.test(plain(run(['u = x^2 + 1', 'y = u^3', "y' = 6x(x^2+1)^2"]).lines.map(l => l.note).join(' '))), 'y = u^3 is not named from the function it expands to');

  // 5.5 A.3 a supplementary or exact-value step. justifyStep names neither, so this module names them itself (owner, 19 November
  // 2026), and only for a line already proved true, in the direction the step went (see "Degrees, and the name of a trigonometric step" in the engine). A step between two
  // functions that are not one of these (cos(π/3) = sin(π/6), a cofunction) is named nothing.
  for (const page of [['cos(π/3) = sin(π/6)']]) {
    const r = run(page);
    ok(r.lines.every(l => !/It matches/.test(l.note || '')), `no supplementary or exact-value rule is invented: ${page[0]}`);
  }

  // 5.6 B.1 "This simplifies to": the last ticked line of a page with no cross, when its last side is a worked expression
  const simp = [
    [['16/3 = 2[2(4)^2 - 4^3/3]', '= 2[32 - 64/3]'], '64/3'], [['12 × 6 = 6 × 12'], '72'], [['-√3 = -2 × √3/2'], '−√3'], [['12√3 = 12e^(ln(3)/2)'], '12√3'],
    [['3/2 = 6/4'], '3/2'], [['6/4 = 6/4'], '3/2'], [['2 + 3 + 4 = 9 = 3 × 3'], '9'], [['6√3 = 2√3 × 3'], '6√3'], [['2√3 = √12'], '2√3'], [['100 - 36 = 64 = 2^6'], '64'],
    [['1/2 + 1/3 = 5/6 = 10/12'], '5/6'], [['√2 × √2 = 2 × 1'], '2'], [['3 × (4 + 5) = 3 × 9'], '27'], [['72 = 6 × 12', 'x = 3'], '72'], [['-3/4 = -6/8'], '−3/4'],
    [['2/3 + 1/3 = 3/3'], '1'], [['5! = 5 × 24'], '120'], [['4 × 5 = 20', '= 2 × 10'], '20'], [['-12/8 = -3/2 = -12/8'], '−3/2'], [['√2/2 = 1/√2'], '√2/2']];
  for (const [page, x] of simp) {
    const r = run(page), ticked = r.lines.map((l, k) => (l.status === 'ok' ? k : -1)).filter(k => k >= 0), last = r.lines[ticked[ticked.length - 1]];
    ok(r.firstBreak === -1 && plain(last.note).endsWith(' Give the final answer in that simplified form.') && plain(last.note).includes(x), `the value ${x} is stated once, then the answer is asked for in that form: ${page.join(' ; ')} (${plain(last ? last.note : '')})`);
    ok(r.lines.filter(l => /Give the final answer/.test(l.note || '')).length === 1 && r.lines.every(l => !/simplifies/.test(l.note || '')), `only the last ticked line is asked to simplify: ${page.join(' ; ')}`);
  }
  // the TeX is the exact form the formatter gives
  ok(run(['16/3 = 2[2(4)^2 - 4^3/3]', '= 2[32 - 64/3]']).lines[1].note === 'This equals the line above: $\\frac{64}{3}$. Give the final answer in that simplified form.', 'a fraction is stated once, stacked, then the prompt');
  ok(run(['12√3 = 12e^(ln(3)/2)']).lines[0].note === 'Both sides come to $12\\sqrt{3}$. Give the final answer in that simplified form.', 'a surd is stated once, typeset, then the prompt');
  ok(run(['6/4 = 6/4']).lines[0].note === 'Both sides come to $\\frac{3}{2}$. Give the final answer in that simplified form.', 'a fraction not in lowest terms is stated reduced, then the prompt');
  // already one value, a decimal, only a rounded decimal available, an earlier line, a page with a cross, nothing ticked: no sentence
  const single = [['2 + 3 = 5'], ['3 × 4 = 12'], ['6/4 = 3/2'], ['√12 = 2√3'], ['2√3 × 3 = 6√3'], ['3/2 = 1.5'], ['-3/4 = -0.75'], ['196 + 64 = 260', '= 260'], ['2√65 = √(4 × 65)'],
    ['5! = 120'], ['-3^2 = -9'], ['(-3)^2 = 9'], ['1/2 + 1/3 = 5/6'], ['72 = 6 × 12', '= 72'], ['12 × 6 = 6 × 12 = 73'], ['2 + 2 = 5', '3 + 3 = 6'], ['√3/2 = √3/2'], ['7 = 7'],
    ['3 × 4 = 12', '= 12'], ['2π = 2π'], ['-√3/2 = -√3/2'], ['6/3 = 2'], ['10/4 = 5/2'], ['sqrt(3)/2 = (√3)/2'], ['e^2 = e^2'], ['20.78 = 20.78']];
  for (const page of single) {
    const r = run(page);
    ok(r.lines.every(l => !/simplifies|Give the final answer/.test(l.note || '')), `no "simplify" sentence: ${page.join(' ; ')} (${r.lines.map(l => plain(l.note || ''))})`);
  }
  // an earlier unsimplified line does not get it when a later line is ticked
  { const r = run(['72 = 6 × 12', '= 72']); ok(r.lines[0].status === 'ok' && !/simplifies/.test(r.lines[0].note), 'only the LAST ticked line speaks'); }
  // the exact form of a value that arithmetic reached with rounding noise is the whole number
  ok(exactForm(Math.sqrt(2) * Math.sqrt(2)).plain === '2' && exactForm(2.0000000000000004).tex === '2' && exactForm(-3.0000000000000004).plain === '−3', 'rounding noise on a whole number is that whole number');
  // 5.7 a name that states a DIRECTION is used only when the two sides show it (independent review: a difference of two
  // squares written as a product was said to be "expanding brackets"). Both sides bracketed, neither, or a mixed move
  // (partial expansion, regrouping, completing the square either way) are named nothing; every comment below is exact.
  const BOTH = 'Both sides are the same expression, written two ways.';
  const direction = [
    ["(x+1)^2 - (x-1)^2 = ((x+1)-(x-1))((x+1)+(x-1))", "Both sides are the same expression, written two ways."],
    ["x^2 - 4 = (x-2)^2 + 4x - 8", "Both sides are the same expression, written two ways."],
    ["x^2 + 6x + 5 = (x+3)^2 - 4", "Both sides are the same expression, written two ways."],
    ["(x+3)^2 - 4 = (x+1)(x+5)", "Both sides are the same expression, written two ways."],
    ["2(x+1) + 3(x+1) = 5(x+1)", "Both sides are the same expression, written two ways."],
    ["(x+1)(x+2) + (x+1) = (x+1)(x+3)", "Both sides are the same expression, written two ways."],
    ["x(x+1) = x^2 + x", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["x^2 + x = x(x+1)", "Both sides are the same expression, written two ways. It matches factorising."],
    ["(x+1)^2 = (x+1)(x+1)", "Both sides are the same expression, written two ways."],
    ["(x+1)(x+1) = (x+1)^2", "Both sides are the same expression, written two ways. It matches the index law: multiplying powers."],
    ["(x+2)(x+3) = (x+3)(x+2)", "Both sides are the same expression, written two ways."],
    ["2(x+1) = 2(1+x)", "Both sides are the same expression, written two ways."],
    ["(x+1)^2 = (1+x)^2", "Both sides are the same expression, written two ways."],
    ["(x+1)^2 = x^2 + 2x + 1", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["x^2 + 2x + 1 = (x+1)^2", "Both sides are the same expression, written two ways. It matches factorising."],
    ["x^2 - 6x + 9 = (x-3)^2", "Both sides are the same expression, written two ways. It matches factorising."],
    ["(x-3)^2 = x^2 - 6x + 9", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["(2x+1)(x-1) = 2x^2 - x - 1", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["2x^2 - x - 1 = (2x+1)(x-1)", "Both sides are the same expression, written two ways. It matches factorising."],
    ["x^2 + 2x + 1 = x^2 + 2x + 1", "Both sides are the same expression, written two ways."],
    ["x + x = 2x", "Both sides are the same expression, written two ways."],
    ["2x = x + x", "Both sides are the same expression, written two ways."],
    ["3(x+2) - 3x = 6", "Both sides come to 6."],
    ["x^2 - 1 = (x-1)(x+1)", "Both sides are the same expression, written two ways. It matches the difference of two squares."],
    ["(x-1)(x+1) = x^2 - 1", "Both sides are the same expression, written two ways. It matches the difference of two squares."],
    ["x^4 - 1 = (x^2-1)(x^2+1)", "Both sides are the same expression, written two ways. It matches the difference of two squares."],
    ["(x^2-1)(x^2+1) = x^4 - 1", "Both sides are the same expression, written two ways. It matches the difference of two squares."],
    ["(x+1)^2 - 1 = x^2 + 2x", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["x^2 + 2x = (x+1)^2 - 1", "Both sides are the same expression, written two ways."],
    ["(x+1)(x+2)(x+3) = (x^2+3x+2)(x+3)", "Both sides are the same expression, written two ways."],
    ["(x^2+3x+2)(x+3) = (x+1)(x+2)(x+3)", "Both sides are the same expression, written two ways."],
    ["(x+1)^2 + (x-1)^2 = 2x^2 + 2", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["2x^2 + 2 = (x+1)^2 + (x-1)^2", "Both sides are the same expression, written two ways."],
    ["(a+b)^2 - (a-b)^2 = 4ab", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["4ab = (a+b)^2 - (a-b)^2", "Both sides are the same expression, written two ways."],
    ["(a+b)(a-b) = a^2 - b^2", "Both sides are the same expression, written two ways. It matches the difference of two squares."],
    ["a^2 - b^2 = (a+b)(a-b)", "Both sides are the same expression, written two ways. It matches the difference of two squares."],
    ["(x+1)^2 - (x+2)^2 = -2x - 3", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["(x+1)^3 = x^3 + 3x^2 + 3x + 1", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["x^3 + 3x^2 + 3x + 1 = (x+1)^3", "Both sides are the same expression, written two ways. It matches factorising."],
    ["x(x+1) + x = x(x+2)", "Both sides are the same expression, written two ways."],
    ["x(x+2) = x(x+1) + x", "Both sides are the same expression, written two ways."],
    ["x^2 + x + x + 1 = x(x+1) + (x+1)", "Both sides are the same expression, written two ways."],
    ["x(x+1) + (x+1) = (x+1)^2", "Both sides are the same expression, written two ways."],
    ["(x+1)^2 = x(x+1) + (x+1)", "Both sides are the same expression, written two ways."],
    ["3(x+1) = 3x + 3", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["3x + 3 = 3(x+1)", "Both sides are the same expression, written two ways. It matches factorising."],
    ["(2(x+1)) = 2x + 2", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["x(x-1) - (x-1) = (x-1)^2", "Both sides are the same expression, written two ways."],
    ["(x-1)^2 = x^2 - 2x + 1", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["x^2 - 5x + 6 = (x-2)(x-3)", "Both sides are the same expression, written two ways. It matches factorising."],
    ["(x-2)(x-3) = x^2 - 5x + 6", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["(x+5)(x-5) + 25 = x^2", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["x^2 = (x+5)(x-5) + 25", "Both sides are the same expression, written two ways."],
    ["x^2 - 9 + 9 = x^2", "Both sides are the same expression, written two ways."],
    ["(x+1)^2 - x^2 = 2x + 1", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["2x + 1 = (x+1)^2 - x^2", "Both sides are the same expression, written two ways."],
    ["(x+1)^2 - (x-1)^2 = 4x", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["4x = (x+1)^2 - (x-1)^2", "Both sides are the same expression, written two ways."],
    ["(x+2)^2 - 4 = x^2 + 4x", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["x^2 + 4x = (x+2)^2 - 4", "Both sides are the same expression, written two ways."],
    ["x^2 + 4x = x(x+4)", "Both sides are the same expression, written two ways. It matches factorising."],
    ["x(x+4) = x^2 + 4x", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["(x+1)/(x+1) = 1", "Both sides come to 1."],
    ["(x^2-1)/(x-1) = x+1", "Both sides are the same expression, written two ways."],
    ["2(x+1) + 3(x+1) = 5x + 5", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["5x + 5 = 2(x+1) + 3(x+1)", "Both sides are the same expression, written two ways."],
    ["(x+1)(x-1) + 1 = x^2", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["x^2 = (x+1)(x-1) + 1", "Both sides are the same expression, written two ways."],
    ["(x+3)^2 = (x+3)(x+3)", "Both sides are the same expression, written two ways."],
    ["x^2 + 7x + 12 = (x+3)(x+4)", "Both sides are the same expression, written two ways. It matches factorising."],
    ["(x+3)(x+4) = x^2 + 7x + 12", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["(2x)^2 = 4x^2", "Both sides are the same expression, written two ways."],
    ["4x^2 = (2x)^2", "Both sides are the same expression, written two ways."],
    ["(x-1)(x+1) - (x^2 - 1) = 0", "Both sides come to 0."],
    ["(x+2)^2 - (x-2)^2 = 8x", "Both sides are the same expression, written two ways. It matches expanding brackets."],
    ["8x = (x+2)^2 - (x-2)^2", "Both sides are the same expression, written two ways."],
    ["(x+2)^2 - (x-2)^2 = ((x+2)-(x-2))((x+2)+(x-2))", "Both sides are the same expression, written two ways."],
    ["((x+2)-(x-2))((x+2)+(x-2)) = (x+2)^2 - (x-2)^2", "Both sides are the same expression, written two ways."],
    ["x^2 + 1 - 1 = x^2", "Both sides are the same expression, written two ways."],
    ["(x+1)^2 - (x+1) = (x+1)x", "Both sides are the same expression, written two ways."]];
  for (const [line, want] of direction) {
    const r = run([line]);
    ok(r.lines[0].status === 'ok' && plain(r.lines[0].note) === want, `direction: ${line} (${plain(r.lines[0].note || '')})`);
  }
  ok(direction.length >= 60, `${direction.length} direction pairs`);
  ok(direction.filter(([, w]) => w === BOTH).length >= 25 && !direction.some(([l, w]) => /^\(x\+1\)\^2 - \(x-1\)\^2 = \(\(/.test(l) && /expanding/.test(w)), 'the reviewer\'s page is named nothing');
  // a continuation is held to the same direction
  { const r = run(['x(x+1)', '= x^2 + x', '= x(x+1)']); ok(/expanding brackets\.$/.test(plain(r.lines[1].note)) && /factorising\.$/.test(plain(r.lines[2].note)), `a chain: expanded then factorised (${r.lines.map(l => plain(l.note || ''))})`); }
  // the value the comment has just stated is not stated twice: the student is asked for the answer in that form
  { const r = run(['12', '= 24/2']); ok(r.lines[1].status === 'ok' && plain(r.lines[1].note) === 'This equals the line above: 12. Give the final answer in that simplified form.', `= 24/2 under = 12 (${r.lines.map(l => plain(l.note || ''))})`); }
  ok(plain(run(['2 = 4/2']).lines[0].note) === 'Both sides come to 2. Give the final answer in that simplified form.', '2 = 4/2 states the value once, then the prompt');

  // every comment this part produced typesets: dollars pair up, the TeX renders, no dash
  { const katex = (await import('katex')).default; const mine = [...comments].filter(c => /simplifies|rule|It matches/.test(c));
    let spans = 0, bad = [];
    for (const c of mine) for (const m of c.matchAll(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g)) { spans++; try { katex.renderToString(m[1], { throwOnError: true, strict: 'error' }); } catch (e) { bad.push(`${m[1]} (${e.message})`); } }
    ok(mine.length >= 60 && mine.every(dollarsBalanced) && mine.every(c => !/[—–]/.test(c) && !/\byou\b/i.test(c)) && spans >= 20 && bad.length === 0, `${mine.length} new comments, ${spans} maths spans: balanced, render, no dash, no "you" (${bad.join(' | ')})`); }
}

// ── Part 6 · e^x(…), degrees and trig step names, derivative marks, like terms ───────────────────────────────────────
// Owner, 19 November 2026. A true line is never crossed, a wrong line is never ticked, and when unsure a line is a note.
{
  const one = line => run([line]).lines[0];
  const noteOf = line => plain(one(line).note || '');
  const katex = (await import('katex')).default;
  const renders = text => [...text.matchAll(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g)].every(m => { try { katex.renderToString(m[1], { throwOnError: true, strict: 'error' }); return true; } catch { return false; } });

  // 6.1 e^x(…): the exponent is one letter, a number or a bracketed group and a bracket follows: e^x TIMES the bracket
  const product = ['e^x(2x-4) = 2xe^x - 4e^x', 'e^x(2x - 4) = 2x e^x - 4e^x', 'e^x(x + 1) = xe^x + e^x', 'e^(2x)(x+1) = xe^(2x) + e^(2x)', '2e^x(x - 1) = 2xe^x - 2e^x',
    'e^-x(1 - x) = e^-x - xe^-x', 'e^2(x + 1) = xe^2 + e^2', 'e^x(3) = 3e^x', "y' = e^x(x^2) + e^x(2x) = e^x(x^2 + 2x)", "y' = e^x(x^2) + e^x(2x) = e^x(x^2 + 2x) = xe^x(x + 2)"];
  for (const f of product) ok(one(f).status === 'ok' && one(f).state === 'arithmetic', `e^x times the bracket is ticked: ${f} (${one(f).status})`);
  ok(noteOf('e^x(2x-4) = 2xe^x - 4e^x') === 'Both sides are the same expression, written two ways. It matches expanding brackets.', 'e^x(2x-4) is named expanding brackets');
  ok(noteOf("y' = e^x(x^2) + e^x(2x) = e^x(x^2 + 2x)") === 'Both sides are the same expression, written two ways. It matches factorising.', "a derivative mark in front of the chain labels it, and the chain is judged");
  // false under the product reading: a note, never a cross, never a tick
  for (const f of ['e^x(2x-4) = 2xe^x + 4e^x', 'e^x(x+1) = xe^x + 1', '2e^x(x - 1) = 2xe^x - 1', 'e^-x(1 - x) = e^-x + xe^-x', 'e^(2x)(x+1) = xe^(2x) - e^(2x)', 'e^x(3) = e^(3x)', "y' = e^x(x^2) + e^x(2x) = e^x(x^2 + 2x) + 1"]) {
    ok(one(f).status === 'note', `false under the product reading is a note, never crossed or ticked: ${f} (${one(f).status})`);
  }
  // ambiguous: e^2x is e^(2x) or e^2 times x. True under one reading, false under the other: never crossed, never ticked
  for (const f of ['e^2x = 2e^x', 'e^2x = e^(2x)', 'e^2x = xe^2', 'e^3x = xe^3', 'e^2x(x+1) = 2xe^x + e^x']) ok(one(f).status === 'note', `e^2x is not judged: ${f} (${one(f).status})`);
  // numbers only: e^2(3) is e^2 times 3, or e^(2·3). A line true under either reading is never crossed
  ok(one('e^2(3) = e^6').status === 'note' && one('e^2(3) = 3e^2').status === 'ok', 'e^2(3) = e^6 is a note (true if the exponent takes the bracket); e^2(3) = 3e^2 is ticked');
  ok(one('e^2(3) = e^2(4)').status === 'break' && one('e^1(2) = 2e').status === 'ok', 'a line false under both readings is crossed (e^2(3) = e^2(4)); a true one is ticked');
  ok(one('e^(1+1)(3) = e^6').status === 'note', 'a bracketed exponent followed by a bracket: true under the other reading, so a note');
  // a derivative mark in front of a single equation is still not a chain: nothing is judged
  ok(one("y' = 2x").status === 'note' && one("f'(x) = 2x = 2x").status === 'ok' && one("dy/dx = 2x(x+1) = 2x^2 + 2x").status === 'ok', 'a derivative label is set aside only in front of a worked chain');
  ok(one("y' = 2x = 3x").status === 'note', 'a derivative label does not make a false chain true');

  // 6.2 degrees: read as radians, tick only
  const degreeTicks = [['sin 30° = 1/2', 'Both sides come to 1/2. It matches an exact value.'], ['sin 30° = 0.5', null], ['cos 60° = 1/2', 'Both sides come to 1/2. It matches an exact value.'], ['tan 60° = √3', 'Both sides come to √3. It matches an exact value.'],
    ['sin 45° = 1/√2', 'Both sides come to √2/2. It matches an exact value. Give the final answer in that simplified form.'], ['sin 150° = sin 30°', 'Both sides come to 1/2. It matches a related angle. Give the final answer in that simplified form.'],
    ['30° = π/6', 'Both sides come to π/6.'], ['sin(180° - θ) = sin θ', 'Both sides are the same expression, written two ways. It matches a related angle.']];
  for (const [f, want] of degreeTicks) ok(one(f).status === 'ok' && (want === null || noteOf(f) === want), `degrees: ${f} (${noteOf(f)})`);
  for (const f of ['sin 31° = 1/2', 'cos 150° = cos 30°', 'tan 45° = 2', '30° + 60° = 80°', 'sin 30° = √3', 'x + 30° = 30° + x', 'sin 30° = 1/2 = cos 30°', 'x° = 30°', 'sin 90° = 1/2']) ok(one(f).status === 'note', `a false or unread degree line is a note, never crossed: ${f} (${one(f).status})`);
  ok(run(['sin 30° = 1/2', 'cos 60° = 1/2', 'tan 45° = 1']).firstBreak === -1 && run(['sin 30° = 1/3']).firstBreak === -1, 'a degree line never starts a break');

  // 6.3 the name of a step: "a related angle" and "an exact value"
  const named = [['sin(180° - θ) = sin θ', 'a related angle'], ['sin(180° - θ) = sin(θ)', 'a related angle'], ['sin(π - x) = sin x', 'a related angle'], ['cos(π - x) = -cos x', 'a related angle'], ['cos(π - x) = -cos(x)', 'a related angle'], ['tan(π + x) = tan x', 'a related angle'],
    ['sin(π + x) = -sin x', 'a related angle'], ['sin(2π - x) = -sin x', 'a related angle'], ['sin 150° = sin 30°', 'a related angle'], ['sin 210° = -sin 30°', 'a related angle'], ['cos 300° = cos 60°', 'a related angle'], ['cos(5π/6) = -cos(π/6)', 'a related angle'],
    ['sin 30° = 1/2', 'an exact value'], ['cos(π/4) = 1/√2', 'an exact value'], ['tan 60° = √3', 'an exact value'], ['sin(π/6) = 1/2', 'an exact value'], ['cos 0° = 1', 'an exact value'], ['sin 90° = 1', 'an exact value'], ['tan 45° = 1', 'an exact value'], ['cos(π/3) = 1/2', 'an exact value']];
  for (const [f, name] of named) ok(one(f).status === 'ok' && noteOf(f).includes(`It matches ${name}.`), `named ${name}: ${f} (${noteOf(f)})`);
  // near misses: ticked where true, but named nothing (a name is never claimed for a step that did not happen)
  const unnamed = ['sin θ = sin(180° - θ)', 'sin x = sin(π - x)', '1/2 = sin 30°', '1/√2 = cos(π/4)', 'sin 30° = cos 60°', 'cos(π/3) = sin(π/6)', 'sin(x + 360°) = sin x', 'sin(x + 2π) = sin x', 'sin(θ - 180°) = -sin θ', 'sin 150° = 1/2',
    'sin 30° = sin 30°', 'sin(π/5) = sin(4π/5)', 'sin 30° + cos 60° = 1', 'sin(2x) = 2sin(x)cos(x)'];
  for (const f of unnamed) { const r = one(f); ok(!/a related angle|an exact value/.test(noteOf(f)), `not named: ${f} (${noteOf(f)})`); if (/^sin 150° = 1\/2|^sin 30° = cos|^cos\(π\/3\) = sin/.test(f)) ok(r.status === 'ok', `still ticked: ${f}`); }
  ok(noteOf('sin(2x) = 2sin(x)cos(x)').includes('double-angle'), 'the double-angle step keeps its own name');
  for (const f of ['cos(π - x) = cos x', 'sin(π - x) = -sin x', 'cos 150° = cos 30°', 'sin 30° = 1/3', 'tan(2π + x) = -tan x']) ok(one(f).status === 'note' && !/It matches/.test(noteOf(f)), `a false step is never named: ${f}`);
  // a continuation: the value under the function
  { const r = run(['sin 30°', '= 1/2']); ok(r.lines[1].status === 'ok' && plain(r.lines[1].note) === 'This equals the line above: 1/2. It matches an exact value.', `sin 30° then = 1/2 (${plain(r.lines[1].note)})`); }
  { const r = run(['1/2', '= sin 30°']); ok(!/It matches/.test(plain(r.lines[1].note || '')), '= sin 30° under 1/2 is the step the other way: named nothing'); }
  { const r = run(['sin 150°', '= sin 30°', '= 1/2']); ok(/It matches a related angle/.test(plain(r.lines[1].note)) && r.lines[2].status === 'ok', `a chain of related angle then value (${r.lines.map(l => plain(l.note || ''))})`); }
  ok(renders([one('sin 30° = 1/2').note, one('tan 60° = √3').note, one('sin(180° - θ) = sin θ').note].join(' ')) && !/[—–]/.test(degreeTicks.map(([f]) => noteOf(f)).join(' ')), 'the new comments typeset and carry no dash');

  // 6.4 derivative marks typeset (commentTex)
  const marks = [["y'", "y'"], ["f'(x)", "f'(x)"], ["u'", "u'"], ["f''(x)", "f''(x)"], ["f'(2)", "f'(2)"], ["y''", "y''"], ['dy/dx', '\\frac{dy}{dx}'], ['d/dx', '\\frac{d}{dx}'], ['du/dx', '\\frac{du}{dx}'], ['d²y/dx²', '\\frac{d^{2}y}{dx^{2}}'], ['d^2y/dx^2', '\\frac{d^{2}y}{dx^{2}}'], ['d/dx(x^2)', '\\frac{d}{dx}(x^{2})'], ['d/dx(3x + 1)', '\\frac{d}{dx}(3x + 1)']];
  for (const [src, tex] of marks) ok(derivativeMarkTex(src) === tex && fragmentTex(src) === tex, `derivative mark ${src} is ${tex} (${derivativeMarkTex(src)})`);
  for (const bad of ['d²y/dx', 'dy/d', 'y', "ab'", 'dy/dxy', 'y^\'', "'y'"]) ok(derivativeMarkTex(bad) === null, `not a derivative mark: ${bad}`);
  ok(mathSpan("y' = 2x") === "$y' = 2x$" && mathSpan('dy/dx = 2x') === '$\\frac{dy}{dx} = 2x$' && mathSpan("f'(x) = 3x^2") === "$f'(x) = 3x^{2}$" && mathSpan("u' = 2x - 4") === "$u' = 2x - 4$", 'an equation with a derivative mark is one typeset span');
  ok(!/\\frac\{dy\}\{d\}/.test(mathSpan('dy/dx = 2x')), 'dy/dx is no longer read as d times y over d times x');
  const prose = [["This is y' and f'(x) and dy/dx and d/dx.", "This is $y'$ and $f'(x)$ and $\\frac{dy}{dx}$ and $\\frac{d}{dx}$."],
    ["Take d²y/dx² of it, f''(x) too.", "Take $\\frac{d^{2}y}{dx^{2}}$ of it, $f''(x)$ too."], ["u' = $2x$ and v'.", "$u'$ = $2x$ and $v'$."], ['The derivative $f\'(x)$ is not y\'.', 'The derivative $f\'(x)$ is not $y\'$.']];
  for (const [src, want] of prose) ok(typesetDerivativeMarks(src) === want && dollarsBalanced(want) && renders(want), `derivative marks in prose: ${src}`);
  // an apostrophe in ordinary English is never a prime
  for (const s of ["It isn't a slip, and Pri's check didn't cross it.", "The students' working, the line's value, it's fine, I'm sure.", "Call the 'y' axis and the 'x' axis.", "don't, can't, won't, y's, x's", "Pri’s page and the slip’s line", 'and/or, a/d, mid/dx and 1/dx']) ok(typesetDerivativeMarks(s) === s, `no prime from an apostrophe: ${s}`);
  ok(typesetDerivativeMarks("a \\$5 note, y'") === "a \\$5 note, $y'$" && typesetDerivativeMarks('') === '' && typesetDerivativeMarks(null) === '', 'an escaped dollar stays literal; empty text stays empty');
  ok(typesetDerivativeMarks("$y' = 2x$ so y' is 2x") === "$y' = 2x$ so $y'$ is 2x", 'maths already between dollars is left exactly as it is');
  ok(plainComment(typesetDerivativeMarks("This is y' and dy/dx and d²y/dx²")) === "This is y' and dy/dx and d²y/dx²", 'plainComment turns the marks back into what a student writes');
  { const r = run(['u = x^2 - 4x + 1', "u' = 2x - 4"]); const m = plain(r.lines[1].note); ok(r.lines[1].status === 'ok' && /^This is the derivative of u = x\^2 - 4x \+ 1/.test(m) && renders(r.lines[1].note) && dollarsBalanced(typesetDerivativeMarks(r.lines[1].note)), `a derivative comment typesets (${m})`); }

  // 6.5 the last line: like terms left uncollected (a note, never a cross or a change of tick)
  const collect = [[['2x + 3x = 2x + 3x'], 'Both sides are the same expression, written two ways. This simplifies to $5x$.'], [['3x + 2x + x = 2x + 3x + x'], 'Both sides are the same expression, written two ways. This simplifies to $6x$.'],
    [['x^2 + 3x^2 + 1 = 3x^2 + x^2 + 1'], 'Both sides are the same expression, written two ways. This simplifies to $4x^{2} + 1$.'], [['4x - x + 2 = 4x - x + 2'], 'Both sides are the same expression, written two ways. This simplifies to $3x + 2$.'],
    [['5x - 5x + z = 5x + z - 5x'], 'Both sides are the same expression, written two ways. This simplifies to $z$.'], [['4xy + xy = 4xy + xy'], null]];
  for (const [page, want] of collect) { const r = run(page); if (want !== null) ok(r.lines[0].status === 'ok' && r.lines[0].note === want && renders(want), `like terms: ${page[0]} (${r.lines[0].note})`); }
  { const r = run(['2x + 3x = 3x + 2x', '= 2x + 3x']); ok(r.lines.map(l => l.status).join() === 'ok,ok' && !/simplifies/.test(r.lines[0].note) && /simplifies to \$5x\$/.test(r.lines[1].note), `only the last line carries the note (${r.lines.map(l => l.note)})`); }
  { const r = run(['2x + 3x = 3x + 2x', '= 5x']); ok(r.lines.every(l => !/simplifies|simplified/.test(l.note || '')), 'collected already: no note'); }
  // no note where nothing is left to collect, or where the line is not read this way
  for (const f of ['5x = 5x', '2x + 3y = 3y + 2x', 'x^2 + x = x + x^2', '2x = x + x', '2x + 3x = 5x', 'x + x = 2x', '0.5x + 1.5x = 1.5x + 0.5x', '5 cm + 3 cm = 3 cm + 5 cm', '2m + 3m = 3m + 2m', '2h + 3h = 3h + 2h', '2A + 3A = 3A + 2A', '2x + 3 = 3 + 2x', 'x(x + 1) = x^2 + x', '2x + 3x = (5)x']) {
    ok(!/simplifies|simplified/.test(noteOf(f)), `no like-terms note: ${f} (${noteOf(f)})`);
  }
  // improper trig value and unrationalised denominator in the last line (the plain-number note, now for these lines too)
  ok(noteOf('cos(π/4) = 1/√2') === 'Both sides come to √2/2. It matches an exact value. Give the final answer in that simplified form.', 'an unrationalised denominator: the rationalised form is stated and asked for');
  ok(noteOf('sin(π/6) = sin(π/6)') === 'Both sides come to 1/2. Give the final answer in that simplified form.', 'a trig value left as sin(π/6) when it is exact');
  ok(/simplifies to \$1\$|simplified form/.test(noteOf('sin(π/2) = cos(0)')), 'sin(π/2) = cos 0 asks for the value 1');
  ok(noteOf('tan 60° = √3') === 'Both sides come to √3. It matches an exact value.' && noteOf('sin 30° = 1/2') === 'Both sides come to 1/2. It matches an exact value.', 'already simplest: no note');
  ok(!/simplif/.test(noteOf('1/√2 = 0.7071')) && !/simplif/.test(noteOf('cos(π/4) = 0.7071')), 'a decimal answer gets no note');
  ok(run(['2x + 3x = 2x + 3x', 'x = 4']).lines.every(l => !/simplifies/.test(l.note || '')), 'a line after it moves the last line: no note on the earlier one');
  ok(run(['2x + 3x = 2x + 3x']).firstBreak === -1 && run(['2x + 3x = 2x + 3x']).lines[0].state === 'arithmetic', 'the note never changes the tick');

  // 6.6 review of 5b3ac56a3: a power followed by brackets (any base, any exponent form) is read both ways; a line true under ANY reading is never crossed
  for (const [f, want] of [['e^π(2) = e^(2π)', 'note'], ['e^2(3)(4) = e^24', 'note'], ['2^3(2) = 64', 'note'], ['2^3(2) = 16', 'ok'], ['x^2(3) = x^6', 'note'], ['10^2(3) = 300', 'ok'], ['10^2(3) = 1000000', 'note'],
    ['e^π(2) = 2e^π', 'ok'], ['3^2(2) = 81', 'note'], ['3^2(2) = 18', 'ok'], ['2^(1+2)(2) = 64', 'note'], ['2^3(2)(2) = 2^12', 'note'], ['2^3(2)(2) = 32', 'ok']]) ok(one(f).status === want, `a power then brackets: ${f} is ${want} (${one(f).status})`);
  for (const f of ['2^3(2) = 17', '10^2(3) = 301', '3^2(2) = 19', 'e^2(3) = e^2(4)', '2^3(2) = 15']) ok(one(f).status === 'break', `false under every reading is still crossed: ${f} (${one(f).status})`);

  // 6.7 a quote-closing apostrophe is never a prime; d/dx(…) takes its argument; dy/dx inside a larger expression stays plain
  for (const t of ["call it 'point A' now", "call it 'point a' now", "call it 'the line l' and then 'y' again", "Say 'f' then 'g' and it's fine", "the 'x' value, then the 'y' value."]) ok(typesetDerivativeMarks(t) === t, `a quote is not a prime: ${t} (${typesetDerivativeMarks(t)})`);
  ok(typesetDerivativeMarks("call it 'f' and then take f'(x) and y' too") === "call it 'f' and then take $f'(x)$ and $y'$ too", 'a closed quote ends: a real mark after it is still set');
  ok(typesetDerivativeMarks("A' and B'(x) stay as written") === "A' and B'(x) stay as written", 'a capital letter with a prime in a sentence is not a derivative mark');
  ok(typesetDerivativeMarks('Take d/dx(x^2) now') === 'Take $\\frac{d}{dx}(x^{2})$ now' && renders(typesetDerivativeMarks('Take d/dx(x^2) now')), 'd/dx(x^2) in prose is one span with its argument');
  ok(mathSpan('d/dx(x^2) = 2x') === '$\\frac{d}{dx}(x^{2}) = 2x$' && fragmentTex('d/dx(x^2)') === '\\frac{d}{dx}(x^{2})', 'd/dx(x^2) is one span with its argument');
  // d/dx(…) with brackets inside its argument: the whole argument is typeset, never "$\frac{d}{dx}$(f(x))" (display only)
  for (const [src, want] of [["Take d/dx(f(x)) now", 'Take $\\frac{d}{dx}(f\\left(x\\right))$ now'], ['Then d/dx(sin(2x)) and d/dx((x+1)^2).', 'Then $\\frac{d}{dx}(\\sin\\left(2x\\right))$ and $\\frac{d}{dx}(\\left(x + 1\\right)^{2})$.'],
    ["Use d/dx(f(x)) = f'(x).", "Use $\\frac{d}{dx}(f\\left(x\\right))$ = $f'(x)$."], ['d/dx(x^2) + d/dx(f(g(x)))', '$\\frac{d}{dx}(x^{2})$ + $\\frac{d}{dx}(f\\left(g\\left(x\\right)\\right))$']]) {
    const got = typesetDerivativeMarks(src);
    ok(got === want && dollarsBalanced(got) && renders(got) && !/\$\\frac\{d\}\{dx\}\$\(/.test(got), `d/dx with nested brackets is one typeset span: ${src} (${got})`);
  }
  ok(derivativeMarkTex('d/dx(f(x))') === '\\frac{d}{dx}(f\\left(x\\right))' && mathSpan('d/dx(f(x)) = f\'(x)') === "$\\frac{d}{dx}(f\\left(x\\right)) = f'(x)$", 'a whole-line d/dx(f(x)) keeps its nested brackets inside the span');
  ok(plainComment(typesetDerivativeMarks('Take d/dx(f(x)) now')) === 'Take d/dx(f(x)) now', 'plainComment turns the nested span back into what the student wrote');
  ok(typesetDerivativeMarks('Odd d/dx(f(x) is left alone where its bracket never closes').includes('(f(x)'), 'an unbalanced d/dx( never swallows the rest of the sentence');
  for (const f of ['3dy/dx = 6x', '(dy/dx)/(dx/dt) = dy/dt', 'dy/dx / 2 = x', 'dy/dx + 1 = 2x', '2dy/dx', 'd/dx(x^2) + 1 = 2x + 1']) {
    const m = mathSpan(f);
    ok(!/\\frac\{dy\}\{d\}/.test(m) && !/\\cdot x/.test(m) && (m === f || renders(m)), `dy/dx inside a larger expression is never a quotient of products: ${f} (${m})`);
  }
  ok(mathSpan('3dy/dx = 6x') === '3dy/dx = 6x' && fragmentTex('dy/dx / 2') === null, 'such a span stays plain text');
  // a backslash and a dollar in a student's line: what the renderer shows is what was written (MathText unescapes `\$` only)
  { const shown = t => t.split(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g).filter((_, i) => i % 2 === 0).join('').replace(/\\\$/g, '$');
    ok(shown(mathSpan('a\\$b')) === 'a\\$b' && mathSpan('a\\$b') === 'a\\\\$b', `a\\$b is shown as written (${mathSpan('a\\$b')})`);
    ok(shown(mathSpan('a\\')) === 'a\\' && shown(mathSpan('a\\\\')) === 'a\\\\' && dollarsBalanced(mathSpan('a\\$b')), 'a trailing and a doubled backslash are shown as written');
    ok(shown(mathSpan('cost $5 * 2')) === 'cost $5 × 2' && dollarsBalanced(mathSpan('cost $5 * 2')), 'a literal dollar is escaped, a star is a times sign'); }
}

// ── Part 6 · the owner's handwritten pages, 20 November 2026 (read by the live reader; exact transcripts) ─────────────
// Rules throughout: a true line is never crossed, a wrong line is never ticked, a definition is never crossed, and an
// unsure line is a note. Every verdict below is tick-only unless it says otherwise.
{
  const stat = lines => run(lines).lines.map(l => l.status === 'ok' ? 'T' : l.status === 'break' ? 'X' : '.').join('');
  const PAGE_A = ['y = 2x^3 + 9x^2', 'y′ = 6x^2 + 18x', 'for stationary points y′ = 0', '0 = 6x^2 + 18x', '0 = 6x[x + 3]', 'x = 0 or x = -3', 'y(0) = 0', 'smallest (0,0)'];
  const PAGE_B = ['8 y = 2x(4 - x).', 'Area = ∫_0^4 2x(4 - x) dx.', '= 2∫_0^4 4x - x^2 dx', '= 2[4x^2/2 - x^3/3]_0^4', '= 2[2x^2 - x^3/3]_0^4', '= 2[2(4)^2 - 4^3/3] = 2[32 - 64/3]', '16/3', '64/3'];
  const PAGE_C = ['integral_2^4 12x dx = 12 integral_-2^4 x dx.', '= [12x^2/2]_2^4', '= [6x^2]_ -2^4', '= 6[x^2]_-2^4', '= 6[4^2 - 2^2]', '= 6(16 - 4) = 6 x 12', 'Ans = 72'];
  const PAGE_D = ['= |[14;8]| = √(14^2 + 8^2)', '196', '+ 64', '260', '= √260'];
  // 1. every prime-like character is the prime; the line shown stays as the student wrote it
  ok(stat(PAGE_A) === '.T.TTTT.', `page A: the derivative, its zero, the rearranged equation, both roots and y(0) are ticked (${stat(PAGE_A)})`);
  ok(run(PAGE_A).lines[1].text === 'y′ = 6x^2 + 18x', 'the text shown is the text written');
  for (const prime of ["'", '′', '’', 'ʹ', '´']) ok(stat(PAGE_A.map(l => l.replace(/′/g, prime))) === '.T.TTTT.', `the prime ${prime} reads as a prime`);
  ok(/derivative of/.test(plain(run(PAGE_A).lines[1].note)), 'line 2 is ticked as the derivative of line 1');
  for (const wrong of ['y′ = 6x^2 + 9x', "y' = 6x^2 + 9x", 'y’ = 6x^2 + 9x', 'y′ = 6x^2 + 18x + 1']) ok(!/T/.test(stat(['y = 2x^3 + 9x^2', wrong]).slice(1)), `a wrong derivative is never ticked: ${wrong} (${stat(['y = 2x^3 + 9x^2', wrong])})`);
  ok(stat(['y = 2x^3 + 9x^2', 'y′ = 6x^2 + 9x']) === '.X' && stat(['y = 2x^3 + 9x^2', "y' = 6x^2 + 9x"]) === '.X', 'a wrong derivative follows the existing rule for u\': crossed, the same with either mark');
  ok(stat(['y = 2x^3 + 9x^2', 'y″ = 12x + 18']) === '..', 'a double prime is read and not ticked as a first derivative');
  // 2. the derivative set to zero
  { const r = run(PAGE_A);
    ok(plain(r.lines[3].note) === 'This sets the derivative above to zero.', `line 4 says it sets the derivative to zero (${r.lines[3].note})`);
    ok(stat(['y = 2x^3 + 9x^2', "y' = 6x^2 + 18x", "y' = 0", '6x^2 + 18x = 0']) === '.T.T', 'with no words before y\' = 0, and the expression on the left');
    ok(stat(['y = 2x^3 + 9x^2', "y' = 6x^2 + 18x", "y' = 0", '0 = 6x^2 + 17x']) !== '.T.T' && !/X/.test(stat(['y = 2x^3 + 9x^2', "y' = 6x^2 + 18x", "y' = 0", '0 = 6x^2 + 17x'])), 'a different expression is not ticked by this rule, and never crossed');
    ok(stat(['y = 2x^3 + 9x^2', "y' = 6x^2 + 18x", 'so', '0 = 6x^2 + 18x']) === '.T..', 'without y\' = 0 above it, 0 = (the derivative) is not ticked by this rule');
    ok(stat(['y = 2x^3 + 9x^2', "y' = 6x^2 + 18x", "y' = 0", '5', '0 = 6x^2 + 18x']) === '.T...' , 'only the line straight after y\' = 0'); }
  // 3. a list of roots
  for (const roots of ['x = 0 or x = -3', 'x = 0, x = -3', 'x = 0 and x = -3', 'x = 0, -3', 'x = 0 or -3', 'x = 0 or x = -3.']) {
    const r = run(PAGE_A.map((l, k) => (k === 5 ? roots : l)));
    ok(r.lines[5].status === 'ok' && !/all the solutions\.?$/.test('') && /not say these are all/.test(r.lines[5].note), `a list of roots is ticked, not claimed complete: ${roots}`);
  }
  for (const bad of ['x = 0 or x = 3', 'x = 1, x = -3', 'x = 3 and x = 4', 'x = ±2']) { const r = run(PAGE_A.map((l, k) => (k === 5 ? bad : l))); ok(r.lines[5].status === 'note' && r.firstBreak === -1 && /does not satisfy|do not satisfy/.test(r.lines[5].note), `a list with a value that is not a root is a note that says so: ${bad} (${r.lines[5].note})`); }
  ok(stat(['x^2 = 4', 'x = ±2']) === '.T' && stat(['x^2 = 4', 'x = ±3']) === '..', 'x = ±a is a pair of values');
  // independent review: a derivative with no definition of y cannot be judged against another statement of it
  ok(stat(["y′ = 2x", "y′ = 2x + 1"]) === '..' && stat(["y' = 2x", "y' = 2x + 1"]) === '..' && stat(["y′ = 2x", "y′ = 2x + 1", "y′ = 2x"]) === '...', 'two different statements for y\' with no y = … above are notes, never crossed');
  // independent review: a root list names the equation it refers to, and only the latest equation line counts
  { const r = run(['x^2 = 9', 'x^2 = 4', 'x = 2 or x = -2']);
    ok(stat(['x^2 = 9', 'x^2 = 4', 'x = 2 or x = -2']) === '..T' && /satisfy \$x\^\{?2\}?\s*=\s*4\$ above/.test(r.lines[2].note) && r.lines[1].status === 'note', `the tick says which equation it refers to, and does not endorse the step before it (${r.lines[2].note})`);
    ok(stat(['x^2 = 9', 'x^2 = 4', 'x = 3 or x = -3']) === '...' && stat(['x^2 = 4', 'x = 5', 'x = 2 or x = -2']) === '...', 'roots of an older equation are not ticked'); }
  ok(stat(['x = 0 or x = -3']) === '.', 'with no equation above, a list of values is not ticked');
  ok(run(PAGE_A).lines[6].status === 'ok', 'y(-3) and y(0) style lines still work');
  ok(stat(['y = 2x^3 + 9x^2', "y' = 6x^2 + 18x", "y' = 0", '0 = 6x^2 + 18x', '0 = 6x(x + 3)', 'x = 0 or x = -3', 'y(-3) = 27']) === '.T.TTTT', 'y(-3) = 27 is ticked');
  ok(stat(['y = 2x^3 + 9x^2', "y' = 6x^2 + 18x", "y' = 0", '0 = 6x^2 + 18x', '0 = 6x(x + 3)', 'x = 0 or x = -3', 'y(-3) = 28']) !== '.T.TTTT.' && !/T$/.test(stat(['y = 2x^3 + 9x^2', "y' = 6x^2 + 18x", "y' = 0", '0 = 6x^2 + 18x', '0 = 6x(x + 3)', 'x = 0 or x = -3', 'y(-3) = 28'])), 'a wrong y(-3) is not ticked');
  // 5 6 7. the value written under the working
  { const r = run(PAGE_B);
    ok(r.firstBreak === -1 && stat(PAGE_B) === '..TTTT.T', `page B: the chain is ticked, the margin 16/3 is a note, 64/3 is ticked (${stat(PAGE_B)})`);
    ok(/value of the working above/.test(plain(r.lines[7].note)) && /64\/3/.test(plain(r.lines[7].note)), `the bare value says what it is (${plain(r.lines[7].note)})`);
    ok(!/Give the final answer|simplifies to/.test(r.lines[5].note), `line 6 does not ask for the simplified form: line 8 states it (${r.lines[5].note})`);
    ok(/Give the final answer in that simplified form/.test(run(PAGE_B.slice(0, 6)).lines[5].note), 'with no line stating it, line 6 still carries the note');
    ok(stat(['3 × 4', '= 12', '12']) === '.TT' && stat(['3 × 4', '= 12', '12.']) === '.TT' && stat(['3 × 4', '= 12', '13']) === '.T.' && stat(['3 × 4', '= 12', '13', '12']) === '.T.T', 'a bare value equal to the chain is ticked; one that is not stays a note, never a cross');
    ok(stat(['500 + 500 = 1000', '1000.0001']) === 'T.' && stat(['500 + 500 = 1000', '1000']) === 'TT' && stat(['2 × 1 = 2', '2.0000001']) === 'T.', 'a bare value ticks only when it equals the working exactly');
    ok(run(['√260 = √260', '16.12']).lines[1].note === 'This is the working above, rounded: 16.12.' && stat(['√260 = √260', '16.12']) === 'TT' && stat(['√260 = √260', '16.13']) === 'T.' && stat(['√260 = √260', '16.1']) === 'T.' && stat(['2.5 × 1 = 2.5', '2.4']) === 'T.' && stat(['1/8 + 1/8 = 1/4', '0.3']) === 'T.', 'a rounding to 2 or more places of a value that never ends is ticked as a rounding; a later digit that differs is a note');
    ok(stat(['3 × 4 = 13', '13']) === 'X.', 'after a cross nothing is ticked');
    ok(stat(['1/2 + 1/3', '= 5/6', '5/6']) === '.TT' && stat(['1/2 + 1/3', '= 5/6', '5/7']) === '.T.', 'fractions too');
    ok(stat(['2 + 3 = 5.', '= 5.', '5.', 'y = 2x(4 - x).']) === 'TTT.', 'a full stop at the end of a line is punctuation, never a decimal point or a product');
    ok(stat(['x^2 = 9.', 'y = 2x(4 - x).', '8 y = 2x(4 - x).', 'Area = ∫_0^4 2x(4 - x) dx.']) === '....', 'the question number and the integral label: notes, never crossed');
    ok(stat(['8 y = 2x(4 - x).', 'y(2) = 16']) === '..', 'an "8 y" that may be 8y is not read as a definition of y, so y(2) = 16 is not ticked'); }
  // 8. integral written in words
  { const r = run(PAGE_C);
    ok(stat(PAGE_C) === 'TTTTTTT' && r.firstBreak === -1, `page C: the word form of the integral is read like ∫ (${stat(PAGE_C)})`);
    ok(stat(['integral_0^3 x^2 dx = 9', 'integral_0^3 x^2 dx = 10']) === 'T.' && stat(['∫_0^3 x^2 dx = 9', '= [x^3/3]_ 0^3']) === 'TT', 'integral_a^b and a space after the underscore read as ∫_a^b'); }
  // 9. a column sum
  { const r = run(PAGE_D);
    ok(stat(PAGE_D) === 'T..TT' && r.firstBreak === -1, `page D: the column's last line is ticked, the others are notes, and = √260 follows the chain above (${stat(PAGE_D)})`);
    ok(/196 \+ 64 = 260/.test(plain(r.lines[3].note)), `the tick says the sum (${plain(r.lines[3].note)})`);
    ok(stat(['196', '+ 64', '260']) === '..T' && stat(['196', '+ 64', '---', '260']) === '...T' && stat(['300', '- 40', '+ 5', '265']) === '...T' && stat(['3', '- 8', '-----', '-5']) === '...T', 'a true column, with or without a rule line, plus and minus');
    ok(stat(['196', '+ 64', '270']) === '...' && stat(['196', '+ 64', '250']) === '...' && !run(['196', '+ 64', '250']).diagnosis, 'a column that does not add up is a note: a column sum is never crossed');
    ok(/^Not checked/.test(run(['196', '+ 64', '250']).lines[2].note), 'and the note says it is not checked');
    // independent review: lists of numbers are not sums (a table of x-values, three numbers in a row)
    for (const page of [['-2', '-1', '0', '1', '2'], ['4', '-2', '7'], ['0', '-3', '5'], ['3', '-1', '5'], ['10', '-3', '8'], ['3', '+ 4', '8'], ['1', '-1', '0'], ['0', '1', '2', '3'], ['-1', '+ 2', '1'], ['2', '-', '3']]) ok(stat(page) === '.'.repeat(page.length), `not a sum, so nothing ticked or crossed: ${page.join(' | ')} (${stat(page)})`);
    ok(stat(['12', '- 5', '7']) === '..T' && stat(['196', '+ 64', '260']) === '..T' && stat(['12', '- 5', '8']) === '...', 'a minus needs a space after it to be an operation');
    ok(stat(['99999999999999999', '+ 1', '100000000000000001']) === '...' && stat(['123456789012345', '+ 1', '123456789012346']) === '..T', 'a number beyond 15 significant digits is not judged');
    ok(stat(['99999999999999999 + 1 = 100000000000000001', '9007199254740993 - 1 = 9007199254740992', '123456789012345 + 1 = 123456789012346']) === '..T', 'the same for a sum written on one line');
    ok(stat(['1.5', '+ 0.5', '3']) === '...' && stat(['1.5', '+ 0.5', '2']) === '..T' && stat(['0.5', '+ 0.25', '0.8']) === '...', 'a decimal column is ticked when true and a note when false');
    ok(stat(['196', '260']) === '..' && stat(['196', '+ 64']) === '..' && stat(['196', '+ 64', '+ 5']) === '...', 'two numbers, or a column with no total, are not a sum');
    ok(stat(['196', '+ 64', '260', '5']) === '..T.', 'a number under the total is not part of the column');
    ok(stat(['x', '+ 64', '260']) === '...', 'a letter in the column: not a sum');
    ok(stat(['12', '+ 8', '20', '= 20']) === '..T.' && stat(['2 + 3 = 5', '196', '+ 64', '260', '= 5']) === 'T..TT' && stat(['2 + 3 = 5', '196', '+ 64', '260', '= 6']) === 'T..T.' && stat(['2 + 3 = 5', '196', '+ 64', '260', '= 260']) === 'T..T.', 'the line below a block is held to the chain above it: ticked when equal, otherwise a note, never crossed'); }
  // 10. column vectors
  ok(stat(['4[-5;-1] + 3[-2;4] = [-20 - 6;-4 + 12]', '= [-26;8]']) === 'TT', 'a sum of column vectors and the line under it');
  ok(stat(['4[-5;-1] + 3[-2;4] = [-26;9]']) === '.' && stat(['4[-5;-1] + 3[-2;4] = [-20 - 6;-4 + 12]', '= [-26;9]']) === 'T.', 'a false vector line is a note: tick only');
  ok(stat(['|[14;8]| = √(14^2 + 8^2)']) === 'T' && stat(['|[14;8]| = 16']) === '.' && stat(['|[3;4]| = 5', '= √25']) === 'TT', 'a magnitude');
  ok(stat(['[1;2;3] + [1;1;1] = [2;3;4]', '2[1;2] = [2;4]', '-[1;2] = [-1;-2]', '[1;2] - [3;5] = [-2;-3]']) === 'TTTT' && stat(['[1;2;3] + [1;1] = [2;3;4]']) === '.', 'three components, a minus, a scalar; vectors of different size are not compared');
  ok(!/X/.test(stat(['[1;2] = [2;1]', '[1;2] + [1;2] = [2;5]', '|[3;4]| = 6', '= |[3;4]|'])), 'no vector line is ever crossed');
}

// ── Part 5 · what the question itself gives (engine/questionFacts.js) ────────────────────────────────────────────────
// Owner's page, 20 November 2026: `y = 2x(4 - x)` copied from the question and `Area = ∫_0^4 2x(4 - x) dx` setting up the
// integral it asks for were true lines that got only a note. The question's facts are read from the PROMPT alone and used
// to tick or leave a note, never to cross.
{
  const code = report => report.lines.map(l => (l.status === 'ok' ? 'T' : l.status === 'break' ? 'X' : '.')).join('');
  const P = (prompt, lines, extra = {}) => keep(stepCheckArithmetic(lines.join('\n'), { facts: questionFacts({ prompt }), ...extra }));
  const S = (prompt, lines) => code(P(prompt, lines));
  const noFacts = lines => code(keep(stepCheckArithmetic(lines.join('\n'))));
  const noteOf = (prompt, lines, k) => P(prompt, lines).lines[k].note;
  const GIVEN = 'This is given in the question.', MISMATCH = 'This does not match what the question gives: check you copied it correctly.';
  const AREA = 'The curve $y = 2x(4 - x)$. Find the area bounded by the curve and the x-axis.';

  // the owner's page, line by line
  const PAGE5 = ['y = 2x(4 - x)', 'Area = ∫_0^4 2x(4 - x) dx', '= 2∫_0^4 4x - x^2 dx', '= 2[2x^2 - x^3/3]_0^4', '= 2[32 - 64/3]', '64/3'];
  ok(noFacts(PAGE5) === '..TTTT', `before: the first two lines were only notes (${noFacts(PAGE5)})`);
  ok(S(AREA, PAGE5) === 'TTTTTT', `the owner's page: every line is ticked (${S(AREA, PAGE5)})`);
  ok(noteOf(AREA, PAGE5, 0) === GIVEN, 'the copied curve is ticked as given in the question');
  ok(/area bounded by the curve and the x-axis/.test(noteOf(AREA, PAGE5, 1)) && !/mark|right step|correct method/i.test(noteOf(AREA, PAGE5, 1)), 'the integral line says what the integral is, not that it is the right step');
  ok(P(AREA, PAGE5).firstBreak === -1, 'nothing on the owner\'s page is crossed');
  ok(S(AREA, ['y = 2x(4 - x)', 'Area = ∫_0^4 y dx', '= 64/3']) === 'TTT', 'the integral of the given y is worked out as written');
  ok(S(AREA, ['Area = ∫_{0}^{4} 2x(4 - x) dx', 'A = ∫_0^4 2x(4 - x) dx']) === 'TT', 'braced limits and a one-letter label');
  ok(S(AREA, ['Area = ∫_0^4 2x(4 - x) dx = 64/3']) === 'T', 'the integral with its value on one line');
  ok(S(AREA, ['y = 2x(4 - x)', '= 8x - 2x^2', '= 2x(4 - x)']) === 'TTT', 'the given curve written another way, and back');
  ok(S(AREA, ['y = 8x - 2x^2']) === 'T' && noteOf(AREA, ['y = 8x - 2x^2'], 0) === GIVEN, 'the given curve expanded is the same function of x: ticked');
  ok(S(AREA, ['y = 2x(4 - x) = 8x - 2x^2']) === 'T', 'a chain of the given curve and its expansion');

  // near misses: never ticked, never crossed
  for (const [line, why] of [['y = 2x(4 + x)', 'a sign changed'], ['y = 3x(4 - x)', 'a digit changed'], ['y = 2x(5 - x)', 'a digit changed in the bracket'], ['y = 2x(4 - x) + 1', 'a term added'], ['y = 2x(4 - x)^2', 'a power added']])
    ok(S(AREA, [line]) === '.', `not ticked: ${line} (${why})`);
  ok(noteOf(AREA, ['y = 2x(4 + x)'], 0) === MISMATCH && noteOf(AREA, ['y = 3x(4 - x)'], 0) === MISMATCH, 'a near copy is a note that says it does not match what the question gives');
  ok(noteOf(AREA, ['y = 2x(4 - x) + 1'], 0) !== GIVEN && !/does not match/.test(noteOf(AREA, ['y = x + 5'], 0)), 'a line that is not close to the given gets the ordinary note');
  for (const line of ['Area = ∫_0^4 2x(4 - x)^2 dx', 'Area = ∫_0^3 2x(4 - x) dx', 'Area = ∫_1^4 2x(4 - x) dx', 'Area = ∫_0^4 2x(4 + x) dx', 'Area = ∫_0^4 x(4 - x) dx', 'Area = ∫_-4^0 2x(4 - x) dx', 'Area = ∫_4^0 2x(4 - x) dx', 'Area = ∫_0^4 2x(4 - x) dt'])
    ok(S(AREA, [line]) === '.', `an area line that is not the question's integral is not ticked: ${line}`);
  ok(!/X/.test(S(AREA, ['y = 2x(4 + x)', 'y(2) = 24', "y' = 8 + 4x", 'y = 0', 'Area = ∫_0^4 2x(4 + x) dx', '= 64/3'])) , 'a miscopied given crosses nothing');
  ok(S(AREA, ['y = 2x(4 + x)', 'y(2) = 24']) === '..', 'after a miscopy the page is not read against the question\'s y either');
  ok(S('The curve $y = x(x - 4)$ and the x-axis enclose a region. Find the area bounded by the curve and the x-axis.', ['Area = ∫_0^4 x(x - 4) dx']) === '.', 'a curve that opens upward: the integral is minus the area, so the line is not ticked');
  ok(S('The curve $y = x^3 - x$. Find the area bounded by the curve and the x-axis between $x = -1$ and $x = 0$.', ['Area = ∫_-1^0 x^3 - x dx']) === '.', 'a cubic is not read as a quadratic: not ticked');
  ok(S('The curve $y = 2x(4 - x)$ and the line $y = x$. Find the area bounded by the curve and the x-axis.', ['Area = ∫_0^4 2x(4 - x) dx']) === '.', 'a second boundary named: no area rule');
  ok(S('The curve $y = 2x(4 - x)$. Find the area bounded by the curve, the x-axis and the line $x = 1$.', ['Area = ∫_0^4 2x(4 - x) dx']) === '.', 'a boundary line x = 1: no area rule');
  ok(S('The curve $y = 2x(4 - x)$. Find the area bounded by the curve and the x-axis from $x = 1$ to $x = 3$.', ['Area = ∫_0^4 2x(4 - x) dx']) === '.', 'limits that are not roots: no area rule');
  ok(S('The curve $y = 2x(4 - x)$ meets the x-axis at $x = 0$ and $x = 4$. Find the area bounded by the curve and the x-axis.', ['Area = ∫_0^4 2x(4 - x) dx']) === '.', 'a second maths span of any kind: no area rule');
  ok(S('Find the area enclosed by $y = 2x(4 - x)$ and the x-axis.', ['Area = ∫_0^4 2x(4 - x) dx']) === 'T', 'enclosed is one of the plain shapes, with the curve in the same sentence');
  ok(S('The curve $y = 2x(4 - x)$ is drawn. Find its gradient at $x = 1$.', ['Area = ∫_0^4 2x(4 - x) dx']) === '.', 'no area asked: the integral is not ticked');

  // later lines use the given as page definitions
  ok(S(AREA, ['y(2) = 8']) === 'T' && S(AREA, ['y(2) = 9']) === '.', 'y(2) = 8 is ticked from the given y, y(2) = 9 is a note');
  ok(S(AREA, ["y' = 8 - 4x"]) === 'T' && /^This is the derivative of .*y = 2x.*by the product rule\.$/.test(noteOf(AREA, ["y' = 8 - 4x"], 0)), 'the derivative of the given y');
  ok(S(AREA, ["y' = 8 - 5x"]) === '.' && S(AREA, ['y = 2x(4 - x)', "y' = 8 - 5x"]) === 'T.', 'a wrong derivative of the given y is a note, never a cross, whether or not y is copied');
  ok(S(AREA, ['y = 2x(4 - x)', 'y(1) = 6', 'y(1) = 7']) === 'TT.', 'a wrong value is a note');
  ok(/from the question/.test(noteOf(AREA, ['y(2) = 8'], 0)), 'a tick that uses the given says it comes from the question');
  ok(S(AREA, ['∫_0^4 y dx = 64/3']) === 'T' && S(AREA, ['∫_0^4 y dx = 65/3']) === '.', 'an integral of the given y is worked out: true ticked, false a note');
  ok(S(AREA, ['(b) y = 5', 'y = 2x(4 - x)', 'y(2) = 8']) === '.TT', 'a part label drops the given; copying it again brings it back');

  // two functions
  const TWO = 'Given $f(x) = x^2 - 4$ and $g(x) = 2x + 1$. Find $f(2) + g(2)$.';
  ok(S(TWO, ['f(x) = x^2 - 4', 'g(x) = 2x + 1', 'f(2) = 0', 'g(2) = 5']) === 'TTTT', 'two given functions, each copied and used');
  ok(S(TWO, ['g(x) = 2x - 1']) === '.' && noteOf(TWO, ['g(x) = 2x - 1'], 0) === MISMATCH, 'a sign changed in the second function');
  ok(S(TWO, ['f(x) = 2x + 1']) === '.', 'the second function\'s rule under the first function\'s name is not ticked');
  ok(S(TWO, ['f(2) = 1', 'g(2) = 4']) === '..', 'wrong values of the given functions: notes');
  ok(S(TWO, ['f(2) + g(2) = 0 + 5']) === 'T', 'a sum of the two given functions, true');
  ok(!/X/.test(S(TWO, ['f(2) = 1', 'g(2) = 4', 'f(2) + g(2) = 5'])), 'never a cross from the given functions');
  // the same name given twice (a piecewise definition, a name with two conditions) gives no facts: nothing is ticked from it
  const SAME = 'The curve $y = x^2$ meets the line $y = 2x$. Find the points of intersection.';
  ok(questionFacts({ prompt: SAME }) === null && S(SAME, ['y = x^2', 'y = 2x', 'y(3) = 9']) === '...', 'the same name given twice: no facts, exactly as without them');
  const PIECE = 'Let $f(x) = x^2$ for $x \\ge 0$ and $f(x) = -x$ for $x < 0$. Find $f(-3)$.';
  ok(questionFacts({ prompt: PIECE }) === null && S(PIECE, ['f(x) = x^2', 'f(x) = -x']) === '..', 'a piecewise prompt with two definitions of f: the student\'s own f(x) = x^2 is not ticked as given');
  const CASES = 'Let $f(x) = \\begin{cases} x^2 & x \\ge 0 \\\\ -x & x < 0 \\end{cases}$. Find $f(-3)$.';
  ok(questionFacts({ prompt: CASES }) === null && S(CASES, ['f(x) = x^2', 'f(x) = -x']) === '..', 'a cases prompt: no facts, f(x) = x^2 is not ticked as given');
  ok(questionFacts({ prompt: 'Let $f(x) = x^2$ for $x \\ge 0$. Find $f(3)$.' }) !== null && S('Let $f(x) = x^2$ for $x \\ge 0$. Find $f(3)$.', ['f(x) = x^2']) === 'T', 'one definition with a condition is still a definition');
  // given numbers
  const NUM = 'Let $a = 3, b = 4$. Find $a^2 + b^2$.';
  ok(S(NUM, ['a = 3', 'b = 4']) === 'TT' && noteOf(NUM, ['a = 3'], 0) === GIVEN, 'given numbers copied');
  ok(S(NUM, ['a = 8']) === '.' && noteOf(NUM, ['a = 8'], 0) === MISMATCH && S(NUM, ['b = 5']) === '.', 'a given number with one digit changed: a note, not ticked');
  ok(S(NUM, ['a = 6/2']) === 'T' && S(NUM, ['a = 0']) === '.' && noteOf(NUM, ['a = 0'], 0) !== MISMATCH, 'a given number written another way; a zero is not called a miscopy');
  ok(S(NUM, ['a = 3', 'b = 4', 'a^2 + b^2 = 9 + 16']) === 'TTT' && S(NUM, ['a = 3', 'b = 4', 'a^2 + b^2 = 9 + 17']) === 'TT.', 'the given numbers are used by the lines below');
  ok(/from the question/.test(noteOf(NUM, ['a^2 = 9'], 0)) && S(NUM, ['a^2 = 9']) === 'T' && S(NUM, ['a^2 = 10']) === '.', 'a given number is put in, with the comment saying so; a wrong value is a note');
  ok(S('A principal of \\$500 earns interest with $r = 0.05$ per year.', ['r = 0.05', 'r = 0.06']) === 'T.', 'a given decimal, after a dollar sign for money');

  // equations, identities and bare expressions the prompt states are never given: a prompt may state a false line
  for (const [prompt, lines, why] of [
    ['Prove or disprove: $(a + b)^2 = a^2 + b^2$', ['(a + b)^2 = a^2 + b^2'], 'a false identity in the prompt'],
    ['A student writes $\\sqrt{x^2 + 9} = x + 3$. Explain the error.', ['sqrt(x^2 + 9) = x + 3'], 'a false line a student wrote'],
    ['Show that $\\sin 2x = 2\\sin x$ is not an identity.', ['sin 2x = 2 sin x'], 'a false identity'],
    ['Verify that $x = 2$ is a root of $x^2 - 4x + 3 = 0$', ['x = 2'], 'x = 2 is not a root'],
    ['Show that $x = 1.5$ is a solution of $2x + 3 = 11$', ['x = 1.5'], 'x = 1.5 is not a solution'],
    ['Test whether $x = 5$ satisfies $2x + 3 = 11$', ['x = 5'], 'x = 5 does not satisfy it'],
    ['Evaluate $\\frac{1}{0}$ if possible', ['1/0'], 'a bare expression states nothing']
  ]) { const r = P(prompt, lines); ok(r.lines.every(l => l.status !== 'ok' || l.note !== GIVEN) && r.lines[0].status !== 'ok', `never ticked as given: ${lines[0]} (${why})`); }
  ok(S('Differentiate $x^2 \\sin x$.', ['x^2 sin x', 'y = x^2 sin x']) === '..', 'the asked expression, bare or named: states nothing, no tick');
  ok(S('Simplify $\\dfrac{x^2 - 1}{x - 1}$.', ['(x^2 - 1)/(x - 1)', 'x + 1']) === '..', 'the asked fraction and its simplified form: no tick');
  ok(S('Expand $(x + 3)^2$.', ['(x + 3)^2', '= x^2 + 6x + 9']) === '..' || S('Expand $(x + 3)^2$.', ['(x + 3)^2', '= x^2 + 6x + 9']) === '.T', 'the asked expression is not given; its expansion may tick only as an identity');
  ok(S('Evaluate $\\int_0^2 x^2\\,dx$.', ['∫_0^2 x^2 dx']) === '.', 'a bare integral from the prompt is not given');
  ok(S('Solve $x^2 - 5x + 6 = 0$.', ['x^2 - 5x + 6 = 0', 'x^2 - 5x + 7 = 0']) === '..', 'a conditional equation to solve: no tick when restated');
  ok(S('Prove that $(x + 1)^2 = x^2 + 2x + 1$.', ['(x + 1)^2 = x^2 + 2x + 1']) === 'T' && noteOf('Prove that $(x + 1)^2 = x^2 + 2x + 1$.', ['(x + 1)^2 = x^2 + 2x + 1'], 0) !== GIVEN, 'a true identity still ticks, as an identity, by the existing rule');
  ok(S('Verify that $y = 2x + 1$ passes through $(0, 1)$.', ['y = 2x + 1']) === '.', 'a definition under verify is not given');
  ok(S('Solve $x^2 - 5x + 6 = 0$.', ['x^2 - 5x + 6 = 0', 'x = 2 or x = 3']) === '.T', 'the roots: ticked only by the existing check against the equation, as before');

  // the area form is a whitelist of whole prompts: anything else about the region means no area fact
  for (const prompt of [
    'The curve $y = 4 - x^2$ and the x-axis for $x \\ge 0$. Find the area bounded by the curve and the x-axis.',
    'Find the area bounded by $y = 4 - x^2$ and the x-axis where $x > 0$.',
    'Find the area bounded by $y = 4 - x^2$ and the x-axis for $-2 \\le x \\le 0$.',
    'Find the area bounded by $y = 4 - x^2$ and the x-axis in the first quadrant.',
    'Find half the area bounded by $y = 4 - x^2$ and the x-axis.',
    'Find the area bounded by $y = 4 - x^2$ and the x-axis to the right of the origin.',
    'Find the area bounded by $y = 4 - x^2$ and the x-axis on the positive side.',
    'The curve $y = 4 - x^2$ is reflected in the x-axis. Find the area bounded by the curve and the x-axis.',
    'Find the area bounded by $y = 4 - x^2$ and the x-axis above the line $y = 1$.',
    'Find the area bounded by $y = 4 - x^2$ and the x-axis, correct to 2 decimal places.'
  ]) {
    ok(questionFacts({ prompt })?.area === null || questionFacts({ prompt }) === null, `no area form: ${prompt.slice(0, 70)}`);
    ok(S(prompt, ['Area = ∫_-2^2 (4 - x^2) dx']) === '.', `the area integral is not ticked: ${prompt.slice(0, 70)}`);
  }
  for (const prompt of [
    'Find the area bounded by $y = 4 - x^2$ and the x-axis.',
    'Calculate the area bounded by the curve $y = 4 - x^2$ and the x-axis.',
    'Determine the exact area enclosed by the parabola $y = 4 - x^2$ and the x-axis.',
    'Find the area bounded by the graph of $y = 4 - x^2$ and the x-axis.',
    'Find the area bounded by the x-axis and $y = 4 - x^2$.',
    'Find the area between $y = 4 - x^2$ and the x-axis.',
    'The curve $y = 4 - x^2$. Find the area enclosed by the curve and the x-axis.',
    'The parabola $y = 4 - x^2$. Calculate the area bounded by the parabola and the x-axis.',
    'Find the area bounded by $y = 4 - x^2$ and the x-axis. Give your answer as an exact value.',
    'The curve $y = 4 - x^2$ and the x-axis bound a region. Find its area.'
  ]) ok(S(prompt, ['Area = ∫_-2^2 (4 - x^2) dx']) === 'T', `a plain prompt still ticks: ${prompt.slice(0, 70)}`);

  // prompts that cannot be read: exactly as without facts
  const SAMEAS = (prompt, lines) => JSON.stringify(stepCheckArithmetic(lines.join('\n'), { facts: questionFacts({ prompt }) })) === JSON.stringify(stepCheckArithmetic(lines.join('\n')));
  ok(questionFacts({ prompt: 'Describe the shape of $\\text{this}$ graph in words.' }) === null, 'a prompt with TeX that cannot be converted has no facts');
  ok(SAMEAS('Show that $\\sqrt{\\text{foo}}$ is irrational.', ['y = 2x', 'y = 2x(4 - x)']), 'unreadable expression: exactly as today');
  ok(SAMEAS('Explain why the sky is blue.', ['y = 2x(4 - x)', '2 + 2 = 4']) && questionFacts({ prompt: 'Explain why the sky is blue.' }) === null, 'a prompt with no maths: exactly as today');
  ok(SAMEAS('Find $\\begin{pmatrix}1\\\\2\\end{pmatrix}$ plus itself', ['y = 2x']), 'a matrix in the prompt: exactly as today');
  ok(JSON.stringify(stepCheckArithmetic('y = 2x(4 - x)', { facts: null })) === JSON.stringify(stepCheckArithmetic('y = 2x(4 - x)')) && JSON.stringify(stepCheckArithmetic('y = 2x(4 - x)', { facts: {} })) === JSON.stringify(stepCheckArithmetic('y = 2x(4 - x)')), 'null or empty facts change nothing');
  ok(S(AREA, ['2 + 2 = 4', '3 × 4 = 13']) === 'TX', 'false arithmetic is still crossed with facts');
  ok(JSON.stringify(stepCheckArithmetic('x', { facts: { defs: 'nonsense', equations: 5, asks: [null, 7], integrals: {} } })) === JSON.stringify(stepCheckArithmetic('x')), 'malformed facts are ignored');

  // a given name reused by the student for something else after a part label
  const REUSE = 'The curve $y = 2x(4 - x)$. (a) Find where it meets the x-axis. (b) Find the area bounded by the curve and the x-axis.';
  ok(S(REUSE, ['(a) y = 0', '2x(4 - x) = 0', '(b) y = 5', 'y(2) = 8']) === '....', 'after a part label y is the student\'s: nothing is read from the question (no tick, no cross)');
  ok(S(REUSE, ['y = 2x(4 - x)', '(b) y = 3x', 'y(2) = 9']) === 'T..', 'a reused name is never crossed against the question');
  ok(S(REUSE, ['(b) y = x^2', 'y(3) = 9', 'y(3) = 10']) === '.T.', 'a reused name is held to the student\'s own page only');
  ok(noteOf(REUSE, ['(b) y = 3x(4 - x)'], 0) !== MISMATCH, 'after a part label a near copy gets no "check you copied it" note');
  ok(S(REUSE, ['y = 0', '8x - 2x^2 = 0']) === '..', 'y = 0 is solving, not a miscopy');

  // an answer is never ticked from the question's facts
  ok(S(AREA, ['64/3']) === '.' && S(AREA, ['Area = 64/3']) === '.', 'the answer on its own is not given by the question');
  ok(!P(AREA, PAGE5).lines.some(l => /mark|correct method|right step/i.test(l.note || '')), 'no tick says a mark or the right step');
  // with the reader's TeX as well
  ok(code(keep(stepCheckArithmetic(['y = 2x(4 - x)', 'Area = ∫_0^4 2x(4 - x) dx'].join('\n'), { facts: questionFacts({ prompt: AREA }), latex: [{ text: 'y = 2x(4 - x)', latex: 'y = 2x(4 - x)' }] }))) === 'TT', 'the TeX second reading and the facts together');
}

// ── chains the reader leaves in forms the line reader did not take (22 November 2026): tick only ─────────────────────────────────
{
  const T = lines => stepCheckArithmetic(lines.join('\n')).lines.map(l => (l.status === 'ok' ? 'T' : l.status === 'break' ? 'X' : '.')).join('');
  // a substitution in front, then a continuation: the expression is what the next line is held to; the substitution line itself states nothing
  ok(T(['d′ = 6t^2 + 8t + 5', 't = 4: 6(16) + 8(4) + 5', '= 96 + 32 + 5', '= 133']) === '...TT'.slice(1), 'substitution `t = 4:`: the bare expression is a note, the next lines tick');
  ok(T(['t = 4: 6(16) + 8(4) + 5', '= 96 + 32 + 6']) === '..', 'substitution: a false continuation is a note, never a cross');
  ok(!/X/.test(T(['x = 3: 2(3) + 1 = 8'])), 'a false line after a substitution is a note, never a cross');
  ok(T(['x = 3π/16: y′ = 4cos(3π/4)', '= 4(-√2/2)']) === '.T', 'a substitution with π in front of a derivative value, then its value');
  // limits in brackets, and a function with no bracket in an integrand
  ok(T(['∫_(π/4)^(π/3) 2sin2x dx', '= [-cos2x]_(π/4)^(π/3)', '= -cos(2π/3) + cos(π/2)']) === '.TT', 'an integral with bracketed limits and 2sin2x, then its bracket and its values');
  ok(T(['∫_(π/4)^(π/3) 2sin2x dx', '= [-cos2x]_(π/4)^(π/3) + 1']) === '..', 'a false bracket is a note, never a cross');
  // a times sign after a factorial
  ok(T(['4! x 3!', '= 24 x 6', '= 144']) === '.TT', '4! x 3! is 24 x 6 is 144');
  ok(T(['4! x 3!', '= 24 x 7']) === '.X', '4! x 3! is not 24 x 7: false arithmetic is crossed as it always is');
  // column vectors written with a slash by the reader: only where the fraction reading is not true and the vector reading is
  const VEC = ['|4a+3b|', '= |4[-5,-1]+3[-2,4]|', '= |[-20 - 6/-4 + 12]|', '196', '+64', '260', '= |[14/8]| = sqrt(14^2+8^2)', '= sqrt(260)'];
  const vr = stepCheckArithmetic(VEC.join('\n')).lines;
  ok(vr[2].status === 'ok' && /equals the line above/.test(vr[2].note), `the slash column |[-20 - 6/-4 + 12]| equals the line above (${vr[2].note})`);
  ok(vr[6].status === 'note' && vr[6].vectorWarning === true && /agree/.test(vr[6].note) && /does not equal the earlier line/.test(vr[6].note), `|[14/8]| is a warning note: its two sides agree but it is not the earlier length (${vr[6].note})`);
  ok(vr.every(l => l.status !== 'break'), 'the slash page: nothing is crossed');
  ok(T(['|[3/4]| = 5']) === '.', '|[3/4]| = 5 with no other vector on the page is not read as a column');
  ok(T(['2[3/4] = 3/2']) === 'T' && T(['|[3/4]| = 3/4']) === '.', 'an ordinary fraction in square brackets is untouched');
  ok(T(['|[3/4]| = 3/4', '= 3/4']) !== undefined && stepCheckArithmetic(['|[3/4]| = 3/4'].join('\n')).lines[0].note === stepCheckArithmetic(['|[3/4]| = 3/4'].join('\n')).lines[0].note, '[3/4] inside bars with a true fraction reading is left as it was');
}

console.log(`ARITHMETIC LINES: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — false arithmetic crossed, true arithmetic ticked as arithmetic only, no mark from it`);
if (fail) process.exit(1);
