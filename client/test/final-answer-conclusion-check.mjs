// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a page that states its conclusion is never "couldn't read your final answer"
// (production defect, 26 Nov 2026, release 879c605e1).
//
// The owner photographed a clear, fully correct page — headed sections, a sketch graph, and the line
//   "Conclusion: The maximum velocity is [12 m s⁻¹] (boxed), obtained at t = 2."
// — and was told "Pri couldn't read your final answer. Rewrite that line or type it here."
// Root cause: finalAnswer.js read the value after the last "is", found "[12 m s⁻¹] (boxed), obtained", and
// refused it; the box, the unit written with a negative power and the where-clause each made the line
// unreadable, and "Conclusion" was not a label it knew.
//
// What is pinned here: this page exactly; forty-plus conclusion-sentence layouts; the adversarial cases
// (trailing clause numbers, two real candidates, a wrong conclusion over a right working line, a conclusion
// that really cannot be read); a sweep over the NSW Years 11–12 generators' own worked-solution final lines
// with units appended in three notations (before and after are both printed); and the typed field's unit
// spelling. The reader is answer-blind throughout: nothing here is given the key, and the deterministic
// marker still decides every mark.
//
// SYNTHETIC: generated questions and hand-written readings; not evidence about real students' pages.
// Usage: node client/test/final-answer-conclusion-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proposeFinalAnswer, lookedAt, spellUnits, readsAsAnswer, isMarginMark } from '../src/photo/finalAnswer.js';
import { parseNumericInput } from '../src/engine/checker-core.js';
import { buildTranscript, includedLines } from '../src/photo/transcript.js';

const SRC = new URL('../src/', import.meta.url).href;
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { generateQuestion, loadAllBanks, GENERATORS } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n += 1; };
// The number a proposed answer carries (its unit, if any, is read off as the marker reads it).
const valueOf = a => { try { return parseNumericInput(String(a)).value; } catch { return Number(String(a).replace(/[−–]/g, '-').match(/^[^\d-]*(-?[\d.]+)/)?.[1]); } };

// ── The owner's page, as the reader returns it (one entry per written line, reading order) ──────────────
const QUESTION = {
  id: 'owner-velocity', answerType: 'numeric', answerSuffix: 'm/s', totalMarks: 1,
  prompt: 'The velocity of a car is $v = 12t - 3t^2$ m/s for $0 \\le t \\le 4$. Find the maximum velocity.',
  answer: { value: 12 }
};
// What the card hands the proposal: the public answer shape only (never the key).
const SHAPE = { answerType: QUESTION.answerType, answerSuffix: QUESTION.answerSuffix };
const WORKING = [
  'Solution:', 'Given v = 12t − 3t² , 0 ≤ t ≤ 4.', 'To find the maximum velocity.',
  'Method: Find the stationary point(s) of v(t) using dv/dt = 0, and compare with the endpoints t = 0 and t = 4',
  'Working:', 'dv/dt = 12 − 6t.', 'Set dv/dt = 0 :', '12 − 6t = 0 ⇒ t = 2.', 'Check values of v at t = 0, 2, 4 :',
  'v(0) = 12(0) − 3(0)² = 0', 'v(2) = 12(2) − 3(2)² = 24 − 12 = 12', 'v(4) = 12(4) − 3(4)² = 48 − 48 = 0.'
];
const CONCLUSION = 'Conclusion: The maximum velocity is [12 m s⁻¹] (boxed), obtained at t = 2.';
const GRAPH = ['(2,12)', '0 2 4', '12'];

const page = proposeFinalAnswer([...WORKING, CONCLUSION], SHAPE);
ok(page.status === 'proposed' && valueOf(page.answer) === 12, `the owner's page states 12 (got ${JSON.stringify(page)})`);
ok(checkAnswer(QUESTION, page.answer).correct === true, 'and the marker marks that answer right, 1 of 1');
for (const tail of [GRAPH, ['v (m/s)', 't (s)', '4'], ['12', '2'], ['O']]) {
  const withGraph = proposeFinalAnswer([...WORKING, CONCLUSION, ...tail], SHAPE);
  ok(withGraph.status === 'proposed' && valueOf(withGraph.answer) === 12, `graph marks after the conclusion (${tail.join(' | ')}) do not take its place`);
}
const asRead = proposeFinalAnswer([...WORKING, 'Conclusion: The maximum velocity is \\boxed{12 m s^{-1}}, obtained at t = 2.'], SHAPE);
ok(asRead.status === 'proposed' && valueOf(asRead.answer) === 12, 'a TeX box is the same as the bracket');
ok(proposeFinalAnswer([...WORKING, CONCLUSION], { answerType: 'numeric' }).status === 'proposed', 'with no unit box in the question the page still states 12');
ok(proposeFinalAnswer([...WORKING, CONCLUSION], { ...SHAPE, prompt: QUESTION.prompt }).status === 'proposed', 'and with the prompt, which is public');

