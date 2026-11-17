// Pri Learning · Step Check on exponential and logarithmic equations
//
// A line of working is correct when its complete real solution set, on its own
// real domain, is exactly the question's (root consistency). This gate pins:
//   • the solution-set proofs in reason-explog.js, including the real-domain
//     rule that every logarithm's argument is positive;
//   • correct chains are verified line by line;
//   • each classic slip is a break on the line where it happens;
//   • a line that combines logarithms and so lets in a value outside the
//     domain is a valid step, but working that never rejects that value is not
//     credited as a finished answer, and keeping the value is a break;
//   • anything outside the proved families stays a note: abstain, never guess.

import { parse, normalize } from '../src/engine/expr.js';
import { stepCheck } from '../src/engine/checker.js';
import { expLogSolutionSet, completeRealRoots, isExpLogLine } from '../src/engine/reason-explog.js';

let pass = 0;
let fail = 0;
const failures = [];
const ok = (label, cond) => { if (cond) pass++; else { fail++; failures.push(label); } };

console.log('STEP CHECK — exponential and logarithmic equations\n');

// ── 1. Solution sets ─────────────────────────────────────────────────────────
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
function solves(text, want, hints = want) {
  const got = expLogSolutionSet(parse(normalize(text)), 'x', hints);
  const good = got && got.roots.length === want.length && want.slice().sort((a, b) => a - b).every((w, i) => close(got.roots[i], w));
  ok(`solution set of ${text}: got ${JSON.stringify(got?.roots)}, want ${JSON.stringify(want)}`, good);
}
function abstains(text, hints = []) {
  const got = expLogSolutionSet(parse(normalize(text)), 'x', hints);
  ok(`abstains on ${text}: got ${JSON.stringify(got)}`, got === null);
}

solves('2^(x+1)=32', [4]);
solves('2*2^x=32', [4]);
solves('9^x=3^(x+2)', [2]);
solves('3^(2x)=3^(x+2)', [2]);
solves('2^(2x)=2^3', [1.5]);
solves('e^(2x)=7', [Math.log(7) / 2]);
solves('exp(x)=3', [Math.log(3)]);
solves('5^x=20', [Math.log(20) / Math.log(5)]);
solves('2^(2x)-5*2^x+4=0', [0, 2]);
solves('(2^x-1)(2^x-4)=0', [0, 2]);
solves('4^x-2^(x+1)-8=0', [2]);              // t = 2^x: t² − 2t − 8 = 0, t = −2 is no power of 2
solves('2^x=-4', [], []);                    // no real solution at all
solves('2^(-x)=8', [-3]);
solves('log(x+5)=2', [95]);
solves('ln(2x+4)=ln(x+7)', [3]);
solves('log(x)-log(2)=1', [20]);
solves('ln(x^3)=6', [Math.E ** 2]);
solves('3ln(x)=6', [Math.E ** 2]);
solves('ln(x)+ln(x-3)=ln(10)', [5]);         // x = −2 makes ln x undefined
solves('ln(x(x-3))=ln(10)', [5, -2], [5]);   // combined: −2 is now in the domain
solves('2ln(x)=ln(9)', [3]);
solves('ln(x^2)=ln(9)', [3, -3], [3]);
solves('log(x)+log(x-2)=log(8)', [4]);
solves('ln(x-1)-ln(x+1)=ln(2)', [], []);     // (x−1)/(x+1) = 2 gives x = −3, outside the domain
solves('x*ln(5)=ln(20)', [Math.log(20) / Math.log(5)]);
solves('x^2-3x-10=0', [5, -2], [5]);
abstains('x*2^x=8', [2]);                    // the unknown in and out of an exponent
abstains('2^x+3^x=13', [2]);                 // two unrelated rates
abstains('ln(x)=x-2', [3.146]);              // the unknown in and out of a logarithm
abstains('ln(x)+log(x+1)=1', [1]);           // natural and common logarithms of different arguments
abstains('ln(ln(x))=1', [Math.E ** Math.E]);
abstains('x^x=4', [2]);
abstains('2^(x^2)=16', [2, -2]);             // exponent not affine
abstains('ln(x)=ln(x)', [1]);                // an identity on its domain has no finite set
abstains('2^x=y', [1]);                      // another letter
abstains('ln(x^3)=6', []);                   // a cubic with nothing to divide out
ok('completeRealRoots refuses a quartic it cannot reduce', completeRealRoots([1, 0, 0, 1, 1]) === null);
ok('isExpLogLine sees an exponent', isExpLogLine(parse('3^(x+1)=9'), 'x'));
ok('isExpLogLine ignores a constant log', !isExpLogLine(parse('x*ln(5)=ln(20)'), 'x'));

