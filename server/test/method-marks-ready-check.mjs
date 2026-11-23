// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · method marks, before they are switched on: do the marks and the page agree?
//
// R4 (marking authority). Nothing here switches anything on: method marks are marked through the server's own evidence path
// (markerOps.stepEvidence + practiceMarksEarned, what MARKER_OPS.practice runs when `policy.methodMarks === true`) inside this
// test process only; PRI_METHOD_MARKS is neither read nor set, and no deployed environment is touched. The sweep is
// tools/method-marks-ready.mjs; it prints its counts before and after the reconciliation (engine/markExplanation.js).
//
//   1. the sweep, the question types with a scheme, every difficulty, seeds 1..60, draft + corpus + falsified pages,
//      as written and as a four-mark copy: zero over-marking, zero credit on a crossed or after-mistake line, zero wrong
//      line paid, zero false tick, zero correct answers below full marks, and no reason for a mark that contradicts the page
//   2. the join, in isolation (constrainToShown, unsupportedCredit, reconcileLostRows)
//   3. the owner's product-rule page (y = x^2(x - 1), last line 3x^2 - x): what method marks pay, and the words on the page
//   4. error carried forward: after the first mistake nothing later earns, and the wording says so
//   5. wording: the new sentences exist in English and Hindi, say "not counted" and never "wrong" for a ticked line
//
//   node server/test/method-marks-ready-check.mjs
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import * as R from '../../tools/method-marks-ready.mjs';
import { constrainToShown, unsupportedCredit, reconcileLostRows } from '../../client/src/engine/markExplanation.js';
import { lostMarksForPage } from '../../client/src/components/attemptEvidence.js';
import { stepEvidence } from '../platform/markerOps.js';
import { markingPolicy, FINAL_ANSWER_ONLY } from '../platform/markingPolicy.js';
import en from '../../client/src/i18n/strings.en.js';
import hi from '../../client/src/i18n/strings.hi.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

// Nothing in this process may have switched the policy on: the sweep marks through the evidence path directly.
ok(markingPolicy({}) === FINAL_ANSWER_ONLY && markingPolicy({ PRI_METHOD_MARKS: '' }) === FINAL_ANSWER_ONLY, 'the policy with nothing set is final answer only');
ok(!process.env.PRI_METHOD_MARKS, 'this process does not set PRI_METHOD_MARKS');

// ── 1. the sweep ──────────────────────────────────────────────────────────────────────────────────────────────────
const before = await R.runSweep({ reconcile: false });
const after = await R.runSweep({ reconcile: true });
R.printCounts('BEFORE (no reconciliation: the card of the day before)', before);
R.printCounts('AFTER', after);
const A = after.total, B = before.total;
ok(A.asWritten.pages === B.asWritten.pages && A.asWritten.pages >= 1800, `${A.asWritten.pages} pages as written over ${R.TYPE_IDS.length} types`);
ok(R.TYPE_IDS.length === 7 && Object.keys(after.byType).length === 8, 'seven types with a scheme, and the first-wrong-step pages');
ok(A.asWritten.withMethod === B.asWritten.withMethod && A.stress.withMethod === B.stress.withMethod, 'the reconciliation changes no page that pays a method mark');
ok(A.stress.creditedLines >= 60, `the four-mark copy exercises the payment path: ${A.stress.creditedLines} credited lines`);
for (const mode of ['asWritten', 'stress']) for (const k of ['disagree', 'afterCross', 'over', 'correctLess', 'wrongPays', 'afterBreak', 'falseTick', 'unflagged', 'residual']) {
  ok(A[mode][k] === 0, `${mode}: ${k} = ${A[mode][k]} (must be 0)`);
}
ok(B.stress.afterCross >= 1 && B.stress.over >= 1 && A.stress.afterCross === 0 && A.stress.over === 0, `before: a mark was paid on a line after the page's own cross on ${B.stress.afterCross} page(s), over-marked on ${B.stress.over}; after: none`);
ok(!!after.byType['first-wrong-step'] && after.byType['first-wrong-step'].asWritten.pages >= 6, `the first-wrong-step pages are in the sweep (${after.byType['first-wrong-step']?.asWritten.pages} pages each way)`);
ok(A.asWritten.heldBack === B.asWritten.heldBack && A.asWritten.contradicts === B.asWritten.contradicts && A.asWritten.contradicts > 0, `a reason for a mark contradicted the page on ${A.asWritten.contradicts} pages`);
ok(B.asWritten.residual === B.asWritten.contradicts && B.stress.residual === B.stress.contradicts && B.stress.residual > 0, `before: the card still contradicted the page on ${B.asWritten.residual} pages as written, ${B.stress.residual} in the four-mark copy`);
ok(B.stress.afterUnseen === A.stress.afterUnseen && A.stress.afterUnseen > 0, `a wrong line the engine cannot judge, shown as a note, with a mark paid below it: ${A.stress.afterUnseen} four-mark pages (said, not hidden)`);
// Every page whose reasons contradict the page keeps the report that decided the marks beside the displayed one.
ok(A.asWritten.markingReport >= A.asWritten.contradicts && A.stress.markingReport >= A.stress.contradicts, `markingReport kept on ${A.asWritten.markingReport} / ${A.stress.markingReport} pages`);
for (const [id, row] of Object.entries(after.byType)) ok(row.questions > 0, `${id}: ${row.questions} questions`);

