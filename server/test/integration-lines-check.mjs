// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · integration working, line by line and claim by claim (engine/integrationLines.js; Prithagoras, owner rule 26 Nov 2026)
//
// The owner's page (integration by substitution, 7 lines, "0 lines correct, 0 wrong, 7 not checked") and the classes of line it holds:
//   1. the page as the marker reads it: every maths line ticked with its own class and phrase, the heading neutral, the final line the answer line;
//   2. adversarial pages, one wrong claim at a time (wrong du, wrong factor, wrong power, lost or wrong constant factor, wrong back-substitution,
//      limits changed or not changed, + C variants): a WRONG claim is crossed at its own line and named, a TRUE line is never crossed;
//   3. undecidable is a note: a missing dx or du, no + C, a word that is not a connective, a logarithm without its modulus;
//   4. direct integrals, the reverse chain rule and the standard integrals of the Advanced and Extension 1 courses;
//   5. DISPLAY ONLY: with the pass on or off the mark, the stepReport and every pay field are identical (only `shownReport` moves).
//
//   node server/test/integration-lines-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_QBANK_DIR;
const { readPage, claimTexts, CONNECTIVES, INTEGRATION_CLASSES } = await import('../../client/src/engine/integrationLines.js');
const { classOf, phraseOf } = await import('../../client/src/components/markedPageTeacher.js');
const { MARKER_OPS } = await import('../platform/markerOps.js');
const { buildAnnotatedWorking } = await import('../../client/src/components/annotatedWorkingModel.js');
const { buildMarkedPage } = await import('../../client/src/components/markedPageModel.js');

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
const Q = { prompt: 'Find $\\int 12x(x^2+8)^5\\,dx$.' };
const DEF = 'Let u = x² + 8. Then du/dx = 2x ⇒ du = 2x dx.';
/** verdict letters per line: t tick, x cross, n neutral, . nothing */
const L = { tick: 't', cross: 'x', neutral: 'n', none: '.' };
const run = (lines, q = Q) => readPage(q, lines);
const sig = lines => run(lines).map(o => L[o.verdict]).join('');
const expect = (label, lines, want, q = Q) => { const got = run(lines, q).map(o => L[o.verdict]).join(''); ok(got === want, `${label}: expected ${want}, got ${got}`); };
const crossNames = (lines, part) => { const r = run(lines).find(o => o.verdict === 'cross'); return !!r && String(r.bad.text + ' ' + r.bad.why).includes(part); };

