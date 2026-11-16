// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · D13 and D14 — interim marking policies, pinned
//
// Owner defaults (docs/release/V1_DECISIONS_2026-11-01.md), each interim until
// the examiner rules (#499):
//
//   D13  Unevaluated answers are refused. A numeric box accepts a single value,
//        a fraction, a mixed number, a surd or a multiple of π, and refuses
//        anything with an operation left to do.
//   D14  Units. A bare number passes where the box shows the unit; the right
//        unit in any spelling passes; a contradicting unit or currency is
//        refused.
//
// Every case is authored, except the generator sweep in section 3, which
// probes every numeric question of the India curriculum's banks with the key
// written as a sum or product still to do. SYNTHETIC: the checker, in-process.
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { unevaluatedRefusal } = await import(`${SRC}engine/checker-core.js`);
const { generateQuestion, loadAllBanks, GENERATORS } = await import(`${SRC}engine/generators/index.js`);
const { allGenerators } = await import(`${SRC}engine/curriculum-in.js`);
await loadAllBanks();

let pass = 0;
const failures = [];
const groups = {};
function check(group, cond, label) {
  groups[group] = (groups[group] || 0) + 1;
  if (cond) pass++; else failures.push(`${group} · ${label}`);
}
const verdict = (q, input) => { try { return checkAnswer(q, input); } catch (e) { return { correct: false, threw: e.message }; } };
const REFUSED = /Work it out first/;
const num = (value, extra = {}) => ({ answerType: 'numeric', answer: { value }, prompt: 'Find the value.', ...extra });

