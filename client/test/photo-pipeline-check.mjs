// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Photo → answer pipeline (deterministic, bare Node)
//
// The owner's page (2026-10-10): unrelated set notes at the top, then
//   f(x) = (x+3)² + 6 / (x+3)² ⩾ 0 / (x+3)² + 6 ⩾ 6 / least value ⇒ 6
// The app copied the sentence "least value ⇒ 6." into the answer field, the
// typed parser refused it, and the photo was kept in memory only.
//
//   1. finalAnswer.js — the mathematical answer, never a sentence, never a
//      guess between two candidates, never an unrelated number on the page.
//   2. transcript.js — which lines belong to the public question: a proposal
//      that hides nothing, and never changes what a line says.
//   3. readerFailure.js / cloudReader.js — every reader refusal named, with
//      its action and whether the page may retry by itself.
//   4. photoDrafts.js — the photo and its reading as a sealed IndexedDB draft
//      confirmed by readback, bound to profile and question.
//
// No key is involved anywhere: none of these modules can see an expected
// answer. Usage: node client/test/photo-pipeline-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { installBrowserEnv, rawRows, resetStorage } from './backend-check.mjs';

installBrowserEnv(); resetStorage();
const { answerFromLine, proposeFinalAnswer, readsAsAnswer, readsAsWritten, stripSentence } = await import('../src/photo/finalAnswer.js');
const T = await import('../src/photo/transcript.js');
const F = await import('../src/ink/readerFailure.js');
const reader = await import('../src/ink/cloudReader.js');
const guard = await import('../src/components/photoSubmissionGuard.js');
const { parseNumericInput } = await import('../src/engine/checker-core.js');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label}\n      got  ${JSON.stringify(a)}\n      want ${JSON.stringify(b)}`);

const N = { answerType: 'numeric' };
const proposed = (answer, line) => (line === undefined ? { status: 'proposed', answer } : { status: 'proposed', answer, line });
const only = r => (r.status === 'proposed' ? { status: r.status, answer: r.answer } : r.status === 'ambiguous' ? { status: r.status, candidates: r.candidates } : { status: r.status });

// ── 1 · the final answer ─────────────────────────────────────────────────────
// [lines, question, expected]
const FINALS = [
  // the owner's own last line, in every spelling the reader has returned
  [['least value => 6.'], N, proposed('6')],
  [['least value ⇒ 6.'], N, proposed('6')],
  [['least value -> 6'], N, proposed('6')],
  [['least value = 6.'], N, proposed('6')],
  [['least value: 6'], N, proposed('6')],
  [['least value is 6.'], N, proposed('6')],
  [['least value 6'], N, proposed('6')],
  // natural-language finals
  [['x = 6'], N, proposed('6')],
  [['Minimum = 6'], N, proposed('6')],
  [['∴ min value is 6'], N, proposed('6')],
  [['∴ x = 6.'], N, proposed('6')],
  [['Hence, the answer is 6.'], N, proposed('6')],
  [['so the required value is 6'], N, proposed('6')],
  [['6 is the least value'], N, proposed('6')],
  [['Ans: 6'], N, proposed('6')],
  [['Ans. 6'], N, proposed('6')],
  [['6'], N, proposed('6')],
  [['6.'], N, proposed('6')],
  [['= 6'], N, proposed('6')],
  [['f(-3) = 0 + 6 = 6'], N, proposed('6')],
  // negatives, fractions, decimals, surds, units, grouped digits
  [['x = -3/4'], N, proposed('-3/4')],
  [['ans: −7'], N, proposed('−7')],
  [['hence the answer is 2 1/2'], N, proposed('2 1/2')],
  [['value = 0.75.'], N, proposed('0.75')],
  [['d = 3sqrt(2)'], N, proposed('3sqrt(2)')],
  [['area = 12 cm'], N, proposed('12 cm')],
  [['total = 1,234'], N, proposed('1,234')],
  [['probability is 3/8.'], N, proposed('3/8')],
  // Hindi lead-in with ASCII digits is read; Devanagari digits are not a form
  // the typed field's parser reads, so nothing is proposed for them.
  [['न्यूनतम मान = 6'], N, proposed('6')],
  [['अतः उत्तर 6 है'], N, { status: 'none' }],
  [['उत्तर ६'], N, { status: 'none' }],
  // not a value: nothing is proposed
  [['(x+3)^2 + 6 >= 6.'], N, { status: 'none' }],
  [['(x+3)^2 + 6 > 6'], N, { status: 'none' }],
  [['x > 3'], N, { status: 'none' }],
  [['least value'], N, { status: 'none' }],
  [['final:'], N, { status: 'none' }],
  [['b = {40,50,60}.'], N, { status: 'none' }],
  [['least value => six'], N, { status: 'none' }],
  [['area = 12 cm^2.'], N, { status: 'none' }],
  [[''], N, { status: 'none' }],
  [[], N, { status: 'none' }],
  // two different candidates: never a guess
  [['x = 2 or x = 6'], N, { status: 'ambiguous', candidates: ['2', '6'] }],
  [['6 or 9'], N, { status: 'ambiguous', candidates: ['6', '9'] }],
  [['x = 2, y = 6'], N, { status: 'ambiguous', candidates: ['2', '6'] }],
  [['Answer = 6', 'so x = 9'], N, { status: 'ambiguous', candidates: ['9', '6'] }],
  [['ans 4', 'ans 5'], N, { status: 'ambiguous', candidates: ['5', '4'] }],
  // the same value said twice is one candidate
  [['Answer = 6', 'check: 9 - 3 = 6'], N, proposed('6')],
  [['x = 6, so least value = 6'], N, proposed('6')],
  [['Ans = 0.5', 'i.e. a half'], N, proposed('0.5')],
  // an announced answer earlier on the page, when the last line states none
  [['Answer: 6', '(x+3)^2 >= 0 always'], N, proposed('6')],
  // the whole page
  [['f(x) = (x+3)^2 + 6.', '(x+3)^2 >= 0.', '(x+3)^2 + 6 >= 6.', 'least value => 6.'], N, proposed('6')],
  [['f(x) = (x+3)^2 + 6.', '(x+3)^2 > 0.', '(x+3)^2 + 6 > 6.', 'least value => 6.'], N, proposed('6')],
  // other answer types
  [['y = 3x + 2.'], { answerType: 'expression' }, proposed('3x + 2')],
  [['derivative is 2x + 3'], { answerType: 'expression' }, proposed('2x + 3')],
  [['dy/dx = 2x + 3'], { answerType: 'expression' }, proposed('2x + 3')],
  [['least value'], { answerType: 'expression' }, { status: 'none' }],
  [['x >= 3'], { answerType: 'expression' }, { status: 'none' }],
  [['solution: x > 3'], { answerType: 'interval' }, proposed('x > 3')],
  [['∴ x ∈ (2, 5]'], { answerType: 'interval' }, proposed('x ∈ (2, 5]')],
  [['2 < x <= 5.'], { answerType: 'interval' }, proposed('2 < x <= 5')],
  [['roots are 1, -2'], { answerType: 'set' }, proposed('1, -2')],
  [['x = {1, -2}'], { answerType: 'set' }, proposed('x = {1, -2}')],
  [['vertex = (2, -3).'], { answerType: 'point' }, proposed('(2, -3)')],
  [['ratio = 2:3'], { answerType: 'ratio' }, proposed('2:3')],
  [['a = 2i - 3j + k'], { answerType: 'vector' }, proposed('a = 2i - 3j + k')],
  [['A = [[1,2],[3,4]]'], { answerType: 'matrix' }, proposed('A = [[1,2],[3,4]]')],
  // a choice or a page of working has no final-answer field
  [['2'], { answerType: 'mcq' }, { status: 'not-applicable' }],
  [['x = 6'], { answerType: 'working' }, { status: 'not-applicable' }]
];
for (const [lines, question, want] of FINALS) {
  eq(only(proposeFinalAnswer(lines, question)), want, `final answer of ${JSON.stringify(lines.join(' ⏎ '))} as ${question.answerType}`);
}
// Whatever is proposed is something the typed field's own parser reads, and it
// is never a sentence and never ends in a sentence's full stop.
for (const [lines, question] of FINALS) {
  const got = proposeFinalAnswer(lines, question);
  if (got.status !== 'proposed') continue;
  ok(readsAsAnswer(got.answer, question), `the proposal ${JSON.stringify(got.answer)} reads as a ${question.answerType} answer`);
  ok(!/(?<!\.)\.\s*$/.test(got.answer) && !/least|value|answer|hence|minimum/i.test(got.answer), `the proposal ${JSON.stringify(got.answer)} is not a sentence and carries no full stop`);
}
ok(Number.isFinite(parseNumericInput(proposeFinalAnswer(['least value => 6.'], N).answer).value), 'the owner\'s last line gives a value the numeric parser reads');
let threw = false; try { parseNumericInput('least value => 6.'); } catch { threw = true; }
ok(threw, 'and the sentence itself is still refused by that parser — it must never reach it');
eq(stripSentence('  ∴ least value ⇒ 6.  '), 'least value ⇒ 6', 'a leading ∴ and a sentence full stop are not mathematics');
eq(stripSentence('0.333...'), '0.333...', 'a run of dots is kept: it says something');
eq(stripSentence('3. x = 6.'), 'x = 6', 'a list number in front of a line is dropped');
eq(answerFromLine('x = 6.', N), proposed('6'), 'one line, one value');
eq(proposeFinalAnswer(['a', 'b = 2', 'least value => 6.'], N).line, 2, 'the proposal names the line it came from');

// ── 1b · handwriting (Write mode) uses the same module ───────────────────────
// Owner case A3: working whose last line is an equation, "38.5 - 24.5 = 14".
// The last line was sent verbatim and refused as unreadable. The card's rule,
// reproduced here: a last line that reads AS WRITTEN is sent exactly as it
// always was; otherwise the answer is proposed from the lines, or not guessed.
const inkAnswer = (lines, question) => {
  const last = lines.at(-1);
  if (readsAsWritten(last, question)) return { sent: last, how: 'as written' };
  const p = proposeFinalAnswer(lines, question);
  return p.status === 'proposed' ? { sent: p.answer, how: 'proposed' } : { sent: null, how: p.status, ...(p.candidates ? { candidates: p.candidates } : {}) };
};
const E = { answerType: 'expression' };
const INK = [
  // a single-line answer that already parses is untouched
  [['5'], N, { sent: '5', how: 'as written' }],
  [['24'], N, { sent: '24', how: 'as written' }],
  [['-3/4'], N, { sent: '-3/4', how: 'as written' }],
  [['x = 6'], N, { sent: 'x = 6', how: 'as written' }],
  [['n = 24'], N, { sent: 'n = 24', how: 'as written' }],
  [['12 cm'], N, { sent: '12 cm', how: 'as written' }],
  [['(2, -3)'], { answerType: 'point' }, { sent: '(2, -3)', how: 'as written' }],
  [['x > 3'], { answerType: 'interval' }, { sent: 'x > 3', how: 'as written' }],
  [['2 < x <= 5'], { answerType: 'interval' }, { sent: '2 < x <= 5', how: 'as written' }],
  [['{1, -2}'], { answerType: 'set' }, { sent: '{1, -2}', how: 'as written' }],
  [['1, -2'], { answerType: 'set' }, { sent: '1, -2', how: 'as written' }],
  [['2:3'], { answerType: 'ratio' }, { sent: '2:3', how: 'as written' }],
  [['3x + 2'], E, { sent: '3x + 2', how: 'as written' }],
  [['y = 3x + 2'], E, { sent: 'y = 3x + 2', how: 'as written' }],
  // working whose last line already parses is untouched too
  [['38.5', '24.5', '14'], N, { sent: '14', how: 'as written' }],
  [['-122 = 16 - 6(n-1)', '23 = n-1', 'n = 24'], N, { sent: 'n = 24', how: 'as written' }],
  // the owner's case, and its relatives: the value is proposed
  [['38.5', '24.5', '38.5 - 24.5 = 14'], N, { sent: '14', how: 'proposed' }],
  [['38.5', '24.5', '38.5-24.5=14'], N, { sent: '14', how: 'proposed' }],
  [['38.5 - 24.5 = 14'], N, { sent: '14', how: 'proposed' }],
  [['area = 1/2 * 7 * 4', '= 14'], N, { sent: '= 14', how: 'as written' }],
  [['1/2 * 7 * 4 = 14 cm'], N, { sent: '14 cm', how: 'proposed' }],
  [['∴ area = 14 cm'], N, { sent: '14 cm', how: 'proposed' }],
  [['area is 14'], N, { sent: '14', how: 'proposed' }],
  [['so the answer is 14.'], N, { sent: '14', how: 'proposed' }],
  [['a + 23d = -122', 'therefore n = 24'], N, { sent: '24', how: 'proposed' }],
  // a sentence with no value, an inequality, two candidates: no guess
  [['38.5', 'it is the difference'], N, { sent: null, how: 'none' }],
  [['x + 3 > 7'], N, { sent: null, how: 'none' }],
  [['x = 2 or x = 6'], N, { sent: null, how: 'ambiguous', candidates: ['2', '6'] }],
  [['answer = 14', 'so total = 15'], N, { sent: null, how: 'ambiguous', candidates: ['15', '14'] }],
  // an answer that IS an equation is never cut down to its right-hand side
  [['x^2 + y^2 = 25'], E, { sent: 'x^2 + y^2 = 25', how: 'as written' }],
  [['2x + 3y = 6'], E, { sent: '2x + 3y = 6', how: 'as written' }],
  [['centre (0,0), radius 5', 'so x^2 + y^2 = 25'], E, { sent: 'x^2 + y^2 = 25', how: 'proposed' }],
  [['the line is 2x + 3y = 6.'], E, { sent: '2x + 3y = 6', how: 'proposed' }],
  [['dy/dx = 2x + 3'], E, { sent: '2x + 3', how: 'proposed' }],
  [['so f(x) = x^2 - 1'], E, { sent: 'x^2 - 1', how: 'proposed' }]
];
for (const [lines, question, want] of INK) eq(inkAnswer(lines, question), want, `ink answer of ${JSON.stringify(lines.join(' ⏎ '))} as ${question.answerType}`);
for (const [lines, question, want] of INK) {
  if (want.how !== 'proposed') continue;
  ok(readsAsWritten(want.sent, question), `the proposed ${JSON.stringify(want.sent)} reads in the typed field's parser for ${question.answerType}`);
  ok(!readsAsWritten(lines.at(-1), question), `and the last line ${JSON.stringify(lines.at(-1))} itself did not — which is why it was refused`);
}
eq(only(proposeFinalAnswer(['x^2 + y^2 = 25'], E)), proposed('x^2 + y^2 = 25'), 'Photo too: an equation-typed answer is kept whole');
eq(only(proposeFinalAnswer(['x^2 + y^2 = 25'], N)), proposed('25'), 'while a numeric question takes the value after the equals sign');

