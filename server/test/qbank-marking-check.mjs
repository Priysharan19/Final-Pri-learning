// Pri Learning · how the author bank's answers are READ (server/platform/qbankMarking.js), over the committed pack
//
//   1. the answer box's own prefix: `dy/dx =`, `∫ =`, `f⁻¹(x) =`, `y' =` ... the accepted answer is marked correct typed with or without
//      its own label, spaced or not; a different left side is never the answer; a trap or a wrong value is as wrong as ever;
//   2. a named precision on an interval ("to two decimal places"): the key rounded as asked is the same answer; the next value up or down is not;
//   3. no precision named: a non-whole numeric key is accepted correctly rounded to 3 or more significant figures as typed, never fewer,
//      and never a value that is not the key's rounding at the figures typed (both sides of the boundary);
//   4. every reading goes through the real marker operation the practice route runs, and only a bank question gets them.
// SYNTHETIC: none; the owner's questions run against the engine. Not evidence about real students.
import './support/hermetic.mjs';
import fs from 'node:fs';
import path from 'node:path';

process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_QBANK_DIR;
const qb = await import('../platform/qbankPack.js');
const { checkBankAnswer, roundSignificant, roundPlaces, typedDecimal, acceptsRoundedFigures, readOwnPrefix } = await import('../platform/qbankMarking.js');
const { MARKER_OPS, markerView } = await import('../platform/markerOps.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
const { namedDecimalPlaces } = await import('../../client/src/engine/checker-core.js');
const { acceptedInput, trapInput } = await import('../../tools/qbank-import.mjs');

let pass = 0; const failures = [];
const ok = (cond, message) => { if (cond) pass++; else failures.push(message); };
const eq = (a, b, message) => ok(JSON.stringify(a) === JSON.stringify(b), `${message} (got ${JSON.stringify(a)})`);

await qb.ensureQbank(process.env, { strict: true });
const manifest = JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, 'manifest.json'), 'utf8'));
const entries = [];
for (const s of manifest.shards) for (const e of JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, s.name), 'utf8')).questions) entries.push(e);
const served = e => markerView(qb.qbankEntryQuestion(e.id, 17));

