import React, { useEffect, useRef } from 'react';
import { MathText } from '../lib/latex.jsx';

// The Index scope: the chapter's mathematics drawn on a graduated instrument
// face, with a tracer the student can steer and a numeric readout. Decorative
// for marks (it never reads or sets one), but labelled for assistive tech.
//
// Drawn on a canvas so it costs nothing to React. The loop runs only while
// the figure is arriving and the tracer makes its slow sweep (SETTLE seconds),
// only while the plate is on screen and the tab visible, and never under
// reduced motion; then it rests on its last frame. A pointer over the scope
// draws one frame per move. Theme colours are read once per run, not per frame,
// so a settled scope costs the main thread nothing (battery on school iPads).

const FN = {
  wave: x => Math.sin(x * 1.3) * 1.6,
  cubic: x => (x * x * x - 4 * x) / 3,
  parabola: x => (2 * x * x - 7 * x + 3) / 3 - 1.2,
  progression: x => Math.floor(x + 6) * 0.45 - 2.4,
  triangle: x => 2.6 - Math.abs(x) * 0.95,
  circle: x => (Math.abs(x) <= 3 ? Math.sqrt(9 - x * x) - 0.6 : NaN),
  coordinate: x => 0.6 * x + 0.4,
  bars: x => 1.6 * Math.exp(-(x * x) / 4) - 0.6,
  numberLine: x => Math.sin(x * 1.1) * 1.4,
  area: x => (x > -3 && x < 3 ? 2 : -0.2),
  derivative: x => (x * x * x) / 8 - x,
  vectors: x => 0.8 * x,
  lines: x => 3.5 - x * 0.9
};

// The figure's own equation, exactly the curve drawn (an illustration of the
// chapter's mathematics, never a question or a mark).
const EQN = {
  cubic: 'y = \\tfrac{1}{3}(x^3 - 4x)',
  parabola: 'y = \\tfrac{1}{3}(2x^2 - 7x + 3) - 1.2',
  triangle: 'y = 2.6 - 0.95\\lvert x \\rvert',
  circle: 'y = \\sqrt{9 - x^2} - 0.6',
  coordinate: 'y = 0.6x + 0.4',
  derivative: 'y = \\tfrac{x^3}{8} - x',
  vectors: 'y = 0.8x',
  lines: 'y = 3.5 - 0.9x,\\; y = 0.9x - 1.3',
  unit: 'x^2 + y^2 = 1',
  wave: 'y = 1.6\\sin 1.3x',
  numberLine: 'y = 1.4\\sin 1.1x'
};

const css = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();
const SETTLE = 6;

