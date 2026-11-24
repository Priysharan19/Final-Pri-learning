// Pri Learning · the owner's four photographed pages, as the production reader wrote them, through the real marking code
//
// 21 November 2026. The owner's pages were run through the real server routes with the production reader (localhost, SQLite; not production
// data). This check keeps the READER TEXT of those pages (no photo, nothing personal) and feeds it as `steps` through stepEvidence, the code the
// route calls, on the question each page was marked against, and on the others the run used. The owner's rules, absolute:
//   a TRUE line is never crossed; a WRONG line is never ticked; a definition, a label or a side calculation is never crossed; when unsure, a note.
//   1  column vectors written with commas ([-5,-1], |[14,8]|) are read like the semicolon form, tick only, and never an interval or a point
//   2  the owner's own slip (-20 - 6 written as 14) is a WARNING NOTE: never a tick, never a cross
//   3  a side sum the reader merged into one line (`196 +64 / 260`) is a note, not the first break
//   4  the reader's degree sign for a prime (`y° = …`)
//   5  the tan page: a lone x between factors is a times sign, [tan x]^-2, a glued question number, y′(π/6)
// Evidence class: reader text of real photos; the questions are generated, so this is a regression fixture, not a benchmark.
import { stepEvidence, stepMetaFor } from '../platform/markerOps.js';
import { stepCheckArithmetic } from '../../client/src/engine/arithmeticLines.js';
import { plainComment } from '../../client/src/engine/commentTex.js';
import * as G from '../../client/src/engine/generators/index.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
await G.loadAllBanks();
const code = r => (r?.stepReport?.lines || []).map(l => (l.status === 'ok' ? 'T' : l.status === 'break' ? 'X' : '.')).join('');
const mark = (q, page, answer, opts) => stepEvidence(q, answer, page.join('\n'), { correct: false }, opts || undefined);
const lines = (q, page, answer) => mark(q, page, answer).stepReport?.lines || [];
const gen = (id, d, seed) => G.generateQuestion(id, d, seed);
const arithmetic = page => stepCheckArithmetic(page.join('\n'));
const acode = page => arithmetic(page).lines.map(l => (l.status === 'ok' ? 'T' : l.status === 'break' ? 'X' : '.')).join('');
const said = l => plainComment(String(l?.note ?? ''));

// ── the reader text of the four pages (IMG_0501, IMG_0496, IMG_1233, IMG_1234, IMG_0503) ─────────────────────────
const AREA = ['8 y = 2x(4-x)', 'Area = ∫_0^4 2x(4-x) dx', '= 2∫_0^4 4x-x^2 dx', '= 2[4x^2/2 - x^3/3]_0^4', '= 2[2x^2 - x^3/3]_0^4', '= 2[2(4)^2 - 4^3/3] = 2[32 - 64/3]', '16/2', '64/3'];
const STAT = ['y = 2x^3 + 9x^2', 'y′ = 6x^2 + 18x', 'for stat points y′ = 0', '0 = 6x^2 + 18x', '0 = 6x[x + 3]', 'x = 0 or x = -3', 'y(0) = 0', 'Smallest: (0,0)'];
const VEC = ['|4a+3b|', '= |4[-5,-1]+3[-2,4]|', '= |[-20,-4]-[-6,+12]|', '196', '+64', '260', '= |[14,8]| = sqrt(14^2+8^2)', '= sqrt(260)'];
const MIX = ['= |[-20 -6; -4 +12]|', '196 +64 / 260', '= |[14; 8]| = sqrt(14^2 + 8^2)', '= sqrt(260)', 'Hamilton paths', 'integral_-2^4 12x dx = 12 integral_-2^4 x dx', '= [12x^2/2]_-2^4', '= [6x^2]_-2^4', '= 6[x^2]_-2^4', '= 6[4^2 - 2^2]', '= 6(16 - 4) = 6 x 12', 'Ans = 72'];
const TAN17 = ['Days remaining: 119days', '8 y = 2x(4-x)', 'Area = ∫_0^4 2x(4-x) dx', '= 2∫_0^4 4x-x^2 dx', '= 2[4x^2/2-x^3/3]_0^4', '= 2[2x^2-x^3/3]_0^4', '16/3', '= 2[2(4)^2-4^3/3] = 2[32-64/3]', '64/3', '8 y = 3/tan x', 'y^0 = 3[tan x]^-1', 'y′ = -3[tan x]^-2 x sec^2 x', '= -3sin x/cos x x 1/cos^2 x', '= -3sin x/cos^3 x', 'y′(π/6) = -3sin(π/6) x 1/[cos(π/6)]^3', '= -3 x 1/2 x 1/(√3)^3 x 2^3', '= -3 x 4/(3√3) = -4/√3 = -4√3/3'];
// the tan page as the owner's handwriting reads in the brief: a degree sign for the prime, and the slips the handwriting carries
const TAN8 = ['8 y = 3/tan x', 'y° = 3[tan x]^-1', 'y′ = -3[tan x]^-2 x sec^2 x', '= -3sin x/cos^2 x x 1/cos^2 x', '= -3sin x/cos^3 x', 'y′(π/6) = -3sin(π/6) x 1/[cos(π/6)]^3', '= -3 x 1/2 x 1/(√3)^3 x 2^3', '= -8 x 4/(3√3) = -4/√3 = -4√3/3'];

