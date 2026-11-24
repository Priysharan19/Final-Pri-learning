// A tiny author question bank, written for the tests. It is invented here: no question, answer, step or hint of the owner's bank is in
// this repository (the repository is public; the bank is not). Same shape as the owner's archive (tools/qbank-import.mjs).
const HINTS = ['Read the question carefully.', 'Choose the method.', 'Work it through.'];
const crit = (marks, answer = true, point = 'Correct final answer') => ({ marks, point, ...(answer ? { answer: true } : {}) });

const part = (question, over) => ({
  question, label: null, marks: 2, course: 'ADV', year: 11, topic: 'MA-C1', difficulty: 2, answerType: 'numeric',
  steps: [{ h: 'Differentiate', d: '$\\dfrac{dy}{dx}=2x$' }, { h: 'Substitute', d: '$2\\times 3 = 6$' }],
  criteria: [{ marks: 1, point: 'Differentiates correctly', line: '2*x' }, crit(1)],
  traps: [], hints: HINTS, ...over
});

/** The parts, in id order. Comments say what each one is for. */
export const FIXTURE_PARTS = [
  // numeric with a trap (the value of y, not the gradient), 2 marks, authored difficulty 2
  part('TQ-001', { prompt: 'Find the gradient of $y=x^{2}$ at $x=3$.', answer: { value: 6 }, traps: [{ value: 9, why: 'This is the value of y at x = 3, not the gradient.' }] }),
  // expression, authored difficulty 5 (served at level 4, authored number kept), 3 marks
  part('TQ-002', { prompt: 'Differentiate $y=x^{3}$.', answerType: 'expression', answer: { expr: '3*x^2' }, marks: 3, difficulty: 5,
    steps: [{ h: 'Power rule', d: 'Bring the power down.' }, { h: 'Reduce', d: '$\\dfrac{dy}{dx}=3x^{2}$' }],
    criteria: [{ marks: 1, point: 'Brings the power down', manual: true }, { marks: 1, point: 'Reduces the power', manual: true }, crit(1)],
    traps: [{ expr: '2*x^3', why: 'The power was reduced but not brought down as a factor.' }] }),
  // set, 1 mark
  part('TQ-003', { prompt: 'Solve $x^{2}-5x+6=0$.', answerType: 'set', answer: { values: [2, 3] }, marks: 1, difficulty: 1,
    steps: [{ h: 'Factorise', d: '$(x-2)(x-3)=0$' }, { h: 'Solve', d: '$x=2$ or $x=3$' }], criteria: [crit(1)], traps: [{ values: [5], why: 'Only the sum of the roots was found.' }] }),
  // interval, 1 mark
  part('TQ-004', { prompt: 'Solve $x^{2}<4$.', answerType: 'interval', answer: { region: '-2 < x < 2', variable: 'x' }, marks: 1, difficulty: 3,
    steps: [{ h: 'Roots', d: '$x^{2}=4$ gives $x=\\pm 2$' }, { h: 'Between', d: '$-2<x<2$' }], criteria: [crit(1)], traps: [{ region: '-2 <= x <= 2', why: 'The ends are not included when the sign is strict.' }] }),
  // equation, 2 marks
  part('TQ-005', { prompt: 'Find the equation of the tangent to $y=x^{2}$ at $(1,1)$.', answerType: 'equation', answer: { lhs: 'y', rhs: '2*x-1' },
    steps: [{ h: 'Gradient', d: '$\\dfrac{dy}{dx}=2x$, so the gradient is $2$' }, { h: 'Tangent', d: '$y-1=2(x-1)$' }], criteria: [{ marks: 1, point: 'Gradient is 2', line: 'y-1 = 2*(x-1)' }, crit(1)], traps: [{ eq: 'y = 2*x+1', why: 'The intercept was taken as +1.' }] }),
  // point, 1 mark
  part('TQ-006', { prompt: 'Find the vertex of $y=x^{2}-2x-3$.', answerType: 'point', answer: { x: 1, y: -4 }, marks: 1,
    steps: [{ h: 'x', d: '$x=-\\dfrac{-2}{2}=1$' }, { h: 'y', d: '$y=1-2-3=-4$' }], criteria: [crit(1)], traps: [{ point: [1, 3], why: 'The sign of the constant was dropped.' }] }),
  // a two-part question: each part stands alone (the stem is in each prompt)
  part('TQ-007', { label: '(i)', prompt: 'A curve is $y=x^{2}+2x$. Find $\\dfrac{dy}{dx}$ at $x=1$.', answer: { value: 4 }, marks: 1, steps: [{ h: 'Differentiate', d: '$\\dfrac{dy}{dx}=2x+2$' }, { h: 'Substitute', d: '$2+2=4$' }], criteria: [crit(1)] }),
  part('TQ-007', { label: '(ii)', prompt: 'A curve is $y=x^{2}+2x$. Find the $y$-value at $x=1$.', answer: { value: 3 }, marks: 1, steps: [{ h: 'Substitute', d: '$y=1+2$' }, { h: 'Evaluate', d: '$y=3$' }], criteria: [crit(1)] }),
  // an Extension 1 part (another family)
  part('TQ-008', { course: 'EXT1', topic: 'ME-A1', prompt: 'In how many ways can $4$ different books be arranged in a row?', answer: { value: 24 }, marks: 1,
    steps: [{ h: 'Count', d: '$4\\times 3\\times 2\\times 1$' }, { h: 'Evaluate', d: '$4!=24$' }], criteria: [crit(1)], traps: [{ value: 16, why: 'Used $4^{2}$ instead of $4!$.' }] }),
  // REJECTED: a manual part
  part('TQ-009', { prompt: 'Prove that the derivative of a constant is zero.', answerType: 'manual', answer: undefined, steps: [{ h: 'Idea', d: '$\\dfrac{c-c}{h}=0$' }], criteria: [{ marks: 1, point: 'States the limit', manual: true }, { marks: 1, point: 'Concludes', manual: true }] }),
  // REJECTED: a hint that is the answer
  part('TQ-010', { prompt: 'Evaluate $3\\times 4$.', answer: { value: 12 }, marks: 1, steps: [{ h: 'Multiply', d: '$3\\times 4$' }, { h: 'Evaluate', d: '$12$' }], criteria: [crit(1)], hints: ['Multiply the two numbers.', 'The product is $12$.', 'Check.'] }),
  // REJECTED: a diagram
  part('TQ-011', { prompt: 'Find the gradient of the line shown.', figureTikz: '\\begin{tikzpicture}\\draw (0,0)--(1,2);\\end{tikzpicture}', answer: { value: 2 }, marks: 1, steps: [{ h: 'Rise', d: '$2$' }, { h: 'Run', d: '$\\dfrac{2}{1}=2$' }], criteria: [crit(1)] }),
  // REJECTED: layout TeX in the prompt
  part('TQ-012', { prompt: '\\leavevmode Find the gradient of $y=5x$.', answer: { value: 5 }, marks: 1, steps: [{ h: 'Read', d: '$y=5x$' }, { h: 'Gradient', d: '$5$' }], criteria: [crit(1)] })
];

/** The question records (title, stem, marks, optional tikz) and the dot point tags for them. */
export function fixtureArchive() {
  const questions = [], seen = new Map();
  for (const p of FIXTURE_PARTS) {
    const q = seen.get(p.question) || { id: p.question, course: p.course, year: p.year, topic: p.topic, title: `Fixture ${p.question}`, diff: p.difficulty, q: p.prompt, marks: 0, ans: 'x' };
    q.marks += p.marks;
    if (p.figureTikz) q.tikz = p.figureTikz;
    if (!seen.has(p.question)) { seen.set(p.question, q); questions.push(q); }
  }
  const tags = Object.fromEntries(questions.map(q => [q.id, q.topic === 'ME-A1' ? 'A1.1a' : q.id <= 'TQ-004' ? 'C1.3a' : 'C1.3c']));
  const parts = FIXTURE_PARTS.map(p => ({ ...p, course: p.course, year: p.year, difficulty: p.difficulty }));
  return { files: {}, questions, parts, tags };
}
