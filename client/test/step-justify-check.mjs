// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Step justification suite (engine/stepJustify.js)
//
//   NAMED     a valid step must be given exactly the rule(s) it used.
//   NEGATIVE  a step must never be given a rule it did not use: a wrong step
//             gets no name at all, a jump gets "valid step (checked)", and a
//             step two rule sets explain equally gets no guessed name.
//   PROOFS    "prove LHS = RHS" items: every authored proof is complete under
//             the checker the server marks with, written straight through,
//             ending "= RHS", and worked from both sides to meet in the middle.
//   MARKS     the annotations never change what the checker decides.
//
// Authored cases, not student data: nothing here is a claim about how often a
// real student's working is named correctly.
// ─────────────────────────────────────────────────────────────────────────────
import { justifyStep, annotateWorking, STEP_RULE_IDS } from '../src/engine/stepJustify.js';
import { checkWorking, stepCheck } from '../src/engine/checker.js';
import { identityProof, identityProofCatalogue } from '../src/engine/generators/identityProofs.js';
import { buildAnnotatedWorking, lineRange } from '../src/components/annotatedWorkingModel.js';

let pass = 0;
const failures = [];
const ok = (label, cond) => { if (cond) pass += 1; else failures.push(label); };
const names = r => (r?.rules || []).map(x => x.rule);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── NAMED: [from, to, rules (in order), scope?] ──────────────────────────────
const NAMED = [
  // the competitor's proof, line by line (owner's screenshots)
  ['(secθ - cosθ)/(cscθ - sinθ)', '(1/cosθ - cosθ)/(1/sinθ - sinθ)', ['reciprocal'], 'both'],
  ['(1/cosθ - cosθ)/(1/sinθ - sinθ)', '((1 - cos^2θ)/cosθ)/((1 - sin^2θ)/sinθ)', ['common-denominator'], 'both'],
  ['((1 - cos^2θ)/cosθ)/((1 - sin^2θ)/sinθ)', '(sin^2θ/cosθ)/(cos^2θ/sinθ)', ['pythagorean'], 'both'],
  ['(sin^2θ/cosθ)/(cos^2θ/sinθ)', 'sin^2θ/cosθ × sinθ/cos^2θ', ['divide-fraction']],
  ['sin^2θ/cosθ × sinθ/cos^2θ', 'sin^3θ/cos^3θ', ['multiply-fractions', 'index-product']],
  ['sin^3θ/cos^3θ', 'tan^3θ', ['quotient'], 'whole'],
  // scope: one part of a fraction
  ['sin^2(x)/cos(x)', '(1 - cos^2(x))/cos(x)', ['pythagorean'], 'numerator'],
  ['sin(x)/(1 - sin^2(x))', 'sin(x)/cos^2(x)', ['pythagorean'], 'denominator'],
  // reciprocal and quotient identities
  ['sec(x)', '1/cos(x)', ['reciprocal']],
  ['cosec(x)', '1/sin(x)', ['reciprocal']],
  ['cot(x)', '1/tan(x)', ['reciprocal']],
  ['tan(x)', 'sin(x)/cos(x)', ['quotient']],
  ['cot(x)', 'cos(x)/sin(x)', ['quotient']],
  ['tan(x)cos(x)', 'sin(x)', ['quotient', 'cancel-common-factor']],
  // the three Pythagorean forms
  ['sin^2(x) + cos^2(x)', '1', ['pythagorean']],
  ['1 - sin^2(x)', 'cos^2(x)', ['pythagorean']],
  ['sec^2(x) - tan^2(x)', '1', ['pythagorean-tan']],
  ['1 + tan^2(x)', 'sec^2(x)', ['pythagorean-tan']],
  ['1 + cot^2(x)', 'cosec^2(x)', ['pythagorean-cot']],
  ['cosec^2(x) - 1', 'cot^2(x)', ['pythagorean-cot']],
  // double-angle, each form of cos 2x by itself
  ['sin(2x)', '2sin(x)cos(x)', ['double-angle-sin']],
  ['2sin(x)cos(x)', 'sin(2x)', ['double-angle-sin']],
  ['cos(2x)', 'cos^2(x) - sin^2(x)', ['double-angle-cos']],
  ['cos(2x)', '2cos^2(x) - 1', ['double-angle-cos-cos']],
  ['cos(2x)', '1 - 2sin^2(x)', ['double-angle-cos-sin']],
  ['tan(2x)', '2tan(x)/(1 - tan^2(x))', ['double-angle-tan']],
  // compound angles
  ['sin(a + b)', 'sin(a)cos(b) + cos(a)sin(b)', ['compound-sin']],
  ['sin(a - b)', 'sin(a)cos(b) - cos(a)sin(b)', ['compound-sin']],
  ['cos(a + b)', 'cos(a)cos(b) - sin(a)sin(b)', ['compound-cos']],
  ['cos(a - b)', 'cos(a)cos(b) + sin(a)sin(b)', ['compound-cos']],
  ['tan(a + b)', '(tan(a) + tan(b))/(1 - tan(a)tan(b))', ['compound-tan']],
  // fractions
  ['1/x + 1/y', '(x + y)/(xy)', ['common-denominator']],
  ['(a + b)/c', 'a/c + b/c', ['split-fraction']],
  ['(a/b)/(c/d)', '(a/b)(d/c)', ['divide-fraction']],
  ['(a/b)(c/d)', '(ac)/(bd)', ['multiply-fractions']],
  ['((x + 3)(x - 3))/(x - 3)', 'x + 3', ['cancel-common-factor']],
  ['(6x)/(3y)', '(2x)/y', ['cancel-common-factor']],
  // expanding, factorising, difference of two squares
  ['2(x + 1)', '2x + 2', ['expand']],
  ['(x + 1)(x + 2)', 'x^2 + 3x + 2', ['expand']],
  ['x^2 + 3x', 'x(x + 3)', ['factorise']],
  ['x^2 + 5x + 6', '(x + 2)(x + 3)', ['factorise']],
  ['(x + 3)(x - 3)', 'x^2 - 9', ['difference-of-squares']],
  ['x^2 - 9', '(x + 3)(x - 3)', ['difference-of-squares']],
  ['cos^4(x) - sin^4(x)', '(cos^2(x) - sin^2(x))(cos^2(x) + sin^2(x))', ['difference-of-squares']],
  // index laws
  ['x^2 * x^3', 'x^5', ['index-product']],
  ['(x^2)^3', 'x^6', ['index-power']],
  ['(a/b)^3', 'a^3/b^3', ['index-quotient-power']],
  // log laws
  ['ln(xy)', 'ln(x) + ln(y)', ['log-product']],
  ['ln(x/y)', 'ln(x) - ln(y)', ['log-quotient']],
  ['ln(x^3)', '3ln(x)', ['log-power']],
  ['log(x) + log(y)', 'log(xy)', ['log-product']],
  // a step that used two identities at once
  ['1/cos(x) - cos(x)', 'sin^2(x)/cos(x)', ['pythagorean', 'common-denominator']],
  ['(1 + tan^2(A))/(1 + cot^2(A))', 'sec^2(A)/cosec^2(A)', ['pythagorean-tan', 'pythagorean-cot']],
  ['sec(A)(1 - sin(A))(sec(A) + tan(A))', '(1/cos(A))(1 - sin(A))(1/cos(A) + sin(A)/cos(A))', ['reciprocal', 'quotient']]
];
for (const [from, to, want, scope] of NAMED) {
  const r = justifyStep(from, to);
  ok(`${from} → ${to}: valid`, r?.valid === true);
  ok(`${from} → ${to}: named ${JSON.stringify(want)}, got ${JSON.stringify(names(r))}`, same(names(r), want));
  if (scope) ok(`${from} → ${to}: scope ${scope}, got ${r?.rules?.[0]?.scope}`, r?.rules?.[0]?.scope === scope);
  for (const rule of r?.rules || []) {
    ok(`${rule.rule} has its identity typeset`, typeof rule.latex === 'string' && rule.latex.length > 3);
    ok(`${rule.rule} is a catalogued rule`, STEP_RULE_IDS.includes(rule.rule));
  }
}
// Every rule in the catalogue is exercised by a named case.
const exercised = new Set(NAMED.flatMap(c => c[2]));
for (const id of STEP_RULE_IDS) ok(`rule ${id} has a named case`, exercised.has(id));

