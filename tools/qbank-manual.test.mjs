// tools/qbank-manual.mjs and its use in the importer: the owner's manual parts (show/prove/explain/sketch, and "find" parts with no structured key).
// Every question here is invented for the test; none of the owner's bank is in this repository.
//
//   node tools/qbank-manual.test.mjs
import crypto from 'node:crypto';
import { classifyManual, readPrintedAnswer, deriveKey, asDerivedPart, plausibleWrongs, stepResults, stepResultLeak, bracketFunctions, plainOf, evalTeX, keyAgreesWithTeX, naturalForms } from './qbank-manual.mjs';
import { compilePack, derivedSample, derivedKeyRefusals, engineQuestion, printedAnswers, evaluateManual } from './qbank-import.mjs';
import { loadPack } from '../server/platform/qbankPack.js';
import { checkBankAnswer } from '../server/platform/qbankMarking.js';

let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── 1. classification, from the prompt's words outside the maths ─────────────
eq(classifyManual('Show that $x^{2}+1>0$ for all real $x$.'), 'prove', 'show that');
eq(classifyManual('Prove that the sum of two even numbers is even.'), 'prove', 'prove');
eq(classifyManual('Verify that $x=2$ is a root.'), 'prove', 'verify');
eq(classifyManual('Derive the formula for the volume of a cone.'), 'prove', 'derive');
eq(classifyManual('Explain why the graph has no turning point.'), 'explain', 'explain');
eq(classifyManual('Describe the transformation that maps $f$ to $g$.'), 'explain', 'describe');
eq(classifyManual('Sketch $y=x^{2}-4$, showing the intercepts.'), 'sketch', 'sketch');
eq(classifyManual('Find the gradient of $y=3x^{2}$ at $x=2$.'), 'find', 'find');
eq(classifyManual('A word like $show$ inside the maths does not count. Find $x$.'), 'find', 'a word inside $...$ is maths, not a verb');

// ── 2. reading his printed answer ────────────────────────────────────────────
const read = (ans, prompt = 'Find the value.') => readPrintedAnswer(ans, prompt);
eq(read('$12$').kind, 'numeric', 'a whole number');
eq(read('$\\tfrac{3}{4}$').value, 0.75, 'a fraction is its value');
eq(read('$x=3$', 'Find $x$.').kind, 'numeric', 'x = 3 is the value 3');
eq(read('$2\\sqrt{3}$').kind, 'numeric', 'a surd is a value');
eq(read('$3x^{2}-4$').kind, 'expression', 'an expression with one unknown');
eq(read('$y=2x+1$', 'Find the equation of the line.').kind, 'equation', 'y = ... on an "equation of" question');
eq(read('$y=2x+1$', 'Find the line.').no, 'left-side-not-a-bare-value', 'y = ... where no equation is asked for is not guessed');
eq(read('$\\dfrac{dy}{dx}=3x^{2}$').kind, 'expression', 'dy/dx = ... carries its label');
eq(read('$(3,-4)$', 'Find the coordinates of the vertex.').kind, 'point', 'a point where a point is asked for');
eq(read('$(3,-4)$', 'Find the value.').no, 'point-not-asked', 'a point is not read where none is asked for');
eq(read('$x=1$ or $x=3$', 'Solve the equation.').values, [1, 3], 'a set where the question solves');
eq(read('$1,\\ 3$', 'Solve the equation.').kind, 'set', 'a comma list is a set');
eq(read('$1,\\ 3$', 'Find the answer.').no, 'list-not-asked', 'a list where one value is asked for is not guessed');
eq(read('$2.1$; $0.49$').no, 'several-quantities', 'a semicolon is his sign for two quantities');
eq(read('$5$ metres').no, 'words-with-the-answer', 'a unit or a word with the answer');
eq(read('$\\pm 3$').no, 'approximate-or-plus-minus', 'plus or minus is two values');
eq(read('$x\\approx 3.14$').no, 'approximate-or-plus-minus', 'an approximation');
eq(read('$x>2$').no, 'inequality-or-range', 'an inequality');
eq(read('$30^\\circ$').no, 'unit-in-answer', 'degrees');
eq(read('$\\text{undefined}$').no, 'unreadable-or-has-words', 'a word inside the maths');
eq(read('').no, 'no-printed-answer', 'nothing printed');
eq(read(undefined).no, 'no-printed-answer', 'nothing printed (absent)');

