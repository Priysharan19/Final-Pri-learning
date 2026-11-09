// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Native ink bridge (web side)
//
// PencilKit owns the low-latency writing surface; this module keeps it told
// where the writing area is and receives the strokes it captures. It does NOT
// ask the shell to read anything: handwriting is read only by the server
// (client/src/ink/cloudReader.js), from a picture the page draws of these very
// strokes, when the student presses "Read my answer" (owner decision
// 2026-10-02, default D16 2026-11-01). The on-device readers the shell once
// exposed (foundationRecognize, recognize) are gone from both sides of the
// bridge, and client/test/native-ink-check.mjs keeps the two sides equal.
// ─────────────────────────────────────────────────────────────────────────────
import { priNative } from '../platform/native/index.js';

// The writing surface is a platform capability (CP-02): priNative decides which
// transport carries it. This module keeps the ink-specific semantics: geometry
// and immutable stroke snapshots.
export const nativeInkAvailable = () => priNative.ink.available();

const strokeListeners = new Set();
let latestStrokes = [];

export function snapshotInkStrokes(strokes) {
  return (Array.isArray(strokes) ? strokes : []).map(stroke => ({
    ...stroke,
    points: (Array.isArray(stroke?.points) ? stroke.points : []).map(point => ({ ...point }))
  }));
}

function receiveInk(payload) {
  if (!payload || typeof payload !== 'object') return;
  if (payload.type === 'strokes') {
    // JSON messages are immutable snapshots from the native bridge. Replace
    // the top-level array on every pen-up instead of mutating it in place, so
    // a caller may retain this exact snapshot by reference (the picture the
    // server reads is drawn from it) without another deep clone.
    latestStrokes = Array.isArray(payload.strokes) ? payload.strokes : [];
    for (const listener of strokeListeners) listener(latestStrokes);
  }
}

if (typeof window !== 'undefined') priNative.ink.onMessage(receiveInk);

const post = message => priNative.ink.post(message);

/**
 * A modal dialog is open on the page and the writing area is not inside it.
 * The native PencilKit surface sits ABOVE the web view, so a dialog the page
 * draws (the D17 permission prompt, the question peek) would sit under the
 * student's ink and, with finger drawing on, under their finger too. While one
 * is open the surface is clipped away (OFFSCREEN_CLIP) and the dialog is what
 * the student sees and touches; the strokes are kept and come back with it.
 */
export function modalCoversInk(element, doc = typeof document === 'undefined' ? null : document) {
  const modal = doc?.querySelector?.('[aria-modal="true"]');
  if (!modal) return false;
  return !(element?.closest?.('[aria-modal="true"]'));
}

// A 1×1 clip outside the view. Not an empty rect: the shell reads an empty
// clip as "the whole view" (InkBridge.placement).
export const OFFSCREEN_CLIP = Object.freeze({ x: -2, y: -2, w: 1, h: 1 });

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
    clip: modalCoversInk(element) ? { ...OFFSCREEN_CLIP } : { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) },
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
    // External callers may retain/mutate their array. Snapshot once at the API
    // boundary; the bridge-owned snapshot is what listeners receive.
    latestStrokes = snapshotInkStrokes(strokes);
    post({ op: 'setStrokes', strokes: latestStrokes });
  },

  /** The strokes the shell last reported, by reference (immutable). */
  strokes() { return latestStrokes; },

  onStrokes(listener) {
    strokeListeners.add(listener);
    return () => strokeListeners.delete(listener);
  }
};
