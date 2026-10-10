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
const SESSION_CLASS = 'pri-ink-session';
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

function syncSessionClass() {
  const open = inkSessionOpen();
  const r = root();
  if (!r) return open;
  if (open) {
    r.classList.add(SESSION_CLASS);
    // Not while the student is typing in a real field (see typingInTextEntry):
    // every keystroke re-renders, and each render would take the caret away.
    if (!(activePointer === null && typeof Element !== 'undefined' && document.activeElement instanceof Element &&
        document.activeElement.closest('input, textarea, select, [contenteditable="true"]') && !document.activeElement.closest('.ink-wrap'))) clearSelection();
  } else {
    r.classList.remove(SESSION_CLASS);
  }
  return open;
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

// A real text-entry control: the line-correction field under the page, the
// sign-in form opened beside the work, the typed working. The invariant above
// says these stay editable, and the stylesheet below already says so — but in
// WebKit a caret IS a selection: cancelling `selectstart` on the field, or
// clearing the document's ranges while it has focus, leaves it focused and
// unable to take a single character (keydown arrives, no input follows). So
// outside an actual pen stroke the guard leaves a focused text field alone.
const TEXT_ENTRY = 'input, textarea, select, [contenteditable="true"]';
const isTextEntry = (target) =>
  typeof Element !== 'undefined' && target instanceof Element && Boolean(target.closest(TEXT_ENTRY)) && !target.closest('.ink-wrap');
const typingInTextEntry = () => activePointer === null && isTextEntry(document.activeElement);

function suppressSelectionGesture(event) {
  if (activePointer === null && !syncSessionClass()) return;
  if (activePointer === null && (isTextEntry(event.target) || (event.type === 'selectstart' && typingInTextEntry()))) return;
  if (event.cancelable) event.preventDefault();
  clearSelection();
}

function clearSelectionDuringInkSession() {
  if (typingInTextEntry()) return;
  if (activePointer !== null || syncSessionClass()) clearSelection();
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

// Do not make the full-session invariant depend on :has() or on PointerEvent
// identity. A MutationObserver maintains SESSION_CLASS whenever React mounts or
// unmounts InkAnswer. The CSS therefore reduces to a plain class selector that
// WebKit has supported for its entire lifetime.
const style = document.createElement('style');
style.id = 'pri-ink-pointer-guard';
style.textContent = `
html.${ACTIVE_CLASS}, html.${ACTIVE_CLASS} *,
html.${SESSION_CLASS}, html.${SESSION_CLASS} #root,
html.${SESSION_CLASS} #root * {
  -webkit-user-select: none !important;
  user-select: none !important;
  -webkit-touch-callout: none !important;
  -webkit-user-drag: none !important;
}
html.${SESSION_CLASS} input,
html.${SESSION_CLASS} textarea,
html.${SESSION_CLASS} [contenteditable="true"] {
  -webkit-user-select: text !important;
  user-select: text !important;
  -webkit-touch-callout: default !important;
}
.ink-wrap, .ink-stage, .ink-answer, .ink-toolbar, .ink-toolbar *, .ink-preview, .ink-preview * {
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}
.ink-hint {
  pointer-events: none !important;
}
`;
if (!document.getElementById(style.id)) document.head.appendChild(style);

// React mounts after this module executes. Observe the existing document root so
// the session class turns on immediately when .ink-answer appears and turns off
// when the user leaves handwriting mode.
syncSessionClass();
if (typeof MutationObserver !== 'undefined') {
  const sessionObserver = new MutationObserver(syncSessionClass);
  sessionObserver.observe(document.documentElement, { childList: true, subtree: true });
}

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
  sessionClass: SESSION_CLASS,
  releaseGraceMs: RELEASE_GRACE_MS,
  inkSessionOpen,
  syncSessionClass
});