// ── 3. deriving a key: his answer AND his last worked step ───────────────────
const find = (prompt, ans, steps, over = {}) => ({ prompt, steps, ...over, _ans: ans });
const derive = p => deriveKey(p, p._ans);
{
  const p = find('Find the gradient of $y=x^{2}$ at $x=3$.', '$6$', [{ h: 'Differentiate', d: '$\\dfrac{dy}{dx}=2x$' }, { h: 'Substitute', d: '$2\\times 3=6$' }]);
  eq(derive(p), { answerType: 'numeric', answer: { value: 6 }, shown: '6' }, 'a value his last step reaches is the key');
}
{
  const p = find('Find the gradient of $y=x^{2}$ at $x=3$.', '$6$', [{ h: 'Substitute', d: '$2\\times 3=6$' }, { h: 'Tidy', d: 'So the gradient is steep.' }]);
  eq(derive(p).no, 'not-the-last-step-result', 'a value only an earlier step reaches is not the key (the last step must state it)');
}
{
  const p = find('Find the gradient of $y=x^{2}$ at $x=3$.', '$7$', [{ h: 'Substitute', d: '$2\\times 3=6$' }]);
  eq(derive(p).no, 'not-the-last-step-result', 'a printed answer his own working does not reach is not guessed');
}
{
  const p = find('Differentiate $y=x^{3}$.', '$3x^{2}$', [{ h: 'Rule', d: '$\\dfrac{dy}{dx}=3x^{2}$' }]);
  eq(derive(p).answerType, 'expression', 'an expression equal to a side of the last step');
}
{
  const p = find('Solve $x^{2}-5x+6=0$.', '$x=2$ or $x=3$', [{ h: 'Factorise', d: '$(x-2)(x-3)=0$' }, { h: 'Solve', d: '$x=2$ or $x=3$' }]);
  eq(derive(p).answer, { values: [2, 3] }, 'a set whose every value the last step states');
}
{
  const p = find('Find the equation of the tangent to $y=x^{2}$ at $(1,1)$.', '$y=2x-1$', [{ h: 'Gradient', d: '$2$' }, { h: 'Tangent', d: '$y-1=2(x-1)$, so $y=2x-1$' }]);
  eq(derive(p).answerType, 'equation', 'an equation the last step states');
}
{
  const p = find('Find the vertex of $y=x^{2}-2x-3$.', '$(1,-4)$', [{ h: 'x', d: '$x=1$' }, { h: 'y', d: '$y=-4$, the vertex is $(1,-4)$' }]);
  eq(derive(p).answerType, 'point', 'a point the last step states');
}
const NOT = [
  ['a show-that question', find('Show that $x^{2}+1>0$.', '$1$', [{ h: 'a', d: '$1$' }]), 'not-a-find'],
  ['a question that asks for two things', find('Find $x$ and find $y$.', '$3$', [{ h: 'a', d: '$x=3$' }]), 'asks-several-things'],
  ['a named precision', find('Find $x$, correct to 2 decimal places.', '$3.14$', [{ h: 'a', d: '$x=3.14$' }]), 'names-a-precision'],
  ['a mandated method', find('Use the substitution $u=x^{2}$ to find $\\int 2x\\,dx$.', '$x^{2}$', [{ h: 'a', d: '$x^{2}$' }]), 'asks-a-method'],
  ['a particular form (expression)', find('Factorise $x^{2}-1$.', '$(x-1)(x+1)$', [{ h: 'a', d: '$(x-1)(x+1)$' }]), 'asks-a-form'],
  ['a particular form (number)', find('Simplify $\\sqrt{8}$.', '$2\\sqrt2$', [{ h: 'a', d: '$2\\sqrt2$' }]), 'asks-a-form'],
  ['no steps', find('Find $x$.', '$3$', []), 'no-steps']
];
for (const [what, p, no] of NOT) eq(derive(p).no, no, `${what} is not derived`);

