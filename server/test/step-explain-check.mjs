// Pri Learning · specific feedback on a ticked line (26 November 2026)
// Two owner pages (a 13-line arithmetic-series page and an 11-line geometric-growth page) went through the real marking path and read "True as written".
// This check pins what the page says now, line by line, and that nothing is said that the engine has not verified:
//   · explainStep: each statement is a verified change between two lines (arithmetic, brackets, expanding, collecting, factorising, cancelling, both sides, roots, derivative)
//   · altered numbers are never neutralised or ticked (816, ratio 3, n = 5, 2^4 = 8, 21 rows, swapped numbers in a sentence)
//   · a wrong line is never explained as right
import { readFileSync } from 'node:fs';
import { explainStep, explainLines } from '../../client/src/engine/stepExplain.js';
import { run, PAGES } from './support/teacher-page-run.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const say = (a, b) => { const r = explainStep({ above: a, line: b }); return r ? r.short : null; };

// ── the step explainer ───────────────────────────────────────────────────────
const CASES = [
  ['= 20(58 + 2(20 - 1))/2', '= 20(58 + 2(19))/2', '20 − 1 = 19'],
  ['= 20(58 + 2(19))/2', '= 20(58 + 38)/2', '2 × 19 = 38'],
  ['= 20(58 + 38)/2', '= 20(96)/2', '58 + 38 = 96'],
  ['= 20(96)/2', '= 1920/2', '20 × 96 = 1920'],
  ['= 1920/2', '= 960', '1920 ÷ 2 = 960'],
  ['= 815 × 2^4', '= 815 × 16', '2⁴ = 16'],
  ['y = 4x^3 - 36x^2', 'dy/dx = 12x^2 - 72x', '4x³ → 12x², −36x² → −72x'],
  ['12x(x - 6) = 0', '12x = 0 or x - 6 = 0', '12x = 0 or x − 6 = 0'],
  ['3x + 2 = 8', '3x = 6', 'Subtracted 2 from both sides'],
  ['3x = 6', 'x = 2', 'Divided both sides by 3'],
  ['5x = 2x + 6', '3x = 6', 'Subtracted 2x from both sides'],
  ['2x(x - 3)', '2x^2 - 6x', '2x(x − 3) = 2x² − 6x'],
  ['x^2 - 9', '(x - 3)(x + 3)', 'x² − 9 = (x − 3)(x + 3)'],
  ['3x + 2x + 5', '5x + 5', '3x + 2x = 5x'],
  ['y = 4x^3 - 36x^2', 'y = 4(6)^3 - 36(6)^2', 'Substituted x = 6']
];
for (const [a, b, want] of CASES) ok(say(a, b) === want, `${a} then ${b}: "${say(a, b)}" is "${want}"`);
// the sentence names the operation
ok(/^Worked out the bracket: /.test(explainStep({ above: '= 20(58 + 2(20 - 1))/2', line: '= 20(58 + 2(19))/2' }).sentence), 'a bracket is named');
ok(/^Expanded the brackets: /.test(explainStep({ above: '2x(x - 3)', line: '2x^2 - 6x' }).sentence), 'an expansion is named');
ok(/^Factorised using the difference of two squares: /.test(explainStep({ above: 'x^2 - 9', line: '(x - 3)(x + 3)' }).sentence), 'a difference of squares is named');
ok(/^Collected like terms: /.test(explainStep({ above: '3x + 2x + 5', line: '5x + 5' }).sentence), 'collecting is named');
// a wrong step is never explained: nothing is said unless the two lines are equal
for (const [a, b] of [['= 20(58 + 38)/2', '= 20(86)/2'], ['= 1920/2', '= 950'], ['3x + 2 = 8', '3x = 5'], ['2x(x - 3)', '2x^2 - 3x'], ['y = 4x^3 - 36x^2', 'dy/dx = 12x^2 - 36x'], ['x^2 - 9', '(x - 3)(x + 4)'], ['12x(x - 6) = 0', 'x = 0 or x = 5']]) ok(say(a, b) === null, `a false step is not explained: ${a} then ${b} gives ${say(a, b)}`);
// no em dash, no praise word in any sentence
for (const [a, b] of CASES) { const r = explainStep({ above: a, line: b }); ok(!/[—–]|\b(?:correct|good|well done|great|excellent)\b/i.test(r.sentence + r.short), `no praise or dash: ${r.sentence}`); }