// ── Forty-plus conclusion sentences: layouts × unit notations × trailing clauses ──────────────────────
const UNITS = ['m/s', 'm s⁻¹', 'ms^-1', 'm s^-1', 'm s^{-1}', 'm s^(-1)', 'metres per second', 'm/s.'];
const LAYOUTS = [
  v => `Conclusion: The maximum velocity is ${v}`,
  v => `The maximum velocity is ${v}`,
  v => `Hence the maximum velocity is ${v}`,
  v => `∴ maximum velocity = ${v}`,
  v => `∴ max = ${v}`,
  v => `Answer: ${v}`,
  v => `Therefore v_max = ${v}`,
  v => `Conclusion: [${v}] (boxed)`,
  v => `Thus the car reaches a maximum velocity of ${v}`.replace('reaches a maximum velocity of', 'has a maximum velocity of'),
  v => `Final answer: ${v}`,
  v => `Max velocity = ${v}`,
  v => `Conclusion: the maximum velocity is [${v}] (boxed)`
];
const CLAUSES = ['', ', obtained at t = 2', ' when t = 2', ', which occurs at t = 2', ' (at t = 2)', ' at t = 2'];
let variants = 0;
const failed = [];
for (const layout of LAYOUTS) for (const unit of UNITS) for (const clause of CLAUSES) {
  const line = `${layout(`12 ${unit.replace(/\.$/, '')}`)}${clause}${/\.$/.test(unit) ? '.' : ''}`;
  variants += 1;
  const got = proposeFinalAnswer([...WORKING, line], SHAPE);
  if (!(got.status === 'proposed' && valueOf(got.answer) === 12)) failed.push(`${line}  →  ${JSON.stringify(got)}`);
}
ok(variants >= 40, `at least forty variants (${variants})`);
assert.deepEqual(failed, [], `every conclusion layout states 12:\n  ${failed.slice(0, 20).join('\n  ')}`);
n += 1;
console.log(`conclusion variants: ${variants} layouts × units × clauses, all state 12`);

