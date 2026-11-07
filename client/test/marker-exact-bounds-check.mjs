// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · exact bounds, bound variables and whole-number keys (#680)
//
// Each pin below was a full-credit award for a mathematically different answer
// on main a5778a319, run against the real, unmodified checker:
//   · an interval endpoint compared with the numeric-answer rounding band, so
//     x > 999999999.9375 was x > 1000000000;
//   · an endpoint literal beyond binary64 precision read as its neighbour;
//   · any letter accepted as the variable ("y > 3" for a set in x, a set-builder
//     binding y over a condition on x, mixed letters in one chain);
//   · a run of signs in an i/j/k vector read with the first sign dropped;
//   · a whole-number key forgiving a non-integer decimal once |key| ≥ 10^6
//     (a |b|·1e-9 band capped at 0.25), reachable on three served generators.
// The valid controls beside them must keep their credit.
// Synthetic evidence only: direct checker calls, no student or HTTP traffic.
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);

let pass = 0, fail = 0;
const failures = [];
function expect(label, question, input, want) {
  let got;
  try { got = !!checkAnswer(question, input)?.correct; } catch (e) { got = `threw ${e.message}`; }
  if (got === want) pass++;
  else { fail++; failures.push(`${label}: ${JSON.stringify(input)} → ${got}, expected ${want}`); }
}
const iv = (region, variable = 'x', extra = {}) => ({ answerType: 'interval', answer: { region, variable, ...extra } });

// ── 1 · endpoints are exact ──────────────────────────────────────────────────
expect('shifted bound', iv('x > 1000000000'), 'x > 999999999.9375', false);
expect('shifted bound', iv('x > 1000000000'), 'x > 1000000000.2', false);
expect('shifted bound', iv('x <= 300000000'), 'x <= 300000000.2', false);
expect('shifted bound', iv('2 < x <= 5'), '2.0000001 < x <= 5', false);
expect('rounded irrational bound', iv('x > sqrt(2)'), 'x > 1.4142', false);
expect('exact bound', iv('x > 1000000000'), 'x > 1000000000', true);
expect('exact bound, other spelling', iv('x > 1000000000'), '(10^9, inf)', true);
expect('exact irrational bound', iv('x > sqrt(2)'), 'x > sqrt(2)', true);
expect('exact rational bound', iv('x < 2/3'), 'x < 4/6', true);
expect('decimal of a terminating bound', iv('x <= 5/2'), 'x <= 2.5', true);
expect('authored approximate bound', iv('x > sqrt(2)', 'x', { tol: 0.001 }), 'x > 1.4142', true);
expect('authored approximate bound, outside', iv('x > sqrt(2)', 'x', { tol: 0.001 }), 'x > 1.41', false);
expect('endpoint inclusion still named', iv('x >= 3'), 'x > 3', false);

// A quadratic irrational is an EXACT boundary, not four ULP of wiggle room.
// Canonical square-root equivalence remains valid, including rational scales.
expect('radical micro-shift', iv('x > sqrt(2)'), 'x > sqrt(2)+0.000000000000001', false);
expect('radical micro-shift negative', iv('x > sqrt(2)'), 'x > sqrt(2)-0.000000000000001', false);
expect('radical scaled alternative', iv('x > sqrt(2)'), 'x > sqrt(8)/2', true);
expect('rational root alternative', iv('x > sqrt(1/4)'), 'x > 1/2', true);
expect('radical sums commute', iv('x > sqrt(2)+sqrt(3)'), 'x > sqrt(3)+sqrt(2)', true);

// Missing union/intersection operands are syntax errors, not removable
// decoration. Never accept by silently filtering empty list items.
for (const malformed of ['x>3 |','| x>3','x>3 | |','x>3 &','& x>3','x>3 and','x>3 or','x>3 &&','x>3 or or x>3']) {
  expect('empty region operand', iv('x>3'), malformed, false);
}
expect('valid repeated intersection', iv('x>3'), 'x>3 & x>3', true);
expect('valid repeated union', iv('x>3'), 'x>3 or x>3', true);

// ── 2 · literals a binary64 cannot hold are refused, never rounded ──────────
expect('beyond 2^53', iv('x > 9007199254740992'), 'x > 9007199254740993', false);
expect('long decimal', iv('x > 1'), 'x > 1.0000000000000001', false);
expect('large exact power of ten', iv('x > 10000000000000000'), 'x > 10000000000000000', true);

