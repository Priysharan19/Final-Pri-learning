import { storyboardPromptContract } from './storyboard.js';
import { selectTeachingStoryboard } from './teachingDirector.js';

const TIMEOUT_MS = 12000;
let nextRequestId = 1;
const pending = new Map();
let receiverInstalled = false;

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
