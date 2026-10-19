// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Every lost mark names its line and the rule it broke
//
// Ledger 3.6 (closed PR #366, re-implemented on the #430 first-error / error-
// carried-forward report). A student who loses a mark is told which line lost
// it and why — in the language they read. This suite pins:
//
//   · methodMarks() returns one `lost` entry per mark not awarded, carrying the
//     1-based line and a catalogue key (plus the rule's own key), never prose
//     assembled in the engine;
//   · on the #430 report the FIRST break is named once, with its rule; a later
//     independent break names its own rule as a second mistake; a line correct
//     on the student's own slip (`ecf`) says it was carried forward, never
//     that it is wrong; the answer mark of a carried page points back to the
//     first break;
//   · the server's evidence (markerOps.stepEvidence) carries the same list;
//   · explaining never changes a mark: `awarded` is what it was without it;
//   · awardStepMarks() (board-style scheme) names the breaking line and rule;
//   · every key the marker can emit exists in BOTH the English and the Hindi
//     catalogue with identical placeholders, and the Hindi string is Hindi.
//
// Every case is authored. Nothing here is generated.
// ─────────────────────────────────────────────────────────────────────────────
import { methodMarks, ruleKeyFor, lostMarks, checkAnswer } from '../src/engine/checker.js';
import { LOST_MARK_KEYS } from '../src/engine/lost-marks.js';
import { awardStepMarks } from '../src/engine/cbseMarking.js';
import { loadAllBanks, generateQuestion } from '../src/engine/generators/index.js';
import { stepEvidence } from '../../server/platform/markerOps.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

await loadAllBanks();

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const fill = (template, vars) => String(template).replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
/** Render a lost entry the way the card does, in one language. */
function render(catalogue, entry) {
  const rule = entry.ruleKey ? catalogue[entry.ruleKey] : '';
  return fill(catalogue[entry.key], { ...entry.vars, rule: typeof rule === 'object' ? rule.other : rule });
}
const DEVANAGARI = /[ऀ-ॿ]/;
const keysOf = lost => (lost || []).map(l => `${l.line}:${l.key}`);

// ── 1 · A slip on line 2 of a three-mark equation ────────────────────────────
const meta = { kind: 'equation', variable: 'x', solutions: [-2] };
const prompt = 'Solve $2x - 7 = -11$.';
{
  const working = '2x - 7 = -11\n2x = -18\nx = -9';
  const mm = methodMarks({ meta, working, marks: 3, prompt });
  ok(mm && Array.isArray(mm.lost), 'methodMarks returns a lost list');
  const lost = mm?.lost || [];
  const onLine2 = lost.find(l => l.line === 2);
  eq(onLine2?.key, 'marks.lost.break', 'line 2 is reported as the first mistake');
  ok(typeof onLine2?.ruleKey === 'string' && onLine2.ruleKey in en && onLine2.ruleKey in hi, `the break names a bilingual rule (${onLine2?.ruleKey})`);
  const after = lost.find(l => l.line === 3);
  eq(after?.key, 'marks.lost.afterBreak', 'line 3 is reported as coming after the mistake');
  eq(after?.vars?.breakLine, 2, 'and it points back to line 2');
  eq(lost.filter(l => l.key === 'marks.lost.break').length, 1, 'the first mistake is named once');
  eq(lost.at(-1)?.key, 'marks.lost.answer', 'the answer mark is named last');
  eq(lost.find(l => l.line === 1)?.key, 'marks.lost.restated', 'line 1 restates the question — said so');
  ok(lost.every(l => Number.isInteger(l.line) && l.line >= 1), 'every entry carries a whole-number line');
  eq(onLine2?.text, render(en, onLine2), 'the English text equals the English catalogue rendering');
  ok(DEVANAGARI.test(render(hi, onLine2)), 'the Hindi rendering is Hindi');
  ok(!/\{\w+\}/.test(render(hi, onLine2)) && !/\{\w+\}/.test(render(en, onLine2)), 'no placeholder is left unfilled in either language');
  ok(/2/.test(render(hi, onLine2)), 'the Hindi line names line 2');
}

