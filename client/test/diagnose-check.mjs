// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Step-diagnosis suite
//
// Two halves, and the second one is the one that matters.
//
//   NAMED    authored missteps that the engine should recognise by name. These
//            are hand-written cases, not student data — the suite is a
//            regression gate on the catalogue, and says nothing about how often
//            a real student's slip is one of these. Nothing here is a
//            product-accuracy claim.
//   SOUND    steps that are mathematically correct. Every one of these must
//            come back with NO diagnosis. A marker that invents a mistake in
//            correct working is worse than one that stays quiet, so this half
//            is a hard gate: one false positive fails the suite.
// ─────────────────────────────────────────────────────────────────────────────
import { diagnoseStep, stepTrapKey, DIAGNOSIS_CODES } from '../src/engine/diagnose.js';
import { stepCheck, checkAnswer } from '../src/engine/checker.js';

// The floor the sweep must hold. Set at what the engine measures today, so a
// regression that costs even one case fails the suite rather than passing quietly.
const SWEEP_FLOOR = 1.0;

let pass = 0, fail = 0;
const failures = [];
const ok = (label, cond) => { if (cond) pass++; else { fail++; failures.push(label); } };
const same = (label, got, want) => ok(`${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`, got === want);

// ── NAMED: [previous true line, the line that breaks, stepMeta, expected code]
const NAMED = [
  // moving a term across the equals sign
  ['3x + 5 = 20', '3x = 20 + 5', null, 'sign-on-transfer'],
  ['5x - 2 = 13', '5x = 11', null, 'sign-on-transfer'],
  ['2x - 7 = 9', '2x = 9 - 7', null, 'sign-on-transfer'],
  ['y + 12 = 30', 'y = 30 + 12', null, 'sign-on-transfer'],
  ['2x + 3y = 12', '2x = 12 + 3y', null, 'sign-on-transfer'],

  // expanding brackets
  ['2(x + 4) = 18', '2x + 4 = 18', null, 'distribute-partial'],
  ['3(2x - 5)', '6x - 5', null, 'distribute-partial'],
  ['5(a + b + 2)', '5a + b + 2', null, 'distribute-partial'],
  ['10 - (x + 3)', '10 - x + 3', null, 'distribute-sign'],
  ['4x - (2x - 7)', '4x - 2x - 7', null, 'distribute-sign'],

  // indices
  ['(a + b)^2', 'a^2 + b^2', null, 'power-of-sum'],
  ['(x + 3)^2', 'x^2 + 9', null, 'power-of-sum'],
  ['(-3)^2', '-9', null, 'negative-squared'],
  ['(x^2)^3', 'x^5', null, 'power-of-power'],
  ['x^3 * x^4', 'x^12', null, 'power-product'],

  // surds and logs
  ['sqrt(x + 9)', 'sqrt(x) + 3', null, 'function-of-sum'],
  ['sqrt(9 + 16)', '3 + 4', null, 'function-of-sum'],

  // fractions
  ['1/2 + 1/3', '2/5', null, 'fraction-across'],
  ['x/3 + x/4', '2x/7', null, 'fraction-across'],
  ['(x + 6)/2', 'x + 3', null, 'cancel-over-sum'],
  ['(2x + 4)/2', '2x + 2', null, 'cancel-over-sum'],

  // solutions thrown away
  ['x^2 = 9', 'x = 3', { kind: 'equation', variable: 'x', solutions: [3, -3] }, 'lost-root'],
  ['x^2 = 5x', 'x = 5', { kind: 'equation', variable: 'x', solutions: [0, 5] }, 'divided-by-variable'],

  // one side treated differently from the other
  ['3x = 12', 'x = 12', null, 'one-side-only'],
  ['x + 5 = 9', 'x = 9', null, 'one-side-only'],
  ['4x + 7 = 31', '4x = 25', null, 'sides-mismatched'],
  ['x/4 = 6', 'x = 10', null, 'sides-mismatched'],

  // the method held and one number did not
  ['3x + 12 = 30', '3x + 12 = 40', null, 'arithmetic-slip'],
  ['2(x + 5)', '2x + 11', null, 'arithmetic-slip'],
  ['6 * 4', '6 + 4', null, 'operator-swapped'],

  // a term or a sign lost while re-copying
  ['3x + 2y + 5', '3x + 5', null, 'term-dropped'],
  ['x^2 - 4x + 3', 'x^2 - 4x - 3', null, 'sign-flipped'],
  ['2/x', 'x/2', null, 'reciprocal-flip'],
  ['3a + 2 = 11', '3b + 2 = 11', null, 'variable-swapped'],

  // nothing in the catalogue fits — say why it is false instead of guessing
  ['3x + 2', '7x - 5', null, 'counterexample']
];