// Unrelated numbers elsewhere on the page never become the answer.
const OWNER_NOTES = ['b = {40,50,60}.', 'b = {100,50,60}.', 'final:', 'a = {10,99,30}.', 'b = {100,50,60}.'];
const OWNER_WORK = ['-> f(x) = (x+3)^2 + 6.', '(x+3)^2 > 0.', '(x+3)^2 + 6 > 6.', 'least value => 6.'];
for (const page of [[...OWNER_NOTES, ...OWNER_WORK], [...OWNER_WORK], [...OWNER_NOTES, ...OWNER_WORK.slice(0, 3)], [...OWNER_WORK.slice(0, 3), ...OWNER_NOTES]]) {
  const got = proposeFinalAnswer(page, N);
  ok(got.status !== 'proposed' || got.answer === '6', `no number from the notes is proposed for ${JSON.stringify(page.at(-1))} (got ${JSON.stringify(got)})`);
}
eq(only(proposeFinalAnswer([...OWNER_WORK.slice(0, 3), ...OWNER_NOTES], N)), { status: 'none' }, 'a page that ends in someone else\'s set notation proposes nothing');

// ── 2 · which lines belong to the question ───────────────────────────────────
const PROMPT = 'Find the least value taken by the real function $f(x) = (x + 3)^2 + 6$.';
const Q = { prompt: PROMPT, answerType: 'numeric' };
const read = (lines, floor = 0.82) => T.buildTranscript({ confidenceFloor: floor, lines: lines.map(l => (typeof l === 'string' ? { text: l, confidence: 0.98 } : { confidence: 0.98, ...l })) }, Q);
const shape = t => t.lines.map(l => (l.excluded ? `out:${l.why}` : 'in'));

