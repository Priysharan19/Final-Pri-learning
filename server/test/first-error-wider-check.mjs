// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the first provably wrong line, crossed with a specific diagnosis, beyond ordinary polynomials (24 November 2026)
//
// Australian edition, Years 11-12 Advanced + Extension 1. Pages are built by rule in tools/first-error-corpus.mjs from expression trees that
// carry their own evaluator, so truth never comes from the engine under test. Every page goes through the real marking path (stepEvidence).
//
//   1  a TRUE page is never crossed: equivalent forms, reordered terms, an unsimplified last line, fractions, indices, exp, log, trig, numbers
//   2  a SLIP page is crossed at the slipped line (never ticked, only the first wrong line carries a false-continuation diagnosis), and the
//      share crossed WITH a specific diagnosis (error type from the closed list, what changed, corrected line, a check) meets a floor per class
//   3  work that must stay a note stays a note: complex, several parts, partial work, rounding, an equation solved, a restricted rewrite
//   4  the diagnosis is specific and true: it names the term that really differs, never a term that was right; no dash; marks are unchanged
//   5  what a TRUE line did is named: factorised, cancelled, expanded, collected, evaluated
//   6  a trap for a typed value is not shown over working that contradicts it
//
//   node server/test/first-error-wider-check.mjs
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { stepEvidence, lineLevelFeedback } from '../platform/markerOps.js';
import { checkAnswer } from '../../client/src/engine/checker.js';
import * as G from '../../client/src/engine/generators/index.js';
import { ERROR_TYPES, stepHow, stepHowWide } from '../../client/src/engine/falseStep.js';
import { explainWide, sameEverywhere, valueAtText } from '../../client/src/engine/wideFalseStep.js';
import { FAMILY_KEYS, SLIP_KINDS, buildPage } from '../../tools/first-error-corpus.mjs';
import { SEEDS as AUDIT_SEEDS, EXTRA_SEEDS, loadFamilies, editionOf, questionsFor, transcriptsFor } from '../../tools/understanding-audit/corpus.mjs';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

const mark = (prompt, lines, expr = 'x', answer = '') => {
  const q = { id: 'few', answerType: 'expression', difficulty: 3, prompt, answer: { expr }, steps: [] };
  const res = checkAnswer(q, answer);
  const ev = stepEvidence(q, answer, lines.join('\n'), res, { slipWarnings: true });
  return { report: ev.stepReport, lines: ev.stepReport?.lines || [], res, ev };
};
const markPage = pg => mark(pg.prompt, pg.lines, pg.expr, pg.answer || '');
const crossAt = r => r.lines.findIndex(l => l.status === 'break');
const falseCross = r => r.lines.flatMap((l, i) => (l.diagnosis?.code === 'false-continuation' ? [i] : []));
const detailed = d => !!d && ((d.whatChanged && d.corrected && d.errorType && d.check) || (d.code !== 'false-continuation' && d.code !== 'counterexample' && d.code !== 'chain-not-equal'));
const DASH = /[–—]/;