// ── 2. Step Check on whole working ──────────────────────────────────────────
const eqMeta = (solutions, extra = {}) => ({ kind: 'equation', variable: 'x', solutions, ...extra });
const statuses = (meta, lines, options = null) => stepCheck(meta, lines.join('\n'), options).lines.map(l => l.status);
const report = (meta, lines) => stepCheck(meta, lines.join('\n'));

function allOk(label, meta, lines) {
  const s = statuses(meta, lines);
  ok(`${label}: every line verified, got ${JSON.stringify(s)}`, s.length === lines.length && s.every(v => v === 'ok'));
}
function breaksAt(label, meta, lines, at, code = null) {
  const rep = report(meta, lines);
  const s = rep.lines.map(l => l.status);
  const first = s.indexOf('break');
  ok(`${label}: first break at line ${at + 1}, got ${JSON.stringify(s)}`, first === at && rep.firstBreak === at);
  ok(`${label}: nothing before the break is a break and the lines before it are verified, got ${JSON.stringify(s)}`, s.slice(0, at).every(v => v === 'ok'));
  if (code) ok(`${label}: diagnosis ${code}, got ${rep.lines[at]?.diagnosis?.code}`, rep.lines[at]?.diagnosis?.code === code);
}

// Correct chains.
allOk('2^(x+1) = 32', eqMeta([4]), ['2^(x+1)=32', '2*2^x=32', '2^x=16', 'x=4']);
allOk('9^x = 3^(x+2)', eqMeta([2]), ['9^x=3^(x+2)', '3^(2x)=3^(x+2)', '2x=x+2', 'x=2']);
allOk('4^x = 8', eqMeta([1.5]), ['4^x=8', '2^(2x)=2^3', '2x=3', 'x=1.5']);
allOk('5^x = 20 by logarithms', eqMeta([Math.log(20) / Math.log(5)]), ['5^x=20', 'x*ln(5)=ln(20)', 'x=ln(20)/ln(5)']);
allOk('5^x = 20 with common logarithms', eqMeta([Math.log(20) / Math.log(5)]), ['5^x=20', 'x*log(5)=log(20)', 'x=log(20)/log(5)']);
allOk('e^(2x) = 7', eqMeta([Math.log(7) / 2]), ['e^(2x)=7', '2x=ln(7)', 'x=ln(7)/2']);
allOk('2^(2x) − 5·2^x + 4 = 0 by branches', eqMeta([0, 2]), ['2^(2x)-5*2^x+4=0', '(2^x-1)(2^x-4)=0', '2^x=1', 'x=0', '2^x=4', 'x=2']);
allOk('4^x − 2^(x+1) − 8 = 0', eqMeta([2]), ['4^x-2^(x+1)-8=0', '(2^x)^2-2*2^x-8=0', '(2^x-4)(2^x+2)=0', '2^x=4', 'x=2']);
allOk('log(x+5) = 2', eqMeta([95]), ['log(x+5)=2', 'x+5=100', 'x=95']);
allOk('log x − log 2 = 1', eqMeta([20]), ['log(x)-log(2)=1', 'log(x/2)=1', 'x/2=10', 'x=20']);
allOk('ln(x^3) = 6', eqMeta([Math.E ** 2]), ['ln(x^3)=6', '3ln(x)=6', 'ln(x)=2', 'x=e^2']);
allOk('ln(2x+4) = ln(x+7)', eqMeta([3]), ['ln(2x+4)=ln(x+7)', '2x+4=x+7', 'x=3']);
allOk('authored exact solution text', eqMeta(['ln(7)/2']), ['e^(2x)=7', '2x=ln(7)', 'x=ln(7)/2']);
allOk('authored source', eqMeta([4], { source: '2^(x+1)=32' }), ['2^(x+1)=32', '2^x=16', 'x=4']);