// ── 1. the owner's page, through the marker ──────────────────────────────────
const PAGE = ['Solution:', DEF, 'Hence 12x dx = 6 du. Also, x² + 8 = u, so', '∫ 12x (x² + 8)⁵ dx = ∫ 6u⁵ du.', '∫ 6u⁵ du = 6 · u⁶/6 + C = u⁶ + C.', 'Substituting back u = x² + 8,', '∫ 12x (x² + 8)⁵ dx = (x² + 8)⁶ + C.'];
expect('owner page', PAGE, '.tttttt');
const owner = { id: 'int-sub', contentId: 'gen:y12-integration:d3:test', answerType: 'expression', type: 'expression', prompt: 'Find $\\int 12x(x^2+8)^5\\,dx$.', answer: { type: 'expression', expr: '(x^2+8)^6+C' } };
const mark = (q, answer, lines, opts) => MARKER_OPS.practice({ q, answer, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true }, ...(opts ? { opts } : {}) }, () => {});
const page = (q, answer, lines) => {
  const r = mark(q, answer, lines); const rep = r.evidence.shownReport || r.evidence.stepReport;
  const model = buildAnnotatedWorking({ lines, stepReport: rep, page: true }); const pg = buildMarkedPage({ model });
  return { r, rep, cards: pg.lines.map(l => ({ status: l.status, cls: classOf(l.card), phrase: phraseOf(classOf(l.card)), tick: l.card?.tickClass })) };
};
{
  const p = page(owner, '(x^2+8)^6+C', PAGE);
  ok(p.r.result.correct === true, 'owner page: the key is marked correct');
  ok(p.cards.map(c => c.status).join() === 'condition,checked,checked,checked,checked,checked,checked', `owner page: heading neutral, six ticks (${p.cards.map(c => c.status)})`);
  ok(p.cards.slice(1).every(c => c.phrase), 'owner page: every tick has a phrase');
  ok(p.rep.answerLine === 6, `owner page: the final line is the answer line (${p.rep.answerLine})`);
  ok(p.cards[6].cls === 'conclusion', 'owner page: line 7 reads as the correct answer');
  const want = ['several-claims', 'differential-form', 'change-of-variable', 'antiderivative-checked', 'substitution-consistent', 'back-substitution'];
  ok(JSON.stringify(p.cards.slice(1).map(c => c.tick)) === JSON.stringify(want.map((w, i) => (i === 5 ? 'back-substitution' : w))), `owner page: classes ${p.cards.map(c => c.tick)}`);
  // display only: the same page with the pass off
  const off = mark(owner, '(x^2+8)^6+C', PAGE, { integrationLines: false });
  const on = mark(owner, '(x^2+8)^6+C', PAGE);
  ok(JSON.stringify(on.result) === JSON.stringify(off.result), 'display only: the result is identical with the pass off');
  ok(JSON.stringify(on.evidence.stepReport) === JSON.stringify(off.evidence.stepReport), 'display only: stepReport is identical with the pass off');
  ok(JSON.stringify(on.evidence.partial) === JSON.stringify(off.evidence.partial), 'display only: the partial (method marks) is identical with the pass off');
  const wrong = page(owner, '(x^2+8)^5+C', PAGE.slice(0, 6).concat(['∫ 12x (x² + 8)⁵ dx = (x² + 8)⁶ + C.']));
  ok(wrong.r.result.correct === false && wrong.cards[6].status === 'checked' && wrong.rep.answerLine === undefined, 'a wrong typed answer: the true line stays ticked, no answer line is named');
}

