// Pri Explain V8 · adaptive teaching policy.
//
// This file controls teaching presentation only. It consumes evidence already
// produced by Pri's marker/student model and the verified Pri Explain timeline.
// It must never infer a new mathematical diagnosis, equation, answer or claim.

export const TEACHING_MODES = Object.freeze({
  RAPID: 'rapid',
  GUIDED: 'guided',
  SCAFFOLDED: 'scaffolded',
  RECOVERY: 'recovery',
});

const MODE_META = Object.freeze({
  rapid: {
    label: 'Quick review',
    reason: 'You are moving confidently, so Pri keeps the explanation concise.',
    timingScale: 0.82,
    voiceRate: 1.08,
  },
  guided: {
    label: 'Guided walkthrough',
    reason: 'Pri is keeping each verified move visible long enough to connect the reasoning.',
    timingScale: 1,
    voiceRate: 1,
  },
  scaffolded: {
    label: 'Extra scaffolding',
    reason: 'Pri is slowing the transitions and giving structural visuals more teaching time.',
    timingScale: 1.18,
    voiceRate: 0.94,
  },
  recovery: {
    label: 'Targeted recovery',
    reason: 'Pri is rebuilding the solution around evidence from your actual attempt.',
    timingScale: 1.3,
    voiceRate: 0.9,
  },
});

function bounded(value, low, high, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;
}

function sessionAccuracy(studentContext = {}) {
  const answered = bounded(studentContext?.session?.answered, 0, 10000, 0);
  const correct = bounded(studentContext?.session?.correct, 0, answered, 0);
  return answered > 0 ? correct / answered : null;
}

function evidenceFocus(payload = {}) {
  const diagnosis = payload?.diagnosis;
  if (diagnosis && (diagnosis.title || diagnosis.message || diagnosis.fix)) {
    return {
      kind: 'diagnosis',
      label: String(diagnosis.title || 'Step diagnosis'),
      message: String(diagnosis.message || ''),
      fix: String(diagnosis.fix || ''),
      confidence: diagnosis.confidence || null,
    };
  }
  const misconception = payload?.misconception;
  if (misconception?.label) {
    return {
      kind: 'misconception',
      label: String(misconception.label),
      message: misconception.count > 1 ? `This pattern has appeared ${misconception.count} times.` : '',
      fix: '',
      confidence: 'marker-ledger',
    };
  }
  if (payload?.hadWrongAttempt || payload?.wrongAttempt) {
    return {
      kind: 'attempt',
      label: 'Compare your first attempt with the verified path',
      message: '',
      fix: '',
      confidence: 'attempt-evidence',
    };
  }
  return null;
}

function sceneTeachingWeight(scene) {
  if (!scene) return 0;
  let score = Math.min(4, Array.isArray(scene.lines) ? scene.lines.length : 0);
  if (scene.kind === 'diagnosis' || scene.concept === 'diagnosis') score += 9;
  for (const visual of scene.visuals || []) {
    if (visual.kind === 'transform') score += 4;
    else if (visual.kind === 'figure') score += 4;
    else if (visual.kind === 'ink' || visual.kind === 'attempt') score += 5;
    else if (visual.kind === 'focus') score += 2;
    else if (visual.kind === 'checkpoint') score += 1;
  }
  return score;
}