// Combining logarithms: valid steps, the extraneous value rejected at the end.
{
  const lines = ['ln(x)+ln(x-3)=ln(10)', 'ln(x(x-3))=ln(10)', 'x^2-3x-10=0', '(x-5)(x+2)=0', 'x=5'];
  const rep = report(eqMeta([5]), lines);
  const s = rep.lines.map(l => l.status);
  ok(`log product rule then x = 5: all verified, got ${JSON.stringify(s)}`, s.every(v => v === 'ok') && rep.firstBreak === -1);
  ok('the combined line says x = −2 is still to be rejected', /x = -2/.test(rep.lines[1].note || '') && /reject/.test(rep.lines[1].note || ''));
  ok('the final line carries no pending note', !rep.lines[4].note);
}
allOk('log x + log(x−2) = log 8, x = 4', eqMeta([4]), ['log(x)+log(x-2)=log(8)', 'log(x(x-2))=log(8)', 'x^2-2x=8', '(x-4)(x+2)=0', 'x=4']);
{
  // The working stops with the extraneous value still allowed: not a finished answer.
  const lines = ['ln(x)+ln(x-3)=ln(10)', 'ln(x(x-3))=ln(10)', 'x^2-3x-10=0', '(x-5)(x+2)=0'];
  const rep = report(eqMeta([5]), lines);
  const s = rep.lines.map(l => l.status);
  ok(`unrejected extraneous root: no break, got ${JSON.stringify(s)}`, !s.includes('break'));
  ok(`unrejected extraneous root: the last line is not credited, got ${s[3]}`, s[3] === 'note');
  ok('unrejected extraneous root: the last line names the value and the extraneous-solution diagnosis',
    /x = -2/.test(rep.lines[3].note || '') && rep.lines[3].diagnosis?.code === 'extraneous-solution');
  const s2 = statuses(eqMeta([3]), ['2ln(x)=ln(9)', 'ln(x^2)=ln(9)', 'x^2=9', '(x-3)(x+3)=0']);
  ok(`2 ln x = ln 9 stopping at (x−3)(x+3)=0: last line not credited, got ${JSON.stringify(s2)}`, s2[3] === 'note' && !s2.includes('break'));
}

