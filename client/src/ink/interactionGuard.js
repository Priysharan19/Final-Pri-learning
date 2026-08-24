// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · browser Pencil interaction guard
//
// Physical iPad testing showed that relying on one particular PointerEvent
// sequence is not strong enough: Safari can begin text selection/callout while
// a fast Apple Pencil stroke is still logically inside the writing experience.
//
// Product invariant:
//   while the handwriting editor is present, the learning surface is not a text
//   selection surface. Finger scrolling still works; real text-entry controls
//   remain selectable/editable. During an actual pen pointer sequence we also
//   retain the document-capture guard so a stroke that outruns the canvas cannot
//   turn into drag/selection behaviour outside it.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVE_CLASS = 'pri-ink-pointer-active';
const RELEASE_GRACE_MS = 220;
let activePointer = null;
let releaseTimer = null;

const root = () => document.documentElement;
const isInkTarget = (target) =>
  target instanceof Element && Boolean(target.closest('.ink-wrap'));
const inkSessionOpen = () => Boolean(document.querySelector?.('.ink-answer'));

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
  // WebKit can dispatch selectstart/selectionchange after pointerup. Keep the
  // pointer guard alive briefly; the session-level rule remains active for as
  // long as the handwriting editor itself is mounted.
  releaseTimer = setTimeout(() => {
    root()?.classList.remove(ACTIVE_CLASS);
    releaseTimer = null;
    clearSelection();
  }, RELEASE_GRACE_MS);
}

function armInkPointer(event) {
  if (!isInkTarget(event.target)) return;
  // Apple Pencil should report pointerType=pen, but session-level protection no
  // longer depends on that being reliable. Mouse remains useful for desktop
  // testing. Touch is left to InkCanvas so finger scrolling/drawing policy is
  // not changed by this document guard.
  if (event.pointerType === 'touch') return;
  activePointer = event.pointerId;
  addActiveClass();
  clearSelection();
  if (event.cancelable) event.preventDefault();
}

function suppressPointerGesture(event) {
  if (activePointer === null) return;
  if (event.cancelable) event.preventDefault();
  clearSelection();
}

function suppressSelectionGesture(event) {
  if (activePointer === null && !inkSessionOpen()) return;
  if (event.cancelable) event.preventDefault();
  clearSelection();
}

function clearSelectionDuringInkSession() {
  if (activePointer !== null || inkSessionOpen()) clearSelection();
}

function releaseInkPointer(event) {
  if (activePointer === null || event.pointerId !== activePointer) return;
  suppressPointerGesture(event);
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

// The :has(.ink-answer) rule is intentional. It removes the race entirely: the
// page is non-selectable for the whole handwriting session, even if Safari does
// not deliver the PointerEvent shape we expected. Inputs/contenteditable are
// explicitly exempt so accessibility text entry still behaves normally.
const style = document.createElement('style');
style.id = 'pri-ink-pointer-guard';
style.textContent = `
html.${ACTIVE_CLASS}, html.${ACTIVE_CLASS} *,
html:has(.ink-answer), html:has(.ink-answer) #root,
html:has(.ink-answer) #root * {
  -webkit-user-select: none !important;
  user-select: none !important;
  -webkit-touch-callout: none !important;
  -webkit-user-drag: none !important;
}
html:has(.ink-answer) input,
html:has(.ink-answer) textarea,
html:has(.ink-answer) [contenteditable="true"] {
  -webkit-user-select: text !important;
  user-select: text !important;
  -webkit-touch-callout: default !important;
}
.ink-wrap, .ink-stage, .ink-answer {
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}
`;
if (!document.getElementById(style.id)) document.head.appendChild(style);

document.addEventListener('pointerdown', armInkPointer, { capture: true, passive: false });
document.addEventListener('pointermove', suppressPointerGesture, { capture: true, passive: false });
document.addEventListener('pointerup', releaseInkPointer, { capture: true, passive: false });
document.addEventListener('pointercancel', releaseInkPointer, { capture: true, passive: false });
document.addEventListener('selectstart', suppressSelectionGesture, { capture: true, passive: false });
document.addEventListener('dragstart', suppressSelectionGesture, { capture: true, passive: false });
document.addEventListener('contextmenu', suppressSelectionGesture, { capture: true, passive: false });
document.addEventListener('selectionchange', clearSelectionDuringInkSession, { capture: true });
window.addEventListener('blur', hardRelease);
window.addEventListener('pagehide', hardRelease);

export const __interactionGuardContract = Object.freeze({
  activeClass: ACTIVE_CLASS,
  releaseGraceMs: RELEASE_GRACE_MS,
  inkSessionOpen
});