// ── 1. D13: what a numeric box takes ─────────────────────────────────────────
{
  const G = 'd13-accepted';
  for (const [value, inputs] of [
    [5, ['5', '+5', '5.0', '(5)', '{5}', 'x = 5', '10/2', '25/5']],
    [-5, ['-5', '−5', '-10/2', '10/-2']],
    [2.5, ['2.5', '5/2', '2 1/2', '10/4', '(5)/(2)', '2 (1)/(2)']],
    [-2.5, ['-2 1/2', '-5/2']],
    [0.75, ['0.75', '3/4', '75%', '6/8']],
    [120000, ['120000', '1.2e5', '1.2 × 10^5', '1.2*10^5', '120,000', '1,20,000']],
    [0.001, ['1 × 10^-3', '1*10^(-3)', '0.001', '10^-3', '10^(-3)', '10⁻³']],
    [1000, ['10^3', '1 × 10^3']],
    [10, ['10^1']],
    [Math.SQRT2, ['sqrt(2)', '√2', 'sqrt2', '√(2)', '2/√2', 'sqrt(8)/2']],
    [Math.SQRT1_2, ['1/√2', '√2/2', '1/sqrt(2)']],
    [3 * Math.SQRT2, ['3√2', '3sqrt(2)', '3*sqrt(2)', '√18', 'sqrt18']],
    [Math.sqrt(3) / 2, ['√3/2', 'sqrt(3)/2', '(1/2)√3']],
    [3 / (2 * Math.SQRT2), ['3/(2√2)', '3√2/4']],
    [Math.cbrt(2), ['cbrt(2)']],
    [2 * Math.PI, ['2π', '2pi', '2*pi', 'π*2', '4π/2']],
    [Math.PI / 3, ['π/3', 'pi/3', '(1/3)π', '1/3π']],
    [2 * Math.PI / 3, ['2π/3', '(2/3)π']],
    [1 / (2 * Math.PI), ['1/(2π)']],
    [Math.E, ['e']],
    [Math.LN2, ['ln 2', 'ln(2)']],
    [3 * Math.log(5), ['3ln(5)', '3 ln 5']],
    [2 + Math.sqrt(3), ['2 + √3', '√3 + 2', '2+sqrt(3)']],
    [(1 + Math.sqrt(5)) / 2, ['(1 + √5)/2', '(1+sqrt(5))/2']],
    [Math.sqrt(2) + Math.sqrt(3), ['√2 + √3']],
    [Math.PI / 2 + 1, ['π/2 + 1', '1 + π/2']],
    [1 / (1 + Math.SQRT2), ['1/(1 + √2)']],
    [-(2 + Math.sqrt(3)), ['-(2 + √3)', '-2 - √3']]
  ]) {
    for (const input of inputs.filter(Boolean)) {
      const r = verdict(num(value), input);
      check(G, r.correct === true, `${JSON.stringify(input)} is a value with nothing left to do, and is ${value} (got ${JSON.stringify(r)})`);
    }
  }
}
{
  const G = 'd13-refused';
  for (const [value, inputs] of [
    [5, ['2+3', '2 + 3', '7-2', '0 + 5', '5 + 0', '5*1', '1*5', '2*2.5', '2(2.5)', '(2+3)', '-(-2-3)', '3^2-4', '25^(1/2)', 'sqrt(25)', '√25', 'sqrt(5^2)', '2.5/0.5', '(10/2)/1', '10/2/1', '(1/2)/(1/10)', '5!/4!', '5C1', 'C(5,1)', 'nCr(5,1)', 'abs(-5)', 'log(100000)', '10/2 + 0', '5 + √2 - √2']],
    [8, ['2^3', '2³', '4*2', '8!/7!', '2*2*2', '64^(1/2)', 'cbrt(512)', 'cbrt(512)']],
    [2.5, ['2 + 1/2', '2+1/2', '5/2 + 0', '1/2*5']],
    [0.75, ['1 - 1/4', '1-1/4', '0.5 + 0.25', '3/4*1']],
    [12, ['3*4', '4C2*2', 'C(4,2)*2', '24/2*1', '2*6']],
    [Math.SQRT2, ['2^(1/2)', 'sqrt(2)*sqrt(1)', '√6/√3', '√2 + √2 - √2']],
    [3 * Math.SQRT2, ['√2+√2+√2', '√2 + √8']],
    [2 * Math.PI, ['pi+pi', 'π + π', '3π - π']],
    [Math.PI / 3, ['60*pi/180 + 0', 'π/2 - π/6']],
    [0.5, ['sin(pi/6)', 'cos(60)', 'tan(45) - 1/2']],
    [Math.log(6), ['ln 2 + ln 3', 'ln(2) + ln(3)']],
    [0, ['ln 1', 'ln(1)', '5 - 5']],
    [1, ['ln(e)', 'log(10)', 'e^0']],
    [10, ['5+5', '(3+2)*2', '(10)^1', '10 + 0', '0 + 10']],
    [1000, ['10^2 * 10', '1*10^3*1', '10^3 + 0', '2 × 500', '10^(1.5*2)']]
  ]) {
    for (const input of inputs.filter(Boolean)) {
      const r = verdict(num(value), input);
      check(G, r.correct === false && r.invalid === true && REFUSED.test(r.feedback || ''), `${JSON.stringify(input)} still has an operation to do and is refused, though it equals ${value} (got ${JSON.stringify(r)})`);
    }
  }
}
// The refusal depends on the written form alone: the same input gets the same
// reply whatever the key, so it says nothing about the answer.
{
  const G = 'd13-key-blind';
  for (const input of ['2+3', '3^2-4', 'sqrt(25)', '5C2', 'π + π', '2 + 1/2']) {
    const replies = [5, 6, 10, Math.PI, 0.5, -7].map(value => JSON.stringify(verdict(num(value), input)));
    check(G, new Set(replies).size === 1, `${JSON.stringify(input)} gets one reply whatever the key (${[...new Set(replies)].join(' | ')})`);
  }
  check(G, unevaluatedRefusal('2+3') === unevaluatedRefusal('100+3'), 'the refusal text names no value');
}
// D13 reads numbers only. Letters are for the reader to refuse; other answer
// types keep their own rules.
{
  const G = 'd13-scope';
  check(G, unevaluatedRefusal('x + 1') === null, 'a letter is not a number at all: the reader, not D13, answers it');
  check(G, unevaluatedRefusal('') === null && unevaluatedRefusal('   ') === null, 'a blank answer is not D13\'s to refuse');
  check(G, unevaluatedRefusal('1 + ') === null, 'an expression the parser cannot read is the reader\'s to refuse');
  const expr = { answerType: 'expression', answer: { expr: 'x^2+2*x+1' }, prompt: 'Expand $(x+1)^2$.' };
  check(G, verdict(expr, 'x^2 + 2x + 1').correct === true, 'an expression answer is still a sum');
  const set = { answerType: 'set', answer: { values: [2, -3] } };
  check(G, verdict(set, 'x = 2, x = -3').correct === true, 'a solution set is still read');
  // A sum as long as the route accepts is refused at once, without recursion.
  let long = '1';
  while (long.length < 3000) long += '+1';
  const at = performance.now();
  const r = verdict(num(1500), long);
  check(G, r.correct === false && (performance.now() - at) < 1000, `a sum of 1,500 ones is refused quickly (${Math.round(performance.now() - at)} ms), never credited`);
  check(G, unevaluatedRefusal(long) !== null, 'and refused as unevaluated, not overflowed');
}