// ── 2. adversarial pages: one wrong claim at a time ──────────────────────────
// wrong du
expect('du = x dx', ['Let u = x² + 8. Then du = x dx.'], 'x');
ok(crossNames(['Let u = x² + 8. Then du = x dx.'], 'du = x dx'), 'wrong du: the cross names the claim du = x dx');
expect('du/dx = x', ['Let u = x² + 8. Then du/dx = x.'], 'x');
expect('du/dx = 3x on a line with a true differential', ['Let u = x² + 8. Then du/dx = 3x ⇒ du = 3x dx.'], 'x');
ok(crossNames(['Let u = x² + 8. Then du/dx = 3x ⇒ du = 3x dx.'], 'du/dx = 3x'), 'the FIRST false claim is the one named');
expect('du/dx = 2x alone after the definition', [DEF, 'du/dx = 2x'], 'tt');
expect('dx = du/(2x)', [DEF, 'dx = du/(2x)'], 'tt');
expect('x dx = du/2', [DEF, 'x dx = du/2'], 'tt');
expect('x dx = du/3', [DEF, 'x dx = du/3'], 'tx');
// wrong factor
expect('12x dx = 6 du', [DEF, '12x dx = 6 du'], 'tt');
expect('12x dx = 12 du', [DEF, '12x dx = 12 du'], 'tx');
expect('12x dx = 3 du', [DEF, '12x dx = 3 du'], 'tx');
expect('12x dx = 6 du, 6 du = 12x dx (both orders)', [DEF, '6 du = 12x dx'], 'tt');
ok(crossNames([DEF, '12x dx = 12 du'], '12x dx = 12 du'), 'wrong factor: the cross names the claim');
// change of variable: lost or wrong constant factor
expect('lost factor', [DEF, '∫ 12x (x² + 8)⁵ dx = ∫ u⁵ du'], 'tx');
expect('wrong factor 12', [DEF, '∫ 12x (x² + 8)⁵ dx = ∫ 12u⁵ du'], 'tx');
expect('factor 3', [DEF, '∫ 12x (x² + 8)⁵ dx = ∫ 3u⁵ du'], 'tx');
expect('wrong power in the change', [DEF, '∫ 12x (x² + 8)⁵ dx = ∫ 6u⁴ du'], 'tx');
expect('correct change', [DEF, '∫ 12x (x² + 8)⁵ dx = ∫ 6u⁵ du'], 'tt');
expect('factor taken outside', [DEF, '∫ 12x (x² + 8)⁵ dx = 6∫ u⁵ du'], 'tt');
expect('factor taken outside, wrong', [DEF, '∫ 12x (x² + 8)⁵ dx = 3∫ u⁵ du'], 'tx');
expect('with a dx kept (mixed)', [DEF, '∫ 12x (x² + 8)⁵ dx = ∫ 12x u⁵ dx'], 'tt');
// antiderivative: wrong power, wrong constant factor, constants
expect('u^6 + C', [DEF, '∫ 6u⁵ du = u⁶ + C'], 'tt');
expect('u^5 + C', [DEF, '∫ 6u⁵ du = u⁵ + C'], 'tx');
expect('6u^6 + C', [DEF, '∫ 6u⁵ du = 6u⁶ + C'], 'tx');
expect('u^6/6 + C', [DEF, '∫ 6u⁵ du = u⁶/6 + C'], 'tx');
expect('chain with an unchanged-but-wrong middle', [DEF, '∫ 6u⁵ du = 6 · u⁶/5 + C = u⁶ + C'], 'tx');
expect('+ c', [DEF, '∫ 6u⁵ du = u⁶ + c'], 'tt');
expect('+ K', [DEF, '∫ 6u⁵ du = u⁶ + K'], 'tt');
expect('+ C1', [DEF, '∫ 6u⁵ du = u⁶ + C₁'], 'tt');
expect('- C', [DEF, '∫ 6u⁵ du = u⁶ - C'], 'tt');
expect('missing + C is a note, not a tick and not a cross', [DEF, '∫ 6u⁵ du = u⁶'], 't.');
expect('a number for + C is not a constant of integration', [DEF, '∫ 6u⁵ du = u⁶ + 5'], 't.');
expect('wrong power and no C is still a note', [DEF, '∫ 6u⁵ du = u⁵'], 't.');
// back-substitution
expect('final line true', [DEF, '∫ 12x (x² + 8)⁵ dx = (x² + 8)⁶ + C'], 'tt');
expect('wrong back-substitution (x²+9)', [DEF, '∫ 12x (x² + 8)⁵ dx = (x² + 9)⁶ + C'], 'tx');
expect('wrong back-substitution (u dropped, x^2 only)', [DEF, '∫ 12x (x² + 8)⁵ dx = (x²)⁶ + C'], 'tx');
expect('wrong back-substitution (power)', [DEF, '∫ 12x (x² + 8)⁵ dx = (x² + 8)⁵ + C'], 'tx');
expect('restated substitution, same', [DEF, 'Substituting back u = x² + 8,'], 'tt');
expect('restated substitution, different', [DEF, 'Substituting back u = x² + 9,'], 'tx');
expect('restated reversed', [DEF, 'x² + 8 = u'], 'tt');
expect('restated reversed, different', [DEF, 'x² + 9 = u'], 'tx');
expect('answer left in u is a true line', [DEF, '∫ 12x (x² + 8)⁵ dx = u⁶ + C'], 'tt');
expect('equivalent form of the answer', [DEF, '∫ 12x (x² + 8)⁵ dx = (8 + x²)⁶ + C'], 'tt');
expect('chain u^6 + C = (x^2+8)^6 + C', [DEF, '∫ 6u⁵ du = u⁶ + C = (x² + 8)⁶ + C'], 'tt');
expect('chain with a wrong back-substitution', [DEF, '∫ 6u⁵ du = u⁶ + C = (x² + 9)⁶ + C'], 'tx');
expect('continuation line', [DEF, '∫ 6u⁵ du', '= u⁶ + C'], 'ttt');
expect('continuation line, wrong', [DEF, '∫ 6u⁵ du', '= u⁵ + C'], 'ttx');
// a different valid substitution
const DEF2 = 'Let u = x². Then du = 2x dx.';
expect('u = x² defined', [DEF2], 'n.'.slice(0, 0) + (sig([DEF2]) === 't' ? 't' : sig([DEF2])));
expect('u = x²: du', [DEF2, '12x dx = 6 du'], 'tt');
expect('u = x²: change of variable', [DEF2, '12x dx = 6 du', '∫ 12x (x² + 8)⁵ dx = ∫ 6(u + 8)⁵ du'], 'ttt');
expect('u = x²: antiderivative', [DEF2, '∫ 6(u + 8)⁵ du = (u + 8)⁶ + C'], 'tt');
expect('u = x²: wrong antiderivative', [DEF2, '∫ 6(u + 8)⁵ du = (u + 8)⁵ + C'], 'tx');
expect('u = x²: the old integrand with the wrong shift', [DEF2, '∫ 12x (x² + 8)⁵ dx = ∫ 6(u + 9)⁵ du'], 'tx');
expect('u = x²: back-substitution', [DEF2, '∫ 6(u + 8)⁵ du = (u + 8)⁶ + C = (x² + 8)⁶ + C'], 'tt');
// definite integrals: limits changed correctly and not
expect('limits changed', [DEF, '∫_0^1 12x (x² + 8)⁵ dx = ∫_8^9 6u⁵ du'], 'tt');
expect('limits with braces', [DEF, '∫_{0}^{1} 12x (x² + 8)⁵ dx = ∫_{8}^{9} 6u⁵ du'], 'tt');
expect('limits NOT changed', [DEF, '∫_0^1 12x (x² + 8)⁵ dx = ∫_0^1 6u⁵ du'], 'tx');
ok(crossNames([DEF, '∫_0^1 12x (x² + 8)⁵ dx = ∫_0^1 6u⁵ du'], 'limits'), 'limits not changed: the sentence says so');
expect('limits changed wrongly', [DEF, '∫_0^1 12x (x² + 8)⁵ dx = ∫_8^10 6u⁵ du'], 'tx');
expect('bracket: antiderivative', [DEF, '∫_8^9 6u⁵ du = [u⁶]_8^9'], 'tt');
expect('bracket: wrong antiderivative', [DEF, '∫_8^9 6u⁵ du = [u⁵]_8^9'], 'tx');
expect('bracket value', [DEF, '[u⁶]_8^9 = 9⁶ - 8⁶ = 269297'], 'tt');
expect('bracket wrong value', [DEF, '[u⁶]_8^9 = 9⁶ - 8⁶ = 269298'], 'tx');
expect('bracket wrong limits in the value', [DEF, '[u⁶]_8^9 = 9⁶ - 7⁶ = 413192'], 'tx');
expect('definite value', [DEF, '∫_8^9 6u⁵ du = 269297'], 'tt');

