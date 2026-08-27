// Pri Explain V4 · on-device teaching director.
//
// This layer chooses pedagogy, not truth. It may reorder emphasis, replay a
// student's first miss, insert prediction checkpoints, and choose which verified
// transformation deserves visual focus. Every action is still compiled through
// the V3 storyboard verifier before the renderer sees it.
//
// The default director is deliberately local so Pri Learning keeps its offline
// guarantee. `selectTeachingStoryboard` is the provider boundary: a future
// on-device or authenticated model may supply the same storyboard object, but
// unsafe model output is rejected and the local director takes over.

import {
  STORYBOARD_VERSION,
  validateStoryboard,
  verifiedMath,
} from './storyboard.js';

const MATH = /\$([^$]+)\$/g;
const MAX_SCENES = 24;
const MAX_LINE = 360;

function trim(value, max = MAX_LINE) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function mathsIn(value) {
  const out = [];
  const source = String(value || '');
  let match;
  MATH.lastIndex = 0;
  while ((match = MATH.exec(source))) {
    const expression = match[1].trim();
    if (expression) out.push(expression);
  }
  return out;
}

// Wrong working is evidence about the student, not verified mathematical truth.
// A diagnosis may quote it as $...$, so the director turns those spans into a
// neutral phrase rather than accidentally promoting the wrong expression into
// narration that sounds authoritative.
function teachingText(value, fallback = '') {
  const clean = trim(value, 420)
    .replace(/\$[^$]+\$/g, 'that expression')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || fallback;
}

function conceptFor(value, hasFigure) {
  const s = String(value || '').toLowerCase();
  if (/integral|differentiat|derivative|gradient function|area under|trapezoid/.test(s)) return 'calculus';
  if (/graph|curve|parabola|hyperbola|scatter|axis|axes|sketch|asymptote|intercept/.test(s)) return 'graph';
  if (/triangle|circle|angle|bearing|geometry|tangent|chord|radius|diameter|similar|congruent|vector/.test(s)) return 'geometry';
  if (/probab|frequency|histogram|box plot|median|quartile|mean|standard deviation/.test(s)) return 'statistics';
  if (/factor|expand|solve|equation|substitut|simplif|formula|root|surd|logarithm|index|indices/.test(s)) return 'algebra';
  return hasFigure ? 'figure' : 'generic';
}

function splitLines(value) {
  return String(value || '')
    .split(/\n+/)
    .map(line => trim(line))
    .filter(Boolean)
    .slice(0, 6);
}

function describeSteps(solution, context) {
  const evidence = verifiedMath(solution);
  const figure = String(context?.questionFigure || '');
  const prompt = String(context?.questionPrompt || '');
  let previous = null;

  return (solution?.steps || []).map((step, index) => {
    const heading = trim(step?.h, 180) || `Step ${index + 1}`;
    const detail = trim(step?.d, 1800);
    const lines = splitLines(detail);
    const maths = [...mathsIn(heading), ...mathsIn(detail)].filter(expr => evidence.has(expr));
    const after = maths.length ? maths[maths.length - 1] : null;
    const before = previous && after && previous !== after
      ? previous
      : (maths.length > 1 && maths[0] !== after ? maths[0] : null);
    const concept = conceptFor(`${prompt} ${heading} ${detail}`, Boolean(figure));
    const descriptor = { index, heading, detail, lines, maths, before, after, concept };
    if (after) previous = after;
    return descriptor;
  });
}

function diagnosisScene(context) {
  const wrongAttempt = context?.wrongAttempt || context?.submission || null;
  if (context?.revealed || (!wrongAttempt && context?.correct !== false && !context?.hadWrongAttempt)) return null;

  const diagnosis = context?.diagnosis || null;
  const misconception = typeof context?.misconception === 'string'
    ? context.misconception
    : context?.misconception?.label || context?.misconception?.name || '';
  const heading = teachingText(
    diagnosis?.title || misconception,
    wrongAttempt ? 'Start with the first place your working diverged' : 'Find the first mismatch'
  );
  const lines = [];
  const message = teachingText(diagnosis?.message || context?.feedback);
  const fix = teachingText(diagnosis?.fix);
  const misconceptionLine = teachingText(misconception);
  if (message) lines.push(message);
  if (fix && !lines.includes(fix)) lines.push(fix);
  if (misconceptionLine && !lines.includes(misconceptionLine) && misconceptionLine !== heading) {
    lines.push(`Pattern to watch: ${misconceptionLine}`);
  }
  if (!lines.length) lines.push('Compare the first uncertain move with the verified path before changing the next line.');

  return {
    id: 'director-diagnosis',
    heading,
    lines: lines.slice(0, 4),
    narration: [heading, ...lines].join('. '),
    concept: 'diagnosis',
    actions: wrongAttempt ? [{ kind: 'replay_attempt' }] : [],
  };
}

