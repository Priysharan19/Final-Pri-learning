// Coverage pass (R4, display only): the third page pass (client/src/engine/pageProofs3.js). Each prover ticks the true forms, and for every true form at least five false near-misses
// (one digit, sign, exponent, wrong law, wrong angle, wrong n, swapped roles) are never ticked, and at least five true variants are never crossed by the marker.
// The pass never crosses; it never runs for an India question; a line it cannot prove stays a note.
//   node server/test/page-proofs3-check.mjs
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras'; delete process.env.PRI_QBANK_DIR;
const { pageProofs3 } = await import('../../client/src/engine/pageProofs3.js');
const { openNote } = await import('../../client/src/engine/provedLines.js');
const { MARKER_OPS, markerView } = await import('../platform/markerOps.js');
let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };
const note = text => ({ text, status: 'note', state: 'unverified', unverified: true });
const bank = (prompt, id = 'A11-T1-900') => ({ prompt, _bank: id });
const ticks = (q, texts) => { const lines = texts.map(note); const r = pageProofs3(q, lines, lines.length, (l, i) => openNote(l)); return r.lines.map((l, i) => (l.status === 'ok' ? l.tickClass : null)); };
const only = (q, t) => ticks(q, [t])[0];
const allTicked = (q, ts, why) => { for (const t of ts) ok(only(q, t) !== null, `${why}: "${t}" is ticked`); };
const noneTicked = (q, ts, why) => { for (const t of ts) ok(only(q, t) === null, `${why}: "${t}" is NOT ticked`); };

// 1. exact-value chains
{
  const q = bank('Find the exact value of $\\sin150^\\circ$.');
  allTicked(q, ['cos(225°)=-((sqrt(2))/2)', 'tan(300°)=-sqrt(3)', 'sin(135°)=((sqrt(2))/2)', '4!=24', '(6C3)=20', 'tan(60°)=sqrt(3)', 'd=90000+40000-2(300)(200)cos(120°)=190000', 'cos(pi/3)=(1/2)', 'ln(e^2)=2', 'arctan(sqrt(3))=60°', '(log(8)/log(2))=3'], 'exact true');
  noneTicked(q, ['d^(2)=90000+40000-2(300)(200)cos(120°)=190000', 'cos(225°)=((sqrt(2))/2)', 'tan(300°)=sqrt(3)', 'sin(135°)=((sqrt(3))/2)', '4!=25', '5!=24', '(6C3)=21', '(6C2)=20', 'cos(226°)=-((sqrt(2))/2)', 'cos(225°)=-((sqrt(3))/2)', 'd=90000+40000-2(300)(200)cos(120°)=190001', 'd=90000+40000-2(300)(200)cos(121°)=190000', 'ln(e^2)=3', 'ln(x)=2', 'sin(30)=0.5', 'sin(135°)=0.7071', 'sin(135°)=((sqrt(2))/2),((sqrt(2))/2)', 'sin(135°)<=((sqrt(2))/2)', 'tan(pi/2)=1', 'x=x'], 'exact false/unsafe');
  // continuation
  const t = ticks(q, ['(6C3)', '=20']); ok(t[1] === 'exact-value', 'a continuation of the value above is ticked');
  const f = ticks(q, ['(6C3)', '=21']); ok(f[1] === null, 'a continuation of another value is not ticked');
  // a log is read only when true in both bases
  noneTicked(q, ['log(100)=2', 'log(100)=4.6051701859880914'], 'log base is not guessed');
}

// 2. a triangle
{
  const q = bank('In triangle $ABC$, $A=40^\\circ$, $B=75^\\circ$ and $a=10$. Find $b$, to one decimal place.');
  allTicked(q, ['b=((10sin(75°))/(sin(40°)))', '((10sin(75°))/(sin(40°)))', 'b/sin(75°)=10/sin(40°)', '((b)/(sin(75°)))=(10/(sin(40°)))', 'b=((10sin(75°))/(sin(40°)))'], 'triangle true');
  noneTicked(q, ['b=((10sin(75°))/(sin(41°)))', 'b=((10sin(74°))/(sin(40°)))', 'b=((11sin(75°))/(sin(40°)))', 'b=((10sin(40°))/(sin(75°)))', 'b=((10cos(75°))/(sin(40°)))', 'b=((10sin(75°))/(cos(40°)))', 'b=((10sin(75°))/(sin(40°)))+1', 'b=2((10sin(75°))/(sin(40°)))', 'b=15'], 'triangle false');
  const s = bank('Find the area of a triangle with sides $8$ and $11$ and included angle $65^\\circ$, to one decimal place.');
  allTicked(s, ['(1/2)*(8)(11)sin(65°)', 'A=(1/2)*(8)(11)sin(65°)', '(1/2)*(11)(8)sin(65°)', '44sin(65°)', 'x=44sin(65°)'], 'area true');
  noneTicked(s, ['(1/2)*(8)(11)sin(64°)', '(1/2)*(8)(12)sin(65°)', '(1/2)*(8)(11)cos(65°)', '(1/2)*(8)(11)sin(25°)', '(8)(11)sin(65°)', '(1/2)*(8)(11)sin(65°)+1', '(1/2)*(8)(1)sin(65°)'], 'area false');
  const c = bank('Find the third side of a triangle with sides $5$ and $8$ and included angle $72^\\circ$, to two decimal places.');
  allTicked(c, ['c^(2)=25+64-80cos(72°)', '25+64-80cos(72°)', 'sqrt(25+64-80cos(72°))', 'c=sqrt(25+64-80cos(72°))', 'd^(2)=64+25-80cos(72°)'], 'cosine rule true');
  noneTicked(c, ['c^(2)=25+64-80cos(73°)', 'c^(2)=25+64+80cos(72°)', 'c^(2)=25+64-80sin(72°)', 'c^(2)=25+64-40cos(72°)', 'c^(2)=25-64-80cos(72°)', 'c^(2)=24+64-80cos(72°)', 'c=25+64-80cos(72°)=sqrt(25+64-80cos(72°))'], 'cosine rule false');
  // a multi-part or unnamed prompt is not read
  const m = bank('Find the area and the third side of a triangle with sides $8$ and $11$ and included angle $65^\\circ$.');
  noneTicked(m, ['(1/2)*(8)(11)sin(65°)'], 'both asked: not read');
}