// ── 2. the join ───────────────────────────────────────────────────────────────────────────────────────────────────
{
  const L = (text, status, extra = {}) => ({ text, status, ...extra });
  const decided = { lines: [L('a', 'ok'), L('b', 'ok'), L('c', 'ok'), L('d', 'ok')] };
  const shown = [L('a', 'ok'), L('b', 'break'), L('c', 'ok'), L('d', 'note')];
  const rows = [{ index: 0, text: 'a', mark: 1 }, { index: 1, text: 'b', mark: 1 }, { index: 2, text: 'c', mark: 1 }, { index: 3, text: 'd', mark: 0 }];
  ok(unsupportedCredit(rows, shown).join() === '1,2', 'credit on the crossed line and on the line after it is unsupported');
  ok(unsupportedCredit(rows, [L('a', 'ok'), L('b', 'ok'), L('c', 'ok'), L('d', 'ok')]).length === 0, 'credit on ticked lines is supported');
  ok(unsupportedCredit(rows, [L('a', 'ok'), L('B changed', 'ok'), L('c', 'ok'), L('d', 'ok')]).join() === '1', 'a line whose text differs is not the line that was marked');
  // A cross the deciding report also made is the rubric's own business (an authored plan lets an independent stage earn after one).
  ok(unsupportedCredit(rows, shown, [L('a', 'ok'), L('b', 'break'), L('c', 'ok'), L('d', 'ok')]).join() === '1', 'a cross the deciding report also made does not remove later credit; the credit on the crossed line itself still goes');
  ok(unsupportedCredit(rows, null).length === 0 && unsupportedCredit(null, shown).length === 0, 'no report, nothing to compare');
  const c = constrainToShown(decided, shown, [1, 2]);
  ok(c.clipped === 2 && c.report.lines[1].status === 'note' && c.report.lines[2].status === 'note' && c.report.lines[0].status === 'ok' && c.report.lines[3].status === 'ok', 'only the unsupported credited lines are made notes');
  ok(constrainToShown(decided, decided.lines, []).report === decided, 'nothing to clip returns the deciding report itself');
  ok(decided.lines[1].status === 'ok', 'the deciding report is not mutated');
  // reconcileLostRows
  const lost = [
    { line: 2, key: 'marks.lost.unverified', vars: { line: 2 }, text: 'x' },
    { line: 3, key: 'marks.lost.unverified', vars: { line: 3 }, text: 'x' },
    { line: 4, key: 'marks.lost.unverified', vars: { line: 4 }, text: 'x' },
    { line: 1, key: 'marks.lost.restated', vars: { line: 1 }, text: 'x' }
  ];
  const r = reconcileLostRows(lost, shown);
  ok(r.rows.map(x => x.key).join() === 'marks.lost.crossedNoMark,marks.lost.afterBreak,marks.lost.afterBreak,marks.lost.restated', `crossed -> crossedNoMark; after the cross -> afterBreak: ${r.rows.map(x => x.key)}`);
  ok(r.rows[1].vars.breakLine === 2 && r.rows[2].vars.breakLine === 2 && r.replaced === 3 && r.dropped === 0, 'afterBreak names the line the page crosses');
  const ticked = reconcileLostRows([{ line: 1, key: 'marks.lost.unverified', vars: { line: 1 } }], [L('a', 'ok')]);
  ok(ticked.rows[0].key === 'marks.lost.tickedNotCounted', 'a ticked line is "ticked, not counted", never "could not be read"');
  const note = [{ line: 1, key: 'marks.lost.unverified', vars: { line: 1 } }];
  ok(reconcileLostRows(note, [L('a', 'note')]).rows === note, 'a line the page also leaves unchecked keeps its row, same array');
  const slip = [{ line: 2, key: 'marks.lost.break', vars: { line: 2 } }, { line: 3, key: 'marks.lost.afterBreak', vars: { line: 3, breakLine: 2 } }];
  ok(reconcileLostRows(slip, [L('a', 'ok'), L('b', 'note'), L('c', 'ok')]).dropped === 2, 'rows that point at a mistake the page does not show are dropped');
  ok(reconcileLostRows(slip, [L('a', 'ok'), L('b', 'break'), L('c', 'ok')]).rows === slip, 'rows that point at a mistake the page shows stay, same array');
  ok(reconcileLostRows([], shown).rows.length === 0 && reconcileLostRows(lost, []).rows === lost, 'empty in, empty out');
  // the card
  const cardOff = lostMarksForPage({ lost, stepReport: { lines: shown } });
  ok(cardOff.rows === lost && cardOff.fromCheckable === false, 'without markingReportDiffers the card changes nothing');
  const cardOn = lostMarksForPage({ lost, stepReport: { lines: shown }, markingReportDiffers: true });
  ok(cardOn.rows.map(x => x.key).join() === 'marks.lost.crossedNoMark,marks.lost.afterBreak,marks.lost.afterBreak,marks.lost.restated' && cardOn.fromCheckable === false, 'with it the card words each row from the page');
}