// ── Adversarial ────────────────────────────────────────────────────────────────────────────────────────────
// A number in the where-clause is never the answer.
for (const [line, want] of [
  ['The maximum velocity is 12 m/s, obtained at t = 2', 12],
  ['Hence the maximum is 12 m/s when t = 2', 12],
  ['Conclusion: the minimum value is −3, attained at x = 1', -3],
  ['Hence y = 7 when x = 3', 7],
  ['The greatest height is 45 m, reached after t = 3 s', 45]
]) {
  const got = proposeFinalAnswer(['Working', line], { answerType: 'numeric' });
  ok(got.status === 'proposed' && valueOf(got.answer) === want, `"${line}" states ${want}, not the number in its clause (${JSON.stringify(got)})`);
}
// Two values that really compete: both are offered, nothing is chosen, the line is named.
for (const line of ['Conclusion: x = 2 or 12', 'Conclusion: the answer is 12 or 2', 'x = 2 or x = 12']) {
  const got = proposeFinalAnswer(['Working', line], { answerType: 'numeric' });
  ok(got.status === 'ambiguous' && got.candidates.length === 2 && got.lineText === line, `"${line}" offers both values and names the line (${JSON.stringify(got)})`);
}
// A wrong final answer is never rescued by a right value earlier in the working.
const wrong = proposeFinalAnswer([...WORKING, 'Conclusion: The maximum velocity is 10 m s⁻¹, obtained at t = 2.'], SHAPE);
ok(wrong.status === 'proposed' && valueOf(wrong.answer) === 10, 'a conclusion of 10 is read as 10 although v(2) = 12 is in the working');
ok(checkAnswer(QUESTION, wrong.answer).correct === false, 'and the marker marks 10 wrong');
const wrongGraph = proposeFinalAnswer([...WORKING, 'The maximum velocity is 10 m/s', ...GRAPH], SHAPE);
ok(wrongGraph.status === 'ambiguous' && wrongGraph.candidates.map(valueOf).sort((a, b) => a - b).join() === '10,12', 'a wrong sentence followed by a lone 12 offers both: never silently the working value or the tick');
// Working only, no conclusion: nothing is invented from a working line.
const noConclusion = proposeFinalAnswer([...WORKING], SHAPE);
ok(noConclusion.status === 'proposed' && noConclusion.answer === '0', 'a page that ends in working takes what its last line equals, as it always did (the marker then marks that 0 wrong)');
ok(checkAnswer(QUESTION, noConclusion.answer).correct === false, 'and a wrong last line is never rescued by the 12 earlier in the working');
const unstated = proposeFinalAnswer([...WORKING, 'Conclusion: see the graph'], SHAPE);
ok(unstated.status === 'none' && unstated.lineText === 'Conclusion: see the graph' && unstated.best === null, 'a conclusion that states no value is named, and nothing is invented from the working above it');
// A conclusion that cannot be taken still names itself and offers its best reading.
const hopeless = proposeFinalAnswer([...WORKING, 'Conclusion: the car is quickest at the middle, about 12 m/s'], SHAPE);
ok(hopeless.status === 'none' && /Conclusion: the car is quickest/.test(hopeless.lineText), 'an unreadable conclusion is named');
ok(hopeless.best === '12 m/s', `its best reading is offered for one tap (got ${JSON.stringify(hopeless.best)})`);
const seen = lookedAt([...WORKING, 'Conclusion: see the graph', '(2,12)', '0 2 4'], SHAPE);
ok(/Conclusion: see the graph/.test(seen.lineText), 'graph marks after the line are not "the last line"');
// A different unit is never taken off, a plain word is not a unit, the exponent is not the answer.
const otherUnit = proposeFinalAnswer(['The maximum velocity is 12 kg m⁻³'], SHAPE);
ok(otherUnit.answer === '12 kg/m³' && checkAnswer(QUESTION, otherUnit.answer).correct !== true, 'a different unit stays on the answer, so the marker still checks it (never taken off)');
ok(proposeFinalAnswer(['The maximum velocity is 12 N m'], SHAPE).status === 'none', 'a unit the marker does not read, under a box with another unit, is not stripped to make the number pass');
ok(proposeFinalAnswer(['The maximum velocity is 14 apples'], { answerType: 'numeric', answerSuffix: 'cm' }).status === 'none', 'a word that is no unit is no answer');
ok(lookedAt(['So the answer is about twelve m s^-1'], SHAPE).best === null, 'the power in a unit is not offered as the answer');
// Check lines and "answer" announcements keep their old behaviour.
ok(proposeFinalAnswer(['x = 3', 'check: 3 + 1 = 4'], { answerType: 'numeric' }).answer === '3', 'a check line is still not the answer');
ok(proposeFinalAnswer(['Answer: 6', 'so area = 5'], { answerType: 'numeric' }).status === 'ambiguous', 'an announced answer that disagrees with the last line is still asked about');

// ── Units are read as the value ───────────────────────────────────────────────────────────────────────────
for (const [line, want] of [['12 m/s', '12 m/s'], ['12 m s⁻¹', '12 m/s'], ['12 ms^-1', '12 m/s'], ['12 m s^{-1}', '12 m/s'], ['12 m s^-1', '12 m/s'], ['45°', '45°'], ['$12', '$12'], ['12%', '12%'], ['12 cm²', '12 cm²'], ['12 cm^2', '12 cm²']]) {
  const got = proposeFinalAnswer([`Hence the answer is ${line}`], { answerType: 'numeric' });
  ok(got.status === 'proposed' && got.answer === want, `"${line}" is read as ${want} (got ${JSON.stringify(got)})`);
}