function checkpointFor(descriptor, context, ordinal) {
  const afterMistake = Boolean(context?.wrongAttempt || context?.hadWrongAttempt || context?.correct === false);
  const prompt = afterMistake
    ? 'Now that the mismatch is located, what should change next while the mathematical relationship stays valid?'
    : descriptor.concept === 'graph' || descriptor.concept === 'geometry'
      ? 'Before the next step appears, what feature should you identify first?'
      : 'Before the next verified step appears, what should change and what should stay fixed?';
  return {
    id: `director-checkpoint-${ordinal}`,
    heading: afterMistake ? 'Repair it before you see it' : 'Predict the next move',
    lines: ['Make a prediction first. Pri will reveal the verified step next.'],
    narration: prompt,
    concept: 'checkpoint',
    actions: [{ kind: 'checkpoint', prompt }],
  };
}

function sceneForStep(descriptor, context) {
  const actions = [];
  if (descriptor.before && descriptor.after && descriptor.before !== descriptor.after) {
    actions.push({ kind: 'transform_equation', before: descriptor.before, after: descriptor.after });
  } else if (descriptor.after) {
    actions.push({ kind: 'focus_math', expression: descriptor.after, tokens: [] });
  }
  if (context?.questionFigure && ['graph', 'geometry', 'calculus', 'statistics', 'figure'].includes(descriptor.concept)) {
    actions.push({ kind: 'show_figure', mode: descriptor.concept });
  }
  return {
    id: `director-solution-${descriptor.index}`,
    heading: descriptor.heading,
    lines: descriptor.lines,
    narration: [descriptor.heading, ...descriptor.lines].filter(Boolean).join('. '),
    concept: descriptor.concept,
    actions,
  };
}

function checkpointIndexes(descriptors, context, budget) {
  if (budget <= 0) return new Set();
  const transforms = descriptors.filter(d => d.before && d.after && d.before !== d.after).map(d => d.index);
  if (!transforms.length) return new Set();

  const chosen = [];
  const wrong = Boolean(context?.wrongAttempt || context?.hadWrongAttempt || context?.correct === false);
  if (wrong) chosen.push(transforms[0]);
  else chosen.push(transforms[Math.floor((transforms.length - 1) / 2)]);

  if (budget > 1 && transforms.length >= 3) {
    const later = transforms[Math.max(1, Math.floor(transforms.length * 0.7))];
    if (!chosen.includes(later)) chosen.push(later);
  }
  return new Set(chosen.slice(0, budget));
}

/** Build Pri's default personalised storyboard entirely on-device. */
export function buildDirectedStoryboard(solution, context = {}) {
  if (!solution) return null;
  const descriptors = describeSteps(solution, context);
  const scenes = [];
  const diagnosis = diagnosisScene(context);
  if (diagnosis) scenes.push(diagnosis);

  const room = Math.max(0, MAX_SCENES - scenes.length - descriptors.length);
  const checkpointBudget = Math.min(2, room);
  const checkpoints = checkpointIndexes(descriptors, context, checkpointBudget);
  let checkpointOrdinal = 0;

  for (const descriptor of descriptors) {
    if (checkpoints.has(descriptor.index) && scenes.length < MAX_SCENES - 1) {
      scenes.push(checkpointFor(descriptor, context, ++checkpointOrdinal));
    }
    scenes.push(sceneForStep(descriptor, context));
    if (scenes.length >= MAX_SCENES) break;
  }

  if (!scenes.length) {
    scenes.push({
      id: 'director-result',
      heading: 'Follow the verified path',
      lines: ['Work through the checked reasoning before revealing the final result.'],
      narration: 'Work through the checked reasoning before revealing the final result.',
      concept: conceptFor(context?.questionPrompt, Boolean(context?.questionFigure)),
      actions: context?.questionFigure ? [{ kind: 'show_figure', mode: 'figure' }] : [],
    });
  }

  const raw = { version: STORYBOARD_VERSION, source: 'director-local-v4', scenes };
  const checked = validateStoryboard(raw, solution, context);
  return checked.ok ? checked.storyboard : null;
}

/**
 * Provider boundary for a future model. The provider's output never receives a
 * trust flag. If any scene invents maths or asks for an unsupported action, it
 * is discarded wholesale and the local director is used instead.
 */
export function selectTeachingStoryboard(providerStoryboard, solution, context = {}) {
  if (providerStoryboard) {
    const checked = validateStoryboard(providerStoryboard, solution, context);
    if (checked.ok) return { storyboard: checked.storyboard, providerAccepted: true, fallbackReason: '' };
    return {
      storyboard: buildDirectedStoryboard(solution, context),
      providerAccepted: false,
      fallbackReason: checked.reason,
    };
  }
  return {
    storyboard: buildDirectedStoryboard(solution, context),
    providerAccepted: false,
    fallbackReason: '',
  };
}

