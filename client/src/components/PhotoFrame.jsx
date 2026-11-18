// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the photo-answer frame
//
// One calm flow for a photographed answer, from nothing chosen to a page the
// student can see: an empty frame with one sentence and the ways in (camera
// first on a phone), a large preview of the page with labelled controls
// (enlarge, rotate, choose another, remove), and a failure that stays in the
// same frame with the reason and the two ways forward.
//
// Presentational. The card owns the files, the reading and the state; every
// control here is a real button with a name (no bare ✕).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';

/** The frame with nothing chosen yet. */
export function PhotoEmpty({ t, touch, dragging, onChoose, onCapture }) {
  return (
    <div className={`pf-empty${dragging ? ' is-dragging' : ''}`} data-photo-empty data-dragging={dragging ? 'true' : undefined}>
      <p className="pf-lead">{dragging ? t('photo.dropActive') : t('photo.empty.lead')}</p>
      <div className="pf-actions">
        {touch && <button type="button" className="btn btn-primary" data-photo-camera onClick={onCapture}>{t('photo.take')}</button>}
        <button type="button" className={`btn ${touch ? 'btn-ghost' : 'btn-primary'} photo-pick`} data-photo-choose onClick={onChoose}>{t('photo.choose')}</button>
      </div>
      {!touch && <p className="pf-hint muted">{t('photo.dropHint')}</p>}
    </div>
  );
}

/** A converting / opening state with a proper frame, not a blank box. */
export function PhotoBusy({ t, kind }) {
  return (
    <div className="pf-busy" role="status" aria-live="polite" data-photo-intake={kind}>
      <span className="pf-spin" aria-hidden="true" />
      <span>{t(kind === 'converting' ? 'photo.converting' : 'photo.opening')}</span>
    </div>
  );
}

/** Enlarged page, a plain dialog the student can close with Escape or the button. */
export function PhotoLightbox({ t, src, onClose }) {
  const close = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    close.current?.focus();
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); try { before?.focus?.(); } catch { /* gone */ } };
  }, [onClose]);
  return (
    <div className="pf-lightbox" role="dialog" aria-modal="true" aria-label={t('photo.view')} data-photo-lightbox>
      <button type="button" className="pf-lightbox-scrim" tabIndex={-1} aria-hidden="true" onClick={onClose} />
      <div className="pf-lightbox-body">
        <img src={src} alt={t('history.paperWorking')} />
        <button type="button" ref={close} className="btn btn-primary" onClick={onClose}>{t('nav.close')}</button>
      </div>
    </div>
  );
}

/**
 * The student's own page, large enough to recognise, with its controls.
 * `canRotate` is false once a reading exists, because a rotated page is a new page.
 */
export function PhotoPreview({ t, src, canRotate, canChange, busy, onRotate, onReplace, onRemove, removeLabel }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pf-preview">
      <button type="button" className="pf-page photo-thumb" data-photo-thumb disabled={!src}
        aria-label={t('photo.view')} onClick={() => src && setOpen(true)}>
        {src ? <img src={src} alt={t('history.paperWorking')} /> : <span className="pf-page-pdf" aria-hidden="true">{t('photo.pdfBadge')}</span>}
        {src && <span className="pf-page-zoom" aria-hidden="true">{t('photo.enlarge')}</span>}
      </button>
      {canChange && (
        <div className="pf-tools" role="group" aria-label={t('photo.frameLabel')}>
          {canRotate && src && <button type="button" className="btn btn-quiet btn-sm" data-photo-rotate disabled={busy} onClick={onRotate}>{t('photo.rotate')}</button>}
          <button type="button" className="btn btn-quiet btn-sm" data-photo-replace disabled={busy} onClick={onReplace}>{t('photo.replace')}</button>
          <button type="button" className="btn btn-quiet btn-sm" data-photo-remove aria-label={removeLabel} onClick={onRemove}>{t('photo.remove')}</button>
        </div>
      )}
      {open && src && <PhotoLightbox t={t} src={src} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** A failure with the reason and the two ways forward, inside the frame. */
export function PhotoFailure({ t, children, onChooseAnother, onType, reasonAttr }) {
  return (
    <div className="pf-failed" data-photo-failed>
      <p className="pf-reason" role="alert" data-photo-reading-problem={reasonAttr}>{children}</p>
      <div className="pf-actions">
        {onChooseAnother && <button type="button" className="btn btn-primary" data-photo-choose-another onClick={onChooseAnother}>{t('photo.chooseAnother')}</button>}
        {onType && <button type="button" className="btn btn-ghost" data-type-instead onClick={onType}>{t('verdict.typeInstead')}</button>}
      </div>
    </div>
  );
}

/** Rotate a JPEG/PNG data URL a quarter turn clockwise. */
export async function rotateDataUrl(dataUrl) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('rotate'));
    el.src = dataUrl;
  });
  const cv = document.createElement('canvas');
  cv.width = img.naturalHeight; cv.height = img.naturalWidth;
  const ctx = cv.getContext('2d');
  // A quarter turn clockwise: (x, y) -> (height - y, x).
  ctx.setTransform(0, 1, -1, 0, img.naturalHeight, 0);
  ctx.drawImage(img, 0, 0);
  return cv.toDataURL('image/jpeg', 0.88);
}
