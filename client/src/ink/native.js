// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Native ink bridge (web side)
//
// Inside the iPad app the writing surface is a real PencilKit canvas sitting
// over this page, and the reading comes from Vision. This module is the whole
// of the web app's side of that: where the writing area is, what the toolbar
// just did, and "please read what is written".
//
// Everywhere else — a browser, a desktop, the dev server — `available()` is
// false and the app keeps its own canvas and its own engine. Nothing else in
// the app needs to know which one it got.
// ─────────────────────────────────────────────────────────────────────────────

const handler = () =>
  (typeof window !== 'undefined' && window.__PRI_NATIVE_INK__ &&
    window.webkit?.messageHandlers?.priInk) || null;

export const nativeInkAvailable = () => !!handler();

let nextRequestId = 1;
const pending = new Map();       // reqId → resolve
const strokeListeners = new Set();
let cachedStrokes = [];

function publishStrokes() {
  // Give listeners a fresh array so React state and callers never observe the
  // bridge mutating an array they already received.
  const snapshot = cachedStrokes.slice();
  for (const listener of strokeListeners) listener(snapshot);
}

if (typeof window !== 'undefined') {
  window.__priInkReceive = (payload) => {
    if (!payload || typeof payload !== 'object') return;
    if (payload.type === 'strokes') {
      cachedStrokes = Array.isArray(payload.strokes) ? payload.strokes.slice() : [];
      publishStrokes();
    } else if (payload.type === 'strokeDelta') {
      const index = Number.isInteger(payload.index) ? payload.index : -1;
      if (!payload.stroke || index < 0) return;
      // Native deltas are emitted on one serial encoding queue. Accept the
      // append-only fast path, but also tolerate a replacement at an existing
      // index so a future shell can use the same contract safely.
      if (index === cachedStrokes.length) cachedStrokes.push(payload.stroke);
      else if (index < cachedStrokes.length) cachedStrokes[index] = payload.stroke;
      else return; // a gap means a full snapshot is required; never invent ink
      publishStrokes();
    } else if (payload.type === 'reading') {
      const resolve = pending.get(payload.reqId);
      if (resolve) { pending.delete(payload.reqId); resolve(payload); }
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
    // A postMessage that throws means the shell went away mid-navigation.
    // The caller's fallback path is the web engine, which is always there.
    return false;
  }
}

/** Where the writing area is, and how much of it the shell may draw in. */
function geometryOf(element) {
  const rect = element.getBoundingClientRect();

  let left = 0, top = 0;
  let right = window.innerWidth, bottom = window.innerHeight;

  // Any ancestor that clips its content also clips the ink.
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

  // The sticky top bar and the sidebar float above the page. A native view
  // knows nothing about z-index, so the area it may paint in stops at them.
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

/** The pen colour the theme is currently using, as the shell wants it. */
function inkColor() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : '#efece1';
}

export const nativeInk = {
  available: nativeInkAvailable,

  mount(element) {
    if (!element) return false;
    cachedStrokes = [];
    return post({ op: 'mount', ...geometryOf(element), ink: inkColor() });
  },

  layout(element) {
    if (!element) return;
    post({ op: 'layout', ...geometryOf(element) });
  },

  unmount() {
    cachedStrokes = [];
    post({ op: 'unmount' });
  },

  setAppearance() { post({ op: 'appearance', ink: inkColor() }); },

  setTool(tool, finger) { post({ op: 'tool', tool, finger: !!finger }); },

  setEnabled(enabled) { post({ op: 'enabled', enabled: !!enabled }); },

  undo() { post({ op: 'undo' }); },
  redo() { post({ op: 'redo' }); },
  clear() { post({ op: 'clear' }); },

  setStrokes(strokes) {
    cachedStrokes = Array.isArray(strokes) ? strokes.slice() : [];
    post({ op: 'setStrokes', strokes: cachedStrokes });
  },

  onStrokes(listener) {
    strokeListeners.add(listener);
    return () => strokeListeners.delete(listener);
  },

  /**
   * Ask the shell to read what is written. Resolves with the same shape the
   * web engine returns, plus `unread` on any line Vision produced nothing for
   * — the caller reads those with the web engine instead, so a step is never
   * lost just because one line was too short to read as text.
   */
  recognize(overrides = {}) {
    return new Promise((resolve) => {
      const reqId = nextRequestId++;
      pending.set(reqId, resolve);
      if (!post({ op: 'recognize', reqId, overrides })) {
        pending.delete(reqId);
        resolve(null);
        return;
      }
      // A reply that never comes must not leave the reading panel waiting on
      // it for the rest of the session.
      setTimeout(() => {
        if (pending.has(reqId)) { pending.delete(reqId); resolve(null); }
      }, 6000);
    });
  }
};
