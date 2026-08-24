// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · browser Pencil interaction guard
//
// iPad Safari can begin native text selection when a fast Apple Pencil stroke
// outruns the canvas hit target or when WebKit drops pointer capture for a frame.
// The canvas already uses touch-action:none and preventDefault(), but those only
// protect the canvas node itself. During an active Pencil stroke we therefore
// suppress selection/drag gestures at document capture phase as well. The guard
// is deliberately armed only for pen/mouse input that STARTS in the ink surface
// so normal finger scrolling and text selection elsewhere in the app stay alive.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVE_CLASS = 'pri-ink-pointer-active';
const RELEASE_GRACE_MS = 180;
let activePointer = null;
let releaseTimer = null;

const root = () => document.documentElement;
const isInkTarget = (target) =>
  target instanceof Element && Boolean(target.closest('.ink-wrap'));

function clearSelection() {
  try { window.getSelection?.()?.removeAllRanges?.(); } catch { /* best effort */ }
}

function addActiveClass() {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  root()?.classList.add(ACTIVE_CLASS);
}

function removeActiveClassSoon() {
  if (releaseTimer) clearTimeout(releaseTimer);
  // WebKit can dispatch selectstart just after pointerup. Keep the guard for a
  // tiny grace window so a fast stroke cannot turn into a highlighted paragraph.
  releaseTimer = setTimeout(() => {
    root()?.classList.remove(ACTIVE_CLASS);
    releaseTimer = null;
    clearSelection();
  }, RELEASE_GRACE_MS);
}

function armInkPointer(event) {
  if (!isInkTarget(event.target)) return;
  // Pencil is pointerType=pen in Safari. Mouse is retained for desktop testing.
  // Finger gestures are intentionally not captured here: InkCanvas owns its
  // explicit finger-drawing policy and normal touch scrolling must remain usable.
  if (event.pointerType === 'touch') return;
  activePointer = event.pointerId;
  addActiveClass();
  clearSelection();
  if (event.cancelable) event.preventDefault();
}

function suppressNativeGesture(event) {
  if (activePointer === null) return;
  if (event.cancelable) event.preventDefault();
  clearSelection();
}

function releaseInkPointer(event) {
  if (activePointer === null || event.pointerId !== activePointer) return;
  suppressNativeGesture(event);
  activePointer = null;
  removeActiveClassSoon();
}

function hardRelease() {
  activePointer = null;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
  root()?.classList.remove(ACTIVE_CLASS);
  clearSelection();
}

// Do not depend on theme.css for the active-stroke invariant. The injected rule
// is loaded with the guard itself, so a chunk/CSS refactor cannot silently bring
// native text selection back while the pen is down.
const style = document.createElement('style');
style.id = 'pri-ink-pointer-guard';
style.textContent = `
html.${ACTIVE_CLASS}, html.${ACTIVE_CLASS} * {
  -webkit-user-select: none !important;
  user-select: none !important;
  -webkit-touch-callout: none !important;
}
.ink-wrap, .ink-stage, .ink-answer {
  -webkit-touch-callout: none;
}
`;
if (!document.getElementById(style.id)) document.head.appendChild(style);

document.addEventListener('pointerdown', armInkPointer, { capture: true, passive: false });
document.addEventListener('pointermove', suppressNativeGesture, { capture: true, passive: false });
document.addEventListener('pointerup', releaseInkPointer, { capture: true, passive: false });
document.addEventListener('pointercancel', releaseInkPointer, { capture: true, passive: false });
document.addEventListener('selectstart', suppressNativeGesture, { capture: true, passive: false });
document.addEventListener('dragstart', suppressNativeGesture, { capture: true, passive: false });
window.addEventListener('blur', hardRelease);
window.addEventListener('pagehide', hardRelease);

export const __interactionGuardContract = Object.freeze({
  activeClass: ACTIVE_CLASS,
  releaseGraceMs: RELEASE_GRACE_MS
});
