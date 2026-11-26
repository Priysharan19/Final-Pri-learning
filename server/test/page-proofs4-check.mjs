// Coverage pass (R4, display only): the fourth page pass (client/src/engine/pageProofs4.js) and the display fields that read it (engine/displayFields.js).
// A value stated with no relation to check is neutral ("A value stated without working"); a value that is the value of the line above carried on is a tick; a line that
// could be a WRONG continuation, a wrong last number or a claim of any kind stays a note. Adversarial cases first (false near-misses must not tick or neutralise; true
// variants must not be crossed), then the same through the real marker.
//   node server/test/page-proofs4-check.mjs
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras'; delete process.env.PRI_QBANK_DIR;
const { pageProofs4, valuesOf, aboveValue } = await import('../../client/src/engine/pageProofs4.js');
const { displayFields } = await import('../../client/src/engine/displayFields.js');
const { openNote } = await import('../../client/src/engine/provedLines.js');
const { classOf, phraseOf } = await import('../../client/src/components/markedPageTeacher.js');
let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

const note = (text, extra = {}) => ({ text, status: 'note', state: 'unverified', unverified: true, ...extra });
const tick = text => ({ text, status: 'ok', state: 'verified' });
const run = (q, lines, limit = lines.length) => pageProofs4(q, lines, limit, (l, i) => openNote(l)).lines;
const kinds = (q, ...texts) => run(q, texts.map(t => note(t))).map(l => (l.status === 'ok' ? `tick:${l.tickClass}` : l.tickClass === 'stated-value' ? 'neutral' : 'note'));
const Q = { answerType: 'numeric', answer: { value: 12 }, prompt: 'Find the value.' };
const QNO = { answerType: 'expression', answer: { expr: 'x+1' }, prompt: 'Simplify.' };

// ── 1. what is read as a value ───────────────────────────────────────────────
const shape = t => { const v = valuesOf(t); return v === null ? null : v.map(x => x.v); };
ok(JSON.stringify(shape('12')) === '[12]' && JSON.stringify(shape('-0.5')) === '[-0.5]', 'a number is a value');
ok(JSON.stringify(shape('4, 3, 5')) === '[4,3,5]', 'a list of numbers is values');
ok(JSON.stringify(shape('45°')) === '[45]' && JSON.stringify(shape('12 cm')) === '[12]' && JSON.stringify(shape('40%')) === '[40]', 'a number with a degree sign or a unit is a value');
ok(JSON.stringify(shape('±2')) === '[2,-2]' && JSON.stringify(shape('170±16')) === '[186,154]', '± states two values');
ok(JSON.stringify(shape('115,170')) === '[115170]', 'a thousands comma is one number');
ok(JSON.stringify(shape('(6C4)')) === '[15]' && JSON.stringify(shape('8!')) === '[40320]', 'a count and a factorial are values');
ok(shape('2*sqrt(2)') !== null && shape('(122/5)') !== null, 'a letter-free expression is a value');
for (const t of ['x', 'x = 3', 'd = 4', '(3, 0)', '(-4, 8)', '[-2,0)', 'x > 3', '3 = 4', '5 > 3', 'the answer is 12', 'sin x', '2x+1', '12 apples', 'P(3)=28', '≈ 0.1641', '1 → 2', '\\boxed{12}']) ok(shape(t) === null, `${t} is not read as a bare value`);
ok(aboveValue('2*sqrt(2)')?.open === true && aboveValue('(122/5)=24.4')?.open === false && aboveValue('x+1') === null, 'the line above: an unworked expression is open, a chain ending on a number is not, a letter is not read');