// ── NEGATIVE ──────────────────────────────────────────────────────────────────
// Wrong steps are not equivalent: no rule, no "valid".
const WRONG = [
  ['sec(x)', '1/sin(x)'],                     // reciprocal of the wrong function
  ['cosec(x)', '1/cos(x)'],
  ['tan(x)', 'cos(x)/sin(x)'],                // quotient upside down
  ['1 - sin^2(x)', 'cos(x)'],                 // dropped the square
  ['1 - sin(x)', 'cos(x)'],
  ['sin(2x)', '2sin(x)'],                     // doubling the ratio
  ['cos(2x)', '2cos(x)'],
  ['cos(2x)', '1 - 2cos^2(x)'],               // wrong form
  ['sin(a + b)', 'sin(a) + sin(b)'],
  ['cos(a + b)', 'cos(a)cos(b) + sin(a)sin(b)'], // sign slip
  ['ln(x + y)', 'ln(x) + ln(y)'],
  ['ln(xy)', 'ln(x)ln(y)'],
  ['(a/b)/(c/d)', '(a/b)(c/d)'],              // forgot to flip
  ['1/x + 1/y', '2/(x + y)'],
  ['(x + 3)/3', 'x'],                         // cancelling a term, not a factor
  ['(x + 3)^2', 'x^2 + 9'],
  ['x^2 * x^3', 'x^6'],
  ['(x^2)^3', 'x^5'],
  ['sin^3θ/cos^3θ', 'tan^2θ'],
  ['(sin^2θ/cosθ)/(cos^2θ/sinθ)', 'sin^2θ/cosθ × cos^2θ/sinθ']
];
for (const [from, to] of WRONG) {
  const r = justifyStep(from, to);
  ok(`${from} → ${to} is not a valid step`, r?.valid === false);
  ok(`${from} → ${to} names no rule`, !r?.rules?.length);
}
// Must-not-name: a valid step is never given these rules.
const NOT = [
  ['(1/cosθ - cosθ)/(1/sinθ - sinθ)', '((1 - cos^2θ)/cosθ)/((1 - sin^2θ)/sinθ)', ['factorise', 'expand', 'pythagorean', 'reciprocal']],
  ['((1 - cos^2θ)/cosθ)/((1 - sin^2θ)/sinθ)', '(sin^2θ/cosθ)/(cos^2θ/sinθ)', ['expand', 'factorise', 'common-denominator', 'reciprocal']],
  ['sin^3θ/cos^3θ', 'tan^3θ', ['index-quotient-power', 'reciprocal', 'pythagorean']],
  ['(cos^2(x) - sin^2(x))(cos^2(x) + sin^2(x))', 'cos^2(x) - sin^2(x)', ['expand', 'factorise', 'cancel-common-factor']],
  ['sec(x)', '1/cos(x)', ['quotient', 'pythagorean', 'pythagorean-tan']],
  ['tan(x)', 'sin(x)/cos(x)', ['reciprocal', 'pythagorean']],
  ['sin(2x)', '2sin(x)cos(x)', ['double-angle-cos', 'compound-sin']],
  ['cos(2x)', '1 - 2sin^2(x)', ['double-angle-cos', 'double-angle-cos-cos', 'pythagorean']],
  ['x^2 - 9', '(x + 3)(x - 3)', ['factorise', 'expand']],
  ['1/x + 1/y', '(x + y)/(xy)', ['split-fraction', 'factorise']],
  ['(a + b)/c', 'a/c + b/c', ['common-denominator', 'expand']],
  ['x^2 + 3x', 'x(x + 3)', ['expand', 'cancel-common-factor']],
  // two relations sampled at one angle must not stand in for the quotient and reciprocal identities
  ['tan(x)^2', 'sin(x)^2*sec(x)^2', ['pythagorean', 'pythagorean-tan']],
  ['sin(x)^2*sec(x)^2', 'tan(x)^2', ['pythagorean', 'pythagorean-tan']],
  ['tan(x)^4', 'sin(x)^4*sec(x)^4', ['pythagorean', 'pythagorean-tan']]
];
for (const [from, to, never] of NOT) {
  const got = names(justifyStep(from, to));
  for (const bad of never) ok(`${from} → ${to} must not be named ${bad} (got ${JSON.stringify(got)})`, !got.includes(bad));
}
// A jump: valid, but no rule set of two explains it — no name, flagged.
{
  const r = justifyStep('(secθ - cosθ)/(cscθ - sinθ)', 'tan^3θ');
  ok('a three-identity jump is valid', r?.valid === true);
  ok('a three-identity jump names no rule', r?.rules?.length === 0);
  ok('a three-identity jump is flagged as more than two rules', r?.more === true);
}
// Restating a line is not a rule.
{
  const r = justifyStep('sin(x)/cos(x)', '(sin(x))/(cos(x))');
  ok('restating is valid and named as the same expression', r?.valid === true && r?.same === true && r.rules.length === 0);
}
// Unreadable input is not judged.
ok('an unreadable line is not judged', justifyStep('sin(', 'cos(x)') === null);
ok('an equation is not an expression step', justifyStep('x = 2', 'x = 2') === null);
// A rule written with csc keeps the student's spelling in the identity.
ok('csc stays \\csc', /\\csc/.test(justifyStep('csc(x)', '1/sin(x)')?.rules?.[0]?.latex || ''));
ok('cosec is typeset as cosec', /cosec/.test(justifyStep('cosec(x)', '1/sin(x)')?.rules?.[0]?.latex || ''));
ok('the identity uses the student\'s angle', /\\theta/.test(justifyStep('secθ', '1/cosθ')?.rules?.[0]?.latex || ''));
// A one-letter angle is spaced from its function: \sec A, never \secA (KaTeX would show an error).
ok('a letter angle is typeset \\sec A', /\\sec A = \\frac\{1\}\{\\cos A\}/.test(justifyStep('sec(A)', '1/cos(A)')?.rules?.[0]?.latex || ''));
for (const [f, t] of [['sec(A)', '1/cos(A)'], ['tan(x)', 'sin(x)/cos(x)'], ['sin(2x)', '2sin(x)cos(x)'], ['1 + tan(A)^2', 'sec(A)^2']]) {
  const tex = justifyStep(f, t)?.rules?.[0]?.latex || '';
  ok(`${f} → ${t}: no function name runs into its argument (${tex})`, !/\\(sin|cos|tan|sec|cot|csc)[A-Za-z]/.test(tex));
}

