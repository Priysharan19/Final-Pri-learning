// Pri Learning · the true-as-written fold (markerOps.foldTrueAsWritten)
//
// 20 November 2026 (live): the owner's integral page on a question WITH a topic Step Check came back "0 of 8 lines correct, none
// checked", though four lines were true as written and had been ticked an hour earlier on a question with no Step Check. After every
// mark is computed, a line the topic report left unjudged takes the true-as-written TICK. Feedback only: never a cross, never a line
// at or after the topic report's first break, never a mark.
//   a  the owner's page on a question whose topic check judges nothing on it
//   b  a topic cross: nothing after it is ticked by the fold
//   c  a page the topic check judges in full is unchanged
//   d  300 generated questions with a Step Check: marks, partial, first break and every topic-judged line identical with and without
import { stepEvidence, stepMetaFor, foldTrueAsWritten } from '../platform/markerOps.js';
import { reportWithInterpretation } from '../platform/lineInterpreter/overlay.js';
import { workingEvidence } from '../../client/src/components/attemptEvidence.js';
import { buildAnnotatedWorking } from '../../client/src/components/annotatedWorkingModel.js';
import * as G from '../../client/src/engine/generators/index.js';
import { SEEDS, transcriptsFor } from '../../tools/understanding-audit/corpus.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
await G.loadAllBanks();
const code = r => r.lines.map(l => (l.status === 'ok' ? 'T' : l.status === 'break' ? 'X' : '.')).join('');
const marks = e => JSON.stringify({ partial: e.partial, board: e.board ?? null });
const both = (q, lines) => { const w = lines.join('\n'); return { on: stepEvidence(q, '', w, { correct: false }), off: stepEvidence(q, '', w, { correct: false }, { fold: false }) }; };

const SIMPLIFY = { prompt: 'Simplify $3(x + 2)$.', answerType: 'expression', answer: { expr: '3*x+6' }, difficulty: 2, steps: [] };
ok(stepMetaFor(SIMPLIFY)?.kind === 'expression', 'the test question has a topic Step Check');

