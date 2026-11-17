// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the mathematics red team's corpus, kept (#680, #692)
//
// The cases below were authored independently of the marker, by the Q1
// mathematics assurance agent, and each one found the real, unmodified checker
// awarding full credit to a wrong answer (or, for a control, the right verdict
// that a repair must keep). They are maintained here so that no change to the
// marker can quietly re-open them:
//   · round 1 holdouts, 22 cases     — q1-holdouts.mjs   sha256 a55c429b…8b8de
//   · round 1 label cases, 11 cases  — q1-label.mjs      sha256 6fd95b78…a06988
//   · round 2 precision, 92 cases    — q1-round2-precision.mjs sha256 e37a4d3d…3cce1
// Round 2's 92 cases are rebuilt by the same construction, not pasted, so the
// counts are checked: a construction change that drops a case fails the suite.
// Beside them stand valid alternatives the red-team sets are thin on — every
// refusal a repair adds must leave these right — and the determinism pin for
// the removed wall-clock backstop (C3's report on #692).
// Synthetic evidence only: direct checker calls on generated questions.
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { checkAnswer, stepCheck } = await import(`${SRC}engine/checker.js`);
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();

const groups = {};
const failures = [];
function expect(group, id, question, input, want) {
  groups[group] ??= { pass: 0, total: 0 };
  groups[group].total++;
  let got;
  try { got = checkAnswer(question, input)?.correct === true; } catch (e) { got = `threw ${e.message}`; }
  if (got === want) groups[group].pass++;
  else failures.push(`${group} · ${id}: ${JSON.stringify(input)} → ${got}, expected ${want}`);
}
const iv = (region, variable = 'x') => ({ answerType: 'interval', answer: { region, variable } });
const numQ = (value, prompt = 'How many whole units?') => ({ answerType: 'numeric', answer: { value }, prompt });

// ── Q1 round 2 · 92 precision cases ─────────────────────────────────────────
{
  const G = 'q1-round2-precision';
  for (const N of [1000000000n, 1000000000000n, 1000000000000000n, 2000000000000000n, 4000000000000000n, 8000000000000000n]) {
    const q = iv('x > ' + N);
    expect(G, `exact-bound-valid-${N}`, q, 'x > ' + N, true);
    expect(G, `exact-bound-parentheses-${N}`, q, '(' + N + ', ∞)', true);
    for (const d of [1n, 2n, 3n, 4n, 8n]) {
      if (N + d <= 9007199254740991n) expect(G, `exact-bound-different-${N}+${d}`, q, 'x > ' + (N + d), false);
      expect(G, `exact-bound-different-${N}-${d}`, q, 'x > ' + (N - d), false);
    }
  }
  for (const [v, wrong] of [[1000000000000, '1000000000000.0001'], [3840000000000, '3840000000000.001'], [3840000000000, '3840000000000.0005'], [2000000000000000, '2000000000000000.5'], [21149700, '21149700.000000004']]) {
    expect(G, `number-canonical-${v}`, numQ(v), String(v), true);
    expect(G, `number-decimal-near-${v}`, numQ(v), wrong, false);
  }
  for (const [id, d, seed, wrong] of [['c8-exponents-ncert-mastery', 4, 1, '3840000000000.001'], ['c8-exponents-ncert-mastery', 4, 1, '3840000000000.0005'], ['c7-place-value-systems-reasoning', 1, 6, '21149700.000000004']]) {
    const q = generateQuestion(id, d, seed);
    expect(G, `real-generator-canonical-${id}`, q, String(q.answer.value), true);
    expect(G, `real-generator-perturbed-${id}`, q, wrong, false);
  }
  for (const [id, q, input] of [
    ['bad-ratio-tiny', { answerType: 'ratio', answer: { a: 1, b: 2, simplified: false } }, '1e-12:1e-12'],
    ['bad-ratio-digit-split', { answerType: 'ratio', answer: { a: 1, b: 2, simplified: true } }, '1:0 2'],
    ['bad-ratio-close', { answerType: 'ratio', answer: { a: 1, b: 2, simplified: false } }, '1:2.0000000001'],
    ['wrong-rupees-for-length', numQ(100, 'How many metres?'), '100 rupees']
  ]) expect(G, id, q, input, false);
}