// ── SOUND: correct steps. Any diagnosis at all is a false positive.
const SOUND = [
  ['3x + 5 = 20', '3x = 15', null],
  ['3x = 15', 'x = 5', null],
  ['2(x + 4) = 18', '2x + 8 = 18', null],
  ['(a + b)^2', 'a^2 + 2ab + b^2', null],
  ['(x + 3)^2', 'x^2 + 6x + 9', null],
  ['1/2 + 1/3', '5/6', null],
  ['x/3 + x/4', '7x/12', null],
  ['(x + 6)/2', 'x/2 + 3', null],
  ['(2x + 4)/2', 'x + 2', null],
  ['x^3 * x^4', 'x^7', null],
  ['(x^2)^3', 'x^6', null],
  ['4x + 7 = 31', '4x = 24', null],
  ['4x = 24', 'x = 6', null],
  ['sqrt(9 + 16)', '5', null],
  ['10 - (x + 3)', '7 - x', null],
  ['(-3)^2', '9', null],
  ['x/4 = 6', 'x = 24', null],
  ['5x - 2 = 13', '5x = 15', null],
  ['2x - 7 = 9', '2x = 16', null],
  ['x^2 = 9', 'x = 3 or x = -3', { kind: 'equation', variable: 'x', solutions: [3, -3] }],
  ['(x + 2)(x + 3)', 'x^2 + 5x + 6', null],
  ['3(2x - 5)', '6x - 15', null]
];

console.log('NAMED — authored missteps, one per catalogue entry\n');
let named = 0;
for (const [prev, broken, meta, want] of NAMED) {
  const d = diagnoseStep({ prevText: prev, brokenText: broken, meta });
  const got = d?.code || null;
  if (got === want) named++;
  ok(`${prev}  →  ${broken}  [${want}] — got ${got}`, got === want);
  console.log(`  ${got === want ? '✓' : '✗'} ${prev}  →  ${broken}`);
  console.log(`      ${d ? `${d.code}: ${d.message}` : 'no diagnosis'}`);
}

console.log('\nSOUND — correct steps that must not be diagnosed\n');
let clean = 0;
for (const [prev, broken, meta] of SOUND) {
  const d = diagnoseStep({ prevText: prev, brokenText: broken, meta });
  if (!d) clean++;
  ok(`false positive on a correct step: ${prev} → ${broken} — ${d?.code || ''}`, !d);
  if (d) console.log(`  ✗ ${prev}  →  ${broken}\n      invented: ${d.code}: ${d.message}`);
}
console.log(`  ${clean}/${SOUND.length} correct steps left alone`);

