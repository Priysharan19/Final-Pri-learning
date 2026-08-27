import { storyboardPromptContract } from './storyboard.js';
import { selectTeachingStoryboard } from './teachingDirector.js';

const TIMEOUT_MS = 12000;
const MAX_WRONG_CACHE = 32;
let nextRequestId = 1;
const pending = new Map();
const firstWrongByQuestion = new Map();
let receiverInstalled = false;
let providerInstalled = false;

function installReceiver() {
  if (receiverInstalled || typeof window === 'undefined') return;
  receiverInstalled = true;
  window.__priExplainModelReceive = payload => {
    const reqId = Number(payload?.reqId);
    const slot = pending.get(reqId);
    if (!slot) return;
    pending.delete(reqId);
    clearTimeout(slot.timer);
    slot.resolve(payload);
  };
}

function nativeHandler() {
  if (typeof window === 'undefined') return null;
  return window.webkit?.messageHandlers?.priExplain || null;
}

function cleanDiagnosis(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    title: String(value.title || '').slice(0, 220),
    message: String(value.message || value.note || '').slice(0, 700),
    fix: String(value.fix || '').slice(0, 500),
    code: String(value.code || '').slice(0, 80),
  };
}

function cleanMisconception(value) {
  if (typeof value === 'string') return value.slice(0, 300);
  if (!value || typeof value !== 'object') return '';
  return String(value.label || value.name || value.title || '').slice(0, 300);
}

function wrongWorking(context) {
  const attempt = context?.wrongAttempt || context?.submission;
  return String(attempt?.steps || attempt?.ink?.recognized || attempt?.answer || '').slice(0, 1200);
}

function providerPayload(solution, context) {
  const contract = storyboardPromptContract(solution, context);
  return {
    version: contract.version,
    allowedActions: contract.allowedActions,
    rules: contract.rules,
    verifiedMath: contract.verifiedMath,
    hasWrongAttempt: contract.hasWrongAttempt,
    hasFigure: contract.hasFigure,
    questionPrompt: String(context?.questionPrompt || '').slice(0, 1000),
    feedback: String(context?.feedback || '').slice(0, 700),
    diagnosis: cleanDiagnosis(context?.diagnosis),
    misconception: cleanMisconception(context?.misconception),
    wrongWorking: wrongWorking(context),
    steps: (solution?.steps || []).slice(0, 20).map(step => ({
      heading: String(step?.h || '').slice(0, 220),
      detail: String(step?.d || '').slice(0, 1200),
    })),
    answerText: String(solution?.answerText || '').slice(0, 500),
  };
}

function rememberFirstWrong(detail) {
  if (!detail?.questionId || detail.correct !== false || !detail.submission) return;
  const key = String(detail.questionId);
  if (firstWrongByQuestion.has(key)) return;
  firstWrongByQuestion.set(key, detail);
  if (firstWrongByQuestion.size > MAX_WRONG_CACHE) {
    firstWrongByQuestion.delete(firstWrongByQuestion.keys().next().value);
  }
}

export function canUseNativeTeachingModel() {
  return Boolean(nativeHandler());
}

/**
 * Ask the native iPad shell for an Apple Foundation Models storyboard. Nothing
 * is sent over the network: this is a WKWebView message to the host app. The
 * returned object is still treated as untrusted data and must pass V3's verifier.
 */
export async function requestNativeTeachingStoryboard(solution, context = {}) {
  const handler = nativeHandler();
  if (!handler || !solution) return { storyboard: null, engine: 'local-director', reason: 'native model unavailable' };
  installReceiver();

  const reqId = nextRequestId++;
  const payload = providerPayload(solution, context);
  const response = await new Promise(resolve => {
    const timer = setTimeout(() => {
      pending.delete(reqId);
      resolve({ reqId, ok: false, reason: 'native model timeout' });
    }, TIMEOUT_MS);
    pending.set(reqId, { resolve, timer });
    try {
      handler.postMessage({ reqId, payload });
    } catch {
      clearTimeout(timer);
      pending.delete(reqId);
      resolve({ reqId, ok: false, reason: 'native bridge failed' });
    }
  });

  if (!response?.ok || !response.storyboard) {
    return { storyboard: null, engine: response?.engine || 'local-director', reason: response?.reason || 'native model unavailable' };
  }

  const selected = selectTeachingStoryboard(response.storyboard, solution, context);
  if (!selected.providerAccepted) {
    return {
      storyboard: null,
      engine: response.engine || 'apple-foundation-models',
      reason: `provider rejected: ${selected.fallbackReason}`,
    };
  }

  return {
    storyboard: selected.storyboard,
    engine: response.engine || 'apple-foundation-models',
    reason: '',
  };
}

/**
 * Install the optional native model as a non-blocking second pass over the same
 * browser-local teaching evidence Pri Explain already uses. The normal local
 * V4 director renders immediately. On supported iPads, a verified model plan is
 * then re-published through the existing worked-solution event; unsupported
 * devices do nothing and therefore keep the local director unchanged.
 */
export function installNativeTeachingProvider() {
  if (providerInstalled || typeof window === 'undefined') return () => {};
  providerInstalled = true;
  installReceiver();

  const onAttempt = event => rememberFirstWrong(event?.detail);
  const onSolution = async event => {
    const detail = event?.detail;
    if (!detail?.solution || detail?.nativeTeachingResolved) return;
    if (!nativeHandler()) return;

    const key = String(detail.questionId || '');
    const prior = firstWrongByQuestion.get(key) || null;
    const context = {
      ...detail,
      questionPrompt: detail.questionPrompt || '',
      wrongAttempt: prior?.submission || (detail.correct === false ? detail.submission : null),
      feedback: prior?.feedback || detail.feedback || '',
      diagnosis: prior?.diagnosis || detail.diagnosis || null,
      misconception: prior?.misconception || detail.misconception || null,
      hadWrongAttempt: Boolean(prior),
    };

    const result = await requestNativeTeachingStoryboard(detail.solution, context);
    firstWrongByQuestion.delete(key);
    if (!result.storyboard) return;

    window.dispatchEvent(new CustomEvent('pri:worked-solution', {
      detail: {
        ...detail,
        nativeTeachingResolved: true,
        teachingEngine: result.engine,
        explanationStoryboard: result.storyboard,
        solution: {
          ...detail.solution,
          explanationStoryboard: result.storyboard,
        },
      },
    }));
  };

  window.addEventListener('pri:attempt-feedback', onAttempt);
  window.addEventListener('pri:worked-solution', onSolution);
  return () => {
    window.removeEventListener('pri:attempt-feedback', onAttempt);
    window.removeEventListener('pri:worked-solution', onSolution);
    providerInstalled = false;
  };
}