// ── the two owner pages ──────────────────────────────────────────────────────
const phrases = o => o.page.lines.map(l => { const m = o.marks.find(x => x.n === l.n); return m ? m.phrase : null; });
const seats = run('seats');
ok(seats.tally === '8 lines correct. 0 wrong. 0 not checked.', `seats tally: ${seats.tally}`);
ok(JSON.stringify(phrases(seats)) === JSON.stringify([null, 'Given in the question', null, null, 'Substituted n = 20 into n(58 + 2(n − 1))/2', '20 − 1 = 19', '2 × 19 = 38', '58 + 38 = 96', '20 × 96 = 1920', '1920 ÷ 2 = 960', 'Correct answer']), `seats phrases ${JSON.stringify(phrases(seats))}`);
ok(seats.page.lines[3].card.tickClass === 'method-stated' && seats.page.lines[3].status === 'condition', 'the method statement is neutral: not a tick, not unchecked');
ok(seats.page.lines[0].status === 'condition' && seats.page.lines[2].status === 'condition', 'the title and the restated formula are neutral');
const users = run('users');
ok(users.tally === '8 lines correct. 0 wrong. 0 not checked.', `users tally: ${users.tally}`);
ok(JSON.stringify(phrases(users)) === JSON.stringify([null, 'Given in the question', 'Common ratio 2, from the question', null, null, 'Correct model: start 815, ×2 each week', 'n = 4, from the question', 'Substituted n = 4 into 815 × 2^n', '2⁴ = 16', '815 × 16 = 13\u00a0040', 'Correct answer']), `users phrases ${JSON.stringify(phrases(users))}`);
ok(users.rep.answerLine === 10, 'the conclusion sentence is the answer line (a thousands space is one number)');

// ── altered numbers are never neutralised or ticked ──────────────────────────
const U = PAGES.users.lines, S = PAGES.seats.lines;
const swap = (lines, i, text) => lines.map((l, k) => (k === i ? text : l));
const statusOf = (o, n) => o.page.lines[n - 1].status;
const U2 = (i, t, key = '13040') => run('users', swap(U, i, t), key);
ok(statusOf(U2(1, 'Given: Initial users = 816, and the number of users doubles every week.'), 2) !== 'checked', 'users: 816 is not the question\'s start value');
ok(statusOf(U2(1, 'Given: Initial users = 815, and the number of users triples every week.'), 2) !== 'checked', 'users: triples is not doubles');
ok(statusOf(U2(1, 'Given: Initial users = 815, and the number of users doubles every month.'), 2) !== 'checked', 'users: every month is not every week');
ok(statusOf(U2(2, 'Method: Use a geometric sequence with common ratio r = 3.'), 3) !== 'checked', 'users: ratio 3 is not the question\'s');
ok(statusOf(U2(5, 'Then U_n = 815 × 3^n.'), 6) !== 'checked', 'users: a model with ratio 3');
ok(statusOf(U2(5, 'Then U_n = 816 × 2^n.'), 6) !== 'checked', 'users: a model with start 816');
ok(statusOf(U2(6, 'After 5 weeks (n = 5),'), 7) !== 'checked', 'users: n = 5 is not after 4 weeks');
ok(statusOf(U2(6, 'After 4 weeks (n = 5),'), 7) !== 'checked', 'users: n = 5 under after 4 weeks');
const klass = (o, n) => o.page.lines[n - 1].card.tickClass;
ok(klass(U2(7, 'U_4 = 815 × 2^5'), 8) !== 'substitution-formula', 'users: 2^5 is not n = 4 in the model');
ok(klass(U2(7, 'U_5 = 815 × 2^5'), 8) !== 'substitution-formula', 'users: n = 5 was never set');
ok(statusOf(U2(10, 'Conclusion: There are [13 041] users after 4 weeks.'), 11) !== 'checked', 'users: 13 041 is not the value reached');
ok(statusOf(U2(10, 'Conclusion: There are not [13 040] users after 4 weeks.'), 11) !== 'checked', 'users: a negated conclusion');
ok(statusOf(U2(10, 'Conclusion: There are [13 040] users after 5 weeks.'), 11) !== 'checked', 'users: 5 weeks in the conclusion');
{ const o = run('users', swap(swap(U, 8, '= 815 × 8'), 7, 'U_4 = 815 × 2^4'), '13040'); ok(o.page.lines[8].status !== 'checked' || o.page.lines[8].card.tickClass !== 'true-as-written', 'users: 815 × 8 after 815 × 2^4 is not a tick'); ok(!o.marks.some(m => m.n === 9 && m.explain), 'users: no explanation on the false line 9'); }
const S2 = (i, t, key = '960') => run('seats', swap(S, i, t), key);
ok(statusOf(S2(1, 'First row has 28 seats, and each later row has 2 more seats.'), 2) !== 'checked', 'seats: 28 is not the question\'s first row');
ok(statusOf(S2(1, 'First row has 29 seats, and each later row has 3 more seats.'), 2) !== 'checked', 'seats: 3 more is not 2 more');
ok(statusOf(S2(2, 'The first n rows hold n(58+2(n−1))/3 seats.'), 3) !== 'condition', 'seats: a changed formula is not the question\'s statement');
ok(statusOf(S2(2, 'The first n rows hold n(58+3(n−1))/2 seats.'), 3) !== 'condition', 'seats: 58+3 is not the question\'s formula');
ok(statusOf(S2(3, 'Method: Substitute n = 21 into the given formula.'), 4) !== 'condition', 'seats: n = 21 is not a number of the question');
ok(klass(S2(4, '= 21(58 + 2(21 − 1))/2', '1071'), 5) !== 'substitution-formula', 'seats: 21 rows was never set');
ok(statusOf(S2(10, 'There are [960] seats in the first 21 rows.'), 11) !== 'checked', 'seats: 21 rows in the conclusion');
ok(statusOf(S2(10, 'There are [20] seats in the first 960 rows.'), 11) !== 'checked', 'seats: the numbers swapped between their words');
ok(statusOf(S2(10, 'There are [960] rows in the first 20 seats.'), 11) !== 'checked', 'seats: the words swapped between their numbers');
ok(statusOf(S2(0, 'Number of seats in the first 21 rows'), 1) !== 'condition', 'seats: a title with 21 rows');

