// Proofs: never marked automatically. The engine checks the algebraic steps
// it understands and reports the first one it cannot confirm; that report is
// evidence for the teacher, never a mark.
// Run: node client/test/proof-steps-check.mjs   [SYNTHETIC: direct engine]
import { checkProofSteps, checkProof, PROOF_REVIEW_NOTE } from '../src/engine/proofSteps.js';
import { checkAnswer } from '../src/engine/checker.js';
import { markResponse } from '../../server/platform/markerOps.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass += 1; else { fail += 1; console.error('FAIL', label); } };
const ST = '(a+b)^2 = a^2+2*a*b+b^2';

// ── Group 1: step reports ──
const good = checkProofSteps(['LHS = (a+b)(a+b)', '= a^2 + a*b + b*a + b^2', '= a^2 + 2ab + b^2', '= RHS'], ST);
ok(good.firstBreak === -1 && good.reachesStatement && good.verifiedSteps === 4, 'a sound chain: every step verified, reaches the statement');
const broken = checkProofSteps(['LHS = (a+b)(a+b)', '= a^2 + b^2', '= RHS'], ST);
ok(broken.firstBreak === 1 && !broken.reachesStatement, 'the dropped cross term is the first break (line 2)');
ok(checkProofSteps(['L.H.S. = (a+b)^2', '= a^2+2ab+b^2 = R.H.S.'], ST).reachesStatement, 'L.H.S. / R.H.S. and a chain on one line');
const prose = checkProofSteps(['Since the triangles share angle A and the sides are in proportion,', 'triangle ABC is similar to triangle ADE.'], 'AB/AD = AC/AE');
ok(prose.steps.every(s => s.status === 'not-algebra') && !prose.reachesStatement, 'prose is not algebra and verifies nothing');
ok(!checkProofSteps(['LHS = (a+b)^2', '= RHS'], null).reachesStatement, 'without a statement LHS/RHS mean nothing');
ok(!checkProofSteps(['(a+b)^2 = a^2+2ab+b^2'], ST).reachesStatement, 'restating the statement does not reach it from a side');
ok(checkProofSteps(['LHS = x/x', '= 1'], 'x/x = 1').firstBreak === 1, 'a step that drops a hole (x/x = 1) is not confirmed');
ok(checkProofSteps(['x = 2 => x^2 = 4'], null).steps.length >= 1, 'an implication line is read, not as a continuation');
ok(checkProofSteps(Array(60).fill('= 1'), null).steps.length <= 40, 'at most 40 lines are read');

// ── Group 2: never a mark ──
const q = { answerType: 'proof', answer: { proof: { statement: ST } } };
const perfect = 'LHS = (a+b)(a+b)\n= a^2 + 2ab + b^2\n= RHS';
const pr = checkAnswer(q, perfect);
ok(pr.correct === false && pr.needsReview === true && pr.feedback.startsWith(PROOF_REVIEW_NOTE), 'practice: a perfect proof is not right automatically, and says why');
ok(pr.proofReport?.reachesStatement === true, 'practice: the report goes with it');
ok(checkAnswer(q, 'LHS = a^2 + b^2\n= RHS').feedback.includes('Line 1'), 'practice: the first break is named');
ok(checkAnswer(q, '').correct === false && !checkAnswer(q, '').needsReview, 'practice: blank is not review');
ok(checkProof(q, 'x'.repeat(6001)).invalid === true, 'practice: overlong proof unread');
const GRID = { correct: 4, incorrect: -1, unanswered: 0 };
const ex = markResponse(q, perfect, perfect, GRID);
ok(ex.awarded === 0 && ex.needsReview === true && ex.outcome === 'needs-review' && ex.markingScheme === 'teacher-review', 'exam: a perfect proof earns 0 until a teacher marks it');
ok(markResponse(q, 'nonsense', '', GRID).awarded === 0, 'exam: a wrong proof is not negatively marked by the engine');
ok(markResponse(q, '', '', GRID).unanswered === true, 'exam: blank is unanswered');

// ── Group 3: false-positive sweep ──
// For a set of identities, every corrupted step (sign flipped, coefficient
// changed, term dropped, power changed) must be reported 'not-verified', and
// no proof — sound or corrupted — may ever come back correct.
const IDENTITIES = [
  ['(a+b)^2', ['a^2', '2*a*b', 'b^2']],
  ['(a-b)^2', ['a^2', '-2*a*b', 'b^2']],
  ['(a+b)*(a-b)', ['a^2', '-b^2']],
  ['(x+1)^3', ['x^3', '3*x^2', '3*x', '1']],
  ['(a+b+c)^2', ['a^2', 'b^2', 'c^2', '2*a*b', '2*b*c', '2*c*a']],
  ['(x+2)*(x+3)', ['x^2', '5*x', '6']],
  ['sin(x)^2+cos(x)^2+x', ['1', 'x']],
  ['(a-b)*(a^2+a*b+b^2)', ['a^3', '-b^3']]
];
const corrupt = term => [
  term.startsWith('-') ? term.slice(1) : `-${term}`,
  /^\d/.test(term.replace('-', '')) ? term.replace(/(\d+)/, (m) => String(Number(m) + 1)) : `2*${term}`,
  /^-?\d+$/.test(term) ? String(Number(term) + 2) : term.includes('^2') ? term.replace('^2', '^3') : `${term}^2`
];
let cases = 0, falseVerify = 0, credited = 0;
for (const [lhs, terms] of IDENTITIES) {
  const rhs = terms.join(' + ').replace(/\+ -/g, '- ');
  const statement = `${lhs} = ${rhs}`;
  const sound = checkProofSteps([`LHS = ${rhs}`, '= RHS'], statement);
  ok(sound.firstBreak === -1, `${lhs}: the sound step verifies`);
  const variants = [];
  terms.forEach((t, i) => {
    variants.push(terms.filter((_, j) => j !== i));
    for (const c of corrupt(t)) variants.push(terms.map((u, j) => (j === i ? c : u)));
  });
  for (const v of variants) {
    const wrong = v.join(' + ').replace(/\+ -/g, '- ') || '0';
    const r = checkProofSteps([`LHS = ${wrong}`, '= RHS'], statement);
    cases += 1;
    if (r.firstBreak === -1 || r.reachesStatement) { falseVerify += 1; console.error('false verify', statement, wrong); }
    if (checkAnswer({ answerType: 'proof', answer: { proof: { statement } } }, `LHS = ${wrong}\n= RHS`).correct !== false) credited += 1;
  }
  if (checkAnswer({ answerType: 'proof', answer: { proof: { statement } } }, `LHS = ${rhs}\n= RHS`).correct !== false) credited += 1;
}
ok(falseVerify === 0 && credited === 0 && cases > 60, `proof sweep: ${falseVerify} corrupted steps verified, ${credited} proofs credited, in ${cases}`);
console.log(`proof sweep: ${falseVerify} corrupted steps verified and ${credited} proofs auto-credited in ${cases} corrupted chains [SYNTHETIC]`);

console.log(`PROOF STEPS: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
