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
//   · stroke eraser, undo/redo, clear; serialisable strokes preserve
//     {x,y,w,t,p,azimuth,altitude} when the browser exposes Pencil dynamics.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef, useCallback } from 'react';
import { strokeStarted, strokeMoved, strokeEnded, touchRejected } from './inputMetrics.js';
import { makePenFilter } from './smooth.js';
import { penWantsEraser } from './penButtons.js';
import { useT } from '../i18n/index.js';

const BASE_W = 3.05;          // resting ink width — strong, chalk-on-board
const MIN_W = 1.5, MAX_W = 7.5;
const RAW_UPDATE = typeof window !== 'undefined' && 'onpointerrawupdate' in window;

const InkCanvas = forwardRef(function InkCanvas({
  height = 260, guides = true, tool = 'pen', fingerMode = 'auto',
  onStrokesChange, ariaLabel = null, disabled = false
}, ref) {
  const t = useT();
  const baseRef = useRef(null);        // committed ink
  const liveRef = useRef(null);        // in-progress stroke + prediction
  const wrapRef = useRef(null);
  const strokesRef = useRef([]);
  const widthRef = useRef(0);          // CSS width the committed strokes are expressed in
  const disabledRef = useRef(disabled);
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
  const hwEraseRef = useRef(false);     // this stroke erases via the stylus eraser end / S Pen button
  const fingerRef = useRef(fingerMode);
  const inkRef = useRef('#efece1');    // cached --ink, refreshed on theme change
  const ctxRef = useRef({ base: null, live: null });
  const [, force] = useState(0);
  toolRef.current = tool;
  disabledRef.current = disabled;
  fingerRef.current = fingerMode;

  // The parent's callback is read through a ref so `notify` never changes
  // identity. The sizing and pointer effects below depend on it; when it was
  // rebuilt from the prop, every parent render that rebuilt the callback
  // (InkAnswer does, whenever a reading arrives or clears) re-ran both effects
  // mid-stroke: the ResizeObserver was torn down and re-attached, its initial
  // callback re-assigned canvas.width — which clears a bitmap even when the
  // value is unchanged — and the live stroke vanished under the pen (#449).
  const onStrokesChangeRef = useRef(onStrokesChange);
  onStrokesChangeRef.current = onStrokesChange;
  const notify = useCallback(() => { onStrokesChangeRef.current?.(strokesRef.current); }, []);

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
      // desynchronized: bypasses compositor queueing where supported — lower
      // pen latency. Only the live layer asks for it: that is the layer the
      // nib is on, and it is the topmost element. The base layer is repainted
      // only when a stroke commits, gains nothing from the hint, and sits
      // under the live canvas — Chrome documents the hint for a translucent
      // canvas as valid only with no DOM element above it, which the base
      // layer always has. (Context attributes are fixed at first getContext.)
      const ctx = (key === 'live' && el.getContext('2d', { desynchronized: true })) || el.getContext('2d');
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
      // A hidden panel or a tab in the background can report a zero width for
      // a moment. A zero-sized bitmap is the ink gone and the geometry it was
      // written in forgotten; the last real size stays until a real one comes.
      if (!Number.isFinite(w) || w <= 0) return;
      // Rotation, split view or a resized window changes the width under ink
      // that was written in CSS pixels. Scale it uniformly with the width so
      // the work keeps its shape instead of being clipped (CP-03).
      // Widening never pushes ink below the sheet: the factor is clamped so the
      // lowest point stays inside the canvas height. Points are copied, never
      // mutated, so snapshots held elsewhere keep their coordinates.
      const prev = widthRef.current;
      const live = currentRef.current;
      let rescaled = false;
      if (prev > 0 && Math.abs(w - prev) >= 1 && (strokesRef.current.length || live)) {
        let f = w / prev;
        if (f > 1) {
          let maxY = 0;
          for (const stroke of strokesRef.current) for (const pt of stroke?.points || []) maxY = Math.max(maxY, pt.y);
          for (const pt of live?.points || []) maxY = Math.max(maxY, pt.y);
          if (maxY > 0) f = Math.max(1, Math.min(f, (height - 8) / maxY));
        }
        if (Math.abs(f - 1) > 1e-3) {
          const scalePoint = pt => ({ ...pt, x: pt.x * f, y: pt.y * f });
          const scale = list => list.map(stroke => ({
            ...stroke, points: (stroke?.points || []).map(scalePoint)
          }));
          strokesRef.current = scale(strokesRef.current);
          redoRef.current = scale(redoRef.current);
          // The width can change between pen-down and pen-up (a split view
          // dragged, the keyboard, a rotation): the unfinished line moves with
          // the page too, and is painted again from its first point.
          if (live) { live.points = live.points.map(scalePoint); live.drawnTo = 0; }
          rescaled = true;
          // A resolved (disabled) answer is never re-read: its marked reading
          // and verdict geometry stay exactly as they were marked.
          if (!disabledRef.current) queueMicrotask(notify);
        }
      }
      widthRef.current = w;
      const pxW = Math.round(w * dpr);
      const pxH = Math.round(height * dpr);
      const canvases = [baseRef.current, liveRef.current].filter(Boolean);
      // Assigning canvas.width or canvas.height clears the bitmap — the
      // committed page and the stroke under the pen — even when the value is
      // the one already there. ResizeObserver fires for a layout that moved by
      // a fraction of a CSS pixel (fluid widths under Windows' 125 % / 150 %
      // scale factors) and for every re-observe, none of which changes the
      // pixel size. So the bitmaps are touched only when their pixel size
      // really changes, and then both layers are painted again.
      const bitmapChanged = canvases.some(c => c.width !== pxW || c.height !== pxH);
      for (const c of canvases) {
        if (c.width !== pxW) c.width = pxW;
        if (c.height !== pxH) c.height = pxH;
        const cssW = w + 'px', cssH = height + 'px';
        if (c.style.width !== cssW) c.style.width = cssW;
        if (c.style.height !== cssH) c.style.height = cssH;
      }
      if (!bitmapChanged && !rescaled) return;
      if (bitmapChanged) primeContexts();   // a resized canvas resets its transform
      predRectRef.current = null;
      predictedRef.current = [];
      redrawBase();
      // The live layer is empty now (or its points moved): the stroke in
      // progress is painted again from its first point on the next frame.
      if (currentRef.current) {
        if (!bitmapChanged) clearLive();
        currentRef.current.drawnTo = 0;
        dirtyRef.current = true;
        scheduleFrame();
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [height, redrawBase, primeContexts, notify, scheduleFrame, clearLive]);

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

    /** Preserve the Pencil signals V4 was designed to consume. Safari exposes
     * altitudeAngle/azimuthAngle on modern iPadOS; absent values are omitted so
     * the model's data pipeline can apply the same explicit defaults it uses for
     * older captures. timeStamp is milliseconds, while V4 stores seconds. */
    const pointFromEvent = (e, pt, w) => {
      const out = { x: pt.x, y: pt.y, w, t: Math.max(0, Number(e.timeStamp || 0)) / 1000 };
      if (Number.isFinite(e.pressure)) out.p = Math.max(0, Math.min(1, Number(e.pressure)));
      if (Number.isFinite(e.azimuthAngle)) out.azimuth = Number(e.azimuthAngle);
      if (Number.isFinite(e.altitudeAngle)) out.altitude = Number(e.altitudeAngle);
      return out;
    };

    const mayDraw = (e) => {
      if (e.pointerType === 'pen') { penSeenRef.current = true; return true; }
      if (e.pointerType === 'touch') {
        const allowed = fingerRef.current === 'finger' || !penSeenRef.current;
        if (!allowed) touchRejected();
        return allowed;
      }
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

    /** Refresh the OS's guess of where the pen is heading. Predicted points are
     * display-only and never enter the model/corpus, so they intentionally carry
     * no synthetic timing or pressure metadata. */
    const takePrediction = (e, cur) => {
      predictedRef.current = (e.getPredictedEvents ? e.getPredictedEvents() : [])
        .slice(0, 4)
        .map(ev => { const p = local(ev); return { x: p.x, y: p.y, w: cur._w || BASE_W }; });
    };

    const erasing = () => toolRef.current === 'eraser' || hwEraseRef.current;

    const down = (e) => {
      if (!mayDraw(e) || activePtrRef.current !== null) return;
      activePtrRef.current = e.pointerId;
      // Capture keeps the stroke's events coming when the pen leaves the
      // canvas. It can throw (a pointer the browser no longer counts as
      // active, a canvas detached in the same tick); a stroke that fails to
      // capture must still be a stroke — and must never leave activePtrRef
      // pointing at a pointer that will never finish, which is a canvas that
      // ignores every pen-down after it.
      try { canvas.setPointerCapture?.(e.pointerId); } catch { /* uncaptured stroke; window listeners finish it */ }
      hwEraseRef.current = penWantsEraser(e);
      e.preventDefault();
      if (erasing()) { erase(e); return; }
      const raw = local(e);
      const filter = makePenFilter();
      const pt = filter(raw.x, raw.y, e.timeStamp || 0);
      const w = widthFor(e, null);
      currentRef.current = {
        points: [pointFromEvent(e, pt, w)],
        drawnTo: 0,
        filter,
        sawRaw: false,
        _cx: e.clientX, _cy: e.clientY, _t: e.timeStamp || 0, _w: w
      };
      redoRef.current = [];
      predictedRef.current = [];
      strokeStarted(e);
      clearLive();
      dirtyRef.current = true;
      scheduleFrame();
    };

    /** Accumulate movement into the live stroke. */
    const consume = (e, withPrediction) => {
      if (activePtrRef.current !== e.pointerId) return;
      if (erasing()) { erase(e); return; }
      const cur = currentRef.current;
      if (!cur) return;
      // Coalescing normally hands back the 240 Hz samples between frames, but
      // the list can come back empty (synthetic and replayed input, some
      // engines) — falling back to the event itself keeps those strokes from
      // being dropped on the floor.
      const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      const events = coalesced && coalesced.length ? coalesced : [e];
      strokeMoved(e, events);
      for (const ev of events) {
        const raw = local(ev);
        const pt = cur.filter(raw.x, raw.y, ev.timeStamp || 0);
        const last = cur.points[cur.points.length - 1];
        if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.9) continue;
        const w = widthFor(ev, cur);
        cur.points.push(pointFromEvent(ev, pt, w));
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
      if (activePtrRef.current !== e.pointerId || erasing()) return;
      takePrediction(e, cur);
      dirtyRef.current = true;
      scheduleFrame();
    };

    /**
     * The stroke ends — pen lifted, or taken away (pointercancel: the browser
     * claimed the gesture; lostpointercapture without an up: the pointer went
     * away under us). Whatever ended it, what was written is committed: a
     * cancelled stroke is the student's ink up to the moment it was cancelled,
     * never silently dropped. Either way the canvas is free for the next
     * pen-down. A second notice for the same pointer (the canvas's and the
     * window's listener, or lostpointercapture after pointerup) is a no-op.
     */
    const finish = (e) => {
      if (activePtrRef.current !== e.pointerId) return;
      activePtrRef.current = null;
      predictedRef.current = [];
      const hwErased = hwEraseRef.current;
      hwEraseRef.current = false;
      if (!hwErased && toolRef.current !== 'eraser' && currentRef.current) {
        const { points } = currentRef.current;
        currentRef.current = null;
        if (points.length) {
          strokesRef.current = [...strokesRef.current, { points }];
          paintStroke(ctxRef.current.base, points, inkRef.current);
          notify();
        }
        // Measured only after the stroke is safely committed.
        strokeEnded(e, { cancelled: e.type !== 'pointerup', kept: points.length });
        clearLive();
        force(x => x + 1);
      }
    };

    canvas.addEventListener('pointerdown', down, { passive: false });
    if (RAW_UPDATE) canvas.addEventListener('pointerrawupdate', onRaw, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('lostpointercapture', finish);
    // A stroke whose capture failed ends wherever the pointer is lifted.
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      if (RAW_UPDATE) canvas.removeEventListener('pointerrawupdate', onRaw);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', finish);
      canvas.removeEventListener('pointercancel', finish);
      canvas.removeEventListener('lostpointercapture', finish);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
    // Every dependency is identity-stable (callbacks over refs), so this runs
    // once per mount: the listeners are never torn down under a live stroke.
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
      aria-label={ariaLabel ?? t('ink.writingSpace')}
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