// Slips: each a break on its own line.
breaksAt('log of a sum', eqMeta([95]), ['log(x+5)=2', 'log(x)+log(5)=2', 'log(5x)=2', '5x=100', 'x=20'], 1, 'function-of-sum');
breaksAt('power slip: 2^(x+1) read as 2^x + 2', eqMeta([4]), ['2^(x+1)=32', '2^x+2=32', '2^x=30'], 1);
breaksAt('power slip: coefficient into the base', eqMeta([4]), ['3*2^x=48', '6^x=48'], 1);
breaksAt('power slip: 4^x written as 2^(x+2)', eqMeta([1.5]), ['4^x=8', '2^(x+2)=2^3', 'x+2=3', 'x=1'], 1);
breaksAt('exponents equated with different bases', eqMeta([2]), ['3^(2x-1)=27', '2x-1=9', 'x=5'], 1);
breaksAt('base change inverted', eqMeta([Math.log(20) / Math.log(5)]), ['5^x=20', 'x=ln(5)/ln(20)'], 1);
breaksAt('base change: log of a quotient', eqMeta([Math.log(20) / Math.log(5)]), ['5^x=20', 'x*ln(5)=ln(20)', 'x=ln(20)-ln(5)'], 2);
breaksAt('base change: divided inside the log', eqMeta([Math.log(7) / 2]), ['e^(2x)=7', 'x=ln(7/2)'], 1);
breaksAt('dropped ln', eqMeta([Math.log(7) / 2]), ['e^(2x)=7', '2x=7', 'x=3.5'], 1);
breaksAt('dropped ln on a logarithm', eqMeta([Math.E ** 2 - 1]), ['ln(x+1)=2', 'x+1=2', 'x=1'], 1);
breaksAt('log quotient misread', eqMeta([20]), ['log(x)-log(2)=1', 'log(x)/log(2)=1', 'x=2'], 1);
breaksAt('log of a product misread', eqMeta([100]), ['log(10x)=3', '10log(x)=3'], 1);
breaksAt('extraneous root kept in the answer', eqMeta([5]), ['ln(x)+ln(x-3)=ln(10)', 'ln(x(x-3))=ln(10)', 'x^2-3x-10=0', '(x-5)(x+2)=0', 'x=5 or x=-2'], 4, 'extraneous-solution');
breaksAt('extraneous root given as the answer', eqMeta([5]), ['ln(x)+ln(x-3)=ln(10)', 'x(x-3)=10', 'x=-2'], 2);
breaksAt('a value the exponential allows brought in by squaring', eqMeta([2]), ['2^x=4', 'x^2=4', 'x=2'], 1, 'extraneous-solution');
breaksAt('wrong factor beside a right one', eqMeta([0, 2]), ['2^(2x)-5*2^x+4=0', '(2^x-1)(2^x-4)=0', '(2^x-1)(2^x-8)=0'], 2, 'extraneous-solution');
breaksAt('a branch lost', eqMeta([0, 2]), ['2^(2x)-5*2^x+4=0', '(2^x-1)(2^x-4)=0', '2^x=4', 'x=2'], 2, 'lost-root');

