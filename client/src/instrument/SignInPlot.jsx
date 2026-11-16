import React, { useEffect, useRef } from 'react';
import { useT } from '../i18n/index.js';

// The sign-in's left half (design s10): the instrument at work, a few plots
// drifting across a grid. Purely decorative — aria-hidden, no data, and still
// (one frame, no animation) under prefers-reduced-motion. Loaded only in the
// instrument build.

const CURVES = [
  ['--in-c3', (x, h, t) => h * 0.42 + Math.sin(x * 0.012 + t) * h * 0.1],
  ['--in-c1', (x, h, t, w) => h * 0.28 + ((x - w * (0.55 + Math.sin(t) * 0.05)) / w) ** 2 * h * 1.1],
  ['--in-c2', (x, h, t, w) => h * 0.72 - (x / w) * h * 0.32],
  ['--in-c5', (x, h, t) => h * 0.56 + Math.sin(x * 0.02 + t * 1.3) * h * 0.035],
  ['--in-c7', (x, h, t) => h * 0.84 + Math.sin(x * 0.03 + t) * 12]
];

export default function SignInPlot() {
  const t = useT();
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let t0 = 0;
    const draw = now => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) { raf = still ? 0 : requestAnimationFrame(draw); return; }
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const css = getComputedStyle(canvas);
      ctx.strokeStyle = css.getPropertyValue('--in-edge').trim() || 'rgba(128,128,128,.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0.5; x < w; x += 29) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = 0.5; y < h; y += 29) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      if (!t0) t0 = now || 0;
      const time = still ? 0 : ((now || 0) - t0) / 4000;
      ctx.lineWidth = 1.4;
      for (const [token, f] of CURVES) {
        ctx.strokeStyle = css.getPropertyValue(token).trim() || '#888';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        let started = false;
        for (let x = 0; x <= w; x += 3) {
          const y = f(x, h, time, w);
          if (y < -20 || y > h + 20) { started = false; continue; }
          if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="in-signin-plot" aria-hidden="true">
      <canvas ref={ref} />
      <p className="in-signin-line">{t('login.instrumentHeadline')}</p>
    </div>
  );
}
