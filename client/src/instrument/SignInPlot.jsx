import React, { useEffect, useRef } from 'react';
import { useT } from '../i18n/index.js';
import { EDITION_ID } from '../brand/edition.js';

// The sign-in's left half (design s10, UI9a): one real function, drawn
// properly — grid, axes, unit ticks, the curve — with a tracer moving slowly
// along it and a live x / y readout. The function is the edition's own and is
// a mathematical fact, not a syllabus claim. The canvas is aria-hidden; a
// visually hidden figcaption names the function. Still under reduced motion
// (the tracer rests at the turning point) and paused while the page is
// hidden. Loaded only in the instrument build.

const FUNCTIONS = {
  priyabhata: { f: x => x * x - 2 * x - 8, name: 'p(x)', text: 'p(x) = x² − 2x − 8', facts: 'login.plotZeroes', alt: 'login.plotAltP', turn: 1 },
  prithagoras: { f: x => x * x - 2 * x - 3, name: 'y', text: 'y = x² − 2x − 3', facts: 'login.plotTurning', alt: 'login.plotAltY', turn: 1 }
};
const X_MIN = -3;
const X_MAX = 5;
const PASS_MS = 14000;

// cubic-bezier(.45, 0, .55, 1), solved for s in [0, 1].
function ease(s) {
  const [x1, y1, x2, y2] = [0.45, 0, 0.55, 1];
  const at = (a, b, u) => 3 * a * (1 - u) * (1 - u) * u + 3 * b * (1 - u) * u * u + u * u * u;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (at(x1, x2, mid) < s) lo = mid; else hi = mid; }
  return at(y1, y2, (lo + hi) / 2);
}

export default function SignInPlot() {
  const t = useT();
  const ref = useRef(null);
  const readout = useRef(null);
  const fn = FUNCTIONS[EDITION_ID] || FUNCTIONS.priyabhata;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let clock = 0;
    let last = 0;
    const draw = now => {
      raf = 0;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) { if (!still) raf = requestAnimationFrame(draw); return; }
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const css = getComputedStyle(canvas);
      const tok = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
      // The unit is the largest that keeps the whole curve, its labels and the headline inside the frame.
      let yLo = Infinity;
      let yHi = -Infinity;
      for (let x = X_MIN; x <= X_MAX; x += 0.25) { const y = fn.f(x); yLo = Math.min(yLo, y); yHi = Math.max(yHi, y); }
      const u = Math.min(h / (yHi - yLo + 8), w / (X_MAX - X_MIN + 1.6));
      const px = x => w / 2 + (x - (X_MIN + X_MAX) / 2) * u;
      const py = y => h * 0.47 - (y - (yLo + yHi) / 2) * u;
      // Grid: 1 px, one line per unit, aligned to the axes.
      ctx.strokeStyle = tok('--in-edge', 'rgba(128,128,128,.1)');
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = Math.ceil((0 - px(0)) / u); px(0) + k * u <= w; k++) { const x = Math.round(px(0) + k * u) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let k = Math.ceil((0 - py(0)) / u); py(0) + k * u <= h; k++) { const y = Math.round(py(0) + k * u) + 0.5; ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      // Axes and unit ticks with mono labels.
      const axis = tok('--in-tx-3', '#777');
      ctx.strokeStyle = axis;
      ctx.fillStyle = axis;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(py(0)) + 0.5); ctx.lineTo(w, Math.round(py(0)) + 0.5);
      ctx.moveTo(Math.round(px(0)) + 0.5, 0); ctx.lineTo(Math.round(px(0)) + 0.5, h);
      ctx.stroke();
      ctx.font = `500 11px ${tok('--in-mono', 'ui-monospace, monospace')}`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      // Labels carry a halo in the page colour, so a curve passing under one never makes it unreadable.
      const label = (text, x, y) => { ctx.strokeStyle = tok('--in-void', '#111'); ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y); ctx.fillStyle = axis; ctx.fillText(text, x, y); };
      for (let x = X_MIN; x <= X_MAX; x++) if (x !== 0) { ctx.fillStyle = axis; ctx.fillRect(Math.round(px(x)), py(0) - 3, 1, 6); label(String(x).replace('-', '−'), px(x), py(0) + 7); }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let y = Math.ceil(yLo); y <= Math.floor(yHi); y++) if (y !== 0 && y % 2 === 0) { ctx.fillStyle = axis; ctx.fillRect(px(0) - 3, Math.round(py(y)), 6, 1); label(String(y).replace('-', '−'), px(0) - 8, py(y)); }
      // The curve, in a chart colour — never the edition accent.
      ctx.strokeStyle = tok('--in-c2', '#a7701f');
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let x = X_MIN; x <= X_MAX + 0.001; x += 0.05) { if (x === X_MIN) ctx.moveTo(px(x), py(fn.f(x))); else ctx.lineTo(px(x), py(fn.f(x))); }
      ctx.stroke();
      // The tracer: one pass (there and back) every 14 s, eased at the ends.
      if (!still) { clock += last ? Math.min(100, (now || 0) - last) : 0; last = now || 0; }
      const phase = (clock / PASS_MS) % 1;
      const s = phase < 0.5 ? phase * 2 : 2 - phase * 2;
      const tx = still ? fn.turn : X_MIN + (X_MAX - X_MIN) * ease(s);
      const ty = fn.f(tx);
      const dot = tok('--in-tx', '#111');
      ctx.fillStyle = dot;
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(px(tx), py(ty), 12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(px(tx), py(ty), 6, 0, Math.PI * 2); ctx.fill();
      if (readout.current) readout.current.textContent = `x = ${tx.toFixed(2).replace('-', '−')} · y = ${ty.toFixed(2).replace('-', '−')}`;
      if (!still && !document.hidden) raf = requestAnimationFrame(draw);
    };
    const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; } else if (!still && !raf) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVisibility); };
  }, [fn]);
  return (
    <figure className="in-signin-plot">
      <canvas ref={ref} aria-hidden="true" />
      <p className="in-signin-readout" ref={readout} aria-hidden="true" />
      <p className="in-signin-fn" aria-hidden="true"><i>{fn.text}</i><span>{t(fn.facts)}</span></p>
      <figcaption className="sr-only">{t(fn.alt)}</figcaption>
      <p className="in-signin-line" aria-hidden="true">{t('login.instrumentHeadline')}</p>
    </figure>
  );
}