// ── 3 · the variable is the asked one ───────────────────────────────────────
expect('wrong variable', iv('x > 3'), 'y > 3', false);
expect('wrong variable, reversed', iv('x > 3'), '3 < y', false);
expect('mixed letters in a chain', iv('2 < x <= 5'), '2 < y <= 5', false);
expect('mixed letters across &', iv('2 < x <= 5'), '2 < x & y <= 5', false);
expect('mixed letters across a union', iv('x < 2 | x > 5'), 'x < 2 | y > 5', false);
expect('membership in the wrong variable', iv('x > 3'), 'y in (3, inf)', false);
expect('binder over another letter', iv('x > 3'), '{y : x > 3}', false);
expect('binder over its own letter', iv('x > 3'), '{y : y > 3}', true);
expect('binder x', iv('x > 3'), '{x : x > 3}', true);
expect('membership x', iv('x > 3'), 'x ∈ (3, ∞)', true);
expect('interval notation', iv('x > 3'), '(3, ∞)', true);
expect('reversed relation', iv('x > 3'), '3 < x', true);
expect('chain', iv('2 < x <= 5'), '(2, 5]', true);
expect('union', iv('x < 2 | x > 5'), '(-∞, 2) ∪ (5, ∞)', true);
expect('question in t', iv('t >= -1', 't'), 't >= -1', true);
expect('question in t, x given', iv('t >= -1', 't'), 'x >= -1', false);

// ── 4 · a run of signs in a vector is read by its parity ────────────────────
const vec = { answerType: 'vector', answer: { components: [1, -2, 3] } };
expect('double minus', vec, 'i - -2j + 3k', false);
expect('double minus, the value it is', { answerType: 'vector', answer: { components: [1, 2, 3] } }, 'i - -2j + 3k', true);
expect('plus minus', vec, 'i + -2j + 3k', true);
expect('plain', vec, 'i - 2j + 3k', true);
expect('list', vec, '(1, -2, 3)', true);

// ── 5 · a whole-number key is exact at every size ───────────────────────────
const num = value => ({ answerType: 'numeric', prompt: 'How many?', answer: { value } });
expect('1e8 key, decimal typed', num(100000000), '99999999.95', false);
expect('1e9 key, decimal typed', num(1000000000), '999999999.8', false);
expect('3.84e14 key, decimal typed', num(384000000000000), '384000000000000.2', false);
expect('1e9 key, grouped', num(1000000000), '1,000,000,000', true);
expect('1e9 key, power', num(1000000000), '10^9', true);
expect('3.84e12 key, scientific', num(3840000000000), '3.84*10^12', true);
expect('small key, float noise', num(3), '0.1*3*10', true);
expect('authored tol still applies', { answerType: 'numeric', answer: { value: 1000000000, tol: 0.5 } }, '999999999.8', true);

// ── 6 · a blank entry is refused, a nonempty interval is never erased (Q1) ──
const mat = { answerType: 'matrix', answer: { rows: [[1, 2], [3, 4]] } };
expect('matrix missing element', mat, '[[1,,2],[3,4]]', false);
expect('matrix doubled row separator', mat, '[1,2;;3,4]', false);
expect('matrix trailing comma', mat, '[[1,2,],[3,4]]', false);
expect('matrix nested', mat, '[[1,2],[3,4]]', true);
expect('matrix semicolons', mat, '[1 2; 3 4]', true);
expect('matrix rows on lines', mat, '1 2\n\n3 4', true);
const v3 = { answerType: 'vector', answer: { components: [1, 2, 3] } };
expect('vector blank component', v3, '(1,,2,3)', false);
expect('vector trailing comma', v3, '(1,2,3,)', false);
expect('vector', v3, '(1, 2, 3)', true);
expect('vector spaced', v3, '1  2  3', true);
expect('tiny nonempty interval is not "no solution"', iv('no solution'), '(0, 0.0000000000001)', false);
expect('tiny nonempty interval kept', iv('0 < x < 0.0000000000001'), '(0, 0.0000000000001)', true);
expect('point interval [3, 3] is {3}', iv('3 <= x <= 3'), '[3, 3]', true);
expect('(3, 3) is empty', iv('no solution'), '(3, 3)', true);
expect('gap kept between near touching pieces', iv('x < 1 | x > 1.0000000000001'), 'x < 1 | x > 1', false);

