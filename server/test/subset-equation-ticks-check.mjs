// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · an equation true of only SOME of a question's roots is not ticked as a step (24 Nov 2026, review of the step-mark drafts)
//
// The step check used to tick any equation whose solutions are a subset of the question's: `x - 5 = 1` under 3(x - 5)(x - 6) = 0 was
// plain-ticked, and the worked-solution match ticked it as "the same condition" as the factor x - 6 = 0. A line with only some of the roots
// is now ticked only when it is plainly a branch: a factor set equal to zero (any nonzero multiple, either side order), a value (x = 6),
// one branch of a square the line above trusted, or an equation equivalent to the FULL equation. Any other such line is a note: never a
// tick (it proves nothing about the working) and never a cross (it is a true statement about one root).
//
//   node server/test/subset-equation-ticks-check.mjs
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import * as G from '../../client/src/engine/generators/index.js';
import { stepEvidence } from '../platform/markerOps.js';
import { checkAnswer } from '../../client/src/engine/checker.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
await G.loadAllBanks();
const find = (re) => { for (let d = 1; d <= 4; d++) for (let s = 1; s <= 120; s++) { let q; try { q = G.generateQuestion('y10-quadratics', d, s); } catch { continue; } if (q && re.test(q.prompt)) return q; } return null; };
const report = (q, lines) => stepEvidence(q, '999', lines.join('\n'), checkAnswer(q, '999')).stepReport.lines;
const statusWith = (q, lines, ans) => stepEvidence(q, ans, lines.join('\n'), checkAnswer(q, ans)).stepReport.lines.map(l => l.status);
const status = (q, lines) => report(q, lines).map(l => l.status);

// 1. the three repros: the subset line is a note, alone and in a page, and never a cross
for (const [re, wrongA, wrongB] of [[/3\(x - 5\)\(x - 6\)/, 'x - 5 = 1', 'x - 6 = 0'], [/5\(x - 2\)\(x - 1\)/, 'x - 1 = 1', 'x - 2 = 0'], [/7\(x - 4\)\(x - 5\)/, 'x - 4 = 1', 'x - 5 = 0']]) {
  const q = find(re);
  ok(!!q, `repro question exists: ${re}`);
  if (!q) continue;
  const alone = status(q, [wrongA]);
  ok(alone.length === 1 && alone[0] === 'note', `${wrongA} alone is a note, got ${alone}`);
  const page = status(q, [wrongA, wrongB, `x = ${wrongB.match(/x - (\d+)/)[1]}`]);
  ok(page[0] === 'note' && !page.includes('break'), `${wrongA} in a page is a note and nothing is crossed: ${page}`);
}

// 1b. the same page with the RIGHT final answer: the line is still not ticked (the final answer does not turn a wrong factor into a step)
{
  const q = find(/3\(x - 5\)\(x - 6\)/);
  const got = statusWith(q, ['x - 5 = 1', 'x - 6 = 0', 'x = 5', 'x = 6', '5 or 6'], '5 or 6');
  ok(checkAnswer(q, '5 or 6').correct === true && got[0] === 'note' && got.slice(1).every(x => x === 'ok'), `right final answer: x - 5 = 1 is a note, the true lines tick: ${got}`);
}

// 2. true lines still tick: factor = 0, scaled factor = 0, 0 = factor, x = root, the expanded full equation
{
  const q = find(/3\(x - 5\)\(x - 6\)/);
  const lines = ['x - 5 = 0', '2x - 10 = 0', '0 = x - 6', 'x = 5', 'x = 6', '3x^2 - 33x + 90 = 0', 'x^2 - 11x + 30 = 0', '3(x - 5)(x - 6) = 0'];
  const got = status(q, lines);
  ok(got.every(s => s === 'ok'), `true lines tick: ${lines.map((l, i) => `${l}:${got[i]}`).join(' ; ')}`);
}

// 3. completed square and quadratic formula lines, over many monic questions
{
  let n = 0, bad = [];
  for (let d = 1; d <= 4; d++) for (let s = 1; s <= 120; s++) {
    let q; try { q = G.generateQuestion('y10-quadratics', d, s); } catch { continue; }
    const m = q && /^Solve \$x\^2 (?:([+-]) (\d*)x )?([+-]) (\d+) = 0\$\.$/.exec(q.prompt);
    if (!m || q.answerType !== 'set') continue;
    const b = m[1] ? (m[1] === '-' ? -1 : 1) * Number(m[2] || 1) : 0, c = (m[3] === '-' ? -1 : 1) * Number(m[4]);
    if (b % 2 !== 0) continue;
    const h = -b / 2, k = h * h - c, r = Math.sqrt(k);
    if (!Number.isInteger(r) || r === 0) continue;
    const sq = h === 0 ? 'x^2' : `(x ${h < 0 ? '+' : '-'} ${Math.abs(h)})^2`;
    const root = (sg) => h + sg * r;
    const br = h === 0 ? [`x = ${r}`, `x = -${r}`] : [`x ${h < 0 ? '+' : '-'} ${Math.abs(h)} = ${r}`, `x ${h < 0 ? '+' : '-'} ${Math.abs(h)} = -${r}`];
    const lines = [`${sq} = ${k}`, ...br, `x = ${root(1)}`, `x = ${root(-1)}`];
    const got = status(q, lines); n++;
    if (!got.every(x => x === 'ok')) bad.push(`${q.prompt} ${lines.map((l, i) => `${l}:${got[i]}`).join(' ; ')}`);
    // the formula's own value lines
    const f = [`x = (${-b} + sqrt(${b * b - 4 * c}))/2`, `x = (${-b} - sqrt(${b * b - 4 * c}))/2`];
    const fg = status(q, f);
    if (fg.includes('break')) bad.push(`formula crossed: ${q.prompt} ${f} ${fg}`);
    if (n >= 25) break;
  }
  ok(n >= 10 && bad.length === 0, `completed-square lines tick and formula lines are never crossed (${n} questions)${bad.length ? ': ' + bad[0] : ''}`);
}

// 4. a wrong-subset line over many questions: any "factor = 1" style line is a note, never a tick or a cross
{
  let n = 0, bad = 0;
  for (let d = 1; d <= 4; d++) for (let s = 1; s <= 120; s++) {
    let q; try { q = G.generateQuestion('y10-quadratics', d, s); } catch { continue; }
    const m = q && /^Solve \$(?:\d+)?\(x ([+-]) (\d+)\)\(x ([+-]) (\d+)\) = 0\$\.$/.exec(q.prompt);
    if (!m) continue;
    const roots = [m[1] === '-' ? Number(m[2]) : -Number(m[2]), m[3] === '-' ? Number(m[4]) : -Number(m[4])];
    if (roots[0] === roots[1]) continue;   // a repeated root: the line is then the FULL equation, and ticks
    const a = roots[0] - 1;   // x - a = 1 has the root roots[0]: true of one root of the question
    const line = `x ${a < 0 ? '+' : '-'} ${Math.abs(a)} = 1`;
    const st = status(q, [line])[0]; n++;
    if (st !== 'note') { bad++; if (bad === 1) console.log('  e.g.', q.prompt, line, st); }
  }
  ok(n >= 10 && bad === 0, `${n} factorised questions: "x ± a = 1" is always a note (${bad} not)`);
}

if (failures.length) { console.error(`SUBSET EQUATION TICKS: FAIL (${failures.length})`); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log(`SUBSET EQUATION TICKS: PASS: ${pass} checks`);