// 3. a binomial expansion
{
  const q = bank('Find the coefficient of $x^{3}$ in $(2-x)^{7}$.', 'X11-A1-900');
  allTicked(q, ['(7C3)*2^(4)*(-1)^(3)', '(7C3)*2^(4)*(-1)^(3)=-560', '-560x^(3)=(7C3)*2^(4)*(-1)^(3)x^(3)', '(7C4)*2^(4)*(-1)^(3)'], 'binomial true');
  noneTicked(q, ['(7C3)*2^(4)*(-1)^(2)', '(7C3)*2^(3)*(-1)^(3)', '(7C4)*2^(3)*(-1)^(4)', '(7C3)*2^(4)*(1)^(3)', '(7C2)*2^(4)*(-1)^(3)', '(7C3)*2^(5)*(-1)^(3)', '-559', '(7C3)*2^(4)*(-1)^(3)x^(2)'], 'binomial false');
  const k = bank('Find the term independent of $x$ in $\\left(x^{2}-\\dfrac1x\\right)^{9}$.', 'X11-A1-901');
  allTicked(k, ['(9C6)*(-1)^(6)', '(9C3)*(-1)^(6)=84'], 'constant term true');
  noneTicked(k, ['(9C6)*(-1)^(5)', '(9C5)*(-1)^(6)', '(9C6)*(1)^(6)=85', '(9C6)*2^(6)', '(9C7)*(-1)^(6)'], 'constant term false');
  noneTicked(bank('Find the coefficient of $x^{3}$ in $(1+x)^{4}(2-x)^{7}$.', 'X11-A1-902'), ['(7C3)*2^(4)*(-1)^(3)'], 'two expansions: not read');
}

// 4. the integral of the question
{
  const q = bank('Evaluate $\\displaystyle\\int_0^{\\sqrt3}\\frac{dx}{1+x^{2}}$.', 'X12-C2-900');
  allTicked(q, ['arctan(sqrt(3))-0', 'arctan(x)', '[arctan(x)]_{0}^{sqrt(3)}', '[arctan(x)]_{0}^{sqrt(3)}=arctan(sqrt(3))-arctan(0)=((π)/3)', 'arctan(x)+C', '((π)/3)-0'], 'integral true');
  noneTicked(q, ['arctan(sqrt(2))-0', 'arctan(2x)', '[arctan(x)]_{0}^{2}', '[arctan(x)]_{1}^{sqrt(3)}', '[arctan(2x)]_{0}^{sqrt(3)}', '[arcsin(x)]_{0}^{sqrt(3)}', '[arctan(x)]_{0}^{sqrt(3)}=((π)/4)', 'arctan(x)+x', '2arctan(x)', 'x^2'], 'integral false');
  const p = bank('Evaluate $\\displaystyle\\int_0^{3}\\frac{dx}{9+x^{2}}$.', 'X12-C2-901');
  allTicked(p, ['(1/3)*arctan(((x)/3))', '[(1/3)*arctan(((x)/3))]_{0}^{3}', '(1/3)*arctan(1)-0'], 'integral 2 true');
  noneTicked(p, ['(1/3)*arctan(x)', '(1/2)*arctan(((x)/3))', '(1/3)*arctan(((x)/9))', '(1/3)*arctan(2)-0', '[(1/3)*arctan(((x)/3))]_{0}^{2}'], 'integral 2 false');
}