// ── PROOFS ────────────────────────────────────────────────────────────────────
const LEIBNIZ = '(secθ - cosθ)/(cscθ - sinθ) = tan^3θ';
const straight = ['LHS = (secθ - cosθ)/(cscθ - sinθ)', '= (1/cosθ - cosθ)/(1/sinθ - sinθ)', '= ((1 - cos^2θ)/cosθ)/((1 - sin^2θ)/sinθ)',
  '= (sin^2θ/cosθ)/(cos^2θ/sinθ)', '= sin^2θ/cosθ × sinθ/cos^2θ', '= sin^3θ/cos^3θ', '= tan^3θ'];
{
  const a = annotateWorking(straight, { statement: LEIBNIZ });
  ok('straight proof: complete', a.proof?.complete === true && a.proof.mode === 'direct');
  ok('straight proof: every step named', a.lines.slice(1).every(l => l.steps.length === 1 && l.steps[0].justification?.rules?.length > 0));
  const b = annotateWorking([...straight.slice(0, -1), '= tan^3θ = RHS'], { statement: LEIBNIZ });
  ok('ending "= RHS": complete', b.proof?.complete === true);
  const meet = ['LHS = (secθ - cosθ)/(cscθ - sinθ)', '= (sin^2θ/cosθ)/(cos^2θ/sinθ)', '= sin^3θ/cos^3θ', 'RHS = tan^3θ', '= sin^3θ/cos^3θ'];
  const m = annotateWorking(meet, { statement: LEIBNIZ });
  ok('meet in the middle: complete', m.proof?.complete === true && m.proof.mode === 'meet');
  ok('meet in the middle: the RHS chain starts a new chain, not a step from line 3', m.lines[3].steps.length === 0);
  ok('meet in the middle: the meeting lines are 3 and 5', same(m.proof?.meetLines, [2, 4]));
  ok('meet in the middle: the RHS chain is marked as starting from the right-hand side', m.lines[3].side === 'rhs' && m.lines[0].side === 'lhs');
  const notMet = annotateWorking(['LHS = (secθ - cosθ)/(cscθ - sinθ)', '= (sin^2θ/cosθ)/(cos^2θ/sinθ)', 'RHS = tan^3θ', '= sin^3θ/cos^3θ'], { statement: LEIBNIZ });
  ok('two chains that end on different expressions do not complete the proof', notMet.proof?.complete === false);
  const broken = annotateWorking(['LHS = (secθ - cosθ)/(cscθ - sinθ)', '= (sin^2θ/cosθ)/(cos^2θ/sinθ)', '= sin^2θ/cos^3θ', '= tan^3θ'], { statement: LEIBNIZ });
  ok('a proof with a wrong step is not complete', broken.proof?.complete === false);
  ok('the wrong step is reported invalid', broken.lines[2].steps[0]?.justification?.valid === false);
}
// The panel: after the first error, a line that follows correctly from the
// line above says "follows from line n"; one that does not is "not verified".
{
  const q = identityProof(() => 0.01, 'nsw');
  const lines = ['(sec(θ) - cos(θ))/(cosec(θ) - sin(θ))', '(sin(θ)^2/cos(θ))/(cos(θ)^2/sin(θ))', 'sin(θ)^2/cos(θ)^3', 'sin(θ)^2/cos(θ)^3 * 1', 'tan(θ)^3'];
  const r = checkWorking(q, lines.join('\n'));
  const m = buildAnnotatedWorking({ lines, stepReport: r.stepReport, receipt: null, solution: { answerText: q.answer.canonicalWorking, steps: q.steps } });
  ok('panel: line 3 is the first error', m.cards[2].status === 'first-error');
  ok('panel: line 4 follows from line 3', m.cards[3].status === 'follows' && m.cards[3].followsFrom === 3);
  ok('panel: line 5 does not follow from line 4', m.cards[4].status === 'not-verified');
  ok('panel: a broken proof is summarised by its first error', m.summary.key === 'aw.summary.breaks' && m.summary.vars.n === 3);
  ok('panel: follow-through lines are listed as not counted yet', JSON.stringify(m.followThrough) === '[4]');
  ok('panel: a criterion evidenced only after the error is not counted, never met', m.criteria.every(c => !c.followThrough || c.lines.length === 0));
  ok('panel: lines 6, 7, 8 read as a range', lineRange([6, 7, 8]) === '6–8' && lineRange([2, 4]) === '2, 4' && lineRange([2, 3]) === '2, 3');
  ok('panel: a first attempt says nothing about re-marking', m.attempt === null);
  ok('panel: a second marked attempt says so', buildAnnotatedWorking({ lines, stepReport: r.stepReport, attempt: 2, solution: { answerText: q.answer.canonicalWorking, steps: q.steps } }).attempt === 2);
  ok('panel: no evidence is counted after the first error', m.criteria.every(c => c.lines.every(n => n < 3)));
  const good = q.answer.canonicalWorking.split('\n');
  const g = buildAnnotatedWorking({ lines: good, stepReport: checkWorking(q, good.join('\n')).stepReport, receipt: { awarded: 4, possible: 4 }, solution: { answerText: q.answer.canonicalWorking, steps: q.steps } });
  ok('panel: a complete proof is summarised as complete', g.summary.key === 'aw.summary.proofDirect');
  ok('panel: every criterion of the worked proof has evidence', g.criteria.every(c => c.lines.length > 0));
  ok('panel: every step after the first is named', g.cards.slice(1).every(c => c.rules.length > 0));
  ok('panel: the first line is the start', g.cards[0].start === true);
  ok('panel: an unread line is labelled unread, not judged', buildAnnotatedWorking({ lines: good, stepReport: checkWorking(q, good.join('\n')).stepReport, readStates: good.map((_, i) => (i === 2 ? 'cant' : 'read')), solution: null }).cards[2].status === 'unread');
  const jump = [good[0], good[good.length - 1]];
  const j = buildAnnotatedWorking({ lines: jump, stepReport: checkWorking(q, jump.join('\n')).stepReport, solution: { answerText: q.answer.canonicalWorking, steps: q.steps } });
  ok('panel: a one-line jump is flagged as a larger step, not named', j.jumps.length === 1 && j.cards[1].rules.length === 0);
  ok('panel: equation working is left to its own report', buildAnnotatedWorking({ lines: ['2x + 3 = 7', '2x = 4', 'x = 2'], stepReport: { lines: [{ text: '2x + 3 = 7', status: 'ok' }, { text: '2x = 4', status: 'ok' }, { text: 'x = 2', status: 'ok' }] } }) === null);
}
// The server's checker: the same proofs are marked complete, "= RHS" included.
for (const ed of ['nsw', 'cbse']) {
  const catalogue = identityProofCatalogue(ed);
  catalogue.forEach((_, i) => {
    const q = identityProof(() => (i + 0.5) / catalogue.length, ed);
    const lines = q.answer.canonicalWorking.split('\n');
    const label = `${ed} proof ${i + 1} (${lines[0]})`;
    ok(`${label}: the worked proof is correct`, checkWorking(q, lines.join('\n')).correct === true);
    ok(`${label}: ending "= RHS" after the right-hand side is correct`, checkWorking(q, [...lines, '= RHS'].join('\n')).correct === true);
    ok(`${label}: "… = R.H.S." on the right-hand side's own line is correct`, checkWorking(q, [...lines.slice(0, -1), `${lines[lines.length - 1]} = R.H.S.`].join('\n')).correct === true);
    ok(`${label}: a closing "Hence LHS = RHS" is correct`, checkWorking(q, [...lines, 'Hence LHS = RHS'].join('\n')).correct === true);
    // FALSE CREDIT: "= RHS" in place of the right-hand side, under a line that is not it
    if (lines.length > 2) ok(`${label}: "= RHS" under a line that is not yet the RHS earns no credit`, checkWorking(q, [...lines.slice(0, -1), '= RHS'].join('\n')).correct !== true);
    const half = Math.max(1, Math.floor(lines.length / 2));
    const meet = [`LHS = ${lines[0]}`, ...lines.slice(1, half + 1).map(l => `= ${l}`), `RHS = ${lines[lines.length - 1]}`,
      ...lines.slice(half, lines.length - 1).reverse().map(l => `= ${l}`)];
    // Meeting in the middle ends on the meeting expression. When the right-hand
    // side is a constant (… = 1) that expression has holes the constant does
    // not, and the final-line check refuses an isolated-domain difference
    // (#231) — nobody meets "1" in the middle, so that item is not asked to.
    if (/[a-z]/i.test(q.answer.stepMeta.sides.rhs)) ok(`${label}: meeting in the middle is correct`, checkWorking(q, meet.join('\n')).correct === true);
    ok(`${label}: meeting in the middle is a complete proof`, annotateWorking(meet, { statement: `${lines[0]} = ${lines[lines.length - 1]}` }).proof?.complete === true);
    ok(`${label}: a wrong line is not correct`, checkWorking(q, [lines[0], `${lines[1]} + 1`, ...lines.slice(2)].join('\n')).correct !== true);
    // every worked step's evidence rule is found in the authored proof
    const found = new Set();
    for (let k = 1; k < lines.length; k += 1) for (const r of justifyStep(lines[k - 1], lines[k])?.rules || []) found.add(r.rule);
    q.steps.forEach((s, j) => { if (s.rules.length) ok(`${label}: step ${j + 1} evidence (${s.rules.join(', ')}) is found in the worked proof`, s.rules.some(r => found.has(r))); });
    ok(`${label}: prompt is a proof`, /^Prove that \$/.test(q.prompt));
  });
}
// The exact competitor identity is in both editions' banks.
ok('the screenshot identity is an NSW proof', identityProofCatalogue('nsw').some(p => p.rhs === 'tan({t})^3'));
ok('the screenshot identity is a CBSE proof', identityProofCatalogue('cbse').some(p => p.rhs === 'tan({t})^3'));
// "= RHS" is read only for an item that states its sides.
{
  const meta = { kind: 'expression', canonical: '(sec(θ) - cos(θ))/(cosec(θ) - sin(θ))' };
  const r = stepCheck(meta, 'LHS = (secθ - cosθ)/(cosecθ - sinθ)\n= tan^3θ\n= RHS');
  ok('without stated sides, "= RHS" is still not read as an expression', r.lines[2].status === 'break');
  const r2 = stepCheck({ ...meta, sides: { lhs: meta.canonical, rhs: 'tan(θ)^3' } }, 'LHS = (secθ - cosθ)/(cosecθ - sinθ)\n= tan^3θ\n= RHS');
  ok('with stated sides, "= RHS" is the stated right-hand side', r2.lines[2].status === 'ok');
}

