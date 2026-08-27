// Pri Explain V2 · deterministic visual reasoning planner.
// This module is deliberately pure: marking owns correctness; this layer only
// decides how an already-verified solution should be visualised.

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
  const chars = `${scene.heading} ${(scene.lines || []).join(' ')}`.length;
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

export function buildVisualTimeline(solution, context = {}) {
  const scenes = [];
  const prompt = String(context.questionPrompt || '');
  const figure = String(context.questionFigure || '');
  const wrongAttempt = cleanAttempt(context.wrongAttempt || context.submission);

  if (context.correct === false && !context.revealed && (context.feedback || wrongAttempt)) {
    const visuals = [];
    if (wrongAttempt?.strokes?.length || wrongAttempt?.scribble?.length) visuals.push({ kind: 'ink', attempt: wrongAttempt });
    else if (wrongAttempt?.working || wrongAttempt?.answer) visuals.push({ kind: 'attempt', attempt: wrongAttempt });
    scenes.push({
      kind: 'diagnosis',
      heading: context?.diagnosis?.message || context?.diagnosis?.note || 'Find the exact point the working changes direction',
      lines: splitLines(context.feedback || 'Compare your working with the verified path before changing the next line.'),
      visuals,
      concept: 'diagnosis',
    });
  }

  let previous = null;
  for (const [stepIndex, step] of (solution?.steps || []).entries()) {
    const heading = String(step?.h || `Step ${stepIndex + 1}`);
    const detail = String(step?.d || '');
    const maths = extractMath(detail);
    const after = maths.length ? maths[maths.length - 1] : null;
    const before = previous && after && previous !== after ? previous : (maths.length > 1 ? maths[0] : null);
    const concept = classify(`${prompt} ${heading} ${detail}`, !!figure);
    const visuals = [];

    if (before && after && before !== after) {
      visuals.push({ kind: 'transform', before, after, diff: diffMath(before, after) });
    }
    if (figure && ['graph', 'geometry', 'calculus', 'statistics', 'figure'].includes(concept)) {
      visuals.push({ kind: 'figure', mode: concept, figure });
    }

    const scene = {
      kind: 'solution', heading, lines: splitLines(detail), visuals, concept,
      id: `solution-${stepIndex}`, number: scenes.length + 1,
    };
    scene.duration = duration(scene);
    scenes.push(scene);
    if (after) previous = after;
  }

  if (!scenes.length && solution?.answerText) {
    scenes.push({ kind: 'solution', heading: 'Work to the result', lines: [], visuals: [], concept: classify(prompt, !!figure) });
  }

  return scenes.map((scene, index) => ({
    ...scene,
    id: scene.id || `${scene.kind}-${index}`,
    number: index + 1,
    duration: scene.duration || duration(scene),
  }));
}

export function visualSummary(timeline) {
  const kinds = new Set();
  for (const scene of timeline || []) for (const v of scene.visuals || []) kinds.add(v.kind === 'figure' ? v.mode : v.kind);
  return [...kinds];
}