const Q = {
  areaExact: gen('y12-integration', 3, 337), areaNear: gen('y12-integration', 3, 437), integStep: gen('y12-integration', 1, 12), // seed 27 drew a plain definite integral, which has a derived step plan since the Years 11-12 coverage pass; seed 31 is a reverse-chain-rule integral, which has none
  integPlain: gen('y12-integration', 1, 31),
  appdiff128: gen('y12-appdiff', 1, 128), appdiff387: gen('y12-appdiff', 1, 387), appdiff19: gen('y12-appdiff', 1, 19), appdiffPlain: gen('y12-appdiff', 2, 41),
  vec58: gen('me12-vectors', 1, 58), vec367: gen('me12-vectors', 1, 367), vecPlain: gen('me12-vectors', 1, 35),
  trig48: gen('y12-trigcalc', 3, 48), trig99: gen('y12-trigcalc', 1, 99)
};
ok(stepMetaFor(Q.areaExact) === null && stepMetaFor(Q.integPlain) === null && stepMetaFor(Q.vecPlain) === null && stepMetaFor(Q.trig48) === null, 'the no-Step-Check questions have no topic meta');
ok(!!stepMetaFor(Q.integStep) && !!stepMetaFor(Q.vec58) && !!stepMetaFor(Q.trig99), 'the Step Check questions have a topic meta');
ok(/y = 2x\(4 - x\)/.test(Q.areaExact.prompt) && Math.abs(Q.areaExact.answer.value - 64 / 3) < 1e-3, `y12-integration d3 seed 337 (the question seed 4 drew before the Advanced variety forms) is exactly y = 2x(4 - x), area 64/3 (${Q.areaExact.prompt})`);

// ── the area page, IMG_0501: nothing changes (the pinned ticks stay, nothing is crossed) ─────────────────────────────
for (const [name, q] of [['exact', Q.areaExact], ['near', Q.areaNear], ['Step Check', Q.integStep]]) {
  const l = lines(q, AREA, '64/3');
  ok(code({ stepReport: { lines: l } }) === '..TTTT.T', `area page on the ${name} question: lines 3 to 6 and 64/3 ticked, none crossed (${code({ stepReport: { lines: l } })})`);
  ok([0, 1, 6].every(i => l[i].status === 'note'), `${name}: the definition, the Area label and the margin number are notes`);
}