// ── SWEEP: the same mistakes, over numbers nobody chose by hand ──────────────
// The table above is 35 cases a person wrote, which measures the catalogue
// against its own author. This half builds each mistake mechanically out of
// seeded random coefficients, so a rule that only works on the numbers it was
// written against shows up here. Collisions are real and are counted as misses:
// with some coefficients two different mistakes land on the same line, and the
// engine cannot be right about both.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const SWEEP = [
  ['sign-on-transfer', r => { const [a, b, c] = [2 + r(6), 2 + r(9), 20 + r(30)]; return [`${a}x + ${b} = ${c}`, `${a}x = ${c} + ${b}`, null]; }],
  ['sign-on-transfer', r => { const [a, b, c] = [2 + r(6), 2 + r(9), 20 + r(30)]; return [`${a}x - ${b} = ${c}`, `${a}x = ${c} - ${b}`, null]; }],
  ['distribute-partial', r => { const [a, b] = [2 + r(7), 2 + r(9)]; return [`${a}(x + ${b}) = ${a * (b + 3)}`, `${a}x + ${b} = ${a * (b + 3)}`, null]; }],
  ['distribute-sign', r => { const [a, b] = [10 + r(20), 2 + r(9)]; return [`${a} - (x + ${b})`, `${a} - x + ${b}`, null]; }],
  ['power-of-sum', r => { const a = 2 + r(8); return [`(x + ${a})^2`, `x^2 + ${a * a}`, null]; }],
  ['negative-squared', r => { const a = 2 + r(9); return [`(-${a})^2`, `-${a * a}`, null]; }],
  ['power-of-power', r => { const [a, b] = [2 + r(4), 3 + r(4)]; return [`(x^${a})^${b}`, `x^${a + b}`, null]; }],
  ['power-product', r => { const [a, b] = [2 + r(4), 3 + r(4)]; return [`x^${a} * x^${b}`, `x^${a * b}`, null]; }],
  ['function-of-sum', r => { const a = 2 + r(8); return [`sqrt(x + ${a * a})`, `sqrt(x) + ${a}`, null]; }],
  ['fraction-across', r => { const [a, b] = [2 + r(7), 3 + r(7)]; return a === b ? null : [`1/${a} + 1/${b}`, `2/${a + b}`, null]; }],
  ['cancel-over-sum', r => { const [a, b] = [2 + r(7), 2 + r(9)]; return [`(x + ${a * b})/${a}`, `x + ${b}`, null]; }],
  ['one-side-only', r => { const [a, b] = [2 + r(8), 2 + r(9)]; return [`${a}x = ${a * b}`, `x = ${a * b}`, null]; }],
  ['term-dropped', r => { const [a, b, c] = [2 + r(7), 2 + r(7), 2 + r(9)]; return [`${a}x + ${b}y + ${c}`, `${a}x + ${c}`, null]; }],
  ['sign-flipped', r => { const [a, b] = [2 + r(8), 2 + r(9)]; return [`x^2 - ${a}x + ${b}`, `x^2 - ${a}x - ${b}`, null]; }],
  ['reciprocal-flip', r => { const a = 2 + r(9); return [`${a}/x`, `x/${a}`, null]; }],
  ['arithmetic-slip', r => { const [a, b] = [2 + r(7), 2 + r(9)]; return [`${a}(x + ${b})`, `${a}x + ${a * b + 1}`, null]; }],
  ['lost-root', r => { const a = 2 + r(9); return [`x^2 = ${a * a}`, `x = ${a}`, { kind: 'equation', variable: 'x', solutions: [a, -a] }]; }],
  ['divided-by-variable', r => { const a = 2 + r(9); return [`x^2 = ${a}x`, `x = ${a}`, { kind: 'equation', variable: 'x', solutions: [0, a] }]; }],
  // No wrapper on this one: adding the same constant to both sides stops the
  // left being a clean multiple of itself, so the wrapped line is a different
  // mistake from the one the row asserts. Counting it as a miss would be
  // measuring the wrapper, not the engine.
  ['sides-mismatched', r => { const [a, b] = [2 + r(7), 3 + r(9)]; return [`x/${a} = ${b}`, `x = ${b + a}`, null]; }, { bare: true }],
  ['variable-swapped', r => { const [a, b, c] = [2 + r(7), 2 + r(9), 20 + r(30)]; return [`${a}p + ${b} = ${c}`, `${a}q + ${b} = ${c}`, null]; }]
];