// ── Q1 round 1 · 22 final-answer holdouts ───────────────────────────────────
{
  const G = 'q1-round1-holdouts';
  const pct = numQ(20, 'What percentage of 50 is 10?');
  const givenX = numQ(200, 'If 20 percent of x is 40, find x');
  const prob = numQ(0.2, 'If 20 percent of the marbles are red, what is the probability of drawing a red marble?');
  const mat = { answerType: 'matrix', answer: { rows: [[1, 2], [3, 4]] } };
  const vec = { answerType: 'vector', answer: { components: [1, 2, 3] } };
  for (const [id, q, input, want] of [
    ['interval-large-valid', iv('x > 1000000000'), 'x > 1000000000', true],
    ['interval-large-shift', iv('x > 1000000000'), 'x > 999999999.9375', false],
    ['interval-large-far', iv('x > 1000000000'), 'x > 999999999', false],
    ['interval-left-reversal', iv('x > 1000000000'), 'x < 1000000000', false],
    ['interval-open-closed', iv('x > 3'), 'x >= 3', false],
    ['interval-valid-alternative', iv('x > 3'), '(3, ∞)', true],
    ['interval-nonempty-vs-empty', iv('no solution'), '(0, 0.0000000000001)', false],
    ['matrix-valid', mat, '[[1,2],[3,4]]', true],
    ['matrix-missing-element', mat, '[[1,,2],[3,4]]', false],
    ['matrix-double-row-separator', mat, '[1,2;;3,4]', false],
    ['matrix-wrong-element', mat, '[[1,7],[3,4]]', false],
    ['vector-valid', vec, '(1,2,3)', true],
    ['vector-empty-component', vec, '(1,,2,3)', false],
    ['vector-trailing-comma', vec, '(1,2,3,)', false],
    ['vector-wrong-component', vec, '(1,7,3)', false],
    ['percent-correct', pct, '20%', true],
    ['percent-2000-wrong', pct, '2000%', false],
    ['percent-raw-proportion-wrong', pct, '0.2', false],
    ['given-percent-correct-number', givenX, '200', true],
    ['given-percent-incorrect-unit', givenX, '200%', false],
    ['given-percent-probability-form', prob, '20%', true],
    ['given-percent-probability-false', prob, '0.2%', false]
  ]) expect(G, id, q, input, want);
}

// ── Q1 round 1 · 11 label cases ─────────────────────────────────────────────
{
  const G = 'q1-round1-labels';
  for (const [id, prompt, value, input, want] of [
    ['square-control', 'Given b is 3, find $b^2$.', 9, 'b = 9', false],
    ['square-valid', 'Given b is 3, find $b^2$.', 9, 'b^2 = 9', true],
    ['sum-power-mislabel', 'Given b is 3, find $b^2 + 1$.', 10, 'b = 10', false],
    ['sum-power-valid', 'Given b is 3, find $b^2 + 1$.', 10, 'b^2+1=10', true],
    ['compound-multiple', 'Suppose b is 4. Find $2b + 1$.', 9, 'b = 9', false],
    ['compound-sum', 'Given x is 4, find $2x + 3$.', 11, 'x = 11', false],
    ['compound-product', 'Given a is 2 and b is 3, find $ab$.', 6, 'a = 6', false],
    ['compound-product-valid', 'Given a is 2 and b is 3, find $ab$.', 6, 'ab = 6', true],
    ['multi-expression-mislabel', 'Given x is 2. Evaluate $x^2 + 3x$.', 10, 'x = 10', false],
    ['compound-root-mislabel', 'Let x be 3. Find $3x^2 - 2$.', 25, 'x = 25', false],
    ['plain-numeric-valid', 'Given x is 4, find $2x+3$.', 11, '11', true]
  ]) expect(G, id, numQ(value, prompt), input, want);
}

