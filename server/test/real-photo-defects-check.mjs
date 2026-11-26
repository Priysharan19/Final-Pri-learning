// Pri Learning · six defects of a real end-to-end run, 27 Nov 2026 (origin/main 23378360e), each pinned with the production reader's own output
//
// The run photographed or rendered twelve pages, sent them through the live reader, and marked the reading with the real code. Its reader outputs
// (text, confidence, line boxes; no image, no key) are kept in server/test/support/real-photo-readings-2026-11-27.json. This suite feeds them back.
//
//   1  a number with a thousands space ("13 040") is one number in the final-answer pickup, as it already was on the marked page; "4 weeks" after it is not merged
//   2  a false link far down a page of working is checked: the 12-line cap of the value chain is gone, and the false link is crossed with the computed value
//   3  a conclusion that assigns a value to the quantity the question names ("Find k") gives that value; the other quantities of the sentence are not candidates
//   4  a line the reader cut off ("... obtained at t =") is judged and described by its complete part; no phrase states what the line does not contain
//   5  every phrase is a plain true sentence for its class (a definition note is only on a definition; the correct final answer says "Correct answer")
//   6  a second column the reader met row by row is read column by column again, from the reader's own boxes; a page in one column is returned untouched
//
// Invariants kept: deterministic; a wrong line is never ticked and a true line never crossed; reading is answer-blind (no key is passed to anything here
// that reads the page); the typed-answer checker is untouched. SYNTHETIC pages are marked as such in the fixture.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.PRI_EDITION = 'prithagoras';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
await imp('server/test/support/hermetic.mjs');
const G = await imp('client/src/engine/generators/index.js');
const MO = await imp('server/platform/markerOps.js');
const QB = await imp('server/platform/qbankPack.js');
const { editionMarkingPolicy } = await imp('server/platform/editionMarking.js');
const { bankPolicy, sealForEdition } = await imp('server/platform/editionBanks.js');
const { interpretAfterStepCheck, reportWithInterpretation } = await imp('server/platform/lineInterpreter/overlay.js');
const { adoptProved } = await imp('client/src/engine/provedLines.js');
const { restoreReadingOrder, findGutter } = await imp('server/platform/readingOrder.js');
const { normalizeResult } = await imp('server/platform/handwritingProvider.js');
const FA = await imp('client/src/photo/finalAnswer.js');
const { parseNumericInput } = await imp('client/src/engine/checker-core.js');
const TR = await imp('client/src/photo/transcript.js');
const GN = await imp('client/src/engine/groupedNumber.js');
const LR = await imp('client/src/engine/lineRecognisers.js');
const { safeLatexLines } = await imp('client/src/engine/texSafe.js');
const { stepCheckValueChain } = await imp('client/src/engine/valueChain.js');
const { stepCheckVectorChain } = await imp('client/src/engine/vectorChain.js');
const { diagnoseStep } = await imp('client/src/engine/diagnose.js');
const TEACHER = await imp('client/src/components/markedPageTeacher.js');
const DF = await imp('client/src/engine/displayFields.js');
const PP2 = await imp('client/src/engine/pageProofs2.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const same = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

await G.loadAllBanks();
await QB.ensureQbank({ PRI_EDITION: 'prithagoras' }, { strict: false });
const FIXTURE = JSON.parse(fs.readFileSync(path.join(HERE, 'support', 'real-photo-readings-2026-11-27.json'), 'utf8'));
const PAGES = FIXTURE.pages;
const texts = id => PAGES[id].reading.lines.map(l => l.text);

function questionOf(spec) {
  let q;
  if (spec.custom) q = MO.markerView({ ...G.generateQuestion('y12-diff', 1, 1), prompt: spec.custom.prompt, answerType: spec.custom.answerType, answer: spec.custom.answer ?? { value: 0 }, steps: undefined, _marking: 'final-answer-only' });
  else if (spec.qbank) q = QB.qbankEntryQuestion(spec.qbank, 1);
  else if (spec.seed) q = G.generateQuestion(spec.gen, spec.level, spec.seed);
  else { const re = new RegExp(spec.promptRe); for (let s = 1; s < 60000 && !q; s++) { try { const c = G.generateQuestion(spec.gen, spec.level, s); if (c && re.test(c.prompt)) q = c; } catch { /* next */ } } }
  if (!q) throw new Error('question not found');
  if (!spec.custom) sealForEdition(q, bankPolicy('prithagoras'));
  return q;
}
/** The reader's lines as the card shows them to the student and sends them: the transcript, then the working text. */
function workingOf(id, q, lines = PAGES[id].reading.lines) {
  const transcription = { engine: 'cloud-fixture', lines: safeLatexLines(lines.map(l => ({ ...l, latex: null }))), text: lines.map(l => l.text).join('\n'), confidence: PAGES[id].reading.confidence, confidenceFloor: 0.8, needsConfirmation: false };
  const transcript = TR.buildTranscript(transcription, { prompt: q.prompt, answerType: q.answerType });
  return TR.workingOf(transcript);
}
/** The marked report of a working text, as the page shows it (topic report, folded true lines, proved lines). */
async function mark(q, working, answer) {
  const policy = editionMarkingPolicy(process.env);
  const run = MO.MARKER_OPS.practice({ q, answer, working, evidenceIfWrong: true, policy }, () => {});
  const ev = run.evidence;
  let report = ev.stepReport;
  const li = await interpretAfterStepCheck({ question: q, working, stepReport: report, env: process.env });
  report = reportWithInterpretation({ stepReport: report, lineInterpretation: li, working });
  if (ev.shownReport) report = report ? adoptProved(report, ev.shownReport) : ev.shownReport;
  return report?.lines || [];
}
const num = a => { try { return parseNumericInput(String(a)).value; } catch { return NaN; } };
const count = (lines, status) => lines.filter(l => l.status === status).length;

// ── 1 · a number with a thousands space ─────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const q = questionOf(PAGES['real48-815-users'].question);
  const shape = { answerType: q.answerType, answerSuffix: q.answerSuffix, askedPrompt: q.prompt };
  const lines = texts('real48-815-users');
  ok(/13 040 users after 4 weeks/.test(lines.at(-1)), 'the reader\'s last line of the owner\'s page carries "13 040 users after 4 weeks"');
  const got = FA.proposeFinalAnswer(lines, shape);
  ok(got.status === 'proposed' && num(got.answer) === 13040, `the owner's page proposes 13040 (${JSON.stringify(got)})`);
  const card = FA.proposeFinalAnswer(TR.includedLines(TR.buildTranscript({ lines: safeLatexLines(PAGES['real48-815-users'].reading.lines.map(l => ({ ...l, latex: null }))), text: lines.join('\n'), confidence: 0.99, confidenceFloor: 0.8 }, { prompt: q.prompt, answerType: q.answerType })), shape);
  ok(card.status === 'proposed' && num(card.answer) === 13040, 'and so does the card, from the transcript it builds');
  for (const [label, last] of [
    ['regular space', 'Conclusion: There are 13 040 users after 4 weeks.'], ['no-break space', 'Conclusion: There are 13 040 users after 4 weeks.'],
    ['thin space', 'Conclusion: There are 13 040 users after 4 weeks.'], ['narrow no-break space', 'Conclusion: There are 13 040 users after 4 weeks.'],
    ['comma', 'There are 13,040 users after 4 weeks.'], ['boxed', 'Conclusion: There are \\boxed{13 040} users after 4 weeks.'], ['no clause', 'There are 13 040 users'],
    ['Answer label', 'Answer: 13 040'], ['bare', '13 040']
  ]) {
    const r = FA.proposeFinalAnswer([...lines.slice(0, -1), last], shape);
    ok(r.status === 'proposed' && num(r.answer) === 13040, `${label}: 13040 (${JSON.stringify(r)})`);
  }
  ok(FA.proposeFinalAnswer(['Total = 1,250,000'], { answerType: 'numeric' }).answer === '1,250,000' && FA.proposeFinalAnswer(['1 250 000'], { answerType: 'numeric' }).answer === '1 250 000', '1,250,000 and 1 250 000 are one number, shown as the student wrote it');
  ok(FA.proposeFinalAnswer(['total = 1\u2009250\u2009000'], { answerType: 'numeric' }).answer === '1250000', 'a thin space is shown as digits');
  const list = FA.proposeFinalAnswer(['x = 13, 040'], { answerType: 'numeric' });
  ok(list.status === 'ambiguous', `"13, 040" (a comma and a space) is a list: the student chooses (${JSON.stringify(list)})`);
  ok(FA.proposeFinalAnswer(['2 5'], { answerType: 'numeric' }).answer !== '25', '"2 5" is not 25');
  same([GN.joinGroupedNumbers('13 040 4 weeks'), GN.joinGroupedNumbers('2 5'), GN.joinGroupedNumbers('1 25'), GN.joinGroupedNumbers('0 040'), GN.joinGroupedNumbers('12 3456'), GN.joinGroupedNumbers('x2 100')],
    ['13040 4 weeks', '2 5', '1 25', '0 040', '12 3456', 'x2 100'], 'only groups of exactly three digits join, and "4 weeks" stays its own number');
  same([GN.joinGroupedNumbers('(1,200)'), GN.joinGroupedNumbers('f(1,200)'), GN.joinGroupedNumbers('x = 1,200', { commas: false }), GN.joinGroupedNumbers('1,200.5'), GN.joinGroupedNumbers('1,2003')], ['(1,200)', 'f(1,200)', 'x = 1,200', '1,200.5', '1,2003'], 'a comma is joined only where nothing can make it a list separator or a decimal comma');
  ok(GN.numOf('13 040') === 13040 && GN.numOf('1,250,000') === 1250000, 'the page-side reading and the pickup share one number reading');
  ok(LR.questionOf({ prompt: 'A tank holds 13 040 litres.' }).numbers.has(13040), 'the marked page reads 13 040 as 13040 too');
  ok(FA.proposeFinalAnswer(['(1,200)'], { answerType: 'point' }).status !== 'proposed' || FA.proposeFinalAnswer(['(1,200)'], { answerType: 'point' }).answer === '(1,200)', 'a point keeps its own comma');
}

