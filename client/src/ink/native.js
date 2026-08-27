// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Native ink bridge (web side)
//
// PencilKit owns the low-latency writing surface. Recognition sources are
// explicit rather than hidden behind one generic call:
//   foundationRecognize() → Pri's bundled Core ML model, when validated/present
//   recognize()           → mature native rescue recogniser
// Browser/dev builds have neither and use the JS Pri engine directly.
//
// DEBUG/native readings are additionally fused with Pri's purpose-built
// line/stroke recogniser. Native owns real-line geometry; Pri owns glyph
// segmentation and identity inside that line. Safe, answer-blind question
// context is retained on the web request and applied only during that Pri pass.
// ─────────────────────────────────────────────────────────────────────────────
import { fuseNativeStrokeReading } from './hybrid.js';
import { inferSetContextFromPrompt, mergeRecognitionContext } from './setNotation.js';

const handler = () =>
  (typeof window !== 'undefined' && window.__PRI_NATIVE_INK__ &&
    window.webkit?.messageHandlers?.priInk) || null;

export const nativeInkAvailable = () => !!handler();

let nextRequestId = 1;
const pending = new Map();       // reqId → {resolve, context, overrides, strokes, surfaceEpoch}
const strokeListeners = new Set();
let latestStrokes = [];
let surfaceEpoch = 0;

export function snapshotInkStrokes(strokes) {
  return (Array.isArray(strokes) ? strokes : []).map(stroke => ({
    ...stroke,
    points: (Array.isArray(stroke?.points) ? stroke.points : []).map(point => ({ ...point }))
  }));
}

const BASE_MATH_ALPHABET = [
  ...'0123456789'.split(''),
  '+', '-', '*', '/', '=', '(', ')', '[', ']', '{', '}', '<', '>', '<=', '>=', '!=', '±', '.', ',', ':', '%', '°', '∪', '∩',
  'pi', 'theta', 'sqrt', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'ln', 'log'
];

/**
 * Recover only ANSWER-BLIND notation from the visible question. This is a
 * fallback for callers that do not yet pass recognitionContext explicitly.
 * Single-letter variables must occur outside a normal word, so the x in
 * "differentiate" cannot enter the alphabet. u/v are included because they are
 * standard scratch variables in product/chain-rule working; no expected answer
 * or mark-scheme text is ever read here.
 */
export function inferredNotationContext(explicit = null) {
  if (typeof document === 'undefined') return explicit || null;
  const prompt = document.querySelector('.q-prompt');
  const raw = String(prompt?.textContent || '');
  const vars = new Set(['u', 'v']);
  const common = new Set('xyzuvnktmabcrfgh'.split(''));
  const re = /(?:^|[^A-Za-z])([A-Za-z])(?=[^A-Za-z]|$)/g;
  for (const match of raw.matchAll(re)) {
    const ch = match[1].toLowerCase();
    if (common.has(ch)) vars.add(ch);
  }
  const generic = { alphabet: [...new Set([...BASE_MATH_ALPHABET, ...vars])] };
  const setContext = inferSetContextFromPrompt(raw, generic.alphabet);
  return mergeRecognitionContext(setContext || generic, explicit);
}

function invalidatePending(reason) {
  surfaceEpoch += 1;
  for (const [reqId, entry] of pending) {
    pending.delete(reqId);
    entry.resolve(failedReading(entry.op, reason));
  }
}

if (typeof window !== 'undefined') {
  window.__priInkReceive = (payload) => {
    if (!payload || typeof payload !== 'object') return;
    if (payload.type === 'strokes') {
      latestStrokes = Array.isArray(payload.strokes) ? payload.strokes : [];
      for (const listener of strokeListeners) listener(latestStrokes);
    } else if (payload.type === 'reading') {
      const entry = pending.get(payload.reqId);
      if (entry) {
        pending.delete(payload.reqId);
        if (entry.surfaceEpoch !== surfaceEpoch) {
          entry.resolve(failedReading(entry.op, 'surface-stale'));
          return;
        }
        let reading = payload;
        if (entry.strokes.length &&
            (payload.engine === 'native-primary-debug' || payload.engine === 'native-rescue')) {
          try {
            reading = fuseNativeStrokeReading(
              payload,
              entry.strokes,
              entry.overrides || {},
              entry.context || inferredNotationContext()
            );
            reading.engine = `${payload.engine}+line-stroke-fusion`;
          } catch {
            reading = payload;
          }
        }
        entry.resolve(reading);
      }
    }
  };
}