// ── 1. the prefix ────────────────────────────────────────────────────────────
{
  const prefixed = entries.filter(e => e.answerPrefix && e.answerPrefix.includes('=') && ['expression', 'numeric', 'set'].includes(e.answerType));
  let withLabel = 0, withoutLabel = 0, tight = 0, otherSide = 0, trapsWrong = 0, trapsTried = 0, hadBefore = 0, wrongRight = 0;
  const bad = [];
  for (const e of prefixed) {
    const q = served(e);
    const given = acceptedInput(e);
    const label = e.answerPrefix.trim();
    if (checkBankAnswer(q, `${label} ${given}`).correct === true) withLabel++; else bad.push(`${e.id}: with its label`);
    if (checkBankAnswer(q, given).correct === true) withoutLabel++; else bad.push(`${e.id}: without it`);
    if (checkBankAnswer(q, `${label.replace(/\s*=$/, '')}=${given}`).correct === true) tight++; else bad.push(`${e.id}: unspaced`);
    if (checkAnswer(q, `${label} ${given}`).correct === true) hadBefore++;
    // a different left side with the right value is another quantity, never this answer
    const other = label.replace(/\s*=$/, '') === 'zq' ? 'wq' : 'zq';
    if (checkBankAnswer(q, `${other} = ${given}`).correct !== true) otherSide++; else bad.push(`${e.id}: a different left side was accepted`);
    for (const t of e.traps) {
      const input = trapInput(t);
      if (input === null) continue;
      trapsTried++;
      if (checkBankAnswer(q, `${label} ${input}`).correct !== true) trapsWrong++; else bad.push(`${e.id}: a trap with its label was accepted`);
    }
    // a wrong value with the right label is wrong
    const wrong = e.answerType === 'set' ? '991, 992' : e.answerType === 'numeric' ? '987654.321' : '(x+987)^7';
    if (checkBankAnswer(q, `${label} ${wrong}`).correct !== true) wrongRight++; else bad.push(`${e.id}: a wrong value with its label was accepted`);
  }
  eq(bad.slice(0, 5), [], 'every prefixed question reads its accepted answer with and without its own label, and nothing else');
  ok(prefixed.length > 250, `${prefixed.length} prefixed questions are held to it`);
  eq([withLabel, withoutLabel, tight, otherSide, wrongRight, trapsWrong], [prefixed.length, prefixed.length, prefixed.length, prefixed.length, prefixed.length, trapsTried], 'with the label, without it, unspaced, other side refused, wrong value refused, every trap refused');
  ok(hadBefore < prefixed.length, `before this reading the engine refused the answer typed with its own label on ${prefixed.length - hadBefore} of them`);
  // exact stripping: a label that merely starts the same is a different label
  const dydx = { _bank: 'x', answerType: 'expression', answer: { expr: '3*x^2' }, answerPrefix: "dy/dx =", prompt: 'Differentiate $y=x^3$.' };
  ok(checkBankAnswer(dydx, 'dy/dx = 3x^2').correct === true && checkBankAnswer(dydx, 'dy/dx=3x^2').correct === true && checkBankAnswer(dydx, '3x^2').correct === true, 'dy/dx = 3x^2, dy/dx=3x^2 and 3x^2 are the answer');
  ok(checkBankAnswer(dydx, 'y = 3x^2').correct === false && checkBankAnswer(dydx, 'dx/dy = 3x^2').correct === false && checkBankAnswer(dydx, 'dy/dx = 3x^3').correct === false, 'y = 3x^2, dx/dy = 3x^2 and dy/dx = 3x^3 are not');
  eq(readOwnPrefix({ ...dydx }, 'dy/dx = 5').input, '5', 'the label is taken off');
  const ginv = { _bank: 'x', answerType: 'expression', answer: { expr: 'x^2' }, answerPrefix: 'f⁻¹(x) =', prompt: 'Find the inverse.' };
  ok(checkBankAnswer(ginv, 'f^-1(x) = x^2').correct === true && checkBankAnswer(ginv, 'f⁻¹(x)=x^2').correct === true && checkBankAnswer(ginv, 'f^{-1}(x) = x^2').correct === true, 'the inverse label is one spelling in any of its forms');
  // one quantity under its names: dy/dx, y' and d/dx(y); f'(x) too when the question defines y = f(x); never a different quantity
  {
    const named = entries.filter(e => e.answerPrefix === 'dy/dx =' && e.answerType === 'expression');
    ok(named.length >= 70, `${named.length} questions have a dy/dx = box`);
    let primed = 0, primeUnicode = 0, wrongQuantity = 0, fPrimeRefused = 0;
    for (const e of named) {
      const q = served(e);
      const given = acceptedInput(e);
      if (checkBankAnswer(q, `y' = ${given}`).correct === true) primed++; else bad.push(`${e.id}: y' = ... in a dy/dx box`);
      if (checkBankAnswer(q, `y\u2032=${given}`).correct === true) primeUnicode++; else bad.push(`${e.id}: y\u2032 = ... in a dy/dx box`);
      if (['y = ', 'dx/dy = ', "y'' = ", 'f(x) = '].every(l => checkBankAnswer(q, `${l}${given}`).correct !== true)) wrongQuantity++; else bad.push(`${e.id}: another quantity was accepted in a dy/dx box`);
      const defines = /y\s*=\s*f\(x\)/.test(e.prompt.replace(/[$\\{}]/g, ''));
      if (defines || checkBankAnswer(q, `f'(x) = ${given}`).correct !== true) fPrimeRefused++; else bad.push(`${e.id}: f'(x) accepted though the question does not define y = f(x)`);
    }
    eq([primed, primeUnicode, wrongQuantity, fPrimeRefused], [named.length, named.length, named.length, named.length], "y' =, y\u2032 =, and refusal of y =, dx/dy =, y'' =, f(x) = (and of f'(x) =, unless y = f(x) is defined), over every dy/dx = box");
    const yp = entries.filter(e => e.answerPrefix === "y' =" && e.answerType === 'expression');
    ok(yp.length > 5 && yp.every(e => checkBankAnswer(served(e), `dy/dx = ${acceptedInput(e)}`).correct === true), "and dy/dx = in a y' = box");
    const f1 = { _bank: 'x', answerType: 'expression', answer: { expr: '2*x' }, answerPrefix: "f'(x) =", prompt: 'Given $y=f(x)=x^2$, find the derivative.' };
    ok(['f\'(x) = 2x', 'dy/dx = 2x', "y' = 2x", '2x'].every(t => checkBankAnswer(f1, t).correct === true) && checkBankAnswer({ ...f1, prompt: 'Given $f(x)=x^2$, find the derivative.' }, 'dy/dx = 2x').correct === false, "f'(x) names the same quantity as dy/dx only when the question defines y = f(x)");
  }
  // not a bank question: the engine alone, as ever
  ok(checkBankAnswer({ ...dydx, _bank: undefined }, 'y = 3x^2').correct === checkAnswer({ ...dydx, _bank: undefined }, 'y = 3x^2').correct, 'a question that is not the bank\'s is read by the engine alone');
}