// a function with a bare argument next to another factor has no one reading: not read, never crossed (the harness found du = 3cos3x dx)
expect('u = sin 3x, du = 3cos3x dx (never read as cos(3)·x·dx)', ['Let u = sin 3x. Then du/dx = 3cos 3x.', 'du = 3cos3x dx'], 'tt');
expect('u = cos 2x, du=-2sin2x dx', ['Let u = cos 2x.', 'du=-2sin2x dx'], 'nt');
expect('cos(3x) with its brackets is read', ['Let u = sin(3x).', 'du = 3cos(3x) dx'], 'nt');
expect('bare argument and a further factor', [DEF, 'du = 2sin2x(x + 1) dx'], 't.');
expect('wrong with a bracketed argument is still crossed', ['Let u = sin(3x).', 'du = 3sin(3x) dx'], '.x');

// ── 3. undecidable is a note ─────────────────────────────────────────────────
expect('missing dx', [DEF, '12x = 6 du'], 't.');
expect('missing du', [DEF, '12x dx = 6'], 't.');
expect('du = 2x without dx', [DEF, 'du = 2x'], 't.');
expect('integral with no dx', [DEF, '∫ 12x (x² + 8)⁵ = ∫ 6u⁵ du'], 't.');
expect('integral with no du', [DEF, '∫ 12x (x² + 8)⁵ dx = ∫ 6u⁵'], 't.');
expect('a word that is not a connective', [DEF, 'Obviously du = 2x dx'], 't.');
expect('a word after a true claim', [DEF, 'du = 2x dx, which is neat'], 't.');
expect('a connective is ignored', [DEF, 'Hence, du = 2x dx'], 'tt');
expect('so ... then ... and', [DEF, 'So du = 2x dx and then 12x dx = 6 du'], 'tt');
expect('a true and an unreadable claim on one line', [DEF, 'du = 2x dx ; y = f(x)'], 't.');
expect('an undefined letter', [DEF, '∫ 6w⁵ dw = w⁶ + C'], 't.');
expect('a log with no modulus is not ticked', [DEF, '∫ 1/x dx = ln x + C'], 't.');
expect('a log with its modulus', [DEF, '∫ 1/x dx = ln|x| + C'], 'tt');
expect('a log that is always positive needs none', [DEF, '∫ 2x/(x² + 1) dx = ln(x² + 1) + C'], 'tt');
expect('a division then a juxtaposed factor is not read (a/bc)', [DEF, 'dx = du/2x'], 't.');
expect('log with no base is not read', ['∫ 1/x dx = log|x| + C'], '.');
expect('a wrong log', [DEF, '∫ 1/x dx = 1/x² + C'], 'tx');
expect('a line that is not integration', ['x² - 5x + 6 = 0', '(x - 2)(x - 3) = 0'], '..');
expect('a bare definition that is never used stays a note', ['Let u = x² + 8.'], '.');
expect('a definition that later lines use is neutral', ['Let u = x² + 8.', 'du = 2x dx', '12x dx = 6 du'], 'ntt');
expect('a line after a cross is left alone', [DEF, 'du = x dx', 'du = 2x dx'], 'tx.');
expect('a part label resets the substitution', [DEF, '(b) Let u = 3x + 1. Then du = 3 dx.'], 'tt');
expect('two letters', ['Let u = 3x + 1 and v = x². Then du = 3 dx, dv = 2x dx.'], 't');