// ── 3. the owner's product-rule page ────────────────────────────────────────────────────────────────────────────
const QUESTION = { id: 'owner-product-rule', answerType: 'expression', difficulty: 3, steps: [], answer: { expr: '3x^2-2x' },
  prompt: 'Use the product rule to differentiate $y = x^{2}(x - 1)$, giving your answer expanded and simplified.' };
const HEAD = ['Differentiate y = x^2(x-1) using the product rule.', 'Let u = x^2 and v = x - 1.', "Then u' = 2x and v' = 1.", 'By the product rule,', "dy/dx = u'v + uv'", '= 2x(x-1) + x^2(1)', '= 2x(x-1) + x^2', '= 2x^2 - 2x + x^2'];
const OWNER = [...HEAD, '= 3x^2 - x'];
const page = (lines, wrongFrom = null) => ({ source: 'fixture', lines, wrongFrom, wrong: wrongFrom === null ? [] : [wrongFrom] });
{
  const one = R.judgePage(QUESTION, page(OWNER, 8));
  ok(one.possible === 1 && one.result.correct === false && one.marks === 0 && !one.ev.partial.awarded, `owner page as written: ${one.marks} of ${one.possible}, method marks ${one.ev.partial?.awarded}`);
  ok(/single mark/.test(one.ev.partial.note), 'a one-mark question carries no method mark and says so');
  const four = R.judgePage(R.asFourMarks(QUESTION), page(OWNER, 8));
  ok(four.possible === 4 && four.marks === 3 && four.ev.partial.awarded === 3, `as a four-mark question: ${four.marks} of ${four.possible}`);
  ok(four.credited.map(i => i + 1).join() === '6,7,8', `lines 6, 7 and 8 earn: ${four.credited.map(i => i + 1)}`);
  const st = four.ev.stepReport.lines.map(l => l.status);
  ok(st[8] === 'break' && [5, 6, 7].every(i => st[i] === 'ok') && st[0] === 'note' && st[3] === 'note', `the page ticks 2, 3, 5 to 8, crosses 9: ${st}`);
  ok(four.flags.disagree === false && four.flags.afterCross === false && four.flags.over === false, 'no credited line is unticked, crossed or after the cross');
  ok(!!four.ev.markingReport, 'the report that decided the marks is kept beside the displayed one');
  const card = lostMarksForPage({ lost: four.ev.partial.lost, stepReport: four.ev.stepReport, markingReportDiffers: true });
  const keyAt = n => card.rows.filter(r => r.vars?.line === n).map(r => r.key);
  ok(keyAt(2).join() === 'marks.lost.tickedNotCounted' && keyAt(3).join() === 'marks.lost.tickedNotCounted' && keyAt(5).join() === 'marks.lost.tickedNotCounted', 'lines 2, 3 and 5 are ticked on the page and say "ticked, not counted"');
  ok(keyAt(9).includes('marks.lost.crossedNoMark') && !keyAt(9).includes('marks.lost.unverified'), 'line 9 is crossed on the page and says so');
  ok(keyAt(1).join() === 'marks.lost.unverified' && keyAt(4).join() === 'marks.lost.unverified', 'lines 1 and 4 (the page leaves them unchecked) keep "could not be read"');
  ok(card.rows.every(r => r.key !== 'marks.lost.unverified' || ['note'].includes(four.ev.stepReport.lines[r.vars.line - 1]?.status)), 'no "could not be read" row on a line the page ticks or crosses');
  // the right answer on the same page: full marks, as ever, and no method mark is computed
  const right = R.judgePage(QUESTION, page([...HEAD, '= 3x^2 - 2x']));
  ok(right.result.correct === true && right.marks === 1 && !right.ev.partial, 'the right answer is the full mark and carries no method mark');
}

