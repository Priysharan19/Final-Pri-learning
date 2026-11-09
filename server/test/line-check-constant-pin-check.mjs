// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line check: a constant answer is never a guess oracle
//
// L2's repro (on main inside #770, PRI_FEATURE_LINE_CHECK off): for
// c10-surface-volume-combo D2 seed 2 (answer "36036 cm³"), ['V = 36036'] was
// judged while ['V = 40000'] got the generic reply — a right and a wrong value
// told apart. The unit made the answer unreadable as a claim, so the shape
// rule missed it, and the Step Check's placement of the RIGHT value decided.
//
// Contract proved here, on the real marker path (lineCheckEvidence):
//   · units are stripped before the answer's form is read;
//   · with a bare-constant answer, ANY line pinning one symbol to a constant
//     (V, V_1, any name) or stating a constant is an attempt — by form only;
//   · a right and a wrong final value give byte-identical evidence;
//   · lines BEFORE the first constant-pinning line are still judged;
//   · the same holds for an arithmetic-progression question.
//
//   node server/test/line-check-constant-pin-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { loadAllBanks, generateQuestion } from '../../client/src/engine/generators/index.js';
import { lineCheckEvidence } from '../platform/markerOps.js';
import { answerForm, firstFinalAttempt, isConstantAnswer, stripUnits } from '../platform/finalAttempt.js';
import { answerTextFor } from '../platform/practice.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

await loadAllBanks?.();

// ── 1 · Units and constant answers ───────────────────────────────────────────
eq(['36036 cm³', '₹ 450', '12.5 %', '7 m/s', '24 sq cm'].map(stripUnits), ['36036', '450', '12.5', '7', '24'], 'units and currency are stripped from a number');
// Spelled-out units (#831 review): every one is stripped, and each such answer is a constant.
const SPELLED = ['48 square units', '48 sq units', '48 sq. units', '48 cubic units', '48 cu units', '48 units', '48 unit',
  '48 square metres', '48 square meters', '48 sq. cm', '48 sq cm', '48 sq.m', '48 square centimetres', '48 cubic centimetres',
  '48 metres', '48 kilometres', '48 litres', '48 millilitres', '48 grams', '48 kilograms', '48 rupees', '48 seconds', '48 minutes',
  '48 cm²', '48 m^2', '48 cubic cm'];
for (const s of SPELLED) {
  eq(stripUnits(s), '48', `"${s}" is stripped to its number`);
  ok(isConstantAnswer(s), `"${s}" is a constant answer`);
  eq(firstFinalAttempt(['A = 48'], answerForm({ answerText: s })), 0, `with "${s}" as the answer, "A = 48" is an attempt`);
}
eq(stripUnits('area = l b'), 'area = l b', 'words that are not after a number are left alone');
eq(stripUnits('m = 2'), 'm = 2', 'a variable named like a unit is never stripped');
ok(['36036 cm³', '₹ 450', '56/65', '-3'].every(isConstantAnswer), 'a bare constant answer is recognised through its unit');
ok(!['y = 2x + 1', 'x^2 + 2x + 1'].some(isConstantAnswer), 'an answer with a symbol is not a constant');

const cForm = answerForm({ answerText: '36036 cm³' });
for (const line of ['V = 36036', 'V = 40000', 'V_1 = 16632', '36036 = V', 'A = 12.5', '36036', '40000 cm³', 'V = 36036 cm³']) {
  eq(firstFinalAttempt([line], cForm), 0, `"${line}" pins one symbol (or nothing) to a constant: an attempt`);
}
for (const line of ['V = l b h', 'V = l*b*h + 2*r*h', 'A + B = C']) {
  eq(firstFinalAttempt([line], cForm), -1, `"${line}" relates symbols: still judged`);
}
eq(firstFinalAttempt(['V = l b h', 'V = 36036', 'V = l b h'], cForm), 1, 'lines before the first constant pin are judged; it and everything after are not');