// ── the stationary-points page, IMG_0496 ────────────────────────────────────────────────────────────────────────
// These four are NOT the page's question: a line is judged against the question asked, so the topic checks cross the derivative of a different curve. That
// is pinned here as it stood before this mission (nothing in items 1 to 5 touches it); the page's own lines are true as written.
ok(code({ stepReport: { lines: lines(Q.appdiff128, STAT, '0') } }) === '.X......' && code({ stepReport: { lines: lines(Q.appdiff387, STAT, '0') } }) === '.X......', 'stationary page on two other curves: unchanged');
ok(code({ stepReport: { lines: lines(Q.appdiff19, STAT, '0, -3') } }) === '.T.X....' && code({ stepReport: { lines: lines(Q.appdiffPlain, STAT, '0') } }) === '.T.TTT..', 'stationary page on the other two questions: unchanged');
ok(!acode(STAT).includes('X'), `the page itself, as written, is never crossed by the arithmetic check (${acode(STAT)})`);

// ── ITEM 1 · column vectors with commas ───────────────────────────────────────────────────────────────────────────
{
  const t = page => acode(page);
  ok(t(['4[-5,-1]+3[-2,4] = [-26,8]']) === 'T', 'comma form: 4[-5,-1] + 3[-2,4] = [-26,8] is ticked (scalar multiple, a sum, an equals sign)');
  ok(t(['|[14,8]| = sqrt(14^2+8^2)']) === 'T', 'comma form: |[14,8]| = sqrt(14^2+8^2) is ticked (magnitude bars)');
  ok(t(['4[-5,-1]+3[-2,4] = [-26,9]']) === '.', 'a comma vector line that is not equal is a note, never a cross');
  ok(t(['|4[-5,-1]+3[-2,4]|', '= |[-26,8]|', '= sqrt(740)', '= 2sqrt(185)']) === '.TTT', 'a true continuation still ticks: = |[-26,8]|, = √740, = 2√185');
  ok(t(['[1,2]+[3,4] = [4,6]', '2[3,4] = [6,8]', '[0,4] = [0,4]']) === 'TTT', 'sums, scalar multiples and equality between brackets are vectors');
  // never an interval, a domain, a point, a limit or a function bracket
  for (const l of ['x ∈ [0,4]', 'for x in [0,4]', 'the domain is [0,4]', 'range [1,2]', 'interval [0,4]', '∫_[0,4] 2x dx', 'lim_[0,4] f', 'max[3,4] = 4', 'f[3,4] = 7', '(0,4) = (0,4)', '2[3,4]', '[0,4]', 'y = 2x on [0,4]'])
    ok(t([l]) === '.', `not a vector: ${l}`);
  ok(arithmetic(['4[-5,-1]+3[-2,4] = [-26,8]']).lines[0].valueChain?.rule === 'true-as-written', 'the comma form is a true-as-written tick, like the semicolon form');
  ok(t(['4[-5;-1]+3[-2;4] = [-26;8]']) === 'T', 'the semicolon form is as before');
}

