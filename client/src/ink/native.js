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
// stroke/CNN glyph classifier using the exact native stroke ownership. Native
// remains responsible for 2-D geometry; the stroke model gets an independent
// vote on glyph identity.
// ─────────────────────────────────────────────────────────────────────────────
import { fuseNativeStrokeReading } from './hybrid.js';

const handler = () =>
  (typeof window !== 'undefined' && window.__PRI_NATIVE_INK__ &&
    window.webkit?.messageHandlers?.priInk) || null;

export const nativeInkAvailable = () => !!handler();

let nextRequestId = 1;
const pending = new Map();       // reqId → resolve
const strokeListeners = new Set();
let latestStrokes = [];

if (typeof window !== 'undefined') {
  window.__priInkReceive = (payload) => {
    if (!payload || typeof payload !== 'object') return;
    if (payload.type === 'strokes') {
      latestStrokes = Array.isArray(payload.strokes) ? payload.strokes : [];
      for (const listener of strokeListeners) listener(latestStrokes);
    } else if (payload.type === 'reading') {
      const resolve = pending.get(payload.reqId);
      if (resolve) {
        pending.delete(payload.reqId);
        let reading = payload;
        // The promoted foundation model is release-gated separately and must
        // not be silently rewritten here. The native debug/rescue reader,
        // however, benefits from Pri's independent stroke classifier because
        // it already supplies exact per-glyph Pencil ownership.
        if (latestStrokes.length &&
            (payload.engine === 'native-primary-debug' || payload.engine === 'native-rescue')) {
          try {
            reading = fuseNativeStrokeReading(payload, latestStrokes, payload.overrides || {});
            reading.engine = `${payload.engine}+stroke-fusion`;
          } catch {
            reading = payload;
          }
        }
        resolve(reading);
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

function requestReading(message, timeoutMs) {
  return new Promise((resolve) => {
    const reqId = nextRequestId++;
    pending.set(reqId, resolve);
    if (!post({ ...message, reqId })) {
      pending.delete(reqId);
      resolve(null);
      return;
    }
    setTimeout(() => {
      if (pending.has(reqId)) { pending.delete(reqId); resolve(null); }
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
    latestStrokes = [];
    return post({ op: 'mount', ...geometryOf(element), ink: inkColor() });
  },

  layout(element) {
    if (!element) return;
    post({ op: 'layout', ...geometryOf(element) });
  },

  unmount() { latestStrokes = []; post({ op: 'unmount' }); },
  setAppearance() { post({ op: 'appearance', ink: inkColor() }); },
  setTool(tool, finger) { post({ op: 'tool', tool, finger: !!finger }); },
  setEnabled(enabled) { post({ op: 'enabled', enabled: !!enabled }); },
  undo() { post({ op: 'undo' }); },
  redo() { post({ op: 'redo' }); },
  clear() { latestStrokes = []; post({ op: 'clear' }); },
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
  foundationRecognize(overrides = {}) {
    return requestReading({ op: 'foundationRecognize', overrides }, 5000);
  },

  /** Mature native rescue recogniser. It remains on-device and is intentionally
   * separate from the foundation call so production fallback order is auditable. */
  recognize(overrides = {}) {
    return requestReading({ op: 'recognize', overrides }, 6000);
  }
};
