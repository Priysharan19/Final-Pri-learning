// ─────────────────────────────────────────────────────────────────────────────
// Fixture for client/test/ink-canvas-loss-browser-check.mjs (#449).
//
// The real InkCanvas, mounted under a stand-in for the InkAnswer → QuestionCard
// pair. The stand-in reproduces the two things the real parents do to the
// canvas while a student writes:
//   · the strokes callback changes identity on every parent render (InkAnswer's
//     onStrokesChange is rebuilt whenever a reading arrives or clears);
//   · the wrapper's CSS width moves by fractions of a pixel (Windows fractional
//     device-pixel ratios and fluid layouts), so ResizeObserver fires without
//     the canvas's pixel size changing.
// `#submit` mirrors QuestionCard's `inkHasStrokes` gate only: it is enabled when
// the canvas reports strokes. It is NOT the app's Submit and claims nothing
// about reading or marking.
//
// `?height=<px>&width=<px>` mounts the canvas at another size. The check uses
// it to mount at a pixel size equal to a fresh <canvas>'s default 300×150
// bitmap (height 200 in a 400 px column at dpr 0.75 — the QuestionCard
// scribble pad at 75 % zoom), where a first resize changes nothing visible.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import InkCanvas from '../../src/ink/InkCanvas.jsx';

const params = new URLSearchParams(window.location.search);
const HEIGHT = Number(params.get('height')) || 300;
const WIDTH = Number(params.get('width')) || 620;

function Fixture() {
  const canvasRef = useRef(null);
  const [width, setWidth] = useState(`${WIDTH}px`);
  const [renders, setRenders] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [reports, setReports] = useState(0);

  // Deliberately a new function every render: InkAnswer's onStrokesChange has
  // the same property whenever `rec.lines.length` changes.
  const changed = current => {
    setStrokes(current.length);
    setReports(n => n + 1);
  };

  useEffect(() => {
    window.__ink = {
      poke: () => setRenders(n => n + 1),
      setWidth: w => setWidth(typeof w === 'number' ? `${w}px` : String(w)),
      getStrokes: () => canvasRef.current?.getStrokes() || [],
      undo: () => canvasRef.current?.undo(),
      setTheme: theme => document.documentElement.setAttribute('data-theme', theme)
    };
  }, []);

  return (
    <div id="fixture" style={{ width }}>
      <span id="render-count">{renders}</span>
      <span id="stroke-count">{strokes}</span>
      <span id="report-count">{reports}</span>
      <button id="submit" type="button" disabled={strokes === 0}>Submit (mirror of inkHasStrokes)</button>
      <InkCanvas ref={canvasRef} onStrokesChange={changed} guides={false} height={HEIGHT} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Fixture />);