// ── D13: a value with an operation still to do is refused ─────────────────────
// Owner default D13 (interim until the examiner rules on #499). These three
// were pinned as valid alternatives before D13; they are the same inputs, now
// pinned as refused whatever they equal.
{
  const G = 'd13-unevaluated';
  expect(G, 'a product of two standard forms', numQ(3840000000000), '(3.2×10^6)(1.2×10^6)', false);
  expect(G, 'a written product', numQ(3), '0.1*3*10', false);
  expect(G, 'a root that is whole', numQ(4), 'sqrt(16)', false);
}

// ── Valid alternatives every repair must keep ───────────────────────────────
{
  const G = 'valid-alternatives';
  const big = numQ(3840000000000);
  for (const input of ['3840000000000', '3,840,000,000,000', '3.84 × 10^12', '3.84*10^12', '3.84e12', '3840000000000.000', '3840000000000.0']) expect(G, `whole key as ${input}`, big, input, true);
  for (const input of ['21149700', '2,11,49,700', '21,149,700', '21149700.00']) expect(G, `lakh grouping ${input}`, numQ(21149700), input, true);
  expect(G, 'a fraction that is whole', numQ(4), '12/3', true);
  expect(G, 'a mixed numeral', numQ(2.5), '2 1/2', true);
  expect(G, 'negative whole key', numQ(-7), '-7', true);
  expect(G, 'negative whole key, decimal off', numQ(-7), '-7.0000001', false);
  expect(G, 'zero key', numQ(0), '0', true);
  expect(G, 'zero key, a decimal beyond the 10⁻⁹ display allowance', numQ(0), '0.00000001', false);
  expect(G, 'calculator display of a whole number (tolerance-policy pin)', numQ(12), '11.9999999999', true);
  expect(G, 'just past the display allowance', numQ(12), '11.999999998', false);
  expect(G, 'authored tol still forgives', { answerType: 'numeric', answer: { value: 3840000000000, tol: 0.01 } }, '3840000000000.001', true);
  expect(G, 'named precision still rounds', numQ(3, 'Give the answer to 1 decimal place.'), '3.0', true);
  // A named precision is keyed with an authored tol (marker-precision-tol-content-check), which the band honours.
  expect(G, 'a decimal key keeps its authored rounding', { answerType: 'numeric', prompt: 'Find √2 to 2 decimal places.', answer: { value: Math.SQRT2, tol: 0.005 } }, '1.41', true);
  expect(G, 'rupees on a money question', numQ(100, 'A pen costs ₹40 and a book ₹60. How much do both cost together?'), '₹100', true);
  expect(G, 'rupee word on a money question', numQ(100, 'A pen costs ₹40 and a book ₹60. How much do both cost together?'), '100 rupees', true);
  const set = { answerType: 'set', answer: { values: [2, -3] } };
  expect(G, 'set exact', set, 'x = 2, x = -3', true);
  expect(G, 'set as fractions', set, '4/2, -6/2', true);
  expect(G, 'set with a decimal past the display allowance', set, '2.000000002, -3', false);
  const pt = { answerType: 'point', answer: { x: 2, y: -3 } };
  expect(G, 'point exact', pt, '(2, -3)', true);
  expect(G, 'point near decimal', pt, '(2, -3.000000001)', false);
  const r12 = { answerType: 'ratio', answer: { a: 1, b: 2, simplified: false } };
  for (const input of ['1:2', '1 : 2', '2:4', '0.5:1', '1 to 2', '3 : 6']) expect(G, `ratio ${input}`, r12, input, true);
  expect(G, 'ratio reversed', r12, '2:1', false);
  expect(G, 'ratio three parts', r12, '1:2:3', false);
  const r12s = { answerType: 'ratio', answer: { a: 1, b: 2, simplified: true } };
  expect(G, 'simplified ratio', r12s, '1:2', true);
  expect(G, 'unsimplified ratio refused when simplest form asked', r12s, '2:4', false);
  for (const [want, input] of [['x > 2000000000000000', 'x > 2*10^15'], ['x > 2000000000000000', '(2e15, ∞)'], ['x > 2/3', 'x > 4/6'], ['x < 0.1', 'x < 1/10'], ['x <= 2.5', 'x <= 5/2'], ['x > sqrt(8)', 'x > 2sqrt(2)'], ['x > sqrt(1/4)', 'x > 1/2'], ['-1 <= x < 3', '[-1, 3)']]) {
    expect(G, `interval ${want} as ${input}`, iv(want), input, true);
  }
  expect(G, 'decimal of an irrational bound is not it', iv('x > sqrt(2)'), 'x > 1.4142135623730951', false);
  expect(G, 'distinct beyond 2^53', iv('x > 9007199254740992'), 'x > 9007199254740993', false);
  expect(G, 'same beyond 2^53', iv('x > 9007199254740993'), 'x > 9007199254740993', true);
  expect(G, 'touching pieces merge', iv('x <= 3'), 'x < 1 | 1 <= x <= 3', true);
  // Round 3: blanks in a point or a set, and a unit the question never names (#680, Q1).
  const D = { answerType: 'point', answer: { x: -10, y: 6 }, prompt: 'Find the coordinates of $D$.' };
  for (const input of ['(-10,6)', '(-10, 6)', '(-10;6)', '(-10  6)', '-10, 6']) expect(G, `point ${input}`, D, input, true);
  for (const input of ['(-10,,6)', '(-10; ;6)', '(-10,6,)', '(-10,,6,)', '(,-10,6)', '(-10,6;)', '(-10;6,)']) expect(G, `point blank ${input}`, D, input, false);
  const AB = { answerType: 'set', answer: { values: [4, 8] }, prompt: 'Write down $A \\cap B$.' };
  for (const input of ['{4,8}', '{8, 4}', '4, 8', '4; 8', '{4; 8}', '4 and 8', '4, and 8', 'x = 4 or x = 8']) expect(G, `set ${input}`, AB, input, true);
  for (const input of ['{4,,8}', '{4,8,}', '4;;8', '{4; ;8}', '{,4,8}', '4,8,']) expect(G, `set blank ${input}`, AB, input, false);
  expect(G, 'empty set key, empty answer', { answerType: 'set', answer: { values: [] } }, '{}', true);
  const latus = numQ(24, 'Find the length of the latus rectum of the parabola $y^2 = 24x$.');
  for (const [input, want] of [['24', true], ['24 units', true], ['24 kg', false], ['24 rupees', false], ['24 paise', false], ['24 s', false]]) expect(G, `unitless length ${input}`, latus, input, want);
  const perim = numQ(24, 'A rectangle is 8 cm by 4 cm. Find its perimeter.');
  for (const [input, want] of [['24', true], ['24 cm', true], ['24 centimetres', true], ['24 kg', false], ['24 cm²', false]]) expect(G, `perimeter ${input}`, perim, input, want);
  expect(G, 'a gap at one point is kept', iv('x <= 3'), 'x < 1 | 1 < x <= 3', false);
}