const owner = read([...OWNER_NOTES, { text: OWNER_WORK[0], gapBefore: true }, ...OWNER_WORK.slice(1)]);
eq(shape(owner), ['out:before-question', 'out:before-question', 'out:before-question', 'out:before-question', 'out:before-question', 'in', 'in', 'in', 'in'],
  'the owner\'s page: the set notes above the restated question are left out by default');
eq(owner.lines.map(l => l.text), [...OWNER_NOTES, ...OWNER_WORK], 'every line is still there, in order, exactly as read');
eq(T.includedLines(owner), OWNER_WORK, 'only the working is sent as working');
eq([owner.anchor, owner.undecided, T.defaultExclusions(owner)], [5, false, 5], 'the line that restates the question is the anchor, and nothing is undecided');
eq(only(proposeFinalAnswer(T.includedLines(owner), Q)), proposed('6'), 'and the answer proposed from the kept lines is 6');
const back = T.includeAll(owner);
eq([shape(back).every(s => s === 'in'), T.includedLines(back).length, back.lines.map(l => l.text)], [true, 9, owner.lines.map(l => l.text)], 'one action brings every left-out line back, unchanged');
eq(only(proposeFinalAnswer(T.includedLines(back), Q)), proposed('6'), 'with the notes included the answer is still the last line\'s 6, not 60 or 100');