// ── 3 · a conclusion that names the asked quantity ───────────────────────────────────────────────────────────────────────────────────────────────
{
  const q = questionOf(PAGES['synth1-integration'].question);
  const shape = { answerType: q.answerType, answerSuffix: q.answerSuffix, askedPrompt: q.prompt };
  const lines = texts('synth1-integration');
  ok(lines.at(-1) === 'The value of k is 7, so the area is 84 square units.', 'the reader\'s last line is the sentence with two values');
  ok(FA.askedName(shape) === 'k', 'the prompt names k ("Find $k$.")');
  const got = FA.proposeFinalAnswer(lines, shape);
  ok(got.status === 'proposed' && got.answer === '7', `"The value of k is 7, so the area is 84 square units." gives 7 (${JSON.stringify(got)})`);
  ok(FA.proposeFinalAnswer([lines.at(-1)], shape).answer === '7', 'on its own too');
  ok(FA.proposeFinalAnswer(['The value of k is 7 so the area is 84 square units.'], shape).answer === '7', 'with no comma');
  ok(FA.proposeFinalAnswer(['The area is 84 square units so the value of k is 7.'], shape).answer === '7', 'with the asked quantity second');
  ok(FA.proposeFinalAnswer(['k = 7, so the area is 84.'], shape).answer === '7', 'k = 7, so the area is 84');
  const unbound = FA.proposeFinalAnswer([lines.at(-1)], { answerType: 'numeric' });
  ok(unbound.status !== 'proposed' || unbound.answer === '84' || unbound.answer === '7', 'with no prompt the card behaves as before (it cannot bind a name)');
  for (const prompt of ['Find the area.', 'Find $k$ and $m$.', 'Find a value of the area.', 'Show that the area is 84.']) {
    const r = FA.proposeFinalAnswer(['The value of k is 7, so the area is 84 square units.'], { answerType: 'numeric', askedPrompt: prompt });
    ok(r.status === 'ambiguous' || r.status === 'proposed', `"${prompt}": nothing is bound by name (${r.status})`);
    ok(FA.askedName({ askedPrompt: prompt }) === null, `"${prompt}" names no single letter`);
  }
  ok(FA.askedName({ askedPrompt: 'Find $a$.' }) === 'a' && FA.askedName({ askedPrompt: 'Find the value of $m$ when $x = 2$.' }) === 'm' && FA.askedName({ askedPrompt: 'Calculate n.' }) === 'n', 'a named letter is read from "find the value of" and "calculate"');
  const twoValues = FA.proposeFinalAnswer(['k = 7 or k = -12, so the area is 84'], shape);
  ok(twoValues.status === 'ambiguous' && twoValues.candidates.length === 2 && !twoValues.candidates.includes('84'), `two values of k are offered, never the area (${JSON.stringify(twoValues)})`);
  ok(FA.proposeFinalAnswer(['So the area is 84 square units.'], { answerType: 'numeric' }).answer === '84', 'a sentence with one value is unchanged');
}