// ── 2 · Perfect working, wrong final answer: only the answer mark is lost ────
{
  const mm = methodMarks({ meta, working: '2x - 7 = -11\n2x = -4\nx = -2', marks: 3, prompt });
  eq(mm?.awarded, 2, 'two method marks for two lines that move the solution on');
  eq((mm?.lost || []).filter(l => l.key !== 'marks.lost.answer').map(l => l.key), ['marks.lost.restated'], 'the only other note is the restated first line');
}

// ── 3 · An unreadable line is named as unverified, not silently skipped ──────
{
  const mm = methodMarks({ meta, working: '2x - 7 = -11\nmove the 7 across\n2x = -4\nx = -2', marks: 4, prompt });
  eq((mm?.lost || []).find(l => l.key === 'marks.lost.unverified')?.line, 2, 'the prose line is line 2 and is named as unverifiable');
}

// ── 4 · A repeated step is named as a repeat ─────────────────────────────────
{
  const mm = methodMarks({ meta, working: '2x - 7 = -11\n2x = -4\n2x = -4\nx = -2', marks: 4, prompt });
  eq((mm?.lost || []).find(l => l.key === 'marks.lost.repeat')?.line, 3, 'the second copy of a line is the repeat');
}

// ── 5 · The #430 AP sum (seed 7000: a = 20, d = 3, n = 18, S = 819) ──────────
// Judged the way the server judges it: markerOps.stepEvidence.
const D2 = generateQuestion('c10-arithmetic-progressions', 2, 7000);
eq([D2.answer.value, D2.stepcheck.ecf], [819, 'method'], 'D2: the sum question, error carried forward by method');
function serverLost(lines, answer) {
  const working = lines.join('\n');
  const result = checkAnswer(D2, String(answer));
  return { result, ...stepEvidence(D2, String(answer), working, result) };
}
{
  // A wrong sum formula, then substituted into: the formula is the first
  // mistake; the substitution and its arithmetic are true OF that formula —
  // carried forward, not wrong — and the answer carries the line-3 mistake.
  const e = serverLost(['a = 20, d = 3, n = 18', 'l = 20 + 17 × 3 = 71', 'S_n = n(a + l)', 'S_18 = 18(20 + 71)', '= 1638'], 1638);
  eq(e.result.correct, false, 'AP formula error: 1638 is wrong');
  eq(e.stepReport.lines.map(l => l.ecf === true), [false, false, false, true, true], 'AP formula error: lines 4–5 are carried forward in the report');
  eq(keysOf(e.partial?.lost), ['1:marks.lost.restated', '3:marks.lost.break', '4:marks.lost.carried', '5:marks.lost.carried', '5:marks.lost.answerCarried'],
    'AP formula error: first mistake once, the carried lines say so, the answer points back');
  eq(e.partial?.lost?.find(l => l.line === 3)?.ruleKey, 'marks.rule.formulaError', 'AP formula error: the rule is the formula');
  ok((e.partial?.lost || []).filter(l => l.key === 'marks.lost.carried').every(l => l.vars.breakLine === 3), 'AP formula error: every carried line points at line 3');
  ok(!(e.partial?.lost || []).some(l => l.key === 'marks.lost.carried' && /wrong|mistake/i.test(l.text.replace(/not wrong/i, ''))), 'AP formula error: a carried line is never called a mistake');
  eq(e.partial?.awarded, 0, 'AP formula error: still no method mark');
}
{
  // A given copied wrongly, then a second, independent arithmetic slip: two
  // mistakes, each with its own rule; the first is not repeated.
  const e = serverLost(['a = 21, d = 3, n = 18', 'S_n = n/2 (2a + (n-1)d)', 'S_18 = 18/2 (2 × 21 + 17 × 3)', '= 844'], 844);
  eq(keysOf(e.partial?.lost), ['1:marks.lost.break', '4:marks.lost.anotherBreak', '4:marks.lost.answer'], 'AP two slips: the first named once, the second as a separate mistake');
  eq(e.partial?.lost?.map(l => l.ruleKey), ['marks.rule.givenMisread', 'misconception.arithmeticSlip.name', null], 'AP two slips: each names its own rule');
  eq(e.partial?.awarded, 1, 'AP two slips: the method mark before the second slip stands');
}
{
  // A given copied wrongly and carried through correctly: one mistake, the
  // carried final line says so, and the answer mark points back to line 1.
  const e = serverLost(['a = 21, d = 3, n = 18', 'S_n = n/2 (2a + (n-1)d)', 'S_18 = 18/2 (2 × 21 + 17 × 3)', '= 837'], 837);
  eq(keysOf(e.partial?.lost), ['1:marks.lost.break', '4:marks.lost.carried', '4:marks.lost.answerCarried'], 'AP carried given: one mistake, carried, answer points back');
  eq(e.partial?.awarded, 1, 'AP carried given: the method mark stands');
}
{
  // Explanation never changes the award: the vector's marks are untouched.
  const lines = ['a = 20, d = 3', 'a_n = a + (n-1)d', 'a_18 = 20 + 17 × 3 = 72', 'S_n = n/2 (a + l)', 'S_18 = 18/2 (20 + 72)', '= 828'];
  const e = serverLost(lines, 828);
  const sum = (e.partial?.lines || []).reduce((s, r) => s + r.mark, 0);
  eq([e.partial?.awarded, sum], [1, 1], 'AP slipped last term: one method mark, the vector sums to it');
  eq(e.partial?.lost?.filter(l => l.key === 'marks.lost.break').map(l => l.line), [3], 'AP slipped last term: line 3 is the first mistake, once');
  ok(!(e.partial?.lost || []).some(l => l.line === 2), 'AP slipped last term: the line that earned is not listed as lost');
}