// ── Determinism: the same working is marked the same way on a slow machine ──
{
  const G = 'determinism';
  groups[G] ??= { pass: 0, total: 0 };
  // C3's reproduction on #692: seven correct lines, every one of them ok on an idle machine.
  const { stepMetaFor } = await import('../../server/platform/markerOps.js');
  const q = generateQuestion('c10-arithmetic-progressions', 2, 1009);
  const meta = stepMetaFor(q);
  const working = ['a = 10, d = 2, n = 14', 'T_n = a + (n-1) × d', 'T_n = (10) + ((14)-1) × (2)', '= 36',
    'S_n = n/2 × (2 × a+(n-1) × d)', 'S_n = (14)/2 × (2 × (10)+((14)-1) × (2))', '= 322'].join('\n');
  const statuses = () => (stepCheck(meta, working, { prompt: q.prompt })?.lines || []).map(l => l.status).join(',');
  const normal = statuses();
  const realNow = Date.now;
  let t = realNow();
  Date.now = () => (t += 150);            // every read of the clock is 150 ms later
  let slow;
  try { slow = statuses(); } finally { Date.now = realNow; }
  groups[G].total++;
  if (normal && !normal.includes('note') && slow === normal) groups[G].pass++;
  else failures.push(`${G} · c10-arithmetic-progressions D2 seed 1009: normal [${normal}] vs slow clock [${slow}]`);
}

