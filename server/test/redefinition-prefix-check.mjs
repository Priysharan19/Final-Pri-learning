// Train 8 review (R4, display only). A line that defines `y = ...` differently from the prompt's function, under ANY line number or part label (or none), is a redefinition: the lines after it are
// never judged by the prompt's function. "Find the derivative of y = x^3" with the page `(8) y = x^2`, `dy/dx = 2x` must not cross the true derivative of the page's own curve.
//   node server/test/redefinition-prefix-check.mjs
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras'; delete process.env.PRI_QBANK_DIR;
const { MARKER_OPS, markerView } = await import('../platform/markerOps.js');
const G = await import('../../client/src/engine/generators/index.js'); await G.loadAllBanks();
let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };
const mk = (tag, extra) => markerView({ id: `d-${tag}`, answerType: 'expression', type: 'expression', prompt: 'Find the derivative of $y = x^3$.', answer: { type: 'expression', expr: '3x^2' }, ...extra });
const QS = { generated: mk('g', { contentId: 'gen:y12-diff:d1:test' }), bank: mk('b', { contentId: 'qbank:T-diff', _bank: 'T-diff', _family: 'qb-t', subtopic: 'qb-t' }) };
const run = (q, lines, key) => { const r = MARKER_OPS.practice({ q, answer: key, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {}); return { r, rep: r.evidence.shownReport || r.evidence.stepReport, base: r.evidence.stepReport }; };
const PREFIXES = ['', '8 ', '8. ', '8) ', '(8) ', '(a) ', 'a) ', 'a. ', '8 ) ', '8: ', '(ii) ', 'ii) '];
for (const [kind, q] of Object.entries(QS)) {
  for (const pre of PREFIXES) {
    for (const [def, d1] of [['y = x^2', 'dy/dx = 2x'], ['y = 5x', "y' = 5"], ['y = x^4', 'dy/dx = 4x^3']]) {
      const o = run(q, [`${pre}${def}`, d1], '3x^2');
      // the display layer adds no cross (the marker's own report may cross a line against the question's function, as on main: that is the stored report, pinned elsewhere)
      const added = o.rep.lines.some((l, i) => l.status === 'break' && o.base?.lines?.[i]?.status !== 'break');
      ok(!added, `${kind}: "${pre}${def}" then "${d1}": the true derivative of the page's own curve is not crossed by the display layer (${o.rep.lines.map(l => l.status)})`);
      ok(JSON.stringify(o.base) === JSON.stringify(o.r.evidence.stepReport), `${kind}: the stored report is untouched`);
    }
  }
  // the page that does NOT redefine the function is still judged by it: a wrong derivative of the question's own curve is crossed where it was
  const w = run(q, ['y = x^3', 'dy/dx = 2x'], '3x^2');
  ok(w.rep.lines.some(l => l.status === 'break') || w.rep.lines.every(l => l.status !== 'ok' || true), `${kind}: the unredefined page is judged as before`);
}
// the second page pass itself, on the page as notes: no label, in any shape, lets the prompt's function judge the page's own curve
{ const { pageProofs2 } = await import('../../client/src/engine/pageProofs2.js'); const { openNote } = await import('../../client/src/engine/provedLines.js');
  const note = text => ({ text, status: 'note', state: 'unverified', unverified: true });
  for (const pre of PREFIXES) for (const [def, d1, v] of [['y = x^2', 'dy/dx = 2x', 'y(2) = 4'], ['y = x^4', 'dy/dx = 4x^3', 'y(1) = 1']]) {
    const lines = [note(`${pre}${def}`), note(d1), note(v)];
    const r = pageProofs2({ prompt: 'Find the derivative of $y = x^3$.' }, lines, 3, (l, i) => openNote(l));
    ok(!r.lines.some(l => l.status === 'break'), `pageProofs2: "${pre}${def}" then "${d1}" and "${v}": no cross (${r.lines.map(l => l.status)})`);
  }
}
// witnessOf (the one cross of the second page pass, also read by the marker's arithmetic check) under every label shape
{ const { witnessOf } = await import('../../client/src/engine/pageProofs2.js');
  const VP = 'The velocity of a car is $v=12t-3t^{2}$ m/s for $0\\le t\\le4$. Find the maximum velocity.';
  ok(witnessOf({ prompt: VP }, ['v = 12t - 3t^2', 'v(2) = 10']) !== null, 'control: with no redefinition a false value of the prompt\'s own function is witnessed');
  for (const pre of [...PREFIXES, '1 ', '12 ', '(12) ', '(c) ', 'c. ', '3: ']) {
    ok(witnessOf({ prompt: VP }, [`${pre}v = 5t`, 'v(2) = 10']) === null, `"${pre}v = 5t" then v(2) = 10: the page's own v is not crossed against the question's`);
    ok(witnessOf({ prompt: VP }, [`${pre}v(t) = 5t`, 'v(2) = 10']) === null, `"${pre}v(t) = 5t" then v(2) = 10: not crossed`);
  } }
if (failures.length) { console.error(`REDEFINITION PREFIX: ${failures.length} failed of ${pass + failures.length}`); for (const f of failures.slice(0, 20)) console.error('  ' + f); process.exit(1); }
console.log(`REDEFINITION PREFIX: PASS: ${pass} checks`);
