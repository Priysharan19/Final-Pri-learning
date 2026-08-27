// Pri Explain V3 · verified storyboard contract.
//
// An AI/teacher is allowed to choose presentation, never mathematical truth.
// Every equation action must point at maths already present in the verified
// solution payload. Any invalid/invented storyboard is rejected and callers
// fall back to the deterministic compiler.

export const STORYBOARD_VERSION = 3;
export const ACTION_KINDS = Object.freeze([
  'replay_attempt',
  'transform_equation',
  'focus_math',
  'show_figure',
  'checkpoint',
]);

const MAX_SCENES = 24;
const MAX_ACTIONS = 8;
const MAX_TEXT = 700;
const MATH = /\$([^$]+)\$/g;

function text(value, max = MAX_TEXT) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function mathFrom(value) {
  const source = String(value || '');
  const out = [];
  let match;
  MATH.lastIndex = 0;
  while ((match = MATH.exec(source))) {
    const expression = match[1].trim();
    if (expression) out.push(expression);
  }
  return out;
}

export function verifiedMath(solution) {
  const values = new Set();
  for (const step of solution?.steps || []) {
    for (const expr of mathFrom(step?.h)) values.add(expr);
    for (const expr of mathFrom(step?.d)) values.add(expr);
  }
  for (const expr of mathFrom(solution?.answerText)) values.add(expr);
  return values;
}

function cleanAction(raw, evidence, context) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = text(raw.kind, 40);
  if (!ACTION_KINDS.includes(kind)) return null;

  if (kind === 'replay_attempt') {
    if (!context?.wrongAttempt && !context?.submission) return null;
    return { kind };
  }

  if (kind === 'transform_equation') {
    const before = text(raw.before, 240);
    const after = text(raw.after, 240);
    if (!before || !after || before === after) return null;
    if (!evidence.has(before) || !evidence.has(after)) return null;
    return { kind, before, after, operation: text(raw.operation, 80) };
  }

  if (kind === 'focus_math') {
    const expression = text(raw.expression, 240);
    if (!expression || !evidence.has(expression)) return null;
    const tokens = Array.isArray(raw.tokens)
      ? raw.tokens.map(v => text(v, 80)).filter(Boolean).slice(0, 10)
      : [];
    return { kind, expression, tokens, label: text(raw.label, 120) };
  }

  if (kind === 'show_figure') {
    if (!context?.questionFigure) return null;
    const mode = ['graph', 'geometry', 'calculus', 'statistics', 'figure'].includes(raw.mode)
      ? raw.mode : 'figure';
    return { kind, mode };
  }

  if (kind === 'checkpoint') {
    const prompt = text(raw.prompt, 220);
    if (!prompt) return null;
    return { kind, prompt, answer: text(raw.answer, 220) };
  }

  return null;
}

function cleanScene(raw, index, evidence, context) {
  if (!raw || typeof raw !== 'object') return null;
  const heading = text(raw.heading, 180) || `Scene ${index + 1}`;
  const lines = Array.isArray(raw.lines)
    ? raw.lines.map(v => text(v, 360)).filter(Boolean).slice(0, 6)
    : [];
  const narration = text(raw.narration, 700);
  const actions = (Array.isArray(raw.actions) ? raw.actions : [])
    .slice(0, MAX_ACTIONS)
    .map(action => cleanAction(action, evidence, context))
    .filter(Boolean);
  return {
    id: text(raw.id, 80) || `story-${index}`,
    heading,
    lines,
    narration,
    concept: text(raw.concept, 80) || 'generic',
    actions,
  };
}

export function validateStoryboard(raw, solution, context = {}) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'missing storyboard', storyboard: null };
  if (Number(raw.version) !== STORYBOARD_VERSION) return { ok: false, reason: 'unsupported version', storyboard: null };
  if (!Array.isArray(raw.scenes) || !raw.scenes.length || raw.scenes.length > MAX_SCENES) {
    return { ok: false, reason: 'invalid scene count', storyboard: null };
  }

  const evidence = verifiedMath(solution);
  const scenes = raw.scenes.map((scene, index) => cleanScene(scene, index, evidence, context)).filter(Boolean);
  if (!scenes.length) return { ok: false, reason: 'no usable scenes', storyboard: null };

  // Reject, rather than silently strip, any equation action that references
  // maths outside the verified solution. This is the hard boundary that makes
  // an AI director safe to use downstream of marking.
  for (let i = 0; i < raw.scenes.length; i++) {
    for (const action of raw.scenes[i]?.actions || []) {
      if (action?.kind === 'transform_equation') {
        if (!evidence.has(text(action.before, 240)) || !evidence.has(text(action.after, 240))) {
          return { ok: false, reason: 'invented equation', storyboard: null };
        }
      }
      if (action?.kind === 'focus_math' && !evidence.has(text(action.expression, 240))) {
        return { ok: false, reason: 'invented focus expression', storyboard: null };
      }
    }
  }

  return {
    ok: true,
    reason: '',
    storyboard: {
      version: STORYBOARD_VERSION,
      source: text(raw.source, 40) || 'authored',
      scenes,
    },
  };
}

export function storyboardPromptContract(solution, context = {}) {
  return {
    version: STORYBOARD_VERSION,
    role: 'teaching-director',
    rules: [
      'Use only the supplied verified mathematics.',
      'Never invent an equation, numerical result, diagram or marking claim.',
      'Prefer one conceptual change per scene.',
      'Use replay_attempt first when a wrong attempt exists.',
      'Use transform_equation only for equations listed in verifiedMath.',
      'Keep narration concise and suitable for spoken Australian English.',
    ],
    allowedActions: ACTION_KINDS,
    verifiedMath: [...verifiedMath(solution)],
    hasWrongAttempt: Boolean(context.wrongAttempt || context.submission),
    hasFigure: Boolean(context.questionFigure),
  };
}