// ── 1 and 2: the corpus ───────────────────────────────────────────────────────────────────────────────────────────
const SEEDS = Number(process.env.FEW_SEEDS) || 40;
const FLOORS = {   // detailed slips out of slips, per family, measured on 40 seeds (a drop is a regression)
  expand: 0.95, square: 0.95, expandAsc: 0.95, unsimplifiedEnd: 0.95, collect: 0.95, factorise: 1, derivPoly: 1, fraction: 0.9, indices: 0.9, coeffIndices: 0.85,
  expLaw: 0.8, expPower: 0.7, logLaw: 0.5, logPow: 0.55, trigId: 0.95, trigDouble: 0.9, trigPyth: 0.85, derivTrig: 0.95, derivLog: 1, twoLetter: 0, numeric: 0.95, numericFrac: 0.9, surd: 0.9, numericPow: 0.85
};
let truePages = 0, trueCrossed = 0, slips = 0, crossedAtSlip = 0, detailedAtSlip = 0, ticked = 0, secondCross = 0, badType = 0, dashes = 0, markDrift = 0;
const byFam = {}; const trueBad = [];
for (const fam of FAMILY_KEYS) {
  const row = byFam[fam] = { slips: 0, detailed: 0 };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const t = buildPage(fam, seed);
    if (t) { truePages++; const r = markPage(t); if (crossAt(r) >= 0) { trueCrossed++; if (trueBad.length < 3) trueBad.push(JSON.stringify(t.lines)); } }
    for (const kind of SLIP_KINDS) {
      const p = buildPage(fam, seed, kind); if (!p) continue;
      slips++; row.slips++;
      const r = markPage(p);
      if (r.lines[p.at]?.status === 'ok') { ticked++; if (process.env.FEW_DEBUG) console.log('TICKED', fam, kind, JSON.stringify(p.lines), p.prompt); }
      if (crossAt(r) === p.at) { crossedAtSlip++; if (detailed(r.lines[p.at].diagnosis)) { detailedAtSlip++; row.detailed++; } }
      const fc = falseCross(r); if (fc.length > 1 || fc.some(i => i !== crossAt(r))) secondCross++;
      for (const l of r.lines) { const d = l.diagnosis; if (d?.code === 'false-continuation') { if (d.errorType && !ERROR_TYPES.includes(d.errorType)) badType++; if (DASH.test(`${d.comment || ''} ${d.whatChanged || ''} ${d.whyWrong || ''} ${d.check || ''} ${d.corrected || ''}`)) dashes++; } }
      // marks are unchanged by commentary: the same page without the slip warnings has the same mark-bearing fields
      const q = { id: 'few', answerType: 'expression', difficulty: 3, prompt: p.prompt, answer: { expr: p.expr }, steps: [] };
      const res = checkAnswer(q, p.answer || '');
      const a = stepEvidence(q, p.answer || '', p.lines.join('\n'), res, { slipWarnings: true }), b = stepEvidence(q, p.answer || '', p.lines.join('\n'), res, {});
      if (JSON.stringify([a.partial, a.board]) !== JSON.stringify([b.partial, b.board])) markDrift++;
    }
  }
}
ok(trueCrossed === 0, `true pages crossed: ${trueCrossed} of ${truePages} ${trueBad.join(' ')}`);
ok(ticked === 0, `a wrong line was ticked: ${ticked}`);
ok(crossedAtSlip / slips >= 0.99, `slips crossed at the slipped line: ${crossedAtSlip} of ${slips}`);
ok(secondCross === 0, `only the first wrong line carries a false-continuation diagnosis: ${secondCross} pages differ`);
ok(badType === 0, `every errorType is from the closed list: ${badType} are not`);
ok(dashes === 0, `no dash in any diagnosis text: ${dashes}`);
ok(markDrift === 0, `marks and board are the same with and without the slip commentary: ${markDrift} pages differ`);
for (const [fam, row] of Object.entries(byFam)) ok(row.slips === 0 || row.detailed / row.slips >= FLOORS[fam], `${fam}: ${row.detailed} of ${row.slips} slips crossed with a specific diagnosis (floor ${FLOORS[fam]})`);
ok(detailedAtSlip / slips >= 0.85, `all classes: ${detailedAtSlip} of ${slips} slips crossed with a specific diagnosis`);
console.log(`sweep: ${truePages} true pages, ${trueCrossed} crossed; ${slips} slips, ${crossedAtSlip} crossed at the slipped line, ${detailedAtSlip} with a specific diagnosis`);