// ── FALSE CREDIT: proof-shaped attacks on items that state their sides ──────
// The reviewer's and the CTO's attacks on the "= RHS" path, each pinned. Every
// one must earn no credit; the ones with a wrong line must show where it breaks.
{
  const q = identityProof(() => 0.01, 'nsw');       // (sec θ − cos θ)/(cosec θ − sin θ) = tan³θ
  const L = q.answer.stepMeta.sides.lhs;
  const lines = q.answer.canonicalWorking.split('\n');
  const deny = (label, working, breakLine = null) => {
    const r = checkWorking(q, working.join('\n'));
    ok(`false credit refused: ${label}`, r.correct !== true);
    if (breakLine != null) ok(`${label}: the first error is line ${breakLine + 1}`, r.stepReport?.firstBreak === breakLine);
  };
  // 1 · "= RHS" after a line that is not equivalent to the RHS
  deny('"= RHS" after a wrong line', [L, 'sin(θ)^2/cos(θ)^3', '= RHS'], 1);
  deny('"x = RHS" where x is false', [L, 'sin(θ)^2/cos(θ) = RHS'], 1);
  deny('"1 = RHS"', [L, '1 = RHS'], 1);
  deny('"= RHS" after an equal line that is not yet the RHS', [L, 'sin(θ)^3/cos(θ)^3', '= RHS'], 2);
  // 2 · no working, or a jump straight from the LHS
  deny('"RHS" then "RHS"', ['RHS', 'RHS']);
  deny('"LHS" then "RHS"', ['LHS', 'RHS']);
  deny('"LHS" then "= RHS"', ['LHS', '= RHS']);
  deny('the LHS then "= RHS"', [L, '= RHS']);
  deny('the LHS then the RHS (a jump)', [L, 'tan(θ)^3']);
  deny('the LHS written twice, then the RHS', [L, L, 'tan(θ)^3']);
  deny('"LHS = RHS" alone', ['LHS = RHS']);
  // 3 · circular: the identity asserted, then "worked" towards
  deny('the identity asserted at the top, then the RHS', [`${L} = tan(θ)^3`, 'tan(θ)^3']);
  deny('"LHS = RHS" at the top, then RHS', ['LHS = RHS', 'tan(θ)^3', '= RHS']);
  deny('the identity worked as an equation', [`${L} = tan(θ)^3`, '1/cos(θ) - cos(θ) = tan(θ)^3*(1/sin(θ) - sin(θ))'], 1);
  deny('asserted, then an equation reduced to 1 = 1', ['LHS = RHS', `(${L})/tan(θ)^3 = 1`, '1 = 1']);
  // 4 · two chains that do not meet, or meet only after an unequal line
  deny('two chains ending on different expressions', ['LHS = ' + L, '= (sin(θ)^2/cos(θ))/(cos(θ)^2/sin(θ))', 'RHS = tan(θ)^3', '= sin(θ)^3/cos(θ)^3']);
  deny('a meet reached through a wrong line', ['LHS = ' + L, '= sin(θ)^2/cos(θ)^3', 'RHS = tan(θ)^3', '= sin(θ)^2/cos(θ)^3'], 1);
  deny('an RHS chain only', ['RHS = tan(θ)^3', '= sin(θ)^3/cos(θ)^3']);
  // 5 · a different identity
  deny('a different, true identity', ['sec(θ)^2 - tan(θ)^2', '= 1']);
  deny('a different starting expression equal to the LHS', ['sin(θ)^3/cos(θ)^3', '= tan(θ)^3']);
  // and the honest proofs still earn it
  ok('a straight proof is credited', checkWorking(q, lines.join('\n')).correct === true);
  ok('a "To prove: LHS = RHS" header does not stop a proof', checkWorking(q, ['To prove: LHS = RHS', ...lines].join('\n')).correct === true);
  ok('a labelled straight proof is credited', checkWorking(q, [`LHS = ${lines[0]}`, ...lines.slice(1).map(l => `= ${l}`), '= RHS'].join('\n')).correct === true);
  ok('meeting in the middle at the same expression is credited',
    checkWorking(q, [`LHS = ${L}`, '= (sin(θ)^2/cos(θ))/(cos(θ)^2/sin(θ))', '= sin(θ)^3/cos(θ)^3', 'RHS = tan(θ)^3', '= sin(θ)^3/cos(θ)^3'].join('\n')).correct === true);
  // an item WITHOUT stated sides reads exactly as before
  const plain = { ...q, answer: { ...q.answer, stepMeta: { kind: 'expression', canonical: L } } };
  ok('without stated sides, a one-step jump is read as before', checkWorking(plain, [L, 'tan(θ)^3'].join('\n')).correct === true);
}