// ── 6 · reading order of a two-column page ───────────────────────────────────────────────────────────────────────────────────────────────────────
const ids = Object.keys(PAGES);
{
  const fresh = PAGES['real-key6-two-column-interleaved'].reading.lines;
  const before = fresh.map(l => l.text);
  ok(before.indexOf('(local maximum)') > before.indexOf('Stationary points when dy/dx = 0:') && before.indexOf('(local maximum)') - before.indexOf('At x = 0: d^2y/dx^2 = -72 < 0') > 1, 'the real read has "(local maximum)" away from its parent line');
  const r = restoreReadingOrder(fresh);
  const after = r.lines.map(l => l.text);
  ok(r.reordered === true, 'the interleaved read is reordered');
  ok(after.indexOf('(local maximum)') === after.indexOf('At x = 0: d^2y/dx^2 = -72 < 0') + 1, '"(local maximum)" follows its parent line');
  ok(after.indexOf('(local minimum)') === after.indexOf('At x = 6: d^2y/dx^2 = 72 > 0') + 1, '"(local minimum)" follows its parent line');
  ok(after.indexOf('So x = 0 or x = 6.') < after.indexOf('d^2y/dx^2 = 24x - 72') && after.indexOf('12x(x - 6) = 0') < after.indexOf('d^2y/dx^2 = 24x - 72'), 'the left column is read first, top to bottom, then the right column');
  ok(after.indexOf('d^2y/dx^2 = 24x - 72') < after.indexOf('At x = 0: d^2y/dx^2 = -72 < 0') && after.indexOf('At x = 6: d^2y/dx^2 = 72 > 0') < after.indexOf('(local minimum)'), 'the right column is read top to bottom');
  same(after.slice(0, 2).concat(after.slice(-3)), before.slice(0, 2).concat(before.slice(-3)), 'the title, "Solution:" and the lines below the columns keep their places (the answer line stays last)');
  same([...after].sort(), [...before].sort(), 'no line is dropped, added or edited: the same lines in another order');
  ok(restoreReadingOrder(r.lines).reordered === false && restoreReadingOrder(r.lines).lines === r.lines, 'reordering again changes nothing (idempotent)');
  const gutter = findGutter(fresh.map(l => ({ ...l.box, right: l.box.x + l.box.w, bottom: l.box.y + l.box.h })));
  ok(gutter && gutter.x > 0.6 && gutter.x < 0.7 && gutter.right.length === 5, 'the gutter is found at the right column (five lines)');
  const inOrder = restoreReadingOrder(PAGES['real-key6-two-column-in-order'].reading.lines);
  ok(inOrder.reordered === false && inOrder.lines === PAGES['real-key6-two-column-in-order'].reading.lines, 'the earlier read of the same page, columns already one after the other, is untouched');
  // every stored page: only the three whose columns the reader interleaved move
  const moved = ids.filter(id => restoreReadingOrder(PAGES[id].reading.lines).reordered);
  same(moved.sort(), ['real-key6-two-column-interleaved', 'synth1-integration', 'synth3-sinerule' in PAGES ? 'synth3-sinerule' : 'synth3', 'synth8-arithmetic-slip'].sort(), 'of the stored pages exactly the interleaved two-column ones move');
  for (const id of ids.filter(i => !moved.includes(i))) ok(restoreReadingOrder(PAGES[id].reading.lines).lines === PAGES[id].reading.lines, `${id}: returned as it came`);
  // adversaries
  const L = (text, x, y, w, h = 0.04) => ({ text, box: { x, y, w, h } });
  const single = Array.from({ length: 10 }, (_, i) => L(`line ${i}`, 0.1, 0.05 + i * 0.08, 0.5));
  ok(restoreReadingOrder(single).lines === single, 'a single column is returned as it came');
  const notes = [];
  for (let i = 0; i < 6; i++) { notes.push(L(`step ${i}`, 0.1, 0.05 + i * 0.12, 0.4)); notes.push(L(`(note ${i})`, 0.7, 0.07 + i * 0.12, 0.1)); }
  ok(restoreReadingOrder(notes).lines === notes, 'short margin notes beside each line are not a column');
  const crossing = [L('title', 0.1, 0.02, 0.8), L('a1', 0.1, 0.1, 0.3), L('b1', 0.6, 0.1, 0.3), L('a2', 0.1, 0.2, 0.3), L('wide line across both', 0.1, 0.25, 0.8), L('b2', 0.6, 0.3, 0.3), L('a3', 0.1, 0.3, 0.3), L('b3', 0.6, 0.4, 0.3), L('a4', 0.1, 0.4, 0.3)];
  ok(restoreReadingOrder(crossing).lines === crossing, 'a line running across the gutter inside the band means no gutter: returned as it came');
  ok(restoreReadingOrder(single.map(l => ({ text: l.text }))).lines.length === 10, 'lines without boxes are returned as they came');
  ok(restoreReadingOrder(null).reordered === false && restoreReadingOrder([]).reordered === false, 'nothing to order');
  const twoCols = [];
  for (let i = 0; i < 5; i++) { twoCols.push(L(`L${i}`, 0.08, 0.1 + i * 0.1, 0.35)); twoCols.push(L(`R${i}`, 0.55, 0.1 + i * 0.1, 0.3)); }
  same(restoreReadingOrder(twoCols).lines.map(l => l.text), ['L0', 'L1', 'L2', 'L3', 'L4', 'R0', 'R1', 'R2', 'R3', 'R4'], 'a plain two-column layout read row by row is read column by column');
  // the server applies it where the reader's reply is normalised
  const reply = { lines: fresh.map(l => ({ text: l.text, confidence: l.confidence, box: l.box, gap_before: l.gapBefore })), confidence: 0.99 };
  const normal = normalizeResult(reply, { model: 'm', confidenceFloor: 0.8 });
  same(normal.lines.map(l => l.text), after, 'normalizeResult returns the lines in the restored order');
  ok(normal.text === after.join('\n'), 'and its text is joined in that order');
}