// A strict sign the reader returned is never "corrected": the student does it.
eq(owner.lines[6].text, '(x+3)^2 > 0.', 'a line read with > stays > until the student changes it');
const fixed = T.editLine(T.editLine(owner, 6, '(x+3)^2 ≥ 0.'), 7, '(x+3)^2 + 6 >= 6.');
eq([fixed.lines[6].text, fixed.lines[6].read, fixed.lines[6].edited], ['(x+3)^2 >= 0.', '(x+3)^2 > 0.', true], 'the student\'s ≥ is kept in the marker\'s spelling, beside what the reader read');
eq(T.includedLines(fixed), ['-> f(x) = (x+3)^2 + 6.', '(x+3)^2 >= 0.', '(x+3)^2 + 6 >= 6.', 'least value => 6.'], 'and that is what is sent as working');
eq(T.editLine(owner, 6, '(x+3)^2 > 0.').lines[6].edited, false, 'typing the same text back is not an edit');
// Display and spelling never change the relation.
eq(T.prettyLine('(x+3)^2 + 6 >= 6'), '(x+3)² + 6 ≥ 6', '>= is drawn as ≥');
eq(T.prettyLine('(x+3)^2 > 0'), '(x+3)² > 0', '> is drawn as >, never as ≥');
eq(T.prettyLine('least value => 6'), 'least value ⇒ 6', '=> is drawn as ⇒, not as an inequality');
eq(T.prettyLine('a <= b != c -> d'), 'a ≤ b ≠ c → d', '<=, != and -> are drawn as themselves');
eq(T.markerText('x ⩾ 3 ≤ y ≠ z'), 'x >= 3 <= y != z', 'the marker\'s spelling of ≥ ≤ ≠');
for (const s of ['(x+3)^2 > 0', '(x+3)^2 >= 0', 'x < 3', 'x <= 3', 'a = b', 'a => b', 'a - b', 'x^2', '{1,2}', '(1,2)', '1/2']) {
  eq(T.markerText(s), s, `markerText leaves ${JSON.stringify(s)} exactly as read`);
}

// The reader's doubt is per line, shown as a doubt about the reading.
const doubted = read([{ text: 'f(x) = (x+3)^2 + 6' }, { text: '(x+3)^2 > 0', uncertain: true, doubt: '>= or >' }, { text: '(x+3)^2 + 6 >= 6', confidence: 0.6 }, 'least value => 6']);
eq(doubted.lines.map(l => [l.check, l.doubt]), [[false, null], [true, '>= or >'], [true, null], [false, null]],
  'a line the reader marked uncertain, and a line under the confidence floor, ask to be checked; the others do not');
eq(T.linesToCheck(doubted), 2, 'two lines to check');
eq(T.linesToCheck(T.editLine(doubted, 1, '(x+3)^2 >= 0')), 1, 'a line the student corrected no longer asks');
eq(T.linesToCheck(T.setLineExcluded(doubted, 2, true)), 1, 'nor does one they left out');
eq(doubted.lines[1].text, '(x+3)^2 > 0', 'and the doubted line is not rewritten');

// The reader read the question's x as n (it does, on the owner's page).
const asN = read([...OWNER_NOTES, '→ f(n) = (n+3)^2 + 6.', '(n+3)^2 >= 0.', '(n+3)^2 + 6 >= 6.', 'least value => 6.']);
eq(shape(asN).slice(0, 6), ['out:before-question', 'out:before-question', 'out:before-question', 'out:before-question', 'out:before-question', 'in'], 'x read as n still restates the question');
eq(asN.lines.slice(5).map(l => [l.check, l.doubt, l.text.includes('n')]), [[true, 'x or n', true], [true, 'x or n', true], [true, 'x or n', true], [false, null, false]],
  'the lines with the letter the reader read differently from the question ask to be checked as "x or n" — and are not changed');

const REL = [
  ['notes after a labelled break', ['f(x) = (x+3)^2 + 6', '(x+3)^2 >= 0', 'least value = 6', { text: 'final:', gapBefore: true }, 'a = {10,99,30}', 'b = {100,500,600}'], ['in', 'in', 'in', 'out:after-break', 'out:after-break', 'out:after-break'], false],
  ['notes after a gap', ['f(x) = (x+3)^2 + 6', 'least value = 6', { text: 'p = 40 + 50', gapBefore: true }, 'q = 2p'], ['in', 'in', 'out:after-break', 'out:after-break'], false],
  ['an answer line after a gap is not other work', ['f(x) = (x+3)^2 + 6', '(x+3)^2 >= 0', { text: 'Ans = 6', gapBefore: true }], ['in', 'in', 'in'], false],
  ['no restatement, all the question\'s own symbols', ['(x+3)^2 >= 0', 'so f(x) >= 6', 'least value is 6'], ['in', 'in', 'in'], false],
  ['no restatement, mixed symbols: cannot decide', ['b = {40,50,60}', '(x+3)^2 >= 0', 'min = 6'], ['in', 'in', 'in'], true],
  ['earlier lines share the question\'s symbol: cannot decide', ['x = 4 + 5', 'f(x) = (x+3)^2 + 6', 'least value 6'], ['in', 'in', 'in'], true],
  ['earlier lines are bare arithmetic: cannot decide', ['40 + 50 = 90', 'f(x) = (x+3)^2 + 6', 'least value 6'], ['in', 'in', 'in'], true],
  ['a heading above the working is kept', ['Solution:', 'f(x) = (x+3)^2 + 6', 'least value 6'], ['in', 'in', 'in'], false],
  ['only the answer', ['6'], ['in'], false]
];
for (const [label, lines, want, undecided] of REL) {
  const t = read(lines);
  eq([shape(t), t.undecided], [want, undecided], `relevance · ${label}`);
  eq(t.lines.map(l => l.text), lines.map(l => (typeof l === 'string' ? l : l.text)), `relevance · ${label}: no line is dropped or changed`);
}
eq(shape(T.buildTranscript({ lines: OWNER_NOTES.map(text => ({ text })) }, { prompt: 'What is 16 - 6 × 23?', answerType: 'numeric' })), ['in', 'in', 'in', 'in', 'in'],
  'a question with no named symbol gives no ground to leave anything out');
// A student's own choice outlives the default.
const mine = T.setLineExcluded(T.includeAll(owner), 8, true);
eq([mine.lines[8].why, T.includeAll(mine).lines[8].excluded, T.defaultExclusions(mine)], ['student', true, 0], 'a line the student left out is theirs: "include them" does not bring it back');
const revived = T.reviveTranscript(JSON.parse(JSON.stringify(fixed)));
eq(revived, { lines: fixed.lines, undecided: false, anchor: 5 }, 'a transcript survives a round trip through storage');
eq([T.reviveTranscript(null), T.reviveTranscript({ lines: [] }), T.reviveTranscript('x')], [null, null, null], 'and junk from storage is refused');