// ── review of 2ad5c22b8: the exact inputs ────────────────────────────────────
// 1. a restated-data line is recognised only when EVERY content word maps to the question
for (const t of ['Given: Initial users = 815, and the number of users decreases every week.', 'Given: Initial users = 815, and the number of users stays the same every week.',
  'Given: Initial users = 815, and the number of users doubles every week, which is impossible.', 'Given: Initial users = 815, and the number of users doubles every week (this is wrong).',
  'Given: Initial users = 815, and the app is free.']) ok(klass(U2(1, t), 2) !== 'given-data' && statusOf(U2(1, t), 2) !== 'checked', `data line not recognised: ${t}`);
ok(klass(U2(1, 'Given: Initial users = 815, and the number of users doubles every week.'), 2) === 'given-data', 'the true data line still is');
ok(statusOf(U2(4, 'Let U_n be the number of users after n weeks, which is impossible.'), 5) !== 'condition', 'a definition with a claim is not neutral');
ok(statusOf(U2(10, 'Conclusion: There are [13 040] users after 4 weeks, which is wrong.'), 11) !== 'checked', 'a conclusion with a claim is not ticked');
// 2. a value is the question's only where the wording binds it
{ const o = S2(3, 'Method: Substitute n = 29 into the given formula.'); ok(o.page.lines[3].status !== 'condition' && o.page.lines[3].card.tickClass !== 'method-stated', 'seats: n = 29 is not the question\'s value, so the method line is not neutral'); }
{ const o = run('seats', swap(swap(S, 3, 'Method: Substitute n = 29 into the given formula.'), 4, '= 29(58 + 2(29 − 1))/2'), '960');
  ok(klass(o, 5) === 'formula-value' && o.marks.find(m => m.n === 5).phrase === 'Value of the formula at n = 29', `seats: n = 29 is only a true evaluation: ${o.marks.find(m => m.n === 5)?.phrase}`); }
ok(klass(U2(6, 'x = 4'), 7) !== 'condition-value' && statusOf(U2(6, 'x = 4'), 7) !== 'checked', 'a bare x = 4 is not "from the question"');
// 3. a step is explained only when the WHOLE step is verified
for (const [a, b] of [['1x = 8', 'x = 7'], ['3x + 2x + 5 = 10', '5x + 5 = 11'], ['x^2 − 9 = 5', '(x − 3)(x + 3) = 0'], ['dy/dx = 3x + 6', 'dy/dx = 3'], ['y = 4x', 'dy/dx = 4(2)'], ['3x + 2 = 8', '3x = 7'], ['2x = 6', 'x = 4']]) ok(say(a, b) === null, `not explained: ${a} then ${b} gives ${say(a, b)}`);
ok(say('y = 3x^2', 'dy/dx = 6x') === '3x² → 6x', 'a true derivative is still explained');
ok(say('= 3 + 4', '= 7') && /^Added/.test(explainStep({ above: '= 3 + 4', line: '= 7' }).sentence), '"Added" for an addition');
ok(!/Simplified the fraction/.test(explainStep({ above: '= 1/3 + 1/6', line: '= 1/2' })?.sentence || ''), '"Simplified the fraction" is only for a cancelled common factor');
ok(/Simplified the fraction/.test(explainStep({ above: '= 6/9', line: '= 2/3' }).sentence), 'a cancelled common factor is named');
{ const lines = [{ text: 'y = 2x + 1', status: 'ok' }, { text: 'y = 2x + 2', status: 'break' }, { text: 'y = 2x + 2 + 0', status: 'ok' }, { text: 'y = 2x + 3', status: 'ok', followsFromError: true }];
  ok(explainLines(lines, 1).every(e => e === null) && explainLines(lines, 1, -1).length === 4, 'nothing is explained after the first cross');
  ok(explainLines(lines, 4)[2] === null && explainLines(lines, 4)[3] === null, 'not after a cross, not a followsFromError line'); }
