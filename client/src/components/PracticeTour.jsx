// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the first-run tour of Practice
//
// Four small notes, one at a time, each anchored beside the real control it
// describes. Not a modal: nothing is dimmed, the page stays usable, and the
// note itself lets pointer events through everywhere but its two buttons.
// Escape or Skip closes it; focus moves to the note and returns to the control
// afterwards. A step whose control is not on the page is left out.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.js';
import { TOUR_STEPS } from '../lib/firstRunTour.js';

const GAP = 8;
const EDGE = 16;

export default function PracticeTour({ onClose }) {
  const t = useT();
  const [at, setAt] = useState(0);
  const [steps, setSteps] = useState(() => TOUR_STEPS.filter(s => document.querySelector(s.anchor)));
  const [box, setBox] = useState(null);
  const noteRef = useRef(null);
  const step = steps[at];

  // The controls may arrive a moment after the first paint (the question loads).
  useEffect(() => {
    const live = TOUR_STEPS.filter(s => document.querySelector(s.anchor));
    if (live.length !== steps.length) setSteps(live);
    if (!live.length) onClose(false);   // nothing to point at: close without recording it as seen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const place = useCallback(() => {
    const el = step && document.querySelector(step.anchor);
    const note = noteRef.current;
    if (!el || !note) return;
    const r = el.getBoundingClientRect();
    const w = step.gutter && window.innerWidth >= 900 ? 236 : Math.min(320, window.innerWidth - 2 * EDGE);
    const h = note.offsetHeight;
    const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - w - EDGE));
    let top = step.side === 'above' ? r.top - h - GAP : r.bottom + GAP;
    if (top < EDGE) top = r.bottom + GAP;
    if (top + h > window.innerHeight - EDGE) top = Math.max(EDGE, r.top - h - GAP);
    setBox({ left, top, width: w });
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return undefined;
    document.querySelector(step.anchor)?.scrollIntoView?.({ block: 'nearest' });
    place();
    let raf = 0;
    const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', again); window.removeEventListener('scroll', again, true); };
  }, [step, place]);

  // Focus moves to the note at each step.
  useEffect(() => { noteRef.current?.focus({ preventScroll: true }); }, [at]);

  // Finishing, Skip and Escape all mean the student has seen it.
  const close = useCallback(() => {
    const back = step && document.querySelector(step.anchor);
    onClose(true);
    // After the note is gone, focus returns to the control it was describing.
    setTimeout(() => back?.focus?.({ preventScroll: true }), 0);
  }, [onClose, step]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [close]);

  if (!step) return null;
  const last = at === steps.length - 1;
  return (
    <div ref={noteRef} className="pr-tour" role="group" tabIndex={-1} data-practice-tour={step.id}
      aria-label={t('tour.label')} style={box ? { left: box.left, top: box.top, width: box.width } : { visibility: 'hidden' }}>
      <p className="pr-tour-step muted">{t('tour.stepOf', { n: at + 1, total: steps.length })}</p>
      <p className="pr-tour-text">{t(step.key)}</p>
      <div className="pr-tour-actions">
        <button type="button" className="btn btn-quiet btn-sm" data-tour-skip onClick={() => close()}>{t('tour.skip')}</button>
        <button type="button" className="btn btn-primary btn-sm" data-tour-next
          onClick={() => (last ? close() : setAt(at + 1))}>{t(last ? 'tour.done' : 'tour.next')}</button>
      </div>
    </div>
  );
}