// ── 4. direct integrals, the reverse chain rule, standard integrals ─────────
const DQ = { prompt: 'Find $\\int 4x^3\\,dx$.' };
const direct = (label, lines, want) => expect(label, lines, want, DQ);
direct('power', ['∫ 4x³ dx = x⁴ + C'], 't');
direct('power, wrong', ['∫ 4x³ dx = 12x² + C'], 'x');
direct('power, no C', ['∫ 4x³ dx = x⁴'], '.');
direct('restated then continuation', ['∫ 4x³ dx', '= x⁴ + C'], 'tt');
direct('continuation, wrong', ['∫ 4x³ dx', '= x³ + C'], 'tx');
direct('an equation of expressions is never crossed as an identity', ['(2x + 1)ln3 = xln5', '3x + 2 = 11', 'x² - 5x + 6 = 0'], '...');
direct('sum of powers', ['∫ (3x² + 2x - 5) dx = x³ + x² - 5x + C'], 't');
direct('sum, lost a term', ['∫ (3x² + 2x - 5) dx = x³ + x² + C'], 'x');
direct('e^x', ['∫ e^x dx = e^x + C'], 't');
direct('e^(2x)', ['∫ e^(2x) dx = (1/2) e^(2x) + C', '∫ e^(2x) dx = e^(2x)/2 + C'], 'tt');
direct('e^(2x), wrong', ['∫ e^(2x) dx = 2e^(2x) + C'], 'x');
direct('e^(-x)', ['∫ e^(-x) dx = -e^(-x) + C'], 't');
direct('1/x', ['∫ 1/x dx = ln|x| + C'], 't');
direct('1/x, no modulus', ['∫ 1/x dx = ln x + C'], '.');
direct('1/(2x+1)', ['∫ 1/(2x + 1) dx = (1/2) ln|2x + 1| + C'], 't');
direct('1/(2x+1), missing 1/2', ['∫ 1/(2x + 1) dx = ln|2x + 1| + C'], 'x');
direct('cos', ['∫ cos x dx = sin x + C', '∫ sin x dx = -cos x + C'], 'tt');
direct('sin, sign slip', ['∫ sin x dx = cos x + C'], 'x');
direct('cos 3x', ['∫ cos 3x dx = (1/3) sin 3x + C', '∫ cos(3x) dx = sin(3x)/3 + C'], 'tt');
direct('cos 3x, wrong', ['∫ cos(3x) dx = 3 sin(3x) + C'], 'x');
direct('sec^2', ['∫ sec²x dx = tan x + C', '∫ sec²(2x) dx = (1/2) tan(2x) + C'], 'tt');
direct('reverse chain rule', ['∫ 6x(x² + 1)³ dx = (3/4)(x² + 1)⁴ + C'], 't');
direct('reverse chain rule, wrong', ['∫ 6x(x² + 1)³ dx = (x² + 1)⁴ + C'], 'x');
direct('f\'/f', ['∫ 2x/(x² + 1) dx = ln(x² + 1) + C'], 't');
direct('(ax+b)^n', ['∫ (3x + 1)⁴ dx = (3x + 1)⁵/15 + C'], 't');
direct('(ax+b)^n, wrong', ['∫ (3x + 1)⁴ dx = (3x + 1)⁵/5 + C'], 'x');
direct('sqrt', ['∫ √x dx = (2/3)x^(3/2) + C'], 't');
direct('definite bracket chain', ['∫_0^2 4x³ dx = [x⁴]_0^2 = 2⁴ - 0⁴ = 16'], 't');
direct('definite chain, wrong value', ['∫_0^2 4x³ dx = [x⁴]_0^2 = 2⁴ - 0⁴ = 18'], 'x');
direct('a typed parameter is not guessed', ['∫ kx dx = kx²/2 + C'], '.');
direct('letters that are not the page\'s are not guessed', ['∫ 4t³ dt = t⁴ + C'], '.');

