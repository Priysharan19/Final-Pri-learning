// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Ink canvas — an Apple Pencil-first writing surface.
//
// Built for feel:
//   · two layers — committed ink on a base canvas, the live stroke on its own.
//     Writing never repaints what's already on the page.
//   · the live stroke is drawn INCREMENTALLY: each frame touches only the few
//     pixels around the pen tip. Repainting the whole live stroke every frame
//     made long strokes — fraction bars, big brackets, a long division sign —
//     cost more with every point they gained.
//   · pointerrawupdate where available: the earliest the browser will say the
//     pen moved. 240 Hz coalesced samples, predicted points drawn ahead of the
//     tip so the ink meets the nib.
//   · 1€-filtered input — hand tremor removed without adding lag on fast
//     strokes, at settings swept against the recogniser (see smooth.js).
//   · ink colour and canvas contexts are cached. Reading a CSS custom property
//     forces a style recalculation, and doing that inside the frame loop is a
//     reliable way to make a pen feel sticky.
//   · pressure + velocity shaped ink, EMA-smoothed width, midpoint quadratics.
//   · palm rejection: once a Pencil is seen, fingers never draw (they scroll);
//     an explicit finger mode brings touch drawing back.
//   · stroke eraser, undo/redo, clear; serialisable strokes {x, y, w}.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef, useCallback } from 'react';
import { makePenFilter } from './smooth.js';

const BASE_W = 3.05;          // resting ink width — strong, chalk-on-board
const MIN_W = 1.5, MAX_W = 7.5;
const RAW_UPDATE = typeof window !== 'undefined' && 'onpointerrawupdate' in window;