// ── ITEM 2 · the owner's own slip is never flagged by a tick, never crossed ────────────────────────────────────────
{
  const r = arithmetic(VEC), L = r.lines;
  ok(r.firstBreak === -1 && L.every(l => l.status !== 'break'), 'the comma vector page: nothing is crossed');
  ok(L[1].status === 'note' && L[2].status === 'note' && L[6].status === 'note' && L[7].status === 'note', `lines 2, 3, 7 and 8 are notes (${L.map(l => l.status)})`);
  ok(L[6].vectorWarning === true && /does not equal the earlier line/.test(said(L[6])) && /The two sides of this line agree \(√260\)/.test(said(L[6])) && /√740 \(27\.2029\)/.test(said(L[6])) && /Check each component\.$/.test(said(L[6])), `line 7 says both facts (${said(L[6])})`);
  ok(L[2].vectorWarning === true && /does not equal the earlier line/.test(said(L[2])) && /√740/.test(said(L[2])), `the garbled line 3 is a warning note too (${said(L[2])})`);
  ok(L[5].status === 'ok', 'the column 196 + 64 = 260 is still ticked');
  ok(L[7].status === 'note' && !/equals the line above/.test(said(L[7])), 'the line under the warned one is not ticked as "equals the line above"');
  ok(acode(MIX.slice(0, 4)) === '....' && arithmetic(MIX.slice(0, 4)).lines[2].vectorWarning === true, 'the semicolon form of the same page: line 3 is the warning note, and nothing is ticked from it');
  // a TRUE continuation ticks, and the sides that agree on their own tick on their own statement
  ok(acode(['|4a+3b|', '= |4[-5,-1]+3[-2,4]|', '= |[-26,8]| = sqrt(26^2+8^2)', '= sqrt(740)']) === '..TT', 'the correct working: |[-26,8]| = √(26²+8²) and = √740 are ticked');
  ok(acode(['= |4[-5,-1]+3[-2,4]|', 'sqrt(14^2 + 8^2) = sqrt(260)']) === '.T', 'a line that is true on its own statement still ticks after a warning-free line');
  // the real question: the topic checker, with the owner's a, b and target |4a + 3b|
  const base = gen('me12-vectors', 1, 58);
  const exact = { ...base, prompt: 'Given $\\underset{\\sim}{a} = \\begin{pmatrix} -5 \\\\ -1 \\end{pmatrix}$ and $\\underset{\\sim}{b} = \\begin{pmatrix} -2 \\\\ 4 \\end{pmatrix}$, find $\\left|4\\underset{\\sim}{a} + 3\\underset{\\sim}{b}\\right|$, correct to 2 decimal places.',
    answer: { ...base.answer, value: Math.sqrt(740) }, stepcheck: { kind: 'vector-chain', vectors: { a: [-5, -1], b: [-2, 4] }, target: '|4*a+(3)*b|' } };
  const e = mark(exact, VEC, 'sqrt(260)'), E = e.stepReport.lines;
  ok(code(e) === 'TT...T' + 'X.', `the exact question's own topic check crosses the line where 14 appears (${code(e)})`);
  ok(E[6].status === 'break' && /27\.202941/.test(said(E[6])) && /16\.124515/.test(said(E[6])), `...and says what it should come to (${said(E[6])})`);
  ok(E[1].status === 'ok' && E[2].status === 'note' && E[2].state !== 'wrong', 'the true line 2 is ticked and the garbled line 3 is a note, never crossed');
  const off = stepEvidence(exact, 'sqrt(260)', VEC.join('\n'), { correct: false }, { claims: false, fold: false });
  ok(JSON.stringify(e.partial) === JSON.stringify(off.partial), 'the marks are what they were without the display rules');
  const right = mark(exact, ['|4a+3b|', '= |4[-5,-1]+3[-2,4]|', '= |[-26,8]|', '= sqrt(740)'], 'sqrt(740)');
  ok(code(right) === 'TTTT', `the correct working on the exact question is ticked throughout (${code(right)})`);
  // the same page on a question with NO Step Check (|AB|), as the owner's run: the warning, no tick from the slip, the column ticked
  const plain = lines(Q.vecPlain, VEC, 'sqrt(260)');
  ok(plain.map(l => l.status === 'ok' ? 'T' : '.').join('') === '.....T..' && plain[2].vectorWarning && plain[6].vectorWarning, `no-Step-Check question: warnings on lines 3 and 7, only the column ticked (${plain.map(l => l.status)})`);
  ok(plain.every(l => l.status !== 'break'), 'nothing is crossed');
  // the other questions the run used: they hold other vectors, so the topic check crosses a line that is not theirs (pinned, unchanged)
  ok(code({ stepReport: { lines: lines(Q.vec58, VEC, 'sqrt(260)') } }) === 'TX......' && code({ stepReport: { lines: lines(Q.vec367, VEC, 'sqrt(260)') } }) === 'TX......', 'the vector page on two questions with other vectors: unchanged');
}

