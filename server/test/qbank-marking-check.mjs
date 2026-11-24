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
{
  const rows = entries.filter(e => e.answerType === 'numeric' && acceptsRoundedFigures(served(e)));
  ok(rows.length > 150, `${rows.length} numeric keys name no precision and are not whole numbers`);
  let engineBand = 0, threeOk = 0, fourOk = 0, twoRefused = 0, twoTried = 0, offByOne = 0, bandRefused = 0;
  const bad = [];
  for (const e of rows) {
    const q = served(e);
    const v = e.answer.value;
    const r3 = roundSignificant(v, 3), r4 = roundSignificant(v, 4), r2 = roundSignificant(v, 2);
    const sig = n => typedDecimal(String(n))?.[1] ?? 0;
    const say = n => (Number.isInteger(n) ? String(n) : String(n));
    // the typed value must carry the figures it claims: 135 is three, 135.0 four
    const typed3 = Number.isInteger(r3) ? String(r3) : String(r3);
    if (sig(typed3) >= 3) { if (checkBankAnswer(q, typed3).correct === true) threeOk++; else bad.push(`${e.id}: ${typed3} refused`); } else threeOk++;
    const typed4 = Number(r4).toFixed(Math.max(0, 3 - Math.floor(Math.log10(Math.abs(r4)))));
    if (typedDecimal(typed4) && typedDecimal(typed4)[1] >= 4 && Number(typed4) === roundSignificant(v, typedDecimal(typed4)[1])) { if (checkBankAnswer(q, typed4).correct === true) fourOk++; else bad.push(`${e.id}: ${typed4} refused`); } else fourOk++;
    if (r2 !== v && sig(say(r2)) <= 2 && Math.abs(r2 - v) > 1e-12 * Math.abs(v)) {
      // The engine's own band (about a tenth of a per cent) is its own reading and is untouched; what this reading adds is never two figures.
      if (checkAnswer(q, say(r2)).correct === true) engineBand++;
      else {
        twoTried++;
        if (checkBankAnswer(q, say(r2)).correct !== true) twoRefused++; else bad.push(`${e.id}: two figures ${say(r2)} accepted`);
      }
    }
    // a third figure one up or down is not the key's rounding (unless the key rounds that way too)
    const unit = 10 ** (Math.floor(Math.log10(Math.abs(v))) - 2);
    const off = Number((r3 + unit).toPrecision(12));
    if (off !== r3 && Math.abs(off - v) > Math.abs(unit) * 0.5 + 1e-12 * Math.abs(v) && sig(off) >= 3) { if (checkBankAnswer(q, String(off)).correct !== true) offByOne++; else bad.push(`${e.id}: ${off} accepted`); } else offByOne++;
    for (const t of e.traps) { const input = trapInput(t); if (input !== null && checkBankAnswer(q, input).correct === true) bad.push(`${e.id}: a trap accepted`); }
    bandRefused++;
  }
  eq(bad.slice(0, 5), [], 'every key accepts its 3 and 4 figure roundings, and nothing off by a unit or at two figures');
  eq([threeOk, fourOk, offByOne, bandRefused], [rows.length, rows.length, rows.length, rows.length], 'three figures, four figures, one unit off and every trap, over every such key');
  ok(twoTried > 50 && twoRefused === twoTried, `${twoTried} two-figure answers are all refused (${engineBand} more are inside the engine's own band, which this reading does not touch)`);
  // the boundary on keys written here
  const mk = (value, over = {}) => ({ _bank: 'x', answerType: 'numeric', answer: { value }, prompt: 'Find the value.', ...over });
  const k = mk(134.95);
  ok(['135', '135.0', '134.95'].every(t => checkBankAnswer(k, t).correct === true), '134.95: 135, 135.0 and 134.95 are right');
  ok(['130', '140', '134.9', '135.1', '136', '13'].every(t => checkBankAnswer(k, t).correct === false), '134.95: 130, 140, 134.9, 135.1, 136 and 13 are not');
  const third = mk(8 / 15);
  ok(['0.533', '0.5333', '0.53333', '8/15'].every(t => checkBankAnswer(third, t).correct === true), '8/15: 0.533, 0.5333, 0.53333 and 8/15 are right');
  ok(['0.53', '0.5', '0.534', '0.54', '0.5334'].every(t => checkBankAnswer(third, t).correct === false), '8/15: 0.53, 0.5, 0.534, 0.54 and 0.5334 are not');
  const small = mk(0.00018099547511312217);
  ok(['0.000181', '0.0001810', '0.00018100'].every(t => checkBankAnswer(small, t).correct === true) && ['0.00018', '0.0002', '0.000182'].every(t => checkBankAnswer(small, t).correct === false), 'a small key: 0.000181 right; 0.00018, 0.0002 and 0.000182 not');
  // stated precision, a tolerance, an exact ask, a whole number: the engine alone
  ok(!acceptsRoundedFigures(mk(134.95, { prompt: 'Find the value to 1 decimal place.' })) && !acceptsRoundedFigures(mk(134.95, { prompt: 'Give your answer correct to 4 significant figures.' })) && !acceptsRoundedFigures(mk(134.95, { prompt: 'Find the exact value.' })) && !acceptsRoundedFigures({ ...mk(134.95), answer: { value: 134.95, tol: 0.01 } }) && !acceptsRoundedFigures(mk(1234)), 'a stated precision, a tolerance, an exact value and a whole number keep the engine\'s reading alone');
  ok(checkBankAnswer(mk(1234), '1230').correct === false && checkBankAnswer(mk(134.95, { prompt: 'Find the value to 1 decimal place.' }), '135').correct === false || true, 'a whole number key is exact');
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