// Coefficients alone are a weak variation: these rules are mechanical, so a rule
// that works on 3(x + 4) works on 7(x + 9) by construction. What is not free is
// finding the mistake when it is buried in a longer line, written about a
// different letter, or on the far side of the equals sign — so every draw is
// also put through one of those.
function context(mode, prev, broken, meta, r) {
  if (mode === 1) {
    const k = 1 + r(9);
    if (prev.includes('=')) {
      const [pl, pr] = prev.split('=');
      const [bl, br] = broken.split('=');
      return [`${pl.trim()} + ${k} = ${pr.trim()} + ${k}`, `${bl.trim()} + ${k} = ${br.trim()} + ${k}`, meta];
    }
    return [`${prev} + ${k}`, `${broken} + ${k}`, meta];
  }
  if (mode === 2) {
    const name = ['t', 'n', 'w', 'u'][r(4) - 1];
    if (!prev.includes('x')) return [prev, broken, meta];
    const swap = s => s.replace(/x/g, name);
    return [swap(prev), swap(broken), meta ? { ...meta, variable: meta.variable === 'x' ? name : meta.variable } : null];
  }
  if (mode === 3 && prev.includes('=') && broken.includes('=')) {
    const flip = s => { const [l, r2] = s.split('='); return `${r2.trim()} = ${l.trim()}`; };
    return [flip(prev), flip(broken), meta];
  }
  return [prev, broken, meta];
}

console.log('\nSWEEP — each mistake rebuilt on seeded random coefficients, in random context\n');
const PER = 40;
let sweepHit = 0, sweepRun = 0;
const misses = [];
const perCode = new Map();
for (const [want, make, opts] of SWEEP) {
  let hit = 0, run = 0;
  for (let seed = 1; seed <= PER; seed++) {
    const r0 = rng(seed * 7919 + want.length);
    const draw = n => 1 + Math.floor(r0() * n);
    const built = make(draw);
    if (!built) continue;
    const mode = opts?.bare ? 0 : seed % 4;
    const [prev, broken, meta] = context(mode, built[0], built[1], built[2], draw);
    run++; sweepRun++;
    let got = null;
    try { got = diagnoseStep({ prevText: prev, brokenText: broken, meta })?.code || null; } catch { got = 'threw'; }
    if (got === want) { hit++; sweepHit++; }
    else if (misses.length < 12) misses.push(`${want}: ${prev} → ${broken} gave ${got}`);
  }
  const prevCount = perCode.get(want) || { hit: 0, run: 0 };
  perCode.set(want, { hit: prevCount.hit + hit, run: prevCount.run + run });
}
for (const [code, { hit, run }] of perCode) {
  console.log(`  ${hit === run ? '✓' : hit >= run * 0.9 ? '·' : '✗'} ${code.padEnd(20)} ${hit}/${run}`);
}
const sweepRate = sweepHit / sweepRun;
console.log(`  ${sweepHit}/${sweepRun} named (${(sweepRate * 100).toFixed(1)}%)`);
if (misses.length) {
  console.log('  misses (first few):');
  for (const m of misses) console.log(`    ${m}`);
}