// ── Typed and stylus pages share the extraction ───────────────────────────────────────────────────────────
ok(spellUnits('12 m s⁻¹', SHAPE) === '12 m/s' && spellUnits('12 ms^-1', SHAPE) === '12 m/s', 'a typed unit is spelt as the marker reads it');
ok(checkAnswer(QUESTION, spellUnits('12 m s⁻¹', SHAPE)).correct === true, 'and is then marked right');
ok(checkAnswer(QUESTION, '12 m s⁻¹').invalid === true, '(the marker alone does not read that spelling: the card spells it first)');
for (const same_ of ['12', '12 m/s', 'x = 12', 'The maximum velocity is 12', '12 apples']) ok(spellUnits(same_, SHAPE) === same_, `"${same_}" is left exactly as typed`);
ok(spellUnits('12 kg m^-3', SHAPE) === '12 kg/m³' && checkAnswer(QUESTION, spellUnits('12 kg m^-3', SHAPE)).correct !== true, 'a different unit is respelt, not dropped: the marker still sees it');
ok(spellUnits('12 m s⁻¹', { answerType: 'expression' }) === '12 m s⁻¹', 'only a numeric answer is respelt');
// A stylus page's own last line goes through the same module (QuestionCard's ink proposal).
ok(proposeFinalAnswer([...WORKING, CONCLUSION], SHAPE).answer === page.answer, 'a stylus reading of the same page proposes the same answer');
ok(readsAsAnswer('12 m/s', SHAPE), 'a last line that is already the answer is still read as written');