// ── 2. a named precision on an interval ──────────────────────────────────────
{
  const named = entries.filter(e => !['numeric', 'working', 'manual'].includes(e.answerType) && namedDecimalPlaces({ prompt: e.prompt }) !== null);
  ok(named.length >= 1, `${named.length} non-numeric question(s) of the pack name a precision (swept)`);
  for (const e of named) {
    const q = served(e);
    const places = namedDecimalPlaces({ prompt: e.prompt });
    // A set whose elements are already written at the named precision (59 and 121 "to the nearest degree") needs no reading; the engine's own marks stand.
    if (e.answerType === 'set' && (e.answer.values || []).every(v => roundPlaces(v, places) === v)) {
      ok(checkBankAnswer(q, e.answer.values.join(', ')).correct === true && checkBankAnswer(q, e.answer.values.map(v => v + 1).join(', ')).correct === false, `${e.id}: a set key already at the named precision is marked as the engine marks it`);
      continue;
    }
    if (e.answerType !== 'interval') { ok(false, `${e.id}: a ${e.answerType} key names a precision and has no reading for it`); continue; }
    const rounded = String(e.answer.region).replace(/\d+(?:\.\d+)?/g, m => String(roundPlaces(Number(m), places)));
    const step = 10 ** -places;
    const bump = d => String(e.answer.region).replace(/\d+(?:\.\d+)?/g, m => String(Number((roundPlaces(Number(m), places) + d * step).toFixed(places))));
    ok(checkBankAnswer(q, e.answer.region).correct === true, `${e.id}: the key as written is the answer`);
    ok(checkBankAnswer(q, rounded).correct === true, `${e.id}: the key rounded to ${places} places is the answer (${rounded})`);
    ok(checkBankAnswer(q, bump(1)).correct === false && checkBankAnswer(q, bump(-1)).correct === false, `${e.id}: the next value up or down is not`);
    ok(checkBankAnswer(q, rounded.replace(/>/, '<')).correct === false, `${e.id}: the other direction is not`);
  }
  const e087 = entries.find(e => e.id === 'A11-E1-087');
  ok(e087 && checkBankAnswer(served(e087), 'x > 2.73').correct === true && checkBankAnswer(served(e087), 'x>2.73').correct === true && checkBankAnswer(served(e087), 'x > 2.7268').correct === true && checkBankAnswer(served(e087), 'x > 2.72').correct === false && checkBankAnswer(served(e087), 'x > 2.74').correct === false && checkBankAnswer(served(e087), 'x < 2.73').correct === false, 'A11-E1-087: x > 2.73 is right to two places; 2.72, 2.74 and the other direction are not');
  // a precision-free interval key keeps exact endpoints
  const plain = entries.find(e => e.answerType === 'interval' && /\d\.\d/.test(e.answer.region) && namedDecimalPlaces({ prompt: e.prompt }) === null);
  if (plain) ok(checkBankAnswer(served(plain), plain.answer.region.replace(/\d+\.\d+/g, m => String(Number(m) + 0.01))).correct === false, `${plain.id}: an interval with no precision named has no tolerance`);
}