// ── 6 · ruleKeyFor covers every diagnosis code the engine can emit ───────────
{
  const { DIAGNOSIS_CODES } = await import('../src/engine/diagnose.js');
  const CHAIN = ['formula-error', 'formula-misapplied', 'given-misread', 'value-slip', 'system-line-false', 'extraneous-solution', 'lost-root'];
  for (const code of [...DIAGNOSIS_CODES, ...CHAIN]) {
    const key = ruleKeyFor({ diagnosis: { code }, text: 'x = 1' }, meta);
    ok(typeof en[key] === 'string' && typeof hi[key] === 'string', `diagnosis "${code}" maps to a bilingual rule key (${key})`);
    ok(!['marks.rule.equationBroken'].includes(key), `diagnosis "${code}" names its own rule, not the generic one`);
  }
  eq(ruleKeyFor({ text: 'x = 2 ± 3' }, meta), 'marks.rule.plusMinusBranch', 'a ± line without a diagnosis names the ± rule');
  eq(ruleKeyFor({ text: '7' }, meta), 'marks.rule.valueWrong', 'a bare value names the value rule');
  eq(ruleKeyFor({ text: '3x + 2' }, { kind: 'expression' }), 'marks.rule.expressionBroken', 'an expression line names the expression rule');
  eq(ruleKeyFor({ diagnosis: { code: 'not-a-code' }, text: 'x = 1' }, meta), 'marks.rule.equationBroken', 'an unknown code falls back to a catalogued rule');
}

