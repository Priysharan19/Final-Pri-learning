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
import {
  buildDirectedStoryboard,
  buildDirectorBranch,
  selectTeachingStoryboard,
} from '../src/explain/teachingDirector.js';

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

check('source metadata cannot spoof the deterministic trust boundary', () => {
  const result = validateStoryboard({
    version: 3,
    source: 'deterministic',
    scenes: [{
      heading: 'Pretend to be trusted',
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

check('V4 inserts a prediction checkpoint before a verified equation motion', () => {
  const timeline = buildVisualTimeline(algebraSolution, { questionPrompt: 'Solve the equation.' });
  assert.equal(timeline.length, 3);
  assert.equal(timeline[0].storyboardSource, 'director-local-v4');
  assert.equal(timeline[1].visuals[0].kind, 'checkpoint');
  assert.equal(timeline[2].visuals[0].kind, 'transform');
  assert.equal(timeline[2].visuals[0].after, 'x=3');
});

check('the local director storyboard itself passes the V3 verifier', () => {
  const plan = buildDirectedStoryboard(algebraSolution, { questionPrompt: 'Solve the equation.' });
  assert.equal(plan.source, 'director-local-v4');
  assert.equal(validateStoryboard(plan, algebraSolution, {}).ok, true);
});

check('V4 prioritises the first wrong attempt before the repaired solution', () => {
  const plan = buildDirectedStoryboard(algebraSolution, {
    correct: true,
    hadWrongAttempt: true,
    feedback: 'The sign changed too early.',
    misconception: 'sign error',
    wrongAttempt: { steps: 'x+2=5\nx=-3', answer: '-3' },
  });
  assert.equal(plan.scenes[0].concept, 'diagnosis');
  assert.equal(plan.scenes[0].actions[0].kind, 'replay_attempt');
  assert.match(plan.scenes[0].lines.join(' '), /sign/i);
  assert.ok(plan.scenes.some(scene => scene.actions.some(action => action.kind === 'checkpoint')));
});

check('provider output is accepted only when it stays inside verified maths', () => {
  const selected = selectTeachingStoryboard({
    version: 3,
    source: 'model-test',
    scenes: [{
      heading: 'Model emphasis',
      narration: 'Keep equality balanced.',
      actions: [{ kind: 'transform_equation', before: 'x+2=5', after: 'x=3' }],
    }],
  }, algebraSolution, {});
  assert.equal(selected.providerAccepted, true);
  assert.equal(selected.storyboard.source, 'model-test');
});

check('invented provider maths fails closed to the local V4 director', () => {
  const selected = selectTeachingStoryboard({
    version: 3,
    source: 'model-test',
    scenes: [{ heading: 'Invented', actions: [{ kind: 'focus_math', expression: 'x=99' }] }],
  }, algebraSolution, {});
  assert.equal(selected.providerAccepted, false);
  assert.equal(selected.fallbackReason, 'invented focus expression');
  assert.equal(selected.storyboard.source, 'director-local-v4');
});

check('V4 slower branch decomposes one verified transform into three verified scenes', () => {
  const timeline = buildVisualTimeline(algebraSolution, {});
  const transformScene = timeline.find(scene => scene.visuals.some(v => v.kind === 'transform'));
  const branch = buildDirectorBranch(transformScene, 'slower', algebraSolution, {});
  assert.ok(branch);
  assert.equal(branch.scenes.length, 3);
  const compiled = compileStoryboard(branch, algebraSolution, {});
  assert.equal(compiled.ok, true);
  assert.deepEqual(compiled.timeline.map(scene => scene.visuals[0].kind), ['focus', 'transform', 'focus']);
});

check('V4 notice branch highlights only tokens inside the verified result expression', () => {
  const timeline = buildVisualTimeline(algebraSolution, {});
  const transformScene = timeline.find(scene => scene.visuals.some(v => v.kind === 'transform'));
  const branch = buildDirectorBranch(transformScene, 'notice', algebraSolution, {});
  const action = branch.scenes[0].actions[0];
  assert.equal(action.kind, 'focus_math');
  assert.equal(action.expression, 'x=3');
  assert.ok(action.tokens.every(token => action.expression.includes(token)));
  assert.equal(validateStoryboard(branch, algebraSolution, {}).ok, true);
});

check('uses a valid solution storyboard in preference to the V4 director', () => {
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

check('falls back safely from invented authored maths to the V4 local director', () => {
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
  assert.ok(timeline.every(scene => scene.storyboardSource === 'director-local-v4'));
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
  assert.equal(timeline[0].storyboardSource, 'director-local-v4');
});

check('deterministic fallback may quote marked wrong working when explicitly requested', () => {
  const timeline = buildVisualTimeline({ steps: [{ h: 'Correct it', d: '$x=3$' }] }, {
    correct: false,
    feedback: 'Your line $x=99$ is where the working diverges.',
    wrongAttempt: { steps: '$x=99$' },
    disableTeachingDirector: true,
  });
  assert.equal(timeline[0].kind, 'diagnosis');
  assert.equal(timeline[0].storyboardSource, 'deterministic');
  assert.match(timeline[0].lines[0], /x=99/);
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

check('the deterministic storyboard still passes the same verifier for verified solution text', () => {
  const plan = buildDeterministicStoryboard(algebraSolution, { questionPrompt: 'Solve the equation.' });
  assert.equal(validateStoryboard(plan, algebraSolution, {}).ok, true);
});

check('reports the visual modes exposed to the player', () => {
  const timeline = buildVisualTimeline(algebraSolution, {});
  assert.ok(visualSummary(timeline).includes('transform'));
  assert.ok(visualSummary(timeline).includes('checkpoint'));
});

if (!process.exitCode) console.log(`PRI EXPLAIN SUITE PASSED — ${checks}/${checks} checks`);
