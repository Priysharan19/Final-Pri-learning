// Pri Learning · specific feedback on a ticked line (26 November 2026)
// Two owner pages (a 13-line arithmetic-series page and an 11-line geometric-growth page) went through the real marking path and read "True as written".
// This check pins what the page says now, line by line, and that nothing is said that the engine has not verified:
//   · explainStep: each statement is a verified change between two lines (arithmetic, brackets, expanding, collecting, factorising, cancelling, both sides, roots, derivative)
//   · altered numbers are never neutralised or ticked (816, ratio 3, n = 5, 2^4 = 8, 21 rows, swapped numbers in a sentence)
//   · a wrong line is never explained as right
import { explainStep } from '../../client/src/engine/stepExplain.js';
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
ok(statusOf(U2(7, 'U_4 = 815 × 2^5'), 8) !== 'checked', 'users: 2^5 is not n = 4 in the model');
ok(statusOf(U2(7, 'U_5 = 815 × 2^5'), 8) !== 'checked', 'users: n = 5 was never set');
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
ok(statusOf(S2(4, '= 21(58 + 2(21 − 1))/2', '1071'), 5) !== 'checked', 'seats: 21 rows was never set');
ok(statusOf(S2(10, 'There are [960] seats in the first 21 rows.'), 11) !== 'checked', 'seats: 21 rows in the conclusion');
ok(statusOf(S2(10, 'There are [20] seats in the first 960 rows.'), 11) !== 'checked', 'seats: the numbers swapped between their words');
ok(statusOf(S2(10, 'There are [960] rows in the first 20 seats.'), 11) !== 'checked', 'seats: the words swapped between their numbers');
ok(statusOf(S2(0, 'Number of seats in the first 21 rows'), 1) !== 'condition', 'seats: a title with 21 rows');

console.log(`step-explain: ${pass} checks passed${fail ? `, ${fail} failed` : ''}`);
process.exit(fail ? 1 : 0);