// ── 2 · The exact repro, on the real marker path ─────────────────────────────
function probe(id, diff, seed) {
  let q;
  try { q = generateQuestion(id, diff, seed); } catch (e) { failures.push(`${id} D${diff} seed ${seed} did not generate: ${e?.message}`); return null; }
  return { q, answerText: String(answerTextFor(q) ?? '') };
}
const sv = probe('c10-surface-volume-combo', 2, 2);
if (sv) {
  ok(/36036/.test(sv.answerText), `the repro question is the one L2 reported (answer "${sv.answerText}")`);
  const right = lineCheckEvidence(sv.q, ['V = 36036'], sv.answerText);
  const wrong = lineCheckEvidence(sv.q, ['V = 40000'], sv.answerText);
  eq(right, wrong, 'L2 repro: ["V = 36036"] and ["V = 40000"] give byte-identical evidence');
  eq(right.attemptAt, 0, '— both are final-answer attempts, never judged');
  eq(lineCheckEvidence(sv.q, ['V_1 = 16632'], sv.answerText).attemptAt, 0, 'an intermediate constant is an attempt too (the conservative trade-off)');
  const prefixRight = lineCheckEvidence(sv.q, ['V = l b h', 'V = 36036'], sv.answerText);
  const prefixWrong = lineCheckEvidence(sv.q, ['V = l b h', 'V = 40000'], sv.answerText);
  eq(prefixRight, prefixWrong, 'with a judged line first, a right and a wrong final value still read the same');
  eq(prefixRight.attemptAt, 1, '— and the line before the constant is what is judged');
}

// ── 2b · Re-review: any one-letter relation determines that letter ──────────
for (const [r, w] of [['n*n = 19*n', 'n*n = 18*n'], ['2n + 3 = 41', '2n + 3 = 43'], ['n^2 - 19n = 0', 'n^2 - 18n = 0'], ['N = 19', 'n = 18'], ['2n + 3 > 7', '2n + 3 > 9'], ['x + x = 38', 'x + x = 36']]) {
  eq([firstFinalAttempt([r], cForm), firstFinalAttempt([w], cForm)], [0, 0], `"${r}" and "${w}" both determine one letter: both attempts`);
}
if (sv) {
  eq(lineCheckEvidence(sv.q, ['n*n = 19*n'], sv.answerText), lineCheckEvidence(sv.q, ['n*n = 18*n'], sv.answerText), 'reviewer case on the real path: identical evidence');
  eq(lineCheckEvidence(sv.q, ['V = l b h', 'n*n = 19*n', 'V = 36036'], sv.answerText), lineCheckEvidence(sv.q, ['V = l b h', 'n*n = 18*n', 'V = 40000'], sv.answerText),
    'after the first attempt everything reads the same — no "could not place" versus "break" difference');
}

// ── 3 · An arithmetic progression ────────────────────────────────────────────
const ap = probe('c10-arithmetic-progressions', 2, 2);
if (ap) {
  const value = String(ap.answerText).replace(/[^\d.\-\/]/g, '') || '1';
  const other = String(Number(value) + 7);
  ok(isConstantAnswer(ap.answerText) || /[a-z]/i.test(stripUnits(ap.answerText)), `AP answer read: "${ap.answerText}"`);
  if (isConstantAnswer(ap.answerText)) {
    for (const name of ['a_n', 'S_n', 'n', 'd']) {
      const r = lineCheckEvidence(ap.q, [`${name} = ${value}`], ap.answerText);
      const w = lineCheckEvidence(ap.q, [`${name} = ${other}`], ap.answerText);
      eq(r, w, `AP: "${name} = <right>" and "${name} = <wrong>" give identical evidence`);
      eq(r.attemptAt, 0, `— "${name} = …" is an attempt`);
    }
    const formula = lineCheckEvidence(ap.q, ['t = a + (n - 1) d'], ap.answerText);
    eq(formula.attemptAt, -1, 'AP: the general-term formula (symbols only) is still judged');
  }
}

console.log(failures.length
  ? `LINE CHECK CONSTANT PIN: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `LINE CHECK CONSTANT PIN: PASS — ${pass}/${pass} checks — a constant answer is never told right from wrong; units stripped; earlier lines still judged.`);
process.exit(failures.length ? 1 : 0);