// ── MARKS: the annotation never changes what the checker decided ─────────────
{
  const q = identityProof(() => 0.01, 'nsw');
  const lines = q.answer.canonicalWorking.split('\n');
  for (const working of [lines, [...lines.slice(0, 3), 'sin(θ)^2', ...lines.slice(4)], [lines[0], lines[lines.length - 1]]]) {
    const before = JSON.stringify(checkWorking(q, working.join('\n')));
    const report = JSON.parse(before).stepReport;
    const receipt = { awarded: 3, possible: 4, correct: JSON.parse(before).correct };
    const frozen = JSON.stringify(receipt);
    const model = buildAnnotatedWorking({ lines: working, stepReport: report, receipt, solution: { answerText: q.answer.canonicalWorking, steps: q.steps } });
    ok('the checker result is unchanged by building the panel', JSON.stringify(checkWorking(q, working.join('\n'))) === before);
    ok('the receipt passed to the panel is not changed', JSON.stringify(receipt) === frozen);
    ok('the panel shows the receipt marks exactly', model?.marks?.awarded === 3 && model.marks.possible === 4);
    ok('the panel never states marks of its own', !('awarded' in (model || {})) && model.criteria.every(c => !('mark' in c)));
  }
}

// ── COPY: facts only, every state has a word and a shape ─────────────────────
{
  const { readFileSync } = await import('node:fs');
  const EN = (await import('../src/i18n/strings.en.js')).default;
  const HI = (await import('../src/i18n/strings.hi.js')).default;
  const camel = k => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const awKeys = Object.keys(EN).filter(k => k.startsWith('aw.'));
  const text = v => (typeof v === 'string' ? v : `${v?.one ?? ''} ${v?.other ?? ''}`);
  const PRAISE = /\b(excellent|great|creative|brilliant|amazing|awesome|well done|perfect|fantastic|superb)\b/i;
  for (const k of awKeys) ok(`${k} has no praise word`, !PRAISE.test(text(EN[k])));
  for (const k of awKeys) ok(`${k} has a Hindi string`, typeof HI[k] === 'string' || (HI[k] && HI[k].one && HI[k].other));
  for (const id of STEP_RULE_IDS) ok(`rule ${id} has an English and a Hindi name`, typeof EN[`aw.rule.${camel(id)}`] === 'string' && typeof HI[`aw.rule.${camel(id)}`] === 'string');
  for (const st of ['checked', 'first-error', 'follows', 'not-verified', 'unread']) ok(`state ${st} has a word`, typeof EN[`aw.status.${camel(st)}`] === 'string');
  const src = readFileSync(new URL('../src/components/AnnotatedWorking.jsx', import.meta.url), 'utf8');
  const icons = /const STATUS_ICON = \{([^}]+)\}/.exec(src)?.[1] || '';
  for (const st of ['checked', "'first-error'", 'follows', "'not-verified'", 'unread']) ok(`state ${st} has a shape`, icons.includes(`${st}:`));
  ok('engine-verified cards never carry an AI label', !/\bAI\b/.test(awKeys.filter(k => !k.startsWith('aw.eval.provenance')).map(k => text(EN[k])).join(' ')));
}

console.log(`Named ${NAMED.length} steps across ${STEP_RULE_IDS.length} rules; ${WRONG.length} wrong steps; ${NOT.length} must-not-name cases.`);
console.log('Authored cases only — no real student working has been scored by this engine.');
if (failures.length) { console.log('\nfailures:'); for (const f of failures) console.log(`  ✖ ${f}`); }
console.log(`\nSTEP JUSTIFY: ${failures.length ? 'FAIL' : 'PASS'} — ${pass}/${pass + failures.length} checks`);
process.exit(failures.length ? 1 : 0);