// a · the owner's page
{
  const PAGE = ['y = 2x(4 - x)', 'Area = ∫_0^4 2x(4 - x) dx', '= 2∫_0^4 4x - x^2 dx', '= 2[4x^2/2 - x^3/3]_0^4', '= 2[2x^2 - x^3/3]_0^4', '= 2[2(4)^2 - 4^3/3] = 2[32 - 64/3]', '16/3', '64/3'];
  const { on, off } = both(SIMPLIFY, PAGE);
  ok(code(off.stepReport) === '........', `before the fold nothing on the page is judged (${code(off.stepReport)})`);
  ok(code(on.stepReport) === '..TTTT.T', `after it lines 3 to 6 and the bare 64/3 are ticked (${code(on.stepReport)})`);
  ok(on.stepReport.lines.slice(2, 6).concat(on.stepReport.lines[7]).every(l => l.state === 'arithmetic' && l.valueChain?.rule), 'each is an arithmetic tick with its rule');
  ok(marks(on) === marks(off) && on.partial === off.partial, 'marks and partial are identical to before the fold');
  ok(on.stepReport.firstBreak === -1 && !on.stepReport.lines.some(l => l.status === 'break'), 'nothing is crossed');
  ok(on.stepReport.source === 'value-chain' && on.stepReport.folded === true && !on.stepReport.arithmetic, 'the report says which lines were checked, and is not the arithmetic-only report');
  const s = on.stepReport.summary;
  ok(s.total === 8 && s.checked === 5 && s.arithmetic.join() === '3,4,5,6,8' && s.unverified.join() === '1,2,7' && s.verified.length === 0 && s.wrong.length === 0, `the summary counts follow the lines (${JSON.stringify(s)})`);
  const ev = workingEvidence({ res: { stepReport: on.stepReport }, submitted: { hasWorking: true, lines: PAGE } });
  ok(ev.kind === 'some' && ev.which.checked.join() === '3,4,5,6,8' && ev.which.rest.join() === '1,2,7', 'the card says WHICH lines were checked');
  const model = buildAnnotatedWorking({ lines: PAGE, stepReport: on.stepReport });
  ok(model && model.cards.filter(c => c.status === 'checked').length === 5 && model.cards[2].note && model.cards[0].status === 'not-verified', 'the annotated page ticks those five and leaves the others as not checked');
  ok(reportWithInterpretation({ stepReport: on.stepReport, lineInterpretation: { lines: PAGE.map(() => ({ verdict: 'valid' })) }, working: PAGE.join('\n') }) === on.stepReport, 'the line interpreter leaves a folded report alone');
  // every line ticked: still says which, never "consistent with the solution"
  const allTrue = both(SIMPLIFY, ['2 + 2 = 4', '3 × 4 = 12']);
  ok(code(allTrue.on.stepReport) === 'TT' && workingEvidence({ res: { stepReport: allTrue.on.stepReport }, submitted: { hasWorking: true, lines: ['2 + 2 = 4', '3 × 4 = 12'] } }).kind === 'some', 'all lines true as written: reported as checked lines, not as consistent with the solution');
}
// b · a topic cross
{
  const PAGE = ['3(x + 2)', '3x + 5', '2 + 2 = 4', '3 × 4 = 12', '7 + 8 = 15'];
  const { on, off } = both(SIMPLIFY, PAGE);
  ok(code(off.stepReport) === '.X...' || off.stepReport.firstBreak === 1, `the topic check crosses line 2 (${code(off.stepReport)})`);
  ok(JSON.stringify(on.stepReport) === JSON.stringify(off.stepReport), 'nothing after the cross is ticked: the report is unchanged');
  ok(marks(on) === marks(off), 'marks are unchanged');
  const first = both(SIMPLIFY, ['2 + 2 = 4', '3(x + 2)', '3x + 5', '3 × 4 = 12']);
  ok(first.on.stepReport.firstBreak === first.off.stepReport.firstBreak && code(first.on.stepReport)[3] !== 'T' && first.on.stepReport.lines.every((l, i) => i < first.off.stepReport.firstBreak || l.status === first.off.stepReport.lines[i].status), 'a tick above the cross is allowed; none at or below it, the cross and its first break unchanged');
  const falseLine = both(SIMPLIFY, ['9 - 4 = 6', '3 × 4 = 12']);
  ok(falseLine.on.stepReport.lines[0].status !== 'ok' && falseLine.on.stepReport.lines.every(l => l.status !== 'break' || falseLine.off.stepReport.lines.some(o => o.status === 'break')), 'a false arithmetic line is never ticked and a cross is never copied from the arithmetic check');
}
// c · a page the topic check judges in full
{
  for (const page of [['3(x + 2)', '3x + 6'], ['3(x + 2)', '= 3x + 6'], ['3x + 6']]) {
    const { on, off } = both(SIMPLIFY, page);
    ok(JSON.stringify(on) === JSON.stringify(off), `fully judged page unchanged: ${page.join(' / ')}`);
  }
  ok(JSON.stringify(foldTrueAsWritten(null, null)) === 'null' && foldTrueAsWritten({ lines: [{ text: 'a', status: 'ok' }] }, { lines: [{ text: 'b', status: 'ok', state: 'arithmetic' }] }).lines[0].text === 'a', 'no report, or lines that do not match by text: no fold');
  const r = { lines: [{ text: 'a', status: 'note' }, { text: 'b', status: 'note' }], firstBreak: -1 };
  ok(foldTrueAsWritten(r, { lines: [{ text: 'a', status: 'ok', state: 'arithmetic' }] }) === r, 'a different number of lines: no fold');
}
// d · generated questions with a Step Check
{
  // the first 15 NSW Year 11 and 12 generators that issue questions with a Step Check
  const families = Object.keys(G.GENERATORS).sort().filter(id => /^(y1[12]|me1[12])-/.test(id)).filter(id => {
    for (let seed = 1; seed < 8; seed++) for (const d of [1, 2, 3, 4]) { try { const q = G.generateQuestion(id, d, seed); if (stepMetaFor(q) && q.answerType !== 'mcq' && !Array.isArray(q.boardScheme)) return true; } catch { /* next */ } }
    return false;
  }).slice(0, 15);
  let n = 0, differ = 0, trueTicked = 0, trueSeen = 0, falseTicked = 0, falseSeen = 0, markDiff = 0, brkDiff = 0, judgedDiff = 0, withMarks = 0;
  for (let pass2 = 0; pass2 < 40 && n < 300; pass2++) for (const id of families) for (const d of [1, 2, 3, 4]) {
    if (n >= 300) break;
    let q; try { q = G.generateQuestion(id, d, SEEDS[pass2 % 3] + pass2 * 7 + d * 3); } catch { continue; }
    if (!stepMetaFor(q) || q.answerType === 'mcq' || Array.isArray(q.boardScheme)) continue;
    const t = transcriptsFor(q)[0];
    if (!t) continue;
    const lines = [...t.lines.map(l => l.text), '7 + 8 = 15', '12 × 3 = 36', '9 - 4 = 6'];
    const w = lines.join('\n');
    let on, off;
    try { on = stepEvidence(q, '', w, { correct: false }); off = stepEvidence(q, '', w, { correct: false }, { fold: false }); } catch { continue; }
    n++;
    if (marks(on) !== marks(off)) markDiff++;
    if (on.partial?.awarded > 0) withMarks++;
    const A = on.stepReport, B = off.stepReport;
    if ((A?.firstBreak ?? -2) !== (B?.firstBreak ?? -2)) brkDiff++;
    const k = lines.length;
    if (A && B && A.lines.length === B.lines.length) {
      A.lines.forEach((l, i) => {
        const o = B.lines[i];
        const folded = l.status !== o.status || l.note !== o.note;
        if (folded) { differ++; if (!(o.status === 'note' && l.status === 'ok' && l.state === 'arithmetic' && (B.firstBreak < 0 || i < B.firstBreak))) judgedDiff++; }
        if (i === k - 3 || i === k - 2) { trueSeen++; if (l.status === 'ok') trueTicked++; }
        if (i === k - 1) { falseSeen++; if (l.status === 'ok') falseTicked++; }
      });
    } else if (A && !B) { /* a topic report that was null: the arithmetic report stands in */ A.lines.forEach((l, i) => { if (i === k - 1 && l.status === 'ok') falseTicked++; if (i === k - 1) falseSeen++; }); }
    else if (JSON.stringify(A) !== JSON.stringify(B)) judgedDiff++;
  }
  ok(n >= 300, `${n} generated questions with a Step Check from ${families.length} generators`);
  ok(markDiff === 0, `awarded marks and partial identical with and without the fold (${markDiff} differ, ${withMarks} questions with method marks)`);
  ok(brkDiff === 0, `first break identical (${brkDiff} differ)`);
  ok(judgedDiff === 0, `every line the topic check judged is identical; the only changes are notes becoming arithmetic ticks above any break (${differ} lines folded, ${judgedDiff} other changes)`);
  ok(falseSeen > 0 && falseTicked === 0, `the false arithmetic line is never ticked (${falseSeen} seen)`);
  ok(trueSeen > 0 && trueTicked > 0, `true unrelated arithmetic lines are ticked where the topic check left them (${trueTicked} of ${trueSeen})`);
  console.log(`  fold: ${n} questions, ${differ} lines folded, true unrelated lines ticked ${trueTicked}/${trueSeen}, false lines ticked ${falseTicked}/${falseSeen}`);
}

console.log(`STEP FOLD: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — a line the topic check left unjudged takes a true-as-written tick; marks, partial, first break and judged lines unchanged; no cross copied`);
if (fail) process.exit(1);