// ── The reader's own output on the owner's real pages (production reader, 26 Nov 2026), through the card's path ─────
// buildTranscript → includedLines → proposeFinalAnswer, exactly as QuestionCard.showReading does.
const V = { id: 'A12-C3-093', answerType: 'numeric', prompt: QUESTION.prompt, answer: { value: 12 }, totalMarks: 1 };   // the bank item has NO answerSuffix
const real = lines => buildTranscript({ lines: lines.map(text => ({ text, confidence: 0.97, uncertain: false })), confidenceFloor: 0.82 }, { prompt: V.prompt, answerType: 'numeric' });
const KEY12_A = ['Solution:', 'Given v = 12t - 3t^2, 0 <= t <= 4.', 'To find the maximum velocity.', 'Method: Find the stationary point(s) of v(t) using', 'dv/dt = 0, and compare with the endpoints t = 0 and t = 4.', 'Working:', 'dv/dt = 12 - 6t.', 'Set dv/dt = 0:', '12 - 6t = 0 => t = 2.', 'v', '(2, 12)', '12', 'Check values of v at t = 0, 2, 4:', '0', '2', '4', 't', 'v(0) = 12(0) - 3(0)^2 = 0', 'v(2) = 12(2) - 3(2)^2 = 24 - 12 = 12', 'v(4) = 12(4) - 3(4)^2 = 48 - 48 = 0.', 'Conclusion: The maximum velocity is 12 m s^-1, obtained at t ='];
const KEY12_B = ['Solution:', 'Given v = 12t - 3t^2, 0 <= t <= 4.', 'To find the maximum velocity.', 'Method: Find the stationary point(s) of v(t) using', 'dv/dt = 0, and compare with the endpoints t = 0 and t = 4.', 'Working:', 'dv/dt = 12 - 6t.', 'Set dv/dt = 0:', '12 - 6t = 0 => t = 2.', 'Check values of v at t = 0, 2, 4:', 'v(0) = 12(0) - 3(0)^2 = 0', 'v(2) = 12(2) - 3(2)^2 = 24 - 12 = 12', 'v(4) = 12(4) - 3(4)^2 = 48 - 48 = 0.', 'v', '(2, 12)', '12', '0', '2', '4', 't', 'Conclusion: The maximum velocity is 12 ms^-1, obtained at t:'];
for (const [name, lines] of [['screenshot overlay', KEY12_A], ['overlay painted out', KEY12_B]]) {
  const tr = real(lines);
  const kept = includedLines(tr);
  const got = proposeFinalAnswer(kept, { answerType: 'numeric' });
  ok(got.status === 'proposed' && got.answer === '12 m/s', `real reading (${name}): the answer is 12 m/s (got ${JSON.stringify(got)})`);
  ok(['v', '(2, 12)', '12', '0', '2', '4', 't'].every(label => !kept.includes(label)), `real reading (${name}): the seven graph labels are not working lines (${kept.length} of ${lines.length} kept)`);
  ok(checkAnswer(V, got.answer).correct === true, `real reading (${name}): the marker marks 12 m/s right on the bank item that states no unit box`);
}
ok(real(KEY12_A).lines.filter(l => l.why === 'figure').length === 7, 'each of the seven is left out as a figure label, and the student can bring them back');
// The bank item has no unit box: the unit the PROMPT states is accepted in the marker's own spelling; another unit is not.
ok(checkAnswer(V, '12 m/s').correct === true && checkAnswer(V, '12m/s').correct === true && checkAnswer(V, '12 metres per second').correct === true, 'the prompt\'s own unit is accepted, in the spellings the marker reads');
const otherRate = checkAnswer(V, '12 km/h');
ok(otherRate.correct !== true && otherRate.invalid === true && /does not ask for an answer in km\/h/.test(otherRate.feedback), 'a different rate is not silently accepted: the student is told which unit the question uses');
ok(checkAnswer(V, '10 m/s').correct === false, 'and a wrong value in the right unit is wrong');
ok(checkAnswer(V, spellUnits('12 m s^-1', { answerType: 'numeric' })).correct === true && checkAnswer(V, spellUnits('12 ms^-1', { answerType: 'numeric' })).correct === true && checkAnswer(V, spellUnits('12 m s⁻¹', { answerType: 'numeric' })).correct === true, 'the reader\'s spellings m s^-1, ms^-1, m s⁻¹ reach the marker as m/s and are right');
// A unit after the value on a plain label line.
const yInt = proposeFinalAnswer(['x = 0', 'y-intercept = 12 m'], { answerType: 'numeric' });
ok(yInt.status === 'proposed' && yInt.answer === '12 m', 'a labelled line with a unit ("y-intercept = 12 m") states 12 m');
// The teacher's marks on a photographed page (real reading of an annotated page) are never the answer.
const ANNOTATED = ['The curve y = 4x^3 - 36x^2 has two stationary points. Find the', 'x-coordinate.', 'Solution:', 'y = 4x^3 - 36x^2', 'd y/d x = 12x^2 - 72x', 'Correct differentiation', '(power rule)', 'So x = 0 or x = 6.', 'The stationary points are:', 'At x = 0: y = 4(0)^3 - 36(0)^2 = 0 => (0,0)', 'Correct, but', 'not required', '(unnecessary', 'working)', 'The two stationary points are (0,0) and (6,-432).', 'The larger x-coordinate is 6.', '1/1', '1/1', '1/1'];
const marked = proposeFinalAnswer(ANNOTATED, { answerType: 'numeric' });
ok(marked.status === 'proposed' && marked.answer === '6', `margin marks never become the answer (got ${JSON.stringify(marked)})`);
const markedPage = real(ANNOTATED);
ok(markedPage.lines.filter(l => l.text === '1/1').length === 3 && markedPage.lines.filter(l => l.text === '1/1').every(l => l.excluded && l.why === 'margin'), 'the three "1/1" are left out of the working as margin marks');
for (const mark of ['1/1', '2 / 2', '(1/1)', '3/4 marks', '✓', '✔ ✔', 'Correct', 'Well done']) ok(isMarginMark(mark), `"${mark}" is a mark on the page`);
for (const notMark of ['3/4', '1/2', 'x = 1/1', 'Correct answer is 6', '6', 'x']) ok(!isMarginMark(notMark), `"${notMark}" is not`);
ok(proposeFinalAnswer(['x = 3/4'], { answerType: 'numeric' }).answer === '3/4', 'a fraction answer is still an answer');
ok(proposeFinalAnswer(['The answer is 3/4'], { answerType: 'numeric' }).answer === '3/4', 'and so is one in a sentence');