// ── 3: what must stay a note ───────────────────────────────────────────────────────────────────────────────────────
// never crossed by the wide rule (a break another check makes on the final answer is that check's own, pinned elsewhere)
const noBreak = (prompt, lines, what, expr = 'x') => { const r = mark(prompt, lines, expr); ok(falseCross(r).length === 0, `${what}: never a false-continuation cross (${r.lines.map(l => l.status)})`); return r; };
noBreak('Simplify $(1 + i)^2$.', ['(1 + i)^2', '= 1 + 2i + i^2', '= 2i'], 'complex numbers', '2i');
noBreak('(a) Simplify $\\ln 6 + \\ln 2$. (b) Simplify $\\ln 8 - \\ln 2$.', ['ln 6 + ln 2', '= ln 12', '= ln 4'], 'two parts');
noBreak('Simplify $\\ln(5x) + \\ln(3x)$.', ['ln(5x) + ln(3x)', '= ln(15x^2)', '= ln(5x)'], 'a restart from an earlier line', 'ln(15x^2)');
noBreak('Simplify $\\sin x \\cos x + 2\\sin x$.', ['sin(x)cos(x) + 2sin(x)', '= sin(x)cos(x)'], 'one piece of a sum', 'sin(x)cos(x) + 2sin(x)');
noBreak('Simplify $\\frac{22}{7}$ to 2 decimal places.', ['22/7', '= 3.14'], 'rounding', '3.14');
noBreak('Evaluate $\\frac{1}{3}$ correct to 3 significant figures.', ['1/3', '= 0.333'], 'significant figures', '0.333');
noBreak('Simplify $\\sqrt{x^{2}}$.', ['sqrt(x^2)', '= x'], 'a rewrite true for x > 0', 'x');
noBreak('Solve $2x + 3 = 7$.', ['2x + 3 = 7', '2x = 4', 'x = 2', '= 2 + 1'], 'an equation solved');
noBreak('Simplify $2x + 3x$.', ['2x + 3x', '= 5x', 'when x = 2', '= 7'], 'a value put in');
noBreak('Simplify $3 \\times 4 + 5 \\times 2$.', ['3*4 + 5*2', '= 12 + 10', '= 22 ± 2'], 'a plus or minus line');
await G.loadAllBanks();
{
  const q = G.generateQuestion('y11-polynomials', 2, 5);
  const lines = ['P(1) = 1^3 + 2(1)^2 + 3(1) - 4', '= 1 + 2 + 3 - 4', '= 4'];
  const rep = stepEvidence(q, '4', lines.join('\n'), checkAnswer(q, '4'), { slipWarnings: true }).stepReport;
  ok(rep.lines[2].status === 'note' && /comes to 4, but the line above comes to 2/.test(rep.lines[2].note || ''), `a numeric line that is not equal to the line above says so, with both values: ${rep.lines[2].note}`);
}

// ── 4: specific and true ──────────────────────────────────────────────────────────────────────────────────────────
{
  const r = mark('Simplify $e^{2x} \\times e^{3x}$.', ['e^(2x)e^(3x)', '= e^(5x)', '= e^(6x)'], 'e^(5x)', 'e^(6x)');
  const d = r.lines[2].diagnosis;
  ok(r.lines[2].status === 'break' && d?.code === 'false-continuation' && d.errorType === 'coefficient-wrong' && /6/.test(d.whatChanged) && d.corrected === '= e^(5x)' && /At x = /.test(d.check), `exp law slip: ${JSON.stringify(d)}`);
  ok(/^Every line checked before line 3 is correct\.$/.test(d.kept || ''), 'everything before is said correct only over ticked lines');
}
{
  const r = mark('Simplify $3 \\times 4 + 5 \\times 2$.', ['3*4 + 5*2', '= 12 + 10', '= 21'], '22', '21');
  const d = r.lines[2].diagnosis;
  ok(d?.errorType === 'arithmetic-slip' && d.corrected === '= 22' && /Working out 12 \+ 10 gives 22, not 21/.test(d.whyWrong), `arithmetic slip: ${JSON.stringify(d)}`);
}
{
  const r = mark('Simplify $\\frac{x^{2} - 9}{x - 3}$.', ['(x^2 - 9)/(x - 3)', '= x - 3'], 'x+3', 'x-3');
  const d = r.lines[1].diagnosis;
  ok(r.lines[1].status === 'break' && detailed(d), `fraction slip: ${JSON.stringify(d)}`);
}
await G.loadAllBanks();
// a line above that is not yet collected: the term that came out right is never named as the slip (power rule, measured 24 November)
{
  const q = G.generateQuestion('y11-diff', 2, 35);
  const lines = ["f'(x) = 3(2)x^2 + 2(2)x + 6", '= 6x^2 + 4x + 6x', '= 6x^2 + 10x'];
  const res = checkAnswer(q, '6x^2+10x');
  const rep = stepEvidence(q, '6x^2+10x', lines.join('\n'), res, { slipWarnings: true }).stepReport;
  const brk = rep.lines.findIndex(l => l.status === 'break');
  const text = `${rep.lines[brk]?.note || ''} ${rep.lines[brk]?.diagnosis?.message || ''}`;
  ok(brk === 1 && !/2 × 2 = 4/.test(text) && !/Check the coefficient/.test(text), `the correct 4x term is not blamed: ${text}`);
}
// the closed numeric chain on the real remainder question, and a wrong first line is not ticked
{
  const q = G.generateQuestion('y11-polynomials', 2, 5);
  const lines = ['P(1) = 1^{3} + 2(1)^{2} + 3(1) - 4', '= 1 + 2 + 3 - 4', '= 4'].map(s => s.replace(/\^\{([^}]*)\}/g, '^$1'));
  const rep = stepEvidence(q, '4', lines.join('\n'), checkAnswer(q, '4'), { slipWarnings: true }).stepReport;
  ok(rep.lines[2].status !== 'ok', 'the wrong final line of the remainder page is never ticked');
}

