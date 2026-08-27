import assert from 'node:assert/strict';
import { buildVisualTimeline, diffMath, extractMath, mathTokens, visualSummary } from '../src/explain/visualEngine.js';

let checks = 0;
const check = (name, fn) => {
  try { fn(); checks++; }
  catch (err) { console.error(`FAIL ${name}: ${err.message}`); process.exitCode = 1; }
};

check('extracts authored maths without inventing expressions', () => {
  assert.deepEqual(extractMath('From $x+2=5$ we get $x=3$.'), ['x+2=5', 'x=3']);
});

check('tokenises LaTeX commands as stable units', () => {
  assert.deepEqual(mathTokens('x=\\frac{6}{2}'), ['x', '=', '\\frac', '{', '6', '}', '{', '2', '}']);
});

check('marks only changed terms across an equation transition', () => {
  const diff = diffMath('x+2=5', 'x=3');
  assert.ok(diff.changedBefore.includes('+'));
  assert.ok(diff.changedAfter.includes('3'));
  assert.equal(diff.after.find(t => t.text === 'x')?.changed, false);
});

check('builds an equation-motion scene from verified consecutive steps', () => {
  const timeline = buildVisualTimeline({ steps: [
    { h: 'Start', d: '$x+2=5$' },
    { h: 'Subtract 2', d: '$x=3$' },
  ] }, { questionPrompt: 'Solve the equation.' });
  assert.equal(timeline[1].visuals[0].kind, 'transform');
  assert.equal(timeline[1].visuals[0].after, 'x=3');
});

check('replays the first wrong Pencil attempt after a successful retry', () => {
  const timeline = buildVisualTimeline({ steps: [{ h: 'Correct it', d: '$x=3$' }] }, {
    correct: true,
    hadWrongAttempt: true,
    feedback: 'The sign changes here.',
    wrongAttempt: { viaInk: true, ink: { strokes: [{ points: [{ x: 0, y: 0 }, { x: 20, y: 10 }] }] } },
  });
  assert.equal(timeline[0].kind, 'diagnosis');
  assert.equal(timeline[0].visuals[0].kind, 'ink');
});

check('uses typed working when no ink exists', () => {
  const timeline = buildVisualTimeline({ steps: [{ h: 'Fix', d: '$2x=6$' }] }, {
    correct: false,
    feedback: 'Check the division.',
    wrongAttempt: { steps: '2x = 6\nx = 6/2', answer: '3' },
  });
  assert.equal(timeline[0].visuals[0].kind, 'attempt');
});

check('animates an authored graph instead of synthesising a new one', () => {
  const figure = '<svg viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5"/></svg>';
  const timeline = buildVisualTimeline({ steps: [{ h: 'Read the graph', d: 'Locate the $x$-intercept.' }] }, {
    questionPrompt: 'Use the graph of the parabola.', questionFigure: figure,
  });
  assert.equal(timeline[0].visuals.find(v => v.kind === 'figure')?.mode, 'graph');
});

check('reports the visual modes exposed to the player', () => {
  const timeline = buildVisualTimeline({ steps: [
    { h: 'Start', d: '$x+1=4$' }, { h: 'Solve', d: '$x=3$' }
  ] }, {});
  assert.ok(visualSummary(timeline).includes('transform'));
});

if (!process.exitCode) console.log(`PRI EXPLAIN SUITE PASSED — ${checks}/${checks} checks`);