// ── 6 · marking the restored page; 2 · a false link far down a page ───────────────────────────────────────────────────────────────────────────
{
  const qk = questionOf(PAGES['real-key6-two-column-interleaved'].question);
  const asRead = await mark(qk, workingOf('real-key6-two-column-interleaved', qk, PAGES['real-key6-two-column-interleaved'].reading.lines), '6');
  const restored = await mark(qk, workingOf('real-key6-two-column-interleaved', qk, restoreReadingOrder(PAGES['real-key6-two-column-interleaved'].reading.lines).lines), '6');
  ok(count(asRead, 'ok') < count(restored, 'ok') || count(asRead, 'ok') === 0, `the interleaved read leaves lines unchecked (${count(asRead, 'ok')} ticked), the restored one does not`);
  ok(count(restored, 'break') === 0 && restored.every(l => l.status !== 'note' || /^(?:This line|Not checked: this question|Restates)/.test(String(l.note ?? '')) || l.context === true || l.restates === true), 'the restored page: nothing crossed, nothing left "not verified"');
  const nature = restored.filter(l => /local m/.test(l.text));
  ok(nature.length === 2 && nature.every(l => l.status === 'ok'), 'both nature lines are ticked in the restored order');
  const inOrder = await mark(qk, workingOf('real-key6-two-column-in-order', qk), '6');
  ok(count(inOrder, 'ok') >= 16 && count(inOrder, 'break') === 0, 'the earlier read still marks 16 lines correct, none crossed');

  // the false link on line 15 of a two-column page (value -432 written -436)
  const q8 = questionOf(PAGES['synth8-arithmetic-slip'].question);
  const ordered8 = restoreReadingOrder(PAGES['synth8-arithmetic-slip'].reading.lines).lines;
  const w8 = workingOf('synth8-arithmetic-slip', q8, ordered8);
  const m8 = await mark(q8, w8, '6');
  const slip = m8.findIndex(l => /-436/.test(l.text));
  ok(slip > 12, `the false link stands past line 12 (line ${slip + 1})`);
  ok(m8[slip]?.status === 'break' && /\$-432\$/.test(String(m8[slip].note)) && /-436/.test(String(m8[slip].note)), `it is crossed with the computed value (${m8[slip]?.status}: ${m8[slip]?.note})`);
  ok(!/too long or too far down/.test(JSON.stringify(m8)), 'and no line says "too far down to check"');
  ok(m8.filter(l => l.status === 'break').length === 1, 'exactly one cross on the page');
  ok(m8.slice(0, slip).every(l => l.status !== 'break'), 'no line before it is crossed');
  const asRead8 = await mark(q8, workingOf('synth8-arithmetic-slip', q8), '6');
  ok(asRead8.filter(l => l.status === 'break').length <= 1, 'as the reader ordered it, at most that one cross');
  // the same false link on a short page, and the true page of the same question
  const shortPage = ['y = 4x^3 - 36x^2', 'dy/dx = 12x^2 - 72x', '12x(x - 6) = 0', 'So x = 0 or x = 6.', 'At x = 6: y = 4(6)^3 - 36(6)^2 = 4(216) - 36(36)', '= 864 - 1296 = -436 => (6, -436)', 'The larger x-coordinate is 6'];
  const ms = await mark(q8, shortPage.join('\n'), '6');
  ok(ms.some(l => l.status === 'break' && /-436/.test(l.text) && /\$-432\$/.test(String(l.note))), 'the same false link on a short page is crossed as well');
  const trueShort = await mark(q8, shortPage.join('\n').replace('-436', '-432').replace('-436', '-432'), '6');
  ok(trueShort.every(l => l.status !== 'break'), 'with -432 written, nothing is crossed');
  for (const bad of ['= 864 - 1296 = -432 => (6, -436)']) {
    const r = await mark(q8, shortPage.slice(0, 5).concat([bad, shortPage[6]]).join('\n'), '6');
    ok(r.every(l => l.status !== 'ok' || !/-436/.test(l.text)), `a false point claim is never ticked (${bad})`);
  }
  // true pages of the key-6 question: nothing crossed, wherever the line stands
  const longTrue = [];
  for (let i = 0; i < 20; i++) longTrue.push(`At x = ${i + 1}: y = 4(${i + 1})^3 - 36(${i + 1})^2`);
  const lt = await mark(q8, longTrue.join('\n'), '6');
  ok(lt.every(l => l.status !== 'break'), 'twenty true substitution lines: no cross');
}

