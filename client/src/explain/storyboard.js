// Pri Explain V3 · verified storyboard contract.
//
// AI and teacher storyboards may choose presentation, never mathematical truth.
// Equation-bearing actions and authored display maths are accepted only when
// they reference mathematics already present in the verified worked solution.
// Any unsafe storyboard is rejected and callers fall back to the deterministic
// renderer, whose text originates from the marking/solution pipeline.

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

function containsOnlyVerifiedMath(value, evidence) {
  return mathFrom(value).every(expression => evidence.has(expression));
}

function cleanAction(raw, evidence, context) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'invalid action', action: null };
  }

  const kind = text(raw.kind, 40);
  if (!ACTION_KINDS.includes(kind)) {
    return { ok: false, reason: 'unsupported action', action: null };
  }

  if (kind === 'replay_attempt') {
    if (!context?.wrongAttempt && !context?.submission) {
      return { ok: false, reason: 'missing attempt', action: null };
    }
    return { ok: true, reason: '', action: { kind } };
  }

  if (kind === 'transform_equation') {
    const before = text(raw.before, 240);
    const after = text(raw.after, 240);
    if (!before || !after || before === after) {
      return { ok: false, reason: 'invalid equation transform', action: null };
    }
    if (!evidence.has(before) || !evidence.has(after)) {
      return { ok: false, reason: 'invented equation', action: null };
    }
    // Operation labels are derived from the verified before/after pair by the
    // renderer. An AI-authored label is intentionally not trusted as maths.
    return { ok: true, reason: '', action: { kind, before, after } };
  }

  if (kind === 'focus_math') {
    const expression = text(raw.expression, 240);
    if (!expression || !evidence.has(expression)) {
      return { ok: false, reason: 'invented focus expression', action: null };
    }
    const tokens = Array.isArray(raw.tokens)
      ? raw.tokens.map(value => text(value, 80)).filter(Boolean).slice(0, 10)
      : [];
    if (tokens.some(token => !expression.includes(token))) {
      return { ok: false, reason: 'invented focus token', action: null };
    }
    const label = text(raw.label, 120);
    if (!containsOnlyVerifiedMath(label, evidence)) {
      return { ok: false, reason: 'invented focus label maths', action: null };
    }
    return { ok: true, reason: '', action: { kind, expression, tokens, label } };
  }

  if (kind === 'show_figure') {
    if (!context?.questionFigure) {
      return { ok: false, reason: 'missing verified figure', action: null };
    }
    const mode = ['graph', 'geometry', 'calculus', 'statistics', 'figure'].includes(raw.mode)
      ? raw.mode
      : 'figure';
    return { ok: true, reason: '', action: { kind, mode } };
  }

  if (kind === 'checkpoint') {
    const prompt = text(raw.prompt, 220);
    if (!prompt) {
      return { ok: false, reason: 'invalid checkpoint', action: null };
    }
    if (text(raw.answer, 220)) {
      return { ok: false, reason: 'checkpoint answer is not allowed', action: null };
    }
    if (!containsOnlyVerifiedMath(prompt, evidence)) {
      return { ok: false, reason: 'invented checkpoint maths', action: null };
    }
    return { ok: true, reason: '', action: { kind, prompt } };
  }

  return { ok: false, reason: 'invalid action', action: null };
}

function cleanScene(raw, index, evidence, context, trustedText) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'invalid scene', scene: null };
  }

  const heading = text(raw.heading, 180) || `Scene ${index + 1}`;
  const lines = Array.isArray(raw.lines)
    ? raw.lines.map(value => text(value, 360)).filter(Boolean).slice(0, 6)
    : [];
  const narration = text(raw.narration, 700);

  if (!trustedText) {
    const authoredText = [heading, narration, ...lines];
    if (authoredText.some(value => !containsOnlyVerifiedMath(value, evidence))) {
      return { ok: false, reason: 'invented narrative maths', scene: null };
    }
  }

  const rawActions = Array.isArray(raw.actions) ? raw.actions.slice(0, MAX_ACTIONS) : [];
  const actions = [];
  for (const rawAction of rawActions) {
    const cleaned = cleanAction(rawAction, evidence, context);
    if (!cleaned.ok) return { ok: false, reason: cleaned.reason, scene: null };
    actions.push(cleaned.action);
  }

  return {
    ok: true,
    reason: '',
    scene: {
      id: text(raw.id, 80) || `story-${index}`,
      heading,
      lines,
      narration,
      concept: text(raw.concept, 80) || 'generic',
      actions,
    },
  };
}

export function validateStoryboard(raw, solution, context = {}) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'missing storyboard', storyboard: null };
  }
  if (Number(raw.version) !== STORYBOARD_VERSION) {
    return { ok: false, reason: 'unsupported version', storyboard: null };
  }
  if (!Array.isArray(raw.scenes) || !raw.scenes.length || raw.scenes.length > MAX_SCENES) {
    return { ok: false, reason: 'invalid scene count', storyboard: null };
  }

  const evidence = verifiedMath(solution);
  const source = text(raw.source, 40) || 'authored';
  const trustedText = source === 'deterministic';
  const scenes = [];

  for (let index = 0; index < raw.scenes.length; index++) {
    const cleaned = cleanScene(raw.scenes[index], index, evidence, context, trustedText);
    if (!cleaned.ok) return { ok: false, reason: cleaned.reason, storyboard: null };
    scenes.push(cleaned.scene);
  }

  return {
    ok: true,
    reason: '',
    storyboard: {
      version: STORYBOARD_VERSION,
      source,
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
      'Do not author operation labels; the renderer derives them from verified equations.',
      'Use focus_math tokens only when the token occurs in the verified expression.',
      'Use checkpoint only to ask for a prediction; never supply its answer.',
      'Any $...$ maths in headings, lines, labels, narration or checkpoints must occur in verifiedMath.',
      'Keep narration concise and suitable for spoken Australian English.',
    ],
    allowedActions: ACTION_KINDS,
    verifiedMath: [...verifiedMath(solution)],
    hasWrongAttempt: Boolean(context.wrongAttempt || context.submission),
    hasFigure: Boolean(context.questionFigure),
  };
}