// ── 4. plausible wrong values are real wrong values ──────────────────────────
for (const key of [{ answerType: 'numeric', answer: { value: 6 } }, { answerType: 'expression', answer: { expr: '3*x^2' } }, { answerType: 'equation', answer: { lhs: 'y', rhs: '2*x-1' } },
  { answerType: 'set', answer: { values: [2, 3] } }, { answerType: 'point', answer: { x: 1, y: -4 } }]) {
  const wrongs = plausibleWrongs(key);
  ok(wrongs.length >= 2, `${key.answerType}: at least two plausible wrong values exist`);
  const dpart = { answerType: key.answerType, answer: key.answer, prompt: 'p', steps: [{ h: 'h', d: 'd' }], traps: [], hints: ['h'], difficulty: 2, subtopic: 'x', question: 'Q', marks: 1 };
  const q = engineQuestion(dpart);
  ok(wrongs.every(w => checkBankAnswer(q, w).correct !== true), `${key.answerType}: the engine refuses every one (${wrongs.join(' | ')})`);
}

// ── 5. the importer: converted, kept as worked solutions, or rejected ────────
const hints = ['Look at the shape of the question.', 'Think about which rule fits.', 'Work one line at a time.'];
const base = (id, over) => ({
  question: id, label: null, marks: 2, course: 'ADV', year: 11, topic: 'MA-C1', difficulty: 2, answerType: 'manual', prompt: 'Find the gradient of $y=x^{2}$ at $x=3$.',
  steps: [{ h: 'Differentiate', d: '$\\dfrac{dy}{dx}=2x$' }, { h: 'Substitute', d: '$2\\times 3=6$' }],
  criteria: [{ marks: 1, point: 'Differentiates correctly', line: '2*x' }, { marks: 1, point: 'Substitutes and evaluates' }], traps: [], hints, ...over
});
const SPEC = [
  ['FD-001', { /* derivable find */ }, '$6$'],
  ['FD-002', { prompt: 'Find the gradient of $y=x^{2}$ at $x=3$.', steps: [{ h: 'Substitute', d: '$2\\times 3=6$' }] }, '$2.5$'],                      // his printed answer is not his working's
  ['FD-003', { prompt: 'Find $E(X)$ and $\\mathrm{Var}(X)$.', steps: [{ h: 'a', d: '$2.1$' }, { h: 'b', d: '$0.49$' }] }, '$2.1$; $0.49$'],                 // two quantities
  ['PR-004', { prompt: 'Show that $(x+1)^{2}\\ge 0$ for all $x$.', steps: [{ h: 'Square', d: '$(x+1)^{2}=x^{2}+2x+1$' }, { h: 'Conclude', d: 'A square is never negative.' }] }, '$\\ge 0$'],
  ['PR-005', { prompt: 'Show that $2x+4=2(x+2)$.', steps: [{ h: 'Split', d: '$2x+4=2\\times x+2\\times 2$' }, { h: 'Factor', d: '$=2(x+2)$' }],
    hints: ['Take out the common factor.', 'Write it as $2\\times x+2\\times 2$ first.', 'Check by expanding.'] }, '$2(x+2)$'],
  ['SK-006', { prompt: 'Sketch $y=x^{2}-4$, showing the intercepts.', steps: [{ h: 'Intercepts', d: '$x=\\pm 2$, $y=-4$' }] }, 'a parabola'],
  ['EX-007', { prompt: 'Explain why $x^{2}+1$ has no real root.', steps: [{ h: 'Reason', d: '$x^{2}\\ge 0$, so $x^{2}+1\\ge 1$' }] }, 'no real root'],
  ['PR-008', { prompt: '\\leavevmode Show that $x+x=2x$.', steps: [{ h: 'Add', d: '$x+x=2x$' }] }, '$2x$']                                              // layout TeX: not served
];
const archive = () => {
  const questions = SPEC.map(([id]) => ({ id, course: 'ADV', year: 11, topic: 'MA-C1', title: id, diff: 2, q: 'q', marks: 2, ans: SPEC.find(s => s[0] === id)[2] }));
  const parts = SPEC.map(([id, over]) => base(id, over));
  return { files: {}, questions, parts, tags: Object.fromEntries(SPEC.map(([id]) => [id, 'C1.3a'])) };
};
{
  const a = archive();
  const out = compilePack(a);
  const again = compilePack(archive());
  ok([...out.files].every(([n, t]) => again.files.get(n) === t), 'the same archive compiles to the same bytes twice');
  const shard = JSON.parse(out.files.get('shards/qb-a11-ma-c1.json'));
  eq(shard.questions.map(q => q.id), ['FD-001'], 'only the derivable find part becomes a marked question');
  ok(shard.questions[0].derived === true && shard.questions[0].answerType === 'numeric' && shard.questions[0].answer.value === 6, 'it carries the derived key and says it was derived');
  ok(shard.questions[0].criteria.filter(c => c.answer === true).length === 1 && shard.questions[0].criteria.at(-1).answer === true, 'its last criterion is its answer criterion (the importer\'s tag, by position)');
  ok(shard.questions[0].traps.length === 0, 'and it has no trap');
  eq(shard.manual.map(q => q.id), ['EX-007', 'FD-002', 'FD-003', 'PR-004', 'PR-005', 'SK-006'], 'the rest are worked-solution questions');
  ok(shard.manual.every(q => q.answerType === 'manual' && q.answer === undefined && q.traps === undefined), 'a worked-solution question has no answer and no trap');
  eq(Object.fromEntries(shard.manual.map(q => [q.id, q.kind])), { 'EX-007': 'explain', 'FD-002': 'find', 'FD-003': 'find', 'PR-004': 'prove', 'PR-005': 'prove', 'SK-006': 'sketch' }, 'each carries its kind');
  eq(out.rejects.map(r => r.id), ['PR-008'], 'a part the client cannot draw is not served');
  ok(out.rejects[0].reasons.every(r => r.startsWith('manual:latex:')), 'and says why');
  eq(out.summary.manual.converted.map(c => c.id), ['FD-001'], 'the summary lists what was converted');
  ok(out.summary.manual.held['not-the-last-step-result'] === 1 && out.summary.manual.held['several-quantities'] === 1, 'and why each find part was not');
  // the hints of PR-005: the third hint's neighbour "Write $2(x+2)$" states a result of his worked steps, so it is dropped; the others stay
  const pr5 = shard.manual.find(q => q.id === 'PR-005');
  ok(!pr5.hints.some(h => h.includes('2\\times x')) && pr5.hints.length === 2 && JSON.stringify(Object.values(pr5.ladder)) === JSON.stringify(pr5.hints), 'a hint that states a result of the steps is dropped and the ladder is the hints that remain');
  // the pack loads exactly as the server loads it, and a worked-solution question is not among the marked ones
  const files = out.files;
  const pack = await loadPack({ kind: 'memory', async read(n) { return files.has(n) ? Buffer.from(files.get(n)) : null; } });
  ok(pack.questionCount === 1 && pack.manualCount === 6, 'the loader counts marked and worked-solution questions apart');
}
{
  // The derived key must pass the same checks an authored part does: a question whose derived key is accepted but whose wrong values are not refused is not converted.
  const p = base('FD-009', { prompt: 'Find the gradient of $y=x^{2}$ at $x=3$.' });
  const d = asDerivedPart(p, { answerType: 'numeric', answer: { value: 6 } });
  const r = derivedKeyRefusals(d, engineQuestion(d), { shown: '6' });
  ok(r.ok === true && r.wrongs >= 3 && r.forms >= 1, 'a numeric key that refuses its wrong values is accepted');
  const wide = asDerivedPart(p, { answerType: 'expression', answer: { expr: 'x' } });
  ok(derivedKeyRefusals({ ...wide, answer: { expr: 'x' } }, engineQuestion(wide), { shown: 'x' }).ok === true, 'an expression key refuses -x, 2x, x+1');
  // His own form must be marked correct by the real marker, in the ways a student types it. A numeric box refuses `e^2+5` ("work it out first").
  const e = base('FD-011', { prompt: 'Find the exact value of $\\displaystyle\\int_{1}^{e^{2}}\\left(1+\\frac3x\\right)dx$.', steps: [{ h: 'Integrate', d: '$[x+3\\ln x]_{1}^{e^{2}}=(e^{2}+6)-1$' }, { h: 'Result', d: '$=e^{2}+5$' }] });
  const ek = deriveKey(e, '$e^{2}+5$');
  ok(ek.answerType === 'numeric' && ek.alt?.answerType === 'expression', 'his e^2+5 is read as a number and carries an exact-form expression alternative');
  const asNumber = asDerivedPart(e, ek);
  eq(derivedKeyRefusals(asNumber, engineQuestion(asNumber), ek).why, 'his-form-is-not-accepted', 'the numeric box that says "work it out first" to his own e^2+5 is not used');
  const asExpr = asDerivedPart(e, ek.alt);
  const er = derivedKeyRefusals(asExpr, engineQuestion(asExpr), ek.alt);
  ok(er.ok === true && er.forms >= 3, 'the exact-form expression accepts e^2+5, 5+e^2, e^(2)+5 and refuses three wrong values');
  const eq3 = engineQuestion(asExpr);
  ok(['e^2+5', '5+e^2', 'e^(2)+5', 'e**2 + 5'].every(t => checkBankAnswer(eq3, t).correct === true) && ['e^2', '12.4', '2e^2+5'].every(t => checkBankAnswer(eq3, t).correct !== true), 'typed as a student would, and not otherwise');
  const pk = deriveKey(base('FD-012', { prompt: 'The region under $y=1+\\cos x$ for $0\\le x\\le\\pi$ is rotated about the $x$-axis. Find the exact volume.', steps: [{ h: 'V', d: '$V=\\tfrac{3\\pi^{2}}2$' }] }), '$\\tfrac{3\\pi^{2}}2$');
  const pd = asDerivedPart(base('FD-012', { prompt: 'Find the exact volume.' }), pk.alt ?? pk);
  const pq = engineQuestion(pd);
  ok(['3pi^2/2', '1.5pi^2', '(3/2)pi^2', '3π²/2', '(3*pi^2)/2'].every(t => checkBankAnswer(pq, t).correct === true), 'his 3π²/2 is accepted as 3pi^2/2, 1.5pi^2, (3/2)pi^2 and 3π²/2');
}
{
  // The leak rule for a question that stays a worked solution: a hint may not state a result of his steps.
  const p = base('PR-010', { prompt: 'Show that $(x+1)^{2}-(x-1)^{2}=4x$.', steps: [{ h: 'Expand', d: '$(x+1)^{2}-(x-1)^{2}=(x^{2}+2x+1)-(x^{2}-2x+1)$' }, { h: 'Subtract', d: '$=4x$' }] });
  const results = stepResults(p);
  ok(results.length > 0, 'the results of the steps are read');
  ok(stepResultLeak(p, 'Expand both squares first.', results) === null, 'a hint that names the move is kept');
  ok(stepResultLeak(p, 'Expand $(x+1)^{2}-(x-1)^{2}$ and subtract.', results) === null, 'a hint that restates the prompt is kept (the target is in the prompt)');
  ok(stepResultLeak(p, 'Write it as $(x^{2}+2x+1)-(x^{2}-2x+1)$.', results) !== null, 'a hint that states an intermediate result of his steps is dropped');
  ok(stepResultLeak(p, 'Set it to $0$.', results) === null, 'a small number a hint may say is not a result');
}
{
  // Line feedback is only for a question whose own steps are never crossed; with no steps to check there is none.
  const a = archive();
  const ev = evaluateManual(a.parts[4], a.questions[4], a, {});
  ok(typeof ev.lineFeedback === 'boolean', 'every worked-solution question says whether line feedback is allowed for it');
}
{
  // The 40-row sample: the same 40 on every run, in id order, from a hash of the id.
  const rows = Array.from({ length: 100 }, (_, i) => ({ id: `Q-${String(i).padStart(3, '0')}`, answerType: 'numeric', shown: String(i), prompt: `Find ${i}.`, key: { value: i } }));
  const a = derivedSample(rows), b = derivedSample([...rows].reverse());
  ok(a === b && a.split('\n').filter(l => l.startsWith('| Q-')).length === 40, 'the sample is 40 rows and does not depend on the order it was found in');
  const first = a.split('\n').filter(l => l.startsWith('| Q-')).map(l => l.split(' | ')[0]);
  ok(JSON.stringify(first) === JSON.stringify([...first].sort()), 'in id order');
  const expectIds = [...rows].sort((x, y) => (crypto.createHash('sha256').update(x.id).digest('hex') < crypto.createHash('sha256').update(y.id).digest('hex') ? -1 : 1)).slice(0, 40).map(r => `| ${r.id}`).sort();
  ok(JSON.stringify(first) === JSON.stringify(expectIds), 'chosen by the hash of the id');
}
{
  // His printed answer for a part of a multi-part question is the part's own.
  const arch = { questions: [{ id: 'M-1', ans: undefined, parts: [{ ans: '$1$' }, { ans: '$2$' }] }, { id: 'M-2', ans: '$9$' }], parts: [{ question: 'M-1', label: '(i)' }, { question: 'M-1', label: '(ii)' }, { question: 'M-2', label: null }] };
  const got = [...printedAnswers(arch).values()];
  eq(got, ['$1$', '$2$', '$9$'], 'printed answers are read by part');
}