function post(message) {
  const target = handler();
  if (!target) return false;
  try {
    target.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

function failedReading(op, failure) {
  const base = op === 'foundationRecognize' ? 'pri-foundation' : 'native-rescue';
  return {
    type: 'reading', lines: [], text: '', symbols: [], minConf: 0, margin: 0,
    weakest: null, engine: `${base}-${failure}`, failure
  };
}

function requestReading(message, timeoutMs, context = null) {
  return new Promise((resolve) => {
    const reqId = nextRequestId++;
    pending.set(reqId, {
      resolve, context, overrides: message.overrides || {}, op: message.op,
      strokes: snapshotInkStrokes(latestStrokes), surfaceEpoch
    });
    if (!post({ ...message, reqId })) {
      pending.delete(reqId);
      resolve(failedReading(message.op, 'bridge-unavailable'));
      return;
    }
    setTimeout(() => {
      const entry = pending.get(reqId);
      if (entry) {
        pending.delete(reqId);
        entry.resolve(failedReading(entry.op, 'timeout'));
      }
    }, timeoutMs);
  });
}

/** Where the writing area is, and how much of it the shell may draw in. */
function geometryOf(element) {
  const rect = element.getBoundingClientRect();

  let left = 0, top = 0;
  let right = window.innerWidth, bottom = window.innerHeight;

  let node = element.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|hidden)/.test(style.overflowY + style.overflowX)) {
      const b = node.getBoundingClientRect();
      left = Math.max(left, b.left); top = Math.max(top, b.top);
      right = Math.min(right, b.right); bottom = Math.min(bottom, b.bottom);
    }
    node = node.parentElement;
  }

  const bar = document.querySelector('.topbar');
  if (bar) {
    const b = bar.getBoundingClientRect();
    if (b.top <= top + 1) top = Math.max(top, b.bottom);
  }
  const side = document.querySelector('.sidebar');
  if (side) {
    const b = side.getBoundingClientRect();
    if (b.left <= left + 1) left = Math.max(left, b.right);
  }

  return {
    frame: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
    clip: { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) },
    scrollX: window.scrollX || 0,
    scrollY: window.scrollY || 0
  };
}

function inkColor() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : '#efece1';
}

export const nativeInk = {
  available: nativeInkAvailable,

  mount(element) {
    if (!element) return false;
    invalidatePending('surface-remounted');
    latestStrokes = [];
    return post({ op: 'mount', ...geometryOf(element), ink: inkColor() });
  },

  layout(element) {
    if (!element) return;
    post({ op: 'layout', ...geometryOf(element) });
  },

  unmount() { invalidatePending('surface-unmounted'); latestStrokes = []; post({ op: 'unmount' }); },
  setAppearance() { post({ op: 'appearance', ink: inkColor() }); },
  setTool(tool, finger) { post({ op: 'tool', tool, finger: !!finger }); },
  setEnabled(enabled) { post({ op: 'enabled', enabled: !!enabled }); },
  undo() { post({ op: 'undo' }); },
  redo() { post({ op: 'redo' }); },
  clear() { invalidatePending('surface-cleared'); latestStrokes = []; post({ op: 'clear' }); },
  setStrokes(strokes) {
    latestStrokes = Array.isArray(strokes) ? strokes : [];
    post({ op: 'setStrokes', strokes: latestStrokes });
  },

  onStrokes(listener) {
    strokeListeners.add(listener);
    return () => strokeListeners.delete(listener);
  },

  /** Pri-owned learned model. Empty result means no validated asset is bundled
   * or the model declined the page; callers must continue through fallbacks. */
  foundationRecognize(overrides = {}, context = null) {
    return requestReading({ op: 'foundationRecognize', overrides }, 8000, context);
  },

  /** Mature native rescue recogniser. It remains on-device and is intentionally
   * separate from the foundation call so production fallback order is auditable. */
  recognize(overrides = {}, context = null) {
    return requestReading({ op: 'recognize', overrides }, 14000, context);
  }
};