// ── 5: naming what a true line did ───────────────────────────────────────────────────────────────────────────────
ok(stepHow('2x^2 + 4x', '2x(x + 2)')?.kind === 'factorised' && JSON.stringify(stepHow('2x^2 + 4x', '2x(x + 2)').factors) === '["2x","x + 2"]', 'factorised: 2x and x + 2');
ok(stepHow('x^2 + 5x + 6', '(x + 2)(x + 3)')?.kind === 'factorised', 'factorised: two brackets');
ok(stepHow('x^2 + 5x + 6', 'x^2 + 5x + 6') === null, 'the same line is not "factorised"');
ok(stepHow('(x + 2)(x - 3)', 'x^2 - x - 6')?.kind === 'expanded', 'expanded: a product of brackets');
ok(stepHow('2x^2 + 3x - x', '2x^2 + 2x')?.kind === 'collected', 'collected like terms');
ok(stepHowWide('(x^2 - 9)/(x - 3)', 'x + 3')?.kind === 'cancelled' && stepHowWide('(x^2 - 9)/(x - 3)', 'x + 3').factorTex === 'x - 3', 'cancelled: the common factor x - 3');
ok(stepHowWide('(x^2 - 9)/(x - 3)', 'x + 4') === null, 'not cancelled when the quotient is wrong');
ok(stepHowWide('12 + 10', '22')?.kind === 'evaluated' && stepHowWide('12 + 10', '23') === null, 'evaluated, and only when true');
{
  const r = mark('Factorise $2x^2 + 4x$.', ['2x^2 + 4x', '= 2x(x + 2)'], '2x(x+2)');
  ok(r.lines[1].status === 'ok' && r.lines[1].how?.kind === 'factorised', `a true factorising line is named: ${JSON.stringify(r.lines[1].how)}`);
}

// ── 6: a trap is not shown over working that contradicts it ───────────────────────────────────────────────────────
{
  const q = G.generateQuestion('y12-trig-model', 3, 23);
  const lines = ['h(10) = 15 + 12sin(10π/12)', '= 15 + 12sin(5π/6)', '= 15 + 12(1/2)', '= 27'];
  const rep = stepEvidence(q, '27', lines.join('\n'), checkAnswer(q, '27'), { slipWarnings: true }).stepReport;
  const said = lineLevelFeedback(rep, { resolved: true, invalid: false, correct: false, optionWhy: '' });
  ok(typeof said === 'string' && /21/.test(said) && !/not .*pi.*2/i.test(said), `the line-level message is said instead of the trap: ${said}`);
  ok(lineLevelFeedback(rep, { resolved: true, invalid: false, correct: true }) === null && lineLevelFeedback(rep, { resolved: false, invalid: false, correct: false }) === null && lineLevelFeedback(rep, { resolved: true, invalid: false, correct: false, optionWhy: 'an option explanation' }) === null, 'a right answer, an open try and a multiple-choice explanation keep the marker\'s own text');
  ok(lineLevelFeedback({ lines: [{ status: 'break', note: 'first line wrong' }] }, { resolved: true, correct: false }) === null, 'a cross on the first line has no ticked line before it: the marker\'s text stays');
}