// A page that could not be read is a reading problem, not working to mark.
eq([T.unreadablePage({ lines: [] }), T.unreadablePage(null), T.unreadablePage({ confidence: 0.02, lines: [{ text: '[illegible]' }, { text: '[illegible]' }] }),
  T.unreadablePage({ confidence: 0.9, lines: [{ text: 'illegible' }, { text: '(unreadable)' }] }), T.unreadablePage({ confidence: 0.1, lines: [{ text: 'x = 6' }] })], [true, true, true, true, true],
  'no lines, lines of "[illegible]", or a page the reader has almost no confidence in: unreadable');
eq([T.unreadablePage({ confidence: 0.68, lines: [{ text: ') 2 > =' }, { text: 'value = 6' }] }), T.unreadablePage({ confidence: 0.9, lines: [{ text: '[illegible]' }, { text: 'x = 6' }] }), T.unreadablePage({ lines: [{ text: '6' }] })], [false, false, false],
  'a partly read page is shown line by line for the student to check — it is not thrown away');

// ── 3 · why the reader did not read ──────────────────────────────────────────
const NOW = 1_800_000_000_000;
const IN_AN_HOUR = NOW + 40 * 60 * 1000;
// [failure, kind, action, autoRetry, manualRetry, photoKey, inkKey, timed]
const REFUSALS = [
  [{ status: 401 }, 'session', 'sign-in', false, false, 'verdict.photoReadingSignIn', 'ink.waitingSignIn'],
  [{ status: 401, code: 'AUTH_REQUIRED' }, 'session', 'sign-in', false, false, 'verdict.photoReadingSignIn', 'ink.waitingSignIn'],
  [{ status: 403, code: 'CSRF_REJECTED' }, 'session', 'sign-in', false, false, 'verdict.photoReadingSignIn', 'ink.waitingSignIn'],
  [{ status: 403, code: 'EMAIL_UNVERIFIED' }, 'verify-email', 'verify-email', false, false, 'verdict.photoReadingVerifyEmail', 'ink.waitingVerifyEmail'],
  [{ status: 403, code: 'GUARDIAN_CONSENT_REQUIRED' }, 'guardian', 'guardian', false, false, 'verdict.photoReadingGuardian', 'ink.waitingGuardian'],
  [{ status: 403, code: 'AGE_DECLARATION_REQUIRED' }, 'guardian', 'guardian', false, false, 'verdict.photoReadingGuardian', 'ink.waitingGuardian'],
  [{ status: 503, code: 'GUARDIAN_CONSENT_UNAVAILABLE' }, 'unreachable', 'try-again', true, true, 'verdict.photoReadingServiceDown', 'ink.waitingServiceDown'],
  [{ status: 403, code: 'ENTITLEMENT_REQUIRED' }, 'not-allowed', 'type', false, false, 'verdict.photoReadingNotAllowed', 'ink.waitingNotAllowed'],
  [{ status: 403 }, 'not-allowed', 'type', false, false, 'verdict.photoReadingNotAllowed', 'ink.waitingNotAllowed'],
  [{ status: 400, code: 'HANDWRITING_BODY_INVALID' }, 'request', 'try-again', false, true, 'verdict.photoReadingRequest', 'ink.waitingRequest'],
  [{ status: 400, code: 'RECOGNITION_INVALID' }, 'request', 'try-again', false, true, 'verdict.photoReadingRequest', 'ink.waitingRequest'],
  [{ status: 404, code: 'QUESTION_NOT_FOUND' }, 'request', 'try-again', false, true, 'verdict.photoReadingRequest', 'ink.waitingRequest'],
  [{ status: 409, code: 'QUESTION_ALREADY_GRADED' }, 'request', 'try-again', false, true, 'verdict.photoReadingRequest', 'ink.waitingRequest'],
  [{ status: 413, code: 'HANDWRITING_IMAGE_TOO_LARGE' }, 'request', 'try-again', false, true, 'verdict.photoReadingRequest', 'ink.waitingRequest'],
  [{ status: 429, code: 'RATE_LIMITED' }, 'rate-limited', 'try-again', false, true, 'verdict.photoReadingRateLimited', 'ink.waitingRateLimited'],
  [{ status: 429, code: 'RATE_LIMITED', resetAt: IN_AN_HOUR }, 'rate-limited', 'try-again', false, true, 'verdict.photoReadingRateLimitedUntil', 'ink.waitingRateLimitedUntil', true],
  [{ status: 429 }, 'rate-limited', 'try-again', false, true, 'verdict.photoReadingRateLimited', 'ink.waitingRateLimited'],
  [{ status: 503, code: 'PAID_CAPACITY_REACHED' }, 'capacity', 'try-again', false, true, 'verdict.photoReadingCapacity', 'ink.waitingCapacity'],
  [{ status: 503, code: 'PAID_CAPACITY_REACHED', resetAt: IN_AN_HOUR }, 'capacity', 'try-again', false, true, 'verdict.photoReadingCapacityUntil', 'ink.waitingCapacityUntil', true],
  [{ status: 429, code: 'AI_ALLOWANCE_EXHAUSTED' }, 'allowance', 'type', false, false, 'verdict.photoReadingAllowance', 'ink.waitingAllowance'],
  [{ status: 429, code: 'AI_ALLOWANCE_EXHAUSTED', resetAt: IN_AN_HOUR }, 'allowance', 'type', false, false, 'verdict.photoReadingAllowanceUntil', 'ink.waitingAllowanceUntil', true],
  [{ status: 503, code: 'PAID_CAPACITY_NOT_CONFIGURED' }, 'not-available', 'type', false, false, 'verdict.photoReadingNotOnThisInstall', 'ink.waitingNotOnThisInstall'],
  [{ status: 503, code: 'HANDWRITING_NOT_CONFIGURED' }, 'not-available', 'type', false, false, 'verdict.photoReadingNotOnThisInstall', 'ink.waitingNotOnThisInstall'],
  [{ status: 503, code: 'HANDWRITING_PROVIDER_CONFIG_INVALID' }, 'not-available', 'type', false, false, 'verdict.photoReadingNotOnThisInstall', 'ink.waitingNotOnThisInstall'],
  [{ status: 504, code: 'HANDWRITING_TIMEOUT' }, 'unreachable', 'try-again', true, true, 'verdict.photoReadingServiceDown', 'ink.waitingServiceDown'],
  [{ status: 503, code: 'HANDWRITING_PROVIDER_5XX' }, 'unreachable', 'try-again', true, true, 'verdict.photoReadingServiceDown', 'ink.waitingServiceDown'],
  [{ status: 503, code: 'HANDWRITING_PROVIDER_429' }, 'unreachable', 'try-again', true, true, 'verdict.photoReadingServiceDown', 'ink.waitingServiceDown'],
  [{ status: 502, code: 'HANDWRITING_UNREACHABLE' }, 'unreachable', 'try-again', true, true, 'verdict.photoReadingServiceDown', 'ink.waitingServiceDown'],
  [{ status: 500 }, 'unreachable', 'try-again', true, true, 'verdict.photoReadingServiceDown', 'ink.waitingServiceDown'],
  [{ status: 408 }, 'unreachable', 'try-again', true, true, 'verdict.photoReadingServiceDown', 'ink.waitingServiceDown'],
  [{ code: 'HANDWRITING_FAILED' }, 'unreachable', 'try-again', true, true, 'verdict.photoReadingServiceDown', 'ink.waitingServiceDown'],
  [{}, 'unreachable', 'try-again', true, true, 'verdict.photoReadingServiceDown', 'ink.waitingServiceDown'],
  [null, 'unreachable', 'try-again', true, true, 'verdict.photoReadingServiceDown', 'ink.waitingServiceDown']
];
const en = (await import('../src/i18n/strings.en.js')).default ?? Object.values(await import('../src/i18n/strings.en.js'))[0];
const hi = (await import('../src/i18n/strings.hi.js')).default ?? Object.values(await import('../src/i18n/strings.hi.js'))[0];
for (const [failure, kind, action, autoRetry, manualRetry, photoKey, inkKey, timed] of REFUSALS) {
  const got = F.classifyReaderFailure(failure, { now: NOW });
  const label = `refusal ${JSON.stringify(failure)}`;
  eq([got.kind, got.action, got.autoRetry, got.manualRetry, got.photoKey, got.inkKey], [kind, action, autoRetry, manualRetry, photoKey, inkKey], label);
  eq(got.retryAt, timed ? IN_AN_HOUR : null, `${label}: the time it lifts is the server's, or none`);
  for (const key of [photoKey, inkKey]) {
    ok(typeof en[key] === 'string' && typeof hi[key] === 'string', `${key} is in the catalogue in English and Hindi`);
    ok(/Until$/.test(key) === /\{time\}/.test(String(en[key])) && /Until$/.test(key) === /\{time\}/.test(String(hi[key])), `${key} names a time exactly when it has one`);
    ok(!/on.device|on your device|डिवाइस पर पढ़/i.test(String(en[key]) + String(hi[key])), `${key} never claims the page is read on the device`);
  }
  // Only a reader that did not answer is retried without being asked.
  ok(got.autoRetry === (kind === 'unreachable'), `${label}: automatic retry only for a reader that did not answer`);
  // A limit pauses sending until it lifts; nothing else does.
  ok((got.pauseUntil !== null) === ['capacity', 'rate-limited', 'allowance'].includes(kind), `${label}: sending pauses only for a limit`);
  if (got.pauseUntil !== null) ok(got.pauseUntil === (timed ? IN_AN_HOUR : NOW + F.DEFAULT_PAUSE_MS), `${label}: paused until the server's time, or a default`);
}
ok(F.AUTO_RETRY_MAX === 3, 'a reader that did not answer is retried by itself three times, no more');
eq(F.classifyReaderFailure({ status: 503, code: 'PAID_CAPACITY_REACHED', resetAt: NOW - 5 }, { now: NOW }).retryAt, null, 'a time in the past is not shown');
eq(F.classifyReaderFailure({ status: 503, code: 'PAID_CAPACITY_REACHED', resetAt: NOW + 3 * 86400000 }, { now: NOW }).retryAt, null, 'nor is one days away');
eq(F.stoppedKey('ink.waitingServiceDown'), 'ink.waitingServiceStopped', 'once retries stop, the sentence stops promising one');
ok(typeof en['ink.waitingServiceStopped'] === 'string' && !/shortly/i.test(en['ink.waitingServiceStopped']), 'and says so');
ok(F.retryClock(Date.UTC(2026, 9, 10, 11, 5), 'en').length > 0 && F.retryClock(null) === '', 'a time is formatted for the student, or left out');

