// Train 8 (R4, display only). The owner's final line is boxed. A final line the reader returns with a box (\boxed{...}, [...], "(boxed)", the value on its own line after
// "Answer:") gets the answer line exactly like the plain one: the display layer reads a box the way the card's final-answer pickup does (photo/finalAnswer.js `unboxed`).
// The box shapes are the reader's real ones (owner-actions/real-photo-e2e-2026-11-26.md: the box dropped from the text, "Answer:" and the boxed value as two lines,
// "[12 m s^-1] (boxed)", TeX \boxed). Nothing about the mark changes, and a boxed WRONG value is never an answer line.
//   node server/test/boxed-answer-line-check.mjs
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras';
const { MARKER_OPS } = await import('../platform/markerOps.js');
const { buildAnnotatedWorking } = await import('../../client/src/components/annotatedWorkingModel.js');
const { buildMarkedPage } = await import('../../client/src/components/markedPageModel.js');
const T = await import('../../client/src/components/markedPageTeacher.js');
const { proposeFinalAnswer } = await import('../../client/src/photo/finalAnswer.js');
let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

const owner = { id: 'int-sub', contentId: 'gen:y12-integration:d3:test', answerType: 'expression', type: 'expression', prompt: 'Find $\\int 12x(x^2+8)^5\\,dx$.', answer: { type: 'expression', expr: '(x^2+8)^6+C' } };
const DEF = 'Let u = x² + 8. Then du/dx = 2x ⇒ du = 2x dx.';
const HEAD = ['Solution:', DEF, 'Hence 12x dx = 6 du. Also, x² + 8 = u, so', '∫ 12x (x² + 8)⁵ dx = ∫ 6u⁵ du.', '∫ 6u⁵ du = 6 · u⁶/6 + C = u⁶ + C.', 'Substituting back u = x² + 8,'];
const FINAL = '∫ 12x (x² + 8)⁵ dx = (x² + 8)⁶ + C.';
const mark = (lines, ans = '(x^2+8)^6+C') => {
  const r = MARKER_OPS.practice({ q: owner, answer: ans, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
  const rep = r.evidence.shownReport || r.evidence.stepReport;
  const page = buildMarkedPage({ model: buildAnnotatedWorking({ lines, stepReport: rep, page: true }) });
  return { r, rep, page, tally: T.tallyOf(page), marks: T.buildTeacherMarks({ page }) };
};
const plain = mark([...HEAD, FINAL]);
ok(plain.rep.answerLine === 6 && /^6 lines correct\. 0 wrong\. 0 not checked\.$/.test(plain.tally), `plain page: answer line 6, ${plain.tally}`);

const SHAPES = [
  ['TeX box round the whole equation', [...HEAD, '\\boxed{∫ 12x (x² + 8)⁵ dx = (x² + 8)⁶ + C}']],
  ['TeX box round the value', [...HEAD, '∫ 12x (x² + 8)⁵ dx = \\boxed{(x² + 8)⁶ + C}']],
  ['TeX box, no full stop', [...HEAD, '∫ 12x (x² + 8)⁵ dx = \\boxed{(x² + 8)⁶ + C}.']],
  ['bracket box round the value', [...HEAD, '∫ 12x (x² + 8)⁵ dx = [(x² + 8)⁶ + C]']],
  ['bracket box round the whole equation', [...HEAD, '[∫ 12x (x² + 8)⁵ dx = (x² + 8)⁶ + C]']],
  ['"(boxed)" after the line', [...HEAD, '∫ 12x (x² + 8)⁵ dx = (x² + 8)⁶ + C (boxed)']],
  ['"[boxed]" after the value', [...HEAD, '∫ 12x (x² + 8)⁵ dx = (x² + 8)⁶ + C [boxed]']],
  ['box dropped, "Answer:" in front', [...HEAD, 'Answer: (x² + 8)⁶ + C']],
  ['box dropped, the equation only', [...HEAD, '= (x² + 8)⁶ + C']]
];
for (const [name, lines] of SHAPES) {
  const o = mark(lines), last = lines.length - 1;
  ok(o.r.result.correct === true, `${name}: the key is marked correct`);
  ok(o.rep.answerLine === last, `${name}: the final line is the answer line (${o.rep.answerLine})`);
  ok(o.page.lines[last].status === 'checked' && o.page.lines[last].card.tickClass !== undefined, `${name}: the final line is ticked (${o.page.lines[last].status})`);
  ok(o.marks.find(m => m.n === last + 1)?.phrase === 'Correct answer', `${name}: the final line says Correct answer (${o.marks.find(m => m.n === last + 1)?.phrase})`);
  ok(o.page.lines.slice(1, last).every(l => l.status === 'checked'), `${name}: the lines above are ticked as on the plain page`);
}
// the reader returns "Answer:" and the boxed value as two lines
for (const [name, value] of [['TeX box', '\\boxed{(x² + 8)⁶ + C}'], ['bracket box', '[(x² + 8)⁶ + C]'], ['no box', '(x² + 8)⁶ + C'], ['"(boxed)"', '(x² + 8)⁶ + C (boxed)']]) {
  const lines = [...HEAD, FINAL, 'Answer:', value], o = mark(lines), last = lines.length - 1;
  ok(o.r.result.correct === true && o.rep.answerLine === last, `two lines, ${name}: the value line is the answer line (${o.rep.answerLine})`);
  ok(o.page.lines[last].status === 'checked', `two lines, ${name}: the value line is ticked (${o.page.lines[last].status})`);
  ok(o.page.lines.every(l => l.status !== 'first-error'), `two lines, ${name}: nothing is crossed`);
}
// the card's pickup and the display layer agree on the same lines
for (const [name, lines] of SHAPES) {
  const p = proposeFinalAnswer(lines, { answerType: 'expression' });
  const o = mark(lines);
  ok(p.status === 'proposed' && p.line === o.rep.answerLine, `${name}: the card proposes line ${p.line} and the page names line ${o.rep.answerLine}`);
}
// a boxed wrong value is never an answer line, never ticked
for (const wrong of ['\\boxed{(x² + 8)⁵ + C}', '[(x² + 8)⁵ + C]', '(x² + 8)⁵ + C (boxed)']) {
  const lines = [...HEAD, `∫ 12x (x² + 8)⁵ dx = ${wrong}`], o = mark(lines, '(x^2+8)^5+C');
  ok(o.rep.answerLine === undefined && o.r.result.correct !== true, `a boxed wrong value (${wrong}) is not the answer line`);
  ok(o.page.lines[lines.length - 1].status !== 'checked', `a boxed wrong value (${wrong}) is not ticked (${o.page.lines[lines.length - 1].status})`);
}
// a boxed line stating another value later is judged exactly like the same plain line
{ const a = mark([...HEAD, FINAL, '∫ 12x (x² + 8)⁵ dx = \\boxed{(x² + 8)⁵ + C}']), b = mark([...HEAD, FINAL, '∫ 12x (x² + 8)⁵ dx = (x² + 8)⁵ + C']);
  ok(a.rep.answerLine === b.rep.answerLine, `a later boxed line with another value is read as the plain one (${a.rep.answerLine} and ${b.rep.answerLine})`);
  ok(a.page.lines[7].status === b.page.lines[7].status, `and ticked or not as the plain one (${a.page.lines[7].status} and ${b.page.lines[7].status})`); }
// the mark is the one it was
for (const [name, lines] of SHAPES) {
  const on = MARKER_OPS.practice({ q: owner, answer: '(x^2+8)^6+C', working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
  const off = MARKER_OPS.practice({ q: owner, answer: '(x^2+8)^6+C', working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true }, opts: { proved: false } }, () => {});
  ok(JSON.stringify(on.result) === JSON.stringify(off.result) && JSON.stringify(on.evidence.stepReport) === JSON.stringify(off.evidence.stepReport), `${name}: the mark and the stored report are unchanged`);
}
if (failures.length) { console.error(`BOXED ANSWER LINE: ${failures.length} failed of ${pass + failures.length}`); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log(`BOXED ANSWER LINE: PASS: ${pass} checks`);