// ── 7 · a one-letter label names that letter, not an expression built on it ─
const lab = (prompt, value) => ({ answerType: 'numeric', prompt, answer: { value } });
expect('b = 10 for b²+1', lab('Given b is 3, find $b^2 + 1$.', 10), 'b = 10', false);
expect('b = 9 for 2b+1', lab('Suppose b is 4. Find $2b + 1$.', 9), 'b = 9', false);
expect('x = 11 for 2x+3', lab('Given x is 4, find $2x + 3$.', 11), 'x = 11', false);
expect('a = 6 for ab', lab('Given a is 2 and b is 3, find $ab$.', 6), 'a = 6', false);
expect('x = 10 for x²+3x', lab('Given x is 2. Evaluate $x^2 + 3x$.', 10), 'x = 10', false);
expect('x = 25 for 3x²−2', lab('Let x be 3. Find $3x^2 - 2$.', 25), 'x = 25', false);
expect('n = 20 for n − 18 (served form)', lab('If $n + 18 = 56$, what is the value of $n - 18$?', 20), 'n = 20', false);
expect('x = 14 for least x + 49/x (served form)', lab('For $x > 0$, find the least possible value of $x + \\dfrac{49}{x}$.', 14), 'x = 14', false);
expect('g = 7 for f(g(1)) (served form)', lab('If $f(x) = 2x + 1$ and $g(x) = x + 2$, evaluate $f(g(1))$.', 7), 'g = 7', false);
expect('y = 12 for dy/dx (served form)', lab('If $y = (3x^2 - 2)^{2}$, find $\\dfrac{dy}{dx}$ at $x = 1$.', 12), 'y = 12', false);
expect('D = 14 for DE (served form)', lab('In triangle $ABC$, $D$ and $E$ are the midpoints of $AB$ and $AC$. If $BC = 28$, find $DE$.', 14), 'D = 14', false);
expect('labelled with the asked expression', lab('Given b is 3, find $b^2 + 1$.', 10), 'b^2+1=10', true);
expect('labelled ab', lab('Given a is 2 and b is 3, find $ab$.', 6), 'ab = 6', true);
expect('bare key', lab('Given x is 4, find $2x+3$.', 11), '11', true);
expect('the asked letter itself', lab('If $3x + 4 = 19$, find $x$.', 5), 'x = 5', true);
expect('a function value named by its letter', lab('If $f(x) = 2x + 3$, find $f(2)$.', 7), 'f = 7', true);
const angle = lab('$\\angle PAB = 45^\\circ$ and $\\angle QAB = 53^\\circ$. Find $\\angle AQB$ in degrees.', 74);
expect('vertex of the asked angle', angle, 'Q = 74', true);
expect('another point of the asked angle', angle, 'A = 74', false);

// The three served generators where the band was reachable (main a5778a319).
await loadAllBanks();

// ── 8 · a chained inequality written twice is shown once ───────────────────
// c11-linear-inequalities: the claim reader holds no single relation for a
// chain, so its copy escaped the repeat rule and the same line earned 2 of 3.
{
  const { methodMarks } = await import(`${SRC}engine/checker.js`);
  const { stepMetaFor } = await import('../../server/platform/markerOps.js');
  const q = generateQuestion('c11-linear-inequalities', 3, 14);
  const meta = stepMetaFor(q);
  const awarded = working => methodMarks({ meta, working, marks: 3, prompt: q.prompt })?.awarded ?? 0;
  const pin = (label, got, want) => { if (got === want) pass++; else { fail++; failures.push(`${label}: awarded ${got}, expected ${want}`); } };
  pin('chain once', awarded('-16 \\le 4x \\le 0'), 1);
  pin('chain twice', awarded('-16 \\le 4x \\le 0\n-16 \\le 4x \\le 0'), 1);
  pin('chain three times in three spellings', awarded('-16 <= 4x <= 0\n-16 \\le 4x \\le 0\n−16 ≤ 4x ≤ 0'), 1);
  pin('two genuine steps', awarded('-16 \\le 4x \\le 0\n-4 \\le x \\le 0'), 2);
}
for (const [id, d, s] of [['c7-place-value-systems-reasoning', 1, 6], ['c7-rounding-bounds-reasoning', 1, 5], ['c8-exponents-ncert-mastery', 4, 1]]) {
  const q = generateQuestion(id, d, s);
  const v = q?.answer?.value;
  if (!(q?.answerType === 'numeric' && Number.isInteger(v) && Math.abs(v) >= 1e6 && q.answer.tol == null)) {
    fail++; failures.push(`${id} d${d} s${s}: expected a whole-number key ≥ 10^6 with no authored tol, got ${JSON.stringify(q?.answer)}`);
    continue;
  }
  expect(`${id} d${d} s${s} key`, q, String(v), true);
  expect(`${id} d${d} s${s} key + 0.2`, q, String(v + 0.2), false);
  expect(`${id} d${d} s${s} key − 0.01`, q, String(v - 0.01), false);
}

const total = pass + fail;
if (fail) {
  console.error(`EXACT BOUNDS: FAIL — ${fail} of ${total} checks`);
  for (const f of failures) console.error('  · ' + f);
  process.exit(1);
}
console.log(`EXACT BOUNDS: PASS — ${pass}/${total} checks — interval endpoints exact, unrepresentable literals refused, the bound variable enforced, vector sign runs read by parity, whole-number keys exact at every size.`);