// 4. a model is proved from its form, not from sample values
ok(klass(U2(5, 'Then U_n = 815 × 2^n + n(n − 1)(n − 2)(n − 3)(n − 4)(n − 5)(n − 6).'), 6) !== 'model', 'a model that agrees only at n = 0 to 6');
ok(klass(U2(5, 'Then U_n = 815 × 2^(n + 1).'), 6) !== 'model' && klass(U2(5, 'Then U_n = 815(2)^n.'), 6) === 'model', 'start value and form');
// 5. the explanation is in the server's report; the page only draws it
ok(users.rep.lines[8].explain && users.rep.lines[8].explain.short === '2⁴ = 16', 'the report line carries the verified explanation');
ok(!/stepExplain/.test(readFileSync(new URL('../../client/src/components/markedPageTeacher.js', import.meta.url), 'utf8')), 'the page does not compute explanations');
// 6. maths in a sentence is typeset: a TeX command is never glued to the next letter
{ const t = explainStep({ above: '(pi t)/12 = pi/2', line: 't = 6' });
  ok(t && /\\pi t/.test(t.sentence) && !/\\pit/.test(t.sentence), `pi then t: ${t && t.sentence}`);
  const r = explainStep({ above: '= sqrt(8)', line: '= 2sqrt(2)' });
  ok(r && /\\sqrt\{8\}/.test(r.sentence) && /\\sqrt\{2\}/.test(r.sentence), `surd: ${r && r.sentence}`);
  const f = explainStep({ above: '= 2^3 * 2^4', line: '= 2^7' });
  ok(f && /\^\{/.test(f.sentence), `power: ${f && f.sentence}`);
  const q = explainStep({ above: '= (3/4)*(2/5)', line: '= 3/10' });
  ok(q && /\\frac/.test(q.sentence), `fraction: ${q && q.sentence}`);
  ok(users.rep.lines[7].fact.saysSegs.some(g => g.t === 'tex' && /2\^\{n\}/.test(g.v)), 'the substitution says its formula as TeX (a power is typeset, not 2^n)'); }

// a label must agree with the value substituted (the marking-mutation check's f(4) = 2(3)^2 - 2(3) - 3)
{ const prompt = 'Let $f(x) = 2x^2 - 2x - 3$. Find $f(3)$.';
  const good = run('f', ['f(3)=2(3)^2-2(3)-3', '=9'], '9', prompt), bad = run('f', ['f(4)=2(3)^2-2(3)-3', '=9'], '9', prompt);
  ok(good.page.lines[0].card.tickClass === 'substitution-formula' || good.page.lines[0].status === 'checked', 'f(3) = 2(3)^2 - 2(3) - 3 is a substitution');
  ok(bad.page.lines[0].card.tickClass !== 'formula-value' && bad.page.lines[0].card.tickClass !== 'substitution-formula', `f(4) with 3 substituted is never ticked as a substitution (${bad.page.lines[0].card.tickClass})`); }

{ const prompt = 'Let $g(x) = 2x + 4$. Find $g(3)$.';
  const bad = run('f', ['g(3)=2(3)+4=9', '=9'], '10', prompt), good = run('f', ['g(3)=2(3)+4=10', '=10'], '10', prompt);
  ok(bad.page.lines[0].card.tickClass !== 'formula-value' && bad.page.lines[0].card.tickClass !== 'substitution-formula', `g(3) = 2(3) + 4 = 9: the last side is wrong, so it is not a substitution tick (${bad.page.lines[0].card.tickClass})`);
  ok(good.page.lines[0].status === 'checked', 'g(3) = 2(3) + 4 = 10 is ticked'); }

console.log(`step-explain: ${pass} checks passed${fail ? `, ${fail} failed` : ''}`);
process.exit(fail ? 1 : 0);