// Review of head df72d5348 (PR #1027): wrong algebra inside a chain that is
// still carrying a rejected value. Each new value must be checked against the
// line above, not only against the domain of the verified log line.
breaksAt('wrong factorisation after combining logs', eqMeta([5]), ['ln(x)+ln(x-3)=ln(10)', 'x^2-3x-10=0', '(x-5)(x+3)=0', 'x=5'], 2, 'extraneous-solution');
breaksAt('wrong factorisation after x(x−3) = 10', eqMeta([5]), ['log(x)+log(x-3)=1', 'x(x-3)=10', 'x^2-3x-10=0', '(x-5)(x+1)=0', 'x=5'], 3, 'extraneous-solution');
breaksAt('wrong expansion after combining logs', eqMeta([5]), ['ln(x)+ln(x-3)=ln(10)', 'x(x-3)=10', 'x^2-4x-5=0', '(x-5)(x+1)=0', 'x=5'], 2, 'extraneous-solution');
breaksAt('wrong factorisation, ln x + ln(x+2) = ln 15', eqMeta([3]), ['ln(x)+ln(x+2)=ln(15)', 'x^2+2x-15=0', '(x-3)(x+4)=0', 'x=3'], 2, 'extraneous-solution');
breaksAt('the rejected value swapped for another', eqMeta([5]), ['ln(x)+ln(x-3)=ln(10)', 'x^2-3x-10=0', '(x-5)(x+2)=0', '(x-5)(x-1)=0', 'x=5'], 3, 'extraneous-solution');
breaksAt('wrong factorisation after ln(x^2)', eqMeta([2]), ['2ln(x)=ln(4)', 'ln(x^2)=ln(4)', 'x^2=4', '(x-2)(x+3)=0', 'x=2'], 3, 'extraneous-solution');
{
  // Multiplying through by x − 1 lets in x = 1, which is not a root of the
  // line above with its domain dropped (x + 2 = 4(x − 1)): not confirmed, so a
  // note; and nothing after it is credited on the strength of it.
  const s = statuses(eqMeta([2]), ['ln(x+2)-ln(x-1)=ln(4)', '(x+2)(x-1)=4(x-1)^2', '(x-2)(x+0.5)=0', 'x=2']);
  ok(`clearing a log quotient by multiplying is not credited, got ${JSON.stringify(s)}`, s[0] === 'ok' && s[1] === 'note' && s[2] !== 'ok');
}
// Review of head f6c8c377a: a wrong factorisation straight after a log line.
// The value it lets in is outside the log's domain, but it is not a root of
// the log line with its domain dropped, so it is never credited.
function notCredited(label, meta, lines, at, options = null) {
  const s = statuses(meta, lines, options);
  ok(`${label}: line ${at + 1} is not credited, got ${JSON.stringify(s)}`, s[at] === 'note' && s.slice(0, at).every(v => v === 'ok'));
}
notCredited('(x−5)(x+3) straight after ln x + ln(x−3) = ln 10', eqMeta([5]), ['ln(x)+ln(x-3)=ln(10)', '(x-5)(x+3)=0', 'x=5'], 1);
notCredited('x(x−5) straight after ln x + ln(x−3) = ln 10', eqMeta([5]), ['ln(x)+ln(x-3)=ln(10)', 'x(x-5)=0', 'x=5'], 1);
notCredited('x²−4x−5 straight after ln x + ln(x−3) = ln 10', eqMeta([5]), ['ln(x)+ln(x-3)=ln(10)', 'x^2-4x-5=0', 'x=5'], 1);
notCredited('(x−2)(x+3) straight after ln x = ln 2', eqMeta([2]), ['ln(x)=ln(2)', '(x-2)(x+3)=0', 'x=2'], 1);
notCredited('(x−10)(x+1) straight after log x = 1', eqMeta([10]), ['log(x)=1', '(x-10)(x+1)=0', 'x=10'], 1);
notCredited('(x−4)(x+1) straight after ln(x+4) − ln x = ln 2', eqMeta([4]), ['ln(x+4)-ln(x)=ln(2)', '(x-4)(x+1)=0', 'x=4'], 1);
notCredited('(x−5)(x−1) after ln(x(x−3)) = ln 10', eqMeta([5]), ['ln(x)+ln(x-3)=ln(10)', 'ln(x(x-3))=ln(10)', '(x-5)(x-1)=0', 'x=5'], 2);
notCredited('an extra factor in a two-root question', eqMeta([1, 4]), ['ln(x)+ln(5-x)=ln(4)', '(x-1)(x-4)(x-6)=0', 'x=1 or x=4'], 1);
notCredited('an extra factor x after ln(x^2) = ln 9', eqMeta([3, -3]), ['ln(x^2)=ln(9)', '(x-3)(x+3)x=0', 'x=3 or x=-3'], 1);
// With an authored source the established checks decide it, as on main: a break.
breaksAt('the same with the question as source', eqMeta([5], { source: 'ln(x)+ln(x-3)=ln(10)' }), ['ln(x)+ln(x-3)=ln(10)', '(x-5)(x+3)=0', 'x=5'], 1, 'extraneous-solution');
notCredited('a wrong first line that is not the question', eqMeta([2], { source: '4^x-2*2^x-8=0' }), ['(2^x-4)(2^x+3)=0', '2^x=4', 'x=2'], 0);
notCredited('a wrong first line against the question in the prompt', eqMeta([2]), ['(2^x-4)(2^x+3)=0', '2^x=4', 'x=2'], 0, { prompt: 'Solve $4^x - 2 \\cdot 2^x - 8 = 0$.' });
{
  const s = statuses(eqMeta([2]), ['(2^x-4)(2^x+2)=0', '2^x=4', 'x=2'], { prompt: 'Solve $4^x - 2 \\cdot 2^x - 8 = 0$.' });
  ok(`the right factorisation as the first line, against the prompt, is credited, got ${JSON.stringify(s)}`, s.every(v => v === 'ok'));
}
// An exponential is defined everywhere: overflow at a large value is not a domain.
breaksAt('a far root after 10^(3x) = 1000', eqMeta([1]), ['10^(3x)=1000', '(x-1)(x-150)=0', 'x=1'], 1);
breaksAt('a far root after 2^x = 4', eqMeta([2]), ['2^x=4', '(x-2)(x-2000)=0', 'x=2'], 1);
breaksAt('a far root after e^x = e^2', eqMeta([2]), ['e^x=e^2', '(x-2)(x-800)=0', 'x=2'], 1);
breaksAt('a far negative root after 2^(−x) = 1/4', eqMeta([2]), ['2^(-x)=1/4', '(x-2)(x+1100)=0', 'x=2'], 1);
{
  // A wrong factor with no real root has the right solutions but is not the
  // line above: it is not credited (the polynomial path abstains the same way).
  const s = statuses(eqMeta([2]), ['4^x-2^(x+1)-8=0', '(2^x-4)(2^x+2)=0', '(2^x-4)(2^x+3)=0', '2^x=4', 'x=2']);
  ok(`(2^x−4)(2^x+3) after (2^x−4)(2^x+2) is not credited, got ${JSON.stringify(s)}`, s[2] !== 'ok' && s[1] === 'ok');
  const s2 = statuses(eqMeta([2]), ['4^x-2^(x+1)-8=0', '(2^x-4)(2^x+5)=0']);
  ok(`(2^x−4)(2^x+5) is not credited, got ${JSON.stringify(s2)}`, s2[1] !== 'ok');
  // A list-shaped authored solution is not read as one number ("2, 3" is not 23).
  const s3 = statuses(eqMeta(['2, 3']), ['x^2-5x+6=0', 'x=23']);
  ok(`"2, 3" is not read as 23, got ${JSON.stringify(s3)}`, s3[1] !== 'ok');
}