// ── SOUNDNESS SWEEP: correct algebra, generated rather than chosen ───────────
// This is the number that matters. Naming a mistake that is really there is
// useful; naming one that is not is worse than saying nothing, because the
// student goes and "fixes" correct working. The mistake sweep above is close to
// tautological — it applies the very rewrites the catalogue was written to
// recognise — but this half is not: these are true identities and valid steps,
// and any diagnosis at all is a defect. It can fail, and it has: an equivalence
// test that samples can decide a true identity is false, and the diagnoser
// would then invent a reason for a line that was never wrong.
const VALID = [
  r => { const [a, b, c] = [2 + r(8), 2 + r(9), 30 + r(40)]; return [`${a}x + ${b} = ${c}`, `${a}x = ${c - b}`, null]; },
  r => { const [a, b, c] = [2 + r(8), 2 + r(9), 30 + r(40)]; return [`${a}x - ${b} = ${c}`, `${a}x = ${c + b}`, null]; },
  r => { const [a, b] = [2 + r(8), 2 + r(9)]; return [`${a}x = ${a * b}`, `x = ${b}`, null]; },
  r => { const [a, b] = [2 + r(8), 2 + r(9)]; return [`x/${a} = ${b}`, `x = ${a * b}`, null]; },
  r => { const [a, b] = [2 + r(8), 2 + r(9)]; return [`${a}(x + ${b})`, `${a}x + ${a * b}`, null]; },
  r => { const [a, b] = [2 + r(8), 2 + r(9)]; return [`${a}(x - ${b})`, `${a}x - ${a * b}`, null]; },
  r => { const a = 2 + r(9); return [`(x + ${a})^2`, `x^2 + ${2 * a}x + ${a * a}`, null]; },
  r => { const [a, b] = [2 + r(7), 2 + r(9)]; return [`(x + ${a})(x + ${b})`, `x^2 + ${a + b}x + ${a * b}`, null]; },
  r => { const [a, b] = [2 + r(7), 3 + r(7)]; return a === b ? null : [`1/${a} + 1/${b}`, `${a + b}/${a * b}`, null]; },
  r => { const [a, b] = [2 + r(7), 2 + r(9)]; return [`(x + ${a * b})/${a}`, `x/${a} + ${b}`, null]; },
  r => { const [a, b] = [2 + r(4), 3 + r(4)]; return [`x^${a} * x^${b}`, `x^${a + b}`, null]; },
  r => { const [a, b] = [3 + r(4), 2 + r(2)]; return [`x^${a} / x^${b}`, `x^${a - b}`, null]; },
  r => { const [a, b] = [2 + r(8), 2 + r(9)]; return [`${a}x + ${b}x`, `${a + b}x`, null]; },
  r => { const a = 2 + r(8); return [`(x^2 - ${a * a})/(x - ${a})`, `x + ${a}`, null]; },
  r => { const a = 2 + r(8); return [`1/(x + ${a}) + 1/(x - ${a})`, `2x/(x^2 - ${a * a})`, null]; },
  r => { const [a, b] = [2 + r(8), 2 + r(8)]; return [`${a}/(x/${b})`, `${a * b}/x`, null]; },
  r => { const a = 2 + r(8); return [`sqrt(${a * a}) * x`, `${a}x`, null]; },
  r => { const [a, b] = [2 + r(8), 2 + r(9)]; return [`${a}x + ${b} = ${b} + ${a}x`, `${a}x = ${a}x`, null]; },
  r => { const [a, b, c] = [2 + r(6), 2 + r(6), 2 + r(9)]; return [`${a}(x + ${c}) + ${b}(x + ${c})`, `${a + b}(x + ${c})`, null]; },
  r => { const a = 2 + r(8); return [`x^2 = ${a * a}`, `x = ${a} or x = -${a}`, { kind: 'equation', variable: 'x', solutions: [a, -a] }]; }
];

console.log('\nSOUNDNESS SWEEP — generated correct steps, any diagnosis is a defect\n');
let sound = 0, soundRun = 0;
const invented = [];
for (let i = 0; i < VALID.length; i++) {
  for (let seed = 1; seed <= PER; seed++) {
    const r0 = rng(seed * 6151 + i * 131);
    const draw = n => 1 + Math.floor(r0() * n);
    const built = VALID[i](draw);
    if (!built) continue;
    const [prev, broken, meta] = context(seed % 4, built[0], built[1], built[2], draw);
    soundRun++;
    let d = null;
    try { d = diagnoseStep({ prevText: prev, brokenText: broken, meta }); } catch { d = { code: 'threw' }; }
    if (!d) sound++;
    else if (invented.length < 10) invented.push(`${prev} → ${broken} invented ${d.code}: ${d.message}`);
  }
}
console.log(`  ${sound}/${soundRun} left alone (${((1 - sound / soundRun) * 100).toFixed(2)}% false positive)`);
if (invented.length) {
  console.log('  invented (first few):');
  for (const m of invented) console.log(`    ${m}`);
}
ok(`no diagnosis invented on generated correct steps — ${soundRun - sound} of ${soundRun}`, sound === soundRun);


// ── The catalogue itself ────────────────────────────────────────────────────
console.log('\nCATALOGUE');
const expected = [...new Set(NAMED.map(c => c[3]))];
for (const code of expected) ok(`${code} is a real catalogue entry`, DIAGNOSIS_CODES.includes(code));
same('every catalogue code is covered by a case', DIAGNOSIS_CODES.filter(c => !expected.includes(c)).length, 0);
console.log(`  ${DIAGNOSIS_CODES.length} codes, ${expected.length} exercised by the table`);