function branchTokens(transform) {
  const changed = transform?.diff?.changedAfter || [];
  return [...new Set(changed.map(token => trim(token, 40)).filter(token => token && transform.after?.includes(token)))].slice(0, 6);
}

/**
 * Build a short, verified branch for "Why?", "Slower", or "Notice". The input
 * scene is already compiled, so its transform/focus/figure values have passed
 * V3 verification once; the branch is still validated again before returning.
 */
export function buildDirectorBranch(scene, intent, solution, context = {}) {
  if (!scene || !solution) return null;
  const visuals = Array.isArray(scene.visuals) ? scene.visuals : [];
  const transform = visuals.find(v => v.kind === 'transform');
  const focus = visuals.find(v => v.kind === 'focus');
  const figure = visuals.find(v => v.kind === 'figure');
  const attempt = visuals.find(v => v.kind === 'ink' || v.kind === 'attempt');
  const scenes = [];

  if (intent === 'slower' && transform) {
    scenes.push({
      id: 'branch-before', heading: 'Freeze the line before the change',
      lines: ['First identify the expression you are starting from.'], narration: 'Freeze the starting expression before making any change.',
      concept: scene.concept || 'algebra', actions: [{ kind: 'focus_math', expression: transform.before, tokens: [] }],
    });
    scenes.push({
      id: 'branch-change', heading: 'Make one verified change',
      lines: ['Watch only the pieces that change; everything else should carry through.'], narration: 'Now make one verified change and keep the rest fixed.',
      concept: scene.concept || 'algebra', actions: [{ kind: 'transform_equation', before: transform.before, after: transform.after }],
    });
    scenes.push({
      id: 'branch-after', heading: 'Read the new line',
      lines: ['Check the resulting expression before moving on.'], narration: 'Read the new line and check that the relationship is still valid.',
      concept: scene.concept || 'algebra', actions: [{ kind: 'focus_math', expression: transform.after, tokens: [] }],
    });
  } else if (intent === 'notice' && (transform || focus)) {
    const expression = transform?.after || focus.expression;
    const tokens = transform ? branchTokens(transform) : (focus.tokens || []).filter(token => expression.includes(token));
    scenes.push({
      id: 'branch-notice', heading: 'What should you notice?',
      lines: ['Track the part that changed and compare it with the previous line.'], narration: 'Notice the part that changed before you continue.',
      concept: scene.concept || 'generic', actions: [{ kind: 'focus_math', expression, tokens }],
    });
  } else if (intent === 'why' && transform) {
    scenes.push({
      id: 'branch-why', heading: 'Why this step works',
      lines: ['The verified move changes only what is needed while preserving the mathematical relationship.'],
      narration: 'Compare what changed with what stayed fixed. The relationship must remain valid after the move.',
      concept: scene.concept || 'algebra', actions: [{ kind: 'transform_equation', before: transform.before, after: transform.after }],
    });
  } else if (figure) {
    scenes.push({
      id: 'branch-figure', heading: intent === 'slower' ? 'Read the diagram in layers' : 'Focus on the useful feature',
      lines: ['Use only the information already present in the verified diagram.'], narration: 'Read the existing diagram carefully before returning to the algebra.',
      concept: figure.mode || scene.concept || 'figure', actions: [{ kind: 'show_figure', mode: figure.mode || 'figure' }],
    });
  } else if (attempt && (context?.wrongAttempt || context?.submission)) {
    scenes.push({
      id: 'branch-attempt', heading: 'Compare your first attempt again',
      lines: ['Look for the earliest move that does not match the verified path.'], narration: 'Replay your first attempt and stop at the earliest mismatch.',
      concept: 'diagnosis', actions: [{ kind: 'replay_attempt' }],
    });
  } else {
    scenes.push({
      id: 'branch-reasoning', heading: intent === 'slower' ? 'Slow the reasoning down' : intent === 'notice' ? 'What matters here' : 'Why this scene matters',
      lines: [intent === 'slower'
        ? 'Read the heading, then each line, before advancing to the next scene.'
        : 'Connect this scene to the verified step immediately before and after it.'],
      narration: 'Keep this scene connected to the verified sequence rather than treating it as an isolated fact.',
      concept: scene.concept || 'generic', actions: [],
    });
  }

  const raw = { version: STORYBOARD_VERSION, source: `director-branch-v4:${intent}`, scenes };
  const checked = validateStoryboard(raw, solution, context);
  return checked.ok ? checked.storyboard : null;
}