// Review of head 641d12f4e: e in a question with two roots is never a new
// false rejection; an exponential line naming some roots is a branch.
{
  const E2 = Math.E ** 2;
  let s = statuses(eqMeta([1, E2]), ['x=1', 'x=e^2']);
  ok(`x = 1, x = e^2 for roots 1 and e^2: both verified, got ${JSON.stringify(s)}`, s.every(v => v === 'ok'));
  s = statuses(eqMeta([1, E2]), ['x=1', 'x=e^2'], { prompt: 'Solve $(\\ln x)^2 = 2\\ln x$.' });
  ok(`the same with a prompt, got ${JSON.stringify(s)}`, s.every(v => v === 'ok'));
  s = statuses(eqMeta([Math.E, E2]), ['(ln(x))^2-3ln(x)+2=0', '(ln(x)-1)(ln(x)-2)=0', 'x=e', 'x=e^2']);
  ok(`quadratic in ln x: no break, got ${JSON.stringify(s)}`, !s.includes('break'));
  s = statuses(eqMeta([0, 2]), ['e^x=1', 'x=0', 'e^x=e^2', 'x=2']);
  ok(`e^x = 1 and e^x = e^2 as branches: all verified, got ${JSON.stringify(s)}`, s.every(v => v === 'ok'));
  s = statuses(eqMeta([0, 2]), ['e^x=1', 'x=0', 'e^x=e^2', 'x=2'], { prompt: 'Solve $(e^x-1)(e^x-e^2)=0$.' });
  ok(`the same with a prompt, got ${JSON.stringify(s)}`, s.every(v => v === 'ok'));
  const rep = report(eqMeta([0, Math.log(3)]), ['e^x=3', 'x=ln(3)']);
  ok(`one root of two named alone: true, still to find, no break, got ${JSON.stringify(rep.lines.map(l => l.status))}`,
    rep.firstBreak === -1 && rep.lines.every(l => l.status === 'ok' && /still to find/.test(l.note || '')));
  s = statuses(eqMeta([0, 2]), ['2^x=4', '2^x=1']);
  ok(`2^x = 4 then 2^x = 1 for roots 0 and 2: both branches, got ${JSON.stringify(s)}`, s.every(v => v === 'ok'));
  s = statuses(eqMeta([1, 2]), ['e^2 x = 1e^2']);
  ok(`e^2·x = e^2 with roots 1 and 2 is not a break, got ${JSON.stringify(s)}`, s[0] !== 'break');
  // A rounded intermediate line is held to the value, as on main.
  breaksAt('a rounded intermediate line', eqMeta([Math.log(3) / Math.log(2)]), ['2^x=3', '2x=3.17', 'x=1.585'], 1);
  // "2 3" is not read as 23.
  s = statuses(eqMeta(['2 3']), ['x=6', 'x=23']);
  ok(`"2 3" is not read as 23, got ${JSON.stringify(s)}`, s[1] !== 'ok' && s[0] !== 'break');
}