// ── SymPy differential oracle, 2026-11-18 · 60 cases ────────────────────────
// tools/math-oracle found the checker crediting each wrong answer below
// (docs/evidence/sympy-oracle-2026-11-18.md, PR #993): a calculator display of an exact
// value on a question that demands the exact value, and final-answer
// expressions that agree with the key only at the published sample points or
// only within the 1e-6 sampling band. Each sits beside a right answer the
// repair must keep. Not covered, and recorded as residual in the report: a
// perturbation below binary64 noise of a large expression ((x² + 9)⁶/3 +
// 0.0000001x), which sampling cannot see; that needs an exact polynomial path.
{
  const G = 'sympy-oracle-2026-11-18';
  const exprQ = (expr, extra = {}) => ({ answerType: 'expression', answer: { expr, ...extra } });
  const vanishing = '(x - 0.7)(x - 1.3)(x + 0.6)(x - 2.1)(x + 1.7)(x - 0.35)(x - 3.4)(x + 2.3)';
  for (const [id, d, seed, right, wrong] of [
    ['me11-inversetrig', 4, 28001, ['3pi/4', '2.356194490192345'], ['2.3561944902', '2.356194490', '2.35619449']],
    ['me12-calc', 3, 21002, ['1400pi/3'], ['1466.076572', '1466.0765716752']],
    ['me12-calc', 3, 21001, ['9pi'], ['28.2743338823']],
    ['y11-trigfunc', 1, 7001, ['4', '4.0'], ['4.0000000001']],
    ['y12-trigcalc', 3, 21001, ['-1'], ['-0.9999999999']],
    ['c8-rational-numbers-distributivity', 4, 28001, ['0'], ['0.0000000001']],
    ['y9-algebra', 3, 21001, ['(x - 13)(x + 13)'], ['x^2 - 169 + 0.0000001*x', `x^2 - 169 + ${vanishing}`]],
    ['mex-proof', 3, 21001, ['32n'], ['32*n + 0.00001*n']],
    ['y11-diff', 1, 7001, ['18x'], ['18*x + 0.00001*x']]
  ]) {
    const q = generateQuestion(id, d, seed);
    for (const r of right) expect(G, `${id}-right-${r}`, q, r, true);
    for (const w of wrong) expect(G, `${id}-wrong-${w.slice(0, 24)}`, q, w, false);
  }
  const square = exprQ('x^2');
  for (const r of ['x*x', '(-x)^2', 'x^2']) expect(G, `x^2-right-${r}`, square, r, true);
  for (const w of ['x^2 + 0.0000001x', `x^2 + ${vanishing}`, 'x^2 + 0.000001x^3']) expect(G, `x^2-wrong-${w.slice(0, 24)}`, square, w, false);
  // Padded with zero of a huge size, so an answer could widen its own band (#992 review).
  const y9 = generateQuestion('y9-algebra', 3, 21001);
  for (const [q, w] of [
    [square, 'x^2 + 0.0000001x + (10^20 - 10^20)'], [square, 'x^2 + 0.0000001x + 100000 - 100000'],
    [square, `x^2 + ${vanishing} + (10^20 - 10^20)`], [square, 'x^2 + 0.0000001x + 10^6 x - 10^6 x'],
    [y9, 'x^2 - 169 + 0.0000001*x + (10^20 - 10^20)'], [y9, 'x^2 - 169 + 0.0000001*x + (x^12 - x^12)'],
    [y9, `x^2 - 169 + ${vanishing} + (10^20-10^20)`],
    [generateQuestion('mex-proof', 3, 21001), '32*n + 0.00001*n + (10^20 - 10^20)'],
    [generateQuestion('y11-diff', 1, 7001), '18*x + 0.00001*x + (10^20 - 10^20)'],
    // round 4: a zero padded just under the readability limit, and a zero
    // defined only near the published sample points
    [square, 'x^2 + 0.0000001x + (20000000.5 - 20000000.5)'], [square, 'x^2 + 0.0000001x + (1.1-1.1)*15000000'],
    [y9, 'x^2 - 169 + 0.0000001*x + (1.1-1.1)*10^9'],
    [generateQuestion('mex-proof', 3, 21001), '32n + 0.00001n + (1.1-1.1)*640000000n'],
    [generateQuestion('mex-proof', 3, 21001), '32n + 0.000001n + 12! - 12!'],
    [generateQuestion('y11-diff', 1, 7001), '18x + 0.00001x + (1.1-1.1)*450000000x'],
    [square, `x^2 + 0.0000001x + 0*sqrt(0.0001 - (${vanishing})^2)`], [square, `x^2 + 0.0000001x + 0*ln(0.0001 - (${vanishing})^2)`],
    // round 5: a zero noisy only where the answer is wrong (H = x + |x|), a term
    // that vanishes on the sampled interval only, and a sub-binary64 coefficient
    [square, `x^2 + ${vanishing}*(x+abs(x)) + (1.1-1.1)*10^20*(x+abs(x))`], [square, `x^2 + ${vanishing}*(x+abs(x)) + (1.1-1.1)*10^15*(x+abs(x))`],
    [square, 'x^2 + 0.0000001*(x+abs(x)) + (1.1-1.1)*10^20*(x+abs(x))'], [y9, 'x^2 - 169 + 0.0000001*(x+abs(x)) + (1.1-1.1)*10^20*(x+abs(x))'],
    [generateQuestion('mex-proof', 3, 21001), '32n + 0.00001*(n-4.5+abs(n-4.5)) + (1.1-1.1)*10^20*(n-4.5+abs(n-4.5))'],
    [square, 'x^2 + 0.0000001x + (sin(x)^2 + cos(x)^2 - 1)*10^20*(x+abs(x))'], [square, 'x^2 + 1e-15x'], [square, 'x^2 + 0.0000000001x'],
    [{ answerType: 'expression', answer: { expr: 'abs(2x + 7)^7' } }, '128x^7 + 3136x^6 + 32928x^5 + 192080x^4 + 672280x^3 + 1411788x^2 + 1647086x + 823543']
  ]) expect(G, `padded-${w.slice(0, 48)}`, q, w, false);
  const thirdExact = { answerType: 'numeric', prompt: 'Find the exact value.', answer: { value: 1 / 3, requireExact: true } };
  for (const r of ['1/3', '0.333333333333']) expect(G, `third-right-${r}`, thirdExact, r, true);
  for (const w of ['0.3333333333', '0.33333333']) expect(G, `third-wrong-${w}`, thirdExact, w, false);
}