// ── 3. no precision named ────────────────────────────────────────────────────
// A rounded decimal is accepted only where the key is a long decimal the author wrote as one AND the question asks for no exact form. It is never
// the answer to "a fraction in simplest form", "a rational denominator", "exact", "in terms of", or a key the author wrote as a fraction, a surd,
// a multiple of pi or a logarithm.
{
  const numeric = entries.filter(e => e.answerType === 'numeric');
  const rows = numeric.filter(e => acceptsRoundedFigures(served(e)));
  console.log(`  the rounding rule applies to ${rows.length} of ${numeric.length} numeric questions of the pack: ${rows.map(e => e.id).join(' ') || 'none'}`);
  eq(rows.map(e => e.id), [], 'swept over every numeric question: none is a long decimal the author wrote as a decimal on a prompt that asks for no exact form');
  // questions whose criterion or step heading asks for an exact value, or whose key is authored as an exact form, never take a rounded decimal
  for (const id of ['A11-E1-011', 'A11-T1-059', 'A12-C4-094', 'A12-C4-106', 'X12-C2-101', 'X12-C2-105', 'A11-T1-124', 'A11-C1-054', 'A11-S1-137']) {
    const e = entries.find(x => x.id === id);
    if (!e) { ok(false, `${id} is in the pack`); continue; }
    const q = served(e);
    ok(!acceptsRoundedFigures(q) && [3, 4].every(k => checkBankAnswer(q, String(roundSignificant(e.answer.value, k))).correct === checkAnswer(q, String(roundSignificant(e.answer.value, k))).correct), `${id}: the rounding rule does not apply (an exact criterion, step heading or authored exact form)`);
  }
  // the three the review found, and the rest of their kind: whatever the engine says of a rounded decimal, the bank's own reading adds nothing to it
  const typedFor = e => { const v = e.answer.value; return [roundSignificant(v, 3), roundSignificant(v, 4)].map(String); };
  let addedByBank = 0, tried = 0;
  for (const e of numeric) {
    if (e.answer.tol !== undefined || Number.isInteger(e.answer.value)) continue;
    const q = served(e);
    for (const t of typedFor(e)) { tried++; if (checkBankAnswer(q, t).correct === true && checkAnswer(q, t).correct !== true) addedByBank++; }
  }
  eq(addedByBank, 0, `over every numeric key of the pack (${tried} roundings to 3 and 4 figures) the bank's own reading accepts no decimal the engine refuses`);
  for (const id of ['A12-M1-021', 'A12-M1-033', 'A11-F1-164']) {
    const e = entries.find(x => x.id === id);
    if (!e) { ok(false, `${id} is in the pack`); continue; }
    const q = served(e);
    const typedByReview = id.endsWith('021') ? ['0.3636', '0.36364'] : id.endsWith('033') ? ['0.1222', '0.12222'] : ['11.2', '11.20', '11.196'];
    ok([...typedFor(e), ...typedByReview].every(t => checkBankAnswer(q, t).correct === false), `${id}: every decimal of the key, including the one the review typed (${typedByReview[0]}), is refused: the question asks for an exact form`);
  }
  ok(checkBankAnswer(served(entries.find(e => e.id === 'A12-M1-021')), '4/11').correct === true && checkBankAnswer(served(entries.find(e => e.id === 'A12-M1-033')), '11/90').correct === true, 'and the exact fraction is');
  const kind = e => e.criteria.find(x => x.answer)?.point;
  ok(numeric.every(e => !acceptsRoundedFigures(served(e))) && kind(entries.find(e => e.id === 'A11-F1-164')) === 'Simplified', 'a prompt that asks for a rational denominator keeps the engine\'s reading alone');
  // the rule itself, on keys written here: a decimal authored as a decimal, then each way of asking for an exact form
  const decimal = 134.953712345;
  const mk = (over = {}) => ({ _bank: 'x', answerType: 'numeric', answer: { value: decimal }, prompt: 'Find the value.', steps: [{ h: 'Compute', d: '$1.5\\times 89.969141563 \\approx 134.9537$' }], criteria: [{ marks: 1, point: 'Correct value', answer: true }], ...over });
  const k = mk();
  ok(acceptsRoundedFigures(k) && ['135', '135.0', '134.95', '134.954'].every(t => checkBankAnswer(k, t).correct === true), 'a long decimal authored as a decimal: 135, 135.0, 134.95 and 134.954 are right (three figures or more, as typed)');
  ok(['130', '140', '134.9', '135.1', '136', '13', '1.3e2'].every(t => checkBankAnswer(k, t).correct === false), 'and 130, 140, 134.9, 135.1, 136 and 13 are not');
  const exactCases = [
    [mk({ prompt: 'Write the value as a fraction in simplest form.' }), 'fraction in simplest form'],
    [mk({ prompt: 'Express the value with a rational denominator.' }), 'rational denominator'],
    [mk({ prompt: 'Find the exact value.' }), 'exact'],
    [mk({ prompt: 'Give the value in terms of $\\pi$.' }), 'in terms of'],
    [mk({ prompt: 'Simplify, giving a surd.' }), 'surd'],
    [mk({ criteria: [{ marks: 1, point: '4/11', answer: true }] }), 'a key authored as a fraction'],
    [mk({ criteria: [{ marks: 1, point: '$\\dfrac{4}{11}$', answer: true }] }), 'a key authored as a TeX fraction'],
    [mk({ criteria: [{ marks: 1, point: '2√5 + 2√2', answer: true }] }), 'a key authored as a surd'],
    [mk({ criteria: [{ marks: 1, point: '12√3π', answer: true }] }), 'a key authored as a multiple of pi'],
    [mk({ criteria: [{ marks: 1, point: 'x = ln 2', answer: true }] }), 'a key authored as a logarithm'],
    [mk({ criteria: [{ marks: 1, point: 'Correct exact answer', answer: true }] }), 'a criterion that says exact'],
    [mk({ steps: [{ h: 'Sum', d: '$\\dfrac{0.36}{0.99}=\\dfrac{4}{11}$' }] }), 'a last worked line that ends in a fraction'],
    [mk({ steps: [{ h: 'Sum', d: '$x=\\sqrt{17}$' }] }), 'a last worked line that ends in a surd'],
    [{ ...mk(), steps: undefined, criteria: undefined }, 'the author\'s form unknown (fail closed)'],
    [mk({ answer: { value: 0.36363636363636365 } }), 'a value that reads as 4/11'],
    [mk({ answer: { value: 11.196152422706632 } }), 'a value that reads as 6 + 3 sqrt 3'],
    [mk({ answer: { value: 0.6931471805599453 } }), 'a value that reads as ln 2'],
    [mk({ answer: { value: 134.95 } }), 'a short decimal'],
    [mk({ answer: { value: 134.953712345, tol: 0.01 } }), 'a key with its own tolerance'],
    [mk({ prompt: 'Find the value to 1 decimal place.' }), 'a stated precision'],
    [mk({ prompt: 'Give your answer correct to 4 significant figures.' }), 'a stated precision in figures'],
    [mk({ answer: { value: 1234 } }), 'a whole number']
  ];
  for (const [q, what] of exactCases) ok(!acceptsRoundedFigures(q), `the rounding rule does not apply: ${what}`);
  ok(checkBankAnswer(mk({ prompt: 'Write the value as a fraction in simplest form.', answer: { value: 0.36363636363636365 } }), '0.3636').correct === false && checkBankAnswer(mk({ answer: { value: 0.36363636363636365 }, prompt: 'Write 0.\\dot3\\dot6 as a fraction in simplest form.' }), '0.36364').correct === false, 'a decimal is not the answer to a fraction in simplest form');
  ok(roundSignificant(134.95, 4) === 135 && roundSignificant(2.675, 3) === 2.68 && roundSignificant(0.0005, 1) === 0.0005 && roundPlaces(2.7268, 2) === 2.73 && roundPlaces(0.005, 2) === 0.01 && roundPlaces(0.004, 2) === 0, 'rounding is half up from the decimal the key is written as, not from its binary value');
  // a bank question is the only one read this way
  ok(checkBankAnswer({ ...k, _bank: undefined }, '135').correct === checkAnswer({ ...k, _bank: undefined }, '135').correct, 'a question that is not the bank\'s is read by the engine alone');
}

// ── 4. through the marker operation the practice route runs ──────────────────
{
  const run = (q, answer) => { let out = null; MARKER_OPS.practice({ q, answer, working: '', evidenceIfWrong: false, policy: null }, r => { out = r.result; }); return out; };
  const e087 = entries.find(e => e.id === 'A11-E1-087');
  const q = qb.qbankEntryQuestion('A11-E1-087', 5);
  eq([run(q, 'x > 2.73')?.correct, run(q, 'x > 2.74')?.correct], [true, false], 'the practice marker marks A11-E1-087: x > 2.73 right, x > 2.74 wrong');
  const pre = entries.find(x => x.answerPrefix === 'dy/dx =' && x.answerType === 'expression');
  const qp = qb.qbankEntryQuestion(pre.id, 5);
  eq([run(qp, `dy/dx = ${pre.answer.expr}`)?.correct, run(qp, `y = ${pre.answer.expr}`)?.correct], [true, false], `the practice marker marks ${pre.id}: its own label right, another left side wrong`);
  void e087;
}

if (failures.length) { console.error(`QBANK MARKING: FAIL ${failures.length}\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log(`QBANK MARKING: PASS — ${pass}/${pass} checks over ${entries.length} questions`);
process.exit(0);