// ── ITEM 3 · a side calculation is not crossed by a topic checker ────────────────────────────────────────────────────
{
  const l = lines(Q.integStep, MIX, '72');
  ok(l[1].status === 'note' && /a sum on its own is not a claim/.test(l[1].note), `196 +64 / 260 is a note, not the first break (${l[1].status}: ${l[1].note})`);
  ok(l.findIndex(x => x.status === 'break') !== 1, 'the first break is no longer the side sum');
  const on = stepEvidence(Q.integStep, '72', MIX.join('\n'), { correct: false }, { fold: false }), off = stepEvidence(Q.integStep, '72', MIX.join('\n'), { correct: false }, { fold: false, claims: false });
  ok(code(off).startsWith('.X') && /satisfy the original equation/.test(off.stepReport.lines[1].note), `before the rule the topic check crossed it (${code(off)})`);
  ok(JSON.stringify(on.partial) === JSON.stringify(off.partial) && JSON.stringify(on.board ?? null) === JSON.stringify(off.board ?? null), 'partial credit and board are identical with the rule on and off');
  for (const t of ['196 + 64', '196 +64 / 260', '(3 + 4) * 2', '12 / 4 - 1']) {
    const r = lines(Q.integStep, ['u = 2x + 3', t, '= 72'], '72');
    ok(r[1].status !== 'break', `a sum with no relation sign is never crossed: ${t}`);
  }
  // a line WITH a relation sign is still judged
  const rel = stepEvidence(Q.integStep, '72', ['196 + 64 = 261'].join('\n'), { correct: false }, { fold: false });
  ok(rel.stepReport === null || rel.stepReport.lines.every(x => x.note !== 'Not checked: a sum on its own is not a claim; Pri did not check it against this question.'), 'a line with an equals sign is not treated as a bare sum');
}

// ── ITEM 4 · the reader's degree sign for a prime ────────────────────────────────────────────────────────────────────
{
  ok(acode(['y = 2x^3', 'y° = 6x^2']) === '.T', 'y° = 6x^2 after y = 2x^3: read as y′, ticked as the derivative');
  ok(acode(['y = 2x^3', 'y° = 7x^2']) === '..', 'y° = 7x^2: not ticked, and never crossed (the mark may be a stray)');
  ok(acode(['y = 2x^3', "y' = 7x^2"]) === '.X', "the same line written y' = 7x^2 is crossed as before");
  ok(acode(['8 y = 3/tan x', 'y° = 3[tan x]^-1']) === '..', 'y° = 3[tan x]^-1 under y = 3/tan x is the line the owner wrote: a note, not a cross');
  ok(acode(['sin 30° = 1/2', '30° = 30°']) === 'TT', 'a degree sign after a number is untouched: sin 30° = 1/2 and 30° = 30° still tick');
  ok(acode(['x° = 30']) === '.' && acode(['2x° = 60']) === '.', 'a degree after a letter before = is read, one after a number-and-letter is not, and neither is ticked');
  ok(acode(["f(x) = x^3", 'f°(x) = 3x^2']) === '.T', 'f°(x) = 3x^2 after f(x) = x^3: the degree sign before ( is a prime too');
}