// ── a function application keeps its argument; the key is proved against his own TeX ─────────────────
eq(bracketFunctions('\\frac12(\\cos 2x-\\cos 4x)'), '\\frac12(\\cos(2x)-\\cos(4x))', 'cos 2x is cos(2x)');
eq(bracketFunctions('\\sin x\\cos x'), '\\sin(x)\\cos(x)', 'sin x cos x is two applications');
eq(bracketFunctions('\\ln \\cos 2x'), '\\ln(\\cos(2x))', 'a function of a function nests');
eq(bracketFunctions('\\sin^2 x+\\sin(x)'), '\\sin^2(x)+\\sin(x)', 'a power stays, a bracket given is the argument');
eq(plainOf('\\cos 2x-\\cos 4x').plain, 'cos(2x)-cos(4x)', 'read as plain text the argument keeps its brackets');
eq(evalTeX('\\tfrac12(\\cos2x-\\cos4x)', { x: 0.7 }), 0.5 * (Math.cos(1.4) - Math.cos(2.8)), 'his TeX is evaluated on its own (cos 2x is cos(2x))');
{
  const bad = { answerType: 'expression', answer: { expr: '((1)/(2))(cos2x-cos4x)' } };
  eq(keyAgreesWithTeX(bad, '$\\tfrac12(\\cos2x-\\cos4x)$'), 'key-disagrees-with-his-tex', 'the old key (cos2x is cos(2)·x) is refused by the round trip');
  const good = { answerType: 'expression', answer: { expr: '((1)/(2))(cos(2x)-cos(4x))' } };
  eq(keyAgreesWithTeX(good, '$\\tfrac12(\\cos2x-\\cos4x)$'), null, 'the bracketed key agrees with his TeX at every sample point');
  eq(keyAgreesWithTeX({ answerType: 'numeric', answer: { value: 5 } }, '$e^{2}+5$'), 'key-disagrees-with-his-tex', 'a numeric key that is not his value is refused');
  eq(keyAgreesWithTeX({ answerType: 'set', answer: { values: [1, 2] } }, '$x=1$ or $x=2$'), null, 'a set agrees item by item');
  const k = deriveKey(base('FD-013', { prompt: 'Express $\\sin x\\sin3x$ as a difference of cosines.', steps: [{ h: 'Product to sum', d: '$\\sin x\\sin3x=\\tfrac12(\\cos2x-\\cos4x)$' }] }), '$\\tfrac12(\\cos2x-\\cos4x)$');
  eq(k.answer?.expr, '((1)/(2))(cos(2x)-cos(4x))', 'the derived key has explicit function arguments');
  const dp = asDerivedPart(base('FD-013', { prompt: 'Express $\\sin x\\sin3x$ as a difference of cosines.' }), k);
  const q = engineQuestion(dp);
  ok(checkBankAnswer(q, '(1/2)(cos(2x)-cos(4x))').correct === true && checkBankAnswer(q, '1/2*(cos(2x)-cos(4x))').correct === true, 'and the correct answer is marked right');
  ok(checkBankAnswer(q, '(1/2)(cos2x-cos4x)').correct !== true && checkBankAnswer(q, '(cos(2x)-cos(4x))').correct !== true && checkBankAnswer(q, '(1/2)(cos(2x)+cos(4x))').correct !== true, 'and wrong ones, including the old misreading, are not');
}
// A prompt that asks for more than a value is never converted.
for (const prompt of ['Every point of a data set lies on the line $y=2x+1$. State the value of Pearson\'s correlation coefficient, with a reason.', 'State the value of $r$ and interpret it.', 'Find $x$ and justify your answer.', 'State the gradient and the intercept of $y=2x+1$.']) eq(deriveKey(base('FD-014', { prompt, steps: [{ h: 'r', d: '$r=1$' }] }), '$r=1$').no !== undefined, true, `not converted: ${prompt.slice(0, 40)}`);
// The natural typed forms of his answer.
eq(naturalForms({ answerType: 'expression', answer: { expr: '' }, shown: '((3pi^(2))/(2))' }).slice(0, 3), ['((3pi^(2))/(2))', '(3pi^2)/2', '(3π^2)/2'], 'his form as read, tidied, with pi as π');
eq(naturalForms({ answerType: 'expression', answer: { expr: '' }, shown: 'e^(2)+5' }).includes('5+e^2'), true, 'and a rearrangement of a sum');
// A hint may not state a number the worked steps reach that the question does not give.
{
  const p = base('PR-015', { prompt: 'A loan of $\\$300000$ is repaid monthly at $0.4\\%$ a month. Find the number of repayments $n$.', steps: [{ h: 'Equation', d: '$300=n$' }, { h: 'Result', d: '$n=360$' }] });
  eq(stepResultLeak(p, 'Balance zero after 360.', stepResults(p)) !== null, true, 'a hint stating 360 is dropped');
  eq(stepResultLeak(p, 'Monthly rate 0.4%.', stepResults(p)), null, 'a number the question gives is not a result');
  const q = base('PR-016', { prompt: 'Solve $e^{-0.2t}=0.4$.', steps: [{ h: 'Take logs', d: '$-0.2t=\\ln0.4$' }, { h: 'Time', d: '$t=4.58$' }] });
  const lq = base('PR-017', { prompt: 'The mass is $M=50e^{-0.2t}$. Find the time when $M=20$.', steps: [{ h: 'Equation', d: '$e^{-0.2t}=0.4$' }, { h: 'Time', d: '$t=4.58$' }] });
  eq(stepResultLeak(lq, 'ln 0.4.', stepResults(lq)) !== null, true, 'a hint stating ln 0.4 (the set-up value 0.4 the steps reach) is dropped');
  void q;
}

console.log(failures.length ? `QBANK MANUAL: FAIL ${failures.length}\n  ${failures.join('\n  ')}` : `QBANK MANUAL: PASS ${pass}/${pass} checks`);
process.exitCode = failures.length ? 1 : 0;
