import React, { useEffect, useRef } from 'react';

// The Index scope: the chapter's mathematics drawn on a graduated instrument
// face, with a tracer the student can steer and a numeric readout. Decorative
// for marks (it never reads or sets one), but labelled for assistive tech.
//
// Drawn on a canvas so it costs nothing to React; one requestAnimationFrame
// loop while the plate is on screen, none under reduced motion.

const FN = {
  wave: x => Math.sin(x * 1.3) * 1.6,
  cubic: x => (x * x * x - 4 * x) / 3,
  parabola: x => (2 * x * x - 7 * x + 3) / 3 - 1.2,
  progression: x => Math.floor(x + 6) * 0.45 - 2.4,
  triangle: x => 2.6 - Math.abs(x) * 0.95,
  circle: x => Math.sqrt(Math.max(0, 9 - x * x)) - 0.6,
  coordinate: x => 0.6 * x + 0.4,
  bars: x => 1.6 * Math.exp(-(x * x) / 4) - 0.6,
  numberLine: x => Math.sin(x * 1.1) * 1.4,
  area: x => (x > -3 && x < 3 ? 2 : -0.2),
  derivative: x => (x * x * x) / 8 - x,
  vectors: x => 0.8 * x,
  lines: x => 3.5 - x * 0.9
};

const css = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

export default function ChapterScope({ figure = 'wave', colourVar = '--in-c1', label }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const readout = useRef(null);
  const probe = useRef(-1);

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let frame = 0;

    const draw = now => {
      const dpr = window.devicePixelRatio || 1;
      const w = el.offsetWidth; const h = el.offsetHeight;
      if (!w || !h) return;
      if (el.width !== Math.round(w * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
      const c = el.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const col = css(box, colourVar) || '#888';
      const second = css(box, '--in-c3') || col;
      const edge = css(box, '--in-edge');
      const tick = css(box, '--in-tx-3');
      const ink = css(box, '--in-tx');
      const mono = css(box, '--in-mono') || 'monospace';
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

      const t = (now - start) / 1000;
      const grow = reduce ? 1 : Math.min(1, t / 1.1);
      const curve = (fn, colour) => {
        c.strokeStyle = colour; c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath();
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
        c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
        c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.cos(a) * r, h / 2 - Math.sin(a) * r); c.lineTo(w / 2 + Math.cos(a) * r, h / 2); c.closePath(); c.stroke();
        dot(w / 2 + Math.cos(a) * r, h / 2 - Math.sin(a) * r, 4.5, col);
        readout.current && (readout.current.innerHTML = `<span>θ = <b>${Math.round(((a % (Math.PI * 2)) * 180) / Math.PI)}°</b></span><span>sin θ = <b>${Math.sin(a).toFixed(2)}</b></span>`);
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
        readout.current && (readout.current.innerHTML = `<span>x = <b>${readX.toFixed(2)}</b></span><span>y = <b>${Number.isFinite(readY) ? readY.toFixed(2) : '—'}</b></span>`);
      }
    };

    const loop = now => { draw(now); if (!reduce) frame = requestAnimationFrame(loop); };
    frame = requestAnimationFrame(loop);
    const move = e => { const r = el.getBoundingClientRect(); probe.current = (e.clientX - r.left) / r.width; if (reduce) draw(performance.now()); };
    const leave = () => { probe.current = -1; if (reduce) draw(performance.now()); };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerleave', leave);
    const resize = () => reduce && draw(performance.now());
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame); box.removeEventListener('pointermove', move); box.removeEventListener('pointerleave', leave); window.removeEventListener('resize', resize); };
  }, [figure, colourVar]);

  return (
    <div className="in-scope" ref={wrap} role="img" aria-label={label} data-instrument-scope={figure}>
      <canvas ref={canvas} aria-hidden="true" />
      <div className="in-readout" ref={readout} aria-hidden="true" />
    </div>
  );
}