// ── ITEM 5 · the tan page ───────────────────────────────────────────────────────────────────────────────────────────
{
  const r = arithmetic(TAN8), L = r.lines;
  ok(r.firstBreak === -1 && L.every(l => l.status !== 'break'), 'the tan page: nothing is crossed');
  // what each line IS (computed here, so a "note" on a false line is on record)
  const D = x => -3 / Math.sin(x) ** 2;                       // the derivative of y = 3/tan x
  const l4 = x => -3 * Math.sin(x) / Math.cos(x) ** 2 / Math.cos(x) ** 2;   // line 4 as written, times reading
  const l5 = x => -3 * Math.sin(x) / Math.cos(x) ** 3;        // line 5
  const p = Math.PI / 6, l6 = -3 * Math.sin(p) / Math.cos(p) ** 3, l7 = -3 * 0.5 / Math.sqrt(3) ** 3 * 8, l8a = -8 * 4 / (3 * Math.sqrt(3)), l8b = -4 / Math.sqrt(3);
  const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const tanY = x => 3 / Math.tan(x), tanD = x => -3 * Math.tan(x) ** -2 / Math.cos(x) ** 2;
  ok([0.5, 1, 2].every(x => near((tanY(x + 1e-6) - tanY(x - 1e-6)) / 2e-6, D(x)) || Math.abs((tanY(x + 1e-6) - tanY(x - 1e-6)) / 2e-6 - tanD(x)) < 1e-4) && [0.5, 1, 2].every(x => near(tanD(x), D(x))), 'line 3, −3[tan x]^−2·sec²x, is the derivative of 3/tan x (−3/sin²x)');
  ok([0.5, 1, 2].every(x => !near(l4(x), D(x))), 'line 4 as written is FALSE (it is −3 sin x/cos⁴ x, not −3/sin² x)');
  ok([0.5, 1, 2].every(x => !near(l5(x), l4(x)) && !near(l5(x), D(x))), 'line 5 as written is FALSE against line 4 and against the derivative');
  ok(!near(l6, D(p)) && near(l6, l5(p)) && near(D(p), -12), `line 6 is FALSE against the derivative of the page (${l6.toFixed(4)} against ${D(p).toFixed(4)}); it is only the value of line 5`);
  ok(near(l7, l6), `line 7 (${l7.toFixed(4)}) is the right-hand side of line 6: true as arithmetic`);
  ok(!near(l8a, l8b) && near(l8b, -4 * Math.sqrt(3) / 3), `line 8 is FALSE as written: −8·4/(3√3) = ${l8a.toFixed(4)}, while −4/√3 = −4√3/3 = ${l8b.toFixed(4)}`);
  ok(L.map(l => l.status).join() === 'note,note,note,note,note,note,ok,note', `statuses: only line 7 ticks; line 3 is a note because "8 y = 3/tan x" may be the equation 8y = 3/tan x (${L.map(l => l.status)})`);
  ok(L[2].status === 'note', 'line 3 is true under the definition reading only (the equation reading 8y = 3/tan x makes it false): a note');
  ok(/equals the line above/.test(said(L[6])) && /4√3\/3|4\\sqrt\{3\}/.test(String(L[6].note) + said(L[6])), `line 7 is ticked as equal to the line above (${said(L[6])})`);
  ok(!L[7].note.includes('equals'), 'line 8 is a note: its first side −8·4/(3√3) is not the value above');
  // the real reader's text for the same page (cos x for cos^2 x): line 5 is then the same as line 4, written another way
  const real = arithmetic(TAN17.slice(9)), R = real.lines;
  ok(R.map(l => l.status).join() === 'note,note,note,note,ok,note,ok,ok', `the reader's own tan page: 5, 7 and 8 tick (${R.map(l => l.status)})`);
  ok(real.firstBreak === -1, 'the reader\'s own tan page: nothing crossed');
  // each reading rule on its own
  ok(acode(['y = 3tan x', 'y′ = 3 sec^2 x']) === '.T', 'sec^2 x at the end of the expression keeps its x: the derivative of 3 tan x is ticked');
  ok(acode(['y = 3tan x', "y' = 3 sec^2 x x 5"]) === '..', 'a times reading that is false is never crossed');
  ok(acode(['y = 3tan x', "y' = 3 x sec^2 x"]) === '..', 'a bare number before x and a function is ambiguous (3x sec² x or 3 sec² x): a note');
  ok(acode(['y = 2x', '[x + 1]^2 x 3 = 3(x + 1)^2']) === '.T', '[x + 1]^2 x 3: a square bracket with a power, times 3, is ticked when true');
  ok(acode(['1/2 x 1/3 = 1/6']) === 'T' && acode(['1/2 x 1/3 = 1/5']) === '.' && acode(['3 x 1/2 x 1/3 = 1/2']) === 'T', 'fractions side by side are one unit each: 1/2 x 1/3 = 1/6 ticks, 1/5 is a note');
  ok(acode(['1/2 x 1/3 = 1/5', '1/2 x 1/3 = 1/6']) === '.T', 'a false line under the times reading does not stop the lines below it');
  ok(acode(['sin x x 2 = 2 sin x']) === 'T' && acode(['sin x x 2 = 3 sin x']) === '.', 'sin x x 2: the first x is the argument, the second a times sign');
  // the glued question number
  ok(acode(['1 y = 2x', "y' = 2"]) === '.T', 'a glued number that changes nothing (1 y = 2x): both readings agree, the derivative ticks');
  ok(acode(['8 y = 3/tan x', "y' = -3[tan x]^-2 x sec^2 x"]) === '..', 'a glued number that changes the derivative: a note');
  // the reviewer's cases: each is false under one reading, so none ticks; and never a cross
  for (const page of [['3 y = 2x + 1', "y' = 2"], ['3 y = 6x', 'y(3) = 18'], ['8 y = 16', 'y(1) = 16'], ['2 y = x^2', "y' = 2x"], ['12 y = 3x^2 + 6', "y' = 6x"], ['3 y = 6x', "y'(2) = 6"]])
    ok(acode(page) === '..', `glued number, ambiguous: ${page.join(' ; ')} (${acode(page)})`);
  ok(acode(['8 y = 16', 'y = 2']) === '.T' && acode(['8 y = 16', 'y = 2', "y' = 0"]) === '.T.', '8 y = 16 then y = 2 still ticks as a root, as before');
  ok(acode(['8 y = 3/tan x', 'z = 4']) === '..' && acode(['8 y = 3/tan x']) === '.', 'with no later use of y the glued line is just a note');
  ok(acode(['8 y = 3/tan x', "y' = -3 sec^2 x"]) === '..', 'a wrong derivative of a glued definition is a note, never a cross (the glued line is only used to tick)');
  // y'(π/6), evaluated against the page's derivative
  ok(acode(['y = 2x^3', "y' = 6x^2", "y'(2) = 24"]) === '.TT', 'y′(2) = 24 against the derivative the page set: ticked');
  ok(acode(['y = 2x^3', "y' = 6x^2", "y'(2) = 25"]) === '.T.', 'y′(2) = 25: a note, never a cross');
  ok(acode(['y = 2x^3', "y'(2) = 24"]) === '.T', 'y′(2) = 24 with no derivative on the page: against the derivative of the definition');
  ok(acode(['y = 2x^3', "y' = 6x^2", "y'(π/6) = 6 x (π/6)^2"]) === '.TT', 'y′(π/6) = 6 x (π/6)²: the point may be π/6');
  // on the questions the run used
  const withFold = q => lines(q, TAN8, '-4sqrt(3)/3').map(l => l.status === 'ok' ? 'T' : l.status === 'break' ? 'X' : '.').join('');
  ok(withFold(Q.areaExact) === '......T.', `y12-integration (no Step Check) on the tan page: only 7 ticked (${withFold(Q.areaExact)})`);
  ok(!withFold(Q.trig48).includes('X') && !withFold(Q.trig99).includes('X'), 'y12-trigcalc, with and without a Step Check: nothing crossed');
  ok(withFold(Q.trig48)[6] === 'T', 'the question that fixes x = π/3 still ticks line 7, which has no x in it');
}