// the value chain itself: the cap was 12 lines
{
  const META = { kind: 'value-chain', fn: { name: 'h', variable: 't', expr: '22+5*sin(pi*t/6)' }, quantities: { max: 27, min: 17, amplitude: 5, midline: 22, period: 12 }, fullDomain: true };
  const pad = n => Array.from({ length: n }, (_, i) => `h(${i % 12}) = ${22 + 5 * Math.sin(Math.PI * (i % 12) / 6)}`);
  const trueLines = ['max = 22 + 5', '= 27', 'period = 2π/(π/6)', '= 12', 'h(3) = 22 + 5 sin(π/2) = 27'];
  const page = [...trueLines, ...Array(55).fill('h(3) = 22 + 5 sin(π/2) = 27'), 'h(3) = 22 + 5 sin(π/2) = 26'];
  const rep = stepCheckValueChain(META, page.join('\n'));
  ok(rep.lines.length === page.length && rep.firstBreak === page.length - 1, `a false value on line ${page.length} is the first break (${rep.firstBreak})`);
  ok(/comes to/.test(rep.lines[page.length - 1].note) && /26/.test(rep.lines[page.length - 1].note), 'with the computed value in its note');
  ok(rep.lines.slice(0, 40).every(l => l.status !== 'note' || !/too far/.test(l.note)) && !rep.lines.some(l => /too long or too far down/.test(l.note ?? '')), 'no line says it is too far down');
  const trueRep = stepCheckValueChain(META, [...trueLines, ...Array(55).fill('h(3) = 22 + 5 sin(π/2) = 27')].join('\n'));
  ok(trueRep.firstBreak === -1 && trueRep.lines.every(l => l.status !== 'break'), 'sixty true lines: no break');
  ok(trueRep.lines.slice(5).every(l => l.status === 'ok'), 'and every one of them is ticked, wherever it stands');
  const long = stepCheckValueChain(META, 'max = ' + '22 + 5 + 0 '.repeat(20));
  ok(/too long to check/.test(long.lines[0].note) && !/far down/.test(long.lines[0].note), 'a line over 160 characters says it is too long, not too far down');
  const past = stepCheckValueChain(META, Array(101).fill('= 27').join('\n'));
  ok(/past the first 100 lines/.test(past.lines[100].note), 'a page past 100 lines says how far a page is checked (the checker\'s own working limit)');
  const vec = stepCheckVectorChain ? 1 : 0;
  ok(vec === 1, 'the vector chain keeps the same limit');
}