// ── 2. the pass on a page ────────────────────────────────────────────────────
ok(kinds(Q, '4, 3, 5')[0] === 'neutral', 'a list of numbers is neutral');
ok(kinds(Q, '(6C4) = 15', '20', '12')[1] === 'neutral', 'a number under a worked-out line is neutral');
ok(kinds(Q, '2*sqrt(2)', '2.83')[1] === 'note' && kinds(Q, '2*sqrt(2)', '2.8284')[1] === 'note', 'a rounded decimal under an exact expression is not equal (exact to 1e-12 only): note');
ok(kinds(Q, '(122/5)', '24.4')[1] === 'tick:equal-to-line-above', 'the value of the line above, carried on, is a tick');
ok(kinds(Q, '(122/5)', '24.5')[1] === 'note' && kinds(Q, '(122/5)', '24')[1] === 'note' && kinds(Q, '(122/5)', '24.4000001')[1] === 'note' && kinds(Q, '(122/5)', '-24.4')[1] === 'note', 'a different number under an unworked expression stays a note (every near-miss)');
ok(kinds(Q, '(122/5)', '24.4')[1] === 'tick:equal-to-line-above' && kinds(Q, '3+4', '7')[1] === 'tick:equal-to-line-above' && kinds(Q, '3+4', '8')[1] === 'note' && kinds(Q, '3+4', '6')[1] === 'note', '3+4 then 7 ticks; 8 and 6 stay notes');
ok(kinds(Q, '4!', '4!')[1] === 'note', 'a line that only repeats the line above is not ticked');
ok(kinds(Q, '(122/5)=24.4', '6', '12')[1] === 'neutral', 'a number under a chain already worked out is a new value: neutral');
ok(kinds(Q, '5', '13')[1] === 'note' && kinds(Q, '5', '12')[1] === 'neutral', 'the last single number: not the key stays a note, the key is neutral');
ok(kinds(Q, '13', '5')[0] === 'neutral' && kinds(Q, '13', '5')[1] === 'note', 'only the LAST number is held to the key; one in the middle is neutral');
ok(kinds({ ...Q, answer: { value: 0.5, tol: 0.06 } }, '(122/5)=24.4', '0.52')[1] === 'neutral' && kinds({ ...Q, answer: { value: 0.5, tol: 0.06 } }, '(122/5)=24.4', '0.6')[1] === 'note', 'the key tolerance is read');
ok(kinds(QNO, '(122/5)=24.4', '13')[1] === 'neutral', 'a question without a numeric key holds no last number to it');
for (const t of ['d = 4', 'x = 3, 4', '(3, 0)', 'x > 3', '3 = 4', '12 apples', '2x + 1']) ok(kinds(Q, t)[0] === 'note', `${t} is left a note`);
// states the marker gave stay
{
  const lines = [note('7', { state: 'incomplete' }), note('8', { candidate: true }), note('9', { slipFollow: true }), note('10', { note: 'Follows from the earlier slip.' }), note('11', { unread: true }), { text: '12', status: 'note', state: 'wrong' }, tick('13'), { text: '14', status: 'break', state: 'wrong' }];
  const out = run(QNO, lines);
  ok(out.every((l, i) => l === lines[i]), 'an incomplete, candidate, slip, unread, wrong, ticked or crossed line is never touched');
}
{
  const lines = [note('4, 3, 5'), { text: 'x = 9', status: 'break', state: 'wrong' }, note('6, 7')];
  const out = run(QNO, lines, 1);
  ok(out[0].tickClass === 'stated-value' && out[2] === lines[2], 'nothing at or after the first cross is touched');
}
ok(run(QNO, [note('4, 3, 5')]).every(l => l.status !== 'break'), 'the pass never crosses');
{
  const r = run(QNO, [note('4, 3, 5')])[0];
  ok(r.context === true && r.status === 'note' && !r.fact && r.tickClass === 'stated-value' && r.state === 'unverified', 'a stated value is neutral context: a note, not a tick, with no proof field');
  ok(phraseOf(classOf({ ...r, tickClass: 'stated-value' })) !== undefined, 'the class has a phrase');
}

