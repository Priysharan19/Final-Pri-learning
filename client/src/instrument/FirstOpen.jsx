import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { markFirstOpenSeen } from './firstOpenSeen.js';
import { useT } from '../i18n/index.js';

// The first-open moment (instrument build only, shown once, before sign-in):
// the bezel engraves, the P′ mark writes itself, one line fades in, then a
// small pad asks for any digit. The pad does NOT read the digit: the
// handwriting reader is a large module that needs a signed-in profile and, for
// checking, a connection, so loading it before sign-in is not cheap. The pad
// only acknowledges the ink, and says so. Nothing here is recognition.
// Under Reduce Motion the final frame is drawn at once; nothing moves.


function Pad({ onInk, cleared, label }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
    const ctx = c.getContext('2d');
    if (ctx) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, c.clientWidth, c.clientHeight); }
  }, [cleared]);
  const at = e => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = e => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ref.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    ctx.strokeStyle = getComputedStyle(ref.current).getPropertyValue('--c-pen').trim() || '#1f2a44';
    ctx.lineWidth = e.pointerType === 'pen' ? 2 + 2 * (e.pressure || 0.5) : 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const [x, y] = at(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.01, y); ctx.stroke();
  };
  const move = e => {
    if (!drawing.current) return;
    const ctx = ref.current.getContext('2d');
    const [x, y] = at(e); ctx.lineTo(x, y); ctx.stroke();
  };
  const up = () => { if (drawing.current) { drawing.current = false; onInk(); } };
  return <canvas ref={ref} className="fo-pad" role="img" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />;
}

export default function FirstOpen({ onDone }) {
  const t = useT();
  const [inked, setInked] = useState(false);
  const [cleared, setCleared] = useState(0);
  const go = useRef(null);
  const root = useRef(null);
  // onDone in a ref: the key handler below is bound once, and must always
  // call the latest one.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const done = () => { markFirstOpenSeen(); onDoneRef.current?.(); };
  useEffect(() => {
    // The page behind is inert while the moment is open; on close, focus
    // goes to the sign-in heading, the first thing the page asks.
    const others = [...document.body.children].filter(el => root.current && !el.contains(root.current));
    others.forEach(el => { el.inert = true; });
    go.current?.focus({ preventScroll: true, focusVisible: false });
    // Escape skips, and Tab stays inside the moment while it is open.
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); done(); return; }
      if (e.key !== 'Tab') return;
      const items = [...document.querySelectorAll('[data-first-open] button')];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      others.forEach(el => { el.inert = false; });
      const heading = document.querySelector('.auth-col h1, .auth-col .signup-title') || document.querySelector('.auth-col');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
    };
  }, []);
  return createPortal(
    <section ref={root} className="fo" role="dialog" aria-modal="true" aria-labelledby="fo-line" data-first-open>
      <svg className="fo-mark" viewBox="0 0 120 120" aria-hidden="true">
        <circle className="fo-bezel" cx="60" cy="60" r="56" pathLength="1" />
        <circle className="fo-bezel-in" cx="60" cy="60" r="50" />
        <path className="fo-p" pathLength="1" d="M44 86 V34 H62 a13 13 0 0 1 0 26 H44" />
        <path className="fo-prime" pathLength="1" d="M84 30 L78 46" />
      </svg>
      <p className="fo-line" id="fo-line">{t('first.line')}</p>
      <div className="fo-ask">
        <p className="c-label" id="fo-prompt">{t('first.prompt')}</p>
        <div className="fo-sheet">
          <Pad label={t('first.padLabel')} cleared={cleared} onInk={() => setInked(true)} />
        </div>
        <p className="fo-ack" role="status" aria-live="polite">{inked ? t('first.ack') : ' '}</p>
        <div className="fo-acts">
          {inked && <button type="button" className="fo-quiet" onClick={() => { setInked(false); setCleared(n => n + 1); }}>{t('first.clear')}</button>}
          {inked
            ? <button type="button" ref={go} className="fo-go c-btn c-btn-primary" data-first-open-continue onClick={done}>{t('first.continue')}</button>
            : <button type="button" ref={go} className="fo-skip" data-first-open-continue onClick={done}>{t('first.skip')}</button>}
        </div>
      </div>
    </section>,
    document.body
  );
}
