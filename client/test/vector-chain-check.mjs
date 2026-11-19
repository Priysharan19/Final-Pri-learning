// Pri Learning · step verdicts for column-vector working (engine/vectorChain.js).
//
// Owner report, 19 November 2026: "Given a = (-5, -1) and b = (-2, 4), find
// |4a + 3b|". A photographed page of five lines came back with no line judged
// ("Your working was not verified"), although the fourth line turned
// (-20 - 6, -4 + 12) into (14, 8). The question carried no Step Check meta.
//
// Part 1  The owner's page exactly as the live reader returned it, and the
//         rules with adversarial lines.
// Part 2  Over the generated family, against vectors parsed back out of the
//         prompt (never the generator's `stepcheck`): true working is never
//         crossed, and a line with one component changed is never ticked.
// Part 3  The server's meta reaches the checker, and the report buys no method
//         mark and counts as no verified transition.
import { stepCheck, methodMarks } from '../src/engine/checker.js';
import { fullyVerifiedWorking } from '../src/engine/misconceptions.js';
import { forms } from '../src/engine/generators/au-forms-ext1-b-nsw.js';
import { vectorChainMeta } from '../src/engine/vectorChain.js';
import { workingEvidence } from '../src/components/attemptEvidence.js';
import { stepMetaFor } from '../../server/platform/markerOps.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const META = { kind: 'vector-chain', vectors: { a: [-5, -1], b: [-2, 4] }, target: '|4*a+(3)*b|' };
const run = (lines, meta = META) => stepCheck(meta, lines.join('\n'));
const st = (lines, meta = META) => run(lines, meta).lines.map(l => l.status).join();

// ── Part 1 · the owner's page, as the live reader returned it ────────────────
const PAGE = ['|4a+3b|', '= |4[-5,-1]+3[-2,4]|', '= |[-20,-4]-[-6,+12]|', '= [14,8] = √(14^2+8^2)', '196', '+64', '260', '= √260'];
let r = run(PAGE);
ok(r.lines.map(l => l.status).join() === 'ok,ok,note,break,note,note,note,note', `the owner's page: two ticks, the slip crossed (${r.lines.map(l => l.status)})`);
ok(r.firstBreak === 3 && r.lines[3].state === 'wrong', 'the cross is on the line where -20 - 6 became 14');
ok(/\(−26, 8\)/.test(r.diagnosis?.message || '') && /\(14, 8\)/.test(r.diagnosis?.message || ''), `the reason names both vectors (${r.diagnosis?.message})`);
ok(r.lines[0].state === 'given' && r.lines[1].state === 'verified', 'the restated question is "given", the substitution is verified');
ok(r.lines[2].status === 'note', 'the stacked sum that was misread as [-6,+12] is a note, never a cross');
ok(r.source === 'value-chain' && r.summary.wrong.join() === '4', 'the report has the value-chain shape');
const ev = workingEvidence({ res: { stepReport: r }, submitted: { hasWorking: true, lines: PAGE } });
ok(ev?.kind === 'break' && ev.line === 4, `the result card reports a break at line 4 (${JSON.stringify(ev)})`);

// the same page as the reader returned it a second time: the margin sum read in the middle of the chain
r = run(['|4a+3b|', '= |4[-5;-1]+3[-2;4]|', '= |[-20 -6; -4 +12]|', '196 +64 / 260', '= |[14; 8]| = sqrt(14^2 + 8^2)', '= sqrt(260)']);
ok(r.lines.map(l => l.status).join() === 'ok,ok,ok,note,break,note', `a margin sum in the middle does not hide the slip (${r.lines.map(l => l.status)})`);
ok(st(['|4a+3b|', '196', '+64', '= 260']) === 'ok,note,note,note', 'a `=` line of plain numbers after a margin sum is never held to the chain');
ok(st(['|4a+3b|', 'Hamilton paths', '= |[14;8]|']) === 'ok,note,note', 'words end the chain for good');
ok(st(['|4a+3b|', '196 + 64', '= |[-26;8]|', '= sqrt(740)']) === 'ok,note,ok,ok', 'and a true vector line after a margin sum is ticked');
// the same page written correctly, and read correctly
ok(st(['|4a+3b|', '= |4[-5,-1]+3[-2,4]|', '= |[-20-6,-4+12]|', '= |[-26,8]| = √(26^2+8^2)', '= √740', '≈ 27.20']) === 'ok,ok,ok,ok,ok,ok', 'correct working: every line ticked');
ok(st(['4a = (-20,-4)', '3b = (-6,12)', '4a+3b = (-26,8)', '|4a+3b| = √(676+64)', '= 27.2']) === 'ok,ok,ok,ok,ok', 'labelled working with round brackets: every line ticked');
ok(st(['a = [-5,-1]', 'b = [-2;4]', '4a + 3b = [-26;8]']) === 'ok,ok,ok', 'the given vectors restated, semicolon columns');