// ── 7: the authored true pages of every Australian family: the rule adds NO cross that the page did not already have without it ────
{
  const fams = (await loadFamilies()).filter(id => editionOf(id) === 'NSW');
  let pages = 0, added = 0, withDiagnosis = 0, crossedAll = 0; const bad = [], badAll = [];
  for (const id of fams) for (const q of questionsFor(id, [...AUDIT_SEEDS, ...EXTRA_SEEDS])) {
    let ts; try { ts = transcriptsFor(q); } catch { continue; }
    for (const t of ts) {
      if (t.style === 'slip') continue;
      const text = t.lines.map(l => l.text).join('\n');
      let on, off; try { on = stepEvidence(q, '', text, { correct: false }, { slipWarnings: true }).stepReport; off = stepEvidence(q, '', text, { correct: false }, { slipWarnings: false }).stepReport; } catch { continue; }
      if (!on?.lines || !off?.lines) continue;
      pages++;
      const a = on.lines.map(l => l.status === 'break'), b = off.lines.map(l => l.status === 'break');
      if (a.some(Boolean)) { crossedAll++; if (badAll.length < 5) badAll.push(`${id} ${JSON.stringify(t.lines.map(l => l.text))}`); }
      if (JSON.stringify(a) !== JSON.stringify(b)) { added++; if (bad.length < 3) bad.push(`${id} ${JSON.stringify(t.lines.map(l => l.text))}`); }
      if (on.lines.some(l => l.diagnosis?.code === 'false-continuation')) withDiagnosis++;
    }
  }
  ok(pages >= 8000, `the sweep covers the authored true pages: ${pages}`);
  ok(crossedAll === 0, `a true authored page is crossed: ${crossedAll} of ${pages} ${badAll.join(' ')}`);
  ok(added === 0, `true authored pages given a new cross by the slip rule: ${added} of ${pages} ${bad.join(' ')}`);
  console.log(`authored true pages: ${pages} swept, ${added} newly crossed, ${withDiagnosis} carry a false-continuation diagnosis on a cross some other check made`);
}

// ── 8: degrees and radians ─────────────────────────────────────────────────────────────────────────────────────────
{
  const DEG = 'Find the exact value of $\\tan 45^\\circ$.', RAD = 'Find the exact value of $\\sin\\left(\\dfrac{\\pi}{6}\\right)$ (in radians).', NONE = 'Find the exact value.';
  const degTrue = ['tan(45) = 1', 'tan 45 = 1', 'sin(30) = 1/2', 'cos(60) = 1/2', 'sin(90) = 1', 'cos(180) = -1', 'sin 30 = 1/2', 'tan(0) = 0', 'cos(0) = 1', 'sin(45) = sqrt(2)/2'];
  for (const l of degTrue) { const r = mark(DEG, [l], '1'); ok(crossAt(r) === -1, `degrees: "${l}" is true and never crossed (${r.lines.map(x => x.status)})`); }
  for (const l of ['sin(pi/6) = 1/2', 'cos(pi) = -1', 'tan(pi/4) = 1', 'sin(pi/2) = 1']) { const r = mark(RAD, [l], '1/2'); ok(crossAt(r) === -1, `radians: "${l}" is never crossed (${r.lines.map(x => x.status)})`); }
  for (const l of degTrue.slice(0, 4)) { const r = mark(NONE, [l], '1'); ok(crossAt(r) === -1, `no unit stated: "${l}" is never crossed`); }
  ok(crossAt(mark(DEG, ['sin(30) = 2'], '1')) === 0, 'in degrees a false line is still crossed: sin(30) = 2');
  ok(crossAt(mark('Find the exact value of $\\sin 30^\\circ$.', ['sin(30) = 0.5', '= 1/2'], '1/2')) === -1, 'sin(30) = 0.5 in degrees is never crossed');
  const r = mark(NONE, ['sin(30)', '= 1/2'], '1/2');
  ok(falseCross(r).length === 0 && crossAt(r) === -1, 'a trig of a plain number with no unit stated is not crossed by the wide rule either');
}

