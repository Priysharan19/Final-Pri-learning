// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Native writing surface (web side)
//
// Stands in for InkCanvas inside the iPad app. It draws nothing itself: it
// reserves the space, keeps the shell told where that space is, and forwards
// the toolbar. The ink is a PencilKit canvas floating exactly over this box.
//
// The ruled paper stays here in the page, and so do the ✓/✗ marks, the red
// underline and the margin note — the native surface is transparent, so they
// show through underneath the ink the way they always did.
//
// The API is InkCanvas's, method for method, so InkAnswer neither knows nor
// cares which surface it is holding.
// ─────────────────────────────────────────────────────────────────────────────
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { nativeInk } from './native.js';

const NativeInkCanvas = forwardRef(function NativeInkCanvas({
  height = 260, guides = true, tool = 'pen', fingerMode = 'auto', disabled = false,
  onStrokesChange, ariaLabel = 'Writing space'
}, ref) {
  const wrapRef = useRef(null);
  const strokesRef = useRef([]);

  const notify = useCallback((strokes) => {
    strokesRef.current = strokes;
    onStrokesChange?.(strokes);
    // Nothing this component renders depends on the stroke array: PencilKit
    // already rendered the ink. Re-rendering React after every Pencil stroke
    // only steals main-thread time from scrolling/layout and buys no pixels.
  }, [onStrokesChange]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return undefined;

    nativeInk.mount(element);
    const stopListening = nativeInk.onStrokes(notify);

    // The shell follows scrolling itself, from WKWebView.scrollView's content
    // offset at native display cadence. Sending viewport geometry across the JS
    // bridge on every finger-scroll frame both duplicates that work and risks
    // fighting the native position update. Only actual layout/size changes are
    // reported here.
    let queued = 0;
    const report = () => {
      queued = 0;
      nativeInk.layout(element);
    };
    const schedule = () => { if (!queued) queued = requestAnimationFrame(report); };

    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    observer.observe(document.documentElement);
    window.addEventListener('resize', schedule, { passive: true });
    const themeWatcher = new MutationObserver(() => nativeInk.setAppearance());
    themeWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      if (queued) cancelAnimationFrame(queued);
      observer.disconnect();
      themeWatcher.disconnect();
      window.removeEventListener('resize', schedule);
      stopListening();
      nativeInk.unmount();
    };
  }, [notify]);

  useEffect(() => {
    nativeInk.setTool(tool === 'eraser' ? 'eraser' : 'pen', fingerMode === 'finger');
  }, [tool, fingerMode]);

  useEffect(() => { nativeInk.setEnabled(!disabled); }, [disabled]);

  useImperativeHandle(ref, () => ({
    undo() { nativeInk.undo(); },
    redo() { nativeInk.redo(); },
    clear() { nativeInk.clear(); },
    getStrokes: () => strokesRef.current,
    setStrokes(strokes) {
      strokesRef.current = strokes || [];
      nativeInk.setStrokes(strokesRef.current);
    },
    isEmpty: () => strokesRef.current.length === 0
  }), []);

  return (
    <div
      ref={wrapRef}
      className={`ink-wrap ${guides ? 'ink-ruled' : ''}`}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    />
  );
});

export default NativeInkCanvas;