// ── 7 · Board-style scheme names the breaking line ───────────────────────────
{
  const SETS = {
    marks: 3,
    prompt: 'In a class, n(A) = 12, n(B) = 11 and n(A ∩ B) = 9. Find n(A ∪ B).',
    answer: { value: 14 },
    steps: [
      { h: 'The addition rule for sets', d: 'n(A ∪ B) = n(A) + n(B) − n(A ∩ B)' },
      { h: 'Substitute', d: '= 12 + 11 − 9' },
      { h: 'Evaluate', d: '= 14' }
    ]
  };
  const report = { lines: [{ status: 'ok' }, { status: 'break', text: '12 + 11 - 9 = 15', diagnosis: { code: 'arithmetic-slip' } }, { status: 'note' }] };
  const award = awardStepMarks({ question: SETS, workingLines: ['n(A ∪ B) = n(A) + n(B) − n(A ∩ B)', '12 + 11 − 9 = 15', '15'], stepReport: report, answerText: '15', correct: false });
  const withheld = award.rows.filter(r => r.earned < r.outOf && r.kind !== 'answer');
  ok(withheld.length >= 1, 'a step point is withheld');
  eq(withheld[0]?.whyKey, 'board.whyBrokeAtLine', 'and it is explained by the breaking line');
  eq(withheld[0]?.whyVars?.line, 2, 'line 2');
  eq(withheld[0]?.whyVars?.ruleKey, 'misconception.arithmeticSlip.name', 'with the diagnosed rule');
  ok(/line 2/.test(withheld[0]?.why || '') && !/\{\w+\}/.test(withheld[0]?.why || ''), `the English sentence names line 2: ${withheld[0]?.why}`);
  const hiText = fill(hi['board.whyBrokeAtLine'], { ...withheld[0].whyVars, rule: hi[withheld[0].whyVars.ruleKey] });
  ok(DEVANAGARI.test(hiText) && /2/.test(hiText) && !/\{\w+\}/.test(hiText), `the Hindi sentence names line 2 and the rule: ${hiText}`);
  eq(award.awarded, awardStepMarks({ question: SETS, workingLines: ['a', 'b', 'c'], stepReport: report, answerText: '15', correct: false }).awarded, 'the explanation does not change the board award');

  const unread = awardStepMarks({ question: SETS, workingLines: ['the rule', 'then 15'], stepReport: { lines: [{ status: 'note' }, { status: 'note' }] }, answerText: '15', correct: false });
  const first = unread.rows.find(r => r.kind !== 'answer' && r.earned < r.outOf);
  eq(first?.whyKey, 'board.whyUnverifiedLine', 'unreadable working is explained by the unreadable line');
  eq(first?.whyVars?.line, 1, 'line 1');
}

// ── 8 · Every emitted key is bilingual with matching placeholders ────────────
{
  const RULES = Object.keys(en).filter(k => k.startsWith('marks.rule.'));
  const keys = [...LOST_MARK_KEYS, 'marks.lost.heading', ...RULES, 'board.whyBrokeAtLine', 'board.whyUnverifiedLine'];
  const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const key of keys) {
    ok(typeof en[key] === 'string', `${key} exists in English`);
    ok(typeof hi[key] === 'string' && DEVANAGARI.test(hi[key]), `${key} exists in Hindi and is Hindi`);
    eq(holes(hi[key]), holes(en[key]), `${key} has the same placeholders in both languages`);
  }
  const vec = [{ status: 'break', mark: 0, reason: 'break' }, { status: 'note', mark: 0, reason: 'note' }, { status: 'ok', mark: 0, reason: 'restated' }, { status: 'ok', mark: 0, reason: 'repeat' }, { status: 'ok', mark: 1, reason: 'progress' }];
  const lines = [{ text: '2x = -18' }, { note: 'Follows from the earlier slip.' }, { text: '2x - 7 = -11' }, { text: '2x = -4' }, { text: 'x = -2' }];
  const lost = lostMarks(vec, lines, meta);
  ok(lost.every(l => LOST_MARK_KEYS.includes(l.key) && (!l.ruleKey || l.ruleKey in en)), 'every emitted key is one of the catalogued keys');
  eq(lost.map(l => l.key), ['marks.lost.break', 'marks.lost.afterBreak', 'marks.lost.restated', 'marks.lost.repeat', 'marks.lost.answer'], 'one entry per lost mark, in line order, then the answer mark');
}

console.log(failures.length
  ? `LOST MARKS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `LOST MARKS: PASS — ${pass}/${pass} checks — every lost mark names its line and the rule it broke, the first mistake once and carried lines as carried, in English and in Hindi, from catalogue keys the marker emits.`);
process.exit(failures.length ? 1 : 0);