// The same through the reader module, with what the device itself knows first.
const linked = { id: 1, cloudLinked: true };
const env = { online: () => true, available: () => true, now: NOW };
const block = (user, outcome, more = {}) => reader.readerBlock(user, { ...env, ...more, outcome });
eq(block({ ...linked, cloudHandwriting: false }, null).key, 'verdict.photoReadingTurnedOff', 'switched off in Settings is said as that');
eq([block(linked, null, { available: () => false }).kind, block(linked, null, { online: () => false }).kind, block({ id: 1 }, null).kind], ['not-available', 'offline', 'session'], 'no server on this install, offline, and no account come before any refusal');
eq(block(linked, { error: { code: 'PAID_CAPACITY_REACHED', status: 503, resetAt: IN_AN_HOUR } }),
  { kind: 'capacity', action: 'try-again', key: 'verdict.photoReadingCapacityUntil', inkKey: 'ink.waitingCapacityUntil', autoRetry: false, manualRetry: true, retryAt: IN_AN_HOUR },
  'production 2026-10-10: 503 PAID_CAPACITY_REACHED is the service\'s reading limit, with when it opens, a manual retry and no automatic one');
ok(reader.inkReadingBlockedKey(linked, { ...env, outcome: { error: { code: 'PAID_CAPACITY_REACHED', status: 503 } } }) !== 'ink.waitingServiceDown', 'and is no longer "the reader isn\'t answering"');
eq(block(linked, { reason: 'allowance', until: IN_AN_HOUR }).key, 'verdict.photoReadingAllowanceUntil', 'today\'s allowance names when it renews');
eq(block(linked, { error: { code: 'HANDWRITING_TIMEOUT', status: 504 }, readiness: { lastFailureCode: 'EMAIL_UNVERIFIED', lastFailureStatus: 403 } }).kind, 'verify-email', 'an account reason from the status probe outranks "did not answer"');
eq(block(linked, { reason: 'unavailable', readiness: { usable: false, lastFailureCode: 'PAID_CAPACITY_NOT_CONFIGURED' } }).kind, 'not-available', 'a deployment with no reading budget configured is "not on this version"');

