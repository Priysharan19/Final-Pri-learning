// The exam shell's sheets (F4 §1.1): one dialog for "are you sure" in both
// modes, with different words. Focus goes to the first button (the one that
// changes nothing), Tab stays inside, Esc and the scrim close it, and focus
// returns to whatever opened it.
//
// The dialog itself can hold the focus (a click on its text keeps Esc and Tab
// working).
//
//   <ConfirmSheet open title confirmLabel cancelLabel onConfirm onCancel busy>…facts…</ConfirmSheet>
//   <Sheet open title onClose closeLabel>…</Sheet>          (ShortcutsSheet uses this)
import React, { useEffect, useId, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])';

export function Sheet({ open, title, onClose, closeLabel, children, actions = null, testId = null }) {
  const id = useId();
  const ref = useRef(null);
  const opener = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement;
    ref.current?.querySelector(FOCUSABLE)?.focus();
    return () => {
      // Back to whatever opened it; if that has gone (the paper was closed), to the page's main region.
      const back = opener.current?.isConnected ? opener.current : document.querySelector('main, [role="main"]');
      try { back?.focus?.(); } catch { /* nothing to return to */ }
    };
  }, [open]);
  if (!open) return null;
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const items = [...(ref.current?.querySelectorAll(FOCUSABLE) || [])];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <>
      <button type="button" className="sheet-scrim" tabIndex={-1} aria-label={closeLabel} onClick={onClose} />
      <div className="sheet xs-sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1} onKeyDown={onKeyDown} data-testid={testId || undefined}>
        <h2 id={id}>{title}</h2>
        {children}
        <div className="sheet-actions">{actions || <button type="button" className="btn btn-ghost" onClick={onClose}>{closeLabel}</button>}</div>
      </div>
    </>
  );
}

export default function ConfirmSheet({ open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel, busy = false, testId = null }) {
  return (
    <Sheet open={open} title={title} onClose={onCancel} closeLabel={cancelLabel} testId={testId} actions={(
      <>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy} data-sheet-confirm>{confirmLabel}</button>
      </>
    )}>
      {children}
    </Sheet>
  );
}