export function importantTeachingScene(timeline = [], mode = TEACHING_MODES.GUIDED) {
  if (!timeline.length) return -1;
  if (mode === TEACHING_MODES.RECOVERY) {
    const diagnosis = timeline.findIndex(scene => scene?.kind === 'diagnosis' || scene?.concept === 'diagnosis');
    if (diagnosis >= 0) return diagnosis;
  }
  let bestIndex = 0;
  let bestScore = -1;
  timeline.forEach((scene, index) => {
    const score = sceneTeachingWeight(scene);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export function buildTeachingProfile({ payload = {}, studentContext = {}, timeline = [] } = {}) {
  const focus = evidenceFocus(payload);
  const year = bounded(studentContext.year, 7, 12, 10);
  const difficulty = bounded(studentContext.difficulty, 1, 4, 2);
  const accuracy = sessionAccuracy(studentContext);
  const answered = bounded(studentContext?.session?.answered, 0, 10000, 0);

  let mode = TEACHING_MODES.GUIDED;
  if (payload?.hadWrongAttempt || payload?.wrongAttempt || payload?.correct === false || payload?.revealed || focus?.kind === 'diagnosis' || focus?.kind === 'misconception') {
    mode = TEACHING_MODES.RECOVERY;
  } else if ((year <= 8 && difficulty >= 3) || difficulty >= 4 || (accuracy != null && answered >= 3 && accuracy < 0.55)) {
    mode = TEACHING_MODES.SCAFFOLDED;
  } else if (accuracy != null && answered >= 3 && accuracy >= 0.8 && difficulty <= 2 && year >= 9) {
    mode = TEACHING_MODES.RAPID;
  }

  const meta = MODE_META[mode];
  const importantSceneIndex = importantTeachingScene(timeline, mode);
  const reason = focus?.kind === 'diagnosis'
    ? 'Pri is centring the explanation on the mistake identified in your working.'
    : focus?.kind === 'misconception'
      ? 'Pri is giving extra attention to a misconception already confirmed by your learning history.'
      : focus?.kind === 'attempt'
        ? 'Pri is comparing your first attempt with the verified solution path.'
        : payload?.revealed
          ? 'Pri is slowing the walkthrough because you chose to reveal the verified solution.'
          : meta.reason;

  return {
    mode,
    label: meta.label,
    reason,
    timingScale: meta.timingScale,
    voiceRate: meta.voiceRate,
    focus,
    importantSceneIndex,
    sessionAccuracy: accuracy,
    pauseAtKeyStep: mode === TEACHING_MODES.RECOVERY || mode === TEACHING_MODES.SCAFFOLDED,
    shouldOfferFollowUp: mode === TEACHING_MODES.RECOVERY || mode === TEACHING_MODES.SCAFFOLDED,
  };
}

export function teachingTimingScale(profile, sceneIndex) {
  const base = bounded(profile?.timingScale, 0.65, 1.6, 1);
  return sceneIndex === profile?.importantSceneIndex && profile?.mode !== TEACHING_MODES.RAPID
    ? Math.min(1.7, base * 1.1)
    : base;
}

export function whyThisStep(scene, profile, sceneIndex) {
  if (!scene || sceneIndex !== profile?.importantSceneIndex) return '';
  if (scene.kind === 'diagnosis' || scene.concept === 'diagnosis') {
    return 'This is the comparison point between your attempt and the verified solution path.';
  }
  if ((scene.visuals || []).some(visual => visual.kind === 'transform')) {
    return 'Track the terms that change between these two verified lines.';
  }
  if ((scene.visuals || []).some(visual => visual.kind === 'figure')) {
    return 'Watch the verified construction before connecting it to the next reasoning line.';
  }
  if ((scene.visuals || []).some(visual => visual.kind === 'ink' || visual.kind === 'attempt')) {
    return 'Keep your submitted working visible while Pri connects it to the verified reasoning.';
  }
  return 'Connect this reasoning line to the verified step immediately before it.';
}

export function adaptiveCheckpointPrompt(scene, profile, sceneIndex) {
  if (!profile?.pauseAtKeyStep || sceneIndex !== profile?.importantSceneIndex || !scene) return '';
  if (profile.focus?.kind === 'diagnosis' || scene.kind === 'diagnosis' || scene.concept === 'diagnosis') {
    return 'Before continuing, say what you would change in your original attempt.';
  }
  if (profile.focus?.kind === 'misconception') {
    return 'Before continuing, name the pattern you want to avoid when you try this again.';
  }
  if ((scene.visuals || []).some(visual => visual.kind === 'transform')) {
    return 'Before continuing, describe what changed between the two verified lines.';
  }
  if ((scene.visuals || []).some(visual => visual.kind === 'figure')) {
    return 'Before continuing, explain which part of the verified construction matters to this step.';
  }
  if (profile.focus?.kind === 'attempt') {
    return 'Before continuing, compare this verified step with what you tried first.';
  }
  return 'Before continuing, explain this verified move in your own words.';
}