// ── 4. error carried forward: nothing later earns, and the page says so ────────────────────────────────────────────
{
  // A slip on line 8 (a first wrong step the page crosses), then lines that follow from it and one that is right again.
  const slipThenFollow = R.judgePage(R.asFourMarks(QUESTION), page([...HEAD.slice(0, 7), '= 2x^2 - 2x + 2x^2', '= 4x^2 - 2x', '= 2x(2x - 1)'], 7));
  const st = slipThenFollow.ev.stepReport.lines.map(l => l.status);
  ok(st[7] === 'break', `the page crosses line 8: ${st}`);
  ok(slipThenFollow.credited.every(i => i < 7), `only lines before the cross earn: ${slipThenFollow.credited.map(i => i + 1)}`);
  ok(slipThenFollow.credited.map(i => i + 1).join() === '6,7' && slipThenFollow.marks === 2, `marks ${slipThenFollow.marks}: the two lines before the cross`);
  const card = lostMarksForPage({ lost: slipThenFollow.ev.partial.lost, stepReport: slipThenFollow.ev.stepReport, markingReportDiffers: !!slipThenFollow.ev.markingReport });
  const after = card.rows.filter(r => r.vars?.line > 8 && r.key !== 'marks.lost.answer').map(r => r.key);
  ok(after.length >= 1 && after.every(k => k === 'marks.lost.afterBreak' || k === 'marks.lost.carried'), `lines after the cross are worded "comes after the mistake on line 8": ${after}`);
  ok(card.rows.filter(r => r.key === 'marks.lost.afterBreak').every(r => r.vars.breakLine === 8), 'the sentence names the line the page crosses');
  // The first wrong step is the page's own cross (the topic check left it a note). A line after it that is true again must not earn:
  // before this work it did (3 of 4 marks); now the mark rests on the two lines before the cross.
  {
    const lines = [...HEAD.slice(0, 7), '= 2x^2 - 2x + 2x^2', '= 3x^2 - 2x'];
    const pg = { source: 'fixture', lines, answer: '3x^2-x', wrongFrom: 7, wrong: [7] };
    const was = R.judgePage(R.asFourMarks(QUESTION), pg, { reconcile: false });
    const now = R.judgePage(R.asFourMarks(QUESTION), pg);
    ok(was.credited.map(i => i + 1).join() === '6,7,9' && was.marks === 3 && was.flags.afterCross && was.flags.over, `before: line 9 (true again) earned after the cross: ${was.credited.map(i => i + 1)}, ${was.marks} marks`);
    ok(now.credited.map(i => i + 1).join() === '6,7' && now.marks === 2 && !now.flags.afterCross && !now.flags.over, `after: ${now.credited.map(i => i + 1)}, ${now.marks} marks`);
    ok(!!now.ev.markingReport && now.ev.markingReport.lines[8].status === 'note', 'the report that decided the (clipped) marks is kept beside the displayed one');
    const card = lostMarksForPage({ lost: now.ev.partial.lost, stepReport: now.ev.stepReport, markingReportDiffers: true });
    ok(card.rows.some(r => r.key === 'marks.lost.afterBreak' && r.vars.line === 9 && r.vars.breakLine === 8), 'line 9 is worded "comes after the mistake on line 8"');
  }
  // The wrong line is never a plain tick, wherever it falls in the sweep.
  ok(A.asWritten.falseTick === 0 && A.stress.falseTick === 0, 'no wrong line is ticked in the sweep');
}
// Error carried forward on every type: after the first mistake of the report that decided the marks, nothing earns.
for (const [id, row] of Object.entries(after.byType)) ok(row.stress.afterBreak === 0 && row.asWritten.afterBreak === 0, `${id}: nothing earned after a mistake`);