// ── 2. D14: units ────────────────────────────────────────────────────────────
{
  const G = 'd14-units';
  const cases = [
    [{ value: 12, answerSuffix: 'cm', prompt: 'Find the length.' },
      { pass: ['12', '12 cm', '12cm', '12 CM', '12 cms', '12 cms.', '12 Cms', '12 centimetre', '12 centimetres', '12 centimeter', '12 centimeters'],
        refuse: ['12 m', '12 mm', '12 km', '12 kg', '12 cm²', '₹12', 'Rs 12', '12 rupees', '$12', '12 dollars', '€12', '12 USD'] }],
    [{ value: 50, answerSuffix: 'cm²', prompt: 'Find the area.' },
      { pass: ['50', '50 cm²', '50 cm^2', '50 cm2', '50 sq cm', '50 sq. cm', '50 sq.cm', '50 sq cms', '50 square centimetres', '50 sq. centimetres'],
        refuse: ['50 cm', '50 m²', '50 cm³', '50 sq m'] }],
    [{ value: 2, answerSuffix: 'cm³', prompt: 'Find the volume.' },
      { pass: ['2', '2 cm³', '2 cm^3', '2 cm3', '2 cc', '2 cu cm', '2 cu. cm', '2 cubic centimetres'],
        refuse: ['2 cm²', '2 m³', '2 ml'] }],
    [{ value: 60, answerSuffix: 'km/h', prompt: 'Find the speed.' },
      { pass: ['60', '60 km/h', '60 km/hr', '60 kmph', '60 km per hour', '60 kilometres per hour', '60 kms per hour'],
        refuse: ['60 m/s', '60 km', '60 h'] }],
    [{ value: 5, answerSuffix: 'kg', prompt: 'Find the mass.' },
      { pass: ['5', '5 kg', '5 kgs', '5 kilograms'], refuse: ['5 g', '5 gms', '5 cm', '5 l'] }],
    [{ value: 5, answerSuffix: 'g', prompt: 'Find the mass.' },
      { pass: ['5 g', '5 gm', '5 gms', '5 grams'], refuse: ['5 kg'] }],
    [{ value: 2, answerSuffix: 'litres', prompt: 'Find the volume.' },
      { pass: ['2', '2 l', '2 L', '2 litres', '2 liters', '2 ltr', '2 ltrs'], refuse: ['2 ml', '2 mls', '2 kg'] }],
    [{ value: 3, answerSuffix: 'hours', prompt: 'Find the time taken.' },
      { pass: ['3', '3 h', '3 hr', '3 hrs', '3 hours'], refuse: ['3 minutes', '3 mins', '3 s'] }],
    [{ value: 30, answerSuffix: '°', prompt: 'Find the angle.' },
      { pass: ['30', '30°', '30 degrees', '30 deg'], refuse: ['30 rad', '30 cm'] }],
    [{ value: 24, prompt: 'A rectangle is 8 cm by 4 cm. Find its perimeter.' },
      { pass: ['24', '24 cm', '24 cms', '24 centimetres'], refuse: ['24 m', '24 kg', '$24', '₹24'] }]
  ];
  for (const [q, { pass: ok, refuse }] of cases) {
    const question = { answerType: 'numeric', answer: { value: q.value }, answerSuffix: q.answerSuffix, prompt: q.prompt };
    for (const input of ok) check(G, verdict(question, input).correct === true, `${q.answerSuffix || 'no unit box'}: "${input}" is the right unit (or none) and passes`);
    for (const input of refuse) check(G, verdict(question, input).correct === false, `${q.answerSuffix || 'no unit box'}: "${input}" contradicts the question's unit and is refused`);
  }
}
{
  const G = 'd14-currency';
  for (const question of [
    { answerType: 'numeric', answer: { value: 500 }, answerPrefix: '₹', prompt: 'Find the cost.' },
    { answerType: 'numeric', answer: { value: 500 }, prompt: 'A pen costs ₹100. Find the cost of five pens.' },
    { answerType: 'numeric', answer: { value: 500 }, prompt: 'A pen costs Rs. 100/-. Find the cost of five pens.' }
  ]) {
    for (const input of ['500', '₹500', '₹ 500', '₹500.00', 'Rs 500', 'Rs. 500', 'Rs.500', '500 Rs', '500 rupees', 'INR 500', '₹500/-', 'Rs. 500/-', '500/-', '50000 paise', '$500$']) {
      check(G, verdict(question, input).correct === true, `${question.answerPrefix || 'rupees in the prompt'}: "${input}" is rupees, or no currency, and passes`);
    }
    for (const input of ['$500', '$ 500', '500$', 'US$500', '500 dollars', '500 dollar', '€500', '£500', '¥500', 'USD 500', '500 USD', '500 euros', '500 cents', '500 paise']) {
      check(G, verdict(question, input).correct === false, `${question.answerPrefix || 'rupees in the prompt'}: "${input}" is another currency (or another amount) and is refused`);
    }
  }
  // A bank priced in dollars (an NSW bank, outside the India covers) reads its own sign.
  const dollars = { answerType: 'numeric', answer: { value: 12.5 }, answerPrefix: '$', prompt: 'Find the price.' };
  check(G, verdict(dollars, '$12.50').correct === true, 'a bank priced in dollars still reads "$12.50"');
  check(G, verdict(dollars, '₹12.50').correct === false, 'and refuses rupees there');
}