// ── 5. claims, connectives, classes ──────────────────────────────────────────
ok(claimTexts('Let u = x² + 8. Then du/dx = 2x ⇒ du = 2x dx.').map(c => c.text).join('|') === 'u = x² + 8|du/dx = 2x|du = 2x dx', 'a line is split into its three claims');
ok(claimTexts('Hence 12x dx = 6 du. Also, x² + 8 = u, so').map(c => c.text).join('|') === '12x dx = 6 du|x² + 8 = u', 'connective words are dropped (Hence, Also, so)');
ok(claimTexts('Obviously du = 2x dx').some(c => c.words), 'a word that is not on the list is kept and flagged');
ok(claimTexts('x = 0.5, so 2x = 1').length === 2 && claimTexts('x = 0.5').length === 1, 'a decimal point does not split a claim');
ok(CONNECTIVES.every(w => !/obviously|clearly|trivially/.test(w)), 'the connective list is fixed and holds no argument words');
ok(INTEGRATION_CLASSES.every(c => phraseOf(classOf({ status: 'checked', tickClass: c })) || ['substitution-defined'].includes(c) === false), 'every integration class a tick can carry has a phrase');
for (const c of INTEGRATION_CLASSES) ok(!!phraseOf(classOf({ status: 'checked', tickClass: c })), `class ${c} has a phrase`);

// ── 6. a true page is never crossed: every honest variant of the owner's lines ──
const honest = [
  [DEF, '∫ 12x (x² + 8)⁵ dx = ∫ 6u⁵ du', '∫ 6u⁵ du = u⁶ + C', '∫ 12x (x² + 8)⁵ dx = (x² + 8)⁶ + C'],
  ['Put u = x² + 8, so du = 2x dx.', 'Then 6 du = 12x dx.', '∫ 6u⁵ du = 6u⁶/6 + C', '= (x² + 8)⁶ + C'],
  ['Let u = x² + 8', 'du/dx = 2x', 'du = 2x dx', '12x dx = 6 du', '∫ 6u⁵ du = u⁶ + C', 'u⁶ + C = (x² + 8)⁶ + C'],
  ['Let u = x^2 + 8.', 'Then du = 2x dx, so 12x dx = 6 du.', '∫ 12x(x^2 + 8)^5 dx = 6∫ u^5 du = 6(u^6/6) + C = (x^2 + 8)^6 + C']
];
honest.forEach((p, i) => { const s = sig(p); ok(!s.includes('x'), `honest page ${i + 1} is never crossed (${s})`); });
console.log(`INTEGRATION LINES: ${failures.length ? 'FAIL' : 'PASS'}: ${pass + failures.length - failures.length} checks`);
if (failures.length) { console.log(failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