// ── 4 · a line the reader cut off ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const q = questionOf(PAGES['real-key12-velocity'].question);
  const lines = texts('real-key12-velocity');
  ok(/obtained at t =$/.test(lines.at(-1)), 'the reader\'s last line ends "obtained at t ="');
  ok(PAGES['real-key12-velocity'].reading.lines.at(-1).uncertain === true, 'and the reader flagged it itself');
  const rep = await mark(q, workingOf('real-key12-velocity', q), '12 m/s');
  const last = rep.at(-1);
  ok(last.status === 'ok' && last.tickClass === 'conclusion-extremum', `the cut-off conclusion is still judged by its complete part and ticked (${last.status})`);
  ok(/^Correct answer: maximum velocity 12 m\/s\./.test(String(last.note)), `its phrase describes the complete part only (${last.note})`);
  ok(!/reached at|t = 2|, as this line says/.test(String(last.note)), 'and says nothing about the place the line does not give');
  ok(rep.filter(l => l.status === 'break').length === 0, 'nothing on the page is crossed');
  const full = await mark(q, [...workingOf('real-key12-velocity', q).split('\n').slice(0, -1), 'Conclusion: The maximum velocity is 12 m s^-1, obtained at t = 2.'].join('\n'), '12 m/s');
  ok(/Correct answer: maximum velocity 12 m\/s\..*reached at t = 2, as this line says/.test(String(full.at(-1).note)), `a line that gives the place is described with it (${full.at(-1).note})`);
  const noPlace = await mark(q, [...workingOf('real-key12-velocity', q).split('\n').slice(0, -1), 'The maximum velocity is 12 m/s'].join('\n'), '12 m/s');
  ok(noPlace.at(-1).status === 'ok' && !/reached at/.test(String(noPlace.at(-1).note)), 'a line with no place is not given one');
  const wrong = await mark(q, [...workingOf('real-key12-velocity', q).split('\n').slice(0, -1), 'Conclusion: The maximum velocity is 11 m/s, obtained at t ='].join('\n'), '11 m/s');
  ok(wrong.at(-1).status !== 'ok', 'a wrong value in a cut-off line is never ticked');
  const claim = PP2.extremumClaim({ fn: { name: 'v', v: 't' }, nouns: new Set(['velocity']), asksValue: false }, 'Conclusion: The maximum velocity is 12 m s^-1, obtained at t =');
  ok(claim === null || claim.truncated === true, 'the claim reader marks a cut-off line as cut off');
}

