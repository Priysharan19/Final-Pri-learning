// Pri Explain V8 · adaptive teaching policy.
//
// This file controls teaching presentation only. It consumes evidence already
// produced by Pri's marker/student model and the verified Pri Explain timeline.
// It must never infer a new mathematical diagnosis, equation, answer or claim.
//
// Every sentence it can produce is a catalogue key (explain.* in
// i18n/strings.en.js). The profile carries the key alongside the English, so
// the player renders it in the student's language with t(); the English-
// returning functions below resolve the same keys against the English
// catalogue, so there is exactly one copy of each sentence.
import en from '../i18n/strings.en.js';

const english = (key, vars) => (key
  ? String(en[key] ?? key).replace(/\{(\w+)\}/g, (whole, name) => (vars && name in vars ? String(vars[name]) : whole))
  : '');

export const TEACHING_MODES = Object.freeze({
  RAPID: 'rapid',
  GUIDED: 'guided',
  SCAFFOLDED: 'scaffolded',
  RECOVERY: 'recovery',
});

const MODE_META = Object.freeze({
  rapid: {
    labelKey: 'explain.mode.rapid',
    reasonKey: 'explain.reason.rapid',
    timingScale: 0.82,
    voiceRate: 1.08,
  },
  guided: {
    labelKey: 'explain.mode.guided',
    reasonKey: 'explain.reason.guided',
    timingScale: 1,
    voiceRate: 1,
  },
  scaffolded: {
    labelKey: 'explain.mode.scaffolded',
    reasonKey: 'explain.reason.scaffolded',
    timingScale: 1.18,
    voiceRate: 0.94,
  },
  recovery: {
    labelKey: 'explain.mode.recovery',
    reasonKey: 'explain.reason.recovery',
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
  if (answered <= 0) return null;

  // Missing correctness evidence is not negative evidence. Keep adaptation
  // neutral until the session model supplies a finite correctness count rather
  // than silently turning incomplete telemetry into a 0% accuracy signal.
  const rawCorrect = studentContext?.session?.correct;
  if (rawCorrect == null || (typeof rawCorrect === 'string' && rawCorrect.trim() === '')) return null;
  const numericCorrect = Number(rawCorrect);
  if (!Number.isFinite(numericCorrect)) return null;

  const correct = bounded(numericCorrect, 0, answered, 0);
  return correct / answered;
}

function evidenceFocus(payload = {}) {
  const diagnosis = payload?.diagnosis;
  if (diagnosis && (diagnosis.title || diagnosis.message || diagnosis.fix)) {
    return {
      kind: 'diagnosis',
      label: String(diagnosis.title || english('explain.focus.stepDiagnosis')),
      labelKey: diagnosis.title ? null : 'explain.focus.stepDiagnosis',
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
      message: misconception.count > 1 ? english('explain.focus.patternCount', { n: misconception.count }) : '',
      messageKey: misconception.count > 1 ? 'explain.focus.patternCount' : null,
      messageVars: { n: misconception.count },
      fix: '',
      confidence: 'marker-ledger',
    };
  }
  if (payload?.hadWrongAttempt || payload?.wrongAttempt) {
    return {
      kind: 'attempt',
      label: english('explain.focus.compareAttempt'),
      labelKey: 'explain.focus.compareAttempt',
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
  const reasonKey = focus?.kind === 'diagnosis'
    ? 'explain.reason.diagnosis'
    : focus?.kind === 'misconception'
      ? 'explain.reason.misconception'
      : focus?.kind === 'attempt'
        ? 'explain.reason.attempt'
        : payload?.revealed
          ? 'explain.reason.revealed'
          : meta.reasonKey;

  return {
    mode,
    label: english(meta.labelKey),
    labelKey: meta.labelKey,
    reason: english(reasonKey),
    reasonKey,
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

/** The catalogue key for why the key teaching step matters, or '' for any other step. */
export function whyThisStepKey(scene, profile, sceneIndex) {
  if (!scene || sceneIndex !== profile?.importantSceneIndex) return '';
  if (scene.kind === 'diagnosis' || scene.concept === 'diagnosis') return 'explain.why.diagnosis';
  if ((scene.visuals || []).some(visual => visual.kind === 'transform')) return 'explain.why.transform';
  if ((scene.visuals || []).some(visual => visual.kind === 'figure')) return 'explain.why.figure';
  if ((scene.visuals || []).some(visual => visual.kind === 'ink' || visual.kind === 'attempt')) return 'explain.why.attempt';
  return 'explain.why.generic';
}

export function whyThisStep(scene, profile, sceneIndex) {
  return english(whyThisStepKey(scene, profile, sceneIndex));
}

/** The catalogue key for the retrieval prompt at the key step, or '' when there is none. */
export function adaptiveCheckpointKey(scene, profile, sceneIndex) {
  if (!profile?.pauseAtKeyStep || sceneIndex !== profile?.importantSceneIndex || !scene) return '';
  if (profile.focus?.kind === 'diagnosis' || scene.kind === 'diagnosis' || scene.concept === 'diagnosis') return 'explain.check.diagnosis';
  if (profile.focus?.kind === 'misconception') return 'explain.check.misconception';
  if ((scene.visuals || []).some(visual => visual.kind === 'transform')) return 'explain.check.transform';
  if ((scene.visuals || []).some(visual => visual.kind === 'figure')) return 'explain.check.figure';
  if (profile.focus?.kind === 'attempt') return 'explain.check.attempt';
  return 'explain.check.generic';
}

export function adaptiveCheckpointPrompt(scene, profile, sceneIndex) {
  return english(adaptiveCheckpointKey(scene, profile, sceneIndex));
}