// 5. equations: the same, or satisfied
{
  const q = bank('Solve $y^{\\prime}=0$ for the curve.', 'A12-C2-900');
  const pair = (a, b) => ticks(q, [a, b])[1];
  for (const [a, b] of [["y'=1-2cos x=0", 'cos x=(1/2)'], ['14-9.8t=0', 't=(10/7)'], ['2x+4=0', 'x=-2'], ['3x-9=0', 'x=3'], ['e^(x)-7=0', 'x=ln(7)']]) ok(pair(a, b) === 'same-equation-as-line-above', `equation: "${a}" then "${b}" is ticked`);
  for (const [a, b] of [["y'=1-2cos x=0", 'cos x=(1/3)'], ['6^(x)=393', 'x*ln(6)=ln(392)'], ['14-9.8t=0', 't=(11/7)'], ['2x+4=0', 'x=2'], ['sin x(2sin x-1)=0', 'sin x=1'], ['sin x(2sin x-1)=0', 'sin x=0'], ['x^(2)-4=0', 'x=3'], ['x^(2)-4=0', 'x=2'], ['(u-2)(u-4)=0', '(u-4)(u-4)=0'], ['(e^(x)-1)(e^(x)-2)=0', '(2^(x)-1)(e^(x)-2)=0'], ['sin x((1/(cos x))-2)=0', 'cos x=1'], ['2x+4=0', 'x=-2,5']]) ok(pair(a, b) === null, `equation: "${a}" then "${b}" is NOT ticked`);
}

// 6. a list of solutions inside the question's interval
{
  const q = bank('Solve $\\cos\\dfrac x2=0$ for $0\\le x\\le4\\pi$.', 'A12-T3-900');
  const pair = (a, b) => ticks(q, [a, b])[1];
  ok(pair('cos(((x)/(2)))=0', '((x)/(2))=((pi)/(2)),((3pi)/(2))') === 'solutions-in-interval', 'every solution in the interval, listed');
  for (const b of ['((x)/(2))=((pi)/(2))', '((x)/(2))=((pi)/(2)),((3pi)/(2)),((5pi)/(2))', '((x)/(2))=((pi)/(2)),((3pi)/(3))', '((x)/(2))=((pi)/(2)),((pi)/(4))', '((x)/(2))=((3pi)/(2)),((3pi)/(2)),((pi)/(2)),pi']) ok(pair('cos(((x)/(2)))=0', b) !== 'solutions-in-interval', `list "${b}" is not "every solution"`);
  ok(ticks(bank('Solve $\\cos\\dfrac x2=0$.', 'A12-T3-901'), ['cos(((x)/(2)))=0', '((x)/(2))=((pi)/(2)),((3pi)/(2))'])[1] === null, 'no interval in the question: not ticked');
}

// 7. never crossed; never India; display-only
{
  const AU = markerView({ id: 'x', answerType: 'numeric', type: 'numeric', prompt: 'Find the exact value of $\\sin150^\\circ+\\cos225^\\circ\\tan300^\\circ$.', answer: { type: 'numeric', value: 1.7247 }, contentId: 'qbank:A11-T2-900', _bank: 'A11-T2-900', _family: 'qb-a11', subtopic: 'qb-a11' });
  for (const lines of [['cos(225°)=-((sqrt(2))/2)', 'tan(300°)=-sqrt(3)', 'tan(60°)=sqrt(3)'], ['sin(135°)=((sqrt(2))/2)', '4!=24', '(6C3)=20', 'cos(225°)=((sqrt(2))/2)']]) {
    const r = MARKER_OPS.practice({ q: AU, answer: '1.7247', working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
    const shown = r.evidence?.shownReport?.lines || [], stored = r.evidence?.stepReport?.lines || [];
    ok(stored.every(l => l.tickClass === undefined || !['exact-value', 'binomial-coefficient', 'triangle-value', 'solutions-in-interval'].includes(l.tickClass)), 'the stored report carries no third-pass class');
    ok(!shown.some((l, i) => l.status === 'break' && stored[i]?.status !== 'break'), 'the display layer adds no cross');
  }
  for (const q of [{ prompt: 'Find the exact value.', contentId: 'gen:in-class10-trig:d1:abc' }, { prompt: 'Find the exact value.', _bank: 'IN-J-0001' }, { prompt: 'Find the exact value.' }, { prompt: 'Find the exact value.', contentId: 'gen:y11-trig:d1:a', edition: 'priyabhata', _bank: 'IN-X-1' }]) {
    ok(only(q, 'cos(225°)=-((sqrt(2))/2)') === null && only(q, '4!=24') === null, `not run for ${q.contentId || q._bank || 'an unidentified question'}`);
  }
  ok(only({ prompt: 'x', contentId: 'gen:y11-trig:d1:a' }, '4!=24') === 'exact-value', 'run for an Australian generated form');
}
if (failures.length) { console.error(`PAGE PROOFS 3: ${failures.length} failed of ${pass + failures.length}`); for (const f of failures.slice(0, 40)) console.error('  ' + f); process.exit(1); }
console.log(`PAGE PROOFS 3: PASS: ${pass} checks`);