// false lines are crossed
ok(st(['|4a+3b| = |a|+|b|']) === 'break', 'the magnitude of a sum is not the sum of the magnitudes');
ok(st(['|4a+3b|', '= 4|a|+3|b|']) === 'ok,break', 'a continuation that names the vectors is still held to the chain');
ok(st(['4a = (-20,4)']) === 'break', 'a wrong multiple is crossed');
ok(st(['[-20,-4]+[-6,12]', '= [-26,8]', '= [14,8]']) === 'note,ok,break', 'a chain of numbers only: the false step is crossed');
ok(st(['[-20,-4]+[-6,12] = [14,8]']) === 'break', 'two vectors stated equal that are not');
ok(st(['|4a+3b| = 30']) === 'break', 'a wrong magnitude is crossed');
r = run(['4a+3b = (-26,8)', '= (14,8)', '|4a+3b| = √260']);
ok(r.lines.map(l => l.status).join() === 'ok,break,note' && r.lines[2].note === 'Follows from the earlier slip.', 'lines after the slip are not judged');

// never a false tick, never a false cross
// independent review, round 1: a length is never equal to a vector
for (const page of [['|4a+3b| = (-26,8)'], ['|a| = (-5,-1)'], ['|a| = a'], ['27.2 = (-26,8)']]) ok(st(page) === 'note', `a length stated equal to a vector is not ticked: ${page}`);
ok(st(['|4a+3b|', '= (-26,8)']) === 'ok,note' && st(['|4a+3b| = |(-26,8)|', '= (-26,8)']) === 'ok,note', 'nor as a continuation');
// independent review, round 1: a rounded value is never crossed
for (const page of [['|4a+3b| ≈ 27'], ['|a| ≈ 5'], ['|4a+3b| ≈ 30'], ['|a|+|b| = 5.10+4.47'], ['4|a| = 4(5.10)'], ['4|a| = 4 × 5.1 = 20.4'], ['a/|a| = (-0.98,-0.20)'], ['(1/3)a = (-1.67,-0.33)'], ['a/3 = (-1.67,-0.33)'], ['|a|^2 = 5.099^2'], ['|4a+3b| = 27.3']]) ok(!/break/.test(st(page)), `a line that may be a rounding is not crossed: ${page} (${st(page)})`);
ok(st(['|4a+3b|', '= |(-26,8)|', '= sqrt(740)', '≈ 27']) === 'ok,ok,ok,note', 'a coarser rounding at the end of a true chain is a note');
ok(st(['4a', '= (-20,-4)', '+ 3b', '= (-26,8)']) === 'ok,ok,note,note', 'a sum carried over two lines is not read, and its true total is not crossed');
ok(st(['|a| ~ 5']) === 'note', 'a tilde between values is not read as a product');
ok(st(['|a|² = 26', '|4a+3b| = √((-26)²+8²)']) === 'ok,ok', 'superscript squares are read');
ok(st(['|4a+3b|', '= |[26,8]|']) === 'ok,note', 'a different vector of the same length is not ticked');
ok(st(['|4a+3b|', '= [26,8]']) === 'ok,note', 'the same, with the bars left off');
ok(st(['|4a+3b| = 27']) === 'break', 'a whole number stated exactly equal is still held to the value');
ok(st(['|4a+3b| = 27.21']) === 'note' && st(['|4a+3b| = 35.5']) === 'note' && st(['|4a+3b| = 27.2']) === 'ok' && st(['|4a+3b| = 27.203']) === 'ok', 'a correctly rounded decimal is accepted; a near miss is a note');
ok(st(['196+64=250', '196', '+64', 'x = 3', 'a.b = 6', 'a·b = 6', 'let c = 4a']) === 'note,note,note,note,note,note,note', 'side arithmetic, other letters and dot products are not judged');
ok(st(['= [14,8]']) === 'note', 'a continuation of nothing is not judged');
ok(st(['4a = (-20,-4)', 'x = 3', '= (14,8)']) === 'ok,note,note', 'an unverified line that does not continue the chain ends it');
ok(st(['4a = (-20,-4)', '196', '= (14,8)']) === 'ok,note,break', 'a margin number does not: the vector line after it still continues the vector chain');
ok(st(['|4a+3b|', '= |4[-5,-1]+3[-2,4]', '= |[-26,8]|']) === 'ok,note,ok', 'an unread `=` line does not end the chain');
ok(st(['|4a+3b| > 20', '4a ≠ 3b']) === 'note,note', 'inequalities are not judged');
ok(st(['4a = (-20,-4,0)']) === 'note', 'a vector of another dimension is not judged');
ok(st(['4a+3b = (-26,+8)']) === 'note', 'a component with a leading plus is the misread signature: a note');
ok(st(['4a/0 = 3', 'sqrt(-4) = 2', '4a^2 = 3', '((((', '']) === 'note,note,note,note', 'malformed lines abstain');
ok(st(Array(14).fill('4a = (-20,-4)')).split(',').slice(12).join() === 'note,note', 'lines past the limit are not judged');
ok(vectorChainMeta({ kind: 'vector-chain', vectors: { a: [1, 2] }, target: '3' }) === null && vectorChainMeta({ kind: 'vector-chain', vectors: { a: [1, 2], b: [1, 2, 3] }, target: 'a' }) === null && vectorChainMeta({ kind: 'vector-chain', vectors: { ab: [1, 2] }, target: 'a' }) === null, 'a malformed meta is refused');
ok(st(['4a = (-20,-4)'], { kind: 'vector-chain', vectors: { a: [1, 'x'] }, target: 'a' }) === 'note', 'and judges nothing');

