// Pri Explain V3 · deterministic visual renderer + verified storyboard compiler.
// Marking owns correctness. This layer accepts presentation instructions only
// after storyboard.js proves every mathematical reference came from the
// verified solution payload.

import { STORYBOARD_VERSION, validateStoryboard } from './storyboard.js';

const MATH = /\$([^$]+)\$/g;
const TOKEN = /\\[a-zA-Z]+|\d+(?:\.\d+)?|[A-Za-z]+|<=|>=|!=|[=+\-*/^(),{}]|\S/g;

export function extractMath(value) {
  const text = String(value || '');
  const out = [];
  let m;
  MATH.lastIndex = 0;
  while ((m = MATH.exec(text))) {
    const expr = m[1].trim();
    if (expr) out.push(expr);
  }
  return out;
}

export function mathTokens(value) {
  return String(value || '').match(TOKEN) || [];
}

function lcs(a, b) {
  const rows = a.length + 1, cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const sameA = new Set(), sameB = new Set();
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { sameA.add(i++); sameB.add(j++); }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return { sameA, sameB };
}

export function diffMath(before, after) {
  const a = mathTokens(before), b = mathTokens(after);
  const { sameA, sameB } = lcs(a, b);
  return {
    before: a.map((text, index) => ({ text, changed: !sameA.has(index) })),
    after: b.map((text, index) => ({ text, changed: !sameB.has(index) })),
    changedBefore: a.filter((_, index) => !sameA.has(index)),
    changedAfter: b.filter((_, index) => !sameB.has(index)),
  };
}

function classify(text, hasFigure) {
  const s = String(text || '').toLowerCase();
  if (/integral|differentiat|derivative|gradient function|area under|trapezoid/.test(s)) return 'calculus';
  if (/graph|curve|parabola|hyperbola|scatter|axis|axes|sketch|asymptote|intercept/.test(s)) return 'graph';
  if (/triangle|circle|angle|bearing|geometry|tangent|chord|radius|diameter|similar|congruent|vector/.test(s)) return 'geometry';
  if (/probab|frequency|histogram|box plot|median|quartile|mean|standard deviation/.test(s)) return 'statistics';
  if (/factor|expand|solve|equation|substitut|simplif|formula|root|surd|logarithm|index|indices/.test(s)) return 'algebra';
  return hasFigure ? 'figure' : 'generic';
}

function duration(scene) {
  const narration = String(scene.narration || '').trim();
  const chars = narration.length || `${scene.heading} ${(scene.lines || []).join(' ')}`.length;
  const visualBonus = (scene.visuals || []).some(v => v.kind === 'ink') ? 1800 : (scene.visuals || []).length ? 900 : 0;
  return Math.max(3500, Math.min(10500, 2600 + chars * 23 + visualBonus));
}

function splitLines(value) {
  return String(value || '').split(/\n+/).map(v => v.trim()).filter(Boolean);
}

function cleanAttempt(attempt) {
  if (!attempt) return null;
  const strokes = Array.isArray(attempt?.ink?.strokes) ? attempt.ink.strokes : [];
  const scribble = Array.isArray(attempt?.scribble) ? attempt.scribble : [];
  const working = String(attempt.steps || attempt?.ink?.recognized || '').trim();
  const answer = attempt.answer == null ? '' : String(attempt.answer);
  if (!strokes.length && !scribble.length && !working && !answer) return null;
  return { strokes, scribble, working, answer, viaInk: Boolean(attempt.viaInk) };
}

function narrationFor(heading, lines) {
  return [heading, ...(lines || [])].filter(Boolean).join('. ');
}

