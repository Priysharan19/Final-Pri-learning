// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Every lost mark names its line and the rule it broke
//
// Ledger 3.6. A student who loses a mark deserves to be told which line lost
// it and why — in the language they read. This suite pins three things:
//
//   · methodMarks() returns one `lost` entry per mark not awarded, carrying the
//     1-based line and a catalogue key (plus the rule's own key), never prose
//     assembled in the engine;
//   · awardStepMarks() (the board-style scheme) names the breaking line and
//     the rule on every step point it withholds;
//   · every key the marker can emit exists in BOTH the English and the Hindi
//     catalogue, every placeholder is filled by the variables the marker sends,
//     and the Hindi string is Hindi.
//
// Every case is authored. Nothing here is generated.
// ─────────────────────────────────────────────────────────────────────────────
import { methodMarks, stepCheck, ruleKeyFor, lostMarks } from '../src/engine/checker.js';
import { awardStepMarks } from '../src/engine/cbseMarking.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

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

// ── 1 · A slip on line 2 of a three-mark equation ────────────────────────────
const meta = { kind: 'equation', variable: 'x', solutions: [-2] };
const prompt = 'Solve $2x - 7 = -11$.';
{
  // 2x − 7 = −11 → 2x = −18 (sign slip on transfer) → x = −9
  const working = '2x - 7 = -11\n2x = -18\nx = -9';
  const mm = methodMarks({ meta, working, marks: 3, prompt });
  ok(mm && Array.isArray(mm.lost), 'methodMarks returns a lost list');
  const lost = mm?.lost || [];
  const onLine2 = lost.find(l => l.line === 2);
  ok(onLine2, 'the lost mark names line 2, where the slip is');
  eq(onLine2?.key, 'marks.lost.break', 'line 2 is reported as the break');
  ok(typeof onLine2?.ruleKey === 'string' && onLine2.ruleKey.length > 0, 'the break names the rule it broke');
  ok(onLine2?.ruleKey in en, `the rule key exists in English (${onLine2?.ruleKey})`);
  ok(onLine2?.ruleKey in hi, `the rule key exists in Hindi (${onLine2?.ruleKey})`);
  const after = lost.find(l => l.line === 3);
  eq(after?.key, 'marks.lost.afterBreak', 'line 3 is reported as following from the slip');
  eq(after?.vars?.breakLine, 2, 'and it points back to line 2');
  ok(lost.some(l => l.key === 'marks.lost.answer'), 'the answer mark is named as lost');
  const line1 = lost.find(l => l.line === 1);
  eq(line1?.key, 'marks.lost.restated', 'line 1 restates the question and earns nothing — said so');
  ok(lost.every(l => Number.isInteger(l.line) && l.line >= 1), 'every entry carries a whole-number line');
  // English text is produced for records; it matches what the catalogue renders
  eq(onLine2?.text, render(en, onLine2), 'the English text equals the English catalogue rendering');
  ok(DEVANAGARI.test(render(hi, onLine2)), 'the Hindi rendering is Hindi');
  ok(!/\{\w+\}/.test(render(hi, onLine2)) && !/\{\w+\}/.test(render(en, onLine2)), 'no placeholder is left unfilled in either language');
  ok(/2/.test(render(hi, onLine2)), 'the Hindi line names line 2');
}

// ── 2 · Perfect working but a wrong final answer: only the answer mark is lost ─
{
  const working = '2x - 7 = -11\n2x = -4\nx = -2';
  const mm = methodMarks({ meta, working, marks: 3, prompt });
  eq(mm?.awarded, 2, 'two method marks for two lines that move the solution on');
  const lost = (mm?.lost || []).filter(l => l.key !== 'marks.lost.answer');
  eq(lost.map(l => l.key), ['marks.lost.restated'], 'the only other note is the restated first line');
}

// ── 3 · An unreadable line is named as unverified, not silently skipped ──────
{
  const working = '2x - 7 = -11\nmove the 7 across\n2x = -4\nx = -2';
  const mm = methodMarks({ meta, working, marks: 4, prompt });
  const unverified = (mm?.lost || []).find(l => l.key === 'marks.lost.unverified');
  eq(unverified?.line, 2, 'the prose line is line 2 and is named as unverifiable');
}

// ── 4 · A repeated step is named as a repeat ─────────────────────────────────
{
  const working = '2x = -4\n2x = -4\nx = -2';
  const mm = methodMarks({ meta, working, marks: 3, prompt });
  const repeat = (mm?.lost || []).find(l => l.key === 'marks.lost.repeat');
  eq(repeat?.line, 2, 'the second copy of a line is the repeat');
}

// ── 5 · Expression working: the rule is the expression rule ──────────────────
{
  const emeta = { kind: 'expression', canonical: '3x + 6' };
  const working = '3(x + 2)\n3x + 2';
  const mm = methodMarks({ meta: emeta, working, marks: 2, prompt: 'Expand $3(x+2)$.' });
  const brk = (mm?.lost || []).find(l => l.key === 'marks.lost.break');
  eq(brk?.line, 2, 'the expansion slip is on line 2');
  ok(brk?.ruleKey in en && brk?.ruleKey in hi, `the rule (${brk?.ruleKey}) is in both catalogues`);
}