// ── comma vectors that end in plain numbers, and mixed readings of x ────────────────────────────────────────────────────
{
  ok(acode(['|[3,4]| = √(3^2+4^2)', '= √25', '= 6']) === 'TTX', 'a comma vector line ending in numbers: the continuation that is wrong is crossed as on main');
  ok(acode(['|[3,4]| = √(3^2+4^2)', '= √24', '= 5']) === 'TX.', 'a wrong √24 under it is crossed');
  ok(acode(['|[3,4]| = √(676+64)', '= √741']).endsWith('X'), 'a wrong √741 after √(676+64) is crossed');
  ok(acode(['x = 2', '-3 x cos(π/3) x sec^2(π/4) = -6']) === '..', 'with x = 2 on the page, one x as the letter and the next as times is not read: a note');
}

// ── the whole run: every page on every question it was marked against, no true line crossed on the page's own question ──
{
  const pages = [['area', AREA, ['areaExact', 'areaNear', 'integStep'], '64/3'], ['tan', TAN17, ['areaExact', 'trig48', 'trig99'], '64/3'], ['mix', MIX, ['integPlain', 'integStep', 'vec58'], '72']];
  for (const [name, page, qs, ans] of pages) for (const k of qs) {
    const r = mark(Q[k], page, ans);
    const brk = (r.stepReport?.lines || []).filter(l => l.status === 'break');
    // the only crosses the run may keep are on a line the question itself decides: `Ans = 72` against a question whose answer is not 72
    ok(brk.every(l => /^Ans = 72$/.test(l.text)), `${name} on ${k}: nothing but the answer line is crossed (${brk.map(l => l.text)})`);
    const l = r.stepReport?.lines || [];
    ok(l.every((x, i) => !(x.status === 'ok' && x.state === 'arithmetic' && !x.valueChain)), `${name} on ${k}: every arithmetic tick carries its rule`);
    ok(JSON.stringify(r.partial) === JSON.stringify(mark(Q[k], page, ans, { claims: false, fold: false }).partial), `${name} on ${k}: partial credit is identical with the display rules off`);
  }
}