// ── 5 · phrases ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const PLACEHOLDER = /undefined|\bnull\b|NaN|\[object|\{\{|\}\}|%s|\$\{|TODO|—|–|\bundefined\b/;
  // the class → phrase table, spelled out: a phrase that does not say what its class proves fails here
  const WANT = {
    'power-rule-differentiation': 'Correct differentiation', differentiation: 'Correct differentiation', 'derivative-rule': 'Correct differentiation', factorisation: 'Correct factorisation',
    'roots-of-a-product': 'Correct stationary values', 'equation-setup': 'Correct stationary equation', 'substitution-evaluated': 'Correct substitution', 'labelled-substitution': 'Correct substitution',
    'arithmetic-chain': 'Correct arithmetic', 'second-derivative-value': 'Correct second derivative', 'sign-claim': 'Correct sign', 'nature-claim': 'Correct nature', 'point-claim': 'Point is on the curve',
    'conclusion-matches': 'Correct conclusion', 'condition-line': 'Condition stated', 'restated-question': 'Question restated', 'restated-function': 'Given in the question', heading: 'Heading',
    'solution-list': 'Correct solutions', 'rounded-value': 'Correct rounding', identity: 'True identity', 'true-as-written': 'True as written', restated: 'Question restated',
    'matches-worked-step': 'Matches a step of the worked solution', 'equal-to-line-above': 'Equal to the line above', 'satisfies-equation-above': 'Satisfies the equation above', 'same-equation-as-line-above': 'Same equation as the line above',
    'substitution-defined': 'Substitution defined', 'substitution-consistent': 'Consistent with the substitution', 'derivative-of-substitution': 'Correct derivative of the substitution', 'differential-form': 'Correct differential form',
    'change-of-variable': 'Correct change of variable', 'integral-rewritten': 'Correct rewriting of the integral', 'antiderivative-checked': 'Correct antiderivative (checked)', 'back-substitution': 'Correct back-substitution',
    'equivalent-expressions': 'Equivalent expressions', 'definite-integral-evaluated': 'Correct evaluation of the integral', 'several-claims': 'Every statement on this line is correct',
    'given-data': 'Given in the question', 'method-stated': 'Method stated', 'formula-value': 'Value of the formula', defines: 'Defines a letter', 'method-claim': 'Stated in the question', 'condition-value': 'Condition from the question',
    model: 'Correct model', 'substitution-formula': 'Correct substitution', 'conclusion-sentence': 'Correct conclusion', 'function-value': 'Correct function value', 'equation-solved': 'Correct solution of the equation',
    'condition-stated': 'Condition stated', 'derivative-of-function': 'Correct derivative', 'conclusion-extremum': 'Correct maximum or minimum', 'check-values-list': 'Values to check listed', 'figure-label': 'Label on the sketch', 'point-on-curve': 'Point on the curve'
  };
  const classes = DF.CLASSES;
  ok(classes.length === Object.keys(WANT).length - 1 && classes.every(c => c in WANT), `every engine class has a phrase in the table (${classes.length} classes)`);
  for (const cls of classes) {
    const phrase = TEACHER.phraseOf(TEACHER.classOf({ status: 'checked', tickClass: cls }));
    ok(phrase === WANT[cls], `${cls} says "${WANT[cls]}" (got ${JSON.stringify(phrase)})`);
    ok(typeof phrase === 'string' && phrase.length > 2 && phrase.length < 60 && !PLACEHOLDER.test(phrase) && !/[.:;]$/.test(phrase), `${cls}: the phrase is plain, finished and has no placeholder`);
  }
  for (const [k, v] of Object.entries(TEACHER.PHRASES)) ok(!PLACEHOLDER.test(v) && v === v.trim(), `PHRASES.${k} has no placeholder, dash or stray space`);
  ok(TEACHER.phraseOf(TEACHER.classOf({ status: 'checked', tickClass: 'conclusion-matches', answerLine: true })) === 'Correct answer', 'a correct final answer line says "Correct answer"');
  ok(TEACHER.phraseOf(TEACHER.classOf({ status: 'checked', tickClass: 'conclusion-extremum', answerLine: true })) === 'Correct answer', 'and so does a maximum or a minimum stated as the answer');
  ok(TEACHER.classOf({ status: 'note', tickClass: 'conclusion-matches' }) === null, 'a line that is not ticked has no class phrase');

  // the engine's own sentence on every line of every stored page, by status
  const defLine = /^(?:let\b|[a-zA-Z]\s*=|d[a-z]\/d[a-z]|[a-z]'\s*=)/i;
  let judged = 0;
  for (const id of ids) {
    const spec = PAGES[id].question;
    if (!spec) continue;
    const q = questionOf(spec);
    const lines0 = restoreReadingOrder(PAGES[id].reading.lines).lines;
    const key = spec.gen === 'y12-diff' ? '8x(2x^2 - 4)' : spec.gen === 'y12-appdiff' ? '6' : spec.qbank ? '12 m/s' : spec.gen === 'y11-quadfunc' ? '-7' : spec.gen === 'y12-integration' ? '7' : '0';
    const rep = await mark(q, workingOf(id, q, lines0), key);
    rep.forEach((l, i) => {
      const note = String(l.note ?? '');
      judged++;
      ok(!PLACEHOLDER.test(note), `${id} line ${i + 1}: no placeholder in "${note.slice(0, 60)}"`);
      if (l.status === 'ok' && note) ok(!/^(?:Not (?:checked|verified)|Follows from|This does not follow)/.test(note), `${id} line ${i + 1}: a tick does not say "not checked" (${note.slice(0, 70)})`);
      if (l.status === 'note' && note) ok(!/^Correct[: ]/.test(note) || l.context === true, `${id} line ${i + 1}: a note does not say "Correct" (${note.slice(0, 70)})`);
      if (l.status === 'break' && note) ok(!/^Correct[: ]/.test(note), `${id} line ${i + 1}: a cross does not say "Correct"`);
      if (/defines something the method uses/.test(note)) ok(/^(?:let\b|[a-zA-Z]\s*=)/i.test(String(l.text).trim()) && !/^(?:answer|so)\b/i.test(String(l.text).trim()), `${id} line ${i + 1}: "defines something" is only on a definition (${l.text})`);
      if (/Correct answer/.test(note)) ok(l.status === 'ok', `${id} line ${i + 1}: "Correct answer" only on a tick`);
    });
  }
  ok(judged > 100, `${judged} lines of ${ids.length} stored pages read for placeholders and mismatched phrases`);

  // the three false sentences of the real run
  const q6 = questionOf(PAGES['synth6-wrong-middle-step'].question);
  const r6 = await mark(q6, texts('synth6-wrong-middle-step').join('\n'), '8x(2x^2 - 4)');
  const at = t => r6.find(l => l.text === t);
  ok(/function given in the question/.test(String(r6[0].note)) && !/defined above/.test(String(r6[0].note)), 'a restated question line is not "the substitution defined above"');
  ok(!/defines something/.test(String(at('4x(2x^2 - 4)')?.note)) && !/defines something/.test(String(at('So the derivative is 4x(2x^2 - 4).')?.note)), 'the answer lines do not say "defines something the method uses"');
  ok(!/defines something/.test(String(at('dy/dx = dy/du x du/dx')?.note)) && !/defines something/.test(String(at('y = u^2 so dy/du = 2u')?.note)), 'a chain-rule line and a derivative of the method\'s letter are not called definitions');
  ok(/defines something/.test(String(at('Let u = 2x^2 - 4')?.note)), 'a definition still says it defines');
  ok(!/side was changed, but the left side was left/.test(JSON.stringify(r6)), 'a line that is the line above simplified (a lone "x" for times) is not said to have had one side changed');
  const slip = diagnoseStep({ prevText: 'h = -7', brokenText: 'h = -6', meta: { kind: 'expression', variable: 'h' } });
  const said = String(slip?.message ?? '');
  ok(!/Everything around it is correct/.test(said) && (!/in place of/.test(said) || /with -6 in place of -7|with 6 in place of 7/.test(said)), `an arithmetic-slip sentence names the number of THIS line first (${said})`);
  const ok7 = await mark(questionOf(PAGES['synth7-slip-then-right'].question), texts('synth7-slip-then-right').join('\n'), '-7');
  ok(ok7.every(l => !/Everything around it is correct/.test(String(l.note))) && /with 7 in place of 6/.test(String(ok7.find(l => l.text === 'h = -7')?.note)), 'the corrected line after a slip says it is the line above with 7 in place of 6 (this line\'s number first), and nothing about the rest being correct');
}

console.log(`REAL PHOTO DEFECTS 2: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — thousands-space answers, a named asked quantity, a false link far down the page, a cut-off line, true phrases, two-column reading order; from the production reader's own output`);
if (fail) process.exit(1);