// The pause: after a capacity refusal nothing is sent until it lifts or the student asks.
{
  let sent = 0;
  const transport = {
    handwritingStatus: async () => ({ configured: true, usable: true, available: true, state: 'ready' }),
    transcribeHandwriting: async () => { sent += 1; throw Object.assign(new Error('limit'), { status: 503, code: 'PAID_CAPACITY_REACHED', resetAt: Date.now() + 30 * 60 * 1000 }); }
  };
  const options = { user: linked, transport, available: () => true, rasterize: () => ({ dataUrl: 'data:image/png;base64,AAAA', width: 1, height: 1, bytes: 3 }), prepare: async () => ({ dataUrl: 'data:image/jpeg;base64,AAAA', width: 1, height: 1, bytes: 3 }) };
  reader.resumeReaderNow(); reader.clearCloudHandwritingReadiness();
  const first = await reader.readWithCloud([{ points: [{ x: 1, y: 1 }] }], options);
  eq([sent, first.error?.code, first.error?.status, Number.isFinite(first.error?.resetAt)], [1, 'PAID_CAPACITY_REACHED', 503, true], 'the first refused read reports its code, status and reset time');
  const again = [await reader.readWithCloud([{ points: [{ x: 2, y: 2 }] }], options), await reader.readPhotoWithCloud('data:image/jpeg;base64,AAAA', options), await reader.readWithCloud([{ points: [{ x: 3, y: 3 }] }], options)];
  eq([sent, again.map(o => o.reason), again.every(o => o.failure?.code === 'PAID_CAPACITY_REACHED')], [1, ['paused', 'paused', 'paused'], true], 'three more reads — new strokes, a photo — send nothing while the limit stands');
  eq(reader.readerBlock(linked, { ...env, now: Date.now(), outcome: again[0] }).kind, 'capacity', 'and each is still named as the limit');
  reader.resumeReaderNow();
  await reader.readWithCloud([{ points: [{ x: 4, y: 4 }] }], options);
  eq(sent, 2, 'the student\'s own Try again sends exactly one new request');
  await reader.readWithCloud([{ points: [{ x: 5, y: 5 }] }], options);
  eq(sent, 2, 'and when that is refused too, the page waits again');
  reader.resumeReaderNow();
}
// One read per picture: two triggers for the same page share one request, and
// a page that was just read is not paid for again.
{
  let sent = 0, release;
  const gate = new Promise(r => { release = r; });
  const seen = [];
  const transport = {
    handwritingStatus: async () => ({ configured: true, usable: true, available: true, state: 'ready' }),
    transcribeHandwriting: async (image, options) => { sent += 1; seen.push(Object.keys(options || {})); await gate; return { transcription: { engine: 'cloud-test', lines: [{ text: '7', confidence: 0.95 }], text: '7', confidence: 0.95, needsConfirmation: false } }; }
  };
  const raster = strokes => ({ dataUrl: 'data:image/png;base64,' + Buffer.from(JSON.stringify(strokes)).toString('base64'), width: 1, height: 1, bytes: 3 });
  const options = { user: linked, transport, available: () => true, rasterize: raster };
  reader.resumeReaderNow(); reader.clearCloudHandwritingReadiness();
  const page = [{ points: [{ x: 1, y: 1 }, { x: 9, y: 9 }] }];
  const a = reader.readWithCloud(page, options), b = reader.readWithCloud(page, options);
  await new Promise(r => setTimeout(r, 20));
  eq(sent, 1, 'two reads of the same page at the same moment send ONE request (the reload race)');
  release();
  const [ra, rb] = await Promise.all([a, b]);
  eq([ra.transcription?.text, rb.transcription?.text, sent], ['7', '7', 1], 'both get the one reading');
  eq((await reader.readWithCloud(page, options)).transcription?.text, '7', 'a page that already has a reading gets it back');
  eq(sent, 1, 'without a second paid read');
  await reader.readWithCloud([{ points: [{ x: 2, y: 2 }, { x: 9, y: 9 }] }], options);
  eq(sent, 2, 'different writing is a different page and is read');
  eq(seen.every(keys => keys.join() === 'signal'), true, 'and each request still carries the picture and a cancel signal, nothing else');
  reader.forgetCloudReads(transport);
  await reader.readWithCloud(page, options);
  eq(sent, 3, 'a change of account forgets remembered readings');
  let doubtful = 0;
  const unsure = { handwritingStatus: transport.handwritingStatus, transcribeHandwriting: async () => { doubtful += 1; return { transcription: { engine: 'cloud-test', lines: [{ text: '7', confidence: 0.6 }], text: '7', confidence: 0.6, needsConfirmation: true } }; } };
  await reader.readWithCloud(page, { ...options, transport: unsure });
  await reader.readWithCloud(page, { ...options, transport: unsure });
  eq(doubtful, 2, 'a reading the reader doubted is not remembered: it may be asked for again');
  // A failed read is never remembered, and a lone caller's cancel still cancels.
  let failures2 = 0, aborted = false;
  const flaky = { handwritingStatus: transport.handwritingStatus, transcribeHandwriting: async (image, { signal }) => { failures2 += 1; if (failures2 === 1) throw Object.assign(new Error('down'), { status: 503, code: 'HANDWRITING_PROVIDER_5XX' }); await new Promise((_, no) => signal.addEventListener('abort', () => { aborted = true; no(Object.assign(new Error('gone'), { name: 'AbortError' })); })); } };
  const o2 = { ...options, transport: flaky };
  eq((await reader.readWithCloud(page, o2)).error?.code, 'HANDWRITING_PROVIDER_5XX', 'a failed read is reported');
  const controller = new AbortController();
  const pending = reader.readWithCloud(page, { ...o2, signal: controller.signal });
  await new Promise(r => setTimeout(r, 20));
  controller.abort();
  eq([(await pending).error?.code, failures2, aborted], ['HANDWRITING_CANCELLED', 2, true], 'then asked again (never remembered), and cancelling the only waiter cancels the request');
}
// The reading before marking: which refusals are the reader's own.
const at = (failure, more = {}) => guard.readerRefusalAtSubmit({ beforeMarking: true, readerFailure: failure, ...more });
eq(at({ code: 'PAID_CAPACITY_REACHED', status: 503, resetAt: IN_AN_HOUR }), { code: 'PAID_CAPACITY_REACHED', status: 503, resetAt: IN_AN_HOUR }, 'a capacity refusal at Submit is the reader\'s');
ok(at({ code: 'AI_ALLOWANCE_EXHAUSTED', status: 429 }) && at({ code: 'HANDWRITING_TIMEOUT', status: 504 }) && at({ code: 'RATE_LIMITED', status: 429 }), 'so are the allowance, a timeout and a rate limit');
eq([at({ code: 'AUTH_REQUIRED', status: 401 }), at({ code: 'EMAIL_UNVERIFIED', status: 403 }), at({ code: 'QUESTION_ALREADY_GRADED', status: 409 }), at({ code: 'HANDWRITING_IMAGE_TOO_LARGE', status: 413 }), at({ code: 'CLOUD_DISABLED' })], [null, null, null, null, null],
  'sign-in, verification, a finished question, an unreadable image and a device with no connection keep the check\'s own flow');