// ── the slip warning on the tan page, and the slash column page (22 November 2026) ─────────────────────────────────────────────────
{
  // The carrier is a question with no Step Check of its own (the pages below are another question's handwriting). Seed 7 drew a gradient-at-a-point
  // question until the Years 11-12 coverage pass gave those a derived step plan; seed 6 is a question with none, as seed 7 was.
  const q = gen('y12-diff', 3, 6);
  const W = page => (stepEvidence(q, '', page.join('\n'), { correct: false }, { slipWarnings: true }).stepReport?.lines || []);
  const L = W(TAN8);
  // line 3 is unchanged (a note: it may be a derivative of the definition or of the equation 8y = 3/tan x).
  // line 4 and 5 are false against the line above but are left plain notes: each carries a lone x between factors (`x x 1/cos^2 x`, `cos^3 x`) that may be a times sign or a letter,
  // so the warning stays silent. line 6 is a value of line 5, not a continuation, and line 8 is glued (`-8 x 4/(3√3)`, the reader's 3 for 8): plain notes.
  ok(L.map(l => l.status).join() === 'note,note,note,note,note,note,ok,note', `the tan page: statuses are as before (${L.map(l => l.status)})`);
  ok(L.every(l => l.slipWarning !== true), 'the tan page: lines 3, 4, 5, 6 and 8 carry no warning, because each reading is ambiguous');
  // the same slip written without the lone x: it IS warned
  const q2 = gen('y11-diff', 2, 11);   // a question with no y′ statement of its own, so the page's y′ line is not contradicted
  const clean = (stepEvidence(q2, '', ['y = 3/tan(x)', "y' = -3(tan(x))^(-2)(sec(x))^2", '= -3(tan(x))^(-2)(sec(x))^2', '= -3sin(x)/(cos(x))^2/(cos(x))^2'].join('\n'), { correct: false }, { slipWarnings: true }).stepReport?.lines || []);
  // a warning needs a continuation under a continuation that was ticked: here line 3 repeats line 2, line 4 is the false rewrite (it is -3 sin/cos^4, not -3/sin^2)
  ok(clean[3].slipWarning === true && /^This is not equal to the line above for every value of x \(for example at x = [-\d.]+: [-\d.]+ against [-\d.]+\)\. Check this step\.$/.test(clean[3].note), `a false rewrite with no ambiguous x is warned (${clean[3].note})`);
  ok(clean[3].status === 'note', 'a warned line is a note');
  ok(clean.every(l => l.status !== 'break'), 'a warning is never a cross');
  // the slash column page
  const V = stepEvidence(q, '', ['|4a+3b|', '= |4[-5,-1]+3[-2,4]|', '= |[-20 - 6/-4 + 12]|', '196', '+64', '260', '= |[14/8]| = sqrt(14^2+8^2)', '= sqrt(260)'].join('\n'), { correct: false }).stepReport.lines;
  ok(V[2].status === 'ok' && V[6].status === 'note' && V[6].vectorWarning === true && V.every(l => l.status !== 'break'), `the slash column page: the column line ticks, |[14/8]| is a warning note, nothing is crossed (${V.map(l => l.status)})`);
}

console.log(`OWNER PAGES: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — the owner's reader text through the real marking code: comma vectors, the vector slip as a warning note, a side sum never crossed, the degree sign for a prime, the tan page; nothing true crossed, nothing false ticked`);
if (fail) process.exit(1);