const InkCanvas = forwardRef(function InkCanvas({
  height = 260, guides = true, tool = 'pen', fingerMode = 'auto',
  onStrokesChange, ariaLabel = 'Writing space'
}, ref) {
  const baseRef = useRef(null);        // committed ink
  const liveRef = useRef(null);        // in-progress stroke + prediction
  const wrapRef = useRef(null);
  const strokesRef = useRef([]);
  const redoRef = useRef([]);
  const currentRef = useRef(null);     // { points, drawnTo, filter, _cx,_cy,_t,_w }
  const predictedRef = useRef([]);
  const predRectRef = useRef(null);    // what the last frame's prediction painted
  const penSeenRef = useRef(false);
  const activePtrRef = useRef(null);
  const rafRef = useRef(0);
  const dirtyRef = useRef(false);
  const lastEraseRef = useRef(0);
  const toolRef = useRef(tool);
  const fingerRef = useRef(fingerMode);
  const inkRef = useRef('#efece1');    // cached --ink, refreshed on theme change
  const ctxRef = useRef({ base: null, live: null });
  const [, force] = useState(0);
  toolRef.current = tool;
  fingerRef.current = fingerMode;

  const notify = useCallback(() => { onStrokesChange?.(strokesRef.current); }, [onStrokesChange]);

  /** Reading a CSS custom property forces a style recalc, so it never happens
   *  in the frame loop — only when the theme actually changes. */
  const refreshInk = useCallback(() => {
    inkRef.current =
      getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#efece1';
  }, []);

  /** Contexts are cached. A canvas resize resets the transform, so sizing
   *  re-primes them instead of every paint re-applying it. */
  const primeContexts = useCallback(() => {
    const dpr = window.devicePixelRatio || 1;
    const out = { base: null, live: null };
    for (const [key, el] of [['base', baseRef.current], ['live', liveRef.current]]) {
      if (!el) continue;
      // desynchronized: bypasses compositor queueing where supported — lower pen latency
      const ctx = el.getContext('2d', { desynchronized: true }) || el.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      out[key] = ctx;
    }
    ctxRef.current = out;
  }, []);

  /**
   * Paint segments [from … to) of a stroke as midpoint-smoothed quadratics.
   * A segment's curve borrows the point before it for its control handle, so a
   * partial repaint reaches one point further back than it redraws.
   */
  const paintRange = (ctx, pts, from, to, color, alpha = 1) => {
    if (!ctx) return;
    if (pts.length === 1) {
      if (from <= 1) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, Math.max(1.6, (pts[0].w || BASE_W) / 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      return;
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    for (let i = Math.max(1, from); i < to; i++) {
      const p0 = pts[i - 1], p1 = pts[i];
      ctx.beginPath();
      ctx.lineWidth = Math.max(MIN_W, ((p0.w || BASE_W) + (p1.w || BASE_W)) / 2);
      if (i === 1) ctx.moveTo(p0.x, p0.y);
      else ctx.moveTo((pts[i - 2].x + p0.x) / 2, (pts[i - 2].y + p0.y) / 2);
      ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  const paintStroke = (ctx, pts, color, alpha = 1) =>
    paintRange(ctx, pts, 1, pts.length, color, alpha);

  const redrawBase = useCallback(() => {
    const ctx = ctxRef.current.base;
    const canvas = baseRef.current;
    if (!ctx || !canvas) return;
    refreshInk();
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    for (const s of strokesRef.current) paintStroke(ctx, s.points, inkRef.current);
  }, [refreshInk]);

  const clearLive = useCallback(() => {
    const ctx = ctxRef.current.live;
    const canvas = liveRef.current;
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    predRectRef.current = null;
  }, []);

  /**
   * One paint per display frame while the pen is down, over only what changed.
   * Two things need painting: the segments added since the last frame, and the
   * area the previous frame's predicted tail covered — that has to be erased
   * before the pen's real path diverges from it and leaves visible overshoot.
   */
  const renderLive = useCallback(() => {
    rafRef.current = 0;
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const ctx = ctxRef.current.live;
    const cur = currentRef.current;
    if (!ctx || !cur) return;
    const ink = inkRef.current;
    const pts = cur.points;
    const pad = MAX_W + 2;

    let from = cur.drawnTo;
    const stale = predRectRef.current;
    if (stale) {
      ctx.clearRect(stale.x1, stale.y1, stale.x2 - stale.x1, stale.y2 - stale.y1);
      // confirmed ink that ran through the erased box has to be put back
      for (let i = cur.drawnTo - 1; i >= 1; i--) {
        const p = pts[i];
        if (p.x + pad < stale.x1 || p.x - pad > stale.x2 ||
            p.y + pad < stale.y1 || p.y - pad > stale.y2) break;
        from = i;
      }
    }
    paintRange(ctx, pts, from, pts.length, ink);
    cur.drawnTo = pts.length;

    // predicted tail — ahead of the tip, faded so overshoot reads as soft
    let rect = null;
    const pred = predictedRef.current;
    if (pred.length && pts.length) {
      const tail = [pts[pts.length - 1], ...pred];
      paintStroke(ctx, tail, ink, 0.55);
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const p of tail) {
        if (p.x < x1) x1 = p.x;
        if (p.x > x2) x2 = p.x;
        if (p.y < y1) y1 = p.y;
        if (p.y > y2) y2 = p.y;
      }
      rect = { x1: x1 - pad, y1: y1 - pad, x2: x2 + pad, y2: y2 + pad };
    }
    predRectRef.current = rect;
  }, []);

  const scheduleFrame = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(renderLive);
  }, [renderLive]);

  // ── sizing ──
  useEffect(() => {
    const wrap = wrapRef.current;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      for (const c of [baseRef.current, liveRef.current]) {
        if (!c) continue;
        c.width = Math.round(w * dpr);
        c.height = Math.round(height * dpr);
        c.style.width = w + 'px';
        c.style.height = height + 'px';
      }
      primeContexts();
      predRectRef.current = null;
      redrawBase();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [height, redrawBase, primeContexts]);

  // repaint committed ink when the theme flips (this also refreshes cached ink)
  useEffect(() => {
    const mo = new MutationObserver(redrawBase);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [redrawBase]);

  // ── input (native listeners — no per-event React overhead) ──
  useEffect(() => {
    const canvas = liveRef.current;
    if (!canvas) return;

    const local = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const widthFor = (e, cur) => {
      const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
      let v = 0;
      if (cur) {
        const dt = Math.max(1, (e.timeStamp || 0) - cur._t);
        v = Math.hypot(e.clientX - cur._cx, e.clientY - cur._cy) / dt;   // px/ms
      }
      const speedThin = Math.max(0.6, 1 - v * 0.18);
      const target = Math.max(MIN_W, Math.min(MAX_W, BASE_W * (0.5 + pressure * 1.3) * speedThin));
      return cur && cur._w ? cur._w * 0.55 + target * 0.45 : target;   // EMA — no width flicker
    };

    const mayDraw = (e) => {
      if (e.pointerType === 'pen') { penSeenRef.current = true; return true; }
      if (e.pointerType === 'touch') return fingerRef.current === 'finger' || !penSeenRef.current;
      return true;   // mouse / trackpad
    };

    const erase = (e) => {
      const now = e.timeStamp || performance.now();
      if (now - lastEraseRef.current < 24) return;
      lastEraseRef.current = now;
      const pt = local(e);
      const R = 16;
      const before = strokesRef.current.length;
      strokesRef.current = strokesRef.current.filter(s =>
        !s.points.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) < R));
      if (strokesRef.current.length !== before) { notify(); redrawBase(); }
    };

    /** Refresh the OS's guess of where the pen is heading. */
    const takePrediction = (e, cur) => {
      predictedRef.current = (e.getPredictedEvents ? e.getPredictedEvents() : [])
        .slice(0, 4)
        .map(ev => { const p = local(ev); return { x: p.x, y: p.y, w: cur._w || BASE_W }; });
    };

    const down = (e) => {
      if (!mayDraw(e) || activePtrRef.current !== null) return;
      activePtrRef.current = e.pointerId;
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      if (toolRef.current === 'eraser') { erase(e); return; }
      const raw = local(e);
      const filter = makePenFilter();
      const pt = filter(raw.x, raw.y, e.timeStamp || 0);
      currentRef.current = {
        points: [{ x: pt.x, y: pt.y, w: widthFor(e, null) }],
        drawnTo: 0,
        filter,
        sawRaw: false,
        _cx: e.clientX, _cy: e.clientY, _t: e.timeStamp || 0, _w: 0
      };
      redoRef.current = [];
      predictedRef.current = [];
      clearLive();
      dirtyRef.current = true;
      scheduleFrame();
    };

    /** Accumulate movement into the live stroke. */
    const consume = (e, withPrediction) => {
      if (activePtrRef.current !== e.pointerId) return;
      if (toolRef.current === 'eraser') { erase(e); return; }
      const cur = currentRef.current;
      if (!cur) return;
      // Coalescing normally hands back the 240 Hz samples between frames, but
      // the list can come back empty (synthetic and replayed input, some
      // engines) — falling back to the event itself keeps those strokes from
      // being dropped on the floor.
      const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      const events = coalesced && coalesced.length ? coalesced : [e];
      for (const ev of events) {
        const raw = local(ev);
        const pt = cur.filter(raw.x, raw.y, ev.timeStamp || 0);
        const last = cur.points[cur.points.length - 1];
        if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.9) continue;
        const w = widthFor(ev, cur);
        cur.points.push({ x: pt.x, y: pt.y, w });
        cur._cx = ev.clientX; cur._cy = ev.clientY; cur._t = ev.timeStamp || 0; cur._w = w;
      }
      if (withPrediction) takePrediction(e, cur);
      dirtyRef.current = true;
      scheduleFrame();
    };

    // pointerrawupdate arrives before pointermove, so where it fires it owns
    // point accumulation and pointermove only carries the predicted points
    // rawupdate lacks. Letting both accumulate would add every sample twice.
    //
    // But the handover is decided per stroke by what actually arrives, never by
    // feature detection alone: the event is non-standard, fires only for
    // trusted input, and an earlier version of this that deferred to it on
    // detection alone silently dropped every point of a stroke when it didn't
    // come. Until a stroke has seen one, pointermove does the accumulating.
    const onRaw = (e) => {                       // not cancelable — no preventDefault
      const cur = currentRef.current;
      if (cur && activePtrRef.current === e.pointerId) cur.sawRaw = true;
      consume(e, false);
    };
    const onMove = (e) => {
      e.preventDefault();
      const cur = currentRef.current;
      if (!cur || !cur.sawRaw) { consume(e, true); return; }
      if (activePtrRef.current !== e.pointerId || toolRef.current === 'eraser') return;
      takePrediction(e, cur);
      dirtyRef.current = true;
      scheduleFrame();
    };

    const finish = (e) => {
      if (activePtrRef.current !== e.pointerId) return;
      activePtrRef.current = null;
      predictedRef.current = [];
      if (toolRef.current !== 'eraser' && currentRef.current) {
        const { points } = currentRef.current;
        currentRef.current = null;
        if (points.length) {
          strokesRef.current = [...strokesRef.current, { points }];
          paintStroke(ctxRef.current.base, points, inkRef.current);
          notify();
        }
        clearLive();
        force(x => x + 1);
      }
    };

    canvas.addEventListener('pointerdown', down, { passive: false });
    if (RAW_UPDATE) canvas.addEventListener('pointerrawupdate', onRaw, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      if (RAW_UPDATE) canvas.removeEventListener('pointerrawupdate', onRaw);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', finish);
      canvas.removeEventListener('pointercancel', finish);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify, redrawBase, scheduleFrame, clearLive]);

  useImperativeHandle(ref, () => ({
    undo() {
      if (!strokesRef.current.length) return;
      redoRef.current.push(strokesRef.current[strokesRef.current.length - 1]);
      strokesRef.current = strokesRef.current.slice(0, -1);
      notify(); redrawBase(); force(x => x + 1);
    },
    redo() {
      const s = redoRef.current.pop();
      if (!s) return;
      strokesRef.current = [...strokesRef.current, s];
      notify(); redrawBase(); force(x => x + 1);
    },
    clear() {
      if (!strokesRef.current.length) return;
      redoRef.current = [...strokesRef.current].reverse();
      strokesRef.current = [];
      notify(); redrawBase(); force(x => x + 1);
    },
    getStrokes: () => strokesRef.current,
    setStrokes(strokes) {
      strokesRef.current = strokes || [];
      redoRef.current = [];
      notify(); redrawBase(); force(x => x + 1);
    },
    isEmpty: () => strokesRef.current.length === 0
  }), [notify, redrawBase]);

  return (
    <div
      ref={wrapRef}
      className={`ink-wrap ${guides ? 'ink-ruled' : ''}`}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <canvas ref={baseRef} className="ink-canvas ink-canvas-base" aria-hidden="true" />
      <canvas
        ref={liveRef}
        className={`ink-canvas ink-canvas-live ${tool === 'eraser' ? 'ink-erasing' : ''}`}
      />
    </div>
  );
});

export default InkCanvas;