// ── Sweep: NSW Years 11–12 generators' own worked-solution final lines, units in three notations ───────────
const FAMILIES = [['m/s', 'm s⁻¹', 'ms^-1'], ['cm²', 'cm^2', 'cm2'.replace('cm2', 'sq cm')], ['kg/m³', 'kg m⁻³', 'kg m^-3']];
const fmt = x => (Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(10))));
const plain = d => String(d ?? '').replace(/\$/g, '').replace(/\s+/g, ' ').trim();
const lastNumber = text => { const m = [...String(text).replace(/[−–]/g, '-').matchAll(/-?\d+(?:\.\d+)?/g)]; return m.length ? Number(m.at(-1)[0]) : NaN; };
const NSW = /^(y11|y12|ms11|ms12|me11|me12|mex)-/;
const pages = [];
for (const gen of Object.keys(GENERATORS).filter(g => NSW.test(g))) for (let d = 1; d <= 4; d += 1) for (let i = 1; i <= 8; i += 1) {
  let q; try { q = generateQuestion(gen, d, i * 7919 + d * 104729); } catch { continue; }
  if (!q || q.answerType !== 'numeric' || !Number.isFinite(q.answer?.value) || q.answer.value === 0) continue;
  const value = q.answer.value;
  const shown = fmt(value);
  const last = plain(q.steps?.at(-1)?.d).replace(/\.$/, '');
  const family = FAMILIES[(pages.length) % FAMILIES.length];
  for (const unit of family) {
    // (A) the worked solution's own last line with the unit after the value; (B) a boxed conclusion sentence with a clause.
    if (last && !/\\/.test(last) && lastNumber(last) === value && /=\s*-?[\d.]+$/.test(last)) pages.push({ gen, d, value, lines: [`${last} ${unit}`], layout: 'worked line' });
    pages.push({ gen, d, value, lines: [`Conclusion: the answer is [${shown} ${unit}] (boxed), obtained at x = 2.`], layout: 'boxed conclusion' });
  }
}
const read = lines => proposeFinalAnswer(['Working:', 'v(1) = 3', ...lines], { answerType: 'numeric' });
let unreadable = 0, wrongValue = 0; const unread = [];
for (const p of pages) {
  const got = read(p.lines);
  if (got.status !== 'proposed') { unreadable += 1; unread.push(`${p.gen} d${p.d}: ${p.lines[0]} → ${JSON.stringify(got)}`); }
  else if (Math.abs(valueOf(got.answer) - p.value) > 1e-9 * Math.max(1, Math.abs(p.value))) wrongValue += 1;
}
// The same pages through the extraction as it stood on 879c605e1, measured by running it (not estimated).
const BEFORE = { pages: 7647, unreadable: 7217, wrongValue: 60 };
console.log(`NSW sweep: ${pages.length} pages · "couldn't read" before ${BEFORE.unreadable} → now ${unreadable} · read as a wrong value before ${BEFORE.wrongValue} → now ${wrongValue}`);
ok(pages.length === BEFORE.pages, `the same ${BEFORE.pages} pages as the measurement on 879c605e1 (${pages.length})`);
ok(pages.length >= 400, `the sweep covers at least 400 pages (${pages.length})`);
ok(wrongValue === 0, 'no page is read as a value other than the one it states');
ok(unreadable === 0, `no page that states its answer is "couldn't read" (${unreadable} of ${pages.length}):\n  ${unread.slice(0, 12).join('\n  ')}`);

// ── The card: one honest sentence, tappable choices, both languages ─────────────────────────────────────────
const card = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
ok(/function FinalAnswerNote/.test(card) && /data-final-answer-choice/.test(card), 'the card names the line it looked at and offers the reading as a tap');
ok(/AU_FINAL_ANSWER_NOTE/.test(card) && /EDITION_ID !== 'prithagoras'/.test(card), 'with its two sentences, for Prithagoras only (Priyabhata keeps its one sentence)');
ok(/spellUnits\(given, publicAnswerShape\)/.test(card), 'and spells a typed unit as the marker reads it');
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
const { AU_FINAL_ANSWER_NOTE } = await import('../src/i18n/strings.au.js');
ok(!('mark.finalLookedPick' in en) && !('mark.finalLookedPick' in hi) && !('mark.finalLookedNone' in hi), 'no catalogue key and no Hindi was written for the new sentences');
ok(/Pri looked at this line/.test(AU_FINAL_ANSWER_NOTE.pick('v = 3')) && /v = 3/.test(AU_FINAL_ANSWER_NOTE.none('v = 3')), 'the Prithagoras sentences carry the line');
ok(/^Pri couldn’t read your final answer\. Rewrite that line or type it here\.$/.test(en['mark.finalUnreadable']), 'the original sentence is unchanged for a page with no line to name');

console.log(`FINAL ANSWER FROM CONCLUSION: PASS — ${n} checks — the owner's page states 12, ${variants} conclusion layouts, units in any notation, a clause never replaces the answer, two candidates are offered, the sweep reads ${pages.length - unreadable} of ${pages.length}`);