// Review of head 362570240: an exponential or logarithmic product that loses
// a root is a lost-root break, as a polynomial product is; only a line with
// one linear factor names a single root on its own.
breaksAt('wrong factor loses a root', eqMeta([0, 2]), ['4^x-5*2^x+4=0', '(2^x-1)(2^x+3)=0', 'x=0', 'x=2'], 1);
breaksAt('wrong factor loses a root, with source', eqMeta([0, 2], { source: '4^x-5*2^x+4=0' }), ['4^x-5*2^x+4=0', '(2^x-1)(2^x+3)=0', 'x=0', 'x=2'], 1);
breaksAt('2^x(2^x−1) loses a root', eqMeta([0, 2]), ['4^x-5*2^x+4=0', '2^x(2^x-1)=0', 'x=0'], 1);
breaksAt('(2^x−4)^2 loses a root', eqMeta([0, 2]), ['4^x-5*2^x+4=0', '(2^x-4)^2=0', 'x=2'], 1);
breaksAt('(2^x−4)(2^x+1) loses a root', eqMeta([0, 2]), ['4^x-5*2^x+4=0', '(2^x-4)(2^x+1)=0', 'x=2'], 1);
{
  const rep = report(eqMeta([0, 2]), ['(2^x-1)(2^x+3)=0', 'x=0', 'x=2'], { prompt: 'Solve $4^x-5\\cdot 2^x+4=0$.' });
  ok(`a first line that loses a root breaks, with a prompt, got ${JSON.stringify(rep.lines.map(l => l.status))}`, rep.firstBreak === 0);
  const rep2 = report(eqMeta([0, 2]), ['(2^x-1)(2^x-5)=0', '2^x=1', 'x=0', 'x=2']);
  ok(`a wrong first factorisation breaks, got ${JSON.stringify(rep2.lines.map(l => l.status))}`, rep2.firstBreak === 0);
  const rep3 = report(eqMeta([1, 100]), ['log(x)(log(x)-3)=0']);
  ok(`log x (log x − 3) = 0 for roots 1 and 100 breaks, got ${JSON.stringify(rep3.lines.map(l => l.status))}`, rep3.firstBreak === 0);
  const s = statuses(eqMeta([1, 100]), ['log(x)(log(x)-2)=0', 'log(x)=0', 'x=1', 'log(x)=2', 'x=100']);
  ok(`log x (log x − 2) = 0 by branches: no break, branches verified, got ${JSON.stringify(s)}`, !s.includes('break') && s.slice(1).every(v => v === 'ok'));
}

