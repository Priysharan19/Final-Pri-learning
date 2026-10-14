import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import InkCanvas from '../../src/ink/InkCanvas.jsx';

function Fixture() {
  const canvasRef = useRef(null);
  const [width, setWidth] = useState(620);
  const [updates, setUpdates] = useState(0);
  const [strokes, setStrokes] = useState(0);
  // Deliberately changes identity on EVERY re-render. The previous canvas
  // re-subscribed ResizeObserver and reassigned canvas.width each time.
  const changed = current => {
    setStrokes(current.length);
    setUpdates(n => n + 1);
  };
  window.__inkTest = {
    poke: () => setUpdates(n => n + 1),
    resize: w => setWidth(w),
    getStrokes: () => canvasRef.current?.getStrokes(),
    undo: () => canvasRef.current?.undo()
  };
  return <div id="fixture" style={{ width }}>
    <span id="update-count">{updates}</span>
    <span id="stroke-count">{strokes}</span>
    <InkCanvas ref={canvasRef} onStrokesChange={changed} guides={false} height={300} />
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
