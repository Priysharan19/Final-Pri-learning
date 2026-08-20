// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Handwriting calibration
// A two-minute guided flow: write each symbol once in your own hand and the
// recogniser stores it as a personal template that outranks the stock shapes.
// Corrections made while practising keep teaching it forever after.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useState } from 'react';
import InkCanvas from './InkCanvas.jsx';
import { addPersonal, personalStats, clearPersonal, ensurePersonalLoaded } from './personal.js';

const PROMPTS = [
  ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'],
  ['5', '5'], ['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'],
  ['x', 'x'], ['y', 'y'], ['+', '+'], ['-', '−'], ['=', '='],
  ['(', '('], [')', ')'], ['/', '/'], ['.', '· (decimal point)'], ['sqrt', '√'],
  ['pi', 'π'], ['theta', 'θ'], ['<', '<'], ['>', '>'],
  ['s', 's'], ['i', 'i'], ['n', 'n'], ['c', 'c'], ['o', 'o'],
  ['t', 't'], ['a', 'a'], ['e', 'e'], ['l', 'l'], ['g', 'g'],
];

export default function Calibrate({ onDone, toast }) {
  const canvasRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const [saved, setSaved] = useState(0);
  const [finished, setFinished] = useState(false);
  ensurePersonalLoaded();

  const [sym, label] = PROMPTS[Math.min(idx, PROMPTS.length - 1)];

  const advance = () => {
    canvasRef.current?.clear();
    if (idx + 1 >= PROMPTS.length) setFinished(true);
    else setIdx(idx + 1);
  };

  const save = async () => {
    const strokes = canvasRef.current?.getStrokes() || [];
    if (!strokes.length) { advance(); return; }
    await addPersonal(sym, strokes, 'calibration');
    setSaved(s => s + 1);
    advance();
  };

  if (finished) {
    const stats = personalStats();
    return (
      <div className="card" style={{ textAlign: 'center', padding: 28 }}>
        <h3>That's your hand learned.</h3>
        <p className="sub" style={{ margin: '10px auto 16px', maxWidth: 420 }}>
          {saved} sample{saved === 1 ? '' : 's'} saved — {stats.total} personal template{stats.total === 1 ? '' : 's'} in total.
          They now outrank the built-in shapes, and every correction you make while practising adds more.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={onDone}>Done</button>
          <button className="btn btn-ghost" onClick={() => { setIdx(0); setFinished(false); }}>Another round</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="card-head">
        <span className="sc-label" style={{ margin: 0 }}>Teach it your handwriting</span>
        <span style={{ flex: 1 }} />
        <span className="muted">{idx + 1} / {PROMPTS.length}</span>
      </div>
      <div style={{ padding: '16px 18px 6px', textAlign: 'center' }}>
        <div className="muted" style={{ fontSize: 13 }}>Write this symbol the way YOU write it, then save:</div>
        <div style={{ fontSize: 54, lineHeight: 1.3, fontFamily: 'var(--font)' }}>{label}</div>
      </div>
      <InkCanvas ref={canvasRef} height={190} guides={false} ariaLabel={`Write ${label}`} />
      <div className="row" style={{ padding: '10px 14px', borderTop: '1px solid var(--hairline)' }}>
        <button className="btn btn-quiet btn-sm" onClick={() => canvasRef.current?.clear()}>Clear</button>
        <button className="btn btn-quiet btn-sm" onClick={advance}>Skip</button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-quiet btn-sm" onClick={onDone}>Stop</button>
        <button className="btn btn-primary btn-sm" onClick={save}>Save & next →</button>
      </div>
    </div>
  );
}

export { personalStats, clearPersonal };