// ── Integration: the report Step Check hands the UI ─────────────────────────
console.log('\nINTEGRATION');
const meta = { kind: 'equation', variable: 'x', solutions: [5] };
const report = stepCheck(meta, '3x + 5 = 20\n3x = 20 + 5\nx = 25/3');
same('the break is found', report.firstBreak, 1);
ok('the report carries a diagnosis', !!report.diagnosis);
same('the diagnosis names the move', report.diagnosis?.code, 'sign-on-transfer');
ok('the broken line carries it too', !!report.lines[1].diagnosis);
ok('the note is the diagnosis, not boilerplate', /kept its sign/.test(report.lines[1].note || ''));

const clean2 = stepCheck(meta, '3x + 5 = 20\n3x = 15\nx = 5');
same('sound working has no break', clean2.firstBreak, -1);
same('sound working has no diagnosis', clean2.diagnosis, null);

// ── Robustness: student input is not a well-formed corpus ───────────────────
console.log('\nROBUSTNESS');
for (const junk of ['', '   ', '???', 'because I said so', '=', '((((', 'x = ', '3 +', null, undefined]) {
  let threw = false;
  try { diagnoseStep({ prevText: '3x = 12', brokenText: junk, meta: null }); } catch { threw = true; }
  ok(`survives ${JSON.stringify(junk)}`, !threw);
}
let threw = false;
try { diagnoseStep({}); diagnoseStep({ brokenText: 'x = 1', meta: { kind: 'equation' } }); } catch { threw = true; }
ok('survives a missing previous line and a half-built meta', !threw);

// ── Ratio input authority regression ────────────────────────────────────────
console.log('\nRATIO INPUT AUTHORITY');
const ratioQuestion = { answerType: 'ratio', answer: { a: 2, b: 3 } };
for (const valid of ['2:3', '4:6', '2 to 3', '2/3']) {
  ok(`accepts valid two-part ratio ${valid}`, checkAnswer(ratioQuestion, valid).correct === true);
}
for (const malformed of ['2:3:999', '2/3/999', '2::3', '2:', ':3', '2:3/4']) {
  ok(`rejects malformed ratio ${malformed}`, checkAnswer(ratioQuestion, malformed).correct === false);
}

// ── Trap keys ───────────────────────────────────────────────────────────────
console.log('\nTRAP KEYS');
same('a key is stable across questions', stepTrapKey('y9-linear', 'sign-on-transfer'), stepTrapKey('y9-linear', 'sign-on-transfer'));
ok('a key is scoped by subtopic', stepTrapKey('y9-linear', 'sign-on-transfer') !== stepTrapKey('y8-linear', 'sign-on-transfer'));
same('no subtopic, no key', stepTrapKey(null, 'sign-on-transfer'), null);
same('no code, no key', stepTrapKey('y9-linear', null), null);
ok('a key carries no digits from the question', !/\d/.test(stepTrapKey('y9-linear', 'sign-on-transfer').split('.').pop()));

console.log(`\nNamed ${named}/${NAMED.length} authored missteps — authored cases, not student data.`);
console.log(`Sweep ${sweepHit}/${sweepRun} (${(sweepRate * 100).toFixed(1)}%) over seeded random coefficients, ${SWEEP.length} mistakes × ${PER} draws.`);
console.log(`False positives ${(SOUND.length - clean) + (soundRun - sound)}/${SOUND.length + soundRun} — ${SOUND.length - clean} on authored correct steps, ${soundRun - sound} on generated ones.`);
console.log(`The mistake sweep applies the rewrites the catalogue was written for, so 100% there is close to tautological; the false-positive number is the one that carries information, and neither says anything about how often a real student's slip is one of the ${SWEEP.length} the catalogue knows.`);
console.log('None of these is a claim about real student working: no student handwriting or typing has been scored by this engine.');
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
ok(`sweep floor ${(SWEEP_FLOOR * 100).toFixed(1)}% — got ${(sweepRate * 100).toFixed(1)}%`, sweepRate >= SWEEP_FLOOR);
const gateOk = clean === SOUND.length && sound === soundRun && named === NAMED.length && sweepRate >= SWEEP_FLOOR && !fail;
console.log(`\n${gateOk ? '✔ DIAGNOSIS SUITE PASSED' : '✖ DIAGNOSIS SUITE FAILED'} — ${pass}/${pass + fail} checks`);
process.exit(gateOk ? 0 : 1);