export default function ChapterScope({ figure = 'wave', colourVar = '--in-c1', label, tracerHint = '', probeHint = '' }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const readout = useRef(null);
  const probe = useRef(-1);
  // The hints live in a ref so a language switch relabels without replaying.
  const hints = useRef({ tracerHint, probeHint });
  hints.current = { tracerHint, probeHint };

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // The arrival clock starts when the scope is first seen, not at mount.
    let start = null;
    let frame = 0;
    let pal = null;
    let lastReadout = '';
    const setReadout = html => { if (html !== lastReadout && readout.current) { lastReadout = html; readout.current.innerHTML = html; } };
    const readPalette = () => {
      pal = { col: css(box, colourVar) || css(box, '--c-ink-3'), second: css(box, '--c-ink-2'), edge: css(box, '--in-edge'), tick: css(box, '--in-tx-3'), ink: css(box, '--in-tx'), mono: css(box, '--c-text') || 'serif' };
      pal.second = pal.second || pal.col;
    };

    const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const hint = () => { const text = probe.current >= 0 ? hints.current.probeHint : hints.current.tracerHint; return text ? `<span class="in-readout-hint">${esc(text)}</span>` : ''; };
    const draw = now => {
      const dpr = window.devicePixelRatio || 1;
      const w = el.offsetWidth; const h = el.offsetHeight;
      if (!w || !h) return;
      if (el.width !== Math.round(w * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
      const c = el.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      if (!pal) readPalette();
      const { col, second, edge, tick, ink, mono } = pal;
      const sx = w / 12; const sy = h / 8;
      const X = x => w / 2 + x * sx; const Y = y => h / 2 - y * sy;

      // Graticule.
      c.strokeStyle = edge; c.lineWidth = 1; c.beginPath();
      for (let x = 0; x < w; x += 32) { c.moveTo(Math.round(x) + 0.5, 0); c.lineTo(Math.round(x) + 0.5, h); }
      for (let y = 0; y < h; y += 32) { c.moveTo(0, Math.round(y) + 0.5); c.lineTo(w, Math.round(y) + 0.5); }
      c.stroke();
      // Axes with graduated ticks and figures, like a measuring instrument.
      c.strokeStyle = tick; c.fillStyle = tick; c.font = `10.5px ${mono}`;
      c.beginPath(); c.moveTo(0, Math.round(Y(0)) + 0.5); c.lineTo(w, Math.round(Y(0)) + 0.5); c.moveTo(Math.round(X(0)) + 0.5, 0); c.lineTo(Math.round(X(0)) + 0.5, h); c.stroke();
      for (let v = -6; v <= 6; v++) {
        const x = Math.round(X(v)) + 0.5; const major = v % 2 === 0;
        c.beginPath(); c.moveTo(x, Y(0) - (major ? 5 : 3)); c.lineTo(x, Y(0) + (major ? 5 : 3)); c.stroke();
        if (major && v && Math.abs(v) < 6) c.fillText(String(v), x - 4, Y(0) + 16);
      }
      for (let v = -4; v <= 4; v++) {
        const y = Math.round(Y(v)) + 0.5; const major = v % 2 === 0;
        c.beginPath(); c.moveTo(X(0) - (major ? 5 : 3), y); c.lineTo(X(0) + (major ? 5 : 3), y); c.stroke();
        if (major && v && Math.abs(v) < 4) c.fillText(String(v), X(0) + 8, y + 3);
      }

      if (start === null) start = now;
      const t = Math.min(SETTLE, (now - start) / 1000);
      const grow = reduce ? 1 : Math.min(1, t / 1.1);
      const curve = (fn, colour) => {
        c.strokeStyle = colour; c.lineWidth = 2.4; c.lineJoin = 'round'; c.beginPath();
        let first = true;
        for (let px = 0; px <= w * grow; px += 2) {
          const y = fn((px - w / 2) / sx);
          if (!Number.isFinite(y)) continue;
          if (first) { c.moveTo(px, Y(y)); first = false; } else c.lineTo(px, Y(y));
        }
        c.stroke();
      };
      const dot = (x, y, r, colour) => { c.fillStyle = colour; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };

      let readX; let readY;
      if (figure === 'unit') {
        const r = h * 0.34; const a = reduce ? 0.7 : t * 0.7;
        c.strokeStyle = tick; c.beginPath(); c.arc(w / 2, h / 2, r, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = col; c.lineWidth = 2.4; c.beginPath();
        c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.cos(a) * r, h / 2 - Math.sin(a) * r); c.lineTo(w / 2 + Math.cos(a) * r, h / 2); c.closePath(); c.stroke();
        dot(w / 2 + Math.cos(a) * r, h / 2 - Math.sin(a) * r, 4.5, col);
        setReadout(`<span>θ = <b>${Math.round(((a % (Math.PI * 2)) * 180) / Math.PI)}°</b></span><span>sin θ = <b>${Math.sin(a).toFixed(2)}</b></span>`);
      } else {
        const fn = FN[figure] || FN.wave;
        curve(fn, col);
        if (figure === 'lines') {
          const other = x => x * 0.9 - 1.3; curve(other, second);
          if (grow >= 1) { const ix = 4.8 / 1.8; dot(X(ix), Y(fn(ix)), 4.5, ink); }
        }
        if (figure === 'parabola' && grow >= 1) [0.5, 3].forEach(root => dot(X(root), Y(0), 4.5, ink));
        const tr = probe.current >= 0 ? probe.current : (reduce ? 0.64 : 0.5 + 0.42 * Math.sin(t * 0.55));
        const px = tr * w; readX = (px - w / 2) / sx; readY = fn(readX);
        if (Number.isFinite(readY)) {
          c.strokeStyle = edge; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(px, 0); c.lineTo(px, h); c.moveTo(0, Y(readY)); c.lineTo(w, Y(readY)); c.stroke(); c.setLineDash([]);
          dot(px, Y(readY), 5, col);
        }
        setReadout(`<span>x = <b>${readX.toFixed(2)}</b></span><span>y = <b>${Number.isFinite(readY) ? readY.toFixed(2) : '—'}</b></span>${hint()}`);
      }
    };

    // Runs only while the scope is on screen, the tab is visible and the
    // figure has not yet settled; afterwards it draws on demand.
    let visible = true;
    const settled = now => reduce || (start !== null && (now - start) / 1000 >= SETTLE);
    const loop = now => { frame = 0; draw(now); if (!settled(now) && visible && !document.hidden) frame = requestAnimationFrame(loop); };
    const resume = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(loop); };
    const once = () => { if (!frame) frame = requestAnimationFrame(loop); };
    const io = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) resume(); else if (start !== null && !settled(performance.now())) start = null; })
      : null;
    io?.observe(box);
    const onVisibility = () => { if (!document.hidden && visible) resume(); };
    document.addEventListener('visibilitychange', onVisibility);
    frame = requestAnimationFrame(loop);
    const move = e => { const r = el.getBoundingClientRect(); probe.current = (e.clientX - r.left) / r.width; once(); };
    const leave = () => { probe.current = -1; once(); };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerleave', leave);
    const resize = () => { pal = null; once(); };
    // A theme change restyles the box: read the palette again and redraw once.
    // Only a real change counts: other code rewrites html's class to the same
    // value (a no-op classList.remove still queues a record), and redrawing on
    // those would loop through the readout's own DOM writes.
    const look = () => `${document.documentElement.className}|${document.documentElement.dataset.theme}`;
    let seen = look();
    const themeWatch = typeof MutationObserver === 'function' ? new MutationObserver(() => { const now = look(); if (now !== seen) { seen = now; resize(); } }) : null;
    themeWatch?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame); io?.disconnect(); themeWatch?.disconnect(); document.removeEventListener('visibilitychange', onVisibility); box.removeEventListener('pointermove', move); box.removeEventListener('pointerleave', leave); window.removeEventListener('resize', resize); };
  }, [figure, colourVar]);

  return (
    <div className="in-scope" ref={wrap} role="img" aria-label={label} data-instrument-scope={figure}>
      <canvas ref={canvas} aria-hidden="true" />
      <div className="in-readout" ref={readout} aria-hidden="true" />
      {EQN[figure] && <div className="in-eqn" aria-hidden="true"><MathText text={`$${EQN[figure]}$`} /></div>}
    </div>
  );
}