export function buildDeterministicStoryboard(solution, context = {}) {
  const scenes = [];
  const prompt = String(context.questionPrompt || '');
  const figure = String(context.questionFigure || '');
  const wrongAttempt = cleanAttempt(context.wrongAttempt || context.submission);

  if (!context.revealed && (context.correct === false || context.hadWrongAttempt || wrongAttempt) && (context.feedback || wrongAttempt)) {
    const heading = context?.diagnosis?.message || context?.diagnosis?.note || 'Find the exact point the working changes direction';
    const lines = splitLines(context.feedback || 'Compare your working with the verified path before changing the next line.');
    scenes.push({
      id: 'diagnosis',
      heading,
      lines,
      narration: narrationFor(heading, lines),
      concept: 'diagnosis',
      actions: wrongAttempt ? [{ kind: 'replay_attempt' }] : [],
    });
  }

  let previous = null;
  for (const [stepIndex, step] of (solution?.steps || []).entries()) {
    const heading = String(step?.h || `Step ${stepIndex + 1}`);
    const detail = String(step?.d || '');
    const lines = splitLines(detail);
    const maths = extractMath(detail);
    const after = maths.length ? maths[maths.length - 1] : null;
    const before = previous && after && previous !== after ? previous : (maths.length > 1 ? maths[0] : null);
    const concept = classify(`${prompt} ${heading} ${detail}`, !!figure);
    const actions = [];

    if (before && after && before !== after) {
      actions.push({ kind: 'transform_equation', before, after });
    } else if (after) {
      actions.push({ kind: 'focus_math', expression: after, tokens: [] });
    }
    if (figure && ['graph', 'geometry', 'calculus', 'statistics', 'figure'].includes(concept)) {
      actions.push({ kind: 'show_figure', mode: concept });
    }

    scenes.push({
      id: `solution-${stepIndex}`,
      heading,
      lines,
      narration: narrationFor(heading, lines),
      concept,
      actions,
    });
    if (after) previous = after;
  }

  if (!scenes.length && solution?.answerText) {
    scenes.push({
      id: 'result',
      heading: 'Work to the result',
      lines: [],
      narration: 'Work through the verified reasoning to the final result.',
      concept: classify(prompt, !!figure),
      actions: [],
    });
  }

  return { version: STORYBOARD_VERSION, source: 'deterministic', scenes };
}

function visualFromAction(action, context) {
  if (!action) return null;
  if (action.kind === 'replay_attempt') {
    const attempt = cleanAttempt(context.wrongAttempt || context.submission);
    if (!attempt) return null;
    return attempt.strokes.length || attempt.scribble.length
      ? { kind: 'ink', attempt }
      : { kind: 'attempt', attempt };
  }
  if (action.kind === 'transform_equation') {
    return {
      kind: 'transform',
      before: action.before,
      after: action.after,
      diff: diffMath(action.before, action.after),
    };
  }
  if (action.kind === 'focus_math') {
    return {
      kind: 'focus',
      expression: action.expression,
      tokens: action.tokens || [],
      label: action.label || '',
    };
  }
  if (action.kind === 'show_figure' && context.questionFigure) {
    return { kind: 'figure', mode: action.mode || 'figure', figure: String(context.questionFigure) };
  }
  if (action.kind === 'checkpoint') {
    return { kind: 'checkpoint', prompt: action.prompt };
  }
  return null;
}

export function compileStoryboard(storyboard, solution, context = {}, options = {}) {
  const checked = validateStoryboard(storyboard, solution, context, options);
  if (!checked.ok) return { ok: false, reason: checked.reason, timeline: [] };

  const timeline = checked.storyboard.scenes.map((scene, index) => {
    const visuals = (scene.actions || []).map(action => visualFromAction(action, context)).filter(Boolean);
    const compiled = {
      kind: scene.concept === 'diagnosis' ? 'diagnosis' : 'solution',
      heading: scene.heading,
      lines: scene.lines || [],
      narration: scene.narration || narrationFor(scene.heading, scene.lines),
      visuals,
      concept: scene.concept || 'generic',
      id: scene.id || `story-${index}`,
      number: index + 1,
      storyboardSource: checked.storyboard.source || 'authored',
    };
    compiled.duration = duration(compiled);
    return compiled;
  });

  return { ok: true, reason: '', timeline };
}

export function buildVisualTimeline(solution, context = {}) {
  const authored = context.explanationStoryboard || solution?.explanationStoryboard || solution?.storyboard || null;
  if (authored) {
    const compiled = compileStoryboard(authored, solution, context);
    if (compiled.ok && compiled.timeline.length) return compiled.timeline;
  }

  const fallback = buildDeterministicStoryboard(solution, context);
  const compiled = compileStoryboard(fallback, solution, context, { trustedText: true });
  return compiled.ok ? compiled.timeline : [];
}

export function visualSummary(timeline) {
  const kinds = new Set();
  for (const scene of timeline || []) for (const v of scene.visuals || []) kinds.add(v.kind === 'figure' ? v.mode : v.kind);
  return [...kinds];
}