eq(guard.readerRefusalAtSubmit({ readerFailure: { code: 'PAID_CAPACITY_REACHED', status: 503 } }), null, 'nothing is named unless it is proven that nothing was marked');
eq([guard.canRetryPhotoReading('x', true, false, { manualRetry: true }), guard.canRetryPhotoReading('x', true, false, { manualRetry: false }), guard.canRetryPhotoReading('verdict.photoReadingCapacity', false, false, { manualRetry: true })], [true, false, false], 'a retry is offered when the classification says so and there is something to read');

// ── 4 · the durable photo draft ──────────────────────────────────────────────
const drafts = await import('../src/local/photoDrafts.js');
const ink = await import('../src/local/inkDrafts.js');
const PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
ink.setInkDraftProfile('pid-photo-a');
const state = { photo: PHOTO, transcript: fixed, answer: '6', answerSource: 'proposed', engine: 'cloud-test', confidence: 0.9 };
eq(drafts.savePhotoDraft('q-photo', state, { label: 'Relations' }), true, 'the photo, its lines and the answer are accepted for keeping');
eq((await drafts.confirmPhotoDraftSaved('q-photo', state)).saved, true, 'and confirmed by a readback of exactly that state');
const row = (rawRows().inkDrafts || []).find(r => String(r.id).includes(':photo:'));
eq([row?.id, row?.pid, row?.kind], ['pid-photo-a:photo:q-photo', 'pid-photo-a', 'photo'], 'one row in the sealed inkDrafts store, bound to the profile and the question');
const kept = await drafts.readPhotoDraft('q-photo');
eq([kept.photo === PHOTO, kept.answer, kept.answerSource, kept.transcript.lines.length, kept.transcript.lines[6].text, kept.transcript.lines[6].read, kept.transcript.lines[0].excluded],
  [true, '6', 'proposed', 9, '(x+3)^2 >= 0.', '(x+3)^2 > 0.', true], 'restored whole: the picture, the edited line beside what was read, the exclusions and the answer');
eq((await drafts.confirmPhotoDraftSaved('q-photo', { ...state, answer: '9' })).saved, false, 'a different answer on screen is NOT reported as saved');
eq((await drafts.confirmPhotoDraftSaved('q-photo', { ...state, transcript: T.includeAll(fixed) })), { saved: false, reason: 'mismatch' }, 'nor are different exclusions');
eq(await ink.readInkDraft('q-photo'), null, 'the ink of the same question is a different record');
eq((await ink.queuedInkDrafts()).length, 0, 'and the ink reading queue does not list a photo');
const storage = JSON.stringify(Object.fromEntries(Object.keys(globalThis.localStorage || {}).map(k => [k, globalThis.localStorage.getItem?.(k)])));
ok(!storage.includes('AAAAAAAAAAAAAAAA') && !storage.includes('least value'), 'nothing of the photo or its reading is in localStorage');
ink.setInkDraftProfile('pid-photo-b');
eq([await drafts.readPhotoDraft('q-photo'), (await drafts.confirmPhotoDraftSaved('q-photo', state)).saved], [null, false], 'another profile on the same device sees none of it');
ink.setInkDraftProfile('pid-photo-a');
eq(await drafts.readPhotoDraft('q-other'), null, 'nor does another question');
eq(drafts.savePhotoDraft('q-big', { photo: 'data:image/jpeg;base64,' + 'A'.repeat(drafts.MAX_PHOTO_DRAFT_CHARS) }), false, 'a picture over the limit is refused, and the caller is told');
eq([drafts.savePhotoDraft('q-none', { photo: null }), drafts.savePhotoDraft('q-url', { photo: 'https://example.test/p.jpg' }), drafts.savePhotoDraft('', state)], [false, false, false], 'so is anything that is not a picture of the student\'s own');
eq((await drafts.confirmPhotoDraftSaved('q-big', { photo: PHOTO })), { saved: false, reason: 'missing' }, 'what was never written is never "saved"');
// Only what the card wrote is kept: nothing else can ride along.
eq(Object.keys(drafts.photoDraftPayload({ ...state, expected: '6', solution: 'x', marks: 3, question: { answer: 6 } })).sort(), ['answer', 'answerSource', 'confidence', 'engine', 'photo', 'reduced', 'transcript'], 'a draft holds the picture, the reading and the answer in the field — no key, solution or mark');
await drafts.clearPhotoDraft('q-photo');
eq([await drafts.readPhotoDraft('q-photo'), (rawRows().inkDrafts || []).filter(r => String(r.id).includes(':photo:')).length], [null, 0], 'submitted or discarded, it is gone from the device');
const source = readFileSync(new URL('../src/local/photoDrafts.js', import.meta.url), 'utf8');
ok(!/console\.|localStorage|sessionStorage|logEvent|diagnostic/i.test(source.replace(/\/\/[^\n]*/g, '')), 'the draft module never logs, reports or writes web storage');

if (failures.length) {
  console.error(`PHOTO PIPELINE: FAIL — ${failures.length} of ${pass + failures.length} checks`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`PHOTO PIPELINE: PASS — ${pass}/${pass} checks — the answer is mathematics or nothing, no line is hidden or rewritten, every reader refusal is named, and the photo draft is kept sealed and confirmed by readback.`);
