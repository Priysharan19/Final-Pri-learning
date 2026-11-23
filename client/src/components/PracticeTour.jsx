// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the first-run tour of Practice
//
// Four small notes, one at a time, each anchored beside the real control it
// describes. Not a modal: nothing is dimmed, the page stays usable, and the
// note itself lets pointer events through everywhere but its two buttons.
// Escape or Skip closes it; focus moves to the note and returns to the control
// afterwards. A step whose control is not on the page is left out.
// ─────────────────────────────────────────────────────────────────────────────
import { createPortal } from 'react-dom';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.js';
import { TOUR_STEPS, TOUR_EDGE as EDGE, tourNoteTop, tourNotePlace } from '../lib/firstRunTour.js';

// The tour never scrolls the page: a control that is not on screen when it starts is left out.
// With a Text size chosen the controls sit lower on the page (the content is zoomed), so a note is not left out for being
// below the fold: its control is scrolled into view when its turn comes (place, below). At Standard nothing scrolls.
const zoomed = () => document.documentElement.hasAttribute('data-text-size');
const inView = s => {
  const el = document.querySelector(s.anchor);
  if (!el) return false;
  if (zoomed()) return el.getClientRects().length > 0;
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
};

// The note is never above a sheet, scrim, menu or dialog: while one is open it is hidden (and its step is kept).
const OVERLAYS = '[role="dialog"]:not(.pr-tour), [aria-modal="true"], .in-hintsheet, .in-hintsheet-scrim, .mnav-sheet, .mnav-sheet-scrim, .in-more-menu, [role="menu"], .pri-explain-backdrop, .drawer, .paper-overlay, [data-question-report]';
const overlayOpen = () => [...document.querySelectorAll(OVERLAYS)].some(e => e.getClientRects().length > 0 && !e.closest('.pr-tour'));

export default function PracticeTour({ onClose }) {
  const t = useT();
  const [at, setAt] = useState(0);
  const [steps, setSteps] = useState(() => TOUR_STEPS.filter(inView));
  const [box, setBox] = useState(null);
  const noteRef = useRef(null);
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    let raf = 0;
    const look = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setCovered(overlayOpen())); };
    look();
    const mo = new MutationObserver(look);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-expanded', 'hidden', 'open', 'style'] });
    return () => { cancelAnimationFrame(raf); mo.disconnect(); };
  }, []);
  const step = steps[at];

  // The controls may arrive a moment after the first paint (the question loads).
  useEffect(() => {
    const live = TOUR_STEPS.filter(inView);
    if (live.length !== steps.length) setSteps(live);
    if (!live.length) onClose(false);   // nothing to point at: close without recording it as seen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const place = useCallback(() => {
    const el = step && document.querySelector(step.anchor);
    const note = noteRef.current;
    if (!el || !note) return;
    let r = el.getBoundingClientRect();
    if (zoomed() && (r.bottom <= 0 || r.top >= window.innerHeight - EDGE)) { el.scrollIntoView({ block: 'center' }); r = el.getBoundingClientRect(); }
    // The wide-screen gutter note stays wholly left of the dot-point picker and the question (it used to overlap their left
    // edge at 1280); when the margin is too narrow for it, it sits under the question text like a narrow screen's.
    const column = step.gutter && window.innerWidth >= 900 ? document.querySelector('[data-dotpoint-picker], .q-prompt') : null;
    const room = column ? column.getBoundingClientRect().left - EDGE - 12 : 0;
    const inGutter = !!column && room >= 180;
    const w = inGutter ? Math.min(236, room) : Math.min(320, window.innerWidth - 2 * EDGE);
    const h = note.offsetHeight;
    const left = inGutter ? EDGE : Math.max(EDGE, Math.min(r.left, window.innerWidth - w - EDGE));
    // Narrow screens: under the question text, never over it (and clear of the action bar). On a short window the note
    // covers the hint ladder before it covers the prompt, and it is always wholly on screen and below the header.
    const avoid = step.avoid && !inGutter && document.querySelector(step.avoid);
    const header = document.querySelector('[data-instrument-bar]');
    const top = tourNoteTop({
      anchor: r, side: step.side, h, vh: window.innerHeight,
      minTop: header ? Math.max(0, header.getBoundingClientRect().bottom) : 0,
      avoid: avoid ? avoid.getBoundingClientRect() : null
    });
    // Never over the question or the dot-point picker: the usual place first, then every side of the control (see tourNotePlace).
    // Obstacles: the question, the picker and the bars that sit over the page (a sticky bar is not one when it holds the control).
    const avoids = ['.q-prompt', '[data-dotpoint-picker]', '.ws-actions', '.ws-bar', '.mobilenav'].map(sel => document.querySelector(sel))
      .filter(e => e && e.getClientRects().length && !e.contains(el)).map(e => e.getBoundingClientRect());
    const at = tourNotePlace({
      anchor: r, w, h, vw: window.innerWidth, vh: window.innerHeight, avoids, usual: { left, top },
      minTop: header ? Math.max(0, header.getBoundingClientRect().bottom) : 0
    });
    setBox({ left: at.left, top: at.top, width: w });
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return undefined;
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

  // Escape closes the tour only when focus is in the note, or nothing else is
  // open; it is never stopped, so the report form or any other overlay still closes.
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return;
      const inNote = noteRef.current?.contains(document.activeElement);
      const otherOpen = document.querySelector('[data-question-report], [role="dialog"], [aria-modal="true"]');
      if (inNote || !otherOpen) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  if (!step) return null;
  const last = at === steps.length - 1;
  // Rendered on <body>, outside the page content: Text size zooms the content, and a fixed note inside it would be
  // offset and clamped in the wrong units. Its anchor is found by selector, and focus moves to it at each step.
  return createPortal(
    <div ref={noteRef} className="pr-tour" role="group" tabIndex={-1} data-practice-tour={step.id}
      aria-label={t('tour.label')} style={box && !covered ? { left: box.left, top: box.top, width: box.width } : { ...(box || {}), visibility: 'hidden', pointerEvents: 'none' }}>
      <p className="pr-tour-step muted">{t('tour.stepOf', { n: at + 1, total: steps.length })}</p>
      <p className="pr-tour-text">{t(step.key)}</p>
      <div className="pr-tour-actions">
        <button type="button" className="btn btn-quiet btn-sm" data-tour-skip onClick={() => close()}>{t('tour.skip')}</button>
        <button type="button" className="btn btn-primary btn-sm" data-tour-next
          onClick={() => (last ? close() : setAt(at + 1))}>{t(last ? 'tour.done' : 'tour.next')}</button>
      </div>
    </div>,
    document.body
  );
}
