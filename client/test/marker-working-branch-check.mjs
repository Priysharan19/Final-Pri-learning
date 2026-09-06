// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Step Check on the methods NCERT actually prints
//
// Two things a student is taught to write, that Step Check called mistakes:
//
//   1. The zero-product branch.  (x + 3)(x + 6) = 0 → x + 3 = 0, x + 6 = 0.
//      Each branch is true of one root by construction, so a checker that
//      demands every line hold for every root marks the standard method wrong.
//   2. Substituting the answer back.  (−3)² + 9(−3) + 18 = 0 has no free
//      variable: it is a check that the answer works, not an equation that
//      dropped its constraint.
//
// The other direction matters just as much: a branch that is never completed
// really has lost a root, and a check that does not balance is really wrong.
//
// Every case is authored. Nothing here is generated.
// ─────────────────────────────────────────────────────────────────────────────
import { stepCheck, checkAnswer } from '../src/engine/checker.js';

let pass = 0;
const failures = [];
function ok(cond, label) {
  if (cond) pass++;
  else failures.push(label);
}
function eq(actual, expected, label) {
  ok(actual === expected, `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
const statuses = (report) => report.lines.map(l => l.status).join(' ');
const noBreak = (report, label) => {
  eq(report.firstBreak, -1, `${label} — firstBreak, statuses: ${statuses(report)}`);
};
const breaksAt = (report, index, label) => {
  eq(report.firstBreak, index, `${label} — firstBreak, statuses: ${statuses(report)}`);
};

// ── 1. The zero-product branch is the method, not a break ───────────────────
const quadratic = { kind: 'equation', variable: 'x', solutions: [-3, -6] };

const branchesOnSeparateLines = stepCheck(quadratic, [
  '(x + 3)(x + 6) = 0',
  'x + 3 = 0',
  'x + 6 = 0',
  'x = -3 or x = -6'
].join('\n'));
noBreak(branchesOnSeparateLines, 'branches: each factor set to zero on its own line');
eq(branchesOnSeparateLines.lines.filter(l => l.status === 'ok').length, 4, 'branches: every line of the NCERT method checks out');

const branchesThenRoots = stepCheck(quadratic, [
  '(x + 3)(x + 6) = 0',
  'x + 3 = 0',
  'x = -3',
  'x + 6 = 0',
  'x = -6'
].join('\n'));
noBreak(branchesThenRoots, 'branches: each branch solved before the next is opened');

const branchesOnOneLine = stepCheck(quadratic, [
  '(x + 3)(x + 6) = 0',
  'x + 3 = 0 or x + 6 = 0',
  'x = -3 or x = -6'
].join('\n'));
noBreak(branchesOnOneLine, 'branches: both factors on one line joined by "or"');
eq(branchesOnOneLine.lines[1].status, 'ok', 'branches: "x + 3 = 0 or x + 6 = 0" is read as the pair of branches');

const branchesWithMinus = stepCheck({ kind: 'equation', variable: 'x', solutions: [2, 5] }, [
  '(x - 2)(x - 5) = 0',
  'x - 2 = 0 or x - 5 = 0',
  'x = 2 or x = 5'
].join('\n'));
noBreak(branchesWithMinus, 'branches: subtracted factors read the same way');

const branchesUnicode = stepCheck(quadratic, [
  '(x + 3)(x + 6) = 0',
  'x + 3 = 0',
  'x + 6 = 0',
  'x = −3 or x = −6'
].join('\n'));
noBreak(branchesUnicode, 'branches: a unicode minus in the answer line');

// ── 2. A branch that is never completed has still lost a root ───────────────
const oneBranchOnly = stepCheck(quadratic, [
  '(x + 3)(x + 6) = 0',
  'x + 3 = 0',
  'x = -3'
].join('\n'));
breaksAt(oneBranchOnly, 1, 'lost root: the working stops after one branch');
eq(oneBranchOnly.diagnosis?.code === undefined ? 'none' : 'named', 'named', 'lost root: the break carries a diagnosis');

const rootDroppedWithoutFactorising = stepCheck(quadratic, [
  'x^2 + 9x + 18 = 0',
  'x = -3'
].join('\n'));
ok(rootDroppedWithoutFactorising.firstBreak !== -1, 'lost root: naming one root with no factorisation above is still a break');

const wrongFactorisation = stepCheck(quadratic, [
  '(x + 3)(x + 5) = 0'
].join('\n'));
breaksAt(wrongFactorisation, 0, 'branches: a wrong factorisation is still a break');

// ── 3. Substituting the answer back is a check, not a dropped constraint ────
const verified = stepCheck(quadratic, [
  '(x + 3)(x + 6) = 0',
  'x = -3 or x = -6',
  '(-3)^2 + 9*(-3) + 18 = 0'
].join('\n'));
noBreak(verified, 'verification: substituting a root back into the original');
eq(verified.lines[2].status, 'ok', 'verification: the substitution line checks out');

const verifiedBothRoots = stepCheck(quadratic, [
  '(x + 3)(x + 6) = 0',
  'x = -3 or x = -6',
  '(-3)^2 + 9*(-3) + 18 = 0',
  '(-6)^2 + 9*(-6) + 18 = 0'
].join('\n'));
noBreak(verifiedBothRoots, 'verification: both roots substituted back');

const verifiedLinear = stepCheck({ kind: 'equation', variable: 'x', solutions: [-2] }, [
  '2x - 7 = -11',
  '2x = -4',
  'x = -2',
  '2*(-2) - 7 = -11'
].join('\n'));
noBreak(verifiedLinear, 'verification: the linear check every NCERT chapter prints');

// ── 4. A check that does not balance is still wrong ─────────────────────────
const badCheck = stepCheck(quadratic, [
  '(x + 3)(x + 6) = 0',
  'x = -3 or x = -6',
  '(-4)^2 + 9*(-4) + 18 = 0'
].join('\n'));
breaksAt(badCheck, 2, 'verification: an arithmetic slip in the check is a break');

const badLiteralCheck = stepCheck({ kind: 'equation', variable: 'x', solutions: [-2] }, [
  '2x - 7 = -11',
  '-4 = -5'
].join('\n'));
breaksAt(badLiteralCheck, 1, 'verification: a false statement of numbers is a break');

const trivialCheck = stepCheck({ kind: 'equation', variable: 'x', solutions: [-2] }, [
  '2x - 7 = -11',
  '2x = -4',
  'x = -2',
  '-2 = -2'
].join('\n'));
noBreak(trivialCheck, 'verification: closing with "-2 = -2" is not a mistake');
eq(trivialCheck.lines[3].status, 'note', 'verification: closing with "-2 = -2" earns nothing either');

// Here "0 = 0" IS the line above with x = −3 put in, so it is true and derived
// — a note, not a mistake. It still evaluates nothing, so it earns nothing and
// cannot finish the working. The case where it is not derived is below.
const identity = stepCheck(quadratic, [
  '(x + 3)(x + 6) = 0',
  '0 = 0'
].join('\n'));
eq(identity.lines[1].status, 'note', 'verification: "0 = 0" states nothing, so it earns nothing');
ok(checkAnswer({ answerType: 'working', answer: { stepMeta: quadratic, minLines: 1 } }, [
  '(x + 3)(x + 6) = 0',
  '0 = 0'
].join('\n')).correct === false, 'verification: "0 = 0" is not a way to finish the working');

const trivialIdentity = stepCheck({ kind: 'equation', variable: 'x', solutions: [-2] }, [
  '2x - 7 = -11',
  '2x - 7 + 11 = 2x - 7 + 11'
].join('\n'));
breaksAt(trivialIdentity, 1, 'verification: an identity that still contains the unknown drops the constraint');

// A bare "a = a" is the line above with the answer put in, or it is an
// equation thrown away. Only the first is harmless, and the difference is
// whether substituting a solution into the line above reproduces it.
const substituted = stepCheck({ kind: 'equation', variable: 'x', solutions: [5] }, [
  '3x = 15',
  'x = 5',
  '5 = 5'
].join('\n'));
noBreak(substituted, 'verification: "5 = 5" is "x = 5" with the answer put in');

const replaced = stepCheck({ kind: 'equation', variable: 'x', solutions: [5] }, [
  '3x = 15',
  '0 = 0',
  'x = 5'
].join('\n'));
breaksAt(replaced, 1, 'verification: no substitution into 3x = 15 gives 0 = 0, so the constraint was dropped');
eq(replaced.diagnosis?.code, 'constraint-dropped', 'verification: the dropped constraint keeps its stable diagnosis');

// ── 5. The whole method, marked end to end ──────────────────────────────────
const zeroesQuestion = {
  answerType: 'working',
  answer: { stepMeta: quadratic, minLines: 2 },
  prompt: 'Find the zeroes of $p(x)=x^2 + 9x + 18$ algebraically.'
};
ok(checkAnswer(zeroesQuestion, [
  '(x + 3)(x + 6) = 0',
  'x + 3 = 0',
  'x + 6 = 0',
  'x = -3 or x = -6'
].join('\n')).correct === true, 'end to end: the NCERT zero-product method is marked correct');

ok(checkAnswer(zeroesQuestion, [
  '(x + 3)(x + 6) = 0',
  'x = -3 or x = -6',
  '(-3)^2 + 9*(-3) + 18 = 0'
].join('\n')).correct === true, 'end to end: working that finishes with a check is marked correct');

ok(checkAnswer(zeroesQuestion, [
  '(x + 3)(x + 6) = 0',
  'x + 3 = 0',
  'x = -3'
].join('\n')).correct === false, 'end to end: stopping after one branch is not a complete answer');

ok(checkAnswer(zeroesQuestion, [
  '(x + 3)(x + 5) = 0',
  'x = -3 or x = -5'
].join('\n')).correct === false, 'end to end: a wrong factorisation is not a correct answer');

console.log(failures.length
  ? `WORKING BRANCHES: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `WORKING BRANCHES: PASS — ${pass}/${pass} checks — the zero-product branch and substituting the answer back are the method, and an incomplete branch or an unbalanced check is still a break.`);
process.exit(failures.length ? 1 : 0);