// ── 9: every sentence of a diagnosis is checked by the engine for that page ──────────────────────────────────────────
const sideOf = line => String(line).split('=').pop().trim();
{
  let checked = 0, bad = [];
  const verify = (page, why) => {
    const r = markPage(page); const l = r.lines[page.at]; const d = l?.diagnosis;
    if (!d || d.code !== 'false-continuation') return;
    const above = sideOf(page.aboveLine), written = sideOf(page.slipLine);
    checked++;
    // the corrected line equals the line above (a rounded decimal only where the working is not exact, and then at 4 places)
    if (d.corrected) {
      const body = d.corrected.replace(/^\s*[=≈]\s*/, '').replace(/\s*\(4 decimal places\)\s*$/, '');
      if (d.correctedValue !== undefined) { if (!(Math.abs(valueAtText(body, '', 0) - valueAtText(above, '', 0)) < 6e-5 * Math.max(1, Math.abs(valueAtText(above, '', 0))))) bad.push(`${why}: corrected ${d.corrected} is not the line above ${above}`); }
      else if (!sameEverywhere(above, body)) {
        // polynomial diagnoses state the line above in its simplest form (checked by the polynomial engine); accept it when it is the same function
        bad.push(`${why}: corrected ${d.corrected} is not equal to the line above ${above}`);
      }
    }
    // the check is numerically true
    const NUM = '(-?\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)'; const m = new RegExp(`At (\\w) = ${NUM} the line above gives ${NUM} but this line gives ${NUM}`).exec(d.check || '');
    if (m) {
      const a = valueAtText(above, m[1], Number(m[2])), b = valueAtText(written, m[1], Number(m[2]));
      const near = (x, y) => x !== null && Math.abs(x - Number(y)) <= 6e-4 * Math.max(1, Math.abs(Number(y)));
      if (!near(a, m[3]) || !near(b, m[4])) bad.push(`${why}: check "${d.check}" is not true of ${above} and ${written}`);
    }
    // what the diagnosis quotes of the student's line is in the student's line
    for (const q of d.quoted || []) if (!page.slipLine.replace(/\s+/g, '').includes(String(q).replace(/\s+/g, ''))) bad.push(`${why}: quoted "${q}" is not in "${page.slipLine}"`);
    if (DASH.test(JSON.stringify(d))) bad.push(`${why}: a dash`);
  };
  for (const fam of FAMILY_KEYS) for (let seed = 1; seed <= 30; seed++) for (const kind of SLIP_KINDS) {
    const p = buildPage(fam, seed, kind); if (!p) continue;
    verify(p, `${fam}/${kind}/${seed}`);
  }
  ok(checked > 1500, `diagnoses re-checked by the engine: ${checked}`);
  ok(bad.length === 0, `sentences not true of the page: ${bad.length}: ${bad.slice(0, 4).join(' | ')}`);
}

// ── 10: the sentences that were false or misleading (review of 24 November 2026) ───────────────────────────────────
{
  const sign = explainWide('sin(x + 2)', 'sin(x)cos(2) - cos(x)sin(2)');
  ok(sign && !/only when a term is moved|neither happens/.test(JSON.stringify(sign)), `an identity or expansion is not told it may not change a sign: ${JSON.stringify(sign)}`);
  const sg = explainWide('3x + 2cos(x)', '3x - 2cos(x)');
  ok(sg?.type === 'sign-error' && /Changing only the sign in front of 2cos\(x\) makes this line equal to the line above/.test(sg.whyWrong) && !/moved across|multiplied by a negative/.test(sg.whyWrong), `sign slip says only what was verified: ${sg?.whyWrong}`);
  const fr = explainWide('1/3 + 1/5', '2/8');
  ok(fr.corrected === '= 8/15' && /8\/15/.test(fr.check) && !/0\.5333/.test(JSON.stringify({ ...fr, correctedValue: undefined })), `exact rationals give an exact value: ${fr.corrected} ${fr.check}`);
  const dec = explainWide('0.1 + 0.25', '0.5');
  ok(dec === null, 'decimal working is an approximation: never crossed or diagnosed here');
  const irr = explainWide('ln(2) + ln(3)', 'ln(7)');
  ok(/≈ 1\.7918 \(4 decimal places\)/.test(irr.corrected) && /about 1\.792/.test(irr.whatChanged), `an irrational value is marked as rounded: ${irr.corrected}`);
  const sq = explainWide('sqrt(216)', '36sqrt(6)');
  ok(sq.corrected === '= 6√6' && /This line says 36sqrt\(6\), which is about 88\.18\./.test(sq.whatChanged) && !/88\.1816/.test(JSON.stringify(sq)) && sq.whyWrong === '216 = 36 × 6, so √216 = 6√6.' && !/Working out sqrt\(216\) gives/.test(JSON.stringify(sq)), `the student's line is quoted as written and the step is explained: ${JSON.stringify(sq)}`);
  const tw = explainWide('2sin(x)cos(x)', '2sin(x)sin(x)');
  ok(tw.type === 'function-wrong' && /One of the sin factors in the term 2sin\(x\)sin\(x\) should be cos/.test(tw.whatChanged) && !/not one number or sign/.test(JSON.stringify(tw)), `one swapped factor is named: ${tw.whatChanged}`);
}

console.log(failures.length ? `FIRST ERROR WIDER: FAIL (${failures.length})\n${failures.map(f => '  ' + f).join('\n')}` : `FIRST ERROR WIDER: PASS: ${pass} checks`);
process.exit(failures.length ? 1 : 0);