// ── The probe keeps right answers right · 1087 cases ─────────────────────────
// Independent review of the probe above (PR #992): an expanded high-degree
// polynomial is a difference of large terms and carries their rounding, so a
// band on the result alone refused (2x + 7)⁷ written out. Every expansion of
// (ax + b)ⁿ for n 2–7, a 1–5, b ±1–9 must stay right.
{
  const G = 'sympy-oracle-2026-11-18-controls';
  const binom = (n, k) => { let r = 1n; for (let i = 1n; i <= BigInt(k); i++) r = r * (BigInt(n) - i + 1n) / i; return r; };
  const expand = (a, b, n) => {
    const terms = [];
    for (let k = n; k >= 0; k--) {
      const c = binom(n, k) * BigInt(a) ** BigInt(k) * BigInt(b) ** BigInt(n - k);
      terms.push(`${c}${k ? `x${k > 1 ? `^${k}` : ''}` : ''}`);
    }
    return terms.join(' + ').replace(/\+ -/g, '- ');
  };
  for (let n = 2; n <= 7; n++) for (let a = 1; a <= 5; a++) for (const b of [-9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    expect(G, `expanded-(${a}x+${b})^${n}`, { answerType: 'expression', answer: { expr: `(${a}x + ${b})^${n}` } }, expand(a, b, n), true);
  }
  expect(G, 'expanded-(2x+7)^7-review', { answerType: 'expression', answer: { expr: '(2x + 7)^7' } }, '128x^7 + 3136x^6 + 32928x^5 + 192080x^4 + 672280x^3 + 1411788x^2 + 1647086x + 823543', true);
  // …and the reverse (key expanded, answer factored), and keys whose noise is in
  // a denominator, an abs or a root (third review of #992).
  for (let n = 2; n <= 7; n++) for (let a = 1; a <= 5; a++) for (const b of [-9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    expect(G, `factored-(${a}x+${b})^${n}`, { answerType: 'expression', answer: { expr: expand(a, b, n) } }, `(${a}x + ${b})^${n}`, true);
  }
  for (const [key, answer, extra] of [
    ['abs(2x + 7)^7', expand(2, 7, 7), { positiveOnly: true }], ['abs(2x - 5)^8', expand(2, -5, 8)], ['sqrt((2x - 5)^16)', expand(2, -5, 8)],
    ['(2x + 7)^(-7)', `1/(${expand(2, 7, 7)})`], ['1/(x - 3)^4', '1/(x^4 - 12x^3 + 54x^2 - 108x + 81)', { positiveOnly: true }]
  ]) expect(G, `noise-in-${key}`, { answerType: 'expression', answer: { expr: key, ...(extra || {}) } }, answer, true);
  expect(G, 'expanded-(x-3)^10-positive', { answerType: 'expression', answer: { expr: '(x - 3)^10', positiveOnly: true } }, expand(1, -3, 10), true);
}

// ── Once XFAIL, now refused · 5 cases ────────────────────────────────────────
// Each is the key plus a term below one part in 10⁹ of the answer's value at
// every probe point, which binary64 sampling could not see. The exact probe
// (rationals, no rounding) sees it (#992 review, round 5).
{
  const G = 'formerly-XFAIL-exact-probe';
  for (const [id, d, seed, input] of [
    ['me12-calc', 1, 7001, '(x^2 + 9)^3 + 0.0000001*x'],
    ['me12-calc', 1, 7002, '(x^2 + 9)^6/3 + 0.0000001*x'],
    ['me12-calc', 1, 7002, '(x^2 + 9)^6/3 + 0.00001*x'],
    ['y11-diff', 1, 7002, '64*x^7 + 0.0000001*x'],
    ['y12-diff', 1, 7001, '20*(5*x - 6)^3 + 0.0000001*x']
  ]) expect(G, `refused-${id}-${input.slice(0, 30)}`, generateQuestion(id, d, seed), input, false);
}

// ── Counts are part of the contract ─────────────────────────────────────────
const EXPECTED = { 'q1-round2-precision': 92, 'q1-round1-holdouts': 22, 'q1-round1-labels': 11, 'sympy-oracle-2026-11-18': 60, 'sympy-oracle-2026-11-18-controls': 1087, 'formerly-XFAIL-exact-probe': 5 };
for (const [g, n] of Object.entries(EXPECTED)) if (groups[g]?.total !== n) failures.push(`${g}: built ${groups[g]?.total} cases, the corpus has ${n}`);

const pass = Object.values(groups).reduce((s, g) => s + g.pass, 0);
const total = Object.values(groups).reduce((s, g) => s + g.total, 0);
const summary = Object.entries(groups).map(([g, v]) => `${g} ${v.pass}/${v.total}`).join(' · ');
if (failures.length) {
  console.error(`ADVERSARIAL CORPUS: FAIL — ${failures.length} problem(s); ${summary}`);
  for (const f of failures) console.error('  · ' + f);
  process.exit(1);
}
console.log(`ADVERSARIAL CORPUS: PASS — ${pass}/${total} checks — ${summary}. [SYNTHETIC: direct checker on generated questions]`);
