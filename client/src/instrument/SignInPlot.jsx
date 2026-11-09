import React, { useEffect, useRef } from 'react';
import { useT } from '../i18n/index.js';

// A real, pointer-inspectable mathematical example, not a simulated grade.
// All points are evaluated from f(x)=x³−3x; pointer changes trigger redraws,
// never a continuous animation or React rerenders.
const fn = x => x * x * x - 3 * x;
const range = [-2.3, 2.3];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const value = x => (Math.abs(x) < 0.005 ? '0.00' : x.toFixed(2));

export default function SignInPlot() {
  const t = useT();
  const canvasRef = useRef(null);
  const readoutRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return undefined;
    let probe = 1.15, frame = 0, live = true;
    const draw = () => {
      frame = 0;
      if (!live) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w < 30 || h < 30) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const compact = h < 240;
      const px = compact ? 16 : Math.min(88, w * .10);
      const py = compact ? 15 : Math.min(180, h * .24);
      const gw = w - 2 * px, gh = h - 2 * py;
      if (gw < 20 || gh < 20) return;
      const sx = x => px + (x - range[0]) / (range[1] - range[0]) * gw;
      const sy = y => py + (5 - y) / 10 * gh;
      const grid = (spacing, color) => {
        ctx.lineWidth = 1; ctx.strokeStyle = color; ctx.beginPath();
        for (let x = -2; x <= 2; x += spacing) { ctx.moveTo(sx(x), py); ctx.lineTo(sx(x), py + gh); }
        for (let y = -5; y <= 5; y += spacing) { ctx.moveTo(px, sy(y)); ctx.lineTo(px + gw, sy(y)); }
        ctx.stroke();
      };
      grid(.5, 'rgba(230,232,246,.055)');
      grid(1, 'rgba(230,232,246,.095)');
      ctx.strokeStyle = 'rgba(230,232,246,.36)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx(0), py); ctx.lineTo(sx(0), py+gh);
      ctx.moveTo(px, sy(0)); ctx.lineTo(px+gw, sy(0)); ctx.stroke();
      for (const root of [-Math.sqrt(3), 0, Math.sqrt(3)]) {
        ctx.beginPath(); ctx.moveTo(sx(root), sy(0)-4); ctx.lineTo(sx(root), sy(0)+4); ctx.stroke();
      }
      ctx.strokeStyle = '#d8b87e'; ctx.lineWidth = compact ? 1.6 : 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let n = 0; n <= 400; n++) {
        const x = range[0] + (range[1] - range[0]) * n / 400;
        if (n) ctx.lineTo(sx(x), sy(fn(x))); else ctx.moveTo(sx(x), sy(fn(x)));
      }
      ctx.stroke();
      const x = clamp(probe, ...range), y = fn(x), cx = sx(x), cy = sy(y);
      ctx.setLineDash([2,5]); ctx.strokeStyle = 'rgba(181,170,255,.58)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, py); ctx.lineTo(cx, py+gh);
      ctx.moveTo(px, cy); ctx.lineTo(px+gw, cy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#b4a6ff'; ctx.beginPath(); ctx.arc(cx,cy,compact?3.5:5,0,Math.PI*2);ctx.fill();
      if (readoutRef.current) readoutRef.current.textContent = 'x ' + value(x) + '  /  f(x) ' + value(y);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const resize = new ResizeObserver(schedule); resize.observe(canvas);
    const move = e => {
      if (e.pointerType === 'touch') return;
      const box = canvas.getBoundingClientRect();
      const px = box.height < 240 ? 16 : Math.min(88, box.width * .10);
      probe = range[0] + clamp((e.clientX-box.left-px) / Math.max(box.width-2*px,1),0,1) * (range[1]-range[0]);
      schedule();
    };
    canvas.addEventListener('pointermove',move,{passive:true});
    window.addEventListener('resize',schedule); schedule();
    return () => {live=false; resize.disconnect(); window.removeEventListener('resize',schedule); canvas.removeEventListener('pointermove',move); cancelAnimationFrame(frame);};
  },[]);
  return (
    <div className="in-signin-plot" aria-hidden="true">
      <div className="pri-plot-top"><span>PRI / MATHEMATICS</span><span>INTERACTIVE STUDY</span></div>
      <canvas ref={canvasRef}/>
      <span className="pri-plot-equation">f(x) = x³ − 3x <small>EXAMPLE</small></span>
      <div className="pri-plot-foot">
        <p className="in-signin-line">{t('login.instrumentHeadline')}</p>
        <span className="pri-plot-value" ref={readoutRef}>x 1.15 / f(x) −1.93</span>
      </div>
    </div>
  );
}