// Review of head e335858e8: a line worked from an exponential or logarithmic
// branch must keep that branch's root (x = 1 straight after 3^x = 9 is wrong
// even though 1 is the other root).
breaksAt('x = 1 straight after 3^x = 9', eqMeta([2, 1]), ['(3^x-9)(3^x-3)=0', '3^x=9', 'x=1', '3^x=3', 'x=1'], 2);
breaksAt('answers swapped across branches', eqMeta([0, 2]), ['(2^x-1)(2^x-4)=0', '2^x=1', 'x=2', '2^x=4', 'x=0'], 2);
breaksAt('a root repeated across branches', eqMeta([0, 2]), ['4^x-5*2^x+4=0', '(2^x-1)(2^x-4)=0', '2^x=1', 'x=2', '2^x=4', 'x=2'], 3);
breaksAt('lone branches with the wrong value', eqMeta([0, 2]), ['2^x=4', 'x=0', '2^x=1', 'x=0'], 1);
{
  const rep = report(eqMeta([1, 100]), ['log(x)(log(x)-2)=0', 'log(x)=0', 'x=100', 'log(x)=2', 'x=100']);
  ok(`a log branch with the wrong value breaks on that line, got ${JSON.stringify(rep.lines.map(l => l.status))}`, rep.firstBreak === 2 && !rep.lines.slice(0, 2).some(l => l.status === 'break'));
}
{
  const s = statuses(eqMeta([2, 1]), ['(3^x-9)(3^x-3)=0', '3^x=9', 'x=1', '3^x=3', 'x=1'], { prompt: 'Solve $(3^x - 9)(3^x - 3) = 0$.' });
  ok(`x = 1 after 3^x = 9 breaks with a prompt too, got ${JSON.stringify(s)}`, s.indexOf('break') === 2);
  const s2 = statuses(eqMeta([1, 2]), ['(2^x-2)(2^x-4)=0', '2^x=2', 'x=1', '2^x=2', 'x=2']);
  ok(`a branch written twice never leaves the working without a break, got ${JSON.stringify(s2)}`, s2.includes('break'));
  const s3 = statuses(eqMeta([0, 2]), ['(2^x-1)(2^x-4)=0', '2^x=1', '2^x=4', 'x=0', 'x=2']);
  ok(`both branches written before their values: no false credit, got ${JSON.stringify(s3)}`, s3.includes('break') || s3.every(v => v === 'ok'));
}

// Abstain: lines outside the proved families are notes, never credit, never a break.
{
  const s = statuses(eqMeta([2]), ['x*2^x=8', '2^x=8/x']);
  ok(`x·2^x = 8 abstains, got ${JSON.stringify(s)}`, s.every(v => v === 'note'));
  const s2 = statuses(eqMeta([2]), ['2^x+3^x=13', '3^x=13-2^x']);
  ok(`2^x + 3^x = 13 abstains, got ${JSON.stringify(s2)}`, s2.every(v => v === 'note'));
  const s3 = statuses(eqMeta([Math.E ** Math.E]), ['ln(ln(x))=1', 'ln(x)=e']);
  ok(`ln(ln x) = 1 abstains on the nested line, got ${JSON.stringify(s3)}`, s3[0] === 'note');
}

// e is Euler's number when it is only ever a base, and still a letter otherwise.
{
  const rep = report(eqMeta([Math.log(3)]), ['e^x=3', 'x=ln(3)']);
  ok('e^x = 3 is not a line about another letter', !rep.lines[0].otherUnknown && rep.lines[0].status === 'ok');
  const rep2 = report(eqMeta([2]), ['x+e=5']);
  ok('a bare e is still another letter', rep2.lines[0].otherUnknown === true && rep2.lines[0].status === 'note');
}

// Deterministic: the same working is always marked the same way.
{
  const lines = ['ln(x)+ln(x-3)=ln(10)', 'ln(x(x-3))=ln(10)', 'x^2-3x-10=0', '(x-5)(x+2)=0'];
  const a = JSON.stringify(report(eqMeta([5]), lines));
  const b = JSON.stringify(report(eqMeta([5]), lines));
  ok('deterministic report', a === b);
}

const total = pass + fail;
if (fail) {
  console.log(failures.map(f => `  ✗ ${f}`).join('\n'));
  console.log(`\nSTEP CHECK EXP/LOG: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`STEP CHECK EXP/LOG: PASS — ${total}/${total} checks — exponential and logarithmic lines are verified when their complete real solution set on its domain is the question's, each slip tested here breaks on its own line or is not credited, an unrejected extraneous root is never credited, and anything else abstains.`);