// ── 3. the display fields: the answer line ───────────────────────────────────
const accepting = (...texts) => t => texts.includes(String(t).trim());
const al = (q, lines, correct, accepts) => displayFields(q, { lines }, { correct, accepts });
const stated = text => ({ text, status: 'note', state: 'unverified', unverified: true, context: true, tickClass: 'stated-value' });
const line = text => ({ text, status: 'ok', state: 'verified' });
{
  const r = al(Q, [line('x = 3'), stated('12')], true, accepting('12'));
  ok(r.answerLine === 1 && r.lines[1].status === 'ok' && r.lines[1].tickClass === 'conclusion-matches', 'a value stated alone that the server\'s check accepts is the answer line, ticked as stating the answer');
  const w = al(Q, [line('x = 3'), stated('12')], false, accepting('12'));
  ok(w.answerLine === undefined && (w.lines || [stated('12'), stated('12')])[1].status === 'note', 'a wrong answer names no answer line and the stated line stays neutral');
  const n = al(Q, [line('x = 3'), stated('11')], true, accepting('12'));
  ok(n.answerLine === undefined && n.lines === undefined ? true : (n.answerLine === undefined && n.lines[1].status === 'note'), 'a stated value the check does not accept is not the answer line');
  const later = al(Q, [stated('12'), line('x = 5')], true, accepting('12'));
  ok(later.answerLine === undefined, 'a later line that states another value withdraws the answer line');
  const laterStated = al(Q, [stated('12'), stated('13')], true, accepting('12'));
  ok(laterStated.answerLine === undefined, 'a later stated number that is not the answer withdraws it too');
}
// a value written with a thousands comma, and a function of numbers, are offered to the answer check as values
ok(al(Q, [line('84,375 - 43,200 = 41,175')], true, accepting('41175')).answerLine === 0, 'a thousands comma is one number in a result');
ok(al({ ...Q, answer: { value: 0.5236 } }, [line('arcsin((1/2))')], true, t => Math.abs(Number(t) - 0.5235987755982989) < 1e-6).answerLine === 0, 'a function of a number is offered as its value');
ok(al({ ...Q, answer: { value: 0.5 } }, [line('arcsin((1/2))')], true, t => Math.abs(Number(t) - 0.5) < 1e-6).answerLine === undefined, 'and is not the answer when its value is not accepted');
ok(al({ ...Q, answer: { value: 0.5 } }, [line('sin(30)')], true, t => Math.abs(Number(t) - 0.5) < 1e-3).answerLine === undefined, 'a trig function of a bare number (degrees or radians?) is never read');
ok(al({ ...Q, answer: { value: 0.5 } }, [line('sin(30°)')], true, t => Math.abs(Number(t) - 0.5) < 1e-6).answerLine === 0, 'a trig function whose angle fixes its unit is');
ok(al(Q, [line('1, 2')], true, accepting('12')).answerLine === undefined, 'a list is not a thousands comma');

// ── 4. the coverage tool's reader text (tools/annotation-coverage.mjs): the flat line a handwriting reader returns for a line of TeX, with its TeX alongside ──
{
  const C = await import('../../tools/annotation-coverage.mjs');
  const f = C.readerFlat;
  const eq = (tex, want) => ok(f(tex) === want, `readerFlat(${tex}) = ${want} (got ${f(tex)})`);
  eq('\\dfrac{3}{4}', '3/4'); eq('\\tfrac{\\pi}{3}', 'π/3'); eq('\\frac{x+1}{x-1}', '(x+1)/(x-1)'); eq('90^\\circ', '90°'); eq('x=3\\pm\\sqrt3', 'x=3±√(3)');
  eq('e^{2x}', 'e^(2x)'); eq('x^2', 'x^2'); eq('\\binom{8}{3}', '(8C3)'); eq('2\\binom{7}{2}', '2(7C2)'); eq('\\sin 30^\\circ = \\tfrac12', 'sin 30° = 1/2'); eq('30\\,000', '30000');
  ok(f('\\begin{cases} x \\end{cases}') === null && f('\\overrightarrow{AB}') === null && f('\\unknowncommand x') === null, 'a layout the reader text would only guess at is not read');
  // what the tool does with them: a line the engine's own reading cannot give is flattened and carries its TeX; a line the engine reads keeps its own reading and carries none
  const q = { steps: [{ h: 'a', d: '$\\sin 30^\\circ = \\tfrac12$ and $x = 4$' }] };
  const r = C.authoredLines(q, () => null);
  ok(r.lines.length === 2 && r.unreadable === 0 && r.latex.length === 2 && r.latex[0].text === r.lines[0], 'a flattened line carries its TeX (the pair the marker takes as workingLatex)');
  const r2 = C.authoredLines(q, t => (/circ/.test(t) ? null : 'x=4'));
  ok(r2.lines.length === 2 && r2.latex.length === 1 && r2.flattened === 1, 'only a flattened line carries TeX');
  const r3 = C.authoredLines({ steps: [{ h: 'a', d: '$\\begin{cases} x \\end{cases}$' }] }, () => null);
  ok(r3.unreadable === 1 && r3.lines.length === 0, 'a line that cannot be flattened is still counted as unreadable, never dropped');
}

if (failures.length) { console.error(`PAGE PROOFS 4: FAIL (${failures.length})`); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log(`PAGE PROOFS 4: PASS: ${pass} checks`);