// ── 3. D13 over the India curriculum's banks ────────────────────────────────
// Every numeric question the India covers can serve: its key is accepted, and
// the key written as a sum or a product still to do is refused.
let swept = 0, probes = 0;
{
  const G = 'd13-sweep';
  const india = allGenerators().filter(id => GENERATORS[id]);
  for (const id of india) {
    for (let d = 1; d <= 4; d++) for (const seed of [11, 4242, 90001]) {
      let q;
      try { q = generateQuestion(id, d, seed); } catch { continue; }
      if (!q || q.answerType !== 'numeric' || !Number.isFinite(q.answer?.value)) continue;
      swept++;
      const v = q.answer.value;
      if (!Number.isInteger(v) || Math.abs(v) > 1e9 || q.answer.forbid) continue;
      // The value with its % or unit, as the question asks it, is not the point here:
      // these probes carry no unit, and a percentage question reads them as its unit.
      for (const input of [`${v - 1} + 1`, `${v + 3} - 3`, `${v} * 1`, `2 * ${v / 2}`, `(${v})^1`]) {
        probes++;
        const r = verdict(q, input);
        check(G, r.correct !== true, `${id} D${d} seed ${seed}: "${input}" (key ${v}) is never credited`);
      }
    }
  }
  check(G, swept > 500, `the sweep reached the India banks (${swept} numeric questions)`);
}

const summary = Object.entries(groups).map(([g, n]) => `${g} ${n}`).join(' · ');
console.log(failures.length
  ? `INTERIM MARKING POLICY (D13, D14): FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.slice(0, 40).join('\n  · ')}`
  : `INTERIM MARKING POLICY (D13, D14): PASS — ${pass}/${pass} checks — ${summary}; ${probes} unevaluated keys across ${swept} India numeric questions, none credited. [SYNTHETIC: direct checker]`);
if (failures.length) process.exit(1);
