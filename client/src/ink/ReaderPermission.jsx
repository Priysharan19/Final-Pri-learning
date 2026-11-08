// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the one-time prompt before anything is read (D17)
//
// Mounted once in the app shell (App.jsx). It registers itself as the prompt
// readerPermission.js asks with, and shows a sheet — a bottom sheet on a
// phone, a dialog on a tablet or a computer (.sheet in theme.css) — the first
// time a student presses "Read my answer", attaches a photo of their working,
// or photographs a question to practise.
//
// Nothing is sent while it is open. "Send it to be read" lets this read and
// every later one go ahead. "No, I'll type" keeps the student on typed
// answers: server reading is turned off in Settings → Handwriting, where they
// can turn it on again (and are then asked again before the next read).
// Closing it any other way (Escape, the backdrop) chooses nothing and sends
// nothing.
//
// The words are in the catalogue under readerPermission.* and are pending
// counsel (D17). Change them there; bump READER_PERMISSION_VERSION when the
// change alters what the student is agreeing to.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { PROMPT_ANSWER, setReaderPermissionPrompt } from './readerPermission.js';

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export default function ReaderPermissionHost() {
  const t = useT();
  const { user, setUser } = useApp() || {};
  const userRef = useRef(user);
  userRef.current = user;
  // The kind being asked about while the sheet is open; the promise's
  // resolver is kept beside it, outside React state.
  const [open, setOpen] = useState(null);
  const resolveRef = useRef(null);
  const sheetRef = useRef(null);
  const returnFocus = useRef(null);

  useEffect(() => {
    const stop = setReaderPermissionPrompt(({ kind }) => new Promise(resolve => {
      resolveRef.current?.(PROMPT_ANSWER.DISMISSED);
      resolveRef.current = resolve;
      returnFocus.current = typeof document !== 'undefined' ? document.activeElement : null;
      setOpen({ kind });
    }));
    // A sheet still open when the shell goes away answers nothing.
    return () => { stop(); resolveRef.current?.(PROMPT_ANSWER.DISMISSED); resolveRef.current = null; };
  }, []);

  const answer = useCallback((value) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOpen(null);
    resolve?.(value);
    try { returnFocus.current?.focus?.({ preventScroll: true }); } catch { /* the element is gone */ }
    if (value !== PROMPT_ANSWER.DECLINED) return;
    // Declining is the same as turning server reading off in Settings, so
    // every screen says the same thing afterwards and the way back is the
    // Settings switch. If this write fails the decline still stands: the
    // next read asks again rather than sending.
    api.patch('/me', { cloudHandwriting: false })
      .then(r => { if (r?.user && String(r.user.id) === String(userRef.current?.id)) setUser?.(r.user); })
      .catch(() => { /* the recorded decline already stops reading */ });
  }, [setUser]);

  useEffect(() => {
    if (!open) return undefined;
    const sheet = sheetRef.current;
    sheet?.querySelector?.('[data-reader-permission-title]')?.focus?.({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); answer(PROMPT_ANSWER.DISMISSED); return; }
      if (e.key !== 'Tab' || !sheet) return;
      const items = [...sheet.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, answer]);

  if (!open) return null;
  const lead = open.kind === 'question-photo' ? 'readerPermission.leadQuestionPhoto'
    : open.kind === 'photo' ? 'readerPermission.leadPhoto' : 'readerPermission.leadInk';
  return (
    <>
      <button type="button" className="sheet-scrim" aria-label={t('readerPermission.close')} tabIndex={-1}
        onClick={() => answer(PROMPT_ANSWER.DISMISSED)} data-reader-permission="dismiss" />
      <div className="sheet reader-permission" role="dialog" aria-modal="true" ref={sheetRef}
        aria-labelledby="reader-permission-title" aria-describedby="reader-permission-body"
        data-reader-permission-sheet={open.kind}>
        <h2 id="reader-permission-title" tabIndex={-1} data-reader-permission-title>{t('readerPermission.title')}</h2>
        <div id="reader-permission-body">
          <p>{t(lead)}</p>
          <p>{t('readerPermission.what')}</p>
          <p>{t('readerPermission.keep')}</p>
          <p>{t('readerPermission.marks')}</p>
          <p className="muted">{t('readerPermission.choice')}</p>
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn btn-quiet" data-reader-permission="decline"
            onClick={() => answer(PROMPT_ANSWER.DECLINED)}>{t('readerPermission.decline')}</button>
          <button type="button" className="btn btn-primary" data-reader-permission="accept"
            onClick={() => answer(PROMPT_ANSWER.ACCEPTED)}>{t('readerPermission.accept')}</button>
        </div>
      </div>
    </>
  );
}
