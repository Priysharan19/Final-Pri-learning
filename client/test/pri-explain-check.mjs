import assert from 'node:assert/strict';
import {
  buildDeterministicStoryboard,
  buildVisualTimeline,
  compileStoryboard,
  diffMath,
  extractMath,
  mathTokens,
  visualSummary,
} from '../src/explain/visualEngine.js';
import {
  ACTION_KINDS,
  STORYBOARD_VERSION,
  storyboardPromptContract,
  validateStoryboard,
  verifiedMath,
} from '../src/explain/storyboard.js';

let checks = 0;
const check = (name, fn) => {
  try { fn(); checks++; }
  catch (err) { console.error(`FAIL ${name}: ${err.message}`); process.exitCode = 1; }
};

const algebraSolution = {
  steps: [
    { h: 'Start', d: '$x+2=5$' },
    { h: 'Subtract 2', d: '$x=3$' },
  ],
  answerText: '$x=3$',
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

check('indexes only mathematics contained in the verified solution', () => {
  assert.deepEqual([...verifiedMath(algebraSolution)].sort(), ['x+2=5', 'x=3']);
});

check('exposes a bounded teaching-director contract', () => {
  const contract = storyboardPromptContract(algebraSolution, {});
  assert.equal(contract.version, STORYBOARD_VERSION);
  assert.deepEqual(contract.allowedActions, ACTION_KINDS);
  assert.ok(contract.rules.some(rule => /Never invent/i.test(rule)));
  assert.ok(contract.rules.some(rule => /checkpoint.*never supply its answer/i.test(rule)));
});

check('accepts an authored storyboard using only verified equations', () => {
  const result = validateStoryboard({
    version: 3,
    source: 'ai',
    scenes: [{
      heading: 'Undo the addition',
      narration: 'Subtract two from both sides.',
      concept: 'algebra',
      actions: [{ kind: 'transform_equation', before: 'x+2=5', after: 'x=3' }],
    }],
  }, algebraSolution, {});
  assert.equal(result.ok, true);
  assert.equal(result.storyboard.source, 'ai');
});

check('rejects a plausible but invented AI equation', () => {
  const result = validateStoryboard({
    version: 3,
    scenes: [{
      heading: 'Invented intermediate',
      actions: [{ kind: 'transform_equation', before: 'x+2=5', after: 'x+1=4' }],
    }],
  }, algebraSolution, {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invented equation');
});

check('rejects invented maths hidden in authored narration', () => {
  const result = validateStoryboard({
    version: 3,
    source: 'ai',
    scenes: [{
      heading: 'A bad spoken claim',
      narration: 'The next line is $x=99$.',
      actions: [],
    }],
  }, algebraSolution, {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invented narrative maths');
});

check('rejects an invented focus expression', () => {
  const result = validateStoryboard({
    version: 3,
    scenes: [{ heading: 'Focus', actions: [{ kind: 'focus_math', expression: '2x=6' }] }],
  }, algebraSolution, {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invented focus expression');
});

check('rejects focus chips that are not part of the verified expression', () => {
  const result = validateStoryboard({
    version: 3,
    scenes: [{
      heading: 'Focus',
      actions: [{ kind: 'focus_math', expression: 'x+2=5', tokens: ['2', '99'] }],
    }],
  }, algebraSolution, {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invented focus token');
});

check('does not trust AI-authored operation labels', () => {
  const plan = {
    version: 3,
    scenes: [{
      heading: 'Transform safely',
      actions: [{
        kind: 'transform_equation',
        before: 'x+2=5',
        after: 'x=3',
        operation: 'multiply both sides by 99',
      }],
    }],
  };
  const checked = validateStoryboard(plan, algebraSolution, {});
  assert.equal(checked.ok, true);
  assert.equal(checked.storyboard.scenes[0].actions[0].operation, undefined);
  const compiled = compileStoryboard(plan, algebraSolution, {});
  assert.equal(compiled.timeline[0].visuals[0].operation, undefined);
});

check('keeps understanding checkpoints prediction-only', () => {
  const valid = validateStoryboard({
    version: 3,
    scenes: [{
      heading: 'Predict the next move',
      actions: [{ kind: 'checkpoint', prompt: 'What should we undo first?' }],
    }],
  }, algebraSolution, {});
  assert.equal(valid.ok, true);

  const unsafe = validateStoryboard({
    version: 3,
    scenes: [{
      heading: 'Predict the next move',
      actions: [{ kind: 'checkpoint', prompt: 'What should we undo first?', answer: 'Subtract 2' }],
    }],
  }, algebraSolution, {});
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.reason, 'checkpoint answer is not allowed');
});

check('rejects unsupported storyboard actions instead of silently executing around them', () => {
  const result = validateStoryboard({
    version: 3,
    scenes: [{ heading: 'Unsafe action', actions: [{ kind: 'run_javascript', code: 'alert(1)' }] }],
  }, algebraSolution, {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unsupported action');
});

check('builds an equation-motion scene from verified consecutive steps', () => {
  const timeline = buildVisualTimeline(algebraSolution, { questionPrompt: 'Solve the equation.' });
  assert.equal(timeline[1].visuals[0].kind, 'transform');
  assert.equal(timeline[1].visuals[0].after, 'x=3');
  assert.equal(timeline[1].storyboardSource, 'deterministic');
});

check('uses a valid solution storyboard in preference to deterministic inference', () => {
  const solution = {
    ...algebraSolution,
    explanationStoryboard: {
      version: 3,
      source: 'teacher',
      scenes: [{
        heading: 'Teacher emphasis',
        narration: 'Keep equality balanced.',
        actions: [{
          kind: 'focus_math',
          expression: 'x+2=5',
          tokens: ['2', '5'],
          label: 'Both sides matter',
        }],
      }],
    },
  };
  const timeline = buildVisualTimeline(solution, {});
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].heading, 'Teacher emphasis');
  assert.equal(timeline[0].storyboardSource, 'teacher');
  assert.equal(timeline[0].visuals[0].kind, 'focus');
});

check('falls back safely when an authored storyboard invents maths', () => {
  const solution = {
    ...algebraSolution,
    explanationStoryboard: {
      version: 3,
      source: 'ai',
      scenes: [{ heading: 'Bad plan', actions: [{ kind: 'focus_math', expression: 'x=99' }] }],
    },
  };
  const timeline = buildVisualTimeline(solution, {});
  assert.ok(timeline.length >= 2);
  assert.ok(timeline.every(scene => scene.storyboardSource === 'deterministic'));
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

check('the deterministic storyboard itself passes the same verifier', () => {
  const plan = buildDeterministicStoryboard(algebraSolution, { questionPrompt: 'Solve the equation.' });
  assert.equal(validateStoryboard(plan, algebraSolution, {}).ok, true);
});

check('reports the visual modes exposed to the player', () => {
  const timeline = buildVisualTimeline(algebraSolution, {});
  assert.ok(visualSummary(timeline).includes('transform'));
});

if (!process.exitCode) console.log(`PRI EXPLAIN SUITE PASSED — ${checks}/${checks} checks`);