// ── 6 · ruleKeyFor covers every diagnosis code the engine can emit ───────────
{
  const { DIAGNOSIS_CODES } = await import('../src/engine/diagnose.js');
  for (const code of DIAGNOSIS_CODES) {
    const key = ruleKeyFor({ diagnosis: { code }, text: 'x = 1' }, meta);
    ok(key in en && key in hi, `diagnosis "${code}" maps to a bilingual rule key (${key})`);
  }
  eq(ruleKeyFor({ text: 'x = 2 ± 3' }, meta), 'marks.rule.plusMinusBranch', 'a ± line without a diagnosis names the ± rule');
  eq(ruleKeyFor({ text: '7' }, meta), 'marks.rule.valueWrong', 'a bare value names the value rule');
  eq(ruleKeyFor({ text: '3x + 2' }, { kind: 'expression' }), 'marks.rule.expressionBroken', 'an expression line names the expression rule');
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
  const report = { lines: [{ status: 'ok' }, { status: 'break', text: '12 + 11 - 9 = 15', diagnosis: { code: 'arithmetic-slip', title: 'Arithmetic slip' } }, { status: 'note' }] };
  const award = awardStepMarks({ question: SETS, workingLines: ['n(A ∪ B) = n(A) + n(B) − n(A ∩ B)', '12 + 11 − 9 = 15', '15'], stepReport: report, answerText: '15', correct: false });
  const withheld = award.rows.filter(r => r.earned < r.outOf && r.kind !== 'answer');
  ok(withheld.length === 1, 'one step point is withheld');
  eq(withheld[0]?.whyKey, 'board.whyBrokeAtLine', 'and it is explained by the breaking line');
  eq(withheld[0]?.whyVars?.line, 2, 'line 2');
  eq(withheld[0]?.whyVars?.ruleKey, 'misconception.arithmeticSlip.name', 'with the diagnosed rule');
  ok(/line 2/.test(withheld[0]?.why || ''), `the English sentence names line 2: ${withheld[0]?.why}`);
  const hiText = fill(hi['board.whyBrokeAtLine'], { ...withheld[0].whyVars, rule: hi[withheld[0].whyVars.ruleKey] });
  ok(DEVANAGARI.test(hiText) && /2/.test(hiText) && !/\{\w+\}/.test(hiText), `the Hindi sentence names line 2 and the rule: ${hiText}`);

  const unread = awardStepMarks({ question: SETS, workingLines: ['the rule', 'then 15'], stepReport: { lines: [{ status: 'note' }, { status: 'note' }] }, answerText: '15', correct: false });
  const first = unread.rows.find(r => r.kind !== 'answer' && r.earned < r.outOf);
  eq(first?.whyKey, 'board.whyUnverifiedLine', 'unreadable working is explained by the unreadable line');
  eq(first?.whyVars?.line, 1, 'line 1');
}

// ── 8 · Every emitted key is bilingual with matching placeholders ────────────
{
  const keys = ['marks.lost.break', 'marks.lost.afterBreak', 'marks.lost.unverified', 'marks.lost.restated', 'marks.lost.repeat', 'marks.lost.answer', 'marks.lost.heading',
    'marks.rule.equationBroken', 'marks.rule.expressionBroken', 'marks.rule.valueWrong', 'marks.rule.plusMinusBranch', 'marks.rule.extraneousSolution',
    'board.whyBrokeAtLine', 'board.whyUnverifiedLine'];
  const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const key of keys) {
    ok(typeof en[key] === 'string', `${key} exists in English`);
    ok(typeof hi[key] === 'string' && DEVANAGARI.test(hi[key]), `${key} exists in Hindi and is Hindi`);
    eq(holes(hi[key]), holes(en[key]), `${key} has the same placeholders in both languages`);
  }
  // lostMarks never invents a key outside the set above
  const vec = [{ status: 'break', mark: 0, reason: 'break' }, { status: 'note', mark: 0, reason: 'note' }, { status: 'ok', mark: 0, reason: 'restated' }, { status: 'ok', mark: 0, reason: 'repeat' }, { status: 'ok', mark: 1, reason: 'progress' }];
  const lines = [{ text: '2x = -18' }, { note: 'Follows from the earlier slip.' }, { text: '2x - 7 = -11' }, { text: '2x = -4' }, { text: 'x = -2' }];
  const lost = lostMarks(vec, lines, meta);
  ok(lost.every(l => keys.includes(l.key) && (!l.ruleKey || l.ruleKey in en)), 'every emitted key is one of the catalogued keys');
  eq(lost.map(l => l.key), ['marks.lost.break', 'marks.lost.afterBreak', 'marks.lost.restated', 'marks.lost.repeat', 'marks.lost.answer'], 'one entry per lost mark, in line order, then the answer mark');
}

console.log(failures.length
  ? `LOST MARKS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `LOST MARKS: PASS — ${pass}/${pass} checks — every lost mark names its line and the rule it broke, in English and in Hindi, from catalogue keys the marker emits.`);
process.exit(failures.length ? 1 : 0);