// ── Part 3 · wiring ──────────────────────────────────────────────────────────
ok(methodMarks({ meta: META, working: PAGE.join('\n'), marks: 3, prompt: '' }) === null, 'a vector-chain report buys no method mark');
ok(fullyVerifiedWorking(run(['4a+3b = (-26,8)'])) === false, 'and counts as no verified transition');

// ── Part 2 · the family, against the prompt parsed back ──────────────────────
function rngOf(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const skill = Object.keys(forms).find(k => forms[k].some(f => { for (let s = 1; s < 40; s++) { const q = f.make(rngOf(s)); if (q?.stepcheck?.kind === 'vector-chain') return true; } return false; }));
const family = forms[skill].filter(f => { for (let s = 1; s < 40; s++) { if (f.make(rngOf(s))?.stepcheck?.kind === 'vector-chain') return true; } return false; });
ok(family.length === 1, `one form carries the vector-chain meta (${family.length})`);
let swept = 0, falseTicks = 0, falseCrosses = 0, metaDisagrees = 0;
const colRe = /\\begin\{pmatrix\}\s*(-?\d+)\s*\\\\\s*(-?\d+)\s*\\end\{pmatrix\}/g;
for (let seed = 1; seed <= 600; seed++) {
  const q = family[0].make(rngOf(seed));
  if (!q) continue;
  swept++;
  // Parsed from the prompt alone: the two vectors, then p and q of |pa ± qb|.
  const cols = [...q.prompt.matchAll(colRe)].map(m => [Number(m[1]), Number(m[2])]);
  const tgt = q.prompt.match(/\\left\|(-?\d*)\\underset\{\\sim\}\{a\} ([+-]) (\d*)\\underset\{\\sim\}\{b\}\\right\|/);
  if (cols.length !== 2 || !tgt) { metaDisagrees++; continue; }
  const [a, b] = cols;
  const p = tgt[1] === '' ? 1 : tgt[1] === '-' ? -1 : Number(tgt[1]);
  const qq = (tgt[2] === '-' ? -1 : 1) * (tgt[3] === '' ? 1 : Number(tgt[3]));
  const c = [p * a[0] + qq * b[0], p * a[1] + qq * b[1]];
  const mag = Math.hypot(...c);
  if (Math.abs(mag - q.answer.value) > 0.006) metaDisagrees++;
  if (stepMetaFor(q) !== q.stepcheck) metaDisagrees++;
  const v = x => `[${x[0]},${x[1]}]`;
  const pa = [p * a[0], p * a[1]], qb = [qq * b[0], qq * b[1]];
  const target = `|${p}a+(${qq})b|`;
  const truth = [target, `= |${p}${v(a)}+(${qq})${v(b)}|`, `= |${v(pa)}+${v(qb)}|`, `= |${v(c)}|`, `= √(${c[0] * c[0]}+${c[1] * c[1]})`, `= ${mag.toFixed(2)}`, `${p}a = ${v(pa)}`, `${p}a+(${qq})b = ${v(c)}`];
  const res = stepCheck(q.stepcheck, truth.join('\n'), { prompt: q.prompt });
  if (res.lines.some(l => l.status !== 'ok')) { falseCrosses++; if (falseCrosses < 4) console.error('true line not ticked', seed, res.lines.map(l => `${l.status}:${l.text}`)); }
  // One component off by one, in every position it can be written.
  const off = [c[0] + 1, c[1]], off2 = [c[0], c[1] - 1];
  for (const wrong of [[target, `= |${v(off)}|`], [target, `= ${v(off2)}`], [`${p}a+(${qq})b = ${v(off)}`], [`${p}a = ${v([pa[0], pa[1] + 1])}`], [target, `= √(${c[0] * c[0] + 1}+${c[1] * c[1]})`], [`${target} = ${(mag + 0.02).toFixed(2)}`]]) {
    const w = stepCheck(q.stepcheck, wrong.join('\n'), { prompt: q.prompt });
    if (w.lines[w.lines.length - 1].status === 'ok') { falseTicks++; if (falseTicks < 4) console.error('false line ticked', seed, wrong); }
  }
}
ok(swept >= 300, `the sweep ran (${swept} questions)`);
ok(metaDisagrees === 0, `the prompt, the answer and the meta agree (${metaDisagrees} disagreements)`);
ok(falseCrosses === 0, `no true line is left unticked or crossed (${falseCrosses})`);
ok(falseTicks === 0, `no false line is ticked (${falseTicks})`);

console.log(`vector-chain-check: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
console.log('PASS vector-chain-check');