// ── 5. wording ────────────────────────────────────────────────────────────────────────────────────────────────────
for (const k of ['marks.lost.tickedNotCounted', 'marks.lost.crossedNoMark']) {
  ok(typeof en[k] === 'string' && typeof hi[k] === 'string' && hi[k].length > 10, `${k} exists in English and Hindi`);
  ok(!/[—–]/.test(en[k] + hi[k]) && /\{line\}/.test(en[k]) && /\{line\}/.test(hi[k]), `${k}: no dash, names the line`);
}
ok(/not counted/.test(en['marks.lost.tickedNotCounted']) && /does not mean it is wrong/.test(en['marks.lost.tickedNotCounted']), 'a ticked line that earned nothing is "not counted", and is said not to be wrong');
ok(!/\bwrong\b(?! does| means)/.test(en['marks.lost.tickedNotCounted'].replace('does not mean it is wrong', '')), 'it never calls a ticked line wrong');
// the server still pays nothing without the switch: the same page through the policy-off evidence has no method mark
{
  const ev = stepEvidence(R.asFourMarks(QUESTION), '3x^2-x', OWNER.join('\n'), { correct: false }, { slipWarnings: true });
  ok(ev.partial && ev.partial.awarded === 3, 'the evidence path computes the method mark; the policy (markerOps MARKER_OPS.practice) is what withholds it');
}

if (failures.length) { console.error(`METHOD MARKS READY: FAIL (${failures.length})`); for (const f of failures) console.error(`  ${f}`); process.exit(1); }
console.log(`METHOD MARKS READY: PASS: ${pass} checks`);
